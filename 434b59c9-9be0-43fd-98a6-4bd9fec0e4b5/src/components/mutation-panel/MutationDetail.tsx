import { useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Mutation, Pathogenicity } from '@/types';
import { X, Check, ExternalLink, FileText, Bookmark } from 'lucide-react';
import { Input, Button, Select, Tag } from 'antd';

const PATHOGENICITY_OPTIONS: { value: Pathogenicity; label: string; color: string }[] = [
  { value: 'pathogenic', label: '致病 (Pathogenic)', color: '#ff00aa' },
  { value: 'likely-pathogenic', label: '可能致病', color: '#ff7b00' },
  { value: 'uncertain', label: '意义未明 (VUS)', color: '#a371f7' },
  { value: 'likely-benign', label: '可能良性', color: '#3fb950' },
  { value: 'benign', label: '良性 (Benign)', color: '#00ffcc' },
];

interface MutationDetailProps {
  mutation: Mutation | null;
  onClose: () => void;
}

export function MutationDetail({ mutation, onClose }: MutationDetailProps) {
  const updateMutation = useAnalysisStore((s) => s.updateMutation);
  const setViewport = useAnalysisStore((s) => s.setViewport);
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const { addToast } = useProjectStore.getState();

  const [note, setNote] = useState(mutation?.note ?? '');
  const [doi, setDoi] = useState(mutation?.doi ?? '');
  const [pathogenicity, setPathogenicity] = useState<Pathogenicity>(
    mutation?.pathogenicity ?? 'uncertain'
  );
  const [gene, setGene] = useState(mutation?.gene ?? '');

  if (!mutation) return null;

  const handleSave = () => {
    updateMutation(mutation.id, { note, doi, pathogenicity, gene });
    addToast('success', '突变信息已更新');
    onClose();
  };

  const handleValidate = () => {
    updateMutation(mutation.id, { validated: !mutation.validated });
    addToast('success', mutation.validated ? '已取消验证' : '已标记为已验证');
  };

  const handleJumpTo = () => {
    if (!currentSequence) return;
    const start = Math.max(0, mutation.position - 50);
    const end = Math.min(currentSequence.length, mutation.position + 50);
    setViewport({ start, end });
    useAnalysisStore.getState().setActiveTab('sequence');
  };

  const openDoi = () => {
    if (mutation.doi) {
      window.open(`https://doi.org/${mutation.doi}`, '_blank');
    }
  };

  const pathogenInfo = PATHOGENICITY_OPTIONS.find((p) => p.value === mutation.pathogenicity);

  return (
    <div className="h-full flex flex-col border-l border-bio-border bg-bio-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bio-border">
        <h3 className="text-sm font-medium text-bio-text">突变详情</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bio-panel border border-bio-border rounded p-3">
            <div className="text-xs text-bio-text-secondary mb-1">位置</div>
            <div className="font-mono text-lg text-bio-blue font-medium">
              {mutation.position.toLocaleString()}
            </div>
          </div>
          <div className="bg-bio-panel border border-bio-border rounded p-3">
            <div className="text-xs text-bio-text-secondary mb-1">类型</div>
            <Tag color="geekblue" style={{ border: 'none' }}>{mutation.type}</Tag>
          </div>
        </div>

        <div className="bg-bio-panel border border-bio-border rounded p-3">
          <div className="text-xs text-bio-text-secondary mb-2">碱基变化</div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl px-3 py-1.5 rounded bg-bio-bg border border-bio-border" style={{
              color: ({ A: '#3fb950', T: '#f85149', C: '#58a6ff', G: '#d29922' } as Record<string, string>)[mutation.refBase]
            }}>
              {mutation.refBase}
            </span>
            <span className="text-bio-text-secondary text-lg">→</span>
            <span className="font-mono text-xl px-3 py-1.5 rounded bg-bio-bg border border-bio-border" style={{
              color: ({ A: '#3fb950', T: '#f85149', C: '#58a6ff', G: '#d29922' } as Record<string, string>)[mutation.altBase]
            }}>
              {mutation.altBase}
            </span>
          </div>
        </div>

        <div className="bg-bio-panel border border-bio-border rounded p-3">
          <div className="text-xs text-bio-text-secondary mb-2">致病性等级</div>
          <Select
            value={pathogenicity}
            onChange={(v) => setPathogenicity(v)}
            className="w-full"
            options={PATHOGENICITY_OPTIONS.map((p) => ({
              value: p.value,
              label: (
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                  {p.label}
                </span>
              ),
            }))}
          />
        </div>

        <div className="bg-bio-panel border border-bio-border rounded p-3">
          <label className="block text-xs text-bio-text-secondary mb-2">相关基因</label>
          <Input
            size="small"
            placeholder="如 BRCA1, TP53..."
            value={gene}
            onChange={(e) => setGene(e.target.value)}
            prefix={<FileText className="w-3.5 h-3.5 text-bio-text-secondary" />}
          />
        </div>

        <div className="bg-bio-panel border border-bio-border rounded p-3">
          <label className="block text-xs text-bio-text-secondary mb-2">文献 DOI</label>
          <Input
            size="small"
            placeholder="10.1038/ng1234..."
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            suffix={
              doi && (
                <button onClick={openDoi} className="text-bio-blue hover:underline text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )
            }
          />
        </div>

        <div className="bg-bio-panel border border-bio-border rounded p-3">
          <label className="block text-xs text-bio-text-secondary mb-2">备注</label>
          <Input.TextArea
            rows={4}
            placeholder="验证信息、临床意义等..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-bio-border flex items-center justify-between gap-2">
        <button
          onClick={handleJumpTo}
          className="text-xs text-bio-blue hover:underline flex items-center gap-1"
        >
          <Bookmark className="w-3.5 h-3.5" />
          在序列中定位
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            icon={mutation.validated ? <Check className="w-3.5 h-3.5" /> : undefined}
            type={mutation.validated ? 'primary' : 'default'}
            onClick={handleValidate}
          >
            {mutation.validated ? '已验证' : '标记验证'}
          </Button>
          <Button size="small" type="primary" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
