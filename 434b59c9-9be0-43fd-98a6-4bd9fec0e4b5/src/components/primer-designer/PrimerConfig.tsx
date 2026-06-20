import { useEffect, useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { PrimerConfigParams } from '@/types';
import { Slider, InputNumber, Switch, Button } from 'antd';
import { Settings, Wand2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useProjectStore } from '@/stores/projectStore';

interface PrimerConfigProps {
  onChange?: (config: PrimerConfigParams) => void;
  onRunDesign?: () => void;
  isRunning?: boolean;
}

export function PrimerConfig({ onChange, onRunDesign, isRunning }: PrimerConfigProps) {
  const primerConfig = useAnalysisStore((s) => s.primerConfig);
  const setPrimerConfig = useAnalysisStore((s) => s.setPrimerConfig);
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const selection = useAnalysisStore((s) => s.selection);
  const { addToast } = useProjectStore.getState();

  const [local, setLocal] = useState<PrimerConfigParams>(primerConfig);
  const debounced = useDebounce(local, 150);

  useEffect(() => {
    setPrimerConfig(debounced);
    onChange?.(debounced);
  }, [debounced]);

  const update = <K extends keyof PrimerConfigParams>(key: K, value: PrimerConfigParams[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const useSelection = () => {
    if (!selection || !currentSequence) {
      addToast('warning', '请先在序列视图中选择目标区域');
      return;
    }
    update('productSizeMin', Math.max(50, selection.end - selection.start - 100));
    update('productSizeMax', selection.end - selection.start + 100);
    addToast('success', `已根据选择区域设置产物大小: ${local.productSizeMin}-${local.productSizeMax}bp`);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-bio-border">
        <Settings className="w-4 h-4 text-bio-blue" />
        <span className="text-sm font-medium text-bio-text">引物参数配置</span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        <div className="bg-bio-panel border border-bio-border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-bio-text-secondary">目标区域</span>
            <button
              onClick={useSelection}
              className="text-xs text-bio-blue hover:underline"
            >
              使用当前选择
            </button>
          </div>
          {selection ? (
            <div className="font-mono text-sm text-bio-text">
              {selection.start.toLocaleString()} - {selection.end.toLocaleString()}
              <span className="text-bio-text-secondary ml-2">({selection.end - selection.start} bp)</span>
            </div>
          ) : (
            <div className="text-xs text-bio-text-secondary italic">未选择区域</div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-bio-text-secondary">引物长度</label>
            <span className="text-xs font-mono text-bio-blue">
              {local.primerLengthMin}-{local.primerLengthMax} bp
            </span>
          </div>
          <Slider
            range
            min={15}
            max={35}
            value={[local.primerLengthMin, local.primerLengthMax]}
            onChange={([min, max]) => {
              update('primerLengthMin', min);
              update('primerLengthMax', max);
            }}
            styles={{ track: { background: '#58a6ff' } }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-bio-text-secondary">Tm 值范围</label>
            <span className="text-xs font-mono text-bio-green">
              {local.tmMin.toFixed(1)}-{local.tmMax.toFixed(1)} °C
            </span>
          </div>
          <Slider
            range
            min={45}
            max={75}
            step={0.5}
            value={[local.tmMin, local.tmMax]}
            onChange={([min, max]) => {
              update('tmMin', min);
              update('tmMax', max);
            }}
            styles={{ track: { background: '#3fb950' } }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-bio-text-secondary">GC 含量</label>
            <span className="text-xs font-mono text-mut-vus">
              {local.gcMin}-{local.gcMax} %
            </span>
          </div>
          <Slider
            range
            min={20}
            max={80}
            value={[local.gcMin, local.gcMax]}
            onChange={([min, max]) => {
              update('gcMin', min);
              update('gcMax', max);
            }}
            styles={{ track: { background: '#a371f7' } }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-bio-text-secondary">产物大小</label>
            <span className="text-xs font-mono text-bio-yellow">
              {local.productSizeMin}-{local.productSizeMax} bp
            </span>
          </div>
          <Slider
            range
            min={50}
            max={2000}
            step={10}
            value={[local.productSizeMin, local.productSizeMax]}
            onChange={([min, max]) => {
              update('productSizeMin', min);
              update('productSizeMax', max);
            }}
            styles={{ track: { background: '#d29922' } }}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-bio-text-secondary">发夹结构检测</span>
            <Switch
              size="small"
              checked={local.checkHairpin}
              onChange={(v) => update('checkHairpin', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-bio-text-secondary">二聚体检测</span>
            <Switch
              size="small"
              checked={local.checkDimer}
              onChange={(v) => update('checkDimer', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-bio-text-secondary">3'端特异性</span>
            <Switch
              size="small"
              checked={local.checkThreePrimeSpecificity}
              onChange={(v) => update('checkThreePrimeSpecificity', v)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-bio-text-secondary mb-1">盐浓度 (mM)</label>
            <InputNumber
              size="small"
              min={10}
              max={200}
              value={local.naConcentration}
              onChange={(v) => update('naConcentration', v ?? 50)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-bio-text-secondary mb-1">引物浓度 (nM)</label>
            <InputNumber
              size="small"
              min={10}
              max={2000}
              value={local.primerConcentration}
              onChange={(v) => update('primerConcentration', v ?? 200)}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-bio-border">
        <Button
          type="primary"
          block
          icon={<Wand2 className="w-4 h-4" />}
          onClick={onRunDesign}
          loading={isRunning}
        >
          设计引物
        </Button>
      </div>
    </div>
  );
}
