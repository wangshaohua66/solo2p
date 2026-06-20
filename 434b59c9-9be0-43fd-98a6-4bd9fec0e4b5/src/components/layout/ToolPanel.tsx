import { useMemo } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { ActiveTab, PrimerConfigParams, SequenceData, Annotation } from '@/types';
import { sequenceSearch } from '@/utils/sequenceParser';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Dna,
  AlertTriangle,
  FlaskConical,
  Activity,
  Settings,
  Sliders,
  Info,
} from 'lucide-react';
import { InputNumber, Slider, Switch, Input, Divider, Tag, Empty, Tooltip, Segmented } from 'antd';
import { useDebounce } from '@/hooks/useDebounce';

const TAB_INFO: Record<ActiveTab, { icon: any; label: string; desc: string }> = {
  sequence: { icon: Dna, label: '序列可视化', desc: '查看、标注、搜索序列' },
  mutation: { icon: AlertTriangle, label: '突变分析', desc: '检测和注释突变位点' },
  primer: { icon: FlaskConical, label: '引物设计', desc: '设计和优化 PCR 引物' },
  quality: { icon: Activity, label: '质量评估', desc: '评估测序数据质量' },
};

export function ToolPanel() {
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const viewport = useAnalysisStore((s) => s.viewport);
  const setViewport = useAnalysisStore((s) => s.setViewport);
  const viewMode = useAnalysisStore((s) => s.viewMode);
  const setViewMode = useAnalysisStore((s) => s.setViewMode);
  const searchQuery = useAnalysisStore((s) => s.searchQuery);
  const setSearchQuery = useAnalysisStore((s) => s.setSearchQuery);
  const searchResults = useAnalysisStore((s) => s.searchResults);
  const setSearchResults = useAnalysisStore((s) => s.setSearchResults);
  const primerConfig = useAnalysisStore((s) => s.primerConfig);
  const setPrimerConfig = useAnalysisStore((s) => s.setPrimerConfig);
  const qualityThreshold = useAnalysisStore((s) => s.qualityThreshold);
  const setQualityThreshold = useAnalysisStore((s) => s.setQualityThreshold);
  const annotations = useAnalysisStore((s) => s.annotations);
  const setSelection = useAnalysisStore((s) => s.setSelection);

  const info = TAB_INFO[activeTab];
  const debouncedQuery = useDebounce(searchQuery, 250);

  const handleSearch = () => {
    if (!currentSequence || !debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = sequenceSearch(currentSequence.sequence, debouncedQuery.toUpperCase());
    setSearchResults(results);
  };

  useMemo(handleSearch, [debouncedQuery, currentSequence]);

  const jumpToResult = (pos: number) => {
    if (!currentSequence) return;
    const len = Math.max(20, debouncedQuery.length);
    const start = Math.max(0, pos - 10);
    const end = Math.min(currentSequence.length, pos + len + 10);
    setViewport({ start, end });
    setSelection({ start: pos, end: pos + debouncedQuery.length });
  };

  const resetZoom = () => {
    if (!currentSequence) return;
    setViewport({ start: 0, end: currentSequence.length, zoom: 1, offset: 0 });
  };

  return (
    <div className="h-full flex flex-col bg-bio-bg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-bio-border">
        <div className="w-7 h-7 rounded-md bg-bio-blue/10 flex items-center justify-center">
          <info.icon className="w-3.5 h-3.5 text-bio-blue" />
        </div>
        <div>
          <div className="text-sm font-medium text-bio-text">{info.label}</div>
          <div className="text-[10px] text-bio-text-secondary">{info.desc}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {activeTab === 'sequence' && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-bio-text-secondary flex items-center gap-1">
                  <Sliders className="w-3 h-3" /> 视图设置
                </span>
              </div>
              <div>
                <label className="block text-xs text-bio-text-secondary mb-1.5">显示模式</label>
                <Segmented
                  size="small"
                  value={viewMode}
                  onChange={(v) => setViewMode(v as any)}
                  options={[
                    { value: 'nucleotide', label: '核苷酸' },
                    { value: 'aminoacid', label: '氨基酸' },
                  ]}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-bio-text-secondary">缩放</label>
                  <span className="text-xs font-mono text-bio-blue">
                    {(viewport.zoom * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewport({ zoom: Math.max(0.3, viewport.zoom / 1.3) })}
                    className="p-1.5 rounded bg-bio-panel border border-bio-border hover:border-bio-blue/50 text-bio-text-secondary hover:text-bio-text transition-colors"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <Slider
                    className="flex-1"
                    min={0.3}
                    max={8}
                    step={0.1}
                    value={viewport.zoom}
                    onChange={(v) => setViewport({ zoom: v as number })}
                    styles={{ track: { background: '#58a6ff' } }}
                  />
                  <button
                    onClick={() => setViewport({ zoom: Math.min(8, viewport.zoom * 1.3) })}
                    className="p-1.5 rounded bg-bio-panel border border-bio-border hover:border-bio-blue/50 text-bio-text-secondary hover:text-bio-text transition-colors"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={resetZoom}
                  className="mt-1.5 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-bio-panel border border-bio-border hover:border-bio-blue/50 text-xs text-bio-text-secondary hover:text-bio-text transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  重置视图
                </button>
              </div>

              {currentSequence && (
                <div>
                  <label className="block text-xs text-bio-text-secondary mb-1.5">
                    可视范围 (bp)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <InputNumber
                      size="small"
                      min={0}
                      max={currentSequence.length}
                      value={viewport.start}
                      onChange={(v) => setViewport({ start: v ?? 0 })}
                      className="w-full"
                    />
                    <InputNumber
                      size="small"
                      min={0}
                      max={currentSequence.length}
                      value={viewport.end}
                      onChange={(v) => setViewport({ end: v ?? currentSequence.length })}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            <Divider style={{ margin: 0, borderColor: '#30363d' }} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-bio-text-secondary flex items-center gap-1">
                  <Search className="w-3 h-3" /> 序列搜索
                </span>
                {searchResults.length > 0 && (
                  <Tag color="blue" style={{ border: 'none', margin: 0, fontSize: 10 }}>
                    {searchResults.length} 个匹配
                  </Tag>
                )}
              </div>
              <Input
                size="small"
                placeholder="输入序列如 ATCG..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                prefix={<Search className="w-3 h-3 text-bio-text-secondary" />}
              />
              {searchResults.length > 0 && (
                <div className="max-h-32 overflow-auto space-y-0.5">
                  {searchResults.slice(0, 20).map((pos, i) => (
                    <button
                      key={i}
                      onClick={() => jumpToResult(pos)}
                      className="w-full text-left px-2 py-1 rounded text-xs hover:bg-bio-blue/10 font-mono text-bio-blue transition-colors"
                    >
                      #{i + 1} 位置 {pos.toLocaleString()}
                    </button>
                  ))}
                  {searchResults.length > 20 && (
                    <div className="px-2 py-1 text-[10px] text-bio-text-secondary">
                      仅显示前 20 个结果...
                    </div>
                  )}
                </div>
              )}
            </div>

            {currentSequence && (
              <>
                <Divider style={{ margin: 0, borderColor: '#30363d' }} />
                <div className="space-y-2">
                  <span className="text-xs font-medium text-bio-text-secondary flex items-center gap-1">
                    <Info className="w-3 h-3" /> 序列信息
                  </span>
                  <div className="bg-bio-panel border border-bio-border rounded p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-bio-text-secondary">名称</span>
                      <span className="text-bio-text truncate max-w-[140px]" title={currentSequence.name}>
                        {currentSequence.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-bio-text-secondary">长度</span>
                      <span className="font-mono text-bio-blue">
                        {currentSequence.length.toLocaleString()} bp
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-bio-text-secondary">格式</span>
                      <span className="text-bio-green">{currentSequence.format}</span>
                    </div>
                    {currentSequence.description && (
                      <div>
                        <span className="text-bio-text-secondary">描述</span>
                        <div className="mt-0.5 text-bio-text text-[10px] leading-relaxed">
                          {currentSequence.description}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {annotations.length > 0 && (
              <>
                <Divider style={{ margin: 0, borderColor: '#30363d' }} />
                <div className="space-y-2">
                  <span className="text-xs font-medium text-bio-text-secondary">
                    注释 ({annotations.length})
                  </span>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {annotations.slice(0, 10).map((a) => (
                      <div
                        key={a.id}
                        className="px-2 py-1.5 rounded bg-bio-panel border border-bio-border text-xs cursor-pointer hover:border-bio-blue/50 transition-colors"
                        onClick={() => {
                          if (!currentSequence) return;
                          setViewport({
                            start: Math.max(0, a.start - 20),
                            end: Math.min(currentSequence.length, a.end + 20),
                          });
                        }}
                        title={`${a.start}-${a.end}: ${a.label}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-sm"
                            style={{ background: a.color }}
                          />
                          <span className="text-bio-text truncate flex-1">{a.label}</span>
                        </div>
                        <div className="font-mono text-[10px] text-bio-text-secondary mt-0.5">
                          {a.start.toLocaleString()} - {a.end.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'mutation' && (
          <div className="space-y-4">
            <div className="bg-bio-panel border border-bio-border rounded p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-mut-pathogenic" />
                <span className="text-sm font-medium text-bio-text">突变检测设置</span>
              </div>
              <div className="text-bio-text-secondary text-[11px] leading-relaxed">
                基于 Smith-Waterman 算法进行序列比对，自动识别 SNP、Indel 等突变类型，
                并匹配内置致病突变数据库进行致病性分级。
              </div>
            </div>
            <div>
              <label className="block text-xs text-bio-text-secondary mb-2">
                致病性颜色说明
              </label>
              <div className="space-y-1.5">
                {[
                  { c: '#ff00aa', l: '致病 (Pathogenic)', desc: '已知致病突变' },
                  { c: '#ff7b00', l: '可能致病', desc: '高风险变异' },
                  { c: '#a371f7', l: '意义未明 (VUS)', desc: '临床意义不确定' },
                  { c: '#3fb950', l: '可能良性', desc: '低风险变异' },
                  { c: '#00ffcc', l: '良性 (Benign)', desc: '已知良性多态' },
                ].map((x) => (
                  <div key={x.l} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ background: x.c, boxShadow: `0 0 4px ${x.c}66` }}
                    />
                    <span className="text-xs text-bio-text w-28" style={{ color: x.c }}>
                      {x.l}
                    </span>
                    <span className="text-[10px] text-bio-text-secondary">{x.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-bio-text-secondary mb-2">
                碱基配色方案
              </label>
              <div className="grid grid-cols-4 gap-1">
                {['A', 'T', 'C', 'G'].map((b) => (
                  <div
                    key={b}
                    className="flex items-center justify-center py-1.5 rounded bg-bio-panel border border-bio-border font-mono text-sm font-bold"
                    style={{
                      color: ({
                        A: '#3fb950',
                        T: '#f85149',
                        C: '#58a6ff',
                        G: '#d29922',
                      } as Record<string, string>)[b],
                    }}
                  >
                    {b}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'primer' && (
          <div className="space-y-4">
            <div className="bg-bio-panel border border-bio-border rounded p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-bio-green" />
                <span className="text-sm font-medium text-bio-text">引物设计配置</span>
              </div>
              <div className="text-bio-text-secondary text-[11px] leading-relaxed">
                引物参数可在下方配置面板调整。推荐产物大小 100-500bp，
                Tm 值 55-65°C，GC 含量 40-60%。
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-bio-text-secondary">引物长度</span>
                <span className="font-mono text-xs text-bio-blue">
                  {primerConfig.primerLengthMin}-{primerConfig.primerLengthMax} bp
                </span>
              </div>
              <Slider
                range
                min={15}
                max={35}
                value={[primerConfig.primerLengthMin, primerConfig.primerLengthMax]}
                onChange={([mn, mx]) =>
                  setPrimerConfig({ primerLengthMin: mn, primerLengthMax: mx })
                }
                styles={{ track: { background: '#58a6ff' } }}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-bio-text-secondary">Tm 值</span>
                <span className="font-mono text-xs text-bio-green">
                  {primerConfig.tmMin}-{primerConfig.tmMax} °C
                </span>
              </div>
              <Slider
                range
                min={45}
                max={75}
                step={0.5}
                value={[primerConfig.tmMin, primerConfig.tmMax]}
                onChange={([mn, mx]) => setPrimerConfig({ tmMin: mn, tmMax: mx })}
                styles={{ track: { background: '#3fb950' } }}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-bio-text-secondary">GC 含量</span>
                <span className="font-mono text-xs text-bio-purple">
                  {primerConfig.gcMin}-{primerConfig.gcMax} %
                </span>
              </div>
              <Slider
                range
                min={20}
                max={80}
                value={[primerConfig.gcMin, primerConfig.gcMax]}
                onChange={([mn, mx]) => setPrimerConfig({ gcMin: mn, gcMax: mx })}
                styles={{ track: { background: '#a371f7' } }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-bio-text-secondary">发夹检测</span>
                <Switch
                  size="small"
                  checked={primerConfig.checkHairpin}
                  onChange={(v) => setPrimerConfig({ checkHairpin: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-bio-text-secondary">二聚体检测</span>
                <Switch
                  size="small"
                  checked={primerConfig.checkDimer}
                  onChange={(v) => setPrimerConfig({ checkDimer: v })}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-4">
            <div className="bg-bio-panel border border-bio-border rounded p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-bio-blue" />
                <span className="text-sm font-medium text-bio-text">质量评估标准</span>
              </div>
              <div className="text-bio-text-secondary text-[11px] leading-relaxed">
                Phred 质量分数 Q = -10 × log₁₀(P)，其中 P 为碱基识别错误概率。
                Q30 表示 99.9% 准确率。
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-bio-text-secondary">质量阈值</span>
                <span className="font-mono text-xs text-bio-blue">Q{qualityThreshold}</span>
              </div>
              <Slider
                min={0}
                max={40}
                value={qualityThreshold}
                onChange={(v) => setQualityThreshold(v as number)}
                styles={{ track: { background: qualityThreshold >= 20 ? '#3fb950' : '#f85149' } }}
              />
            </div>
            <div>
              <label className="block text-xs text-bio-text-secondary mb-2">质量等级</label>
              <div className="space-y-1.5">
                {[
                  { min: 30, c: '#3fb950', l: '高质量 (Q≥30)', desc: '准确率 ≥ 99.9%' },
                  { min: 20, c: '#d29922', l: '中等 (Q20-30)', desc: '准确率 99-99.9%' },
                  { min: 10, c: '#ff7b00', l: '低质量 (Q10-20)', desc: '准确率 90-99%' },
                  { min: 0, c: '#f85149', l: '不合格 (Q<10)', desc: '准确率 < 90%' },
                ].map((x) => (
                  <div key={x.l} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: x.c }} />
                    <span className="text-xs w-28" style={{ color: x.c }}>
                      {x.l}
                    </span>
                    <span className="text-[10px] text-bio-text-secondary">{x.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
