/* ==========================================================================
   app.js — 入口与 Hash 路由分发、全局状态、页面渲染
   ========================================================================== */
(function (global) {
  'use strict';
  var $ = global.jQuery;
  var DS = global.DataStore;
  var AE = global.AnalysisEngine;
  var CR = global.ChartRenderer;
  var RG = global.ReportGenerator;
  var TF = global.TrialForm;

  var App = {
    routes: {},
    state: null,
    $main: null
  };

  /* ---------- Toast ---------- */
  App.toast = function (type, title, msg, timeout) {
    var icons = { success: 'bi-check-circle-fill', warn: 'bi-exclamation-triangle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    var $t = $('<div class="toast-msg ' + type + '"><i class="bi ' + (icons[type] || icons.info) + '"></i><div class="tm-text">' + (title ? '<b>' + title + '</b>' : '') + (msg || '') + '</div></div>');
    $('#toastContainer').append($t);
    setTimeout(function () { $t.addClass('out'); setTimeout(function () { $t.remove(); }, 300); }, timeout || 3200);
  };

  App.navigate = function (hash) { location.hash = hash; };

  /* ---------- 顶部栏/侧边栏渲染 ---------- */
  App.refreshChrome = function () {
    var state = DS.getState();
    App.state = state;
    // 作物标签
    var $tabs = $('#cropTabs').empty();
    DS.getCrops().forEach(function (c) {
      $tabs.append('<button class="crop-tab' + (c.code === state.currentCrop ? ' active' : '') + '" data-crop="' + c.code + '"><i class="bi ' + c.icon + '"></i><span>' + c.name + '</span></button>');
    });
    // 年度选择
    var $y = $('#yearSelector').empty();
    DS.getYears().forEach(function (y) { $y.append('<option value="' + y + '"' + (y === state.currentYear ? ' selected' : '') + '>' + y + ' 年度</option>'); });
    // 存储用量
    var usage = DS.getStorageUsage();
    var $m = $('#storageMeter');
    $m.find('.sm-value').text(usage.percent + '%');
    $m.attr('title', '本地存储: ' + (usage.used / 1024).toFixed(1) + 'KB / ' + (usage.total / 1024).toFixed(0) + 'KB (' + usage.percent + '%)');
    $m.find('.sm-bar').remove();
    $m.append('<span class="sm-bar"><span class="sm-fill" style="width:' + usage.percent + '%"></span></span>');
    $m.find('.sm-value').wrap('<span></span>');
  };

  /* ---------- 事件绑定(全局) ---------- */
  App.bindGlobal = function () {
    $(document).on('click', '.crop-tab', function () {
      DS.setState({ currentCrop: $(this).data('crop') });
      App.refreshChrome();
      App.route();
    });
    $(document).on('change', '#yearSelector', function () {
      DS.setState({ currentYear: parseInt($(this).val(), 10) });
      App.refreshChrome();
      App.route();
    });
    $('#sidebarToggle').on('click', function () { $('#sidebar').toggleClass('open'); $('#sidebarOverlay').toggleClass('show'); });
    $('#sidebarOverlay').on('click', function () { $('#sidebar').removeClass('open'); $('#sidebarOverlay').removeClass('show'); });
    $(document).on('click', '.side-link', function () { if (window.innerWidth < 992) { $('#sidebar').removeClass('open'); $('#sidebarOverlay').removeClass('show'); } });
    $('#resetDataBtn').on('click', function () { if (confirm('确认重置为示例数据？当前所有自定义数据将被清除。')) { DS.resetSeed(); App.refreshChrome(); App.toast('success', '已重置', '示例数据已恢复'); App.route(); } });
    $(window).on('hashchange', App.route);
  };

  /* ---------- 路由分发 ---------- */
  App.route = function () {
    var hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
    var parts = hash.split('?');
    var path = parts[0];
    var query = {};
    (parts[1] || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    App.query = query;
    CR.destroyAll();
    $('.side-link').removeClass('active');
    $('.side-link[data-route="' + path + '"]').addClass('active');
    var fn = App.routes[path] || App.routes.dashboard;
    var $main = $('#app-main');
    $main.scrollTop(0);
    try {
      fn.call(App, $main, query);
    } catch (e) {
      console.error(e);
      $main.html('<div class="empty-state"><i class="bi bi-bug"></i><h5>页面渲染出错</h5><p>' + e.message + '</p></div>');
    }
  };

  /* ---------- 辅助 ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cropName(code) { var c = DS.getCrop(code); return c ? c.name : code; }
  function stationName(code) { var s = DS.getStation(code); return s ? s.name : code; }
  function getState() { return DS.getState(); }

  /* ============================================================
     页面：工作台
     ============================================================ */
  App.routes.dashboard = function ($main) {
    var state = getState();
    var year = state.currentYear, crop = state.currentCrop;
    var cropObj = DS.getCrop(crop);
    var plans = DS.getTrialPlans({ year: year });
    var allRecords = DS.getRecords({ year: year });
    var cropRecords = DS.getRecords({ year: year, crop: crop });
    var varieties = DS.getVarieties({ year: year });
    var issues = DS.getValidationIssues({ year: year });
    var completeRate = allRecords.length ? Math.round(cropRecords.filter(function (r) { return r.status === 'normal'; }).length / cropRecords.length * 100) : 0;
    var cropDist = {};
    DS.getCrops().forEach(function (c) { cropDist[c.name] = DS.getVarieties({ year: year, crop: c.code }).length; });

    $main.html(''
      + '<div class="page-head"><div><h1 class="page-title">工作台总览<small>' + year + ' 年度 · 当前作物 <b style="color:var(--gold-700)">' + cropObj.name + '</b> · 试验数据一体化中心</small></h1></div>'
      + '<div class="crumb"><i class="bi bi-house"></i> 首页 <span class="sep">/</span> 工作台</div></div>'

      + '<div class="stat-grid mb-4">'
      + statCard('bi-flower1', '参试品种', varieties.length, '个', cropObj.name + ' 等 ' + DS.getCrops().filter(function (c) { return DS.getVarieties({ year: year, crop: c.code }).length; }).length + ' 作物', 'gold')
      + statCard('bi-geo-alt', '试验站点', DS.getStations().length, '个', '覆盖 ' + new Set(DS.getStations().map(function (s) { return s.region; })).size + ' 区域', '')
      + statCard('bi-database', '试验记录', allRecords.length, '条', cropObj.name + ' ' + cropRecords.length + ' 条', 'info')
      + statCard('bi-shield-check', '数据完整率', completeRate, '%', '异常 ' + issues.length + ' 项', issues.length ? 'warn' : '')
      + '</div>'

      + '<div class="row g-4">'
      + '<div class="col-lg-5"><div class="card card-hover h-100"><div class="card-header"><i class="bi bi-pie-chart"></i> 作物品种分布<span class="actions"><span class="badge-soft badge-gray">' + year + '年度</span></span></div><div class="card-body"><div class="chart-canvas-wrap" style="height:280px;"><canvas id="dashCropChart"></canvas></div></div></div></div>'
      + '<div class="col-lg-4"><div class="card card-hover h-100"><div class="card-header"><i class="bi bi-bar-chart"></i> 各作物记录量</div><div class="card-body"><div class="chart-canvas-wrap" style="height:280px;"><canvas id="dashRecChart"></canvas></div></div></div></div>'
      + '<div class="col-lg-3"><div class="card card-hover h-100"><div class="card-header"><i class="bi bi-shield-exclamation"></i> 异常预警</div><div class="card-body d-flex flex-column">'
      + issueStat('缺失小区', issues.filter(function (i) { return i.type === 'missing'; }).length, 'bi-exclamation-octagon', 'warn')
      + issueStat('极端值', issues.filter(function (i) { return i.type === 'extreme'; }).length, 'bi-graph-down-arrow', 'warn')
      + issueStat('逻辑矛盾', issues.filter(function (i) { return i.type === 'logic'; }).length, 'bi-arrow-left-right', 'warn')
      + '<button class="btn btn-outline-green btn-sm mt-auto" onclick="App.navigate(\'#/validation\')"><i class="bi bi-arrow-right"></i> 查看校验详情</button>'
      + '</div></div></div></div>'
      + '</div>'

      + '<div class="row g-4 mt-1">'
      + '<div class="col-lg-8"><div class="card"><div class="card-header"><i class="bi bi-lightning-charge"></i> 快速入口</div><div class="card-body">'
      + '<div class="row g-3">'
      + quickEntry('#/data-entry', 'bi-pencil-square', '田间数据录入', '物候·农艺·抗性三步向导', 'green')
      + quickEntry('#/analysis', 'bi-bar-chart-line', '多点汇总分析', '产量·CV·Shukla稳定性', 'gold')
      + quickEntry('#/gge', 'bi-diagram-3', 'GGE双标图', 'PCA分解·理想品种识别', 'green')
      + quickEntry('#/compare', 'bi-graph-up-arrow', '品种比较图表', '柱状·折线·雷达', 'gold')
      + quickEntry('#/reports', 'bi-file-earmark-text', '审定报告生成', 'PDF·Excel一键导出', 'green')
      + quickEntry('#/trials', 'bi-clipboard-data', '试验方案配置', '品种·站点·重复', 'gold')
      + '</div></div></div></div>'
      + '<div class="col-lg-4"><div class="card h-100"><div class="card-header"><i class="bi bi-clock-history"></i> 当前方案</div><div class="card-body" id="dashPlan"></div></div></div>'
      + '</div>');

    // 当前方案卡
    if (plans.length) {
      var p = plans[0];
      $('#dashPlan').html('<div class="badge-soft badge-green mb-2">' + p.id + ' · ' + p.version + '</div>'
        + '<div class="small text-muted-2 mb-2">' + cropName(p.cropCode) + ' · ' + p.year + '年度</div>'
        + '<div class="d-flex justify-content-between mb-1"><span class="small">参试品种</span><b class="num">' + p.varietyIds.length + '</b></div>'
        + '<div class="d-flex justify-content-between mb-1"><span class="small">试验站点</span><b class="num">' + p.stationCodes.length + '</b></div>'
        + '<div class="d-flex justify-content-between mb-1"><span class="small">重复次数</span><b class="num">' + p.replications + '</b></div>'
        + '<div class="progress mt-2"><div class="progress-bar" style="width:' + completeRate + '%"></div></div>'
        + '<div class="small text-muted-2 mt-1">数据完整率 ' + completeRate + '%</div>'
        + '<button class="btn btn-sm btn-outline-green w-100 mt-3" onclick="App.navigate(\'#/analysis\')"><i class="bi bi-bar-chart-line"></i> 查看汇总</button>');
    } else {
      $('#dashPlan').html('<div class="empty-state" style="padding:20px;"><i class="bi bi-clipboard-plus"></i><p>暂无方案</p><button class="btn btn-sm btn-primary" onclick="App.navigate(\'#/trials\')">创建方案</button></div>');
    }

    // 图表
    setTimeout(function () {
      CR.doughnut('dashCropChart', { labels: Object.keys(cropDist), values: Object.values(cropDist) });
      var recByCrop = DS.getCrops().map(function (c) { return DS.getRecords({ year: year, crop: c.code }).length; });
      CR.yieldBar('dashRecChart', { labels: DS.getCrops().map(function (c) { return c.name; }), datasets: [{ label: '记录数', values: recByCrop }], unit: '条' });
    }, 50);
  };

  function statCard(icon, label, value, unit, foot, cls) {
    return '<div class="stat-card ' + (cls || '') + '"><div class="stat-label"><i class="bi ' + icon + '"></i>' + label + '</div><div class="stat-value">' + value + '<span class="unit">' + (unit || '') + '</span></div><div class="stat-foot">' + (foot || '') + '</div></div>';
  }
  function issueStat(label, count, icon, cls) {
    return '<div class="d-flex align-items-center justify-content-between py-2 border-bottom"><div><i class="bi ' + icon + '" style="color:var(--warn-600)"></i> <span class="small">' + label + '</span></div><span class="badge-soft badge-' + (cls || 'warn') + '">' + count + '</span></div>';
  }
  function quickEntry(hash, icon, title, sub, cls) {
    return '<div class="col-md-4 col-sm-6"><a href="' + hash + '" class="text-decoration-none"><div class="card card-hover h-100 text-center p-3"><i class="bi ' + icon + '" style="font-size:26px;color:var(--green-600)"></i><div class="fw-semibold mt-2" style="color:var(--green-800)">' + title + '</div><div class="small text-muted-2">' + sub + '</div></div></a></div>';
  }

  /* ============================================================
     页面：试验方案配置
     ============================================================ */
  App.routes.trials = function ($main) {
    var state = getState();
    var plans = DS.getTrialPlans({ year: state.currentYear });
    $main.html(''
      + '<div class="page-head"><div><h1 class="page-title">试验方案配置<small>按作物设定参试品种、对照、站点分配与重复次数 · 支持年度复用</small></h1></div>'
      + '<div class="crumb"><i class="bi bi-house"></i> 首页 <span class="sep">/</span> 试验管理 <span class="sep">/</span> 方案配置</div></div>'
      + '<div class="d-flex justify-content-end mb-3 gap-2"><button class="btn btn-outline-green btn-sm" id="reusePlan"><i class="bi bi-files"></i> 复用去年方案</button><button class="btn btn-primary" id="newPlan"><i class="bi bi-plus-lg"></i> 新建方案</button></div>'
      + '<div class="row g-3" id="planList"></div>');

    function renderList() {
      var plansAll = DS.getTrialPlans({ year: state.currentYear });
      var $list = $('#planList').empty();
      if (!plansAll.length) {
        $list.html('<div class="col-12"><div class="empty-state"><i class="bi bi-clipboard-plus"></i><h5>暂无方案</h5><p>' + state.currentYear + ' 年度尚未配置试验方案</p><button class="btn btn-primary" onclick="$(\'#newPlan\').click()"><i class="bi bi-plus-lg"></i> 新建方案</button></div></div>');
        return;
      }
      plansAll.forEach(function (p) {
        var crop = DS.getCrop(p.cropCode);
        var recCount = DS.getRecords({ planId: p.id }).length;
        $list.append('<div class="col-md-6 col-xl-4"><div class="card card-hover h-100"><div class="card-body">'
          + '<div class="d-flex justify-content-between align-items-start mb-2"><div><span class="cropsprite" style="background:var(--green-100);color:var(--green-700)"><i class="bi ' + crop.icon + '"></i></span> <b style="color:var(--green-900)">' + p.cropName + '</b></div><span class="badge-soft badge-gold">' + p.version + '</span></div>'
          + '<div class="text-muted-2 small mb-3">' + p.id + ' · ' + p.year + '年度</div>'
          + '<div class="d-flex justify-content-between mb-1"><span class="small">参试品种</span><b class="num">' + p.varietyIds.length + '</b></div>'
          + '<div class="d-flex justify-between align-items-center mb-1"><span class="small">试验站点</span><b class="num">' + p.stationCodes.length + '</b></div>'
          + '<div class="d-flex justify-content-between mb-3"><span class="small">重复次数</span><b class="num">' + p.replications + '</b></div>'
          + '<div class="progress mb-1"><div class="progress-bar" style="width:' + Math.min(100, recCount / (p.varietyIds.length * p.stationCodes.length * p.replications) * 100) + '%"></div></div>'
          + '<div class="small text-muted-2 mb-3">已录入 ' + recCount + ' 条</div>'
          + '<div class="d-flex gap-2"><button class="btn btn-sm btn-outline-green flex-fill" onclick="App.editPlan(\'' + p.id + '\')"><i class="bi bi-pencil"></i> 编辑</button>'
          + '<button class="btn btn-sm btn-outline-gold flex-fill" onclick="App.navigate(\'#/data-entry\')"><i class="bi bi-arrow-right"></i> 录入</button>'
          + '<button class="btn btn-sm btn-ghost text-danger" onclick="App.deletePlan(\'' + p.id + '\')"><i class="bi bi-trash"></i></button></div>'
          + '</div></div></div>');
      });
    }
    renderList();

    $('#newPlan').on('click', function () { App.editPlan(null); });
    $('#reusePlan').on('click', function () {
      var lastYear = DS.getTrialPlans({ year: state.currentYear - 1 });
      if (!lastYear.length) { App.toast('warn', '无可复用方案', (state.currentYear - 1) + '年度无方案'); return; }
      lastYear.forEach(function (p) {
        var np = Object.assign({}, p, { id: 'P' + Date.now() + '_' + p.cropCode, year: state.currentYear, version: 'v1.0(复用' + (state.currentYear - 1) + ')', createdAt: state.currentYear + '-03-01' });
        DS.saveTrialPlan(np);
      });
      App.toast('success', '已复用', '从 ' + (state.currentYear - 1) + ' 年度复用 ' + lastYear.length + ' 个方案');
      renderList();
    });
  };

  App.editPlan = function (planId) {
    var state = getState();
    var plan = planId ? DS.getTrialPlan(planId) : { id: null, year: state.currentYear, cropCode: state.currentCrop, cropName: cropName(state.currentCrop), varietyIds: [], controlId: null, stationCodes: DS.getStations().map(function (s) { return s.code; }), replications: 3, version: 'v1.0', status: '进行中' };
    var crops = DS.getCrops();
    var allVarieties = DS.getVarieties({ year: state.currentYear });
    var stations = DS.getStations();
    var modalHtml = ''
      + '<div class="modal fade" id="planModal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content">'
      + '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-clipboard-data"></i>' + (planId ? '编辑方案' : '新建方案') + '</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
      + '<div class="modal-body">'
      + '  <div class="row g-3 mb-3">'
      + '    <div class="col-md-4"><label class="form-label">作物</label><select id="pmCrop" class="form-select">' + crops.map(function (c) { return '<option value="' + c.code + '"' + (c.code === plan.cropCode ? ' selected' : '') + '>' + c.name + '</option>'; }).join('') + '</select></div>'
      + '    <div class="col-md-4"><label class="form-label">年度</label><input type="number" id="pmYear" class="form-control" value="' + plan.year + '" /></div>'
      + '    <div class="col-md-4"><label class="form-label">重复次数</label><input type="number" id="pmRep" class="form-control" min="1" max="5" value="' + plan.replications + '" /></div>'
      + '  </div>'
      + '  <div class="mb-3"><label class="form-label">版本号</label><input type="text" id="pmVer" class="form-control" value="' + plan.version + '" /></div>'
      + '  <div class="divider-text">参试品种(勾选参与试验的品种)</div>'
      + '  <div class="chip-group" id="pmVarieties"></div>'
      + '  <div class="divider-text">试验站点分配</div>'
      + '  <div class="chip-group" id="pmStations"></div>'
      + '</div>'
      + '<div class="modal-footer"><button class="btn btn-ghost" data-bs-dismiss="modal">取消</button><button class="btn btn-primary" id="pmSave"><i class="bi bi-check2"></i> 保存方案</button></div>'
      + '</div></div></div>';
    $('body').append(modalHtml);
    var $m = $('#planModal');
    var selVarieties = {};
    plan.varietyIds.forEach(function (id) { selVarieties[id] = true; });
    var selStations = {};
    plan.stationCodes.forEach(function (c) { selStations[c] = true; });

    function renderVarieties() {
      var cc = $('#pmCrop').val();
      var list = DS.getVarieties({ year: parseInt($('#pmYear').val(), 10), crop: cc });
      var $v = $('#pmVarieties').empty();
      if (!list.length) { $v.html('<span class="text-muted-2 small">该年度/作物无品种，请先到录入或重置示例数据</span>'); return; }
      list.forEach(function (v) {
        $v.append('<span class="chip' + (selVarieties[v.id] ? ' active' : '') + '" data-vid="' + v.id + '">' + v.code + ' ' + v.name + (v.isControl ? ' ★' : '') + '</span>');
      });
    }
    function renderStations() {
      var $s = $('#pmStations').empty();
      stations.forEach(function (s) {
        $s.append('<span class="chip' + (selStations[s.code] ? ' active' : '') + '" data-scode="' + s.code + '">' + s.code + ' ' + s.name + '</span>');
      });
    }
    renderVarieties(); renderStations();
    $m.on('click', '#pmVarieties .chip', function () { var id = $(this).data('vid'); selVarieties[id] = !selVarieties[id]; $(this).toggleClass('active'); });
    $m.on('click', '#pmStations .chip', function () { var c = $(this).data('scode'); selStations[c] = !selStations[c]; $(this).toggleClass('active'); });
    $m.on('change', '#pmCrop,#pmYear', renderVarieties);
    $m.on('click', '#pmSave', function () {
      var cc = $('#pmCrop').val();
      var vids = Object.keys(selVarieties);
      var scodes = Object.keys(selStations);
      if (!vids.length) { App.toast('warn', '请选择品种', '至少选择1个参试品种'); return; }
      if (!scodes.length) { App.toast('warn', '请选择站点', '至少选择1个试验站点'); return; }
      var controlVid = vids.map(function (id) { return DS.getVariety(id); }).find(function (v) { return v.isControl; });
      var np = {
        id: plan.id || ('P' + Date.now()),
        year: parseInt($('#pmYear').val(), 10),
        cropCode: cc, cropName: cropName(cc),
        varietyIds: vids,
        controlId: controlVid ? controlVid.id : vids[0],
        stationCodes: scodes,
        replications: parseInt($('#pmRep').val(), 10) || 3,
        version: $('#pmVer').val() || 'v1.0',
        createdAt: plan.createdAt || new Date().toISOString().slice(0, 10),
        status: plan.status || '进行中'
      };
      DS.saveTrialPlan(np);
      App.toast('success', '方案已保存', np.cropName + ' · ' + np.year + '年度');
      try { if (window.bootstrap && bootstrap.Modal) bootstrap.Modal.getInstance($m[0]).hide(); } catch (e) {}
      $m.remove();
      App.routes.trials($('#app-main'));
    });
    var bs = null;
    try { if (window.bootstrap && bootstrap.Modal) { bs = new bootstrap.Modal($m[0]); bs.show(); } else $m.addClass('show').css('display', 'block').attr('aria-modal', 'true'); }
    catch (e) { $m.addClass('show').css('display', 'block').attr('aria-modal', 'true'); }
    $m.on('hidden.bs.modal', function () { $m.remove(); });
  };
  App.deletePlan = function (id) { if (confirm('确认删除该方案及其所有试验记录？')) { DS.deleteTrialPlan(id); App.toast('success', '已删除', '方案及关联记录已清除'); App.routes.trials($('#app-main')); } };

  /* ============================================================
     页面：数据录入
     ============================================================ */
  App.routes['data-entry'] = function ($main) {
    $main.html('<div class="row g-4"><div class="col-lg-8" id="tfHost"></div><div class="col-lg-4" id="tfImport"></div></div>');
    TF.render('#tfHost');
    TF.renderImportCard('#tfImport');
  };

  /* ============================================================
     页面：多点汇总分析
     ============================================================ */
  App.routes.analysis = function ($main) {
    var state = getState();
    var plans = DS.getTrialPlans({ year: state.currentYear, crop: state.currentCrop });
    if (!plans.length) { $main.html(emptyPlan()); return; }
    var plan = plans[0];
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var stations = plan.stationCodes.map(function (c) { return DS.getStation(c); }).filter(Boolean);
    var records = DS.getRecords({ planId: plan.id });
    $main.html(''
      + '<div class="page-head"><div><h1 class="page-title">多点汇总分析<small>' + cropName(state.currentCrop) + ' · ' + plan.id + ' · 跨 ' + stations.length + ' 站点产量汇总与稳定性分析</small></h1></div>'
      + '<div class="crumb"><i class="bi bi-house"></i> 首页 <span class="sep">/</span> 分析评估 <span class="sep">/</span> 多点汇总</div></div>'
      + '<div class="d-flex justify-content-end mb-3 gap-2"><button class="btn btn-outline-gold btn-sm" onclick="ReportGenerator.exportDataTablePDF()"><i class="bi bi-file-pdf"></i> 数值表PDF</button><button class="btn btn-outline-green btn-sm" onclick="ReportGenerator.exportExcel()"><i class="bi bi-file-earmark-excel"></i> Excel汇总</button></div>'
      + '<div class="row g-4"><div class="col-lg-3"><div class="filter-panel"><h6><i class="bi bi-funnel"></i> 分析筛选</h6>'
      + '<div class="filter-group"><label>试验方案</label><select class="form-select form-select-sm" id="anPlan"></select></div>'
      + '<div class="filter-group"><label>显示品种数 <span class="hint" id="anVarCount"></span></label><input type="range" class="form-range" id="anLimit" min="5" max="' + varieties.length + '" value="' + Math.min(12, varieties.length) + '" /></div>'
      + '<div class="filter-group"><label>排序依据</label><select class="form-select form-select-sm" id="anSort"><option value="mean">亩产均值↓</option><option value="shuklaVar">稳定性方差↑</option><option value="cv">变异系数↑</option><option value="idealScore">综合评分↓</option></select></div>'
      + '<div class="filter-group"><label>记录状态</label><select class="form-select form-select-sm" id="anStatus"><option value="">全部</option><option value="normal">仅正常</option><option value="abnormal">仅异常</option></select></div>'
      + '<button class="btn btn-primary btn-sm w-100" id="anRun"><i class="bi bi-arrow-repeat"></i> 重新计算</button>'
      + '<div class="mt-3 small text-muted-2" id="anMeta"></div>'
      + '</div></div>'
      + '<div class="col-lg-9"><div id="anResults"></div></div></div>');

    var $plan = $('#anPlan');
    DS.getTrialPlans({ year: state.currentYear }).forEach(function (p) { $plan.append('<option value="' + p.id + '"' + (p.id === plan.id ? ' selected' : '') + '>' + p.id + ' ' + p.cropName + '</option>'); });
    $('#anVarCount').text(varieties.length + '品种');
    run();

    $('#anRun,#anPlan,#anSort,#anStatus,#anLimit').on('change input', function () { run(); });

    function run() {
      var t0 = performance.now();
      var pid = $('#anPlan').val();
      var pl = DS.getTrialPlan(pid);
      if (!pl) return;
      var vs = pl.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
      var sts = pl.stationCodes.map(function (c) { return DS.getStation(c); }).filter(Boolean);
      var recs = DS.getRecords({ planId: pid });
      var summary = AE.multiPointSummary(recs, vs, sts);
      var anova = AE.anova(recs, vs, sts);
      var sortKey = $('#anSort').val();
      var limit = parseInt($('#anLimit').val(), 10);
      var rows = summary.rows.slice().sort(function (a, b) {
        if (sortKey === 'mean' || sortKey === 'idealScore') return b[sortKey] - a[sortKey];
        return a[sortKey] - b[sortKey];
      }).slice(0, limit);
      var ge = summary.ge;
      var dt = (performance.now() - t0).toFixed(0);

      $('#anMeta').html('<i class="bi bi-stopwatch"></i> 计算耗时 ' + dt + 'ms · ' + recs.length + ' 条记录');

      // 产量矩阵
      var matrixHead = '<tr><th>品种</th>' + sts.map(function (s) { return '<th>' + s.code + '</th>'; }).join('') + '<th>均值</th><th>CV%</th></tr>';
      var matrixRows = ge.genoIds.map(function (vid, i) {
        var cells = ge.matrix[i].map(function (v) { return '<td class="num">' + (v != null ? v.toFixed(1) : '<span class="text-danger">—</span>') + '</td>'; }).join('');
        return '<tr><td>' + esc(vs[i].code + ' ' + vs[i].name) + '</td>' + cells + '<td class="num"><b>' + ge.genoMeans[i].toFixed(1) + '</b></td><td class="num">' + summary.rows[i].cv + '</td></tr>';
      }).join('');

      // 稳定性排序表
      var rankRows = rows.map(function (r) {
        var idealBadge = r.idealScore >= 70 ? '<span class="badge-soft badge-gold">理想</span>' : (r.idealScore >= 55 ? '<span class="badge-soft badge-green">较优</span>' : '<span class="badge-soft badge-gray">一般</span>');
        return '<tr' + (r.idealScore >= 70 ? ' class="row-ideal"' : '') + '><td class="num">' + r.rank + '</td><td><b>' + esc(r.name) + '</b></td><td class="num">' + r.mean + '</td><td class="num">' + r.cv + '</td><td class="num">' + r.shuklaVar + '</td><td class="num">' + r.stabilityRank + '</td><td class="num">' + r.idealScore + '</td><td>' + idealBadge + '</td></tr>';
      }).join('');

      $('#anResults').html(''
        + '<div class="card mb-4"><div class="card-header"><i class="bi bi-table"></i> 品种×站点 产量矩阵 <span class="actions"><span class="badge-soft badge-gray">单位 ' + (DS.getCrop(pl.cropCode).unit) + '</span></span></div>'
        + '<div class="card-body p-0"><div class="table-wrap"><table class="table table-sm mb-0"><thead>' + matrixHead + '</thead><tbody>' + matrixRows + '</tbody></table></div></div></div>'

        + '<div class="row g-4"><div class="col-lg-7"><div class="card"><div class="card-header"><i class="bi bi-trophy"></i> 稳定性排序</div><div class="card-body p-0"><div class="table-wrap"><table class="table table-sm mb-0"><thead><tr><th>产量序</th><th>品种</th><th>均值</th><th>CV%</th><th>Shukla方差</th><th>稳定性序</th><th>综合评分</th><th>评级</th></tr></thead><tbody>' + rankRows + '</tbody></table></div></div></div></div>'
        + '<div class="col-lg-5"><div class="card h-100"><div class="card-header"><i class="bi bi-clipboard2-data"></i> 方差分析(ANOVA)</div><div class="card-body p-0"><div class="table-wrap"><table class="table table-sm mb-0"><thead><tr><th>变异来源</th><th>df</th><th>SS</th><th>MS</th><th>F</th><th>显著性</th></tr></thead><tbody>' + anova.rows.map(function (r) { return '<tr><td>' + r.source + '</td><td class="num">' + r.df + '</td><td class="num">' + r.ss + '</td><td class="num">' + r.ms + '</td><td class="num">' + (r.f || '—') + '</td><td>' + (r.sig || '') + '</td></tr>'; }).join('') + '</tbody></table></div><div class="p-3 small">总均值 <b class="num">' + anova.grandMean + '</b> ' + DS.getCrop(pl.cropCode).unit + ' · 误差CV <b class="num">' + anova.CV + '%</b></div></div></div></div></div>'
        + '</div>');
    }
  };

  /* ============================================================
     页面：GGE双标图
     ============================================================ */
  App.routes.gge = function ($main) {
    var state = getState();
    var plans = DS.getTrialPlans({ year: state.currentYear, crop: state.currentCrop });
    if (!plans.length) { $main.html(emptyPlan()); return; }
    var plan = plans[0];
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var stations = plan.stationCodes.map(function (c) { return DS.getStation(c); }).filter(Boolean);
    var records = DS.getRecords({ planId: plan.id });
    var t0 = performance.now();
    var gge = AE.ggeBiplot(records, varieties, stations, { components: 2 });
    var dt = (performance.now() - t0).toFixed(0);

    // 理想品种：高均值 + 靠近平均环境轴
    var idealList = gge.genoLabels.map(function (name, i) {
      var dist = Math.sqrt(gge.genoScores[i][0] * gge.genoScores[i][0] + (gge.genoScores[i][1] || 0) * (gge.genoScores[i][1] || 0));
      return { name: name, mean: gge.genoMeans[i], dist: dist, x: gge.genoScores[i][0], y: gge.genoScores[i][1] || 0 };
    }).sort(function (a, b) { return b.mean - a.mean; });

    $main.html(''
      + '<div class="page-head"><div><h1 class="page-title">GGE 双标图<small>基于品种×环境互作矩阵 PCA 分解 · 识别理想品种与代表性环境</small></h1></div>'
      + '<div class="crumb"><i class="bi bi-house"></i> 首页 <span class="sep">/</span> 分析评估 <span class="sep">/</span> GGE双标图</div></div>'
      + '<div class="row g-4"><div class="col-lg-3"><div class="filter-panel"><h6><i class="bi bi-diagram-3"></i> 双标图控制</h6>'
      + '<div class="filter-group"><label>主成分组合</label><select class="form-select form-select-sm" id="ggePC"><option value="0,1">PC1 × PC2</option><option value="0,2">PC1 × PC3</option><option value="1,2">PC2 × PC3</option></select></div>'
      + '<div class="filter-group"><label>显示模式</label><select class="form-select form-select-sm" id="ggeMode"><option value="all">品种+环境</option><option value="geno">仅品种</option><option value="env">仅环境</option></select></div>'
      + '<div class="mt-3"><div class="kpi-strip"><span class="legend-dot" style="background:#2b5530"></span> 品种 <span class="legend-dot ms-2" style="background:#c8902f"></span> 环境</div></div>'
      + '<div class="small text-muted-2 mt-3"><i class="bi bi-stopwatch"></i> PCA计算 ' + dt + 'ms<br/>PC1解释 ' + gge.explained[0] + '% · PC2 ' + gge.explained[1] + '%</div>'
      + '</div></div>'
      + '<div class="col-lg-6"><div class="chart-card"><div class="chart-head"><div class="chart-title"><i class="bi bi-diagram-3"></i> GGE双标图</div><span class="badge-soft badge-green">PC1 ' + gge.explained[0] + '%</span><span class="badge-soft badge-gold">PC2 ' + gge.explained[1] + '%</span></div><div class="chart-canvas-wrap square"><canvas id="ggeChart"></canvas></div></div></div>'
      + '<div class="col-lg-3"><div class="card h-100"><div class="card-header"><i class="bi bi-star"></i> 品种产量榜</div><div class="card-body p-0"><div class="table-wrap"><table class="table table-sm mb-0"><thead><tr><th>#</th><th>品种</th><th>均值</th></tr></thead><tbody>' + idealList.slice(0, 8).map(function (v, i) { return '<tr' + (i < 3 ? ' class="row-ideal"' : '') + '><td class="num">' + (i + 1) + '</td><td>' + esc(v.name) + '</td><td class="num">' + v.mean.toFixed(1) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div></div>'
      + '</div>'
      + '<div class="row g-4 mt-1"><div class="col-lg-6"><div class="chart-card"><div class="chart-head"><div class="chart-title"><i class="bi bi-bar-chart"></i> 主成分贡献率</div></div><div class="chart-canvas-wrap" style="height:240px;"><canvas id="ggePcaChart"></canvas></div></div></div>'
      + '<div class="col-lg-6"><div class="chart-card"><div class="chart-head"><div class="chart-title"><i class="bi bi-scatter-chart"></i> 环境表现散点</div></div><div class="chart-canvas-wrap" style="height:240px;"><canvas id="ggeEnvChart"></canvas></div></div></div></div>');

    renderBiplot(gge);
    CR.horizontalBar('ggePcaChart', { labels: gge.allExplained.slice(0, 8).map(function (_, i) { return 'PC' + (i + 1); }), values: gge.allExplained.slice(0, 8), unit: '%' });
    CR.yieldBar('ggeEnvChart', { labels: gge.envLabels, datasets: [{ label: '环境均值产量', values: gge.envMeanYield.map(function (v) { return Math.round(v * 10) / 10; }) }], unit: DS.getCrop(state.currentCrop).unit });

    $('#ggePC,#ggeMode').on('change', function () {
      var pcs = $('#ggePC').val().split(',').map(Number);
      var mode = $('#ggeMode').val();
      // 重新计算取指定PC
      var g = AE.ggeBiplot(records, varieties, stations, { components: Math.max.apply(null, pcs) + 1 });
      var newGge = {
        genoScores: g.genoScores.map(function (s) { return [s[pcs[0]], s[pcs[1]]]; }),
        envScores: g.envScores.map(function (s) { return [s[pcs[0]], s[pcs[1]]]; }),
        genoLabels: g.genoLabels, envLabels: g.envLabels, genoMeans: g.genoMeans,
        explained: [g.allExplained[pcs[0]], g.allExplained[pcs[1]]]
      };
      // 应用显示模式过滤
      if (mode === 'geno') newGge.envScores = [];
      if (mode === 'env') newGge.genoScores = [];
      renderBiplot(newGge);
      $('.chart-title').first().html('<i class="bi bi-diagram-3"></i> GGE双标图');
    });

    function renderBiplot(data) {
      CR.ggeBiplot('ggeChart', data);
    }
  };

  /* ============================================================
     页面：品种比较图表
     ============================================================ */
  App.routes.compare = function ($main) {
    var state = getState();
    var plans = DS.getTrialPlans({ year: state.currentYear, crop: state.currentCrop });
    if (!plans.length) { $main.html(emptyPlan()); return; }
    var plan = plans[0];
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var stations = plan.stationCodes.map(function (c) { return DS.getStation(c); }).filter(Boolean);
    var records = DS.getRecords({ planId: plan.id });
    var ge = AE.buildGEMatrix(records, varieties, stations);

    var selVarieties = {}; varieties.slice(0, 6).forEach(function (v) { selVarieties[v.id] = true; });
    var selStations = {}; stations.slice(0, 6).forEach(function (s) { selStations[s.code] = true; });
    var view = 'bar';
    var metric = 'muYield';

    $main.html(''
      + '<div class="page-head"><div><h1 class="page-title">品种比较图表<small>柱状图 · 折线图 · 雷达图多维对比 · 自定义品种组与站点筛选</small></h1></div>'
      + '<div class="crumb"><i class="bi bi-house"></i> 首页 <span class="sep">/</span> 分析评估 <span class="sep">/</span> 品种比较</div></div>'
      + '<div class="row g-4"><div class="col-lg-3"><div class="filter-panel"><h6><i class="bi bi-sliders"></i> 比较设置</h6>'
      + '<div class="filter-group"><label>图表视图</label><div class="view-tabs w-100"><button class="view-tab active" data-view="bar"><i class="bi bi-bar-chart"></i> 柱状</button><button class="view-tab" data-view="line"><i class="bi bi-graph-up"></i> 折线</button><button class="view-tab" data-view="radar"><i class="bi bi-broadcast"></i> 雷达</button></div></div>'
      + '<div class="filter-group"><label>对比品种 <span class="hint" id="cmpVarCount"></span></label><div class="chip-group" id="cmpVarieties"></div></div>'
      + (view === 'radar' ? '' : '<div class="filter-group"><label>站点筛选 <span class="hint" id="cmpStaCount"></span></label><div class="chip-group" id="cmpStations"></div></div>')
      + '<div class="filter-group"><label>雷达图指标</label><select class="form-select form-select-sm" id="cmpMetric"><option value="mean">产量均值</option><option value="agronomic">农艺性状(归一化)</option><option value="resistance">抗性指标(归一化)</option></select></div>'
      + '<button class="btn btn-primary btn-sm w-100" id="cmpRun"><i class="bi bi-arrow-repeat"></i> 刷新图表</button>'
      + '</div></div>'
      + '<div class="col-lg-9"><div class="chart-card"><div class="chart-head"><div class="chart-title" id="cmpTitle"><i class="bi bi-bar-chart"></i> 产量柱状对比</div><span class="badge-soft badge-gold" id="cmpSub"></span></div><div class="chart-canvas-wrap tall"><canvas id="cmpChart"></canvas></div><div class="small text-muted-2 mt-2" id="cmpNote"></div></div></div></div>');

    renderChips();
    $('#cmpVarCount').text(Object.keys(selVarieties).filter(function (k) { return selVarieties[k]; }).length + '/' + varieties.length);
    run();

    function renderChips() {
      var $v = $('#cmpVarieties').empty();
      varieties.forEach(function (v) { $v.append('<span class="chip' + (selVarieties[v.id] ? ' active' : '') + '" data-vid="' + v.id + '">' + v.code + ' ' + v.name + '</span>'); });
      var $s = $('#cmpStations');
      if ($s.length) { $s.empty(); stations.forEach(function (s) { $s.append('<span class="chip' + (selStations[s.code] ? ' active' : '') + '" data-scode="' + s.code + '">' + s.code + '</span>'); }); $('#cmpStaCount').text(Object.keys(selStations).filter(function (k) { return selStations[k]; }).length + '/' + stations.length); }
    }
    $(document).off('click.cmp').on('click.cmp', '#cmpVarieties .chip, #cmpStations .chip', function () {
      var $el = $(this); $el.toggleClass('active');
      if ($el.data('vid')) selVarieties[$el.data('vid')] = $el.hasClass('active');
      if ($el.data('scode')) selStations[$el.data('scode')] = $el.hasClass('active');
      $('#cmpVarCount').text(Object.keys(selVarieties).filter(function (k) { return selVarieties[k]; }).length + '/' + varieties.length);
      var $sc = $('#cmpStaCount'); if ($sc.length) $sc.text(Object.keys(selStations).filter(function (k) { return selStations[k]; }).length + '/' + stations.length);
    });
    $('#cmpRun,#cmpMetric').on('change click', function () { run(); });
    $('.view-tab').on('click', function () { $('.view-tab').removeClass('active'); $(this).addClass('active'); view = $(this).data('view'); run(); });

    function run() {
      var vSel = varieties.filter(function (v) { return selVarieties[v.id]; });
      var sSel = stations.filter(function (s) { return selStations[s.code]; });
      if (!vSel.length) { App.toast('warn', '请选择品种', '至少选择1个对比品种'); return; }
      var cropUnit = DS.getCrop(state.currentCrop).unit;
      var titleMap = { bar: '产量柱状对比', line: '品种跨站点表现', radar: '多维雷达对比' };
      $('#cmpTitle').html('<i class="bi bi-' + (view === 'bar' ? 'bar-chart' : view === 'line' ? 'graph-up' : 'broadcast') + '"></i> ' + titleMap[view]);
      $('#cmpSub').text(vSel.length + '品种' + (view === 'radar' ? '' : ' · ' + sSel.length + '站点'));

      if (view === 'bar') {
        var ds = [{ label: '亩产均值', values: vSel.map(function (v) { var idx = ge.genoIds.indexOf(v.id); return Math.round(ge.genoMeans[idx] * 10) / 10; }) }];
        $('#cmpNote').text('柱状图展示各参试品种的跨站点平均亩产对比，数值为' + sSel.length + '站点均值。');
        CR.yieldBar('cmpChart', { labels: vSel.map(function (v) { return v.code + ' ' + v.name; }), datasets: ds, unit: cropUnit });
      } else if (view === 'line') {
        var dsLine = vSel.map(function (v, i) {
          var vi = ge.genoIds.indexOf(v.id);
          return { label: v.name, values: sSel.map(function (s) { var sj = ge.envCodes.indexOf(s.code); return ge.matrix[vi][sj] != null ? Math.round(ge.matrix[vi][sj] * 10) / 10 : null; }) };
        });
        $('#cmpNote').text('折线图展示各品种在' + sSel.length + '个站点的产量走势，用于识别品种的环境响应模式。');
        CR.yieldLine('cmpChart', { labels: sSel.map(function (s) { return s.code; }), datasets: dsLine, unit: cropUnit, fill: false });
      } else {
        // 雷达图
        var metric = $('#cmpMetric').val();
        var labels, datasets;
        if (metric === 'mean') {
          labels = sSel.map(function (s) { return s.name; });
          datasets = vSel.map(function (v) { var vi = ge.genoIds.indexOf(v.id); return { label: v.name, values: sSel.map(function (s) { var sj = ge.envCodes.indexOf(s.code); return ge.matrix[vi][sj] != null ? Math.round(ge.matrix[vi][sj] * 10) / 10 : 0; }) }; });
        } else {
          var defs = metric === 'agronomic' ? DS.AGRONOMIC_TRAITS : DS.RESISTANCE_DEFS;
          labels = defs.map(function (d) { return d.label; });
          // 归一化
          var recs = DS.getRecords({ planId: plan.id });
          var ranges = defs.map(function (d) { var vals = recs.map(function (r) { return metric === 'agronomic' ? r.agronomic[d.key] : r.resistance[d.key]; }).filter(function (x) { return x != null; }); return [Math.min.apply(null, vals), Math.max.apply(null, vals)]; });
          datasets = vSel.map(function (v) {
            var vrecs = recs.filter(function (r) { return r.varietyId === v.id; });
            return { label: v.name, values: defs.map(function (d, di) { var vals = vrecs.map(function (r) { return metric === 'agronomic' ? r.agronomic[d.key] : r.resistance[d.key]; }).filter(function (x) { return x != null; }); var m = AE.mean(vals); var r0 = ranges[di]; return r0[1] > r0[0] ? Math.round((m - r0[0]) / (r0[1] - r0[0]) * 100) : 50; }) };
          });
        }
        $('#cmpNote').text('雷达图' + (metric === 'mean' ? '展示各品种在多站点的产量多维对比' : (metric === 'agronomic' ? '展示12项农艺性状的归一化对比' : '展示抗性指标的归一化对比')) + '。');
        CR.radarCompare('cmpChart', { labels: labels, datasets: datasets, unit: metric === 'mean' ? cropUnit : '' });
      }
    }
  };

  /* ============================================================
     页面：审定报告生成
     ============================================================ */
  App.routes.reports = function ($main) {
    var state = getState();
    var plans = DS.getTrialPlans({ year: state.currentYear, crop: state.currentCrop });
    if (!plans.length) { $main.html(emptyPlan()); return; }
    var plan = plans[0];
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var firstVid = varieties.length ? varieties[0].id : null;

    $main.html(''
      + '<div class="page-head"><div><h1 class="page-title">审定报告生成<small>按品种自动填充产量摘要、稳定性评价、适应区域建议 · 一键导出</small></h1></div>'
      + '<div class="crumb"><i class="bi bi-house"></i> 首页 <span class="sep">/</span> 审定输出 <span class="sep">/</span> 审定报告</div></div>'
      + '<div class="row g-4"><div class="col-lg-4"><div class="card"><div class="card-header"><i class="bi bi-list-check"></i> 品种选择</div><div class="card-body" style="max-height:680px;overflow-y:auto">'
      + '<div class="list-group list-group-flush" id="rpList"></div>'
      + '</div></div></div>'
      + '<div class="col-lg-5"><div class="report-preview" id="rpPreview"></div></div>'
      + '<div class="col-lg-3"><div class="card"><div class="card-header"><i class="bi bi-download"></i> 导出与意见</div><div class="card-body" id="rpExport"></div></div></div></div>');

    var $list = $('#rpList').empty();
    varieties.forEach(function (v) {
      $list.append('<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center' + (v.id === firstVid ? ' active' : '') + '" data-vid="' + v.id + '"><div><div class="fw-semibold">' + esc(v.name) + '</div><div class="small text-muted-2">' + v.code + ' · ' + v.source + '</div></div>' + (v.isControl ? '<span class="badge-soft badge-gold">对照</span>' : '') + '</button>');
    });
    show(firstVid);

    $(document).off('click.rp').on('click.rp', '#rpList .list-group-item', function () {
      $('#rpList .list-group-item').removeClass('active'); $(this).addClass('active');
      show($(this).data('vid'));
    });

    function show(vid) {
      var data = RG.buildReportData(vid, state);
      if (!data) { $('#rpPreview').html('<div class="empty-state"><i class="bi bi-exclamation-circle"></i><h5>数据不足</h5><p>无法生成报告</p></div>'); return; }
      $('#rpPreview').html(RG.renderReportHTML(data));
      var v = data.verdict;
      var lvlMap = { green: 'badge-green', gold: 'badge-gold', warn: 'badge-warn' };
      $('#rpExport').html(''
        + '<div class="mb-3"><div class="small text-muted-2 mb-1">审定结论</div><span class="badge-soft ' + (lvlMap[v.level] || 'badge-gray') + '">' + v.conclusion + '</span></div>'
        + '<div class="mb-3"><div class="small text-muted-2 mb-1">较对照</div><div class="num" style="font-size:18px;color:' + (v.diffPct >= 0 ? 'var(--ok-600)' : 'var(--warn-600)') + '">' + (v.diffPct >= 0 ? '+' : '') + v.diffPct + '%</div></div>'
        + '<div class="mb-3"><div class="small text-muted-2 mb-1">产量均值</div><div class="num" style="font-size:18px;color:var(--green-800)">' + data.row.mean + ' ' + data.crop.unit + '</div></div>'
        + '<div class="mb-3"><label class="form-label">审定意见(可编辑)</label><textarea class="form-control" id="rpOpinion" rows="4">' + v.yield + '；' + v.stability + '；' + v.adapt + '。结论：' + v.conclusion + '。</textarea></div>'
        + '<div class="d-grid gap-2">'
        + '<button class="btn btn-gold" id="rpPrint"><i class="bi bi-printer"></i> 导出PDF审定书</button>'
        + '<button class="btn btn-outline-green" onclick="ReportGenerator.exportDataTablePDF()"><i class="bi bi-file-pdf"></i> 数值表PDF</button>'
        + '<button class="btn btn-outline-gold" onclick="ReportGenerator.exportExcel()"><i class="bi bi-file-earmark-excel"></i> Excel汇总表</button>'
        + '</div>');
      $('#rpPrint').on('click', function () { RG.printReport(data); });
    }
  };

  /* ============================================================
     页面：数据校验
     ============================================================ */
  App.routes.validation = function ($main) {
    var state = getState();
    var plans = DS.getTrialPlans({ year: state.currentYear, crop: state.currentCrop });
    if (!plans.length) { $main.html(emptyPlan()); return; }
    var plan = plans[0];
    var issues = DS.getValidationIssues({ planId: plan.id });
    var missing = DS.getMissingPlots(plan.id);
    var grouped = { missing: [], extreme: [], logic: [] };
    issues.forEach(function (i) { (grouped[i.type] = grouped[i.type] || []).push(i); });

    $main.html(''
      + '<div class="page-head"><div><h1 class="page-title">数据校验异常标注<small>检测缺失小区、极端值、逻辑矛盾 · 异常数据红色标记提示修正</small></h1></div>'
      + '<div class="crumb"><i class="bi bi-house"></i> 首页 <span class="sep">/</span> 试验管理 <span class="sep">/</span> 数据校验</div></div>'
      + '<div class="stat-grid mb-4">'
      + statCard('bi-exclamation-octagon', '缺失小区', missing.length, '个', '需补录数据', missing.length ? 'warn' : '')
      + statCard('bi-graph-down-arrow', '极端值', grouped.extreme.length, '项', '超出合理范围', grouped.extreme.length ? 'warn' : '')
      + statCard('bi-arrow-left-right', '逻辑矛盾', grouped.logic.length, '项', '物候/数值矛盾', grouped.logic.length ? 'warn' : '')
      + statCard('bi-check-circle', '正常记录', DS.getRecords({ planId: plan.id }).filter(function (r) { return r.status === 'normal'; }).length, '条', '通过校验', '')
      + '</div>'
      + '<div class="row g-4"><div class="col-lg-7"><div class="card"><div class="card-header"><i class="bi bi-list-check"></i> 异常清单 <span class="actions"><button class="btn btn-sm btn-outline-gold" onclick="ReportGenerator.exportExcel()"><i class="bi bi-download"></i> 导出</button></span></div><div class="card-body" id="vdIssues"></div></div></div>'
      + '<div class="col-lg-5"><div class="card"><div class="card-header"><i class="bi bi-clipboard-x"></i> 缺失小区</div><div class="card-body" id="vdMissing"></div></div></div></div>');

    var $iss = $('#vdIssues');
    if (!issues.length) {
      $iss.html('<div class="empty-state"><i class="bi bi-check-circle"></i><h5>数据校验通过</h5><p>当前方案未发现异常数据</p></div>');
    } else {
      var html = '';
      [['missing', '缺失数据', 'bi-exclamation-octagon', 'high'], ['extreme', '极端值', 'bi-graph-down-arrow', 'mid'], ['logic', '逻辑矛盾', 'bi-arrow-left-right', 'high']].forEach(function (g) {
        var list = grouped[g[0]] || [];
        if (!list.length) return;
        html += '<div class="divider-text"><i class="bi ' + g[2] + '"></i> ' + g[1] + ' (' + list.length + ')</div>';
        list.forEach(function (iss) {
          html += '<div class="issue-card sev-' + (iss.severity || g[3]) + '"><i class="bi ' + g[2] + ' issue-ico"></i><div class="issue-body"><div class="issue-title">' + esc(iss.msg) + '</div><div class="issue-desc">' + esc(iss.recordLabel || '') + ' · 字段: ' + (iss.field || '—') + '</div></div><button class="btn btn-sm btn-outline-green" onclick="App.editRecord(\'' + iss.recordId + '\')"><i class="bi bi-pencil"></i> 修正</button></div>';
        });
      });
      $iss.html(html);
    }

    var $ms = $('#vdMissing');
    if (!missing.length) {
      $ms.html('<div class="empty-state" style="padding:30px;"><i class="bi bi-check2-circle"></i><h5>小区数据完整</h5><p>所有品种×站点×重复均已录入</p></div>');
    } else {
      var mhtml = '<div class="small text-muted-2 mb-2">共 ' + missing.length + ' 个小区未录入：</div>';
      missing.slice(0, 50).forEach(function (m) {
        var v = DS.getVariety(m.varietyId); var s = DS.getStation(m.stationCode);
        mhtml += '<div class="issue-card sev-low"><i class="bi bi-plus-circle issue-ico"></i><div class="issue-body"><div class="issue-title">' + (v ? esc(v.name) : m.varietyId) + ' · ' + (s ? s.code : m.stationCode) + ' · 重复' + m.replication + '</div><div class="issue-desc">缺失小区待补录</div></div></div>';
      });
      if (missing.length > 50) mhtml += '<div class="small text-muted-2 mt-2">…还有 ' + (missing.length - 50) + ' 项</div>';
      $ms.html(mhtml);
    }
  };

  App.editRecord = function (rid) {
    var rec = DS.getRecord(rid);
    if (!rec) return;
    DS.setState({ currentCrop: rec.cropCode, currentYear: rec.year });
    App.refreshChrome();
    location.hash = '#/data-entry';
    setTimeout(function () { TF.render('#tfHost', { record: rec.id }); }, 100);
  };

  function emptyPlan() {
    return '<div class="page-head"><div><h1 class="page-title">提示</h1></div></div><div class="empty-state"><i class="bi bi-clipboard-plus"></i><h5>当前年度/作物无试验方案</h5><p>请先到「方案配置」创建方案，或切换作物/年度</p><button class="btn btn-primary" onclick="App.navigate(\'#/trials\')"><i class="bi bi-arrow-right"></i> 前往方案配置</button></div>';
  }

  /* ---------- 启动 ---------- */
  $(function () {
    DS.init();
    App.refreshChrome();
    App.bindGlobal();
    if (!location.hash) location.hash = '#/dashboard';
    App.route();
    setTimeout(function () { $('#app-boot').addClass('done'); }, 600);
    DS.onChange(function (evt) { if (evt.type === 'state' || evt.type === 'reset') App.refreshChrome(); });
  });

  global.App = App;
})(window);
