/* 预案管理页 — 预案树、版本差异比对、水位匹配、应急通讯录 */
App.registerPage('emergency', {
  title: '预案管理',
  sub: '防汛预案版本化 · 相邻版本差异比对 · 水位自动匹配 · 应急通讯录',
  async render($el, App) {
    const api = App.api;
    let selRes = null, selVer = null;

    const treeRaw = await api.emergency.planTree();
    const tree = adaptPlanTree(treeRaw);
    selRes = tree[0].reservoirId;
    const firstVersRaw = await api.emergency.versions(selRes);
    const firstVers = adaptVersions(firstVersRaw);
    selVer = (firstVers.find(v => v.current) || firstVers[firstVers.length - 1])._id;

    let contactsTotal = 0;
    try {
      const allContacts = await api.contacts.list();
      contactsTotal = Array.isArray(allContacts) ? allContacts.length : 0;
    } catch (e) { contactsTotal = 0; }

    App.setQuickStats(
      chip('水库预案', tree.length, 'info') + chip('版本总数', tree.reduce((s, r) => s + r.versions.length, 0), 'ok') +
      chip('通讯录', contactsTotal, 'info')
    );

    $el.html(`
      <div class="row g-3">
        <div class="col-12 col-xl-3">
          <div class="panel"><div class="panel-head"><span class="panel-title"><i class="bi bi-diagram-2"></i>预案层级</span><button class="btn btn-primary btn-sm ms-auto" id="addPlanBtn"><i class="bi bi-plus-lg"></i> 新建预案</button></div>
            <div class="panel-body"><div class="tree" id="planTree"></div></div>
          </div>
        </div>
        <div class="col-12 col-xl-5">
          <div class="panel"><div class="panel-head"><span class="panel-title"><i class="bi bi-file-earmark-ruled"></i>预案详情</span><span class="small text-muted" id="verMeta"></span>
              <div class="btn-group btn-group-sm ms-auto">
                <button class="btn btn-outline-light" id="editPlanBtn"><i class="bi bi-pencil"></i> 编辑</button>
                <button class="btn btn-outline-danger" id="delPlanBtn"><i class="bi bi-trash"></i> 删除</button>
              </div>
            </div>
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

      <div class="modal fade" tabindex="-1" id="planModal">
        <div class="modal-dialog modal-dialog-centered modal-xl">
          <div class="modal-content bg-dark border border-secondary">
            <div class="modal-header border-secondary">
              <h6 class="modal-title" id="planModalTitle"><i class="bi bi-plus-lg"></i> 新建预案</h6>
              <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="planForm">
                <div class="row g-2">
                  <div class="col-12 col-md-6"><label class="form-label">所属水库 <span class="text-danger">*</span></label>
                    <select class="form-select form-select-sm" id="fReservoir"></select>
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">预案名称 <span class="text-danger">*</span></label>
                    <input class="form-control form-control-sm" id="fPlanName" placeholder="例：2024年度防汛应急预案">
                  </div>
                  <div class="col-6 col-md-3"><label class="form-label">版本号</label>
                    <input class="form-control form-control-sm mono" id="fVersion" value="1.0" placeholder="1.0">
                  </div>
                  <div class="col-6 col-md-3"><label class="form-label">创建人</label>
                    <input class="form-control form-control-sm" id="fCreatedBy" placeholder="例：张工">
                  </div>
                  <div class="col-12"><label class="form-label">响应等级</label>
                    <div class="btn-group btn-group-sm w-100" id="levelTags">
                      <button type="button" class="btn btn-outline-info active" data-lv="Level4">Ⅳ级（蓝）</button>
                      <button type="button" class="btn btn-outline-success" data-lv="Level3">Ⅲ级（黄）</button>
                      <button type="button" class="btn btn-outline-warning" data-lv="Level2">Ⅱ级（橙）</button>
                      <button type="button" class="btn btn-outline-danger" data-lv="Level1">Ⅰ级（红）</button>
                    </div>
                  </div>
                  <div class="col-12"><div class="divider"></div><div class="small text-muted mb-2"><i class="bi bi-layers"></i> 等级参数（按启用的等级填写）</div></div>
                  <div class="col-6 col-md-3"><label class="form-label">Ⅳ级 触发水位(m)</label>
                    <input class="form-control form-control-sm mono lv-input" data-lv="Level4" data-field="threshold" type="number" step="0.1" value="75">
                  </div>
                  <div class="col-6 col-md-3"><label class="form-label">Ⅲ级 触发水位(m)</label>
                    <input class="form-control form-control-sm mono lv-input" data-lv="Level3" data-field="threshold" type="number" step="0.1" value="80">
                  </div>
                  <div class="col-6 col-md-3"><label class="form-label">Ⅱ级 触发水位(m)</label>
                    <input class="form-control form-control-sm mono lv-input" data-lv="Level2" data-field="threshold" type="number" step="0.1" value="85">
                  </div>
                  <div class="col-6 col-md-3"><label class="form-label">Ⅰ级 触发水位(m)</label>
                    <input class="form-control form-control-sm mono lv-input" data-lv="Level1" data-field="threshold" type="number" step="0.1" value="90">
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">Ⅳ级 响应措施 <span class="small text-muted">(每行一条)</span></label>
                    <textarea class="form-control form-control-sm lv-input" data-lv="Level4" data-field="measures" rows="3" placeholder="启动防汛Ⅳ级应急响应&#10;值班人员到岗&#10;加强水位监测"></textarea>
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">Ⅲ级 响应措施 <span class="small text-muted">(每行一条)</span></label>
                    <textarea class="form-control form-control-sm lv-input" data-lv="Level3" data-field="measures" rows="3" placeholder="启动防汛Ⅲ级应急响应&#10;抢险队伍待命&#10;开启部分泄洪闸"></textarea>
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">Ⅱ级 响应措施 <span class="small text-muted">(每行一条)</span></label>
                    <textarea class="form-control form-control-sm lv-input" data-lv="Level2" data-field="measures" rows="3" placeholder="启动防汛Ⅱ级应急响应&#10;抢险队伍进驻&#10;加大泄洪力度"></textarea>
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">Ⅰ级 响应措施 <span class="small text-muted">(每行一条)</span></label>
                    <textarea class="form-control form-control-sm lv-input" data-lv="Level1" data-field="measures" rows="3" placeholder="启动防汛Ⅰ级应急响应&#10;全员到岗&#10;全力泄洪&#10;人员转移"></textarea>
                  </div>
                  <div class="col-12"><div class="divider"></div></div>
                  <div class="col-12"><label class="form-label">通用措施 <span class="small text-muted">(每行一条)</span></label>
                    <textarea class="form-control form-control-sm" id="fGeneralMeasures" rows="2" placeholder="做好值班记录&#10;保持通讯畅通"></textarea>
                  </div>
                  <div class="col-12"><label class="form-label">应急联系人 <span class="small text-muted">(每行：姓名,角色,电话)</span></label>
                    <textarea class="form-control form-control-sm mono" id="fContacts" rows="3" placeholder="李明,指挥长,13800000001&#10;王芳,副指挥,13800000002&#10;张伟,抢险队长,13800000003"></textarea>
                  </div>
                  <div class="col-12"><label class="form-label">预案描述</label>
                    <textarea class="form-control form-control-sm" id="fDescription" rows="2" placeholder="选填，简要说明本预案适用场景和总体要求"></textarea>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer border-secondary">
              <button class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">取消</button>
              <button class="btn btn-primary btn-sm" id="submitPlan"><i class="bi bi-check2-circle"></i> 保存</button>
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
          <ul ${open ? '' : 'style="display:none"'}>${r.versions.map(v => `<li><div class="tnode ${v._id === selVer ? 'sel' : ''}" data-ver="${v._id}" data-res="${r.reservoirId}" style="position:relative">
            <span class="ver-label"><i class="bi bi-${v.current ? 'star-fill' : v.draft ? 'pencil' : 'file-earmark'}"></i> v${v.version} ${v.current ? '<span class="tag ok">现行</span>' : v.draft ? '<span class="tag warn">草案</span>' : ''}</span>
            <span class="ver-actions" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);display:none">
              <i class="bi bi-pencil-square text-info ver-edit" style="cursor:pointer;margin-right:6px" title="编辑"></i>
              <i class="bi bi-trash text-danger ver-del" style="cursor:pointer" title="删除"></i>
            </span>
          </div></li>`).join('')}</ul>
        </div>`;
      }).join(''));
      $('#planTree .tnode[data-ver]').hover(
        function () { $(this).find('.ver-actions').show(); },
        function () { $(this).find('.ver-actions').hide(); }
      );
    }

    async function renderVersion() {
      try {
        const versRaw = await api.emergency.versions(selRes);
        const vers = adaptVersions(versRaw);
        const v = vers.find(x => x._id === selVer) || vers[vers.length - 1];
        selVer = v._id;

        let planDetail = null;
        try {
          planDetail = await api.emergency.getVersion(selVer);
        } catch (e) { planDetail = null; }

        const levels = planDetail?.levels || v.levels || [];

        $('#verMeta').text('v' + v.version + ' · ' + App.fmtDate(v.publishTime) + ' · ' + v.author);
        $('#verDetail').html(`
          ${v.current ? '<div class="tag ok mb-2"><span class="dot ok"></span>现行版本</div>' : v.draft ? '<div class="tag warn mb-2"><span class="dot warn"></span>草案</div>' : '<div class="tag mute mb-2">历史版本</div>'}
          ${levels.map(l => `
            <div class="mb-2"><div class="d-flex justify-content-between"><span class="fw-bold">${l.name}</span><span class="mono small text-muted">水位 ≥ ${l.threshold}m</span></div>
            <ul class="small mb-0 ps-3">${l.measures.map(m => `<li>${m}</li>`).join('')}</ul></div>`).join('')}
        `);

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
            <div class="col-7"><label class="form-label">输入当前水位(m)</label><input class="form-control form-control-sm mono" id="matchLevel" type="number" step="0.1" value="${v.currentLevel || 80}"></div>
            <div class="col-5 d-grid"><button class="btn btn-danger btn-sm" id="matchBtn"><i class="bi bi-broadcast-pin"></i> 匹配预案</button></div>
          </div>
          <div id="matchOut" class="mt-2"></div>
        `);
      } catch (err) {
        $('#verDetail').html('<div class="empty text-danger">加载失败：' + (err.message || '') + '</div>');
      }
    }

    async function renderDiff() {
      const a = $('#diffA').val(), b = $('#diffB').val();
      if (!a || !b) return;
      try {
        const d = await api.emergency.diff(selRes, a, b);
        const diffItems = adaptDiff(d);
        $('#diffOut').html(diffItems.levels.map(lv => `
          <div class="mb-2"><div class="d-flex justify-content-between"><span class="fw-bold small">${lv.level}</span><span class="mono small text-muted">阈值 ${lv.threshold}m</span></div>
          ${lv.lines.map(ln => `<div class="diff-line ${ln.type === 'add' ? 'diff-add' : ln.type === 'del' ? 'diff-del' : 'diff-eq'}">${ln.type === 'add' ? '+ ' : ln.type === 'del' ? '- ' : '  '}${ln.text}</div>`).join('')}</div>`).join(''));
      } catch (err) {
        $('#diffOut').html('<div class="text-danger small">比对失败：' + (err.message || '') + '</div>');
      }
    }

    async function renderMatch() {
      const level = +$('#matchLevel').val();
      if (!(level >= 0)) { App.toast('水位须为非负数', 'warn'); return; }
      try {
        const m = await api.emergency.match(selRes, level);
        const adapted = adaptMatchResult(m);
        $('#matchOut').html(`
          <div class="alert alert-danger py-2"><i class="bi bi-exclamation-octagon-fill"></i> 匹配响应级别：<b>${adapted.matchedLevel}</b>（阈值 ${adapted.threshold}m）</div>
          <div class="mb-2">${adapted.allLevels.map(l => `<span class="tag ${l.active ? 'bad pulse' : 'mute'} me-1">${l.name} ${l.active ? '✓' : ''}</span>`).join('')}</div>
          <ul class="small mb-0 ps-3">${adapted.measures.map(x => `<li>${x}</li>`).join('')}</ul>
        `);
        App.toast('已匹配 ' + adapted.matchedLevel + ' 响应措施', 'success');
      } catch (err) { App.toast(err.message || '匹配失败', 'error'); }
    }

    let ctRole = 'all';
    async function renderContacts(kw) {
      try {
        const roleMap = { 'all': null, '调度员': 'dispatcher', '巡检员': 'inspector', '管理员': 'admin', '维护人员': 'maintenance' };
        const data = kw
          ? await api.contacts.search(kw)
          : await api.contacts.list(roleMap[ctRole] || null);

        const groups = groupContacts(data);
        $('#ctList').html(Object.keys(groups).length ? Object.entries(groups).map(([g, list]) => `
          <div class="mb-2"><div class="small text-muted fw-bold">${g}（${list.length}）</div>
          ${list.map(c => `<label class="d-flex align-items-center gap-2 py-1 small"><input type="checkbox" class="form-check-input ct-check" value="${c._id}"><span>${c.name}</span><span class="text-muted mono ms-auto">${c.phone}</span></label>`).join('')}</div>`).join('') : '<div class="empty"><i class="bi bi-search"></i>未找到联系人</div>');
      } catch (err) {
        $('#ctList').html('<div class="empty text-danger">加载失败</div>');
      }
    }

    async function renderLogs() {
      try {
        const logs = await api.contacts.notifyLogs();
        $('#ctLogs').html(logs.map(l => `<div class="small d-flex justify-content-between border-bottom border-secondary py-1"><span><i class="bi bi-check2 text-success"></i> ${l.name || l.recipientName} <span class="text-muted">${l.phone || l.recipientPhone}</span></span><span class="mono text-muted">${App.fmtTime(l.sentAt || l.createdAt)}</span></div>`).join('') || '<div class="empty small">暂无通知记录</div>');
      } catch (e) {
        $('#ctLogs').html('<div class="empty small">暂无通知记录</div>');
      }
    }

    let editingId = null;
    let modal = null;

    const LEVEL_NAMES = {
      Level4: 'Ⅳ级响应',
      Level3: 'Ⅲ级响应',
      Level2: 'Ⅱ级响应',
      Level1: 'Ⅰ级响应'
    };
    const LEVEL_COLORS = {
      Level4: 'blue',
      Level3: 'yellow',
      Level2: 'orange',
      Level1: 'red'
    };

    function initModal() {
      modal = new bootstrap.Modal(document.getElementById('planModal'));
      $('#fReservoir').html(tree.map(r => `<option value="${r.reservoirId}">${r.reservoirName}</option>`).join(''));
    }

    function getActiveLevels() {
      return $('#levelTags .btn.active').map(function () { return $(this).data('lv'); }).get();
    }

    function updateLevelInputsState() {
      const active = getActiveLevels();
      $('.lv-input').each(function () {
        const lv = $(this).data('lv');
        $(this).prop('disabled', !active.includes(lv));
      });
    }

    async function openModal(planId) {
      editingId = planId || null;
      $('#planModalTitle').html(planId ? '<i class="bi bi-pencil"></i> 编辑预案' : '<i class="bi bi-plus-lg"></i> 新建预案');

      if (planId) {
        try {
          const raw = await api.emergency.getVersion(planId);
          const detail = adaptPlanDetail(raw);
          $('#fReservoir').val(detail.reservoirId);
          $('#fPlanName').val(detail.planName || '');
          $('#fVersion').val(detail.version || '');
          $('#fCreatedBy').val(detail.author || '');
          $('#fDescription').val(detail.description || '');
          $('#fGeneralMeasures').val((detail.generalMeasures || []).join('\n'));
          $('#fContacts').val((detail.contacts || []).map(c => `${c.name},${c.role},${c.phone}`).join('\n'));

          const levelKeys = (detail.levels || []).map(l => l.key);
          $('#levelTags .btn').each(function () {
            const lv = $(this).data('lv');
            $(this).toggleClass('active', levelKeys.includes(lv));
          });

          (detail.levels || []).forEach(l => {
            $(`.lv-input[data-lv="${l.key}"][data-field="threshold"]`).val(l.threshold);
            $(`.lv-input[data-lv="${l.key}"][data-field="measures"]`).val((l.measures || []).join('\n'));
          });

          updateLevelInputsState();
        } catch (err) {
          App.toast(err.message || '加载预案详情失败', 'error');
          return;
        }
      } else {
        $('#fReservoir').val(selRes);
        $('#fPlanName').val('');
        $('#fVersion').val('1.0');
        $('#fCreatedBy').val(App.currentUser ? App.currentUser() : '');
        $('#fDescription').val('');
        $('#fGeneralMeasures').val('');
        $('#fContacts').val('');
        $('#levelTags .btn').removeClass('active').first().addClass('active');
        $('.lv-input[data-field="threshold"]').each(function (i) {
          $(this).val([75, 80, 85, 90][i]);
        });
        $('.lv-input[data-field="measures"]').val('');
        updateLevelInputsState();
      }

      modal.show();
    }

    function collectFormData() {
      const activeLevels = getActiveLevels();
      const levels = activeLevels.map(lv => {
        const threshold = parseFloat($(`.lv-input[data-lv="${lv}"][data-field="threshold"]`).val()) || 0;
        const measuresText = $(`.lv-input[data-lv="${lv}"][data-field="measures"]`).val() || '';
        const measures = measuresText.split('\n').filter(s => s.trim()).map((m, i) => ({
          measureId: '',
          title: m.trim().slice(0, 20),
          content: m.trim(),
          category: '',
          order: i
        }));
        return {
          level: lv,
          levelName: LEVEL_NAMES[lv],
          triggerWaterLevel: threshold,
          color: LEVEL_COLORS[lv],
          measures: measures
        };
      });

      const generalText = $('#fGeneralMeasures').val() || '';
      const generalMeasures = generalText.split('\n').filter(s => s.trim()).map(s => s.trim());

      const contactsText = $('#fContacts').val() || '';
      const contacts = contactsText.split('\n').filter(s => s.trim()).map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          name: parts[0] || '',
          role: parts[1] || '',
          phone: parts[2] || '',
          department: parts[3] || ''
        };
      }).filter(c => c.name);

      return {
        reservoirId: $('#fReservoir').val(),
        planName: $('#fPlanName').val().trim(),
        version: $('#fVersion').val().trim(),
        levels: levels,
        generalMeasures: generalMeasures,
        emergencyContacts: contacts,
        description: $('#fDescription').val().trim(),
        createdBy: $('#fCreatedBy').val().trim()
      };
    }

    function validateForm(d) {
      if (!d.reservoirId) return '请选择所属水库';
      if (!d.planName) return '请填写预案名称';
      if (!d.version) return '请填写版本号';
      if (d.levels.length === 0) return '请至少选择一个响应等级';
      for (const lv of d.levels) {
        if (isNaN(lv.triggerWaterLevel) || lv.triggerWaterLevel < 0) return `${lv.levelName} 的触发水位无效`;
      }
      return null;
    }

    async function refreshTreeAndVersion() {
      const treeRaw = await api.emergency.planTree();
      tree.splice(0, tree.length, ...adaptPlanTree(treeRaw));
      if (selVer) {
        const versRaw = await api.emergency.versions(selRes);
        const vers = adaptVersions(versRaw);
        if (!vers.find(v => v._id === selVer)) {
          selVer = (vers.find(v => v.current) || vers[vers.length - 1])._id;
        }
      }
      renderTree();
      renderVersion();
    }

    $('#planTree').on('click', '.tnode[data-res]', async function (e) {
      if ($(e.target).hasClass('ver-edit') || $(e.target).hasClass('ver-del')) return;
      selRes = $(this).data('res');
      const versRaw = await api.emergency.versions(selRes);
      const vers = adaptVersions(versRaw);
      selVer = (vers.find(v => v.current) || vers[vers.length - 1])._id;
      renderTree(); renderVersion();
    });
    $('#planTree').on('click', '.tnode[data-ver]', function (e) {
      if ($(e.target).hasClass('ver-edit') || $(e.target).hasClass('ver-del')) return;
      selVer = $(this).data('ver');
      renderTree(); renderVersion();
    });
    $('#planTree').on('click', '.ver-edit', function (e) {
      e.stopPropagation();
      const verId = $(this).closest('.tnode[data-ver]').data('ver');
      selVer = verId;
      openModal(verId);
    });
    $('#planTree').on('click', '.ver-del', async function (e) {
      e.stopPropagation();
      const verId = $(this).closest('.tnode[data-ver]').data('ver');
      const resId = $(this).closest('.tnode[data-ver]').data('res');
      if (!window.confirm('确定要删除该预案版本吗？此操作不可恢复。')) return;
      try {
        await api.emergency.deletePlan(verId);
        App.toast('删除成功', 'success');
        if (selVer === verId) selVer = null;
        selRes = resId;
        await refreshTreeAndVersion();
      } catch (err) { App.toast(err.message || '删除失败', 'error'); }
    });
    $('#diffArea').on('click', '#diffBtn', renderDiff);
    $('#matchArea').on('click', '#matchBtn', renderMatch);
    $('#ctSearch').on('input', function () { renderContacts($(this).val()); });
    $('#ctRole .btn').on('click', function () { $(this).siblings().removeClass('active'); $(this).addClass('active'); ctRole = $(this).data('r'); renderContacts(); });
    $('#ctNotify').on('click', async function () {
      const ids = $('.ct-check:checked').map(function () { return $(this).val(); }).get();
      const msg = $('#ctMsg').val();
      if (!ids.length) { App.toast('请勾选通知对象', 'warn'); return; }
      if (!msg) { App.toast('请填写通知内容', 'warn'); return; }
      try {
        const r = await api.contacts.notify(ids, '应急通知', msg);
        App.toast('已通知 ' + (r.count || r.successCount || ids.length) + ' 人', 'success');
        $('#ctMsg').val('');
        renderLogs();
      }
      catch (err) { App.toast(err.message || '通知失败', 'error'); }
    });

    $('#addPlanBtn').on('click', function () { openModal(null); });

    $('#editPlanBtn').on('click', function () {
      if (!selVer) { App.toast('请先选择预案版本', 'warn'); return; }
      openModal(selVer);
    });

    $('#delPlanBtn').on('click', async function () {
      if (!selVer) { App.toast('请先选择预案版本', 'warn'); return; }
      if (!window.confirm('确定要删除该预案版本吗？此操作不可恢复。')) return;
      try {
        await api.emergency.deletePlan(selVer);
        App.toast('删除成功', 'success');
        selVer = null;
        await refreshTreeAndVersion();
      } catch (err) { App.toast(err.message || '删除失败', 'error'); }
    });

    $('#levelTags').on('click', '.btn', function (e) {
      e.preventDefault();
      $(this).toggleClass('active');
      updateLevelInputsState();
    });

    $('#submitPlan').on('click', async function () {
      const data = collectFormData();
      const err = validateForm(data);
      if (err) { App.toast(err, 'warn'); return; }
      try {
        let result;
        if (editingId) {
          result = await api.emergency.updatePlan(editingId, data);
          App.toast('更新成功', 'success');
        } else {
          result = await api.emergency.createPlan(data);
          App.toast('创建成功', 'success');
        }
        const adapted = adaptPlanDetail(result);
        selRes = adapted.reservoirId;
        selVer = adapted._id;
        modal.hide();
        await refreshTreeAndVersion();
      } catch (err) { App.toast(err.message || '保存失败', 'error'); }
    });

    initModal();
    renderTree(); renderVersion(); renderContacts(); renderLogs();
  }
});

function adaptPlanTree(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(r => ({
    reservoirId: r.reservoirId || (r.id || '').replace('res_', '') || r.Id,
    reservoirName: r.reservoirName || r.name || r.Name || '',
    versions: adaptVersions(r.children || r.versions || [])
  }));
}

function adaptVersions(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(v => ({
    _id: v.id || v.Id || v._id,
    version: v.version || v.Version || v.versionNumber || '1.0',
    current: v.isCurrent ?? v.IsCurrent ?? v.current ?? false,
    draft: (v.status || v.Status || '').toLowerCase() === 'draft',
    publishTime: v.updatedAt || v.UpdatedAt || v.publishTime || Date.now(),
    author: v.author || v.Author || '',
    levels: v.levels || v.Levels || [],
    currentLevel: v.currentLevel || 80
  }));
}

function adaptPlanDetail(raw) {
  if (!raw) return null;
  const levels = raw.levels || raw.Levels || [];
  const adaptedLevels = levels.map(l => ({
    key: l.level || l.Level || '',
    name: l.levelName || l.LevelName || '',
    threshold: l.triggerWaterLevel ?? l.TriggerWaterLevel ?? 0,
    measures: (l.measures || l.Measures || []).map(m => m.content || m.Content || m.title || m.Title || '')
  }));
  return {
    _id: raw.id || raw.Id || raw._id,
    reservoirId: raw.reservoirId || raw.ReservoirId || '',
    reservoirName: raw.reservoirName || raw.ReservoirName || '',
    planName: raw.planName || raw.PlanName || '',
    version: raw.version || raw.Version || '',
    author: raw.author || raw.Author || raw.approvedBy || raw.ApprovedBy || '',
    description: raw.description || raw.Description || '',
    levels: adaptedLevels,
    generalMeasures: raw.generalMeasures || raw.GeneralMeasures || [],
    contacts: (raw.emergencyContacts || raw.EmergencyContacts || []).map(c => ({
      name: c.name || c.Name || '',
      role: c.role || c.Role || '',
      phone: c.phone || c.Phone || '',
      department: c.department || c.Department || ''
    }))
  };
}

function adaptDiff(d) {
  if (!d) return { levels: [] };
  const diffs = d.differences || d.Differences || [];
  const levels = {};
  diffs.forEach(diff => {
    const path = diff.path || diff.Path || '';
    const match = path.match(/levels\.([^.]+)/);
    const levelName = match ? match[1] : '其他';
    if (!levels[levelName]) levels[levelName] = { level: levelName, threshold: '', lines: [] };
    const type = (diff.changeType || diff.ChangeType || 'modified').toLowerCase();
    const lineType = type === 'added' ? 'add' : type === 'deleted' ? 'del' : 'eq';
    const text = (diff.field || diff.Field || '') + ': ' + (diff.newValue || diff.NewValue || diff.oldValue || diff.OldValue || '');
    levels[levelName].lines.push({ type: lineType, text });
  });
  return { levels: Object.values(levels) };
}

function adaptMatchResult(m) {
  if (!m) return { matchedLevel: '', threshold: 0, allLevels: [], measures: [] };
  return {
    matchedLevel: m.levelName || m.LevelName || m.matchedLevel || '',
    threshold: m.triggerWaterLevel ?? m.TriggerWaterLevel ?? 0,
    allLevels: [
      { name: m.levelName || '', active: true }
    ],
    measures: (m.measures || m.Measures || []).map(x => x.content || x.Content || x.title || x.Title || '')
  };
}

function groupContacts(data) {
  if (!data || !Array.isArray(data)) return {};
  const groups = {};
  data.forEach(c => {
    const role = c.roleName || c.RoleName || c.role || '其他';
    if (!groups[role]) groups[role] = [];
    groups[role].push({
      _id: c.id || c.Id || c._id,
      name: c.name || c.Name || '',
      phone: c.phone || c.Phone || '',
      role: role
    });
  });
  return groups;
}
