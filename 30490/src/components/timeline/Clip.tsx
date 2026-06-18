import { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, Scissors, Copy, Repeat } from 'lucide-react';
import type { TimelineClip, WaveformData } from '@/types';
import { useTimelineStore } from '@/store/timelineStore';
import { useAudioStore } from '@/store/audioStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { translate } from '@/i18n';
import { getWaveformData } from '@/storage/fileOperations';
import styles from './Clip.module.css';

interface ClipProps {
  clip: TimelineClip;
  pxPerSecond: number;
  trackHeight: number;
}

const RESIZE_HANDLE_WIDTH = 8;

export const Clip = ({
  clip,
  pxPerSecond,
  trackHeight,
}: ClipProps) => {
  const language = useSettingsStore((s) => s.language);
  const { recordings } = useAudioStore();
  const { actions } = useTimelineStore();
  const showToast = useUIStore((s) => s.actions.showToast);
  const t = (key: string) => translate(language, key);

  const [isSelected, setIsSelected] = useState(false);
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const clipRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; startTime: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; startTime: number; endTime: number } | null>(null);

  const audio = recordings.find((r) => r.id === clip.audioId);
  const clipDuration = clip.endTime - clip.startTime;
  const left = clip.startTime * pxPerSecond;
  const width = clipDuration * pxPerSecond;

  useEffect(() => {
    if (!audio) return;

    let mounted = true;
    void getWaveformData(audio.waveformDataPath).then((data) => {
      if (mounted) {
        setWaveformData(data);
      }
    });

    return () => {
      mounted = false;
    };
  }, [audio]);

  const downsampleWaveform = useCallback(
    (data: WaveformData, targetWidth: number): number[] => {
      if (data.peaks.length === 0 || targetWidth <= 0) return [];

      const clipStartRatio = 0;
      const clipEndRatio = 1;
      const startIndex = Math.floor(data.peaks.length * clipStartRatio);
      const endIndex = Math.ceil(data.peaks.length * clipEndRatio);
      const clipPeaks = data.peaks.slice(startIndex, endIndex);

      const samplesPerBar = Math.max(1, Math.floor(clipPeaks.length / targetWidth));
      const result: number[] = [];

      for (let i = 0; i < targetWidth; i++) {
        const start = i * samplesPerBar;
        const end = Math.min(start + samplesPerBar, clipPeaks.length);
        let max = 0;
        for (let j = start; j < end; j++) {
          if (clipPeaks[j] > max) max = clipPeaks[j];
        }
        result.push(max);
      }

      return result;
    },
    [],
  );

  const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();
    setIsSelected(true);

    if (mode === 'move') {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        startTime: clip.startTime,
      };
    } else {
      if (mode === 'resize-left') {
        setIsResizingLeft(true);
      } else {
        setIsResizingRight(true);
      }
      resizeStartRef.current = {
        x: e.clientX,
        startTime: clip.startTime,
        endTime: clip.endTime,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaTime = deltaX / pxPerSecond;
        let newStartTime = dragStartRef.current.startTime + deltaTime;
        newStartTime = Math.max(0, newStartTime);

        void actions.updateClip(clip.id, {
          startTime: newStartTime,
          endTime: newStartTime + clipDuration,
        });
      }

      if ((isResizingLeft || isResizingRight) && resizeStartRef.current) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaTime = deltaX / pxPerSecond;
        const minDuration = 0.1;

        if (isResizingLeft) {
          let newStartTime = resizeStartRef.current.startTime + deltaTime;
          newStartTime = Math.max(0, Math.min(newStartTime, resizeStartRef.current.endTime - minDuration));

          void actions.updateClip(clip.id, {
            startTime: newStartTime,
          });
        } else if (isResizingRight) {
          let newEndTime = resizeStartRef.current.endTime + deltaTime;
          newEndTime = Math.max(resizeStartRef.current.startTime + minDuration, newEndTime);

          void actions.updateClip(clip.id, {
            endTime: newEndTime,
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizingLeft(false);
      setIsResizingRight(false);
      dragStartRef.current = null;
      resizeStartRef.current = null;
    };

    if (isDragging || isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizingLeft, isResizingRight, pxPerSecond, clip.id, clipDuration, actions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showContextMenu) {
        setShowContextMenu(false);
      }
      if (clipRef.current && !clipRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
    setIsSelected(true);
  };

  const handleDelete = () => {
    void actions.deleteClip(clip.id);
    setShowContextMenu(false);
    showToast('success', t('timeline.deleteClip'));
  };

  const handleSplit = async () => {
    const state = useTimelineStore.getState();
    const splitTime = state.currentTime;

    if (splitTime > clip.startTime && splitTime < clip.endTime) {
      await actions.splitClip(clip.id, splitTime);
    }
    setShowContextMenu(false);
    showToast('success', t('timeline.splitClip'));
  };

  const handleDuplicate = async () => {
    const { currentProject } = useTimelineStore.getState();
    if (!currentProject) return;

    const newStartTime = clip.endTime + 1;
    const newClip = await actions.addClip(currentProject.id, clip.audioId, newStartTime);
    if (newClip) {
      void actions.updateClip(newClip.id, {
        trackIndex: clip.trackIndex,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        volume: clip.volume,
        loop: clip.loop,
      });
    }
    setShowContextMenu(false);
    showToast('success', t('common.success'));
  };

  const handleToggleLoop = () => {
    void actions.updateClip(clip.id, { loop: !clip.loop });
    setShowContextMenu(false);
  };

  const waveformBars = waveformData
    ? downsampleWaveform(waveformData, Math.max(1, Math.floor(width - 16)))
    : [];

  return (
    <>
      <div
        ref={clipRef}
        className={`
          ${styles.clip}
          ${isSelected ? styles.selected : ''}
          ${isDragging ? styles.dragging : ''}
          ${(isResizingLeft || isResizingRight) ? styles.resizing : ''}
        `}
        style={{
          left,
          width,
          height: trackHeight - 8,
          top: 4,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
        onContextMenu={handleContextMenu}
      >
        <div
          className={styles.resizeHandleLeft}
          style={{ width: RESIZE_HANDLE_WIDTH }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
        />

        <div className={styles.content}>
          {audio && (
            <div className={styles.titleBar}>
              <span className={styles.title}>{audio.title}</span>
              {clip.loop && (
                <Repeat size={12} className={styles.loopIcon} />
              )}
            </div>
          )}

          <div className={styles.waveform}>
            <svg
              className={styles.waveformSvg}
              preserveAspectRatio="none"
              viewBox={`0 0 ${waveformBars.length} 100`}
            >
              {waveformBars.map((peak, i) => {
                const height = Math.max(4, peak * 80);
                const y = (100 - height) / 2;
                return (
                  <rect
                    key={i}
                    x={i}
                    y={y}
                    width={Math.max(1, 0.8)}
                    height={height}
                    fill={isSelected ? 'var(--color-accent-secondary)' : 'var(--color-waveform)'}
                    opacity={0.85}
                  />
                );
              })}
            </svg>
          </div>

          {clip.fadeIn > 0 && (
            <div
              className={styles.fadeIn}
              style={{ width: clip.fadeIn * pxPerSecond }}
            >
              <svg viewBox="0 0 100 100" className={styles.fadeTriangle}>
                <polygon points="0,100 100,100 0,0" fill="rgba(255,255,255,0.3)" />
              </svg>
            </div>
          )}

          {clip.fadeOut > 0 && (
            <div
              className={styles.fadeOut}
              style={{ width: clip.fadeOut * pxPerSecond }}
            >
              <svg viewBox="0 0 100 100" className={styles.fadeTriangle}>
                <polygon points="100,100 0,100 100,0" fill="rgba(255,255,255,0.3)" />
              </svg>
            </div>
          )}
        </div>

        <div
          className={styles.resizeHandleRight}
          style={{ width: RESIZE_HANDLE_WIDTH }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
        />
      </div>

      {showContextMenu && (
        <div
          className={styles.contextMenu}
          style={{
            left: contextMenuPos.x,
            top: contextMenuPos.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={styles.contextMenuItem}
            onClick={handleSplit}
          >
            <Scissors size={14} />
            <span>{t('timeline.splitClip')}</span>
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={handleDuplicate}
          >
            <Copy size={14} />
            <span>{t('common.edit').replace(t('common.edit'), t('timeline.clipCount').replace('{count}', '1'))}</span>
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={handleToggleLoop}
          >
            <Repeat size={14} />
            <span>{clip.loop ? t('player.clearLoop') : t('timeline.loop')}</span>
          </button>
          <div className={styles.contextMenuDivider} />
          <button
            className={`${styles.contextMenuItem} ${styles.danger}`}
            onClick={handleDelete}
          >
            <Trash2 size={14} />
            <span>{t('timeline.deleteClip')}</span>
          </button>
        </div>
      )}
    </>
  );
};

export default Clip;
