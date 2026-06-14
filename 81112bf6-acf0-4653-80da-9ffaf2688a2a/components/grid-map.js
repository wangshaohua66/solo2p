var GridMap = (function() {
    var chart = null;
    var unsubscribeFns = [];
    var blinkInterval = null;
    var isBlinkOn = false;

    function render(container) {
        cleanup();

        var html = `
            <div class="row">
                <div class="col-lg-8 mb-4">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-diagram-3 me-2"></i>配电网络拓扑图</h5>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-secondary" onclick="GridMap.resetZoom()">
                                    <i class="bi bi-fullscreen-exit"></i> 重置视图
                                </button>
                                <button class="btn btn-sm btn-outline-primary" onclick="GridMap.toggleFaultHighlight()">
                                    <i class="bi bi-lightning"></i> 故障高亮
                                </button>
                            </div>
                        </div>
                        <div class="card-body p-0 position-relative">
                            <div id="grid-chart" style="width: 100%; height: 60vh; min-height: 450px;"></div>
                            <div class="position-absolute top-0 end-0 m-3 bg-white rounded shadow-sm p-2 small">
                                <div class="mb-1"><span class="d-inline-block rounded-circle bg-warning me-1" style="width:12px;height:12px;"></span>变电站</div>
                                <div class="mb-1"><span class="d-inline-block rounded-circle bg-success me-1" style="width:10px;height:10px;"></span>变压器</div>
                                <div class="mb-1"><span class="d-inline-block rounded-circle bg-secondary me-1" style="width:8px;height:8px;"></span>分支节点</div>
                                <div><span class="d-inline-block rounded-circle bg-danger me-1 animate-pulse" style="width:14px;height:14px;"></span>故障点</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4 mb-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-exclamation-triangle me-2"></i>活动故障</h5>
                        </div>
                        <div class="card-body p-0" style="max-height: 60vh; min-height: 450px; overflow-y: auto;">
                            <div id="active-faults-list"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div class="card grid-detail-card collapsed" id="grid-detail-panel">
                        <div class="card-header d-flex justify-content-between align-items-center cursor-pointer" onclick="GridMap.toggleDetailPanel()">
                            <h5 class="mb-0"><i class="bi bi-info-circle me-2"></i>节点详情</h5>
                            <i class="bi bi-chevron-up fs-5"></i>
                        </div>
                        <div class="card-body" id="node-detail-body">
                            <p class="text-muted mb-0">请点击拓扑图节点查看详情</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.html(html);
        initChart();
        renderActiveFaults();

        var unsub1 = Store.subscribe('faults', function() {
            renderActiveFaults();
            updateChart();
        });
        var unsub2 = Store.subscribe('crews', updateChart);
        unsubscribeFns.push(unsub1, unsub2);

        $(window).on('resize.gridmap', function() {
            if (chart) chart.resize();
        });
    }

    function initChart() {
        var start = performance.now();
        var dom = document.getElementById('grid-chart');
        if (!dom) return;

        chart = echarts.init(dom, null, { renderer: 'canvas' });
        chart.on('click', handleNodeClick);

        renderChart();

        var elapsed = performance.now() - start;
        if (elapsed > 800) {
            console.warn('Grid chart render exceeded 800ms:', elapsed);
        }
    }

    function renderChart() {
        if (!chart) return;

        var nodes = Store.get('gridNodes') || [];
        var links = Store.get('gridLinks') || [];
        var faults = Store.get('faults') || [];
        var crews = Store.get('crews') || [];

        var activeFaults = faults.filter(function(f) { return f.status !== 'resolved'; });
        var faultNodeIds = new Set();

        activeFaults.forEach(function(fault) {
            if (fault.lineId) {
                nodes.forEach(function(n) {
                    if (n.lineId === fault.lineId) {
                        faultNodeIds.add(n.id);
                    }
                });
            }
        });

        var graphNodes = nodes.map(function(n) {
            var isFaultLine = faultNodeIds.has(n.id);
            return {
                id: n.id,
                name: n.name,
                x: n.x,
                y: n.y,
                symbolSize: n.symbolSize,
                fixed: n.fixed,
                category: n.type,
                itemStyle: {
                    color: isFaultLine ? (isBlinkOn ? '#ef4444' : (n.type === 'substation' ? '#f59e0b' : n.type === 'transformer' ? '#10b981' : '#6b7280')) : (n.itemStyle && n.itemStyle.color),
                    borderColor: isFaultLine ? '#dc2626' : 'transparent',
                    borderWidth: isFaultLine ? 3 : 0,
                    shadowBlur: isFaultLine ? 20 : 0,
                    shadowColor: isFaultLine ? '#ef4444' : 'transparent'
                },
                label: {
                    show: n.type === 'substation',
                    position: 'bottom',
                    fontSize: 11,
                    color: '#374151'
                },
                _raw: n
            };
        });

        activeFaults.forEach(function(fault, idx) {
            graphNodes.push({
                id: 'FAULT_' + fault.id,
                name: fault.id + ' - ' + fault.typeText,
                x: fault.x,
                y: fault.y,
                symbolSize: 18,
                fixed: true,
                category: 'fault',
                itemStyle: {
                    color: isBlinkOn ? '#ef4444' : '#f87171',
                    borderColor: '#991b1b',
                    borderWidth: 2,
                    shadowBlur: 25,
                    shadowColor: '#ef4444'
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: fault.id,
                    fontSize: 11,
                    color: '#dc2626',
                    fontWeight: 'bold'
                },
                _raw: { type: 'fault', fault: fault }
            });
        });

        crews.forEach(function(crew) {
            var color = crew.status === 'idle' ? '#10b981' : crew.status === 'enroute' ? '#3b82f6' : crew.status === 'working' ? '#f59e0b' : crew.status === 'returning' ? '#8b5cf6' : '#9ca3af';
            graphNodes.push({
                id: 'CREW_' + crew.id,
                name: crew.name,
                x: crew.x,
                y: crew.y,
                symbolSize: 16,
                fixed: true,
                category: 'crew',
                itemStyle: {
                    color: color,
                    borderColor: '#fff',
                    borderWidth: 2,
                    shadowBlur: 10,
                    shadowColor: color
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: crew.name,
                    fontSize: 10,
                    color: '#374151'
                },
                _raw: { type: 'crew', crew: crew }
            });
        });

        var graphLinks = links.map(function(l) {
            var isFaultLine = false;
            activeFaults.forEach(function(f) {
                if (f.lineName === l.lineName) isFaultLine = true;
            });
            return {
                source: l.source,
                target: l.target,
                lineStyle: {
                    color: isFaultLine ? (isBlinkOn ? '#ef4444' : '#f87171') : (l.lineStyle && l.lineStyle.color),
                    width: isFaultLine ? (l.lineStyle.width || 2) + 1 : (l.lineStyle && l.lineStyle.width),
                    type: 'solid'
                },
                _raw: l
            };
        });

        var option = {
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    if (params.dataType === 'edge') {
                        return '<strong>' + (params.data._raw && params.data._raw.lineName) + '</strong><br/>线路连接';
                    }
                    var raw = params.data._raw;
                    if (raw && raw.type === 'fault') {
                        var f = raw.fault;
                        var levelText = { urgent: '紧急', major: '重大', normal: '一般' }[f.level];
                        return '<strong>' + f.id + ' - ' + f.typeText + '</strong><br/>' +
                            '等级: ' + levelText + '<br/>' +
                            '位置: ' + f.location + '<br/>' +
                            '线路: ' + f.lineName + '<br/>' +
                            '影响用户: ' + f.affectedUsers + '户<br/>' +
                            '接报时间: ' + moment(f.reportTime).format('HH:mm:ss');
                    }
                    if (raw && raw.type === 'crew') {
                        var c = raw.crew;
                        var statusText = { idle: '空闲', enroute: '在途', working: '作业中', returning: '返程' }[c.status];
                        return '<strong>' + c.name + '</strong><br/>' +
                            '班长: ' + c.leader + '<br/>' +
                            '状态: ' + statusText + '<br/>' +
                            '人数: ' + c.members + '人';
                    }
                    if (raw) {
                        var typeText = { substation: '变电站', transformer: '变压器', junction: '分支节点' }[raw.type];
                        return '<strong>' + raw.name + '</strong><br/>' +
                            '类型: ' + typeText + '<br/>' +
                            (raw.voltage ? '电压: ' + raw.voltage + '<br/>' : '') +
                            (raw.line ? '线路: ' + raw.line : '');
                    }
                    return params.name;
                }
            },
            animationDuration: 300,
            series: [{
                type: 'graph',
                layout: 'none',
                roam: true,
                focusNodeAdjacency: true,
                data: graphNodes,
                links: graphLinks,
                categories: [
                    { name: '变电站', itemStyle: { color: '#f59e0b' } },
                    { name: '变压器', itemStyle: { color: '#10b981' } },
                    { name: '分支节点', itemStyle: { color: '#6b7280' } },
                    { name: '故障点', itemStyle: { color: '#ef4444' } },
                    { name: '抢修班组', itemStyle: { color: '#3b82f6' } }
                ],
                lineStyle: {
                    curveness: 0,
                    opacity: 0.9
                },
                emphasis: {
                    focus: 'adjacency',
                    lineStyle: {
                        width: 4
                    }
                }
            }]
        };

        chart.setOption(option, true);
    }

    function updateChart() {
        if (!chart) return;
        if (blinkInterval) clearInterval(blinkInterval);

        blinkInterval = setInterval(function() {
            isBlinkOn = !isBlinkOn;
            renderChart();
        }, 800);

        renderChart();
    }

    function handleNodeClick(params) {
        if (params.dataType === 'edge') return;
        var raw = params.data && params.data._raw;
        if (!raw) return;

        var panel = $('#grid-detail-panel');
        var body = $('#node-detail-body');
        panel.removeClass('collapsed');
        panel.find('.card-header i').attr('class', 'bi bi-chevron-down fs-5');

        var html = '';

        if (raw.type === 'fault') {
            var f = raw.fault;
            var levelBadge = { urgent: 'danger', major: 'warning', normal: 'primary' }[f.level];
            var levelText = { urgent: '紧急', major: '重大', normal: '一般' }[f.level];
            var statusText = { reported: '待派工', dispatched: '进行中', checking: '待验收', resolved: '已复电' }[f.status];
            html = `
                <div class="row">
                    <div class="col-md-6">
                        <span class="badge bg-${levelBadge} fs-6 me-2">${levelText}</span>
                        <h5 class="d-inline">${f.id} - ${f.typeText}</h5>
                        <table class="table table-sm mt-3">
                            <tr><td class="text-muted" style="width:100px">故障位置</td><td>${f.location}</td></tr>
                            <tr><td class="text-muted">所属线路</td><td>${f.lineName} (${f.voltage})</td></tr>
                            <tr><td class="text-muted">影响用户</td><td>${f.affectedUsers} 户</td></tr>
                            <tr><td class="text-muted">当前状态</td><td>${statusText}</td></tr>
                            <tr><td class="text-muted">负责班组</td><td>${f.crewName || '未指派'}</td></tr>
                            <tr><td class="text-muted">接报时间</td><td>${moment(f.reportTime).format('YYYY-MM-DD HH:mm:ss')}</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>故障描述</h6>
                        <p class="bg-light p-3 rounded">${f.description}</p>
                        <div class="d-flex gap-2">
                            <button class="btn btn-primary" onclick="DataService.showFaultDetail(Store.getFault('${f.id}'))">
                                <i class="bi bi-eye me-1"></i>查看详情
                            </button>
                            ${f.status === 'reported' ? '<button class="btn btn-success" onclick="FaultPanel.quickDispatch(\'' + f.id + '\')"><i class="bi bi-send me-1"></i>派工</button>' : ''}
                        </div>
                    </div>
                </div>
            `;
        } else if (raw.type === 'crew') {
            var c = raw.crew;
            var statusColor = { idle: 'success', enroute: 'primary', working: 'warning', returning: 'info' }[c.status];
            var statusText = { idle: '空闲', enroute: '在途', working: '作业中', returning: '返程' }[c.status];
            html = `
                <div class="row">
                    <div class="col-md-6">
                        <span class="badge bg-${statusColor} fs-6 me-2">${statusText}</span>
                        <h5 class="d-inline">${c.name}</h5>
                        <table class="table table-sm mt-3">
                            <tr><td class="text-muted" style="width:100px">班长</td><td>${c.leader}</td></tr>
                            <tr><td class="text-muted">联系电话</td><td>${c.phone}</td></tr>
                            <tr><td class="text-muted">成员人数</td><td>${c.members} 人</td></tr>
                            <tr><td class="text-muted">今日任务</td><td>${c.todayTasks || 0} 单</td></tr>
                            <tr><td class="text-muted">平均复电</td><td>${c.avgRecoveryTime || 0} 分钟</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>当前位置</h6>
                        <p class="bg-light p-3 rounded">坐标: (${c.x.toFixed(1)}, ${c.y.toFixed(1)})</p>
                        ${c.currentFaultId ? `
                            <button class="btn btn-outline-primary" onclick="DataService.showFaultDetail(Store.getFault('${c.currentFaultId}'))">
                                <i class="bi bi-geo me-1"></i>查看当前任务
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        } else {
            var typeText = { substation: '变电站', transformer: '变压器', junction: '分支节点' }[raw.type];
            html = `
                <div class="row">
                    <div class="col-md-6">
                        <h5>${raw.name}</h5>
                        <table class="table table-sm mt-3">
                            <tr><td class="text-muted" style="width:100px">节点类型</td><td>${typeText}</td></tr>
                            ${raw.voltage ? '<tr><td class="text-muted">电压等级</td><td>' + raw.voltage + '</td></tr>' : ''}
                            ${raw.line ? '<tr><td class="text-muted">所属线路</td><td>' + raw.line + '</td></tr>' : ''}
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>节点坐标</h6>
                        <p class="bg-light p-3 rounded">X: ${raw.x.toFixed(1)}, Y: ${raw.y.toFixed(1)}</p>
                    </div>
                </div>
            `;
        }

        body.html(html);
    }

    function renderActiveFaults() {
        var faults = Store.get('faults') || [];
        var active = faults.filter(function(f) { return f.status !== 'resolved'; });
        var $list = $('#active-faults-list');

        if (active.length === 0) {
            $list.html(`
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-check2-circle fs-1 d-block mb-2 text-success"></i>
                    <p>暂无活动故障</p>
                </div>
            `);
            return;
        }

        var levelConfig = {
            urgent: { text: '紧急', cls: 'danger' },
            major: { text: '重大', cls: 'warning' },
            normal: { text: '一般', cls: 'primary' }
        };

        var html = '';
        active.forEach(function(fault) {
            var cfg = levelConfig[fault.level];
            var elapsed = Math.round((Date.now() - moment(fault.reportTime)) / 60000);

            html += `
                <div class="list-group-item list-group-item-action border-0 border-start border-4 border-${cfg.cls} py-3"
                     onclick="GridMap.focusFault('${fault.id}')">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <div>
                            <span class="badge bg-${cfg.cls} me-1">${cfg.text}</span>
                            <small class="fw-bold">${fault.id}</small>
                        </div>
                        <small class="text-danger">${elapsed}分</small>
                    </div>
                    <div class="small fw-medium mb-1">${fault.typeText}</div>
                    <div class="small text-muted mb-1">
                        <i class="bi bi-geo-alt me-1"></i>${fault.location}
                    </div>
                    <div class="small text-muted">
                        <i class="bi bi-people me-1"></i>${fault.affectedUsers}户
                        <span class="mx-2">|</span>
                        ${fault.crewName || '<span class="text-warning">待派工</span>'}
                    </div>
                </div>
            `;
        });

        $list.html(html);
    }

    function focusFault(faultId) {
        var fault = Store.getFault(faultId);
        if (!fault || !chart) return;

        chart.dispatchAction({
            type: 'showTip',
            seriesIndex: 0,
            dataIndex: chart.getOption().series[0].data.findIndex(function(d) {
                return d.id === 'FAULT_' + faultId;
            })
        });

        chart.dispatchAction({
            type: 'highlight',
            seriesIndex: 0,
            name: fault.id + ' - ' + fault.typeText
        });
    }

    function resetZoom() {
        if (!chart) return;
        chart.dispatchAction({
            type: 'restore'
        });
    }

    function toggleFaultHighlight() {
        if (!chart) return;
        isBlinkOn = !isBlinkOn;
        renderChart();
    }

    function toggleDetailPanel() {
        var panel = $('#grid-detail-panel');
        var icon = panel.find('.card-header i');
        if (panel.hasClass('collapsed')) {
            panel.removeClass('collapsed');
            icon.attr('class', 'bi bi-chevron-down fs-5');
        } else {
            panel.addClass('collapsed');
            icon.attr('class', 'bi bi-chevron-up fs-5');
        }
    }

    function cleanup() {
        unsubscribeFns.forEach(function(fn) { fn && fn(); });
        unsubscribeFns = [];
        if (blinkInterval) {
            clearInterval(blinkInterval);
            blinkInterval = null;
        }
        if (chart) {
            chart.dispose();
            chart = null;
        }
        $(window).off('resize.gridmap');
    }

    return {
        render: render,
        resetZoom: resetZoom,
        toggleFaultHighlight: toggleFaultHighlight,
        toggleDetailPanel: toggleDetailPanel,
        focusFault: focusFault
    };
})();

window.GridMap = GridMap;
