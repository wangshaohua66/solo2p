import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseDropZoneOptions {
  acceptAudioOnly?: boolean;
  onFilesDrop?: (files: File[]) => void;
  onFileDrop?: (file: File) => void;
  multiple?: boolean;
  maxFiles?: number;
}

export interface UseDropZoneReturn {
  isDragOver: boolean;
  isDragEnter: boolean;
  isValid: boolean;
  rejectedFiles: File[];
  acceptedFiles: File[];
  getRootProps: () => {
    onDragEnter: (e: React.DragEvent<HTMLElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLElement>) => void;
    onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
    onDrop: (e: React.DragEvent<HTMLElement>) => void;
  };
  getInputProps: () => {
    type: 'file';
    multiple: boolean;
    accept: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    ref: React.RefObject<HTMLInputElement>;
  };
  open: () => void;
  reset: () => void;
}

const AUDIO_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
];

const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.aac', '.m4a', '.webm'];

const isAudioFile = (file: File): boolean => {
  if (AUDIO_MIME_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? AUDIO_EXTENSIONS.includes(`.${ext}`) : false;
};

const filterFiles = (
  files: FileList | File[],
  acceptAudioOnly: boolean,
  maxFiles?: number,
): { accepted: File[]; rejected: File[] } => {
  const fileArray = Array.from(files);
  const accepted: File[] = [];
  const rejected: File[] = [];

  fileArray.forEach((file, index) => {
    if (maxFiles && index >= maxFiles) {
      rejected.push(file);
      return;
    }

    if (acceptAudioOnly && !isAudioFile(file)) {
      rejected.push(file);
      return;
    }

    accepted.push(file);
  });

  return { accepted, rejected };
};

export function useDropZone(options: UseDropZoneOptions = {}): UseDropZoneReturn {
  const {
    acceptAudioOnly = true,
    onFilesDrop,
    onFileDrop,
    multiple = true,
    maxFiles,
  } = options;

  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragEnter, setIsDragEnter] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [acceptedFiles, setAcceptedFiles] = useState<File[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<File[]>([]);

  const dragEnterCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const { accepted, rejected } = filterFiles(files, acceptAudioOnly, maxFiles);
      setAcceptedFiles(accepted);
      setRejectedFiles(rejected);
      setIsValid(rejected.length === 0);

      if (accepted.length > 0) {
        if (onFilesDrop) {
          onFilesDrop(accepted);
        }
        if (onFileDrop && accepted.length === 1) {
          onFileDrop(accepted[0]);
        }
      }
    },
    [acceptAudioOnly, maxFiles, onFilesDrop, onFileDrop],
  );

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragEnterCountRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragEnter(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragEnterCountRef.current -= 1;
    if (dragEnterCountRef.current <= 0) {
      setIsDragOver(false);
      setIsDragEnter(false);
      dragEnterCountRef.current = 0;
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      setIsDragEnter(false);
      dragEnterCountRef.current = 0;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  const open = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const reset = useCallback(() => {
    setAcceptedFiles([]);
    setRejectedFiles([]);
    setIsValid(true);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    return () => {
      dragEnterCountRef.current = 0;
    };
  }, []);

  const getRootProps = useCallback(
    () => ({
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    }),
    [handleDragEnter, handleDragOver, handleDragLeave, handleDrop],
  );

  const getInputProps = useCallback(
    () => ({
      type: 'file' as const,
      multiple,
      accept: acceptAudioOnly ? AUDIO_MIME_TYPES.join(',') : '',
      onChange: handleChange,
      ref: inputRef,
    }),
    [multiple, acceptAudioOnly, handleChange],
  );

  return {
    isDragOver,
    isDragEnter,
    isValid,
    acceptedFiles,
    rejectedFiles,
    getRootProps,
    getInputProps,
    open,
    reset,
  };
}
