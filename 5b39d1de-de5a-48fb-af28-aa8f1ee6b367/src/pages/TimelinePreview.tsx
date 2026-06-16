import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Track } from '@/components/Timeline/Track';
import { Skeleton } from '@/components/Common/Skeleton';
import { useProjectStore } from '@/stores/projectStore';
import { Shot } from '@/types';
import { generateThumbnail, getCachedThumbnail } from '@/utils/thumbnailGenerator';
import { formatTime } from '@/utils/fpsCalculator';

type PlaybackRate = 0.25 | 0.5 | 1 | 1.5 | 2;
type FpsRate = 12 | 24 | 30;

const PLAYBACK_RATES: PlaybackRate[] = [0.25, 0.5, 1, 1.5, 2];
const FPS_RATES: FpsRate[] = [12, 24, 30];

interface TimelineSegment {
  shot: Shot;
  start: number;
  end: number;
}

export const TimelinePreview: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const currentProject = useProjectStore((s) => s.currentProject);
  const shots = useProjectStore((s) => s.shots);
  const scenes = useProjectStore((s) => s.scenes);
  const loadProject = useProjectStore((s) => s.loadProject);
  const updateShot = useProjectStore((s) => s.updateShot);
  const commitHistory = useProjectStore((s) => s._commitHistory);

  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentShotId, setCurrentShotId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [fps, setFps] = useState<FpsRate>(24);
  const [abLoop, setAbLoop] = useState<{ a: number | null; b: number | null }>({
    a: null,
    b: null,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cameraFilter, setCameraFilter] = useState<string>('');
  const [transitionFilter, setTransitionFilter] = useState<string>('');

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const projectId = searchParams.get('project');

  const segments = useMemo<TimelineSegment[]>(() => {
    const arr: TimelineSegment[] = [];
    let acc = 0;
    for (const shot of shots) {
      const end = acc + shot.duration;
      arr.push({ shot, start: acc, end });
      acc = end;
    }
    return arr;
  }, [shots]);

  const totalDuration = segments.length ? segments[segments.length - 1].end : 0;

  const filteredShotIds = useMemo(() => {
    if (!cameraFilter && !transitionFilter) return null;
    return new Set(
      shots
        .filter(
          (s) =>
            (!cameraFilter || s.cameraMovement === cameraFilter) &&
            (!transitionFilter || s.transition === transitionFilter)
        )
        .map((s) => s.id)
    );
  }, [shots, cameraFilter, transitionFilter]);

  const displayedSegments = useMemo(() => {
    if (!filteredShotIds) return segments;
    return segments.filter((seg) => filteredShotIds.has(seg.shot.id));
  }, [segments, filteredShotIds]);

  const displayedShots = useMemo(() => {
    if (!filteredShotIds) return shots;
    return shots.filter((s) => filteredShotIds.has(s.id));
  }, [shots, filteredShotIds]);

  const findSegmentByTime = useCallback(
    (t: number): TimelineSegment | null => {
      if (displayedSegments.length === 0) return null;
      if (t < 0) return displayedSegments[0];
      if (t >= totalDuration) return displayedSegments[displayedSegments.length - 1];
      return (
        displayedSegments.find((seg) => t >= seg.start && t < seg.end) ||
        displayedSegments[displayedSegments.length - 1]
      );
    },
    [displayedSegments, totalDuration]
  );

  useEffect(() => {
    const init = async () => {
      if (!projectId) {
        navigate('/projects');
        return;
      }
      await loadProject(projectId);
      setLoading(false);
    };
    init();
  }, [projectId, loadProject, navigate]);

  useEffect(() => {
    const seg = findSegmentByTime(currentTime);
    if (seg && seg.shot.id !== currentShotId) {
      setCurrentShotId(seg.shot.id);
    }
  }, [currentTime, findSegmentByTime, currentShotId]);

  useEffect(() => {
    if (!currentShotId) return;
    const shot = shots.find((s) => s.id === currentShotId);
    if (!shot) return;
    setPreviewLoading(true);
    let alive = true;
    const cached = getCachedThumbnail(shot.id);
    if (cached) {
      setPreviewUrl(cached);
      setPreviewLoading(false);
      return;
    }
    const load = async () => {
      try {
        const url = await generateThumbnail(shot, 1280, 720);
        if (alive) {
          setPreviewUrl(url);
          setPreviewLoading(false);
        }
      } catch {
        if (alive) setPreviewLoading(false);
      }
    };
    const t = setTimeout(load, 30);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [currentShotId, shots]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      return;
    }

    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const deltaSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const advance = deltaSec * playbackRate;

      setCurrentTime((prev) => {
        let next = prev + advance;
        if (abLoop.a !== null && abLoop.b !== null && abLoop.a < abLoop.b) {
          if (next >= abLoop.b) {
            next = abLoop.a + (next - abLoop.b);
          }
        }
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, playbackRate, totalDuration, abLoop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const frameStep = 1 / fps;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        setCurrentTime((t) => Math.min(totalDuration, t + frameStep));
      } else if (e.key === 'ArrowLeft') {
        setCurrentTime((t) => Math.max(0, t - frameStep));
      } else if (e.key === 'ArrowUp') {
        setPlaybackRate((r) => {
          const idx = PLAYBACK_RATES.indexOf(r);
          return PLAYBACK_RATES[Math.min(idx + 1, PLAYBACK_RATES.length - 1)];
        });
      } else if (e.key === 'ArrowDown') {
        setPlaybackRate((r) => {
          const idx = PLAYBACK_RATES.indexOf(r);
          return PLAYBACK_RATES[Math.max(idx - 1, 0)];
        });
      } else if (e.key === 'a' || e.key === 'A') {
        setAbLoop((prev) => ({ ...prev, a: currentTime }));
      } else if (e.key === 'b' || e.key === 'B') {
        setAbLoop((prev) => ({ ...prev, b: currentTime }));
      } else if (e.key === 'r' || e.key === 'R') {
        setAbLoop({ a: null, b: null });
      } else if (e.key === 'Escape') {
        if (projectId) navigate(`/editor?project=${projectId}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fps, totalDuration, currentTime, navigate, projectId]);

  const handleSeek = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  };

  const handleShotClick = (shotId: string) => {
    const seg = segments.find((s) => s.shot.id === shotId);
    if (seg) {
      handleSeek(seg.start + seg.shot.duration * 0.1);
    }
  };

  const handleDurationChange = (shotId: string, newDuration: number) => {
    updateShot(shotId, { duration: newDuration });
    commitHistory();
  };

  const currentSegment = findSegmentByTime(currentTime);
  const currentShot = currentSegment?.shot;
  const timeInShot = currentSegment ? currentTime - currentSegment.start : 0;

  const activeDialogues = useMemo(() => {
    if (!currentShot?.dialogues) return [];
    return currentShot.dialogues.filter(
      (d) =>
        d.timePoint <= timeInShot &&
        d.timePoint + Math.min(3, currentShot.duration / 2) >= timeInShot
    );
  }, [currentShot, timeInShot]);

  const togglePlay = () => setIsPlaying((p) => !p);

  const stepFrame = (dir: 1 | -1) => {
    const step = (1 / fps) * dir;
    handleSeek(currentTime + step);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#1e1e2e]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-3 border-[#7c3aed] border-t-transparent animate-spin"></div>
          <p className="text-gray-400 text-sm">加载时间轴中...</p>
        </div>
      </div>
    );
  }

  const sceneName =
    currentShot && scenes.find((s) => s.id === currentShot.sceneId)?.name;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#161622] text-white overflow-hidden">
      <header className="h-12 flex items-center justify-between px-4 border-b border-white/10 bg-[#1e1e2e] flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              projectId ? navigate(`/editor?project=${projectId}`) : navigate('/projects')
            }
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 transition-colors"
            title="返回编辑器 (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 19l-7-7 7-7M3 12h18" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#ef4444] flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-[#7c3aed]/20">
            ▶
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-100 truncate">
              时间轴预览
            </h1>
            <p className="text-[10px] text-gray-500 flex items-center gap-3">
              <span>{currentProject?.name}</span>
              <span>{shots.length} 分镜</span>
              <span>{formatTime(totalDuration)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] bg-white/5 rounded-md px-2 py-1">
            <span className="text-gray-500">镜头:</span>
            <select
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
              className="bg-transparent text-gray-300 outline-none cursor-pointer"
            >
              <option value="">全部</option>
              <option value="static">固定</option>
              <option value="push">推</option>
              <option value="pull">拉</option>
              <option value="pan">摇</option>
              <option value="tilt">移</option>
              <option value="follow">跟</option>
            </select>
          </div>
          <div className="flex items-center gap-1 text-[11px] bg-white/5 rounded-md px-2 py-1">
            <span className="text-gray-500">转场:</span>
            <select
              value={transitionFilter}
              onChange={(e) => setTransitionFilter(e.target.value)}
              className="bg-transparent text-gray-300 outline-none cursor-pointer"
            >
              <option value="">全部</option>
              <option value="cut">切</option>
              <option value="fade">淡入淡出</option>
              <option value="wipe">划变</option>
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col p-4 gap-4">
        <div
          ref={previewContainerRef}
          className="relative w-full max-h-[calc(100vh-380px)] aspect-video mx-auto bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 group"
        >
          <div className="absolute inset-0 bg-[#0a0a14] flex items-center justify-center">
            {previewLoading || !previewUrl ? (
              <div className="w-full h-full p-6 flex items-center justify-center">
                <Skeleton className="w-full h-full max-w-[90%] max-h-[90%] rounded-lg" />
              </div>
            ) : (
              <img
                src={previewUrl}
                alt="预览"
                className="w-full h-full object-contain animate-fade-in"
                draggable={false}
              />
            )}
          </div>

          {activeDialogues.length > 0 && (
            <div className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-2 px-6 pointer-events-none">
              {activeDialogues.map((d) => (
                <div
                  key={d.id}
                  className="max-w-2xl bg-black/75 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl border border-white/10 animate-fade-in"
                >
                  <p className="text-xs text-[#a78bfa] font-semibold mb-0.5">
                    {d.character || '未知角色'}
                  </p>
                  <p className="text-sm leading-relaxed">{d.text}</p>
                </div>
              ))}
            </div>
          )}

          {currentShot && (
            <>
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-3 py-1.5 space-y-0.5 text-[11px] border border-white/10">
                <p className="text-gray-300 font-mono">
                  #{currentShot.orderIndex + 1} · {sceneName || '—'}
                </p>
                <p className="text-gray-400 truncate max-w-[240px]">
                  {currentShot.title || '未命名分镜'}
                </p>
              </div>

              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-md px-3 py-1.5 space-y-0.5 text-[11px] border border-white/10 text-right">
                <div className="flex gap-2 justify-end text-gray-400">
                  <span>🎥 {currentShot.cameraMovement}</span>
                </div>
                <div className="flex gap-2 justify-end text-gray-400">
                  <span>
                    {(currentShot.sfxTags || []).slice(0, 4).join(' · ') || '—'}
                  </span>
                </div>
              </div>

              <div className="absolute bottom-3 left-3 right-3">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#7c3aed] to-[#ef4444] transition-all duration-75"
                    style={{
                      width: `${Math.min(100, (timeInShot / currentShot.duration) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {isPlaying && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-16 h-16 rounded-full border-2 border-white/10 animate-ping opacity-30" />
            </div>
          )}
        </div>

        <div className="h-16 bg-[#1e1e2e] rounded-xl border border-white/10 px-4 flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSeek(0)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-100 transition-colors"
              title="回到起点"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
            <button
              onClick={() => stepFrame(-1)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-100 transition-colors"
              title="上一帧 ←"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-lg shadow-[#7c3aed]/30 transition-all active:scale-95"
              title="播放/暂停 (Space)"
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-100 transition-colors"
              title="下一帧 →"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              onClick={() => handleSeek(totalDuration)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-100 transition-colors"
              title="跳到末尾"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 mr-1">速度</span>
            {PLAYBACK_RATES.map((r) => (
              <button
                key={r}
                onClick={() => setPlaybackRate(r)}
                className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                  playbackRate === r
                    ? 'bg-[#7c3aed] text-white font-semibold'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 mr-1">帧率</span>
            {FPS_RATES.map((f) => (
              <button
                key={f}
                onClick={() => setFps(f)}
                className={`px-2 py-1 text-[11px] rounded-md font-mono transition-colors ${
                  fps === f
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={() => setAbLoop({ ...abLoop, a: currentTime })}
              className={`px-2 py-1 rounded-md border transition-colors ${
                abLoop.a !== null
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'border-white/10 text-gray-500 hover:text-gray-300'
              }`}
              title="设置 A 点 (A)"
            >
              A {abLoop.a !== null ? formatTime(abLoop.a) : '—'}
            </button>
            <button
              onClick={() => setAbLoop({ ...abLoop, b: currentTime })}
              className={`px-2 py-1 rounded-md border transition-colors ${
                abLoop.b !== null
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'border-white/10 text-gray-500 hover:text-gray-300'
              }`}
              title="设置 B 点 (B)"
            >
              B {abLoop.b !== null ? formatTime(abLoop.b) : '—'}
            </button>
            {(abLoop.a !== null || abLoop.b !== null) && (
              <button
                onClick={() => setAbLoop({ a: null, b: null })}
                className="px-2 py-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="清除循环 (R)"
              >
                清除
              </button>
            )}
          </div>

          <div className="ml-auto font-mono text-sm text-gray-200 flex items-center gap-2">
            <span className="text-[#7c3aed]">{formatTime(currentTime)}</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-500">{formatTime(totalDuration)}</span>
          </div>
        </div>

        <div className="flex-1 min-h-[180px] bg-[#1e1e2e] rounded-xl border border-white/10 overflow-hidden flex-shrink-0 flex flex-col">
          <Track
            shots={displayedShots}
            currentShotId={currentShotId}
            currentTime={currentTime}
            onShotClick={handleShotClick}
            onShotDurationChange={handleDurationChange}
            onSeek={handleSeek}
            fps={fps}
          />
        </div>
      </div>
    </div>
  );
};
