const LabPage = {
  render() {
    AppLayout.setPageHeader('实验室资源', ['资源管理']);
    const equipments = MockData.equipments;
    const technicians = MockData.technicians;
    const trainings = MockData.labTrainings;
    const capabilities = MockData.labCapabilities;

    const getEquipStatus = (s) => {
      const map = { running: { class: 'badge-success', text: '运行中' }, maintenance: { class: 'badge-warning', text: '维护中' }, idle: { class: 'badge-secondary', text: '空闲' } };
      const m = map[s] || map.idle;
      return `<span class="badge ${m.class}">${m.text}</span>`;
    };

    const getTechStatus = (s) => {
      const map = { busy: 'badge-danger', normal: 'badge-success', leave: 'badge-secondary' };
      const text = { busy: '工作中', normal: '空闲', leave: '休假' };
      return `<span class="badge ${map[s] || 'badge-secondary'}">${text[s] || '未知'}</span>`;
    };

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🔬 检测设备</h3>
          <div>
            <button class="btn btn-primary btn-sm">➕ 新增设备</button>
            <button class="btn btn-outline-primary btn-sm">📅 校准计划</button>
          </div>
        </div>
        <div class="row g-3" style="padding:20px;">
          ${equipments.map(e => {
            const daysToCal = Math.ceil((new Date(e.nextCal) - new Date()) / (1000 * 60 * 60 * 24));
            const calStatus = daysToCal < 0 ? 'danger' : daysToCal <= 30 ? 'warning' : 'success';
            return `
            <div class="col-12 col-sm-6 col-lg-4">
              <div style="border:1px solid var(--gray-200);border-radius:10px;padding:16px;background:#fff;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                  <div style="width:44px;height:44px;border-radius:10px;background:rgba(37,99,235,0.1);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:22px;">⚙️</div>
                  <div style="flex:1;">
                    <div style="font-weight:600;">${e.name}</div>
                    <div style="font-size:12px;color:var(--gray-500);font-family:monospace;">${e.code}</div>
                  </div>
                  ${getEquipStatus(e.status)}
                </div>
                <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px;">所属实验室：<span style="color:var(--gray-700);">${e.lab}</span></div>
                <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px;">上次校准：<span style="color:var(--gray-700);">${e.lastCal}</span></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:12px;color:var(--gray-500);">下次校准: ${e.nextCal}</span>
                  <span style="font-size:12px;color:var(--${calStatus});font-weight:600;">${daysToCal < 0 ? '已超期' : daysToCal + '天后到期'}</span>
                </div>
                <div class="progress">
                  <div class="progress-bar ${e.load > 70 ? 'danger' : ''}" style="width:${e.load}%;"></div>
                </div>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">👨‍🔬 技术人员</h3>
          <button class="btn btn-outline-primary btn-sm">🎓 培训管理</button>
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
              ${technicians.map(t => `
                <tr>
                  <td style="font-weight:500;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      ${AppUtils.getAvatar(t.name)}
                      ${t.name}
                    </div>
                  </td>
                  <td>${t.lab}</td>
                  <td>${t.title}</td>
                  <td class="col-hide-lg">
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      ${t.skills.map(s => `<span class="badge badge-secondary">${s}</span>`).join('')}
                    </div>
                  </td>
                  <td class="col-hide-md" style="text-align:center;font-weight:600;">${t.certs} 个</td>
                  <td>${getTechStatus(t.status)}</td>
                  <td style="width:180px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="progress" style="flex:1;margin:0;">
                        <div class="progress-bar ${t.workload > 70 ? 'danger' : ''}" style="width:${t.workload}%;"></div>
                      </div>
                      <span style="font-size:12px;color:var(--gray-600);min-width:36px;">${t.workload}%</span>
                    </div>
                  </td>
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

      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🎓 培训记录</h3>
          <button class="btn btn-primary btn-sm">➕ 新建培训</button>
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
              ${trainings.map(t => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);">${t.id}</td>
                  <td style="font-weight:500;">${t.name}</td>
                  <td class="col-hide-md">${t.date}</td>
                  <td class="col-hide-lg">${t.hours} 学时</td>
                  <td class="col-hide-md">${t.participants} 人</td>
                  <td>${t.status === 'completed' ? '<span class="badge badge-success">已完成</span>' : '<span class="badge badge-warning">计划中</span>'}</td>
                  <td><div class="table-actions"><button class="action-btn">👁️</button></div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📋 实验室能力范围维护</h3>
          <button class="btn btn-primary btn-sm">➕ 新增能力项</button>
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
              ${capabilities.map(c => `
                <tr>
                  <td style="font-family:monospace;color:var(--primary);font-weight:600;">${c.code}</td>
                  <td style="font-weight:500;">${c.name}</td>
                  <td class="col-hide-md" style="font-size:13px;">${c.standard}</td>
                  <td class="col-hide-lg" style="color:var(--gray-600);">${c.scope}</td>
                  <td><span class="badge badge-info">${c.accreditor}</span></td>
                  <td>${c.status === 'active' ? '<span class="badge badge-success">已获认可</span>' : '<span class="badge badge-warning">扩项中</span>'}</td>
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
    `;

    $('#pageContent').html(html);
  }
};

const TracePage = {
  render() {
    AppLayout.setPageHeader('数据追溯与审计', ['资源管理']);
    const logs = MockData.auditLogs;

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">🔍 追溯码查询</h3>
        </div>
        <div class="card-body">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
            <div style="flex:1;min-width:300px;">
              <input type="text" class="form-control" placeholder="请输入样品追溯码，如：SP-2026-0891" style="width:100%;height:44px;font-size:15px;" value="SP-2026-0891">
            </div>
            <button class="btn btn-primary" style="height:44px;padding:0 24px;" onclick="TracePage.showTraceResult()">🔍 开始追溯</button>
            <button class="btn btn-outline-primary" style="height:44px;">📱 扫码查询</button>
          </div>
        </div>
      </div>

      <div class="card mb-4" id="traceResultCard">
        <div class="card-header">
          <h3 class="card-title">📦 追溯结果：SP-2026-0891</h3>
          <span class="badge badge-success">追溯完整</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
            <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
              <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">样品名称</div>
              <div style="font-weight:600;">智能断路器</div>
            </div>
            <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
              <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">委托企业</div>
              <div style="font-weight:600;">上海正泰电器有限公司</div>
            </div>
            <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
              <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">认证类型</div>
              <div style="font-weight:600;">CCC 强制性产品认证</div>
            </div>
            <div style="padding:14px;background:var(--gray-50);border-radius:8px;">
              <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px;">当前状态</div>
              <div style="font-weight:600;color:var(--warning);">检测进行中</div>
            </div>
          </div>

          <h4 style="font-size:15px;margin-bottom:16px;">🔗 完整检测链路</h4>
          <div class="timeline">
            ${[
              { status: 'success', time: '2026-06-15 09:30:00', title: '企业在线申请', desc: '企业客户通过自助服务平台提交CCC认证申请，订单号AP-2026-0908' },
              { status: 'success', time: '2026-06-15 10:15:00', title: '样品接收登记', desc: '样品管理员李娟接收样品3件，登记追溯码SP-2026-0891' },
              { status: 'success', time: '2026-06-15 14:00:00', title: '任务智能分配', desc: '系统分配给电气实验室技术员张伟，设备GDW-1000高低温试验箱' },
              { status: 'primary', time: '2026-06-16 08:30:00', title: '检测数据录入', desc: '录入介电强度测试数据，原始记录ID: RAW-2026-0615-001' },
              { status: 'warning', time: '2026-06-16 14:00:00', title: '检测进行中', desc: '温升试验、绝缘电阻测试待完成，进度60%' },
              { status: '', time: '预计 2026-06-18', title: '报告生成审核', desc: '自动生成检测报告并提交审核组复核' },
              { status: '', time: '预计 2026-06-20', title: '证书发放', desc: '签发CCC电子认证证书' }
            ].map(t => `
              <div class="timeline-item ${t.status}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-time">${t.time}</div>
                  <div class="timeline-title">${t.title}</div>
                  <div class="timeline-desc">${t.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📝 操作日志审计</h3>
          <div style="display:flex;gap:8px;">
            <select class="form-control" style="width:140px;height:32px;">
              <option value="">全部类型</option>
              <option>样品操作</option>
              <option>数据录入</option>
              <option>报告签发</option>
            </select>
            <input type="date" class="form-control" style="width:160px;height:32px;">
          </div>
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
                <th>IP地址</th>
                <th>操作详情</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td style="font-family:monospace;font-size:12px;color:var(--primary);">${l.id}</td>
                  <td>${AppUtils.getAvatar(l.operator)} ${l.operator}</td>
                  <td><span class="badge badge-info">${l.action}</span></td>
                  <td style="font-family:monospace;">${l.target}</td>
                  <td>${l.time}</td>
                  <td style="font-family:monospace;font-size:12px;">${l.ip}</td>
                  <td style="color:var(--gray-600);">${l.detail}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
  },

  showTraceResult() {
    AppUtils.showToast('追溯查询', '正在查询追溯码 SP-2026-0891 ...', 'success');
  }
};

const AnalyticsPage = {
  render() {
    AppLayout.setPageHeader('统计分析报表', ['统计分析']);
    const stats = MockData.stats;

    const html = `
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">📊 业务总览报表</h3>
          <div style="display:flex;gap:8px;">
            <select class="form-control" style="width:120px;height:32px;">
              <option>本年度</option>
              <option>上年度</option>
              <option>近30天</option>
            </select>
            <button class="btn btn-outline-primary btn-sm">📥 导出Excel</button>
            <button class="btn btn-primary btn-sm">🖨️ 打印报表</button>
          </div>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">年度检测总量</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">6,430</div>
                <div style="font-size:12px;color:var(--success);margin-top:4px;">↑ 18.5% 同比增长</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">累计营业收入</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">¥1,860万</div>
                <div style="font-size:12px;color:var(--success);margin-top:4px;">↑ 22.3% 同比增长</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">平均检测周期</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">6.2 天</div>
                <div style="font-size:12px;color:var(--success);margin-top:4px;">↓ 15.3% 周期缩短</div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <div style="padding:18px;background:linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02));border-radius:10px;">
                <div style="font-size:13px;color:var(--gray-500);">客户满意度</div>
                <div style="font-size:28px;font-weight:700;margin-top:8px;">98.6%</div>
                <div style="font-size:12px;color:var(--success);margin-top:4px;">↑ 2.1% 环比提升</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-8">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📈 月度检测量与收入分析</h3>
            </div>
            <div class="card-body">
              <div class="chart-container" style="height:280px;">
                ${this.renderDualBarChart(stats.monthlyData)}
              </div>
              <div class="chart-legend">
                <div class="chart-legend-item"><div class="chart-legend-color" style="background:var(--primary);"></div>检测批次</div>
                <div class="chart-legend-item"><div class="chart-legend-color" style="background:var(--success);"></div>营业收入（万元）</div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">🏆 客户检测频次排行</h3>
            </div>
            <div class="card-body" style="padding:0;">
              ${MockData.customers.slice(0, 5).map((c, i) => {
                const pct = (c.totalOrders / 256 * 100).toFixed(0);
                return `
                  <div style="padding:14px 20px;border-bottom:1px solid var(--gray-100);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <span style="width:22px;height:22px;border-radius:50%;background:${i === 0 ? 'var(--warning)' : i === 1 ? 'var(--gray-400)' : i === 2 ? '#d97706' : 'var(--gray-300)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${i + 1}</span>
                        <span style="font-weight:500;">${c.name.length > 14 ? c.name.substring(0, 14) + '...' : c.name}</span>
                      </div>
                      <span style="font-weight:600;">${c.totalOrders} 次</span>
                    </div>
                    <div class="progress"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--primary),var(--primary-light));border-radius:3px;"></div></div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">🏭 产品类别分析</h3>
            </div>
            <div class="card-body">
              ${this.renderCategoryAnalysis(stats.categoryData)}
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <h3 class="card-title">⏰ 超期预警分析</h3>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--warning);">18</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">即将超期任务</div>
                </div>
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--danger);">5</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">已超期任务</div>
                </div>
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--warning);">23</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">60天内到期证书</div>
                </div>
                <div style="padding:16px;border:1px solid var(--gray-200);border-radius:10px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:var(--danger);">7</div>
                  <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">设备校准到期</div>
                </div>
              </div>
              <div style="margin-top:16px;">
                <div style="font-size:13px;color:var(--gray-600);margin-bottom:10px;">超期原因分布</div>
                ${[
                  { name: '检测项目复杂', pct: 40, color: 'var(--primary)' },
                  { name: '设备故障维修', pct: 25, color: 'var(--warning)' },
                  { name: '技术人员不足', pct: 20, color: 'var(--danger)' },
                  { name: '客户补充资料', pct: 15, color: 'var(--secondary)' }
                ].map(r => `
                  <div style="margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                      <span>${r.name}</span>
                      <span style="font-weight:600;">${r.pct}%</span>
                    </div>
                    <div class="progress" style="height:4px;"><div style="width:${r.pct}%;height:100%;background:${r.color};border-radius:2px;"></div></div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $('#pageContent').html(html);
  },

  renderDualBarChart(data) {
    const max1 = Math.max(...data.map(d => d.samples));
    const max2 = Math.max(...data.map(d => d.revenue / 10000));
    return `
      <div style="display:flex;align-items:flex-end;gap:8px;height:240px;padding:0 8px;">
        ${data.map(d => {
          const h1 = (d.samples / max1) * 100;
          const h2 = (d.revenue / 10000 / max2) * 100;
          return `
            <div style="flex:1;display:flex;gap:4px;align-items:flex-end;height:100%;padding-top:20px;">
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:11px;color:var(--gray-600);font-weight:600;">${d.samples}</div>
                <div style="width:100%;height:${h1}%;background:linear-gradient(180deg,var(--primary),var(--primary-light));border-radius:4px 4px 0 0;"></div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:11px;color:var(--gray-600);font-weight:600;">${(d.revenue / 10000).toFixed(0)}</div>
                <div style="width:100%;height:${h2}%;background:linear-gradient(180deg,var(--success),#34d399);border-radius:4px 4px 0 0;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        ${data.map(d => `<div style="flex:1;text-align:center;font-size:12px;color:var(--gray-500);">${d.month}</div>`).join('')}
      </div>
    `;
  },

  renderCategoryAnalysis(data) {
    const total = data.reduce((s, d) => s + d.value, 0);
    return `
      <div style="display:flex;align-items:center;gap:24px;height:260px;">
        <svg width="180" height="180" viewBox="0 0 180 180">
          ${data.reduce((acc, d, i) => {
            const prev = data.slice(0, i).reduce((s, x) => s + x.value, 0) / total;
            const curr = d.value / total;
            const polarToCartesian = (cx, cy, r, a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
            const s = prev * 2 * Math.PI - Math.PI / 2;
            const e = (prev + curr) * 2 * Math.PI - Math.PI / 2;
            const start = polarToCartesian(90, 90, 70, s);
            const end = polarToCartesian(90, 90, 70, e);
            const large = curr > 0.5 ? 1 : 0;
            return acc + `<path d="M 90 90 L ${start.x} ${start.y} A 70 70 0 ${large} 1 ${end.x} ${end.y} Z" fill="${d.color}" opacity="0.9"/>`;
          }, '')}
          <circle cx="90" cy="90" r="42" fill="#fff"/>
          <text x="90" y="86" text-anchor="middle" font-size="12" fill="#64748b">类别</text>
          <text x="90" y="104" text-anchor="middle" font-size="20" font-weight="700" fill="#1e293b">${total}</text>
        </svg>
        <div style="flex:1;">
          ${data.map(d => `
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <div class="chart-legend-item"><div class="chart-legend-color" style="background:${d.color};"></div>${d.name}</div>
                <span style="font-weight:600;">${d.value}%</span>
              </div>
              <div class="progress" style="height:6px;"><div style="width:${d.value * 2}%;height:100%;background:${d.color};border-radius:3px;"></div></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};
