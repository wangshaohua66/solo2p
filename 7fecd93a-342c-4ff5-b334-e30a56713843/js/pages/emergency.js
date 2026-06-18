/* 预案管理页 — 预案树、版本差异比对、水位匹配、应急通讯录 */
App.registerPage('emergency', {
  title: '预案管理',
  sub: '防汛预案版本化 · 相邻版本差异比对 · 水位自动匹配 · 应急通讯录',
  render($el, App) {
    const api = App.api;
    let selRes = null, selVer = null;
    const tree = api.emergency.planTree();
    selRes = tree[0].reservoirId;
    const firstVers = api.emergency.versions(selRes);
    selVer = (firstVers.find(v => v.current) || firstVers[firstVers.length - 1])._id;

    App.setQuickStats(
      chip('水库预案', tree.length, 'info') + chip('版本总数', tree.reduce((s, r) => s + r.versions.length, 0), 'ok') +
      chip('通讯录', api.contacts.list('all') && Object.values(api.contacts.list('all')).flat().length, 'info')
    );

    $el.html(`
      <div class="row g-3">
        <div class="col-12 col-xl-3">
          <div class="panel"><div class="panel-head"><span class="panel-title"><i class="bi bi-diagram-2"></i>预案层级</span></div>
            <div class="panel-body"><div class="tree" id="planTree"></div></div>
          </div>
        </div>
        <div class="col-12 col-xl-5">
          <div class="panel"><div class="panel-head"><span class="panel-title"><i class="bi bi-file-earmark-ruled"></i>预案详情</span><span class="small text-muted" id="verMeta"></span></div>
            <div class="panel-body" id="verDetail"></div></div>
          <div class="panel mt-3"><div class="panel-head"><span class="panel-title"><i class="bi bi-git"></i>版本差异比对</span></div>
            <div class="panel-body" id="diffArea"></div></div>
          <div class="panel mt-3"><div class="panel-head"><span class="panel-title"><i class="bi bi-broadcast"></i>应急响应匹配</span></div>
            <div class="panel-body" id="matchArea"></div></div>
        </div>
        <div class="col-12 col-xl-4">
          <div class="panel"><div class="panel-head"><span class="panel-title"><i class="bi bi-people"></i>应急通讯录</span></div>
            <div class="panel-body">
              <input class="form-control form-control-sm mb-2" id="ctSearch" placeholder="搜索姓名/电话/角色">
              <div class="btn-group btn-group-sm w-100 mb-2" id="ctRole">
                <button class="btn btn-outline-light active" data-r="all">全部</button>
                <button class="btn btn-outline-light" data-r="调度员">调度</button>
                <button class="btn btn-outline-light" data-r="巡检员">巡检</button>
                <button class="btn btn-outline-light" data-r="管理员">管理</button>
                <button class="btn btn-outline-light" data-r="维护人员">维护</button>
              </div>
              <div class="list-scroll" id="ctList" style="max-height:280px"></div>
              <div class="divider"></div>
              <textarea class="form-control form-control-sm mb-2" id="ctMsg" rows="2" placeholder="通知内容，如：龙潭水库超警戒，请立即到岗值班"></textarea>
              <button class="btn btn-gold btn-sm w-100" id="ctNotify"><i class="bi bi-megaphone"></i> 批量通知选中人员</button>
              <div class="mt-3"><h6 class="small text-muted"><i class="bi bi-clock-history"></i> 通知记录</h6><div class="list-scroll" id="ctLogs" style="max-height:140px"></div></div>
            </div>
          </div>
        </div>
      </div>
    `);

    function chip(l, v, t) { return `<div class="qstat"><span class="dot ${t}"></span>${l} <b>${v}</b></div>`; }

    function renderTree() {
      $('#planTree').html(tree.map(r => {
        const open = r.reservoirId === selRes ? 'open' : '';
        return `<div>
          <div class="tnode ${open}" data-res="${r.reservoirId}"><i class="bi bi-caret-right-fill twist"></i><i class="bi bi-water"></i> ${r.reservoirName}</div>
          <ul ${open ? '' : 'style="display:none"'}>${r.versions.map(v => `<li><div class="tnode ${v._id === selVer ? 'sel' : ''}" data-ver="${v._id}" data-res="${r.reservoirId}"><i class="bi bi-${v.current ? 'star-fill' : v.draft ? 'pencil' : 'file-earmark'}"></i> v${v.version} ${v.current ? '<span class="tag ok">现行</span>' : v.draft ? '<span class="tag warn">草案</span>' : ''}</div></li>`).join('')}</ul>
        </div>`;
      }).join(''));
    }

    function renderVersion() {
      const vers = api.emergency.versions(selRes);
      const v = vers.find(x => x._id === selVer) || vers[vers.length - 1];
      $('#verMeta').text('v' + v.version + ' · ' + App.fmtDate(v.publishTime) + ' · ' + v.author);
      $('#verDetail').html(`
        ${v.current ? '<div class="tag ok mb-2"><span class="dot ok"></span>现行版本</div>' : v.draft ? '<div class="tag warn mb-2"><span class="dot warn"></span>草案</div>' : '<div class="tag mute mb-2">历史版本</div>'}
        ${v.levels.map(l => `
          <div class="mb-2"><div class="d-flex justify-content-between"><span class="fw-bold">${l.name}</span><span class="mono small text-muted">水位 ≥ ${l.threshold}m</span></div>
          <ul class="small mb-0 ps-3">${l.measures.map(m => `<li>${m}</li>`).join('')}</ul></div>`).join('')}
      `);
      // diff selects
      const opts = vers.map(x => `<option value="${x._id}" ${x._id === selVer ? 'selected' : ''}>v${x.version} ${x.current ? '(现行)' : x.draft ? '(草案)' : ''}</option>`).join('');
      $('#diffArea').html(`
        <div class="row g-2 align-items-end">
          <div class="col-5"><label class="form-label">版本A</label><select class="form-select form-select-sm" id="diffA">${opts}</select></div>
          <div class="col-5"><label class="form-label">版本B</label><select class="form-select form-select-sm" id="diffB">${opts}</select></div>
          <div class="col-2 d-grid"><button class="btn btn-primary btn-sm" id="diffBtn">比对</button></div>
        </div>
        <div id="diffOut" class="mt-2"></div>
      `);
      $('#matchArea').html(`
        <div class="row g-2 align-items-end">
          <div class="col-7"><label class="form-label">输入当前水位(m)</label><input class="form-control form-control-sm mono" id="matchLevel" type="number" step="0.1" value="${(DB.findOne('reservoirs', { _id: selRes }) || {}).current ? DB.findOne('reservoirs', { _id: selRes }).current.level : 80}"></div>
          <div class="col-5 d-grid"><button class="btn btn-danger btn-sm" id="matchBtn"><i class="bi bi-broadcast-pin"></i> 匹配预案</button></div>
        </div>
        <div id="matchOut" class="mt-2"></div>
      `);
    }

    function renderDiff() {
      const a = $('#diffA').val(), b = $('#diffB').val();
      if (!a || !b) return;
      const d = api.emergency.diff(selRes, a, b);
      $('#diffOut').html(d.levels.map(lv => `
        <div class="mb-2"><div class="d-flex justify-content-between"><span class="fw-bold small">${lv.level}</span><span class="mono small text-muted">阈值 ${lv.threshold}m</span></div>
        ${lv.lines.map(ln => `<div class="diff-line ${ln.type === 'add' ? 'diff-add' : ln.type === 'del' ? 'diff-del' : 'diff-eq'}">${ln.type === 'add' ? '+ ' : ln.type === 'del' ? '- ' : '  '}${ln.text}</div>`).join('')}</div>`).join(''));
    }

    function renderMatch() {
      const level = +$('#matchLevel').val();
      if (!(level >= 0)) { App.toast('水位须为非负数', 'warn'); return; }
      try {
        const m = api.emergency.match(selRes, level);
        $('#matchOut').html(`
          <div class="alert alert-danger py-2"><i class="bi bi-exclamation-octagon-fill"></i> 匹配响应级别：<b>${m.matchedLevel}</b>（阈值 ${m.threshold}m）</div>
          <div class="mb-2">${m.allLevels.map(l => `<span class="tag ${l.active ? 'bad pulse' : 'mute'} me-1">${l.name} ${l.active ? '✓' : ''}</span>`).join('')}</div>
          <ul class="small mb-0 ps-3">${m.measures.map(x => `<li>${x}</li>`).join('')}</ul>
        `);
        App.toast('已匹配 ' + m.matchedLevel + ' 响应措施', 'success');
      } catch (err) { App.toast(err.message || '匹配失败', 'error'); }
    }

    let ctRole = 'all';
    function renderContacts(kw) {
      const groups = kw ? api.contacts.search(kw) : api.contacts.list(ctRole === 'all' ? null : ctRole);
      $('#ctList').html(Object.keys(groups).length ? Object.entries(groups).map(([g, list]) => `
        <div class="mb-2"><div class="small text-muted fw-bold">${g}（${list.length}）</div>
        ${list.map(c => `<label class="d-flex align-items-center gap-2 py-1 small"><input type="checkbox" class="form-check-input ct-check" value="${c._id}"><span>${c.name}</span><span class="text-muted mono ms-auto">${c.phone}</span></label>`).join('')}</div>`).join('') : '<div class="empty"><i class="bi bi-search"></i>未找到联系人</div>');
    }
    function renderLogs() {
      $('#ctLogs').html(api.contacts.notifyLogs().map(l => `<div class="small d-flex justify-content-between border-bottom border-secondary py-1"><span><i class="bi bi-check2 text-success"></i> ${l.name} <span class="text-muted">${l.phone}</span></span><span class="mono text-muted">${App.fmtTime(l.sentAt)}</span></div>`).join('') || '<div class="empty small">暂无通知记录</div>');
    }

    // events
    $('#planTree').on('click', '.tnode[data-res]', function (e) {
      selRes = $(this).data('res'); selVer = (api.emergency.versions(selRes).find(v => v.current) || api.emergency.versions(selRes).slice(-1)[0])._id;
      renderTree(); renderVersion();
    });
    $('#planTree').on('click', '.tnode[data-ver]', function () { selVer = $(this).data('ver'); renderTree(); renderVersion(); });
    $('#diffArea').on('click', '#diffBtn', renderDiff);
    $('#matchArea').on('click', '#matchBtn', renderMatch);
    $('#ctSearch').on('input', function () { renderContacts($(this).val()); });
    $('#ctRole .btn').on('click', function () { $(this).siblings().removeClass('active'); $(this).addClass('active'); ctRole = $(this).data('r'); renderContacts(); });
    $('#ctNotify').on('click', function () {
      const ids = $('.ct-check:checked').map(function () { return $(this).val(); }).get();
      const msg = $('#ctMsg').val();
      if (!ids.length) { App.toast('请勾选通知对象', 'warn'); return; }
      if (!msg) { App.toast('请填写通知内容', 'warn'); return; }
      try { const r = api.contacts.notify(ids, msg); App.toast('已通知 ' + r.count + ' 人', 'success'); $('#ctMsg').val(''); renderLogs(); }
      catch (err) { App.toast(err.message || '通知失败', 'error'); }
    });

    renderTree(); renderVersion(); renderContacts(); renderLogs();
  }
});
