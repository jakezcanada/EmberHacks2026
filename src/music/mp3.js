import lamejs from '@breezystack/lamejs';
import * as Tone from 'tone';

export async function exportMp3File(audioInput, filename = 'chromajam.mp3') {
  const audioBuffer = audioInput && typeof audioInput.getChannelData === 'function'
    ? audioInput
    : await decodeAudioBlob(audioInput);
  if (!audioBuffer) throw new Error('No captured audio to export');

  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
  const channelData = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));
  const samplesPerFrame = 1152;
  const mp3Data = [];

  for (let offset = 0; offset < audioBuffer.length; offset += samplesPerFrame) {
    const left = toInt16(channelData[0].subarray(offset, offset + samplesPerFrame));
    const right = channels === 2 ? toInt16(channelData[1].subarray(offset, offset + samplesPerFrame)) : undefined;
    const encoded = channels === 2
      ? encoder.encodeBuffer(left, right)
      : encoder.encodeBuffer(left);
    if (encoded.length > 0) mp3Data.push(encoded);
  }

  const finalFrame = encoder.flush();
  if (finalFrame.length > 0) mp3Data.push(finalFrame);

  const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toInt16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

async function decodeAudioBlob(blob) {
  if (!(blob instanceof Blob)) throw new Error('No audio recording to export');
  try {
    return await Tone.getContext().decodeAudioData(await blob.arrayBuffer());
  } catch (error) {
    throw new Error(`${error.message} (${blob.size} bytes, ${blob.type || 'unknown format'})`);
  }
}