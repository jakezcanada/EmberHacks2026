import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { SYSTEM_PROMPT, FEW_SHOT_EXAMPLES, CREATIVE_TWISTS } from './prompt.js';
import { geminiResponseSchema, repairAndValidate, getFallbackPreset } from './schema.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEFAULT_FALLBACK_MODELS = 'gemini-flash-lite-latest,gemini-3.5-flash,gemini-3.7-flash';
const ATTEMPT_TIMEOUT_MS = 16000;
const TOTAL_BUDGET_MS = 30000;

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

/** Primary model first, then the fallbacks, without duplicates. */
function modelChain() {
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}

async function callWithTimeout(promise, ms) {
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

/** Overload, quota, missing model, unsupported option or timeout: another model may still answer. */
function isModelUnavailable(err) {
  const msg = String(err?.message || err);
  return /\b(503|429|404|400)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|INVALID_ARGUMENT|high demand|quota|Timeout after/i.test(msg);
}

function shortError(err) {
  const msg = String(err?.message || err);
  const code = /"code":\s*(\d{3})/.exec(msg)?.[1] || /\b(503|429|404)\b/.exec(msg)?.[1];
  if (/Timeout after/.test(msg)) return 'timeout';
  if (code === '429') return '429 quota exceeded';
  if (code === '503') return '503 high demand';
  if (code === '404') return '404 model not found';
  return msg.slice(0, 120);
}

// Models that rejected the minimal thinking level; they run with their default
const noMinimalThinking = new Set();

async function requestJson(client, model, contents) {
  const config = {
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: 'application/json',
    responseSchema: geminiResponseSchema,
    temperature: 1.0,
    // A fresh seed per request so the same prompt never returns the same loop
    seed: Math.floor(Math.random() * 2 ** 31),
  };
  // Minimal thinking roughly halves latency; the schema does the structuring
  if (!noMinimalThinking.has(model)) config.thinkingConfig = { thinkingLevel: 'MINIMAL' };
  try {
    const response = await callWithTimeout(client.models.generateContent({ model, contents, config }), ATTEMPT_TIMEOUT_MS);
    return JSON.parse(response.text);
  } catch (err) {
    if (config.thinkingConfig && /thinking level/i.test(String(err?.message))) {
      noMinimalThinking.add(model);
      return requestJson(client, model, contents);
    }
    throw err;
  }
}

/**
 * Walk the model chain. An unavailable model (overloaded, out of quota, slow)
 * hands over to the next one; an unusable answer gets one retry with the
 * compact prompt on the same model.
 */
async function generateWithChain(client, contents, compactContents, tag) {
  const start = Date.now();
  const failures = [];

  for (const model of modelChain()) {
    if (Date.now() - start > TOTAL_BUDGET_MS) break;
    const variants = compactContents ? [contents, compactContents] : [contents];
    for (let i = 0; i < variants.length; i++) {
      try {
        const parsed = await requestJson(client, model, variants[i]);
        console.log(`[${tag}] ${model} answered in ${Date.now() - start}ms${i ? ' (compact prompt)' : ''}`);
        return { parsed, model };
      } catch (err) {
        failures.push(`${model}: ${shortError(err)}`);
        console.warn(`[${tag}] ${model} failed (${shortError(err)})`);
        if (isModelUnavailable(err)) break; // try the next model instead of re-asking this one
      }
    }
  }
  const error = new Error(failures.join('; ') || 'No Gemini model available');
  error.failures = failures;
  throw error;
}

export async function generateJam({ prompt, audioBase64, extractedNotes, taps, providedHint = 'prompt', avoidPresetId }) {
  const startTime = Date.now();
  const client = getGenAIClient();

  if (process.env.USE_FALLBACK_ONLY === 'true' || !client) {
    console.log('[Gemini] Using fallback preset (offline/USE_FALLBACK_ONLY)');
    return { data: getFallbackPreset(providedHint, avoidPresetId), fallback: true, elapsedMs: Date.now() - startTime };
  }

  let inputDescription = `Input type detected: ${providedHint}.\n`;
  if (prompt && prompt.trim()) inputDescription += `User prompt: "${prompt.trim()}".\n`;
  if (extractedNotes && extractedNotes.length > 0) {
    inputDescription += `Extracted notes from hummed audio: ${JSON.stringify(extractedNotes)}.\n`;
  }
  if (taps && taps.length > 0) inputDescription += `Tapped rhythm timings: ${JSON.stringify(taps)}.\n`;
  const twist = CREATIVE_TWISTS[Math.floor(Math.random() * CREATIVE_TWISTS.length)];
  inputDescription += `Creative direction for this take: ${twist}.\n`;

  const audioPart = audioBase64 ? [{ inlineData: { mimeType: 'audio/wav', data: audioBase64 } }] : [];

  const contents = [];
  for (const ex of FEW_SHOT_EXAMPLES) {
    contents.push({ text: `Example Input:\n${ex.input}` });
    contents.push({ text: `Example Output:\n${JSON.stringify(ex.output)}` });
  }
  contents.push({ text: inputDescription }, ...audioPart);

  const compactContents = [
    { text: `${inputDescription}\nProvide the complementary musical parts and visual design in JSON.` },
    ...audioPart,
  ];

  try {
    const { parsed, model } = await generateWithChain(client, contents, compactContents, 'Gemini');
    const validated = repairAndValidate(parsed, providedHint);
    return { data: validated, fallback: Boolean(validated.fallback), elapsedMs: Date.now() - startTime, raw: parsed, model };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[Gemini] All models failed, using a fallback preset - ${elapsed}ms`);
    return { data: getFallbackPreset(providedHint, avoidPresetId), fallback: true, elapsedMs: elapsed, error: err.message };
  }
}

export async function refineJam({ previousResult, instruction }) {
  const startTime = Date.now();
  const client = getGenAIClient();

  if (process.env.USE_FALLBACK_ONLY === 'true' || !client) {
    console.log('[Gemini Refine] Using fallback (offline/USE_FALLBACK_ONLY)');
    return { data: previousResult, fallback: true, elapsedMs: Date.now() - startTime };
  }

  const { id, fallback, ...song } = previousResult || {};
  const promptText = `The user wants to refine their current song and visuals.
Current state JSON:
${JSON.stringify(song)}

Refinement instruction:
"${instruction}"

Output the updated JSON adhering to the schema, adjusting tempo, patterns, instruments, or visual styling accordingly.`;

  try {
    const { parsed, model } = await generateWithChain(client, [{ text: promptText }], null, 'Gemini Refine');
    const validated = repairAndValidate(parsed, previousResult?.analysis?.provided || 'prompt');
    return { data: validated, fallback: Boolean(validated.fallback), elapsedMs: Date.now() - startTime, raw: parsed, model };
  } catch (err) {
    console.error(`[Gemini Refine] All models failed, keeping the previous result - ${Date.now() - startTime}ms`);
    return { data: previousResult, fallback: true, elapsedMs: Date.now() - startTime, error: err.message };
  }
}
