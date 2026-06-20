/* ==========================================================================
   app/modules/analytics/stats.js — 统计分析模块
   多维度汇总、计划vs实际同环比对比、趋势图表
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { charts: [] };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };

  function destroyCharts() { state.charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); state.charts = []; }
  function C() { return { amber: '#f59e0b', blue: '#3b82f6', red: '#ef4444', green: '#10b981', cyan: '#06b6d4', purple: '#8b5cf6', grid: 'rgba(120,150,180,.15)', text: '#cbd5e1' }; }

  function byType() {
    var projs = DS().getProjects();
    var types = ['住宅', '商业', '市政'];
    return types.map(function (t) {
      var arr = projs.filter(function (p) { return p.type === t; });
      var avg = arr.length ? Math.round(arr.reduce(function (s, p) { return s + p.progress; }, 0) / arr.length) : 0;
      var planned = arr.length ? Math.round(arr.reduce(function (s, p) {
        var tasks = DS().getTasks(p.id);
        return s + (tasks.length ? tasks.reduce(function (x, tk) { return x + tk.plannedPercent; }, 0) / tasks.length : 0);
      }, 0) / arr.length) : 0;
      return { type: t, count: arr.length, actual: avg, planned: planned };
    });
  }

  function warningDist() {
    var warns = DS().getWarnings(null, '待处理');
    var map = { '工期延误': 0, '资源冲突': 0, '关键节点滞后': 0 };
    warns.forEach(function (w) { map[w.type] = (map[w.type] || 0) + 1; });
    return map;
  }

  function projectComparison() {
    return DS().getProjects().slice(0, 12).map(function (p) {
      var tasks = DS().getTasks(p.id);
      var planned = tasks.length ? Math.round(tasks.reduce(function (s, t) { return s + t.plannedPercent; }, 0) / tasks.length) : 0;
      return { name: p.name.length > 8 ? p.name.slice(0, 8) + '…' : p.name, actual: p.progress, planned: planned, risk: p.riskLevel };
    });
  }

  function riskDist() {
    var projs = DS().getProjects();
    var map = { '高': 0, '中': 0, '低': 0 };
    projs.forEach(function (p) { map[p.riskLevel]++; });
    return map;
  }

  function renderSummary($main) {
    var projs = DS().getProjects();
    var tasks = DS().getTasks();
    var warns = DS().getWarnings(null, '待处理');
    var avgProg = projs.length ? Math.round(projs.reduce(function (s, p) { return s + p.progress; }, 0) / projs.length) : 0;
    var delayed = tasks.filter(function (t) { return t.progress < t.plannedPercent - 10 && t.plannedPercent > 0; }).length;
    var cards = [
      { label: '项目平均进度', value: avgProg + '%', icon: 'bi-graph-up', ok: avgProg >= 50, delta: projs.length + ' 个项目' },
      { label: '任务总数', value: UI().fmtNum(tasks.length), icon: 'bi-list-check', ok: true, delta: '全项目汇总' },
      { label: '进度滞后任务', value: delayed, icon: 'bi-skip-forward', ok: !delayed, delta: '实际<计划' },
      { label: '待处置预警', value: warns.length, icon: 'bi-bell', ok: !warns.length, delta: '全风险类型' }
    ];
    $main.find('#ana-stat').html(cards.map(function (c) {
      return '<div class="col-6 col-lg-3 mb-3"><div class="stat-card"><div class="label">' + UI().escape(c.label) + '</div><div class="value mono ' + (c.ok ? 'text-green' : 'text-red') + '">' + c.value + '</div><div class="delta text-muted-2">' + UI().escape(c.delta) + '</div><i class="bi ' + c.icon + ' icon"></i></div></div>';
    }).join(''));
  }

  function opts(suffix, xRot) {
    var c = C();
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: c.text, font: { size: 11 } } }, tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y + suffix; } } } },
      scales: {
        x: { ticks: { color: c.text, font: { size: 9 }, maxRotation: xRot ? 45 : 0, autoSkip: true }, grid: { color: c.grid } },
        y: { ticks: { color: c.text, font: { size: 10 }, callback: function (v) { return v + suffix; } }, grid: { color: c.grid }, beginAtZero: true }
      }
    };
  }

  function renderCharts($main) {
    destroyCharts();
    var c = C();
    var bt = byType();
    state.charts.push(new Chart(document.getElementById('type-chart'), {
      type: 'bar',
      data: { labels: bt.map(function (x) { return x.type; }), datasets: [
        { label: '实际完成率', data: bt.map(function (x) { return x.actual; }), backgroundColor: c.amber, borderRadius: 5 },
        { label: '计划完成率', data: bt.map(function (x) { return x.planned; }), backgroundColor: c.blue, borderRadius: 5 }
      ] },
      options: opts('%', false)
    }));
    var wd = warningDist();
    state.charts.push(new Chart(document.getElementById('warn-chart'), {
      type: 'doughnut',
      data: { labels: Object.keys(wd), datasets: [{ data: Object.values(wd), backgroundColor: [c.red, c.amber, c.purple], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: c.text, font: { size: 11 } } } } }
    }));
    var pc = projectComparison();
    state.charts.push(new Chart(document.getElementById('compare-chart'), {
      type: 'bar',
      data: { labels: pc.map(function (x) { return x.name; }), datasets: [
        { label: '实际', data: pc.map(function (x) { return x.actual; }), backgroundColor: pc.map(function (x) { return x.risk === '高' ? c.red : (x.risk === '中' ? c.amber : c.green); }), borderRadius: 4 },
        { label: '计划', data: pc.map(function (x) { return x.planned; }), backgroundColor: 'rgba(120,150,180,.35)', borderRadius: 4 }
      ] },
      options: opts('%', true)
    }));
    var rd = riskDist();
    state.charts.push(new Chart(document.getElementById('risk-chart'), {
      type: 'polarArea',
      data: { labels: ['高风险', '中风险', '低风险'], datasets: [{ data: [rd['高'], rd['中'], rd['低']], backgroundColor: ['rgba(239,68,68,.7)', 'rgba(245,158,11,.7)', 'rgba(16,185,129,.7)'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: c.text, font: { size: 11 } } } }, scales: { r: { ticks: { color: c.text, backdropColor: 'transparent' }, grid: { color: c.grid } } } }
    }));
  }

  M.render = function ($main) {
    destroyCharts();
    $main.html(
      '<div class="d-flex align-items-center mb-3"><div class="me-auto"><div class="text-muted-2" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase">ANALYTICS</div><div style="font-size:13px;color:var(--steel-100)">项目群多维度汇总分析 · 计划 vs 实际同环比对比</div></div></div>' +
      '<div id="ana-stat" class="row"></div>' +
      '<div class="row g-3 mt-1">' +
      '<div class="col-lg-6"><div class="chart-card"><div class="ch-title">各工程类型 计划 vs 实际完成率</div><div class="chart-canvas-wrap"><canvas id="type-chart"></canvas></div></div></div>' +
      '<div class="col-lg-6"><div class="chart-card"><div class="ch-title">预警类型分布</div><div class="chart-canvas-wrap"><canvas id="warn-chart"></canvas></div></div></div>' +
      '<div class="col-lg-8"><div class="chart-card"><div class="ch-title">项目进度对比（按风险着色）</div><div class="chart-canvas-wrap" style="height:300px"><canvas id="compare-chart"></canvas></div></div></div>' +
      '<div class="col-lg-4"><div class="chart-card"><div class="ch-title">风险等级分布</div><div class="chart-canvas-wrap"><canvas id="risk-chart"></canvas></div></div></div>' +
      '</div>' +
      '<div class="panel mt-3"><div class="panel-head"><span class="h"><i class="bi bi-table"></i>项目群进度明细</span></div><div class="panel-body" style="padding:0"><table id="ana-table" class="table mb-0"></table></div></div>'
    );
    renderSummary($main);
    renderCharts($main);
    renderTable($main);
  };

  function renderTable($main) {
    var rows = DS().getProjects().slice().sort(function (a, b) { return b.progress - a.progress; }).map(function (p) {
      var tasks = DS().getTasks(p.id);
      var planned = tasks.length ? Math.round(tasks.reduce(function (s, t) { return s + t.plannedPercent; }, 0) / tasks.length) : 0;
      var dev = p.progress - planned;
      var warns = DS().getWarnings(p.id, '待处理').length;
      return [
        UI().escape(p.name),
        '<span style="color:' + UI().typeColor(p.type) + '">' + UI().escape(p.type) + '</span>',
        UI().stageBadge(p.stage),
        UI().riskBadge(p.riskLevel),
        '<span class="mono">' + tasks.length + '</span>',
        UI().progressBar(p.progress, p.riskLevel === '高' ? 'var(--red)' : 'var(--amber)') + ' <span class="mono ms-1">' + p.progress + '%</span>',
        '<span class="mono">' + planned + '%</span>',
        '<span class="deviation-badge ' + (dev >= 0 ? 'good' : (dev >= -10 ? 'warn' : 'bad')) + '">' + (dev > 0 ? '+' : '') + dev + '%</span>',
        warns ? '<span class="text-red mono">' + warns + '</span>' : '<span class="text-green mono">0</span>'
      ];
    });
    var $tbl = $main.find('#ana-table');
    if ($.fn.DataTable.isDataTable($tbl[0])) $tbl.DataTable().destroy();
    $tbl.html('<thead><tr><th>项目</th><th>类型</th><th>阶段</th><th>风险</th><th>任务</th><th>实际进度</th><th>计划进度</th><th>偏差</th><th>预警</th></tr></thead><tbody></tbody>');
    $tbl.find('tbody').html(rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join(''));
    $tbl.DataTable({ pageLength: 8, lengthMenu: [[8, 15, -1], [8, 15, '全部']], language: { info: '显示 _START_-_END_ / 共 _TOTAL_', lengthMenu: '每页 _MENU_', search: '搜索:', zeroRecords: '无数据', paginate: { previous: '上一页', next: '下一页' } } });
  }

  M.destroy = function () { destroyCharts(); };

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.analytics = M;
})(window);
