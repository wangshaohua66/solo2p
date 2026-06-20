/* ==========================================================================
   app/modules/progress/report.js — 进度汇报模块
   一键生成周报月报：S曲线对比、里程碑达成率、资源利用率、导出PDF
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { pid: null, period: '周报', charts: [] };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };
  var today = moment('2026-06-20');

  function load() { state.pid = global.App.Store.currentProjectId || (DS().getProjects()[0] && DS().getProjects()[0].id); }
  function destroyCharts() { state.charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); state.charts = []; }
  function chartColors() { return { amber: '#f59e0b', blue: '#3b82f6', red: '#ef4444', green: '#10b981', cyan: '#06b6d4', grid: 'rgba(15,22,32,.12)', text: '#475569' }; }

  function sCurveData(proj, tasks) {
    var start = moment(proj.startDate), end = moment(proj.endDate);
    var weeks = Math.max(2, end.diff(start, 'weeks'));
    var labels = [], planned = [], actual = [];
    var nowWeek = today.diff(start, 'weeks');
    for (var w = 0; w <= weeks; w++) {
      var d = start.clone().add(w, 'weeks');
      labels.push(d.format('MM-DD'));
      var p = Math.round(100 * w / weeks);
      planned.push(p);
      if (w <= nowWeek) {
        var a = Math.round(proj.progress * (w / Math.max(1, nowWeek)));
        actual.push(Math.min(100, a));
      } else {
        actual.push(null);
      }
    }
    return { labels: labels, planned: planned, actual: actual };
  }

  function milestoneData(tasks) {
    var phases = {};
    tasks.forEach(function (t) { phases[t.phase] = phases[t.phase] || []; phases[t.phase].push(t); });
    return Object.keys(phases).map(function (ph) {
      var arr = phases[ph];
      var avg = arr.reduce(function (s, t) { return s + t.progress; }, 0) / arr.length;
      return { phase: ph, avg: Math.round(avg), done: avg >= 80 };
    });
  }

  function utilizationData(proj, tasks) {
    var res = DS().getResources(proj.id);
    var pdays = moment(proj.endDate).diff(moment(proj.startDate), 'days') + 1;
    return res.map(function (r) {
      var assigned = tasks.filter(function (t) { return t.resourceId === r.id; }).reduce(function (s, t) { return s + (t.duration || 1); }, 0);
      var avail = pdays * (r.capacity || 1);
      var util = avail ? Math.min(120, Math.round(assigned / avail * 100)) : 0;
      return { name: r.name, util: util, type: r.type };
    }).filter(function (x) { return x.util > 0; }).slice(0, 10);
  }

  function renderReport($main) {
    destroyCharts();
    var proj = DS().getProject(state.pid);
    if (!proj) { UI().empty($main, 'bi-file-earmark-bar-graph', '请先选择项目'); return; }
    var tasks = DS().getTasks(state.pid);
    var sc = sCurveData(proj, tasks);
    var ms = milestoneData(tasks);
    var ut = utilizationData(proj, tasks);
    var warns = DS().getWarnings(state.pid, '待处理');
    var msDone = ms.filter(function (m) { return m.done; }).length;
    var avgUtil = ut.length ? Math.round(ut.reduce(function (s, x) { return s + x.util; }, 0) / ut.length) : 0;
    var dev = proj.progress - (sc.planned[Math.min(sc.planned.length - 1, today.diff(moment(proj.startDate), 'weeks'))] || 0);

    $main.find('#report-area').html(
      '<div class="no-print d-flex flex-wrap align-items-center gap-2 mb-3">' +
      '<select class="form-select form-select-sm" id="r-proj" style="width:auto;max-width:240px"></select>' +
      '<div class="seg">' + ['周报', '月报'].map(function (v) { return '<button class="' + (state.period === v ? 'on' : '') + '" data-period="' + v + '">' + v + '</button>'; }).join('') + '</div>' +
      '<button class="btn btn-amber btn-sm ms-auto" id="print-btn"><i class="bi bi-printer"></i> 导出 PDF</button>' +
      '</div>' +
      '<div class="report-sheet">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1b2330;padding-bottom:12px;margin-bottom:16px">' +
      '<div><div style="font-family:var(--font-display);font-size:22px;font-weight:700">施工进度' + state.period + '</div><div style="font-size:13px;color:#64748b;margin-top:2px">' + UI().escape(proj.name) + ' · ' + UI().escape(proj.type) + '工程</div></div>' +
      '<div style="text-align:right;font-size:12px;color:#64748b"><div>报告周期：' + (state.period === '周报' ? today.clone().subtract(6, 'days').format('MM-DD') + ' ~ ' + today.format('MM-DD') : today.clone().subtract(29, 'days').format('MM-DD') + ' ~ ' + today.format('MM-DD')) + '</div><div>生成时间：' + today.format('YYYY-MM-DD HH:mm') + '</div><div>编制人：' + UI().escape(proj.manager) + '</div></div>' +
      '</div>' +
      '<div class="row g-3 mb-3">' +
      metric('整体进度', proj.progress + '%', dev >= 0 ? '+' + dev + '%' : dev + '%', dev >= 0 ? '#10b981' : '#ef4444') +
      metric('里程碑达成', msDone + '/' + ms.length, Math.round(msDone / ms.length * 100) + '%', '#3b82f6') +
      metric('资源利用率', avgUtil + '%', ut.length + '项资源', '#f59e0b') +
      metric('待处置预警', warns.length, warns.length ? '需关注' : '正常', warns.length ? '#ef4444' : '#10b981') +
      '</div>' +
      '<div class="row g-3">' +
      '<div class="col-12"><div class="chart-card" style="background:#fff"><div class="ch-title" style="color:#0f766e">S曲线对比 — 计划完成率 vs 实际完成率</div><div class="chart-canvas-wrap" style="height:260px"><canvas id="scurve-chart"></canvas></div></div></div>' +
      '<div class="col-md-6"><div class="chart-card" style="background:#fff"><div class="ch-title" style="color:#0f766e">里程碑达成率</div><div class="chart-canvas-wrap" style="height:220px"><canvas id="ms-chart"></canvas></div></div></div>' +
      '<div class="col-md-6"><div class="chart-card" style="background:#fff"><div class="ch-title" style="color:#0f766e">资源利用率统计</div><div class="chart-canvas-wrap" style="height:220px"><canvas id="util-chart"></canvas></div></div></div>' +
      '</div>' +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:12px;color:#64748b">备注：本报告由施工进度管理系统自动汇总生成，数据截至 ' + today.format('YYYY-MM-DD') + '。S曲线虚线部分为实际进度，实线为计划进度。</div>' +
      '</div>'
    );

    var projs = DS().getProjects();
    $main.find('#r-proj').html(projs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === state.pid ? ' selected' : '') + '>' + UI().escape(p.name) + '</option>'; }).join(''));

    var C = chartColors();
    var ctx1 = document.getElementById('scurve-chart');
    state.charts.push(new Chart(ctx1, {
      type: 'line',
      data: { labels: sc.labels, datasets: [
        { label: '计划完成率', data: sc.planned, borderColor: C.blue, backgroundColor: 'rgba(59,130,246,.1)', fill: true, tension: .35, borderWidth: 2, pointRadius: 0 },
        { label: '实际完成率', data: sc.actual, borderColor: C.amber, backgroundColor: 'rgba(245,158,11,.12)', fill: true, tension: .35, borderWidth: 2.5, pointRadius: 0, spanGaps: false }
      ] },
      options: chartOpts(C, '%', true)
    }));
    state.charts.push(new Chart(document.getElementById('ms-chart'), {
      type: 'bar',
      data: { labels: ms.map(function (m) { return m.phase; }), datasets: [{ label: '阶段平均进度', data: ms.map(function (m) { return m.avg; }), backgroundColor: ms.map(function (m) { return m.done ? '#10b981' : '#f59e0b'; }), borderRadius: 5 }] },
      options: chartOpts(C, '%', false)
    }));
    state.charts.push(new Chart(document.getElementById('util-chart'), {
      type: 'bar',
      data: { labels: ut.map(function (u) { return u.name; }), datasets: [{ label: '利用率', data: ut.map(function (u) { return u.util; }), backgroundColor: ut.map(function (u) { return u.util > 100 ? '#ef4444' : (u.util > 80 ? '#f59e0b' : '#3b82f6'); }), borderRadius: 5 }] },
      options: chartOpts(C, '%', true)
    }));

    $main.find('#r-proj').on('change', function () { state.pid = $(this).val(); global.App.setProject(state.pid); renderReport($main); });
    $main.find('[data-period]').on('click', function () { state.period = $(this).data('period'); $main.find('[data-period]').removeClass('on'); $(this).addClass('on'); renderReport($main); });
    $main.find('#print-btn').on('click', function () { global.setTimeout(function () { global.print(); }, 300); UI().toast('正在调用浏览器打印，可选择「另存为 PDF」', 'info', 3000); });
  }

  function metric(label, val, sub, color) {
    return '<div class="col-6 col-lg-3"><div class="r-metric"><div class="v" style="color:' + color + '">' + val + '</div><div class="k">' + UI().escape(label) + '</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">' + UI().escape(sub) + '</div></div></div>';
  }
  function chartOpts(C, suffix, xRotate) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: C.text, font: { size: 11 } } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + c.parsed.y + suffix; } } } },
      scales: {
        x: { ticks: { color: C.text, font: { size: 9 }, maxRotation: xRotate ? 60 : 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { size: 10 }, callback: function (v) { return v + suffix; } }, grid: { color: C.grid }, min: 0, max: 100 }
      }
    };
  }

  M.render = function ($main) {
    load();
    $main.html('<div id="report-area"></div>');
    renderReport($main);
  };
  M.destroy = function () { destroyCharts(); };

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.report = M;
})(window);
