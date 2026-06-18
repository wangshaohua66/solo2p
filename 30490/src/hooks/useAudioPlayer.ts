import { useState, useEffect, useRef, useCallback } from 'react';
import type { AudioRecording, CompareTrack } from '@/types';
import { createObjectURLFromPath, revokeObjectURL } from '@/storage/fileOperations';

interface UseAudioPlayerOptions {
  recording: AudioRecording | null;
  compareTracks?: CompareTrack[];
}

interface UseAudioPlayerResult {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  loop: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  frequencyData: Uint8Array;
  isLoading: boolean;
  error: string | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleLoop: () => void;
  setLoopRange: (start: number | null, end: number | null) => void;
  getTrackVolume: (audioId: string) => number;
  setTrackVolume: (audioId: string, volume: number) => void;
  getTrackMuted: (audioId: string) => boolean;
  setTrackMuted: (audioId: string, muted: boolean) => void;
  getTrackSolo: (audioId: string) => boolean;
  setTrackSolo: (audioId: string, solo: boolean) => void;
}

export const useAudioPlayer = ({
  recording,
  compareTracks = [],
}: UseAudioPlayerOptions): UseAudioPlayerResult => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceMapRef = useRef<Map<string, { audio: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode }>>(new Map());
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [loop, setLoopState] = useState(false);
  const [loopStart, setLoopStartState] = useState<number | null>(null);
  const [loopEnd, setLoopEndState] = useState<number | null>(null);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(64));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackVolumesRef = useRef<Map<string, number>>(new Map());
  const trackMutedRef = useRef<Map<string, boolean>>(new Map());
  const trackSoloRef = useRef<Map<string, boolean>>(new Map());

  const getOrCreateAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current;
  }, []);

  const cleanupAudioResources = useCallback(() => {
    sourceMapRef.current.forEach((entry) => {
      entry.audio.pause();
      entry.source.disconnect();
      entry.gain.disconnect();
    });
    sourceMapRef.current.clear();

    objectUrlsRef.current.forEach((url) => {
      revokeObjectURL(url);
    });
    objectUrlsRef.current.clear();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  const setupSingleTrack = useCallback(async (rec: AudioRecording) => {
    cleanupAudioResources();
    setIsLoading(true);
    setError(null);

    try {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;

      const objectUrl = await createObjectURLFromPath(rec.opfsPath);
      objectUrlsRef.current.set(rec.id, objectUrl);

      audio.src = objectUrl;
      audio.volume = volume;
      audio.playbackRate = playbackRate;
      audio.loop = loop;
      audio.crossOrigin = 'anonymous';

      const audioContext = getOrCreateAudioContext();
      const analyser = analyserRef.current!;

      const existingSources = audioContextRef.current
        ? Array.from(audioContextRef.current.createGain().connect.toString() ? [] : [])
        : [];
      existingSources.length = 0;

      const source = audioContext.createMediaElementSource(audio);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(analyser);

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);

        if (loopStart !== null && loopEnd !== null && audio.currentTime >= loopEnd) {
          audio.currentTime = loopStart;
        }
      });

      audio.addEventListener('ended', () => {
        if (!loop || (loopStart !== null && loopEnd !== null)) {
          setIsPlaying(false);
        }
      });

      audio.addEventListener('error', () => {
        setError('Failed to load audio');
        setIsLoading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup audio');
      setIsLoading(false);
    }
  }, [cleanupAudioResources, volume, playbackRate, loop, loopStart, loopEnd, getOrCreateAudioContext]);

  const setupCompareTracks = useCallback(async (tracks: CompareTrack[]) => {
    cleanupAudioResources();
    setIsLoading(true);
    setError(null);

    try {
      const audioContext = getOrCreateAudioContext();
      const analyser = analyserRef.current!;
      const masterGain = audioContext.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(analyser);

      let loadedCount = 0;
      const totalTracks = tracks.length;

      for (const track of tracks) {
        const audio = new Audio();
        const objectUrl = await createObjectURLFromPath(track.audio.opfsPath);
        objectUrlsRef.current.set(track.audioId, objectUrl);

        audio.src = objectUrl;
        audio.playbackRate = playbackRate;
        audio.loop = loop;
        audio.crossOrigin = 'anonymous';

        const source = audioContext.createMediaElementSource(audio);
        const gainNode = audioContext.createGain();
        const initialVolume = track.muted ? 0 : (track.solo ? track.volume : track.volume);
        gainNode.gain.value = initialVolume;

        source.connect(gainNode);
        gainNode.connect(masterGain);

        sourceMapRef.current.set(track.audioId, { audio, source, gain: gainNode });
        trackVolumesRef.current.set(track.audioId, track.volume);
        trackMutedRef.current.set(track.audioId, track.muted);
        trackSoloRef.current.set(track.audioId, track.solo);

        audio.addEventListener('loadedmetadata', () => {
          loadedCount++;
          if (loadedCount === 1) {
            setDuration(audio.duration);
          }
          if (loadedCount === totalTracks) {
            setIsLoading(false);
          }
        });

        audio.addEventListener('timeupdate', () => {
          if (track.audioId === tracks[0]?.audioId) {
            setCurrentTime(audio.currentTime);
          }

          if (loopStart !== null && loopEnd !== null && audio.currentTime >= loopEnd) {
            audio.currentTime = loopStart;
          }
        });

        audio.addEventListener('ended', () => {
          if (!loop || (loopStart !== null && loopEnd !== null)) {
            const allEnded = Array.from(sourceMapRef.current.values()).every(
              (e) => e.audio.ended || e.audio.paused,
            );
            if (allEnded) {
              setIsPlaying(false);
            }
          }
        });
      }

      updateCompareGains();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup compare tracks');
      setIsLoading(false);
    }
  }, [cleanupAudioResources, volume, playbackRate, loop, loopStart, loopEnd, getOrCreateAudioContext]);

  const updateCompareGains = useCallback(() => {
    const hasSolo = Array.from(trackSoloRef.current.values()).some(Boolean);

    sourceMapRef.current.forEach((entry, audioId) => {
      const trackVolume = trackVolumesRef.current.get(audioId) ?? 1;
      const muted = trackMutedRef.current.get(audioId) ?? false;
      const solo = trackSoloRef.current.get(audioId) ?? false;

      let effectiveVolume = trackVolume;
      if (muted) {
        effectiveVolume = 0;
      } else if (hasSolo && !solo) {
        effectiveVolume = 0;
      }

      entry.gain.gain.value = effectiveVolume;
    });
  }, []);

  useEffect(() => {
    if (compareTracks.length > 0) {
      void setupCompareTracks(compareTracks);
    } else if (recording) {
      void setupSingleTrack(recording);
    } else {
      cleanupAudioResources();
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
    }

    return () => {
      cleanupAudioResources();
    };
  }, [recording, compareTracks, setupSingleTrack, setupCompareTracks, cleanupAudioResources]);

  useEffect(() => {
    if (!analyserRef.current) return;

    let animationId: number;
    const updateFrequencyData = () => {
      if (analyserRef.current && isPlaying) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        setFrequencyData(data);
      }
      animationId = requestAnimationFrame(updateFrequencyData);
    };

    animationId = requestAnimationFrame(updateFrequencyData);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  const play = useCallback(async () => {
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    try {
      if (compareTracks.length > 0) {
        const promises = Array.from(sourceMapRef.current.values()).map((entry) =>
          entry.audio.play(),
        );
        await Promise.all(promises);
      } else if (audioRef.current) {
        await audioRef.current.play();
      }
      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to play');
    }
  }, [compareTracks.length]);

  const pause = useCallback(() => {
    if (compareTracks.length > 0) {
      sourceMapRef.current.forEach((entry) => {
        entry.audio.pause();
      });
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [compareTracks.length]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration));

    if (compareTracks.length > 0) {
      sourceMapRef.current.forEach((entry) => {
        entry.audio.currentTime = clampedTime;
      });
    } else if (audioRef.current) {
      audioRef.current.currentTime = clampedTime;
    }
    setCurrentTime(clampedTime);
  }, [duration, compareTracks.length]);

  const setVolume = useCallback((v: number) => {
    const clampedVolume = Math.max(0, Math.min(1, v));
    setVolumeState(clampedVolume);

    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }

    if (audioContextRef.current) {
      const masterGain = audioContextRef.current.createGain();
      masterGain.gain.value = clampedVolume;
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current.connect(audioContextRef.current.destination);
      }
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2, rate));
    setPlaybackRateState(clampedRate);

    if (audioRef.current) {
      audioRef.current.playbackRate = clampedRate;
    }

    sourceMapRef.current.forEach((entry) => {
      entry.audio.playbackRate = clampedRate;
    });
  }, []);

  const toggleLoop = useCallback(() => {
    setLoopState((prev) => {
      const newLoop = !prev;
      if (audioRef.current) {
        audioRef.current.loop = newLoop;
      }
      sourceMapRef.current.forEach((entry) => {
        entry.audio.loop = newLoop;
      });
      return newLoop;
    });
  }, []);

  const setLoopRange = useCallback((start: number | null, end: number | null) => {
    setLoopStartState(start);
    setLoopEndState(end);
  }, []);

  const getTrackVolume = useCallback((audioId: string) => {
    return trackVolumesRef.current.get(audioId) ?? 1;
  }, []);

  const setTrackVolume = useCallback((audioId: string, v: number) => {
    const clampedVolume = Math.max(0, Math.min(1, v));
    trackVolumesRef.current.set(audioId, clampedVolume);
    updateCompareGains();
  }, [updateCompareGains]);

  const getTrackMuted = useCallback((audioId: string) => {
    return trackMutedRef.current.get(audioId) ?? false;
  }, []);

  const setTrackMuted = useCallback((audioId: string, muted: boolean) => {
    trackMutedRef.current.set(audioId, muted);
    updateCompareGains();
  }, [updateCompareGains]);

  const getTrackSolo = useCallback((audioId: string) => {
    return trackSoloRef.current.get(audioId) ?? false;
  }, []);

  const setTrackSolo = useCallback((audioId: string, solo: boolean) => {
    trackSoloRef.current.set(audioId, solo);
    updateCompareGains();
  }, [updateCompareGains]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    loop,
    loopStart,
    loopEnd,
    frequencyData,
    isLoading,
    error,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    setPlaybackRate,
    toggleLoop,
    setLoopRange,
    getTrackVolume,
    setTrackVolume,
    getTrackMuted,
    setTrackMuted,
    getTrackSolo,
    setTrackSolo,
  };
};
