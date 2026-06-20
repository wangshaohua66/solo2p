import { useRef, ReactNode, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { parseSequenceFile } from '@/utils/sequenceParser';
import type { SequenceData } from '@/types';

interface FileUploaderProps {
  onFilesParsed?: (sequences: SequenceData[]) => void;
  accept?: string;
  multiple?: boolean;
  children?: ReactNode;
  className?: string;
}

export function FileUploader({
  onFilesParsed,
  accept = '.fa,.fasta,.fa.gz,.gb,.gbk,.genbank,.txt',
  multiple = true,
  children,
  className = '',
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { addToast } = useProjectStore();

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const allSequences: SequenceData[] = [];

    for (const file of fileArray) {
      try {
        const content = await file.text();
        const sequences = parseSequenceFile(content, file.name);
        if (sequences.length > 0) {
          allSequences.push(...sequences);
        }
      } catch (e) {
        addToast('error', `解析文件失败: ${file.name}`);
      }
    }

    if (allSequences.length > 0) {
      addToast('success', `成功解析 ${allSequences.length} 条序列`);
      onFilesParsed?.(allSequences);
    } else {
      addToast('warning', '未解析到有效序列');
    }

    setPendingFiles(fileArray);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      void processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void processFiles(e.target.files);
    }
  };

  const triggerUpload = () => {
    inputRef.current?.click();
  };

  const clearFiles = () => {
    setPendingFiles([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (children) {
    return (
      <div className={className} onClick={triggerUpload}>
        {children}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        onClick={triggerUpload}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-bio-blue bg-bio-blue/5 shadow-glow-blue'
            : 'border-bio-border hover:border-bio-blue/60 bg-bio-panel/50'
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-bio-blue/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-bio-blue" />
          </div>
          <div>
            <p className="text-sm text-bio-text font-medium">
              点击或拖拽文件到此处上传
            </p>
            <p className="text-xs text-bio-text-secondary mt-1">
              支持 FASTA (.fa, .fasta)、GenBank (.gb, .gbk) 格式
            </p>
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />

      {pendingFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {pendingFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-bio-panel border border-bio-border rounded px-3 py-2"
            >
              <FileText className="w-4 h-4 text-bio-blue" />
              <span className="text-sm flex-1 truncate">{f.name}</span>
              <span className="text-xs text-bio-text-secondary">
                {(f.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingFiles(pendingFiles.filter((_, idx) => idx !== i));
                }}
                className="text-bio-text-secondary hover:text-bio-red transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {pendingFiles.length > 1 && (
            <button
              onClick={clearFiles}
              className="text-xs text-bio-text-secondary hover:text-bio-red transition-colors"
            >
              清除全部
            </button>
          )}
        </div>
      )}
    </div>
  );
}
