/**
 * 实验室资源、数据追溯审计、统计分析报表页面。
 * 全部数据通过 ApiClient 调用后端 REST API 获取，无任何硬编码 Mock 数据。
 */
const LabPage = {
  equipments: [],
  technicians: [],
  trainings: [],
  abilityScopes: [],

  render() {
    AppLayout.setPageHeader('实验室资源', ['资源管理']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    try {
      this.equipments = await ApiClient.task.equipmentList() || [];
    } catch (e) { ApiClient.handleError(e, '加载设备列表失败'); }
    try {
      this.technicians = await ApiClient.task.technicianList() || [];
    } catch (e) { ApiClient.handleError(e, '加载技术员列表失败'); }
    try {
      this.trainings = await ApiClient.task.training.list() || [];
    } catch (e) { ApiClient.handleError(e, '加载培训记录失败'); this.trainings = []; }
    try {
      this.abilityScopes = await ApiClient.task.abilityScope.list() || [];
    } catch (e) { ApiClient.handleError(e, '加载能力范围失败'); this.abilityScopes = []; }
    this.renderPage();
  },

  renderPage() {
    const equipments = this.equipments;
    const technicians = this.technicians;

    const getEquipStatus = (s) => {
      const map = {
        RUNNING: { class: 'badge-success', text: '运行中' },
        MAINTENANCE: { class: 'badge-warning', text: '维护中' },
        IDLE: { class: 'badge-secondary', text: '空闲' },
        FAULT: { class: 'badge-danger', text: '故障' }
      };
      const m = map[(s || 'IDLE').toUpperCase()] || map.IDLE;
      return `<span class="badge ${m.class}">${m.text}</span>`;
    };

    const getTechStatus = (s) => {
      const map = {
        BUSY: 'badge-danger', NORMAL: 'badge-success', LEAVE: 'badge-secondary', IDLE: 'badge-success'
      };
      const text = { BUSY: '工作中', NORMAL: '空闲', LEAVE: '休假', IDLE: '空闲' };
      const key = (s || 'IDLE').toUpperCase();
      return `<span class="badge ${map[key] || 'badge-secondary'}">${text[key] || '未知'}</span>`;
    };

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🔬 检测设备</h3>
          <span style="font-size:13px;color:var(--gray-500);">共 ${equipments.length} 台设备</span>
        </div>
        <div class="row g-3" style="padding:20px;">
          ${equipments.length ? equipments.map(e => {
            const nextCal = e.nextCalibrationDate || e.nextCalDate || e.nextCal;
            const lastCal = e.lastCalibrationDate || e.lastCalDate || e.lastCal;
            const daysToCal = nextCal ? Math.ceil((AppUtils.parseDateTime(nextCal) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const calStatus = daysToCal === null ? 'secondary' : daysToCal < 0 ? 'danger' : daysToCal <= 30 ? 'warning' : 'success';
            const load = e.loadRate || e.currentLoad || e.load || 0;
            return `
            <div class="col-12 col-sm-6 col-lg-4">
              <div style="border:1px solid var(--gray-200);border-radius:10px;padding:16px;background:#fff;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                  <div style="width:44px;height:44px;border-radius:10px;background:rgba(37,99,235,0.1);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:22px;">⚙️</div>
                  <div style="flex:1;">
                    <div style="font-weight:600;">${e.equipmentName || e.name || '-'}</div>
                    <div style="font-size:12px;color:var(--gray-500);font-family:monospace;">${e.equipmentCode || e.code || '-'}</div>
                  </div>
                  ${getEquipStatus(e.equipmentStatus || e.status)}
                </div>
                <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px;">所属实验室：<span style="color:var(--gray-700);">${e.labName || e.lab || '-'}</span></div>
                <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px;">上次校准：<span style="color:var(--gray-700);">${lastCal ? AppUtils.formatDateTime(lastCal, 'YYYY-MM-DD') : '-'}</span></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:12px;color:var(--gray-500);">下次校准: ${nextCal ? AppUtils.formatDateTime(nextCal, 'YYYY-MM-DD') : '-'}</span>
                  ${daysToCal !== null ? `<span style="font-size:12px;color:var(--${calStatus});font-weight:600;">${daysToCal < 0 ? '已超期' : daysToCal + '天后到期'}</span>` : ''}
                </div>
                <div class="progress">
                  <div class="progress-bar ${load > 70 ? 'danger' : ''}" style="width:${load}%;"></div>
                </div>
              </div>
            </div>
            `;
          }).join('') : `<div class="col-12">${AppUtils.renderEmpty('暂无设备数据，请确认后端服务已启动')}</div>`}
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">👨‍🔬 技术人员</h3>
          <span style="font-size:13px;color:var(--gray-500);">共 ${technicians.length} 人</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>所属实验室</th>
                <th>职称</th>
                <th class="col-hide-lg">专业技能</th>
                <th class="col-hide-md">资质证书</th>
                <th>状态</th>
                <th>工作负载</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${technicians.length ? technicians.map(t => {
                const name = t.technicianName || t.name || '-';
                const lab = t.labName || t.lab || '-';
                const title = t.title || t.professionalTitle || '-';
                const skills = t.skills || t.skillTags || [];
                const certs = t.certCount || t.certificateCount || 0;
                const status = t.workStatus || t.status || 'IDLE';
                const workload = t.workload || t.currentLoad || 0;
                return `
                <tr>
                  <td style="font-weight:500;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      ${AppUtils.getAvatar(name)}
                      ${name}
                    </div>
                  </td>
                  <td>${lab}</td>
                  <td>${title}</td>
                  <td class="col-hide-lg">
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      ${Array.isArray(skills) ? skills.map(s => `<span class="badge badge-secondary">${typeof s === 'string' ? s : (s.name || s.skillName || '-')}</span>`).join('') : (skills || '-')}
                    </div>
                  </td>
                  <td class="col-hide-md" style="text-align:center;font-weight:600;">${certs} 个</td>
                  <td>${getTechStatus(status)}</td>
                  <td style="width:180px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="progress" style="flex:1;margin:0;">
                        <div class="progress-bar ${workload > 70 ? 'danger' : ''}" style="width:${workload}%;"></div>
                      </div>
                      <span style="font-size:12px;color:var(--gray-600);min-width:36px;">${workload}%</span>
                    </div>
                  </td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="查看" onclick="AppUtils.showToast('提示','技术员详情待开发','warning')">👁️</button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('') : `<tr><td colspan="8">${AppUtils.renderEmpty('暂无技术员数据')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🎓 培训记录</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:13px;color:var(--gray-500);">共 ${trainings.length} 条</span>
            <button class="btn btn-primary btn-sm" onclick="LabPage.showTrainingModal()">➕ 新建培训</button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:70px;">ID</th>
                <th>培训主题</th>
                <th class="col-hide-md">技术员</th>
                <th class="col-hide-lg">讲师</th>
                <th>培训日期</th>
                <th class="col-hide-md">学时</th>
                <th class="col-hide-lg">证书</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${trainings.length ? trainings.map(t => {
                const td = t.trainingDate ? AppUtils.formatDateTime(t.trainingDate, 'YYYY-MM-DD') : '-';
                const tech = t.technicianId ? (t.technicianName || ('技术员#' + t.technicianId)) : '-';
                const certLink = t.certificateUrl
                  ? `<a href="${t.certificateUrl}" target="_blank" style="color:var(--primary);">查看</a>`
                  : '<span style="color:var(--gray-400);">未上传</span>';
                return `
                <tr>
                  <td style="font-family:monospace;font-size:12px;color:var(--primary);">${t.id || '-'}</td>
                  <td style="font-weight:500;">${t.trainingTitle || '-'}</td>
                  <td class="col-hide-md">${tech}</td>
                  <td class="col-hide-lg">${t.trainer || '-'}</td>
                  <td>${td}</td>
                  <td class="col-hide-md" style="text-align:center;">${t.trainingHours || 0} 学时</td>
                  <td class="col-hide-lg">${certLink}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="编辑" onclick="LabPage.showTrainingModal(${t.id})">✏️</button>
                      <button class="action-btn" title="删除" onclick="LabPage.deleteTraining(${t.id})">🗑️</button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('') : `<tr><td colspan="8">${AppUtils.renderEmpty('暂无培训记录，点击右上角「新建培训」创建')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📋 实验室能力范围维护</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:13px;color:var(--gray-500);">共 ${abilityScopes.length} 项</span>
            <button class="btn btn-primary btn-sm" onclick="LabPage.showAbilityScopeModal()">➕ 新增能力项</button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:90px;">认可编号</th>
                <th>标准号</th>
                <th class="col-hide-md">标准名称</th>
                <th>检测项目范围</th>
                <th class="col-hide-md">认可日期</th>
                <th class="col-hide-lg">到期日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${abilityScopes.length ? abilityScopes.map(a => {
                const accDate = a.accreditationDate ? AppUtils.formatDateTime(a.accreditationDate, 'YYYY-MM-DD') : '-';
                const expDate = a.expireDate ? AppUtils.formatDateTime(a.expireDate, 'YYYY-MM-DD') : '-';
                const stMap = {
                  ACTIVE: { class: 'badge-success', text: '有效' },
                  EXPIRED: { class: 'badge-danger', text: '已过期' },
                  PENDING: { class: 'badge-warning', text: '待认可' },
                  SUSPENDED: { class: 'badge-secondary', text: '暂停' }
                };
                const st = a.status || 'ACTIVE';
                const sm = stMap[st.toUpperCase()] || { class: 'badge-secondary', text: st };
                const daysToExpire = a.expireDate ? Math.ceil((AppUtils.parseDateTime(a.expireDate) - new Date()) / (1000*60*60*24)) : null;
                const expireWarn = daysToExpire !== null && daysToExpire <= 90 && daysToExpire > 0;
                const expireBadge = expireWarn ? ' <span class="badge badge-warning" style="margin-left:4px;">⚠️ ' + daysToExpire + '天后过期</span>' : '';
                return `
                <tr>
                  <td style="font-family:monospace;font-size:12px;color:var(--primary);">${a.accreditationNo || a.id || '-'}</td>
                  <td style="font-weight:500;">${a.standardCode || '-'}</td>
                  <td class="col-hide-md">${a.standardName || '-'}</td>
                  <td>${a.testItemScope || '-'}</td>
                  <td class="col-hide-md">${accDate}</td>
                  <td class="col-hide-lg">${expDate}${expireBadge}</td>
                  <td><span class="badge ${sm.class}">${sm.text}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn" title="编辑" onclick="LabPage.showAbilityScopeModal(${a.id})">✏️</button>
                      <button class="action-btn" title="删除" onclick="LabPage.deleteAbilityScope(${a.id})">🗑️</button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('') : `<tr><td colspan="8">${AppUtils.renderEmpty('暂无能力范围数据，点击右上角「新增能力项」创建')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
  },

  showTrainingModal(id) {
    const isEdit = !!id;
    let t = null;
    if (isEdit) {
      t = this.trainings.find(x => x.id === id);
      if (!t) { AppUtils.showToast('错误', '未找到培训记录', 'error'); return; }
    }
    const today = new Date().toISOString().substring(0, 10);
    const html = `
      <div style="display:grid;gap:12px;">
        <div class="floating-label">
          <input type="text" id="trnTitle" placeholder=" " value="${t ? (t.trainingTitle || '') : ''}">
          <label>培训主题 *</label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="floating-label">
            <input type="number" id="trnTech" placeholder=" " value="${t ? (t.technicianId || '') : ''}">
            <label>技术员ID</label>
          </div>
          <div class="floating-label">
            <input type="number" id="trnHours" placeholder=" " value="${t ? (t.trainingHours || 8) : 8}">
            <label>学时 *</label>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="floating-label">
            <input type="text" id="trnTrainer" placeholder=" " value="${t ? (t.trainer || '') : ''}">
            <label>讲师</label>
          </div>
          <div class="floating-label">
            <input type="date" id="trnDate" placeholder=" " value="${t ? (String(t.trainingDate || '').substring(0,10) || today) : today}">
            <label>培训日期</label>
          </div>
        </div>
        <div class="floating-label">
          <textarea id="trnContent" placeholder=" " style="height:90px;resize:vertical;">${t ? (t.trainingContent || '') : ''}</textarea>
          <label>培训内容</label>
        </div>
        <div class="floating-label">
          <input type="text" id="trnCertUrl" placeholder=" " value="${t ? (t.certificateUrl || '') : ''}">
          <label>证书URL（可选）</label>
        </div>
      </div>
    `;
    const mask = AppUtils.showModal({
      title: (isEdit ? '✏️ 编辑培训记录' : '➕ 新建培训'),
      content: html,
      confirmText: '保存',
      cancelText: '取消',
      width: '520px',
      onConfirm: async () => {
        const payload = {
          trainingTitle: $('#trnTitle').val().trim(),
          technicianId: Number($('#trnTech').val()) || null,
          trainer: $('#trnTrainer').val().trim() || null,
          trainingHours: Number($('#trnHours').val()) || 0,
          trainingDate: $('#trnDate').val(),
          trainingContent: $('#trnContent').val().trim() || null,
          certificateUrl: $('#trnCertUrl').val().trim() || null
        };
        if (!payload.trainingTitle) { AppUtils.showToast('提示', '请填写培训主题', 'warning'); return false; }
        if (isEdit) payload.id = id;
        try {
          if (isEdit) await ApiClient.task.training.update(payload);
          else await ApiClient.task.training.create(payload);
          AppUtils.closeModal(mask);
          AppUtils.showToast('成功', isEdit ? '培训记录已更新' : '培训记录已创建', 'success');
          await this.load();
        } catch (e) { ApiClient.handleError(e, '保存培训记录失败'); return false; }
        return false;
      }
    });
  },

  async deleteTraining(id) {
    if (!confirm('确定删除该培训记录吗？此操作不可恢复。')) return;
    try {
      await ApiClient.task.training.remove(id);
      AppUtils.showToast('成功', '培训记录已删除', 'success');
      await this.load();
    } catch (e) { ApiClient.handleError(e, '删除培训记录失败'); }
  },

  showAbilityScopeModal(id) {
    const isEdit = !!id;
    let a = null;
    if (isEdit) {
      a = this.abilityScopes.find(x => x.id === id);
      if (!a) { AppUtils.showToast('错误', '未找到能力范围记录', 'error'); return; }
    }
    const today = new Date().toISOString().substring(0, 10);
    const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 3);
    const html = `
      <div style="display:grid;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="floating-label">
            <input type="number" id="ascLabId" placeholder=" " value="${a ? (a.labId || '') : ''}">
            <label>实验室ID</label>
          </div>
          <div class="floating-label">
            <input type="number" id="ascCategoryId" placeholder=" " value="${a ? (a.productCategoryId || '') : ''}">
            <label>产品类别ID</label>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="floating-label">
            <input type="number" id="ascCertTypeId" placeholder=" " value="${a ? (a.certTypeId || '') : ''}">
            <label>认证类型ID</label>
          </div>
          <div class="floating-label">
            <input type="text" id="ascAccNo" placeholder=" " value="${a ? (a.accreditationNo || '') : ''}">
            <label>认可编号 *</label>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="floating-label">
            <input type="text" id="ascStdCode" placeholder=" " value="${a ? (a.standardCode || '') : ''}">
            <label>标准号 *</label>
          </div>
          <div class="floating-label">
            <input type="text" id="ascStdName" placeholder=" " value="${a ? (a.standardName || '') : ''}">
            <label>标准名称 *</label>
          </div>
        </div>
        <div class="floating-label">
          <textarea id="ascScope" placeholder=" " style="height:80px;resize:vertical;">${a ? (a.testItemScope || '') : ''}</textarea>
          <label>检测项目范围 *</label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div class="floating-label">
            <input type="date" id="ascAccDate" placeholder=" " value="${a ? (String(a.accreditationDate || '').substring(0,10) || today) : today}">
            <label>认可日期</label>
          </div>
          <div class="floating-label">
            <input type="date" id="ascExpDate" placeholder=" " value="${a ? (String(a.expireDate || '').substring(0,10) || '') : nextYear.toISOString().substring(0,10)}">
            <label>到期日期</label>
          </div>
          <div class="floating-label">
            <select id="ascStatus" style="padding:10px 12px;">
              <option value="ACTIVE" ${a && a.status==='ACTIVE'?'selected':''}>有效</option>
              <option value="PENDING" ${a && a.status==='PENDING'?'selected':''}>待认可</option>
              <option value="EXPIRED" ${a && a.status==='EXPIRED'?'selected':''}>已过期</option>
              <option value="SUSPENDED" ${a && a.status==='SUSPENDED'?'selected':''}>暂停</option>
            </select>
            <label>状态</label>
          </div>
        </div>
      </div>
    `;
    const mask = AppUtils.showModal({
      title: (isEdit ? '✏️ 编辑能力范围' : '➕ 新增能力项'),
      content: html,
      confirmText: '保存',
      cancelText: '取消',
      width: '580px',
      onConfirm: async () => {
        const payload = {
          labId: Number($('#ascLabId').val()) || null,
          productCategoryId: Number($('#ascCategoryId').val()) || null,
          certTypeId: Number($('#ascCertTypeId').val()) || null,
          accreditationNo: $('#ascAccNo').val().trim(),
          standardCode: $('#ascStdCode').val().trim(),
          standardName: $('#ascStdName').val().trim(),
          testItemScope: $('#ascScope').val().trim(),
          accreditationDate: $('#ascAccDate').val(),
          expireDate: $('#ascExpDate').val(),
          status: $('#ascStatus').val() || 'ACTIVE'
        };
        if (!payload.accreditationNo || !payload.standardCode || !payload.standardName || !payload.testItemScope) {
          AppUtils.showToast('提示', '请填写认可编号、标准号、标准名称、检测范围', 'warning'); return false;
        }
        if (isEdit) payload.id = id;
        try {
          if (isEdit) await ApiClient.task.abilityScope.update(payload);
          else await ApiClient.task.abilityScope.create(payload);
          AppUtils.closeModal(mask);
          AppUtils.showToast('成功', isEdit ? '能力范围已更新' : '能力范围已创建', 'success');
          await this.load();
        } catch (e) { ApiClient.handleError(e, '保存能力范围失败'); return false; }
        return false;
      }
    });
  },

  async deleteAbilityScope(id) {
    if (!confirm('确定删除该能力范围吗？此操作不可恢复。')) return;
    try {
      await ApiClient.task.abilityScope.remove(id);
      AppUtils.showToast('成功', '能力范围已删除', 'success');
      await this.load();
    } catch (e) { ApiClient.handleError(e, '删除能力范围失败'); }
  }
};

const TracePage = {
  auditLogs: [],

  render() {
    AppLayout.setPageHeader('数据追溯与审计', ['资源管理']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    try {
      this.auditLogs = await ApiClient.analytics.auditLogs() || [];
    } catch (e) {
      ApiClient.handleError(e, '加载审计日志失败');
      this.auditLogs = [];
    }
    this.renderPage();
  },

  renderPage() {
    const logs = this.auditLogs;

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🔍 追溯码查询</h3>
        </div>
        <div class="card-body">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
            <div style="flex:1;min-width:300px;">
              <input type="text" class="form-control" id="traceCodeInput" placeholder="请输入样品追溯码或任务编号" style="width:100%;height:44px;font-size:15px;">
            </div>
            <button class="btn btn-primary" style="height:44px;padding:0 24px;" id="traceSearchBtn">🔍 开始追溯</button>
            <button class="btn btn-outline-primary" style="height:44px;" id="verifyIntegrityBtn">🛡️ 完整性校验</button>
          </div>
        </div>
      </div>

      <div class="card mb-4" id="traceResultCard" style="display:none;">
        <div class="card-header">
          <h3 class="card-title">📦 追溯结果</h3>
          <span class="badge badge-info" id="traceBadge">查询中</span>
        </div>
        <div class="card-body">
          <div id="traceResultBody">${AppUtils.renderLoading()}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📝 操作日志审计</h3>
          <span style="font-size:13px;color:var(--gray-500);">共 ${logs.length} 条记录</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>日志编号</th>
                <th>操作人</th>
                <th>操作类型</th>
                <th>操作对象</th>
                <th>操作时间</th>
                <th class="col-hide-md">IP地址</th>
                <th class="col-hide-lg">操作详情</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length ? logs.map(l => `
                <tr>
                  <td style="font-family:monospace;font-size:12px;color:var(--primary);">${l.id || '-'}</td>
                  <td>${l.user || l.operator || l.username ? AppUtils.getAvatar(l.user || l.operator || l.username) + ' ' + (l.user || l.operator || l.username) : '-'}</td>
                  <td><span class="badge badge-info">${l.action || l.operationType || '-'}</span></td>
                  <td style="font-family:monospace;">${l.target || l.operationTarget || '-'}</td>
                  <td>${l.time ? AppUtils.formatDateTime(l.time) : (l.createTime ? AppUtils.formatDateTime(l.createTime) : '-')}</td>
                  <td class="col-hide-md" style="font-family:monospace;font-size:12px;">${l.ip || l.ipAddress || '-'}</td>
                  <td class="col-hide-lg" style="color:var(--gray-600);">${l.detail || l.description || '-'}</td>
                </tr>
              `).join('') : `<tr><td colspan="7">${AppUtils.renderEmpty('暂无审计日志')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
    this.bindEvents();
  },

  bindEvents() {
    $('#traceSearchBtn').on('click', () => this.doTraceSearch());
    $('#verifyIntegrityBtn').on('click', () => this.doVerifyIntegrity());
    $('#traceCodeInput').on('keydown', function(e) {
      if (e.which === 13) TracePage.doTraceSearch();
    });
  },

  async doTraceSearch() {
    const code = $('#traceCodeInput').val().trim();
    if (!code) { AppUtils.showToast('提示', '请输入追溯码', 'warning'); return; }

    $('#traceResultCard').show();
    $('#traceBadge').attr('class', 'badge badge-info').text('查询中');
    $('#traceResultBody').html(AppUtils.renderLoading());

    let sample = null;
    try {
      sample = await ApiClient.sample.getById(code);
    } catch (e) {
      try {
        const page = await ApiClient.sample.list({ keyword: code, current: 1, size: 1 });
        sample = page && page.records && page.records[0];
      } catch (e2) {
        ApiClient.handleError(e2, '追溯查询失败');
        $('#traceBadge').attr('class', 'badge badge-danger').text('查询失败');
        $('#traceResultBody').html(AppUtils.renderEmpty('追溯查询失败，请确认后端服务已启动'));
        return;
      }
    }

    if (!sample) {
      $('#traceBadge').attr('class', 'badge badge-warning').text('未找到');
      $('#traceResultBody').html(AppUtils.renderEmpty('未找到追溯码 ' + code + ' 对应的样品记录'));
      return;
    }

    $('#traceBadge').attr('class', 'badge badge-success').text('追溯成功');
    $('#traceResultBody').html(`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
        <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">样品名称</div>
          <div style="font-weight:600;">${sample.sampleName || '-'}</div>
        </div>
        <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">委托企业</div>
          <div style="font-weight:600;">${sample.companyName || '-'}</div>
        </div>
        <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">认证类型</div>
          <div style="font-weight:600;">${sample.certTypeCode || '-'} 认证</div>
        </div>
        <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">当前状态</div>
          <div style="font-weight:600;color:var(--warning);">${AppUtils.getSampleStatusBadge((sample.sampleStatus || 'RECEIVED').toLowerCase())}</div>
        </div>
      </div>
      <h4 style="font-size:15px;margin-bottom:16px;">🔗 样品基础信息</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
        <div style="padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;"><span style="color:var(--gray-500);">追溯码：</span>${sample.sampleCode || '-'}</div>
        <div style="padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;"><span style="color:var(--gray-500);">规格型号：</span>${sample.sampleModel || '-'}</div>
        <div style="padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;"><span style="color:var(--gray-500);">产品类别：</span>${sample.productCategoryName || '-'}</div>
        <div style="padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;"><span style="color:var(--gray-500);">数量：</span>${sample.sampleAmount || 0} ${sample.sampleUnit || '件'}</div>
        <div style="padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;"><span style="color:var(--gray-500);">接收人：</span>${sample.receiverName || '-'}</div>
        <div style="padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;"><span style="color:var(--gray-500);">接收日期：</span>${sample.receiveTime ? AppUtils.formatDateTime(sample.receiveTime, 'YYYY-MM-DD') : '-'}</div>
      </div>
      <div style="margin-top:16px;padding:12px;background:rgba(37,99,235,0.05);border-radius:8px;font-size:13px;color:var(--gray-600);">
        💡 提示：流转记录详情可在「样品管理」页面查看完整时间线。
      </div>
    `);
  },

  async doVerifyIntegrity() {
    const code = $('#traceCodeInput').val().trim();
    if (!code) { AppUtils.showToast('提示', '请输入任务编号进行完整性校验', 'warning'); return; }

    AppUtils.showToast('完整性校验', '正在校验原始记录哈希链...', 'success');
    let result = null;
    try {
      result = await ApiClient.analytics.verifyIntegrity(code);
    } catch (e) {
      ApiClient.handleError(e, '完整性校验失败');
      return;
    }

    const valid = result && (result.verified === true || result.valid === true || result.integrity === true);
    const total = result && (result.totalRecords || result.count || 0);
    const broken = result && (result.brokenLinks || result.brokenCount || 0);
    const detail = result && (result.detail || result.message || '');

    AppUtils.showModal({
      title: '🛡️ 防篡改完整性校验结果',
      content: `
        <div style="padding:12px 0;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:48px;">${valid ? '✅' : '⚠️'}</div>
            <div style="font-size:18px;font-weight:600;margin-top:8px;color:${valid ? 'var(--success)' : 'var(--warning)'};">${valid ? '校验通过：哈希链完整' : '校验异常：存在断裂记录'}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="padding:16px;background:var(--gray-50);border-radius:8px;text-align:center;">
              <div style="font-size:24px;font-weight:700;color:var(--primary);">${total}</div>
              <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">原始记录总数</div>
            </div>
            <div style="padding:16px;background:var(--gray-50);border-radius:8px;text-align:center;">
              <div style="font-size:24px;font-weight:700;color:${broken > 0 ? 'var(--danger)' : 'var(--success)'};">${broken}</div>
              <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">断裂记录数</div>
            </div>
          </div>
          ${detail ? `<div style="padding:12px;background:var(--gray-50);border-radius:8px;font-size:13px;color:var(--gray-600);line-height:1.8;">${detail}</div>` : ''}
        </div>
      `,
      confirmText: '关闭',
      cancelText: ''
    });
  }
};

const AnalyticsPage = {
  stats: null,
  revenueStats: null,
  enterpriseFrequency: null,

  render() {
    AppLayout.setPageHeader('统计分析报表', ['统计分析']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    try {
      const [stats, revenue, freq] = await Promise.all([
        ApiClient.analytics.dashboardStats().catch(() => null),
        ApiClient.analytics.revenueStats().catch(() => null),
        ApiClient.analytics.enterpriseFrequency().catch(() => null)
      ]);
      this.stats = stats || {};
      this.revenueStats = revenue || {};
      this.enterpriseFrequency = freq || {};
    } catch (e) {
      ApiClient.handleError(e, '加载统计数据失败');
      $('#pageContent').html(AppUtils.renderEmpty('统计数据加载失败，请确认后端服务已启动'));
      return;
    }
    this.renderPage();
  },

  renderPage() {
    const stats = this.stats || {};
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

    const totalSamples = stats.totalSamples || 0;
    const passReports = stats.passReports || 0;
    const overdueTasks = stats.overdueTasks || 0;
    const expiringCerts = stats.expiringCerts || 0;
    const validCerts = stats.validCertificates || 0;
    const passRate = stats.passRate || 0;
    const avgTurnaround = stats.avgTurnaroundDays || 0;

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">📊 业务总览报表</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline-primary btn-sm" onclick="AppUtils.showToast('提示','报表导出功能开发中','warning')">📥 导出Excel</button>
            <button class="btn btn-primary btn-sm" onclick="window.print()">🖨️ 打印报表</button>
          </div>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">样品总量</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">${totalSamples.toLocaleString()}</div>
                <div style="font-size:12px;color:var(--success);margin-top:4px;">数据库实时聚合</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">合格报告数</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">${passReports.toLocaleString()}</div>
                <div style="font-size:12px;color:var(--success);margin-top:4px;">合格率 ${passRate.toFixed(1)}%</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">平均检测周期</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">${avgTurnaround.toFixed(1)} 天</div>
                <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">基于已完成任务计算</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">有效证书</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">${validCerts.toLocaleString()}</div>
                <div style="font-size:12px;color:${expiringCerts > 0 ? 'var(--warning)' : 'var(--gray-400)'};margin-top:4px;">${expiringCerts > 0 ? '⚠️ ' + expiringCerts + '张即将到期' : '暂无即将到期'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-8">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📈 月度检测量趋势</h3>
            </div>
            <div class="card-body">
              <div class="chart-container" style="height:280px;">
                ${monthly.length ? this.renderBarChart(monthly) : AppUtils.renderEmpty('暂无月度数据')}
              </div>
              <div class="chart-legend">
                <div class="chart-legend-item"><div class="chart-legend-color" style="background:var(--primary);"></div>检测批次</div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">🏭 产品类别分布</h3>
            </div>
            <div class="card-body">
              ${category.length ? this.renderCategoryPie(category) : AppUtils.renderEmpty('暂无类别数据')}
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">⏰ 超期预警分析</h3>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--danger);">${overdueTasks}</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">已超期任务</div>
                </div>
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--warning);">${expiringCerts}</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">60天内到期证书</div>
                </div>
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--success);">${passReports}</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">合格报告数</div>
                </div>
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--primary);">${validCerts}</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">有效证书数</div>
                </div>
              </div>
              <div style="margin-top:16px;padding:12px;background:rgba(37,99,235,0.05);border-radius:8px;font-size:13px;color:var(--gray-600);line-height:1.8;">
                📋 当前合格率：<span style="font-weight:700;color:var(--success);">${passRate.toFixed(1)}%</span> · 平均检测周期：<span style="font-weight:700;color:var(--primary);">${avgTurnaround.toFixed(1)}天</span>
                ${overdueTasks > 0 ? `<br>⚠️ 有 <span style="color:var(--danger);font-weight:700;">${overdueTasks}</span> 个超期任务已触发自动升级提醒` : ''}
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">📊 检测合格率分析</h3>
            </div>
            <div class="card-body">
              <div style="display:flex;align-items:center;gap:24px;height:260px;">
                <svg width="180" height="180" viewBox="0 0 180 180">
                  ${this.renderGaugeArc(passRate)}
                  <text x="90" y="86" text-anchor="middle" font-size="12" fill="#64748b">合格率</text>
                  <text x="90" y="108" text-anchor="middle" font-size="24" font-weight="700" fill="${passRate >= 90 ? '#10b981' : passRate >= 70 ? '#f59e0b' : '#ef4444'}">${passRate.toFixed(1)}%</text>
                </svg>
                <div style="flex:1;">
                  <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
                    <div style="font-size:13px;color:var(--gray-500);">合格报告</div>
                    <div style="font-size:22px;font-weight:700;color:var(--success);margin-top:4px;">${passReports}</div>
                  </div>
                  <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
                    <div style="font-size:13px;color:var(--gray-500);">样品总量</div>
                    <div style="font-size:22px;font-weight:700;color:var(--primary);margin-top:4px;">${totalSamples}</div>
                  </div>
                  <div style="padding:12px 0;">
                    <div style="font-size:13px;color:var(--gray-500);">平均周期</div>
                    <div style="font-size:22px;font-weight:700;color:var(--warning);margin-top:4px;">${avgTurnaround.toFixed(1)}天</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${this.renderRevenueSection(this.revenueStats)}

      ${this.renderEnterpriseFrequencySection(this.enterpriseFrequency)}
    `;

    $('#pageContent').html(html);
  },

  renderBarChart(data) {
    const max = Math.max(...data.map(d => d.samples), 1);
    return `
      <div style="display:flex;align-items:flex-end;gap:8px;height:240px;padding:0 8px;">
        ${data.map(d => {
          const h = (d.samples / max) * 100;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;padding-top:20px;">
              <div style="font-size:11px;color:var(--gray-600);font-weight:600;">${d.samples}</div>
              <div style="width:100%;height:${h}%;background:linear-gradient(180deg,var(--primary),var(--primary-light));border-radius:4px 4px 0 0;"></div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        ${data.map(d => `<div style="flex:1;text-align:center;font-size:12px;color:var(--gray-500);">${d.month}</div>`).join('')}
      </div>
    `;
  },

  renderCategoryPie(data) {
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
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <div class="chart-legend-item"><div class="chart-legend-color" style="background:${d.color};"></div>${d.name}</div>
                <span style="font-weight:600;">${d.value} (${d.percent}%)</span>
              </div>
              <div class="progress" style="height:6px;"><div style="width:${d.percent}%;height:100%;background:${d.color};border-radius:3px;"></div></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderGaugeArc(percent) {
    const r = 70;
    const cx = 90, cy = 90;
    const polarToCartesian = (r, angle) => ({ x: cx + r * Math.cos((angle - 90) * Math.PI / 180), y: cy + r * Math.sin((angle - 90) * Math.PI / 180) });
    const endAngle = (percent / 100) * 270;
    const bgEnd = polarToCartesian(r, 270);
    const bgPath = `M ${polarToCartesian(r, 0).x} ${polarToCartesian(r, 0).y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;
    const fillEnd = polarToCartesian(r, endAngle);
    const largeArc = endAngle > 180 ? 1 : 0;
    const fillPath = endAngle > 0 ? `M ${polarToCartesian(r, 0).x} ${polarToCartesian(r, 0).y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}` : '';
    const color = percent >= 90 ? '#10b981' : percent >= 70 ? '#f59e0b' : '#ef4444';
    return `
      <path d="${bgPath}" fill="none" stroke="#e2e8f0" stroke-width="14" stroke-linecap="round"/>
      ${fillPath ? `<path d="${fillPath}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>` : ''}
    `;
  },

  renderRevenueSection(r) {
    r = r || {};
    const total = Number(r.totalRevenue || 0);
    const last30 = Number(r.revenueLast30Days || 0);
    const thisYear = Number(r.revenueThisYear || 0);
    const fmt = (v) => '¥ ' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const monthly = (r.monthlyRevenueTrend || []).map(m => ({
      month: String(m.month || '').substring(5) || m.month,
      revenue: Number(m.revenue || 0),
      count: Number(m.count || 0)
    }));
    const byMethod = (r.revenueByPaymentMethod || []).map(x => ({
      method: x.method || '未分类',
      revenue: Number(x.revenue || 0),
      count: Number(x.count || 0)
    }));
    const totalMethod = byMethod.reduce((s, x) => s + x.revenue, 0) || 1;
    const methodColors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    return `
      <div class="card mb-4" style="margin-top:24px;">
        <div class="card-header">
          <h3 class="card-title">💵 收入分析报表</h3>
          <span style="font-size:13px;color:var(--gray-500);">基于 payment_record 聚合数据</span>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12 col-md-6 col-lg-4">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">历史总收入</div>
                <div style="font-size:26px;font-weight:700;margin-top:8px;color:var(--success);">${fmt(total)}</div>
                <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">累计所有支付记录</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-4">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(37,99,235,0.1), rgba(37,99,235,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">近30天收入</div>
                <div style="font-size:26px;font-weight:700;margin-top:8px;color:var(--primary);">${fmt(last30)}</div>
                <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">当月回款情况</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-4">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">本年度收入</div>
                <div style="font-size:26px;font-weight:700;margin-top:8px;color:var(--warning);">${fmt(thisYear)}</div>
                <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">1月1日至今累计</div>
              </div>
            </div>
          </div>

          <div class="row g-3" style="margin-top:8px;">
            <div class="col-12 col-lg-8">
              <div class="card" style="border:1px solid var(--gray-200);box-shadow:none;">
                <div class="card-header" style="border-bottom:1px solid var(--gray-100);padding:12px 16px;">
                  <h3 class="card-title" style="font-size:15px;">📈 月度收入趋势</h3>
                </div>
                <div class="card-body" style="padding:16px;">
                  <div style="height:260px;">
                    ${monthly.length ? this.renderRevenueBarChart(monthly) : AppUtils.renderEmpty('暂无月度收入数据')}
                  </div>
                </div>
              </div>
            </div>
            <div class="col-12 col-lg-4">
              <div class="card h-100" style="border:1px solid var(--gray-200);box-shadow:none;">
                <div class="card-header" style="border-bottom:1px solid var(--gray-100);padding:12px 16px;">
                  <h3 class="card-title" style="font-size:15px;">💳 支付方式分布</h3>
                </div>
                <div class="card-body" style="padding:16px;">
                  ${byMethod.length ? `
                    <div style="height:260px;overflow:auto;">
                      ${byMethod.map((m, i) => {
                        const pct = Math.round(m.revenue / totalMethod * 100);
                        const c = methodColors[i % methodColors.length];
                        return `
                        <div style="margin-bottom:14px;">
                          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                            <div class="chart-legend-item"><div class="chart-legend-color" style="background:${c};"></div>${m.method}</div>
                            <span style="font-weight:600;">${fmt(m.revenue)} (${pct}%)</span>
                          </div>
                          <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px;">笔数：${m.count} 笔</div>
                          <div class="progress" style="height:6px;"><div style="width:${pct}%;height:100%;background:${c};border-radius:3px;"></div></div>
                        </div>
                        `;
                      }).join('')}
                    </div>
                  ` : AppUtils.renderEmpty('暂无支付方式数据')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderRevenueBarChart(data) {
    const max = Math.max(...data.map(d => d.revenue), 1);
    const fmt = (v) => (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toFixed(0));
    return `
      <div style="display:flex;align-items:flex-end;gap:6px;height:220px;padding:0 8px;">
        ${data.map(d => {
          const h = (d.revenue / max) * 100;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;padding-top:20px;">
              <div style="font-size:11px;color:var(--gray-600);font-weight:600;">${fmt(d.revenue)}</div>
              <div style="width:100%;height:${h}%;background:linear-gradient(180deg,#10b981,#059669);border-radius:4px 4px 0 0;"></div>
              <div style="font-size:10px;color:var(--gray-500);margin-top:4px;">${d.count}笔</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        ${data.map(d => `<div style="flex:1;text-align:center;font-size:12px;color:var(--gray-500);">${d.month}</div>`).join('')}
      </div>
    `;
  },

  renderEnterpriseFrequencySection(f) {
    f = f || {};
    const detection = (f.detectionFrequency || []).slice(0, 10);
    const sampleFreq = f.sampleFrequency || {};
    const totalDetect = detection.reduce((s, d) => s + Number(d.taskCount || 0), 0);

    return `
      <div class="card" style="margin-top:24px;">
        <div class="card-header">
          <h3 class="card-title">🏢 企业客户检测频次分析</h3>
          <span style="font-size:13px;color:var(--gray-500);">TOP ${detection.length} 活跃企业 · 共 ${totalDetect} 笔任务</span>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12 col-lg-8">
              <div class="table-wrapper" style="border:1px solid var(--gray-200);border-radius:8px;">
                <table class="data-table" style="margin:0;">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>企业名称</th>
                      <th style="text-align:center;">委托任务</th>
                      <th style="text-align:center;" class="col-hide-md">检测样品</th>
                      <th style="width:220px;">活跃度</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detection.length ? detection.map((d, i) => {
                      const taskCount = Number(d.taskCount || 0);
                      const detectCount = Number(d.detectionCount || 0);
                      const pct = totalDetect > 0 ? Math.min(100, Math.round(taskCount / totalDetect * 100 * 3)) : 0;
                      const rankBadge = i < 3
                        ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-weight:700;font-size:13px;color:#fff;background:${['#f59e0b','#94a3b8','#cd7f32'][i]};">${i+1}</span>`
                        : `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-weight:600;font-size:12px;color:var(--gray-600);background:var(--gray-100);">${i+1}</span>`;
                      return `
                      <tr>
                        <td style="text-align:center;">${rankBadge}</td>
                        <td style="font-weight:500;">${d.companyName || '未命名企业'}</td>
                        <td style="text-align:center;font-weight:600;color:var(--primary);">${taskCount}</td>
                        <td style="text-align:center;" class="col-hide-md">${detectCount}</td>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px;">
                            <div class="progress" style="flex:1;margin:0;"><div class="progress-bar" style="width:${pct}%;background:${i < 3 ? '#f59e0b' : 'var(--primary)'};"></div></div>
                            <span style="font-size:12px;color:var(--gray-600);min-width:36px;">${pct}%</span>
                          </div>
                        </td>
                      </tr>
                      `;
                    }).join('') : `<tr><td colspan="5">${AppUtils.renderEmpty('暂无企业检测数据')}</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="col-12 col-lg-4">
              <div class="card h-100" style="border:1px solid var(--gray-200);box-shadow:none;">
                <div class="card-header" style="border-bottom:1px solid var(--gray-100);padding:12px 16px;">
                  <h3 class="card-title" style="font-size:15px;">📦 样品总体统计</h3>
                </div>
                <div class="card-body" style="padding:16px;">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="padding:16px;background:rgba(37,99,235,0.06);border-radius:10px;text-align:center;">
                      <div style="font-size:28px;font-weight:700;color:var(--primary);">${Number(sampleFreq.sampleCount || 0).toLocaleString()}</div>
                      <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">样品总数</div>
                    </div>
                    <div style="padding:16px;background:rgba(16,185,129,0.06);border-radius:10px;text-align:center;">
                      <div style="font-size:28px;font-weight:700;color:var(--success);">${Number(sampleFreq.testedCount || 0).toLocaleString()}</div>
                      <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">已检测</div>
                    </div>
                    <div style="padding:16px;background:rgba(239,68,68,0.06);border-radius:10px;text-align:center;">
                      <div style="font-size:28px;font-weight:700;color:var(--danger);">${Number(sampleFreq.destroyedCount || 0).toLocaleString()}</div>
                      <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">已销毁</div>
                    </div>
                    <div style="padding:16px;background:rgba(245,158,11,0.06);border-radius:10px;text-align:center;">
                      <div style="font-size:28px;font-weight:700;color:var(--warning);">${Math.max(0, Number(sampleFreq.sampleCount || 0) - Number(sampleFreq.destroyedCount || 0)).toLocaleString()}</div>
                      <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">在库中</div>
                    </div>
                  </div>
                  <div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:8px;font-size:13px;color:var(--gray-600);line-height:1.8;">
                    💡 活跃企业排名 = 委托任务数降序 TOP10，基于 inspection_task 与 sample_info 联表聚合。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
