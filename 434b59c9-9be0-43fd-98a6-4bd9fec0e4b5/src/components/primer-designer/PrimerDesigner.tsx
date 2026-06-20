import { useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { PrimerCanvas } from './PrimerCanvas';
import { PrimerConfig } from './PrimerConfig';
import { PrimerTable } from './PrimerTable';
import type { Primer } from '@/types';
import { designPrimers } from '@/utils/primerCalculator';
import { Dna, Play, FlaskConical } from 'lucide-react';
import { Empty, Progress, Spin, Button } from 'antd';
import { useProjectStore } from '@/stores/projectStore';

export function PrimerDesigner() {
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const selection = useAnalysisStore((s) => s.selection);
  const primerConfig = useAnalysisStore((s) => s.primerConfig);
  const setPrimers = useAnalysisStore((s) => s.setPrimers);
  const primers = useAnalysisStore((s) => s.primers);

  const [selected, setSelected] = useState<Primer | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { addToast } = useProjectStore.getState();

  const handleDesign = async () => {
    if (!currentSequence) {
      addToast('warning', '请先导入序列');
      return;
    }
    const targetStart = selection?.start ?? Math.floor(currentSequence.length / 2) - 500;
    const targetEnd = selection?.end ?? Math.floor(currentSequence.length / 2) + 500;

    if (targetEnd - targetStart < primerConfig.productSizeMin) {
      addToast('warning', `目标区域太小，请选择至少 ${primerConfig.productSizeMin} bp 的区域`);
      return;
    }

    setIsRunning(true);
    setProgress(0);

    try {
      await new Promise((r) => setTimeout(r, 100));
      setProgress(20);
      await new Promise((r) => setTimeout(r, 150));
      setProgress(50);

      const result = designPrimers(currentSequence.sequence, targetStart, targetEnd, primerConfig);
      setProgress(80);
      await new Promise((r) => setTimeout(r, 100));
      setPrimers([...result.forward, ...result.reverse]);
      setProgress(100);
      addToast(
        'success',
        `设计完成：${result.forward.length} 条正向 / ${result.reverse.length} 条反向引物`
      );
    } catch (e) {
      addToast('error', '引物设计失败');
    } finally {
      setTimeout(() => {
        setIsRunning(false);
        setProgress(0);
      }, 400);
    }
  };

  if (!currentSequence) {
    return (
      <div className="h-full flex items-center justify-center">
        <Empty
          description="请先在「序列可视化」Tab中导入序列文件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bio-border bg-bio-bg/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-bio-green/10 flex items-center justify-center">
            <Dna className="w-4 h-4 text-bio-green" />
          </div>
          <div>
            <div className="text-sm font-medium text-bio-text">引物设计与优化</div>
            <div className="text-xs text-bio-text-secondary">
              {currentSequence.length.toLocaleString()} bp · {primers.length} 条引物
              {selection && (
                <span className="ml-2 text-bio-purple">
                  · 选中: {(selection.end - selection.start).toLocaleString()} bp
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-bio-text-secondary">
              <Spin size="small" />
              <Progress percent={progress} showInfo={false} size="small" style={{ width: 100 }} />
              <span>{progress}%</span>
            </div>
          )}
          <Button
            size="small"
            icon={<FlaskConical className="w-3.5 h-3.5" />}
            onClick={handleDesign}
            loading={isRunning}
          >
            模拟运行
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={handleDesign}
            loading={isRunning}
          >
            设计引物
          </Button>
        </div>
      </div>

      <div className="p-4 border-b border-bio-border bg-bio-bg/30">
        <PrimerCanvas
          targetStart={selection?.start}
          targetEnd={selection?.end}
          selectedPrimer={selected}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden p-4">
          <PrimerTable onSelect={(p) => setSelected(p)} selectedId={selected?.id} />
        </div>
        <div className="w-[320px] flex-shrink-0 border-l border-bio-border">
          <PrimerConfig onRunDesign={handleDesign} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}
