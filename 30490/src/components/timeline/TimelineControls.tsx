import { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  Repeat,
  ZoomIn,
  ZoomOut,
  Scissors,
  ListMusic,
  Archive,
  Plus,
  FolderOpen,
} from 'lucide-react';
import { useTimelineStore } from '@/store/timelineStore';
import { useAudioStore } from '@/store/audioStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { translate } from '@/i18n';
import { downloadM3U } from '@/utils/export/m3u';
import { downloadZip } from '@/utils/export/zip';
import styles from './TimelineControls.module.css';

export const TimelineControls = () => {
  const language = useSettingsStore((s) => s.language);
  const { recordings } = useAudioStore((s) => ({ recordings: s.recordings }));
  const {
    projects,
    currentProject,
    clips,
    currentTime,
    isPlaying,
    zoomLevel,
    actions,
  } = useTimelineStore();
  const showToast = useUIStore((s) => s.actions.showToast);
  const t = (key: string) => translate(language, key);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      showToast('error', t('form.required'));
      return;
    }

    const project = await actions.createProject(newProjectName.trim(), newProjectDescription.trim());
    if (project) {
      await actions.loadProject(project.id);
      setShowProjectModal(false);
      setNewProjectName('');
      setNewProjectDescription('');
      showToast('success', t('common.success'));
    }
  };

  const handleSelectProject = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    if (projectId) {
      await actions.loadProject(projectId);
    }
  };

  const handleExportM3U = () => {
    if (clips.length === 0) {
      showToast('warning', t('timeline.noClips'));
      return;
    }

    const clipAudioIds = clips.map((c) => c.audioId);
    const uniqueAudioIds = [...new Set(clipAudioIds)];
    const toExport = recordings.filter((r) => uniqueAudioIds.includes(r.id));

    if (toExport.length === 0) {
      showToast('warning', t('export.noSelection'));
      return;
    }

    downloadM3U(toExport, `${currentProject?.name || 'timeline'}.m3u8`, true);
    showToast('success', t('export.exportComplete'));
  };

  const handleExportZip = async () => {
    if (clips.length === 0) {
      showToast('warning', t('timeline.noClips'));
      return;
    }

    const clipAudioIds = clips.map((c) => c.audioId);
    const uniqueAudioIds = [...new Set(clipAudioIds)];
    const toExport = recordings.filter((r) => uniqueAudioIds.includes(r.id));

    if (toExport.length === 0) {
      showToast('warning', t('export.noSelection'));
      return;
    }

    try {
      await downloadZip(
        toExport,
        `${currentProject?.name || 'timeline'}.zip`,
        {
          includeMetadata: true,
          includeCover: true,
          includeAudio: true,
        },
      );
      showToast('success', t('export.exportComplete'));
    } catch {
      showToast('error', t('error.saveFailed'));
    }
  };

  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.section}>
          <button
            className={`${styles.iconButton} ${isPlaying ? styles.active : ''}`}
            onClick={() => actions.setIsPlaying(!isPlaying)}
            title={isPlaying ? t('player.pause') : t('player.play')}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            className={styles.iconButton}
            onClick={() => actions.setCurrentTime(0)}
            title={t('player.stop')}
          >
            <SkipBack size={18} />
          </button>

          <button
            className={`${styles.iconButton} ${(useTimelineStore.getState().loopStart !== null || useTimelineStore.getState().loopEnd !== null) ? styles.active : ''}`}
            onClick={() => {
              const state = useTimelineStore.getState();
              if (state.loopStart !== null || state.loopEnd !== null) {
                actions.setLoop(null, null);
              } else if (currentProject) {
                actions.setLoop(0, currentProject.totalDuration || 60);
              }
            }}
            title={t('player.loop')}
          >
            <Repeat size={18} />
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <button
            className={styles.iconButton}
            onClick={() => actions.setZoomLevel(zoomLevel / 1.25)}
            disabled={zoomLevel <= 0.25}
            title={t('timeline.zoomOut')}
          >
            <ZoomOut size={18} />
          </button>

          <div className={styles.zoomContainer}>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.05"
              value={zoomLevel}
              onChange={(e) => actions.setZoomLevel(parseFloat(e.target.value))}
              className={styles.zoomSlider}
            />
            <span className={styles.zoomLabel}>{zoomPercent}%</span>
          </div>

          <button
            className={styles.iconButton}
            onClick={() => actions.setZoomLevel(zoomLevel * 1.25)}
            disabled={zoomLevel >= 4}
            title={t('timeline.zoomIn')}
          >
            <ZoomIn size={18} />
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <button
            className={styles.iconButton}
            onClick={() => {
              if (clips.length > 0 && currentProject) {
                const state = useTimelineStore.getState();
                const selectedClip = clips[0];
                if (selectedClip && currentTime > selectedClip.startTime && currentTime < selectedClip.endTime) {
                  void actions.splitClip(selectedClip.id, currentTime);
                }
              }
            }}
            title={t('timeline.splitClip')}
          >
            <Scissors size={18} />
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <button
            className={styles.iconButton}
            onClick={handleExportM3U}
            title={t('export.m3uExport')}
          >
            <ListMusic size={18} />
          </button>

          <button
            className={styles.iconButton}
            onClick={() => void handleExportZip()}
            title={t('export.zipExport')}
          >
            <Archive size={18} />
          </button>
        </div>

        <div className={styles.flexSpacer} />

        <div className={styles.section}>
          <div className={styles.projectSelectWrapper}>
            <FolderOpen size={16} className={styles.projectIcon} />
            <select
              className={styles.projectSelect}
              value={currentProject?.id || ''}
              onChange={handleSelectProject}
            >
              <option value="">{t('timeline.noProject')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className={styles.primaryButton}
            onClick={() => setShowProjectModal(true)}
          >
            <Plus size={16} />
            <span>{t('timeline.newProject')}</span>
          </button>
        </div>
      </div>

      <div className={styles.timeRow}>
        <div className={styles.timeDisplay}>
          <span className={styles.timeLabel}>{t('player.currentTime')}:</span>
          <span className={styles.timeValue}>{formatTime(currentTime)}</span>
        </div>
        {currentProject && (
          <div className={styles.timeDisplay}>
            <span className={styles.timeLabel}>{t('timeline.totalDuration')}:</span>
            <span className={styles.timeValueSecondary}>{formatTime(currentProject.totalDuration)}</span>
            <span className={styles.timeSeparator}>|</span>
            <span className={styles.timeLabel}>{t('timeline.clipCount')}:</span>
            <span className={styles.timeValueSecondary}>{clips.length}</span>
          </div>
        )}
      </div>

      {showProjectModal && (
        <div className={styles.modalOverlay} onClick={() => setShowProjectModal(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>{t('timeline.newProject')}</h3>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>
                {t('timeline.projectName')} *
              </label>
              <input
                type="text"
                className={styles.modalInput}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('timeline.projectName')}
              />
            </div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>
                {t('timeline.projectDescription')}
              </label>
              <textarea
                className={styles.modalTextarea}
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder={t('timeline.projectDescription')}
                rows={3}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowProjectModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={styles.confirmButton}
                onClick={() => void handleCreateProject()}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineControls;
