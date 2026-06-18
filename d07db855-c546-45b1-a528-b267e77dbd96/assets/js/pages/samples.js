const SamplesPage = {
  render() {
    AppLayout.setPageHeader('样品管理', ['业务管理']);
    const samples = MockData.samples;

    const html = `
      <div class="card">
        <div class="filter-bar">
          <div class="filter-group">
            <select class="form-control" style="width:160px;">
            <option value="">全部状态</option>
            <option>已接收</option>
            <option>已登记</option>
            <option>检测中</option>
            <option>报告中</option>
            <option>已发证</option>
            </select>
            <select class="form-control" style="width:140px;">
            <option value="">全部类别</option>
            <option>电子电器</option>
            <option>机械装备</option>
            <option>建材家具</option>
            <option>汽车零部件</option>
            <option>食品接触</option>
            </select>
            <select class="form-control" style="width:120px;">
            <option value="">认证类型</option>
            <option>CCC</option>
            <option>CE</option>
            <option>ISO</option>
            </select>
          </div>
          <input type="text" class="form-control" placeholder="搜索样品名称/追溯码" style="width:220px;">
          <input type="date" class="form-control" type="date">
          <button class="btn btn-primary" id="addSampleBtn">➕ 样品登记</button>
          <button class="btn btn-outline-primary">📥 批量导入</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>追溯码</th>
                <th>样品名称</th>
                <th>企业名称</th>
                <th>产品类别</th>
                <th>认证类型</th>
                <th>数量</th>
                <th>接收人</th>
                <th>接收日期</th>
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
          <span style="font-size:13px;color:var(--gray-500);">共 ${samples.length} 条记录</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-sm btn-outline-primary" style="padding:4px 12px;">上一页</button>
            <button class="btn btn-sm btn-primary" style="padding:4px 12px;">1</button>
            <button class="btn btn-sm btn-outline-primary" style="padding:4px 12px;">2</button>
            <button class="btn btn-sm btn-outline-primary" style="padding:4px 12px;">3</button>
            <button class="btn btn-sm btn-outline-primary" style="padding:4px 12px;">下一页</button>
          </div>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  renderSampleRows(samples) {
    return samples.map(s => `
      <tr>
        <td style="font-family:monospace;color:var(--primary);font-weight:600;">${s.id}</td>
        <td style="font-weight:500;">${s.name}<div style="font-size:12px;color:var(--gray-400);">${s.code}</div></td>
        <td>${s.company}</td>
        <td><span class="badge badge-secondary">${s.category}</span></td>
        <td>${this.renderCertType(s.certType)}</td>
        <td>${s.amount} 件</td>
        <td>${AppUtils.getAvatar(s.receiver) + ' ' + s.receiver}</td>
        <td>${s.receiveDate}</td>
        <td>${AppUtils.getSampleStatusBadge(s.status)}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn" title="查看详情" data-id="${s.id}" data-action="view">👁️</button>
            <button class="action-btn" title="流转记录" data-id="${s.id}" data-action="timeline">🕐</button>
            <button class="action-btn danger" title="销毁" data-id="${s.id}" data-action="destroy">🗑️</button>
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
    const m = map[type] || { class: 'badge-secondary', text: type };
    return `<span class="badge ${m.class}">${m.text}</span>`;
  },

  bindEvents() {
    $('#addSampleBtn').on('click', () => this.showAddModal());

    $('body').on('click', '.action-btn[data-action="view"]', function() {
      SamplesPage.showDetailModal($(this).data('id'));
    });
    $('body').on('click', '.action-btn[data-action="timeline"]', function() {
      SamplesPage.showTimelineModal($(this).data('id'));
    });
    $('body').on('click', '.action-btn[data-action="destroy"]', function() {
      AppUtils.showToast('销毁确认', '确定销毁该样品？', 'warning');
    });
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
            <select placeholder=" " id="sampleCode">
            <option value=""></option>
            <option>上海正泰电器有限公司</option>
            <option>三一重工股份有限公司</option>
            <option>苏泊尔集团有限公司</option>
            <option>德尔未来科技控股</option>
            </select>
            <label>企业名称 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <select placeholder=" " id="sampleCategory">
            <option value=""></option>
            <option>电子电器</option>
            <option>机械装备</option>
            <option>建材家具</option>
            <option>汽车零部件</option>
            <option>食品接触</option>
            </select>
            <label>产品类别 *</label>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="floating-label">
            <select placeholder=" " id="sampleCert">
            <option value=""></option>
            <option>CCC</option>
            <option>CE</option>
            <option>ISO</option>
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
            <input type="text" placeholder=" " id="sampleReceiver" value="李娟">
            <label>接收人</label>
          </div>
        </div>
        <div class="col-12 col-sm-4">
          <div class="floating-label">
            <input type="date" placeholder=" " id="sampleExpire">
            <label>留样到期日</label>
          </div>
        </div>
        <div class="col-12">
          <div style="border:2px dashed var(--gray-200);border-radius:8px;padding:24px;text-align:center;cursor:pointer;color:var(--gray-500);" onmouseover="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)';this.style.color='var(--gray-500)'">
            <div style="font-size:36px;margin-bottom:8px;">📷</div>
            <div>点击上传样品照片（支持拍照或批量上传</div>
            <div style="font-size:12px;margin-top:4px;">支持 JPG/PNG，单张不超过10MB</div>
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
    const mask = AppUtils.showModal({
      title: '📦 样品登记',
      content,
      confirmText: '提交登记',
      onConfirm: () => {
        AppUtils.closeModal(mask);
        AppUtils.showToast('登记成功', '样品已成功登记，系统已生成唯一追溯码', 'success');
      }
    });
  },

  showDetailModal(id) {
    const s = MockData.getSampleById(id) || MockData.samples[0];
    const content = `
      <div class="row g-3">
        <div class="col-12">
        <div style="background:linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02);border-radius:10px;padding:20px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="width:64px;height:64px;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>
            <div>
              <div style="font-size:18px;font-weight:600;">${s.name}</div>
              <div style="font-family:monospace;color:var(--primary);font-size:14px;margin-top:4px;">追溯码: ${s.id}</div>
              <div style="margin-top:8px;">${AppUtils.getSampleStatusBadge(s.status)} ${this.renderCertType(s.certType)} <span class="badge badge-secondary">${s.category}</span></div>
            </div>
          </div>
        </div>
        </div>
        <div class="col-6">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">企业名称</div>
            <div style="font-weight:500;">${s.company}</div>
          </div>
        </div>
        <div class="col-6">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">样品编码</div>
            <div style="font-weight:500;">${s.code}</div>
          </div>
        </div>
        <div class="col-6">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">样品数量</div>
            <div style="font-weight:500;">${s.amount} 件</div>
          </div>
        </div>
        <div class="col-6">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">接收人</div>
            <div style="font-weight:500;">${s.receiver}</div>
          </div>
          </div>
        </div>
        <div class="col-6">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">接收日期</div>
            <div style="font-weight:500;">${s.receiveDate}</div>
          </div>
        </div>
        <div class="col-6">
          <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">留样到期</div>
            <div style="font-weight:500;color:var(--danger);">${s.expireDate}</div>
          </div>
        </div>
      </div>
      `;
    AppUtils.showModal({ title: '📋 样品详情', content, confirmText: '查看流转记录', onConfirm: () => { SamplesPage.showTimelineModal(id); }});
  },

  showTimelineModal(id) {
    const content = `
      <div class="timeline">
        ${MockData.sampleTimeline.map(t => `
          <div class="timeline-item ${t.status}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-time">${t.time}</div>
              <div class="timeline-title">${t.title}</div>
              ${t.desc ? `<div class="timeline-desc">${t.desc}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    AppUtils.showModal({ title: '🕐 样品流转记录', content, confirmText: '关闭', cancelText: '' });
  }
};
