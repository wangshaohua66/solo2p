/* 巡检管理页 — 任务卡片、缺陷上报、严重等级筛选统计 */
App.registerPage('inspection', {
  title: '巡检管理',
  sub: '巡检任务卡片 · 移动端缺陷上报 · 严重等级筛选与统计',
  render($el, App) {
    const api = App.api;
    let filterStatus = 'all', sevFilter = '', statFilter = '';
    const PARTS = ['坝顶', '上游护坡', '下游护坡', '溢洪道', '输水洞', '闸门启闭机', '坝肩', '排水沟'];
    const SEVS = ['一般', '较重', '严重'];
    let defectTaskId = null;

    const st = api.inspection.stats();
    App.setQuickStats(
      chip('任务总数', st.total, 'info') + chip('待办', st.pending, 'warn') +
      chip('已完成', st.done, 'ok') + chip('缺陷', st.defects, 'bad')
    );

    $el.html(`
      <div class="filter-bar mb-3">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-light active" data-s="all">全部</button>
          <button class="btn btn-outline-light" data-s="pending">待办</button>
          <button class="btn btn-outline-light" data-s="done">已完成</button>
          <button class="btn btn-outline-light" data-s="overdue">超时</button>
        </div>
        ${App.role === 'admin' ? `<button class="btn btn-primary btn-sm ms-auto" id="genPlan"><i class="bi bi-calendar-plus"></i> 生成月度计划</button>` : ''}
      </div>

      <div class="row g-3">
        <div class="col-12 col-xl-7">
          <div class="panel"><div class="panel-head"><span class="panel-title"><i class="bi bi-kanban"></i>巡检任务</span><span class="small text-muted" id="taskCount"></span></div>
            <div class="panel-body"><div class="row g-2" id="taskGrid"></div></div>
          </div>
        </div>
        <div class="col-12 col-xl-5">
          <div class="panel"><div class="panel-head"><span class="panel-title"><i class="bi bi-pie-chart"></i>缺陷统计</span></div>
            <div class="panel-body">
              <div class="filter-bar mb-2">
                <select class="form-select form-select-sm" id="sevFilter" style="width:auto"><option value="">严重程度</option>${SEVS.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
                <select class="form-select form-select-sm" id="statFilter" style="width:auto"><option value="">处理状态</option><option value="open">待处理</option><option value="processing">处理中</option><option value="closed">已闭环</option></select>
              </div>
              <div class="row g-2">
                <div class="col-7"><div style="height:200px"><canvas id="defectPie"></canvas></div></div>
                <div class="col-5"><div id="defectKpi" class="d-flex flex-column gap-2"></div></div>
              </div>
              <div class="divider"></div>
              <div class="table-wrap" style="max-height:260px"><table class="table table-sm card-collapse" id="defectTable"></table></div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" tabindex="-1" id="defectModal">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content bg-dark border border-secondary">
            <div class="modal-header border-secondary"><h6 class="modal-title"><i class="bi bi-exclamation-triangle"></i> 缺陷上报</h6><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <form id="defectForm">
                <div class="mb-2"><label class="form-label">严重等级 <span class="text-danger">*</span></label>
                  <div class="btn-group btn-group-sm w-100" id="sevPick">${SEVS.map((s, i) => `<button type="button" class="btn btn-outline-light" data-sev="${s}">${s}</button>`).join('')}</div>
                </div>
                <div class="mb-2"><label class="form-label">工程部位 <span class="text-danger">*</span></label>
                  <select class="form-select form-select-sm" id="dPart">${PARTS.map(p => `<option>${p}</option>`).join('')}</select>
                </div>
                <div class="mb-2"><label class="form-label">位置</label><input class="form-control form-control-sm" id="dLoc" placeholder="桩号/位置"></div>
                <div class="mb-2"><label class="form-label">缺陷描述</label><textarea class="form-control form-control-sm" id="dDesc" rows="2"></textarea></div>
                <div class="mb-2"><label class="form-label">现场照片</label><input class="form-control form-control-sm" type="file" accept="image/*" capture="environment" id="dPhoto"><div id="photoPrev" class="thumb-grid mt-2"></div></div>
                <input type="hidden" id="dSev">
              </form>
            </div>
            <div class="modal-footer border-secondary"><button class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">取消</button><button class="btn btn-danger btn-sm" id="submitDefect"><i class="bi bi-send"></i> 提交缺陷</button></div>
          </div>
        </div>
      </div>
    `);

    function chip(l, v, t) { return `<div class="qstat"><span class="dot ${t}"></span>${l} <b>${v}</b></div>`; }
    let photoData = null;
    let modal = new bootstrap.Modal(document.getElementById('defectModal'));

    function renderTasks() {
      const rows = api.inspection.list({ status: filterStatus === 'all' ? null : filterStatus });
      $('#taskCount').text('共 ' + rows.length + ' 项');
      if (!rows.length) { $('#taskGrid').html('<div class="col-12"><div class="empty"><i class="bi bi-inbox"></i>暂无巡检任务</div></div>'); return; }
      $('#taskGrid').html(rows.map(t => {
        const over = t.status === 'overdue' || (t.status !== 'done' && t.dueDate < Date.now());
        const dc = (t.defects || []).length;
        return `<div class="col-12 col-md-6">
          <div class="panel panel-tight task-card">
            <div class="panel-body">
              <div class="d-flex justify-content-between align-items-start">
                <div><div class="fw-bold">${t.route}</div><div class="small text-muted"><i class="bi bi-person"></i> ${t.inspector} · 截止 ${App.fmtDate(t.dueDate)}</div></div>
                ${App.statusTag(t.status === 'done' ? 'done' : (over ? 'overdue' : 'pending'))}
              </div>
              <div class="d-flex align-items-center gap-2 mt-2">
                <span class="tag info"><i class="bi bi-bug"></i> 缺陷 ${dc}</span>
                ${dc ? `<span class="small text-muted">${defectSummary(t.defects)}</span>` : '<span class="small text-muted">暂无缺陷</span>'}
              </div>
              ${(t.defects || []).slice(0, 3).map(d => `<div class="small mt-1 d-flex justify-content-between"><span>${sevTag(d.severity)} ${d.part}</span>${App.statusTag(d.status)}</div>`).join('')}
              <div class="d-flex gap-2 mt-2">
                ${(App.role === 'inspector' || App.role === 'admin') ? `<button class="btn btn-danger btn-sm flex-fill" data-act="defect" data-id="${t._id}"><i class="bi bi-plus-lg"></i> 上报缺陷</button>` : ''}
                ${dc ? `<button class="btn btn-outline-light btn-sm flex-fill" data-act="resolve" data-id="${t._id}">处理记录</button>` : ''}
              </div>
            </div>
          </div>
        </div>`;
      }).join(''));
    }

    function defectSummary(defs) {
      const c = { '严重': 0, '较重': 0, '一般': 0 };
      defs.forEach(d => c[d.severity]++);
      return Object.entries(c).filter(([, v]) => v).map(([k, v]) => k + v).join(' · ');
    }
    function sevTag(s) { return `<span class="tag ${s === '严重' ? 'bad' : s === '较重' ? 'warn' : 'ok'}">${s}</span>`; }

    function renderDefectStats() {
      const ds = api.inspection.defectStats({ severity: sevFilter || null, status: statFilter || null });
      const colors = { '一般': '#2a9d8f', '较重': '#e9b949', '严重': '#e63946' };
      if (App.charts.dpie) App.charts.dpie.destroy();
      App.charts.dpie = new Chart(document.getElementById('defectPie'), {
        type: 'doughnut',
        data: { labels: SEVS, datasets: [{ data: SEVS.map(s => ds.bySev[s] || 0), backgroundColor: SEVS.map(s => colors[s]), borderColor: '#0e2236', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: '#9fb4c7', font: { size: 10 }, boxWidth: 12 } } } }
      });
      $('#defectKpi').html(
        kpi('缺陷总数', ds.total) + kpi('待处理', ds.byStatus.open, 'down') + kpi('处理中', ds.byStatus.processing) + kpi('已闭环', ds.byStatus.closed, 'up')
      );
      $('#defectTable').html(`<thead><tr><th>路线</th><th>部位</th><th>等级</th><th>状态</th><th>时间</th><th></th></tr></thead><tbody>
        ${ds.list.map(d => `<tr><td>${d.route}</td><td>${d.part}</td><td>${sevTag(d.severity)}</td><td>${App.statusTag(d.status)}</td><td class="mono small">${App.fmtTime(d.createdAt)}</td>
          <td>${d.status !== 'closed' ? `<button class="btn btn-sm btn-outline-light" data-resolve="${d.task}" data-def="${d.id}">闭环</button>` : '<span class="text-muted">—</span>'}</td></tr>`).join('')}
      </tbody>`);
    }
    function kpi(k, v, dir) { return `<div class="kpi"><span class="lbl">${k}</span><span class="val ${dir || ''}" style="font-size:1.1rem">${v}</span></div>`; }

    // events
    $('.filter-bar .btn[data-s]').on('click', function () { $(this).siblings().removeClass('active'); $(this).addClass('active'); filterStatus = $(this).data('s'); renderTasks(); });
    $('#sevFilter,#statFilter').on('change', function () { sevFilter = $('#sevFilter').val(); statFilter = $('#statFilter').val(); renderDefectStats(); });
    $('#taskGrid').on('click', '[data-act="defect"]', function () {
      defectTaskId = $(this).data('id'); photoData = null; $('#photoPrev').empty(); $('#dDesc').val(''); $('#dLoc').val(''); $('#dSev').val(''); $('#sevPick .btn').removeClass('active');
      modal.show();
    });
    $('#taskGrid').on('click', '[data-act="resolve"]', function () {
      sevFilter = ''; statFilter = 'open'; $('#sevFilter').val(''); $('#statFilter').val('open'); renderDefectStats();
      $('html,body').animate({ scrollTop: $('#defectPie').offset().top - 90 }, 300);
    });
    $('#sevPick .btn').on('click', function () { $(this).siblings().removeClass('active'); $(this).addClass('active'); $('#dSev').val($(this).data('sev')); });
    $('#dPhoto').on('change', function (e) {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = function (ev) { photoData = ev.target.result; $('#photoPrev').html(`<div class="thumb"><img src="${photoData}"></div>`); };
      r.readAsDataURL(f);
    });
    $('#submitDefect').on('click', function () {
      try {
        const res = api.inspection.addDefect(defectTaskId, {
          severity: $('#dSev').val(), part: $('#dPart').val(), location: $('#dLoc').val(),
          desc: $('#dDesc').val(), photo: !!photoData, photoData: photoData
        });
        App.toast('缺陷已上报并入库', 'success'); modal.hide(); renderTasks(); renderDefectStats();
      } catch (err) { App.toast(err.message || '提交失败', 'error'); }
    });
    $('#defectTable').on('click', '[data-resolve]', function () {
      try { api.inspection.resolveDefect($(this).data('resolve'), $(this).data('def')); App.toast('缺陷已闭环', 'success'); renderTasks(); renderDefectStats(); }
      catch (err) { App.toast(err.message || '操作失败', 'error'); }
    });
    $('#genPlan').on('click', function () {
      const month = new Date().toISOString().slice(0, 7);
      try { const created = api.inspection.generatePlan(month); App.toast('已生成 ' + created.length + ' 条月度巡检任务', 'success'); renderTasks(); }
      catch (err) { App.toast(err.message || '生成失败', 'error'); }
    });

    renderTasks();
    renderDefectStats();
  }
});
