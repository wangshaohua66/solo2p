(function (global) {
    'use strict';

    const AppointmentManager = {
        selectedTime: null,

        init: function () {
            this.bindEvents();
            this.subscribeEvents();
            this.renderAppointmentTable();
            this.renderApprovalList();
        },

        subscribeEvents: function () {
            const self = this;
            App.bus.subscribe('app:initialized', function () { self.renderAppointmentTable(); self.renderApprovalList(); });
            App.bus.subscribe('state:changed', function () { self.renderAppointmentTable(); self.renderApprovalList(); });
            App.bus.subscribe('branch:changed', function () { self.renderAppointmentTable(); });
            App.bus.subscribe('appointments:changed', function () { self.renderAppointmentTable(); });
            App.bus.subscribe('waitlist:changed', function () { self.renderAppointmentTable(); });
            App.bus.subscribe('swapRequests:changed', function () { self.renderApprovalList(); });
        },

        bindEvents: function () {
            const self = this;

            $('#newAppointmentBtn, #newAppointmentBtn2').on('click', function () {
                self.openNewModal({});
            });

            $('#aptDate').on('change', function () { self.renderAvailableTimeSlots(); });
            $('#aptVet').on('change', function () { self.renderAvailableTimeSlots(); });
            $('#aptType').on('change', function () {
                self.renderHistoryIfNeeded();
            });
            $('#aptOwnerName, #aptPhone').on('blur', function () {
                self.renderHistoryIfNeeded();
            });

            $('#saveAppointmentBtn').on('click', function () { self.saveAppointment(); });

            $('#unavailableModal').on('show.bs.modal', function () {
                $('#unavailableStart').val(Utils.formatDate(new Date()));
                $('#unavailableEnd').val(Utils.formatDate(Utils.addDays(new Date(), 1)));
                $('#unavailableNotes').val('');
            });

            $('#saveUnavailableBtn').on('click', function () {
                const type = $('#unavailableType').val();
                const start = $('#unavailableStart').val();
                const end = $('#unavailableEnd').val();
                const notes = $('#unavailableNotes').val().trim();
                if (!start || !end) {
                    Utils.showToast('请选择开始和结束日期', 'warning');
                    return;
                }
                if (start > end) {
                    Utils.showToast('结束日期不能早于开始日期', 'danger');
                    return;
                }
                const result = App.addUnavailable({
                    userId: App.state.currentUserId,
                    type: type,
                    startDate: start,
                    endDate: end,
                    notes: notes
                });
                if (result.success) {
                    Utils.showToast('不可用时段已标记', 'success');
                    bootstrap.Modal.getInstance($('#unavailableModal')[0]).hide();
                }
            });

            $('#searchAppointmentsBtn').on('click', function () { self.renderAppointmentTable(); });

            $('#pendingApprovalsBtn').on('click', function () {
                $(this).addClass('active');
                $('#historyApprovalsBtn').removeClass('active');
                self.renderApprovalList('pending');
            });
            $('#historyApprovalsBtn').on('click', function () {
                $(this).addClass('active');
                $('#pendingApprovalsBtn').removeClass('active');
                self.renderApprovalList('history');
            });

            $('#approveApprovalBtn').on('click', function () {
                const id = App.state.currentApprovalId;
                if (!id) return;
                Utils.confirmDialog('确定审批通过该换班申请？').then(function (ok) {
                    if (ok) {
                        App.approveSwapRequest(id);
                        Utils.showToast('换班已审批通过', 'success');
                        bootstrap.Modal.getInstance($('#approvalDetailModal')[0]).hide();
                    }
                });
            });
            $('#rejectApprovalBtn').on('click', function () {
                const id = App.state.currentApprovalId;
                if (!id) return;
                Utils.confirmDialog('确定驳回该换班申请？').then(function (ok) {
                    if (ok) {
                        App.rejectSwapRequest(id, '院长驳回');
                        Utils.showToast('换班申请已驳回', 'info');
                        bootstrap.Modal.getInstance($('#approvalDetailModal')[0]).hide();
                    }
                });
            });
        },

        openNewModal: function (defaults) {
            App.state.editingAppointmentId = null;
            this.selectedTime = defaults.time || null;
            $('#appointmentModalTitle').text('新增预约');
            $('#aptOwnerName').val(defaults.ownerName || '');
            $('#aptPhone').val(defaults.phone || '');
            $('#aptPetName').val(defaults.petName || '');
            $('#aptPetType').val(defaults.petType || 'dog');
            $('#aptType').val(defaults.type || 'first');
            $('#aptVet').val(defaults.vetId || '');
            $('#aptDate').val(defaults.date || Utils.formatDate(new Date()));
            $('#aptNotes').val(defaults.notes || '');
            $('#aptHistorySection').addClass('d-none');
            this.renderAvailableTimeSlots();
            new bootstrap.Modal($('#appointmentModal')[0]).show();
        },

        openEditModal: function (apt) {
            App.state.editingAppointmentId = apt.id;
            this.selectedTime = apt.time;
            $('#appointmentModalTitle').text('编辑预约');
            $('#aptOwnerName').val(apt.ownerName || '');
            $('#aptPhone').val(apt.phone || '');
            $('#aptPetName').val(apt.petName || '');
            $('#aptPetType').val(apt.petType || 'dog');
            $('#aptType').val(apt.type || 'first');
            $('#aptVet').val(apt.vetId || '');
            $('#aptDate').val(apt.date || '');
            $('#aptNotes').val(apt.notes || '');
            this.renderHistoryIfNeeded();
            this.renderAvailableTimeSlots();
            new bootstrap.Modal($('#appointmentModal')[0]).show();
        },

        renderAvailableTimeSlots: function () {
            const self = this;
            const vetId = $('#aptVet').val();
            const date = $('#aptDate').val();
            const $container = $('#aptTimeSlots');

            if (!vetId || !date) {
                $container.html('<div class="text-muted small">请先选择兽医和日期</div>');
                return;
            }

            const vet = App.getUserById(vetId);
            const shifts = App.state.shifts.filter(function (s) { return s.userId === vetId && s.date === date; });
            const appointments = App.state.appointments.filter(function (a) {
                return a.vetId === vetId && a.date === date && a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            });

            if (shifts.length === 0) {
                $container.html('<div class="text-warning small"><i class="bi bi-exclamation-triangle me-1"></i>该兽医当日无排班</div>');
                return;
            }

            const aptCounts = {};
            appointments.forEach(function (a) {
                aptCounts[a.time] = (aptCounts[a.time] || 0) + 1;
            });

            const qual = vet ? Utils.getQualificationById(vet.qualification) : null;
            const maxPerSlot = qual ? qual.maxAppointmentsPerSlot : 1;

            const allSlots = Utils.CONSTANTS.APPOINTMENT_SLOTS;
            const availableSlots = allSlots.filter(function (time) {
                const slot = Utils.getTimeSlotByTime(time);
                if (!slot) return false;
                return shifts.some(function (s) { return s.slotId === slot.id; });
            });

            const html = availableSlots.map(function (time) {
                const count = aptCounts[time] || 0;
                const isFull = count >= maxPerSlot;
                const isSelected = self.selectedTime === time;
                let btnClass = isFull ? 'btn-outline-secondary disabled' :
                    isSelected ? 'btn-primary' : 'btn-outline-primary';
                const badge = count > 0 ? ' <span class="badge bg-' + (isFull ? 'danger' : 'info') + ' ms-1">' + count + '/' + maxPerSlot + '</span>' : '';
                return '<button type="button" class="btn btn-sm ' + btnClass + ' time-slot-btn" data-time="' + time + '">' + time + badge + '</button>';
            }).join('');

            $container.html(html || '<div class="text-muted small">当日无可用时段</div>');

            $('.time-slot-btn').on('click', function () {
                if ($(this).hasClass('disabled')) return;
                self.selectedTime = $(this).data('time');
                $('.time-slot-btn').removeClass('btn-primary').addClass('btn-outline-primary');
                $(this).removeClass('btn-outline-primary').addClass('btn-primary');
            });

            if (this.selectedTime) {
                $('.time-slot-btn[data-time="' + this.selectedTime + '"]').trigger('click');
            }
        },

        renderHistoryIfNeeded: function () {
            const type = $('#aptType').val();
            const ownerName = $('#aptOwnerName').val().trim();
            const phone = $('#aptPhone').val().trim();
            const $section = $('#aptHistorySection');

            if (type !== 'followup' || !ownerName || !phone) {
                $section.addClass('d-none');
                return;
            }

            const history = App.state.appointments.filter(function (a) {
                return a.ownerName === ownerName && a.phone === phone &&
                    a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            }).sort(function (a, b) { return b.date.localeCompare(a.date); });

            $section.removeClass('d-none');
            const $list = $('#aptHistoryList');
            if (history.length === 0) {
                $list.html('<div class="text-muted small">暂无历史就诊记录</div>');
                return;
            }
            const html = history.map(function (a) {
                const vet = App.getUserById(a.vetId);
                const typeLabel = Utils.CONSTANTS.APPOINTMENT_TYPES[a.type] || a.type;
                return `<div class="small border-bottom border-secondary py-1">
                    <span class="fw-bold">${a.date} ${a.time}</span>
                    <span class="text-muted"> - ${typeLabel}</span>
                    <div class="text-muted">${vet?.name || ''} · ${a.petName}${a.notes ? ' · ' + a.notes : ''}</div>
                </div>`;
            }).join('');
            $list.html(html);
        },

        saveAppointment: function () {
            const ownerName = $('#aptOwnerName').val().trim();
            const phone = $('#aptPhone').val().trim();
            const petName = $('#aptPetName').val().trim();
            const petType = $('#aptPetType').val();
            const type = $('#aptType').val();
            const vetId = $('#aptVet').val();
            const date = $('#aptDate').val();
            const notes = $('#aptNotes').val().trim();

            if (!ownerName || !phone || !petName || !vetId || !date || !this.selectedTime) {
                Utils.showToast('请填写所有必填项并选择时段', 'warning');
                return;
            }

            const aptData = {
                ownerName: ownerName,
                phone: phone,
                petName: petName,
                petType: petType,
                type: type,
                vetId: vetId,
                branchId: App.state.currentBranchId,
                date: date,
                time: this.selectedTime,
                notes: notes
            };

            let result;
            if (App.state.editingAppointmentId) {
                result = App.updateAppointment(App.state.editingAppointmentId, aptData);
            } else {
                result = App.addAppointment(aptData);
            }

            if (result.success) {
                if (result.waitlisted) {
                    Utils.showToast('该时段已满，已加入候补队列', 'warning', 4000);
                } else {
                    Utils.showToast('预约保存成功', 'success');
                }
                bootstrap.Modal.getInstance($('#appointmentModal')[0]).hide();
            } else {
                const errors = (result.errors || []).map(function (e) { return e.message; }).join('；');
                Utils.showToast('预约失败：' + errors, 'danger', 4000);
            }
        },

        getAvailableSlots: function (vetId, date) {
            const t0 = performance.now();
            const vet = App.getUserById(vetId);
            const shifts = App.state.shifts.filter(function (s) { return s.userId === vetId && s.date === date; });
            const appointments = App.state.appointments.filter(function (a) {
                return a.vetId === vetId && a.date === date && a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            });
            const waitlist = App.state.waitlist.filter(function (w) {
                return w.vetId === vetId && w.date === date && w.status === Utils.CONSTANTS.APPOINTMENT_STATUS.WAITLIST;
            });

            const aptCounts = {};
            appointments.forEach(function (a) { aptCounts[a.time] = (aptCounts[a.time] || 0) + 1; });

            const qual = vet ? Utils.getQualificationById(vet.qualification) : null;
            const maxPerSlot = qual ? qual.maxAppointmentsPerSlot : 1;

            const allSlots = Utils.CONSTANTS.APPOINTMENT_SLOTS;
            const result = allSlots.map(function (time) {
                const slot = Utils.getTimeSlotByTime(time);
                const hasShift = slot && shifts.some(function (s) { return s.slotId === slot.id; });
                const count = aptCounts[time] || 0;
                const isAvailable = hasShift && count < maxPerSlot;
                const wlForSlot = waitlist.filter(function (w) { return !w.time || w.time === time; });
                return {
                    time: time,
                    available: isAvailable,
                    appointments: count,
                    maxAppointments: maxPerSlot,
                    waitlist: wlForSlot.length
                };
            });

            const elapsed = performance.now() - t0;
            if (elapsed > 200) console.warn('Availability calc slow:', elapsed + 'ms');
            return result;
        },

        renderAppointmentTable: function () {
            const filterDate = $('#filterDate').val();
            const filterVet = $('#filterVet').val();
            const filterStatus = $('#filterStatus').val();

            let list = App.getBranchAppointments().concat(
                App.state.waitlist.filter(function (w) { return w.branchId === App.state.currentBranchId; })
            );

            if (filterDate) list = list.filter(function (a) { return a.date === filterDate; });
            if (filterVet) list = list.filter(function (a) { return a.vetId === filterVet; });
            if (filterStatus) {
                list = list.filter(function (a) {
                    if (filterStatus === 'waitlist') return a.status === Utils.CONSTANTS.APPOINTMENT_STATUS.WAITLIST;
                    return a.status === filterStatus;
                });
            }

            list = Utils.sortBy(list, function (a) { return a.date + a.time; }, false);

            if (list.length === 0) {
                $('#appointmentTable').html('<div class="text-center text-muted py-4">暂无预约记录</div>');
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-sm table-dark table-hover mb-0">';
            html += '<thead><tr>';
            html += '<th>日期时间</th><th>客户</th><th>宠物</th><th>兽医</th>';
            html += '<th>类型</th><th>状态</th><th>操作</th>';
            html += '</tr></thead><tbody>';

            const statusMap = {
                confirmed: { label: '待就诊', class: 'bg-primary' },
                completed: { label: '已完成', class: 'bg-success' },
                cancelled: { label: '已取消', class: 'bg-secondary' },
                waitlist: { label: '候补', class: 'bg-warning text-dark' }
            };

            html += list.map(function (a) {
                const vet = App.getUserById(a.vetId);
                const s = statusMap[a.status] || { label: a.status, class: 'bg-secondary' };
                const typeLabel = Utils.CONSTANTS.APPOINTMENT_TYPES[a.type] || a.type;
                const petTypeLabel = a.petType === 'dog' ? '犬' : a.petType === 'cat' ? '猫' : '其他';
                return `<tr data-apt-id="${a.id}">
                    <td>${a.date} ${a.time || '--:--'}</td>
                    <td>${Utils.escapeHtml(a.ownerName)}<br><span class="text-muted small">${Utils.escapeHtml(a.phone)}</span></td>
                    <td>${Utils.escapeHtml(a.petName)} <span class="badge bg-info small">${petTypeLabel}</span></td>
                    <td>${Utils.escapeHtml(vet?.name || '--')}</td>
                    <td><span class="badge bg-info">${typeLabel}</span></td>
                    <td><span class="badge ${s.class}">${s.label}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary apt-edit-btn"><i class="bi bi-pencil"></i></button>
                        ${a.status !== 'cancelled' && a.status !== 'completed' ?
                            '<button class="btn btn-sm btn-outline-danger apt-cancel-btn ms-1"><i class="bi bi-x-lg"></i></button>' : ''}
                    </td>
                </tr>`;
            }).join('');

            html += '</tbody></table></div>';
            $('#appointmentTable').html(html);

            const self = this;
            $('#appointmentTable').find('.apt-edit-btn').on('click', function () {
                const aptId = $(this).closest('tr').data('apt-id');
                let apt = App.state.appointments.find(function (a) { return a.id === aptId; });
                if (!apt) apt = App.state.waitlist.find(function (a) { return a.id === aptId; });
                if (apt) self.openEditModal(apt);
            });
            $('#appointmentTable').find('.apt-cancel-btn').on('click', function () {
                const aptId = $(this).closest('tr').data('apt-id');
                Utils.confirmDialog('确定取消该预约吗？').then(function (ok) {
                    if (ok) {
                        const inWaitlist = App.state.waitlist.some(function (w) { return w.id === aptId; });
                        if (inWaitlist) {
                            App.state.waitlist = App.state.waitlist.filter(function (w) { return w.id !== aptId; });
                            Storage.setWaitlist(App.state.waitlist);
                            App.bus.publish('waitlist:changed', App.state.waitlist);
                        } else {
                            App.cancelAppointment(aptId);
                        }
                        Utils.showToast('预约已取消', 'success');
                    }
                });
            });
        },

        renderApprovalList: function (mode) {
            mode = mode || ($('#pendingApprovalsBtn').hasClass('active') ? 'pending' : 'history');
            let list = App.state.swapRequests;

            if (mode === 'pending') {
                list = list.filter(function (r) { return r.status === 'pending'; });
            } else {
                list = list.filter(function (r) { return r.status !== 'pending'; });
            }

            list = Utils.sortBy(list, 'createdAt', false);

            if (list.length === 0) {
                $('#approvalList').html('<div class="text-center text-muted py-4">' +
                    (mode === 'pending' ? '暂无待审批换班申请' : '暂无历史审批记录') + '</div>');
                return;
            }

            const statusMap = {
                pending: { label: '待审批', class: 'bg-warning text-dark' },
                approved: { label: '已通过', class: 'bg-success' },
                rejected: { label: '已驳回', class: 'bg-danger' }
            };

            const html = list.map(function (req) {
                const requester = App.getUserById(req.requesterId);
                const target = App.getUserById(req.targetId);
                const s = statusMap[req.status] || { label: req.status, class: 'bg-secondary' };
                const origSlot = Utils.getTimeSlotById(req.originalSlot);
                const tgtSlot = Utils.getTimeSlotById(req.targetSlot);
                return `<div class="p-3 border-bottom border-secondary approval-card" data-req-id="${req.id}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge ${s.class} me-2">${s.label}</span>
                            <span class="text-muted small">${new Date(req.createdAt).toLocaleString()}</span>
                        </div>
                        ${req.status === 'pending' ? '<button class="btn btn-sm btn-outline-primary view-approval-btn">查看详情</button>' : ''}
                    </div>
                    <div class="row small">
                        <div class="col-md-5">
                            <div class="text-muted">申请人：<strong>${Utils.escapeHtml(requester?.name || '')}</strong></div>
                            <div>${req.originalDate} ${origSlot?.label || ''}</div>
                        </div>
                        <div class="col-md-2 text-center text-primary"><i class="bi bi-arrow-left-right"></i></div>
                        <div class="col-md-5">
                            <div class="text-muted">换班对象：<strong>${Utils.escapeHtml(target?.name || '')}</strong></div>
                            <div>${req.targetDate} ${tgtSlot?.label || ''}</div>
                        </div>
                    </div>
                    <div class="small text-muted mt-2"><i class="bi bi-chat-left-text"></i> ${Utils.escapeHtml(req.reason || '')}</div>
                </div>`;
            }).join('');

            $('#approvalList').html(html);

            const self = this;
            $('.view-approval-btn').on('click', function () {
                const reqId = $(this).closest('.approval-card').data('req-id');
                self.openApprovalDetail(reqId);
            });
        },

        openApprovalDetail: function (reqId) {
            const req = App.state.swapRequests.find(function (r) { return r.id === reqId; });
            if (!req) return;
            App.state.currentApprovalId = reqId;

            const requester = App.getUserById(req.requesterId);
            const target = App.getUserById(req.targetId);
            const origSlot = Utils.getTimeSlotById(req.originalSlot);
            const tgtSlot = Utils.getTimeSlotById(req.targetSlot);

            const requesterShift = {
                userId: req.requesterId, date: req.originalDate, slotId: req.originalSlot, branchId: requester?.branchId
            };
            const targetShift = {
                userId: req.targetId, date: req.targetDate, slotId: req.targetSlot, branchId: target?.branchId
            };
            const validation = ShiftRules.validateSwap(requesterShift, targetShift, req.requesterId, req.targetId, App.state.shifts, App.state.unavailable);

            const validationHtml = validation.valid
                ? '<div class="alert alert-success"><i class="bi bi-check-circle me-1"></i>规则校验通过</div>'
                : '<div class="alert alert-danger">' + validation.errors.map(function (e) {
                    const side = e.side === 'requester' ? '【申请人】' : '【换班对象】';
                    return '<div>' + side + e.message + '</div>';
                }).join('') + '</div>';

            $('#approvalDetailBody').html(`
                <div class="row g-3">
                    <div class="col-md-6">
                        <div class="card bg-black border-secondary p-3">
                            <h6 class="text-primary mb-2"><i class="bi bi-person-gear me-1"></i>申请人</h6>
                            <div class="mb-1"><strong>${Utils.escapeHtml(requester?.name || '--')}</strong></div>
                            <div class="small text-muted">${req.originalDate} ${origSlot?.label || ''}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card bg-black border-secondary p-3">
                            <h6 class="text-info mb-2"><i class="bi bi-person-gear me-1"></i>换班对象</h6>
                            <div class="mb-1"><strong>${Utils.escapeHtml(target?.name || '--')}</strong></div>
                            <div class="small text-muted">${req.targetDate} ${tgtSlot?.label || ''}</div>
                        </div>
                    </div>
                    <div class="col-md-12">
                        <div class="card bg-black border-secondary p-3">
                            <h6 class="mb-2"><i class="bi bi-chat-left-text me-1"></i>换班原因</h6>
                            <div>${Utils.escapeHtml(req.reason || '--')}</div>
                        </div>
                    </div>
                    <div class="col-md-12">${validationHtml}</div>
                </div>
            `);

            new bootstrap.Modal($('#approvalDetailModal')[0]).show();
        }
    };

    global.AppointmentManager = AppointmentManager;

    $(function () {
        AppointmentManager.init();
    });

})(window);
