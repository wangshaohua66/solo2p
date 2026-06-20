import { useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { Filter, X } from 'lucide-react';
import { Checkbox, Input, Slider, Collapse } from 'antd';
import type { MutationType, Pathogenicity } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';

const MUTATION_TYPES: { value: MutationType; label: string }[] = [
  { value: 'SNP', label: 'SNP' },
  { value: 'Ins', label: '插入' },
  { value: 'Del', label: '缺失' },
  { value: 'Indel', label: 'Indel' },
];

const PATHOGENICITY: { value: Pathogenicity; label: string; color: string }[] = [
  { value: 'pathogenic', label: '致病', color: '#ff00aa' },
  { value: 'likely-pathogenic', label: '可能致病', color: '#ff7b00' },
  { value: 'uncertain', label: '意义未明', color: '#a371f7' },
  { value: 'likely-benign', label: '可能良性', color: '#3fb950' },
  { value: 'benign', label: '良性', color: '#00ffcc' },
];

interface MutationFilterProps {
  onFilterChange?: (filters: {
    types: MutationType[];
    pathogenicity: Pathogenicity[];
    positionRange?: [number, number];
    validated?: boolean;
    searchText: string;
  }) => void;
  maxPosition: number;
}

export function MutationFilter({ onFilterChange, maxPosition }: MutationFilterProps) {
  const [expanded, setExpanded] = useState(true);
  const [types, setTypes] = useState<MutationType[]>([]);
  const [pathogen, setPathogen] = useState<Pathogenicity[]>([]);
  const [posRange, setPosRange] = useState<[number, number]>([0, maxPosition || 100000]);
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 200);

  const emit = () => {
    onFilterChange?.({
      types,
      pathogenicity: pathogen,
      positionRange: posRange,
      searchText: debouncedSearch,
    });
  };

  return (
    <div className="border-b border-bio-border">
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-bio-panel/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-sm text-bio-text">
          <Filter className="w-4 h-4 text-bio-blue" />
          <span>筛选条件</span>
          {(types.length > 0 || pathogen.length > 0 || debouncedSearch) && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-bio-blue/20 text-bio-blue">
              {[types.length > 0 && `${types.length}类型`,
                pathogen.length > 0 && `${pathogen.length}等级`,
                debouncedSearch && '搜索'].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          <div>
            <label className="block text-xs text-bio-text-secondary mb-2">搜索</label>
            <Input
              size="small"
              placeholder="位置、基因、碱基..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setTimeout(emit, 200);
              }}
              allowClear
              prefix={<Filter className="w-3.5 h-3.5 text-bio-text-secondary" />}
            />
          </div>

          <div>
            <label className="block text-xs text-bio-text-secondary mb-2">突变类型</label>
            <div className="flex flex-wrap gap-2">
              {MUTATION_TYPES.map((t) => {
                const checked = types.includes(t.value);
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      const next = checked
                        ? types.filter((v) => v !== t.value)
                        : [...types, t.value];
                      setTypes(next);
                      setTimeout(emit, 0);
                    }}
                    className={`
                      px-2.5 py-1 text-xs rounded border transition-all
                      ${checked
                        ? 'bg-bio-blue/20 border-bio-blue text-bio-blue'
                        : 'bg-transparent border-bio-border text-bio-text-secondary hover:border-bio-blue/50 hover:text-bio-text'
                      }
                    `}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-bio-text-secondary mb-2">致病性等级</label>
            <div className="flex flex-wrap gap-2">
              {PATHOGENICITY.map((p) => {
                const checked = pathogen.includes(p.value);
                return (
                  <button
                    key={p.value}
                    onClick={() => {
                      const next = checked
                        ? pathogen.filter((v) => v !== p.value)
                        : [...pathogen, p.value];
                      setPathogen(next);
                      setTimeout(emit, 0);
                    }}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-all
                      ${checked
                        ? 'border-current bg-current/10'
                        : 'border-bio-border hover:border-bio-border'
                      }
                    `}
                    style={{ color: checked ? p.color : undefined }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-bio-text-secondary mb-2">
              位置范围: {posRange[0]} - {posRange[1]}
            </label>
            <Slider
              range
              min={0}
              max={maxPosition || 100000}
              value={posRange}
              onChange={(v) => setPosRange(v as [number, number])}
              onChangeComplete={() => emit()}
              styles={{ track: { background: '#58a6ff' } }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
