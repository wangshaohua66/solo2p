var DataService = (function() {
    var simulationInterval = null;
    var crewMoveInterval = null;
    var faultIdCounter = 1000;

    var substations = [
        { id: 'SS01', name: '城北变电站', voltage: '35kV', x: 300, y: 100 },
        { id: 'SS02', name: '城南变电站', voltage: '35kV', x: 700, y: 500 },
        { id: 'SS03', name: '城东变电站', voltage: '35kV', x: 800, y: 150 },
        { id: 'SS04', name: '城西变电站', voltage: '35kV', x: 150, y: 400 },
        { id: 'SS05', name: '开发区变电站', voltage: '35kV', x: 550, y: 80 },
        { id: 'SS06', name: '工业园区变电站', voltage: '35kV', x: 650, y: 300 },
        { id: 'SS07', name: '新城区变电站', voltage: '35kV', x: 400, y: 250 },
        { id: 'SS08', name: '老城区变电站', voltage: '35kV', x: 250, y: 300 }
    ];

    var lines = [
        { id: 'L001', name: '城北线', from: 'SS01', length: 15.2 },
        { id: 'L002', name: '城南线', from: 'SS02', length: 12.8 },
        { id: 'L003', name: '城东线', from: 'SS03', length: 18.5 },
        { id: 'L004', name: '城西线', from: 'SS04', length: 14.3 },
        { id: 'L005', name: '开发线', from: 'SS05', length: 11.6 },
        { id: 'L006', name: '工业园线', from: 'SS06', length: 16.9 },
        { id: 'L007', name: '新城线', from: 'SS07', length: 13.4 },
        { id: 'L008', name: '老城线', from: 'SS08', length: 9.8 },
        { id: 'L009', name: '工业二线', from: 'SS06', length: 20.1 },
        { id: 'L010', name: '开发二线', from: 'SS05', length: 17.5 }
    ];

    var faultTypes = [
        { id: 'overload', name: '过载', weight: 15 },
        { id: 'short_circuit', name: '短路故障', weight: 25 },
        { id: 'ground_fault', name: '接地故障', weight: 20 },
        { id: 'equipment_failure', name: '设备故障', weight: 18 },
        { id: 'weather', name: '天气原因', weight: 12 },
        { id: 'external', name: '外力破坏', weight: 10 }
    ];

    var locations = [
        '城北街道光明社区', '城南工业园区A区', '城东开发区创业路', '城西老城区人民路',
        '开发区科技大道', '工业园区新兴路', '新城区中央公园', '老城区中山街',
        '城北镇政府周边', '城南街道幸福小区', '城东商贸区', '西郊物流园区',
        '高新技术产业园', '经济开发区管委会', '新城区实验小学', '老城区第一医院',
        '城北工业区', '城南安置小区', '城东高速路口', '西郊农业示范区'
    ];

    var weatherConditions = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '雷暴', '大风'];

    var defaultCrews = [
        { id: 'CR01', name: '抢修一班', leader: '张建国', phone: '13800138001', members: 4, status: 'idle', x: 350, y: 200, baseX: 350, baseY: 200, currentFaultId: null, todayTasks: 0, avgRecoveryTime: 125, track: [] },
        { id: 'CR02', name: '抢修二班', leader: '李志强', phone: '13800138002', members: 3, status: 'idle', x: 650, y: 450, baseX: 650, baseY: 450, currentFaultId: null, todayTasks: 0, avgRecoveryTime: 140, track: [] },
        { id: 'CR03', name: '抢修三班', leader: '王伟民', phone: '13800138003', members: 5, status: 'idle', x: 750, y: 200, baseX: 750, baseY: 200, currentFaultId: null, todayTasks: 0, avgRecoveryTime: 110, track: [] },
        { id: 'CR04', name: '抢修四班', leader: '赵德胜', phone: '13800138004', members: 3, status: 'idle', x: 200, y: 350, baseX: 200, baseY: 350, currentFaultId: null, todayTasks: 0, avgRecoveryTime: 150, track: [] },
        { id: 'CR05', name: '抢修五班', leader: '孙立军', phone: '13800138005', members: 4, status: 'idle', x: 500, y: 150, baseX: 500, baseY: 150, currentFaultId: null, todayTasks: 0, avgRecoveryTime: 130, track: [] },
        { id: 'CR06', name: '抢修六班', leader: '周明辉', phone: '13800138006', members: 4, status: 'idle', x: 300, y: 280, baseX: 300, baseY: 280, currentFaultId: null, todayTasks: 0, avgRecoveryTime: 118, track: [] }
    ];

    function init() {
        if (Store.get('crews').length === 0) {
            Store.mutate('crews', JSON.parse(JSON.stringify(defaultCrews)));
        }
        generateGridData();
        if (Store.get('faults').length === 0) {
            generateHistoricalFaults(30);
        }
    }

    function generateGridData() {
        var nodes = [];
        var links = [];
        var nodeId = 0;

        substations.forEach(function(ss) {
            nodes.push({
                id: 'NODE_' + (nodeId++),
                name: ss.name,
                type: 'substation',
                voltage: ss.voltage,
                x: ss.x,
                y: ss.y,
                symbolSize: 30,
                itemStyle: { color: '#f59e0b' },
                fixed: true
            });
        });

        lines.forEach(function(line) {
            var fromSs = substations.find(function(s) { return s.id === line.from; });
            if (!fromSs) return;

            var transformerCount = Math.floor(line.length / 2) + 2;
            var prevNodeId = 'NODE_' + substations.findIndex(function(s) { return s.id === line.from; });

            for (var i = 0; i < transformerCount; i++) {
                var t = (i + 1) / (transformerCount + 1);
                var tx = fromSs.x + (Math.random() - 0.5) * 200 + (i % 2 === 0 ? 50 : -50);
                var ty = fromSs.y + t * 150 + (Math.random() - 0.5) * 80;
                tx = Math.max(50, Math.min(900, tx));
                ty = Math.max(50, Math.min(550, ty));

                var transformerNodeId = 'NODE_' + (nodeId++);
                nodes.push({
                    id: transformerNodeId,
                    name: line.name + '#' + (i + 1) + '变压器',
                    type: 'transformer',
                    line: line.name,
                    lineId: line.id,
                    x: tx,
                    y: ty,
                    symbolSize: 14,
                    itemStyle: { color: '#10b981' },
                    fixed: false
                });

                links.push({
                    source: prevNodeId,
                    target: transformerNodeId,
                    lineName: line.name,
                    lineStyle: { color: '#3b82f6', width: 2 }
                });

                prevNodeId = transformerNodeId;

                if (i % 2 === 0 && i > 0) {
                    var branchCount = Math.floor(Math.random() * 3) + 1;
                    for (var j = 0; j < branchCount; j++) {
                        var bx = tx + (j - 1) * 60 + (Math.random() - 0.5) * 40;
                        var by = ty + 50 + Math.random() * 50;
                        bx = Math.max(50, Math.min(900, bx));
                        by = Math.max(50, Math.min(550, by));

                        var branchNodeId = 'NODE_' + (nodeId++);
                        nodes.push({
                            id: branchNodeId,
                            name: line.name + '分支#' + (i + 1) + '-' + (j + 1),
                            type: 'junction',
                            line: line.name,
                            lineId: line.id,
                            x: bx,
                            y: by,
                            symbolSize: 8,
                            itemStyle: { color: '#6b7280' },
                            fixed: false
                        });

                        links.push({
                            source: transformerNodeId,
                            target: branchNodeId,
                            lineName: line.name,
                            lineStyle: { color: '#9ca3af', width: 1 }
                        });
                    }
                }
            }
        });

        Store.mutate('gridNodes', nodes);
        Store.mutate('gridLinks', links);
    }

    function generateHistoricalFaults(days) {
        var now = moment();
        for (var d = days; d >= 0; d--) {
            var faultsPerDay = Math.floor(Math.random() * 5) + 2;
            for (var i = 0; i < faultsPerDay; i++) {
                var reportTime = now.clone().subtract(d, 'days').subtract(Math.random() * 12, 'hours').subtract(Math.random() * 60, 'minutes');
                var fault = createFaultObject(reportTime.toISOString());
                var recoveryMinutes = Math.floor(Math.random() * 180) + 30;
                fault.recoveryTime = reportTime.clone().add(recoveryMinutes, 'minutes').toISOString();
                fault.status = 'resolved';
                fault.crewId = defaultCrews[Math.floor(Math.random() * defaultCrews.length)].id;
                fault.crewName = defaultCrews.find(function(c) { return c.id === fault.crewId; }).name;
                fault.timeline = generateTimeline(fault, recoveryMinutes);
                Store.addFault(fault);
            }
        }
    }

    function generateTimeline(fault, durationMin) {
        var reportTime = moment(fault.reportTime);
        return [
            {
                node: 'report',
                title: '故障接报',
                operator: '调度员',
                time: reportTime.format('YYYY-MM-DD HH:mm:ss'),
                remark: fault.description
            },
            {
                node: 'dispatch',
                title: '派工完成',
                operator: fault.crewName || '抢修一班',
                time: reportTime.clone().add(5 + Math.floor(Math.random() * 10), 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                remark: '已通知班组前往现场'
            },
            {
                node: 'arrive',
                title: '到达现场',
                operator: fault.crewName || '抢修一班',
                time: reportTime.clone().add(20 + Math.floor(Math.random() * 30), 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                remark: '现场勘查完毕，确认故障点'
            },
            {
                node: 'repair',
                title: '抢修作业中',
                operator: fault.crewName || '抢修一班',
                time: reportTime.clone().add(40 + Math.floor(Math.random() * 40), 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                remark: '正在实施故障隔离与修复'
            },
            {
                node: 'check',
                title: '待验收',
                operator: '调度员',
                time: reportTime.clone().add(durationMin - 10, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                remark: '抢修完成，申请验收'
            },
            {
                node: 'resolve',
                title: '恢复供电',
                operator: '调度员',
                time: reportTime.clone().add(durationMin, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                remark: '验收通过，已恢复供电'
            }
        ];
    }

    function startSimulation() {
        simulateNewFault();
        simulationInterval = setInterval(simulateNewFault, 45000 + Math.random() * 60000);
        crewMoveInterval = setInterval(simulateCrewMovement, 3000);
        setInterval(updateFaultProgress, 5000);
    }

    function stopSimulation() {
        if (simulationInterval) clearInterval(simulationInterval);
        if (crewMoveInterval) clearInterval(crewMoveInterval);
    }

    function simulateNewFault() {
        var shouldRing = Math.random() > 0.5;
        var fault = createFaultObject();

        if (shouldRing) {
            showIncomingCall(fault);
        } else {
            Store.addFault(fault);
        }
    }

    function createFaultObject(reportTime) {
        var line = lines[Math.floor(Math.random() * lines.length)];
        var location = locations[Math.floor(Math.random() * locations.length)];
        var faultType = weightedRandom(faultTypes);
        var weather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
        var voltage = ['10kV', '35kV'][Math.random() > 0.3 ? 0 : 1];
        var affectedUsers = calculateAffectedUsers(faultType.id, voltage);
        var level = calculateFaultLevel(affectedUsers, voltage, weather);

        faultIdCounter++;
        return {
            id: 'F' + faultIdCounter,
            type: faultType.id,
            typeText: faultType.name,
            level: level,
            lineId: line.id,
            lineName: line.name,
            location: location,
            voltage: voltage,
            weather: weather,
            affectedUsers: affectedUsers,
            reporter: ['客户报修', '线路巡检', '监控系统', '95598工单'][Math.floor(Math.random() * 4)],
            reporterPhone: '138****' + Math.floor(1000 + Math.random() * 9000),
            description: generateFaultDescription(faultType.name, location),
            status: 'reported',
            reportTime: reportTime || new Date().toISOString(),
            dispatchTime: null,
            arriveTime: null,
            recoveryTime: null,
            crewId: null,
            crewName: null,
            estimatedArrival: null,
            x: 100 + Math.random() * 800,
            y: 80 + Math.random() * 450,
            timeline: []
        };
    }

    function weightedRandom(items) {
        var total = items.reduce(function(sum, item) { return sum + item.weight; }, 0);
        var r = Math.random() * total;
        for (var i = 0; i < items.length; i++) {
            r -= items[i].weight;
            if (r <= 0) return items[i];
        }
        return items[0];
    }

    function calculateAffectedUsers(type, voltage) {
        var base = voltage === '35kV' ? 500 : 100;
        var multiplier = { overload: 1.5, short_circuit: 2.5, ground_fault: 1.8, equipment_failure: 1.2, weather: 2.0, external: 1.6 }[type] || 1;
        return Math.floor(base * multiplier * (0.5 + Math.random()));
    }

    function calculateFaultLevel(users, voltage, weather) {
        var score = 0;
        if (users >= 500) score += 3;
        else if (users >= 200) score += 2;
        else if (users >= 50) score += 1;

        if (voltage === '35kV') score += 2;
        else score += 1;

        if (['雷暴', '大雨', '大风'].indexOf(weather) !== -1) score += 2;
        else if (['中雨', '小雨'].indexOf(weather) !== -1) score += 1;

        if (score >= 6) return 'urgent';
        if (score >= 4) return 'major';
        return 'normal';
    }

    function generateFaultDescription(type, location) {
        var templates = {
            '过载': [location + '配变负载率过高，温度异常报警', location + '区域用电负荷突增，设备过载运行'],
            '短路故障': [location + '相间短路，开关跳闸', location + '疑似异物搭挂引发短路'],
            '接地故障': [location + '发生单相接地故障', location + '线路接地报警，需要现场排查'],
            '设备故障': [location + '变压器异响，疑似内部故障', location + '开关设备操作机构卡涩'],
            '天气原因': [location + '暴雨导致线路跳闸', location + '大风引起线路舞动跳闸'],
            '外力破坏': [location + '疑似施工挖断电缆', location + '车辆撞断电杆']
        };
        var arr = templates[type] || ['故障待排查'];
        return arr[Math.floor(Math.random() * arr.length)];
    }

    var pendingCallFault = null;
    function showIncomingCall(fault) {
        pendingCallFault = fault;
        $('#caller-name').text(fault.reporter);
        $('#caller-phone').text(fault.reporterPhone);
        $('#call-location').text(fault.location);
        $('#call-desc').text(fault.description);
        var modal = new bootstrap.Modal(document.getElementById('incomingCallModal'));
        modal.show();
    }

    function acceptIncomingCall() {
        if (pendingCallFault) {
            Store.addFault(pendingCallFault);
            pendingCallFault = null;
        }
        var modal = bootstrap.Modal.getInstance(document.getElementById('incomingCallModal'));
        if (modal) modal.hide();
    }

    function simulateCrewMovement() {
        var crews = Store.get('crews') || [];
        crews.forEach(function(crew) {
            var targetX, targetY;
            if (crew.status === 'enroute' && crew.currentFaultId) {
                var fault = Store.getFault(crew.currentFaultId);
                if (fault) {
                    targetX = fault.x;
                    targetY = fault.y;
                    var dist = Math.hypot(targetX - crew.x, targetY - crew.y);
                    if (dist < 15) {
                        crew.status = 'working';
                        crew.x = targetX;
                        crew.y = targetY;
                        crew.track.push({ x: crew.x, y: crew.y, time: Date.now() });
                        if (crew.track.length > 100) crew.track.shift();
                        if (fault.status === 'dispatched') {
                            Store.updateFault(fault.id, {
                                status: 'checking',
                                arriveTime: new Date().toISOString()
                            });
                            addTimelineEvent(fault.id, 'arrive', crew.name, '到达现场，开始作业');
                        }
                        Store.updateCrew(crew.id, crew);
                        return;
                    }
                } else {
                    targetX = crew.baseX;
                    targetY = crew.baseY;
                }
            } else if (crew.status === 'returning') {
                targetX = crew.baseX;
                targetY = crew.baseY;
                var dist = Math.hypot(targetX - crew.x, targetY - crew.y);
                if (dist < 10) {
                    crew.status = 'idle';
                    crew.x = targetX;
                    crew.y = targetY;
                    crew.currentFaultId = null;
                }
            } else if (crew.status === 'idle') {
                if (Math.random() < 0.3) {
                    crew.x += (Math.random() - 0.5) * 20;
                    crew.y += (Math.random() - 0.5) * 20;
                    crew.x = Math.max(50, Math.min(900, crew.x));
                    crew.y = Math.max(50, Math.min(550, crew.y));
                    crew.track.push({ x: crew.x, y: crew.y, time: Date.now() });
                    if (crew.track.length > 100) crew.track.shift();
                }
                Store.updateCrew(crew.id, crew);
                return;
            } else {
                targetX = crew.x + (Math.random() - 0.5) * 5;
                targetY = crew.y + (Math.random() - 0.5) * 5;
            }

            var dx = targetX - crew.x;
            var dy = targetY - crew.y;
            var dist = Math.hypot(dx, dy);
            if (dist > 0) {
                var speed = crew.status === 'enroute' ? 8 : crew.status === 'returning' ? 6 : 3;
                crew.x += (dx / dist) * speed;
                crew.y += (dy / dist) * speed;
                crew.track.push({ x: crew.x, y: crew.y, time: Date.now() });
                if (crew.track.length > 100) crew.track.shift();
            }
            Store.updateCrew(crew.id, crew);
        });
    }

    function updateFaultProgress() {
        var faults = Store.get('faults') || [];
        faults.forEach(function(fault) {
            if (fault.status === 'checking') {
                var arriveTime = fault.arriveTime ? moment(fault.arriveTime) : moment(fault.reportTime);
                var elapsed = moment().diff(arriveTime, 'minutes');
                var expectedDuration = { urgent: 45, major: 75, normal: 100 }[fault.level] || 60;
                if (elapsed > expectedDuration && Math.random() < 0.3) {
                    Store.updateFault(fault.id, {
                        status: 'resolved',
                        recoveryTime: new Date().toISOString()
                    });
                    addTimelineEvent(fault.id, 'resolve', '调度员', '验收通过，恢复供电');
                    if (fault.crewId) {
                        var crew = Store.getCrew(fault.crewId);
                        if (crew) {
                            crew.status = 'returning';
                            crew.todayTasks = (crew.todayTasks || 0) + 1;
                            Store.updateCrew(crew.id, crew);
                        }
                    }
                }
            }
        });
    }

    function dispatchCrew(faultId, crewId) {
        var fault = Store.getFault(faultId);
        var crew = Store.getCrew(crewId);
        if (!fault || !crew) return false;

        var estMinutes = estimateTravelTime(crew, fault);

        Store.updateFault(faultId, {
            status: 'dispatched',
            crewId: crewId,
            crewName: crew.name,
            dispatchTime: new Date().toISOString(),
            estimatedArrival: moment().add(estMinutes, 'minutes').toISOString()
        });

        crew.status = 'enroute';
        crew.currentFaultId = faultId;
        Store.updateCrew(crewId, crew);

        addTimelineEvent(faultId, 'dispatch', crew.name, '已派工，预计' + estMinutes + '分钟到达');

        return true;
    }

    function estimateTravelTime(crew, fault) {
        var dist = Math.hypot(fault.x - crew.x, fault.y - crew.y);
        return Math.max(5, Math.round(dist / 15));
    }

    function findNearestAvailableCrew(fault) {
        var crews = Store.get('crews') || [];
        var available = crews.filter(function(c) { return c.status === 'idle'; });
        if (available.length === 0) return null;

        var nearest = available[0];
        var minDist = Infinity;
        available.forEach(function(c) {
            var dist = Math.hypot(fault.x - c.x, fault.y - c.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = c;
            }
        });
        return nearest;
    }

    function addTimelineEvent(faultId, node, operator, remark) {
        var fault = Store.getFault(faultId);
        if (!fault) return;
        fault.timeline = fault.timeline || [];
        var titleMap = { report: '故障接报', dispatch: '派工完成', arrive: '到达现场', repair: '抢修作业中', check: '待验收', resolve: '恢复供电' };
        fault.timeline.push({
            node: node,
            title: titleMap[node] || node,
            operator: operator,
            time: moment().format('YYYY-MM-DD HH:mm:ss'),
            remark: remark
        });
        Store.updateFault(faultId, { timeline: fault.timeline });
    }

    function showFaultDetail(fault) {
        var levelBadge = { urgent: 'danger', major: 'warning', normal: 'primary' };
        var levelText = { urgent: '紧急', major: '重大', normal: '一般' };
        var statusText = { reported: '待派工', dispatched: '进行中', checking: '待验收', resolved: '已复电' };
        var statusBadge = { reported: 'secondary', dispatched: 'info', checking: 'warning', resolved: 'success' };

        var timelineHtml = '';
        (fault.timeline || []).forEach(function(event, idx) {
            timelineHtml += `
                <li class="timeline-item">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="mb-1">${event.title}</h6>
                            <small class="text-muted">${event.time}</small>
                        </div>
                        <p class="mb-1 small"><strong>操作人：</strong>${event.operator}</p>
                        ${event.remark ? '<p class="mb-0 small text-muted">' + event.remark + '</p>' : ''}
                    </div>
                </li>
            `;
        });

        var duration = '-';
        if (fault.recoveryTime) {
            duration = Math.round((moment(fault.recoveryTime) - moment(fault.reportTime)) / 60000) + ' 分钟';
        } else if (fault.reportTime) {
            duration = Math.round((Date.now() - moment(fault.reportTime)) / 60000) + ' 分钟(进行中)';
        }

        var html = `
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <span class="badge bg-${levelBadge[fault.level]} fs-6 me-2">${levelText[fault.level]}</span>
                        <span class="badge bg-${statusBadge[fault.status]} fs-6">${statusText[fault.status]}</span>
                    </div>
                    <table class="table table-sm table-borderless">
                        <tr><td class="text-muted" style="width:100px">故障编号</td><td><strong>${fault.id}</strong></td></tr>
                        <tr><td class="text-muted">故障类型</td><td>${fault.typeText}</td></tr>
                        <tr><td class="text-muted">所属线路</td><td>${fault.lineName} (${fault.voltage})</td></tr>
                        <tr><td class="text-muted">故障位置</td><td>${fault.location}</td></tr>
                        <tr><td class="text-muted">影响用户</td><td>${fault.affectedUsers} 户</td></tr>
                        <tr><td class="text-muted">天气条件</td><td>${fault.weather}</td></tr>
                        <tr><td class="text-muted">信息来源</td><td>${fault.reporter}</td></tr>
                        <tr><td class="text-muted">负责班组</td><td>${fault.crewName || '<span class="text-muted">未指派</span>'}</td></tr>
                        <tr><td class="text-muted">接报时间</td><td>${moment(fault.reportTime).format('YYYY-MM-DD HH:mm:ss')}</td></tr>
                        <tr><td class="text-muted">处理时长</td><td>${duration}</td></tr>
                    </table>
                    <div class="p-3 bg-light rounded">
                        <strong>故障描述：</strong>
                        <p class="mb-0 mt-1">${fault.description}</p>
                    </div>
                </div>
                <div class="col-md-6">
                    <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-clock-history me-2"></i>处置时间轴</h6>
                    <ul class="timeline-list">
                        ${timelineHtml}
                    </ul>
                </div>
            </div>
        `;

        $('#faultDetailTitle').text('故障详情 - ' + fault.id);
        $('#faultDetailBody').html(html);
        var modal = new bootstrap.Modal(document.getElementById('faultDetailModal'));
        modal.show();
    }

    function getStats() {
        var faults = Store.get('faults') || [];
        var todayStart = moment().startOf('day');
        var todayFaults = faults.filter(function(f) { return moment(f.reportTime).isAfter(todayStart); });

        var resolvedFaults = faults.filter(function(f) { return f.status === 'resolved' && f.recoveryTime; });
        var avgRecoveryTime = 0;
        if (resolvedFaults.length > 0) {
            var total = resolvedFaults.reduce(function(sum, f) {
                return sum + (moment(f.recoveryTime) - moment(f.reportTime));
            }, 0);
            avgRecoveryTime = Math.round(total / resolvedFaults.length / 60000);
        }

        var crews = Store.get('crews') || [];
        var busyCrews = crews.filter(function(c) { return c.status === 'enroute' || c.status === 'working'; }).length;
        var crewUtilization = crews.length > 0 ? Math.round(busyCrews / crews.length * 100) : 0;

        var recoveryTrend = [];
        for (var i = 29; i >= 0; i--) {
            var day = moment().subtract(i, 'days');
            var dayStart = day.clone().startOf('day');
            var dayEnd = day.clone().endOf('day');
            var dayResolved = faults.filter(function(f) {
                return f.status === 'resolved' && f.recoveryTime &&
                    moment(f.recoveryTime).isAfter(dayStart) && moment(f.recoveryTime).isBefore(dayEnd);
            });
            var dayAvg = 0;
            if (dayResolved.length > 0) {
                var dayTotal = dayResolved.reduce(function(sum, f) {
                    return sum + (moment(f.recoveryTime) - moment(f.reportTime));
                }, 0);
                dayAvg = Math.round(dayTotal / dayResolved.length / 60000);
            }
            recoveryTrend.push({
                date: day.format('MM-DD'),
                avgTime: dayAvg,
                count: dayResolved.length
            });
        }

        var typeDistribution = {};
        faults.forEach(function(f) {
            typeDistribution[f.typeText] = (typeDistribution[f.typeText] || 0) + 1;
        });
        var typeData = Object.keys(typeDistribution).map(function(k) {
            return { name: k, value: typeDistribution[k] };
        });

        var crewRanking = crews.map(function(c) {
            var crewFaults = faults.filter(function(f) { return f.crewId === c.id && f.status === 'resolved'; });
            var crewAvg = 0;
            if (crewFaults.length > 0) {
                var t = crewFaults.reduce(function(s, f) {
                    return s + (moment(f.recoveryTime) - moment(f.reportTime));
                }, 0);
                crewAvg = Math.round(t / crewFaults.length / 60000);
            }
            var score = crewFaults.length * 10 + (crewAvg > 0 ? Math.max(0, 200 - crewAvg) : 0);
            return {
                id: c.id,
                name: c.name,
                tasks: crewFaults.length,
                avgTime: crewAvg,
                score: score
            };
        }).sort(function(a, b) { return b.score - a.score; }).slice(0, 5);

        return {
            todayFaults: todayFaults.length,
            avgRecoveryTime: avgRecoveryTime,
            crewUtilization: crewUtilization,
            satisfaction: Math.min(99.9, 92 + Math.random() * 6),
            recoveryTrend: recoveryTrend,
            typeDistribution: typeData,
            crewRanking: crewRanking
        };
    }

    return {
        init: init,
        startSimulation: startSimulation,
        stopSimulation: stopSimulation,
        acceptIncomingCall: acceptIncomingCall,
        dispatchCrew: dispatchCrew,
        findNearestAvailableCrew: findNearestAvailableCrew,
        estimateTravelTime: estimateTravelTime,
        showFaultDetail: showFaultDetail,
        addTimelineEvent: addTimelineEvent,
        getStats: getStats,
        substations: substations,
        lines: lines,
        defaultCrews: defaultCrews
    };
})();
