/* ==========================================================================
   app/modules/task/gantt.js — 任务甘特图模块
   时间轴渲染、拖拽移动/缩放工期、依赖连线、关键路径与浮动时间、视图缩放
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { pid: null, view: '日', dayWidth: 30, range: null, tasks: [], byId: {}, scale: 1 };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };
  var today = moment('2026-06-20');

  var VIEW_PRESETS = { '日': 30, '周': 16, '月': 9 };

  function load() {
    state.pid = global.App.Store.currentProjectId || (DS().getProjects()[0] && DS().getProjects()[0].id);
    if (!state.pid) { state.tasks = []; return; }
    state.tasks = DS().getTasks(state.pid);
    state.byId = {};
    state.tasks.forEach(function (t) { state.byId[t.id] = t; });
    state.range = computeRange();
  }

  function computeRange() {
    var tasks = state.tasks;
    if (!tasks.length) return { start: moment().startOf('month'), end: moment().add(1, 'month') };
    var min = moment.min.apply(null, tasks.map(function (t) { return moment(t.startDate); }));
    var max = moment.max.apply(null, tasks.map(function (t) { return moment(t.endDate); }));
    return { start: min.clone().subtract(3, 'days').startOf('day'), end: max.clone().add(5, 'days') };
  }

  function totalDays() { return state.range.end.diff(state.range.start, 'days') + 1; }
  function dayToX(d) { return moment(d).diff(state.range.start, 'days') * state.dayWidth; }
  function xToDay(x) { return Math.round(x / state.dayWidth); }

  function barColor(t) {
    if (t.isCritical) return 'linear-gradient(135deg,#ef4444,#b91c1c)';
    var map = {
      '钢筋绑扎': 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
      '混凝土浇筑': 'linear-gradient(135deg,#06b6d4,#0e7490)',
      '模板支设': 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
      '土方开挖': 'linear-gradient(135deg,#f59e0b,#b45309)',
      '桩基施工': 'linear-gradient(135deg,#10b981,#047857)',
      '砌筑工程': 'linear-gradient(135deg,#0ea5e9,#0369a1)',
      '抹灰工程': 'linear-gradient(135deg,#64748b,#334155)',
      '水电安装': 'linear-gradient(135deg,#22c55e,#15803d)',
      '外墙保温': 'linear-gradient(135deg,#eab308,#a16207)',
      '屋面工程': 'linear-gradient(135deg,#ec4899,#be185d)',
      '脚手架搭设': 'linear-gradient(135deg,#14b8a6,#0f766e)',
      '防水工程': 'linear-gradient(135deg,#f97316,#c2410c)'
    };
    return map[t.category] || 'linear-gradient(135deg,#64748b,#334155)';
  }

  function renderHeader() {
    var dw = state.dayWidth, start = state.range.start.clone();
    var months = {}, days = [];
    var d = start.clone();
    var n = totalDays();
    for (var i = 0; i < n; i++) {
      var mk = d.format('YYYY-MM');
      months[mk] = (months[mk] || 0) + 1;
      var we = (d.day() === 0 || d.day() === 6);
      var isToday = d.isSame(today, 'day');
      days.push('<div class="dcell ' + (we ? 'we' : '') + (isToday ? ' today' : '') + '" style="width:' + dw + 'px"><span>' + d.format('DD') + '</span><span style="font-size:8px;opacity:.6">' + d.format('dd') + '</span></div>');
      d.add(1, 'day');
    }
    var mhtml = '';
    Object.keys(months).forEach(function (mk) {
      mhtml += '<div class="mcell" style="width:' + (months[mk] * dw) + 'px">' + moment(mk + '-01').format('YYYY年 M月') + '</div>';
    });
    return '<div class="gantt-header">' +
      '<div class="row-month">' + mhtml + '</div>' +
      '<div class="row-day">' + days.join('') + '</div>' +
      '</div>';
  }

  function renderGridlines() {
    var dw = state.dayWidth, n = totalDays(), d = state.range.start.clone();
    var html = '';
    for (var i = 0; i < n; i++) {
      var we = (d.day() === 0 || d.day() === 6);
      if (we) html += '<div class="gantt-gridline we" style="left:' + (i * dw) + 'px;width:' + dw + 'px;top:0;bottom:0"></div>';
      else html += '<div class="gantt-gridline" style="left:' + (i * dw) + 'px"></div>';
      d.add(1, 'day');
    }
    return html;
  }

  function renderLinks() {
    if (!state.tasks.length) return '';
    var n = totalDays();
    var h = state.tasks.length * 38 + 8;
    var paths = '';
    state.tasks.forEach(function (t, idx) {
      if (!t.predecessorIds) return;
      String(t.predecessorIds).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (pid) {
        var p = state.byId[pid];
        if (!p) return;
        var si = state.tasks.indexOf(p);
        var ti = idx;
        var x1 = dayToX(p.endDate) + state.dayWidth;
        var y1 = si * 38 + 19;
        var x2 = dayToX(t.startDate);
        var y2 = ti * 38 + 19;
        var crit = (p.isCritical && t.isCritical) ? ' crit' : '';
        var mx = Math.max(x1 + 8, x2 - 8);
        var d = 'M' + x1 + ',' + y1 + ' L' + mx + ',' + y1 + ' L' + mx + ',' + y2 + ' L' + (x2 - 6) + ',' + y2;
        paths += '<path class="gantt-link' + crit + '" d="' + d + '"></path>';
        paths += '<polygon class="gantt-link-arrow' + crit + '" points="' + (x2 - 6) + ',' + (y2 - 4) + ' ' + (x2 - 6) + ',' + (y2 + 4) + ' ' + x2 + ',' + y2 + '"></polygon>';
      });
    });
    return '<svg class="gantt-links" style="position:absolute;left:0;top:0;width:' + (n * dw) + 'px;height:' + h + 'px;pointer-events:none;overflow:visible">' + paths + '</svg>';
  }

  function renderBars() {
    var dw = state.dayWidth;
    var html = '';
    state.tasks.forEach(function (t, idx) {
      var left = dayToX(t.startDate);
      var width = Math.max(dw, moment(t.endDate).diff(moment(t.startDate), 'days') * dw + dw);
      var progW = width * (t.progress / 100);
      html += '<div class="gantt-track">' +
        '<div class="gantt-bar' + (t.isCritical ? ' crit' : '') + '" data-id="' + t.id + '" style="left:' + left + 'px;width:' + width + 'px;background:' + barColor(t) + '">' +
        '<div class="bar-progress" style="width:' + progW + 'px"></div>' +
        '<span class="resize-handle l"></span>' +
        '<span class="bar-label">' + UI().escape(t.name) + (t.floatDays > 0 && !t.isCritical ? ' <span class="float-badge">浮动 ' + t.floatDays + 'd</span>' : '') + '</span>' +
        '<span class="resize-handle r"></span>' +
        '</div></div>';
    });
    return html;
  }

  function renderLabels() {
    var html = '<div class="gh">任务节点 (' + state.tasks.length + ')</div>';
    state.tasks.forEach(function (t) {
      html += '<div class="gantt-row-label" title="' + UI().escape(t.name) + '">' +
        '<span class="crit-dot ' + (t.isCritical ? 'on' : '') + '"></span>' +
        '<span class="lbl">' + UI().escape(t.name) + '</span>' +
        '</div>';
    });
    return html;
  }

  function renderGantt($main) {
    if (!state.tasks.length) { $main.find('#gantt-area').html('<div class="empty-state"><i class="bi bi-bar-chart-steps"></i><div>当前项目暂无任务，点击右上角「新增任务」开始编排</div></div>'); return; }
    var n = totalDays();
    var todayX = dayToX(today);
    var labelsW = 240;
    var ganttHtml =
      '<div class="gantt-wrap">' +
      '<div class="gantt-left" style="width:' + labelsW + 'px">' + renderLabels() + '</div>' +
      '<div class="gantt-scroll" id="gantt-scroll">' +
        '<div class="gantt-timeline" style="width:' + (n * state.dayWidth) + 'px">' +
          renderHeader() +
          '<div class="gantt-body" style="position:relative">' +
            renderGridlines() +
            (todayX >= 0 ? '<div class="gantt-today-line" style="left:' + todayX + 'px"></div>' : '') +
            renderBars() +
            renderLinks() +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    $main.find('#gantt-area').html(ganttHtml);
    // 滚动到今日
    var $scroll = $main.find('#gantt-scroll');
    $scroll.scrollLeft(Math.max(0, todayX - $scroll.width() / 2 + 200));
    bindDrag($main);
  }

  function bindDrag($main) {
    var $bar, task, mode, startX, startLeft, startWidth, rangeStart;
    $main.on('mousedown', '.gantt-bar', function (e) {
      if (e.target.classList.contains('resize-handle')) return; // 由 handle 处理
      e.preventDefault();
      $bar = $(this); task = state.byId[$bar.data('id')]; mode = 'move';
      startX = e.clientX; startLeft = parseFloat($bar[0].style.left); rangeStart = state.range.start.clone();
      $bar.addClass('dragging');
      $(document).on('mousemove.gantt', onMove).on('mouseup.gantt', onUp);
    });
    $main.on('mousedown', '.gantt-bar .resize-handle', function (e) {
      e.preventDefault(); e.stopPropagation();
      $bar = $(this).closest('.gantt-bar'); task = state.byId[$bar.data('id')];
      mode = $(this).hasClass('r') ? 'resize-r' : 'resize-l';
      startX = e.clientX; startLeft = parseFloat($bar[0].style.left); startWidth = parseFloat($bar[0].style.width); rangeStart = state.range.start.clone();
      $bar.addClass('dragging');
      $(document).on('mousemove.gantt', onMove).on('mouseup.gantt', onUp);
    });
    function onMove(e) {
      if (!$bar) return;
      var dx = e.clientX - startX;
      var dw = state.dayWidth;
      if (mode === 'move') {
        var newLeft = Math.round((startLeft + dx) / dw) * dw;
        $bar.css('left', newLeft);
      } else if (mode === 'resize-r') {
        var newW = Math.max(dw, Math.round((startWidth + dx) / dw) * dw);
        $bar.css('width', newW);
      } else if (mode === 'resize-l') {
        var newL = Math.round((startLeft + dx) / dw) * dw;
        var newW2 = startWidth + (startLeft - newL);
        if (newW2 >= dw) { $bar.css({ left: newL, width: newW2 }); }
      }
    }
    function onUp() {
      $(document).off('.gantt');
      if (!$bar) return;
      $bar.removeClass('dragging');
      var dw = state.dayWidth;
      var left = parseFloat($bar[0].style.left), width = parseFloat($bar[0].style.width);
      var newStart = rangeStart.clone().add(xToDay(left), 'days');
      var dur = Math.max(1, Math.round(width / dw));
      var newEnd = newStart.clone().add(dur - 1, 'days');
      task.startDate = newStart.format('YYYY-MM-DD');
      task.endDate = newEnd.format('YYYY-MM-DD');
      task.duration = dur;
      DS().saveTask(task, { skipRecompute: false });
      DS().refreshWarnings(DS().load(), state.pid);
      load();
      renderGantt($main);
      renderTable($main);
      $bar = null; mode = null;
      global.App.refreshChrome && global.App.refreshChrome();
      UI().toast('任务工期已更新', 'success', 1400);
    }
  }

  function renderTable($main) {
    var rows = state.tasks.map(function (t) {
      var r = state.tasks.filter(function (x) { return String(t.predecessorIds).split(',').indexOf(x.id) >= 0; });
      return [
        '<span class="crit-dot ' + (t.isCritical ? 'on' : '') + '"></span> ' + UI().escape(t.name),
        UI().escape(t.phase),
        UI().escape(t.category),
        '<span class="mono">' + moment(t.startDate).format('MM-DD') + '</span>',
        '<span class="mono">' + moment(t.endDate).format('MM-DD') + '</span>',
        '<span class="mono">' + t.duration + 'd</span>',
        UI().progressBar(t.progress, t.isCritical ? 'var(--red)' : 'var(--amber)'),
        '<span class="mono">' + (t.isCritical ? '<span class="text-red">是</span>' : '否') + ' / ' + t.floatDays + 'd</span>',
        '<button class="btn btn-ghost btn-sm-icon btn-edit-task" data-id="' + t.id + '"><i class="bi bi-pencil"></i></button> ' +
        '<button class="btn btn-danger-outline btn-sm-icon btn-del-task" data-id="' + t.id + '"><i class="bi bi-trash"></i></button>'
      ];
    });
    var $tbl = $main.find('#task-table');
    if ($.fn.DataTable.isDataTable($tbl[0])) $tbl.DataTable().destroy();
    $tbl.html('<thead><tr><th>任务</th><th>阶段</th><th>工序</th><th>开始</th><th>结束</th><th>工期</th><th>进度</th><th>关键/浮动</th><th>操作</th></tr></thead><tbody></tbody>');
    $tbl.find('tbody').html(rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join(''));
    $tbl.DataTable({
      pageLength: 8, lengthMenu: [[8, 15, 30, -1], [8, 15, 30, '全部']],
      language: { url: '' , info:'显示 _START_-_END_ / 共 _TOTAL_ 条', lengthMenu:'每页 _MENU_', search:'搜索:', zeroRecords:'无匹配任务', paginate:{previous:'上一页', next:'下一页'} },
      columnDefs: [{ targets: [3, 4, 5, 7], className: 'mono' }]
    });
  }

  function openTaskModal(taskId) {
    var tasks = state.tasks;
    var t = taskId ? state.byId[taskId] : { projectId: state.pid, name: '', phase: '主体工程', category: '钢筋绑扎', startDate: moment().format('YYYY-MM-DD'), endDate: moment().add(7, 'days').format('YYYY-MM-DD'), duration: 8, progress: 0, plannedPercent: 0, predecessorIds: '', resourceId: '', assignee: '' };
    var resOpts = DS().getResources(state.pid).map(function (r) { return '<option value="' + r.id + '"' + (t.resourceId === r.id ? ' selected' : '') + '>' + UI().escape(r.name) + ' (' + r.type + ')</option>'; }).join('');
    var predOpts = tasks.filter(function (x) { return x.id !== t.id; }).map(function (x) { return '<option value="' + x.id + '"' + (String(t.predecessorIds).split(',').indexOf(x.id) >= 0 ? ' selected' : '') + '>' + UI().escape(x.name) + '</option>'; }).join('');
    var cats = ['钢筋绑扎', '混凝土浇筑', '模板支设', '土方开挖', '桩基施工', '砌筑工程', '抹灰工程', '水电安装', '外墙保温', '屋面工程', '脚手架搭设', '防水工程'];
    var catOpts = cats.map(function (c) { return '<option' + (t.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var body =
      '<form id="task-form" novalidate><div class="row g-3">' +
      '<div class="col-12"><div class="form-floating"><input class="form-control" id="tf-name" value="' + UI().escape(t.name) + '" required><label>任务名称</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><select class="form-select" id="tf-phase">' + ['基础工程', '主体工程', '装饰装修', '机电与收尾', '附属工程'].map(function (p) { return '<option' + (t.phase === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select><label>所属阶段</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><select class="form-select" id="tf-cat">' + catOpts + '</select><label>工序类别</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="date" class="form-control" id="tf-start" value="' + t.startDate + '" required><label>开始日期</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="date" class="form-control" id="tf-end" value="' + t.endDate + '" required><label>结束日期</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><select class="form-select" id="tf-res">' + (resOpts || '<option value="">暂无资源</option>') + '</select><label>分配资源</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input class="form-control" id="tf-assignee" value="' + UI().escape(t.assignee || '') + '"><label>负责人</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="number" min="0" max="100" class="form-control" id="tf-prog" value="' + (t.progress || 0) + '"><label>完成进度 %</label></div></div>' +
      '<div class="col-6"><div class="form-floating"><input type="number" min="0" max="100" class="form-control" id="tf-plan" value="' + (t.plannedPercent || 0) + '"><label>计划完成率 %</label></div></div>' +
      '<div class="col-12"><label class="form-label">前置任务（可多选，按 Ctrl/Cmd）</label><select class="form-select" id="tf-pred" multiple size="5" style="height:auto">' + predOpts + '</select></div>' +
      '</div></form>';
    var footer = '<button class="btn btn-ghost btn-sm" data-bs-dismiss="modal">取消</button><button class="btn btn-amber btn-sm" id="tf-save">' + (taskId ? '保存修改' : '新增任务') + '</button>';
    var m = UI().modal({ title: '<i class="bi bi-diagram-3 text-amber me-2"></i>' + (taskId ? '编辑任务' : '新增任务'), body: body, footer: footer, size: 'lg', scrollable: true });
    global.App.Validator.apply('#task-form', { 'tf-name': 'required', 'tf-start': 'required', 'tf-end': 'required' });
    m.$el.find('#tf-save').on('click', function () {
      if (!global.App.Validator.isValid('#task-form')) return;
      var start = m.$el.find('#tf-start').val(), end = m.$el.find('#tf-end').val();
      if (moment(end).isBefore(moment(start))) { UI().toast('结束日期不能早于开始日期', 'error'); return; }
      t.name = m.$el.find('#tf-name').val();
      t.phase = m.$el.find('#tf-phase').val();
      t.category = m.$el.find('#tf-cat').val();
      t.startDate = start; t.endDate = end;
      t.duration = moment(end).diff(moment(start), 'days') + 1;
      t.resourceId = m.$el.find('#tf-res').val();
      t.assignee = m.$el.find('#tf-assignee').val();
      t.progress = Number(m.$el.find('#tf-prog').val()) || 0;
      t.plannedPercent = Number(m.$el.find('#tf-plan').val()) || 0;
      t.predecessorIds = m.$el.find('#tf-pred').val().join(',');
      if (!t.id) t.id = DS().uid('T');
      DS().saveTask(t);
      DS().refreshWarnings(DS().load(), state.pid);
      m.modal.hide();
      UI().toast('任务已保存', 'success', 1400);
      load(); renderGantt($('#app-main')); renderTable($('#app-main'));
      global.App.refreshChrome && global.App.refreshChrome();
    });
  }

  function renderControls($main) {
    var proj = DS().getProject(state.pid);
    var projs = DS().getProjects();
    var sel = projs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === state.pid ? ' selected' : '') + '>' + UI().escape(p.name) + '</option>'; }).join('');
    $main.find('#gantt-controls').html(
      '<div class="d-flex flex-wrap align-items-center gap-2 mb-3">' +
      '<select class="form-select form-select-sm" id="proj-select" style="width:auto;max-width:260px">' + sel + '</select>' +
      (proj ? '<span class="badge-stage">' + UI().escape(proj.type) + '</span>' + UI().riskBadge(proj.riskLevel) + '<span class="text-muted-2" style="font-size:12px">整体进度 <b class="mono text-amber">' + proj.progress + '%</b></span>' : '') +
      '<div class="ms-auto d-flex align-items-center gap-2">' +
      viewSeg() +
      '<button class="btn btn-ghost btn-sm-icon" id="zoom-out" title="缩小"><i class="bi bi-zoom-out"></i></button>' +
      '<button class="btn btn-ghost btn-sm-icon" id="zoom-in" title="放大"><i class="bi bi-zoom-in"></i></button>' +
      '<button class="btn btn-ghost btn-sm-icon" id="go-today" title="跳到今日"><i class="bi bi-calendar-event"></i></button>' +
      '<button class="btn btn-amber btn-sm" id="add-task"><i class="bi bi-plus-lg"></i> 新增任务</button>' +
      '</div></div>'
    );
    $main.find('#proj-select').on('change', function () { global.App.setProject($(this).val()); load(); renderGantt($main); renderTable($main); renderControls($main); });
    $main.find('[data-view]').on('click', function () { state.view = $(this).data('view'); state.dayWidth = VIEW_PRESETS[state.view]; $main.find('[data-view]').removeClass('on').filter('[data-view="' + state.view + '"]').addClass('on'); renderGantt($main); });
    $main.find('#zoom-in').on('click', function () { state.dayWidth = Math.min(60, state.dayWidth + 6); renderGantt($main); });
    $main.find('#zoom-out').on('click', function () { state.dayWidth = Math.max(8, state.dayWidth - 6); renderGantt($main); });
    $main.find('#go-today').on('click', function () { var x = dayToX(today); $('#gantt-scroll').animate({ scrollLeft: Math.max(0, x - 200) }, 300); });
    $main.find('#add-task').on('click', function () { openTaskModal(null); });
  }
  function viewSeg() {
    return '<div class="seg">' + ['日', '周', '月'].map(function (v) { return '<button class="' + (state.view === v ? 'on' : '') + '" data-view="' + v + '">' + v + '视图</button>'; }).join('') + '</div>';
  }

  function renderLegend($main) {
    $main.find('#gantt-legend').html('<div class="gantt-legend">' +
      '<div class="lg"><span class="sw" style="background:var(--red)"></span>关键路径</div>' +
      '<div class="lg"><span class="sw" style="background:#3b82f6"></span>常规任务</div>' +
      '<div class="lg"><span class="sw" style="background:rgba(0,0,0,.22)"></span>已完成进度</div>' +
      '<div class="lg"><i class="bi bi-arrow-right text-muted-2"></i> 依赖关系（拖拽任务条调整工期）</div>' +
      '</div><div class="text-muted-2 mt-2" style="font-size:12px">提示：拖动任务条中部移动工期，拖动两端调整工期长度；红色边框为关键路径任务，浮动时间为 0。</div>');
  }

  M.render = function ($main) {
    load();
    $main.html(
      '<div id="gantt-controls"></div>' +
      '<div id="gantt-area"></div>' +
      '<div id="gantt-legend" class="mt-2"></div>' +
      '<div class="gantt-list-fallback mt-3"><div class="panel"><div class="panel-body" id="mobile-list"></div></div></div>' +
      '<div class="panel mt-3"><div class="panel-head"><span class="h"><i class="bi bi-list-task"></i>任务清单</span><span class="tools text-muted-2" style="font-size:12px">支持搜索、排序、分页</span></div><div class="panel-body" style="padding:0"><table id="task-table" class="table table-hover mb-0"></table></div></div>'
    );
    renderControls($main);
    renderGantt($main);
    renderLegend($main);
    renderTable($main);
    renderMobile($main);
    $main.on('click', '.btn-edit-task', function () { openTaskModal($(this).data('id')); });
    $main.on('click', '.btn-del-task', function () {
      var id = $(this).data('id'); var t = state.byId[id];
      UI().confirm({ title: '删除任务', message: '确定删除任务「' + t.name + '」？相关依赖将被清理。', okText: '删除' }, function () {
        DS().deleteTask(id);
        DS().refreshWarnings(DS().load(), state.pid);
        UI().toast('任务已删除', 'success', 1400);
        load(); renderGantt($main); renderTable($main); renderControls($main);
        global.App.refreshChrome && global.App.refreshChrome();
      });
    });
  };

  function renderMobile($main) {
    var html = state.tasks.map(function (t) {
      return '<div class="gl-item"><div><div><span class="crit-dot ' + (t.isCritical ? 'on' : '') + '"></span> ' + UI().escape(t.name) + '</div><div class="text-muted-2" style="font-size:11px">' + moment(t.startDate).format('MM-DD') + ' → ' + moment(t.endDate).format('MM-DD') + ' · ' + t.duration + 'd</div></div>' + UI().progressBar(t.progress, t.isCritical ? 'var(--red)' : 'var(--amber)') + '</div>';
    }).join('');
    $main.find('#mobile-list').html(html || '<div class="empty-state"><i class="bi bi-inbox"></i><div>暂无任务</div></div>');
  }

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.gantt = M;
})(window);
