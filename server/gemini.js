import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { SYSTEM_PROMPT, FEW_SHOT_EXAMPLES } from './prompt.js';
import { geminiResponseSchema, repairAndValidate, getFallbackPreset } from './schema.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let ai = null;
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!ai && apiKey) {
    try {
      ai = new GoogleGenAI({ apiKey });
    } catch (err) {
      console.error('Failed to initialize GoogleGenAI client:', err.message);
    }
  }
  return ai;
}

async function callWithTimeout(promise, ms = 10000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateJam({ prompt, audioBase64, extractedNotes, taps, providedHint = 'prompt' }) {
  const startTime = Date.now();
  const client = getGenAIClient();
  const useFallbackOnly = process.env.USE_FALLBACK_ONLY === 'true';
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (useFallbackOnly || !client) {
    const elapsed = Date.now() - startTime;
    console.log(`[Gemini] Using fallback preset (offline/USE_FALLBACK_ONLY) - ${elapsed}ms`);
    const fallback = getFallbackPreset(providedHint);
    return { data: fallback, fallback: true, elapsedMs: elapsed };
  }

  // Construct prompt contents
  const contents = [];

  // Add few-shot context
  for (const ex of FEW_SHOT_EXAMPLES) {
    contents.push({ text: `Example Input:\n${ex.input}` });
    contents.push({ text: `Example Output:\n${JSON.stringify(ex.output)}` });
  }

  // Current request input description
  let inputDescription = `Input type detected: ${providedHint}.\n`;
  if (prompt && prompt.trim()) {
    inputDescription += `User prompt: "${prompt.trim()}".\n`;
  }
  if (extractedNotes && extractedNotes.length > 0) {
    inputDescription += `Extracted notes from hummed audio: ${JSON.stringify(extractedNotes)}.\n`;
  }
  if (taps && taps.length > 0) {
    inputDescription += `Tapped rhythm timings: ${JSON.stringify(taps)}.\n`;
  }

  contents.push({ text: inputDescription });

  // Add audio if provided
  if (audioBase64) {
    contents.push({
      inlineData: {
        mimeType: 'audio/wav',
        data: audioBase64,
      },
    });
  }

  const callModel = async (contentsToUse) => {
    const response = await client.models.generateContent({
      model: modelName,
      contents: contentsToUse,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: geminiResponseSchema,
        temperature: 0.7,
      },
    });
    return response.text;
  };

  try {
    const rawText = await callWithTimeout(callModel(contents), 10000);
    const parsed = JSON.parse(rawText);
    const validated = repairAndValidate(parsed, providedHint);
    const elapsed = Date.now() - startTime;
    console.log(`[Gemini] Generated in ${elapsed}ms, fallback: ${Boolean(validated.fallback)}`);
    return { data: validated, fallback: Boolean(validated.fallback), elapsedMs: elapsed, raw: parsed };
  } catch (firstErr) {
    console.warn(`[Gemini] First attempt failed (${firstErr.message}), retrying with compact prompt...`);
    try {
      // Retry once with shorter prompt without few-shots
      const compactContents = [
        { text: `${inputDescription}\nProvide the complementary musical parts and visual design in JSON.` }
      ];
      if (audioBase64) {
        compactContents.push({
          inlineData: {
            mimeType: 'audio/wav',
            data: audioBase64,
          },
        });
      }
      const retryText = await callWithTimeout(callModel(compactContents), 7000);
      const parsed = JSON.parse(retryText);
      const validated = repairAndValidate(parsed, providedHint);
      const elapsed = Date.now() - startTime;
      console.log(`[Gemini] Retry succeeded in ${elapsed}ms, fallback: ${Boolean(validated.fallback)}`);
      return { data: validated, fallback: Boolean(validated.fallback), elapsedMs: elapsed, raw: parsed };
    } catch (retryErr) {
      const elapsed = Date.now() - startTime;
      console.error(`[Gemini] Both attempts failed (${retryErr.message}), falling back to cached preset - ${elapsed}ms`);
      const fallback = getFallbackPreset(providedHint);
      return { data: fallback, fallback: true, elapsedMs: elapsed, error: retryErr.message };
    }
  }
}

export async function refineJam({ previousResult, instruction }) {
  const startTime = Date.now();
  const client = getGenAIClient();
  const useFallbackOnly = process.env.USE_FALLBACK_ONLY === 'true';
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (useFallbackOnly || !client) {
    const elapsed = Date.now() - startTime;
    console.log(`[Gemini Refine] Using fallback (offline/USE_FALLBACK_ONLY) - ${elapsed}ms`);
    return { data: previousResult, fallback: true, elapsedMs: elapsed };
  }

  const promptText = `The user wants to refine their current song and visuals.
Current state JSON:
${JSON.stringify(previousResult)}

Refinement instruction:
"${instruction}"

Output the updated JSON adhering to the schema, adjusting tempo, patterns, instruments, or visual styling accordingly.`;

  try {
    const response = await callWithTimeout(
      client.models.generateContent({
        model: modelName,
        contents: [{ text: promptText }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
          temperature: 0.7,
        },
      }),
      10000
    );
    const parsed = JSON.parse(response.text);
    const validated = repairAndValidate(parsed, previousResult?.analysis?.provided || 'prompt');
    const elapsed = Date.now() - startTime;
    console.log(`[Gemini Refine] Succeeded in ${elapsed}ms`);
    return { data: validated, fallback: Boolean(validated.fallback), elapsedMs: elapsed, raw: parsed };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[Gemini Refine] Failed (${err.message}), returning previous result - ${elapsed}ms`);
    return { data: previousResult, fallback: true, elapsedMs: elapsed, error: err.message };
  }
}
