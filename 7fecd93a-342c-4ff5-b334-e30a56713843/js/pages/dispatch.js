/* 调度管理页 — 指令下发、确认回填、全流程追溯、操作统计 */
App.registerPage('dispatch', {
  title: '调度管理',
  sub: '闸门调度指令下发 · 30分钟确认回填 · 全流程追溯',
  render($el, App) {
    const api = App.api;
    let selectedId = null, filterStatus = 'all', timer = null;
    const gates = api.dispatch.gates();
    const receivers = api.dispatch.receivers();
    const st = api.dispatch.stats();

    App.setQuickStats(
      chip('指令总数', st.total, 'info') + chip('待确认', st.pending, 'warn') +
      chip('已确认', st.confirmed, 'ok') + chip('超时', st.overdue, 'bad')
    );

    $el.html(`
      <div class="row g-3">
        <div class="col-12 col-xl-4">
          <div class="panel">
            <div class="panel-head"><span class="panel-title"><i class="bi bi-list-task"></i>调度指令</span>
              <select class="form-select form-select-sm" id="dFilter" style="width:auto">
                <option value="all">全部</option><option value="pending">待确认</option>
                <option value="confirmed">已确认</option><option value="overdue">超时</option><option value="closed">已归档</option>
              </select>
            </div>
            <div class="panel-body p-2"><div class="list-scroll" id="orderList" style="max-height:560px"></div></div>
          </div>
        </div>
        <div class="col-12 col-xl-8">
          ${App.role === 'dispatcher' || App.role === 'admin' ? newOrderForm(gates, receivers) : ''}
          <div class="panel mt-3" id="detailWrap"></div>
          <div class="panel mt-3" id="statsWrap"></div>
        </div>
      </div>
    `);

    function chip(l, v, t) { return `<div class="qstat"><span class="dot ${t}"></span>${l} <b>${v}</b></div>`; }

    function renderList() {
      const rows = api.dispatch.list({ status: filterStatus === 'all' ? null : filterStatus });
      if (!rows.length) { $('#orderList').html('<div class="empty"><i class="bi bi-inbox"></i>暂无指令</div>'); return; }
      $('#orderList').html(rows.map(o => {
        const cd = (o.status === 'pending' || o.status === 'overdue') ? App.countdown(o.deadline) : null;
        return `<div class="order-item ${o._id === selectedId ? 'active' : ''}" data-id="${o._id}">
          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-bold mono">${o.code}</span>${App.statusTag(o.status)}
          </div>
          <div class="small text-muted mt-1">${o.gateName} · ${o.reservoirName}</div>
          <div class="d-flex justify-content-between small mt-1">
            <span><i class="bi bi-person"></i> ${o.receiver}</span>
            <span class="mono">${App.fmtTime(o.sendTime)}</span>
          </div>
          ${cd ? `<div class="small mt-1"><span class="countdown ${cd.late ? 'late' : ''}" data-deadline="${o.deadline}"><i class="bi bi-stopwatch"></i> ${cd.late ? '已超时' : '剩余 ' + cd.text}</span></div>` : ''}
        </div>`;
      }).join(''));
    }

    function renderDetail(id) {
      if (!id) { $('#detailWrap').html('<div class="panel-head"><span class="panel-title"><i class="bi bi-info-circle"></i>指令详情</span></div><div class="empty"><i class="bi bi-hand-index"></i>请从左侧选择指令查看详情</div>'); return; }
      const o = api.dispatch.get(id);
      const canConfirm = (o.status === 'pending' || o.status === 'overdue') && (App.role === 'inspector' || App.role === 'admin');
      const canClose = o.status === 'confirmed' && App.role === 'admin';
      const trace = api.dispatch.trace(id);
      $('#detailWrap').html(`
        <div class="panel-head"><span class="panel-title"><i class="bi bi-file-earmark-text"></i>指令详情 ${App.statusTag(o.status)}</span><span class="mono small">${o.code}</span></div>
        <div class="panel-body">
          <div class="row g-2 mb-3">
            ${kv('闸门', o.gateName)}${kv('所属', o.reservoirName)}${kv('指令开度', o.opening + ' cm')}
            ${kv('实际开度', o.actualOpening != null ? o.actualOpening + ' cm' : '—')}
            ${kv('下发人', o.sender)}${kv('接收人', o.receiver)}
            ${kv('下发时间', App.fmtFull(o.sendTime))}${kv('截止时间', App.fmtFull(o.deadline))}
            ${kv('确认时间', o.confirmTime ? App.fmtFull(o.confirmTime) : '—')}
          </div>
          ${o.remark ? `<div class="alert alert-dark py-2 small mb-3"><i class="bi bi-chat-left-text"></i> ${o.remark}</div>` : ''}
          ${canConfirm ? `
          <form id="confirmForm" class="row g-2 align-items-end mb-3">
            <div class="col-7 col-md-4"><label class="form-label">回填实际开度(cm)</label><input class="form-control form-control-sm mono" id="actOpen" type="number" min="0" value="${o.opening}"></div>
            <div class="col-5 col-md-3 d-grid"><button class="btn btn-success btn-sm" type="submit"><i class="bi bi-check2-circle"></i> 确认回填</button></div>
          </form>` : ''}
          ${canClose ? `<button class="btn btn-outline-light btn-sm mb-3" id="closeBtn"><i class="bi bi-archive"></i> 归档</button>` : ''}
          <h6 class="mb-2"><i class="bi bi-diagram-3"></i> 全流程追溯</h6>
          <div class="timeline">${trace.map(t => `<div class="tl-node ${t.node === 'bad' ? 'bad' : t.node === 'warn' ? 'warn' : ''}">
            <div class="tl-time">${App.fmtFull(t.time)}</div><div class="tl-text">${t.op} · <span class="text-muted">${t.by}</span></div></div>`).join('')}</div>
        </div>
      `);
      if (canConfirm) {
        $('#confirmForm').on('submit', function (e) {
          e.preventDefault();
          try { api.dispatch.confirm(id, +$('#actOpen').val()); App.toast('已确认回填实际开度', 'success'); refresh(); }
          catch (err) { App.toast(err.message || '确认失败', 'error'); }
        });
      }
      if (canClose) {
        $('#closeBtn').on('click', function () {
          try { api.dispatch.close(id); App.toast('指令已归档', 'success'); refresh(); }
          catch (err) { App.toast(err.message || '归档失败', 'error'); }
        });
      }
    }

    function renderStats() {
      const s = api.dispatch.stats();
      $('#statsWrap').html(`
        <div class="panel-head"><span class="panel-title"><i class="bi bi-bar-chart"></i>操作统计</span></div>
        <div class="panel-body">
          <div class="row g-2 mb-3">
            ${kpi('总指令', s.total)}${kpi('已确认', s.confirmed, 'up')}${kpi('待确认', s.pending)}${kpi('超时', s.overdue, 'down')}
          </div>
          <div class="row g-3">
            <div class="col-12 col-md-7"><div class="table-wrap"><table class="table table-sm card-collapse">
              <thead><tr><th>闸门</th><th>操作次数</th><th>已确认</th><th>平均响应</th></tr></thead>
              <tbody>${s.byGate.map(g => `<tr><td>${g.gate}</td><td class="mono">${g.count}</td><td class="mono">${g.confirmed}</td><td class="mono">${g.avgRespMin} 分钟</td></tr>`).join('')}</tbody>
            </table></div></div>
            <div class="col-12 col-md-5"><div style="height:180px"><canvas id="opsChart"></canvas></div></div>
          </div>
        </div>
      `);
      if (App.charts.ops) App.charts.ops.destroy();
      App.charts.ops = new Chart(document.getElementById('opsChart'), {
        type: 'bar',
        data: { labels: s.byGate.map(g => g.gate.slice(0, 4)), datasets: [{ data: s.byGate.map(g => g.count), backgroundColor: '#1a9fb5', borderRadius: 3, barThickness: 16 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6a8197' }, grid: { color: 'rgba(28,59,87,.4)' } }, y: { ticks: { color: '#9fb4c7', font: { size: 10 } }, grid: { display: false } } } }
      });
    }

    function newOrderForm(gates, receivers) {
      return `<div class="panel">
        <div class="panel-head"><span class="panel-title"><i class="bi bi-send"></i>下发闸门调度指令</span></div>
        <div class="panel-body">
          <form id="newOrder" class="row g-2 align-items-end">
            <div class="col-12 col-md-3"><label class="form-label">闸门</label>
              <select class="form-select form-select-sm" id="nGate">${gates.map(g => `<option value="${g.id}" data-max="${g.maxOpening}">${g.name}（${g.reservoirName}）</option>`).join('')}</select>
            </div>
            <div class="col-6 col-md-2"><label class="form-label">开度(cm) <span class="text-muted" id="nMaxHint"></span></label><input class="form-control form-control-sm mono" id="nOpen" type="number" min="0" value="40"></div>
            <div class="col-6 col-md-3"><label class="form-label">接收人</label>
              <select class="form-select form-select-sm" id="nRecv">${receivers.map(r => `<option value="${r.name}">${r.name}（${r.role}）</option>`).join('')}</select>
            </div>
            <div class="col-12 col-md-2"><label class="form-label">备注</label><input class="form-control form-control-sm" id="nRemark" placeholder="选填"></div>
            <div class="col-12 col-md-2 d-grid"><button class="btn btn-primary btn-sm" type="submit"><i class="bi bi-send-fill"></i> 下发</button></div>
          </form>
        </div>
      </div>`;
    }

    function kv(k, v) { return `<div class="col-6 col-md-3"><div class="kpi"><span class="lbl">${k}</span><span class="val" style="font-size:.95rem">${v}</span></div></div>`; }
    function kpi(k, v, dir) { return `<div class="col-6 col-md-3"><div class="kpi"><span class="lbl">${k}</span><span class="val ${dir || ''}">${v}</span></div></div>`; }

    function refresh() { renderList(); renderDetail(selectedId); renderStats(); }

    // events
    $('#dFilter').on('change', function () { filterStatus = $(this).val(); renderList(); });
    $('#orderList').on('click', '.order-item', function () { selectedId = $(this).data('id'); renderList(); renderDetail(selectedId); });
    $('#nGate').on('change', function () { $('#nMaxHint').text('最大' + $(this).find(':selected').data('max')); }).change();
    $('#newOrder').on('submit', function (e) {
      e.preventDefault();
      try {
        const o = api.dispatch.create({ gateId: $('#nGate').val(), opening: +$('#nOpen').val(), receiver: $('#nRecv').val(), remark: $('#nRemark').val(), sender: App.currentUser() });
        App.toast('指令 ' + o.code + ' 已下发', 'success'); selectedId = o._id; refresh();
      } catch (err) { App.toast(err.message || '下发失败', 'error'); }
    });

    // init
    const first = api.dispatch.list()[0];
    selectedId = first ? first._id : null;
    refresh();

    // countdown ticker
    clearInterval(timer);
    timer = setInterval(function () {
      $('[data-deadline]').each(function () {
        const cd = App.countdown(+$(this).data('deadline'));
        $(this).html('<i class="bi bi-stopwatch"></i> ' + (cd.late ? '已超时' : '剩余 ' + cd.text)).toggleClass('late', cd.late);
      });
    }, 1000);
  }
});
