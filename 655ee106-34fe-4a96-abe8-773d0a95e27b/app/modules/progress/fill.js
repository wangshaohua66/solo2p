/* ==========================================================================
   app/modules/progress/fill.js — 进度填报模块
   每日填报完成百分比/实际工时/现场照片，自动计算计划完成率偏差
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { pid: null, photos: [] };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };
  var today = moment('2026-06-20');

  function plannedAt(task, date) {
    var s = moment(task.startDate), e = moment(task.endDate);
    var d = moment(date);
    if (d.isBefore(s)) return 0;
    if (d.isAfter(e)) return 100;
    var total = e.diff(s, 'days') + 1;
    var passed = d.diff(s, 'days') + 1;
    return Math.round(passed / total * 100);
  }

  function load() {
    state.pid = global.App.Store.currentProjectId || (DS().getProjects()[0] && DS().getProjects()[0].id);
    state.photos = [];
  }

  function updateDeviation($main) {
    var taskId = $main.find('#ff-task').val();
    var date = $main.find('#ff-date').val();
    var actual = Number($main.find('#ff-pct').val()) || 0;
    var $badge = $main.find('#dev-badge');
    var $plan = $main.find('#plan-val');
    if (!taskId || !date) { $badge.html('—'); $plan.html('—'); return; }
    var t = DS().getTask(taskId);
    var planned = plannedAt(t, date);
    var dev = actual - planned;
    $plan.html('<span class="mono">' + planned + '%</span>');
    var cls = dev >= 0 ? 'good' : (dev >= -10 ? 'warn' : 'bad');
    var sign = dev > 0 ? '+' : '';
    $badge.html('<span class="deviation-badge ' + cls + '">' + sign + dev + '%</span>');
  }

  function renderForm($main) {
    var projs = DS().getProjects();
    var sel = projs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === state.pid ? ' selected' : '') + '>' + UI().escape(p.name) + '</option>'; }).join('');
    var tasks = state.pid ? DS().getTasks(state.pid) : [];
    var taskOpts = tasks.map(function (t) { return '<option value="' + t.id + '">' + UI().escape(t.name) + ' (' + t.progress + '%)</option>'; }).join('');
    $main.find('#fill-form-area').html(
      '<div class="panel"><div class="panel-head"><span class="h"><i class="bi bi-clipboard-check"></i>施工进度填报</span></div><div class="panel-body">' +
      '<form id="fill-form" novalidate>' +
      '<div class="row g-3 mb-2">' +
      '<div class="col-md-6"><div class="form-floating"><select class="form-select" id="ff-proj">' + sel + '</select><label>所属项目</label></div></div>' +
      '<div class="col-md-6"><div class="form-floating"><select class="form-select" id="ff-task" required>' + taskOpts + '</select><label>填报任务</label></div></div>' +
      '<div class="col-md-4"><div class="form-floating"><input type="date" class="form-control" id="ff-date" value="' + today.format('YYYY-MM-DD') + '" required><label>填报日期</label></div></div>' +
      '<div class="col-md-4"><div class="form-floating"><input type="number" min="0" max="100" class="form-control" id="ff-pct" value="0" required><label>实际完成 %</label></div></div>' +
      '<div class="col-md-4"><div class="form-floating"><input type="number" min="0" step="0.5" class="form-control" id="ff-hours" value="8"><label>实际工时 (h)</label></div></div>' +
      '</div>' +
      '<div class="mb-3"><label class="form-label">完成进度：<b class="mono text-amber" id="pct-val">0</b>%</label><input type="range" class="form-range" id="ff-pct-range" min="0" max="100" value="0"></div>' +
      '<div class="row g-3 mb-3">' +
      '<div class="col-md-6"><label class="form-label">该日期计划完成率</label><div id="plan-val" class="form-control" readonly>—</div></div>' +
      '<div class="col-md-6"><label class="form-label">偏差（实际 - 计划）</label><div id="dev-badge" class="form-control" readonly>—</div></div>' +
      '</div>' +
      '<div class="mb-3"><label class="form-label">现场照片</label><input type="file" class="form-control" id="ff-photos" accept="image/*" multiple><div class="photo-grid" id="photo-preview"></div></div>' +
      '<div class="mb-3"><div class="form-floating"><textarea class="form-control" id="ff-note" style="height:80px" placeholder="备注"></textarea><label>施工备注</label></div></div>' +
      '<button type="submit" class="btn btn-amber" id="ff-submit"><i class="bi bi-send"></i> 提交填报</button>' +
      '</form></div></div>'
    );
    $main.find('#ff-pct').on('input change', function () { $main.find('#ff-pct-range').val($(this).val()); $main.find('#pct-val').text($(this).val()); updateDeviation($main); });
    $main.find('#ff-pct-range').on('input', function () { $main.find('#ff-pct').val($(this).val()); $main.find('#pct-val').text($(this).val()); updateDeviation($main); });
    $main.find('#ff-task,#ff-date').on('change', function () { updateDeviation($main); });
    $main.find('#ff-proj').on('change', function () { state.pid = $(this).val(); global.App.setProject(state.pid); var to = DS().getTasks(state.pid).map(function (t) { return '<option value="' + t.id + '">' + UI().escape(t.name) + ' (' + t.progress + '%)</option>'; }).join(''); $main.find('#ff-task').html(to); updateDeviation($main); });
    $main.find('#ff-photos').on('change', function (e) {
      var files = e.target.files;
      Array.prototype.forEach.call(files, function (f) {
        var reader = new FileReader();
        reader.onload = function (ev) { state.photos.push(ev.target.result); renderPhotos($main); };
        reader.readAsDataURL(f);
      });
      e.target.value = '';
    });
    $main.on('click', '.photo-grid .rm', function () { state.photos.splice($(this).data('i'), 1); renderPhotos($main); });
    updateDeviation($main);
  }

  function renderPhotos($main) {
    $main.find('#photo-preview').html(state.photos.map(function (src, i) {
      return '<div class="ph"><img src="' + src + '"><button type="button" class="rm" data-i="' + i + '"><i class="bi bi-x"></i></button></div>';
    }).join(''));
  }

  function renderHistory($main) {
    var logs = DS().getProgressLogs(state.pid).sort(function (a, b) { return b.reportDate.localeCompare(a.reportDate); });
    var $tbl = $main.find('#log-table');
    if ($.fn.DataTable.isDataTable($tbl[0])) $tbl.DataTable().destroy();
    if (!logs.length) {
      $tbl.html('<tbody><tr><td><div class="empty-state"><i class="bi bi-inbox"></i><div>暂无填报记录</div></div></td></tr></tbody>');
      $main.find('#log-wrap .panel-head .h').html('<i class="bi bi-clock-history"></i>填报记录 (0)');
      return;
    }
    var rows = logs.map(function (l) {
      var t = DS().getTask(l.taskId);
      return [
        '<span class="mono">' + moment(l.reportDate).format('MM-DD') + '</span>',
        UI().escape(t ? t.name : l.taskId),
        '<span class="mono">' + l.actualPercent + '%</span>',
        '<span class="mono">' + l.actualHours + 'h</span>',
        devBadge(l.deviation),
        (l.photos && l.photos.length ? '<span class="text-amber"><i class="bi bi-images"></i> ' + l.photos.length + '</span>' : '<span class="text-muted-2">—</span>'),
        UI().escape(l.note || '—')
      ];
    });
    $main.find('#log-wrap .panel-head .h').html('<i class="bi bi-clock-history"></i>填报记录 (' + logs.length + ')');
    $tbl.html('<thead><tr><th>日期</th><th>任务</th><th>实际%</th><th>工时</th><th>偏差</th><th>照片</th><th>备注</th></tr></thead><tbody></tbody>');
    $tbl.find('tbody').html(rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join(''));
    $tbl.DataTable({ pageLength: 6, lengthChange: false, language: { info: '显示 _START_-_END_ / 共 _TOTAL_ 条', zeroRecords: '无记录', paginate: { previous: '上一页', next: '下一页' } } });
  }
  function devBadge(dev) {
    var cls = dev >= 0 ? 'good' : (dev >= -10 ? 'warn' : 'bad');
    var sign = dev > 0 ? '+' : '';
    return '<span class="deviation-badge ' + cls + '">' + sign + dev + '%</span>';
  }

  M.render = function ($main) {
    load();
    if (!state.pid) { UI().empty($main, 'bi-clipboard-check', '请先选择项目'); return; }
    $main.html(
      '<div class="row g-3">' +
      '<div class="col-lg-7"><div id="fill-form-area"></div></div>' +
      '<div class="col-lg-5"><div class="panel" id="log-wrap"><div class="panel-head"><span class="h"><i class="bi bi-clock-history"></i>填报记录</span></div><div class="panel-body" style="padding:0"><table id="log-table" class="table mb-0"></table></div></div></div>' +
      '</div>'
    );
    renderForm($main);
    renderHistory($main);
    global.App.Validator.apply('#fill-form', { 'ff-task': 'required', 'ff-date': 'required', 'ff-pct': { required: true, number: true, range: [0, 100] } });
    $main.find('#fill-form').on('submit', function (e) {
      e.preventDefault();
      if (!global.App.Validator.isValid('#fill-form')) return;
      var taskId = $main.find('#ff-task').val();
      var t = DS().getTask(taskId);
      var date = $main.find('#ff-date').val();
      var actual = Number($main.find('#ff-pct').val());
      var planned = plannedAt(t, date);
      var dev = actual - planned;
      var log = {
        id: DS().uid('L'), taskId: taskId, projectId: state.pid,
        reportDate: date, actualPercent: actual,
        actualHours: Number($main.find('#ff-hours').val()) || 0,
        photos: state.photos.slice(), deviation: dev,
        note: $main.find('#ff-note').val()
      };
      DS().saveProgressLog(log);
      DS().refreshWarnings(DS().load(), state.pid);
      UI().toast('填报已提交，偏差 ' + (dev >= 0 ? '+' : '') + dev + '%', 'success');
      state.photos = [];
      renderPhotos($main);
      $main.find('#ff-pct').val(0); $main.find('#ff-pct-range').val(0); $main.find('#pct-val').text(0); $main.find('#ff-note').val('');
      updateDeviation($main);
      renderHistory($main);
      global.App.refreshChrome && global.App.refreshChrome();
    });
  };

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.progressFill = M;
})(window);
