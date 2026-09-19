/**
 * Decodes audio data, downmixes to mono, resamples to 16 kHz, and encodes to 16-bit PCM WAV.
 * Returns { base64, duration, sampleRate: 16000, pcmData: Float32Array, audioBuffer }
 */
export async function processAudioToWav(blobOrBuffer) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  let arrayBuffer;
  if (blobOrBuffer instanceof Blob) {
    arrayBuffer = await blobOrBuffer.arrayBuffer();
  } else if (blobOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = blobOrBuffer;
  } else {
    throw new Error('Unsupported audio input type');
  }

  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const targetSampleRate = 16000;
  const duration = decodedBuffer.duration;

  // Use OfflineAudioContext to downmix to mono and resample to 16kHz
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const pcmData = renderedBuffer.getChannelData(0);

  // Encode Float32Array to 16-bit PCM WAV
  const wavBytes = encodeWav(pcmData, targetSampleRate);

  // Convert to Base64
  let binary = '';
  const len = wavBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(wavBytes[i]);
  }
  const base64 = btoa(binary);

  try { await audioCtx.close(); } catch (e) {}

  return {
    base64,
    duration,
    sampleRate: targetSampleRate,
    pcmData,
    audioBuffer: renderedBuffer,
  };
}

function encodeWav(samples, sampleRate) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
