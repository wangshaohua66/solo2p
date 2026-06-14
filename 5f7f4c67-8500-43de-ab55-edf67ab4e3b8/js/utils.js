(function (global) {
    'use strict';

    const Utils = {};

    Utils.CONSTANTS = {
        TIME_SLOTS: [
            { id: 'morning', label: '早班', start: '08:00', end: '12:00', hours: 4 },
            { id: 'afternoon', label: '午班', start: '13:00', end: '17:00', hours: 4 },
            { id: 'evening', label: '晚班', start: '17:00', end: '21:00', hours: 4 }
        ],
        APPOINTMENT_SLOTS: [
            '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
            '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
            '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
            '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'
        ],
        ROLES: {
            DIRECTOR: { id: 'director', label: '分院院长', permissions: ['all'] },
            VET: { id: 'vet', label: '执业兽医', permissions: ['view_schedule', 'swap_shift', 'mark_unavailable', 'view_own_appointments'] },
            RECEPTIONIST: { id: 'receptionist', label: '前台接待', permissions: ['view_schedule', 'manage_appointments', 'manage_waitlist'] },
            ASSISTANT: { id: 'assistant', label: '兽医助理', permissions: ['view_schedule', 'view_tasks'] }
        },
        QUALIFICATIONS: {
            CHIEF_VET: { id: 'chief_vet', label: '主任医师', color: 'danger', maxAppointmentsPerSlot: 2 },
            SENIOR_VET: { id: 'senior_vet', label: '副主任医师', color: 'warning', maxAppointmentsPerSlot: 2 },
            VET: { id: 'vet', label: '执业兽医师', color: 'primary', maxAppointmentsPerSlot: 1 },
            ASSOCIATE_VET: { id: 'associate_vet', label: '助理兽医师', color: 'info', maxAppointmentsPerSlot: 1 }
        },
        APPOINTMENT_STATUS: {
            CONFIRMED: 'confirmed',
            COMPLETED: 'completed',
            CANCELLED: 'cancelled',
            WAITLIST: 'waitlist'
        },
        APPOINTMENT_TYPES: {
            first: '首次就诊',
            followup: '复诊',
            checkup: '体检',
            vaccine: '疫苗',
            surgery: '手术'
        },
        SHIFT_RULES: {
            MAX_CONSECUTIVE_DAYS: 6,
            MIN_REST_HOURS: 12,
            CROSS_BRANCH_MIN_INTERVAL_HOURS: 8,
            MAX_APPOINTMENTS_PER_SLOT: 1
        },
        STORAGE_KEYS: {
            BRANCHES: 'vet_clinic_branches',
            USERS: 'vet_clinic_users',
            SHIFTS: 'vet_clinic_shifts',
            APPOINTMENTS: 'vet_clinic_appointments',
            WAITLIST: 'vet_clinic_waitlist',
            UNAVAILABLE: 'vet_clinic_unavailable',
            SWAP_REQUESTS: 'vet_clinic_swap_requests',
            OFFLINE_LOG: 'vet_clinic_offline_log',
            VERSION: 'vet_clinic_version',
            SETTINGS: 'vet_clinic_settings'
        },
        CURRENT_VERSION: '1.0.0',
        DAYS_OF_WEEK: ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    };

    Utils.formatDate = function (date, format) {
        format = format || 'YYYY-MM-DD';
        return moment(date).format(format);
    };

    Utils.formatDateTime = function (date) {
        return moment(date).format('YYYY-MM-DD HH:mm');
    };

    Utils.formatTime = function (date) {
        return moment(date).format('HH:mm');
    };

    Utils.parseDate = function (str) {
        return moment(str, 'YYYY-MM-DD').toDate();
    };

    Utils.getStartOfWeek = function (date) {
        return moment(date).startOf('week').toDate();
    };

    Utils.getEndOfWeek = function (date) {
        return moment(date).endOf('week').toDate();
    };

    Utils.getStartOfMonth = function (date) {
        return moment(date).startOf('month').toDate();
    };

    Utils.getEndOfMonth = function (date) {
        return moment(date).endOf('month').toDate();
    };

    Utils.addDays = function (date, days) {
        return moment(date).add(days, 'days').toDate();
    };

    Utils.diffDays = function (date1, date2) {
        return moment(date1).startOf('day').diff(moment(date2).startOf('day'), 'days');
    };

    Utils.diffHours = function (datetime1, datetime2) {
        return moment(datetime1).diff(moment(datetime2), 'hours', true);
    };

    Utils.isSameDay = function (date1, date2) {
        return moment(date1).isSame(date2, 'day');
    };

    Utils.isToday = function (date) {
        return moment(date).isSame(moment(), 'day');
    };

    Utils.isPast = function (date) {
        return moment(date).isBefore(moment(), 'day');
    };

    Utils.isFuture = function (date) {
        return moment(date).isAfter(moment(), 'day');
    };

    Utils.getWeekDates = function (baseDate) {
        const start = Utils.getStartOfWeek(baseDate);
        const dates = [];
        for (let i = 0; i < 7; i++) {
            dates.push(Utils.addDays(start, i));
        }
        return dates;
    };

    Utils.getDayOfWeek = function (date) {
        return moment(date).day();
    };

    Utils.getDayOfWeekLabel = function (date) {
        return Utils.CONSTANTS.DAYS_OF_WEEK[Utils.getDayOfWeek(date)];
    };

    Utils.generateId = function () {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    };

    Utils.formatCurrency = function (amount) {
        return '¥' + Number(amount).toFixed(2);
    };

    Utils.escapeHtml = function (str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    Utils.showToast = function (message, type, duration) {
        type = type || 'info';
        duration = duration || 3000;
        const bgClass = {
            success: 'bg-success',
            danger: 'bg-danger',
            warning: 'bg-warning text-dark',
            info: 'bg-info',
            primary: 'bg-primary'
        }[type] || 'bg-secondary';

        const iconClass = {
            success: 'bi-check-circle-fill',
            danger: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill',
            primary: 'bi-info-circle-fill'
        }[type] || 'bi-info-circle-fill';

        const toastId = 'toast_' + Utils.generateId();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center">
                        <i class="bi ${iconClass} me-2"></i>
                        <span>${Utils.escapeHtml(message)}</span>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        $('#toastContainer').append(toastHtml);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: duration });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', function () {
            $('#' + toastId).remove();
        });
    };

    Utils.confirmDialog = function (message, title) {
        return new Promise(function (resolve) {
            title = title || '确认操作';
            const modalId = 'confirm_' + Utils.generateId();
            const modalHtml = `
                <div class="modal fade" id="${modalId}" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content bg-dark border-secondary">
                            <div class="modal-header border-secondary">
                                <h5 class="modal-title fw-bold">${Utils.escapeHtml(title)}</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>${Utils.escapeHtml(message)}</p>
                            </div>
                            <div class="modal-footer border-secondary">
                                <button type="button" class="btn btn-secondary" data-confirm="false">取消</button>
                                <button type="button" class="btn btn-primary" data-confirm="true">确认</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            $('body').append(modalHtml);
            const modalEl = document.getElementById(modalId);
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            $(modalEl).find('[data-confirm]').on('click', function () {
                const result = $(this).data('confirm') === true;
                modal.hide();
                $(modalEl).on('hidden.bs.modal', function () {
                    $('#' + modalId).remove();
                    resolve(result);
                });
            });
        });
    };

    Utils.getTimeSlotById = function (slotId) {
        return Utils.CONSTANTS.TIME_SLOTS.find(function (s) { return s.id === slotId; });
    };

    Utils.getTimeSlotByTime = function (time) {
        const minutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
        for (let i = 0; i < Utils.CONSTANTS.TIME_SLOTS.length; i++) {
            const slot = Utils.CONSTANTS.TIME_SLOTS[i];
            const startMin = parseInt(slot.start.split(':')[0]) * 60 + parseInt(slot.start.split(':')[1]);
            const endMin = parseInt(slot.end.split(':')[0]) * 60 + parseInt(slot.end.split(':')[1]);
            if (minutes >= startMin && minutes < endMin) {
                return slot;
            }
        }
        return null;
    };

    Utils.getQualificationById = function (qualId) {
        const q = Utils.CONSTANTS.QUALIFICATIONS;
        for (let key in q) {
            if (q[key].id === qualId) return q[key];
        }
        return null;
    };

    Utils.getQualificationBadgeClass = function (qualId) {
        const qual = Utils.getQualificationById(qualId);
        if (!qual) return 'bg-secondary';
        return 'bg-' + qual.color;
    };

    Utils.deepClone = function (obj) {
        return JSON.parse(JSON.stringify(obj));
    };

    Utils.groupBy = function (array, key) {
        return array.reduce(function (groups, item) {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(item);
            return groups;
        }, {});
    };

    Utils.sortBy = function (array, key, ascending) {
        ascending = ascending !== false;
        return array.slice().sort(function (a, b) {
            const va = typeof key === 'function' ? key(a) : a[key];
            const vb = typeof key === 'function' ? key(b) : b[key];
            if (va < vb) return ascending ? -1 : 1;
            if (va > vb) return ascending ? 1 : -1;
            return 0;
        });
    };

    Utils.unique = function (array) {
        return [...new Set(array)];
    };

    Utils.chunk = function (array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };

    Utils.debounce = function (fn, delay) {
        let timer = null;
        return function () {
            const args = arguments;
            const context = this;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    };

    Utils.throttle = function (fn, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                fn.apply(context, args);
                inThrottle = true;
                setTimeout(function () { return inThrottle = false; }, limit);
            }
        };
    };

    global.Utils = Utils;

})(window);
