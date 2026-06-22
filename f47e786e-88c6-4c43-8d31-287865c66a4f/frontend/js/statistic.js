const StatisticModule = {
    activeTab: 'overview',
    dateRange: 'year',
    charts: {},
    progressData: null,
    trainingStats: null,
    examStats: null,
    equipmentStats: null,
    overviewData: null,

    fireStations: [
        { id: 1, name: '一站' },
        { id: 2, name: '二站' },
        { id: 3, name: '三站' },
        { id: 4, name: '四站' },
        { id: 5, name: '五站' },
        { id: 6, name: '六站' },
        { id: 7, name: '七站' },
        { id: 8, name: '八站' }
    ],

    levels: [
        { id: 1, name: '初级' },
        { id: 2, name: '中级' },
        { id: 3, name: '高级' },
        { id: 4, name: '专家级' }
    ],

    specialties: [
        { id: 1, name: '灭火救援' },
        { id: 2, name: '抢险救援' },
        { id: 3, name: '水域救援' },
        { id: 4, name: '化工处置' },
        { id: 5, name: '火灾调查' }
    ],

    trainingCourses: [
        { id: 1, title: '基础灭火战术', specialtyId: 1, levelId: 1, duration: 24 },
        { id: 2, title: '高层建筑灭火', specialtyId: 1, levelId: 2, duration: 32 },
        { id: 3, title: '抢险救援基础', specialtyId: 2, levelId: 1, duration: 20 },
        { id: 4, title: '水域救援技术', specialtyId: 3, levelId: 2, duration: 40 },
        { id: 5, title: '化工事故处置', specialtyId: 4, levelId: 3, duration: 48 }
    ],

    practicalExams: [
        { id: 1, name: '一人三盘水带连接', specialtyId: 1, passScore: 60, fullScore: 100 },
        { id: 2, name: '百米障碍救助', specialtyId: 2, passScore: 60, fullScore: 100 },
        { id: 3, name: '救生抛投器操作', specialtyId: 3, passScore: 70, fullScore: 100 }
    ],

    firefighters: [
        { id: 1, name: '张三', stationId: 1, levelId: 1, theoryHours: { completed: 80, required: 100 }, practicalCount: { completed: 15, required: 20 }, examPassed: true },
        { id: 2, name: '李四', stationId: 1, levelId: 2, theoryHours: { completed: 120, required: 150 }, practicalCount: { completed: 25, required: 30 }, examPassed: true },
        { id: 3, name: '王五', stationId: 2, levelId: 1, theoryHours: { completed: 60, required: 100 }, practicalCount: { completed: 10, required: 20 }, examPassed: false },
        { id: 4, name: '赵六', stationId: 2, levelId: 3, theoryHours: { completed: 200, required: 200 }, practicalCount: { completed: 40, required: 40 }, examPassed: true }
    ],

    statistics: {
        overview: {
            totalFirefighters: 600,
            totalCourses: 85,
            totalExams: 120,
            totalEquipment: 500,
            passRate: 78.5,
            avgScore: 82.3
        }
    },

    init() {
        this.render();
    },

    render() {
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <h5 class="mb-0"><i class="bi bi-bar-chart me-2 text-primary"></i>数据统计</h5>
                </div>
                <div class="col-md-9 text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary active" data-range="month">月度</button>
                        <button class="btn btn-outline-primary" data-range="quarter">季度</button>
                        <button class="btn btn-outline-primary" data-range="year">年度</button>
                    </div>
                    <button class="btn btn-outline-secondary btn-sm ms-2" id="btn-export-report">
                        <i class="bi bi-download me-1"></i>导出报表
                    </button>
                </div>
            </div>

            <ul class="nav nav-tabs" id="stat-tabs">
                <li class="nav-item">
                    <button class="nav-link active" data-tab="overview">综合概览</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="training">培训统计</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="exam">考核统计</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="equipment">器材统计</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="progress">学习进度</button>
                </li>
            </ul>

            <div id="tab-overview" class="tab-content"></div>
            <div id="tab-training" class="tab-content d-none"></div>
            <div id="tab-exam" class="tab-content d-none"></div>
            <div id="tab-equipment" class="tab-content d-none"></div>
            <div id="tab-progress" class="tab-content d-none"></div>
        `;

        $('#page-statistic').html(html);
        this.bindEvents();
        this.renderOverview();
    },

    bindEvents() {
        const self = this;

        $('#stat-tabs .nav-link').on('click', function() {
            const tab = $(this).data('tab');
            self.activeTab = tab;
            
            $('#stat-tabs .nav-link').removeClass('active');
            $(this).addClass('active');
            
            $('.tab-content').addClass('d-none');
            $(`#tab-${tab}`).removeClass('d-none');

            switch (tab) {
                case 'overview':
                    self.renderOverview();
                    break;
                case 'training':
                    self.renderTrainingStats();
                    break;
                case 'exam':
                    self.renderExamStats();
                    break;
                case 'equipment':
                    self.renderEquipmentStats();
                    break;
                case 'progress':
                    self.renderProgressTracking();
                    break;
            }
        });

        $('[data-range]').on('click', function() {
            $('[data-range]').removeClass('active');
            $(this).addClass('active');
            self.dateRange = $(this).data('range');
            self.refreshCurrentTab();
        });

        $('#btn-export-report').on('click', () => {
            self.exportReport();
        });
    },

    refreshCurrentTab() {
        switch (this.activeTab) {
            case 'overview':
                this.renderOverview();
                break;
            case 'training':
                this.renderTrainingStats();
                break;
            case 'exam':
                this.renderExamStats();
                break;
            case 'equipment':
                this.renderEquipmentStats();
                break;
            case 'progress':
                this.renderProgressTracking();
                break;
        }
    },

    renderOverview() {
        const self = this;
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="stat-card bg-primary text-white position-relative">
                        <div class="card-body">
                            <div class="stat-value" id="ov-training-coverage">-</div>
                            <div class="stat-label text-white-50">培训覆盖率</div>
                            <i class="bi bi-people stat-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-success text-white position-relative">
                        <div class="card-body">
                            <div class="stat-value" id="ov-exam-pass-rate">-</div>
                            <div class="stat-label text-white-50">考核通过率</div>
                            <i class="bi bi-award stat-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-warning text-dark position-relative">
                        <div class="card-body">
                            <div class="stat-value" id="ov-eq-utilization">-</div>
                            <div class="stat-label text-dark-50">器材利用率</div>
                            <i class="bi bi-tools stat-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-info text-white position-relative">
                        <div class="card-body">
                            <div class="stat-value" id="ov-total-firefighters">-</div>
                            <div class="stat-label text-white-50">消防员总数</div>
                            <i class="bi bi-person-badge stat-icon"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>月度趋势对比</span>
                            <span class="small text-muted">2025年度</span>
                        </div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 300px;">
                                <canvas id="trendChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">各站点培训达标率</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 300px;">
                                <canvas id="stationChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3 mt-0">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">等级分布</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 250px;">
                                <canvas id="levelChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">专业方向分布</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 250px;">
                                <canvas id="specialtyChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#tab-overview').html(html);

        this.loadOverviewData(function(data) {
            if (data) {
                self.updateOverviewUI(data);
                self.initOverviewCharts(data);
            } else {
                const stats = this.statistics.overview;
                $('#ov-training-coverage').text(stats.trainingCoverage + '%');
                $('#ov-exam-pass-rate').text(stats.examPassRate + '%');
                $('#ov-eq-utilization').text(stats.equipmentUtilization + '%');
                $('#ov-total-firefighters').text(stats.totalFirefighters);
                self.initOverviewCharts(null);
            }
        });
    },

    updateOverviewUI(data) {
        $('#ov-training-coverage').text((data.trainingCoverage || 0) + '%');
        $('#ov-exam-pass-rate').text((data.examPassRate || 0) + '%');
        $('#ov-eq-utilization').text((data.equipmentUtilization || 0) + '%');
        $('#ov-total-firefighters').text(data.totalFirefighters || 0);
    },

    initOverviewCharts(data) {
        let trendLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        let coverageData = [65, 68, 72, 70, 75, 78, 80, 78, 82, 85, 87, 85];
        let passRateData = [60, 63, 68, 65, 70, 73, 75, 72, 78, 80, 82, 80];
        let utilizationData = [55, 58, 62, 60, 65, 68, 70, 68, 72, 75, 78, 76];

        if (data && data.monthlyTrend && data.monthlyTrend.length > 0) {
            trendLabels = data.monthlyTrend.map(d => d.periodLabel || d.month + '月');
            coverageData = data.monthlyTrend.map(d => d.trainingCoverage || d.coverage || 0);
            passRateData = data.monthlyTrend.map(d => d.examPassRate || d.passRate || 0);
            utilizationData = data.monthlyTrend.map(d => d.equipmentUtilization || d.utilization || 0);
        }

        const trendCtx = document.getElementById('trendChart');
        if (trendCtx) {
            this.charts.trend = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: trendLabels,
                    datasets: [
                        {
                            label: '培训覆盖率',
                            data: coverageData,
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: '考核通过率',
                            data: passRateData,
                            borderColor: '#198754',
                            backgroundColor: 'rgba(25, 135, 84, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: '器材利用率',
                            data: utilizationData,
                            borderColor: '#ffc107',
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            fill: true,
                            tension: 0.4
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
                            beginAtZero: false,
                            min: 40,
                            max: 100,
                            ticks: {
                                callback: value => value + '%'
                            }
                        }
                    }
                }
            });
        }

        let stationLabels = ['第一中队', '第二中队', '第三中队', '第四中队', '第五中队', '第六中队', '第七中队', '第八中队'];
        let stationCoverage = [85, 78, 82, 90, 75, 88, 80, 72];
        let stationPassRate = [80, 72, 78, 85, 70, 82, 75, 68];

        if (data && data.byStation && data.byStation.length > 0) {
            stationLabels = data.byStation.map(d => d.stationName || d.station);
            stationCoverage = data.byStation.map(d => d.coverageRate || d.coverage || 0);
            stationPassRate = data.byStation.map(d => d.passRate || 0);
        }

        const stationCtx = document.getElementById('stationChart');
        if (stationCtx) {
            this.charts.station = new Chart(stationCtx, {
                type: 'bar',
                data: {
                    labels: stationLabels,
                    datasets: [
                        {
                            label: '培训覆盖率',
                            data: stationCoverage,
                            backgroundColor: '#0d6efd'
                        },
                        {
                            label: '考核通过率',
                            data: stationPassRate,
                            backgroundColor: '#198754'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: value => value + '%'
                            }
                        }
                    }
                }
            });
        }

        let levelLabels = ['一级', '二级', '三级', '四级'];
        let levelCounts = [50, 150, 250, 150];

        if (data && data.byLevel && data.byLevel.length > 0) {
            levelLabels = data.byLevel.map(d => d.levelName || d.level);
            levelCounts = data.byLevel.map(d => d.firefighterCount || d.count || 0);
        }

        const levelCtx = document.getElementById('levelChart');
        if (levelCtx) {
            this.charts.level = new Chart(levelCtx, {
                type: 'doughnut',
                data: {
                    labels: levelLabels,
                    datasets: [{
                        data: levelCounts,
                        backgroundColor: ['#0dcaf0', '#198754', '#ffc107', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }

        let specialtyLabels = ['灭火战斗', '抢险救援', '危化品处置', '水域救援', '森林消防'];
        let specialtyCounts = [200, 150, 100, 80, 70];

        if (data && data.bySpecialty && data.bySpecialty.length > 0) {
            specialtyLabels = data.bySpecialty.map(d => d.specialtyName || d.specialty || d.name);
            specialtyCounts = data.bySpecialty.map(d => d.firefighterCount || d.count || 0);
        }

        const specialtyCtx = document.getElementById('specialtyChart');
        if (specialtyCtx) {
            this.charts.specialty = new Chart(specialtyCtx, {
                type: 'pie',
                data: {
                    labels: specialtyLabels,
                    datasets: [{
                        data: specialtyCounts,
                        backgroundColor: ['#dc3545', '#ffc107', '#0d6efd', '#0dcaf0', '#198754']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }
    },

    renderTrainingStats() {
        const self = this;
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-primary" id="stat-total-courses">-</div>
                                    <div class="small text-muted">本期培训计划</div>
                                </div>
                                <i class="bi bi-calendar-check fs-1 text-primary opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-success" id="stat-completed-courses">-</div>
                                    <div class="small text-muted">已完成课程</div>
                                </div>
                                <i class="bi bi-check2-circle fs-1 text-success opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-warning" id="stat-total-hours">-</div>
                                    <div class="small text-muted">累计学时</div>
                                </div>
                                <i class="bi bi-clock-history fs-1 text-warning opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-info" id="stat-training-coverage">-</div>
                                    <div class="small text-muted">培训覆盖率</div>
                                </div>
                                <i class="bi bi-play-circle fs-1 text-info opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">培训时长趋势</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 300px;">
                                <canvas id="trainingHoursChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">专业方向分布</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 300px;">
                                <canvas id="courseTypeChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mt-3">
                <div class="card-header">各站点培训完成情况</div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>站点</th>
                                <th>应参训人数</th>
                                <th>实参训人数</th>
                                <th>培训覆盖率</th>
                                <th>平均学时</th>
                                <th>达标率</th>
                            </tr>
                        </thead>
                        <tbody id="training-station-table-body">
                            ${self.getLoadingHtml(6)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        $('#tab-training').html(html);

        this.loadTrainingStats(function(stats) {
            if (stats) {
                self.updateTrainingStatsUI(stats);
                self.initTrainingCharts(stats);
            } else {
                $('#stat-total-courses').text(this.trainingCourses.length);
                $('#stat-completed-courses').text(Math.floor(this.trainingCourses.length * 0.75));
                $('#stat-total-hours').text('-');
                $('#stat-training-coverage').text('85%');
                self.initTrainingCharts(null);
            }
        });
    },

    updateTrainingStatsUI(stats) {
        $('#stat-total-courses').text(stats.totalCourses || 0);
        $('#stat-completed-courses').text(stats.completedCourses || 0);
        $('#stat-total-hours').text(stats.averageHours ? Math.round(stats.averageHours * 10) : 0);
        $('#stat-training-coverage').text((stats.trainingCoverage || 0) + '%');

        if (stats.byStation && stats.byStation.length > 0) {
            $('#training-station-table-body').html(stats.byStation.map(s => {
                const coverage = Math.round(s.coverageRate || 0);
                const passRate = Math.round(s.passRate || 0);
                const actualCount = Math.round((s.firefighterCount || 0) * coverage / 100);
                const badgeClass = passRate >= 80 ? 'bg-success' : passRate >= 70 ? 'bg-warning text-dark' : 'bg-danger';
                return `
                    <tr>
                        <td class="fw-medium">${s.stationName || '-'}</td>
                        <td>${s.firefighterCount || 0}</td>
                        <td>${actualCount}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="flex-grow-1 me-2">
                                    <div class="progress" style="height: 6px;">
                                        <div class="progress-bar bg-primary" style="width: ${coverage}%"></div>
                                    </div>
                                </div>
                                <span class="small fw-medium">${coverage}%</span>
                            </div>
                        </td>
                        <td>${s.averageHours ? Math.round(s.averageHours) : '-'}</td>
                        <td><span class="badge ${badgeClass}">${passRate}%</span></td>
                    </tr>
                `;
            }).join(''));
        }
    },

    initTrainingCharts(stats) {
        const hoursCtx = document.getElementById('trainingHoursChart');
        if (hoursCtx) {
            let labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            let theoryData = [800, 850, 900, 870, 920, 950, 890, 910, 940, 960, 980, 1000];
            let practicalData = [600, 650, 700, 680, 720, 750, 710, 730, 760, 780, 800, 820];

            if (stats && stats.trendData && stats.trendData.length > 0) {
                labels = stats.trendData.map(d => d.periodLabel || d.month + '月');
                theoryData = stats.trendData.map(d => d.theoryHours || 0);
                practicalData = stats.trendData.map(d => d.practicalHours || 0);
            }

            new Chart(hoursCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '理论学时',
                            data: theoryData,
                            backgroundColor: '#0d6efd'
                        },
                        {
                            label: '实操学时',
                            data: practicalData,
                            backgroundColor: '#198754'
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
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        const typeCtx = document.getElementById('courseTypeChart');
        if (typeCtx) {
            let specialtyLabels = ['灭火战斗', '抢险救援', '危化品处置', '水域救援', '森林消防'];
            let specialtyData = [45, 35, 12, 8, 0];

            if (stats && stats.bySpecialty && stats.bySpecialty.length > 0) {
                specialtyLabels = stats.bySpecialty.map(s => s.specialtyName || s.name);
                specialtyData = stats.bySpecialty.map(s => s.courseCount || s.count || 0);
            }

            new Chart(typeCtx, {
                type: 'doughnut',
                data: {
                    labels: specialtyLabels,
                    datasets: [{
                        data: specialtyData,
                        backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#6f42c1', '#0dcaf0']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }
    },

    renderExamStats() {
        const self = this;
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-success" id="stat-exam-pass-rate">-</div>
                                    <div class="small text-muted">总体通过率</div>
                                </div>
                                <i class="bi bi-award fs-1 text-success opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-primary" id="stat-exam-count">-</div>
                                    <div class="small text-muted">本期考试场次</div>
                                </div>
                                <i class="bi bi-file-earmark-text fs-1 text-primary opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-warning" id="stat-exam-takers">-</div>
                                    <div class="small text-muted">参考人次</div>
                                </div>
                                <i class="bi bi-people fs-1 text-warning opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-md-7">
                    <div class="card">
                        <div class="card-header">各等级通过率对比</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 280px;">
                                <canvas id="levelPassChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-5">
                    <div class="card">
                        <div class="card-header">理论 vs 实操通过率</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 280px;">
                                <canvas id="theoryVsPracticalChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mt-3">
                <div class="card-header">各专业考核情况</div>
                <div class="card-body">
                    <div class="row g-3" id="exam-specialty-cards">
                        ${self.getExamSpecialtySkeletons()}
                    </div>
                </div>
            </div>
        `;

        $('#tab-exam').html(html);

        this.loadExamStats(function(stats) {
            if (stats) {
                self.updateExamStatsUI(stats);
                self.initExamCharts(stats);
            } else {
                $('#stat-exam-pass-rate').text('78.3%');
                $('#stat-exam-count').text('42');
                $('#stat-exam-takers').text('1,256');
                self.initExamCharts(null);
            }
        });
    },

    getExamSpecialtySkeletons() {
        let html = '';
        for (let i = 0; i < 6; i++) {
            html += `
                <div class="col-md-4 col-lg-2">
                    <div class="text-center p-3 border rounded">
                        <div class="skeleton-icon mb-2"></div>
                        <div class="skeleton-text fw-bold mb-1"></div>
                        <div class="skeleton-text small mb-2"></div>
                        <div class="skeleton-text fs-4 fw-bold"></div>
                    </div>
                </div>
            `;
        }
        return html;
    },

    updateExamStatsUI(stats) {
        $('#stat-exam-pass-rate').text((stats.passRate || 0) + '%');
        $('#stat-exam-count').text(stats.totalExams || 0);
        $('#stat-exam-takers').text(stats.totalTakers || 0);

        if (stats.bySpecialty && stats.bySpecialty.length > 0) {
            const colors = ['primary', 'success', 'warning', 'info', 'danger', 'purple'];
            const icons = ['fire', 'shield-exclamation', 'droplet-half', 'water', 'tree', 'gear'];
            $('#exam-specialty-cards').html(stats.bySpecialty.map((s, i) => {
                const passRate = Math.round(s.passRate || 0);
                const passColor = passRate >= 80 ? 'success' : passRate >= 70 ? 'warning' : 'danger';
                return `
                    <div class="col-md-4 col-lg-2">
                        <div class="text-center p-3 border rounded">
                            <div class="fs-1 text-${colors[i % colors.length]} mb-2">
                                <i class="bi bi-${icons[i % icons.length]}"></i>
                            </div>
                            <div class="fw-bold">${s.specialtyName || '-'}</div>
                            <div class="text-muted small mb-2">${s.takerCount || 0}人参考</div>
                            <div class="fs-4 fw-bold text-${passColor}">${passRate}%</div>
                            <div class="small text-muted">通过率</div>
                            <div class="mt-2">
                                <div class="progress" style="height: 4px;">
                                    <div class="progress-bar bg-${colors[i % colors.length]}" style="width: ${passRate}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join(''));
        }
    },

    initExamCharts(stats) {
        const levelPassCtx = document.getElementById('levelPassChart');
        if (levelPassCtx) {
            let levelLabels = ['一级', '二级', '三级', '四级'];
            let levelPassRates = [75, 80, 85, 70];

            if (stats && stats.byLevel && stats.byLevel.length > 0) {
                levelLabels = stats.byLevel.map(d => d.levelName || d.level);
                levelPassRates = stats.byLevel.map(d => Math.round(d.passRate || 0));
            }

            new Chart(levelPassCtx, {
                type: 'bar',
                data: {
                    labels: levelLabels,
                    datasets: [
                        {
                            label: '通过率',
                            data: levelPassRates,
                            backgroundColor: ['#0dcaf0', '#198754', '#ffc107', '#dc3545']
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: value => value + '%'
                            }
                        }
                    }
                }
            });
        }

        const vsCtx = document.getElementById('theoryVsPracticalChart');
        if (vsCtx) {
            let specialtyLabels = ['灭火战斗', '抢险救援', '危化品处置', '水域救援', '森林消防'];
            let theoryData = [80, 75, 85, 70, 78];
            let practicalData = [75, 82, 72, 85, 70];

            if (stats && stats.bySpecialty && stats.bySpecialty.length > 0) {
                specialtyLabels = stats.bySpecialty.map(s => s.specialtyName || s.name);
                theoryData = stats.bySpecialty.map(s => Math.round(s.theoryPassRate || s.passRate || 0));
                practicalData = stats.bySpecialty.map(s => Math.round(s.practicalPassRate || s.passRate || 0));
            }

            new Chart(vsCtx, {
                type: 'radar',
                data: {
                    labels: specialtyLabels,
                    datasets: [
                        {
                            label: '理论通过率',
                            data: theoryData,
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.2)',
                            fill: true
                        },
                        {
                            label: '实操通过率',
                            data: practicalData,
                            borderColor: '#198754',
                            backgroundColor: 'rgba(25, 135, 84, 0.2)',
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    },
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                stepSize: 20
                            }
                        }
                    }
                }
            });
        }
    },

    renderEquipmentStats() {
        const self = this;
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-primary" id="stat-eq-usage-rate">-</div>
                                    <div class="small text-muted">整体利用率</div>
                                </div>
                                <i class="bi bi-graph-up fs-1 text-primary opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-success" id="stat-eq-total">-</div>
                                    <div class="small text-muted">总器材数</div>
                                </div>
                                <i class="bi bi-boxes fs-1 text-success opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-warning" id="stat-eq-maintenance">-</div>
                                    <div class="small text-muted">维护中</div>
                                </div>
                                <i class="bi bi-wrench fs-1 text-warning opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-info" id="stat-eq-reservations">-</div>
                                    <div class="small text-muted">本月预约次数</div>
                                </div>
                                <i class="bi bi-calendar-check fs-1 text-info opacity-30"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">器材利用率趋势</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 280px;">
                                <canvas id="equipmentUsageChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">器材分类占比</div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 280px;">
                                <canvas id="equipmentCategoryChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mt-3">
                <div class="card-header">器材使用排行</div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>排名</th>
                                <th>器材名称</th>
                                <th>分类</th>
                                <th>总数</th>
                                <th>使用次数</th>
                                <th>利用率</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody id="equipment-ranking-body">
                            ${self.getLoadingHtml(7)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        $('#tab-equipment').html(html);

        this.loadEquipmentStats(function(stats) {
            if (stats) {
                self.updateEquipmentStatsUI(stats);
                self.initEquipmentCharts(stats);
            } else {
                $('#stat-eq-usage-rate').text('68.7%');
                $('#stat-eq-total').text('156');
                $('#stat-eq-maintenance').text('5');
                $('#stat-eq-reservations').text('328');
                self.initEquipmentCharts(null);
            }
        });
    },

    updateEquipmentStatsUI(stats) {
        $('#stat-eq-usage-rate').text((stats.overallUsageRate || 0) + '%');
        $('#stat-eq-total').text(stats.totalEquipment || 0);
        $('#stat-eq-maintenance').text(stats.maintenanceCount || 0);
        $('#stat-eq-reservations').text(stats.monthlyReservations || 0);

        if (stats.usageRanking && stats.usageRanking.length > 0) {
            $('#equipment-ranking-body').html(stats.usageRanking.map((eq, idx) => {
                const usage = Math.round(eq.usageRate || 0);
                const progressClass = usage >= 80 ? 'bg-danger' : usage >= 60 ? 'bg-warning' : 'bg-success';
                const statusClass = eq.status === 'maintenance' ? 'bg-warning' : 'bg-success';
                const statusText = eq.status === 'maintenance' ? '维护中' : '正常';
                const rankBadge = idx < 3 ? 'bg-warning text-dark' : 'bg-secondary';
                return `
                    <tr>
                        <td><span class="badge ${rankBadge}">${idx + 1}</span></td>
                        <td class="fw-medium">${eq.equipmentName || eq.name || '-'}</td>
                        <td>${eq.categoryName || eq.category || '-'}</td>
                        <td>${eq.totalQty || 0} ${eq.unit || ''}</td>
                        <td>${eq.useCount || 0}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="flex-grow-1 me-2" style="max-width: 120px;">
                                    <div class="progress" style="height: 6px;">
                                        <div class="progress-bar ${progressClass}" style="width: ${usage}%"></div>
                                    </div>
                                </div>
                                <span class="small fw-medium">${usage}%</span>
                            </div>
                        </td>
                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                    </tr>
                `;
            }).join(''));
        }
    },

    initEquipmentCharts(stats) {
        const usageCtx = document.getElementById('equipmentUsageChart');
        if (usageCtx) {
            let labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            let datasets = [
                { label: '呼吸防护类', data: [60, 62, 65, 63, 68, 70, 72, 70, 75, 78, 80, 78], borderColor: '#0d6efd', tension: 0.4, fill: false },
                { label: '破拆器材类', data: [50, 52, 55, 58, 60, 62, 65, 63, 68, 70, 72, 70], borderColor: '#198754', tension: 0.4, fill: false },
                { label: '水域救援类', data: [45, 48, 52, 50, 55, 58, 60, 62, 58, 55, 50, 48], borderColor: '#0dcaf0', tension: 0.4, fill: false },
                { label: '搜救装备类', data: [55, 58, 60, 62, 65, 63, 68, 70, 72, 70, 73, 75], borderColor: '#ffc107', tension: 0.4, fill: false }
            ];

            if (stats && stats.trendData && stats.trendData.length > 0) {
                labels = stats.trendData.map(d => d.periodLabel || d.month + '月');
                const categories = [...new Set(stats.trendData.map(d => d.categoryName || d.category))].filter(Boolean);
                if (categories.length > 0) {
                    datasets = categories.map((cat, i) => {
                        const colors = ['#0d6efd', '#198754', '#0dcaf0', '#ffc107', '#6f42c1', '#dc3545'];
                        const catData = stats.trendData
                            .filter(d => (d.categoryName || d.category) === cat)
                            .map(d => Math.round(d.usageRate || 0));
                        return {
                            label: cat,
                            data: catData,
                            borderColor: colors[i % colors.length],
                            tension: 0.4,
                            fill: false
                        };
                    });
                }
            }

            new Chart(usageCtx, {
                type: 'line',
                data: { labels: labels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { callback: value => value + '%' }
                        }
                    }
                }
            });
        }

        const catCtx = document.getElementById('equipmentCategoryChart');
        if (catCtx) {
            let catLabels = ['呼吸防护', '破拆器材', '水域救援', '搜救装备', '防护装备', '灭火装备'];
            let catData = [50, 20, 8, 6, 200, 15];
            let catColors = [
                'rgba(13, 110, 253, 0.7)',
                'rgba(25, 135, 84, 0.7)',
                'rgba(13, 202, 240, 0.7)',
                'rgba(255, 193, 7, 0.7)',
                'rgba(13, 202, 240, 0.5)',
                'rgba(220, 53, 69, 0.7)'
            ];

            if (stats && stats.byCategory && stats.byCategory.length > 0) {
                catLabels = stats.byCategory.map(c => c.categoryName || c.name || '-');
                catData = stats.byCategory.map(c => c.count || c.totalQty || 0);
            }

            new Chart(catCtx, {
                type: 'polarArea',
                data: {
                    labels: catLabels,
                    datasets: [{
                        data: catData,
                        backgroundColor: catColors
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { boxWidth: 12, font: { size: 11 } }
                        }
                    }
                }
            });
        }
    },

    renderProgressTracking() {
        const self = this;
        const html = `
            <div class="card mb-3">
                <div class="card-header">
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <div class="flex-grow-1">
                            <h6 class="mb-0">学习进度追踪</h6>
                        </div>
                        <select class="form-select form-select-sm" style="width: auto;" id="progress-filter-station">
                            <option value="">全部站点</option>
                            ${this.fireStations.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                        <select class="form-select form-select-sm" style="width: auto;" id="progress-filter-level">
                            <option value="">全部等级</option>
                            ${this.levels.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                        </select>
                        <select class="form-select form-select-sm" style="width: auto;" id="progress-filter-status">
                            <option value="">全部状态</option>
                            <option value="warning">未达标预警</option>
                            <option value="normal">达标</option>
                        </select>
                        <input type="text" class="form-control form-control-sm" style="width: 150px;" id="progress-search" placeholder="搜索姓名...">
                    </div>
                </div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>所属站点</th>
                                <th>等级</th>
                                <th>理论学时</th>
                                <th>实操训练</th>
                                <th>考核状态</th>
                                <th>综合进度</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody id="progress-table-body">
                            <tr><td colspan="8" class="text-center text-muted py-4"><i class="bi bi-hourglass-split me-1"></i>加载中...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <span class="small text-muted" id="progress-total-count">共 0 人</span>
                    <nav>
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item disabled"><a class="page-link" href="#">上一页</a></li>
                            <li class="page-item active"><a class="page-link" href="#">1</a></li>
                            <li class="page-item"><a class="page-link" href="#">下一页</a></li>
                        </ul>
                    </nav>
                </div>
            </div>
        `;

        $('#tab-progress').html(html);

        self.loadProgressData(function(data) {
            if (data && Array.isArray(data) && data.length > 0) {
                self.progressData = data.map(f => self.normalizeProgressData(f));
            } else {
                self.progressData = this.firefighters;
            }
            $('#progress-table-body').html(self.renderProgressRows(self.progressData));
            $('#progress-total-count').text(`共 ${self.progressData.length} 人`);
        });

        $('#progress-search').on('input', AppCommon.debounce(() => {
            this.filterProgress();
        }, 300));

        $('#progress-filter-station, #progress-filter-level, #progress-filter-status').on('change', () => {
            this.filterProgress();
        });
    },

    normalizeProgressData(f) {
        return {
            id: f.id || f.firefighterId,
            name: f.name || f.firefighterName || '未知',
            stationId: f.stationId || f.fireStationId,
            stationName: f.stationName || f.fireStationName || this.fireStations.find(s => s.id === f.stationId)?.name || '',
            levelId: f.levelId || 1,
            levelName: f.levelName || this.levels.find(l => l.id === (f.levelId || 1))?.name || '',
            theoryHours: f.theoryHours || { completed: f.theoryCompletedHours || 0, required: f.theoryRequiredHours || 120 },
            practicalCount: f.practicalCount || { completed: f.practicalCompletedCount || 0, required: f.practicalRequiredCount || 30 },
            examPassed: f.examPassed !== undefined ? f.examPassed : (f.examStatus === 'passed')
        };
    },

    renderProgressRows(firefighters) {
        return firefighters.map(f => {
            const theoryPercent = Math.round(f.theoryHours.completed / f.theoryHours.required * 100);
            const practicalPercent = Math.round(f.practicalCount.completed / f.practicalCount.required * 100);
            const overallPercent = Math.round((theoryPercent + practicalPercent) / 2);
            
            const isWarning = overallPercent < 70 || !f.examPassed;
            
            return `
                <tr class="${isWarning ? 'table-warning' : ''}">
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" 
                                 style="width: 32px; height: 32px; font-size: 0.85rem;">
                                ${f.name.charAt(0)}
                            </div>
                            <span class="fw-medium">${f.name}</span>
                        </div>
                    </td>
                    <td>${f.stationName}</td>
                    <td>
                        <span class="badge bg-${AppCommon.getLevelColor(f.levelId)}">${f.levelName}</span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="flex-grow-1 me-2" style="min-width: 80px;">
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar ${theoryPercent >= 80 ? 'bg-success' : theoryPercent >= 60 ? 'bg-warning' : 'bg-danger'}" 
                                         style="width: ${theoryPercent}%"></div>
                                </div>
                            </div>
                            <span class="small" style="min-width: 55px;">${f.theoryHours.completed}/${f.theoryHours.required}</span>
                        </div>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="flex-grow-1 me-2" style="min-width: 80px;">
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar ${practicalPercent >= 80 ? 'bg-success' : practicalPercent >= 60 ? 'bg-warning' : 'bg-danger'}" 
                                         style="width: ${practicalPercent}%"></div>
                                </div>
                            </div>
                            <span class="small" style="min-width: 55px;">${f.practicalCount.completed}/${f.practicalCount.required}</span>
                        </div>
                    </td>
                    <td>
                        <span class="badge ${f.examPassed ? 'bg-success' : 'bg-danger'}">
                            ${f.examPassed ? '已通过' : '未通过'}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="flex-grow-1 me-2" style="min-width: 100px;">
                                <div class="progress" style="height: 8px;">
                                    <div class="progress-bar ${overallPercent >= 80 ? 'bg-success' : overallPercent >= 60 ? 'bg-warning' : 'bg-danger'}" 
                                         style="width: ${overallPercent}%"></div>
                                </div>
                            </div>
                            <span class="fw-bold" style="min-width: 45px;">${overallPercent}%</span>
                        </div>
                    </td>
                    <td>
                        ${isWarning 
                            ? '<span class="badge bg-danger"><i class="bi bi-exclamation-triangle me-1"></i>预警</span>' 
                            : '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>正常</span>'
                        }
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterProgress() {
        const keyword = $('#progress-search').val().toLowerCase();
        const station = $('#progress-filter-station').val();
        const level = $('#progress-filter-level').val();
        const status = $('#progress-filter-status').val();

        let firefighters = this.progressData || this.firefighters;

        if (keyword) {
            firefighters = firefighters.filter(f => f.name.toLowerCase().includes(keyword));
        }
        if (station) {
            firefighters = firefighters.filter(f => f.stationId == station);
        }
        if (level) {
            firefighters = firefighters.filter(f => f.levelId == level);
        }
        if (status) {
            firefighters = firefighters.filter(f => {
                const theoryPercent = f.theoryHours.completed / f.theoryHours.required;
                const practicalPercent = f.practicalCount.completed / f.practicalCount.required;
                const overall = (theoryPercent + practicalPercent) / 2;
                const isWarning = overall < 0.7 || !f.examPassed;
                return status === 'warning' ? isWarning : !isWarning;
            });
        }

        $('#progress-table-body').html(this.renderProgressRows(firefighters));
    },

    exportReport() {
        const params = new URLSearchParams({
            type: this.activeTab,
            dateRange: this.dateRange,
            format: 'csv'
        });

        const url = `/api/Statistic/export?${params.toString()}`;
        
        $.ajax({
            url: url,
            method: 'GET',
            xhrFields: {
                responseType: 'blob'
            },
            success: function(data, status, xhr) {
                const disposition = xhr.getResponseHeader('Content-Disposition');
                let filename = 'report.csv';
                if (disposition) {
                    const matches = disposition.match(/filename="?([^"]+)"?/);
                    if (matches) filename = matches[1];
                }

                const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                AppCommon.showAlert('报表导出成功', 'success');
            },
            error: function() {
                const csvContent = StatisticModule.generateMockCSV();
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `${StatisticModule.activeTab}_report_${StatisticModule.dateRange}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                AppCommon.showAlert('报表导出成功（本地模式）', 'warning');
            }
        });
    },

    generateMockCSV() {
        let csv = '';
        if (this.activeTab === 'training') {
            csv = '课程名称,专业方向,等级,学时数,排课次数\n';
            this.trainingCourses.forEach((c, i) => {
                csv += `${c.title},${this.specialties.find(s => s.id === c.specialtyId)?.name || ''},${this.levels.find(l => l.id === c.levelId)?.name || ''},${c.duration},${(i % 5) + 1}\n`;
            });
        } else if (this.activeTab === 'exam') {
            csv = '考试名称,类型,参考人数,平均分,通过率\n';
            this.practicalExams.forEach((e, i) => {
                const avgScore = (65 + (i * 3) % 20).toFixed(1);
                const passRate = (70 + (i * 2) % 25).toFixed(1);
                csv += `${e.name},实操,${30 + i * 5},${avgScore},${passRate}%\n`;
            });
        } else {
            csv = '姓名,所属站点,等级,理论学时完成,实操次数完成,是否通过考试\n';
            this.firefighters.slice(0, 10).forEach(f => {
                csv += `${f.name},${this.fireStations.find(s => s.id === f.stationId)?.name || ''},${this.levels.find(l => l.id === f.levelId)?.name || ''},${f.theoryHours.completed}/${f.theoryHours.required},${f.practicalCount.completed}/${f.practicalCount.required},${f.examPassed ? '是' : '否'}\n`;
            });
        }
        return csv;
    },

    loadProgressData(callback) {
        const self = this;
        $.ajax({
            url: '/api/Statistic/progress',
            method: 'GET',
            data: self.getFilterParams(),
            success: function(data) {
                var list = data.data || data.firefighters || data;
                if (!Array.isArray(list)) list = [];
                callback(list);
            },
            error: function() {
                callback(null);
            }
        });
    },

    getFilterParams() {
        const params = {};
        const now = new Date();

        switch (this.dateRange) {
            case 'month':
                params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                params.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                params.startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
                params.endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0).toISOString();
                break;
            case 'year':
                params.startDate = new Date(now.getFullYear(), 0, 1).toISOString();
                params.endDate = new Date(now.getFullYear(), 11, 31).toISOString();
                break;
        }

        return params;
    },

    loadTrainingStats(callback) {
        const self = this;
        $.ajax({
            url: '/api/Statistic/training',
            method: 'GET',
            data: self.getFilterParams(),
            success: function(data) {
                self.trainingStats = data;
                callback(data);
            },
            error: function() {
                callback(null);
            }
        });
    },

    loadExamStats(callback) {
        const self = this;
        $.ajax({
            url: '/api/Statistic/exam',
            method: 'GET',
            data: self.getFilterParams(),
            success: function(data) {
                self.examStats = data;
                callback(data);
            },
            error: function() {
                callback(null);
            }
        });
    },

    loadEquipmentStats(callback) {
        const self = this;
        $.ajax({
            url: '/api/Statistic/equipment',
            method: 'GET',
            data: self.getFilterParams(),
            success: function(data) {
                self.equipmentStats = data;
                callback(data);
            },
            error: function() {
                callback(null);
            }
        });
    },

    loadOverviewData(callback) {
        const self = this;
        $.ajax({
            url: '/api/Statistic/overview',
            method: 'GET',
            data: self.getFilterParams(),
            success: function(data) {
                self.overviewData = data;
                self.trainingStats = data.trainingStats;
                self.examStats = data.examStats;
                self.equipmentStats = data.equipmentStats;
                callback(data);
            },
            error: function() {
                callback(null);
            }
        });
    },

    getLoadingHtml(cols) {
        return `<tr><td colspan="${cols}" class="text-center text-muted py-4">
            <i class="bi bi-hourglass-split me-1"></i>加载中...
        </td></tr>`;
    }
};
