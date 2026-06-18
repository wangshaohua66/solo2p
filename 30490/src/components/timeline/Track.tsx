import { useState } from 'react';
import { Volume2, VolumeX, Music2 } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { useTimelineStore } from '@/store/timelineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { translate } from '@/i18n';
import Clip from './Clip';
import styles from './Track.module.css';

interface TrackProps {
  trackIndex: number;
  clips: TimelineClip[];
  pxPerSecond: number;
  height: number;
}

const TRACK_HEADER_WIDTH = 160;

export const Track = ({
  trackIndex,
  clips,
  pxPerSecond,
  height,
}: TrackProps) => {
  const language = useSettingsStore((s) => s.language);
  const t = (key: string) => translate(language, key);

  const { actions } = useTimelineStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isSolo, setIsSolo] = useState(false);
  const [volume] = useState(1);

  const trackClipsSorted = [...clips].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className={styles.container} style={{ height }}>
      <div className={styles.header} style={{ width: TRACK_HEADER_WIDTH }}>
        <div className={styles.headerContent}>
          <div className={styles.trackInfo}>
            <Music2 size={14} className={styles.trackIcon} />
            <span className={styles.trackNumber}>{trackIndex + 1}</span>
            <span className={styles.trackName}>
              {t('timeline.addTrack').replace(t('timeline.addTrack'), `Track ${trackIndex + 1}`)}
            </span>
          </div>

          <div className={styles.trackControls}>
            <button
              className={`${styles.controlButton} ${isMuted ? styles.muted : ''}`}
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? t('player.unmute') : t('player.mute')}
            >
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>

            <button
              className={`${styles.controlButton} ${isSolo ? styles.solo : ''}`}
              onClick={() => {
                setIsSolo(!isSolo);
                void actions;
              }}
              title={t('compare.solo')}
            >
              S
            </button>

            <div className={styles.volumeIndicator}>
              <div
                className={styles.volumeBar}
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content} style={{ minHeight: height }}>
        <div className={styles.gridLines}>
          {trackClipsSorted.map((clip) => (
            <Clip
              key={clip.id}
              clip={clip}
              pxPerSecond={pxPerSecond}
              trackHeight={height}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Track;
