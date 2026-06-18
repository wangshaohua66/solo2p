import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import type { AudioRecording } from '@/types';
import { useAudioStore } from '@/store/audioStore';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { saveCoverImage, getCoverImageURL, getCoverPath, isValidImageFile } from '@/storage/fileOperations';
import { deleteFile } from '@/storage/opfs';
import { translate } from '@/i18n';
import styles from './CoverUpload.module.css';

interface CoverUploadProps {
  recording: AudioRecording;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const CoverUpload = ({ recording }: CoverUploadProps) => {
  const language = useSettingsStore((s) => s.language);
  const updateRecording = useAudioStore((s) => s.actions.updateRecording);
  const showToast = useUIStore((s) => s.actions.showToast);
  const t = (key: string) => translate(language, key);

  const [coverUrl, setCoverUrl] = useState<string | null>(recording.coverImagePath ? null : null);
  const [isLoading, setIsLoading] = useState(recording.coverImagePath !== null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCover = useCallback(async () => {
    if (!recording.coverImagePath) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const url = await getCoverImageURL(recording.coverImagePath);
      setCoverUrl(url);
    } catch {
      setCoverUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [recording.coverImagePath]);

  useEffect(() => {
    void loadCover();
  }, [loadCover]);

  const validateFile = (file: File): boolean => {
    if (!isValidImageFile(file)) {
      showToast('error', t('error.unsupportedAudio'));
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast('error', t('error.fileTooLarge').replace('{max}', '5'));
      return false;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
        showToast('error', t('error.unsupportedAudio'));
        return false;
      }
    }

    return true;
  };

  const handleFile = useCallback(async (file: File) => {
    if (!validateFile(file)) return;

    setIsUploading(true);
    try {
      const path = await saveCoverImage(recording.id, file);
      const updated = await updateRecording(recording.id, { coverImagePath: path });

      if (updated) {
        const url = await getCoverImageURL(path);
        setCoverUrl(url);
        showToast('success', t('common.success'));
      }
    } catch (error) {
      showToast('error', t('error.saveFailed'));
    } finally {
      setIsUploading(false);
    }
  }, [recording.id, updateRecording, showToast, t, validateFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      if (recording.coverImagePath) {
        await deleteFile(recording.coverImagePath);
      }

      const coverPathToDelete = getCoverPath(recording.id);
      if (coverPathToDelete !== recording.coverImagePath) {
        await deleteFile(coverPathToDelete);
      }

      await updateRecording(recording.id, { coverImagePath: null });
      setCoverUrl(null);
      showToast('success', t('common.success'));
    } catch {
      showToast('error', t('error.deleteFailed'));
    }
  };

  return (
    <div
      className={`${styles.container} ${isDragging ? styles.dragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className={styles.hiddenInput}
      />

      {coverUrl ? (
        <div className={styles.previewContainer}>
          <img
            src={coverUrl}
            alt={recording.title}
            className={styles.previewImage}
          />
          <button
            className={styles.removeButton}
            onClick={handleRemove}
            title={t('detail.removeCover')}
            disabled={isUploading}
          >
            <X size={16} />
          </button>
          <div className={styles.changeOverlay} onClick={handleClick}>
            <Upload size={20} />
            <span>{t('detail.changeCover')}</span>
          </div>
        </div>
      ) : isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
        </div>
      ) : (
        <button
          className={styles.uploadButton}
          onClick={handleClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <div className={styles.spinnerSmall} />
          ) : (
            <ImageIcon size={28} />
          )}
          <span className={styles.uploadText}>
            {isUploading ? t('common.loading') : t('detail.uploadCover')}
          </span>
          <span className={styles.uploadHint}>
            JPG / PNG / WebP · Max 5MB
          </span>
        </button>
      )}
    </div>
  );
};

export default CoverUpload;
