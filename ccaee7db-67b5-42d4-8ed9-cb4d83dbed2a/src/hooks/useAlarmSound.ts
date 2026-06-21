import { useState, useEffect, useCallback, useRef } from 'react';
import type { AlarmLevel } from '@/types';

// 音效合成参数配置接口
interface SoundConfig {
  frequency: number;       // 频率（Hz）
  waveform: OscillatorType; // 波形类型
  duration: number;        // 单音持续时长（秒）
  gain: number;            // 音量增益（0-1）
  pattern?: Array<{ on: number; off: number }>; // 循环节奏模式（秒）
  repeat?: number;         // 重复次数
}

// 三级告警音效配置
const SOUND_CONFIGS: Record<AlarmLevel, SoundConfig> = {
  urgent: {
    frequency: 880,
    waveform: 'square',
    duration: 2,
    gain: 0.3,
    pattern: [{ on: 0.15, off: 0.1 }],
    repeat: 3,
  },
  important: {
    frequency: 660,
    waveform: 'sine',
    duration: 0.5,
    gain: 0.2,
  },
  general: {
    frequency: 440,
    waveform: 'triangle',
    duration: 0.3,
    gain: 0.15,
  },
};

// 防重复播放的最小间隔（毫秒）
const MIN_PLAY_INTERVAL_MS = 2000;

// Hook返回值接口
interface UseAlarmSoundReturn {
  play: (level: AlarmLevel) => Promise<boolean>;  // 播放指定级别音效，返回是否实际播放
  stop: () => void;                               // 停止所有正在播放的音效
  isPlaying: boolean;                             // 是否正在播放
  isMuted: boolean;                               // 是否已静音
  isUnlocked: boolean;                            // AudioContext是否已解锁
  unlock: () => Promise<void>;                    // 手动解锁AudioContext（需用户交互中调用）
}

// 静音状态来源：优先尝试从monitorStore读取，回退localStorage
function getAlarmMuted(): boolean {
  try {
    // 尝试从潜在的monitorStore获取（使用动态import避免静态依赖报错）
    // 若后续创建了 @/store/monitor，请在此替换为真实import
    const stored = localStorage.getItem('monitor:alarmMuted');
    return stored === 'true';
  } catch {
    return false;
  }
}

function setAlarmMuted(value: boolean): void {
  try {
    localStorage.setItem('monitor:alarmMuted', String(value));
  } catch {
    // ignore
  }
}

