import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import type { LengthBin } from '@/types';

export function LengthDistributionChart() {
  const qualityData = useAnalysisStore((s) => s.qualityData);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  useEffect(() => {
    if (!svgRef.current || !size || !qualityData) return;

    const width = size.width;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const dist = qualityData.lengthDistribution;
    if (dist.length === 0) return;

    const maxLen = Math.max(...dist.map((d) => d.length));
    const maxCount = Math.max(...dist.map((d) => d.count), 1) * 1.1;

    const x = d3.scaleLinear().domain([0, maxLen]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, maxCount]).range([innerH, 0]);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickSize(-innerH))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick line')
          .attr('stroke', '#30363d')
          .attr('stroke-dasharray', '2 2')
      )
      .call((g) =>
        g.selectAll('.tick text').attr('fill', '#6e7681').attr('font-size', 10)
      );

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(d3.format('~s')))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick line')
          .attr('stroke', '#30363d')
          .attr('stroke-dasharray', '2 2')
      )
      .call((g) =>
        g.selectAll('.tick text').attr('fill', '#6e7681').attr('font-size', 10)
      );

    g.append('line')
      .attr('x1', x(qualityData.meanReadLength))
      .attr('x2', x(qualityData.meanReadLength))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#d29922')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3');

    g.append('text')
      .attr('x', x(qualityData.meanReadLength) + 4)
      .attr('y', 12)
      .attr('fill', '#d29922')
      .attr('font-size', 10)
      .text(`均值 ${qualityData.meanReadLength.toFixed(0)} bp`);

    const defs = svg.append('defs');
    const gradId = 'len-grad-' + Math.random().toString(36).slice(2, 8);
    const gradient = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 1);
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#58a6ff').attr('stop-opacity', 0.7);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#58a6ff').attr('stop-opacity', 0.2);

    const line = d3
      .line<LengthBin>()
      .x((d) => x(d.length))
      .y((d) => y(d.count))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const area = d3
      .area<LengthBin>()
      .x((d) => x(d.length))
      .y0(innerH)
      .y1((d) => y(d.count))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append('path').datum(dist).attr('fill', `url(#${gradId})`).attr('d', area);

    g.append('path')
      .datum(dist)
      .attr('fill', 'none')
      .attr('stroke', '#58a6ff')
      .attr('stroke-width', 1.5)
      .attr('d', line);

    g.append('text')
      .attr('x', 0)
      .attr('y', -6)
      .attr('fill', '#6e7681')
      .attr('font-size', 10)
      .text('Read count');

    g.append('text')
      .attr('x', innerW)
      .attr('y', innerH + 30)
      .attr('text-anchor', 'end')
      .attr('fill', '#6e7681')
      .attr('font-size', 10)
      .text('Sequence length (bp)');
  }, [qualityData, size]);

  if (!qualityData) return null;

  const n50 = qualityData.lengthDistribution.length > 0
    ? qualityData.lengthDistribution[Math.floor(qualityData.lengthDistribution.length / 2)]?.length ?? 0
    : 0;

  return (
    <div ref={ref} className="w-full border border-bio-border rounded bg-bio-bg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-bio-text">序列长度分布</div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-bio-text-secondary">
            均值: <span className="font-mono text-bio-yellow">{qualityData.meanReadLength.toFixed(0)} bp</span>
          </span>
          <span className="text-bio-text-secondary">
            N50: <span className="font-mono text-bio-blue">{n50} bp</span>
          </span>
          <span className="text-bio-text-secondary">
            总reads: <span className="font-mono text-bio-green">{qualityData.totalReads.toLocaleString()}</span>
          </span>
        </div>
      </div>
      <svg ref={svgRef} />
    </div>
  );
}
