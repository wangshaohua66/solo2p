/**
 * 实验室资源、数据追溯审计、统计分析报表页面。
 * 全部数据通过 ApiClient 调用后端 REST API 获取，无任何硬编码 Mock 数据。
 */
const LabPage = {
  equipments: [],
  technicians: [],

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
          <button class="btn btn-primary btn-sm" onclick="AppUtils.showToast('提示','培训记录管理需后端补充独立接口','warning')">➕ 新建培训</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>培训编号</th>
                <th>培训主题</th>
                <th class="col-hide-md">培训日期</th>
                <th class="col-hide-lg">学时</th>
                <th class="col-hide-md">参与人数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="7">${AppUtils.renderEmpty('培训记录需后端补充独立查询接口后展示')}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📋 实验室能力范围维护</h3>
          <button class="btn btn-primary btn-sm" onclick="AppUtils.showToast('提示','能力范围管理需后端补充独立接口','warning')">➕ 新增能力项</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>能力代码</th>
                <th>能力名称</th>
                <th class="col-hide-md">依据标准</th>
                <th class="col-hide-lg">检测范围</th>
                <th>认可机构</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="7">${AppUtils.renderEmpty('能力范围数据需后端补充独立查询接口后展示')}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
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

  render() {
    AppLayout.setPageHeader('统计分析报表', ['统计分析']);
    $('#pageContent').html(AppUtils.renderLoading());
    this.load();
  },

  async load() {
    try {
      this.stats = await ApiClient.analytics.dashboardStats();
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
  }
};
