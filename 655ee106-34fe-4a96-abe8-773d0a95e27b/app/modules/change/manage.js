/* ==========================================================================
   app/modules/change/manage.js — 变更管理模块
   设计变更与签证记录、自动联动受影响任务工期与依赖、变更历史追溯
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { pid: null };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };
  var today = moment('2026-06-20');

  function load() { state.pid = global.App.Store.currentProjectId || (DS().getProjects()[0] && DS().getProjects()[0].id); }

  function renderTimeline($main) {
    var changes = DS().getChanges(state.pid).sort(function (a, b) { return b.changeDate.localeCompare(a.changeDate); });
    var $tl = $main.find('#change-timeline');
    if (!changes.length) { UI().empty($tl, 'bi-clock-history', '暂无变更记录'); return; }
    $tl.html('<div class="timeline">' + changes.map(function (c) {
      var tasks = String(c.affectedTaskIds || '').split(',').filter(Boolean).map(function (tid) { var t = DS().getTask(tid); return '<span class="chip-tag">' + UI().escape(t ? t.name : tid) + '</span>'; }).join(' ');
      return '<div class="tl-item"><div class="tl-date">' + moment(c.changeDate).format('YYYY-MM-DD') + '</div>' +
        '<div class="tl-title">' + UI().escape(c.title) + ' <span class="sev-tag ' + (c.visaAmount > 0 ? 'high' : 'low') + '">' + (c.visaAmount ? UI().fmtMoney(c.visaAmount) : '无签证') + '</span></div>' +
        '<div class="tl-body">' + UI().escape(c.content) + '</div>' +
        (tasks ? '<div class="tl-tags">' + tasks + (c.durationDelta ? ' <span class="chip-tag">工期' + (c.durationDelta > 0 ? '+' : '') + c.durationDelta + 'd</span>' : '') + '</div>' : '') +
        '<div class="tl-tags"><span class="chip-tag"><i class="bi bi-person"></i> ' + UI().escape(c.operator || '—') + '</span></div>' +
        '</div>';
    }).join('') + '</div>');
  }

  function openForm() {
    var tasks = DS().getTasks(state.pid);
    var taskOpts = tasks.map(function (t) { return '<option value="' + t.id + '">' + UI().escape(t.name) + ' (' + t.duration + 'd)</option>'; }).join('');
    var body =
      '<form id="change-form" novalidate><div class="row g-3">' +
      '<div class="col-12"><div class="form-floating"><input class="form-control" id="cf-title" required><label>变更标题</label></div></div>' +
      '<div class="col-12"><div class="form-floating"><textarea class="form-control" id="cf-content" style="height:90px" required></textarea><label>变更内容说明</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="number" step="0.01" class="form-control" id="cf-visa" value="0"><label>签证金额 (元)</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="number" class="form-control" id="cf-delta" value="0"><label>工期增减 (天，可负)</label></div></div>' +
      '<div class="col-12"><label class="form-label">受影响任务（可多选）</label><select class="form-select" id="cf-tasks" multiple size="6" style="height:auto">' + taskOpts + '</select><div class="text-muted-2" style="font-size:11px;margin-top:4px">将自动联动所选任务工期并重算关键路径</div></div>' +
      '<div class="col-12"><div class="form-floating"><input class="form-control" id="cf-operator" value="' + (DS().getProject(state.pid) ? DS().getProject(state.pid).manager : '') + '"><label>经办人</label></div></div>' +
      '</div></form>';
    var footer = '<button class="btn btn-ghost btn-sm" data-bs-dismiss="modal">取消</button><button class="btn btn-amber btn-sm" id="cf-save">登记变更</button>';
    var m = UI().modal({ title: '<i class="bi bi-file-earmark-diff text-amber me-2"></i>登记设计变更 / 签证', body: body, footer: footer, size: 'lg', scrollable: true });
    global.App.Validator.apply('#change-form', { 'cf-title': 'required', 'cf-content': 'required' });
    m.$el.find('#cf-save').on('click', function () {
      if (!global.App.Validator.isValid('#change-form')) return;
      var affected = m.$el.find('#cf-tasks').val() || [];
      var change = {
        projectId: state.pid,
        title: m.$el.find('#cf-title').val(),
        content: m.$el.find('#cf-content').val(),
        visaAmount: Number(m.$el.find('#cf-visa').val()) || 0,
        durationDelta: Number(m.$el.find('#cf-delta').val()) || 0,
        affectedTaskIds: affected.join(','),
        operator: m.$el.find('#cf-operator').val(),
        changeDate: today.format('YYYY-MM-DD')
      };
      DS().saveChange(change);
      m.modal.hide();
      UI().toast('变更已登记' + (affected.length ? '，已联动 ' + affected.length + ' 个任务工期' : ''), 'success');
      renderTimeline($('#app-main'));
      global.App.refreshChrome && global.App.refreshChrome();
    });
  }

  function renderSummary($main) {
    var changes = DS().getChanges(state.pid);
    var visa = changes.reduce(function (s, c) { return s + (c.visaAmount || 0); }, 0);
    var affected = changes.reduce(function (s, c) { return s + String(c.affectedTaskIds || '').split(',').filter(Boolean).length; }, 0);
    var cards = [
      { label: '变更记录', value: changes.length, icon: 'bi-file-earmark-diff', delta: '累计登记' },
      { label: '签证金额', value: UI().fmtMoney(visa), icon: 'bi-cash-coin', delta: '汇总' },
      { label: '受影响任务', value: affected, icon: 'bi-link-45deg', delta: '已联动工期' },
      { label: '本月变更', value: changes.filter(function (c) { return moment(c.changeDate).isSame(today, 'month'); }).length, icon: 'bi-calendar-month', delta: '当月' }
    ];
    $main.find('#change-stat').html(cards.map(function (c) {
      return '<div class="col-6 col-lg-3 mb-3"><div class="stat-card"><div class="label">' + UI().escape(c.label) + '</div><div class="value mono text-amber" style="font-size:' + (typeof c.value === 'string' && c.value.length > 8 ? '18px' : '28px') + '">' + c.value + '</div><div class="delta text-muted-2">' + UI().escape(c.delta) + '</div><i class="bi ' + c.icon + ' icon"></i></div></div>';
    }).join(''));
  }

  M.render = function ($main) {
    load();
    if (!state.pid) { UI().empty($main, 'bi-file-earmark-diff', '请先选择项目'); return; }
    var projs = DS().getProjects();
    var sel = projs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === state.pid ? ' selected' : '') + '>' + UI().escape(p.name) + '</option>'; }).join('');
    $main.html(
      '<div class="d-flex flex-wrap align-items-center gap-2 mb-3">' +
      '<select class="form-select form-select-sm" id="proj-select" style="width:auto;max-width:260px">' + sel + '</select>' +
      '<span class="text-muted-2" style="font-size:12px">设计变更与签证全流程追溯</span>' +
      '<button class="btn btn-amber btn-sm ms-auto" id="add-change"><i class="bi bi-plus-lg"></i> 登记变更</button></div>' +
      '<div id="change-stat" class="row"></div>' +
      '<div class="panel mt-1"><div class="panel-head"><span class="h"><i class="bi bi-clock-history"></i>变更历史追溯</span></div><div class="panel-body"><div id="change-timeline"></div></div></div>'
    );
    renderSummary($main);
    renderTimeline($main);
    $main.find('#proj-select').on('change', function () { state.pid = $(this).val(); global.App.setProject(state.pid); renderSummary($main); renderTimeline($main); });
    $main.find('#add-change').on('click', openForm);
  };

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.change = M;
})(window);
