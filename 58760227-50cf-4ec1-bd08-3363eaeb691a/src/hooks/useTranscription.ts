import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import type { TranscriptSegment } from "@/types/audio";
import { uuid } from "@/utils/audioProcessor";

type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: Array<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
    length: number;
  }>;
}

export interface TranscriptionState {
  supported: boolean;
  isRecording: boolean;
  error: string | null;
  currentText: string;
  segments: TranscriptSegment[];
}

export interface TranscriptionAPI extends TranscriptionState {
  start: (trackId?: string) => void;
  stop: () => void;
  toggle: (trackId?: string) => void;
  clear: () => void;
  jumpToSegment: (id: string) => void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function useTranscription(): TranscriptionAPI {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const trackIdRef = useRef<string | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const segmentStartRef = useRef<number>(0);
  const partialTextRef = useRef<string>("");

  const projectTrackId = useProjectStore((s) => s.activeTrackId);
  const currentTime = useProjectStore((s) => s.currentTime);
  const storeSegments = useProjectStore((s) => s.project.transcripts);
  const addTranscript = useProjectStore((s) => s.addTranscript);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState("");

  const supported = Boolean(
    typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const getConstructor = useCallback((): SpeechRecognitionCtor | null => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  }, []);

  const commitSegment = useCallback(
    (text: string, endOffset: number) => {
      const trackId = trackIdRef.current ?? projectTrackId;
      const start = segmentStartRef.current;
      const end = Math.max(start + 0.1, startTimeRef.current + endOffset);
      if (text.trim().length === 0) return;
      const seg: TranscriptSegment = {
        id: uuid(),
        trackId: trackId ?? "global",
        startTime: start,
        endTime: end,
        text: text.trim(),
      };
      addTranscript([seg]);
      segmentStartRef.current = end;
      partialTextRef.current = "";
    },
    [addTranscript, projectTrackId]
  );

  const start = useCallback(
    (trackId?: string) => {
      setError(null);
      if (!supported) {
        setError("当前浏览器不支持 Web Speech API，请使用 Chrome/Edge");
        return;
      }
      const Ctor = getConstructor();
      if (!Ctor) {
        setError("SpeechRecognition 不可用");
        return;
      }
      stop();
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language.includes("zh") ? "zh-CN" : "en-US";
      rec.maxAlternatives = 1;

      trackIdRef.current = trackId ?? projectTrackId ?? undefined;
      startTimeRef.current = currentTime;
      segmentStartRef.current = currentTime;
      partialTextRef.current = "";

      rec.onstart = () => {
        setIsRecording(true);
        setCurrentText("");
      };

      rec.onresult = (ev: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) {
            const txt = (partialTextRef.current + r[0].transcript).trim();
            const elapsed =
              (window.performance.now() - startTimeRef.current) / 1000 +
              startTimeRef.current -
              segmentStartRef.current +
              currentTime;
            partialTextRef.current = "";
            commitSegment(txt, Math.max(0.1, elapsed));
          } else {
            interim += r[0].transcript;
          }
        }
        partialTextRef.current = interim;
        setCurrentText(interim);
      };

      rec.onerror = (e) => {
        const msg = (e as unknown as { error?: string }).error ?? "unknown";
        if (msg === "no-speech" || msg === "aborted") return;
        setError("识别错误: " + msg);
        setIsRecording(false);
      };

      rec.onend = () => {
        if (partialTextRef.current.trim()) {
          const elapsed =
            (window.performance.now() - startTimeRef.current) / 1000;
          commitSegment(partialTextRef.current, Math.max(0.1, elapsed));
        }
        setIsRecording(false);
        setCurrentText("");
      };

      try {
        rec.start();
        recognitionRef.current = rec;
      } catch (e) {
        setError("启动失败: " + String(e));
      }
    },
    [supported, getConstructor, projectTrackId, currentTime, commitSegment]
  );

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const toggle = useCallback(
    (trackId?: string) => {
      if (isRecording) stop();
      else start(trackId);
    },
    [isRecording, start, stop]
  );

  const clear = useCallback(() => {
    setCurrentText("");
    partialTextRef.current = "";
  }, []);

  const jumpToSegment = useCallback(
    (id: string) => {
      const seg = storeSegments.find((s) => s.id === id);
      if (seg) setCurrentTime(seg.startTime);
    },
    [storeSegments, setCurrentTime]
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    supported,
    isRecording,
    error,
    currentText,
    segments: storeSegments,
    start,
    stop,
    toggle,
    clear,
    jumpToSegment,
  };
}

export function mockTranscript(
  trackId: string,
  duration: number,
  count = 12
): TranscriptSegment[] {
  const sampleText = [
    "欢迎收听本期播客节目，我是主持人小A",
    "今天我们要聊的话题非常有意思",
    "先给大家介绍一下今天的嘉宾",
    "这位嘉宾在这个行业里有超过十年的经验",
    "先请您简单给大家打个招呼",
    "非常感谢邀请，很高兴能来到这里",
    "那我们直接进入第一个话题",
    "关于这个问题，我觉得有几点需要说明",
    "第一点是关于技术层面的考量",
    "其次我们也要关注用户的真实需求",
    "最后还有一点是运营层面的策略",
    "总结一下今天的讨论内容，非常精彩",
    "时间差不多了，感谢大家的收听",
    "我们下期节目再见",
  ];
  const segs: TranscriptSegment[] = [];
  const step = duration / (count + 1);
  for (let i = 0; i < Math.min(count, sampleText.length); i++) {
    const s = step * (i + 0.3);
    segs.push({
      id: uuid(),
      trackId,
      startTime: s,
      endTime: s + step * 0.7,
      text: sampleText[i],
    });
  }
  return segs;
}
