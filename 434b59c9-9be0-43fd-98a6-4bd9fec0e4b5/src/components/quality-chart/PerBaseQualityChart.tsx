import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/stores/analysisStore';
import { getQualityColor, getQualityLabel } from '@/utils/qualityAnalyzer';
import { useResizeObserver } from '@/hooks/useResizeObserver';

export function PerBaseQualityChart() {
  const qualityData = useAnalysisStore((s) => s.qualityData);
  const threshold = useAnalysisStore((s) => s.qualityThreshold);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  useEffect(() => {
    if (!svgRef.current || !size || !qualityData) return;

    const width = size.width;
    const height = 260;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const positions = qualityData.perBaseQuality.map((_, i) => i);
    const maxPos = Math.max(...positions);

    const x = d3.scaleLinear().domain([0, maxPos]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 45]).range([innerH, 0]);

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(8)
          .tickSize(-innerH)
          .tickFormat((d) => String(d))
      )
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
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerW))
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
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(threshold))
      .attr('y2', y(threshold))
      .attr('stroke', '#f85149')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4');

    g.append('text')
      .attr('x', innerW)
      .attr('y', y(threshold) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#f85149')
      .attr('font-size', 10)
      .text(`阈值 Q${threshold}`);

    const defs = svg.append('defs');
    const gradId = 'pq-grad-' + Math.random().toString(36).slice(2, 8);
    const gradient = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 1);
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#3fb950').attr('stop-opacity', 0.4);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#3fb950').attr('stop-opacity', 0.02);

    const area = d3
      .area<number>()
      .x((d) => x(d))
      .y0(innerH)
      .y1((d) => y(qualityData.perBaseQuality[d].median))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(positions)
      .attr('fill', `url(#${gradId})`)
      .attr('d', area);

    const lineMedian = d3
      .line<number>()
      .x((d) => x(d))
      .y((d) => y(qualityData.perBaseQuality[d].median))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(positions)
      .attr('fill', 'none')
      .attr('stroke', '#3fb950')
      .attr('stroke-width', 2)
      .attr('d', lineMedian);

    g.append('path')
      .datum(positions)
      .attr('fill', 'none')
      .attr('stroke', '#d29922')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 2')
      .attr(
        'd',
        d3
          .line<number>()
          .x((d) => x(d))
          .y((d) => y(qualityData.perBaseQuality[d].q25))
          .curve(d3.curveMonotoneX)
      );

    g.append('path')
      .datum(positions)
      .attr('fill', 'none')
      .attr('stroke', '#d29922')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 2')
      .attr(
        'd',
        d3
          .line<number>()
          .x((d) => x(d))
          .y((d) => y(qualityData.perBaseQuality[d].q75))
          .curve(d3.curveMonotoneX)
      );

    g.append('text')
      .attr('x', 0)
      .attr('y', -6)
      .attr('fill', '#6e7681')
      .attr('font-size', 10)
      .text('Phred Quality Score');

    g.append('text')
      .attr('x', innerW)
      .attr('y', innerH + 30)
      .attr('text-anchor', 'end')
      .attr('fill', '#6e7681')
      .attr('font-size', 10)
      .text('Position in read (bp)');

    const lowCount = qualityData.lowQualityRegions.length;
    if (lowCount > 0) {
      g.append('text')
        .attr('x', innerW)
        .attr('y', -6)
        .attr('text-anchor', 'end')
        .attr('fill', '#f85149')
        .attr('font-size', 10)
        .text(`⚠ ${lowCount} 个低质量区域`);
    }
  }, [qualityData, size, threshold]);

  if (!qualityData) return null;

  return (
    <div ref={ref} className="w-full border border-bio-border rounded bg-bio-bg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-bio-text">Per-base 质量分布</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-bio-green" />
            <span className="text-bio-text-secondary">中位数</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-bio-yellow" />
            <span className="text-bio-text-secondary">Q25/Q75</span>
          </span>
        </div>
      </div>
      <svg ref={svgRef} />
    </div>
  );
}
