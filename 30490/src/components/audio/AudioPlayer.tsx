import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Gauge,
} from 'lucide-react';
import type { AudioRecording, WaveformData, CompareTrack } from '@/types';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useSettingsStore } from '@/store/settingsStore';
import { getCoverImageURL, formatDuration, getWaveformData } from '@/storage/fileOperations';
import { translate } from '@/i18n';
import WaveformCanvas from './WaveformCanvas';
import SpectrumCanvas from './SpectrumCanvas';
import styles from './AudioPlayer.module.css';

interface AudioPlayerProps {
  recording: AudioRecording | null;
  compareTracks?: CompareTrack[];
}

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const AudioPlayer = ({
  recording,
  compareTracks = [],
}: AudioPlayerProps) => {
  const language = useSettingsStore((s) => s.language);
  const t = (key: string) => translate(language, key);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    loop,
    loopStart,
    loopEnd,
    frequencyData,
    togglePlay,
    seek,
    setVolume,
    setPlaybackRate,
    toggleLoop,
    setTrackVolume,
    setTrackMuted,
    setTrackSolo,
    getTrackMuted,
    getTrackSolo,
  } = useAudioPlayer({ recording, compareTracks });

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    setCoverImageUrl(null);
    setWaveformData(null);

    const targetRecording = compareTracks.length > 0 ? compareTracks[0]?.audio : recording;
    if (!targetRecording) return;

    if (targetRecording.coverImagePath) {
      void getCoverImageURL(targetRecording.coverImagePath).then((url) => {
        setCoverImageUrl(url);
      });
    }

    void getWaveformData(targetRecording.waveformDataPath).then((data) => {
      setWaveformData(data);
    });
  }, [recording, compareTracks]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    setIsMuted(value === 0);
  };

  const toggleMute = () => {
    if (isMuted || volume === 0) {
      setVolume(0.8);
      setIsMuted(false);
    } else {
      setVolume(0);
      setIsMuted(true);
    }
  };

  const formatTimeMs = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const displayRecording = compareTracks.length > 0 ? compareTracks[0]?.audio : recording;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.coverWrapper}>
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={displayRecording?.title || 'cover'}
              className={styles.coverImage}
            />
          ) : (
            <div className={styles.coverPlaceholder}>
              <Volume2 size={32} />
            </div>
          )}
        </div>

        <div className={styles.infoSection}>
          <h3 className={styles.title}>{displayRecording?.title || t('library.noRecordings')}</h3>
          {displayRecording?.locationName && (
            <p className={styles.subtitle}>{displayRecording.locationName}</p>
          )}
        </div>
      </div>

      <div className={styles.visualSection}>
        <WaveformCanvas
          waveformData={waveformData}
          progress={currentTime}
          height={120}
          onClick={seek}
          loopStart={loopStart}
          loopEnd={loopEnd}
        />
        <SpectrumCanvas frequencyData={frequencyData} height={80} />
      </div>

      <div className={styles.timeDisplay}>
        <span className={styles.timeText}>{formatTimeMs(currentTime)}</span>
        <span className={styles.timeSeparator}>/</span>
        <span className={styles.timeTextSecondary}>{formatDuration(duration)}</span>
      </div>

      <div className={styles.controls}>
        <div className={styles.leftControls}>
          <button
            className={styles.playButton}
            onClick={() => void togglePlay()}
            disabled={!displayRecording}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
        </div>

        <div className={styles.centerControls}>
          <div className={styles.volumeControl}>
            <button
              className={styles.iconButton}
              onClick={toggleMute}
              title={isMuted ? t('player.unmute') : t('player.mute')}
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className={styles.volumeSlider}
            />
            <span className={styles.volumeLabel}>{Math.round(volume * 100)}%</span>
          </div>

          <button
            className={`${styles.iconButton} ${loop ? styles.active : ''}`}
            onClick={toggleLoop}
            title={loop ? t('player.clearLoop') : t('player.loop')}
          >
            {loopStart !== null && loopEnd !== null ? (
              <Repeat1 size={18} />
            ) : (
              <Repeat size={18} />
            )}
          </button>

          <div className={styles.speedControl}>
            <button
              className={styles.iconButton}
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              title={t('player.speed')}
            >
              <Gauge size={18} />
            </button>
            {showSpeedMenu && (
              <div className={styles.speedMenu}>
                {playbackRates.map((rate) => (
                  <button
                    key={rate}
                    className={`${styles.speedOption} ${playbackRate === rate ? styles.active : ''}`}
                    onClick={() => {
                      setPlaybackRate(rate);
                      setShowSpeedMenu(false);
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
            <span className={styles.speedLabel}>{playbackRate}x</span>
          </div>
        </div>
      </div>

      {compareTracks.length > 0 && (
        <div className={styles.compareSection}>
          <h4 className={styles.compareTitle}>{t('compare.title')}</h4>
          <div className={styles.compareTracks}>
            {compareTracks.map((track) => {
              const trackMuted = getTrackMuted(track.audioId);
              const trackSolo = getTrackSolo(track.audioId);
              return (
                <div key={track.audioId} className={styles.compareTrack}>
                  <div className={styles.trackInfo}>
                    <span className={styles.trackTitle}>{track.audio.title}</span>
                  </div>
                  <div className={styles.trackControls}>
                    <div className={styles.trackVolumeControl}>
                      <Volume2 size={14} />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={track.volume}
                        onChange={(e) => setTrackVolume(track.audioId, parseFloat(e.target.value))}
                        className={styles.trackVolumeSlider}
                      />
                    </div>
                    <button
                      className={`${styles.trackButton} ${trackMuted ? styles.active : ''}`}
                      onClick={() => setTrackMuted(track.audioId, !trackMuted)}
                      title={t('compare.mute')}
                    >
                      {trackMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <button
                      className={`${styles.trackButton} ${trackSolo ? styles.soloActive : ''}`}
                      onClick={() => setTrackSolo(track.audioId, !trackSolo)}
                      title={t('compare.solo')}
                    >
                      S
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
