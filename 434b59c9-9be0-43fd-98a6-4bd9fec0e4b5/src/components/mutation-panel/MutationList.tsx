import { useState, useMemo } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { filterMutations, exportMutationsCSV } from '@/utils/mutationDetector';
import type { Mutation, MutationType, Pathogenicity } from '@/types';
import { MutationFilter } from './MutationFilter';
import { Download, Plus, Search, AlertCircle } from 'lucide-react';
import { Empty, Button, Tooltip, Tag, Modal } from 'antd';
import { useProjectStore } from '@/stores/projectStore';
import { downloadFile } from '@/utils/storage';

const PATHOGENICITY_INFO: Record<Pathogenicity, { label: string; color: string }> = {
  'pathogenic': { label: '致病', color: '#ff00aa' },
  'likely-pathogenic': { label: '可能致病', color: '#ff7b00' },
  'uncertain': { label: 'VUS', color: '#a371f7' },
  'likely-benign': { label: '可能良性', color: '#3fb950' },
  'benign': { label: '良性', color: '#00ffcc' },
};

interface MutationListProps {
  onSelectMutation: (m: Mutation) => void;
}

export function MutationList({ onSelectMutation }: MutationListProps) {
  const mutations = useAnalysisStore((s) => s.mutations);
  const addMutation = useAnalysisStore((s) => s.addMutation);
  const setViewport = useAnalysisStore((s) => s.setViewport);
  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const { addToast } = useProjectStore.getState();

  const [filters, setFilters] = useState<{
    types: MutationType[];
    pathogenicity: Pathogenicity[];
    positionRange?: [number, number];
    validated?: boolean;
    searchText: string;
  }>({ types: [], pathogenicity: [], searchText: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ position: 0, refBase: 'A', altBase: 'T', type: 'SNP' as MutationType });

  const filtered = useMemo(
    () => filterMutations(mutations, filters),
    [mutations, filters]
  );

  const handleExport = () => {
    if (filtered.length === 0) {
      addToast('warning', '没有可导出的突变数据');
      return;
    }
    const csv = exportMutationsCSV(filtered);
    downloadFile(csv, `mutations_${Date.now()}.csv`, 'text/csv');
    addToast('success', `已导出 ${filtered.length} 个突变`);
  };

  const handleJumpTo = (pos: number) => {
    if (!currentSequence) return;
    const start = Math.max(0, pos - 30);
    const end = Math.min(currentSequence.length, pos + 30);
    setViewport({ start, end });
    setActiveTab('sequence');
  };

  const handleAdd = () => {
    addMutation({
      position: formData.position,
      refBase: formData.refBase.toUpperCase(),
      altBase: formData.altBase.toUpperCase(),
      type: formData.type,
      pathogenicity: 'uncertain',
      validated: false,
    });
    addToast('success', '突变已添加');
    setShowAddModal(false);
  };

  const stats = useMemo(() => {
    const counts = { pathogenic: 0, likely: 0, uncertain: 0, benign: 0 };
    for (const m of mutations) {
      if (m.pathogenicity === 'pathogenic') counts.pathogenic++;
      else if (m.pathogenicity === 'likely-pathogenic') counts.likely++;
      else if (m.pathogenicity === 'uncertain') counts.uncertain++;
      else counts.benign++;
    }
    return counts;
  }, [mutations]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-bio-border bg-bio-bg/50">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-bio-text-secondary">共</span>
          <span className="text-bio-text font-mono font-medium">{filtered.length}</span>
          <span className="text-bio-text-secondary">个突变</span>
          {mutations.length !== filtered.length && (
            <span className="text-bio-text-secondary">(全部 {mutations.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip title="手动添加突变">
            <button
              onClick={() => setShowAddModal(true)}
              className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip title="导出CSV">
            <button
              onClick={handleExport}
              className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {mutations.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-bio-border bg-bio-panel/30">
          {([
            { key: 'pathogenic', count: stats.pathogenic, label: '致病', color: '#ff00aa' },
            { key: 'likely', count: stats.likely, label: '可能致病', color: '#ff7b00' },
            { key: 'uncertain', count: stats.uncertain, label: 'VUS', color: '#a371f7' },
            { key: 'benign', count: stats.benign, label: '良性', color: '#00ffcc' },
          ] as const).map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-bio-text-secondary">{s.label}</span>
              <span className="font-mono font-medium text-bio-text">{s.count}</span>
            </div>
          ))}
        </div>
      )}

      <MutationFilter
        onFilterChange={setFilters}
        maxPosition={currentSequence?.length ?? 100000}
      />

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Empty
              description={
                mutations.length === 0
                  ? '暂无突变数据，导入序列后可运行突变检测'
                  : '没有符合筛选条件的突变'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bio-panel/95 backdrop-blur z-10">
              <tr className="text-left text-xs text-bio-text-secondary border-b border-bio-border">
                <th className="px-4 py-2.5 font-medium w-16">#</th>
                <th className="px-4 py-2.5 font-medium">位置</th>
                <th className="px-4 py-2.5 font-medium">类型</th>
                <th className="px-4 py-2.5 font-medium">变化</th>
                <th className="px-4 py-2.5 font-medium">等级</th>
                <th className="px-4 py-2.5 font-medium">基因</th>
                <th className="px-4 py-2.5 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => {
                const pathogen = PATHOGENICITY_INFO[m.pathogenicity];
                return (
                  <tr
                    key={m.id}
                    className="border-b border-bio-border/50 hover:bg-bio-blue/5 transition-colors cursor-pointer group"
                    onClick={() => onSelectMutation(m)}
                  >
                    <td className="px-4 py-2.5 text-bio-text-secondary font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-bio-blue">{m.position.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <Tag color="geekblue" style={{ border: 'none', margin: 0 }}>{m.type}</Tag>
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      <span style={{ color: ({ A: '#3fb950', T: '#f85149', C: '#58a6ff', G: '#d29922' } as Record<string, string>)[m.refBase] }}>{m.refBase}</span>
                      <span className="text-bio-text-secondary mx-1">→</span>
                      <span style={{ color: ({ A: '#3fb950', T: '#f85149', C: '#58a6ff', G: '#d29922' } as Record<string, string>)[m.altBase] }}>{m.altBase}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: pathogen.color, boxShadow: `0 0 6px ${pathogen.color}66` }}
                        />
                        <span style={{ color: pathogen.color }}>{pathogen.label}</span>
                        {m.validated && (
                          <AlertCircle className="w-3 h-3 text-bio-green" />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-bio-text-secondary text-xs">
                      {m.gene || '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpTo(m.position);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bio-blue/20 text-bio-blue transition-all"
                        title="在序列中查看"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        title="添加突变"
        open={showAddModal}
        onOk={handleAdd}
        onCancel={() => setShowAddModal(false)}
        okText="添加"
        styles={{
          content: { background: '#161b22', border: '1px solid #30363d' },
          header: { color: '#c9d1d9' },
        }}
      >
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs text-bio-text-secondary mb-1.5">位置</label>
            <input
              type="number"
              className="w-full px-3 py-2 bg-bio-bg border border-bio-border rounded text-sm text-bio-text focus:outline-none focus:border-bio-blue"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-bio-text-secondary mb-1.5">参考碱基</label>
              <select
                className="w-full px-3 py-2 bg-bio-bg border border-bio-border rounded text-sm text-bio-text focus:outline-none focus:border-bio-blue"
                value={formData.refBase}
                onChange={(e) => setFormData({ ...formData, refBase: e.target.value })}
              >
                {['A', 'T', 'C', 'G'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-bio-text-secondary mb-1.5">变异碱基</label>
              <select
                className="w-full px-3 py-2 bg-bio-bg border border-bio-border rounded text-sm text-bio-text focus:outline-none focus:border-bio-blue"
                value={formData.altBase}
                onChange={(e) => setFormData({ ...formData, altBase: e.target.value })}
              >
                {['A', 'T', 'C', 'G'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-bio-text-secondary mb-1.5">突变类型</label>
            <select
              className="w-full px-3 py-2 bg-bio-bg border border-bio-border rounded text-sm text-bio-text focus:outline-none focus:border-bio-blue"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as MutationType })}
            >
              <option value="SNP">SNP</option>
              <option value="Ins">插入 (Insertion)</option>
              <option value="Del">缺失 (Deletion)</option>
              <option value="Indel">Indel</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
