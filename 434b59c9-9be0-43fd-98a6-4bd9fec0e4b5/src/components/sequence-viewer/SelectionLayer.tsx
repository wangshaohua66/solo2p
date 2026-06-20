import { useAnalysisStore } from '@/stores/analysisStore';
import { useProjectStore } from '@/stores/projectStore';
import { Copy, Scissors, X } from 'lucide-react';

interface SelectionLayerProps {
  className?: string;
}

export function SelectionLayer({ className = '' }: SelectionLayerProps) {
  const selection = useAnalysisStore((s) => s.selection);
  const setSelection = useAnalysisStore((s) => s.setSelection);
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const { addToast } = useProjectStore.getState();

  if (!selection || !currentSequence) return null;

  const { start, end } = selection;
  const length = end - start;

  if (length <= 0) return null;

  const selectedSeq = currentSequence.sequence.slice(start, end);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedSeq).then(() => {
      addToast('success', `已复制 ${length} 个碱基`);
    }).catch(() => {
      addToast('error', '复制失败');
    });
  };

  const handleCopyRC = () => {
    const rc = selectedSeq
      .split('')
      .map((c) => ({ A: 'T', T: 'A', C: 'G', G: 'C', N: 'N' } as Record<string, string>)[c] ?? 'N')
      .reverse()
      .join('');
    navigator.clipboard.writeText(rc).then(() => {
      addToast('success', '已复制反向互补序列');
    });
  };

  const gcCount = selectedSeq.replace(/[^GC]/g, '').length;
  const gcPct = length > 0 ? ((gcCount / length) * 100).toFixed(1) : '0.0';

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2
        bg-bio-blue/10 border border-bio-blue/30 rounded-md
        text-sm
        ${className}
      `}
    >
      <span className="text-bio-text-secondary whitespace-nowrap">
        选择区域:
      </span>
      <span className="font-mono text-bio-blue font-medium">
        {start} - {end}
      </span>
      <span className="text-bio-text-secondary">|</span>
      <span className="text-bio-text-secondary whitespace-nowrap">
        长度: <span className="text-bio-text font-mono">{length} bp</span>
      </span>
      <span className="text-bio-text-secondary">|</span>
      <span className="text-bio-text-secondary whitespace-nowrap">
        GC: <span className="text-bio-yellow font-mono">{gcPct}%</span>
      </span>

      <div className="flex-1 min-w-0">
        <div className="truncate font-mono text-xs text-bio-text-secondary">
          {selectedSeq.slice(0, 60)}
          {selectedSeq.length > 60 && '...'}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-bio-blue/20 text-bio-blue transition-colors"
          title="复制序列"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCopyRC}
          className="p-1.5 rounded hover:bg-bio-blue/20 text-bio-blue transition-colors"
          title="复制反向互补序列"
        >
          <Scissors className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setSelection(null)}
          className="p-1.5 rounded hover:bg-bio-red/20 text-bio-red transition-colors"
          title="取消选择"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
