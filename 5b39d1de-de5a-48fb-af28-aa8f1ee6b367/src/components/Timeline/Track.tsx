import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Shot } from '@/types';
import { generateThumbnail, getCachedThumbnail } from '@/utils/thumbnailGenerator';
import { Skeleton } from '@/components/Common/Skeleton';

const THUMB_WIDTH_RATIO = 40; // 每秒像素数 (px/s)
const MIN_WIDTH = 40;
const THUMB_HEIGHT = 72;

interface TrackProps {
  shots: Shot[];
  currentShotId: string | null;
  currentTime: number;
  onShotClick: (shotId: string) => void;
  onShotDurationChange?: (shotId: string, newDuration: number) => void;
  onSeek: (time: number) => void;
  fps: number;
}

interface ShotItemProps {
  shot: Shot;
  startX: number;
  width: number;
  isActive: boolean;
  onClick: () => void;
  onDurationChange: (duration: number) => void;
}

const ShotItem: React.FC<ShotItemProps> = ({
  shot,
  startX,
  width,
  isActive,
  onClick,
  onDurationChange,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const resizeStartRef = useRef<{ x: number; duration: number } | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const cached = getCachedThumbnail(shot.id);
    if (cached) {
      setThumbUrl(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    const doGenerate = async () => {
      try {
        const url = await generateThumbnail(shot, 320, 180);
        if (alive) {
          setThumbUrl(url);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setLoading(false);
        }
      }
    };
    const t = setTimeout(doGenerate, 50 + Math.random() * 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [shot]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const dx = e.clientX - resizeStartRef.current.x;
      const deltaDuration = dx / THUMB_WIDTH_RATIO;
      let newDuration = resizeStartRef.current.duration;
      if (dragging === 'right') {
        newDuration = newDuration + deltaDuration;
      } else {
        newDuration = Math.max(0.5, newDuration - deltaDuration);
      }
      newDuration = Math.max(0.5, Math.min(30, Math.round(newDuration * 10) / 10));
      onDurationChange(newDuration);
    };
    const onUp = () => {
      setDragging(null);
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = dragging === 'left' ? 'w-resize' : 'e-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onDurationChange]);

  const startResize = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(side);
    resizeStartRef.current = { x: e.clientX, duration: shot.duration };
  };

  return (
    <div
      ref={itemRef}
      onClick={onClick}
      className={`group absolute top-0 h-full flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2 ${
        isActive
          ? 'border-[#7c3aed] shadow-[0_0_12px_rgba(124,58,237,0.5)] scale-[1.02] z-10'
          : 'border-transparent hover:border-white/30'
      }`}
      style={{
        left: `${startX}px`,
        width: `${width}px`,
      }}
    >
      <div className="relative w-full h-full bg-[#252535] overflow-hidden">
        {loading ? (
          <div className="w-full h-full p-1.5">
            <Skeleton className="w-full h-full rounded" />
          </div>
        ) : thumbUrl ? (
          <img
            src={thumbUrl}
            alt={shot.title || `分镜 ${shot.orderIndex + 1}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2a2a40] to-[#1e1e2e] text-gray-600 text-xs">
            暂无内容
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-8">
          <p className="text-[10px] text-white font-medium truncate drop-shadow-sm">
            {shot.orderIndex + 1}. {shot.title || `分镜 ${shot.orderIndex + 1}`}
          </p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] font-mono text-gray-300/80">
              {shot.duration.toFixed(1)}s
            </span>
            <div className="flex items-center gap-0.5">
              {(shot.sfxTags || []).slice(0, 3).map((sfx) => (
                <span key={sfx} className="text-[9px] opacity-70">
                  {sfx}
                </span>
              ))}
            </div>
          </div>
        </div>

        {isActive && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#7c3aed] text-[9px] font-bold text-white">
            播放中
          </div>
        )}
      </div>

      {onDurationChange && (
        <>
          <div
            onMouseDown={startResize('left')}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-[#7c3aed]/40 transition-colors z-20 flex items-center justify-center"
          >
            <div className="w-0.5 h-8 bg-white/30 rounded-full" />
          </div>
          <div
            onMouseDown={startResize('right')}
            className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-[#7c3aed]/40 transition-colors z-20 flex items-center justify-center"
          >
            <div className="w-0.5 h-8 bg-white/30 rounded-full" />
          </div>
        </>
      )}
    </div>
  );
};

export const Track: React.FC<TrackProps> = ({
  shots,
  currentShotId,
  currentTime,
  onShotClick,
  onShotDurationChange,
  onSeek,
  fps,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const { layout, totalWidth } = useMemo(() => {
    const positions: Array<{ shot: Shot; startX: number; width: number; startTime: number }> = [];
    let x = 0;
    let startTime = 0;
    for (const shot of shots) {
      const width = Math.max(MIN_WIDTH, shot.duration * THUMB_WIDTH_RATIO);
      positions.push({ shot, startX: x, width, startTime });
      x += width;
      startTime += shot.duration;
    }
    return { layout: positions, totalWidth: Math.max(x, 800) };
  }, [shots]);

  const playheadX = currentTime * THUMB_WIDTH_RATIO;

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const scrollLeft = trackRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;
    const time = Math.max(0, x / THUMB_WIDTH_RATIO);
    onSeek(time);
  };

  const ticks = useMemo(() => {
    const totalSec = shots.reduce((sum, s) => sum + s.duration, 0);
    const step = totalSec > 60 ? 10 : totalSec > 30 ? 5 : totalSec > 10 ? 2 : 1;
    const arr: Array<{ x: number; label: string }> = [];
    for (let t = 0; t <= totalSec + step; t += step) {
      const mm = Math.floor(t / 60);
      const ss = Math.floor(t % 60);
      arr.push({
        x: t * THUMB_WIDTH_RATIO,
        label: `${mm}:${ss.toString().padStart(2, '0')}`,
      });
    }
    return arr;
  }, [shots]);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="h-6 flex-shrink-0 bg-[#1a1a28] border-b border-white/5 text-[10px] text-gray-500 font-mono relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 top-0"
          style={{ width: `${totalWidth}px` }}
        >
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 flex items-end"
              style={{ left: `${tick.x}px` }}
            >
              <div className="w-px h-2 bg-white/10" />
              <span className="absolute left-1 -translate-y-3 whitespace-nowrap">
                {tick.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="flex-1 relative overflow-x-auto overflow-y-hidden bg-[#161622] select-none cursor-pointer"
      >
        <div
          className="relative h-full py-2"
          style={{
            width: `${totalWidth + 80}px`,
            minHeight: `${THUMB_HEIGHT + 16}px`,
          }}
        >
          {layout.map(({ shot, startX, width }) => (
            <ShotItem
              key={shot.id}
              shot={shot}
              startX={startX + 8}
              width={width - 4}
              isActive={currentShotId === shot.id}
              onClick={() => onShotClick(shot.id)}
              onDurationChange={(d) => onShotDurationChange?.(shot.id, d)}
            />
          ))}

          <div
            className="playhead"
            style={{
              left: `${playheadX}px`,
            }}
          >
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#ef4444] -translate-x-1/2 -mt-0.5" />
            <div className="w-0.5 h-full bg-[#ef4444] translate-x-[-1px]" />
          </div>
        </div>
      </div>
    </div>
  );
};
