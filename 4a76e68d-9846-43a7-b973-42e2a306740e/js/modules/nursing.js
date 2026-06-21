var Nursing = window.Nursing = (function () {
    var weekOffset = 0;
    var qualificationFilter = 'all';
    var shifts = [];
    var nurses = [];
    var mothers = [];

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
            Store.getMothersByStore(storeId)
        ]).then(function (results) {
            shifts = results[0] || [];
            nurses = results[1] || [];
            mothers = results[2] || [];
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
        html += renderFilterBar(weekDates);
        html += renderScheduleTable(weekDates, today);

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
        var actionsHtml = '<button class="btn btn-pink" id="btn-batch-schedule"><i class="bi bi-calendar-plus me-1"></i>批量排班</button>';
        return App.renderPageHeader('bi-clipboard2-pulse', '护理排班', App.state.storeName, actionsHtml);
    }

    function renderStatCards(today) {
        var totalNurses = nurses.length;
        var dayShiftsToday = shifts.filter(function (s) { return s.shiftDate === today && s.shiftType === 'day'; });
        var nightShiftsToday = shifts.filter(function (s) { return s.shiftDate === today && s.shiftType === 'night'; });
        var unsignedHandovers = shifts.filter(function (s) { return s.status !== 'signed' && s.shiftDate <= today; });

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
            '<div class="stat-card"><div class="stat-icon yellow"><i class="bi bi-pencil-square"></i></div>' +
            '<div class="stat-value">' + unsignedHandovers.length + '</div><div class="stat-label">待签名交接</div></div></div>' +
            '</div>';
    }

    function renderFilterBar(weekDates) {
        var startDate = weekDates[0];
        var endDate = weekDates[6];

        var weekLabel = startDate + ' ~ ' + endDate;

        return '<div class="card-pink mb-4 fade-in"><div class="card-pink-body">' +
            '<div class="filter-bar">' +
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

        html += '<thead><tr><th style="min-width:100px;">护士</th>';
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
                html += '<tr>';
                html += '<td class="fw-medium" style="font-size:13px;white-space:nowrap;">' +
                    '<i class="bi bi-nurse me-1 text-primary-pink"></i>' + nurse.name + '</td>';

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
            footerHtml = '<button type="button" class="btn btn-pink" id="btn-sign-shift" data-shift-id="' + shift.id + '">' +
                '<i class="bi bi-vector-pen me-1"></i>电子签名确认</button>';
        }
        footerHtml += '<button type="button" class="btn btn-soft-pink" data-bs-dismiss="modal">关闭</button>';

        App.showGlobalModal('排班详情 - ' + shift.staffName, bodyHtml, footerHtml);
    }

    function signShift(shiftId) {
        var shift = shifts.find(function (s) { return s.id === shiftId; });
        if (!shift) return;

        var handoverNote = $('#handover-note-input').val().trim();
        var nightRecord = $('#night-record-input').val().trim();

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

    function openBatchSchedule() {
        var bodyHtml = '<div class="row g-3">' +
            '<div class="col-md-4">' +
            '<label class="form-label">排班日期</label>' +
            '<input type="date" class="form-control" id="batch-date" value="' + Store.formatDate(new Date()) + '">' +
            '</div>' +
            '<div class="col-md-4">' +
            '<label class="form-label">班次类型</label>' +
            '<select class="form-select" id="batch-shift-type">' +
            '<option value="day">白班</option><option value="night">夜班</option>' +
            '</select></div>' +
            '<div class="col-md-4">' +
            '<label class="form-label">资质要求</label>' +
            '<select class="form-select" id="batch-qualification">' +
            '<option value="all">不限</option>' +
            '<option value="新生儿护理证">新生儿护理证</option>' +
            '<option value="产后护理证">产后护理证</option>' +
            '</select></div>' +
            '</div>' +
            '<div class="divider-pink"></div>' +
            '<label class="form-label">选择护士</label>' +
            '<div id="batch-nurse-list" class="mb-3" style="max-height:250px;overflow-y:auto;">' +
            renderNurseChecklist(nurses) +
            '</div>';

        var footerHtml = '<button type="button" class="btn btn-pink" id="btn-submit-batch">' +
            '<i class="bi bi-check2 me-1"></i>确认排班</button>' +
            '<button type="button" class="btn btn-soft-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal('批量排班', bodyHtml, footerHtml, function () {
            $('#batch-qualification').on('change', function () {
                var qual = $(this).val();
                var filtered = qual === 'all' ? nurses : nurses.filter(function (n) {
                    return n.qualifications && n.qualifications.indexOf(qual) !== -1;
                });
                $('#batch-nurse-list').html(renderNurseChecklist(filtered));
            });
        });
    }

    function renderNurseChecklist(nurseList) {
        if (nurseList.length === 0) {
            return '<div class="text-muted text-center py-3">暂无符合条件的护士</div>';
        }
        var html = '';
        for (var i = 0; i < nurseList.length; i++) {
            var n = nurseList[i];
            var quals = (n.qualifications || []).join('、');
            html += '<div class="form-check mb-2">' +
                '<input class="form-check-input batch-nurse-check" type="checkbox" value="' + n.id + '" id="batch-nurse-' + n.id + '">' +
                '<label class="form-check-label" for="batch-nurse-' + n.id + '">' +
                n.name +
                (quals ? ' <span class="badge-pink" style="font-size:10px;">' + quals + '</span>' : '') +
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

        $('#app-content').off('click', '.shift-block').on('click', '.shift-block', function () {
            var shiftId = $(this).data('shift-id');
            openShiftDetail(shiftId);
        });

        $(document).off('click', '#btn-sign-shift').on('click', '#btn-sign-shift', function () {
            var shiftId = $(this).data('shift-id');
            signShift(shiftId);
        });

        $(document).off('click', '#btn-submit-batch').on('click', '#btn-submit-batch', function () {
            submitBatchSchedule();
        });
    }

    return { render: render };
})();
