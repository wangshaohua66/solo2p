(function (global) {
    'use strict';

    function EventBus() {
        this.subscribers = {};
    }

    EventBus.prototype.subscribe = function (event, callback) {
        if (!this.subscribers[event]) this.subscribers[event] = [];
        this.subscribers[event].push(callback);
        const self = this;
        return function () {
            self.subscribers[event] = self.subscribers[event].filter(function (cb) { return cb !== callback; });
        };
    };

    EventBus.prototype.publish = function (event, data) {
        if (!this.subscribers[event]) return;
        const callbacks = this.subscribers[event].slice();
        const t0 = performance.now();
        callbacks.forEach(function (cb) {
            try { cb(data); } catch (e) { console.error('Event subscriber error:', event, e); }
        });
        const elapsed = performance.now() - t0;
        if (elapsed > 50) console.warn('Event broadcast slow:', event, elapsed + 'ms');
    };

    const App = {
        state: {
            branches: [],
            users: [],
            shifts: [],
            appointments: [],
            waitlist: [],
            unavailable: [],
            swapRequests: [],
            offlineLog: [],
            currentBranchId: null,
            currentUserId: null,
            currentRole: null,
            isOnline: true,
            scheduleView: 'week',
            scheduleDate: new Date(),
            currentApprovalId: null,
            editingAppointmentId: null
        },
        bus: new EventBus(),

        init: function () {
            if (!Storage.isAvailable()) {
                Utils.showToast('本地存储不可用，部分功能受限', 'warning');
            }
            Storage.migrate();
            this.loadState();
            this.initNetworkListener();
            this.renderGlobalUI();
            this.bindGlobalEvents();
            this.bus.publish('app:initialized', this.state);
            Utils.showToast('系统加载完成', 'success', 2000);
        },

        loadState: function () {
            this.state.branches = Storage.getBranches();
            this.state.users = Storage.getUsers();
            this.state.shifts = Storage.getShifts();
            this.state.appointments = Storage.getAppointments();
            this.state.waitlist = Storage.getWaitlist();
            this.state.unavailable = Storage.getUnavailable();
            this.state.swapRequests = Storage.getSwapRequests();
            this.state.offlineLog = Storage.getOfflineLog();

            const settings = Storage.getSettings();
            if (settings.currentBranchId && this.state.branches.some(function (b) { return b.id === settings.currentBranchId; })) {
                this.state.currentBranchId = settings.currentBranchId;
            } else if (this.state.branches.length > 0) {
                this.state.currentBranchId = this.state.branches[0].id;
            }
            if (settings.currentUserId && this.state.users.some(function (u) { return u.id === settings.currentUserId; })) {
                this.state.currentUserId = settings.currentUserId;
            } else if (this.state.users.length > 0) {
                this.state.currentUserId = this.state.users[0].id;
            }
            this.state.scheduleView = settings.scheduleView || 'week';

            const curUser = this.state.users.find(function (u) { return u.id === App.state.currentUserId; });
            this.state.currentRole = curUser ? curUser.role : null;
        },

        saveSettings: function () {
            Storage.setSettings({
                currentBranchId: this.state.currentBranchId,
                currentUserId: this.state.currentUserId,
                scheduleView: this.state.scheduleView
            });
        },

        initNetworkListener: function () {
            const self = this;
            this.state.isOnline = navigator.onLine;
            this.updateOfflineStatusUI();

            window.addEventListener('online', function () {
                self.state.isOnline = true;
                self.updateOfflineStatusUI();
                self.replayOfflineChanges();
                Utils.showToast('网络已恢复，正在同步离线数据...', 'info');
            });

            window.addEventListener('offline', function () {
                self.state.isOnline = false;
                self.updateOfflineStatusUI();
                Utils.showToast('网络已断开，操作将暂存本地', 'warning');
            });
        },

        updateOfflineStatusUI: function () {
            const $btn = $('#offlineStatus');
            if (this.state.isOnline) {
                $btn.removeClass('btn-outline-danger').addClass('btn-outline-primary')
                    .attr('title', '在线').html('<i class="bi bi-wifi"></i>');
            } else {
                $btn.removeClass('btn-outline-primary').addClass('btn-outline-danger')
                    .attr('title', '离线模式').html('<i class="bi bi-wifi-off"></i>');
            }
        },

        replayOfflineChanges: function () {
            if (this.state.offlineLog.length === 0) return;
            const result = Storage.replayOfflineLogs();
            if (result.conflicts.length > 0) {
                this.showOfflineConflictModal(result.conflicts);
            } else {
                this.loadState();
                this.bus.publish('state:changed', this.state);
                this.renderGlobalUI();
                Utils.showToast('同步完成，已应用 ' + result.applied.length + ' 条变更', 'success');
            }
        },

        showOfflineConflictModal: function (conflicts) {
            const $modal = $('#offlineConflictModal');
            const $list = $('#offlineConflictList');
            const html = conflicts.map(function (c, idx) {
                const entry = c.entry;
                return `
                    <div class="card bg-black border-secondary mb-2 p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge bg-warning me-2">${entry.action}</span>
                                <span class="text-muted small">${new Date(entry.timestamp).toLocaleString()}</span>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input conflict-checkbox" type="checkbox" data-idx="${idx}" checked>
                            </div>
                        </div>
                        <div class="row small">
                            <div class="col-md-6">
                                <div class="text-muted">本地版本：</div>
                                <pre class="bg-dark p-2 rounded text-light small" style="white-space:pre-wrap;">${JSON.stringify(entry.data, null, 2).slice(0, 200)}</pre>
                            </div>
                            <div class="col-md-6">
                                <div class="text-muted">当前版本：</div>
                                <pre class="bg-dark p-2 rounded text-light small" style="white-space:pre-wrap;">${JSON.stringify(c.current || {}, null, 2).slice(0, 200)}</pre>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            $list.html(html);
            const modal = new bootstrap.Modal($modal[0]);
            modal.show();
        },

        persistWithOfflineLog: function (action, dataType, data, persistFn) {
            if (this.state.isOnline) {
                persistFn();
            } else {
                Storage.addOfflineLog(action, dataType, data);
                persistFn();
            }
        },

        setCurrentBranch: function (branchId) {
            this.state.currentBranchId = branchId;
            this.saveSettings();
            this.renderGlobalUI();
            this.bus.publish('branch:changed', branchId);
            this.bus.publish('state:changed', this.state);
        },

        setCurrentUser: function (userId) {
            this.state.currentUserId = userId;
            const user = this.state.users.find(function (u) { return u.id === userId; });
            this.state.currentRole = user ? user.role : null;
            this.saveSettings();
            this.renderGlobalUI();
            this.bus.publish('user:changed', userId);
            this.bus.publish('state:changed', this.state);
        },

        hasPermission: function (permission) {
            if (!this.state.currentRole) return false;
            const roleDef = Utils.CONSTANTS.ROLES;
            for (let key in roleDef) {
                if (roleDef[key].id === this.state.currentRole) {
                    return roleDef[key].permissions.includes('all') || roleDef[key].permissions.includes(permission);
                }
            }
            return false;
        },

        getBranchUsers: function (branchId) {
            branchId = branchId || this.state.currentBranchId;
            return this.state.users.filter(function (u) { return u.branchId === branchId; });
        },

        getBranchVets: function (branchId) {
            return this.getBranchUsers(branchId).filter(function (u) { return u.role === 'vet'; });
        },

        getBranchShifts: function (branchId) {
            branchId = branchId || this.state.currentBranchId;
            return this.state.shifts.filter(function (s) { return s.branchId === branchId; });
        },

        getBranchAppointments: function (branchId) {
            branchId = branchId || this.state.currentBranchId;
            return this.state.appointments.filter(function (a) { return a.branchId === branchId; });
        },

        addShift: function (shift) {
            if (!shift.id) shift.id = 'shift_' + Utils.generateId();
            shift.updatedAt = new Date().toISOString();
            const validation = ShiftRules.validateShift(shift, this.state.shifts, this.state.unavailable);
            if (!validation.valid) {
                return { success: false, errors: validation.errors };
            }
            this.state.shifts.push(shift);
            this.persistWithOfflineLog('create', 'shifts', shift, function () {
                Storage.setShifts(App.state.shifts);
            });
            this.bus.publish('shifts:changed', this.state.shifts);
            this.bus.publish('state:changed', this.state);
            return { success: true, shift: shift };
        },

        updateShift: function (shiftId, updates) {
            const idx = this.state.shifts.findIndex(function (s) { return s.id === shiftId; });
            if (idx < 0) return { success: false, error: '排班不存在' };
            const updated = { ...this.state.shifts[idx], ...updates, updatedAt: new Date().toISOString() };
            const validation = ShiftRules.validateShift(updated, this.state.shifts, this.state.unavailable);
            if (!validation.valid) {
                return { success: false, errors: validation.errors };
            }
            this.state.shifts[idx] = updated;
            this.persistWithOfflineLog('update', 'shifts', updated, function () {
                Storage.setShifts(App.state.shifts);
            });
            this.bus.publish('shifts:changed', this.state.shifts);
            this.bus.publish('state:changed', this.state);
            return { success: true, shift: updated };
        },

        deleteShift: function (shiftId) {
            const idx = this.state.shifts.findIndex(function (s) { return s.id === shiftId; });
            if (idx < 0) return { success: false };
            const removed = this.state.shifts.splice(idx, 1)[0];
            this.persistWithOfflineLog('delete', 'shifts', removed, function () {
                Storage.setShifts(App.state.shifts);
            });
            this.bus.publish('shifts:changed', this.state.shifts);
            this.bus.publish('state:changed', this.state);
            return { success: true };
        },

        addAppointment: function (apt) {
            if (!apt.id) apt.id = 'apt_' + Utils.generateId();
            apt.status = apt.status || Utils.CONSTANTS.APPOINTMENT_STATUS.CONFIRMED;
            apt.updatedAt = new Date().toISOString();
            apt.createdAt = apt.createdAt || new Date().toISOString();
            const validation = ShiftRules.validateAppointment(apt, this.state.appointments, this.state.shifts, this.state.unavailable);
            if (!validation.valid && !validation.isFull) {
                return { success: false, errors: validation.errors };
            }
            if (validation.isFull) {
                apt.status = Utils.CONSTANTS.APPOINTMENT_STATUS.WAITLIST;
                apt.waitlistPriority = this.calculateWaitlistPriority(apt);
                apt.waitlistAddedAt = new Date().toISOString();
                this.state.waitlist.push(apt);
                this.persistWithOfflineLog('create', 'waitlist', apt, function () {
                    Storage.setWaitlist(App.state.waitlist);
                });
                this.bus.publish('waitlist:changed', this.state.waitlist);
                this.bus.publish('state:changed', this.state);
                return { success: true, waitlisted: true, appointment: apt };
            }
            this.state.appointments.push(apt);
            this.persistWithOfflineLog('create', 'appointments', apt, function () {
                Storage.setAppointments(App.state.appointments);
            });
            this.bus.publish('appointments:changed', this.state.appointments);
            this.bus.publish('state:changed', this.state);
            return { success: true, appointment: apt };
        },

        updateAppointment: function (aptId, updates) {
            const idx = this.state.appointments.findIndex(function (a) { return a.id === aptId; });
            if (idx < 0) {
                const wIdx = this.state.waitlist.findIndex(function (a) { return a.id === aptId; });
                if (wIdx >= 0) {
                    this.state.waitlist[wIdx] = { ...this.state.waitlist[wIdx], ...updates, updatedAt: new Date().toISOString() };
                    Storage.setWaitlist(this.state.waitlist);
                    this.bus.publish('waitlist:changed', this.state.waitlist);
                    return { success: true, appointment: this.state.waitlist[wIdx] };
                }
                return { success: false };
            }
            this.state.appointments[idx] = { ...this.state.appointments[idx], ...updates, updatedAt: new Date().toISOString() };
            this.persistWithOfflineLog('update', 'appointments', this.state.appointments[idx], function () {
                Storage.setAppointments(App.state.appointments);
            });
            this.bus.publish('appointments:changed', this.state.appointments);
            this.bus.publish('state:changed', this.state);
            return { success: true, appointment: this.state.appointments[idx] };
        },

        cancelAppointment: function (aptId) {
            const idx = this.state.appointments.findIndex(function (a) { return a.id === aptId; });
            if (idx < 0) return { success: false };
            const apt = this.state.appointments[idx];
            apt.status = Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            apt.updatedAt = new Date().toISOString();
            this.state.appointments[idx] = apt;
            this.persistWithOfflineLog('update', 'appointments', apt, function () {
                Storage.setAppointments(App.state.appointments);
            });
            this.fillFromWaitlist(apt.vetId, apt.date, apt.time);
            this.bus.publish('appointments:changed', this.state.appointments);
            this.bus.publish('state:changed', this.state);
            return { success: true };
        },

        calculateWaitlistPriority: function (apt) {
            let priority = 0;
            if (apt.type === 'surgery') priority += 50;
            if (apt.type === 'followup') priority += 30;
            if (apt.notes && apt.notes.indexOf('紧急') >= 0) priority += 100;
            const existingCount = this.state.appointments.filter(function (a) {
                return a.ownerName === apt.ownerName && a.phone === apt.phone && a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            }).length;
            priority += existingCount * 10;
            return priority + Date.now() * 0.000001;
        },

        fillFromWaitlist: function (vetId, date, time) {
            const candidates = this.state.waitlist.filter(function (w) {
                return w.vetId === vetId && w.date === date && w.status === Utils.CONSTANTS.APPOINTMENT_STATUS.WAITLIST;
            }).sort(function (a, b) { return b.waitlistPriority - a.waitlistPriority; });

            if (candidates.length === 0) return;
            const promoted = candidates[0];
            promoted.status = Utils.CONSTANTS.APPOINTMENT_STATUS.CONFIRMED;
            promoted.promotedFromWaitlist = true;
            promoted.time = time;
            promoted.updatedAt = new Date().toISOString();

            this.state.waitlist = this.state.waitlist.filter(function (w) { return w.id !== promoted.id; });
            this.state.appointments.push(promoted);
            Storage.setWaitlist(this.state.waitlist);
            Storage.setAppointments(this.state.appointments);

            this.bus.publish('appointments:changed', this.state.appointments);
            this.bus.publish('waitlist:changed', this.state.waitlist);

            Utils.showToast(promoted.ownerName + '(' + promoted.petName + ') 已从候补队列晋升至 ' + time, 'success');
        },

        addUnavailable: function (item) {
            if (!item.id) item.id = 'unavail_' + Utils.generateId();
            item.createdAt = new Date().toISOString();
            const typeLabels = { vacation: '休假', training: '培训', surgery: '手术', other: '其他' };
            item.typeLabel = typeLabels[item.type] || item.type;
            this.state.unavailable.push(item);
            this.persistWithOfflineLog('create', 'unavailable', item, function () {
                Storage.setUnavailable(App.state.unavailable);
            });
            this.bus.publish('unavailable:changed', this.state.unavailable);
            this.bus.publish('state:changed', this.state);
            return { success: true };
        },

        submitSwapRequest: function (req) {
            if (!req.id) req.id = 'swap_' + Utils.generateId();
            req.status = 'pending';
            req.createdAt = new Date().toISOString();
            this.state.swapRequests.push(req);
            this.persistWithOfflineLog('create', 'swapRequests', req, function () {
                Storage.setSwapRequests(App.state.swapRequests);
            });
            this.bus.publish('swapRequests:changed', this.state.swapRequests);
            this.bus.publish('state:changed', this.state);
            return { success: true };
        },

        approveSwapRequest: function (reqId) {
            const idx = this.state.swapRequests.findIndex(function (r) { return r.id === reqId; });
            if (idx < 0) return { success: false };
            const req = this.state.swapRequests[idx];

            const requesterShift = this.state.shifts.find(function (s) {
                return s.userId === req.requesterId && s.date === req.originalDate && s.slotId === req.originalSlot;
            });
            const targetShift = this.state.shifts.find(function (s) {
                return s.userId === req.targetId && s.date === req.targetDate && s.slotId === req.targetSlot;
            });

            const requesterVet = this.state.users.find(function (u) { return u.id === req.requesterId; });
            const targetVet = this.state.users.find(function (u) { return u.id === req.targetId; });

            if (requesterShift) {
                requesterShift.userId = req.targetId;
                requesterShift.updatedAt = new Date().toISOString();
            } else if (requesterVet) {
                this.state.shifts.push({
                    id: 'shift_' + Utils.generateId(),
                    userId: req.targetId,
                    branchId: requesterVet.branchId,
                    date: req.originalDate,
                    slotId: req.originalSlot,
                    updatedAt: new Date().toISOString()
                });
            }
            if (targetShift) {
                targetShift.userId = req.requesterId;
                targetShift.updatedAt = new Date().toISOString();
            } else if (targetVet) {
                this.state.shifts.push({
                    id: 'shift_' + Utils.generateId(),
                    userId: req.requesterId,
                    branchId: targetVet.branchId,
                    date: req.targetDate,
                    slotId: req.targetSlot,
                    updatedAt: new Date().toISOString()
                });
            }

            req.status = 'approved';
            req.approvedAt = new Date().toISOString();
            this.state.swapRequests[idx] = req;

            Storage.setSwapRequests(this.state.swapRequests);
            Storage.setShifts(this.state.shifts);
            this.bus.publish('swapRequests:changed', this.state.swapRequests);
            this.bus.publish('shifts:changed', this.state.shifts);
            this.bus.publish('state:changed', this.state);
            return { success: true };
        },

        rejectSwapRequest: function (reqId, reason) {
            const idx = this.state.swapRequests.findIndex(function (r) { return r.id === reqId; });
            if (idx < 0) return { success: false };
            this.state.swapRequests[idx].status = 'rejected';
            this.state.swapRequests[idx].rejectReason = reason;
            this.state.swapRequests[idx].rejectedAt = new Date().toISOString();
            Storage.setSwapRequests(this.state.swapRequests);
            this.bus.publish('swapRequests:changed', this.state.swapRequests);
            this.bus.publish('state:changed', this.state);
            return { success: true };
        },

        renderGlobalUI: function () {
            this.renderBranchSelect();
            this.renderRoleSelect();
            this.renderUserSelect();
            this.renderApprovalBadge();
            this.renderNotificationBadge();
            this.renderStats();
            this.renderVetSelects();
        },

        renderBranchSelect: function () {
            const $sel = $('#branchSelect');
            const options = this.state.branches.map(function (b) {
                return '<option value="' + b.id + '"' + (b.id === App.state.currentBranchId ? ' selected' : '') + '>' + Utils.escapeHtml(b.name) + '</option>';
            }).join('');
            $sel.html(options);
            const $reportSel = $('#reportBranch');
            if ($reportSel.length) {
                $reportSel.html('<option value="">全部分院</option>' + options);
            }
        },

        renderRoleSelect: function () {
            const $sel = $('#roleSelect');
            const roles = Utils.CONSTANTS.ROLES;
            const options = Object.values(roles).map(function (r) {
                return '<option value="' + r.id + '">' + r.label + '</option>';
            }).join('');
            $sel.html(options);
            if (this.state.currentRole) $sel.val(this.state.currentRole);
        },

        renderUserSelect: function () {
            const $sel = $('#userSelect');
            const role = $('#roleSelect').val();
            let users = this.state.users;
            if (role) users = users.filter(function (u) { return u.role === role; });
            const options = users.map(function (u) {
                return '<option value="' + u.id + '"' + (u.id === App.state.currentUserId ? ' selected' : '') + '>' + Utils.escapeHtml(u.name) + '</option>';
            }).join('');
            $sel.html(options);
            if (users.some(function (u) { return u.id === App.state.currentUserId; })) {
                $sel.val(App.state.currentUserId);
            } else if (users.length > 0) {
                App.setCurrentUser(users[0].id);
            }
        },

        renderApprovalBadge: function () {
            const pending = this.state.swapRequests.filter(function (r) { return r.status === 'pending'; }).length;
            const $badge = $('#approvalCount');
            if (pending > 0) {
                $badge.removeClass('d-none').text(pending);
            } else {
                $badge.addClass('d-none');
            }
        },

        renderNotificationBadge: function () {
            const pending = this.state.swapRequests.filter(function (r) { return r.status === 'pending'; }).length;
            const $badge = $('#notificationBadge');
            if (pending > 0) {
                $badge.removeClass('d-none').text(pending);
            } else {
                $badge.addClass('d-none');
            }
        },

        renderStats: function () {
            const today = Utils.formatDate(new Date());
            const branchId = this.state.currentBranchId;
            const onDuty = this.state.shifts.filter(function (s) { return s.date === today && s.branchId === branchId; }).length;
            const aptCount = this.state.appointments.filter(function (a) {
                return a.date === today && a.branchId === branchId && a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            }).length;
            const wlCount = this.state.waitlist.filter(function (w) { return w.branchId === branchId; }).length;

            $('#statOnDuty').text(onDuty);
            $('#statAppointments').text(aptCount);
            $('#statWaitlist').text(wlCount);
            $('#waitlistCount').text(wlCount);
        },

        renderVetSelects: function () {
            const vets = this.getBranchVets();
            const options = vets.map(function (v) {
                const qual = Utils.getQualificationById(v.qualification);
                return '<option value="' + v.id + '">' + Utils.escapeHtml(v.name) + (qual ? ' (' + qual.label + ')' : '') + '</option>';
            }).join('');
            $('#aptVet').html(options);
            const fvOptions = '<option value="">全部兽医</option>' + options;
            $('#filterVet').html(fvOptions);
        },

        bindGlobalEvents: function () {
            const self = this;

            $('#branchSelect').on('change', function () {
                self.setCurrentBranch($(this).val());
            });
            $('#roleSelect').on('change', function () {
                self.renderUserSelect();
            });
            $('#userSelect').on('change', function () {
                self.setCurrentUser($(this).val());
            });
            $('#notificationBell').on('click', function () {
                const pending = self.state.swapRequests.filter(function (r) { return r.status === 'pending'; });
                if (pending.length > 0) {
                    Utils.showToast('您有 ' + pending.length + ' 条换班审批待处理', 'info');
                    const triggerEl = document.querySelector('#approvalTab');
                    bootstrap.Tab.getOrCreateInstance(triggerEl).show();
                } else {
                    Utils.showToast('暂无待处理通知', 'info');
                }
            });

            this.bus.subscribe('state:changed', function () {
                self.renderStats();
                self.renderApprovalBadge();
                self.renderNotificationBadge();
            });
        },

        getUserById: function (id) {
            return this.state.users.find(function (u) { return u.id === id; });
        },

        getBranchById: function (id) {
            return this.state.branches.find(function (b) { return b.id === id; });
        }
    };

    global.App = App;

    $(function () {
        App.init();
    });

})(window);
