const TasksPage = {
  render() {
    AppLayout.setPageHeader('检测任务', ['业务管理']);

    const html = `
      <div class="card" style="background:transparent;border:none;box-shadow:none;">
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
          <div class="tag-filter-group">
            <span class="tag active">全部 (${this.totalCount()})</span>
            <span class="tag">待分配</span>
            <span class="tag">进行中</span>
            <span class="tag">待审核</span>
            <span class="tag">已完成</span>
          </div>
          <div style="flex:1;"></div>
          <button class="btn btn-primary" id="autoDispatchBtn">🤖 智能调度</button>
          <button class="btn btn-outline-primary">📊 资源分配</button>
          <button class="btn btn-outline-primary">📥 导入任务</button>
        </div>

        <div class="kanban-board" id="kanbanBoard">
          ${this.renderKanbanColumn('待分配', 'pending', MockData.tasks.pending, 'var(--warning)')}
          ${this.renderKanbanColumn('进行中', 'inProgress', MockData.tasks.inProgress, 'var(--primary)')}
          ${this.renderKanbanColumn('待审核', 'review', MockData.tasks.review, 'var(--warning)')}
          ${this.renderKanbanColumn('已完成', 'completed', MockData.tasks.completed, 'var(--success)')}
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  totalCount() {
    const t = MockData.tasks;
    return t.pending.length + t.inProgress.length + t.review.length + t.completed.length;
  },

  renderKanbanColumn(title, key, tasks, color) {
    return `
      <div class="kanban-column" data-status="${key}">
        <div class="kanban-column-header">
          <div class="kanban-column-title" style="color:${color};">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>
            ${title}
          </div>
          <span class="kanban-column-count">${tasks.length}</span>
        </div>
        <div class="kanban-cards">
          ${tasks.map(t => this.renderKanbanCard(t, color)).join('')}
          ${tasks.length === 0 ? '<div class="empty-state" style="padding:24px 0;color:var(--gray-300);"><div style="font-size:32px;">📭</div><div>暂无任务</div></div>' : ''}
        </div>
      </div>
    `;
  },

  renderKanbanCard(task, color) {
    const priorityMap = { high: 'badge-danger', medium: 'badge-warning', normal: 'badge-secondary' };
    const progressColor = task.progress >= 80 ? 'success' : task.progress >= 50 ? 'warning' : '';
    return `
      <div class="kanban-card" draggable="true" data-id="${task.id}">
        <div class="kanban-card-title">${task.title}</div>
        <div style="margin-bottom:8px;font-size:12px;color:var(--gray-500);font-family:monospace;">${task.id}
        </div>
        <div class="kanban-card-meta">
          <div>${AppUtils.getAvatar(task.assignee)} ${task.assignee}</div>
          <span class="badge ${priorityMap[task.priority]}">${task.priority === 'high' ? '高优' : task.priority === 'medium' ? '中优' : '普通'}</span>
        </div>
        ${task.progress > 0 ? `<div class="progress"><div class="progress-bar ${progressColor}" style="width:${task.progress}%;"></div></div><div style="font-size:11px;color:var(--gray-500);margin-top:4px;text-align:right;">${task.progress}%</div>` : ''}
        <div class="kanban-card-tags">
          ${task.tags.map(tag => `<span class="badge badge-secondary">${tag}</span>`).join('')}
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--gray-400);display:flex;justify-content:space-between;align-items:center;">
          <span>📅 截止: ${task.deadline}</span>
          <span style="color:var(--gray-400);">📦 ${task.sample}</span>
        </div>
      </div>
    `;
  },

  bindEvents() {
    $('#autoDispatchBtn').on('click', () => {
      AppUtils.showToast('智能调度', '正在根据设备负载与人员专长自动分配...', 'success');
    });

    let dragId = null;

    $(document).on('dragstart', '.kanban-card', function(e) {
      dragId = $(this).data('id');
      $(this).css('opacity', '0.5');
    }).on('dragend', '.kanban-card', function() {
      $(this).css('opacity', '1');
    });

    $(document).on('dragover', '.kanban-column', function(e) {
      e.preventDefault();
      $(this).css('background', 'rgba(37,99,235,0.08)');
    }).on('dragleave', '.kanban-column', function() {
      $(this).css('background', '');
    }).on('drop', '.kanban-column', function(e) {
      e.preventDefault();
      $(this).css('background', '');
      const newStatus = $(this).data('status');
      AppUtils.showToast('任务状态已更新', `任务 ${dragId} 已移动至 ${$(this).find('.kanban-column-title').text().trim()}`, 'success');
    });
  }
};

const ReportsPage = {
  render() {
    AppLayout.setPageHeader('报告与证书', ['业务管理']);
    const reports = MockData.reports;
    const certs = MockData.certificates;

    const getReportStatus = (s) => {
      const map = { draft: { class: 'badge-secondary', text: '草稿' }, reviewing: { class: 'badge-warning', text: '审核中' }, issued: { class: 'badge-success', text: '已签发' } };
      const m = map[s] || map.draft;
      return `<span class="badge ${m.class}">${m.text}</span>`;
    };

    const getCertStatus = (s) => {
      const map = { valid: { class: 'badge-success', text: '有效' }, expiring: { class: 'badge-warning', text: '即将到期' }, expired: { class: 'badge-danger', text: '已过期' } };
      const m = map[s] || map.valid;
      return `<span class="badge ${m.class}">${m.text}</span>`;
    };

    const renderCertType = (type) => {
      const map = { CCC: 'badge-danger', CE: 'badge-primary', ISO: 'badge-success' };
      return `<span class="badge ${map[type] || 'badge-secondary'}">${type}</span>`;
    };

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">📄 检测报告</h3>
          <div>
            <button class="btn btn-primary btn-sm" id="genReportBtn">➕ 生成报告</button>
            <button class="btn btn-outline-primary btn-sm">📚 模板管理</button>
          </div>
        </div>
        <div class="filter-bar">
          <select class="form-control" style="width:140px;">
          <option value="">全部状态</option>
          <option>草稿</option>
          <option>审核中</option>
          <option>已签发</option>
          </select>
          <select class="form-control" style="width:120px;">
          <option value="">认证类型</option>
          <option>CCC</option>
          <option>CE</option>
          <option>ISO</option>
          </select>
          <input type="text" class="form-control" placeholder="搜索报告编号" style="width:200px;">
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>报告编号</th>
                <th>报告标题</th>
                <th>企业名称</th>
                <th>认证类型</th>
                <th>编制人</th>
                <th>版本</th>
                <th>页数</th>
                <th>创建日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${reports.map(r => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${r.id}</td>
                  <td style="font-weight:500;">${r.title}</td>
                  <td>${r.company}</td>
                  <td>${renderCertType(r.certType)}</td>
                  <td>${r.author}</td>
                  <td><span class="badge badge-info">${r.version}</span></td>
                  <td>${r.pages} 页</td>
                  <td>${r.createDate}</td>
                  <td>${getReportStatus(r.status)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="预览" data-action="preview" data-id="${r.id}">👁️</button>
                      <button class="action-btn" title="编辑" data-action="edit">✏️</button>
                      <button class="action-btn" title="下载">📥</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📜 认证证书</h3>
          <div>
            <button class="btn btn-primary btn-sm" id="genCertBtn">➕ 签发证书</button>
            <button class="btn btn-outline-primary btn-sm">🖨️ 批量打印</button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>证书编号</th>
                <th>获证企业</th>
                <th>产品名称</th>
                <th>认证类型</th>
                <th>依据标准</th>
                <th>发证日期</th>
                <th>到期日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${certs.map(c => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${c.certNo}</td>
                  <td>${c.company}</td>
                  <td>${c.product}</td>
                  <td>${renderCertType(c.certType)}</td>
                  <td style="font-size:13px;">${c.standard}</td>
                  <td>${c.issueDate}</td>
                  <td class="${c.status !== 'valid' ? 'cert-date-expiring' : ''}">${c.expireDate}</td>
                  <td>${getCertStatus(c.status)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="查看" data-action="viewCert" data-id="${c.id}">👁️</button>
                      <button class="action-btn" title="续期提醒">🔔</button>
                      <button class="action-btn danger" title="撤销">⛔</button>
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
    this.bindEvents();
  },

  bindEvents() {
    $('#genReportBtn').on('click', () => {
      AppUtils.showToast('生成报告', '正在根据检测数据自动生成报告...', 'success');
    });

    $('body').on('click', '[data-action="preview"]', function() {
      ReportsPage.showReportPreview($(this).data('id'));
    });

    $('body').on('click', '[data-action="viewCert"]', function() {
      ReportsPage.showCertPreview($(this).data('id'));
    });
  },

  showReportPreview(id) {
    const r = MockData.reports.find(x => x.id === id) || MockData.reports[0];
    const content = `
      <div class="pdf-preview">
        <div class="pdf-page">
          <div class="pdf-header">
          <div class="pdf-title">检测报告</div>
          <div class="pdf-subtitle">TESTING REPORT</div>
          <div style="margin-top:12px;font-family:monospace;font-size:14px;color:var(--gray-500);">报告编号: ${r.id}</div>
        </div>
          <div class="pdf-info-row"><div class="pdf-info-label">委托单位</div><div class="pdf-info-value">${r.company}</div></div>
          <div class="pdf-info-row"><div class="pdf-info-label">样品名称</div><div class="pdf-info-value">${r.title.replace('检测报告', '')}</div></div>
          <div class="pdf-info-row"><div class="pdf-info-label">认证类型</div><div class="pdf-info-value">${r.certType} 认证</div></div>
          <div class="pdf-info-row"><div class="pdf-info-label">检测依据</div><div class="pdf-info-value">GB 7251.1-2013 / IEC 61439-1:2011</div></div>
          <div class="pdf-info-row"><div class="pdf-info-label">检测日期</div><div class="pdf-info-value">2026-06-10 至 2026-06-15</div></div>
          <div class="pdf-info-row"><div class="pdf-info-label">报告签发</div><div class="pdf-info-value">${r.createDate}</div></div>
          <div class="pdf-section-title">检测结论</div>
          <div style="padding:16px;background:var(--gray-50);border-radius:8px;">
            <div style="font-size:16px;font-weight:600;color:var(--success);margin-bottom:8px;">✓ 合格 PASS</div>
            <div style="font-size:13px;color:var(--gray-600);line-height:1.8;">
              依据相关标准及委托方提供的技术要求，对送检样品进行了全项检测，所检项目符合标准要求。
            </div>
          </div>
          <div class="pdf-section-title">检测项目结果</div>
          <table style="width:100%;font-size:13px;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--gray-50);">
                <th style="padding:10px;text-align:left;border-bottom:1px solid var(--gray-200);">检测项目</th>
                <th style="padding:10px;text-align:left;border-bottom:1px solid var(--gray-200);">标准要求</th>
                <th style="padding:10px;text-align:left;border-bottom:1px solid var(--gray-200);">检测结果</th>
                <th style="padding:10px;text-align:left;border-bottom:1px solid var(--gray-200);">单项判定</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:10px;border-bottom:1px solid var(--gray-100);">介电强度</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);">2000V AC 1min</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);">无击穿、闪络</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);color:var(--success);">合格</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid var(--gray-100);">温升试验</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);">≤70K</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);">45K</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);color:var(--success);">合格</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid var(--gray-100);">绝缘电阻</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);">≥100MΩ</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);">520MΩ</td><td style="padding:10px;border-bottom:1px solid var(--gray-100);color:var(--success);">合格</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    AppUtils.showModal({ title: '📄 报告预览', content, width: '760px', confirmText: '下载PDF' });
  },

  showCertPreview(id) {
    const c = MockData.certificates.find(x => x.id === id) || MockData.certificates[0];
    const content = `
      <div style="padding:30px;background:linear-gradient(135deg,#fef3c7,#fefce8);border-radius:12px;border:2px solid #fcd34d;">
        <div style="text-align:center;">
          <div style="font-size:14px;letter-spacing:4px;color:var(--gray-600);">${c.certType} 认 证 证 书</div>
          <div style="font-size:28px;font-weight:700;margin-top:8px;color:var(--dark);">CERTIFICATE</div>
          <div style="font-family:monospace;margin-top:16px;padding:8px 16px;background:rgba(255,255,255,0.6);display:inline-block;border-radius:8px;font-weight:600;">证书编号：${c.certNo}</div>
        </div>
        <div style="margin-top:28px;padding:24px;background:#fff;border-radius:10px;">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">获证企业</div>
            <div style="flex:1;font-weight:600;">${c.company}</div>
          </div>
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">产品名称</div>
            <div style="flex:1;font-weight:600;">${c.product}</div>
          </div>
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">认证依据</div>
            <div style="flex:1;">${c.standard}</div>
          </div>
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">发证日期</div>
            <div style="flex:1;">${c.issueDate}</div>
          </div>
          <div style="padding:12px 0;display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">有效期至</div>
            <div style="flex:1;font-weight:600;color:${c.status !== 'valid' ? 'var(--danger)' : 'var(--dark)'};">${c.expireDate}</div>
          </div>
        </div>
        <div style="margin-top:24px;text-align:right;">
          <div style="font-family:STKaiti;font-size:28px;color:var(--primary);">✓</div>
          <div style="margin-top:4px;font-size:13px;color:var(--gray-500);">某某认证中心</div>
          <div style="font-size:13px;color:var(--gray-400);">签发日期：${c.issueDate}</div>
        </div>
      </div>
    `;
    AppUtils.showModal({ title: '📜 证书详情', content, width: '560px', confirmText: '打印证书' });
  }
};

