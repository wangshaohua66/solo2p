import { useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { PerBaseQualityChart } from './PerBaseQualityChart';
import { GCDistributionChart } from './GCDistributionChart';
import { LengthDistributionChart } from './LengthDistributionChart';
import { simulateQualityData, analyzeQuality } from '@/utils/qualityAnalyzer';
import { Activity, Play, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Empty, Progress, Spin, Slider, Button, Tag, Card } from 'antd';
import { useProjectStore } from '@/stores/projectStore';

export function QualityChart() {
  const qualityData = useAnalysisStore((s) => s.qualityData);
  const setQualityData = useAnalysisStore((s) => s.setQualityData);
  const qualityThreshold = useAnalysisStore((s) => s.qualityThreshold);
  const setQualityThreshold = useAnalysisStore((s) => s.setQualityThreshold);
  const currentSequence = useAnalysisStore((s) => s.currentSequence);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { addToast } = useProjectStore.getState();

  const handleAnalyze = async () => {
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

      const result = simulateQualityData(currentSequence.length);
      setProgress(85);
      await new Promise((r) => setTimeout(r, 150));
      setQualityData(result);
      setProgress(100);
      addToast('success', `质量分析完成，共 ${result.totalReads.toLocaleString()} 条 reads`);
    } catch (e) {
      addToast('error', '质量分析失败');
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
          <div className="w-8 h-8 rounded-lg bg-bio-blue/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-bio-blue" />
          </div>
          <div>
            <div className="text-sm font-medium text-bio-text">测序质量评估</div>
            <div className="text-xs text-bio-text-secondary">
              {currentSequence.length.toLocaleString()} bp
              {qualityData && (
                <span className="ml-2">
                  · {qualityData.totalReads.toLocaleString()} reads
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-bio-text-secondary">
              <Spin size="small" />
              <Progress percent={progress} showInfo={false} size="small" style={{ width: 100 }} />
              <span>{progress}%</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-bio-text-secondary">质量阈值</span>
            <div style={{ width: 100 }}>
              <Slider
                min={0}
                max={40}
                value={qualityThreshold}
                onChange={(v) => setQualityThreshold(v as number)}
                styles={{ track: { background: qualityThreshold >= 20 ? '#3fb950' : '#f85149' } }}
              />
            </div>
            <span className="font-mono text-bio-blue">Q{qualityThreshold}</span>
          </div>
          <Button
            size="small"
            icon={isRunning ? undefined : <RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleAnalyze}
            loading={isRunning}
          >
            {qualityData ? '重新分析' : '模拟分析'}
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={handleAnalyze}
            loading={isRunning}
          >
            开始分析
          </Button>
        </div>
      </div>

      {qualityData && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-bio-border bg-bio-panel/30">
          {qualityData.lowQualityRegions.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-bio-green">
              <CheckCircle2 className="w-3.5 h-3.5" />
              未检测到低质量区域
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-mut-pathogenic">
              <AlertTriangle className="w-3.5 h-3.5" />
              检测到 {qualityData.lowQualityRegions.length} 个低质量区域
              {qualityData.lowQualityRegions.slice(0, 3).map((r, i) => (
                <Tag key={i} color="red" style={{ border: 'none', margin: 0 }}>
                  {r.start}-{r.end} ({r.meanQ.toFixed(1)})
                </Tag>
              ))}
              {qualityData.lowQualityRegions.length > 3 && (
                <span className="text-bio-text-secondary">
                  +{qualityData.lowQualityRegions.length - 3}
                </span>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-4 text-xs">
            <span className="text-bio-text-secondary">
              平均Q值: <span className="font-mono text-bio-green">{qualityData.meanQuality.toFixed(2)}</span>
            </span>
            <span className="text-bio-text-secondary">
              总reads: <span className="font-mono text-bio-blue">{qualityData.totalReads.toLocaleString()}</span>
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!qualityData ? (
          <div className="h-[400px] flex items-center justify-center">
            <Empty
              description="点击「开始分析」运行测序质量评估"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <>
            <PerBaseQualityChart />
            <div className="grid grid-cols-2 gap-4">
              <GCDistributionChart />
              <LengthDistributionChart />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
