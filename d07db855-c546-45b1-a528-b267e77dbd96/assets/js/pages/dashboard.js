const DashboardPage = {
  render() {
    AppLayout.setPageHeader('数据概览', ['工作台']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    let stats = null;
    try {
      stats = await ApiClient.analytics.dashboardStats();
    } catch (e) {
      ApiClient.handleError(e, '加载仪表盘失败');
      $('#pageContent').html(AppUtils.renderEmpty('暂无统计数据，请确认后端服务已启动'));
      return;
    }
    stats = stats || {};
    const monthly = (stats.monthlyTrend || []).map(m => ({
      month: String(m.month || '').substring(5) || m.month,
      samples: Number(m.count || 0)
    }));
    const category = (stats.byCategory || []).map(c => ({
      name: c.name,
      value: Number(c.value || 0),
      color: UI_CONST.categoryColors[c.name] || '#94a3b8'
    }));
    const totalCat = category.reduce((s, c) => s + c.value, 0);
    category.forEach(c => c.percent = totalCat > 0 ? Math.round(c.value / totalCat * 100) : 0);

    const html = `
      <div class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card primary">
            <div class="stat-card-icon">📦</div>
            <div class="stat-card-value">${stats.totalSamples || 0}</div>
            <div class="stat-card-label">样品总量</div>
            <div class="stat-card-trend">数据库实时聚合</div>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card warning">
            <div class="stat-card-icon">📝</div>
            <div class="stat-card-value">${stats.pendingTasks || 0}</div>
            <div class="stat-card-label">进行中检测任务</div>
            <div class="stat-card-trend ${stats.overdueTasks > 0 ? 'up' : ''}">${stats.overdueTasks > 0 ? '⚠️ ' + stats.overdueTasks + '个超期' : '暂无超期'}</div>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card success">
            <div class="stat-card-icon">📄</div>
            <div class="stat-card-value">${stats.passReports || 0}</div>
            <div class="stat-card-label">合格检测报告</div>
            <div class="stat-card-trend">合格率 ${(stats.passRate || 0).toFixed(1)}%</div>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="stat-card danger">
            <div class="stat-card-icon">📜</div>
            <div class="stat-card-value">${stats.expiringCerts || 0}</div>
            <div class="stat-card-label">即将到期证书(60天内)</div>
            <div class="stat-card-trend">有效证书 ${stats.validCertificates || 0}</div>
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
              </div>
            </div>
            <div class="card-body">
              ${monthly.length ? this.renderBarChart(monthly) : AppUtils.renderEmpty('暂无月度数据')}
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">🏭 产品类别分布</h3>
            </div>
            <div class="card-body">
              ${category.length ? this.renderPieChart(category) : AppUtils.renderEmpty('暂无类别数据')}
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">⏱️ 检测周期概览</h3>
            </div>
            <div class="card-body">
              ${this.renderTurnaround(stats)}
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">🔔 最近动态</h3>
              <button class="btn btn-sm btn-outline-primary" id="dashViewAllNotif">查看全部</button>
            </div>
            <div class="card-body" style="padding:0;">
              <div class="timeline" style="padding:20px 20px 20px 44px;">
                ${(AppLayout.notifications || []).slice(0, 4).map((n, i) => `
                  <div class="timeline-item ${i < 2 ? 'primary' : 'success'}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <div class="timeline-time">${n.time}</div>
                      <div class="timeline-title">${n.title}</div>
                      <div class="timeline-desc">${n.content}</div>
                    </div>
                  </div>
                `).join('') || AppUtils.renderEmpty('暂无通知')}
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
    const max = Math.max(...data.map(d => d.samples), 1);
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
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
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
              <div style="font-weight:600;color:var(--dark);">${d.value} (${d.percent}%)</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderTurnaround(stats) {
    const days = stats.avgTurnaroundDays || 0;
    const passRate = stats.passRate || 0;
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="padding:18px;background:linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02));border-radius:10px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:var(--primary);">${days.toFixed(1)}</div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">平均检测周期(天)</div>
        </div>
        <div style="padding:18px;background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02));border-radius:10px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:var(--success);">${passRate.toFixed(1)}%</div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">报告合格率</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--gray-600);">超期任务：<span style="color:var(--danger);font-weight:600;">${stats.overdueTasks || 0}</span> 个 · 有效证书：<span style="font-weight:600;">${stats.validCertificates || 0}</span> 张 · 即将到期证书：<span style="color:var(--warning);font-weight:600;">${stats.expiringCerts || 0}</span> 张</div>
    `;
  },

  bindEvents() {
    $('.tag-filter-group .tag').on('click', function() {
      $(this).siblings().removeClass('active');
      $(this).addClass('active');
    });
    $('#dashViewAllNotif').on('click', () => AppLayout.showNotifications());
  }
};

const TodoPage = {
  render() {
    AppLayout.setPageHeader('我的待办', ['工作台']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    let tasks = [], reports = [];
    try {
      tasks = await ApiClient.task.list();
    } catch (e) { ApiClient.handleError(e, '加载任务失败'); }
    try {
      reports = await ApiClient.report.list();
    } catch (e) { /* ignore */ }

    tasks = tasks || [];
    reports = reports || [];
    const pending = tasks.filter(t => t.taskStatus === 'PENDING');
    const review = tasks.filter(t => t.taskStatus === 'REVIEW' || t.taskStatus === 'IN_PROGRESS');
    const reviewReports = reports.filter(r => r.reportStatus === 'REVIEW' || r.reportStatus === 'DRAFT');

    const rows = [
      ...pending.map(t => ({ id: t.taskCode, title: t.taskTitle, type: '待分配任务', sample: t.sampleCode, assignee: t.technicianName, due: t.deadline ? AppUtils.formatDate(AppUtils.parseDateTime(t.deadline)) : '-', action: 'assign' })),
      ...review.map(t => ({ id: t.taskCode, title: t.taskTitle, type: '待审核任务', sample: t.sampleCode, assignee: t.technicianName, due: t.deadline ? AppUtils.formatDate(AppUtils.parseDateTime(t.deadline)) : '-', action: 'review' })),
      ...reviewReports.map(r => ({ id: r.reportCode, title: r.reportTitle, type: '待审核报告', sample: r.sampleCode, assignee: r.authorName, due: r.createTime ? AppUtils.formatDateTime(r.createTime, 'YYYY-MM-DD') : '-', action: 'approve' }))
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
              ${rows.length ? rows.map(t => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${t.id || '-'}</td>
                  <td style="font-weight:500;">${t.title || '-'}</td>
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
              `).join('') : `<tr><td colspan="7">${AppUtils.renderEmpty('暂无待办事项')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
  }
};
