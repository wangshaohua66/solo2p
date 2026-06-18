import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useTimelineStore } from '@/store/timelineStore';
import { useAudioStore } from '@/store/audioStore';
import { useSettingsStore } from '@/store/settingsStore';
import { translate } from '@/i18n';
import Track from './Track';
import styles from './Timeline.module.css';

const PX_PER_SECOND_BASE = 50;
const TRACK_HEIGHT = 80;
const RULER_HEIGHT = 40;
const TRACK_HEADER_WIDTH = 160;

const formatRulerTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const Timeline = () => {
  const language = useSettingsStore((s) => s.language);
  const t = (key: string) => translate(language, key);

  const {
    currentProject,
    clips,
    currentTime,
    zoomLevel,
    actions,
  } = useTimelineStore();
  const { recordings } = useAudioStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const [isDraggingRecording, setIsDraggingRecording] = useState(false);
  const [dragOverTrack, setDragOverTrack] = useState<number | null>(null);
  const [dragOverTime, setDragOverTime] = useState<number>(0);

  const pxPerSecond = PX_PER_SECOND_BASE * zoomLevel;

  const trackIndices = useMemo(() => {
    if (!currentProject) return [0];
    const maxTrack = clips.reduce((max, c) => Math.max(max, c.trackIndex), 0);
    const tracks = [];
    for (let i = 0; i <= maxTrack + 1; i++) {
      tracks.push(i);
    }
    return tracks.length > 0 ? tracks : [0, 1];
  }, [clips, currentProject]);

  const totalDuration = useMemo(() => {
    if (currentProject?.totalDuration && currentProject.totalDuration > 0) {
      return Math.max(currentProject.totalDuration, 60);
    }
    const maxEnd = clips.reduce((max, c) => Math.max(max, c.endTime), 0);
    return Math.max(maxEnd + 10, 60);
  }, [clips, currentProject]);

  const totalWidth = Math.ceil(totalDuration * pxPerSecond);

  const rulerMarks = useMemo(() => {
    const marks: { position: number; label: string; major: boolean }[] = [];
    let interval: number;

    if (zoomLevel >= 2) {
      interval = 1;
    } else if (zoomLevel >= 1) {
      interval = 5;
    } else if (zoomLevel >= 0.5) {
      interval = 10;
    } else {
      interval = 30;
    }

    for (let time = 0; time <= totalDuration; time += interval) {
      const position = time * pxPerSecond;
      const major = time % (interval * 5) === 0 || interval <= 5;
      marks.push({
        position,
        label: major ? formatRulerTime(time) : '',
        major,
      });
    }

    return marks;
  }, [totalDuration, pxPerSecond, zoomLevel]);

  const handleHorizontalScroll = useCallback(() => {
    if (horizontalScrollRef.current && rulerRef.current) {
      rulerRef.current.scrollLeft = horizontalScrollRef.current.scrollLeft;
    }
  }, []);

  const handleVerticalScroll = useCallback(() => {
    void verticalScrollRef.current;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.25, Math.min(4, zoomLevel * delta));
      actions.setZoomLevel(newZoom);
    } else if (e.shiftKey) {
      if (horizontalScrollRef.current) {
        horizontalScrollRef.current.scrollLeft += e.deltaY;
      }
    }
  }, [zoomLevel, actions]);

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + (rulerRef.current.scrollLeft || 0);
    const time = x / pxPerSecond;
    actions.setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  };

  const handleDragOver = (e: React.DragEvent, trackIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    if (!horizontalScrollRef.current) return;
    const rect = horizontalScrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + horizontalScrollRef.current.scrollLeft - TRACK_HEADER_WIDTH;
    const time = Math.max(0, x / pxPerSecond);

    setDragOverTrack(trackIndex);
    setDragOverTime(time);
  };

  const handleDragLeave = () => {
    setDragOverTrack(null);
  };

  const handleDrop = async (e: React.DragEvent, trackIndex: number) => {
    e.preventDefault();
    setIsDraggingRecording(false);
    setDragOverTrack(null);

    const audioId = e.dataTransfer.getData('audioId');
    if (!audioId || !currentProject) return;

    const audio = recordings.find((r) => r.id === audioId);
    if (!audio) return;

    let startTime = dragOverTime;
    if (e.dataTransfer.types.includes('text/plain') || true) {
      const adjustedStartTime = Math.max(0, dragOverTime);
      startTime = adjustedStartTime;
    }

    const clip = await actions.addClip(currentProject.id, audioId, startTime);
    if (clip) {
      const clipsForTrack = clips.filter((c) => c.trackIndex === trackIndex);
      const maxEnd = clipsForTrack.reduce(
        (max, c) => Math.max(max, c.endTime),
        0,
      );
      const newTotal = Math.max(currentProject.totalDuration, Math.max(maxEnd, clip.endTime));
      if (newTotal > currentProject.totalDuration) {
        void actions.updateProject(currentProject.id, { totalDuration: newTotal });
      }
    }
  };

  useEffect(() => {
    const handleDragStart = () => setIsDraggingRecording(true);
    const handleDragEnd = () => {
      setIsDraggingRecording(false);
      setDragOverTrack(null);
    };

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel as unknown as EventListener, {
      passive: false,
    });

    return () => {
      container.removeEventListener('wheel', handleWheel as unknown as EventListener);
    };
  }, [handleWheel]);

  const playheadPosition = currentTime * pxPerSecond;

  if (!currentProject) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>{t('timeline.noProject')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isDraggingRecording ? styles.dragActive : ''}`}
    >
      <div className={styles.rulerContainer} style={{ paddingLeft: TRACK_HEADER_WIDTH }}>
        <div
          ref={rulerRef}
          className={styles.ruler}
          style={{ width: `calc(100% + ${TRACK_HEADER_WIDTH}px)` }}
          onClick={handleRulerClick}
        >
          <div
            className={styles.rulerContent}
            style={{ width: totalWidth + TRACK_HEADER_WIDTH }}
          >
            <div style={{ width: TRACK_HEADER_WIDTH, flexShrink: 0 }} />
            <div className={styles.rulerTracks} style={{ width: totalWidth }}>
              {rulerMarks.map((mark, i) => (
                <div
                  key={i}
                  className={`${styles.rulerMark} ${mark.major ? styles.rulerMarkMajor : ''}`}
                  style={{ left: mark.position }}
                >
                  {mark.label && (
                    <span className={styles.rulerLabel}>{mark.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={horizontalScrollRef}
        className={styles.scrollContainer}
        onScroll={handleHorizontalScroll}
      >
        <div
          className={styles.content}
          style={{ width: totalWidth + TRACK_HEADER_WIDTH }}
        >
          <div style={{ width: TRACK_HEADER_WIDTH, flexShrink: 0 }} />

          <div
            className={styles.tracksArea}
            style={{ width: totalWidth, minWidth: '100%' }}
          >
            <div
              className={styles.playhead}
              style={{
                left: playheadPosition,
                height: trackIndices.length * TRACK_HEIGHT,
              }}
            >
              <div className={styles.playheadTop} />
            </div>

            {dragOverTrack !== null && (
              <div
                className={styles.dropIndicator}
                style={{
                  left: dragOverTime * pxPerSecond,
                  top: dragOverTrack * TRACK_HEIGHT,
                  height: TRACK_HEIGHT,
                }}
              />
            )}

            {trackIndices.map((trackIndex) => {
              const trackClips = clips.filter((c) => c.trackIndex === trackIndex);
              return (
                <div
                  key={trackIndex}
                  onDragOver={(e) => handleDragOver(e, trackIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => void handleDrop(e, trackIndex)}
                >
                  <Track
                    trackIndex={trackIndex}
                    clips={trackClips}
                    pxPerSecond={pxPerSecond}
                    height={TRACK_HEIGHT}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        ref={verticalScrollRef}
        onScroll={handleVerticalScroll}
        className={styles.hidden}
      />

      {clips.length === 0 && !isDraggingRecording && (
        <div className={styles.emptyClips}>
          <p className={styles.emptyText}>{t('timeline.noClips')}</p>
        </div>
      )}
    </div>
  );
};

export default Timeline;