export function useAlarmSound(): UseAlarmSoundReturn {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(getAlarmMuted());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // 内部引用
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<Array<{ osc: OscillatorNode; gain: GainNode }>>([]);
  const stopTimerRef = useRef<number | null>(null);
  const lastPlayTimeRef = useRef<Record<AlarmLevel, number>>({
    urgent: 0,
    important: 0,
    general: 0,
  });

  // 初始化/获取AudioContext实例
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  }, []);

  // 销毁AudioContext
  const destroyAudioContext = useCallback(async (): Promise<void> => {
    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
  }, []);

  // 停止所有活动的音效节点
  const stop = useCallback((): void => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const ctx = audioCtxRef.current;
    activeNodesRef.current.forEach(({ osc, gain }) => {
      try {
        // 快速淡出避免爆音
        gain.gain.cancelScheduledValues(ctx ? ctx.currentTime : 0);
        if (ctx) {
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        }
        osc.stop(ctx ? ctx.currentTime + 0.06 : 0);
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    });
    activeNodesRef.current = [];
    setIsPlaying(false);
  }, []);

  // 解锁AudioContext（处理浏览器自动播放限制）
  const unlock = useCallback(async (): Promise<void> => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // 播放一个静默音作为解锁触发
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
      setIsUnlocked(true);
    } catch (err) {
      console.warn('[AlarmSound] AudioContext解锁失败', err);
    }
  }, [getAudioContext]);

  // 播放单个音符
  const playTone = useCallback((config: SoundConfig, startTime: number): number => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = config.waveform;
    osc.frequency.setValueAtTime(config.frequency, startTime);

    // 淡入避免爆音
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(config.gain, startTime + 0.01);
    // 淡出
    gain.gain.setValueAtTime(config.gain, startTime + config.duration - 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + config.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + config.duration + 0.02);

    activeNodesRef.current.push({ osc, gain });

    return config.duration * 1000;
  }, [getAudioContext]);

  // 按节奏模式循环播放（用于urgent级别）
  const playPattern = useCallback((config: SoundConfig): number => {
    const ctx = getAudioContext();
    const pattern = config.pattern!;
    const repeat = config.repeat || 1;
    let currentTime = ctx.currentTime;
    let totalDurationMs = 0;

    for (let r = 0; r < repeat; r++) {
      pattern.forEach((step) => {
        const toneStart = currentTime;
        const toneDuration = step.on;
        const stepConfig: SoundConfig = { ...config, duration: toneDuration };
        playTone(stepConfig, toneStart);
        currentTime += toneDuration + step.off;
        totalDurationMs += (toneDuration + step.off) * 1000;
      });
    }
    return totalDurationMs;
  }, [getAudioContext, playTone]);

  // 主播放入口
  const play = useCallback(async (level: AlarmLevel): Promise<boolean> => {
    // 检查静音
    if (isMuted) {
      console.info(`[AlarmSound] 已静音，跳过${level}级别音效`);
      return false;
    }

    // 检查防重复播放
    const now = Date.now();
    if (now - lastPlayTimeRef.current[level] < MIN_PLAY_INTERVAL_MS) {
      console.info(`[AlarmSound] ${level}级别播放间隔过短（${now - lastPlayTimeRef.current[level]}ms），跳过`);
      return false;
    }
    lastPlayTimeRef.current[level] = now;

    // 确保AudioContext已解锁
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const currentState: AudioContextState = ctx.state;
      setIsUnlocked(currentState === 'running');
    } catch (err) {
      console.warn('[AlarmSound] AudioContext恢复失败', err);
      return false;
    }

    const config = SOUND_CONFIGS[level];
    let durationMs: number;

    try {
      if (config.pattern && config.pattern.length > 0) {
        durationMs = playPattern(config);
      } else {
        durationMs = playTone(config, getAudioContext().currentTime);
      }
    } catch (err) {
      console.error(`[AlarmSound] 播放${level}音效异常`, err);
      return false;
    }

    setIsPlaying(true);

    // 播放完毕自动复位状态
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
    }
    stopTimerRef.current = window.setTimeout(() => {
      setIsPlaying(false);
      activeNodesRef.current = [];
    }, durationMs + 100);

    return true;
  }, [isMuted, getAudioContext, playPattern, playTone]);

  // 监听静音状态：尝试订阅monitorStore变化，若不可用则监听storage事件
  useEffect(() => {
    // storage事件：监听跨标签页的静音切换
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'monitor:alarmMuted') {
        setIsMuted(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);

    // 尝试每1秒轮询一次（作为兜底，应对同标签页内外部修改localStorage的场景）
    const pollTimer = window.setInterval(() => {
      const current = getAlarmMuted();
      setIsMuted((prev) => (prev !== current ? current : prev));
    }, 1000);

    // 首次用户交互自动解锁
    const unlockOnInteraction = async () => {
      if (!isUnlocked) {
        await unlock();
      }
    };
    const unlockEvents = ['click', 'keydown', 'touchstart', 'pointerdown'] as const;
    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, unlockOnInteraction, { once: true, passive: true });
    });

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(pollTimer);
      unlockEvents.forEach((evt) => {
        window.removeEventListener(evt, unlockOnInteraction);
      });
      stop();
      destroyAudioContext();
    };
  }, [isUnlocked, unlock, stop, destroyAudioContext]);

  // 同步isMuted到持久化
  useEffect(() => {
    setAlarmMuted(isMuted);
  }, [isMuted]);

  return {
    play,
    stop,
    isPlaying,
    isMuted,
    isUnlocked,
    unlock,
  };
}

export default useAlarmSound;
