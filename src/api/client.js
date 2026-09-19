import fallbackPresets from '../fallback/presets.json';

export async function generateJamRequest({
  prompt = '',
  audioBase64 = null,
  extractedNotes = [],
  taps = [],
  providedHint = 'prompt',
}) {
  const payload = {
    prompt,
    audioBase64,
    extractedNotes,
    taps,
    providedHint,
  };

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Invalid server response');
    }

    return {
      data: data.data,
      fallback: Boolean(data.fallback),
      elapsedMs: data.elapsedMs,
      raw: data.raw,
      requestPayload: payload,
    };
  } catch (err) {
    console.warn('[ApiClient] API call failed or network unavailable, using local fallback:', err);
    // Find matching fallback preset
    let matched = fallbackPresets.find(p => p.analysis?.provided === providedHint);
    if (!matched) matched = fallbackPresets[0];
    const fallbackCopy = JSON.parse(JSON.stringify(matched));
    fallbackCopy.fallback = true;

    return {
      data: fallbackCopy,
      fallback: true,
      elapsedMs: 0,
      raw: fallbackCopy,
      error: err.message,
      requestPayload: payload,
    };
  }
}

export async function refineJamRequest({ previousResult, instruction }) {
  const payload = { previousResult, instruction };

  try {
    const res = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Invalid server response');
    }

    return {
      data: data.data,
      fallback: Boolean(data.fallback),
      elapsedMs: data.elapsedMs,
      raw: data.raw,
      requestPayload: payload,
    };
  } catch (err) {
    console.warn('[ApiClient] Refine call failed, keeping previous state:', err);
    return {
      data: previousResult,
      fallback: true,
      elapsedMs: 0,
      raw: previousResult,
      error: err.message,
      requestPayload: payload,
    };
  }
}
