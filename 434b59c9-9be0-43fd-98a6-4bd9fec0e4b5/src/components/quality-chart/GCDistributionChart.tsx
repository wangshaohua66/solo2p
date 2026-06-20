import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useResizeObserver } from '@/hooks/useResizeObserver';

export function GCDistributionChart() {
  const qualityData = useAnalysisStore((s) => s.qualityData);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  useEffect(() => {
    if (!svgRef.current || !size || !qualityData) return;

    const width = size.width;
    const height = 240;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const gcDist = qualityData.gcDistribution;
    const maxY = Math.max(...gcDist.map((d) => d.count), 1) * 1.1;

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, maxY]).range([innerH, 0]);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(10)
          .tickFormat((d) => `${d}%`)
          .tickSize(-innerH)
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
      .attr('x1', x(qualityData.meanGcContent))
      .attr('x2', x(qualityData.meanGcContent))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#a371f7')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3');

    g.append('text')
      .attr('x', x(qualityData.meanGcContent) + 4)
      .attr('y', 12)
      .attr('fill', '#a371f7')
      .attr('font-size', 10)
      .text(`均值 ${qualityData.meanGcContent.toFixed(1)}%`);

    const barWidth = Math.max(1, innerW / gcDist.length - 1);

    g.selectAll('.gc-bar')
      .data(gcDist)
      .enter()
      .append('rect')
      .attr('class', 'gc-bar')
      .attr('x', (d) => x(d.gc) - barWidth / 2)
      .attr('y', (d) => y(d.count))
      .attr('width', barWidth)
      .attr('height', (d) => innerH - y(d.count))
      .attr('fill', (d) => {
        const gc = d.gc;
        if (gc < 30 || gc > 70) return '#f85149';
        if (gc < 35 || gc > 65) return '#ff7b00';
        return '#58a6ff';
      })
      .attr('opacity', 0.75)
      .append('title')
      .text((d) => `GC: ${d.gc}%\nReads: ${d.count.toLocaleString()}`);

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
      .text('GC content (%)');
  }, [qualityData, size]);

  if (!qualityData) return null;

  return (
    <div ref={ref} className="w-full border border-bio-border rounded bg-bio-bg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-bio-text">GC 含量分布</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-bio-text-secondary">
            均值: <span className="font-mono text-bio-purple">{qualityData.meanGcContent.toFixed(1)}%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-bio-blue" />
            <span className="text-bio-text-secondary">正常</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-bio-orange" />
            <span className="text-bio-text-secondary">偏离</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-mut-pathogenic" />
            <span className="text-bio-text-secondary">异常</span>
          </span>
        </div>
      </div>
      <svg ref={svgRef} />
    </div>
  );
}
