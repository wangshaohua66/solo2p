/* ==========================================================================
   app/modules/project/list.js — 项目看板模块
   项目卡片网格、多条件筛选、拖拽排序、新建项目
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { type: '全部', stage: '全部', risk: '全部', kw: '' };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };

  function filtered() {
    var projects = DS().getProjects().slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    return projects.filter(function (p) {
      if (state.type !== '全部' && p.type !== state.type) return false;
      if (state.stage !== '全部' && p.stage !== state.stage) return false;
      if (state.risk !== '全部' && p.riskLevel !== state.risk) return false;
      if (state.kw && p.name.indexOf(state.kw) < 0 && p.manager.indexOf(state.kw) < 0) return false;
      return true;
    });
  }

  function statCards() {
    var all = DS().getProjects();
    var warns = DS().getWarnings(null, '待处理');
    var high = all.filter(function (p) { return p.riskLevel === '高'; }).length;
    var inProgress = all.filter(function (p) { return p.stage !== '竣工'; }).length;
    return [
      { label: '在建项目', value: all.length, icon: 'bi-buildings', delta: '住宅/商业/市政三类', ok: true },
      { label: '推进中', value: inProgress, icon: 'bi-graph-up-arrow', delta: '未竣工项目', ok: true },
      { label: '高风险项目', value: high, icon: 'bi-exclamation-octagon', delta: high ? '需重点盯控' : '风险可控', ok: !high },
      { label: '待处置预警', value: warns.length, icon: 'bi-bell', delta: '工期/资源/节点', ok: !warns.length }
    ];
  }

  function taskCount(pid) { return DS().getTasks(pid).length; }
  function warnCount(pid) { return DS().getWarnings(pid, '待处理').length; }

  function renderCard(p) {
    var wc = warnCount(p.id);
    var riskClass = p.riskLevel === '高' ? 'risk-high' : (p.riskLevel === '中' ? 'risk-mid' : 'risk-low');
    var ringColor = p.riskLevel === '高' ? 'var(--red)' : (p.riskLevel === '中' ? 'var(--amber)' : 'var(--green)');
    return '<div class="col-xl-3 col-lg-4 col-md-6 mb-3 project-col" draggable="true" data-id="' + p.id + '">' +
      '<div class="project-card ' + riskClass + '" data-id="' + p.id + '">' +
      '<div class="risk-bar"></div>' +
      '<div class="pc-body">' +
        '<div class="pc-top">' +
          '<div><div class="pc-name">' + UI().escape(p.name) + '</div>' +
          '<div class="pc-type"><span style="color:' + UI().typeColor(p.type) + '">' + UI().escape(p.type) + '</span> · ' + UI().escape(p.stage) + '</div></div>' +
          UI().riskBadge(p.riskLevel) +
        '</div>' +
        '<div class="pc-mid">' +
          UI().ringSVG(p.progress, 74, 7, ringColor) +
          '<div class="pc-meta">' +
            '<div><div class="k">项目经理</div><div class="v">' + UI().escape(p.manager) + '</div></div>' +
            '<div><div class="k">任务节点</div><div class="v mono">' + taskCount(p.id) + '</div></div>' +
            '<div><div class="k">开工</div><div class="v mono">' + moment(p.startDate).format('MM-DD') + '</div></div>' +
            '<div><div class="k">竣工</div><div class="v mono">' + moment(p.endDate).format('MM-DD') + '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="pc-foot">' +
          UI().stageBadge(p.stage) +
          '<span class="badge-stage">' + moment(p.endDate).diff(moment(p.startDate), 'days') + '天</span>' +
          '<span class="warn-pill ' + (wc ? '' : 'zero') + '"><i class="bi bi-bell-fill"></i> ' + wc + '</span>' +
        '</div>' +
      '</div>' +
      '</div></div>';
  }

  function renderGrid($main) {
    var list = filtered();
    var $grid = $main.find('#project-grid');
    if (!list.length) { UI().empty($grid, 'bi-inbox', '没有符合筛选条件的项目'); return; }
    $grid.html('<div class="row stagger">' + list.map(renderCard).join('') + '</div>');
  }

  function renderStats($main) {
    var cards = statCards();
    $main.find('#stat-row').html(cards.map(function (c) {
      return '<div class="col-6 col-lg-3 mb-3"><div class="stat-card">' +
        '<div class="label">' + UI().escape(c.label) + '</div>' +
        '<div class="value mono ' + (c.ok ? 'text-green' : 'text-red') + '">' + c.value + '</div>' +
        '<div class="delta text-muted-2">' + UI().escape(c.delta) + '</div>' +
        '<i class="bi ' + c.icon + ' icon"></i></div></div>';
    }).join(''));
  }

  function bindFilters($main) {
    $main.find('[data-seg]').each(function () {
      var key = $(this).data('seg');
      $(this).find('button').on('click', function () {
        state[key] = $(this).data('val');
        $(this).siblings().removeClass('on').end().addClass('on');
        renderGrid($main);
      });
    });
    $main.find('#kw-input').on('input', function () { state.kw = $(this).val().trim(); renderGrid($main); });
  }

  function bindDragSort($main) {
    var dragId = null;
    $main.on('dragstart', '.project-col', function (e) {
      dragId = $(this).data('id');
      this.style.opacity = '0.4';
    }).on('dragend', '.project-col', function () { this.style.opacity = '1'; })
      .on('dragover', '.project-col', function (e) { e.preventDefault(); })
      .on('drop', '.project-col', function (e) {
        e.preventDefault();
        var targetId = $(this).data('id');
        if (!dragId || dragId === targetId) return;
        var ids = filtered().map(function (p) { return p.id; });
        var from = ids.indexOf(dragId), to = ids.indexOf(targetId);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        DS().reorderProjects(ids);
        UI().toast('排序已更新', 'success', 1600);
        renderGrid($main);
      });
  }

  function openCreateModal() {
    var body =
      '<form id="proj-form" novalidate>' +
      '<div class="row g-3">' +
      '<div class="col-12"><div class="form-floating"><input class="form-control" id="pf-name" name="name" placeholder="项目名称" required><label for="pf-name">项目名称</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><select class="form-select" id="pf-type" name="type"><option>住宅</option><option>商业</option><option>市政</option></select><label for="pf-type">工程类型</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><select class="form-select" id="pf-stage" name="stage"><option>基础</option><option selected>主体</option><option>装饰</option><option>竣工</option></select><label for="pf-stage">当前阶段</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><select class="form-select" id="pf-risk" name="riskLevel"><option>低</option><option selected>中</option><option>高</option></select><label for="pf-risk">风险等级</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input class="form-control" id="pf-manager" name="manager" placeholder="项目经理" required><label for="pf-manager">项目经理</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input class="form-control" id="pf-start" name="startDate" type="date" required><label for="pf-start">开工日期</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input class="form-control" id="pf-end" name="endDate" type="date" required><label for="pf-end">竣工日期</label></div></div>' +
      '</div></form>';
    var footer = '<button class="btn btn-ghost btn-sm" data-bs-dismiss="modal">取消</button><button class="btn btn-amber btn-sm" id="pf-save">创建项目</button>';
    var m = UI().modal({ title: '<i class="bi bi-plus-circle text-amber me-2"></i>新建项目', body: body, footer: footer, size: 'lg' });
    global.App.Validator.apply('#proj-form', { name: 'required', manager: 'required', startDate: 'required', endDate: 'required' });
    m.$el.find('#pf-save').on('click', function () {
      if (!global.App.Validator.isValid('#proj-form')) return;
      var start = m.$el.find('#pf-start').val();
      var end = m.$el.find('#pf-end').val();
      if (moment(end).isBefore(moment(start))) { UI().toast('竣工日期不能早于开工日期', 'error'); return; }
      var proj = {
        id: DS().uid('P'), name: m.$el.find('#pf-name').val(), type: m.$el.find('#pf-type').val(),
        stage: m.$el.find('#pf-stage').val(), riskLevel: m.$el.find('#pf-risk').val(),
        manager: m.$el.find('#pf-manager').val(), startDate: start, endDate: end,
        progress: 0, createdAt: moment().format('YYYY-MM-DD')
      };
      DS().saveProject(proj);
      m.modal.hide();
      UI().toast('项目「' + proj.name + '」已创建', 'success');
      renderStats($('#app-main')); renderGrid($('#app-main'));
      global.App.refreshChrome && global.App.refreshChrome();
    });
  }

  M.render = function ($main) {
    state = { type: '全部', stage: '全部', risk: '全部', kw: '' };
    $main.html(
      '<div class="d-flex align-items-center mb-3"><div class="me-auto"><div class="text-muted-2" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase">PROJECT DASHBOARD</div><div style="font-size:13px;color:var(--steel-100)">统筹 15 个在建项目，钢筋/混凝土/模板工序协同管控</div></div>' +
      '<button class="btn btn-amber btn-sm" id="new-project-btn"><i class="bi bi-plus-lg"></i> 新建项目</button></div>' +
      '<div id="stat-row" class="row"></div>' +
      '<div class="filter-bar mt-1 mb-3">' +
      seg('type', '工程类型', ['全部', '住宅', '商业', '市政']) +
      seg('stage', '阶段', ['全部', '基础', '主体', '装饰', '竣工']) +
      seg('risk', '风险', ['全部', '高', '中', '低']) +
      '<div class="search-input"><i class="bi bi-search"></i><input id="kw-input" placeholder="搜索项目名称或项目经理"></div>' +
      '</div>' +
      '<div id="project-grid"></div>'
    );
    renderStats($main);
    renderGrid($main);
    bindFilters($main);
    bindDragSort($main);
    $main.find('#new-project-btn').on('click', openCreateModal);
    $main.on('click', '.project-card', function (e) {
      if ($(e.target).closest('.project-col.dragging').length) return;
      var id = $(this).data('id');
      global.App.setProject(id);
      global.App.go('#/gantt');
    });
  };

  function seg(key, label, vals) {
    return '<div class="seg" data-seg="' + key + '" title="' + label + '">' +
      vals.map(function (v, i) { return '<button class="' + (i === 0 ? 'on' : '') + '" data-val="' + v + '">' + v + '</button>'; }).join('') +
      '</div>';
  }

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.dashboard = M;
})(window);
