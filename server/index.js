import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateJam, refineJam } from './gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Generate endpoint
app.post('/api/generate', async (req, res) => {
  const { prompt, audioBase64, extractedNotes, taps, providedHint } = req.body || {};

  try {
    const result = await generateJam({
      prompt,
      audioBase64,
      extractedNotes,
      taps,
      providedHint: providedHint || 'prompt',
    });

    res.json({
      success: true,
      data: result.data,
      fallback: result.fallback,
      elapsedMs: result.elapsedMs,
      raw: result.raw,
      error: result.error,
    });
  } catch (err) {
    console.error('Unhandled error in /api/generate:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Refine endpoint
app.post('/api/refine', async (req, res) => {
  const { previousResult, instruction } = req.body || {};

  if (!previousResult || !instruction) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: previousResult and instruction are required.',
    });
  }

  try {
    const result = await refineJam({ previousResult, instruction });
    res.json({
      success: true,
      data: result.data,
      fallback: result.fallback,
      elapsedMs: result.elapsedMs,
      raw: result.raw,
      error: result.error,
    });
  } catch (err) {
    console.error('Unhandled error in /api/refine:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// In production, serve client build
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Chromajam Server] Listening on port ${PORT}`);
});
