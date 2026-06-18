import type { WaveformData } from '@/types';

export const generateWaveformData = async (
  audioBuffer: AudioBuffer,
  samplesPerPeak: number = 1000,
): Promise<WaveformData> => {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const duration = audioBuffer.duration;

  const peaks: number[] = [];
  const step = Math.max(1, Math.floor(totalSamples / samplesPerPeak));

  for (let i = 0; i < totalSamples; i += step) {
    let max = 0;
    const end = Math.min(i + step, totalSamples);
    for (let j = i; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  const actualSamplesPerPeak = Math.floor(totalSamples / peaks.length);

  return {
    peaks,
    duration,
    samplesPerPeak: actualSamplesPerPeak,
  };
};

export const getPeakAtTime = (
  waveformData: WaveformData,
  time: number,
): number => {
  const { peaks, duration } = waveformData;
  const index = Math.min(peaks.length - 1, Math.floor((time / duration) * peaks.length));
  return peaks[index] || 0;
};

export const getTimeFromIndex = (
  waveformData: WaveformData,
  index: number,
  canvasWidth: number,
): number => {
  const ratio = index / canvasWidth;
  return ratio * waveformData.duration;
};

export const drawWaveform = (
  canvas: HTMLCanvasElement,
  waveformData: WaveformData,
  options: {
    progress?: number;
    loopStart?: number;
    loopEnd?: number;
    colors?: {
      background?: string;
      wave?: string;
      waveProgress?: string;
      loop?: string;
      centerLine?: string;
    };
  } = {},
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const {
    progress = 0,
    loopStart,
    loopEnd,
    colors = {},
  } = options;

  const {
    background = 'transparent',
    wave = '#3B82F6',
    waveProgress = '#60A5FA',
    loop = 'rgba(59, 130, 246, 0.2)',
    centerLine = 'rgba(255, 255, 255, 0.1)',
  } = colors;

  const { width, height } = canvas;
  const { peaks, duration } = waveformData;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const progressX = Math.floor((progress / duration) * width);

  if (loopStart !== undefined && loopEnd !== undefined) {
    const loopStartX = (loopStart / duration) * width;
    const loopEndX = (loopEnd / duration) * width;
    ctx.fillStyle = loop;
    ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, height);
  }

  const barWidth = width / peaks.length;
  const centerY = height / 2;

  const waveGradient = ctx.createLinearGradient(0, 0, 0, height);
  waveGradient.addColorStop(0, wave);
  waveGradient.addColorStop(0.5, waveProgress);
  waveGradient.addColorStop(1, wave);

  peaks.forEach((peak, i) => {
    const x = i * barWidth;
    const barHeight = Math.max(2, peak * height * 0.8);
    const y = centerY - barHeight / 2;

    ctx.fillStyle = x < progressX ? waveProgress : wave;
    ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
  });

  ctx.strokeStyle = centerLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  if (progress > 0) {
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, height);
    ctx.stroke();
  }
};

export const drawSpectrum = (
  canvas: HTMLCanvasElement,
  frequencyData: Uint8Array,
  options: {
    colors?: {
      background?: string;
      barStart?: string;
      barEnd?: string;
      peak?: string;
    };
  } = {},
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { colors = {} } = options;
  const {
    background = 'transparent',
    barStart = '#3B82F6',
    barEnd = '#8B5CF6',
    peak = '#F59E0B',
  } = colors;

  const { width, height } = canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const barCount = frequencyData.length;
  const barWidth = width / barCount;
  const gap = 2;

  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, barStart);
  gradient.addColorStop(1, barEnd);

  frequencyData.forEach((value, i) => {
    const x = i * barWidth;
    const barHeight = (value / 255) * height;
    const y = height - barHeight;

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth - gap, barHeight);

    ctx.fillStyle = peak;
    ctx.fillRect(x, y, barWidth - gap, 2);
  });
};

export const decodeAudioFile = async (file: File): Promise<AudioBuffer> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    audioContext.close();
  }
};

export const getAudioInfo = (
  audioBuffer: AudioBuffer,
  file: File,
): {
  duration: number;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  fileSize: number;
} => {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'wav';
  const bitDepthMap: Record<string, number> = {
    wav: 16,
    flac: 24,
    mp3: 16,
    ogg: 16,
    aac: 16,
    m4a: 16,
  };

  return {
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    bitDepth: bitDepthMap[extension] || 16,
    fileFormat: extension,
    fileSize: file.size,
  };
};
