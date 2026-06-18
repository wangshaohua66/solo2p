const DashboardPage = {
  render() {
    AppLayout.setPageHeader('数据概览', ['工作台']);
    const stats = MockData.stats;

    const html = `
      <div class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card primary">
            <div class="stat-card-icon">📦</div>
            <div class="stat-card-value">${stats.todaySamples}</div>
            <div class="stat-card-label">今日接收样品</div>
            <div class="stat-card-trend up">↑ 12.5% 较昨日</div>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card warning">
            <div class="stat-card-icon">📝</div>
            <div class="stat-card-value">${stats.totalTasks}</div>
            <div class="stat-card-label">进行中检测任务</div>
            <div class="stat-card-trend up">↑ 8.2% 较上周</div>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card success">
            <div class="stat-card-icon">📄</div>
            <div class="stat-card-value">${stats.pendingReports}</div>
            <div class="stat-card-label">待审核报告</div>
            <div class="stat-card-trend down">↓ 5.1% 较昨日</div>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card danger">
            <div class="stat-card-icon">📜</div>
            <div class="stat-card-value">${stats.expiringCerts}</div>
            <div class="stat-card-label">即将到期证书</div>
            <div class="stat-card-trend up">↑ 3 新增提醒</div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-8">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📈 月度检测趋势</h3>
              <div class="tag-filter-group">
                <span class="tag active">检测批次</span>
                <span class="tag">任务数</span>
                <span class="tag">收入</span>
              </div>
            </div>
            <div class="card-body">
              ${this.renderBarChart(stats.monthlyData)}
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">🏭 产品类别分布</h3>
            </div>
            <div class="card-body">
              ${this.renderPieChart(stats.categoryData)}
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">⏱️ 检测周期分布</h3>
            </div>
            <div class="card-body">
              ${this.renderCycleBars(stats.cycleData)}
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">🔔 最近动态</h3>
              <button class="btn btn-sm btn-outline-primary">查看全部</button>
            </div>
            <div class="card-body" style="padding:0;">
              <div class="timeline" style="padding:20px 20px 20px 44px;">
                ${MockData.notifications.slice(0, 4).map((n, i) => `
                  <div class="timeline-item ${i < 2 ? 'primary' : 'success'}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <div class="timeline-time">${n.time}</div>
                      <div class="timeline-title">${n.title}</div>
                      <div class="timeline-desc">${n.content}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  renderBarChart(data) {
    const max = Math.max(...data.map(d => d.samples));
    return `
      <div class="chart-container">
        <div class="chart-bar">
          ${data.map(d => {
            const h = (d.samples / max) * 100;
            return `
              <div class="chart-bar-item">
                <div class="chart-bar-value">${d.samples}</div>
                <div class="chart-bar-fill" style="height:${h}%;"></div>
                <div class="chart-bar-label">${d.month}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="chart-legend">
        <div class="chart-legend-item"><div class="chart-legend-color" style="background:var(--primary);"></div>检测批次</div>
      </div>
    `;
  },

  renderPieChart(data) {
    let cumulative = 0;
    const total = data.reduce((s, d) => s + d.value, 0);
    const segments = data.map(d => {
      const start = cumulative;
      cumulative += d.value;
      const end = cumulative;
      return { ...d, start, end };
    });

    const polarToCartesian = (cx, cy, r, angle) => {
      const rad = (angle - 90) * Math.PI / 180.0;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const describeArc = (cx, cy, r, startP, endP) => {
      const start = (startP / total) * 360;
      const end = (endP / total) * 360;
      const startAngle = polarToCartesian(cx, cy, r, end);
      const endAngle = polarToCartesian(cx, cy, r, start);
      const largeArc = end - start <= 180 ? 0 : 1;
      return `M ${cx} ${cy} L ${startAngle.x} ${startAngle.y} A ${r} ${r} 0 ${largeArc} 0 ${endAngle.x} ${endAngle.y} Z`;
    };

    return `
      <div style="display:flex;align-items:center;gap:24px;height:260px;">
        <svg width="180" height="180" viewBox="0 0 180 180">
          ${segments.map(s => `
            <path d="${describeArc(90, 90, 70, s.start, s.end)}" fill="${s.color}" opacity="0.9"/>
          `).join('')}
          <circle cx="90" cy="90" r="42" fill="#fff"/>
          <text x="90" y="86" text-anchor="middle" font-size="12" fill="#64748b">总计</text>
          <text x="90" y="104" text-anchor="middle" font-size="20" font-weight="700" fill="#1e293b">${total}</text>
        </svg>
        <div style="flex:1;">
          ${data.map(d => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
              <div class="chart-legend-item"><div class="chart-legend-color" style="background:${d.color};"></div>${d.name}</div>
              <div style="font-weight:600;color:var(--dark);">${d.value}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderCycleBars(data) {
    const max = Math.max(...data.map(d => d.percent));
    return data.map(d => {
      const color = d.range.includes('15') ? 'var(--danger)' : d.range.includes('8') ? 'var(--warning)' : 'var(--primary)';
      return `
        <div style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:var(--gray-600);">${d.range}</span>
            <span style="font-size:13px;font-weight:600;color:var(--dark);">${d.count}个 (${d.percent}%)</span>
          </div>
          <div class="progress" style="height:8px;">
            <div style="width:${d.percent}%;height:100%;background:${color};border-radius:4px;"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    $('.tag-filter-group .tag').on('click', function() {
      $(this).siblings().removeClass('active');
      $(this).addClass('active');
    });
  }
};

const TodoPage = {
  render() {
    AppLayout.setPageHeader('我的待办', ['工作台']);
    const tasks = [
      ...MockData.tasks.pending.map(t => ({ ...t, type: '待分配任务', due: t.deadline, action: 'assign' })),
      ...MockData.tasks.review.map(t => ({ ...t, type: '待审核任务', due: t.deadline, action: 'review' })),
      ...MockData.reports.filter(r => r.status === 'reviewing').map(r => ({ id: r.id, title: r.title, type: '待审核报告', due: r.createDate, action: 'approve' }))
    ];

    const html = `
      <div class="card">
        <div class="filter-bar">
          <div class="filter-group">
            <span style="font-size:13px;color:var(--gray-500);">类型筛选:</span>
            <span class="tag active">全部</span>
            <span class="tag">待分配任务</span>
            <span class="tag">待审核任务</span>
            <span class="tag">待审核报告</span>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>标题</th>
                <th>类型</th>
                <th>关联样品</th>
                <th>负责人</th>
                <th>截止日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(t => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${t.id}</td>
                  <td style="font-weight:500;">${t.title}</td>
                  <td><span class="badge badge-primary">${t.type}</span></td>
                  <td>${t.sample || '-'}</td>
                  <td>${t.assignee ? AppUtils.getAvatar(t.assignee) + ' ' + t.assignee : '-'}</td>
                  <td><span class="badge badge-warning">${t.due}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="处理" onclick="AppUtils.showToast('提示','正在打开待办...','success')">✏️</button>
                      <button class="action-btn" title="详情">👁️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
  }
};
