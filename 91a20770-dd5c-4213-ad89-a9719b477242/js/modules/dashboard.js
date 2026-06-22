/* dashboard.js — 工作台首页：指标卡片 + 近期订单 + 加工状态分布 + 周趋势 */
(function (global) {
  "use strict";

  var Dashboard = {
    chart: null,
    render: function () {
      var sid = Store.currentStoreId();
      var store = Store.currentStore();
      var today = new Date().toISOString().slice(0, 10);
      var now = Date.now();

      var orders = Store.query("orders", function (o) { return o.storeId === sid; });
      var optometry = Store.query("optometry", function (o) { return o.storeId === sid; });
      var frames = Store.query("inventory_frames", function (f) { return f.storeId === sid; });
      var lenses = Store.query("inventory_lenses", function (l) { return l.storeId === sid; });
      var techs = Store.query("technicians", function (t) { return t.storeId === sid; });

      var todayOrders = orders.filter(function (o) { return new Date(o.createdAt).toISOString().slice(0, 10) === today; });
      var todayOpt = optometry.filter(function (o) { return o.date === today; });
      var monthOrders = orders.filter(function (o) { return new Date(o.createdAt).toISOString().slice(0, 7) === today.slice(0, 7); });
      var monthSales = monthOrders.reduce(function (s, o) { return s + (o.finalAmount || o.amount || 0); }, 0);
      var avgOrder = monthOrders.length ? Math.round(monthSales / monthOrders.length) : 0;
      var pendingCount = orders.filter(function (o) { return o.status !== "delivered"; }).length;
      var lowStock = frames.concat(lenses).filter(function (it) { return it.stock <= it.minStock; }).length;

      var metrics = [
        { icon: "bi-people-fill", bg: "bg-soft-teal", label: "今日客流量", value: todayOpt.length, trend: "+12%", up: true, sub: "验光到店" },
        { icon: "bi-clipboard2-pulse", bg: "bg-soft-info", label: "今日验光量", value: todayOpt.length, trend: "+8%", up: true, sub: "完成建档" },
        { icon: "bi-bag-check-fill", bg: "bg-soft-purple", label: "今日配镜量", value: todayOrders.length, trend: "+5%", up: true, sub: "新增订单" },
        { icon: "bi-currency-yen", bg: "bg-soft-success", label: "本月销售额", value: UI.formatMoney(monthSales), trend: "+18%", up: true, sub: "含已交付" },
        { icon: "bi-receipt", bg: "bg-soft-warn", label: "客单价", value: UI.formatMoney(avgOrder), trend: "-3%", up: false, sub: "月均订单" }
      ];

      var metricHtml = '<div class="metric-grid">';
      metrics.forEach(function (m) {
        metricHtml += '<div class="metric-card"><div class="metric-icon ' + m.bg + '"><i class="bi ' + m.icon + '"></i></div>';
        metricHtml += '<div class="metric-label">' + m.label + '</div><div class="metric-value">' + m.value + '</div>';
        metricHtml += '<div class="metric-trend ' + (m.up ? "trend-up" : "trend-down") + '"><i class="bi bi-arrow-' + (m.up ? "up" : "down") + '-short"></i>' + m.trend + ' · <span class="text-muted">' + m.sub + "</span></div></div>";
      });
      metricHtml += "</div>";

      var statusDist = ["received", "processing", "adjusting", "quality", "delivered"].map(function (st) {
        return { status: st, count: orders.filter(function (o) { return o.status === st; }).length };
      });
      var maxDist = Math.max.apply(null, statusDist.map(function (s) { return s.count; }).concat([1]));

      var distHtml = '<div class="card h-100"><div class="card-header"><span class="card-title"><i class="bi bi-pie-chart-fill text-teal me-2"></i>加工状态分布</span></div><div class="card-body">';
      statusDist.forEach(function (s) {
        var pct = Math.round(s.count / maxDist * 100);
        var info = UI.orderStatusList()[s.status];
        distHtml += '<div class="mb-3"><div class="d-flex justify-content-between mb-1"><span>' + UI.badge(info.label, info.type) + '</span><span class="fw-bold">' + s.count + " 单</span></div>";
        distHtml += '<div class="progress" style="height:8px;border-radius:4px;"><div class="progress-bar bg-teal" style="width:' + pct + '%"></div></div></div>';
      });
      distHtml += "</div></div>";

      var trendHtml = '<div class="card h-100"><div class="card-header"><span class="card-title"><i class="bi bi-graph-up-arrow text-teal me-2"></i>近 7 日订单趋势</span></div><div class="card-body"><canvas id="dashTrend" height="160"></canvas></div></div>";

      var quickStat = '<div class="card"><div class="card-header"><span class="card-title"><i class="bi bi-grid-3x3-gap-fill text-teal me-2"></i>' + UI.escape(store ? store.name : "") + " · 运营概览</span></div><div class="card-body">';
      quickStat += '<div class="list-stat"><span class="ls-label">在岗技师</span><span class="ls-value">' + techs.length + " 人</span></div>';
      quickStat += '<div class="list-stat"><span class="ls-label">待处理订单</span><span class="ls-value text-warning">' + pendingCount + " 单</span></div>';
      quickStat += '<div class="list-stat"><span class="ls-label">镜架 SKU</span><span class="ls-value">' + frames.length + " 款</span></div>';
      quickStat += '<div class="list-stat"><span class="ls-label">镜片 SKU</span><span class="ls-value">' + lenses.length + " 款</span></div>';
      quickStat += '<div class="list-stat"><span class="ls-label">库存预警</span><span class="ls-value text-danger">' + lowStock + " 项</span></div>';
      quickStat += "</div></div>";

      var recentOrders = orders.slice(0, 8);
      var recentHtml = '<div class="card table-card"><div class="card-header"><span class="card-title"><i class="bi bi-clock-history text-teal me-2"></i>近期订单</span><a href="#/processing" class="btn btn-sm btn-outline-teal">查看全部 <i class="bi bi-arrow-right"></i></a></div><div class="card-body p-0"><div class="table-scroll"><table class="data-table"><thead><tr><th>订单号</th><th>顾客</th><th>镜架</th><th>金额</th><th>状态</th><th>创建时间</th></tr></thead><tbody>';
      recentOrders.forEach(function (o) {
        var overtime = o.status !== "delivered" && o.timeline.length && (now - o.timeline[o.timeline.length - 1].time > 24 * 3600000);
        recentHtml += '<tr class="' + (overtime ? "row-danger" : "") + ' cursor-pointer" data-go="#/processing/' + o.id + '"><td class="cell-link">' + o.id.slice(0, 10) + '</td><td>' + UI.escape(o.customerName) + '</td><td>' + UI.escape(o.frameDesc || "—") + '</td><td>' + UI.formatMoney(o.finalAmount || o.amount) + "</td><td>" + UI.orderStatusBadge(o.status) + "</td><td>" + UI.fromNow(o.createdAt) + "</td></tr>";
      });
      recentHtml += "</tbody></table></div></div></div>";

      var html = metricHtml +
        '<div class="row g-3 mb-3"><div class="col-lg-8">' + trendHtml + '</div><div class="col-lg-4">' + distHtml + "</div></div>" +
        '<div class="row g-3"><div class="col-lg-8">' + recentHtml + '</div><div class="col-lg-4">' + quickStat + "</div></div>";

      $("#appContent").html(html);

      $("[data-go]").on("click", function () { location.hash = $(this).data("go"); });

      Dashboard.renderTrendChart(orders);
    },

    renderTrendChart: function (orders) {
      if (Dashboard.chart) { Dashboard.chart.destroy(); Dashboard.chart = null; }
      var ctx = document.getElementById("dashTrend");
      if (!ctx) return;
      var labels = [], data = [];
      for (var i = 6; i >= 0; i--) {
        var d = new Date(Date.now() - i * 86400000);
        var ds = d.toISOString().slice(0, 10);
        labels.push((d.getMonth() + 1) + "/" + d.getDate());
        data.push(orders.filter(function (o) { return new Date(o.createdAt).toISOString().slice(0, 10) === ds; }).length);
      }
      Dashboard.chart = new Chart(ctx, {
        type: "line",
        data: { labels: labels, datasets: [{ label: "订单数", data: data, borderColor: "#0d9488", backgroundColor: "rgba(20,184,166,.15)", fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: "#0d6e6e", borderWidth: 2 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }
  };

  global.Dashboard = Dashboard;
})(window);
