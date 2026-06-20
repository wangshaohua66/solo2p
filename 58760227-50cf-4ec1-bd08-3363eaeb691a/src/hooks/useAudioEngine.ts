import { useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { getMonoChannelData, computeWaveformPeaks } from "@/utils/audioProcessor";

export interface AudioEngineAPI {
  audioContext: AudioContext | null;
  resume: () => Promise<void>;
  seek: (time: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  setMasterVolume: (v: number) => void;
  playPreview: (start: number, end: number) => void;
  computeWaveform: (
    buffer: AudioBuffer,
    samples: number
  ) => number[];
  decodeFile: (file: File) => Promise<AudioBuffer>;
}

export function useAudioEngine(): AudioEngineAPI {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const previewStopRef = useRef<number | null>(null);

  const {
    project,
    isPlaying,
    soloTrackIds,
    setIsPlaying,
    setCurrentTime,
  } = useProjectStore();

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = 1;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = gain;
      analyserRef.current = analyser;
    }
    return ctxRef.current as AudioContext;
  }, []);

  const stopAllSources = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {}
      sourceRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (previewStopRef.current) {
      clearTimeout(previewStopRef.current);
      previewStopRef.current = null;
    }
  }, []);

  const tickPlayback = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !isPlaying) return;
    const elapsed = ctx.currentTime - startTimeRef.current + offsetRef.current;
    if (elapsed >= project.duration) {
      setCurrentTime(project.duration);
      pause();
      return;
    }
    setCurrentTime(elapsed);
    rafRef.current = requestAnimationFrame(tickPlayback);
  }, [isPlaying, project.duration, setCurrentTime]);

  const resume = useCallback(async () => {
    const ctx = ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
  }, [ensureContext]);

  const seek = useCallback((time: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) pause();
    offsetRef.current = Math.max(0, Math.min(project.duration, time));
    setCurrentTime(offsetRef.current);
    if (wasPlaying) {
      setTimeout(() => play(), 10);
    }
  }, [isPlaying, project.duration, setCurrentTime]);

  const buildMixBuffer = useCallback((): AudioBuffer | null => {
    const ctx = ensureContext();
    const tracks = project.tracks;
    if (tracks.length === 0) return null;
    const hasSolo = soloTrackIds.size > 0;
    const active = tracks.filter((t) =>
      hasSolo ? soloTrackIds.has(t.id) : !t.muted
    );
    if (active.length === 0) return null;
    const sr = project.sampleRate;
    const totalFrames = Math.ceil(project.duration * sr);
    const out = ctx.createBuffer(2, totalFrames, sr);
    for (let i = 0; i < 2; i++) {
      const dst = out.getChannelData(i);
      dst.fill(0);
    }
    for (const t of active) {
      if (!t.waveformData || t.segments.length === 0) continue;
      const vol = Math.max(0, Math.min(2, t.volume));
      for (const seg of t.segments) {
        const startFrame = Math.floor(seg.start * sr);
        const durFrames = Math.floor(seg.duration * sr);
        const offFrame = Math.floor(seg.offset * sr);
        for (let i = 0; i < 2; i++) {
          const dst = out.getChannelData(i);
          const peaks = t.waveformData;
          for (let f = 0; f < durFrames; f++) {
            const dstIdx = startFrame + f;
            if (dstIdx < 0 || dstIdx >= totalFrames) continue;
            const peakIdx = Math.min(
              peaks.length - 1,
              Math.max(0, Math.floor(((offFrame + f) / sr / t.duration) * peaks.length))
            );
            const phase = ((offFrame + f) / sr) * 440;
            const sample =
              Math.sin(phase * Math.PI * 2) * 0.4 +
              Math.sin(phase * 2.3 * Math.PI * 2) * 0.15;
            dst[dstIdx] += sample * vol * (peaks[peakIdx] ?? 0.3) * 0.3;
          }
        }
      }
    }
    for (let i = 0; i < 2; i++) {
      const dst = out.getChannelData(i);
      for (let f = 0; f < totalFrames; f++) {
        if (dst[f] > 1) dst[f] = 1;
        else if (dst[f] < -1) dst[f] = -1;
      }
    }
    return out;
  }, [ensureContext, project.tracks, project.sampleRate, project.duration, soloTrackIds]);

  const play = useCallback(async () => {
    const ctx = ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    stopAllSources();
    const buffer = buildMixBuffer();
    if (!buffer) {
      setIsPlaying(true);
      startTimeRef.current = ctx.currentTime;
      rafRef.current = requestAnimationFrame(tickPlayback);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.onended = () => {
      if (sourceRef.current === src) {
        setIsPlaying(false);
        offsetRef.current = 0;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    src.connect(masterGainRef.current as GainNode);
    try {
      src.start(0, offsetRef.current);
      sourceRef.current = src;
      startTimeRef.current = ctx.currentTime;
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(tickPlayback);
    } catch (err) {
      console.warn("play error", err);
    }
  }, [ensureContext, buildMixBuffer, tickPlayback, stopAllSources, setIsPlaying]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx && isPlaying) {
      offsetRef.current =
        ctx.currentTime - startTimeRef.current + offsetRef.current;
      if (offsetRef.current >= project.duration) offsetRef.current = 0;
    }
    stopAllSources();
    setIsPlaying(false);
    setCurrentTime(offsetRef.current);
  }, [isPlaying, project.duration, stopAllSources, setIsPlaying, setCurrentTime]);

  const stop = useCallback(() => {
    stopAllSources();
    setIsPlaying(false);
    offsetRef.current = 0;
    setCurrentTime(0);
  }, [stopAllSources, setIsPlaying, setCurrentTime]);

  const setMasterVolume = useCallback((v: number) => {
    ensureContext();
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = Math.max(0, Math.min(1.5, v));
    }
  }, [ensureContext]);

  const playPreview = useCallback((start: number, end: number) => {
    const ctx = ensureContext();
    const buffer = buildMixBuffer();
    if (!buffer) return;
    const dur = Math.max(0.01, end - start);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(masterGainRef.current as GainNode);
    try {
      src.start(0, start, dur);
      previewStopRef.current = window.setTimeout(() => {
        try { src.stop(); } catch {}
      }, dur * 1000 + 200);
    } catch {}
  }, [ensureContext, buildMixBuffer]);

  const computeWaveform = useCallback(
    (buffer: AudioBuffer, samples: number): number[] => {
      const mono = getMonoChannelData(buffer);
      return computeWaveformPeaks(
        mono,
        Math.max(1, Math.floor(mono.length / samples)),
        samples
      );
    },
    []
  );

  const decodeFile = useCallback(
    async (file: File): Promise<AudioBuffer> => {
      const ctx = ensureContext();
      const arrayBuffer = await file.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer.slice(0));
    },
    [ensureContext]
  );

  useEffect(() => {
    return () => {
      stopAllSources();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, [stopAllSources]);

  return {
    audioContext: ctxRef.current,
    resume,
    seek,
    play,
    pause,
    stop,
    setMasterVolume,
    playPreview,
    computeWaveform,
    decodeFile,
  };
}
