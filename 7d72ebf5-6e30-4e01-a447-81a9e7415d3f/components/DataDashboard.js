class DataDashboard extends BaseComponent {
  constructor() {
    super();
    this.charts = {};
    this.animationTimers = [];
  }

  async init() {
    this.state = {
      todayVisitors: 0,
      avgSatisfaction: 0,
      avgHandleTime: 0,
      windowsOnline: 0,
      visitorTrend: [],
      windowsLoad: [],
      satisfactionTrend: [],
      windowStatus: [],
      lastUpdate: null,
      chartLoaded: false
    };

    await this.loadChartJS();
    await this.loadData();
    this.startAutoRefresh();
  }

  async loadChartJS() {
    if (typeof Chart !== 'undefined') {
      this.state.chartLoaded = true;
      return;
    }
    await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
    this.state.chartLoaded = true;
  }

  async loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async loadData() {
    const result = await ApiService.getDashboardData();
    if (result.code === 200) {
      const data = result.data;
      const windowsData = await ApiService.getQueueStatus();
      const onlineCount = windowsData.code === 200
        ? windowsData.data.windows.filter(w => w.status === 'busy').length
        : 0;

      this.setState({
        todayVisitors: data.todayVisitors,
        avgSatisfaction: data.avgSatisfaction,
        avgHandleTime: data.avgHandleTime,
        windowsOnline: onlineCount,
        visitorTrend: data.visitorTrend,
        windowsLoad: data.windowsLoad,
        satisfactionTrend: data.satisfactionTrend,
        windowStatus: windowsData.code === 200 ? windowsData.data.windows.slice(0, 10) : [],
        lastUpdate: Date.now()
      });

      this.animateNumbers();
      this.updateCharts();
    }
  }

  animateNumbers() {
    this.animationTimers.forEach(t => this.clearTimer(t));
    this.animationTimers = [];

    const animate = (selector, target, suffix = '', duration = 1500) => {
      const el = this.query(selector);
      if (!el) return;
      const start = 0;
      const startTime = Date.now();
      const timer = this.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (target - start) * easeProgress);
        el.textContent = current + suffix;
        if (progress >= 1) {
          this.clearTimer(timer);
        }
      }, 16);
      this.animationTimers.push(timer);
    };

    requestAnimationFrame(() => {
      animate('.num-visitors', this.state.todayVisitors);
      animate('.num-satisfaction', this.state.avgSatisfaction, '');
      animate('.num-handletime', this.state.avgHandleTime, '');
      animate('.num-windows', this.state.windowsOnline);
    });
  }

  startAutoRefresh() {
    this.setInterval(() => {
      this.loadData();
    }, 30000);
  }

  updateCharts() {
    if (!this.state.chartLoaded || typeof Chart === 'undefined') return;
    requestAnimationFrame(() => {
      this.renderVisitorTrendChart();
      this.renderWindowLoadChart();
      this.renderSatisfactionTrendChart();
    });
  }

  getChartGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  }

  renderVisitorTrendChart() {
    const canvas = this.query('#visitorTrendChart');
    if (!canvas) return;

    if (this.charts.visitor) {
      this.charts.visitor.data.labels = this.state.visitorTrend.map(v => v.time);
      this.charts.visitor.data.datasets[0].data = this.state.visitorTrend.map(v => v.count);
      this.charts.visitor.update();
      return;
    }

    const ctx = canvas.getContext('2d');
    this.charts.visitor = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.state.visitorTrend.map(v => v.time),
        datasets: [{
          label: '人流量',
          data: this.state.visitorTrend.map(v => v.count),
          borderColor: '#667eea',
          backgroundColor: this.getChartGradient(ctx, 'rgba(102, 126, 234, 0.3)', 'rgba(102, 126, 234, 0.02)'),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#667eea',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleFont: { size: 14 },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `人流量: ${ctx.raw} 人`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#888', font: { size: 12 } }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { color: '#888', font: { size: 12 } },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  renderWindowLoadChart() {
    const canvas = this.query('#windowLoadChart');
    if (!canvas) return;

    if (this.charts.windowLoad) {
      this.charts.windowLoad.data.labels = this.state.windowsLoad.map(w => w.name);
      this.charts.windowLoad.data.datasets[0].data = this.state.windowsLoad.map(w => w.load);
      this.charts.windowLoad.update();
      return;
    }

    const ctx = canvas.getContext('2d');
    const colors = this.state.windowsLoad.map((_, i) => {
      const hues = [220, 150, 280, 30, 45, 200, 350, 180, 90];
      return `hsl(${hues[i % hues.length]}, 70%, 60%)`;
    });

    this.charts.windowLoad = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.state.windowsLoad.map(w => w.name),
        datasets: [{
          label: '负载率',
          data: this.state.windowsLoad.map(w => w.load),
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 30
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `负载率: ${ctx.raw}%`
            }
          }
        },
        scales: {
          x: {
            max: 100,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              color: '#888',
              callback: (v) => v + '%'
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#555', font: { size: 11 } }
          }
        }
      },
      plugins: [{
        id: 'datalabels',
        afterDatasetsDraw: (chart) => {
          const ctx = chart.ctx;
          chart.data.datasets[0].data.forEach((value, i) => {
            const meta = chart.getDatasetMeta(0);
            const bar = meta.data[i];
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(value + '%', bar.x - 8, bar.y);
            ctx.restore();
          });
        }
      }]
    });
  }

  renderSatisfactionTrendChart() {
    const canvas = this.query('#satisfactionTrendChart');
    if (!canvas) return;

    if (this.charts.satisfaction) {
      this.charts.satisfaction.data.labels = this.state.satisfactionTrend.map(s => s.date);
      this.charts.satisfaction.data.datasets[0].data = this.state.satisfactionTrend.map(s => s.score);
      this.charts.satisfaction.update();
      return;
    }

    const ctx = canvas.getContext('2d');
    this.charts.satisfaction = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.state.satisfactionTrend.map(s => s.date),
        datasets: [{
          label: '满意度',
          data: this.state.satisfactionTrend.map(s => s.score),
          borderColor: '#11998e',
          backgroundColor: this.getChartGradient(ctx, 'rgba(17, 153, 142, 0.3)', 'rgba(17, 153, 142, 0.02)'),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#11998e',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `满意度: ${ctx.raw} 分`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#888', font: { size: 12 } }
          },
          y: {
            min: 3,
            max: 5,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              color: '#888',
              stepSize: 0.5,
              callback: (v) => v + '分'
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  handleExport() {
    const data = {
      导出时间: window.DateUtils?.formatDateTime(Date.now()) || new Date().toLocaleString(),
      今日总人流量: this.state.todayVisitors,
      平均满意度: this.state.avgSatisfaction + '分',
      平均办理时效: this.state.avgHandleTime + '分钟',
      窗口在线数: this.state.windowsOnline,
      各时段人流量: this.state.visitorTrend,
      窗口负载: this.state.windowsLoad,
      近7天满意度: this.state.satisfactionTrend
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `数据报表_${window.DateUtils?.formatDate(Date.now()) || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  destroy() {
    super.destroy();
    Object.values(this.charts).forEach(chart => chart?.destroy());
  }

  getStyles() {
    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :host {
          display: block;
          width: 100%;
          min-height: 100vh;
          background: #f0f2f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .dashboard-container {
          padding: 20px;
          max-width: 1600px;
          margin: 0 auto;
        }
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .dashboard-title {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a2e;
        }
        .dashboard-subtitle {
          font-size: 13px;
          color: #888;
          margin-top: 4px;
        }
        .export-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .export-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(102, 126, 234, 0.4);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
        }
        .stat-card:nth-child(1)::before { background: linear-gradient(180deg, #667eea, #764ba2); }
        .stat-card:nth-child(2)::before { background: linear-gradient(180deg, #11998e, #38ef7d); }
        .stat-card:nth-child(3)::before { background: linear-gradient(180deg, #f093fb, #f5576c); }
        .stat-card:nth-child(4)::before { background: linear-gradient(180deg, #4facfe, #00f2fe); }
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        .stat-icon.blue { background: linear-gradient(135deg, rgba(102,126,234,0.2), rgba(118,75,162,0.2)); color: #667eea; }
        .stat-icon.green { background: linear-gradient(135deg, rgba(17,153,142,0.2), rgba(56,239,125,0.2)); color: #11998e; }
        .stat-icon.orange { background: linear-gradient(135deg, rgba(240,147,251,0.2), rgba(245,87,108,0.2)); color: #f5576c; }
        .stat-icon.cyan { background: linear-gradient(135deg, rgba(79,172,254,0.2), rgba(0,242,254,0.2)); color: #4facfe; }
        .stat-content {
          flex: 1;
        }
        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #1a1a2e;
          line-height: 1.2;
        }
        .stat-value.small {
          font-size: 28px;
        }
        .stat-label {
          font-size: 13px;
          color: #888;
          margin-top: 6px;
        }
        .trend-indicator {
          position: absolute;
          top: 20px;
          right: 20px;
          font-size: 12px;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 600;
        }
        .trend-up { background: rgba(17,153,142,0.1); color: #11998e; }
        .trend-down { background: rgba(245,87,108,0.1); color: #f5576c; }
        .charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        .chart-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .chart-title {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a2e;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chart-badge {
          font-size: 11px;
          padding: 3px 8px;
          background: rgba(102,126,234,0.1);
          color: #667eea;
          border-radius: 10px;
          font-weight: 600;
        }
        .chart-container {
          height: 280px;
          position: relative;
        }
        .bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .monitor-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .monitor-list {
          max-height: 280px;
          overflow-y: auto;
        }
        .monitor-item {
          display: flex;
          align-items: center;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
          transition: background 0.2s;
        }
        .monitor-item:hover {
          background: #f8f9fa;
        }
        .window-status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .window-status-dot.busy {
          background: #11998e;
          box-shadow: 0 0 0 3px rgba(17,153,142,0.2);
          animation: pulse 2s infinite;
        }
        .window-status-dot.idle {
          background: #ccc;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .window-info {
          flex: 1;
        }
        .window-name {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }
        .window-item {
          font-size: 12px;
          color: #888;
          margin-top: 2px;
        }
        .window-number-badge {
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 6px;
        }
        .refresh-info {
          font-size: 12px;
          color: #999;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .refresh-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #11998e;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .charts-grid { grid-template-columns: 1fr; }
          .bottom-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .stats-grid { grid-template-columns: 1fr; }
          .stat-value { font-size: 26px; }
        }
      </style>
    `;
  }

  renderStatsGrid() {
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">👥</div>
          <div class="stat-content">
            <div class="stat-value num-visitors">0</div>
            <div class="stat-label">今日总人流量</div>
          </div>
          <span class="trend-indicator trend-up">↑ 12%</span>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">⭐</div>
          <div class="stat-content">
            <div class="stat-value num-satisfaction small">0.0</div>
            <div class="stat-label">平均满意度</div>
          </div>
          <span class="trend-indicator trend-up">↑ 0.2</span>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">⏱️</div>
          <div class="stat-content">
            <div class="stat-value num-handletime small">0</div>
            <div class="stat-label">平均办理时效(分钟)</div>
          </div>
          <span class="trend-indicator trend-down">↓ 8%</span>
        </div>
        <div class="stat-card">
          <div class="stat-icon cyan">🪟</div>
          <div class="stat-content">
            <div class="stat-value num-windows">0</div>
            <div class="stat-label">窗口在线数</div>
          </div>
          <span class="trend-indicator trend-up">↑ 3</span>
        </div>
      </div>
    `;
  }

  renderMonitorList() {
    return this.state.windowStatus.map(w => `
      <div class="monitor-item">
        <div class="window-status-dot ${w.status}"></div>
        <div class="window-info">
          <div class="window-name">${this.escapeHtml(w.name)}</div>
          <div class="window-item">
            ${w.status === 'busy' ? `办理中: ${this.escapeHtml(w.currentNumber || '-')}` : '空闲中'}
          </div>
        </div>
        ${w.status === 'busy' ? `<span class="window-number-badge">${this.escapeHtml(w.currentNumber || '-')}</span>` : ''}
      </div>
    `).join('');
  }

  render() {
    this.shadowRoot.innerHTML = this.getStyles() + `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <div>
            <h1 class="dashboard-title">📊 数据看板</h1>
            <p class="dashboard-subtitle">实时监控大厅运营数据</p>
          </div>
          <div style="display:flex;align-items:center;gap:16px;">
            <span class="refresh-info">
              <span class="refresh-dot"></span>
              每30秒自动刷新
            </span>
            <button class="export-btn" onclick="this.getRootNode().host.handleExport()">
              📥 导出报表
            </button>
          </div>
        </div>

        ${this.renderStatsGrid()}

        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-header">
              <span class="chart-title">📈 人流量趋势图</span>
              <span class="chart-badge">今日</span>
            </div>
            <div class="chart-container">
              <canvas id="visitorTrendChart"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-header">
              <span class="chart-title">📊 窗口负载</span>
              <span class="chart-badge">实时</span>
            </div>
            <div class="chart-container">
              <canvas id="windowLoadChart"></canvas>
            </div>
          </div>
        </div>

        <div class="bottom-grid">
          <div class="chart-card">
            <div class="chart-header">
              <span class="chart-title">😊 满意度趋势</span>
              <span class="chart-badge">近7天</span>
            </div>
            <div class="chart-container">
              <canvas id="satisfactionTrendChart"></canvas>
            </div>
          </div>
          <div class="monitor-card">
            <div class="chart-header">
              <span class="chart-title">🎥 实时监控</span>
              <span class="chart-badge">${this.state.windowStatus.length} 个窗口</span>
            </div>
            <div class="monitor-list">
              ${this.renderMonitorList()}
            </div>
          </div>
        </div>
      </div>
    `;

    if (this.state.chartLoaded) {
      this.updateCharts();
    }
  }
}

customElements.define('data-dashboard', DataDashboard);
window.DataDashboard = DataDashboard;
