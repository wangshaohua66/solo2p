(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    var dateRange = { type: 'week' };
    var currentStoreId = null;

    function render() {
        var stores = App.store.getStores();
        var storeOpts = '<option value="">全部门店</option>' + stores.map(function(s) {
            return '<option value="' + s.id + '" ' + (currentStoreId === s.id ? 'selected' : '') + '>' + s.name + '</option>';
        }).join('');
        return '<div class="container-fluid p-0">' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-12"><div class="card bg-gradient-primary text-white shadow-sm">' +
            '<div class="card-body py-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto"><h4 class="mb-0 fw-bold"><i class="bi bi-graph-up me-2"></i>经营数据看板</h4>' +
            '<small class="opacity-75">实时营业数据分析 · 多维度绩效洞察</small>' +
            '</div>' +
            '<div class="col-md-2 ms-auto"><select class="form-select" id="storeFilter">' + storeOpts + '</select></div>' +
            '<div class="col-md-3"><div class="btn-group w-100" role="group">' +
            '<button class="btn btn-light btn-sm range-btn active" data-type="day">今日</button>' +
            '<button class="btn btn-light btn-sm range-btn" data-type="week">本周</button>' +
            '<button class="btn btn-light btn-sm range-btn" data-type="month">本月</button>' +
            '<button class="btn btn-light btn-sm range-btn" data-type="all">全部</button>' +
            '</div></div>' +
            '<div class="col-md-2"><button class="btn btn-outline-light w-100" id="btnExportChart"><i class="bi bi-download me-1"></i>导出报表</button></div>' +
            '</div></div></div></div></div>' +

            '<div class="row g-3 mb-4">' +
            statCard('营业收入', '0', 'totalRevenue', 'currency', 'bi-cash-coin', 'primary') +
            statCard('服务单数', '0', 'serviceCount', 'count', 'bi-list-ol', 'success') +
            statCard('客单均价', '0', 'avgPrice', 'currency', 'bi-tag', 'warning') +
            statCard('在管会员', '0', 'memberCount', 'count', 'bi-people', 'info') +
            statCard('宠物档案', '0', 'petCount', 'count', 'bi-heart', 'danger') +
            statCard('完成率', '0', 'completeRate', 'percent', 'bi-check2-circle', 'secondary') +
            '</div>' +

            '<div class="row g-4">' +
            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-bar-chart-line me-2 text-primary"></i>营业额趋势</h6></div>' +
            '<div class="card-body"><canvas id="revenueChart" height="200"></canvas></div></div></div>' +

            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-pie-chart me-2 text-success"></i>服务类型分布</h6></div>' +
            '<div class="card-body"><canvas id="typeChart" height="200"></canvas></div></div></div>' +

            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-people me-2 text-purple"></i>会员增长趋势</h6></div>' +
            '<div class="card-body"><canvas id="memberGrowthChart" height="200"></canvas></div></div></div>' +

            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-geo-alt me-2 text-info"></i>门店业绩对比</h6>' +
            '<span class="badge bg-secondary">营业额</span></div>' +
            '<div class="card-body"><canvas id="storeChart" height="200"></canvas></div></div></div>' +

            '<div class="col-lg-12"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-trophy me-2 text-warning"></i>美容师绩效排行</h6>' +
            '<span class="badge bg-secondary">按营业额排名</span></div>' +
            '<div class="card-body p-0" id="groomerRankHost"></div></div></div>' +

            '<div class="col-lg-12"><div class="card shadow-sm">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-receipt me-2 text-danger"></i>最近交易记录</h6>' +
            '<button class="btn btn-sm btn-outline-primary" onclick="App.router.navigate(\'/checkout\')"><i class="bi bi-plus me-1"></i>收银台</button>' +
            '</div><div class="card-body p-0" id="receiptsHost"></div></div></div>' +

            '</div></div>';
    }

    function statCard(label, val, id, type, icon, color) {
        return '<div class="col-md-6 col-xl-2"><div class="card shadow-sm h-100 border-left-' + color + '">' +
            '<div class="card-body p-3">' +
            '<div class="d-flex align-items-start justify-content-between mb-2">' +
            '<div class="avatar-md bg-' + color + '-subtle rounded d-flex align-items-center justify-content-center">' +
            '<i class="bi ' + icon + ' text-' + color + ' fs-4"></i></div>' +
            '<span class="badge bg-light text-dark small opacity-75">' + label + '</span>' +
            '</div>' +
            '<div class="display-6 fw-bold text-dark" id="' + id + '">' + val + '</div>' +
            '<div class="small text-muted" id="' + id + '_hint">&nbsp;</div>' +
            '</div></div></div>';
    }

    function bind() {
        refreshAll();

        $('.range-btn').on('click', function() {
            $('.range-btn').removeClass('active');
            $(this).addClass('active');
            dateRange.type = $(this).data('type');
            refreshAll();
        });

        $('#storeFilter').on('change', function() {
            currentStoreId = $(this).val() || null;
            refreshAll();
        });

        $('#btnExportChart').on('click', function() {
            var store = currentStoreId ? App.store.getStores().find(function(s) { return s.id === currentStoreId; }) : null;
            var stats = App.store.getDashboardStats(getFilter());
            var content = '萌宠乐美 经营数据报表\n' +
                '导出时间：' + new Date().toLocaleString() + '\n' +
                '门店范围：' + (store ? store.name : '全部门店') + '\n' +
                '数据范围：' + ({day:'今日', week:'本周', month:'本月', all:'全部'}[dateRange.type]) + '\n' +
                '————————————————\n' +
                '总营业额：¥' + stats.totalRevenue.toFixed(2) + '\n' +
                '服务单数：' + stats.serviceCount + '\n' +
                '完成单数：' + stats.completedCount + '\n' +
                '客单均价：¥' + stats.avgPrice.toFixed(2) + '\n' +
                '会员总数：' + stats.memberCount + '\n' +
                '宠物总数：' + stats.petCount + '\n';
            var blob = new Blob([content], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = '经营报表_' + Date.now() + '.txt'; a.click();
            App.showToast('报表已导出', 'success');
        });
    }

    function getFilter() {
        var f = { storeId: currentStoreId || undefined };
        var now = new Date();
        if (dateRange.type === 'day') {
            f.startDate = f.endDate = now.toISOString().slice(0, 10);
        } else if (dateRange.type === 'week') {
            var day = now.getDay();
            var diff = now.getDate() - day + (day === 0 ? -6 : 1);
            var monday = new Date(now); monday.setDate(diff);
            var sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
            f.startDate = monday.toISOString().slice(0, 10);
            f.endDate = sunday.toISOString().slice(0, 10);
        } else if (dateRange.type === 'month') {
            f.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            f.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        }
        return f;
    }

    function refreshAll() {
        var filter = getFilter();
        var stats = App.store.getDashboardStats(filter);
        var compRate = stats.serviceCount > 0 ? Math.round(stats.completedCount / stats.serviceCount * 100) : 0;

        $('#totalRevenue').text('¥' + stats.totalRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        $('#serviceCount').text(stats.serviceCount);
        $('#avgPrice').text('¥' + stats.avgPrice.toFixed(2));
        $('#memberCount').text(stats.memberCount);
        $('#petCount').text(stats.petCount);
        $('#completeRate').text(compRate + '%');

        renderRevenueChart(filter);
        renderTypeChart(stats.typeDistribution);
        renderMemberGrowthChart(filter);
        renderGroomerRank(stats.groomerRank);
        renderStoreChart(filter);
        renderRecentReceipts(filter);
    }

    function renderRevenueChart(filter) {
        var ctx = document.getElementById('revenueChart');
        if (!ctx) return;
        if (ctx.chart) ctx.chart.destroy();
        var labels = [];
        var data = [];
        var dayCount = dateRange.type === 'day' ? 1 : (dateRange.type === 'week' ? 7 : (dateRange.type === 'month' ? 30 : 12));

        var receipts = App.store.getReceipts(filter);
        var dateMap = {};
        receipts.forEach(function(r) {
            var key = r.date.substring(0, dateRange.type === 'all' ? 7 : 10);
            dateMap[key] = (dateMap[key] || 0) + Number(r.total);
        });

        if (dateRange.type === 'day') {
            labels = ['今日'];
            data = [Object.values(dateMap).reduce(function(s, v) { return s + v; }, 0)];
        } else if (dateRange.type === 'week') {
            ['周一','周二','周三','周四','周五','周六','周日'].forEach(function(d, i) {
                labels.push(d);
                var day = new Date();
                var cur = day.getDay();
                var diff = day.getDate() - cur + (cur === 0 ? -6 : 1) + i;
                day.setDate(diff);
                var key = day.toISOString().slice(0, 10);
                data.push(dateMap[key] || 0);
            });
        } else if (dateRange.type === 'month') {
            for (var i = 1; i <= 30; i++) { labels.push(i + '日'); data.push(0); }
            Object.keys(dateMap).forEach(function(k) {
                var idx = parseInt(k.split('-')[2]) - 1;
                if (idx >= 0 && idx < 30) data[idx] = dateMap[k];
            });
        } else {
            for (var j = 0; j < 12; j++) { labels.push((j + 1) + '月'); data.push(0); }
            Object.keys(dateMap).forEach(function(k) {
                var idx = parseInt(k.split('-')[1]) - 1;
                if (idx >= 0 && idx < 12) data[idx] += dateMap[k];
            });
        }

        ctx.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '营业额 (¥)',
                    data: data,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13,110,253,0.1)',
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: '#0d6efd'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { callback: function(v) { return '¥' + v; } } } }
            }
        });
    }

    function renderTypeChart(dist) {
        var ctx = document.getElementById('typeChart');
        if (!ctx) return;
        if (ctx.chart) ctx.chart.destroy();
        var types = App.store.getServiceTypes();
        var colorMap = {};
        types.forEach(function(t) { colorMap[t.id] = t.color; });

        var labels = dist.map(function(d) { return d.name; });
        var data = dist.map(function(d) { return d.count; });
        var colors = dist.map(function(d) {
            var t = types.find(function(x) { return x.id === d.id; });
            return t ? t.color : '#6c757d';
        });

        ctx.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { usePointStyle: true } }
                }
            }
        });
    }

    function renderMemberGrowthChart(filter) {
        var ctx = document.getElementById('memberGrowthChart');
        if (!ctx) return;
        if (ctx.chart) ctx.chart.destroy();

        var customers = App.store.getCustomers();
        var periodCount = dateRange.type === 'day' ? 1 : (dateRange.type === 'week' ? 7 : (dateRange.type === 'month' ? 30 : 12));
        var labels = [];
        var newData = [];
        var cumulativeData = [];

        var dailyCounts = {};
        var minDate = null;
        var maxDate = null;

        customers.forEach(function(c) {
            if (!c.registerDate) return;
            var key = c.registerDate.substring(0, dateRange.type === 'all' ? 7 : 10);
            dailyCounts[key] = (dailyCounts[key] || 0) + 1;
            if (!minDate || c.registerDate < minDate) minDate = c.registerDate;
            if (!maxDate || c.registerDate > maxDate) maxDate = c.registerDate;
        });

        var now = new Date();
        var cumulativeTotal = 0;

        if (dateRange.type === 'day') {
            labels = ['今日'];
            var todayKey = now.toISOString().slice(0, 10);
            var todayCount = dailyCounts[todayKey] || 0;
            newData = [todayCount];
            for (var k in dailyCounts) { if (k <= todayKey) cumulativeTotal += dailyCounts[k]; }
            cumulativeData = [cumulativeTotal];
        } else if (dateRange.type === 'week') {
            ['周一','周二','周三','周四','周五','周六','周日'].forEach(function(d, i) {
                labels.push(d);
                var day = new Date();
                var cur = day.getDay();
                var diff = day.getDate() - cur + (cur === 0 ? -6 : 1) + i;
                day.setDate(diff);
                var key = day.toISOString().slice(0, 10);
                var count = dailyCounts[key] || 0;
                newData.push(count);
                for (var k in dailyCounts) { if (k <= key) cumulativeTotal += dailyCounts[k]; }
                cumulativeData.push(cumulativeTotal);
                cumulativeTotal = 0;
            });
        } else if (dateRange.type === 'month') {
            var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            for (var i = 1; i <= 30; i++) {
                labels.push(i + '日');
                var d = new Date(monthStart); d.setDate(i - 1);
                var key = d.toISOString().slice(0, 10);
                newData.push(dailyCounts[key] || 0);
            }
            var runningTotal = 0;
            Object.keys(dailyCounts).sort().forEach(function(k) {
                runningTotal += dailyCounts[k];
            });
            for (var j = 0; j < 30; j++) {
                cumulativeData.push(runningTotal);
            }
        } else {
            for (var m = 0; m < 12; m++) { labels.push((m + 1) + '月'); newData.push(0); cumulativeData.push(0); }
            Object.keys(dailyCounts).forEach(function(k) {
                var ym = k.substring(0, 7);
                var monthIdx = parseInt(ym.split('-')[1]) - 1;
                if (monthIdx >= 0 && monthIdx < 12) {
                    newData[monthIdx] += dailyCounts[k];
                }
            });
            var cum = 0;
            for (var n = 0; n < 12; n++) {
                cum += newData[n];
                cumulativeData[n] = cum;
            }
        }

        ctx.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '新增会员',
                        data: newData,
                        borderColor: '#6f42c1',
                        backgroundColor: 'rgba(111,66,193,0.1)',
                        tension: 0.35,
                        fill: true,
                        pointBackgroundColor: '#6f42c1',
                        yAxisID: 'y'
                    },
                    {
                        label: '累计会员',
                        data: cumulativeData,
                        borderColor: '#d63384',
                        backgroundColor: 'transparent',
                        tension: 0.35,
                        fill: false,
                        pointBackgroundColor: '#d63384',
                        borderDash: [5, 5],
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true } }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: '新增人数' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: '累计人数' }
                    }
                }
            }
        });
    }

    function renderGroomerRank(rankList) {
        var html = '';
        if (!rankList.length) {
            html = '<div class="text-center py-4 text-muted small">暂无数据</div>';
        } else {
            html = '<div class="list-group list-group-flush">';
            rankList.slice(0, 8).forEach(function(r, idx) {
                var medal = '';
                if (idx === 0) medal = '<i class="bi bi-trophy-fill text-warning me-1"></i>';
                else if (idx === 1) medal = '<i class="bi bi-medal text-secondary me-1"></i>';
                else if (idx === 2) medal = '<i class="bi bi-medal text-danger me-1"></i>';
                else medal = '<span class="me-2 badge bg-light text-dark fw-bold">' + (idx + 1) + '</span>';
                var maxRev = rankList[0].revenue || 1;
                var pct = Math.round(r.revenue / maxRev * 100);
                html += '<div class="list-group-item d-flex align-items-center gap-3">' +
                    '<div class="fs-4 d-flex align-items-center" style="width:40px;">' + medal + '</div>' +
                    '<div class="flex-grow-1">' +
                    '<div class="d-flex justify-content-between align-items-center mb-1">' +
                    '<span class="fw-bold">' + r.name + '</span>' +
                    '<div class="d-flex gap-3 small">' +
                    '<span class="text-muted">' + r.count + ' 单</span>' +
                    '<span class="text-success fw-bold">' + App.calculator.formatMoney(r.revenue) + '</span>' +
                    '</div></div>' +
                    '<div class="progress" style="height:6px;"><div class="progress-bar bg-gradient" style="width:' + pct + '%;"></div></div>' +
                    '</div></div>';
            });
            html += '</div>';
        }
        $('#groomerRankHost').html(html);
    }

    function renderStoreChart(filter) {
        var ctx = document.getElementById('storeChart');
        if (!ctx) return;
        if (ctx.chart) ctx.chart.destroy();
        var stores = App.store.getStores();
        var labels = [];
        var data = [];
        stores.forEach(function(s) {
            var f = Object.assign({}, filter, { storeId: s.id });
            var r = App.store.getReceipts(f);
            labels.push(s.name.replace(/分店|旗舰店/g, ''));
            data.push(r.reduce(function(sum, x) { return sum + Number(x.total); }, 0));
        });
        var colors = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0'];
        ctx.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '营业额 (¥)',
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { callback: function(v) { return '¥' + v; } } } }
            }
        });
    }

    function renderRecentReceipts(filter) {
        var receipts = App.store.getReceipts(filter).slice(0, 10);
        if (!receipts.length) {
            $('#receiptsHost').html('<div class="text-center py-4 text-muted">暂无交易记录</div>');
            return;
        }
        var html = '<table class="table table-hover align-middle mb-0"><thead class="table-light"><tr>' +
            '<th>单号</th><th>门店</th><th>客户</th><th>项目数</th><th>支付方式</th><th>金额</th><th>积分</th><th>时间</th><th>操作</th></tr></thead><tbody>';
        receipts.forEach(function(r) {
            var store = App.store.getStores().find(function(s) { return s.id === r.storeId; });
            var c = r.customerId ? App.store.getCustomerById(r.customerId) : null;
            var payMap = {cash:'现金', stored:'储值卡', qr:'扫码', card:'银行卡'};
            html += '<tr><td class="small fw-mono text-muted">' + r.id + '</td>' +
                '<td class="small">' + (store ? store.name : '-') + '</td>' +
                '<td class="small">' + (c ? c.name : '<span class="text-muted">散客</span>') + '</td>' +
                '<td><span class="badge bg-secondary">' + r.items.length + '</span></td>' +
                '<td><span class="badge bg-light text-dark">' + (payMap[r.payMethod] || r.payMethod) + '</span></td>' +
                '<td class="fw-bold text-success">' + App.calculator.formatMoney(r.total) + '</td>' +
                '<td class="small text-primary">+' + r.pointsEarned + '</td>' +
                '<td class="small text-muted">' + r.date.substring(5, 16) + '</td>' +
                '<td><button class="btn btn-sm btn-outline-info btn-view-receipt" data-id="' + r.id + '"><i class="bi bi-eye"></i></button></td></tr>';
        });
        html += '</tbody></table>';
        $('#receiptsHost').html(html);
        $('#receiptsHost').off('click', '.btn-view-receipt').on('click', '.btn-view-receipt', function() {
            var id = $(this).data('id');
            var r = App.store.getReceipts().find(function(x) { return x.id === id; });
            if (r) {
                var c = r.customerId ? App.store.getCustomerById(r.customerId) : null;
                var body = '<table class="table table-sm"><tbody>' +
                    r.items.map(function(it) {
                        return '<tr><td>' + it.name + '</td><td class="text-center">×' + it.qty + '</td><td class="text-end">' + App.calculator.formatMoney(it.price * it.qty) + '</td></tr>';
                    }).join('') +
                    '<tr class="table-active"><td colspan="2" class="fw-bold">合计</td><td class="text-end fw-bold text-danger">' + App.calculator.formatMoney(r.total) + '</td></tr>' +
                    '</tbody></table>' +
                    '<div class="small text-muted">客户：' + (c ? c.name + '（' + c.phone + '）' : '散客') + ' · 操作员：' + (r.operatorId || '-') + '</div>';
                App.showModal('小票详情 - ' + r.id, body);
            }
        });
    }

    App.pages.dashboard = {
        render: render,
        bind: bind
    };

})(typeof window !== 'undefined' ? window : this);
