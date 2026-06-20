import type { AudioClip } from '@/types';

let sharedCtx: AudioContext | null = null;
export function getAudioCtx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

export async function decodeAudio(dataUrl: string): Promise<AudioBuffer> {
  const ctx = getAudioCtx();
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return await ctx.decodeAudioData(bytes.buffer);
}

export function extractWaveform(buffer: AudioBuffer, targetPoints = 2000): number[] {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / targetPoints));
  const points: number[] = [];
  for (let i = 0; i < targetPoints; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channel.length);
    let peak = 0, sum = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j]);
      if (v > peak) peak = v;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    points.push(peak * 0.6 + rms * 0.4);
  }
  return points;
}

export class AudioPlayer {
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode;
  private fadeInNode: GainNode;
  private fadeOutNode: GainNode;
  private ctx: AudioContext;
  private startTime = 0;

  constructor() {
    this.ctx = getAudioCtx();
    this.gain = this.ctx.createGain();
    this.fadeInNode = this.ctx.createGain();
    this.fadeOutNode = this.ctx.createGain();
    this.gain.connect(this.fadeInNode);
    this.fadeInNode.connect(this.fadeOutNode);
    this.fadeOutNode.connect(this.ctx.destination);
  }

  async play(clip: AudioClip, buffer: AudioBuffer): Promise<void> {
    this.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = clip.loop;
    this.gain.gain.value = clip.volume;
    const now = this.ctx.currentTime;
    this.fadeInNode.gain.setValueAtTime(0, now);
    this.fadeInNode.gain.linearRampToValueAtTime(1, now + clip.fadeIn);
    const dur = (clip.endTime - clip.startTime);
    this.fadeOutNode.gain.setValueAtTime(1, now + Math.max(0, dur - clip.fadeOut));
    this.fadeOutNode.gain.linearRampToValueAtTime(0, now + dur);
    this.source.connect(this.gain);
    this.source.start(0, clip.startTime, clip.loop ? undefined : dur);
    this.startTime = now;
  }

  stop(): void {
    if (this.source) {
      try { this.source.stop(); } catch { /* noop */ }
      this.source.disconnect();
      this.source = null;
    }
  }
}
