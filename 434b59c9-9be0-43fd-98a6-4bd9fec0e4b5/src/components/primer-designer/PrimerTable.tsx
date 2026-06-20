import { useMemo, useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { Primer } from '@/types';
import { generatePrimerOrderForm } from '@/utils/primerCalculator';
import { downloadFile } from '@/utils/storage';
import { useProjectStore } from '@/stores/projectStore';
import { Download, Trash2, Copy, Filter, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { Empty, Checkbox, Tag, Tooltip, Tooltip as AntTooltip } from 'antd';

type SortKey = 'start' | 'tm' | 'gcContent' | 'penalty';
type SortDir = 'asc' | 'desc';

interface PrimerTableProps {
  onSelect?: (primer: Primer) => void;
  selectedId?: string | null;
}

export function PrimerTable({ onSelect, selectedId }: PrimerTableProps) {
  const primers = useAnalysisStore((s) => s.primers);
  const deletePrimer = useAnalysisStore((s) => s.deletePrimer);
  const { addToast } = useProjectStore.getState();

  const [showPassOnly, setShowPassOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('penalty');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = useMemo(() => {
    let list = primers;
    if (showPassOnly) list = list.filter((p) => p.passFilter);
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [primers, showPassOnly, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ label, key: k }: { label: string; key: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className="flex items-center gap-1 text-bio-text-secondary hover:text-bio-text transition-colors"
    >
      {label}
      {sortKey === k && (
        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );

  const handleCopy = (seq: string) => {
    navigator.clipboard.writeText(seq);
    addToast('success', '序列已复制到剪贴板');
  };

  const handleExportOrder = () => {
    if (primers.length === 0) {
      addToast('warning', '没有引物可导出');
      return;
    }
    const content = generatePrimerOrderForm(primers);
    downloadFile(content, `primer_order_${Date.now()}.txt`, 'text/plain');
    addToast('success', `已生成 ${primers.length} 条引物的订购表单`);
  };

  const handleExportFASTA = () => {
    if (primers.length === 0) return;
    const lines = primers
      .map(
        (p) =>
          `>${p.id} ${p.direction} pos:${p.start}-${p.end} Tm:${p.tm.toFixed(1)}C GC:${p.gcContent.toFixed(1)}%\n${p.sequence}`
      )
      .join('\n');
    downloadFile(lines, `primers_${Date.now()}.fa`, 'text/plain');
    addToast('success', `已导出 ${primers.length} 条引物 FASTA`);
  };

  const stats = useMemo(() => {
    const pass = primers.filter((p) => p.passFilter).length;
    const fw = primers.filter((p) => p.direction === 'forward').length;
    const rv = primers.filter((p) => p.direction === 'reverse').length;
    return { pass, total: primers.length, fw, rv };
  }, [primers]);

  return (
    <div className="h-full flex flex-col border border-bio-border rounded bg-bio-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-bio-border">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-bio-text-secondary">共</span>
          <span className="font-mono font-medium text-bio-text">{filtered.length}</span>
          <span className="text-bio-text-secondary">/ {stats.total}</span>
          <span className="text-bio-text-secondary">条引物</span>
          <Tag color="green" style={{ border: 'none', margin: 0 }}>
            Forward {stats.fw}
          </Tag>
          <Tag color="geekblue" style={{ border: 'none', margin: 0 }}>
            Reverse {stats.rv}
          </Tag>
          <Tag color={stats.pass > 0 ? 'success' : 'default'} style={{ border: 'none', margin: 0 }}>
            合格 {stats.pass}
          </Tag>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={showPassOnly}
            onChange={(e) => setShowPassOnly(e.target.checked)}
          >
            <span className="text-xs text-bio-text-secondary">仅显示合格</span>
          </Checkbox>
          <button
            onClick={handleExportFASTA}
            className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
            title="导出 FASTA"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportOrder}
            className="p-1.5 rounded hover:bg-bio-blue/10 text-bio-text-secondary hover:text-bio-blue transition-colors"
            title="生成订购单"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Empty
              description={primers.length === 0 ? '尚未设计引物，请点击「设计引物」' : '没有符合条件的引物'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bio-panel/95 backdrop-blur z-10">
              <tr className="text-left text-xs text-bio-text-secondary border-b border-bio-border">
                <th className="px-3 py-2.5 font-medium w-10">#</th>
                <th className="px-3 py-2.5 font-medium"><SortHeader label="位置" key="start" /></th>
                <th className="px-3 py-2.5 font-medium">方向</th>
                <th className="px-3 py-2.5 font-medium">序列 (5'→3')</th>
                <th className="px-3 py-2.5 font-medium"><SortHeader label="Tm (°C)" key="tm" /></th>
                <th className="px-3 py-2.5 font-medium"><SortHeader label="GC (%)" key="gcContent" /></th>
                <th className="px-3 py-2.5 font-medium">长度</th>
                <th className="px-3 py-2.5 font-medium"><SortHeader label="罚分" key="penalty" /></th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const selected = selectedId === p.id;
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-bio-border/50 hover:bg-bio-blue/5 transition-colors cursor-pointer ${selected ? 'bg-bio-blue/10' : ''}`}
                    onClick={() => onSelect?.(p)}
                  >
                    <td className="px-3 py-2 text-bio-text-secondary font-mono text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono text-bio-blue text-xs">
                      {p.start.toLocaleString()}-{p.end.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Tag
                        color={p.direction === 'forward' ? 'success' : 'geekblue'}
                        style={{ border: 'none', margin: 0, fontSize: 11 }}
                      >
                        {p.direction === 'forward' ? 'FWD' : 'REV'}
                      </Tag>
                    </td>
                    <td className="px-3 py-2">
                      <code className="font-mono text-xs bg-bio-panel px-1.5 py-0.5 rounded">
                        {p.sequence}
                      </code>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-bio-green">{p.tm.toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-mut-vus">{p.gcContent.toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-bio-text-secondary">{p.length}bp</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <span className={p.penalty < 5 ? 'text-bio-green' : p.penalty < 10 ? 'text-bio-yellow' : 'text-mut-pathogenic'}>
                        {p.penalty.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.passFilter ? (
                        <span className="flex items-center gap-1 text-xs text-bio-green">
                          <Check className="w-3 h-3" /> 合格
                        </span>
                      ) : (
                        <Tooltip title={p.warnings?.join('\n')}>
                          <span className="text-xs text-mut-pathogenic">不合格</span>
                        </Tooltip>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(p.sequence);
                          }}
                          className="p-1 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text"
                          title="复制序列"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePrimer(p.id);
                            addToast('success', '引物已删除');
                          }}
                          className="p-1 rounded hover:bg-mut-pathogenic/10 text-bio-text-secondary hover:text-mut-pathogenic"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
