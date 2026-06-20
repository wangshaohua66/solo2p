export function computeWaveformPeaks(
  channelData: Float32Array,
  samplesPerPixel: number,
  outputLength: number
): number[] {
  const peaks: number[] = new Array(outputLength).fill(0);
  const totalSamples = channelData.length;
  if (samplesPerPixel <= 0 || totalSamples === 0) return peaks;
  const step = Math.max(1, Math.floor(samplesPerPixel));
  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * samplesPerPixel);
    const end = Math.min(start + step, totalSamples);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j] ?? 0);
      if (abs > max) max = abs;
    }
    peaks[i] = Math.min(1, max);
  }
  return peaks;
}

export function computeMultiLevelWaveform(
  channelData: Float32Array,
  baseSamples: number,
  levels = 5
): number[][] {
  const result: number[][] = [];
  let samples = baseSamples;
  for (let l = 0; l < levels; l++) {
    const perPixel = Math.max(1, Math.floor(channelData.length / samples));
    result.push(computeWaveformPeaks(channelData, perPixel, samples));
    samples = Math.max(64, Math.floor(samples / 4));
  }
  return result;
}

export function computeRMS(channelData: Float32Array, windowSize = 1024): number[] {
  const rms: number[] = [];
  for (let i = 0; i < channelData.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, channelData.length);
    for (let j = i; j < end; j++) {
      const v = channelData[j] ?? 0;
      sum += v * v;
    }
    rms.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  return rms;
}

export function sliceAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  audioCtx: AudioContext
): AudioBuffer {
  const startSample = Math.max(0, Math.floor(startSec * buffer.sampleRate));
  const endSample = Math.min(
    buffer.length,
    Math.floor(endSec * buffer.sampleRate)
  );
  const frameCount = Math.max(0, endSample - startSample);
  const out = audioCtx.createBuffer(
    buffer.numberOfChannels,
    frameCount,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      dst[i] = src[startSample + i] ?? 0;
    }
  }
  return out;
}

export function mergeAudioBuffers(
  buffers: AudioBuffer[],
  audioCtx: AudioContext,
  padding = 0
): AudioBuffer {
  if (buffers.length === 0) {
    return audioCtx.createBuffer(1, 1, 44100);
  }
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const sampleRate = buffers[0].sampleRate;
  const padSamples = Math.floor(padding * sampleRate);
  let totalLength = 0;
  for (let i = 0; i < buffers.length; i++) {
    totalLength += buffers[i].length;
    if (i < buffers.length - 1) totalLength += padSamples;
  }
  const out = audioCtx.createBuffer(channels, totalLength, sampleRate);
  let offset = 0;
  for (let idx = 0; idx < buffers.length; idx++) {
    const buf = buffers[idx];
    for (let ch = 0; ch < channels; ch++) {
      const srcCh = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
      const dstCh = out.getChannelData(ch);
      for (let i = 0; i < buf.length; i++) {
        dstCh[offset + i] = srcCh[i] ?? 0;
      }
    }
    offset += buf.length + padSamples;
  }
  return out;
}

export function getMonoChannelData(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const len = buffer.length;
  const mono = new Float32Array(len);
  const chA = buffer.getChannelData(0);
  const chB = buffer.getChannelData(1);
  for (let i = 0; i < len; i++) {
    mono[i] = ((chA[i] ?? 0) + (chB[i] ?? 0)) * 0.5;
  }
  return mono;
}

export function applyGain(
  buffer: AudioBuffer,
  gain: number,
  audioCtx: AudioContext
): AudioBuffer {
  const out = audioCtx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) {
      dst[i] = Math.max(-1, Math.min(1, (src[i] ?? 0) * gain));
    }
  }
  return out;
}

export function decodeAudioFile(
  file: File,
  audioCtx: AudioContext
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      audioCtx.decodeAudioData(arrayBuffer).then(resolve).catch(reject);
    };
    reader.readAsArrayBuffer(file);
  });
}

export function generateSyntheticWaveform(length: number, seed = 42): number[] {
  const peaks: number[] = new Array(length);
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < length; i++) {
    const envelope = Math.sin((i / length) * Math.PI) * 0.8 + 0.2;
    const noise = (rand() - 0.5) * 0.3;
    const wave =
      Math.sin(i * 0.02) * 0.35 +
      Math.sin(i * 0.053 + 1.3) * 0.25 +
      Math.sin(i * 0.127) * 0.15;
    peaks[i] = Math.max(0.02, Math.min(1, Math.abs(wave + noise) * envelope));
  }
  return peaks;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
