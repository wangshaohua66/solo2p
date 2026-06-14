var DispatchBoard = (function() {
    var unsubscribeFns = [];
    var draggedFaultId = null;

    function render(container) {
        cleanup();

        var html = `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body d-flex flex-wrap align-items-center gap-3">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-people-fill fs-4 text-success me-2"></i>
                                <div>
                                    <div class="small text-muted">在线班组</div>
                                    <strong id="board-crew-count">0 / 6</strong>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <i class="bi bi-hourglass-split fs-4 text-warning me-2"></i>
                                <div>
                                    <div class="small text-muted">待派工</div>
                                    <strong id="board-pending-count" class="text-warning">0</strong>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <i class="bi bi-tools fs-4 text-primary me-2"></i>
                                <div>
                                    <div class="small text-muted">进行中</div>
                                    <strong id="board-progress-count" class="text-primary">0</strong>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <i class="bi bi-check-circle-fill fs-4 text-info me-2"></i>
                                <div>
                                    <div class="small text-muted">待验收</div>
                                    <strong id="board-checking-count" class="text-info">0</strong>
                                </div>
                            </div>
                            <div class="ms-auto d-flex gap-2">
                                <button class="btn btn-outline-primary btn-sm" onclick="DispatchBoard.autoDispatchAll()">
                                    <i class="bi bi-magic me-1"></i>一键自动派工
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card kanban-column h-100" data-status="reported">
                        <div class="card-header bg-warning bg-opacity-10 border-warning border-bottom border-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-0 text-warning"><i class="bi bi-hourglass-split me-1"></i>待派工</h6>
                                <span class="badge bg-warning" id="col-pending">0</span>
                            </div>
                        </div>
                        <div class="card-body kanban-body p-2" id="col-reported"
                             ondragover="DispatchBoard.handleDragOver(event)"
                             ondrop="DispatchBoard.handleDrop(event, 'reported')">
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card kanban-column h-100" data-status="dispatched">
                        <div class="card-header bg-primary bg-opacity-10 border-primary border-bottom border-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-0 text-primary"><i class="bi bi-tools me-1"></i>进行中</h6>
                                <span class="badge bg-primary" id="col-progress">0</span>
                            </div>
                        </div>
                        <div class="card-body kanban-body p-2" id="col-dispatched"
                             ondragover="DispatchBoard.handleDragOver(event)"
                             ondrop="DispatchBoard.handleDrop(event, 'dispatched')">
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card kanban-column h-100" data-status="checking">
                        <div class="card-header bg-info bg-opacity-10 border-info border-bottom border-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-0 text-info"><i class="bi bi-check-circle me-1"></i>待验收</h6>
                                <span class="badge bg-info" id="col-checking">0</span>
                            </div>
                        </div>
                        <div class="card-body kanban-body p-2" id="col-checking"
                             ondragover="DispatchBoard.handleDragOver(event)"
                             ondrop="DispatchBoard.handleDrop(event, 'checking')">
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card kanban-column h-100" data-status="resolved">
                        <div class="card-header bg-success bg-opacity-10 border-success border-bottom border-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-0 text-success"><i class="bi bi-lightning-charge me-1"></i>已复电</h6>
                                <span class="badge bg-success" id="col-resolved">0</span>
                            </div>
                        </div>
                        <div class="card-body kanban-body p-2" id="col-resolved" style="max-height: 600px; overflow-y: auto;">
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.html(html);
        renderColumns();
        updateStats();

        var unsub1 = Store.subscribe('faults', function() {
            renderColumns();
            updateStats();
        });
        var unsub2 = Store.subscribe('crews', updateStats);
        unsubscribeFns.push(unsub1, unsub2);
    }

    function renderColumns() {
        var faults = Store.get('faults') || [];
        var todayStart = moment().startOf('day');

        var groups = { reported: [], dispatched: [], checking: [], resolved: [] };
        faults.forEach(function(f) {
            if (groups[f.status]) {
                if (f.status === 'resolved') {
                    if (moment(f.reportTime).isAfter(todayStart)) {
                        groups[f.status].push(f);
                    }
                } else {
                    groups[f.status].push(f);
                }
            }
        });

        Object.keys(groups).forEach(function(status) {
            renderColumn(status, groups[status]);
        });
    }

    function renderColumn(status, faults) {
        var $col = $('#col-' + status);
        if (!$col.length) return;

        var countId = status === 'reported' ? 'col-pending' :
                      status === 'dispatched' ? 'col-progress' :
                      'col-' + status;
        $('#' + countId).text(faults.length);

        if (faults.length === 0) {
            $col.html(`
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>
                    <p class="small mb-0">暂无任务</p>
                </div>
            `);
            return;
        }

        var levelConfig = {
            urgent: { text: '紧急', cls: 'danger', border: 'border-danger' },
            major: { text: '重大', cls: 'warning', border: 'border-warning' },
            normal: { text: '一般', cls: 'primary', border: 'border-primary' }
        };

        var html = faults.map(function(fault) {
            var cfg = levelConfig[fault.level];
            var elapsed = Math.round((Date.now() - moment(fault.reportTime)) / 60000);
            var isOverdue = (fault.level === 'urgent' && elapsed > 30) ||
                           (fault.level === 'major' && elapsed > 60) ||
                           (fault.level === 'normal' && elapsed > 120);

            var crewInfo = '';
            if (fault.crewName) {
                crewInfo = `<div class="mt-2 small"><i class="bi bi-people me-1"></i>${fault.crewName}</div>`;
            }

            var etaInfo = '';
            if (fault.estimatedArrival && status === 'dispatched') {
                var minsLeft = Math.max(0, moment(fault.estimatedArrival).diff(moment(), 'minutes'));
                etaInfo = `<span class="badge bg-light text-dark ms-1"><i class="bi bi-clock"></i> 预计${minsLeft}分钟</span>`;
            }

            var draggable = (status !== 'resolved') ? 'draggable="true"' : '';

            return `
                <div class="fault-card card mb-2 border-start border-3 ${cfg.border} shadow-sm cursor-move"
                     ${draggable}
                     ondragstart="DispatchBoard.handleDragStart(event, '${fault.id}')"
                     ondragend="DispatchBoard.handleDragEnd(event)"
                     onclick="DataService.showFaultDetail(Store.getFault('${fault.id}'))">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge bg-${cfg.cls} me-1">${cfg.text}</span>
                                <small class="fw-bold">${fault.id}</small>
                            </div>
                            <small class="${isOverdue ? 'text-danger fw-bold' : 'text-muted'}">
                                <i class="bi bi-stopwatch"></i> ${elapsed}分
                            </small>
                        </div>
                        <div class="small fw-medium mb-1 text-truncate" title="${fault.typeText}">${fault.typeText}</div>
                        <div class="small text-muted mb-1 text-truncate" title="${fault.location}">
                            <i class="bi bi-geo-alt me-1"></i>${fault.location}
                        </div>
                        <div class="small text-muted">
                            <i class="bi bi-diagram-3 me-1"></i>${fault.lineName}
                            <span class="ms-2"><i class="bi bi-people me-1"></i>${fault.affectedUsers}户</span>
                        </div>
                        ${crewInfo}
                        ${etaInfo}
                        ${status === 'reported' ? `
                            <div class="mt-2">
                                <select class="form-select form-select-sm" onclick="event.stopPropagation()" onchange="DispatchBoard.dispatchToCrew('${fault.id}', this.value)">
                                    <option value="">指派班组...</option>
                                </select>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        $col.html(html);

        if (status === 'reported') {
            var crews = Store.get('crews') || [];
            var availableCrews = crews.filter(function(c) { return c.status === 'idle'; });
            $col.find('select').each(function() {
                var $sel = $(this);
                availableCrews.forEach(function(c) {
                    $sel.append('<option value="' + c.id + '">' + c.name + ' (' + c.leader + ')</option>');
                });
            });
        }
    }

    function updateStats() {
        var crews = Store.get('crews') || [];
        var online = crews.filter(function(c) { return c.status !== 'offline'; }).length;
        $('#board-crew-count').text(online + ' / ' + crews.length);

        var faults = Store.get('faults') || [];
        $('#board-pending-count').text(faults.filter(function(f) { return f.status === 'reported'; }).length);
        $('#board-progress-count').text(faults.filter(function(f) { return f.status === 'dispatched'; }).length);
        $('#board-checking-count').text(faults.filter(function(f) { return f.status === 'checking'; }).length);
    }

    function handleDragStart(e, faultId) {
        draggedFaultId = faultId;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        draggedFaultId = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(e, targetStatus) {
        e.preventDefault();
        if (!draggedFaultId) return;

        var fault = Store.getFault(draggedFaultId);
        if (!fault) return;

        if (targetStatus === 'dispatched' && fault.status === 'reported') {
            var nearest = DataService.findNearestAvailableCrew(fault);
            if (nearest) {
                DataService.dispatchCrew(draggedFaultId, nearest.id);
            } else {
                alert('暂无空闲班组可派工');
            }
        } else if (targetStatus === 'checking' && fault.status === 'dispatched') {
            Store.updateFault(draggedFaultId, { status: 'checking' });
            DataService.addTimelineEvent(draggedFaultId, 'check', '调度员', '到达现场，待验收');
        } else if (targetStatus === 'resolved' && (fault.status === 'checking' || fault.status === 'dispatched')) {
            Store.updateFault(draggedFaultId, {
                status: 'resolved',
                recoveryTime: new Date().toISOString()
            });
            DataService.addTimelineEvent(draggedFaultId, 'resolve', '调度员', '验收通过，恢复供电');
            if (fault.crewId) {
                var crew = Store.getCrew(fault.crewId);
                if (crew) {
                    crew.status = 'returning';
                    crew.todayTasks = (crew.todayTasks || 0) + 1;
                    Store.updateCrew(crew.id, crew);
                }
            }
        } else if (targetStatus === 'reported' && fault.status !== 'reported') {
            if (fault.crewId) {
                var crew = Store.getCrew(fault.crewId);
                if (crew) {
                    crew.status = 'idle';
                    crew.currentFaultId = null;
                    Store.updateCrew(crew.id, crew);
                }
            }
            Store.updateFault(draggedFaultId, {
                status: 'reported',
                crewId: null,
                crewName: null,
                dispatchTime: null
            });
        }
    }

    function dispatchToCrew(faultId, crewId) {
        if (!crewId) return;
        DataService.dispatchCrew(faultId, crewId);
    }

    function autoDispatchAll() {
        var faults = Store.get('faults') || [];
        var pending = faults.filter(function(f) { return f.status === 'reported'; });
        var count = 0;

        pending.forEach(function(fault) {
            var nearest = DataService.findNearestAvailableCrew(fault);
            if (nearest) {
                DataService.dispatchCrew(fault.id, nearest.id);
                count++;
            }
        });

        if (count > 0) {
            alert('已成功自动派工 ' + count + ' 个故障');
        } else {
            alert('暂无待派工故障或无空闲班组');
        }
    }

    function cleanup() {
        unsubscribeFns.forEach(function(fn) { fn && fn(); });
        unsubscribeFns = [];
        draggedFaultId = null;
    }

    return {
        render: render,
        handleDragStart: handleDragStart,
        handleDragEnd: handleDragEnd,
        handleDragOver: handleDragOver,
        handleDrop: handleDrop,
        dispatchToCrew: dispatchToCrew,
        autoDispatchAll: autoDispatchAll
    };
})();

window.DispatchBoard = DispatchBoard;
