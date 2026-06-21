var Report = window.Report = (function () {
    var logs = [];
    var allStores = [];
    var period = 'month';
    var periodStoreId = null;
    var charts = {};

    function render() {
        var storeId = App.state.storeId;
        periodStoreId = storeId;
        if (!storeId) return;

        Promise.all([
            Store.getLogsByStore(storeId),
            Store.getAllStores()
        ]).then(function (results) {
            logs = results[0] || [];
            allStores = results[1] || [];
            renderPage();
        }).catch(function (err) {
            console.error('加载报表数据失败:', err);
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>数据加载失败，请刷新重试</p></div>');
        });
    }

    function renderPage() {
        var html = '';
        html += renderPageHeader();
        html += renderFilterBar();
        html += renderKpiCards();
        html += renderCharts();

        $('#app-content').html(html);
        bindEvents();
        setTimeout(renderAllCharts, 100);
    }

    function renderPageHeader() {
        var actionsHtml = '<button class="btn btn-outline-pink" id="btn-export"><i class="bi bi-download me-1"></i>导出报表</button>';
        return App.renderPageHeader('bi-bar-chart-line', '运营报表', App.state.storeName, actionsHtml);
    }

    function renderFilterBar() {
        return '<div class="filter-bar fade-in mb-4">' +
            '<span class="text-muted me-2">时间范围：</span>' +
            '<div class="btn-group" role="group">' +
            '<button type="button" class="btn ' + (period === 'week' ? 'btn-pink' : 'btn-outline-pink') + '" data-period="week">本周</button>' +
            '<button type="button" class="btn ' + (period === 'month' ? 'btn-pink' : 'btn-outline-pink') + '" data-period="month">本月</button>' +
            '<button type="button" class="btn ' + (period === 'quarter' ? 'btn-pink' : 'btn-outline-pink') + '" data-period="quarter">本季度</button>' +
            '<button type="button" class="btn ' + (period === 'year' ? 'btn-pink' : 'btn-outline-pink') + '" data-period="year">全年</button>' +
            '</div>' +
            '<select class="form-select form-select-sm" id="report-store-select">' +
            '<option value="all">全部门店</option>' +
            allStores.map(function (s) {
                return '<option value="' + s.id + '"' + (s.id === periodStoreId ? ' selected' : '') + '>' + s.name + '</option>';
            }).join('') +
            '</select>' +
            '<span class="badge-pink"><i class="bi bi-info-circle me-1"></i>自动计算同比环比</span>' +
            '</div>';
    }

    function getPeriodRange() {
        var today = new Date(Store.formatDate(new Date()));
        var startDate = new Date(today);
        var daysCount = 1;
        var todayStr = Store.formatDate(today);

        switch (period) {
            case 'week':
                startDate.setDate(today.getDate() - 6);
                daysCount = 7;
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                daysCount = today.getDate();
                break;
            case 'quarter':
                var qMonth = Math.floor(today.getMonth() / 3) * 3;
                startDate = new Date(today.getFullYear(), qMonth, 1);
                daysCount = Math.ceil((today - startDate) / 86400000);
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1);
                daysCount = Math.ceil((today - startDate) / 86400000);
                break;
        }

        var startDateStr = Store.formatDate(startDate);
        var dateList = [];
        for (var i = 0; i < daysCount; i++) {
            dateList.push(Store.addDays(startDateStr, i));
        }

        var prevStart = new Date(startDate);
        prevStart.setDate(prevStart.getDate() - daysCount);
        var prevEnd = new Date(startDate);
        prevEnd.setDate(prevEnd.getDate() - 1);
        var prevDateList = [];
        for (var j = 0; j < daysCount; j++) {
            prevDateList.push(Store.addDays(Store.formatDate(prevStart), j));
        }

        return {
            startDate: startDateStr,
            endDate: todayStr,
            dates: dateList,
            prevDates: prevDateList,
            prevStart: Store.formatDate(prevStart),
            prevEnd: Store.formatDate(prevEnd)
        };
    }

    function getFilteredLogs() {
        var range = getPeriodRange();
        var filterStore = $('#report-store-select').val();
        var storeFilter = filterStore === 'all' ? allStores.map(function (s) { return s.id; }) : [filterStore];

        return logs.filter(function (log) {
            return storeFilter.indexOf(log.storeId) >= 0 &&
                log.date >= range.startDate && log.date <= range.endDate;
        });
    }

    function getPrevLogs() {
        var range = getPeriodRange();
        var filterStore = $('#report-store-select').val();
        var storeFilter = filterStore === 'all' ? allStores.map(function (s) { return s.id; }) : [filterStore];

        return logs.filter(function (log) {
            return storeFilter.indexOf(log.storeId) >= 0 &&
                log.date >= range.prevStart && log.date <= range.prevEnd;
        });
    }

    function calcYoY(cur, prev) {
        if (prev === 0) return cur > 0 ? '+100%' : '0%';
        var diff = Math.round((cur - prev) / prev * 100);
        return (diff >= 0 ? '+' : '') + diff + '%';
    }

    function renderKpiCards() {
        var range = getPeriodRange();
        var currentLogs = getFilteredLogs();
        var prevLogs = getPrevLogs();

        function sumField(arr, field) {
            return arr.reduce(function (s, l) { return s + (l[field] || 0); }, 0);
        }

        var totalOccupancy = currentLogs.length > 0
            ? Math.round(currentLogs.reduce(function (s, l) { return s + l.occupancyRate; }, 0) / currentLogs.length)
            : 0;
        var prevOccupancy = prevLogs.length > 0
            ? Math.round(prevLogs.reduce(function (s, l) { return s + l.occupancyRate; }, 0) / prevLogs.length)
            : 0;

        var totalNursing = sumField(currentLogs, 'nursingCount');
        var prevNursing = sumField(prevLogs, 'nursingCount');

        var totalMeals = sumField(currentLogs, 'mealCount');
        var prevMeals = sumField(prevLogs, 'mealCount');

        var totalRevenue = sumField(currentLogs, 'rehabRevenue');
        var prevRevenue = sumField(prevLogs, 'rehabRevenue');

        var newCheckIns = sumField(currentLogs, 'newCheckIns');

        return '<div class="row g-3 mb-4 fade-in">' +
            renderKpiCard('平均入住率', totalOccupancy + '%', calcYoY(totalOccupancy, prevOccupancy), 'pink', 'bi-graph-up-arrow', totalOccupancy >= prevOccupancy) +
            renderKpiCard('护理服务量', totalNursing + '次', calcYoY(totalNursing, prevNursing), 'blue', 'bi-clipboard2-pulse', totalNursing >= prevNursing) +
            renderKpiCard('月子餐数量', totalMeals + '份', calcYoY(totalMeals, prevMeals), 'yellow', 'bi-cup-hot', totalMeals >= prevMeals) +
            renderKpiCard('康复项目收入', '¥' + totalRevenue.toLocaleString(), calcYoY(totalRevenue, prevRevenue), 'green', 'bi-cash-stack', totalRevenue >= prevRevenue) +
            renderKpiCard('新入住产妇', newCheckIns + '人', '', 'pink', 'bi-person-heart', true) +
            renderKpiCard('统计周期', range.dates.length + '天', range.startDate + ' ~ ' + range.endDate, 'blue', 'bi-calendar3', true) +
            '</div>';
    }

    function renderKpiCard(label, value, yoy, color, icon, isPositive) {
        var yoyColor = isPositive ? 'text-success' : 'text-danger';
        var yoyIcon = isPositive ? 'bi-arrow-up' : 'bi-arrow-down';
        if (!yoy) yoyColor = 'text-muted';

        return '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon ' + color + '"><i class="bi ' + icon + '"></i></div>' +
            '<div class="stat-value" style="font-size:26px;">' + value + '</div>' +
            '<div class="d-flex justify-content-between align-items-center mt-1">' +
            '<div class="stat-label">' + label + '</div>' +
            (yoy ? '<small class="' + yoyColor + ' fw-medium"><i class="bi ' + yoyIcon + '"></i> ' + yoy + '</small>' : '') +
            '</div></div></div>';
    }

    function renderCharts() {
        return '<div class="row g-3 fade-in mb-4">' +
            '<div class="col-xl-8 col-lg-12">' +
            '<div class="card-pink">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-graph-up-arrow"></i>入住率趋势（同比对比）</h5>' +
            '</div>' +
            '<div class="card-pink-body"><div class="chart-container"><canvas id="chart-occupancy"></canvas></div></div>' +
            '</div></div>' +
            '<div class="col-xl-4 col-lg-6">' +
            '<div class="card-pink">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-pie-chart"></i>房型入住占比</h5>' +
            '</div>' +
            '<div class="card-pink-body"><div class="chart-container"><canvas id="chart-room-type"></canvas></div></div>' +
            '</div></div>' +
            '<div class="col-xl-6 col-lg-6">' +
            '<div class="card-pink">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-bar-chart"></i>每日护理服务与月子餐</h5>' +
            '</div>' +
            '<div class="card-pink-body"><div class="chart-container"><canvas id="chart-service"></canvas></div></div>' +
            '</div></div>' +
            '<div class="col-xl-6 col-lg-12">' +
            '<div class="card-pink">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-cash-coin"></i>门店康复收入对比</h5>' +
            '</div>' +
            '<div class="card-pink-body"><div class="chart-container"><canvas id="chart-revenue"></canvas></div></div>' +
            '</div></div>' +
            '</div>';
    }

    function renderAllCharts() {
        destroyCharts();
        renderOccupancyChart();
        renderRoomTypeChart();
        renderServiceChart();
        renderRevenueChart();
    }

    function destroyCharts() {
        Object.keys(charts).forEach(function (key) {
            if (charts[key]) {
                try { charts[key].destroy(); } catch (e) { }
                charts[key] = null;
            }
        });
    }

    function getLabelForDate(dateStr) {
        switch (period) {
            case 'week':
                var d = new Date(dateStr);
                return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
            case 'month':
                return dateStr.substring(8, 10);
            case 'quarter':
                return dateStr.substring(5, 10);
            case 'year':
                return dateStr.substring(5, 10);
            default:
                return dateStr.substring(8, 10);
        }
    }

    function renderOccupancyChart() {
        var range = getPeriodRange();
        var currentLogs = getFilteredLogs();
        var prevLogs = getPrevLogs();

        function occupancyForDates(dates, logArr) {
            return dates.map(function (d) {
                var dayLogs = logArr.filter(function (l) { return l.date === d; });
                return dayLogs.length > 0
                    ? Math.round(dayLogs.reduce(function (s, l) { return s + l.occupancyRate; }, 0) / dayLogs.length)
                    : 0;
            });
        }

        var curData = occupancyForDates(range.dates, currentLogs);
        var prevData = occupancyForDates(range.prevDates, prevLogs);

        var labels = range.dates.map(getLabelForDate);

        var ctx = document.getElementById('chart-occupancy');
        if (!ctx) return;

        charts.occupancy = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '当前周期入住率（%）',
                        data: curData,
                        borderColor: '#E891A8',
                        backgroundColor: 'rgba(232, 145, 168, 0.15)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#E891A8',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    },
                    {
                        label: '上期同比（%）',
                        data: prevData,
                        borderColor: '#999',
                        borderDash: [6, 4],
                        backgroundColor: 'rgba(153, 153, 153, 0.05)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#999'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { font: { size: 12 }, usePointStyle: true } },
                    tooltip: { backgroundColor: 'rgba(74, 74, 74, 0.95)', titleFont: { size: 13 }, bodyFont: { size: 12 }, cornerRadius: 8, padding: 12 }
                },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(232, 145, 168, 0.08)' }, ticks: { font: { size: 11 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } }
                }
            }
        });
    }

    function renderRoomTypeChart() {
        var range = getPeriodRange();
        var currentLogs = getFilteredLogs();

        function sumField(arr, field) {
            return arr.reduce(function (s, l) { return s + (l[field] || 0); }, 0);
        }

        var luxuryOcc = sumField(currentLogs, 'luxuryOccupied');
        var stdOcc = sumField(currentLogs, 'standardOccupied');

        var ctx = document.getElementById('chart-room-type');
        if (!ctx) return;

        charts.roomType = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['豪华套房入住', '标准套房入住'],
                datasets: [{
                    data: [luxuryOcc, stdOcc],
                    backgroundColor: ['#E891A8', '#5BA8C9'],
                    borderColor: '#fff',
                    borderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 }, usePointStyle: true, padding: 16 } },
                    tooltip: { backgroundColor: 'rgba(74, 74, 74, 0.95)', cornerRadius: 8, padding: 12 }
                }
            }
        });
    }

    function renderServiceChart() {
        var range = getPeriodRange();
        var currentLogs = getFilteredLogs();

        function dailySum(dates, logArr, field) {
            return dates.map(function (d) {
                var dayLogs = logArr.filter(function (l) { return l.date === d; });
                return dayLogs.reduce(function (s, l) { return s + (l[field] || 0); }, 0);
            });
        }

        var labels = range.dates.map(getLabelForDate);
        var nursingData = dailySum(range.dates, currentLogs, 'nursingCount');
        var mealData = dailySum(range.dates, currentLogs, 'mealCount');

        var ctx = document.getElementById('chart-service');
        if (!ctx) return;

        charts.service = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: '护理服务（次）',
                        data: nursingData,
                        backgroundColor: 'rgba(232, 145, 168, 0.75)',
                        borderRadius: 6,
                        maxBarThickness: 28
                    },
                    {
                        type: 'line',
                        label: '月子餐（份）',
                        data: mealData,
                        borderColor: '#F0AD4E',
                        backgroundColor: 'rgba(240, 173, 78, 0.12)',
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#F0AD4E',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { font: { size: 12 }, usePointStyle: true } },
                    tooltip: { backgroundColor: 'rgba(74, 74, 74, 0.95)', cornerRadius: 8, padding: 12 }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(232, 145, 168, 0.08)' }, ticks: { font: { size: 11 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } }
                }
            }
        });
    }

    function renderRevenueChart() {
        var range = getPeriodRange();
        var currentLogs = getFilteredLogs();

        var storeRevenue = {};
        allStores.forEach(function (s) { storeRevenue[s.id] = { name: s.name, value: 0 }; });
        currentLogs.forEach(function (log) {
            if (storeRevenue[log.storeId]) {
                storeRevenue[log.storeId].value += log.rehabRevenue || 0;
            }
        });

        var values = Object.values(storeRevenue);
        var labels = values.map(function (v) { return v.name.replace('店', ''); });
        var data = values.map(function (v) { return v.value; });

        var ctx = document.getElementById('chart-revenue');
        if (!ctx) return;

        var gradient = ctx.getContext ? null : null;

        charts.revenue = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '康复收入（元）',
                    data: data,
                    backgroundColor: function (ctx) {
                        var chart = ctx.chart;
                        var { ctx: c, chartArea } = chart;
                        if (!chartArea) return '#E891A8';
                        var gradientFill = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradientFill.addColorStop(0, 'rgba(232, 145, 168, 0.4)');
                        gradientFill.addColorStop(1, 'rgba(198, 107, 133, 0.9)');
                        return gradientFill;
                    },
                    borderRadius: 8,
                    maxBarThickness: 36
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(74, 74, 74, 0.95)',
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: function (ctx) {
                                return '康复收入：¥' + (ctx.parsed.x || 0).toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(232, 145, 168, 0.08)' }, ticks: { font: { size: 11 }, callback: function (v) { return '¥' + v; } } },
                    y: { grid: { display: false }, ticks: { font: { size: 11 } } }
                }
            }
        });
    }

    function bindEvents() {
        $('.filter-bar [data-period]').on('click', function () {
            period = $(this).data('period');
            renderPage();
        });

        $('#report-store-select').on('change', function () {
            periodStoreId = $(this).val();
            setTimeout(renderAllCharts, 100);
        });

        $('#btn-export').on('click', function () {
            exportReport();
        });
    }

    function exportReport() {
        var range = getPeriodRange();
        var currentLogs = getFilteredLogs();

        function sumField(arr, field) {
            return arr.reduce(function (s, l) { return s + (l[field] || 0); }, 0);
        }

        var totalOccupancy = currentLogs.length > 0
            ? Math.round(currentLogs.reduce(function (s, l) { return s + l.occupancyRate; }, 0) / currentLogs.length)
            : 0;
        var totalNursing = sumField(currentLogs, 'nursingCount');
        var totalMeals = sumField(currentLogs, 'mealCount');
        var totalRevenue = sumField(currentLogs, 'rehabRevenue');

        var content = '===== 月子中心运营报表 =====\n' +
            '门店：' + App.state.storeName + '\n' +
            '周期：' + range.startDate + ' ~ ' + range.endDate + '\n' +
            '导出时间：' + new Date().toLocaleString() + '\n\n' +
            '--- 核心指标 ---\n' +
            '平均入住率：' + totalOccupancy + '%\n' +
            '护理服务量：' + totalNursing + ' 次\n' +
            '月子餐数量：' + totalMeals + ' 份\n' +
            '康复项目收入：¥' + totalRevenue.toLocaleString() + '\n\n' +
            '--- 每日明细 ---\n';

        currentLogs.forEach(function (log) {
            content += log.date + ' | 入住率:' + log.occupancyRate + '% | 护理:' + log.nursingCount + ' | 餐品:' + log.mealCount + ' | 康复收入:¥' + log.rehabRevenue + '\n';
        });

        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '运营报表_' + range.startDate + '_' + range.endDate + '.txt';
        a.click();
        URL.revokeObjectURL(url);

        App.showToast('报表已导出', 'success');
    }

    return { render: render };
})();
