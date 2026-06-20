import { useState, useMemo } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProjectStore } from '@/stores/projectStore';
import { SequenceCanvas } from './SequenceCanvas';
import { RulerAxis } from './RulerAxis';
import { SelectionLayer } from './SelectionLayer';
import { AnnotationLayer } from './AnnotationLayer';
import { FileUploader } from '@/components/common/FileUploader';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { Search, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';
import { Input, Tooltip, Select, Segmented, Modal } from 'antd';
import { sequenceSearch } from '@/utils/sequenceParser';
import { analyzeQuality } from '@/utils/qualityAnalyzer';
import type { SequenceData } from '@/types';

export function SequenceViewer() {
  const { ref: containerRef, size: containerSize } = useResizeObserver<HTMLDivElement>();
  const [hoverPos, setHoverPos] = useState<number | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);

  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const setSequence = useAnalysisStore((s) => s.setSequence);
  const viewMode = useAnalysisStore((s) => s.viewMode);
  const setViewMode = useAnalysisStore((s) => s.setViewMode);
  const viewport = useAnalysisStore((s) => s.viewport);
  const setViewport = useAnalysisStore((s) => s.setViewport);
  const setSelection = useAnalysisStore((s) => s.setSelection);
  const searchQuery = useAnalysisStore((s) => s.searchQuery);
  const setSearchQuery = useAnalysisStore((s) => s.setSearchQuery);
  const setSearchResults = useAnalysisStore((s) => s.setSearchResults);
  const searchResults = useAnalysisStore((s) => s.searchResults);
  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);
  const setQualityData = useAnalysisStore((s) => s.setQualityData);
  const { addToast } = useProjectStore.getState();

  const handleFilesParsed = (seqs: SequenceData[]) => {
    if (seqs.length > 0) {
      const seq = seqs[0];
      setSequence(seq);
      setQualityData(analyzeQuality(seq.sequence));
      addToast('success', `已加载序列: ${seq.name} (${seq.length} bp)`);
    }
  };

  const charWidth = useMemo(() => {
    const base = viewMode === 'aminoacid' ? 14 : 11;
    return base * viewport.zoom;
  }, [viewMode, viewport.zoom]);

  const paddingLeft = 40;

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (!currentSequence || value.length < 2) {
      setSearchResults([]);
      return;
    }
    const results = sequenceSearch(currentSequence.sequence, value);
    setSearchResults(results);
    if (results.length > 0) {
      const visChars = Math.max(1, Math.floor((containerSize.width - paddingLeft) / charWidth));
      const pos = results[0];
      const half = Math.floor(visChars / 2);
      const start = Math.max(0, Math.min(currentSequence.length - visChars, pos - half));
      setViewport({ start, end: start + visChars });
    }
  };

  const handleZoom = (factor: number) => {
    if (!currentSequence) return;
    const newZoom = Math.max(0.3, Math.min(8, viewport.zoom * factor));
    const center = Math.floor((viewport.start + viewport.end) / 2);
    const visChars = Math.max(1, Math.floor((containerSize.width - paddingLeft) / ((viewMode === 'aminoacid' ? 14 : 11) * newZoom)));
    const half = Math.floor(visChars / 2);
    const start = Math.max(0, Math.min(currentSequence.length - visChars, center - half));
    setViewport({ zoom: newZoom, start, end: start + visChars });
  };

  const handleReset = () => {
    if (!currentSequence) return;
    const visChars = Math.max(1, Math.floor((containerSize.width - paddingLeft) / (viewMode === 'aminoacid' ? 14 : 11)));
    setViewport({ zoom: 1, start: 0, end: Math.min(visChars, currentSequence.length) });
    setSelection(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-bio-border bg-bio-bg/50">
        <div className="flex items-center gap-2">
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'nucleotide' | 'aminoacid')}
            options={[
              { label: '核苷酸', value: 'nucleotide' },
              { label: '氨基酸', value: 'aminoacid' },
            ]}
            size="small"
          />
          {currentSequence && (
            <span className="text-xs text-bio-text-secondary font-mono ml-2">
              {currentSequence.name} · {currentSequence.length.toLocaleString()} bp
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {searchVisible ? (
            <Input
              size="small"
              placeholder="搜索序列 (如 ATCG)..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
              prefix={<Search className="w-3.5 h-3.5 text-bio-text-secondary" />}
              suffix={
                searchResults.length > 0 && (
                  <span className="text-xs text-bio-text-secondary">
                    {searchResults.length} 处
                  </span>
                )
              }
              style={{ width: 220 }}
              autoFocus
              onBlur={() => !searchQuery && setSearchVisible(false)}
            />
          ) : (
            <Tooltip title="搜索序列">
              <button
                onClick={() => setSearchVisible(true)}
                className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          <Tooltip title="放大">
            <button
              onClick={() => handleZoom(1.2)}
              className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip title="缩小">
            <button
              onClick={() => handleZoom(0.8)}
              className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip title="重置视图">
            <button
              onClick={handleReset}
              className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        {!currentSequence ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-xl">
              <FileUploader onFilesParsed={handleFilesParsed} />
              <div className="mt-6 text-center text-xs text-bio-text-secondary space-y-1">
                <p>也可以使用上方工具栏中的「导入」按钮</p>
                <p>支持拖拽多个文件</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-2">
              <RulerAxis
                start={viewport.start}
                end={viewport.end}
                charWidth={charWidth}
                width={containerSize.width}
                paddingLeft={paddingLeft}
              />
            </div>
            <AnnotationLayer
              charWidth={charWidth}
              viewportStart={viewport.start}
              paddingLeft={paddingLeft}
              width={containerSize.width}
            />
            <div className="flex-1 px-2">
              <SequenceCanvas
                onHoverPosition={setHoverPos}
              />
            </div>
            <SelectionLayer className="m-3" />
          </>
        )}
      </div>
    </div>
  );
}
