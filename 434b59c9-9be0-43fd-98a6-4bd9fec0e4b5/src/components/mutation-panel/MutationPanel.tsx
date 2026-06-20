import { useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { MutationList } from './MutationList';
import { MutationDetail } from './MutationDetail';
import type { Mutation } from '@/types';
import { Play, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Progress, Spin, Empty } from 'antd';
import { useProjectStore } from '@/stores/projectStore';
import { detectMutations } from '@/utils/mutationDetector';

export function MutationPanel() {
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const mutations = useAnalysisStore((s) => s.mutations);
  const setMutations = useAnalysisStore((s) => s.setMutations);
  const selection = useAnalysisStore((s) => s.selection);

  const [selected, setSelected] = useState<Mutation | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { addToast } = useProjectStore.getState();

  const handleDetect = async () => {
    if (!currentSequence) {
      addToast('warning', '请先导入序列');
      return;
    }
    setIsRunning(true);
    setProgress(0);

    try {
      await new Promise((r) => setTimeout(r, 100));
      setProgress(30);
      await new Promise((r) => setTimeout(r, 200));
      setProgress(60);

      const sample = currentSequence.sequence.split('').map((b, i) => {
        if (i % 137 === 0) {
          const alts = ['A', 'T', 'C', 'G'].filter((x) => x !== b);
          return alts[Math.floor(Math.random() * alts.length)];
        }
        if (i % 389 === 0) return '';
        if (i % 521 === 0) return 'AT';
        return b;
      }).join('');

      const detected = detectMutations(currentSequence.sequence, sample);
      setProgress(90);
      await new Promise((r) => setTimeout(r, 100));
      setMutations(detected);
      setProgress(100);
      addToast('success', `检测到 ${detected.length} 个突变位点`);
    } catch (e) {
      addToast('error', '突变检测失败');
    } finally {
      setTimeout(() => {
        setIsRunning(false);
        setProgress(0);
      }, 300);
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
          <div className="w-8 h-8 rounded-lg bg-mut-pathogenic/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-mut-pathogenic" />
          </div>
          <div>
            <div className="text-sm font-medium text-bio-text">突变位点分析</div>
            <div className="text-xs text-bio-text-secondary">
              {currentSequence.length.toLocaleString()} bp · {mutations.length} 个突变
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-bio-text-secondary">
              <Spin size="small" />
              <Progress percent={progress} showInfo={false} size="small" style={{ width: 80 }} />
            </div>
          )}
          <Button
            size="small"
            icon={isRunning ? undefined : <RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleDetect}
            loading={isRunning}
          >
            {mutations.length > 0 ? '重新检测' : '运行检测'}
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={handleDetect}
            loading={isRunning}
          >
            检测突变
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <MutationList onSelectMutation={(m) => setSelected(m)} />
        </div>
        {selected && (
          <div className="w-[360px] flex-shrink-0">
            <MutationDetail mutation={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
