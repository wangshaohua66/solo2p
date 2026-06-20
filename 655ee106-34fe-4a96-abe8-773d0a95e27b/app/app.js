/* ==========================================================================
   app/app.js — 应用入口
   初始化数据、构建导航、注册路由、管理全局状态栏（顶部KPI/预警/存储）
   ========================================================================== */
(function (global) {
  'use strict';
  var App = global.App = global.App || {};
  App.Store = { currentProjectId: null, currentModule: null };

  var NAV = [
    { hash: '#/dashboard', label: '项目看板', icon: 'bi-grid-1x2-fill', sub: 'PROJECT DASHBOARD', module: 'dashboard' },
    { hash: '#/gantt', label: '任务甘特图', icon: 'bi-bar-chart-steps', sub: 'TASK GANTT', module: 'gantt' },
    { hash: '#/resource', label: '资源排程', icon: 'bi-people-fill', sub: 'RESOURCE SCHEDULE', module: 'resource' },
    { hash: '#/progress', label: '进度填报', icon: 'bi-clipboard-check-fill', sub: 'PROGRESS FILL', module: 'progressFill' },
    { hash: '#/warning', label: '预警中心', icon: 'bi-bell-fill', sub: 'WARNING CENTER', module: 'warning', badge: true },
    { hash: '#/report', label: '进度汇报', icon: 'bi-file-earmark-bar-graph-fill', sub: 'PROGRESS REPORT', module: 'report' },
    { hash: '#/change', label: '变更管理', icon: 'bi-file-earmark-diff', sub: 'CHANGE MANAGEMENT', module: 'change' },
    { hash: '#/analytics', label: '统计分析', icon: 'bi-graph-up-arrow', sub: 'ANALYTICS', module: 'analytics' }
  ];

  function buildNav() {
    var html = '<div class="brand"><div class="logo"><i class="bi bi-bricks"></i></div>' +
      '<div><div class="title">施工进度管控</div><div class="sub">CONSTRUCTION OS</div></div></div>' +
      '<div class="nav-section"><div class="nav-label">业务导航</div>';
    NAV.forEach(function (n) {
      html += '<a class="nav-link-app" data-hash="' + n.hash + '"' + (n.badge ? ' data-badge="1"' : '') + '>' +
        '<i class="bi ' + n.icon + '"></i><span class="lbl">' + n.label + '</span>' +
        (n.badge ? '<span class="nav-badge dim">0</span>' : '') + '</a>';
    });
    html += '</div>';
    html += '<div class="sidebar-foot">' +
      '<div class="d-flex justify-content-between align-items-center"><span>本地存储</span><span class="mono storage-text">0 / 10 MB</span></div>' +
      '<div class="storage-bar"><span style="width:0%"></span></div>' +
      '<div class="mt-2 text-muted-2" style="font-size:10px">支持离线操作 · 数据本地持久化</div>' +
      '</div>';
    $('#sidebar').html(html);
    $('#sidebar').on('click', '.nav-link-app', function (e) { e.preventDefault(); App.Router.navigate($(this).data('hash')); });
  }

  function buildTopbar() {
    $('#topbar').html(
      '<button class="hamburger" id="hamburger"><i class="bi bi-list"></i></button>' +
      '<div class="crumb"><i class="bi bi-house-door text-amber"></i><div><div class="page-title" id="top-title">项目看板</div><div class="page-sub" id="top-sub">PROJECT DASHBOARD</div></div></div>' +
      '<div class="topbar-right">' +
      '<span class="kpi-chip"><i class="bi bi-buildings text-blue"></i><span>项目</span><span class="v" id="kpi-proj-v">0</span></span>' +
      '<span class="kpi-chip warn"><i class="bi bi-exclamation-octagon"></i><span>高风险</span><span class="v" id="kpi-high-v">0</span></span>' +
      '<span class="kpi-chip warn"><i class="bi bi-bell"></i><span>预警</span><span class="v" id="kpi-warn-v">0</span></span>' +
      '<div class="dropdown"><button class="btn btn-ghost btn-sm-icon" data-bs-toggle="dropdown"><i class="bi bi-gear"></i></button>' +
      '<ul class="dropdown-menu dropdown-menu-end">' +
      '<li><a class="dropdown-item" id="act-export"><i class="bi bi-download me-2"></i>导出数据备份</a></li>' +
      '<li><a class="dropdown-item" id="act-import"><i class="bi bi-upload me-2"></i>导入恢复数据</a></li>' +
      '<li><hr class="dropdown-divider"></li>' +
      '<li><a class="dropdown-item" id="act-reset"><i class="bi bi-arrow-counterclockwise me-2"></i>重置演示数据</a></li>' +
      '</ul></div>' +
      '</div>'
    );
  }

  function refreshChrome() {
    var DS = App.DataService;
    var data = DS.load();
    var warns = DS.getWarnings(null, '待处理');
    var projs = data.projects;
    var high = projs.filter(function (p) { return p.riskLevel === '高'; }).length;
    $('#kpi-proj-v').text(projs.length);
    $('#kpi-high-v').text(high).parent().toggleClass('warn', !!high);
    $('#kpi-warn-v').text(warns.length).parent().toggleClass('warn', !!warns.length);
    $('.nav-link-app[data-badge="1"] .nav-badge').text(warns.length).toggleClass('dim', !warns.length);
    var u = DS.getStorageUsage();
    $('.storage-bar span').css('width', Math.min(100, u.mb / 10 * 100) + '%');
    $('.storage-text').text(u.mb + ' / 10 MB');
  }
  App.refreshChrome = refreshChrome;

  App.setProject = function (id) { App.Store.currentProjectId = id; };

  App.renderRoute = function (route, hash, $main) {
    if (App.Store.currentModule && typeof App.Store.currentModule.destroy === 'function') {
      try { App.Store.currentModule.destroy(); } catch (e) {}
    }
    $('.nav-link-app').removeClass('active');
    $('.nav-link-app[data-hash="' + hash + '"]').addClass('active');
    $('#top-title').text(route.title || '');
    $('#top-sub').text(route.sub || '');
    App.Store.currentModule = route.module;
    $('.sidebar').removeClass('open');
    $('.backdrop-nav').removeClass('show');
    route.render($main);
    refreshChrome();
    $main[0].scrollTop = 0;
  };

  function registerRoutes() {
    NAV.forEach(function (n) {
      var mod = App.Modules[n.module];
      App.Router.register(n.hash, { title: n.label, sub: n.sub, icon: n.icon, module: mod, render: mod.render });
    });
  }

  function bindGlobals() {
    $('#hamburger').on('click', function () { $('#sidebar').addClass('open'); $('.backdrop-nav').addClass('show'); });
    $('.backdrop-nav').on('click', function () { $('#sidebar').removeClass('open'); $(this).removeClass('show'); });
    $('#act-export').on('click', function () { App.DataService.exportJSON(); App.UI.toast('数据已导出备份', 'success'); });
    $('#act-import').on('click', function () { $('#import-file').trigger('click'); });
    $('#import-file').on('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      App.DataService.importJSON(f, function () {
        App.UI.toast('数据已恢复，正在刷新', 'success');
        setTimeout(function () { location.reload(); }, 800);
      }, function (err) { App.UI.toast('导入失败：' + err.message, 'error'); });
      e.target.value = '';
    });
    $('#act-reset').on('click', function () {
      App.UI.confirm({ title: '重置演示数据', message: '将清除当前所有数据并重新生成演示数据，此操作不可恢复。', okText: '确认重置' }, function () {
        App.DataService.reset();
        App.UI.toast('已重置为演示数据', 'success');
        setTimeout(function () { location.reload(); }, 600);
      });
    });
  }

  function init() {
    App.DataService.load();
    buildNav();
    buildTopbar();
    registerRoutes();
    bindGlobals();
    refreshChrome();
    App.Router.start();
  }

  $(init);
})(window);
