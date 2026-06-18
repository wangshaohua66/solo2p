/**
 * 检测任务看板、报告证书管理、客户服务页面。
 * 全部数据通过 ApiClient 调用后端 REST API 获取，无任何硬编码 Mock 数据。
 */
const TasksPage = {
  tasks: [],

  render() {
    AppLayout.setPageHeader('检测任务', ['业务管理']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    try {
      this.tasks = await ApiClient.task.list() || [];
    } catch (e) {
      ApiClient.handleError(e, '加载任务列表失败');
      $('#pageContent').html(AppUtils.renderEmpty('任务列表加载失败，请确认后端服务已启动'));
      return;
    }
    this.renderPage();
  },

  groupedTasks() {
    const byStatus = (s) => (this.tasks || []).filter(t => (t.taskStatus || '').toUpperCase() === s);
    return {
      pending: byStatus('PENDING'),
      inProgress: byStatus('IN_PROGRESS'),
      review: byStatus('REVIEW'),
      completed: byStatus('COMPLETED')
    };
  },

  renderPage() {
    const g = this.groupedTasks();
    const total = this.tasks.length;

    const html = `
      <div class="card" style="background:transparent;border:none;box-shadow:none;">
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
          <div class="tag-filter-group">
            <span class="tag active">全部 (${total})</span>
            <span class="tag">待分配 (${g.pending.length})</span>
            <span class="tag">进行中 (${g.inProgress.length})</span>
            <span class="tag">待审核 (${g.review.length})</span>
            <span class="tag">已完成 (${g.completed.length})</span>
          </div>
          <div style="flex:1;"></div>
          <button class="btn btn-primary" id="autoDispatchBtn">🤖 智能调度</button>
          <button class="btn btn-outline-primary" id="resourceBtn">📊 资源分配</button>
        </div>

        <div class="kanban-board" id="kanbanBoard">
          ${this.renderKanbanColumn('待分配', 'pending', 'PENDING', g.pending, 'var(--warning)')}
          ${this.renderKanbanColumn('进行中', 'inProgress', 'IN_PROGRESS', g.inProgress, 'var(--primary)')}
          ${this.renderKanbanColumn('待审核', 'review', 'REVIEW', g.review, 'var(--warning)')}
          ${this.renderKanbanColumn('已完成', 'completed', 'COMPLETED', g.completed, 'var(--success)')}
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  renderKanbanColumn(title, key, status, tasks, color) {
    return `
      <div class="kanban-column" data-status="${status}" data-key="${key}">
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

  priorityBadge(priority) {
    const p = (priority || 'NORMAL').toUpperCase();
    const map = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', NORMAL: 'badge-secondary' };
    const text = { HIGH: '高优', MEDIUM: '中优', NORMAL: '普通' };
    return `<span class="badge ${map[p] || 'badge-secondary'}">${text[p] || '普通'}</span>`;
  },

  renderKanbanCard(task, color) {
    const assignee = task.technicianName || task.assigneeName || '未分配';
    const deadline = task.deadline ? AppUtils.formatDateTime(task.deadline, 'YYYY-MM-DD') : '-';
    const sample = task.sampleCode || task.sampleName || '-';
    const code = task.taskCode || task.id || '-';
    const title = task.taskTitle || task.title || '未命名任务';
    const certType = task.certTypeCode || '';
    const progress = task.progress || 0;
    const progressColor = progress >= 80 ? 'success' : progress >= 50 ? 'warning' : '';
    return `
      <div class="kanban-card" draggable="true" data-id="${task.id}" data-status="${task.taskStatus}">
        <div class="kanban-card-title">${title}</div>
        <div style="margin-bottom:8px;font-size:12px;color:var(--gray-500);font-family:monospace;">${code}</div>
        <div class="kanban-card-meta">
          <div>${AppUtils.getAvatar(assignee)} ${assignee}</div>
          ${this.priorityBadge(task.priority)}
        </div>
        ${progress > 0 ? `<div class="progress"><div class="progress-bar ${progressColor}" style="width:${progress}%;"></div></div><div style="font-size:11px;color:var(--gray-500);margin-top:4px;text-align:right;">${progress}%</div>` : ''}
        <div class="kanban-card-tags">
          ${certType ? `<span class="badge badge-secondary">${certType}</span>` : ''}
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--gray-400);display:flex;justify-content:space-between;align-items:center;">
          <span>📅 截止: ${deadline}</span>
          <span style="color:var(--gray-400);">📦 ${sample}</span>
        </div>
      </div>
    `;
  },

  bindEvents() {
    $('#autoDispatchBtn').on('click', () => this.doAutoDispatch());

    $('#resourceBtn').on('click', () => {
      AppUtils.showToast('资源分配', '正在加载设备与技术员资源...', 'success');
      AppLayout.currentPage = 'lab';
      AppLayout.renderSidebar();
      PageRouter.go('lab');
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
    }).on('drop', '.kanban-column', async function(e) {
      e.preventDefault();
      $(this).css('background', '');
      const targetStatus = $(this).data('status');
      const columnTitle = $(this).find('.kanban-column-title').text().trim();
      const taskId = dragId;
      dragId = null;
      if (!taskId || !targetStatus) return;
      try {
        await ApiClient.task.updateStatus(taskId, targetStatus);
        AppUtils.showToast('任务状态已更新', `任务 ${taskId} 已移动至 ${columnTitle} 并持久化`, 'success');
        TasksPage.load();
      } catch (err) {
        ApiClient.handleError(err, '任务状态更新失败');
        TasksPage.load();
      }
    });
  },

  async doAutoDispatch() {
    AppUtils.showToast('智能调度', '正在根据设备负载与人员专长自动分配...', 'success');
    try {
      const result = await ApiClient.task.autoDispatch();
      const dispatched = (Array.isArray(result) ? result.length : (result && result.dispatched) || 0);
      const detail = result && result.detail ? result.detail : '';
      AppUtils.showModal({
        title: '🤖 智能调度结果',
        content: `
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:48px;">✅</div>
            <div style="font-size:18px;font-weight:600;margin-top:12px;">调度完成</div>
            <div style="font-size:14px;color:var(--gray-500);margin-top:8px;">成功分配 <span style="color:var(--primary);font-weight:700;">${dispatched}</span> 个待处理任务</div>
            ${detail ? `<div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:8px;font-size:13px;color:var(--gray-600);text-align:left;">${detail}</div>` : ''}
          </div>
        `,
        confirmText: '刷新看板',
        onConfirm: () => { this.load(); return true; }
      });
    } catch (e) {
      ApiClient.handleError(e, '智能调度失败');
    }
  }
};

const ReportsPage = {
  reports: [],
  certificates: [],

  render() {
    AppLayout.setPageHeader('报告与证书', ['业务管理']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    try {
      this.reports = await ApiClient.report.list() || [];
    } catch (e) { ApiClient.handleError(e, '加载报告列表失败'); }
    try {
      this.certificates = await ApiClient.certificate.list() || [];
    } catch (e) { ApiClient.handleError(e, '加载证书列表失败'); }
    this.renderPage();
  },

  renderPage() {
    const reports = this.reports;
    const certs = this.certificates;

    const getReportStatus = (s) => {
      const map = {
        DRAFT: { class: 'badge-secondary', text: '草稿' },
        REVIEW: { class: 'badge-warning', text: '审核中' },
        ISSUED: { class: 'badge-success', text: '已签发' },
        REJECTED: { class: 'badge-danger', text: '已驳回' }
      };
      const m = map[(s || 'DRAFT').toUpperCase()] || map.DRAFT;
      return `<span class="badge ${m.class}">${m.text}</span>`;
    };

    const getCertStatus = (c) => {
      const today = new Date();
      const expire = AppUtils.parseDateTime(c.expireDate);
      if (!expire || expire < today) return '<span class="badge badge-danger">已过期</span>';
      const days = Math.ceil((expire - today) / (1000 * 60 * 60 * 24));
      if (days <= 60) return '<span class="badge badge-warning">即将到期</span>';
      if (c.certStatus === 'REVOKED') return '<span class="badge badge-danger">已撤销</span>';
      return '<span class="badge badge-success">有效</span>';
    };

    const renderCertType = (type) => {
      const map = { CCC: 'badge-danger', CE: 'badge-primary', ISO: 'badge-success' };
      return `<span class="badge ${map[type] || 'badge-secondary'}">${type || '-'}</span>`;
    };

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">📄 检测报告</h3>
          <div>
            <button class="btn btn-primary btn-sm" id="genReportBtn">➕ 生成报告</button>
            <button class="btn btn-outline-primary btn-sm" id="reportTemplateBtn">📚 模板管理</button>
          </div>
        </div>
        <div class="filter-bar">
          <select class="form-control" id="reportStatusFilter" style="width:140px;">
            <option value="">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="REVIEW">审核中</option>
            <option value="ISSUED">已签发</option>
          </select>
          <select class="form-control" id="reportCertFilter" style="width:120px;">
            <option value="">认证类型</option>
            ${UI_CONST.certTypes.map(c => `<option>${c}</option>`).join('')}
          </select>
          <input type="text" class="form-control" id="reportKeyword" placeholder="搜索报告编号" style="width:200px;">
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
                <th>创建日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${reports.length ? reports.map(r => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${r.reportCode || r.id}</td>
                  <td style="font-weight:500;">${r.reportTitle || '-'}</td>
                  <td>${r.companyName || '-'}</td>
                  <td>${renderCertType(r.certTypeCode)}</td>
                  <td>${r.authorName ? AppUtils.getAvatar(r.authorName) + ' ' + r.authorName : '-'}</td>
                  <td><span class="badge badge-info">v${r.version || '1.0'}</span></td>
                  <td>${r.createTime ? AppUtils.formatDateTime(r.createTime, 'YYYY-MM-DD') : '-'}</td>
                  <td>${getReportStatus(r.reportStatus)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="预览" data-action="preview" data-id="${r.id}">👁️</button>
                      <button class="action-btn" title="下载PDF" data-action="downloadReportPdf" data-id="${r.id}" data-code="${r.reportCode || r.id}">📥</button>
                      <button class="action-btn ${r.reportStatus === 'REVIEW' ? '' : 'disabled'}" title="审核" data-action="auditReport" data-id="${r.id}" data-code="${r.reportCode || r.id}">✓</button>
                    </div>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="9">${AppUtils.renderEmpty('暂无报告数据')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📜 认证证书</h3>
          <div>
            <button class="btn btn-primary btn-sm" id="genCertBtn">➕ 签发证书</button>
            <button class="btn btn-outline-primary btn-sm" id="batchPrintBtn">🖨️ 批量打印</button>
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
                <th class="col-hide-md">依据标准</th>
                <th>发证日期</th>
                <th>到期日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${certs.length ? certs.map(c => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${c.certNo || c.id}</td>
                  <td>${c.companyName || '-'}</td>
                  <td>${c.productName || '-'}</td>
                  <td>${renderCertType(c.certTypeCode)}</td>
                  <td class="col-hide-md" style="font-size:13px;">${c.standard || '-'}</td>
                  <td>${c.issueDate ? AppUtils.formatDateTime(c.issueDate, 'YYYY-MM-DD') : '-'}</td>
                  <td>${c.expireDate ? AppUtils.formatDateTime(c.expireDate, 'YYYY-MM-DD') : '-'}</td>
                  <td>${getCertStatus(c)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="查看" data-action="viewCert" data-id="${c.id}">👁️</button>
                      <button class="action-btn" title="下载PDF(含电子签章)" data-action="downloadCertPdf" data-id="${c.id}" data-code="${c.certNo || c.id}">📥</button>
                      <button class="action-btn danger" title="撤销" data-action="revokeCert" data-id="${c.id}" data-code="${c.certNo || c.id}">⛔</button>
                    </div>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="9">${AppUtils.renderEmpty('暂无证书数据')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  bindEvents() {
    $('#genReportBtn').on('click', () => this.showGenerateModal());
    $('#reportTemplateBtn').on('click', () => this.showTemplateModal());
    $('#genCertBtn').on('click', () => this.showIssueCertModal());
    $('#batchPrintBtn').on('click', () => this.doBatchPrint());

    $('body').off('click.reports').on('click.reports', '[data-action="preview"]', function() {
      ReportsPage.showReportPreview($(this).data('id'));
    });
    $('body').on('click', '[data-action="viewCert"]', function() {
      ReportsPage.showCertPreview($(this).data('id'));
    });
    $('body').on('click', '[data-action="downloadReportPdf"]', function() {
      ReportsPage.downloadReportPdf($(this).data('id'), $(this).data('code'));
    });
    $('body').on('click', '[data-action="downloadCertPdf"]', function() {
      ReportsPage.downloadCertPdf($(this).data('id'), $(this).data('code'));
    });
    $('body').on('click', '[data-action="auditReport"]', function() {
      ReportsPage.showAuditModal($(this).data('id'), $(this).data('code'));
    });
    $('body').on('click', '[data-action="revokeCert"]', function() {
      ReportsPage.showRevokeModal($(this).data('id'), $(this).data('code'));
    });
  },

  showTemplateModal() {
    AppUtils.showModal({
      title: '📚 报告模板管理',
      content: '<div id="templateListContainer">' + AppUtils.renderLoading() + '</div>',
      confirmText: '关闭',
      cancelText: ''
    });
    ApiClient.report.templates().then(list => {
      const items = (list || []).map(t => `
        <div style="padding:12px;border:1px solid var(--gray-200);border-radius:8px;margin-bottom:8px;">
          <div style="font-weight:600;">${t.templateName || t.name || '-'}</div>
          <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">${t.certTypeCode || ''} · ${t.templateCode || t.code || ''}</div>
        </div>
      `).join('');
      $('#templateListContainer').html(items || AppUtils.renderEmpty('暂无模板'));
    }).catch(e => {
      $('#templateListContainer').html(AppUtils.renderEmpty('模板加载失败'));
    });
  },

  showGenerateModal() {
    const content = `
      <div class="row g-3">
        <div class="col-12">
          <div class="floating-label">
            <input type="number" placeholder=" " id="genTaskId">
            <label>检测任务ID *</label>
          </div>
        </div>
        <div class="col-12">
          <div class="floating-label">
            <input type="number" placeholder=" " id="genTemplateId">
            <label>报告模板ID</label>
          </div>
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: '➕ 生成检测报告',
      content,
      confirmText: '生成',
      onConfirm: async () => {
        const taskId = $('#genTaskId').val().trim();
        if (!taskId) { AppUtils.showToast('提示', '请填写任务ID', 'warning'); return false; }
        const templateId = $('#genTemplateId').val().trim();
        try {
          await ApiClient.report.generate({ taskId: Number(taskId), templateId: templateId ? Number(templateId) : undefined });
          AppUtils.showToast('生成报告', '报告生成成功', 'success');
          this.load();
          return true;
        } catch (e) {
          ApiClient.handleError(e, '生成报告失败');
          return false;
        }
      }
    });
  },

  showAuditModal(id, code) {
    const content = `
      <div class="row g-3">
        <div class="col-12">
          <div class="floating-label">
            <select id="auditStatus"><option value="ISSUED">通过(签发)</option><option value="REJECTED">驳回</option></select>
            <label>审核结果 *</label>
          </div>
        </div>
        <div class="col-12">
          <div class="floating-label">
            <textarea id="auditRemark" rows="3" placeholder=" " style="height:auto;padding-top:22px;"></textarea>
            <label>审核意见</label>
          </div>
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: `✓ 审核报告 ${code}`,
      content,
      confirmText: '提交审核',
      onConfirm: async () => {
        const status = $('#auditStatus').val();
        const remark = $('#auditRemark').val().trim();
        try {
          await ApiClient.report.audit(id, status, remark);
          AppUtils.showToast('审核', '报告审核完成', 'success');
          this.load();
          return true;
        } catch (e) {
          ApiClient.handleError(e, '审核失败');
          return false;
        }
      }
    });
  },

  async showReportPreview(id) {
    const r = this.reports.find(x => String(x.id) === String(id));
    if (!r) { AppUtils.showToast('提示', '未找到报告', 'warning'); return; }

    let annotations = [];
    try {
      annotations = await ApiClient.report.annotations(id) || [];
    } catch (e) { /* 忽略批注加载失败 */ }

    const content = `
      <div style="display:grid;grid-template-columns:1fr 280px;gap:20px;">
        <div class="pdf-preview" style="margin:0;">
          <div class="pdf-page" style="position:relative;">
            <div class="pdf-header">
              <div class="pdf-title">检测报告</div>
              <div class="pdf-subtitle">TESTING REPORT</div>
              <div style="margin-top:12px;font-family:monospace;font-size:14px;color:var(--gray-500);">报告编号: ${r.reportCode || r.id}</div>
            </div>
            <div class="pdf-info-row"><div class="pdf-info-label">委托单位</div><div class="pdf-info-value">${r.companyName || '-'}</div></div>
            <div class="pdf-info-row"><div class="pdf-info-label">报告标题</div><div class="pdf-info-value">${r.reportTitle || '-'}</div></div>
            <div class="pdf-info-row"><div class="pdf-info-label">认证类型</div><div class="pdf-info-value">${r.certTypeCode || '-'} 认证</div></div>
            <div class="pdf-info-row"><div class="pdf-info-label">编制人</div><div class="pdf-info-value">${r.authorName || '-'}</div></div>
            <div class="pdf-info-row"><div class="pdf-info-label">创建日期</div><div class="pdf-info-value">${r.createTime ? AppUtils.formatDateTime(r.createTime) : '-'}</div></div>
            <div class="pdf-section-title">检测结论</div>
            <div style="padding:16px;background:var(--gray-50);border-radius:8px;">
              <div style="font-size:16px;font-weight:600;color:var(--success);margin-bottom:8px;">${(r.reportStatus || '').toUpperCase() === 'ISSUED' ? '✓ 合格 PASS' : '⏳ 报告处理中'}</div>
              <div style="font-size:13px;color:var(--gray-600);line-height:1.8;">
                报告状态: ${r.reportStatus || '-'} · 版本: v${r.version || '1.0'}
              </div>
            </div>
            ${annotations.length > 0 ? `
              <div style="position:absolute;top:35%;right:16px;background:#fff;border:1px solid var(--gray-200);border-radius:8px;padding:10px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);max-width:200px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                  <span style="color:${annotations[0].color || '#f59e0b'};font-size:16px;">💬</span>
                  <span style="font-weight:600;font-size:12px;">${annotations[0].annotatorName || annotations[0].annotator || '-'}</span>
                </div>
                <div style="font-size:12px;color:var(--gray-700);line-height:1.5;">${annotations[0].content || annotations[0].annotationContent || ''}</div>
              </div>
            ` : ''}
          </div>
        </div>
        <div style="border-left:1px solid var(--gray-200);padding-left:16px;">
          ${AppUtils.renderAnnotations(id, annotations)}
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: '📄 报告预览（含批注）',
      content,
      width: '1080px',
      confirmText: '下载PDF',
      onConfirm: () => {
        this.downloadReportPdf(id, r.reportCode || id);
        return false;
      }
    });
  },

  addAnnotationPrompt(reportId) {
    const content = `
      <div class="row g-3">
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <select placeholder=" " id="annType">
              <option value="comment">文字批注</option>
              <option value="highlight">高亮标记</option>
              <option value="stamp">签章批注</option>
            </select>
            <label>批注类型 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <input type="number" placeholder=" " id="annPage" value="1">
            <label>页码</label>
          </div>
        </div>
        <div class="col-12">
          <div class="floating-label">
            <textarea placeholder=" " rows="4" id="annContent" style="height:auto;padding-top:22px;"></textarea>
            <label>批注内容 *</label>
          </div>
        </div>
      </div>
    `;
    const mask = AppUtils.showModal({
      title: '➕ 添加批注',
      content,
      confirmText: '提交批注',
      onConfirm: async () => {
        const annContent = $('#annContent').val().trim();
        if (!annContent) { AppUtils.showToast('提示', '请填写批注内容', 'warning'); return false; }
        const data = {
          annotationType: $('#annType').val() || 'comment',
          pageNo: parseInt($('#annPage').val()) || 1,
          content: annContent
        };
        try {
          await ApiClient.report.addAnnotation(reportId, data);
          AppUtils.closeModal(mask);
          AppUtils.showToast('批注', '批注添加成功', 'success');
          this.showReportPreview(reportId);
          return false;
        } catch (e) {
          ApiClient.handleError(e, '添加批注失败');
          return false;
        }
      }
    });
  },

  async downloadReportPdf(id, code) {
    AppUtils.showToast('下载PDF', '正在生成报告PDF...', 'success');
    try {
      const resp = await ApiClient.report.downloadPdf(id);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `检测报告_${code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      AppUtils.showToast('下载完成', `检测报告_${code || id}.pdf 已下载`, 'success');
    } catch (e) {
      ApiClient.handleError(e, 'PDF下载失败');
    }
  },

  async downloadCertPdf(id, code) {
    AppUtils.showToast('下载PDF', '正在生成证书PDF(含电子签章)...', 'success');
    try {
      const resp = await ApiClient.certificate.downloadPdf(id);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `认证证书_${code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      AppUtils.showToast('下载完成', `认证证书_${code || id}.pdf 已下载(含电子签章)`, 'success');
    } catch (e) {
      ApiClient.handleError(e, 'PDF下载失败');
    }
  },

  showIssueCertModal() {
    const content = `
      <div class="row g-3">
        <div class="col-12">
          <div class="floating-label">
            <input type="number" placeholder=" " id="certReportId">
            <label>关联报告ID *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <input type="text" placeholder=" " id="certCompany">
            <label>获证企业 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <input type="text" placeholder=" " id="certProduct">
            <label>产品名称 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <select id="certType"><option value="CCC">CCC</option><option value="CE">CE</option><option value="ISO">ISO</option></select>
            <label>认证类型 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <input type="number" placeholder=" " id="certYears" value="3">
            <label>有效期(年)</label>
          </div>
        </div>
        <div class="col-12">
          <div class="floating-label">
            <input type="text" placeholder=" " id="certStandard">
            <label>依据标准</label>
          </div>
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: '➕ 签发认证证书',
      content,
      confirmText: '签发',
      onConfirm: async () => {
        const reportId = $('#certReportId').val().trim();
        const company = $('#certCompany').val().trim();
        const product = $('#certProduct').val().trim();
        if (!reportId || !company || !product) { AppUtils.showToast('提示', '请填写必填项', 'warning'); return false; }
        const data = {
          reportId: Number(reportId),
          companyName: company,
          productName: product,
          certTypeCode: $('#certType').val(),
          standard: $('#certStandard').val().trim(),
          validYears: parseInt($('#certYears').val()) || 3
        };
        try {
          await ApiClient.certificate.issue(data);
          AppUtils.showToast('签发证书', '证书签发成功(含电子签章)', 'success');
          this.load();
          return true;
        } catch (e) {
          ApiClient.handleError(e, '签发证书失败');
          return false;
        }
      }
    });
  },

  showRevokeModal(id, code) {
    const content = `
      <div class="row g-3">
        <div class="col-12">
          <div class="floating-label">
            <textarea id="revokeReason" rows="3" placeholder=" " style="height:auto;padding-top:22px;"></textarea>
            <label>撤销原因 *</label>
          </div>
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: `⛔ 撤销证书 ${code}`,
      content,
      confirmText: '确认撤销',
      onConfirm: async () => {
        const reason = $('#revokeReason').val().trim();
        if (!reason) { AppUtils.showToast('提示', '请填写撤销原因', 'warning'); return false; }
        try {
          await ApiClient.certificate.revoke(id, reason);
          AppUtils.showToast('撤销', '证书已撤销', 'success');
          this.load();
          return true;
        } catch (e) {
          ApiClient.handleError(e, '撤销失败');
          return false;
        }
      }
    });
  },

  doBatchPrint() {
    const checked = [];
    $('[data-action="viewCert"]').each(function() { checked.push($(this).data('id')); });
    if (!checked.length) { AppUtils.showToast('提示', '暂无证书可批量打印', 'warning'); return; }
    AppUtils.showModal({
      title: '🖨️ 批量打印证书',
      content: `<div style="padding:20px 0;text-align:center;"><div style="font-size:36px;">🖨️</div><div style="margin-top:12px;">即将批量打印 <span style="font-weight:700;color:var(--primary);">${checked.length}</span> 张证书PDF(含电子签章)</div></div>`,
      confirmText: '开始打印',
      onConfirm: async () => {
        try {
          await ApiClient.certificate.batchPrint(checked);
          AppUtils.showToast('批量打印', `${checked.length} 张证书已加入打印队列`, 'success');
          return true;
        } catch (e) {
          ApiClient.handleError(e, '批量打印失败');
          return false;
        }
      }
    });
  },

  showCertPreview(id) {
    const c = this.certificates.find(x => String(x.id) === String(id));
    if (!c) { AppUtils.showToast('提示', '未找到证书', 'warning'); return; }
    const expireDate = c.expireDate ? AppUtils.formatDateTime(c.expireDate, 'YYYY-MM-DD') : '-';
    const issueDate = c.issueDate ? AppUtils.formatDateTime(c.issueDate, 'YYYY-MM-DD') : '-';
    const today = new Date();
    const expire = AppUtils.parseDateTime(c.expireDate);
    const isExpiring = expire && Math.ceil((expire - today) / (1000 * 60 * 60 * 24)) <= 60;

    const content = `
      <div style="padding:30px;background:linear-gradient(135deg,#fef3c7,#fefce8);border-radius:12px;border:2px solid #fcd34d;">
        <div style="text-align:center;">
          <div style="font-size:14px;letter-spacing:4px;color:var(--gray-600);">${c.certTypeCode || ''} 认 证 证 书</div>
          <div style="font-size:28px;font-weight:700;margin-top:8px;color:var(--dark);">CERTIFICATE</div>
          <div style="font-family:monospace;margin-top:16px;padding:8px 16px;background:rgba(255,255,255,0.6);display:inline-block;border-radius:8px;font-weight:600;">证书编号：${c.certNo || c.id}</div>
        </div>
        <div style="margin-top:28px;padding:24px;background:#fff;border-radius:10px;">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">获证企业</div>
            <div style="flex:1;font-weight:600;">${c.companyName || '-'}</div>
          </div>
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">产品名称</div>
            <div style="flex:1;font-weight:600;">${c.productName || '-'}</div>
          </div>
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">认证依据</div>
            <div style="flex:1;">${c.standard || '-'}</div>
          </div>
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">发证日期</div>
            <div style="flex:1;">${issueDate}</div>
          </div>
          <div style="padding:12px 0;display:flex;">
            <div style="width:120px;color:var(--gray-500);font-size:13px;">有效期至</div>
            <div style="flex:1;font-weight:600;color:${isExpiring ? 'var(--danger)' : 'var(--dark)'};">${expireDate}</div>
          </div>
        </div>
        <div style="margin-top:24px;text-align:right;">
          <div style="font-family:STKaiti;font-size:28px;color:var(--primary);">✓</div>
          <div style="margin-top:4px;font-size:13px;color:var(--gray-500);">检验检测认证中心</div>
          <div style="font-size:13px;color:var(--gray-400);">签发日期：${issueDate}</div>
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: '📜 证书详情',
      content,
      width: '560px',
      confirmText: '下载PDF(含签章)',
      onConfirm: () => {
        this.downloadCertPdf(c.id, c.certNo || c.id);
        return false;
      }
    });
  }
};

const CustomersPage = {
  applications: [],

  render() {
    AppLayout.setPageHeader('客户服务', ['业务管理']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    try {
      this.applications = await ApiClient.customer.myApps() || [];
    } catch (e) {
      ApiClient.handleError(e, '加载申请列表失败');
      this.applications = [];
    }
    this.renderPage();
  },

  buildCustomerSummary() {
    const map = {};
    (this.applications || []).forEach(a => {
      const name = a.companyName || '未知企业';
      if (!map[name]) {
        map[name] = { name, contact: a.contactName || '-', phone: a.contactPhone || '-', creditCode: a.creditCode || '-', category: a.productCategoryName || '-', certCount: 0, totalOrders: 0, level: a.customerLevel || 'C' };
      }
      map[name].totalOrders++;
    });
    return Object.values(map);
  },

  renderPage() {
    const customers = this.buildCustomerSummary();
    const applications = this.applications;

    const getLevelBadge = (l) => {
      const map = { A: 'badge-danger', B: 'badge-primary', C: 'badge-secondary' };
      return `<span class="badge ${map[l] || 'badge-secondary'}">${l || 'C'}级客户</span>`;
    };

    const getAppStatus = (s) => {
      const map = {
        PENDING: { class: 'badge-warning', text: '待审核' },
        APPROVED: { class: 'badge-primary', text: '已通过' },
        PROCESSING: { class: 'badge-info', text: '处理中' },
        COMPLETED: { class: 'badge-success', text: '已完成' },
        REJECTED: { class: 'badge-danger', text: '已拒绝' }
      };
      const m = map[(s || 'PENDING').toUpperCase()] || map.PENDING;
      return `<span class="badge ${m.class}">${m.text}</span>`;
    };

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🏢 企业客户</h3>
          <span style="font-size:13px;color:var(--gray-500);">共 ${customers.length} 家企业</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>企业名称</th>
                <th>联系人</th>
                <th>联系电话</th>
                <th class="col-hide-lg">统一社会信用代码</th>
                <th class="col-hide-md">主营类别</th>
                <th>历史订单</th>
                <th>客户等级</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${customers.length ? customers.map(c => `
                <tr>
                  <td style="font-weight:500;">${c.name}</td>
                  <td>${c.contact}</td>
                  <td style="font-family:monospace;font-size:13px;">${c.phone}</td>
                  <td class="col-hide-lg" style="font-family:monospace;font-size:12px;">${c.creditCode}</td>
                  <td class="col-hide-md"><span class="badge badge-secondary">${c.category}</span></td>
                  <td style="text-align:center;font-weight:600;">${c.totalOrders}</td>
                  <td>${getLevelBadge(c.level)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="查看申请" data-action="viewCustomerApps" data-company="${c.name}">👁️</button>
                    </div>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="8">${AppUtils.renderEmpty('暂无客户数据')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📋 在线申请</h3>
          <button class="btn btn-outline-primary btn-sm" id="refreshAppsBtn">🔄 刷新</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>申请编号</th>
                <th>企业名称</th>
                <th>产品名称</th>
                <th>认证类型</th>
                <th class="col-hide-md">样品数量</th>
                <th>申请日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${applications.length ? applications.map(a => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${a.applicationCode || a.id || '-'}</td>
                  <td>${a.companyName || '-'}</td>
                  <td style="font-weight:500;">${a.productName || '-'}</td>
                  <td>${a.certTypeCode || '-'}</td>
                  <td class="col-hide-md">${a.sampleAmount || 0} 件</td>
                  <td>${a.submitTime ? AppUtils.formatDateTime(a.submitTime, 'YYYY-MM-DD') : '-'}</td>
                  <td>${getAppStatus(a.appStatus)}</td>
                  <td>
                    <div class="table-actions">
                      ${(a.appStatus || '').toUpperCase() === 'PENDING' ? `<button class="action-btn" title="审核" style="color:var(--success);" data-action="auditApp" data-id="${a.id}" data-code="${a.applicationCode || a.id}">✓</button>` : ''}
                      <button class="action-btn" title="查看进度" data-action="viewProgress" data-id="${a.id}">👁️</button>
                      ${(a.appStatus || '').toUpperCase() === 'APPROVED' ? `<button class="action-btn" title="在线支付" data-action="payApp" data-id="${a.id}">💳</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="8">${AppUtils.renderEmpty('暂无申请数据')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  bindEvents() {
    $('#refreshAppsBtn').on('click', () => this.load());

    $('body').off('click.customers').on('click.customers', '[data-action="auditApp"]', function() {
      CustomersPage.showAuditAppModal($(this).data('id'), $(this).data('code'));
    });
    $('body').on('click', '[data-action="viewProgress"]', function() {
      CustomersPage.showProgressModal($(this).data('id'));
    });
    $('body').on('click', '[data-action="payApp"]', function() {
      CustomersPage.showPayModal($(this).data('id'));
    });
    $('body').on('click', '[data-action="viewCustomerApps"]', function() {
      const company = $(this).data('company');
      AppUtils.showToast('企业申请', '正在筛选 ' + company + ' 的申请记录...', 'success');
    });
  },

  showAuditAppModal(id, code) {
    const content = `
      <div class="row g-3">
        <div class="col-12">
          <div class="floating-label">
            <select id="appAuditStatus"><option value="APPROVED">通过</option><option value="REJECTED">拒绝</option></select>
            <label>审核结果 *</label>
          </div>
        </div>
        <div class="col-12">
          <div class="floating-label">
            <textarea id="appAuditReason" rows="3" placeholder=" " style="height:auto;padding-top:22px;"></textarea>
            <label>审核意见</label>
          </div>
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: `✓ 审核申请 ${code}`,
      content,
      confirmText: '提交',
      onConfirm: async () => {
        const status = $('#appAuditStatus').val();
        const reason = $('#appAuditReason').val().trim();
        try {
          await ApiClient.customer.auditApp(id, status, reason);
          AppUtils.showToast('审核', '申请审核完成', 'success');
          this.load();
          return true;
        } catch (e) {
          ApiClient.handleError(e, '审核失败');
          return false;
        }
      }
    });
  },

  async showProgressModal(id) {
    let progress = null;
    try {
      progress = await ApiClient.customer.progress(id);
    } catch (e) {
      ApiClient.handleError(e, '查询进度失败');
      return;
    }
    const stages = (progress && progress.stages) || [];
    const currentStage = progress && progress.currentStage;
    const content = `
      <div style="padding:8px 0;">
        <div style="margin-bottom:16px;">
          <div style="font-size:13px;color:var(--gray-500);">申请编号: ${progress && progress.applicationCode || id}</div>
          <div style="font-size:16px;font-weight:600;margin-top:4px;">当前状态: ${currentStage || (progress && progress.appStatus) || '-'}</div>
        </div>
        <div class="timeline">
          ${stages.length ? stages.map(s => `
            <div class="timeline-item ${s.done ? 'success' : ''}">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-time">${s.time ? AppUtils.formatDateTime(s.time) : ''}</div>
                <div class="timeline-title">${s.name || s.stage || '-'}</div>
                <div class="timeline-desc">${s.desc || s.description || ''}</div>
              </div>
            </div>
          `).join('') : AppUtils.renderEmpty('暂无进度信息')}
        </div>
      </div>
    `;
    AppUtils.showModal({ title: '📋 申请进度查询', content, width: '520px', confirmText: '关闭', cancelText: '' });
  },

  showPayModal(id) {
    const content = `
      <div class="row g-3">
        <div class="col-12">
          <div class="floating-label">
            <select id="payMethod"><option value="ALIPAY">支付宝</option><option value="WECHAT">微信支付</option><option value="BANK">银行转账</option></select>
            <label>支付方式 *</label>
          </div>
        </div>
        <div class="col-12">
          <div class="floating-label">
            <input type="number" placeholder=" " id="payAmount" step="0.01">
            <label>支付金额(元) *</label>
          </div>
        </div>
      </div>
    `;
    AppUtils.showModal({
      title: '💳 在线支付',
      content,
      confirmText: '确认支付',
      onConfirm: async () => {
        const method = $('#payMethod').val();
        const amount = $('#payAmount').val().trim();
        if (!amount) { AppUtils.showToast('提示', '请输入支付金额', 'warning'); return false; }
        try {
          await ApiClient.customer.pay(id, method, Number(amount));
          AppUtils.showToast('支付', '支付成功', 'success');
          this.load();
          return true;
        } catch (e) {
          ApiClient.handleError(e, '支付失败');
          return false;
        }
      }
    });
  }
};
