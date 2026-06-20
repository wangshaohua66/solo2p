/* ==========================================================================
   app/modules/resource/schedule.js — 资源排程模块
   班组/设备泳道排班、时间重叠冲突检测、超载日期段高亮
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { pid: null, range: null, dayWidth: 26, resources: [], tasks: [], conflicts: [] };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };
  var today = moment('2026-06-20');

  function load() {
    state.pid = global.App.Store.currentProjectId || (DS().getProjects()[0] && DS().getProjects()[0].id);
    if (!state.pid) return;
    state.resources = DS().getResources(state.pid);
    state.tasks = DS().getTasks(state.pid).filter(function (t) { return t.resourceId; });
    var start = today.clone().subtract(7, 'days');
    var end = today.clone().add(45, 'days');
    // 收缩到任务范围外延
    if (state.tasks.length) {
      var tmin = moment.min.apply(null, state.tasks.map(function (t) { return moment(t.startDate); }));
      var tmax = moment.max.apply(null, state.tasks.map(function (t) { return moment(t.endDate); }));
      start = moment.min(start, tmin); end = moment.max(end, tmax);
    }
    state.range = { start: start.startOf('day'), end: end };
    state.conflicts = DS().detectResourceConflicts(DS().load(), state.pid);
  }
  function totalDays() { return state.range.end.diff(state.range.start, 'days') + 1; }
  function dayToX(d) { return moment(d).diff(state.range.start, 'days') * state.dayWidth; }

  function conflictDates(resId) {
    var set = {};
    state.conflicts.filter(function (c) { return c.resourceId === resId; }).forEach(function (c) { set[c.date] = true; });
    return set;
  }

  function renderHeader() {
    var dw = state.dayWidth, d = state.range.start.clone(), n = totalDays();
    var cells = '';
    for (var i = 0; i < n; i++) {
      var we = (d.day() === 0 || d.day() === 6);
      var isToday = d.isSame(today, 'day');
      cells += '<div class="dc ' + (we ? 'we' : '') + (isToday ? ' today' : '') + '" style="width:' + dw + 'px"><span>' + d.format('MM/DD') + '</span><span style="font-size:9px;opacity:.6">' + d.format('dd') + '</span></div>';
      d.add(1, 'day');
    }
    return '<div class="res-days">' + cells + '</div>';
  }

  function renderLane(res) {
    var dw = state.dayWidth, n = totalDays();
    var cells = '';
    var d = state.range.start.clone();
    var cd = conflictDates(res.id);
    for (var i = 0; i < n; i++) {
      var we = (d.day() === 0 || d.day() === 6);
      var isToday = d.isSame(today, 'day');
      var conflict = cd[d.format('YYYY-MM-DD')];
      cells += '<div class="grid-cell ' + (we ? 'we' : '') + (isToday ? ' today' : '') + '" style="left:' + (i * dw) + 'px;width:' + dw + 'px' + (conflict ? ';background:rgba(239,68,68,.18)' : '') + '"></div>';
      d.add(1, 'day');
    }
    var blocks = '';
    state.tasks.filter(function (t) { return t.resourceId === res.id; }).forEach(function (t) {
      var left = dayToX(t.startDate);
      var width = Math.max(dw, (moment(t.endDate).diff(moment(t.startDate), 'days') + 1) * dw);
      var conflict = t.isCritical;
      // 标记该任务是否落在冲突日
      var isInConflict = false;
      var d2 = moment(t.startDate);
      while (d2.isSameOrBefore(moment(t.endDate))) { if (cd[d2.format('YYYY-MM-DD')]) { isInConflict = true; break; } d2.add(1, 'day'); }
      blocks += '<div class="res-block ' + res.type + (isInConflict ? ' overload' : '') + '" style="left:' + left + 'px;width:' + width + 'px" data-id="' + t.id + '" title="' + UI().escape(t.name) + ' · ' + t.progress + '%">' + UI().escape(t.name) + '</div>';
    });
    return '<div class="res-lane">' + cells + blocks + '</div>';
  }

  function renderLanes() {
    var labels = '';
    var lanes = '';
    state.resources.forEach(function (r) {
      var cnt = state.tasks.filter(function (t) { return t.resourceId === r.id; }).length;
      var iconCls = r.type === '班组' ? 'team' : 'equip';
      var icon = r.type === '班组' ? 'bi-people-fill' : 'bi-truck';
      labels += '<div class="res-lane-label"><span class="ri ' + iconCls + '"><i class="bi ' + icon + '"></i></span><div class="nm"><div>' + UI().escape(r.name) + '</div><div class="ty">' + UI().escape(r.type) + ' · ' + cnt + '任务</div></div></div>';
      lanes += renderLane(r);
    });
    if (!state.resources.length) return null;
    return { labels: labels, lanes: lanes };
  }

  function renderGrid($main) {
    var lanes = renderLanes();
    if (!lanes) { $main.find('#res-grid').html('<div class="empty-state"><i class="bi bi-people"></i><div>当前项目暂无资源，点击「新增资源」添加班组/设备</div></div>'); return; }
    var cornerW = 220;
    var html = '<div class="res-wrap">' +
      '<div class="res-head"><div class="res-corner" style="width:' + cornerW + 'px">资源 / 日期</div>' + renderHeader() + '</div>' +
      '<div class="res-body"><div class="res-lane-labels" style="width:' + cornerW + 'px">' + lanes.labels + '</div>' +
      '<div class="res-scroll" id="res-scroll" style="flex:1;overflow:auto"><div style="width:' + (totalDays() * state.dayWidth) + 'px;position:relative">' + lanes.lanes + '</div></div>' +
      '</div></div>';
    $main.find('#res-grid').html(html);
    var todayX = dayToX(today);
    $('#res-scroll').scrollLeft(Math.max(0, todayX - 100));
    $main.on('click', '.res-block', function () {
      var t = DS().getTask($(this).data('id'));
      if (!t) return;
      UI().modal({ title: '<i class="bi bi-info-circle text-amber me-2"></i>任务占用详情', body: '<div style="font-size:14px;margin-bottom:8px"><b>' + UI().escape(t.name) + '</b></div><div class="row g-2"><div class="col-6"><div class="text-muted-2" style="font-size:11px">起止</div><div class="mono">' + moment(t.startDate).format('MM-DD') + ' ~ ' + moment(t.endDate).format('MM-DD') + '</div></div><div class="col-6"><div class="text-muted-2" style="font-size:11px">工期</div><div class="mono">' + t.duration + ' 天</div></div><div class="col-6"><div class="text-muted-2" style="font-size:11px">进度</div><div class="mono">' + t.progress + '%</div></div><div class="col-6"><div class="text-muted-2" style="font-size:11px">负责人</div><div>' + UI().escape(t.assignee || '—') + '</div></div></div>', footer: '<button class="btn btn-ghost btn-sm" data-bs-dismiss="modal">关闭</button>' });
    });
  }

  function renderSummary($main) {
    var conflicts = state.conflicts;
    var overloadedRes = {};
    conflicts.forEach(function (c) { overloadedRes[c.resourceId] = true; });
    var affectedTasks = {};
    conflicts.forEach(function (c) { c.tasks.forEach(function (t) { affectedTasks[t.id] = true; }); });
    var cards = [
      { label: '资源总数', value: state.resources.length, icon: 'bi-people-fill', ok: true, delta: '班组 ' + state.resources.filter(function (r) { return r.type === '班组'; }).length + ' / 设备 ' + state.resources.filter(function (r) { return r.type === '设备'; }).length },
      { label: '冲突日期数', value: conflicts.length, icon: 'bi-exclamation-triangle', ok: !conflicts.length, delta: conflicts.length ? '需调整排班' : '无冲突' },
      { label: '超载资源', value: Object.keys(overloadedRes).length, icon: 'bi-arrow-up-circle', ok: !Object.keys(overloadedRes).length, delta: Object.keys(overloadedRes).length ? '存在超载' : '负载均衡' },
      { label: '受影响任务', value: Object.keys(affectedTasks).length, icon: 'bi-link-45deg', ok: !Object.keys(affectedTasks).length, delta: '需重新协调' }
    ];
    $main.find('#res-stat').html(cards.map(function (c) {
      return '<div class="col-6 col-lg-3 mb-3"><div class="stat-card"><div class="label">' + UI().escape(c.label) + '</div><div class="value mono ' + (c.ok ? 'text-green' : 'text-red') + '">' + c.value + '</div><div class="delta text-muted-2">' + UI().escape(c.delta) + '</div><i class="bi ' + c.icon + ' icon"></i></div></div>';
    }).join(''));
  }

  function renderConflictTable($main) {
    var rows = state.conflicts.map(function (c) {
      var res = DS().getResources(state.pid).find(function (r) { return r.id === c.resourceId; });
      var proj = DS().getProject(c.tasks[0].projectId);
      return [
        '<span class="mono">' + moment(c.date).format('MM-DD') + '</span>',
        UI().escape(res ? res.name : c.resourceId),
        UI().escape(res ? res.type : '—'),
        '<span class="text-red">' + c.tasks.length + '</span>',
        c.tasks.map(function (t) { return '<span class="chip-tag">' + UI().escape(t.name) + '</span>'; }).join(' '),
        '<button class="btn btn-ghost btn-sm-icon btn-resolve" data-res="' + c.resourceId + '" data-date="' + c.date + '"><i class="bi bi-arrow-repeat"></i></button>'
      ];
    });
    var $tbl = $main.find('#conflict-table');
    if ($.fn.DataTable.isDataTable($tbl[0])) $tbl.DataTable().destroy();
    $tbl.html('<thead><tr><th>冲突日期</th><th>资源</th><th>类型</th><th>占用数</th><th>涉及任务</th><th>操作</th></tr></thead><tbody></tbody>');
    $tbl.find('tbody').html(rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join(''));
    if (rows.length) {
      $tbl.DataTable({ pageLength: 6, searching: false, lengthChange: false, language: { info: '显示 _START_-_END_ / 共 _TOTAL_ 条', zeroRecords: '无冲突', paginate: { previous: '上一页', next: '下一页' } } });
    } else {
      $tbl.find('tbody').html('<tr><td colspan="6"><div class="empty-state"><i class="bi bi-check-circle text-green"></i><div>未检测到资源冲突，排班均衡</div></div></td></tr>');
    }
  }

  function openResourceModal() {
    var body = '<form id="res-form" novalidate><div class="row g-3">' +
      '<div class="col-12"><div class="form-floating"><input class="form-control" id="rf-name" required><label>资源名称</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><select class="form-select" id="rf-type"><option value="班组">班组</option><option value="设备">设备</option></select><label>类型</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="number" min="1" class="form-control" id="rf-cap" value="12"><label>容量/人数</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="date" class="form-control" id="rf-start"></div></div><div class="col-6"><div class="form-floating"><input type="date" class="form-control" id="rf-end"></div></div>' +
      '</div></form>';
    var proj = DS().getProject(state.pid);
    var footer = '<button class="btn btn-ghost btn-sm" data-bs-dismiss="modal">取消</button><button class="btn btn-amber btn-sm" id="rf-save">新增资源</button>';
    var m = UI().modal({ title: '<i class="bi bi-person-plus text-amber me-2"></i>新增资源', body: body, footer: footer });
    m.$el.find('#rf-start').val(proj ? proj.startDate : moment().format('YYYY-MM-DD'));
    m.$el.find('#rf-end').val(proj ? proj.endDate : moment().add(60, 'days').format('YYYY-MM-DD'));
    global.App.Validator.apply('#res-form', { 'rf-name': 'required' });
    m.$el.find('#rf-save').on('click', function () {
      if (!global.App.Validator.isValid('#res-form')) return;
      DS().saveResource({ id: DS().uid('R'), projectId: state.pid, name: m.$el.find('#rf-name').val(), type: m.$el.find('#rf-type').val(), capacity: Number(m.$el.find('#rf-cap').val()) || 1, startDate: m.$el.find('#rf-start').val(), endDate: m.$el.find('#rf-end').val() });
      m.modal.hide(); UI().toast('资源已新增', 'success', 1400);
      load(); renderGrid($('#app-main')); renderSummary($('#app-main')); renderConflictTable($('#app-main'));
    });
  }

  M.render = function ($main) {
    load();
    if (!state.pid) { UI().empty($main, 'bi-people', '请先在项目看板选择一个项目'); return; }
    var projs = DS().getProjects();
    var sel = projs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === state.pid ? ' selected' : '') + '>' + UI().escape(p.name) + '</option>'; }).join('');
    $main.html(
      '<div class="d-flex flex-wrap align-items-center gap-2 mb-3">' +
      '<select class="form-select form-select-sm" id="proj-select" style="width:auto;max-width:260px">' + sel + '</select>' +
      '<span class="text-muted-2" style="font-size:12px">近 7 日 ~ 未来 45 日 排班视图</span>' +
      '<div class="ms-auto"><button class="btn btn-amber btn-sm" id="add-res"><i class="bi bi-person-plus"></i> 新增资源</button></div>' +
      '</div>' +
      '<div id="res-stat" class="row"></div>' +
      '<div id="res-grid" class="mt-1"></div>' +
      '<div class="panel mt-3"><div class="panel-head"><span class="h"><i class="bi bi-exclamation-octagon"></i>冲突检测</span><span class="tools text-muted-2" style="font-size:12px">同一资源同一日期被多任务占用即判定为冲突</span></div><div class="panel-body" style="padding:0"><table id="conflict-table" class="table mb-0"></table></div></div>'
    );
    renderSummary($main);
    renderGrid($main);
    renderConflictTable($main);
    $main.find('#proj-select').on('change', function () { global.App.setProject($(this).val()); load(); renderSummary($main); renderGrid($main); renderConflictTable($main); });
    $main.find('#add-res').on('click', openResourceModal);
    $main.on('click', '.btn-resolve', function () {
      UI().toast('已定位冲突资源，请在甘特图调整对应任务工期', 'warn', 2400);
      global.App.setProject(state.pid); global.App.go('#/gantt');
    });
  };

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.resource = M;
})(window);
