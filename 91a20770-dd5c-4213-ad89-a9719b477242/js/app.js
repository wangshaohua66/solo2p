/* app.js — 应用初始化、全局状态、布局壳与路由注册 */
(function (global) {
  "use strict";

  var NAV = [
    { group: "运营管理", items: [{ path: "/dashboard", label: "工作台", icon: "bi-speedometer2" }] },
    { group: "业务模块", items: [
      { path: "/optometry", label: "验光管理", icon: "bi-clipboard2-pulse" },
      { path: "/inventory", label: "库存管理", icon: "bi-box-seam" },
      { path: "/processing", label: "加工追踪", icon: "bi-diagram-3" },
      { path: "/schedule", label: "排班管理", icon: "bi-calendar3-week" },
      { path: "/member", label: "会员营销", icon: "bi-award" }
    ]},
    { group: "数据分析", items: [{ path: "/reports", label: "数据报表", icon: "bi-bar-chart-line" }] }
  ];

  var TITLE_MAP = {
    "/dashboard": "工作台", "/optometry": "验光管理", "/inventory": "库存管理",
    "/processing": "加工追踪", "/schedule": "排班管理", "/member": "会员营销", "/reports": "数据报表"
  };

  var App = {
    renderSidebar: function () {
      var html = "";
      NAV.forEach(function (g) {
        html += '<div class="nav-group-label">' + g.group + "</div>";
        g.items.forEach(function (it) {
          html += '<a class="nav-item" data-path="' + it.path + '" href="#' + it.path + '"><i class="bi ' + it.icon + '"></i><span>' + it.label + "</span></a>";
        });
      });
      $("#sidebarNav").html(html);
      App.updateActiveNav();
    },

    updateActiveNav: function () {
      var path = Router.current() || "/dashboard";
      var base = "/" + (path.replace(/^\//, "").split("/")[0] || "dashboard");
      $("#sidebarNav .nav-item").removeClass("active");
      $("#sidebarNav .nav-item").each(function () {
        var p = $(this).data("path");
        if (p === path || p === base) $(this).addClass("active");
      });
      var title = TITLE_MAP[base] || "明视眼镜";
      $("#topbarTitle").text(path.indexOf("/new") > -1 ? "新增验光记录" : path.indexOf("/transfer") > -1 ? "调拨中心" : title);
    },

    renderTopbar: function () {
      var now = new Date();
      var week = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
      $("#topbarDate").html('<i class="bi bi-calendar3 me-1 text-teal-soft"></i>' + now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日 周" + week);
    },

    renderStoreSwitcher: function () {
      var stores = Store.allStores();
      var cur = Store.currentStoreId();
      var html = stores.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === cur ? " selected" : "") + ">" + UI.escape(s.name) + "</option>";
      }).join("");
      $("#storeSwitcher").html(html);
    },

    renderQuickPanel: function () {
      var sid = Store.currentStoreId();
      var orders = Store.query("orders", function (o) { return o.storeId === sid; });
      var today = new Date().toISOString().slice(0, 10);
      var todayOrders = orders.filter(function (o) { return new Date(o.createdAt).toISOString().slice(0, 10) === today; });
      var pendingOrders = orders.filter(function (o) { return o.status !== "delivered"; });
      var overdue = pendingOrders.filter(function (o) {
        var last = o.timeline[o.timeline.length - 1];
        return last && (Date.now() - last.time > 24 * 3600000);
      });

      var frames = Store.query("inventory_frames", function (f) { return f.storeId === sid; });
      var lenses = Store.query("inventory_lenses", function (l) { return l.storeId === sid; });
      var lowStock = frames.concat(lenses).filter(function (it) { return it.stock <= it.minStock; });

      var transfers = Store.query("transfers", function (t) { return t.toStoreId === sid && t.status === "pending"; });
      var promos = Store.query("promotions", function (p) { return p.status === "active"; });
      var notifications = Store.get("notify") || [];

      var todoCount = pendingOrders.length + transfers.length;
      $("#notifyDot").toggleClass("show", todoCount > 0 || lowStock.length > 0);

      var html = "";

      html += '<div class="aside-section"><div class="aside-section-title"><i class="bi bi-list-check text-teal"></i>今日待办';
      if (todoCount) html += '<span class="badge bg-soft-warn ms-auto">' + todoCount + "</span>";
      html += "</div>";
      var todoItems = [
        { icon: "bi-box-arrow-in-down", type: "info", title: "待加工订单", count: pendingOrders.length, path: "/processing" },
        { icon: "bi-exclamation-octagon", type: "danger", title: "超时未交付", count: overdue.length, path: "/processing" },
        { icon: "bi-arrow-left-right", type: "warn", title: "待确认调拨", count: transfers.length, path: "/inventory/transfer" },
        { icon: "bi-graph-up", type: "teal", title: "今日新增订单", count: todayOrders.length, path: "/processing" }
      ];
      todoItems.forEach(function (t) {
        var cls = "bg-soft-" + t.type;
        html += '<div class="notify-item" data-go="' + t.path + '"><div class="ni-icon ' + cls + '"><i class="bi ' + t.icon + '"></i></div>';
        html += '<div class="ni-body"><div class="ni-title">' + t.title + '</div><div class="ni-time">' + t.count + " 项</div></div></div>";
      });
      html += "</div>";

      html += '<div class="aside-section"><div class="aside-section-title"><i class="bi bi-exclamation-triangle text-warning"></i>库存预警';
      if (lowStock.length) html += '<span class="badge bg-soft-danger ms-auto">' + lowStock.length + "</span>";
      html += "</div>";
      if (!lowStock.length) { html += '<div class="text-muted small py-2">暂无预警，库存充足</div>'; }
      else {
        lowStock.slice(0, 6).forEach(function (it) {
          var name = it.brand ? it.brand + " " + it.model : it.refractiveIndex + " " + it.functionType;
          html += '<div class="notify-item" data-go="/inventory"><div class="ni-icon bg-soft-danger"><i class="bi bi-box-seam"></i></div>';
          html += '<div class="ni-body"><div class="ni-title">' + UI.escape(name) + '</div><div class="ni-time">余 ' + it.stock + " / 安全线 " + it.minStock + "</div></div></div>";
        });
        if (lowStock.length > 6) html += '<div class="text-muted small text-center pt-1">还有 ' + (lowStock.length - 6) + " 项…</div>";
      }
      html += "</div>";

      html += '<div class="aside-section"><div class="aside-section-title"><i class="bi bi-megaphone text-teal"></i>进行中促销';
      html += '<span class="badge bg-soft-success ms-auto">' + promos.length + "</span></div>";
      promos.forEach(function (p) {
        html += '<div class="notify-item"><div class="ni-icon bg-soft-success"><i class="bi bi-tag-fill"></i></div>';
        html += '<div class="ni-body"><div class="ni-title">' + UI.escape(p.name) + '</div><div class="ni-time">' + UI.escape(p.desc) + " · 至 " + p.end + "</div></div></div>";
      });
      html += "</div>";

      html += '<div class="aside-section"><div class="aside-section-title"><i class="bi bi-bell text-teal"></i>系统通知</div>';
      notifications.forEach(function (n) {
        html += '<div class="notify-item"><div class="ni-icon bg-soft-' + n.type + '"><i class="bi ' + n.icon + '"></i></div>';
        html += '<div class="ni-body"><div class="ni-title">' + UI.escape(n.title) + '</div><div class="ni-time">' + UI.escape(n.body) + " · " + UI.fromNow(n.time) + "</div></div></div>";
      });
      html += "</div>";

      $("#quickPanel").html(html);
      $("#quickPanel .notify-item[data-go]").on("click", function () {
        Router.go($(this).data("go"));
        if (window.innerWidth < 1200) $("#appAside").removeClass("show");
      });
    },

    bindEvents: function () {
      $("#sidebarToggle").on("click", function () {
        $("#appSidebar").toggleClass("show");
        $("#appOverlay").toggleClass("show");
      });
      $("#asideToggle").on("click", function () {
        $("#appAside").toggleClass("show");
        $("#appOverlay").toggleClass("show");
      });
      $("#asideClose").on("click", function () {
        $("#appAside").removeClass("show");
        $("#appOverlay").removeClass("show");
      });
      $("#appOverlay").on("click", function () {
        $("#appSidebar").removeClass("show");
        $("#appAside").removeClass("show");
        $("#appOverlay").removeClass("show");
      });
      $("#storeSwitcher").on("change", function () {
        Store.switchStore($(this).val());
        App.renderQuickPanel();
        var cur = Router.current();
        Router._dispatch(cur, true);
        UI.toast("已切换至 " + Store.currentStore().name, "info");
      });
      Router.on("change", function () { App.updateActiveNav(); });
    },

    registerRoutes: function () {
      Router.register("/dashboard", function () { Dashboard.render(); });
      Router.register("/optometry", function () { Optometry.renderList(); });
      Router.register("/optometry/new", function () { Optometry.renderForm(); });
      Router.register("/optometry/:id", function (p) { Optometry.renderDetail(p.id); });
      Router.register("/inventory", function () { Inventory.render(); });
      Router.register("/inventory/transfer", function () { Inventory.renderTransfer(); });
      Router.register("/processing", function () { Processing.renderList(); });
      Router.register("/processing/:id", function (p) { Processing.renderDetail(p.id); });
      Router.register("/schedule", function () { Schedule.render(); });
      Router.register("/member", function () { Member.render(); });
      Router.register("/reports", function () { Reports.render(); });
    },

    init: function () {
      Store.initSeed();
      App.renderSidebar();
      App.renderTopbar();
      App.renderStoreSwitcher();
      App.renderQuickPanel();
      App.bindEvents();
      App.registerRoutes();
      Router.start();
    }
  };

  global.App = App;
  $(function () { App.init(); });
})(window);
