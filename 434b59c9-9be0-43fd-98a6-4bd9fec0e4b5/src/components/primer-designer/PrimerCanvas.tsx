import { useMemo } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { calculateTm, gcContent } from '@/utils/primerCalculator';
import type { Primer } from '@/types';
import { useResizeObserver } from '@/hooks/useResizeObserver';

const BASE_COLORS: Record<string, string> = {
  A: '#3fb950',
  T: '#f85149',
  C: '#58a6ff',
  G: '#d29922',
};

interface PrimerCanvasProps {
  targetStart?: number;
  targetEnd?: number;
  selectedPrimer?: Primer | null;
  onRegionChange?: (start: number, end: number) => void;
}

export function PrimerCanvas({ targetStart, targetEnd, selectedPrimer, onRegionChange }: PrimerCanvasProps) {
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const viewport = useAnalysisStore((s) => s.viewport);
  const setViewport = useAnalysisStore((s) => s.setViewport);
  const primers = useAnalysisStore((s) => s.primers);

  const { ref, size } = useResizeObserver<HTMLDivElement>();
  const width = size?.width ?? 600;
  const height = 140;

  const PADDING = { left: 50, right: 20, top: 20, bottom: 20 };
  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const { start: viewStart, end: viewEnd } = viewport;
  const seqLen = currentSequence?.length ?? 1;
  const scale = (i: number) => ((i - viewStart) / (viewEnd - viewStart)) * chartWidth + PADDING.left;

  const rulerTicks = useMemo(() => {
    const range = viewEnd - viewStart;
    if (range <= 0) return [];
    const rawStep = range / 8;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const steps = [1, 2, 2.5, 5, 10];
    const step = steps.reduce((best, s) => {
      const v = s * magnitude;
      return v >= rawStep ? best : v;
    }, 10 * magnitude);

    const ticks: number[] = [];
    let t = Math.ceil(viewStart / step) * step;
    while (t <= viewEnd) {
      ticks.push(Math.floor(t));
      t += step;
    }
    return ticks;
  }, [viewStart, viewEnd]);

  if (!currentSequence) return null;

  const visiblePrimers = primers.filter(
    (p) => (p.end >= viewStart && p.start <= viewEnd)
  );

  return (
    <div ref={ref} className="w-full border border-bio-border rounded bg-bio-panel/30 overflow-hidden">
      <svg width={width} height={height}>
        <line
          x1={PADDING.left}
          y1={PADDING.top + chartHeight / 2}
          x2={PADDING.left + chartWidth}
          y2={PADDING.top + chartHeight / 2}
          stroke="#30363d"
          strokeWidth={2}
        />

        {rulerTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={scale(tick)}
              y1={PADDING.top + chartHeight / 2 - 6}
              x2={scale(tick)}
              y2={PADDING.top + chartHeight / 2 + 6}
              stroke="#6e7681"
              strokeWidth={1}
            />
            <text
              x={scale(tick)}
              y={height - 4}
              textAnchor="middle"
              className="fill-bio-text-secondary"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {tick >= 1_000_000
                ? `${(tick / 1_000_000).toFixed(1)}M`
                : tick >= 1_000
                ? `${(tick / 1_000).toFixed(1)}K`
                : tick}
            </text>
          </g>
        ))}

        {targetStart !== undefined && targetEnd !== undefined && (
          <>
            <rect
              x={scale(targetStart)}
              y={PADDING.top + 8}
              width={Math.max(2, scale(targetEnd) - scale(targetStart))}
              height={chartHeight - 16}
              fill="rgba(163, 113, 247, 0.15)"
              stroke="#a371f7"
              strokeWidth={1}
              strokeDasharray="4 2"
              rx={2}
            />
            <text
              x={scale(targetStart) + 4}
              y={PADDING.top + 18}
              fill="#a371f7"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              目标区域 ({targetEnd - targetStart} bp)
            </text>
          </>
        )}

        {visiblePrimers.map((p) => {
          const isSelected = selectedPrimer?.id === p.id;
          const isForward = p.direction === 'forward';
          const y = isForward ? PADDING.top + chartHeight / 2 - 16 : PADDING.top + chartHeight / 2 + 4;
          const color = p.passFilter ? '#3fb950' : '#f85149';

          return (
            <g key={p.id} className="cursor-pointer">
              <rect
                x={scale(p.start)}
                y={y}
                width={Math.max(8, scale(p.end) - scale(p.start))}
                height={12}
                fill={isSelected ? 'rgba(88, 166, 255, 0.25)' : `${color}33`}
                stroke={isSelected ? '#58a6ff' : color}
                strokeWidth={isSelected ? 2 : 1}
                rx={2}
              >
                <title>
                  {p.sequence}\nTm: {p.tm.toFixed(1)}°C\nGC: {p.gcContent.toFixed(1)}%\n{isForward ? 'Forward' : 'Reverse'}
                </title>
              </rect>
              {isForward ? (
                <polygon
                  points={`${scale(p.end)},${y + 6} ${scale(p.end) + 6},${y} ${scale(p.end) + 6},${y + 12}`}
                  fill={color}
                />
              ) : (
                <polygon
                  points={`${scale(p.start)},${y + 6} ${scale(p.start) - 6},${y} ${scale(p.start) - 6},${y + 12}`}
                  fill={color}
                />
              )}
            </g>
          );
        })}

        <text
          x={PADDING.left}
          y={PADDING.top + chartHeight / 2 - 20}
          fill="#6e7681"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          Forward
        </text>
        <text
          x={PADDING.left}
          y={PADDING.top + chartHeight / 2 + 32}
          fill="#6e7681"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          Reverse
        </text>
      </svg>
    </div>
  );
}
