(function(global) {
  'use strict';

  const LEGO_COLORS = [
    '#E3000B', '#FFD700', '#0055BF', '#237841', '#FF8200',
    '#9B0000', '#FECC33', '#003A91', '#05592C', '#DA6400',
    '#7B0052', '#1B2A34', '#F5F5F5', '#2C2C2C', '#A0A0A0',
    '#FF69B4', '#8B4513', '#32CD32', '#6A5ACD', '#FF6347'
  ];

  function baseOptions() {
    const theme = document.documentElement.getAttribute('data-bs-theme') || 'light';
    const textColor = theme === 'dark' ? '#F0F0F0' : '#1A1A1A';
    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { family: "'Inter', sans-serif", size: 12 },
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(26,26,26,0.95)',
          titleFont: { family: "'Inter', sans-serif", size: 13, weight: '600' },
          bodyFont: { family: "'Inter', sans-serif", size: 12 },
          padding: 10,
          cornerRadius: 6,
          displayColors: true
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor }
        }
      }
    };
  }

  function pie(canvasId, data, opts) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: data.colors || LEGO_COLORS,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.9)',
          hoverOffset: 8
        }]
      },
      options: $.extend(true, baseOptions(), {
        cutout: '65%',
        scales: { x: { display: false }, y: { display: false } },
        plugins: {
          legend: { position: 'right' }
        }
      }, opts || {})
    });
  }

  function bar(canvasId, data, opts) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: data.label || '数量',
          data: data.values,
          backgroundColor: data.colors || LEGO_COLORS.slice(0, (data.values || []).length),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 48
        }]
      },
      options: $.extend(true, baseOptions(), {
        plugins: { legend: { display: false } }
      }, opts || {})
    });
  }

  function line(canvasId, data, opts) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: (data.datasets || [{
          label: data.label || '趋势',
          data: data.values,
          borderColor: '#E3000B',
          backgroundColor: 'rgba(227,0,11,0.08)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#E3000B',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }])
      },
      options: $.extend(true, baseOptions(), opts || {})
    });
  }

  global.BVChart = { pie, bar, line, COLORS: LEGO_COLORS };
})(window);
