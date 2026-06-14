var FaultPanel = (function() {
    var unsubscribeFns = [];

    function render(container) {
        cleanup();

        var html = `
            <div class="row">
                <div class="col-lg-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-pencil-square me-2"></i>手动录入故障</h5>
                            <button class="btn btn-outline-primary btn-sm" onclick="FaultPanel.triggerMockCall()">
                                <i class="bi bi-telephone-inbound"></i> 模拟来电
                            </button>
                        </div>
                        <div class="card-body">
                            <form id="fault-form" onsubmit="return FaultPanel.submitForm(event)">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">故障类型 <span class="text-danger">*</span></label>
                                        <select id="f-type" class="form-select" required>
                                            <option value="">请选择故障类型</option>
                                            <option value="overload">过载</option>
                                            <option value="short_circuit">短路故障</option>
                                            <option value="ground_fault">接地故障</option>
                                            <option value="equipment_failure">设备故障</option>
                                            <option value="weather">天气原因</option>
                                            <option value="external">外力破坏</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">所属线路 <span class="text-danger">*</span></label>
                                        <select id="f-line" class="form-select" required>
                                            <option value="">请选择线路</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">电压等级</label>
                                        <select id="f-voltage" class="form-select">
                                            <option value="10kV">10kV</option>
                                            <option value="35kV">35kV</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">天气条件</label>
                                        <select id="f-weather" class="form-select">
                                            <option value="晴">晴</option>
                                            <option value="多云">多云</option>
                                            <option value="阴">阴</option>
                                            <option value="小雨">小雨</option>
                                            <option value="中雨">中雨</option>
                                            <option value="大雨">大雨</option>
                                            <option value="雷暴">雷暴</option>
                                            <option value="大风">大风</option>
                                        </select>
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label">故障位置 <span class="text-danger">*</span></label>
                                        <input type="text" id="f-location" class="form-control" placeholder="如：城北街道光明社区" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">影响用户数</label>
                                        <input type="number" id="f-users" class="form-control" placeholder="预估影响用户数" min="0">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">信息来源</label>
                                        <select id="f-reporter" class="form-select">
                                            <option value="客户报修">客户报修</option>
                                            <option value="线路巡检">线路巡检</option>
                                            <option value="监控系统">监控系统</option>
                                            <option value="95598工单">95598工单</option>
                                        </select>
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label">故障描述 <span class="text-danger">*</span></label>
                                        <textarea id="f-desc" class="form-control" rows="3" placeholder="请详细描述故障情况" required></textarea>
                                    </div>
                                    <div class="col-md-12" id="level-preview">
                                        <div class="alert alert-info mb-0">
                                            <i class="bi bi-info-circle me-2"></i>
                                            <span>请填写信息后自动计算故障等级</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-4 d-flex gap-2">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="bi bi-check-circle me-1"></i>提交接报
                                    </button>
                                    <button type="reset" class="btn btn-outline-secondary" onclick="FaultPanel.resetForm()">
                                        <i class="bi bi-arrow-counterclockwise me-1"></i>重置
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="col-lg-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-list-nested me-2"></i>待处理故障</h5>
                            <span class="badge bg-secondary" id="pending-count">0</span>
                        </div>
                        <div class="card-body p-0" style="max-height: 600px; overflow-y: auto;">
                            <div id="pending-faults-list" class="list-group list-group-flush">
                                <div class="text-center py-5 text-muted">
                                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                                    <p>暂无待处理故障</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.html(html);
        initForm();
        renderPendingFaults();

        var unsub1 = Store.subscribe('faults', renderPendingFaults);
        unsubscribeFns.push(unsub1);
    }

    function initForm() {
        var lineSelect = $('#f-line');
        DataService.lines.forEach(function(line) {
            lineSelect.append('<option value="' + line.id + '">' + line.name + '</option>');
        });

        $('#f-type, #f-voltage, #f-weather, #f-users').on('change input', updateLevelPreview);
    }

    function calculateLevelFromForm() {
        var type = $('#f-type').val();
        var voltage = $('#f-voltage').val() || '10kV';
        var weather = $('#f-weather').val() || '晴';
        var users = parseInt($('#f-users').val()) || 0;

        if (users === 0) {
            var base = voltage === '35kV' ? 500 : 100;
            var multiplier = { overload: 1.5, short_circuit: 2.5, ground_fault: 1.8, equipment_failure: 1.2, weather: 2.0, external: 1.6 }[type] || 1;
            users = Math.floor(base * multiplier * 0.7);
        }

        var score = 0;
        if (users >= 500) score += 3;
        else if (users >= 200) score += 2;
        else if (users >= 50) score += 1;

        if (voltage === '35kV') score += 2;
        else score += 1;

        if (['雷暴', '大雨', '大风'].indexOf(weather) !== -1) score += 2;
        else if (['中雨', '小雨'].indexOf(weather) !== -1) score += 1;

        if (score >= 6) return { level: 'urgent', users: users };
        if (score >= 4) return { level: 'major', users: users };
        return { level: 'normal', users: users };
    }

    function updateLevelPreview() {
        if (!$('#f-type').val()) {
            $('#level-preview').html(`
                <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    <span>请选择故障类型后自动计算故障等级</span>
                </div>
            `);
            return;
        }

        var result = calculateLevelFromForm();
        var levelConfig = {
            urgent: { text: '紧急', cls: 'danger', icon: 'exclamation-octagon-fill' },
            major: { text: '重大', cls: 'warning', icon: 'exclamation-triangle-fill' },
            normal: { text: '一般', cls: 'primary', icon: 'info-circle-fill' }
        };
        var cfg = levelConfig[result.level];

        $('#level-preview').html(`
            <div class="alert alert-${cfg.cls} mb-0 d-flex align-items-center">
                <i class="bi bi-${cfg.icon} fs-4 me-2"></i>
                <div>
                    <strong>故障等级：${cfg.text}</strong>
                    <span class="ms-3">预估影响用户：${result.users} 户</span>
                </div>
            </div>
        `);
    }

    function submitForm(e) {
        e.preventDefault();

        var typeVal = $('#f-type').val();
        if (!typeVal) {
            alert('请选择故障类型');
            return false;
        }

        var typeMap = { overload: '过载', short_circuit: '短路故障', ground_fault: '接地故障', equipment_failure: '设备故障', weather: '天气原因', external: '外力破坏' };
        var lineId = $('#f-line').val();
        var line = DataService.lines.find(function(l) { return l.id === lineId; });
        var result = calculateLevelFromForm();

        var faultIdCounter = parseInt((Store.get('faults')[0] || { id: 'F1000' }).id.replace('F', '')) + 1;

        var fault = {
            id: 'F' + faultIdCounter,
            type: typeVal,
            typeText: typeMap[typeVal],
            level: result.level,
            lineId: lineId,
            lineName: line ? line.name : '',
            location: $('#f-location').val(),
            voltage: $('#f-voltage').val(),
            weather: $('#f-weather').val(),
            affectedUsers: result.users,
            reporter: $('#f-reporter').val(),
            reporterPhone: '138****' + Math.floor(1000 + Math.random() * 9000),
            description: $('#f-desc').val(),
            status: 'reported',
            reportTime: new Date().toISOString(),
            dispatchTime: null,
            arriveTime: null,
            recoveryTime: null,
            crewId: null,
            crewName: null,
            estimatedArrival: null,
            x: 100 + Math.random() * 800,
            y: 80 + Math.random() * 450,
            timeline: [
                {
                    node: 'report',
                    title: '故障接报',
                    operator: '调度员',
                    time: moment().format('YYYY-MM-DD HH:mm:ss'),
                    remark: $('#f-desc').val()
                }
            ]
        };

        Store.addFault(fault);
        resetForm();

        var toastHtml = `
            <div class="toast align-items-center text-bg-success border-0 position-fixed top-5 end-0 m-3" role="alert" style="z-index:9999">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi bi-check-circle me-2"></i>故障接报成功，编号 ${fault.id}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        $('body').append(toastHtml);
        var toast = new bootstrap.Toast($('.toast').last()[0], { delay: 3000 });
        toast.show();

        return false;
    }

    function resetForm() {
        $('#fault-form')[0].reset();
        $('#level-preview').html(`
            <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle me-2"></i>
                <span>请填写信息后自动计算故障等级</span>
            </div>
        `);
    }

    function triggerMockCall() {
        DataService.simulateNewFault_Forced = true;
        DataService.simulateNewFault && DataService.simulateNewFault();
    }

    function acceptCall() {
        DataService.acceptIncomingCall();
    }

    function renderPendingFaults() {
        var faults = Store.get('faults') || [];
        var pending = faults.filter(function(f) { return f.status === 'reported'; });

        $('#pending-count').text(pending.length);

        if (pending.length === 0) {
            $('#pending-faults-list').html(`
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    <p>暂无待处理故障</p>
                </div>
            `);
            return;
        }

        var levelConfig = {
            urgent: { text: '紧急', cls: 'danger', border: 'border-start-danger' },
            major: { text: '重大', cls: 'warning', border: 'border-start-warning' },
            normal: { text: '一般', cls: 'primary', border: 'border-start-primary' }
        };

        var html = '';
        pending.slice(0, 20).forEach(function(fault) {
            var cfg = levelConfig[fault.level];
            var elapsed = Math.round((Date.now() - moment(fault.reportTime)) / 60000);

            html += `
                <div class="list-group-item list-group-item-action border-0 border-start border-4 ${cfg.border} py-3 px-4" onclick="DataService.showFaultDetail(Store.getFault('${fault.id}'))">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge bg-${cfg.cls} me-2">${cfg.text}</span>
                            <strong>${fault.id}</strong>
                            <small class="text-muted ms-2">${fault.typeText}</small>
                        </div>
                        <small class="text-danger fw-bold">
                            <i class="bi bi-stopwatch"></i> ${elapsed}分钟
                        </small>
                    </div>
                    <p class="mb-1 small">
                        <i class="bi bi-geo-alt text-muted me-1"></i>${fault.location}
                        <span class="mx-2 text-muted">|</span>
                        <i class="bi bi-diagram-3 text-muted me-1"></i>${fault.lineName}
                    </p>
                    <p class="mb-0 small text-muted text-truncate">${fault.description}</p>
                    <div class="mt-2 d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); FaultPanel.quickDispatch('${fault.id}')">
                            <i class="bi bi-send me-1"></i>快速派工
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); DataService.showFaultDetail(Store.getFault('${fault.id}'))">
                            <i class="bi bi-eye me-1"></i>详情
                        </button>
                    </div>
                </div>
            `;
        });

        $('#pending-faults-list').html(html);
    }

    function quickDispatch(faultId) {
        var fault = Store.getFault(faultId);
        if (!fault) return;

        var nearest = DataService.findNearestAvailableCrew(fault);
        if (!nearest) {
            alert('暂无空闲班组，请稍后再试');
            return;
        }

        var est = DataService.estimateTravelTime(nearest, fault);
        if (confirm('已匹配最近班组：' + nearest.name + '（' + nearest.leader + '），预计' + est + '分钟到达，是否派工？')) {
            DataService.dispatchCrew(faultId, nearest.id);
        }
    }

    function cleanup() {
        unsubscribeFns.forEach(function(fn) { fn && fn(); });
        unsubscribeFns = [];
    }

    return {
        render: render,
        submitForm: submitForm,
        resetForm: resetForm,
        triggerMockCall: triggerMockCall,
        acceptCall: acceptCall,
        quickDispatch: quickDispatch
    };
})();

window.FaultPanel = FaultPanel;
