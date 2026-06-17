const DashboardPage = (function() {
    let revenueChart = null;
    let statusChart = null;

    function render() {
        const storeId = DataStore.getCurrentStore();
        const stats = StatisticsService.getDashboardStats(storeId);

        const growthClass = stats.today.growth >= 0 ? 'text-success' : 'text-danger';
        const growthIcon = stats.today.growth >= 0 ? 'bi-arrow-up' : 'bi-arrow-down';

        const html = `
            <div class="fade-in">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">仪表盘</h1>
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <div class="btn-group me-2">
                            <button type="button" class="btn btn-sm btn-outline-secondary" onclick="location.hash='#/vehicle'">
                                <i class="bi bi-plus-circle me-1"></i>快速登记
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-secondary" onclick="location.hash='#/order'">
                                <i class="bi bi-list-ul me-1"></i>工单管理
                            </button>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-6 col-lg-3">
                        <div class="card h-100 stat-card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 class="text-muted mb-1">今日营收</h6>
                                        <h3 class="mb-0 text-primary fw-bold">${Helpers.formatCurrency(stats.today.revenue)}</h3>
                                        <small class="${growthClass}">
                                            <i class="${growthIcon}"></i> ${Math.abs(stats.today.growth)}% 较上周
                                        </small>
                                    </div>
                                    <div class="bg-primary bg-opacity-10 rounded-circle p-3">
                                        <i class="bi bi-currency-yen fs-3 text-primary"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card h-100 stat-card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 class="text-muted mb-1">本周营收</h6>
                                        <h3 class="mb-0 text-success fw-bold">${Helpers.formatCurrency(stats.week.revenue)}</h3>
                                        <small class="text-muted">${stats.week.orderCount} 个工单</small>
                                    </div>
                                    <div class="bg-success bg-opacity-10 rounded-circle p-3">
                                        <i class="bi bi-graph-up fs-3 text-success"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card h-100 stat-card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 class="text-muted mb-1">在修车辆</h6>
                                        <h3 class="mb-0 text-warning fw-bold">${stats.statusCounts.repairing}</h3>
                                        <small class="text-muted">待结算 ${stats.statusCounts.settlement} 台</small>
                                    </div>
                                    <div class="bg-warning bg-opacity-10 rounded-circle p-3">
                                        <i class="bi bi-tools fs-3 text-warning"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card h-100 stat-card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 class="text-muted mb-1">会员总数</h6>
                                        <h3 class="mb-0 text-info fw-bold">${stats.memberCount}</h3>
                                        <small class="text-muted">车辆档案 ${stats.vehicleCount} 台</small>
                                    </div>
                                    <div class="bg-info bg-opacity-10 rounded-circle p-3">
                                        <i class="bi bi-people fs-3 text-info"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-md-3 col-6">
                        <div class="card status-card pending-card cursor-pointer" onclick="location.hash='#/order?status=pending'">
                            <div class="card-body text-center">
                                <h4 class="display-4 text-secondary fw-bold">${stats.statusCounts.pending}</h4>
                                <p class="mb-0 text-secondary">待接车</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card status-card repairing-card cursor-pointer" onclick="location.hash='#/order?status=repairing'">
                            <div class="card-body text-center">
                                <h4 class="display-4 text-warning fw-bold">${stats.statusCounts.repairing}</h4>
                                <p class="mb-0 text-warning">维修中</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card status-card settlement-card cursor-pointer" onclick="location.hash='#/order?status=settlement'">
                            <div class="card-body text-center">
                                <h4 class="display-4 text-primary fw-bold">${stats.statusCounts.settlement}</h4>
                                <p class="mb-0 text-primary">待结算</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card status-card completed-card cursor-pointer" onclick="location.hash='#/order?status=completed'">
                            <div class="card-body text-center">
                                <h4 class="display-4 text-success fw-bold">${stats.statusCounts.completed}</h4>
                                <p class="mb-0 text-success">已完成</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3">
                    <div class="col-lg-8">
                        <div class="card h-100">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">营收趋势</h5>
                                <div class="btn-group btn-group-sm">
                                    <button type="button" class="btn btn-outline-primary active" data-range="week">本周</button>
                                    <button type="button" class="btn btn-outline-primary" data-range="month">本月</button>
                                </div>
                            </div>
                            <div class="card-body">
                                <canvas id="revenueChart" height="250"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">工单状态分布</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="statusChart" height="250"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mt-3">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">快捷操作</h5>
                            </div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-md-4 col-6">
                                        <button class="btn btn-outline-primary w-100 h-100 py-4 quick-action-btn" onclick="location.hash='#/vehicle'">
                                            <i class="bi bi-car-front fs-1 d-block mb-2"></i>
                                            <span>车辆登记</span>
                                        </button>
                                    </div>
                                    <div class="col-md-4 col-6">
                                        <button class="btn btn-outline-success w-100 h-100 py-4 quick-action-btn" onclick="showQuickOrderModal()">
                                            <i class="bi bi-plus-circle fs-1 d-block mb-2"></i>
                                            <span>新建工单</span>
                                        </button>
                                    </div>
                                    <div class="col-md-4 col-12">
                                        <button class="btn btn-outline-info w-100 h-100 py-4 quick-action-btn" onclick="showMemberSearchModal()">
                                            <i class="bi bi-person-search fs-1 d-block mb-2"></i>
                                            <span>会员查询</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#main-content').html(html);
        initCharts(stats);
        bindEvents();
    }

    function initCharts(stats) {
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx) {
            if (revenueChart) revenueChart.destroy();

            const weekTrend = stats.week.trend;
            revenueChart = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: weekTrend.map(d => d.date),
                    datasets: [
                        {
                            label: '总营收',
                            data: weekTrend.map(d => d.totalRevenue),
                            borderColor: '#1e40af',
                            backgroundColor: 'rgba(30, 64, 175, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: '工时收入',
                            data: weekTrend.map(d => d.laborRevenue),
                            borderColor: '#059669',
                            backgroundColor: 'transparent',
                            tension: 0.4,
                            borderDash: [5, 5]
                        },
                        {
                            label: '材料收入',
                            data: weekTrend.map(d => d.materialRevenue),
                            borderColor: '#d97706',
                            backgroundColor: 'transparent',
                            tension: 0.4,
                            borderDash: [5, 5]
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

        const statusCtx = document.getElementById('statusChart');
        if (statusCtx) {
            if (statusChart) statusChart.destroy();

            statusChart = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['待接车', '维修中', '待结算', '已完成'],
                    datasets: [{
                        data: [
                            stats.statusCounts.pending,
                            stats.statusCounts.repairing,
                            stats.statusCounts.settlement,
                            stats.statusCounts.completed
                        ],
                        backgroundColor: ['#6b7280', '#f97316', '#2563eb', '#16a34a'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    },
                    cutout: '60%'
                }
            });
        }
    }

    function bindEvents() {
        $('.btn-group [data-range]').on('click', function() {
            $('.btn-group [data-range]').removeClass('active');
            $(this).addClass('active');
            const range = $(this).data('range');
            updateRevenueChart(range);
        });
    }

    function updateRevenueChart(range) {
        const storeId = DataStore.getCurrentStore();
        const dateRange = Helpers.getDateRange(range);
        const trend = StatisticsService.getRevenueTrend(dateRange.start, dateRange.end, storeId);

        if (revenueChart) {
            revenueChart.data.labels = trend.map(d => d.date);
            revenueChart.data.datasets[0].data = trend.map(d => d.totalRevenue);
            revenueChart.data.datasets[1].data = trend.map(d => d.laborRevenue);
            revenueChart.data.datasets[2].data = trend.map(d => d.materialRevenue);
            revenueChart.update();
        }
    }

    function showQuickOrderModal() {
        location.hash = '#/order?action=create';
    }

    function showMemberSearchModal() {
        location.hash = '#/member';
    }

    function init() {
        $(document).off('dataSynced.dashboard').on('dataSynced.dashboard', function(e, data) {
            if (data.key === 'orders' || data.key === 'vehicles' || data.key === 'members') {
                render();
            }
        });

        $(document).off('orderStatusChanged.dashboard').on('orderStatusChanged.dashboard', function() {
            render();
        });
    }

    return {
        render,
        init
    };
})();
