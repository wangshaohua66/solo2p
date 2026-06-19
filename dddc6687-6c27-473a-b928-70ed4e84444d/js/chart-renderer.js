/* ==========================================================================
   chart-renderer.js — Chart.js 图表模块
   产量柱状图 / 折线图 / 雷达图 / 环形图 / 稳定性散点 / GGE双标图
   ========================================================================== */
(function (global) {
  'use strict';

  var PALETTE = [
    '#2b5530', '#3a6b35', '#4f8347', '#7a9266', '#a9c194',
    '#c8902f', '#d9a441', '#efce9b', '#8b4513', '#a0522d',
    '#2f6e8c', '#5b8fa8', '#b5402f', '#d97742', '#6e3318'
  ];

  var instances = {};

  function setupDefaults() {
    if (!global.Chart) return;
    Chart.defaults.font.family = "'Spline Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5d6a59';
    Chart.defaults.borderColor = '#e4ddcd';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(31,61,34,0.95)';
    Chart.defaults.plugins.tooltip.titleFont = { family: "'Fraunces', serif", weight: '600', size: 13 };
    Chart.defaults.plugins.tooltip.bodyFont = { family: "'IBM Plex Mono', monospace", size: 12 };
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.boxPadding = 6;
    Chart.defaults.plugins.tooltip.titleColor = '#faf7f0';
    Chart.defaults.plugins.tooltip.bodyColor = '#efce9b';
  }

  function getCanvas(id) { var el = document.getElementById(id); return el; }

  function destroy(id) {
    if (instances[id]) { try { instances[id].destroy(); } catch (e) {} delete instances[id]; }
  }

  function render(id, config) {
    var el = getCanvas(id);
    if (!el) return null;
    destroy(id);
    setupDefaults();
    // 自适应高度
    if (config._height) { el.parentNode.style.height = config._height + 'px'; }
    var chart = new Chart(el.getContext('2d'), config);
    instances[id] = chart;
    return chart;
  }

  function color(i) { return PALETTE[i % PALETTE.length]; }
  function colorAlpha(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---------- 产量柱状图 ---------- */
  function yieldBar(id, data) {
    var config = {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: (data.datasets || []).map(function (ds, i) {
          return {
            label: ds.label,
            data: ds.values,
            backgroundColor: colorAlpha(color(i), 0.85),
            borderColor: color(i),
            borderWidth: 1.5,
            borderRadius: 5,
            borderSkipped: false,
            maxBarThickness: 42
          };
        })
      },
      options: baseOpts({
        unit: data.unit || '',
        showLegend: (data.datasets || []).length > 1,
        xStacked: false
      })
    };
    return render(id, config);
  }

  /* ---------- 折线图(品种跨站点表现) ---------- */
  function yieldLine(id, data) {
    var config = {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: (data.datasets || []).map(function (ds, i) {
          return {
            label: ds.label,
            data: ds.values,
            borderColor: color(i),
            backgroundColor: colorAlpha(color(i), 0.12),
            borderWidth: 2.2,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color(i),
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            fill: data.fill && i === 0
          };
        })
      },
      options: baseOpts({ unit: data.unit || '', showLegend: true })
    };
    return render(id, config);
  }

  /* ---------- 雷达图(多维农艺性状对比) ---------- */
  function radarCompare(id, data) {
    var config = {
      type: 'radar',
      data: {
        labels: data.labels,
        datasets: (data.datasets || []).map(function (ds, i) {
          return {
            label: ds.label,
            data: ds.values,
            borderColor: color(i),
            backgroundColor: colorAlpha(color(i), 0.18),
            borderWidth: 2,
            pointBackgroundColor: color(i),
            pointBorderColor: '#fff',
            pointRadius: 3.5,
            pointHoverRadius: 5
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: tooltipCb(data.unit || '')
        },
        scales: {
          r: {
            beginAtZero: true,
            grid: { color: '#e4ddcd' },
            angleLines: { color: '#e4ddcd' },
            pointLabels: { font: { size: 11, weight: '500' }, color: '#3d4a3a' },
            ticks: { backdropColor: 'transparent', font: { family: "'IBM Plex Mono', monospace", size: 9 }, color: '#828c7e' }
          }
        }
      }
    };
    return render(id, config);
  }

  /* ---------- 环形图(作物分布等) ---------- */
  function doughnut(id, data) {
    var config = {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: (data.colors || PALETTE).map(function (c, i) { return color(i); }),
          borderColor: '#faf7f0',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { padding: 12, font: { size: 12 } } },
          tooltip: tooltipCb(data.unit || '')
        }
      }
    };
    return render(id, config);
  }

  /* ---------- 稳定性散点(均值 vs Shukla方差) ---------- */
  function stabilityScatter(id, data) {
    var pts = data.points.map(function (p, i) {
      return { x: p.x, y: p.y, label: p.label, mean: p.mean, shukla: p.shukla, ideal: p.ideal };
    });
    var avgX = pts.reduce(function (s, p) { return s + p.x; }, 0) / (pts.length || 1);
    var avgY = pts.reduce(function (s, p) { return s + p.y; }, 0) / (pts.length || 1);
    var annotations = data.showQuadrant !== false ? [{
      type: 'line', xMin: avgX, xMax: avgX, borderColor: '#b3b9ad', borderDash: [5, 5], borderWidth: 1
    }, {
      type: 'line', yMin: avgY, yMax: avgY, borderColor: '#b3b9ad', borderDash: [5, 5], borderWidth: 1
    }] : [];
    var config = {
      type: 'scatter',
      data: {
        datasets: [{
          label: data.label || '品种',
          data: pts,
          backgroundColor: pts.map(function (p) { return p.ideal ? '#c8902f' : colorAlpha('#3a6b35', 0.7); }),
          borderColor: pts.map(function (p) { return p.ideal ? '#9c6a1d' : '#2b5530'; }),
          pointRadius: pts.map(function (p) { return p.ideal ? 9 : 6; }),
          pointHoverRadius: 10,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(31,61,34,0.95)', padding: 12, cornerRadius: 8,
            callbacks: {
              label: function (ctx) {
                var p = ctx.raw;
                return [p.label, '均值产量: ' + p.mean + ' ' + (data.unit || ''), '稳定性方差: ' + p.shukla];
              }
            }
          },
          datalabels: { display: true, anchor: 'end', align: 'top', font: { size: 10, weight: '500' }, color: '#3d4a3a', formatter: function (v) { return v.label; } }
        },
        scales: {
          x: { title: { display: true, text: data.xLabel || '均值产量', font: { weight: '600' } }, grid: { color: '#efe9da' }, ticks: { font: { family: "'IBM Plex Mono', monospace" } } },
          y: { title: { display: true, text: data.yLabel || 'Shukla稳定性方差', font: { weight: '600' } }, grid: { color: '#efe9da' }, ticks: { font: { family: "'IBM Plex Mono', monospace" } } }
        }
      }
    };
    return render(id, config);
  }

  /* ---------- GGE 双标图 ---------- */
  function ggeBiplot(id, data) {
    var genoDs = {
      label: '品种 (Genotype)',
      data: data.genoScores.map(function (s, i) { return { x: s[0], y: s[1] || 0, label: data.genoLabels[i], mean: data.genoMeans ? data.genoMeans[i] : null }; }),
      backgroundColor: colorAlpha('#2b5530', 0.7),
      borderColor: '#1f3d22',
      pointStyle: 'circle',
      pointRadius: 7,
      pointHoverRadius: 9,
      borderWidth: 2
    };
    var envDs = {
      label: '环境 (Environment)',
      data: data.envScores.map(function (s, i) { return { x: s[0], y: s[1] || 0, label: data.envLabels[i] }; }),
      backgroundColor: colorAlpha('#c8902f', 0.9),
      borderColor: '#8b4513',
      pointStyle: 'triangle',
      pointRadius: 9,
      pointHoverRadius: 11,
      borderWidth: 2
    };
    // 平均环境轴：从原点指向环境得分均值点
    var avgEnvX = data.envScores.reduce(function (s, p) { return s + p[0]; }, 0) / data.envScores.length;
    var avgEnvY = data.envScores.reduce(function (s, p) { return s + (p[1] || 0); }, 0) / data.envScores.length;
    var scale = 2.4;
    var avgLine = {
      label: '平均环境轴',
      data: [{ x: -avgEnvX * scale, y: -avgEnvY * scale }, { x: avgEnvX * scale, y: avgEnvY * scale }],
      type: 'line',
      borderColor: colorAlpha('#d97742', 0.6),
      borderWidth: 1.5,
      borderDash: [6, 5],
      pointRadius: 0,
      fill: false,
      tension: 0
    };
    var config = {
      type: 'scatter',
      data: { datasets: [avgLine, genoDs, envDs] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 1,
        plugins: {
          legend: { position: 'top', labels: { padding: 12, filter: function (item, data) { return item.datasetIndex > 0; } } },
          tooltip: {
            backgroundColor: 'rgba(31,61,34,0.95)', padding: 12, cornerRadius: 8,
            callbacks: {
              label: function (ctx) {
                var p = ctx.raw;
                if (!p.label) return null;
                var lines = [p.label];
                if (p.mean != null) lines.push('均值产量: ' + Math.round(p.mean * 100) / 100 + ' kg/亩');
                lines.push('PC1: ' + Math.round(p.x * 100) / 100 + '  PC2: ' + Math.round(p.y * 100) / 100);
                return lines;
              }
            }
          },
          datalabels: {
            display: true, anchor: 'end', align: 'top',
            font: { size: 10, weight: '500' },
            color: function (ctx) { return ctx.datasetIndex === 2 ? '#8b4513' : '#2b5530'; },
            formatter: function (v) { return v.label; }
          }
        },
        scales: {
          x: { title: { display: true, text: 'PC1 (' + (data.explained ? data.explained[0] : '') + '%)', font: { weight: '600' } }, grid: { color: '#efe9da', drawOnChartArea: true }, ticks: { font: { family: "'IBM Plex Mono', monospace", size: 10 } } },
          y: { title: { display: true, text: 'PC2 (' + (data.explained ? data.explained[1] : '') + '%)', font: { weight: '600' } }, grid: { color: '#efe9da' }, ticks: { font: { family: "'IBM Plex Mono', monospace", size: 10 } } }
        }
      }
    };
    return render(id, config);
  }

  /* ---------- 通用柱状(ANOVA SS / 产量分布等) ---------- */
  function horizontalBar(id, data) {
    var config = {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: data.label || '',
          data: data.values,
          backgroundColor: (data.values || []).map(function (_, i) { return colorAlpha(color(i), 0.85); }),
          borderColor: (data.values || []).map(function (_, i) { return color(i); }),
          borderWidth: 1.5,
          borderRadius: 5
        }]
      },
      options: Object.assign({}, baseOpts({ unit: data.unit || '', showLegend: false, horizontal: true }))
    };
    return render(id, config);
  }

  /* ---------- 基础选项工厂 ---------- */
  function baseOpts(opts) {
    opts = opts || {};
    var o = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: opts.horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: opts.showLegend !== false, position: 'top', align: 'end', labels: { padding: 12 } },
        tooltip: tooltipCb(opts.unit || '')
      },
      scales: {
        x: { stacked: !!opts.xStacked, grid: { display: !opts.horizontal, color: '#efe9da' }, ticks: { font: { family: "'IBM Plex Mono', monospace", size: 11 }, maxRotation: 45, minRotation: 0, autoSkip: true } },
        y: { stacked: !!opts.xStacked, grid: { color: '#efe9da' }, ticks: { font: { family: "'IBM Plex Mono', monospace", size: 11 } }, title: opts.unit ? { display: true, text: opts.unit, font: { size: 11 } } : {} }
      }
    };
    return o;
  }
  function tooltipCb(unit) {
    return {
      backgroundColor: 'rgba(31,61,34,0.95)', padding: 12, cornerRadius: 8, boxPadding: 6, usePointStyle: true,
      callbacks: {
        label: function (ctx) {
          var v = ctx.parsed.y !== undefined && ctx.parsed.y !== null ? ctx.parsed.y : (ctx.parsed.x !== undefined ? ctx.parsed.x : ctx.raw);
          var val = typeof v === 'number' ? Math.round(v * 100) / 100 : v;
          return ' ' + (ctx.dataset.label || ctx.label) + ': ' + val + (unit ? ' ' + unit : '');
        }
      }
    };
  }

  global.ChartRenderer = {
    PALETTE: PALETTE,
    color: color, colorAlpha: colorAlpha,
    setupDefaults: setupDefaults,
    destroy: destroy, destroyAll: function () { Object.keys(instances).forEach(destroy); },
    render: render,
    yieldBar: yieldBar, yieldLine: yieldLine, radarCompare: radarCompare,
    doughnut: doughnut, stabilityScatter: stabilityScatter,
    ggeBiplot: ggeBiplot, horizontalBar: horizontalBar
  };
})(window);
