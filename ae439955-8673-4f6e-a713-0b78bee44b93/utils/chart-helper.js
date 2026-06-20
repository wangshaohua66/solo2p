(function(global) {
  'use strict';

  const charts = {};

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } }
    }
  };

  const ChartHelper = {
    destroy(id) {
      if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
      }
    },

    destroyAll() {
      Object.keys(charts).forEach(id => this.destroy(id));
    },

    line(ctx, config) {
      this.destroy(ctx.canvas ? ctx.canvas.id : ctx);
      const hasDualAxis = (config.datasets || []).some(ds => ds.yAxisID);
      const scales = {
        x: { grid: { display: false } }
      };
      if (hasDualAxis) {
        scales.y = {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: config.beginAtZero !== false,
          suggestedMin: config.suggestedMin,
          suggestedMax: config.suggestedMax || 100,
          title: { display: true, text: config.yLabel || '' }
        };
        scales.y1 = {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: config.beginAtZeroY1 !== false,
          suggestedMin: config.suggestedMinY1,
          suggestedMax: config.suggestedMaxY1 || 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: config.y1Label || '' }
        };
      } else {
        scales.y = {
          beginAtZero: config.beginAtZero !== false,
          suggestedMin: config.suggestedMin,
          suggestedMax: config.suggestedMax || 100
        };
      }
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: config.labels || [],
          datasets: (config.datasets || []).map(ds => ({
            borderColor: ds.color || '#0d6efd',
            backgroundColor: (ds.color || '#0d6efd') + '22',
            tension: 0.3,
            fill: ds.fill !== false,
            pointRadius: 4,
            pointHoverRadius: 6,
            ...ds
          }))
        },
        options: {
          ...defaultOptions,
          scales
        }
      });
      charts[ctx.canvas ? ctx.canvas.id : ctx] = chart;
      return chart;
    },

    bar(ctx, config) {
      this.destroy(ctx.canvas ? ctx.canvas.id : ctx);
      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: config.labels || [],
          datasets: (config.datasets || []).map((ds, i) => ({
            backgroundColor: ds.color || ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1'][i % 5],
            borderRadius: 4,
            ...ds
          }))
        },
        options: {
          ...defaultOptions,
          scales: {
            y: { beginAtZero: true },
            x: { grid: { display: false } }
          }
        }
      });
      charts[ctx.canvas ? ctx.canvas.id : ctx] = chart;
      return chart;
    },

    doughnut(ctx, config) {
      this.destroy(ctx.canvas ? ctx.canvas.id : ctx);
      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: config.labels || [],
          datasets: [{
            data: config.data || [],
            backgroundColor: config.colors || ['#198754', '#ffc107', '#0d6efd', '#dc3545', '#6c757d'],
            borderWidth: 0
          }]
        },
        options: {
          ...defaultOptions,
          cutout: '60%',
          plugins: {
            legend: { position: 'right', labels: { usePointStyle: true, padding: 12, font: { size: 12 } } }
          }
        }
      });
      charts[ctx.canvas ? ctx.canvas.id : ctx] = chart;
      return chart;
    },

    buildTastingTrend(tastings) {
      const sorted = (tastings || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        labels: sorted.map(t => t.date),
        datasets: [
          { label: '综合评分', data: sorted.map(t => t.overall), color: '#0d6efd' },
          { label: '香气质', data: sorted.map(t => t.scores.aromaQuality), color: '#198754', fill: false },
          { label: '香气量', data: sorted.map(t => t.scores.aromaAmount), color: '#ffc107', fill: false },
          { label: '杂气', data: sorted.map(t => t.scores.impurity), color: '#6f42c1', fill: false },
          { label: '余味', data: sorted.map(t => t.scores.aftertaste), color: '#fd7e14', fill: false },
          { label: '刺激性', data: sorted.map(t => t.scores.irritation), color: '#dc3545', fill: false }
        ]
      };
    },

    buildInspectionTrend(inspections) {
      const sorted = (inspections || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-30);
      return {
        labels: sorted.map(i => i.date),
        datasets: [
          { label: '温度(℃)', data: sorted.map(i => i.temperature), color: '#dc3545', yAxisID: 'y' },
          { label: '湿度(%)', data: sorted.map(i => i.humidity), color: '#0d6efd', yAxisID: 'y1' }
        ]
      };
    }
  };

  global.ChartHelper = ChartHelper;
})(window);
