const StatisticsPage = (function() {
    let revenueChart = null;
    let storeComparisonChart = null;
    let serviceTypeChart = null;
    let modelDistributionChart = null;
    let technicianChart = null;

    function render() {
        const today = new Date();
        const defaultEnd = today.toISOString().split('T')[0];
        const defaultStart = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];

        const html = `
            <div class="fade-in">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">统计报表</h1>
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <button type="button" class="btn btn-outline-success" id="btnExportCSV">
                            <i class="bi bi-download me-1"></i>导出CSV
                        </button>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <div class="row g-3 align-items-end">
                            <div class="col-md-3">
                                <label class="form-label">开始日期 <span class="text-danger">*</span></label>
                                <input type="text" class="form-control datepicker" id="startDate" value="${defaultStart}">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">结束日期 <span class="text-danger">*</span></label>
                                <input type="text" class="form-control datepicker" id="endDate" value="${defaultEnd}">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">门店</label>
                                <select class="form-select" id="filterStore">
                                    <option value="">全部门店</option>
                                    ${Helpers.getStores().map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-3">
                                <button class="btn btn-primary w-100" id="btnApplyFilter">
                                    <i class="bi bi-filter me-1"></i>应用筛选
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <div class="card stat-card h-100">
                            <div class="card-body">
                                <h6 class="text-muted mb-1">总营收</h6>
                                <h3 class="mb-0 text-primary fw-bold" id="totalRevenue">¥0.00</h3>
                                <small class="text-muted" id="totalOrders">0 个工单</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card stat-card h-100">
                            <div class="card-body">
                                <h6 class="text-muted mb-1">工时收入</h6>
                                <h3 class="mb-0 text-success fw-bold" id="laborRevenue">¥0.00</h3>
                                <small class="text-muted" id="laborPercent">占比 0%</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card stat-card h-100">
                            <div class="card-body">
                                <h6 class="text-muted mb-1">材料收入</h6>
                                <h3 class="mb-0 text-warning fw-bold" id="materialRevenue">¥0.00</h3>
                                <small class="text-muted" id="materialPercent">占比 0%</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card stat-card h-100">
                            <div class="card-body">
                                <h6 class="text-muted mb-1">平均客单价</h6>
                                <h3 class="mb-0 text-info fw-bold" id="avgOrderAmount">¥0.00</h3>
                                <small class="text-muted">较上期 <span id="avgGrowth">0%</span></small>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-lg-8">
                        <div class="card h-100">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">营收趋势</h5>
                                <div class="btn-group btn-group-sm">
                                    <button type="button" class="btn btn-outline-primary active" data-range="day">日</button>
                                    <button type="button" class="btn btn-outline-primary" data-range="week">周</button>
                                    <button type="button" class="btn btn-outline-primary" data-range="month">月</button>
                                </div>
                            </div>
                            <div class="card-body">
                                <canvas id="revenueChart" height="300"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">服务类型占比</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="serviceTypeChart" height="300"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-lg-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">门店对比</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="storeComparisonChart" height="300"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">车型分布 TOP10</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="modelDistributionChart" height="300"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-lg-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">高峰时段热力图</h5>
                            </div>
                            <div class="card-body">
                                <div id="heatmapContainer" class="heatmap-container"></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">技师绩效排名</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="technicianChart" height="300"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#main-content').html(html);
        initDatepickers();
        loadStatistics();
        bindEvents();
    }

    function initDatepickers() {
        $('.datepicker').datepicker({
            format: 'yyyy-mm-dd',
            autoclose: true,
            todayHighlight: true,
            language: 'zh-CN'
        });
    }

    function loadStatistics() {
        const startTime = performance.now();
        const startDate = $('#startDate').val();
        const endDate = $('#endDate').val();
        const storeId = $('#filterStore').val() || null;

        Helpers.showLoading(true, '加载统计数据...');

        setTimeout(() => {
            try {
                const revenueTrend = StatisticsService.getRevenueTrend(startDate, endDate, storeId);
                const storeComparison = StatisticsService.getStoreComparison(startDate, endDate);
                const serviceTypeRatio = StatisticsService.getServiceTypeRatio(startDate, endDate, storeId);
                const modelDistribution = StatisticsService.getModelDistribution(startDate, endDate, storeId);
                const peakHourHeatmap = StatisticsService.getPeakHourHeatmap(startDate, endDate, storeId);
                const technicianRanking = StatisticsService.getTechnicianRanking(startDate, endDate, storeId);

                updateSummaryCards(revenueTrend);
                renderRevenueChart(revenueTrend);
                renderStoreComparisonChart(storeComparison);
                renderServiceTypeChart(serviceTypeRatio);
                renderModelDistributionChart(modelDistribution);
                renderHeatmap(peakHourHeatmap);
                renderTechnicianChart(technicianRanking);

                const elapsed = performance.now() - startTime;
                if (elapsed > 1000) {
                    console.warn('Statistics rendering took', elapsed, 'ms, exceeds 1s limit');
                }
            } catch (e) {
                console.error('Error loading statistics:', e);
                Helpers.showToast('统计数据加载失败', 'error');
            } finally {
                Helpers.showLoading(false);
            }
        }, 50);
    }

    function updateSummaryCards(trend) {
        const totalRevenue = trend.reduce((sum, d) => sum + d.totalRevenue, 0);
        const laborRevenue = trend.reduce((sum, d) => sum + d.laborRevenue, 0);
        const materialRevenue = trend.reduce((sum, d) => sum + d.materialRevenue, 0);
        const totalOrders = trend.reduce((sum, d) => sum + d.orderCount, 0);
        const avgOrderAmount = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        $('#totalRevenue').text(Helpers.formatCurrency(totalRevenue));
        $('#totalOrders').text(totalOrders + ' 个工单');
        $('#laborRevenue').text(Helpers.formatCurrency(laborRevenue));
        $('#materialRevenue').text(Helpers.formatCurrency(materialRevenue));
        $('#avgOrderAmount').text(Helpers.formatCurrency(avgOrderAmount));

        const laborPercent = totalRevenue > 0 ? ((laborRevenue / totalRevenue) * 100).toFixed(1) : 0;
        const materialPercent = totalRevenue > 0 ? ((materialRevenue / totalRevenue) * 100).toFixed(1) : 0;

        $('#laborPercent').text('占比 ' + laborPercent + '%');
        $('#materialPercent').text('占比 ' + materialPercent + '%');
    }

    function renderRevenueChart(trend) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        if (revenueChart) revenueChart.destroy();

        revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: trend.map(d => d.date),
                datasets: [
                    {
                        label: '总营收',
                        data: trend.map(d => d.totalRevenue),
                        backgroundColor: 'rgba(30, 64, 175, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: '工时收入',
                        data: trend.map(d => d.laborRevenue),
                        backgroundColor: 'rgba(5, 150, 105, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: '材料收入',
                        data: trend.map(d => d.materialRevenue),
                        backgroundColor: 'rgba(217, 119, 6, 0.8)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '¥' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderStoreComparisonChart(comparison) {
        const ctx = document.getElementById('storeComparisonChart');
        if (!ctx) return;

        if (storeComparisonChart) storeComparisonChart.destroy();

        storeComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: comparison.map(d => d.storeName),
                datasets: [
                    {
                        label: '总营收',
                        data: comparison.map(d => d.totalRevenue),
                        backgroundColor: 'rgba(37, 99, 235, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: '工单数量',
                        data: comparison.map(d => d.orderCount * 100),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '¥' + value;
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: function(value) {
                                return (value / 100) + '单';
                            }
                        }
                    }
                }
            }
        });
    }

    function renderServiceTypeChart(ratio) {
        const ctx = document.getElementById('serviceTypeChart');
        if (!ctx) return;

        if (serviceTypeChart) serviceTypeChart.destroy();

        serviceTypeChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ratio.map(d => d.label + ' (' + d.percentage + '%)'),
                datasets: [{
                    data: ratio.map(d => d.revenue),
                    backgroundColor: ['#059669', '#d97706', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                return label + ': ' + Helpers.formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }

    function renderModelDistributionChart(distribution) {
        const ctx = document.getElementById('modelDistributionChart');
        if (!ctx) return;

        if (modelDistributionChart) modelDistributionChart.destroy();

        const colors = [
            'rgba(37, 99, 235, 0.8)',
            'rgba(5, 150, 105, 0.8)',
            'rgba(217, 119, 6, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(14, 165, 233, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(244, 63, 94, 0.8)'
        ];

        modelDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: distribution.map(d => d.brand),
                datasets: [{
                    label: '车辆数量',
                    data: distribution.map(d => d.count),
                    backgroundColor: colors.slice(0, distribution.length),
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    function renderHeatmap(heatmapData) {
        const container = $('#heatmapContainer');
        if (!container.length) return;

        const { data, maxCount, daysOfWeek, hours } = heatmapData;

        let html = '<div class="heatmap">';
        html += '<div class="heatmap-header">';
        html += '<div class="heatmap-cell heatmap-corner"></div>';
        hours.forEach(hour => {
            html += `<div class="heatmap-cell heatmap-hour">${hour}</div>`;
        });
        html += '</div>';

        daysOfWeek.forEach(day => {
            html += '<div class="heatmap-row">';
            html += `<div class="heatmap-cell heatmap-day">${day}</div>`;
            hours.forEach(hour => {
                const count = data[day]?.[hour] || 0;
                const intensity = maxCount > 0 ? count / maxCount : 0;
                const bgColor = getHeatmapColor(intensity);
                html += `<div class="heatmap-cell heatmap-value" style="background-color: ${bgColor};" title="${day} ${hour}: ${count}单">
                    ${count > 0 ? count : ''}
                </div>`;
            });
            html += '</div>';
        });

        html += '</div>';
        html += '<div class="heatmap-legend d-flex justify-content-center mt-3 align-items-center">';
        html += '<span class="me-2">少</span>';
        for (let i = 0; i <= 5; i++) {
            const intensity = i / 5;
            html += `<div class="heatmap-legend-cell" style="background-color: ${getHeatmapColor(intensity)};"></div>`;
        }
        html += '<span class="ms-2">多</span>';
        html += '</div>';

        container.html(html);
    }

    function getHeatmapColor(intensity) {
        if (intensity === 0) return '#f3f4f6';
        if (intensity < 0.2) return '#bfdbfe';
        if (intensity < 0.4) return '#60a5fa';
        if (intensity < 0.6) return '#3b82f6';
        if (intensity < 0.8) return '#2563eb';
        return '#1d4ed8';
    }

    function renderTechnicianChart(ranking) {
        const ctx = document.getElementById('technicianChart');
        if (!ctx) return;

        if (technicianChart) technicianChart.destroy();

        const labels = ranking.map(d => d.technicianName);
        const revenues = ranking.map(d => d.totalRevenue);
        const orderCounts = ranking.map(d => d.orderCount);

        technicianChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '营收',
                        data: revenues,
                        backgroundColor: 'rgba(37, 99, 235, 0.8)',
                        borderRadius: 4,
                        order: 1
                    },
                    {
                        label: '工单数量',
                        data: orderCounts,
                        type: 'line',
                        borderColor: '#f97316',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointBackgroundColor: '#f97316',
                        tension: 0.3,
                        yAxisID: 'y1',
                        order: 0
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '¥' + value;
                            }
                        }
                    },
                    x1: {
                        type: 'linear',
                        position: 'top',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    function bindEvents() {
        $('#btnApplyFilter').on('click', function() {
            loadStatistics();
        });

        $('#btnExportCSV').on('click', function() {
            const startDate = $('#startDate').val();
            const endDate = $('#endDate').val();
            const storeId = $('#filterStore').val() || null;

            const exportData = StatisticsService.getExportData('orders', startDate, endDate, storeId);
            StatisticsService.exportToCSV(exportData, '工单统计报表');
            Helpers.showToast('导出成功', 'success');
        });

        $('.btn-group [data-range]').on('click', function() {
            $('.btn-group [data-range]').removeClass('active');
            $(this).addClass('active');
            const range = $(this).data('range');
            updateDateRange(range);
        });
    }

    function updateDateRange(range) {
        const now = new Date();
        let start, end;

        switch (range) {
            case 'day':
                start = end = now;
                break;
            case 'week':
                start = new Date(now);
                start.setDate(now.getDate() - 7);
                end = now;
                break;
            case 'month':
                start = new Date(now);
                start.setDate(now.getDate() - 30);
                end = now;
                break;
        }

        $('#startDate').datepicker('setDate', start);
        $('#endDate').datepicker('setDate', end);
        loadStatistics();
    }

    function init() {
        $(document).off('dataSynced.statistics').on('dataSynced.statistics', function(e, data) {
            if (data.key === 'orders') {
                if ($('#main-content').find('#revenueChart').length > 0) {
                    loadStatistics();
                }
            }
        });
    }

    return {
        render,
        init
    };
})();
