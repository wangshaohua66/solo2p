var CrewTracker = (function() {
    var chart = null;
    var trackChart = null;
    var unsubscribeFns = [];
    var selectedCrewId = null;
    var isReplaying = false;
    var replayInterval = null;

    function render(container) {
        cleanup();

        var html = `
            <div class="row mb-4">
                <div class="col-lg-8 mb-4">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-geo-alt me-2"></i>班组实时位置地图</h5>
                            <div class="d-flex gap-2">
                                <select class="form-select form-select-sm" style="width: auto;" id="crew-select" onchange="CrewTracker.selectCrew(this.value)">
                                    <option value="">全部班组</option>
                                </select>
                                <button class="btn btn-sm btn-outline-secondary" onclick="CrewTracker.resetMap()">
                                    <i class="bi bi-fullscreen-exit"></i> 重置
                                </button>
                            </div>
                        </div>
                        <div class="card-body p-0 position-relative">
                            <div id="crew-map-chart" style="width: 100%; height: 500px;"></div>
                            <div class="position-absolute top-0 end-0 m-3 bg-white rounded shadow-sm p-2 small">
                                <div class="mb-1"><span class="d-inline-block rounded-circle bg-success me-1" style="width:12px;height:12px;"></span>空闲</div>
                                <div class="mb-1"><span class="d-inline-block rounded-circle bg-primary me-1" style="width:12px;height:12px;"></span>在途</div>
                                <div class="mb-1"><span class="d-inline-block rounded-circle bg-warning me-1" style="width:12px;height:12px;"></span>作业中</div>
                                <div><span class="d-inline-block rounded-circle me-1" style="width:12px;height:12px;background-color:#8b5cf6;"></span>返程</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4 mb-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-people me-2"></i>班组状态</h5>
                        </div>
                        <div class="card-body p-0" style="max-height: 500px; overflow-y: auto;">
                            <div id="crew-status-list"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h5 class="mb-0"><i class="bi bi-play-circle me-2"></i>轨迹回放</h5>
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <span class="small text-muted">选择班组:</span>
                                <select class="form-select form-select-sm" style="width: 150px;" id="replay-crew-select">
                                    <option value="">请选择班组</option>
                                </select>
                                <span class="small text-muted">时间范围:</span>
                                <input type="datetime-local" class="form-control form-control-sm" style="width: 180px;" id="replay-start">
                                <span class="text-muted">至</span>
                                <input type="datetime-local" class="form-control form-control-sm" style="width: 180px;" id="replay-end">
                                <button class="btn btn-sm btn-primary" id="replay-btn" onclick="CrewTracker.startReplay()">
                                    <i class="bi bi-play-fill"></i> 开始回放
                                </button>
                                <button class="btn btn-sm btn-outline-secondary d-none" id="stop-replay-btn" onclick="CrewTracker.stopReplay()">
                                    <i class="bi bi-stop-fill"></i> 停止
                                </button>
                                <span class="small text-muted" id="replay-progress"></span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="track-replay-chart" style="width: 100%; height: 200px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.html(html);

        var crews = Store.get('crews') || [];
        crews.forEach(function(c) {
            $('#crew-select').append('<option value="' + c.id + '">' + c.name + '</option>');
            $('#replay-crew-select').append('<option value="' + c.id + '">' + c.name + '</option>');
        });

        var now = moment();
        $('#replay-start').val(now.clone().subtract(2, 'hours').format('YYYY-MM-DDTHH:mm'));
        $('#replay-end').val(now.format('YYYY-MM-DDTHH:mm'));

        initCrewMap();
        renderCrewList();
        initTrackReplayChart();

        var unsub1 = Store.subscribe('crews', function() {
            renderCrewList();
            updateCrewMap();
        });
        unsubscribeFns.push(unsub1);

        $(window).on('resize.crew', function() {
            if (chart) chart.resize();
            if (trackChart) trackChart.resize();
        });
    }

    function initCrewMap() {
        var dom = document.getElementById('crew-map-chart');
        if (!dom) return;

        chart = echarts.init(dom);
        chart.on('click', handleMapClick);
        updateCrewMap();
    }

    function updateCrewMap() {
        if (!chart) return;

        var crews = Store.get('crews') || [];
        var faults = Store.get('faults') || [];
        var nodes = Store.get('gridNodes') || [];
        var links = Store.get('gridLinks') || [];

        var displayCrews = selectedCrewId ? crews.filter(function(c) { return c.id === selectedCrewId; }) : crews;

        var graphNodes = nodes.map(function(n) {
            return {
                id: n.id,
                name: n.name,
                x: n.x,
                y: n.y,
                symbolSize: n.type === 'substation' ? 20 : n.type === 'transformer' ? 8 : 5,
                fixed: true,
                itemStyle: {
                    color: n.type === 'substation' ? '#f59e0b' : n.type === 'transformer' ? '#10b981' : '#d1d5db',
                    opacity: 0.4
                }
            };
        });

        var graphLinks = links.map(function(l) {
            return {
                source: l.source,
                target: l.target,
                lineStyle: { color: '#e5e7eb', width: 1 }
            };
        });

        var activeFaults = faults.filter(function(f) { return f.status !== 'resolved'; });
        activeFaults.forEach(function(f) {
            graphNodes.push({
                id: 'F_' + f.id,
                name: f.id,
                x: f.x,
                y: f.y,
                symbolSize: 14,
                fixed: true,
                itemStyle: { color: '#ef4444' },
                label: { show: true, formatter: f.id, position: 'top', fontSize: 10, color: '#dc2626' }
            });
        });

        displayCrews.forEach(function(crew) {
            var colorMap = {
                idle: '#10b981',
                enroute: '#3b82f6',
                working: '#f59e0b',
                returning: '#8b5cf6',
                offline: '#9ca3af'
            };
            var statusColor = colorMap[crew.status] || '#6b7280';

            var track = crew.track || [];
            if (track.length > 1) {
                for (var i = 1; i < track.length; i++) {
                    graphLinks.push({
                        source: 'T_' + crew.id + '_' + (i-1),
                        target: 'T_' + crew.id + '_' + i,
                        lineStyle: { color: statusColor, width: 2, type: i === track.length - 1 ? 'dashed' : 'solid', opacity: 0.5 }
                    });
                    graphNodes.push({
                        id: 'T_' + crew.id + '_' + (i-1),
                        x: track[i-1].x,
                        y: track[i-1].y,
                        symbolSize: 0,
                        itemStyle: { opacity: 0 }
                    });
                }
                graphNodes.push({
                    id: 'T_' + crew.id + '_' + (track.length - 1),
                    x: track[track.length - 1].x,
                    y: track[track.length - 1].y,
                    symbolSize: 0,
                    itemStyle: { opacity: 0 }
                });
            }

            graphNodes.push({
                id: 'C_' + crew.id,
                name: crew.name,
                x: crew.x,
                y: crew.y,
                symbolSize: 18,
                fixed: true,
                itemStyle: {
                    color: statusColor,
                    borderColor: '#fff',
                    borderWidth: 3,
                    shadowBlur: 15,
                    shadowColor: statusColor
                },
                label: {
                    show: true,
                    formatter: crew.name,
                    position: 'right',
                    fontSize: 11,
                    color: '#1f2937',
                    fontWeight: 'bold'
                },
                _crew: crew
            });
        });

        var option = {
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    if (params.data && params.data._crew) {
                        var c = params.data._crew;
                        var statusText = { idle: '空闲', enroute: '在途', working: '作业中', returning: '返程', offline: '离线' }[c.status];
                        return '<strong>' + c.name + '</strong><br/>' +
                            '班长: ' + c.leader + '<br/>' +
                            '状态: ' + statusText + '<br/>' +
                            '成员: ' + c.members + '人<br/>' +
                            (c.currentFaultId ? '当前任务: ' + c.currentFaultId : '');
                    }
                    return params.name;
                }
            },
            animationDurationUpdate: 500,
            animationEasingUpdate: 'linear',
            series: [{
                type: 'graph',
                layout: 'none',
                roam: true,
                data: graphNodes,
                links: graphLinks,
                lineStyle: { curveness: 0 },
                emphasis: { focus: 'none' }
            }]
        };

        chart.setOption(option, true);
    }

    function handleMapClick(params) {
        if (params.data && params.data._crew) {
            selectCrew(params.data._crew.id);
        }
    }

    function selectCrew(crewId) {
        selectedCrewId = crewId || null;
        $('#crew-select').val(crewId);
        updateCrewMap();
        renderCrewList();
    }

    function renderCrewList() {
        var crews = Store.get('crews') || [];
        var $list = $('#crew-status-list');

        if (crews.length === 0) {
            $list.html('<p class="text-muted text-center py-4">暂无班组数据</p>');
            return;
        }

        var statusConfig = {
            idle: { text: '空闲', cls: 'success', icon: 'check-circle', desc: '待命中', bg: '16, 185, 129' },
            enroute: { text: '在途', cls: 'primary', icon: 'truck', desc: '赶往现场', bg: '59, 130, 246' },
            working: { text: '作业中', cls: 'warning', icon: 'tools', desc: '现场抢修', bg: '245, 158, 11' },
            returning: { text: '返程', cls: 'info', icon: 'arrow-left-circle', desc: '任务完成返回', bg: '139, 92, 246' },
            offline: { text: '离线', cls: 'secondary', icon: 'dash-circle', desc: '未连接', bg: '156, 163, 175' }
        };

        var html = '';
        crews.forEach(function(crew) {
            var cfg = statusConfig[crew.status] || statusConfig.offline;
            var isSelected = selectedCrewId === crew.id;
            var currentFault = crew.currentFaultId ? Store.getFault(crew.currentFaultId) : null;
            var bgColor = cfg.bg;

            var extraBtns = '';
            if (crew.status === 'working' || crew.status === 'enroute') {
                extraBtns = '<button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); CrewTracker.callCrew(\'' + crew.phone + '\')"><i class="bi bi-telephone me-1"></i>联系</button>';
            }

            html += '<div class="p-3 border-bottom ' + (isSelected ? 'bg-primary bg-opacity-5' : '') + '" style="cursor: pointer;" onclick="CrewTracker.selectCrew(\'' + crew.id + '\')">';
            html += '<div class="d-flex align-items-start">';
            html += '<div style="width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: rgba(' + bgColor + ', 0.1);">';
            html += '<i class="bi bi-' + cfg.icon + ' text-' + cfg.cls + ' fs-4"></i>';
            html += '</div>';
            html += '<div class="ms-3 flex-grow-1">';
            html += '<div class="d-flex justify-content-between align-items-center">';
            html += '<h6 class="mb-0">' + crew.name + '</h6>';
            html += '<span class="badge bg-' + cfg.cls + '">' + cfg.text + '</span>';
            html += '</div>';
            html += '<p class="small text-muted mb-1">班长: ' + crew.leader + ' | ' + crew.members + '人</p>';
            html += '<p class="small text-muted mb-1">' + cfg.desc + '</p>';
            if (currentFault) {
                html += '<div class="mt-2 p-2 bg-light rounded small"><i class="bi bi-lightning me-1"></i>当前: ' + currentFault.id + ' - ' + currentFault.typeText + '</div>';
            }
            html += '</div>';
            html += '</div>';
            html += '<div class="mt-2 d-flex gap-2">';
            html += '<button class="btn btn-sm btn-outline-' + cfg.cls + ' flex-grow-1" onclick="event.stopPropagation(); CrewTracker.focusOnCrew(\'' + crew.id + '\')"><i class="bi bi-geo me-1"></i>定位</button>';
            html += extraBtns;
            html += '</div>';
            html += '</div>';
        });

        $list.html(html);
    }

    function focusOnCrew(crewId) {
        var crew = Store.getCrew(crewId);
        if (!crew || !chart) return;
        selectedCrewId = crewId;
        selectCrew(crewId);
        chart.dispatchAction({
            type: 'showTip',
            seriesIndex: 0,
            name: crew.name
        });
    }

    function callCrew(phone) {
        alert('正在呼叫: ' + phone);
    }

    function resetMap() {
        selectedCrewId = null;
        $('#crew-select').val('');
        updateCrewMap();
        renderCrewList();
    }

    function initTrackReplayChart() {
        var dom = document.getElementById('track-replay-chart');
        if (!dom) return;
        trackChart = echarts.init(dom);
        trackChart.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: 40, right: 20, top: 20, bottom: 30 },
            xAxis: { type: 'time', axisLine: { lineStyle: { color: '#e5e7eb' } } },
            yAxis: { type: 'value', show: false },
            series: [{
                type: 'line',
                smooth: true,
                data: [],
                lineStyle: { width: 2 },
                areaStyle: {}
            }]
        });
    }

    function startReplay() {
        var crewId = $('#replay-crew-select').val();
        if (!crewId) {
            alert('请选择班组');
            return;
        }

        var crew = Store.getCrew(crewId);
        if (!crew) {
            alert('未找到班组');
            return;
        }

        isReplaying = true;
        $('#replay-btn').addClass('d-none');
        $('#stop-replay-btn').removeClass('d-none');

        var track = crew.track || [];
        if (track.length < 2) {
            alert('该班组暂无轨迹数据，请稍后再试');
            stopReplay();
            return;
        }

        var replayIndex = 0;
        var step = Math.max(1, Math.floor(track.length / 50));

        replayInterval = setInterval(function() {
            if (replayIndex >= track.length || !isReplaying) {
                stopReplay();
                return;
            }

            var currentData = track.slice(0, replayIndex + 1);
            var progress = Math.round((replayIndex / track.length) * 100);
            $('#replay-progress').text('回放进度: ' + progress + '%');

            if (trackChart) {
                trackChart.setOption({
                    series: [{
                        data: currentData.map(function(p, idx) {
                            return [p.time || (Date.now() - (track.length - idx) * 60000), Math.hypot(p.x - crew.baseX, p.y - crew.baseY)];
                        })
                    }]
                });
            }

            replayIndex += step;
        }, 200);
    }

    function stopReplay() {
        isReplaying = false;
        if (replayInterval) {
            clearInterval(replayInterval);
            replayInterval = null;
        }
        $('#replay-btn').removeClass('d-none');
        $('#stop-replay-btn').addClass('d-none');
        $('#replay-progress').text('');
    }

    function cleanup() {
        unsubscribeFns.forEach(function(fn) { fn && fn(); });
        unsubscribeFns = [];
        if (chart) { chart.dispose(); chart = null; }
        if (trackChart) { trackChart.dispose(); trackChart = null; }
        if (replayInterval) { clearInterval(replayInterval); replayInterval = null; }
        $(window).off('resize.crew');
    }

    return {
        render: render,
        selectCrew: selectCrew,
        focusOnCrew: focusOnCrew,
        callCrew: callCrew,
        resetMap: resetMap,
        startReplay: startReplay,
        stopReplay: stopReplay
    };
})();

window.CrewTracker = CrewTracker;
