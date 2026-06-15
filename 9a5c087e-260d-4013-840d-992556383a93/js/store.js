var Store = (function () {
    var STORAGE_KEY = 'flood_store_v1';
    var STORAGE_LIMIT = 5 * 1024 * 1024;
    var EVICT_THRESHOLD = 4.5 * 1024 * 1024;

    var _state = {};
    var _listeners = {};
    var _lruOrder = [];
    var _cacheStats = { hits: 0, misses: 0, evictions: 0 };

    function _deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(_deepClone);
        var copy = {};
        for (var k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                copy[k] = _deepClone(obj[k]);
            }
        }
        return copy;
    }

    function _emit(event, payload) {
        if (!_listeners[event]) return;
        var start = performance.now();
        _listeners[event].forEach(function (fn) {
            try {
                fn(_deepClone(payload));
            } catch (e) {
                console.error('[Store] listener error for', event, e);
            }
        });
        var elapsed = performance.now() - start;
        if (elapsed > 100) console.warn('[Store] broadcast for', event, 'took', elapsed.toFixed(1) + 'ms');
    }

    function _estimateSize(str) {
        return new Blob([str]).size;
    }

    function _lruTouch(key) {
        var idx = _lruOrder.indexOf(key);
        if (idx >= 0) _lruOrder.splice(idx, 1);
        _lruOrder.unshift(key);
    }

    function _lruEvict() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            if (!data) return;
            var size = _estimateSize(data);
            if (size < EVICT_THRESHOLD) return;
            var parsed = JSON.parse(data);
            while (_lruOrder.length && size > EVICT_THRESHOLD * 0.8) {
                var victim = _lruOrder.pop();
                if (parsed[victim]) {
                    delete parsed[victim];
                    _cacheStats.evictions++;
                }
                size = _estimateSize(JSON.stringify(parsed));
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch (e) {
            console.warn('[Store] LRU eviction failed:', e);
        }
    }

    function _persist() {
        try {
            var persisted = {
                responseLevel: _state.responseLevel,
                responseChecklist: _state.response.responseChecklist,
                alerts: _state.alerts,
                inspections: _state.inspections,
                materialFlows: _state.materialFlows,
                dispatchLogs: _state.dispatchLogs,
                timeline: _state.timeline
            };
            var str = JSON.stringify(persisted);
            if (_estimateSize(str) > EVICT_THRESHOLD) _lruEvict();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: persisted, lru: _lruOrder }));
        } catch (e) {
            console.warn('[Store] persist failed (likely quota):', e);
            _lruEvict();
        }
    }

    function _restore() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (parsed.lru) _lruOrder = parsed.lru;
            return parsed.data || null;
        } catch (e) {
            console.warn('[Store] restore failed:', e);
            return null;
        }
    }

    function on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
        return function () {
            _listeners[event] = _listeners[event].filter(function (f) { return f !== fn; });
        };
    }

    function getState() {
        return _deepClone(_state);
    }

    function get(path) {
        var parts = path.split('.');
        var cur = _state;
        for (var i = 0; i < parts.length; i++) {
            if (cur == null) return undefined;
            cur = cur[parts[i]];
        }
        return _deepClone(cur);
    }

    function set(key, value) {
        _state[key] = value;
        _emit(key, value);
        if (['inspections', 'alerts', 'materials', 'materialFlows', 'dispatchLogs', 'teams', 'timeline', 'floodPoints', 'response'].indexOf(key) >= 0) {
            _persist();
        }
    }

    function init() {
        var restored = _restore();
        var mockRivers = MockData.generateRiverData();
        var mockRainfall = MockData.generateRainfallData();
        var mockFloodPoints = MockData.generateFloodPoints();
        var mockReservoirs = MockData.generateReservoirData();
        var mockTeams = MockData.generateTeams();
        var mockMaterials = MockData.generateMaterials();
        var mockFlows = restored && restored.materialFlows ? restored.materialFlows : MockData.generateMaterialFlows(30);
        var mockAlerts = restored && restored.alerts ? restored.alerts : MockData.generateAlerts();
        var mockInspections = restored && restored.inspections ? restored.inspections : MockData.generateInspections();
        var mockTimeline = restored && restored.timeline ? restored.timeline : MockData.generateTimelineEvents();
        var mockDispatch = restored && restored.dispatchLogs ? restored.dispatchLogs : MockData.generateDispatchLogs();
        var responseVal = restored && restored.response ? restored.response : 'IV';

        _state.response = {
            response: responseVal,
            thresholds: MockData.getResponseThresholds(responseVal),
            checklist: MockData.getResponseChecklist(responseVal)
        };
        _state.rivers = mockRivers;
        _state.rainfall = mockRainfall;
        _state.floodPoints = mockFloodPoints;
        _state.reservoirs = mockReservoirs;
        _state.teams = mockTeams;
        _state.materials = mockMaterials;
        _state.materialFlows = mockFlows;
        _state.alerts = mockAlerts;
        _state.inspections = mockInspections;
        _state.timeline = mockTimeline;
        _state.dispatchLogs = mockDispatch;
        _state.pumpStations = MockData.PUMP_STATIONS;
        _state.warehouses = MockData.WAREHOUSES;
        _state.response = { response: responseVal };

        _emit('response', _state.response);
        _emit('rivers', _state.rivers);
        _emit('rainfall', _state.rainfall);
        _emit('floodPoints', _state.floodPoints);
        _emit('teams', _state.teams);
        _emit('materials', _state.materials);
        _emit('materialFlows', _state.materialFlows);
        _emit('alerts', _state.alerts);
        _emit('timeline', _state.timeline);
        _emit('dispatchLogs', _state.dispatchLogs);

        setInterval(_tickWaterData, 5000);
        setInterval(_tickFloodPoints, 15000);
    }

    function _tickWaterData() {
        var rivers = _state.rivers;
        if (!rivers) return;
        Object.keys(rivers).forEach(function (rid) {
            var river = rivers[rid];
            river.series.forEach(function (p) {
                p.value = +(p.value + (Math.random() - 0.5) * 0.1).toFixed(2);
            });
            Object.keys(river.stations).forEach(function (sid) {
                var station = river.stations[sid];
                var delta = (Math.random() - 0.48) * 0.15;
                station.current = +(station.current + delta).toFixed(2);
                if (station.series && station.series.length) {
                    station.series.shift();
                    var last = station.series[station.series.length - 1];
                    var now = new Date();
                    var pad = function (n) { return String(n).padStart(2, '0'); };
                    var timeStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
                        + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
                    station.series.push({
                        time: timeStr,
                        value: +(station.current).toFixed(2)
                    });
                }
            });
        });
        _emit('rivers', rivers);

        var rainfall = _state.rainfall;
        if (rainfall) {
            Object.keys(rainfall).forEach(function (sid) {
                var r = rainfall[sid];
                r.hourly.forEach(function (p) {
                    p.value = Math.max(0, +(p.value + (Math.random() - 0.4) * 2).toFixed(1));
                });
            });
            _emit('rainfall', rainfall);
        }
    }

    function _tickFloodPoints() {
        var fps = _state.floodPoints;
        if (!fps) return;
        fps.forEach(function (fp) {
            var delta = (Math.random() - 0.45) * 6;
            fp.depth = Math.max(0, +(fp.depth + delta).toFixed(1));
            var newLevel = fp.depth < 8 ? 0 : fp.depth < 25 ? 1 : fp.depth < 55 ? 2 : 3;
            if (newLevel !== fp.level && newLevel >= 2) {
                addAlert({
                    type: newLevel === 3 ? 'danger' : 'warning',
                    title: '易涝点积水告警',
                    content: fp.name + ' 积水加深至' + fp.depth + 'cm，等级' + ['绿', '黄', '橙', '红'][newLevel] + '色',
                    relatedId: fp.id
                });
                addTimelineEvent({
                    type: newLevel === 3 ? 'danger' : 'warning',
                    icon: 'bi-droplet-half',
                    title: '积水告警',
                    description: fp.name + ' 等级升至' + ['正常', '轻度', '中度', '重度'][newLevel]
                });
            }
            fp.level = newLevel;
            fp.traffic = ['畅通', '缓行', '拥堵', '封闭'][Math.min(newLevel, 3)];
            var now = new Date();
            var pad = function (n) { return String(n).padStart(2, '0'); };
            fp.lastUpdate = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
                + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
        });
        _emit('floodPoints', fps);
    }

    function addAlert(alert) {
        var alerts = _state.alerts || [];
        var now = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var newAlert = {
            id: 'AL' + Date.now(),
            type: alert.type || 'warning',
            icon: alert.icon || 'bi-exclamation-triangle',
            level: alert.level || alert.type || 'warning',
            title: alert.title || '告警',
            content: alert.content || '',
            time: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
                + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
            unread: true,
            relatedId: alert.relatedId || null
        };
        alerts.unshift(newAlert);
        _state.alerts = alerts;
        _emit('alerts', alerts);
        _emit('newAlert', newAlert);
        _persist();
    }

    function markAlertRead(id) {
        var alerts = _state.alerts || [];
        var found = alerts.find(function (a) { return a.id === id; });
        if (found) {
            found.unread = false;
            _emit('alerts', alerts);
            _persist();
        }
    }

    function markAllAlertsRead() {
        var alerts = _state.alerts || [];
        alerts.forEach(function (a) { a.unread = false; });
        _emit('alerts', alerts);
        _persist();
    }

    function addInspection(inspection) {
        var inspections = _state.inspections || [];
        var now = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var newInsp = {
            id: 'IN' + Date.now(),
            inspector: inspection.inspector || '匿名巡查员',
            floodPoint: inspection.floodPoint,
            floodPointName: inspection.floodPointName,
            dangerType: inspection.dangerType,
            depth: inspection.depth,
            affected: inspection.affected,
            description: inspection.description,
            images: inspection.images || [],
            time: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
                + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
            status: '待处理'
        };
        inspections.unshift(newInsp);
        _state.inspections = inspections;
        _emit('inspections', inspections);

        var fps = _state.floodPoints;
        if (fps) {
            var fp = fps.find(function (f) { return f.id === inspection.floodPoint; });
            if (fp) {
                var newLevel = inspection.depth < 8 ? 0 : inspection.depth < 25 ? 1 : inspection.depth < 55 ? 2 : 3;
                fp.depth = +inspection.depth;
                fp.level = newLevel;
                fp.reported = true;
                fp.lastUpdate = newInsp.time;
                _emit('floodPoints', fps);
            }
        }

        addAlert({
            type: inspection.depth > 50 ? 'danger' : inspection.depth > 20 ? 'warning' : 'info',
            title: '巡查险情上报',
            content: newInsp.inspector + ' 上报 ' + (inspection.floodPointName || inspection.floodPoint) + '：' + inspection.dangerType
                + '，积水深度 ' + inspection.depth + 'cm',
            relatedId: inspection.floodPoint
        });

        addTimelineEvent({
            type: inspection.depth > 50 ? 'danger' : 'warning',
            icon: 'bi-exclamation-triangle',
            title: '险情上报',
            description: newInsp.inspector + ' 在 ' + (inspection.floodPointName || inspection.floodPoint) + ' 上报 ' + inspection.dangerType
        });

        _persist();
        return newInsp;
    }

    function updateInspectionStatus(id, status) {
        var inspections = _state.inspections || [];
        var found = inspections.find(function (i) { return i.id === id; });
        if (found) {
            found.status = status;
            _emit('inspections', inspections);
            _persist();
        }
    }

    function dispatchTeam(teamId, targetFloodPoint) {
        var teams = _state.teams;
        if (!teams) return null;
        var team = teams.find(function (t) { return t.id === teamId; });
        var fps = _state.floodPoints || [];
        var target = fps.find(function (f) { return f.id === targetFloodPoint; });
        if (!team || !target) return null;

        var dx = (target.lng - team.lng) * 111;
        var dy = (target.lat - team.lat) * 111;
        var distance = +Math.sqrt(dx * dx + dy * dy).toFixed(1);
        var eta = Math.max(5, Math.round(distance / 0.6));

        team.status = 'working';
        team.targetFloodPoint = targetFloodPoint;
        team.currentTask = target.name + ' 处置';
        team.progress = 0;
        team.eta = eta;
        _emit('teams', teams);

        var logs = _state.dispatchLogs || [];
        var now = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var newLog = {
            id: 'DL' + Date.now(),
            teamId: teamId,
            teamName: team.name,
            from: { lng: team.lng, lat: team.lat },
            to: { lng: target.lng, lat: target.lat },
            toFloodPoint: targetFloodPoint,
            distance: distance,
            eta: eta,
            dispatcher: '调度主任',
            time: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
                + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
            reason: (target.level >= 3 ? '重度' : target.level >= 2 ? '中度' : '轻度') + '积水处置'
        };
        logs.unshift(newLog);
        _state.dispatchLogs = logs;
        _emit('dispatchLogs', logs);

        addTimelineEvent({
            type: 'success',
            icon: 'bi-truck',
            title: '队伍调度',
            description: team.name + ' 前往 ' + target.name + '，预计 ' + eta + ' 分钟到达'
        });

        addAlert({
            type: 'info',
            title: '队伍调度指令',
            content: team.name + ' 已调派至 ' + target.name + '，预计' + eta + '分钟到达',
            relatedId: targetFloodPoint
        });

        _persist();
        return newLog;
    }

    function updateTeamProgress(teamId, progress) {
        var teams = _state.teams;
        if (!teams) return;
        var team = teams.find(function (t) { return t.id === teamId; });
        if (team) {
            team.progress = progress;
            if (progress >= 100) {
                team.status = 'ready';
                team.targetFloodPoint = null;
                team.currentTask = null;
                team.progress = 0;
                team.eta = 0;
            } else if (progress >= 80) {
                team.status = 'busy';
            }
            _emit('teams', teams);
        }
    }

    function allocateMaterial(materialId, quantity, target) {
        var materials = _state.materials;
        if (!materials) return null;
        var mat = materials.find(function (m) { return m.id === materialId; });
        if (!mat || mat.stock < quantity) return null;

        mat.stock -= quantity;
        mat.lowStock = mat.stock < mat.minStock * 1.3;
        var now = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };

        var flows = _state.materialFlows || [];
        var newFlow = {
            id: 'FL' + Date.now(),
            type: '应急出库',
            materialName: mat.name,
            quantity: quantity,
            from: mat.warehouseName,
            to: target || '抢险现场',
            operator: '调度主任',
            time: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
                + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
            reason: '应急调拨'
        };
        flows.unshift(newFlow);
        _state.materialFlows = flows;
        _emit('materials', materials);
        _emit('materialFlows', flows);
        _emit('newFlow', newFlow);

        if (mat.lowStock) {
            addAlert({
                type: 'warning',
                title: '物资库存预警',
                content: mat.warehouseName + ' ' + mat.name + ' 库存偏低，剩余 ' + mat.stock + mat.unit,
                relatedId: mat.id
            });
        }

        addTimelineEvent({
            type: 'success',
            icon: 'bi-box-arrow-right',
            title: '物资调拨',
            description: '从' + mat.warehouseName + '调出' + quantity + mat.unit + ' ' + mat.name + ' 至 ' + (target || '抢险现场')
        });

        _persist();
        return newFlow;
    }

    function addTimelineEvent(evt) {
        var timeline = _state.timeline || [];
        var now = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var newEvt = {
            id: 'EV' + Date.now(),
            type: evt.type || 'info',
            icon: evt.icon || 'bi-info-circle',
            title: evt.title || '事件',
            description: evt.description || '',
            time: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
                + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
            causeOf: evt.causeOf || null
        };
        timeline.unshift(newEvt);
        _state.timeline = timeline;
        _emit('timeline', timeline);
    }

    function setResponseLevel(level) {
        _state.response = {
            response: level,
            thresholds: MockData.getResponseThresholds(level),
            checklist: MockData.getResponseChecklist(level)
        };
        _emit('response', _state.response);
        addTimelineEvent({
            type: level === 'I' ? 'danger' : level === 'II' ? 'warning' : level === 'III' ? 'warning' : 'info',
            icon: 'bi-flag',
            title: '响应等级调整',
            description: '防汛应急响应等级调整为 ' + level + ' 级'
        });
        _persist();
    }

    function updateChecklist(index, checked) {
        if (!_state.response || !_state.response.checklist) return;
        if (_state.response.checklist[index]) {
            _state.response.checklist[index].checked = checked;
            _emit('response', _state.response);
            _persist();
        }
    }

    return {
        init: init,
        on: on,
        get: get,
        getState: getState,
        set: set,
        addAlert: addAlert,
        markAlertRead: markAlertRead,
        markAllAlertsRead: markAllAlertsRead,
        addInspection: addInspection,
        updateInspectionStatus: updateInspectionStatus,
        dispatchTeam: dispatchTeam,
        updateTeamProgress: updateTeamProgress,
        allocateMaterial: allocateMaterial,
        addTimelineEvent: addTimelineEvent,
        setResponseLevel: setResponseLevel,
        updateChecklist: updateChecklist,
        getCacheStats: function () { return _cacheStats; }
    };
})();
