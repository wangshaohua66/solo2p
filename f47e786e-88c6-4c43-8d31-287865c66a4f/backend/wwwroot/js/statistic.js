const StatisticModule = {
    activeTab: 'overview',
    dateRange: 'year',
    charts: {},
    progressData: null,

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
        const stats = MockData.statistics.overview;
        
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="stat-card bg-primary text-white position-relative">
                        <div class="card-body">
                            <div class="stat-value">${stats.trainingCoverage}%</div>
                            <div class="stat-label text-white-50">培训覆盖率</div>
                            <i class="bi bi-people stat-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-success text-white position-relative">
                        <div class="card-body">
                            <div class="stat-value">${stats.examPassRate}%</div>
                            <div class="stat-label text-white-50">考核通过率</div>
                            <i class="bi bi-award stat-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-warning text-dark position-relative">
                        <div class="card-body">
                            <div class="stat-value">${stats.equipmentUtilization}%</div>
                            <div class="stat-label text-dark-50">器材利用率</div>
                            <i class="bi bi-tools stat-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-info text-white position-relative">
                        <div class="card-body">
                            <div class="stat-value">${stats.totalFirefighters}</div>
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
        this.initOverviewCharts();
    },

    initOverviewCharts() {
        const trendData = MockData.statistics.monthlyTrend;
        
        const trendCtx = document.getElementById('trendChart');
        if (trendCtx) {
            this.charts.trend = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: trendData.map(d => d.month),
                    datasets: [
                        {
                            label: '培训覆盖率',
                            data: trendData.map(d => d.coverage),
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: '考核通过率',
                            data: trendData.map(d => d.passRate),
                            borderColor: '#198754',
                            backgroundColor: 'rgba(25, 135, 84, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: '器材利用率',
                            data: trendData.map(d => d.utilization),
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

        const stationData = MockData.statistics.byStation;
        const stationCtx = document.getElementById('stationChart');
        if (stationCtx) {
            this.charts.station = new Chart(stationCtx, {
                type: 'bar',
                data: {
                    labels: stationData.map(d => d.station),
                    datasets: [
                        {
                            label: '培训覆盖率',
                            data: stationData.map(d => d.coverage),
                            backgroundColor: '#0d6efd'
                        },
                        {
                            label: '考核通过率',
                            data: stationData.map(d => d.passRate),
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

        const levelData = MockData.statistics.byLevel;
        const levelCtx = document.getElementById('levelChart');
        if (levelCtx) {
            this.charts.level = new Chart(levelCtx, {
                type: 'doughnut',
                data: {
                    labels: levelData.map(d => d.level),
                    datasets: [{
                        data: levelData.map(d => d.count),
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

        const specialtyData = MockData.statistics.bySpecialty;
        const specialtyCtx = document.getElementById('specialtyChart');
        if (specialtyCtx) {
            this.charts.specialty = new Chart(specialtyCtx, {
                type: 'pie',
                data: {
                    labels: specialtyData.map(d => d.specialty),
                    datasets: [{
                        data: specialtyData.map(d => d.count),
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
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-primary">156</div>
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
                                    <div class="fs-2 fw-bold text-success">128</div>
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
                                    <div class="fs-2 fw-bold text-warning">18,560</div>
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
                                    <div class="fs-2 fw-bold text-info">24</div>
                                    <div class="small text-muted">进行中课程</div>
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
                        <div class="card-header">课程类型分布</div>
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
                <div class="card-body">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>站点</th>
                                <th>应参训人数</th>
                                <th>实参训人数</th>
                                <th>培训覆盖率</th>
                                <th>完成学时</th>
                                <th>达标率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${MockData.statistics.byStation.map(s => `
                                <tr>
                                    <td class="fw-medium">${s.station}</td>
                                    <td>${s.firefighters}</td>
                                    <td>${Math.floor(s.firefighters * s.coverage / 100)}</td>
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <div class="flex-grow-1 me-2">
                                                <div class="progress" style="height: 6px;">
                                                    <div class="progress-bar bg-primary" style="width: ${s.coverage}%"></div>
                                                </div>
                                            </div>
                                            <span class="small fw-medium">${s.coverage}%</span>
                                        </div>
                                    </td>
                                    <td>${Math.floor(1000 + Math.random() * 500)}</td>
                                    <td>
                                        <span class="badge ${s.passRate >= 80 ? 'bg-success' : s.passRate >= 70 ? 'bg-warning text-dark' : 'bg-danger'}">
                                            ${s.passRate}%
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        $('#tab-training').html(html);
        this.initTrainingCharts();
    },

    initTrainingCharts() {
        const hoursCtx = document.getElementById('trainingHoursChart');
        if (hoursCtx) {
            const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            const theoryHours = months.map(() => 800 + Math.floor(Math.random() * 400));
            const practicalHours = months.map(() => 600 + Math.floor(Math.random() * 500));

            new Chart(hoursCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: '理论学时',
                            data: theoryHours,
                            backgroundColor: '#0d6efd'
                        },
                        {
                            label: '实操学时',
                            data: practicalHours,
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
            new Chart(typeCtx, {
                type: 'doughnut',
                data: {
                    labels: ['理论课程', '实操课程', '综合演练', '考核评估'],
                    datasets: [{
                        data: [45, 35, 12, 8],
                        backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#6f42c1']
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
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-success">78.3%</div>
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
                                    <div class="fs-2 fw-bold text-primary">42</div>
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
                                    <div class="fs-2 fw-bold text-warning">1,256</div>
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
                    <div class="row g-3">
                        ${MockData.specialties.map(s => {
                            const passRate = 70 + Math.floor(Math.random() * 20);
                            const avgScore = 70 + Math.floor(Math.random() * 20);
                            return `
                                <div class="col-md-4 col-lg-2">
                                    <div class="text-center p-3 border rounded">
                                        <div class="fs-1 text-${s.color} mb-2">
                                            <i class="bi bi-${s.icon}"></i>
                                        </div>
                                        <div class="fw-bold">${s.name}</div>
                                        <div class="text-muted small mb-2">${100 + Math.floor(Math.random() * 100)}人参考</div>
                                        <div class="fs-4 fw-bold ${passRate >= 80 ? 'text-success' : passRate >= 70 ? 'text-warning' : 'text-danger'}">
                                            ${passRate}%
                                        </div>
                                        <div class="small text-muted">通过率</div>
                                        <div class="mt-2">
                                            <div class="progress" style="height: 4px;">
                                                <div class="progress-bar bg-${s.color}" style="width: ${passRate}%"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        $('#tab-exam').html(html);
        this.initExamCharts();
    },

    initExamCharts() {
        const levelPassCtx = document.getElementById('levelPassChart');
        if (levelPassCtx) {
            const levelData = MockData.statistics.byLevel;
            new Chart(levelPassCtx, {
                type: 'bar',
                data: {
                    labels: levelData.map(d => d.level),
                    datasets: [
                        {
                            label: '通过率',
                            data: levelData.map(d => d.passRate),
                            backgroundColor: levelData.map((_, i) => ['#0dcaf0', '#198754', '#ffc107', '#dc3545'][i])
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
            new Chart(vsCtx, {
                type: 'radar',
                data: {
                    labels: MockData.specialties.map(s => s.name),
                    datasets: [
                        {
                            label: '理论通过率',
                            data: MockData.specialties.map(() => 75 + Math.floor(Math.random() * 20)),
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.2)',
                            fill: true
                        },
                        {
                            label: '实操通过率',
                            data: MockData.specialties.map(() => 70 + Math.floor(Math.random() * 20)),
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
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fs-2 fw-bold text-primary">68.7%</div>
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
                                    <div class="fs-2 fw-bold text-success">156</div>
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
                                    <div class="fs-2 fw-bold text-warning">5</div>
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
                                    <div class="fs-2 fw-bold text-info">328</div>
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
                <div class="card-body">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>排名</th>
                                <th>器材名称</th>
                                <th>分类</th>
                                <th>总数</th>
                                <th>本月使用次数</th>
                                <th>利用率</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${MockData.equipment.map((eq, idx) => {
                                const usage = 60 + Math.floor(Math.random() * 35);
                                const useCount = 20 + Math.floor(Math.random() * 80);
                                return `
                                    <tr>
                                        <td>
                                            <span class="badge ${idx < 3 ? 'bg-warning text-dark' : 'bg-secondary'}">${idx + 1}</span>
                                        </td>
                                        <td class="fw-medium">${eq.name}</td>
                                        <td>${eq.category}</td>
                                        <td>${eq.totalQty} ${eq.unit}</td>
                                        <td>${useCount}</td>
                                        <td>
                                            <div class="d-flex align-items-center">
                                                <div class="flex-grow-1 me-2" style="max-width: 120px;">
                                                    <div class="progress" style="height: 6px;">
                                                        <div class="progress-bar ${usage >= 80 ? 'bg-danger' : usage >= 60 ? 'bg-warning' : 'bg-success'}" 
                                                             style="width: ${usage}%"></div>
                                                    </div>
                                                </div>
                                                <span class="small fw-medium">${usage}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge ${eq.status === 'maintenance' ? 'bg-warning' : 'bg-success'}">
                                                ${eq.status === 'maintenance' ? '维护中' : '正常'}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        $('#tab-equipment').html(html);
        this.initEquipmentCharts();
    },

    initEquipmentCharts() {
        const usageCtx = document.getElementById('equipmentUsageChart');
        if (usageCtx) {
            const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            
            new Chart(usageCtx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: '呼吸防护类',
                            data: months.map(() => 55 + Math.floor(Math.random() * 25)),
                            borderColor: '#0d6efd',
                            tension: 0.4
                        },
                        {
                            label: '破拆器材类',
                            data: months.map(() => 50 + Math.floor(Math.random() * 30)),
                            borderColor: '#198754',
                            tension: 0.4
                        },
                        {
                            label: '水域救援类',
                            data: months.map(() => 40 + Math.floor(Math.random() * 35)),
                            borderColor: '#0dcaf0',
                            tension: 0.4
                        },
                        {
                            label: '搜救装备类',
                            data: months.map(() => 45 + Math.floor(Math.random() * 25)),
                            borderColor: '#ffc107',
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

        const catCtx = document.getElementById('equipmentCategoryChart');
        if (catCtx) {
            new Chart(catCtx, {
                type: 'polarArea',
                data: {
                    labels: ['呼吸防护', '破拆器材', '水域救援', '搜救装备', '防护装备', '灭火装备'],
                    datasets: [{
                        data: [50, 20, 8, 6, 200, 15],
                        backgroundColor: [
                            'rgba(13, 110, 253, 0.7)',
                            'rgba(25, 135, 84, 0.7)',
                            'rgba(13, 202, 240, 0.7)',
                            'rgba(255, 193, 7, 0.7)',
                            'rgba(13, 202, 240, 0.5)',
                            'rgba(220, 53, 69, 0.7)'
                        ]
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
                            ${MockData.fireStations.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                        <select class="form-select form-select-sm" style="width: auto;" id="progress-filter-level">
                            <option value="">全部等级</option>
                            ${MockData.levels.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
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
                self.progressData = MockData.firefighters;
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
            stationName: f.stationName || f.fireStationName || MockData.fireStations.find(s => s.id === f.stationId)?.name || '',
            levelId: f.levelId || 1,
            levelName: f.levelName || MockData.levels.find(l => l.id === (f.levelId || 1))?.name || '',
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

        let firefighters = this.progressData || MockData.firefighters;

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
            MockData.trainingCourses.forEach(c => {
                csv += `${c.title},${MockData.specialties.find(s => s.id === c.specialtyId)?.name || ''},${MockData.levels.find(l => l.id === c.levelId)?.name || ''},${c.duration},${Math.floor(Math.random() * 10 + 1)}\n`;
            });
        } else if (this.activeTab === 'exam') {
            csv = '考试名称,类型,参考人数,平均分,通过率\n';
            MockData.practicalExams.forEach(e => {
                csv += `${e.name},实操,${Math.floor(Math.random() * 50 + 20)},${(Math.random() * 30 + 60).toFixed(1)},${(Math.random() * 30 + 60).toFixed(1)}%\n`;
            });
        } else {
            csv = '姓名,所属站点,等级,理论学时完成,实操次数完成,是否通过考试\n';
            MockData.firefighters.slice(0, 10).forEach(f => {
                csv += `${f.name},${MockData.fireStations.find(s => s.id === f.stationId)?.name || ''},${MockData.levels.find(l => l.id === f.levelId)?.name || ''},${f.theoryHours.completed}/${f.theoryHours.required},${f.practicalCount.completed}/${f.practicalCount.required},${f.examPassed ? '是' : '否'}\n`;
            });
        }
        return csv;
    },

    loadProgressData(callback) {
        const self = this;
        $.ajax({
            url: '/api/Statistic/progress',
            method: 'GET',
            data: { dateRange: this.dateRange },
            success: function(data) {
                var list = data.data || data.firefighters || data;
                if (!Array.isArray(list)) list = [];
                callback(list);
            },
            error: function() {
                callback(null);
            }
        });
    }
};