const CustomersPage = {
  render() {
    AppLayout.setPageHeader('客户服务', ['业务管理']);
    const customers = MockData.customers;
    const applications = MockData.applications;

    const getLevelBadge = (l) => {
      const map = { A: 'badge-danger', B: 'badge-primary', C: 'badge-secondary' };
      return `<span class="badge ${map[l] || 'badge-secondary'}">${l}级客户</span>`;
    };

    const getAppStatus = (s) => {
      const map = { pending: 'badge-warning', approved: 'badge-primary', processing: 'badge-info', completed: 'badge-success' };
      const text = { pending: '待审核', approved: '已通过', processing: '处理中', completed: '已完成' };
      return `<span class="badge ${map[s]}">${text[s]}</span>`;
    };

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🏢 企业客户</h3>
          <button class="btn btn-primary btn-sm">➕ 新增客户</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>企业名称</th>
                <th>联系人</th>
                <th>联系电话</th>
                <th>统一社会信用代码</th>
                <th>主营类别</th>
                <th>持有证书</th>
                <th>历史订单</th>
                <th>客户等级</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${customers.map(c => `
                <tr>
                  <td style="font-weight:500;">${c.name}</td>
                  <td>${c.contact}</td>
                  <td>${c.phone}</td>
                  <td style="font-family:monospace;font-size:12px;">${c.creditCode}</td>
                  <td><span class="badge badge-secondary">${c.category}</span></td>
                  <td style="text-align:center;font-weight:600;">${c.certCount}</td>
                  <td style="text-align:center;">${c.totalOrders}</td>
                  <td>${getLevelBadge(c.level)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn">👁️</button>
                      <button class="action-btn">✏️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📋 在线申请</h3>
          <button class="btn btn-outline-primary btn-sm">📤 导出</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>申请编号</th>
                <th>企业名称</th>
                <th>产品名称</th>
                <th>认证类型</th>
                <th>样品数量</th>
                <th>申请日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${applications.map(a => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${a.id}</td>
                  <td>${a.company}</td>
                  <td style="font-weight:500;">${a.product}</td>
                  <td>${a.certType}</td>
                  <td>${a.amount} 件</td>
                  <td>${a.submitDate}</td>
                  <td>${getAppStatus(a.status)}</td>
                  <td>
                    <div class="table-actions">
                      ${a.status === 'pending' ? `<button class="action-btn" title="审核" style="color:var(--success);">✓</button>` : ''}
                      <button class="action-btn">👁️</button>
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
