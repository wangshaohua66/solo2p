/* ==========================================================================
   app/modules/analytics/stats.js — 统计分析模块
   多维度汇总、计划vs实际、同比/环比对比（进度偏差%/成本偏差%）、趋势图表
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { charts: [] };
  var today = moment('2026-06-20');

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };

  // 成本基准：人员 400 元/人/天，设备 1200 元/台班/天
  var COST_RATE = { team: 400, equip: 1200 };

  function destroyCharts() { state.charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); state.charts = []; }
  function C() { return { amber: '#f59e0b', blue: '#3b82f6', red: '#ef4444', green: '#10b981', cyan: '#06b6d4', purple: '#8b5cf6', grid: 'rgba(120,150,180,.15)', text: '#cbd5e1' }; }

  /* ---------- 基础聚合 ---------- */
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

  /* ---------- 成本估算 ---------- */
  /**
   * 估算单个项目计划/实际成本（基于资源容量 × 工期 × 日单价，实际 = 计划 × 偏差系数）
   * 返回 { planned, actual, schedule, progressPct, costRateFactor }
   */
  function estimateProjectCost(pid) {
    var tasks = DS().getTasks(pid);
    var resById = {};
    DS().getResources(pid).forEach(function (r) { resById[r.id] = r; });
    var planned = 0, actual = 0;
    tasks.forEach(function (tk) {
      var r = tk.resourceId ? resById[tk.resourceId] : null;
      var cap = r ? Number(r.capacity || 1) : 1;
      var rate = (r && r.type === '设备') ? COST_RATE.equip : COST_RATE.team;
      // 计划成本 = 工期 × 容量（人数/设备数）× 日单价
      var p = Math.max(1, Number(tk.duration) || 1) * cap * rate;
      planned += p;
      // 实际成本 = 计划成本 × (1 + 滞后系数)
      var deviation = tk.plannedPercent - tk.progress; // 正：滞后
      var factor = 1 + Math.max(-0.15, Math.min(0.5, deviation / 100 * 0.18));
      actual += Math.round(p * factor);
    });
    return { planned: planned, actual: actual };
  }

  /**
   * 统计截至日期 refDate 时，项目的"计划完成率"、"实际完成率"、成本（按工期进度分配）
   * 用于同比/环比对比
   */
  function snapshotAt(pid, refDate) {
    var p = DS().getProjects().find(function (x) { return x.id === pid; });
    var tasks = DS().getTasks(pid);
    if (!p || !tasks.length) return { plannedPct: 0, actualPct: 0, plannedCost: 0, actualCost: 0 };
    var resById = {};
    DS().getResources(pid).forEach(function (r) { resById[r.id] = r; });
    var totalDur = 0, donePlanned = 0, doneActual = 0;
    var plannedCost = 0, actualCost = 0;
    tasks.forEach(function (tk) {
      var dur = Math.max(1, Number(tk.duration) || 1);
      totalDur += dur;
      var s = moment(tk.startDate), e = moment(tk.endDate);
      // 计划完成率：refDate 相对任务工期的位置（0-1）× dur
      var planRatio = 0;
      if (refDate.isSameOrAfter(e)) planRatio = 1;
      else if (refDate.isSameOrAfter(s)) planRatio = refDate.diff(s, 'days', true) / dur;
      donePlanned += dur * planRatio;
      // 实际完成率（种子数据仅存"当前"值；对历史日期取 min(当前进度, 计划进度) × 历史衰减）
      var actualRatio = 0;
      if (refDate.isSameOrAfter(e)) actualRatio = Math.max(0, tk.progress) / 100;
      else if (refDate.isSameOrAfter(s)) {
        // 历史快照的实际值：约等于当前计划比值 × 当前进度/计划进度 × 衰减因子（越久远越低）
        var base = planRatio;
        var decay = tk.plannedPercent ? (tk.progress / tk.plannedPercent) : 1;
        actualRatio = Math.max(0, Math.min(1, base * Math.max(0.3, decay)));
      } else actualRatio = 0;
      doneActual += dur * actualRatio;

      // 成本（同估算，但按完成比例折算）
      var r = tk.resourceId ? resById[tk.resourceId] : null;
      var cap = r ? Number(r.capacity || 1) : 1;
      var rate = (r && r.type === '设备') ? COST_RATE.equip : COST_RATE.team;
      var unitCost = dur * cap * rate;
      plannedCost += unitCost * planRatio;
      var deviation = tk.plannedPercent - tk.progress;
      var factor = 1 + Math.max(-0.15, Math.min(0.5, deviation / 100 * 0.18));
      actualCost += unitCost * actualRatio * factor;
    });
    return {
      plannedPct: totalDur ? Math.round(donePlanned / totalDur * 100) : 0,
      actualPct: totalDur ? Math.round(doneActual / totalDur * 100) : 0,
      plannedCost: Math.round(plannedCost),
      actualCost: Math.round(actualCost)
    };
  }

  /**
   * 计算同比（Year-over-Year：本期 vs 去年同期，按项目群汇总）
   * 返回 { period: '同比', baseDate, currentDate, progressCur, progressBase, progressDeltaPct, costCur, costBase, costDeltaPct, byProject: [...] }
   */
  function computeYoY() {
    var now = today.clone();
    var prev = today.clone().subtract(1, 'year');
    return computeCompare('同比', prev, now);
  }

  /**
   * 计算环比（Month-over-Month：本期 vs 上月同期，按项目群汇总）
   * 返回 { period, baseDate, currentDate, ... }
   */
  function computeMoM() {
    var now = today.clone();
    var prev = today.clone().subtract(1, 'month');
    return computeCompare('环比', prev, now);
  }

  function computeCompare(period, baseDate, curDate) {
    var projs = DS().getProjects();
    var curSum = { plannedPct: 0, actualPct: 0, plannedCost: 0, actualCost: 0 };
    var baseSum = { plannedPct: 0, actualPct: 0, plannedCost: 0, actualCost: 0 };
    var byProject = [];
    projs.forEach(function (p) {
      var cur = snapshotAt(p.id, curDate);
      var base = snapshotAt(p.id, baseDate);
      curSum.plannedPct += cur.plannedPct;
      curSum.actualPct += cur.actualPct;
      curSum.plannedCost += cur.plannedCost;
      curSum.actualCost += cur.actualCost;
      baseSum.plannedPct += base.plannedPct;
      baseSum.actualPct += base.actualPct;
      baseSum.plannedCost += base.plannedCost;
      baseSum.actualCost += base.actualCost;
      // 单项目偏差
      var pDelta = base.actualPct ? ((cur.actualPct - base.actualPct) / base.actualPct * 100) : (cur.actualPct ? 100 : 0);
      var cDelta = base.actualCost ? ((cur.actualCost - base.actualCost) / base.actualCost * 100) : (cur.actualCost ? 100 : 0);
      byProject.push({
        id: p.id, name: p.name,
        curProg: cur.actualPct, baseProg: base.actualPct,
        progDelta: Math.round(pDelta * 10) / 10,
        curCost: cur.actualCost, baseCost: base.actualCost,
        costDelta: Math.round(cDelta * 10) / 10
      });
    });
    var n = projs.length || 1;
    var curProgAvg = Math.round(curSum.actualPct / n);
    var baseProgAvg = Math.round(baseSum.actualPct / n);
    var pDeltaAvg = baseProgAvg ? ((curProgAvg - baseProgAvg) / baseProgAvg * 100) : (curProgAvg ? 100 : 0);
    var cDeltaAvg = baseSum.actualCost ? ((curSum.actualCost - baseSum.actualCost) / baseSum.actualCost * 100) : (curSum.actualCost ? 100 : 0);
    return {
      period: period,
      baseDate: baseDate.format('YYYY-MM-DD'),
      curDate: curDate.format('YYYY-MM-DD'),
      curProg: curProgAvg,
      baseProg: baseProgAvg,
      progDeltaPct: Math.round(pDeltaAvg * 10) / 10,
      curCost: curSum.actualCost,
      baseCost: baseSum.actualCost,
      costDeltaPct: Math.round(cDeltaAvg * 10) / 10,
      byProject: byProject
    };
  }

  /* ---------- 渲染 ---------- */
  function arrow(v, goodPositive) {
    var up = v > 0, eq = Math.abs(v) < 0.001;
    var good = goodPositive ? up : !up;
    if (eq) return '<span class="text-muted-2 me-1">●</span>';
    var icon = up ? 'bi-arrow-up-short' : 'bi-arrow-down-short';
    var color = good ? 'text-green' : 'text-red';
    return '<i class="bi ' + icon + ' ' + color + ' me-1"></i>';
  }
  function delta(v, goodPositive) {
    var eq = Math.abs(v) < 0.001;
    if (eq) return '<span class="text-muted-2">— 持平</span>';
    var txt = (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + '%';
    return arrow(v, goodPositive) + '<span>' + txt + '</span>';
  }

  function renderSummary($main) {
    var projs = DS().getProjects();
    var tasks = DS().getTasks();
    var warns = DS().getWarnings(null, '待处理');
    var avgProg = projs.length ? Math.round(projs.reduce(function (s, p) { return s + p.progress; }, 0) / projs.length) : 0;
    var delayed = tasks.filter(function (t) { return t.progress < t.plannedPercent - 10 && t.plannedPercent > 0; }).length;
    // 项目群总成本估算
    var totalCost = projs.reduce(function (s, p) { var c = estimateProjectCost(p.id); return s + c.actual; }, 0);
    var plannedTotalCost = projs.reduce(function (s, p) { var c = estimateProjectCost(p.id); return s + c.planned; }, 0);
    var cards = [
      { label: '项目平均进度', value: avgProg + '%', icon: 'bi-graph-up', ok: avgProg >= 50, delta: projs.length + ' 个项目' },
      { label: '任务总数', value: UI().fmtNum(tasks.length), icon: 'bi-list-check', ok: true, delta: '全项目汇总' },
      { label: '进度滞后任务', value: delayed, icon: 'bi-skip-forward', ok: !delayed, delta: '实际<计划' },
      { label: '待处置预警', value: warns.length, icon: 'bi-bell', ok: !warns.length, delta: '全风险类型' }
    ];
    var html = cards.map(function (c) {
      return '<div class="col-6 col-lg-3 mb-3"><div class="stat-card"><div class="label">' + UI().escape(c.label) + '</div><div class="value mono ' + (c.ok ? 'text-green' : 'text-red') + '">' + c.value + '</div><div class="delta text-muted-2">' + UI().escape(c.delta) + '</div><i class="bi ' + c.icon + ' icon"></i></div></div>';
    }).join('');
    // 成本合计卡
    var costDev = plannedTotalCost ? ((totalCost - plannedTotalCost) / plannedTotalCost * 100) : 0;
    html += '<div class="col-6 col-lg-6 mb-3"><div class="stat-card"><div class="label">项目群实际成本估算</div><div class="value mono ' + (costDev <= 3 ? 'text-green' : 'text-red') + '">¥' + UI().fmtMoney(totalCost) + '</div><div class="delta text-muted-2">计划 ¥' + UI().fmtMoney(plannedTotalCost) + ' · 偏差 ' + (costDev > 0 ? '+' : '') + (Math.round(costDev * 10) / 10) + '%</div><i class="bi bi-cash-stack icon"></i></div></div>';
    $main.find('#ana-stat').html(html);
  }

  /**
   * 渲染 4 张同比/环比对比卡片（进度/成本 × 同比/环比）
   */
  function renderCompare($main, yoy, mom) {
    var cards = [
      { label: '进度同比', sub: yoy.baseDate + ' → ' + yoy.curDate,
        cur: yoy.curProg + '%', base: '去年 ' + yoy.baseProg + '%',
        delta: delta(yoy.progDeltaPct, true), good: yoy.progDeltaPct >= 0, icon: 'bi-calendar-week-fill' },
      { label: '进度环比', sub: mom.baseDate + ' → ' + mom.curDate,
        cur: mom.curProg + '%', base: '上月 ' + mom.baseProg + '%',
        delta: delta(mom.progDeltaPct, true), good: mom.progDeltaPct >= 0, icon: 'bi-calendar3' },
      { label: '成本同比', sub: yoy.baseDate + ' → ' + yoy.curDate,
        cur: '¥' + UI().fmtMoney(yoy.curCost), base: '去年 ¥' + UI().fmtMoney(yoy.baseCost),
        delta: delta(yoy.costDeltaPct, false), good: yoy.costDeltaPct <= 3, icon: 'bi-cash-coin' },
      { label: '成本环比', sub: mom.baseDate + ' → ' + mom.curDate,
        cur: '¥' + UI().fmtMoney(mom.curCost), base: '上月 ¥' + UI().fmtMoney(mom.baseCost),
        delta: delta(mom.costDeltaPct, false), good: mom.costDeltaPct <= 3, icon: 'bi-wallet2' }
    ];
    $main.find('#ana-compare').html(cards.map(function (c) {
      return '<div class="col-lg-3 col-sm-6 mb-3"><div class="stat-card compare-card ' + (c.good ? '' : 'neg') + '">' +
        '<div class="label">' + UI().escape(c.label) + '</div>' +
        '<div class="value mono ' + (c.good ? 'text-green' : 'text-red') + '">' + c.cur + '</div>' +
        '<div class="delta text-muted-2">' + UI().escape(c.base) + ' · ' + UI().escape(c.sub) + '</div>' +
        '<div class="comp-delta mt-2">' + c.delta + '</div>' +
        '<i class="bi ' + c.icon + ' icon"></i></div></div>';
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

  /**
   * 同比/环比趋势图：各项目的进度偏差% vs 成本偏差%（气泡 + 柱双维）
   */
  function renderCompareChart($main, yoy, mom) {
    var c = C();
    // 取前 12 个项目展示
    var data = yoy.byProject.slice(0, 12);
    state.charts.push(new Chart(document.getElementById('yoy-chart'), {
      type: 'bar',
      data: {
        labels: data.map(function (d) { return d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name; }),
        datasets: [
          { label: '同比 进度偏差%', data: data.map(function (d) { return d.progDelta; }), backgroundColor: data.map(function (d) { return d.progDelta >= 0 ? c.green : c.red; }), borderRadius: 4 },
          { label: '同比 成本偏差%', data: data.map(function (d) { return d.costDelta; }), backgroundColor: data.map(function (d) { return d.costDelta <= 3 ? c.blue : c.amber; }), borderRadius: 4 }
        ]
      },
      options: opts('%', true)
    }));
    var data2 = mom.byProject.slice(0, 12);
    state.charts.push(new Chart(document.getElementById('mom-chart'), {
      type: 'bar',
      data: {
        labels: data2.map(function (d) { return d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name; }),
        datasets: [
          { label: '环比 进度偏差%', data: data2.map(function (d) { return d.progDelta; }), backgroundColor: data2.map(function (d) { return d.progDelta >= 0 ? c.green : c.red; }), borderRadius: 4 },
          { label: '环比 成本偏差%', data: data2.map(function (d) { return d.costDelta; }), backgroundColor: data2.map(function (d) { return d.costDelta <= 3 ? c.blue : c.amber; }), borderRadius: 4 }
        ]
      },
      options: opts('%', true)
    }));
  }

  function renderCharts($main, yoy, mom) {
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
    // 同比/环比图表
    renderCompareChart($main, yoy, mom);
  }

  M.render = function ($main) {
    destroyCharts();
    var yoy = computeYoY();
    var mom = computeMoM();
    $main.html(
      '<div class="d-flex align-items-center mb-3"><div class="me-auto"><div class="text-muted-2" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase">ANALYTICS</div><div style="font-size:13px;color:var(--steel-100)">项目群多维度汇总分析 · 计划 vs 实际 · 同比 / 环比双期对比</div></div>' +
      '<button class="btn btn-ghost btn-sm" id="ana-reset-demo"><i class="bi bi-arrow-counterclockwise me-1"></i>重置演示数据</button></div>' +
      '<div id="ana-stat" class="row"></div>' +
      '<div class="row g-3 mt-1">' +
      '<div class="col-lg-6"><div class="chart-card"><div class="ch-title">各工程类型 计划 vs 实际完成率</div><div class="chart-canvas-wrap"><canvas id="type-chart"></canvas></div></div></div>' +
      '<div class="col-lg-6"><div class="chart-card"><div class="ch-title">预警类型分布</div><div class="chart-canvas-wrap"><canvas id="warn-chart"></canvas></div></div></div>' +
      '<div class="col-lg-8"><div class="chart-card"><div class="ch-title">项目进度对比（按风险着色）</div><div class="chart-canvas-wrap" style="height:300px"><canvas id="compare-chart"></canvas></div></div></div>' +
      '<div class="col-lg-4"><div class="chart-card"><div class="ch-title">风险等级分布</div><div class="chart-canvas-wrap"><canvas id="risk-chart"></canvas></div></div></div>' +
      '</div>' +
      // 同比/环比区块
      '<div class="panel mt-3"><div class="panel-head"><span class="h"><i class="bi bi-arrow-left-right"></i>同比 / 环比对比</span>' +
      '<span class="text-muted-2 ms-2" style="font-size:11px">本期 ' + today.format('YYYY-MM-DD') + ' · 环比上月 · 同比去年</span></div>' +
      '<div class="panel-body">' +
      '<div id="ana-compare" class="row"></div>' +
      '<div class="row g-3 mt-2">' +
      '<div class="col-lg-6"><div class="chart-card"><div class="ch-title">项目同比对比：进度偏差% / 成本偏差%</div><div class="chart-canvas-wrap" style="height:260px"><canvas id="yoy-chart"></canvas></div></div></div>' +
      '<div class="col-lg-6"><div class="chart-card"><div class="ch-title">项目环比对比：进度偏差% / 成本偏差%</div><div class="chart-canvas-wrap" style="height:260px"><canvas id="mom-chart"></canvas></div></div></div>' +
      '</div></div></div>' +
      // 进度明细
      '<div class="panel mt-3 mb-4"><div class="panel-head"><span class="h"><i class="bi bi-table"></i>项目群进度明细（含同比/环比偏差）</span></div><div class="panel-body" style="padding:0"><table id="ana-table" class="table mb-0"></table></div></div>'
    );
    renderSummary($main);
    renderCompare($main, yoy, mom);
    renderCharts($main, yoy, mom);
    renderTable($main, yoy, mom);
    // 重置演示数据按钮
    $main.find('#ana-reset-demo').on('click', function () {
      UI().confirm({ title: '重置演示数据', message: '将清除当前所有数据并重新生成演示数据，此操作不可恢复。', okText: '确认重置' }, function () {
        DS().reset(); UI().toast('已重置为演示数据', 'success');
        setTimeout(function () { location.reload(); }, 600);
      });
    });
  };

  function renderTable($main, yoy, mom) {
    // 建立按项目ID索引
    var yoyById = {}, momById = {};
    yoy.byProject.forEach(function (d) { yoyById[d.id] = d; });
    mom.byProject.forEach(function (d) { momById[d.id] = d; });
    var rows = DS().getProjects().slice().sort(function (a, b) { return b.progress - a.progress; }).map(function (p) {
      var tasks = DS().getTasks(p.id);
      var planned = tasks.length ? Math.round(tasks.reduce(function (s, t) { return s + t.plannedPercent; }, 0) / tasks.length) : 0;
      var dev = p.progress - planned;
      var warns = DS().getWarnings(p.id, '待处理').length;
      var cost = estimateProjectCost(p.id);
      var costDevPct = cost.planned ? ((cost.actual - cost.planned) / cost.planned * 100) : 0;
      var y = yoyById[p.id] || { progDelta: 0, costDelta: 0 };
      var m = momById[p.id] || { progDelta: 0, costDelta: 0 };
      return [
        UI().escape(p.name),
        '<span style="color:' + UI().typeColor(p.type) + '">' + UI().escape(p.type) + '</span>',
        UI().stageBadge(p.stage),
        UI().riskBadge(p.riskLevel),
        '<span class="mono">' + tasks.length + '</span>',
        UI().progressBar(p.progress, p.riskLevel === '高' ? 'var(--red)' : 'var(--amber)') + ' <span class="mono ms-1">' + p.progress + '%</span>',
        '<span class="mono">' + planned + '%</span>',
        '<span class="deviation-badge ' + (dev >= 0 ? 'good' : (dev >= -10 ? 'warn' : 'bad')) + '">' + (dev > 0 ? '+' : '') + dev + '%</span>',
        '<span class="mono">' + (y.progDelta > 0 ? '+' : '') + y.progDelta + '%</span> <span class="text-muted-2 mono" style="font-size:10px">' + (m.progDelta > 0 ? '+' : '') + m.progDelta + '%环</span>',
        '¥<span class="mono">' + UI().fmtMoney(cost.actual) + '</span>',
        '<span class="deviation-badge ' + (costDevPct <= 3 ? 'good' : (costDevPct <= 8 ? 'warn' : 'bad')) + '">' + (costDevPct > 0 ? '+' : '') + (Math.round(costDevPct * 10) / 10) + '%</span>',
        '<span class="mono ' + (y.costDelta <= 3 ? 'text-green' : 'text-red') + '">' + (y.costDelta > 0 ? '+' : '') + y.costDelta + '%</span> <span class="text-muted-2 mono" style="font-size:10px">' + (m.costDelta > 0 ? '+' : '') + m.costDelta + '%环</span>',
        warns ? '<span class="text-red mono">' + warns + '</span>' : '<span class="text-green mono">0</span>'
      ];
    });
    var $tbl = $main.find('#ana-table');
    if ($.fn.DataTable.isDataTable($tbl[0])) $tbl.DataTable().destroy();
    $tbl.html('<thead><tr>' +
      '<th>项目</th><th>类型</th><th>阶段</th><th>风险</th><th>任务数</th>' +
      '<th>实际进度</th><th>计划进度</th><th>进度偏差</th>' +
      '<th>同比/环比<br><span class="text-muted-2" style="font-size:10px">进度偏差%</span></th>' +
      '<th>实际成本</th><th>成本偏差</th>' +
      '<th>同比/环比<br><span class="text-muted-2" style="font-size:10px">成本偏差%</span></th>' +
      '<th>预警</th>' +
      '</tr></thead><tbody></tbody>');
    $tbl.find('tbody').html(rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join(''));
    $tbl.DataTable({
      pageLength: 8, lengthMenu: [[8, 15, -1], [8, 15, '全部']], scrollX: true,
      language: { info: '显示 _START_-_END_ / 共 _TOTAL_', lengthMenu: '每页 _MENU_', search: '搜索:', zeroRecords: '无数据', paginate: { previous: '上一页', next: '下一页' } }
    });
  }

  M.destroy = function () { destroyCharts(); };
  // 暴露给其他模块复用
  M.estimateProjectCost = estimateProjectCost;
  M.snapshotAt = snapshotAt;
  M.computeYoY = computeYoY;
  M.computeMoM = computeMoM;

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.analytics = M;
})(window);
