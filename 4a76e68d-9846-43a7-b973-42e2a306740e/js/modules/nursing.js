var Nursing = window.Nursing = (function () {
    var weekOffset = 0;
    var qualificationFilter = 'all';
    var currentTab = 'schedule';
    var shifts = [];
    var nurses = [];
    var mothers = [];
    var shiftSwaps = [];

    var WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    function getWeekDates() {
        var now = new Date();
        var day = now.getDay();
        var diffToMonday = day === 0 ? -6 : 1 - day;
        var monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);
        var dates = [];
        for (var i = 0; i < 7; i++) {
            dates.push(Store.formatDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
        }
        return dates;
    }

    function render() {
        var storeId = App.state.storeId;
        if (!storeId) return;

        Promise.all([
            Store.getShiftsByStore(storeId),
            Store.getStaffByStoreAndRole(storeId, 'nurse'),
            Store.getMothersByStore(storeId),
            Store.getShiftSwapsByStore(storeId)
        ]).then(function (results) {
            shifts = results[0] || [];
            nurses = results[1] || [];
            mothers = results[2] || [];
            shiftSwaps = results[3] || [];
            renderPage();
        }).catch(function (err) {
            console.error('加载护理排班数据失败:', err);
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>数据加载失败，请刷新重试</p></div>');
        });
    }

    function renderPage() {
        var weekDates = getWeekDates();
        var today = Store.formatDate(new Date());
        var html = '';

        html += renderNightShiftWarning();
        html += renderPageHeader();
        html += renderStatCards(today);
        html += renderTabs();
        if (currentTab === 'schedule') {
            html += renderFilterBar(weekDates);
            html += renderScheduleTable(weekDates, today);
        } else {
            html += renderSwapApprovalPanel();
        }

        $('#app-content').html(html);
        bindEvents();
    }

    function renderNightShiftWarning() {
        var missingNightShifts = shifts.filter(function (s) {
            return s.shiftType === 'night' && s.nightRecordMissing === true;
        });
        if (missingNightShifts.length === 0) return '';

        return '<div class="alert alert-warning d-flex align-items-center fade-in mb-3" style="border-radius:var(--radius-md);border-color:var(--color-warning);background:rgba(240,173,78,0.1);">' +
            '<i class="bi bi-exclamation-triangle-fill me-2" style="color:var(--color-warning);font-size:20px;"></i>' +
            '<div><strong>夜班护理记录未补录</strong>：当前有 <span class="badge bg-warning text-dark">' + missingNightShifts.length + '</span> 条夜班记录缺失，请尽快补录。</div>' +
            '</div>';
    }

    function renderPageHeader() {
        var actionsHtml = '';
        if (currentTab === 'schedule') {
            actionsHtml = '<button class="btn btn-soft-pink" id="btn-request-swap"><i class="bi bi-arrow-left-right me-1"></i>申请换班</button>' +
                '<button class="btn btn-pink ms-2" id="btn-batch-schedule"><i class="bi bi-calendar-plus me-1"></i>批量排班</button>';
        }
        return App.renderPageHeader('bi-clipboard2-pulse', '护理排班', App.state.storeName, actionsHtml);
    }

    function renderStatCards(today) {
        var totalNurses = nurses.length;
        var dayShiftsToday = shifts.filter(function (s) { return s.shiftDate === today && s.shiftType === 'day'; });
        var nightShiftsToday = shifts.filter(function (s) { return s.shiftDate === today && s.shiftType === 'night'; });
        var unsignedHandovers = shifts.filter(function (s) { return s.status !== 'signed' && s.shiftDate <= today; });
        var pendingSwaps = shiftSwaps.filter(function (s) { return s.status === 'pending'; });

        return '<div class="row g-3 mb-4 fade-in">' +
            '<div class="col-6 col-md-3">' +
            '<div class="stat-card"><div class="stat-icon pink"><i class="bi bi-nurse"></i></div>' +
            '<div class="stat-value">' + totalNurses + '</div><div class="stat-label">在岗护士</div></div></div>' +

            '<div class="col-6 col-md-3">' +
            '<div class="stat-card"><div class="stat-icon blue"><i class="bi bi-sun"></i></div>' +
            '<div class="stat-value">' + dayShiftsToday.length + '</div><div class="stat-label">今日白班</div></div></div>' +

            '<div class="col-6 col-md-3">' +
            '<div class="stat-card"><div class="stat-icon pink"><i class="bi bi-moon"></i></div>' +
            '<div class="stat-value">' + nightShiftsToday.length + '</div><div class="stat-label">今日夜班</div></div></div>' +

            '<div class="col-6 col-md-3">' +
            '<div class="stat-card"><div class="stat-icon yellow"><i class="bi bi-arrow-left-right"></i></div>' +
            '<div class="stat-value">' + pendingSwaps.length + '</div><div class="stat-label">待审批换班</div></div></div>' +
            '</div>';
    }

    function renderTabs() {
        return '<ul class="nav nav-tabs mb-4 fade-in" id="nursing-tabs" style="border-bottom:2px solid var(--color-primary-lighter);">' +
            '<li class="nav-item">' +
            '<a class="nav-link' + (currentTab === 'schedule' ? ' active' : '') + '" data-tab="schedule" href="#" style="border-radius:8px 8px 0 0;' + (currentTab === 'schedule' ? 'background:var(--color-primary);color:#fff;border-color:var(--color-primary);' : 'color:var(--color-primary-dark);') + '">' +
            '<i class="bi bi-calendar3 me-1"></i>排班表</a></li>' +
            '<li class="nav-item">' +
            '<a class="nav-link' + (currentTab === 'swaps' ? ' active' : '') + '" data-tab="swaps" href="#" style="border-radius:8px 8px 0 0;margin-left:4px;' + (currentTab === 'swaps' ? 'background:var(--color-primary);color:#fff;border-color:var(--color-primary);' : 'color:var(--color-primary-dark);') + '">' +
            '<i class="bi bi-arrow-left-right me-1"></i>换班审批' + (shiftSwaps.filter(function (s) { return s.status === 'pending'; }).length > 0 ? ' <span class="badge bg-danger" style="font-size:10px;">' + shiftSwaps.filter(function (s) { return s.status === 'pending'; }).length + '</span>' : '') +
            '</a></li></ul>';
    }

    function renderFilterBar(weekDates) {
        var startDate = weekDates[0];
        var endDate = weekDates[6];
        var weekLabel = startDate + ' ~ ' + endDate;

        return '<div class="card-pink mb-4 fade-in"><div class="card-pink-body">' +
            '<div class="filter-bar" style="flex-wrap:wrap;gap:10px;">' +
            '<div class="d-flex align-items-center gap-2">' +
            '<button class="btn btn-soft-pink btn-sm" id="btn-prev-week"><i class="bi bi-chevron-left"></i></button>' +
            '<span class="fw-medium" style="min-width:200px;text-align:center;">' + weekLabel + '</span>' +
            '<button class="btn btn-soft-pink btn-sm" id="btn-next-week"><i class="bi bi-chevron-right"></i></button>' +
            '<button class="btn btn-outline-pink btn-sm" id="btn-this-week">本周</button>' +
            '</div>' +
            '<div class="d-flex align-items-center gap-2 ms-auto">' +
            '<label class="form-label mb-0" style="font-size:13px;white-space:nowrap;">资质筛选：</label>' +
            '<select class="form-select form-select-sm" id="filter-qualification" style="width:auto;">' +
            '<option value="all"' + (qualificationFilter === 'all' ? ' selected' : '') + '>全部</option>' +
            '<option value="新生儿护理证"' + (qualificationFilter === '新生儿护理证' ? ' selected' : '') + '>新生儿护理证</option>' +
            '<option value="产后护理证"' + (qualificationFilter === '产后护理证' ? ' selected' : '') + '>产后护理证</option>' +
            '</select></div>' +
            '</div></div></div>';
    }

    function renderScheduleTable(weekDates, today) {
        var filteredNurses = getFilteredNurses();

        var html = '<div class="card-pink fade-in" style="overflow-x:auto;"><div class="card-pink-body p-2">' +
            '<table class="schedule-table">';

        html += '<thead><tr><th style="min-width:120px;">护士（资质）</th>';
        for (var d = 0; d < 7; d++) {
            var isToday = weekDates[d] === today;
            var dateObj = new Date(weekDates[d]);
            var month = dateObj.getMonth() + 1;
            var day = dateObj.getDate();
            var dateLabel = WEEKDAYS[d] + '<br><small>' + month + '/' + day + '</small>';
            if (isToday) {
                dateLabel = '<span class="text-primary-pink">' + dateLabel + '</span>';
            }
            html += '<th>' + dateLabel + '</th>';
        }
        html += '</tr></thead><tbody>';

        if (filteredNurses.length === 0) {
            html += '<tr><td colspan="8" class="text-center py-4 text-muted">暂无符合条件的护士</td></tr>';
        } else {
            for (var n = 0; n < filteredNurses.length; n++) {
                var nurse = filteredNurses[n];
                var quals = (nurse.qualifications || []).map(function (q) {
                    return '<span class="badge-pink" style="font-size:10px;padding:1px 6px;margin-left:4px;">' + q + '</span>';
                }).join('');
                html += '<tr>';
                html += '<td class="fw-medium" style="font-size:13px;white-space:nowrap;">' +
                    '<i class="bi bi-nurse me-1 text-primary-pink"></i>' + nurse.name + quals + '</td>';

                for (var d = 0; d < 7; d++) {
                    var dateStr = weekDates[d];
                    var nurseShifts = shifts.filter(function (s) {
                        return s.staffId === nurse.id && s.shiftDate === dateStr;
                    });
                    html += '<td>';
                    for (var si = 0; si < nurseShifts.length; si++) {
                        html += renderShiftBlock(nurseShifts[si]);
                    }
                    html += '</td>';
                }
                html += '</tr>';
            }
        }

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderShiftBlock(shift) {
        var typeClass = shift.shiftType === 'day' ? 'day' : 'night';
        var signClass = '';
        if (shift.status === 'signed') {
            signClass = ' signed';
        } else if (shift.shiftDate <= Store.formatDate(new Date())) {
            signClass = ' unsigned';
        }

        var motherInfo = shift.motherName ? shift.motherName : '未分配';
        var roomInfo = shift.roomNumber ? shift.roomNumber : '';

        var typeLabel = shift.shiftType === 'day' ? '白' : '夜';
        var statusBadge = '';
        if (shift.status === 'signed') {
            statusBadge = '<span class="badge-green" style="font-size:10px;padding:1px 5px;">已签</span>';
        } else if (shift.status === 'swapRequested') {
            statusBadge = '<span class="badge-yellow" style="font-size:10px;padding:1px 5px;">换班</span>';
        } else if (signClass === ' unsigned') {
            statusBadge = '<span class="badge-yellow" style="font-size:10px;padding:1px 5px;">待签</span>';
        }

        return '<div class="shift-block ' + typeClass + signClass + '" data-shift-id="' + shift.id + '" style="margin-bottom:4px;cursor:pointer;">' +
            '<div class="d-flex justify-content-between align-items-center mb-1">' +
            '<span style="font-weight:600;">' + typeLabel + '</span>' + statusBadge +
            '</div>' +
            '<div style="font-size:11px;opacity:0.9;">' + motherInfo + '</div>' +
            (roomInfo ? '<div style="font-size:10px;opacity:0.7;">' + roomInfo + '</div>' : '') +
            '</div>';
    }

    function renderSwapApprovalPanel() {
        var pending = shiftSwaps.filter(function (s) { return s.status === 'pending'; });
        var approved = shiftSwaps.filter(function (s) { return s.status === 'approved'; });
        var rejected = shiftSwaps.filter(function (s) { return s.status === 'rejected'; });

        var html = '<div class="row g-3 mb-4 fade-in">' +
            '<div class="col-md-4"><div class="stat-card" style="background:#fffbe6;border:1px solid #ffe58f;">' +
            '<div class="stat-icon yellow"><i class="bi bi-clock"></i></div>' +
            '<div class="stat-value" style="color:#d48806;">' + pending.length + '</div><div class="stat-label" style="color:#d48806;">待审批</div></div></div>' +
            '<div class="col-md-4"><div class="stat-card" style="background:#f6ffed;border:1px solid #b7eb8f;">' +
            '<div class="stat-icon green"><i class="bi bi-check-circle"></i></div>' +
            '<div class="stat-value" style="color:#389e0d;">' + approved.length + '</div><div class="stat-label" style="color:#389e0d;">已通过</div></div></div>' +
            '<div class="col-md-4"><div class="stat-card" style="background:#fff1f0;border:1px solid #ffa39e;">' +
            '<div class="stat-icon red"><i class="bi bi-x-circle"></i></div>' +
            '<div class="stat-value" style="color:#cf1322;">' + rejected.length + '</div><div class="stat-label" style="color:#cf1322;">已拒绝</div></div></div>' +
            '</div>';

        html += '<div class="card-pink fade-in"><div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-list-check"></i>换班申请审批列表</h5></div>' +
            '<div class="card-pink-body p-0"><div style="overflow-x:auto;">' +
            '<table class="table table-hover align-middle" style="margin:0;font-size:13px;">' +
            '<thead style="background:var(--color-primary-lighter);">' +
            '<tr><th>申请人</th><th>日期</th><th>班次</th><th>原因</th><th>目标护士</th><th>状态</th><th>申请时间</th><th style="width:200px;">操作</th></tr>' +
            '</thead><tbody>';

        if (shiftSwaps.length === 0) {
            html += '<tr><td colspan="8" class="text-center py-4 text-muted">暂无换班申请</td></tr>';
        } else {
            var sorted = shiftSwaps.slice().sort(function (a, b) {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return b.createdAt > a.createdAt ? 1 : -1;
            });
            sorted.forEach(function (swap) {
                var statusBadge = '';
                if (swap.status === 'pending') statusBadge = '<span class="badge-yellow">待审批</span>';
                else if (swap.status === 'approved') statusBadge = '<span class="badge-green">已通过</span>';
                else statusBadge = '<span class="badge-red">已拒绝</span>';

                var actionHtml = '';
                if (swap.status === 'pending') {
                    actionHtml = '<button class="btn btn-sm btn-success btn-approve-swap" data-id="' + swap.id + '"><i class="bi bi-check me-1"></i>通过</button>' +
                        ' <button class="btn btn-sm btn-outline-danger btn-reject-swap" data-id="' + swap.id + '"><i class="bi bi-x me-1"></i>拒绝</button>';
                } else if (swap.status === 'rejected' && swap.rejectReason) {
                    actionHtml = '<small class="text-muted">拒绝原因：' + swap.rejectReason + '</small>';
                } else if (swap.status === 'approved') {
                    actionHtml = '<small class="text-muted">审批人：' + (swap.approvedBy || '-') + '</small>';
                }

                html += '<tr>' +
                    '<td><strong>' + swap.requesterName + '</strong></td>' +
                    '<td>' + swap.shiftDate + '</td>' +
                    '<td>' + (swap.shiftType === 'day' ? '<span class="badge bg-info text-white">白班</span>' : '<span class="badge bg-secondary">夜班</span>') + '</td>' +
                    '<td>' + swap.reason + '</td>' +
                    '<td>' + (swap.targetName || '<span class="text-muted">未指定</span>') + '</td>' +
                    '<td>' + statusBadge + '</td>' +
                    '<td>' + swap.createdAt + '</td>' +
                    '<td>' + actionHtml + '</td></tr>';
            });
        }

        html += '</tbody></table></div></div></div>';
        return html;
    }

    function getFilteredNurses() {
        if (qualificationFilter === 'all') return nurses;
        return nurses.filter(function (n) {
            return n.qualifications && n.qualifications.indexOf(qualificationFilter) !== -1;
        });
    }

    function openShiftDetail(shiftId) {
        var shift = shifts.find(function (s) { return s.id === shiftId; });
        if (!shift) return;

        var typeLabel = shift.shiftType === 'day' ? '白班' : '夜班';
        var statusLabel = '';
        if (shift.status === 'signed') statusLabel = '<span class="badge-green">已签名</span>';
        else if (shift.status === 'swapRequested') statusLabel = '<span class="badge-yellow">换班申请</span>';
        else statusLabel = '<span class="badge-pink">待签名</span>';

        var bodyHtml = '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<div class="mb-3"><label class="form-label text-muted">护士</label><div class="fw-medium">' + shift.staffName + '</div></div>' +
            '<div class="mb-3"><label class="form-label text-muted">产妇</label><div class="fw-medium">' + (shift.motherName || '未分配') + '</div></div>' +
            '<div class="mb-3"><label class="form-label text-muted">房间</label><div class="fw-medium">' + (shift.roomNumber || '—') + '</div></div>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<div class="mb-3"><label class="form-label text-muted">日期</label><div class="fw-medium">' + shift.shiftDate + '</div></div>' +
            '<div class="mb-3"><label class="form-label text-muted">班次</label><div class="fw-medium">' + typeLabel + '</div></div>' +
            '<div class="mb-3"><label class="form-label text-muted">状态</label><div>' + statusLabel + '</div></div>' +
            '</div></div>';

        if (shift.nightRecordMissing) {
            bodyHtml += '<div class="alert alert-danger d-flex align-items-center mt-3 mb-3" style="border-radius:var(--radius-sm);">' +
                '<i class="bi bi-exclamation-triangle-fill me-2"></i>' +
                '<strong>夜班护理记录未补录</strong></div>' +
                '<div class="mb-3"><label class="form-label">补录夜班护理记录</label>' +
                '<textarea class="form-control" id="night-record-input" rows="3" placeholder="请输入夜班护理记录..."></textarea></div>';
        }

        bodyHtml += '<div class="divider-pink"></div>' +
            '<div class="mb-3"><label class="form-label">交接班记录</label>' +
            '<textarea class="form-control" id="handover-note-input" rows="3" placeholder="请输入交接班记录...">' + (shift.handoverNote || '') + '</textarea></div>';

        if (shift.status === 'signed') {
            bodyHtml += '<div class="text-muted" style="font-size:13px;"><i class="bi bi-check-circle me-1"></i>已由 ' + (shift.signedBy || '') + ' 于 ' + (shift.signedAt || '') + ' 签名确认</div>';
        }

        var footerHtml = '';
        if (shift.status !== 'signed') {
            footerHtml = '<button type="button" class="btn btn-soft-pink" id="btn-open-swap" data-shift-id="' + shift.id + '">' +
                '<i class="bi bi-arrow-left-right me-1"></i>申请换班</button> ' +
                '<button type="button" class="btn btn-pink" id="btn-sign-shift" data-shift-id="' + shift.id + '">' +
                '<i class="bi bi-vector-pen me-1"></i>电子签名确认</button>';
        }
        footerHtml += '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';

        App.showGlobalModal('排班详情 - ' + shift.staffName, bodyHtml, footerHtml);
    }

    function signShift(shiftId) {
        var shift = shifts.find(function (s) { return s.id === shiftId; });
        if (!shift) return;

        var handoverNote = $('#handover-note-input').val().trim();
        var nightRecord = $('#night-record-input').length ? $('#night-record-input').val().trim() : '';

        shift.handoverNote = handoverNote;
        shift.status = 'signed';
        shift.signedBy = App.state.user ? App.state.user.name : '';
        shift.signedAt = Store.formatDate(new Date()) + ' ' + new Date().toTimeString().substring(0, 5);

        if (shift.nightRecordMissing && nightRecord) {
            shift.nightRecordMissing = false;
        }

        Store.updateShift(shift).then(function () {
            App.showToast('签名确认成功', 'success');
            App.closeModal();
            render();
        }).catch(function (err) {
            App.showToast('签名确认失败', 'danger');
        });
    }

    function openSwapRequestModal(shift) {
        var candidates = nurses.filter(function (n) {
            return n.id !== shift.staffId;
        });
        var candidateOptions = candidates.map(function (n) {
            var quals = (n.qualifications || []).join('、');
            return '<option value="' + n.id + '">' + n.name + (quals ? ' (' + quals + ')' : '') + '</option>';
        }).join('');

        var bodyHtml = '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label text-muted">申请人</label>' +
            '<div class="fw-medium mb-3">' + shift.staffName + '</div>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label text-muted">班次</label>' +
            '<div class="fw-medium mb-3">' + shift.shiftDate + ' ' + (shift.shiftType === 'day' ? '白班' : '夜班') + '</div>' +
            '</div>' +
            '<div class="col-12">' +
            '<label class="form-label"><span class="text-danger">*</span> 换班原因</label>' +
            '<textarea class="form-control" id="swap-reason" rows="3" placeholder="请输入换班原因..."></textarea>' +
            '</div>' +
            '<div class="col-12">' +
            '<label class="form-label">目标护士（可选，留空则由主管分配）</label>' +
            '<select class="form-select" id="swap-target">' +
            '<option value="">—请选择（或留空）—</option>' +
            candidateOptions +
            '</select>' +
            '</div></div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-submit-swap"><i class="bi bi-check2 me-1"></i>提交申请</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal('申请换班', bodyHtml, footerHtml, function () {
            $('#btn-submit-swap').off('click').on('click', function () {
                submitSwapRequest(shift);
            });
        });
    }

    function submitSwapRequest(shift) {
        var reason = $('#swap-reason').val().trim();
        var targetId = $('#swap-target').val();
        if (!reason) { App.showToast('请填写换班原因', 'warning'); return; }

        var target = nurses.find(function (n) { return n.id === targetId; });
        var swapData = {
            id: Store.generateId(),
            storeId: App.state.storeId,
            requesterId: shift.staffId,
            requesterName: shift.staffName,
            targetId: targetId || '',
            targetName: target ? target.name : '',
            shiftId: shift.id,
            shiftDate: shift.shiftDate,
            shiftType: shift.shiftType,
            reason: reason,
            status: 'pending',
            createdAt: Store.formatDate(new Date()),
            approvedBy: '',
            approvedAt: '',
            rejectReason: ''
        };
        Store.addShiftSwap(swapData).then(function () {
            shift.status = 'swapRequested';
            return Store.updateShift(shift);
        }).then(function () {
            App.showToast('换班申请已提交，请等待审批', 'success');
            App.closeModal();
            render();
        }).catch(function (err) {
            App.showToast('提交失败：' + (err.message || err), 'danger');
        });
    }

    function openQuickSwapRequest() {
        var today = Store.formatDate(new Date());
        var nurseOptions = nurses.map(function (n) {
            var quals = (n.qualifications || []).join('、');
            return '<option value="' + n.id + '">' + n.name + (quals ? ' (' + quals + ')' : '') + '</option>';
        }).join('');
        var bodyHtml = '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 申请人</label>' +
            '<select class="form-select" id="qsw-requester">' +
            '<option value="">—请选择—</option>' + nurseOptions + '</select></div>' +
            '<div class="col-md-3">' +
            '<label class="form-label"><span class="text-danger">*</span> 日期</label>' +
            '<input type="date" class="form-control" id="qsw-date" value="' + today + '"></div>' +
            '<div class="col-md-3">' +
            '<label class="form-label"><span class="text-danger">*</span> 班次</label>' +
            '<select class="form-select" id="qsw-type">' +
            '<option value="day">白班</option><option value="night">夜班</option></select></div>' +
            '<div class="col-12">' +
            '<label class="form-label"><span class="text-danger">*</span> 换班原因</label>' +
            '<textarea class="form-control" id="qsw-reason" rows="3"></textarea></div></div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-submit-qsw"><i class="bi bi-check2 me-1"></i>提交</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal('申请换班', bodyHtml, footerHtml, function () {
            $('#btn-submit-qsw').off('click').on('click', submitQuickSwapRequest);
        });
    }

    function submitQuickSwapRequest() {
        var requesterId = $('#qsw-requester').val();
        var shiftDate = $('#qsw-date').val();
        var shiftType = $('#qsw-type').val();
        var reason = $('#qsw-reason').val().trim();
        if (!requesterId) { App.showToast('请选择申请人', 'warning'); return; }
        if (!shiftDate) { App.showToast('请选择日期', 'warning'); return; }
        if (!reason) { App.showToast('请填写换班原因', 'warning'); return; }
        var requester = nurses.find(function (n) { return n.id === requesterId; });
        var swapData = {
            id: Store.generateId(),
            storeId: App.state.storeId,
            requesterId: requesterId,
            requesterName: requester ? requester.name : '',
            targetId: '',
            targetName: '',
            shiftId: '',
            shiftDate: shiftDate,
            shiftType: shiftType,
            reason: reason,
            status: 'pending',
            createdAt: Store.formatDate(new Date()),
            approvedBy: '',
            approvedAt: '',
            rejectReason: ''
        };
        Store.addShiftSwap(swapData).then(function () {
            App.showToast('换班申请已提交', 'success');
            App.closeModal();
            render();
        });
    }

    function approveSwap(swapId) {
        var swap = shiftSwaps.find(function (s) { return s.id === swapId; });
        if (!swap) return;

        if (swap.shiftId) {
            var shift = shifts.find(function (s) { return s.id === swap.shiftId; });
            if (shift && swap.targetId) {
                var target = nurses.find(function (n) { return n.id === swap.targetId; });
                shift.staffId = swap.targetId;
                shift.staffName = target ? target.name : shift.staffName;
                shift.status = 'scheduled';
                Store.updateShift(shift);
            } else if (shift) {
                shift.status = 'scheduled';
                Store.updateShift(shift);
            }
        }

        swap.status = 'approved';
        swap.approvedBy = App.state.user ? App.state.user.name : '';
        swap.approvedAt = Store.formatDate(new Date());
        Store.updateShiftSwap(swap).then(function () {
            App.showToast('换班申请已通过', 'success');
            render();
        });
    }

    function rejectSwap(swapId) {
        var swap = shiftSwaps.find(function (s) { return s.id === swapId; });
        if (!swap) return;
        App.showGlobalModal(
            '拒绝换班申请',
            '<div class="mb-3"><label class="form-label">拒绝原因</label><textarea class="form-control" id="reject-reason" rows="3" placeholder="请输入拒绝原因..."></textarea></div>',
            '<button class="btn btn-danger" id="btn-confirm-reject"><i class="bi bi-x-circle me-1"></i>确认拒绝</button><button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>',
            function () {
                $('#btn-confirm-reject').off('click').on('click', function () {
                    var reason = $('#reject-reason').val().trim() || '未填写原因';
                    swap.status = 'rejected';
                    swap.rejectReason = reason;

                    if (swap.shiftId) {
                        var shift = shifts.find(function (s) { return s.id === swap.shiftId; });
                        if (shift) {
                            shift.status = 'scheduled';
                            Store.updateShift(shift);
                        }
                    }
                    Store.updateShiftSwap(swap).then(function () {
                        App.showToast('换班申请已拒绝', 'info');
                        App.closeModal();
                        render();
                    });
                });
            }
        );
    }

    function openBatchSchedule() {
        var today = Store.formatDate(new Date());

        var bodyHtml = '<div class="alert alert-info" style="background:#e6f7ff;border:1px solid #91d5ff;border-radius:10px;">' +
            '<i class="bi bi-lightbulb me-2"></i><strong>智能匹配提示：</strong>选择资质后将自动高亮推荐具备对应资质的护士，并过滤不符合条件的人员。' +
            '</div>' +
            '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label">排班日期</label>' +
            '<input type="date" class="form-control" id="batch-date" value="' + today + '">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">班次类型</label>' +
            '<select class="form-select" id="batch-shift-type">' +
            '<option value="day">白班</option><option value="night">夜班</option>' +
            '</select></div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">护理类型</label>' +
            '<select class="form-select" id="batch-care-type">' +
            '<option value="all">通用护理</option>' +
            '<option value="新生儿护理证">新生儿护理（需新生儿护理证）</option>' +
            '<option value="产后护理证">产后康复（需产后护理证）</option>' +
            '</select></div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">资质要求</label>' +
            '<select class="form-select" id="batch-qualification">' +
            '<option value="all">不限</option>' +
            '<option value="新生儿护理证">新生儿护理证</option>' +
            '<option value="产后护理证">产后护理证</option>' +
            '</select></div>' +
            '</div>' +
            '<div class="divider-pink"></div>' +
            '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<label class="form-label mb-0">选择护士（<span id="recommended-count" class="text-primary-pink fw-bold">0</span> 名符合资质，<span id="selected-count">0</span> 名已选）</label>' +
            '<button type="button" class="btn btn-sm btn-outline-pink" id="btn-select-recommended"><i class="bi bi-magic me-1"></i>智能匹配-全选推荐</button>' +
            '</div>' +
            '<div id="batch-nurse-list" class="mb-3" style="max-height:280px;overflow-y:auto;border:1px solid var(--color-primary-lighter);border-radius:10px;padding:8px;">' +
            renderNurseChecklistSmart(nurses, 'all', today) +
            '</div>';

        var footerHtml = '<button type="button" class="btn btn-pink" id="btn-submit-batch">' +
            '<i class="bi bi-check2 me-1"></i>确认排班</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal('批量排班（智能资质匹配）', bodyHtml, footerHtml, function () {
            updateSelectedCount();

            $('#batch-care-type').on('change', function () {
                var careType = $(this).val();
                var qual = careType === 'all' ? 'all' : careType;
                $('#batch-qualification').val(qual);
                refreshNurseList();
            });

            $('#batch-qualification').on('change', refreshNurseList);
            $('#batch-date').on('change', refreshNurseList);

            $('#btn-select-recommended').on('click', function () {
                var qual = $('#batch-qualification').val();
                var date = $('#batch-date').val();
                var recommended = getRecommendedNurses(qual, date);
                $('.batch-nurse-check').each(function () {
                    var id = $(this).val();
                    var isRec = recommended.some(function (n) { return n.id === id; });
                    if (isRec) $(this).prop('checked', true);
                });
                updateSelectedCount();
                App.showToast('已自动选择 ' + recommended.length + ' 名符合资质的推荐护士', 'success');
            });

            $(document).on('change', '.batch-nurse-check', updateSelectedCount);
        });
    }

    function refreshNurseList() {
        var qual = $('#batch-qualification').val();
        var date = $('#batch-date').val();
        var filtered = getRecommendedNurses(qual, date);
        $('#batch-nurse-list').html(renderNurseChecklistSmart(nurses, qual, date));
        $('#recommended-count').text(filtered.length);
        updateSelectedCount();
    }

    function updateSelectedCount() {
        var count = $('.batch-nurse-check:checked').length;
        $('#selected-count').text(count);
    }

    function getRecommendedNurses(qual, date) {
        var list = qual === 'all' ? nurses.slice() : nurses.filter(function (n) {
            return n.qualifications && n.qualifications.indexOf(qual) !== -1;
        });
        if (date) {
            var shiftType = $('#batch-shift-type').length ? $('#batch-shift-type').val() : 'day';
            list = list.filter(function (n) {
                var already = shifts.some(function (s) {
                    return s.staffId === n.id && s.shiftDate === date && s.shiftType === shiftType && s.status !== 'swapRequested';
                });
                return !already;
            });
        }
        return list;
    }

    function renderNurseChecklistSmart(nurseList, requiredQual, date) {
        if (nurseList.length === 0) {
            return '<div class="text-muted text-center py-3">暂无护士</div>';
        }
        var html = '';
        var recommended = getRecommendedNurses(requiredQual, date);
        var recIds = recommended.map(function (n) { return n.id; });

        for (var i = 0; i < nurseList.length; i++) {
            var n = nurseList[i];
            var isRec = recIds.indexOf(n.id) !== -1;
            var quals = (n.qualifications || []);
            var qualsHtml = quals.map(function (q) {
                var match = requiredQual !== 'all' && q === requiredQual;
                return '<span class="badge-pink" style="font-size:10px;padding:1px 6px;margin-left:4px;' + (match ? 'background:#52c41a;color:#fff;' : '') + '">' + q + '</span>';
            }).join('');

            var hasConflict = date && shifts.some(function (s) {
                var shiftType = $('#batch-shift-type').length ? $('#batch-shift-type').val() : 'day';
                return s.staffId === n.id && s.shiftDate === date && s.shiftType === shiftType && s.status !== 'swapRequested';
            });

            html += '<div class="form-check mb-2 p-2 rounded" style="' + (isRec ? 'background:#f6ffed;border:1px solid #b7eb8f;' : '') + (hasConflict ? 'opacity:0.5;' : '') + '">' +
                '<input class="form-check-input batch-nurse-check" type="checkbox" value="' + n.id + '" id="batch-nurse-' + n.id + '"' + (hasConflict ? ' disabled' : '') + '>' +
                '<label class="form-check-label" for="batch-nurse-' + n.id + '">' +
                '<strong>' + n.name + '</strong>' + qualsHtml +
                (isRec ? ' <span class="badge-green" style="font-size:10px;padding:1px 6px;margin-left:4px;"><i class="bi bi-magic"></i>推荐</span>' : '') +
                (hasConflict ? ' <span class="badge bg-secondary" style="font-size:10px;padding:1px 6px;margin-left:4px;">已有排班</span>' : '') +
                '</label></div>';
        }
        return html;
    }

    function submitBatchSchedule() {
        var date = $('#batch-date').val();
        var shiftType = $('#batch-shift-type').val();

        if (!date) {
            App.showToast('请选择排班日期', 'warning');
            return;
        }

        var selectedNurseIds = [];
        $('.batch-nurse-check:checked').each(function () {
            selectedNurseIds.push($(this).val());
        });

        if (selectedNurseIds.length === 0) {
            App.showToast('请选择至少一名护士', 'warning');
            return;
        }

        var currentMothers = mothers.filter(function (m) {
            return m.checkInDate <= date && m.checkOutDate >= date;
        });

        var newShifts = [];
        for (var i = 0; i < selectedNurseIds.length; i++) {
            var nurseId = selectedNurseIds[i];
            var nurse = nurses.find(function (n) { return n.id === nurseId; });
            if (!nurse) continue;

            var existingShift = shifts.find(function (s) {
                return s.staffId === nurseId && s.shiftDate === date && s.shiftType === shiftType;
            });
            if (existingShift) continue;

            var mother = currentMothers[i % Math.max(1, currentMothers.length)] || null;

            newShifts.push({
                id: Store.generateId(),
                storeId: App.state.storeId,
                staffId: nurse.id,
                staffName: nurse.name,
                motherId: mother ? mother.id : '',
                motherName: mother ? mother.name : '',
                roomId: mother ? mother.roomId : '',
                roomNumber: mother ? mother.roomNumber : '',
                shiftDate: date,
                shiftType: shiftType,
                status: 'scheduled',
                handoverNote: '',
                signedBy: '',
                signedAt: '',
                qualifications: nurse.qualifications || []
            });
        }

        if (newShifts.length === 0) {
            App.showToast('所选护士在该日期班次已有排班', 'warning');
            return;
        }

        var promises = newShifts.map(function (s) { return Store.addShift(s); });

        Promise.all(promises).then(function () {
            App.showToast('成功创建 ' + newShifts.length + ' 条排班记录', 'success');
            App.closeModal();
            render();
        }).catch(function (err) {
            App.showToast('批量排班失败', 'danger');
        });
    }

    function bindEvents() {
        $('#app-content').off('click', 'a[data-tab]').on('click', 'a[data-tab]', function (e) {
            e.preventDefault();
            currentTab = $(this).data('tab');
            renderPage();
        });

        $('#app-content').off('click', '#btn-prev-week').on('click', '#btn-prev-week', function () {
            weekOffset--;
            render();
        });

        $('#app-content').off('click', '#btn-next-week').on('click', '#btn-next-week', function () {
            weekOffset++;
            render();
        });

        $('#app-content').off('click', '#btn-this-week').on('click', '#btn-this-week', function () {
            weekOffset = 0;
            render();
        });

        $('#app-content').off('change', '#filter-qualification').on('change', '#filter-qualification', function () {
            qualificationFilter = $(this).val();
            render();
        });

        $('#app-content').off('click', '#btn-batch-schedule').on('click', '#btn-batch-schedule', function () {
            openBatchSchedule();
        });

        $('#app-content').off('click', '#btn-request-swap').on('click', '#btn-request-swap', function () {
            openQuickSwapRequest();
        });

        $('#app-content').off('click', '.shift-block').on('click', '.shift-block', function () {
            var shiftId = $(this).data('shift-id');
            openShiftDetail(shiftId);
        });

        $(document).off('click', '#btn-sign-shift').on('click', '#btn-sign-shift', function () {
            var shiftId = $(this).data('shift-id');
            signShift(shiftId);
        });

        $(document).off('click', '#btn-open-swap').on('click', '#btn-open-swap', function () {
            var shiftId = $(this).data('shift-id');
            var shift = shifts.find(function (s) { return s.id === shiftId; });
            if (shift) openSwapRequestModal(shift);
        });

        $(document).off('click', '#btn-submit-batch').on('click', '#btn-submit-batch', function () {
            submitBatchSchedule();
        });

        $('#app-content').off('click', '.btn-approve-swap').on('click', '.btn-approve-swap', function () {
            var id = $(this).data('id');
            if (confirm('确认通过该换班申请？')) approveSwap(id);
        });

        $('#app-content').off('click', '.btn-reject-swap').on('click', '.btn-reject-swap', function () {
            var id = $(this).data('id');
            rejectSwap(id);
        });
    }

    return { render: render };
})();
