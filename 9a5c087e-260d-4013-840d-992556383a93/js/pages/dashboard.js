var DashboardPage = (function () {
    var _charts = {};
    var _unsubs = [];
    var _selectedRiver = 'R001';
    var _timeWindow = '24h';
    var _levelFilter = 'all';
    var _draggingTeam = null;
    var _draggingCard = null;

    var _defaultCardOrder = [
        { id: 'water-card', size: 'col-xl-8' },
        { id: 'flood-card', size: 'col-xl-4' },
        { id: 'team-card', size: 'col-xl-6' },
        { id: 'timeline-card', size: 'col-xl-6' },
        { id: 'material-card', size: 'col-xl-4' },
        { id: 'checklist-card', size: 'col-xl-4' },
        { id: 'reservoir-card', size: 'col-xl-4' }
    ];

    function _getCardTemplate(card) {
        var templates = {
            'water-card': '<div class="col-xl-8 dashboard-card" data-card-id="water-card" draggable="true">'
                + '<div class="card card-dashboard"><div class="card-header card-drag-handle"><h6 class="mb-0 fw-bold"><i class="bi bi-graph-up me-1 text-primary"></i>河道水位·降雨联动</h6>'
                + '<div class="d-flex gap-2"><select class="form-select form-select-sm" id="riverSelect" style="width:auto;">'
                + MockData.RIVERS.map(function (r) { return '<option value="' + r.id + '">' + r.name + '</option>'; }).join('')
                + '</select><select class="form-select form-select-sm" id="timeWindowSelect" style="width:auto;">'
                + '<option value="6h">近6小时</option><option value="12h">近12小时</option><option value="24h" selected>近24小时</option><option value="72h">近3天</option>'
                + '</select></div></div>'
                + '<div class="card-body"><div id="waterChart" class="chart-container"></div></div></div>'
                + '</div>',

            'flood-card': '<div class="col-xl-4 dashboard-card" data-card-id="flood-card" draggable="true">'
                + '<div class="card card-dashboard"><div class="card-header card-drag-handle"><h6 class="mb-0 fw-bold"><i class="bi bi-geo-alt me-1 text-success"></i>86处易涝点态势</h6>'
                + '<select class="form-select form-select-sm" id="floodFilter" style="width:auto;"><option value="all">全部</option><option value="high">仅高风险</option><option value="0">正常</option><option value="1">轻度</option><option value="2">中度</option><option value="3">重度</option></select>'
                + '</div>'
                + '<div class="card-body"><div id="floodGrid" class="flood-grid"></div></div></div>'
                + '</div>',

            'team-card': '<div class="col-xl-6 dashboard-card" data-card-id="team-card" draggable="true">'
                + '<div class="card card-dashboard"><div class="card-header card-drag-handle"><h6 class="mb-0 fw-bold"><i class="bi bi-people me-1 text-info"></i>抢险队伍调度</h6>'
                + '<span class="badge rounded-pill bg-secondary"><span id="teamReadyCount">0</span>待命</span></div>'
                + '<div class="card-body" id="teamContainer"></div></div>'
                + '</div>',

            'timeline-card': '<div class="col-xl-6 dashboard-card" data-card-id="timeline-card" draggable="true">'
                + '<div class="card card-dashboard"><div class="card-header card-drag-handle"><h6 class="mb-0 fw-bold"><i class="bi bi-clock me-1 text-warning"></i>汛情事件时间轴</h6>'
                + '<span class="text-muted small">最近20条</span></div>'
                + '<div class="card-body" id="timelineContainer"></div></div>'
                + '</div>',

            'material-card': '<div class="col-xl-4 dashboard-card" data-card-id="material-card" draggable="true">'
                + '<div class="card card-dashboard"><div class="card-header card-drag-handle"><h6 class="mb-0 fw-bold"><i class="bi bi-box-seam me-1 text-purple"></i>应急物资总览</h6></div>'
                + '<div class="card-body" id="materialContainer"></div></div>'
                + '</div>',

            'checklist-card': '<div class="col-xl-4 dashboard-card" data-card-id="checklist-card" draggable="true">'
                + '<div class="card card-dashboard"><div class="card-header card-drag-handle"><h6 class="mb-0 fw-bold"><i class="bi bi-list-check me-1 text-secondary"></i>响应标准清单</h6></div>'
                + '<div class="card-body" id="checklistContainer"></div></div>'
                + '</div>',

            'reservoir-card': '<div class="col-xl-4 dashboard-card" data-card-id="reservoir-card" draggable="true">'
                + '<div class="card card-dashboard"><div class="card-header card-drag-handle"><h6 class="mb-0 fw-bold"><i class="bi bi-database me-1 text-danger"></i>水库状态</h6></div>'
                + '<div class="card-body" id="reservoirContainer"></div></div>'
                + '</div>'
        };
        return templates[card.id] || '';
    }

    function _getCardOrder() {
        var saved = Store.get('dashboardCardOrder');
        if (!saved || !Array.isArray(saved) || saved.length !== _defaultCardOrder.length) {
            return _defaultCardOrder;
        }
        return saved.map(function (id) {
            var def = _defaultCardOrder.find(function (c) { return c.id === id; });
            return def || { id: id, size: 'col-xl-4' };
        });
    }

    function _initCardDragDrop($container) {
        $container.on('dragstart', '.dashboard-card', function (e) {
            _draggingCard = $(this).attr('data-card-id');
            $(this).addClass('card-dragging');
            try { e.originalEvent.dataTransfer.setData('text/plain', _draggingCard); } catch (er) { }
            e.originalEvent.dataTransfer.effectAllowed = 'move';
        });

        $container.on('dragend', '.dashboard-card', function () {
            _draggingCard = null;
            $container.find('.dashboard-card').removeClass('card-dragging card-drag-over');
        });

        $container.on('dragover', '.dashboard-card', function (e) {
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            if (_draggingCard && $(this).attr('data-card-id') !== _draggingCard) {
                $(this).addClass('card-drag-over');
            }
        });

        $container.on('dragleave', '.dashboard-card', function () {
            $(this).removeClass('card-drag-over');
        });

        $container.on('drop', '.dashboard-card', function (e) {
            e.preventDefault();
            var targetId = $(this).attr('data-card-id');
            $(this).removeClass('card-drag-over');

            if (!_draggingCard || _draggingCard === targetId) return;

            var currentOrder = _getCardOrder();
            var fromIdx = currentOrder.findIndex(function (c) { return c.id === _draggingCard; });
            var toIdx = currentOrder.findIndex(function (c) { return c.id === targetId; });

            if (fromIdx >= 0 && toIdx >= 0) {
                var item = currentOrder.splice(fromIdx, 1)[0];
                currentOrder.splice(toIdx, 0, item);
                var newOrderIds = currentOrder.map(function (c) { return c.id; });
                Store.setDashboardCardOrder(newOrderIds);
                App.showToast('info', '布局已更新', '卡片顺序已保存，刷新页面后保持不变');
            }
        });
    }

    function _renderStats($container) {
        var rivers = Store.get('rivers');
        var fps = Store.get('floodPoints');
        var teams = Store.get('teams');
        var mats = Store.get('materials');

        var aboveWarn = 0;
        Object.keys(rivers || {}).forEach(function (rid) {
            var river = rivers[rid];
            Object.keys(river.stations).forEach(function (sid) {
                if (river.stations[sid].current >= river.info.warningLevel) aboveWarn++;
            });
        });

        var highFlood = (fps || []).filter(function (f) { return f.level >= 2; }).length;
        var readyTeams = (teams || []).filter(function (t) { return t.status === 'ready'; }).length;
        var lowStock = (mats || []).filter(function (m) { return m.lowStock; }).length;

        $container.find('[data-stat="warn-stations"] .stat-value').text(aboveWarn);
        $container.find('[data-stat="high-flood"] .stat-value').text(highFlood);
        $container.find('[data-stat="ready-teams"] .stat-value').text(readyTeams);
        $container.find('[data-stat="low-stock"] .stat-value').text(lowStock);

        if (aboveWarn > 0) {
            $container.find('[data-stat="warn-stations"]').addClass('alert-flash');
            setTimeout(function () {
                $container.find('[data-stat="warn-stations"]').removeClass('alert-flash');
            }, 600);
        }
    }

    function _renderWaterChart() {
        if (!_charts.water) return;
        var rivers = Store.get('rivers');
        var rainfall = Store.get('rainfall');
        if (!rivers || !rivers[_selectedRiver]) return;
        var river = rivers[_selectedRiver];
        var stationIds = Object.keys(river.stations);
        if (!stationIds.length) return;

        var series = [{
            name: '预警线',
            type: 'line',
            data: river.series.map(function () { return river.info.warningLevel; }),
            lineStyle: { type: 'dashed', color: '#fd7e14', width: 2 },
            itemStyle: { color: '#fd7e14' },
            symbol: 'none',
            z: 1
        }, {
            name: '保证水位',
            type: 'line',
            data: river.series.map(function () { return river.info.guaranteedLevel; }),
            lineStyle: { type: 'dashed', color: '#dc3545', width: 2 },
            itemStyle: { color: '#dc3545' },
            symbol: 'none',
            z: 1
        }];

        var colorPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
        stationIds.forEach(function (sid, i) {
            var st = river.stations[sid];
            series.push({
                name: st.info.name,
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: st.current >= river.info.warningLevel ? 8 : 4,
                itemStyle: {
                    color: st.current >= river.info.dangerLevel ? '#dc3545'
                        : st.current >= river.info.warningLevel ? '#fd7e14'
                        : colorPalette[i % colorPalette.length]
                },
                lineStyle: {
                    width: st.current >= river.info.warningLevel ? 3 : 2
                },
                data: st.series ? st.series.map(function (p) { return p.value; }) : [],
                markPoint: i === 0 ? {
                    data: [
                        { type: 'max', name: '最高' },
                        { type: 'min', name: '最低' }
                    ]
                } : undefined,
                z: 10
            });
        });

        var rainStation = Object.keys(rainfall)[0];
        var rainSeries = rainfall[rainStation] ? rainfall[rainStation].hourly : [];
        var barData = rainSeries.map(function (p) { return Math.max(0, p.value); });
        series.push({
            name: '降雨量',
            type: 'bar',
            yAxisIndex: 1,
            barWidth: '40%',
            itemStyle: { color: 'rgba(96, 165, 250, 0.45)', borderRadius: [3, 3, 0, 0] },
            data: barData,
            z: 5
        });

        var times = river.series.map(function (p) {
            return p.time.split(' ')[1].slice(0, 5);
        });

        _charts.water.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            legend: {
                data: series.map(function (s) { return s.name; }),
                top: 0,
                textStyle: { fontSize: 11 }
            },
            grid: { left: 45, right: 45, top: 38, bottom: 28 },
            xAxis: {
                type: 'category',
                data: times,
                axisLabel: { fontSize: 10, interval: Math.floor(times.length / 8) }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '水位(m)',
                    nameTextStyle: { fontSize: 10 },
                    axisLabel: { fontSize: 10, formatter: '{value}' },
                    splitLine: { lineStyle: { type: 'dashed' } }
                },
                {
                    type: 'value',
                    name: '降雨(mm)',
                    nameTextStyle: { fontSize: 10 },
                    axisLabel: { fontSize: 10 },
                    splitLine: { show: false }
                }
            ],
            dataZoom: [
                { type: 'inside', start: 0, end: 100 }
            ],
            series: series
        }, true);
    }

    function _renderFloodGrid($container, fps) {
        fps = fps || Store.get('floodPoints') || [];
        var filtered = _levelFilter === 'all' ? fps : fps.filter(function (f) {
            if (_levelFilter === 'high') return f.level >= 2;
            if (_levelFilter === 'normal') return f.level <= 1;
            return f.level === parseInt(_levelFilter);
        });

        var html = '';
        filtered.forEach(function (fp) {
            var classes = ['flood-point', 'flood-level-' + fp.level];
            if (fp.level >= 2) classes.push('alert-blink');
            var title = fp.name + '\n水深: ' + fp.depth + 'cm\n状态: ' + fp.traffic + '\n更新: ' + fp.lastUpdate;
            html += '<div class="' + classes.join(' ') + '" '
                + 'data-id="' + fp.id + '" '
                + 'title="' + title + '" '
                + 'draggable="true"'
                + 'data-lng="' + fp.lng + '" data-lat="' + fp.lat + '">'
                + fp.id.slice(2) + '</div>';
        });

        if (!filtered.length) {
            html = '<div class="text-center text-muted py-4">暂无数据</div>';
        }

        $container.html(html);

        var lvlCount = [0, 0, 0, 0];
        fps.forEach(function (f) { lvlCount[f.level]++; });
        $container.siblings('.card-header').find('.flood-legend').remove();
        $container.siblings('.card-header').append(
            '<div class="flood-legend d-flex gap-3 small align-items-center">'
            + '<span class="d-flex align-items-center gap-1"><span class="d-inline-block rounded" style="width:12px;height:12px;background:var(--flood-green)"></span>' + lvlCount[0] + '</span>'
            + '<span class="d-flex align-items-center gap-1"><span class="d-inline-block rounded" style="width:12px;height:12px;background:var(--flood-yellow)"></span>' + lvlCount[1] + '</span>'
            + '<span class="d-flex align-items-center gap-1"><span class="d-inline-block rounded" style="width:12px;height:12px;background:var(--flood-orange)"></span>' + lvlCount[2] + '</span>'
            + '<span class="d-flex align-items-center gap-1"><span class="d-inline-block rounded" style="width:12px;height:12px;background:var(--flood-red)"></span>' + lvlCount[3] + '</span>'
            + '</div>'
        );

        $container.find('.flood-point').on('click', function () {
            var id = $(this).data('id');
            _showFloodDetail(id);
        });

        $container.find('.flood-point').on('dragover', function (e) {
            if (_draggingTeam) {
                e.preventDefault();
                $(this).addClass('drag-over');
            }
        }).on('dragleave', function () {
            $(this).removeClass('drag-over');
        }).on('drop', function (e) {
            e.preventDefault();
            $(this).removeClass('drag-over');
            if (_draggingTeam) {
                var fpId = $(this).data('id');
                var log = Store.dispatchTeam(_draggingTeam, fpId);
                if (log) {
                    App.showToast('success', '调度成功', '已调度队伍前往 ' + fpId + '，预计 ' + log.eta + ' 分钟到达');
                }
            }
            _draggingTeam = null;
        });
    }

    function _showFloodDetail(id) {
        var fps = Store.get('floodPoints');
        var fp = fps.find(function (f) { return f.id === id; });
        if (!fp) return;

        var $modal = $('#floodPointModal');
        var headerClass = 'bg-' + ['success', 'warning', 'orange', 'danger'][fp.level] + ' text-white';
        var levelText = ['正常', '轻度积水', '中度积水', '重度积水'][fp.level];
        $('#floodModalHeader').attr('class', 'modal-header ' + headerClass);
        $('#floodModalTitle').html('<i class="bi bi-geo-alt me-2"></i>' + fp.name + ' <span class="badge bg-white text-dark ms-2">' + levelText + '</span>');

        var pumps = Store.get('pumpStations') || [];
        var nearPumps = pumps.filter(function (p) { return fp.nearbyPumps.indexOf(p.id) >= 0; });
        var pumpHtml = nearPumps.map(function (p) {
            var statusColor = p.status === 'running' ? 'text-success' : p.status === 'standby' ? 'text-secondary' : 'text-danger';
            var statusText = p.status === 'running' ? '运行中' : p.status === 'standby' ? '待命' : '检修';
            return '<li class="list-group-item d-flex justify-content-between align-items-center">'
                + '<div><i class="bi bi-arrow-repeat me-2 ' + statusColor + '"></i>' + p.name
                + ' <span class="badge bg-light text-dark ms-1">' + statusText + '</span></div>'
                + '<span class="small text-muted">负载 ' + p.load + '% / ' + p.capacity + 'm³/h</span></li>';
        }).join('') || '<li class="list-group-item text-muted small">无关联泵站</li>';

        var inspections = Store.get('inspections') || [];
        var relatedInsp = inspections.filter(function (i) { return i.floodPoint === id; }).slice(0, 5);
        var inspHtml = relatedInsp.length ? relatedInsp.map(function (i) {
            var badgeColor = i.status === '已解决' ? 'bg-success' : i.status === '处理中' ? 'bg-warning' : 'bg-secondary';
            return '<li class="list-group-item"><div class="d-flex justify-content-between"><strong>' + i.inspector + '</strong>'
                + '<span class="badge ' + badgeColor + '">' + i.status + '</span></div>'
                + '<div class="small text-muted">' + i.time + '</div>'
                + '<div class="mt-1">' + i.dangerType + ' - 水深 ' + i.depth + 'cm</div>'
                + '<div class="small mt-1">' + i.description + '</div></li>';
        }).join('') : '<li class="list-group-item text-muted small">暂无巡查记录</li>';

        $('#floodModalBody').html(
            '<div class="row g-3">'
            + '<div class="col-md-6">'
            + '<h6 class="mb-2"><i class="bi bi-info-circle me-1"></i>基本信息</h6>'
            + '<table class="table table-sm small mb-3"><tbody>'
            + '<tr><th>点位编号</th><td>' + fp.id + '</td></tr>'
            + '<tr><th>当前水深</th><td><strong>' + fp.depth + ' cm</strong></td></tr>'
            + '<tr><th>积水等级</th><td>' + levelText + '</td></tr>'
            + '<tr><th>影响面积</th><td>' + fp.affectedArea + ' m²</td></tr>'
            + '<tr><th>交通状况</th><td>' + fp.traffic + '</td></tr>'
            + '<tr><th>最后更新</th><td class="text-muted">' + fp.lastUpdate + '</td></tr>'
            + '</tbody></table>'
            + '<h6 class="mb-2"><i class="bi bi-arrow-repeat me-1"></i>周边泵站</h6>'
            + '<ul class="list-group small mb-3">' + pumpHtml + '</ul>'
            + '</div>'
            + '<div class="col-md-6">'
            + '<h6 class="mb-2"><i class="bi bi-graph-up me-1"></i>历史积水曲线</h6>'
            + '<div id="floodHistoryChart" style="width:100%;height:200px;"></div>'
            + '<h6 class="mb-2 mt-3"><i class="bi bi-clipboard me-1"></i>巡查记录</h6>'
            + '<ul class="list-group small" style="max-height:200px;overflow-y:auto;">' + inspHtml + '</ul>'
            + '</div>'
            + '</div>'
        );

        var modal = new bootstrap.Modal($modal[0]);
        modal.show();

        setTimeout(function () {
            var chart = echarts.init(document.getElementById('floodHistoryChart'));
            var times = fp.history.map(function (h) { return h.time.split(' ')[1].slice(0, 5); });
            var depths = fp.history.map(function (h) { return h.depth; });
            chart.setOption({
                grid: { left: 35, right: 15, top: 15, bottom: 25 },
                tooltip: { trigger: 'axis', valueFormatter: function (v) { return v + ' cm'; } },
                xAxis: {
                    type: 'category',
                    data: times,
                    axisLabel: { fontSize: 9, interval: Math.floor(times.length / 6) }
                },
                yAxis: { type: 'value', name: 'cm', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 9 } },
                series: [{
                    type: 'line',
                    smooth: true,
                    areaStyle: { color: 'rgba(59, 130, 246, 0.2)' },
                    lineStyle: { color: '#3b82f6', width: 2 },
                    itemStyle: { color: '#3b82f6' },
                    data: depths,
                    markLine: {
                        lineStyle: { type: 'dashed' },
                        data: [{ yAxis: 25, name: '中度预警' }]
                    }
                }]
            });
            $(window).one('hidden.bs.modal', function () { chart.dispose(); });
        }, 100);
    }

    function _renderTeams($container) {
        var teams = Store.get('teams') || [];
        var html = '<div class="team-grid d-flex flex-wrap gap-2 mb-3">';
        teams.forEach(function (t) {
            var statusText = { ready: '待命', working: '出警', busy: '处置中' }[t.status];
            var progressBar = t.status !== 'ready' ? '<div class="progress mt-1" style="height:4px;"><div class="progress-bar" style="width:' + t.progress + '%"></div></div>' : '';
            var etaTag = t.eta ? '<span class="badge bg-info ms-1">ETA ' + t.eta + '分</span>' : '';
            html += '<div class="team-marker status-' + t.status + '" draggable="true" '
                + 'data-id="' + t.id + '" '
                + 'title="' + t.name + '\n队长: ' + t.leader + '\n状态: ' + statusText + '\n人数: ' + t.memberCount + '人'
                + (t.currentTask ? '\n任务: ' + t.currentTask : '') + '">'
                + t.id.slice(1)
                + '<div class="dropdown-menu position-absolute start-50 translate-middle-x" style="top:44px;min-width:180px;">'
                + '<div class="p-2 small">'
                + '<div class="fw-bold">' + t.name + '</div>'
                + '<div class="text-muted">队长：' + t.leader + '</div>'
                + '<div>人数：' + t.memberCount + '人</div>'
                + '<div>状态：<span class="badge bg-' + (t.status === 'ready' ? 'success' : t.status === 'working' ? 'warning' : 'danger') + '">' + statusText + '</span>' + etaTag + '</div>'
                + (t.currentTask ? '<div class="mt-1">任务：' + t.currentTask + '</div>' : '')
                + (t.equipment ? '<div class="mt-1 text-muted">装备：' + t.equipment.join('、') + '</div>' : '')
                + progressBar
                + (t.status !== 'ready' ? '<button class="btn btn-sm btn-success w-100 mt-2 btn-complete-team" data-id="' + t.id + '">标记完成</button>' : '')
                + '</div></div>'
                + '</div>';
        });
        html += '</div>';
        html += '<div class="row g-2 small"><div class="col-4 text-center"><span class="d-inline-block rounded me-1" style="width:10px;height:10px;background:#198754"></span><span>待命 ' + teams.filter(function (t) { return t.status === 'ready'; }).length + '</span></div>'
            + '<div class="col-4 text-center"><span class="d-inline-block rounded me-1" style="width:10px;height:10px;background:#fd7e14"></span><span>出警 ' + teams.filter(function (t) { return t.status === 'working'; }).length + '</span></div>'
            + '<div class="col-4 text-center"><span class="d-inline-block rounded me-1" style="width:10px;height:10px;background:#dc3545"></span><span>处置中 ' + teams.filter(function (t) { return t.status === 'busy'; }).length + '</span></div></div>';
        html += '<div class="mt-3 p-2 bg-light rounded small text-muted"><i class="bi bi-info-circle me-1"></i>拖拽队伍图标到易涝点网格点位可发起调度指令；拖拽卡片标题栏可调整布局顺序</div>';

        $container.html(html);

        $container.find('.team-marker').on('dragstart', function (e) {
            _draggingTeam = $(this).data('id');
            e.originalEvent.dataTransfer.effectAllowed = 'move';
        }).on('dragend', function () {
            _draggingTeam = null;
            $(this).find('.dropdown-menu').removeClass('show');
        }).on('click', function (e) {
            e.stopPropagation();
            $container.find('.team-marker .dropdown-menu').removeClass('show');
            $(this).find('.dropdown-menu').toggleClass('show');
        });

        $(document).one('click', function () {
            $container.find('.dropdown-menu').removeClass('show');
        });

        $container.find('.btn-complete-team').on('click', function (e) {
            e.stopPropagation();
            var id = $(this).data('id');
            Store.updateTeamProgress(id, 100);
            App.showToast('success', '任务完成', '队伍已完成任务，返回待命状态');
        });
    }

    function _renderMaterialCard($container) {
        var mats = Store.get('materials') || [];
        var flows = Store.get('materialFlows') || [];
        var totalStock = mats.reduce(function (s, m) { return s + m.stock; }, 0);
        var lowStockCount = mats.filter(function (m) { return m.lowStock; }).length;
        var recentFlows = flows.slice(0, 5);

        var flowsHtml = recentFlows.map(function (f) {
            var color = f.type.indexOf('入库') >= 0 ? 'text-success' : f.type === '应急出库' ? 'text-danger' : 'text-warning';
            var icon = f.type.indexOf('入库') >= 0 ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up-right';
            return '<div class="resource-feed-item d-flex gap-2 small">'
                + '<i class="bi ' + icon + ' ' + color + ' mt-1"></i>'
                + '<div class="flex-grow-1 min-w-0">'
                + '<div class="fw-medium">' + f.materialName + ' <span class="' + color + '">' + f.type + '</span></div>'
                + '<div class="text-muted">数量：' + f.quantity + ' · ' + f.from + ' → ' + f.to + '</div>'
                + '<div class="text-muted xsmall">' + f.time + '</div>'
                + '</div></div>';
        }).join('');

        $container.html(
            '<div class="row g-2 mb-3">'
            + '<div class="col-6"><div class="card border-0 bg-light p-2"><div class="small text-muted">物资总量</div><div class="fs-4 fw-bold text-primary">' + totalStock.toLocaleString() + '</div></div></div>'
            + '<div class="col-6"><div class="card border-0 bg-light p-2"><div class="small text-muted">低库存预警</div><div class="fs-4 fw-bold text-danger">' + lowStockCount + '</div></div></div>'
            + '</div>'
            + '<h6 class="small fw-bold text-muted mb-2"><i class="bi bi-clock-history me-1"></i>最近调拨</h6>'
            + '<div class="resource-feed">' + flowsHtml + '</div>'
            + '<div class="mt-2"><a href="#/resource" class="btn btn-sm btn-outline-primary w-100"><i class="bi bi-box-seam me-1"></i>查看全部物资</a></div>'
        );
    }

    function _renderTimeline($container) {
        var events = Store.get('timeline') || [];
        var html = '';
        events.slice(0, 20).forEach(function (e) {
            var causalBadge = e.causeOf ? '<span class="badge bg-light text-dark xsmall ms-1" title="因果关联">→ ' + e.causeOf + '</span>' : '';
            html += '<div class="timeline-item ' + e.type + '">'
                + '<div class="d-flex justify-content-between align-items-start">'
                + '<div>'
                + '<div class="fw-bold small"><i class="bi ' + e.icon + ' me-1"></i>' + e.title + causalBadge + '</div>'
                + '<div class="small mt-1">' + e.description + '</div>'
                + '</div>'
                + '<span class="text-muted xsmall ms-2">' + e.time.split(' ')[1].slice(0, 5) + '</span>'
                + '</div></div>';
        });
        if (!events.length) html = '<div class="text-muted text-center py-4 small">暂无事件</div>';
        $container.html('<div class="timeline-wrapper">' + html + '</div>');
    }

    function _renderChecklist($container) {
        var response = Store.get('response') || {};
        var level = response.response || 'IV';
        var checklist = response.checklist || MockData.getResponseChecklist(level);
        var done = checklist.filter(function (c) { return c.checked; }).length;

        var html = '<div class="d-flex justify-content-between align-items-center mb-2">'
            + '<h6 class="small fw-bold mb-0"><i class="bi bi-list-check me-1"></i>响应标准清单</h6>'
            + '<span class="badge bg-secondary xsmall">' + done + '/' + checklist.length + '</span>'
            + '</div><div class="progress mb-3" style="height:6px;">'
            + '<div class="progress-bar bg-' + (level === 'I' ? 'danger' : level === 'II' ? 'warning' : level === 'III' ? 'info' : 'primary') + '" style="width:' + Math.round(done / checklist.length * 100) + '%"></div>'
            + '</div><div class="response-checklist">';

        checklist.forEach(function (item, i) {
            html += '<label class="list-group-item list-group-item-action level-' + level + ' d-flex gap-2 align-items-start pe-2 py-2 cursor-pointer">'
                + '<input class="form-check-input mt-1 checklist-checkbox" type="checkbox" data-index="' + i + '" ' + (item.checked ? 'checked' : '') + '>'
                + '<span class="small flex-grow-1 ' + (item.checked ? 'text-decoration-line-through text-muted' : '') + '">' + item.text + '</span>'
                + '</label>';
        });
        html += '</div>';
        $container.html(html);

        $container.find('.checklist-checkbox').on('change', function () {
            var idx = $(this).data('index');
            var checked = $(this).prop('checked');
            Store.updateChecklist(idx, checked);
        });
    }

    function render($app, params) {
        var cardOrder = _getCardOrder();
        var cardsHtml = cardOrder.map(_getCardTemplate).join('');

        var template = [
            '<div class="container-fluid p-0">',
            '<div class="row g-3 mb-3" id="statsRow">',
            '<div class="col-6 col-xl-3"><div class="stat-card warning" data-stat="warn-stations"><i class="bi bi-exclamation-triangle-fill fs-5 opacity-80"></i><div class="mt-2"><div class="stat-value">0</div><div class="stat-label">超警戒站点</div></div></div></div>',
            '<div class="col-6 col-xl-3"><div class="stat-card" data-stat="high-flood"><i class="bi bi-droplet-half fs-5 opacity-80"></i><div class="mt-2"><div class="stat-value">0</div><div class="stat-label">中重度积水点</div></div></div></div>',
            '<div class="col-6 col-xl-3"><div class="stat-card success" data-stat="ready-teams"><i class="bi bi-people-fill fs-5 opacity-80"></i><div class="mt-2"><div class="stat-value">0</div><div class="stat-label">待命抢险队伍</div></div></div></div>',
            '<div class="col-6 col-xl-3"><div class="stat-card info" data-stat="low-stock"><i class="bi bi-box-seam fs-5 opacity-80"></i><div class="mt-2"><div class="stat-value">0</div><div class="stat-label">物资低库存预警</div></div></div></div>',
            '</div>',

            '<div class="row g-3" id="dashboardCardsRow">',
            cardsHtml,
            '</div></div>'
        ].join('');

        $app.html(template);

        _charts.water = echarts.init(document.getElementById('waterChart'));

        _renderStats($app);
        _renderWaterChart();
        _renderFloodGrid($('#floodGrid'));
        _renderTeams($('#teamContainer'));
        _renderMaterialCard($('#materialContainer'));
        _renderTimeline($('#timelineContainer'));
        _renderChecklist($('#checklistContainer'));
        _renderReservoirs($('#reservoirContainer'));

        _initCardDragDrop($('#dashboardCardsRow'));

        $('#riverSelect').on('change', function () {
            _selectedRiver = $(this).val();
            _renderWaterChart();
        });

        $('#timeWindowSelect').on('change', function () {
            _timeWindow = $(this).val();
            _renderWaterChart();
        });

        $('#floodFilter').on('change', function () {
            _levelFilter = $(this).val();
            _renderFloodGrid($('#floodGrid'));
        });

        _unsubs.push(Store.on('rivers', function () {
            _renderStats($app);
            _renderWaterChart();
        }));
        _unsubs.push(Store.on('rainfall', _renderWaterChart));
        _unsubs.push(Store.on('floodPoints', function (fps) {
            _renderStats($app);
            _renderFloodGrid($('#floodGrid'), fps);
        }));
        _unsubs.push(Store.on('teams', function () {
            _renderStats($app);
            _renderTeams($('#teamContainer'));
        }));
        _unsubs.push(Store.on('materials', function () {
            _renderStats($app);
            _renderMaterialCard($('#materialContainer'));
        }));
        _unsubs.push(Store.on('materialFlows', function () {
            _renderMaterialCard($('#materialContainer'));
        }));
        _unsubs.push(Store.on('timeline', function () {
            _renderTimeline($('#timelineContainer'));
        }));
        _unsubs.push(Store.on('response', function () {
            _renderChecklist($('#checklistContainer'));
        }));
        _unsubs.push(Store.on('dashboardCardOrder', function () {
            Router.go('dashboard');
        }));

        $(window).on('resize.dashboard', function () {
            Object.values(_charts).forEach(function (c) { if (c && c.resize) c.resize(); });
        });
    }

    function _renderReservoirs($container) {
        var reservoirs = Store.get('reservoirs') || [];
        var html = reservoirs.map(function (r) {
            var pct = r.currentLevel;
            var color = pct >= r.warningLevel ? 'danger' : pct >= r.warningLevel - 10 ? 'warning' : 'success';
            return '<div class="mb-3 pb-3 border-bottom last-border-none">'
                + '<div class="d-flex justify-content-between align-items-center mb-1">'
                + '<div class="fw-medium small">' + r.name + '</div>'
                + '<span class="badge bg-' + color + '">' + pct.toFixed(0) + '% / ' + r.warningLevel + '%</span>'
                + '</div>'
                + '<div class="progress" style="height:8px;"><div class="progress-bar bg-' + color + '" style="width:' + pct + '%"></div></div>'
                + '<div class="d-flex gap-3 mt-2 xsmall text-muted">'
                + '<span>入流 ' + r.inflow + 'm³/s</span>'
                + '<span>出流 ' + r.outflow + 'm³/s</span>'
                + '<span>泄洪 ' + r.discharge + 'm³/s</span>'
                + '</div></div>';
        }).join('');
        $container.html(html);
    }

    function cleanup() {
        _unsubs.forEach(function (fn) { try { fn(); } catch (e) { } });
        _unsubs = [];
        Object.values(_charts).forEach(function (c) { try { c.dispose(); } catch (e) { } });
        _charts = {};
        $(window).off('resize.dashboard');
    }

    return {
        render: render,
        cleanup: cleanup
    };
})();

Router.register('dashboard', DashboardPage.render, {
    title: '总览看板',
    cleanup: DashboardPage.cleanup
});
