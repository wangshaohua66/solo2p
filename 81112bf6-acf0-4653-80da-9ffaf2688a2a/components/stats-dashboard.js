var StatsDashboard = (function() {
    var trendChart = null;
    var typeChart = null;
    var unsubscribeFns = [];
    var updateInterval = null;

    function render(container) {
        cleanup();

        var html = `
            <div class="row mb-4">
                <div class="col-xl-3 col-md-6 mb-3">
                    <div class="card stat-card stat-card-primary h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <p class="small text-muted mb-1">当日故障数</p>
                                    <h2 class="mb-0" id="stat-today-faults">0</h2>
                                    <small class="text-muted">较昨日 <span class="text-success" id="stat-fault-trend">+0%</span></small>
                                </div>
                                <div class="stat-icon bg-primary bg-opacity-10">
                                    <i class="bi bi-exclamation-octagon text-primary fs-3"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-3">
                    <div class="card stat-card stat-card-warning h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <p class="small text-muted mb-1">平均复电时长</p>
                                    <h2 class="mb-0"><span id="stat-avg-recovery">0</span> <small class="fs-6">分钟</small></h2>
                                    <small class="text-muted">目标: ≤120分钟 <span class="text-success" id="stat-recovery-trend">-0%</span></small>
                                </div>
                                <div class="stat-icon bg-warning bg-opacity-10">
                                    <i class="bi bi-clock-history text-warning fs-3"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-3">
                    <div class="card stat-card stat-card-success h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <p class="small text-muted mb-1">班组利用率</p>
                                    <h2 class="mb-0"><span id="stat-crew-util">0</span> <small class="fs-6">%</small></h2>
                                    <small class="text-muted">6个班组在线 <span class="text-info" id="stat-crew-active">0个忙碌</span></small>
                                </div>
                                <div class="stat-icon bg-success bg-opacity-10">
                                    <i class="bi bi-people-fill text-success fs-3"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-3">
                    <div class="card stat-card stat-card-info h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <p class="small text-muted mb-1">客户满意度</p>
                                    <h2 class="mb-0"><span id="stat-satisfaction">0</span> <small class="fs-6">%</small></h2>
                                    <small class="text-muted">目标: ≥95% <span class="text-success">达标</span></small>
                                </div>
                                <div class="stat-icon bg-info bg-opacity-10">
                                    <i class="bi bi-emoji-smile-fill text-info fs-3"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mb-4">
                <div class="col-xl-8 mb-4">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-graph-up me-2"></i>近30天复电时长趋势</h5>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-secondary active" onclick="StatsDashboard.switchTrendView('time')">平均时长</button>
                                <button class="btn btn-outline-secondary" onclick="StatsDashboard.switchTrendView('count')">故障数量</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="trend-chart" style="width: 100%; height: 300px;"></div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-4 mb-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-pie-chart me-2"></i>故障类型分布</h5>
                        </div>
                        <div class="card-body">
                            <div id="type-chart" style="width: 100%; height: 300px;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-xl-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-trophy me-2"></i>班组效能排行榜 TOP 5</h5>
                        </div>
                        <div class="card-body">
                            <div id="crew-ranking-list"></div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-activity me-2"></i>实时状态概览</h5>
                            <span class="small text-muted"><i class="bi bi-arrow-repeat me-1"></i>自动刷新</span>
                        </div>
                        <div class="card-body">
                            <div id="realtime-stats"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.html(html);
        initCharts();
        updateAllStats();

        var unsub1 = Store.subscribe('faults', updateAllStats);
        var unsub2 = Store.subscribe('crews', updateAllStats);
        unsubscribeFns.push(unsub1, unsub2);

        updateInterval = setInterval(updateAllStats, 10000);

        $(window).on('resize.dashboard', function() {
            if (trendChart) trendChart.resize();
            if (typeChart) typeChart.resize();
        });
    }

    function initCharts() {
        var trendDom = document.getElementById('trend-chart');
        var typeDom = document.getElementById('type-chart');

        if (trendDom) {
            trendChart = echarts.init(trendDom);
        }
        if (typeDom) {
            typeChart = echarts.init(typeDom);
        }
    }

    var currentTrendView = 'time';
    function switchTrendView(view) {
        currentTrendView = view;
        $('.card-header .btn-group button').removeClass('active');
        $('.card-header .btn-group button').eq(view === 'time' ? 0 : 1).addClass('active');
        updateAllStats();
    }

    function updateAllStats() {
        var stats = DataService.getStats();
        updateStatCards(stats);
        updateTrendChart(stats);
        updateTypeChart(stats);
        updateCrewRanking(stats);
        updateRealtimeStats(stats);
    }

    function updateStatCards(stats) {
        $('#stat-today-faults').text(stats.todayFaults);
        $('#stat-avg-recovery').text(stats.avgRecoveryTime);
        $('#stat-crew-util').text(stats.crewUtilization);
        $('#stat-satisfaction').text(stats.satisfaction.toFixed(1));

        var crews = Store.get('crews') || [];
        var busy = crews.filter(function(c) { return c.status === 'enroute' || c.status === 'working'; }).length;
        $('#stat-crew-active').text(busy + '个忙碌');

        var recoveryTrend = stats.avgRecoveryTime > 0 ? Math.round((120 - stats.avgRecoveryTime) / 120 * 100) : 0;
        $('#stat-recovery-trend').text((recoveryTrend >= 0 ? '+' : '') + recoveryTrend + '%');
    }

    function updateTrendChart(stats) {
        if (!trendChart) return;

        var dates = stats.recoveryTrend.map(function(d) { return d.date; });
        var seriesData = currentTrendView === 'time'
            ? stats.recoveryTrend.map(function(d) { return d.avgTime; })
            : stats.recoveryTrend.map(function(d) { return d.count; });

        var option = {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    var p = params[0];
                    return p.axisValue + '<br/>' +
                        (currentTrendView === 'time' ? '平均复电时长: ' + p.value + ' 分钟' : '故障数量: ' + p.value + ' 单');
                }
            },
            grid: { left: 40, right: 20, top: 20, bottom: 40 },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: '#e5e7eb' } },
                axisLabel: { fontSize: 10, color: '#6b7280' }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                axisLabel: { fontSize: 10, color: '#6b7280' }
            },
            series: [{
                data: seriesData,
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 3, color: currentTrendView === 'time' ? '#3b82f6' : '#f59e0b' },
                itemStyle: { color: currentTrendView === 'time' ? '#3b82f6' : '#f59e0b', borderWidth: 2, borderColor: '#fff' },
                areaStyle: {
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: currentTrendView === 'time' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)' },
                            { offset: 1, color: currentTrendView === 'time' ? 'rgba(59, 130, 246, 0.02)' : 'rgba(245, 158, 11, 0.02)' }
                        ]
                    }
                }
            }]
        };

        trendChart.setOption(option, true);
    }

    function updateTypeChart(stats) {
        if (!typeChart) return;

        var colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];
        var data = stats.typeDistribution.length > 0
            ? stats.typeDistribution
            : [{ name: '暂无数据', value: 1 }];

        var option = {
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            legend: {
                orient: 'horizontal',
                bottom: 0,
                fontSize: 10,
                itemWidth: 10,
                itemHeight: 10
            },
            color: colors,
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 6,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    formatter: '{d}%',
                    fontSize: 10,
                    fontWeight: 'bold'
                },
                labelLine: {
                    length: 8,
                    length2: 8
                },
                data: data
            }]
        };

        typeChart.setOption(option, true);
    }

    function updateCrewRanking(stats) {
        var $list = $('#crew-ranking-list');
        if (!stats.crewRanking || stats.crewRanking.length === 0) {
            $list.html('<p class="text-muted text-center py-4">暂无数据</p>');
            return;
        }

        var medals = ['🥇', '🥈', '🥉', '4', '5'];
        var medalColors = ['#f59e0b', '#9ca3af', '#cd7f32', '#6b7280', '#6b7280'];

        var html = '';
        stats.crewRanking.forEach(function(crew, idx) {
            var maxScore = stats.crewRanking[0] ? stats.crewRanking[0].score : 1;
            var percent = Math.round(crew.score / maxScore * 100);

            html += `
                <div class="ranking-item d-flex align-items-center py-2">
                    <div class="ranking-medal me-3" style="color: ${medalColors[idx]}">
                        <span class="fs-5 fw-bold">${medals[idx]}</span>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <strong>${crew.name}</strong>
                            <small class="text-muted">效能分: ${crew.score}</small>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar bg-${idx < 3 ? (idx === 0 ? 'warning' : idx === 1 ? 'secondary' : 'info') : 'primary'}"
                                 style="width: ${percent}%"></div>
                        </div>
                        <div class="d-flex justify-content-between mt-1 small text-muted">
                            <span>完成 ${crew.tasks} 单</span>
                            <span>平均 ${crew.avgTime || '-'} 分钟</span>
                        </div>
                    </div>
                </div>
            `;
        });

        $list.html(html);
    }

    function updateRealtimeStats(stats) {
        var faults = Store.get('faults') || [];
        var crews = Store.get('crews') || [];
        var todayStart = moment().startOf('day');

        var todayFaults = faults.filter(function(f) { return moment(f.reportTime).isAfter(todayStart); });
        var pending = faults.filter(function(f) { return f.status === 'reported'; }).length;
        var inProgress = faults.filter(function(f) { return f.status === 'dispatched' || f.status === 'checking'; }).length;
        var resolved = todayFaults.filter(function(f) { return f.status === 'resolved'; }).length;

        var idleCrews = crews.filter(function(c) { return c.status === 'idle'; }).length;
        var busyCrews = crews.filter(function(c) { return c.status === 'enroute' || c.status === 'working'; }).length;

        var html = `
            <div class="row g-3">
                <div class="col-6">
                    <div class="p-3 rounded bg-light">
                        <div class="small text-muted mb-1">待派工故障</div>
                        <div class="d-flex align-items-baseline">
                            <span class="h3 mb-0 text-warning fw-bold">${pending}</span>
                            <span class="small text-muted ms-2">单</span>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="p-3 rounded bg-light">
                        <div class="small text-muted mb-1">抢修进行中</div>
                        <div class="d-flex align-items-baseline">
                            <span class="h3 mb-0 text-primary fw-bold">${inProgress}</span>
                            <span class="small text-muted ms-2">单</span>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="p-3 rounded bg-light">
                        <div class="small text-muted mb-1">今日已复电</div>
                        <div class="d-flex align-items-baseline">
                            <span class="h3 mb-0 text-success fw-bold">${resolved}</span>
                            <span class="small text-muted ms-2">单</span>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="p-3 rounded bg-light">
                        <div class="small text-muted mb-1">空闲班组</div>
                        <div class="d-flex align-items-baseline">
                            <span class="h3 mb-0 text-info fw-bold">${idleCrews}</span>
                            <span class="small text-muted ms-2">/${crews.length}个</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-4">
                <h6 class="mb-3">班组工作状态</h6>
                <div class="d-flex flex-wrap gap-2">
                    ${crews.map(function(c) {
                        var statusConfig = {
                            idle: { text: '空闲', cls: 'success', icon: 'check-circle' },
                            enroute: { text: '在途', cls: 'primary', icon: 'truck' },
                            working: { text: '作业中', cls: 'warning', icon: 'tools' },
                            returning: { text: '返程', cls: 'info', icon: 'arrow-left-circle' },
                            offline: { text: '离线', cls: 'secondary', icon: 'dash-circle' }
                        }[c.status] || { text: c.status, cls: 'secondary', icon: 'circle' };
                        return `
                            <span class="badge bg-${statusConfig.cls} bg-opacity-10 text-${statusConfig.cls} px-3 py-2">
                                <i class="bi bi-${statusConfig.icon} me-1"></i>${c.name}: ${statusConfig.text}
                            </span>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        $('#realtime-stats').html(html);
    }

    function cleanup() {
        unsubscribeFns.forEach(function(fn) { fn && fn(); });
        unsubscribeFns = [];
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        if (trendChart) {
            trendChart.dispose();
            trendChart = null;
        }
        if (typeChart) {
            typeChart.dispose();
            typeChart = null;
        }
        $(window).off('resize.dashboard');
    }

    return {
        render: render,
        switchTrendView: switchTrendView
    };
})();

window.StatsDashboard = StatsDashboard;
