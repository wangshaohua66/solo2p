(function(window, $) {
  var api = window.AuctionApp.api;
  var utils = window.AuctionApp.utils;
  var _charts = {};

  function init() {
    loadKPI();
    loadSoldRateChart();
    loadCategoryPieChart();
    loadPriceComparisonChart();
    loadCommissionTable();
  }

  function loadKPI() {
    api.get('/dashboard/kpi')
      .then(function(res) {
        var data = res.data || res || {};
        $('#kpi-total-lots').text(data.total_lots || 0);
        $('#kpi-sold-rate').text((data.sold_rate || 0) + '%');
        $('#kpi-total-revenue').text(utils.formatCurrency(data.total_revenue));
        $('#kpi-avg-premium').text((data.avg_premium || 0) + '%');
      })
      .fail(function() {
        $('#kpi-total-lots').text('-');
        $('#kpi-sold-rate').text('-');
        $('#kpi-total-revenue').text('-');
        $('#kpi-avg-premium').text('-');
      });
  }

  function loadSoldRateChart() {
    api.get('/dashboard/sold-rate-trend')
      .then(function(res) {
        var data = res.data || res || [];
        var labels = data.map(function(d) { return d.month || d.label; });
        var values = data.map(function(d) { return d.rate || d.sold_rate || 0; });
        renderSoldRateChart(labels, values);
      })
      .fail(function() {
        renderSoldRateChart([], []);
      });
  }

  function renderSoldRateChart(labels, values) {
    var ctx = document.getElementById('chart-sold-rate');
    if (!ctx) return;

    if (_charts.soldRate) _charts.soldRate.destroy();

    _charts.soldRate = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '成交率 (%)',
          data: values,
          borderColor: '#c9a96e',
          backgroundColor: 'rgba(201,169,110,0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#c9a96e',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#c9a96e' } }
        },
        scales: {
          x: { ticks: { color: '#8a8a9a' }, grid: { color: 'rgba(61,61,92,0.3)' } },
          y: { ticks: { color: '#8a8a9a' }, grid: { color: 'rgba(61,61,92,0.3)' }, min: 0, max: 100 }
        }
      }
    });
  }

  function loadCategoryPieChart() {
    api.get('/dashboard/category-distribution')
      .then(function(res) {
        var data = res.data || res || [];
        var labels = data.map(function(d) { return utils.getCategoryLabel(d.category) || d.category; });
        var values = data.map(function(d) { return d.count || 0; });
        renderCategoryPieChart(labels, values);
      })
      .fail(function() {
        renderCategoryPieChart([], []);
      });
  }

  function renderCategoryPieChart(labels, values) {
    var ctx = document.getElementById('chart-category-pie');
    if (!ctx) return;

    if (_charts.categoryPie) _charts.categoryPie.destroy();

    var goldShades = [
      '#c9a96e', '#8b6914', '#e8d5b7', '#d4af37', '#b8860b',
      '#daa520', '#cd853f', '#d2b48c', '#f5deb3', '#deb887'
    ];

    _charts.categoryPie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: goldShades.slice(0, labels.length),
          borderColor: '#2d2d44',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#f5f0e8', padding: 12, font: { size: 12 } }
          }
        }
      }
    });
  }

  function loadPriceComparisonChart() {
    api.get('/dashboard/price-comparison')
      .then(function(res) {
        var data = res.data || res || [];
        var labels = data.map(function(d) { return d.category || d.label; });
        var livePrices = data.map(function(d) { return d.live_avg || d.live || 0; });
        var onlinePrices = data.map(function(d) { return d.online_avg || d.online || 0; });
        renderPriceComparisonChart(labels, livePrices, onlinePrices);
      })
      .fail(function() {
        renderPriceComparisonChart([], [], []);
      });
  }

  function renderPriceComparisonChart(labels, livePrices, onlinePrices) {
    var ctx = document.getElementById('chart-price-compare');
    if (!ctx) return;

    if (_charts.priceCompare) _charts.priceCompare.destroy();

    _charts.priceCompare = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '现场均价',
            data: livePrices,
            backgroundColor: 'rgba(201,169,110,0.8)',
            borderColor: '#c9a96e',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: '线上均价',
            data: onlinePrices,
            backgroundColor: 'rgba(139,105,20,0.6)',
            borderColor: '#8b6914',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#c9a96e' } }
        },
        scales: {
          x: { ticks: { color: '#8a8a9a' }, grid: { color: 'rgba(61,61,92,0.3)' } },
          y: { ticks: { color: '#8a8a9a' }, grid: { color: 'rgba(61,61,92,0.3)' } }
        }
      }
    });
  }

  function loadCommissionTable() {
    api.get('/dashboard/commission-summary')
      .then(function(res) {
        var data = res.data || res || [];
        var html = '';
        if (!data.length) {
          html = '<tr><td colspan="5" class="text-center text-muted py-3">暂无佣金数据</td></tr>';
        } else {
          data.forEach(function(row) {
            html += '<tr>';
            html += '  <td>' + (row.auction_name || '-') + '</td>';
            html += '  <td style="font-family:var(--font-num)">' + (row.sold_count || 0) + '</td>';
            html += '  <td style="font-family:var(--font-num)">' + utils.formatCurrency(row.total_hammer) + '</td>';
            html += '  <td style="font-family:var(--font-num)">' + utils.formatCurrency(row.total_premium) + '</td>';
            html += '  <td style="font-family:var(--font-num);font-weight:600;color:var(--gold)">' + utils.formatCurrency(row.total_commission) + '</td>';
            html += '</tr>';
          });
        }
        $('#dashboard-commission-table tbody').html(html);
      });
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.dashboard = {
    init: init
  };
})(window, jQuery);
