const SamplesPage = {
  currentPage: 1,
  pageSize: 10,
  total: 0,

  render() {
    AppLayout.setPageHeader('样品管理', ['业务管理']);
    this.currentPage = 1;
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    const status = $('#sampleStatusFilter').val() || '';
    const keyword = $('#sampleKeyword').val() || '';
    let page = null;
    try {
      page = await ApiClient.sample.list({ current: this.currentPage, size: this.pageSize, status, keyword });
    } catch (e) {
      ApiClient.handleError(e, '加载样品列表失败');
      $('#pageContent').html(AppUtils.renderEmpty('样品列表加载失败，请确认后端服务已启动'));
      return;
    }
    page = page || { records: [], total: 0 };
    this.total = page.total || 0;
    const samples = page.records || [];
    this.renderPage(samples);
  },

  renderPage(samples) {
    const html = `
      <div class="card">
        <div class="filter-bar">
          <div class="filter-group">
            <select class="form-control" id="sampleStatusFilter" style="width:160px;">
              <option value="">全部状态</option>
              <option value="RECEIVED">已接收</option>
              <option value="REGISTERED">已登记</option>
              <option value="TESTING">检测中</option>
              <option value="REPORTED">报告中</option>
              <option value="CERTIFIED">已发证</option>
              <option value="ARCHIVED">已归档</option>
              <option value="DESTROYED">已销毁</option>
            </select>
            <select class="form-control" style="width:140px;">
              <option value="">全部类别</option>
              ${UI_CONST.productCategories.map(c => `<option>${c.name}</option>`).join('')}
            </select>
            <select class="form-control" style="width:120px;">
              <option value="">认证类型</option>
              ${UI_CONST.certTypes.map(c => `<option>${c}</option>`).join('')}
            </select>
          </div>
          <input type="text" class="form-control" id="sampleKeyword" placeholder="搜索样品名称/追溯码" style="width:220px;">
          <input type="date" class="form-control" type="date">
          <button class="btn btn-primary" id="addSampleBtn">➕ 样品登记</button>
          <button class="btn btn-outline-primary" id="batchImportBtn">📥 批量导入</button>
          <input type="file" id="batchImportFile" accept=".xlsx,.xls" style="display:none;">
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>追溯码</th>
                <th>样品名称</th>
                <th>企业名称</th>
                <th class="col-hide-lg">产品类别</th>
                <th class="col-hide-md">认证类型</th>
                <th class="col-hide-xl">数量</th>
                <th class="col-hide-lg">接收人</th>
                <th class="col-hide-md">接收日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="sampleTableBody">
              ${this.renderSampleRows(samples)}
            </tbody>
          </table>
        </div>
        <div style="padding:16px 20px;border-top:1px solid var(--gray-200);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;color:var(--gray-500);">共 ${this.total} 条记录</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-sm btn-outline-primary" style="padding:4px 12px;" id="prevPageBtn">上一页</button>
            <button class="btn btn-sm btn-primary" style="padding:4px 12px;">${this.currentPage}/${Math.max(1, Math.ceil(this.total / this.pageSize))}</button>
            <button class="btn btn-sm btn-outline-primary" style="padding:4px 12px;" id="nextPageBtn">下一页</button>
          </div>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  renderSampleRows(samples) {
    if (!samples.length) return `<tr><td colspan="10">${AppUtils.renderEmpty('暂无样品数据')}</td></tr>`;
    return samples.map(s => `
      <tr>
        <td style="font-family:monospace;color:var(--primary);font-weight:600;">${s.sampleCode || s.id}</td>
        <td style="font-weight:500;">${s.sampleName || '-'}<div style="font-size:12px;color:var(--gray-400);">${s.sampleModel || s.sampleCodeInternal || ''}</div></td>
        <td>${s.companyName || '-'}</td>
        <td class="col-hide-lg"><span class="badge badge-secondary">${s.productCategoryName || '-'}</span></td>
        <td class="col-hide-md">${this.renderCertType(s.certTypeCode)}</td>
        <td class="col-hide-xl">${s.sampleAmount || 0} ${s.sampleUnit || '件'}</td>
        <td class="col-hide-lg">${s.receiverName ? AppUtils.getAvatar(s.receiverName) + ' ' + s.receiverName : '-'}</td>
        <td class="col-hide-md">${s.receiveTime ? AppUtils.formatDateTime(s.receiveTime, 'YYYY-MM-DD') : '-'}</td>
        <td>${AppUtils.getSampleStatusBadge((s.sampleStatus || 'RECEIVED').toLowerCase())}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn" title="查看详情" data-id="${s.id}" data-action="view">👁️</button>
            <button class="action-btn" title="流转记录" data-id="${s.id}" data-action="timeline">🕐</button>
            <button class="action-btn danger" title="销毁" data-id="${s.id}" data-code="${s.sampleCode || s.id}" data-action="destroy">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderCertType(type) {
    const map = {
      CCC: { class: 'badge-danger', text: 'CCC' },
      CE: { class: 'badge-primary', text: 'CE' },
      ISO: { class: 'badge-success', text: 'ISO' }
    };
    const m = map[type] || { class: 'badge-secondary', text: type || '-' };
    return `<span class="badge ${m.class}">${m.text}</span>`;
  },

  bindEvents() {
    const self = this;
    $('#addSampleBtn').on('click', () => this.showAddModal());

    $('#sampleStatusFilter, #sampleKeyword').on('change keypress', function(e) {
      if (e.type === 'keypress' && e.which !== 13) return;
      self.currentPage = 1;
      self.load();
    });

    $('#prevPageBtn').on('click', () => { if (self.currentPage > 1) { self.currentPage--; self.load(); } });
    $('#nextPageBtn').on('click', () => {
      if (self.currentPage * self.pageSize < self.total) { self.currentPage++; self.load(); }
    });

    $('#batchImportBtn').on('click', () => $('#batchImportFile').trigger('click'));
    $('#batchImportFile').on('change', function() {
      const file = this.files[0];
      if (file) self.doBatchImport(file);
      this.value = '';
    });

    $('body').off('click', '.action-btn[data-action]');
    $('body').on('click', '.action-btn[data-action="view"]', function() {
      SamplesPage.showDetailModal($(this).data('id'));
    });
    $('body').on('click', '.action-btn[data-action="timeline"]', function() {
      SamplesPage.showTimelineModal($(this).data('id'));
    });
    $('body').on('click', '.action-btn[data-action="destroy"]', function() {
      SamplesPage.confirmDestroy($(this).data('id'), $(this).data('code'));
    });
  },

  async doBatchImport(file) {
    AppUtils.showToast('批量导入', '正在上传并解析Excel文件...', 'success');
    try {
      const result = await ApiClient.sample.batchImport(file);
      const ok = result.successCount || 0;
      const fail = result.failCount || 0;
      AppUtils.showModal({
        title: '📥 批量导入结果',
        content: `
          <div style="padding:8px 0;">
            <div style="display:flex;gap:16px;margin-bottom:16px;">
              <div style="flex:1;padding:16px;background:rgba(16,185,129,0.08);border-radius:8px;text-align:center;">
                <div style="font-size:28px;font-weight:700;color:var(--success);">${ok}</div>
                <div style="font-size:13px;color:var(--gray-500);">成功导入</div>
              </div>
              <div style="flex:1;padding:16px;background:rgba(239,68,68,0.08);border-radius:8px;text-align:center;">
                <div style="font-size:28px;font-weight:700;color:var(--danger);">${fail}</div>
                <div style="font-size:13px;color:var(--gray-500);">导入失败</div>
              </div>
            </div>
            ${(result.errors && result.errors.length) ? `
              <div style="font-weight:600;margin-bottom:8px;">失败明细：</div>
              <div style="max-height:200px;overflow-y:auto;font-size:13px;color:var(--gray-600);">
                ${result.errors.map(e => `<div style="padding:4px 0;border-bottom:1px solid var(--gray-100);">${e}</div>`).join('')}
              </div>` : ''}
          </div>
        `,
        confirmText: '确定'
      });
      this.currentPage = 1;
      this.load();
    } catch (e) {
      ApiClient.handleError(e, '批量导入失败');
    }
  },

  showAddModal() {
    const content = `
      <div class="row g-3">
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <input type="text" placeholder=" " id="sampleName">
            <label>样品名称 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <input type="text" placeholder=" " id="companyName">
            <label>企业名称 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <select placeholder=" " id="sampleCategory">
            <option value=""></option>
            ${UI_CONST.productCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
            <label>产品类别 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <select placeholder=" " id="sampleCert">
            <option value=""></option>
            ${UI_CONST.certTypes.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <label>认证类型 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-4">
          <div class="floating-label">
            <input type="number" placeholder=" " id="sampleAmount" value="1">
            <label>样品数量</label>
          </div>
        </div>
        <div class="col-12 col-sm-4">
          <div class="floating-label">
            <input type="text" placeholder=" " id="sampleModel">
            <label>样品型号</label>
          </div>
        </div>
        <div class="col-12 col-sm-4">
          <div class="floating-label">
            <select placeholder=" " id="samplePriority">
              <option value="NORMAL">普通</option>
              <option value="MEDIUM">中优</option>
              <option value="HIGH">高优</option>
            </select>
            <label>优先级</label>
          </div>
        </div>
        <div class="col-12">
          <div style="border:2px dashed var(--gray-200);border-radius:8px;padding:24px;text-align:center;cursor:pointer;color:var(--gray-500);" id="photoUploadArea"
               onmouseover="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'"
               onmouseout="this.style.borderColor='var(--gray-200)';this.style.color='var(--gray-500)'">
            <div style="font-size:36px;margin-bottom:8px;">📷</div>
            <div>点击上传样品照片（支持拍照或批量上传）</div>
            <div style="font-size:12px;margin-top:4px;">支持 JPG/PNG，单张不超过10MB</div>
            <input type="file" id="photoInput" accept="image/*" multiple style="display:none;">
          </div>
        </div>
        <div class="col-12">
          <div class="floating-label">
            <textarea placeholder=" " rows="3" id="sampleRemark" style="height:auto;padding-top:22px;"></textarea>
            <label>备注说明</label>
          </div>
        </div>
      </div>
    `;
    let uploadedPhotos = [];
    const mask = AppUtils.showModal({
      title: '📦 样品登记',
      content,
      confirmText: '提交登记',
      onConfirm: async () => {
        const name = $('#sampleName').val().trim();
        const company = $('#companyName').val().trim();
        if (!name || !company) { AppUtils.showToast('提示', '请填写样品名称和企业名称', 'warning'); return false; }
        const data = {
          sampleName: name,
          companyName: company,
          productCategoryName: $('#sampleCategory').val(),
          certTypeCode: $('#sampleCert').val(),
          sampleAmount: parseInt($('#sampleAmount').val()) || 1,
          sampleModel: $('#sampleModel').val(),
          priority: $('#samplePriority').val(),
          remark: $('#sampleRemark').val()
        };
        try {
          const created = await ApiClient.sample.create(data);
          if (uploadedPhotos.length && created && created.id) {
            try { await ApiClient.sample.uploadPhotos(uploadedPhotos, created.id); } catch (e) { /* ignore */ }
          }
          AppUtils.closeModal(mask);
          AppUtils.showToast('登记成功', '样品已成功登记，追溯码：' + (created.sampleCode || created.id), 'success');
          this.load();
        } catch (e) {
          ApiClient.handleError(e, '登记失败');
        }
        return false;
      }
    });
    $('#photoUploadArea').on('click', () => $('#photoInput').trigger('click'));
    $('#photoInput').on('change', function() { uploadedPhotos = Array.from(this.files); });
  },

  async showDetailModal(id) {
    let s = null;
    try { s = await ApiClient.sample.getById(id); }
    catch (e) { ApiClient.handleError(e, '加载样品详情失败'); return; }
    if (!s) return;
    const content = `
      <div class="row g-3">
        <div class="col-12">
          <div style="background:linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02));border-radius:10px;padding:20px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="width:64px;height:64px;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>
              <div>
                <div style="font-size:18px;font-weight:600;">${s.sampleName || '-'}</div>
                <div style="font-family:monospace;color:var(--primary);font-size:14px;margin-top:4px;">追溯码: ${s.sampleCode || s.id}</div>
                <div style="margin-top:8px;">${AppUtils.getSampleStatusBadge((s.sampleStatus || 'RECEIVED').toLowerCase())} ${this.renderCertType(s.certTypeCode)} <span class="badge badge-secondary">${s.productCategoryName || '-'}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-6"><div style="padding:12px 0;border-bottom:1px solid var(--gray-100);"><div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">企业名称</div><div style="font-weight:500;">${s.companyName || '-'}</div></div></div>
        <div class="col-6"><div style="padding:12px 0;border-bottom:1px solid var(--gray-100);"><div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">样品型号</div><div style="font-weight:500;">${s.sampleModel || s.sampleCodeInternal || '-'}</div></div></div>
        <div class="col-6"><div style="padding:12px 0;border-bottom:1px solid var(--gray-100);"><div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">样品数量</div><div style="font-weight:500;">${s.sampleAmount || 0} ${s.sampleUnit || '件'}</div></div></div>
        <div class="col-6"><div style="padding:12px 0;border-bottom:1px solid var(--gray-100);"><div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">接收人</div><div style="font-weight:500;">${s.receiverName || '-'}</div></div></div>
        <div class="col-6"><div style="padding:12px 0;border-bottom:1px solid var(--gray-100);"><div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">接收日期</div><div style="font-weight:500;">${s.receiveTime ? AppUtils.formatDateTime(s.receiveTime, 'YYYY-MM-DD') : '-'}</div></div></div>
        <div class="col-6"><div style="padding:12px 0;border-bottom:1px solid var(--gray-100);"><div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">留样到期</div><div style="font-weight:500;color:var(--danger);">${s.retentionExpireDate ? AppUtils.formatDate(AppUtils.parseDateTime(s.retentionExpireDate)) : '-'}</div></div></div>
      </div>
    `;
    AppUtils.showModal({ title: '📋 样品详情', content, confirmText: '查看流转记录', onConfirm: () => { SamplesPage.showTimelineModal(id); }});
  },

  async showTimelineModal(id) {
    let logs = [];
    try { logs = await ApiClient.sample.flowLogs(id); }
    catch (e) { ApiClient.handleError(e, '加载流转记录失败'); return; }
    logs = logs || [];
    const content = logs.length ? `
      <div class="timeline">
        ${logs.map(l => `
          <div class="timeline-item ${l.flowStatus === 'DESTROYED' ? 'warning' : 'success'}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-time">${l.operationTime ? AppUtils.formatDateTime(l.operationTime) : '-'}</div>
              <div class="timeline-title">${l.flowStatusText || l.flowStatus || ''}</div>
              ${l.operationDesc ? `<div class="timeline-desc">${l.operationDesc}（操作人：${l.operatorName || '-'}）</div>` : `<div class="timeline-desc">操作人：${l.operatorName || '-'}</div>`}
            </div>
          </div>
        `).join('')}
      </div>
    ` : AppUtils.renderEmpty('暂无流转记录');
    AppUtils.showModal({ title: '🕐 样品流转记录', content, confirmText: '关闭', cancelText: '' });
  },

  confirmDestroy(id, code) {
    AppUtils.showModal({
      title: '🗑️ 销毁确认',
      content: `<div style="padding:16px 0;">确定要销毁样品 <b style="font-family:monospace;color:var(--primary);">${code}</b> 吗？留样未到期将无法销毁。<textarea id="destroyRemark" placeholder="销毁备注（选填）" class="form-control" rows="3" style="margin-top:12px;"></textarea></div>`,
      confirmText: '确认销毁',
      onConfirm: async () => {
        const remark = $('#destroyRemark').val().trim();
        try {
          await ApiClient.sample.destroy(id, remark);
          AppUtils.showToast('销毁成功', '样品已销毁并记录流转日志', 'success');
          this.load();
        } catch (e) {
          ApiClient.handleError(e, '销毁失败');
        }
      }
    });
  }
};
