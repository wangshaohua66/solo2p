(function (global) {
    'use strict';

    const ScheduleGrid = {
        draggedShift: null,
        dragSourceCell: null,

        init: function () {
            this.render();
            this.bindEvents();
            this.subscribeEvents();
        },

        subscribeEvents: function () {
            const self = this;
            App.bus.subscribe('app:initialized', function () { self.render(); });
            App.bus.subscribe('state:changed', function () { self.render(); });
            App.bus.subscribe('branch:changed', function () { self.render(); });
            App.bus.subscribe('shifts:changed', function () { self.render(); });
        },

        bindEvents: function () {
            const self = this;

            $('#viewWeekBtn').on('click', function () {
                App.state.scheduleView = 'week';
                App.saveSettings();
                $(this).addClass('active');
                $('#viewDayBtn').removeClass('active');
                self.render();
            });
            $('#viewDayBtn').on('click', function () {
                App.state.scheduleView = 'day';
                App.saveSettings();
                $(this).addClass('active');
                $('#viewWeekBtn').removeClass('active');
                self.render();
            });
            $('#prevPeriodBtn').on('click', function () {
                const offset = App.state.scheduleView === 'week' ? -7 : -1;
                App.state.scheduleDate = Utils.addDays(App.state.scheduleDate, offset);
                self.render();
            });
            $('#nextPeriodBtn').on('click', function () {
                const offset = App.state.scheduleView === 'week' ? 7 : 1;
                App.state.scheduleDate = Utils.addDays(App.state.scheduleDate, offset);
                self.render();
            });
            $('#todayBtn').on('click', function () {
                App.state.scheduleDate = new Date();
                self.render();
            });

            if (App.state.scheduleView === 'week') {
                $('#viewWeekBtn').addClass('active');
                $('#viewDayBtn').removeClass('active');
            } else {
                $('#viewDayBtn').addClass('active');
                $('#viewWeekBtn').removeClass('active');
            }
        },

        render: function () {
            const view = App.state.scheduleView;
            if (view === 'week') {
                this.renderWeekView();
            } else {
                this.renderDayView();
            }
            this.renderAppointmentList();
            this.renderWaitlist();
        },

        renderWeekView: function () {
            const dates = Utils.getWeekDates(App.state.scheduleDate);
            const startDate = dates[0];
            const endDate = dates[6];
            $('#periodLabel').text(Utils.formatDate(startDate, 'MM月DD日') + ' - ' + Utils.formatDate(endDate, 'MM月DD日'));

            const vets = App.getBranchVets();
            const slots = Utils.CONSTANTS.TIME_SLOTS;
            const shifts = App.getBranchShifts();
            const unavailable = App.state.unavailable;

            const shiftMap = {};
            shifts.forEach(function (s) {
                const key = s.userId + '_' + s.date + '_' + s.slotId;
                shiftMap[key] = s;
            });

            const unavailMap = {};
            unavailable.forEach(function (u) {
                const start = moment(u.startDate);
                const end = moment(u.endDate);
                for (let m = moment(start); m.isSameOrBefore(end, 'day'); m.add(1, 'days')) {
                    const key = u.userId + '_' + m.format('YYYY-MM-DD');
                    if (!unavailMap[key]) unavailMap[key] = [];
                    unavailMap[key].push(u);
                }
            });

            let html = '<div class="table-responsive"><table class="table table-sm table-bordered table-dark schedule-table">';
            html += '<thead><tr><th class="sticky-col time-col">时段</th>';

            vets.forEach(function (vet) {
                const qual = Utils.getQualificationById(vet.qualification);
                const badgeClass = qual ? 'bg-' + qual.color : 'bg-secondary';
                const qualLabel = qual ? qual.label : '';
                html += '<th class="vet-col text-center">';
                html += '<div class="fw-bold small">' + Utils.escapeHtml(vet.name) + '</div>';
                html += '<span class="badge ' + badgeClass + ' small">' + Utils.escapeHtml(qualLabel) + '</span>';
                html += '</th>';
            });
            if (vets.length === 0) {
                html += '<th class="text-center text-muted">暂无兽医数据</th>';
            }
            html += '</tr></thead><tbody>';

            dates.forEach(function (date) {
                const dateStr = Utils.formatDate(date);
                const isToday = Utils.isToday(date);
                const dayLabel = Utils.getDayOfWeekLabel(date);
                const dateLabel = Utils.formatDate(date, 'MM/DD');

                slots.forEach(function (slot, slotIdx) {
                    html += '<tr>';
                    if (slotIdx === 0) {
                        html += '<td class="sticky-col time-col date-cell text-center" rowspan="' + slots.length + '">';
                        html += '<div class="fw-bold ' + (isToday ? 'text-primary' : '') + '">' + dateLabel + '</div>';
                        html += '<div class="small text-muted">' + dayLabel + '</div>';
                        if (isToday) html += '<div class="badge bg-primary small mt-1">今天</div>';
                        html += '</td>';
                    }
                    html += '<td class="time-col text-center small"><div class="fw-bold">' + slot.label + '</div>';
                    html += '<div class="text-muted small">' + slot.start + '-' + slot.end + '</div></td>';

                    vets.forEach(function (vet) {
                        const key = vet.id + '_' + dateStr + '_' + slot.id;
                        const unavailKey = vet.id + '_' + dateStr;
                        const shift = shiftMap[key];
                        const isUnavailable = unavailMap[unavailKey];

                        let cellClass = 'shift-cell';
                        let content = '';
                        let cellTitle = '';

                        if (isUnavailable && (!shift || shift.userId !== vet.id)) {
                            cellClass += ' unavailable';
                            const u = isUnavailable[0];
                            content = '<span class="text-muted small"><i class="bi bi-ban"></i> ' + Utils.escapeHtml(u.typeLabel || u.type) + '</span>';
                            cellTitle = u.notes || (u.typeLabel || u.type);
                        } else if (shift) {
                            cellClass += ' has-shift';
                            content = '<div class="shift-content" draggable="true" data-shift-id="' + shift.id + '">';
                            content += '<i class="bi bi-person-check text-success me-1"></i>';
                            content += '<span class="small">' + Utils.escapeHtml(vet.name) + '</span>';
                            content += '</div>';
                            cellTitle = vet.name + ' - ' + slot.label;
                        } else {
                            cellClass += ' empty';
                            content = '<span class="text-muted small">空</span>';
                        }

                        html += '<td class="' + cellClass + '" ';
                        html += 'data-vet-id="' + vet.id + '" data-date="' + dateStr + '" data-slot="' + slot.id + '" ';
                        html += 'title="' + Utils.escapeHtml(cellTitle) + '">';
                        html += content;
                        html += '</td>';
                    });
                    html += '</tr>';
                });
            });

            if (vets.length === 0) {
                html += '<tr><td colspan="10" class="text-center text-muted py-4">请先添加兽医用户</td></tr>';
            }

            html += '</tbody></table></div>';
            $('#scheduleGrid').html(html);
            this.setupDragAndDrop();
            this.bindCellEvents();
        },

        renderDayView: function () {
            const date = App.state.scheduleDate;
            $('#periodLabel').text(Utils.formatDate(date, 'YYYY年MM月DD日') + ' ' + Utils.getDayOfWeekLabel(date));

            const vets = App.getBranchVets();
            const aptSlots = Utils.CONSTANTS.APPOINTMENT_SLOTS;
            const shifts = App.getBranchShifts();
            const appointments = App.getBranchAppointments().filter(function (a) {
                return a.date === Utils.formatDate(date) && a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            });

            const shiftMap = {};
            shifts.forEach(function (s) {
                if (s.date === Utils.formatDate(date)) {
                    if (!shiftMap[s.userId]) shiftMap[s.userId] = {};
                    shiftMap[s.userId][s.slotId] = s;
                }
            });

            const aptMap = {};
            appointments.forEach(function (a) {
                const key = a.vetId + '_' + a.time;
                if (!aptMap[key]) aptMap[key] = [];
                aptMap[key].push(a);
            });

            let html = '<div class="table-responsive"><table class="table table-sm table-bordered table-dark schedule-table">';
            html += '<thead><tr><th class="sticky-col time-col">时间</th>';
            vets.forEach(function (vet) {
                const qual = Utils.getQualificationById(vet.qualification);
                const badgeClass = qual ? 'bg-' + qual.color : 'bg-secondary';
                const qualLabel = qual ? qual.label : '';
                html += '<th class="vet-col text-center">';
                html += '<div class="fw-bold small">' + Utils.escapeHtml(vet.name) + '</div>';
                html += '<span class="badge ' + badgeClass + ' small">' + Utils.escapeHtml(qualLabel) + '</span>';
                html += '</th>';
            });
            if (vets.length === 0) html += '<th class="text-center text-muted">暂无兽医数据</th>';
            html += '</tr></thead><tbody>';

            aptSlots.forEach(function (time) {
                const slot = Utils.getTimeSlotByTime(time);
                html += '<tr>';
                html += '<td class="sticky-col time-col text-center fw-bold">' + time + '</td>';

                vets.forEach(function (vet) {
                    const hasShift = slot && shiftMap[vet.id] && shiftMap[vet.id][slot.id];
                    const key = vet.id + '_' + time;
                    const apts = aptMap[key] || [];

                    let cellClass = 'shift-cell';
                    let content = '';

                    if (!hasShift) {
                        cellClass += ' unavailable';
                        content = '<span class="text-muted small"><i class="bi bi-x-circle"></i> 休息</span>';
                    } else if (apts.length > 0) {
                        cellClass += ' has-appointments';
                        content = apts.map(function (a) {
                            const statusBadge = a.status === 'confirmed' ? 'bg-primary' :
                                a.status === 'completed' ? 'bg-success' : 'bg-secondary';
                            return '<div class="appointment-item badge ' + statusBadge + ' d-block mb-1 text-start" data-apt-id="' + a.id + '">';
                            content += '<i class="bi bi-clipboard2-pulse me-1"></i>';
                            content += Utils.escapeHtml(a.petName || '') + ' - ' + Utils.escapeHtml(a.ownerName || '');
                            content += '</div>';
                        }).join('');
                    } else {
                        cellClass += ' available';
                        content = '<span class="text-success small"><i class="bi bi-check-circle"></i> 可预约</span>';
                    }

                    html += '<td class="' + cellClass + '" data-vet-id="' + vet.id + '" data-time="' + time + '">';
                    html += content;
                    html += '</td>';
                });
                html += '</tr>';
            });

            if (vets.length === 0) {
                html += '<tr><td colspan="10" class="text-center text-muted py-4">请先添加兽医用户</td></tr>';
            }

            html += '</tbody></table></div>';
            $('#scheduleGrid').html(html);
            this.bindDayViewEvents();
        },

        setupDragAndDrop: function () {
            const self = this;
            $('.shift-content[draggable="true"]').on('dragstart', function (e) {
                const shiftId = $(this).data('shift-id');
                self.draggedShift = App.state.shifts.find(function (s) { return s.id === shiftId; });
                self.dragSourceCell = $(this).closest('td');
                self.dragSourceCell.addClass('drag-source');
                e.originalEvent.dataTransfer.effectAllowed = 'move';
                e.originalEvent.dataTransfer.setData('text/plain', shiftId);
            });

            $('.shift-content[draggable="true"]').on('dragend', function () {
                self.dragSourceCell?.removeClass('drag-source');
                self.draggedShift = null;
                self.dragSourceCell = null;
                $('.shift-cell').removeClass('drag-target drag-target-invalid');
            });

            $('.shift-cell').on('dragover', function (e) {
                e.preventDefault();
                if (!self.draggedShift) return;
                const $cell = $(this);
                const vetId = $cell.data('vet-id');
                const date = $cell.data('date');
                const slot = $cell.data('slot');
                if (!vetId || !date || !slot) return;

                const testShift = {
                    id: self.draggedShift.id,
                    userId: vetId,
                    branchId: App.state.currentBranchId,
                    date: date,
                    slotId: slot
                };
                const validation = ShiftRules.validateShift(testShift, App.state.shifts, App.state.unavailable);
                $cell.addClass(validation.valid ? 'drag-target' : 'drag-target-invalid');
            });

            $('.shift-cell').on('dragleave', function () {
                $(this).removeClass('drag-target drag-target-invalid');
            });

            $('.shift-cell').on('drop', function (e) {
                e.preventDefault();
                const $cell = $(this);
                $cell.removeClass('drag-target drag-target-invalid');
                if (!self.draggedShift) return;

                const vetId = $cell.data('vet-id');
                const date = $cell.data('date');
                const slot = $cell.data('slot');

                if (vetId === self.draggedShift.userId &&
                    date === self.draggedShift.date &&
                    slot === self.draggedShift.slotId) {
                    return;
                }

                if (!vetId || !date || !slot) return;

                const result = App.updateShift(self.draggedShift.id, {
                    userId: vetId,
                    date: date,
                    slotId: slot
                });

                if (result.success) {
                    Utils.showToast('排班已更新', 'success', 2000);
                } else {
                    const errors = (result.errors || []).map(function (e) { return e.message; }).join('；');
                    Utils.showToast('排班冲突：' + errors, 'danger', 4000);
                }

                self.dragSourceCell?.removeClass('drag-source');
                self.draggedShift = null;
                self.dragSourceCell = null;
            });
        },

        bindCellEvents: function () {
            const self = this;
            $('.shift-cell').on('dblclick', function () {
                const $cell = $(this);
                const vetId = $cell.data('vet-id');
                const date = $cell.data('date');
                const slot = $cell.data('slot');
                if (!vetId || !date || !slot) return;

                const existing = App.state.shifts.find(function (s) {
                    return s.userId === vetId && s.date === date && s.slotId === slot;
                });

                if (existing) {
                    Utils.confirmDialog('确定要删除该排班吗？', '删除排班').then(function (confirmed) {
                        if (confirmed) {
                            App.deleteShift(existing.id);
                            Utils.showToast('排班已删除', 'success');
                        }
                    });
                } else {
                    const result = App.addShift({
                        userId: vetId,
                        branchId: App.state.currentBranchId,
                        date: date,
                        slotId: slot
                    });
                    if (result.success) {
                        Utils.showToast('排班已添加', 'success');
                    } else {
                        const errors = (result.errors || []).map(function (e) { return e.message; }).join('；');
                        Utils.showToast('排班冲突：' + errors, 'danger', 4000);
                    }
                }
            });

            $('.shift-cell').on('contextmenu', function (e) {
                e.preventDefault();
                const $cell = $(this);
                const vetId = $cell.data('vet-id');
                const date = $cell.data('date');
                const slot = $cell.data('slot');
                const existing = App.state.shifts.find(function (s) {
                    return s.userId === vetId && s.date === date && s.slotId === slot;
                });

                if (existing) {
                    self.openShiftSwapModal(existing);
                }
            });

            $('.shift-content').on('contextmenu', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const shiftId = $(this).data('shift-id');
                const shift = App.state.shifts.find(function (s) { return s.id === shiftId; });
                if (shift) self.openShiftSwapModal(shift);
            });
        },

        bindDayViewEvents: function () {
            $('.appointment-item').on('click', function () {
                const aptId = $(this).data('apt-id');
                const apt = App.state.appointments.find(function (a) { return a.id === aptId; });
                if (apt) {
                    AppointmentManager.openEditModal(apt);
                }
            });

            $('.shift-cell.available').on('click', function () {
                const vetId = $(this).data('vet-id');
                const time = $(this).data('time');
                const date = Utils.formatDate(App.state.scheduleDate);
                AppointmentManager.openNewModal({
                    vetId: vetId,
                    date: date,
                    time: time
                });
            });
        },

        openShiftSwapModal: function (shift) {
            const vet = App.getUserById(shift.userId);
            const slot = Utils.getTimeSlotById(shift.slotId);
            const branch = App.getBranchById(shift.branchId);

            $('#originalShiftInfo').html(`
                <div class="mb-1"><i class="bi bi-person me-1"></i><strong>${Utils.escapeHtml(vet?.name || '')}</strong></div>
                <div class="mb-1"><i class="bi bi-calendar me-1"></i>${shift.date}</div>
                <div class="mb-1"><i class="bi bi-clock me-1"></i>${slot?.label || ''} (${slot?.start || ''}-${slot?.end || ''})</div>
                <div><i class="bi bi-hospital me-1"></i>${Utils.escapeHtml(branch?.name || '')}</div>
            `);

            const vets = App.getBranchVets().filter(function (v) { return v.id !== shift.userId; });
            const options = vets.map(function (v) {
                return '<option value="' + v.id + '">' + Utils.escapeHtml(v.name) + '</option>';
            }).join('');
            $('#swapTargetUser').html(options);

            $('#swapTargetDate').val(Utils.formatDate(Utils.addDays(new Date(), 1)));
            const slotOptions = Utils.CONSTANTS.TIME_SLOTS.map(function (s) {
                return '<option value="' + s.id + '">' + s.label + '</option>';
            }).join('');
            $('#swapTargetSlot').html(slotOptions);
            $('#swapReason').val('');
            $('#swapValidationResult').addClass('d-none');

            const modal = new bootstrap.Modal($('#shiftSwapModal')[0]);
            modal.show();

            $('#submitSwapBtn').off('click').on('click', function () {
                const targetId = $('#swapTargetUser').val();
                const targetDate = $('#swapTargetDate').val();
                const targetSlotId = $('#swapTargetSlot').val();
                const reason = $('#swapReason').val().trim();

                if (!targetId || !targetDate || !targetSlotId || !reason) {
                    Utils.showToast('请填写完整的换班信息', 'warning');
                    return;
                }

                const targetVet = App.getUserById(targetId);
                $('#targetShiftInfo').html(`
                    <div class="mb-1"><i class="bi bi-person me-1"></i><strong>${Utils.escapeHtml(targetVet?.name || '')}</strong></div>
                    <div class="mb-1"><i class="bi bi-calendar me-1"></i>${targetDate}</div>
                    <div class="mb-1"><i class="bi bi-clock me-1"></i>${Utils.getTimeSlotById(targetSlotId)?.label || ''}</div>
                `);

                const requesterShift = { userId: shift.userId, date: shift.date, slotId: shift.slotId, branchId: shift.branchId };
                const targetShift = { userId: targetId, date: targetDate, slotId: targetSlotId, branchId: App.state.currentBranchId };
                const validation = ShiftRules.validateSwap(requesterShift, targetShift, shift.userId, targetId, App.state.shifts, App.state.unavailable);

                const $result = $('#swapValidationResult');
                $result.removeClass('d-none');
                if (validation.valid) {
                    $result.removeClass('alert-danger').addClass('alert alert-success').html('<i class="bi bi-check-circle me-1"></i>规则校验通过，可以提交换班申请');
                    App.submitSwapRequest({
                        requesterId: shift.userId,
                        targetId: targetId,
                        originalDate: shift.date,
                        originalSlot: shift.slotId,
                        targetDate: targetDate,
                        targetSlot: targetSlotId,
                        reason: reason
                    });
                    Utils.showToast('换班申请已提交，等待审批', 'success');
                    modal.hide();
                } else {
                    const errorsHtml = validation.errors.map(function (e) {
                        const side = e.side === 'requester' ? '【申请人】' : '【换班对象】';
                        return '<div>' + side + e.message + (e.detail ? ' - ' + e.detail : '') + '</div>';
                    }).join('');
                    $result.removeClass('alert-success').addClass('alert alert-danger').html(errorsHtml);
                }
            });
        },

        renderAppointmentList: function () {
            const today = Utils.formatDate(new Date());
            const appointments = App.getBranchAppointments()
                .filter(function (a) { return a.date === today && a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED; })
                .sort(function (a, b) { return a.time.localeCompare(b.time); });

            if (appointments.length === 0) {
                $('#appointmentList').html('<div class="text-center text-muted py-4 small">今日暂无预约</div>');
                return;
            }

            const html = appointments.map(function (a) {
                const vet = App.getUserById(a.vetId);
                const statusMap = { confirmed: '待就诊', completed: '已完成', waitlist: '候补中' };
                const statusBadge = { confirmed: 'bg-primary', completed: 'bg-success', waitlist: 'bg-warning text-dark' }[a.status] || 'bg-secondary';
                const typeLabel = Utils.CONSTANTS.APPOINTMENT_TYPES[a.type] || a.type;
                return `
                    <div class="p-3 border-bottom border-secondary appointment-card" data-apt-id="${a.id}">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <div>
                                <span class="fw-bold">${Utils.escapeHtml(a.time)}</span>
                                <span class="badge ${statusBadge} ms-2 small">${statusMap[a.status]}</span>
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                                <ul class="dropdown-menu dropdown-menu-dark">
                                    <li><a class="dropdown-item apt-edit" href="#"><i class="bi bi-pencil me-2"></i>编辑</a></li>
                                    <li><a class="dropdown-item apt-complete text-success" href="#"><i class="bi bi-check2 me-2"></i>标记完成</a></li>
                                    <li><a class="dropdown-item apt-cancel text-danger" href="#"><i class="bi bi-x-lg me-2"></i>取消预约</a></li>
                                </ul>
                            </div>
                        </div>
                        <div class="small">
                            <div><i class="bi bi-person me-1"></i>${Utils.escapeHtml(a.ownerName)} - ${Utils.escapeHtml(a.petName)}(${Utils.escapeHtml(a.petType === 'dog' ? '犬' : a.petType === 'cat' ? '猫' : '其他')})</div>
                            <div class="text-muted"><i class="bi bi-stethoscope me-1"></i>${Utils.escapeHtml(vet?.name || '')} · <span class="badge bg-info small">${typeLabel}</span></div>
                            ${a.notes ? '<div class="text-warning"><i class="bi bi-chat-left-text me-1"></i>' + Utils.escapeHtml(a.notes) + '</div>' : ''}
                        </div>
                    </div>
                `;
            }).join('');

            $('#appointmentList').html(html);

            $('.appointment-card').on('click', '.apt-edit', function (e) {
                e.preventDefault();
                const aptId = $(this).closest('.appointment-card').data('apt-id');
                const apt = App.state.appointments.find(function (a) { return a.id === aptId; });
                if (apt) AppointmentManager.openEditModal(apt);
            });
            $('.appointment-card').on('click', '.apt-complete', function (e) {
                e.preventDefault();
                const aptId = $(this).closest('.appointment-card').data('apt-id');
                App.updateAppointment(aptId, { status: 'completed' });
                Utils.showToast('预约已标记完成', 'success');
            });
            $('.appointment-card').on('click', '.apt-cancel', function (e) {
                e.preventDefault();
                const aptId = $(this).closest('.appointment-card').data('apt-id');
                Utils.confirmDialog('确定取消该预约吗？', '取消预约').then(function (ok) {
                    if (ok) {
                        App.cancelAppointment(aptId);
                        Utils.showToast('预约已取消', 'success');
                    }
                });
            });
        },

        renderWaitlist: function () {
            const waitlist = App.state.waitlist
                .filter(function (w) { return w.branchId === App.state.currentBranchId; })
                .sort(function (a, b) { return b.waitlistPriority - a.waitlistPriority; });

            if (waitlist.length === 0) {
                $('#waitlistList').html('<div class="text-center text-muted py-4 small">暂无候补</div>');
                return;
            }

            const html = waitlist.map(function (w, idx) {
                const vet = App.getUserById(w.vetId);
                const typeLabel = Utils.CONSTANTS.APPOINTMENT_TYPES[w.type] || w.type;
                return `
                    <div class="p-3 border-bottom border-warning waitlist-item" data-apt-id="${w.id}">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <div>
                                <span class="badge bg-warning text-dark me-2">#${idx + 1}</span>
                                <span class="fw-bold">${w.date}</span>
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                                <ul class="dropdown-menu dropdown-menu-dark">
                                    <li><a class="dropdown-item wl-promote text-success" href="#"><i class="bi bi-arrow-up me-2"></i>晋升预约</a></li>
                                    <li><a class="dropdown-item wl-cancel text-danger" href="#"><i class="bi bi-x-lg me-2"></i>移除候补</a></li>
                                </ul>
                            </div>
                        </div>
                        <div class="small">
                            <div><i class="bi bi-person me-1"></i>${Utils.escapeHtml(w.ownerName)} - ${Utils.escapeHtml(w.petName)}</div>
                            <div class="text-muted"><i class="bi bi-stethoscope me-1"></i>${Utils.escapeHtml(vet?.name || '')} · <span class="badge bg-info small">${typeLabel}</span></div>
                        </div>
                    </div>
                `;
            }).join('');
            $('#waitlistList').html(html);

            $('.waitlist-item').on('click', '.wl-promote', function (e) {
                e.preventDefault();
                const aptId = $(this).closest('.waitlist-item').data('apt-id');
                const wl = App.state.waitlist.find(function (w) { return w.id === aptId; });
                if (wl) AppointmentManager.openNewModal(wl);
            });
            $('.waitlist-item').on('click', '.wl-cancel', function (e) {
                e.preventDefault();
                const aptId = $(this).closest('.waitlist-item').data('apt-id');
                App.state.waitlist = App.state.waitlist.filter(function (w) { return w.id !== aptId; });
                Storage.setWaitlist(App.state.waitlist);
                App.bus.publish('waitlist:changed', App.state.waitlist);
                Utils.showToast('已从候补队列移除', 'success');
            });
        }
    };

    global.ScheduleGrid = ScheduleGrid;

    $(function () {
        ScheduleGrid.init();
    });

})(window);
