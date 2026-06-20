const AppCommon = {
    apiBaseUrl: '/api',

    ajax(options) {
        return $.ajax({
            ...options,
            error: function(xhr, status, error) {
                console.error('API Error:', error);
                if (xhr.responseJSON?.message) {
                    AppCommon.showAlert(xhr.responseJSON.message, 'danger');
                } else {
                    AppCommon.showAlert('请求失败，请稍后重试', 'danger');
                }
                if (options.error) options.error(xhr, status, error);
            }
        });
    },

    get(url, data = {}) {
        return this.ajax({
            url: this.apiBaseUrl + url,
            method: 'GET',
            data: data
        });
    },

    post(url, data = {}) {
        return this.ajax({
            url: this.apiBaseUrl + url,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data)
        });
    },

    put(url, data = {}) {
        return this.ajax({
            url: this.apiBaseUrl + url,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(data)
        });
    },

    delete(url) {
        return this.ajax({
            url: this.apiBaseUrl + url,
            method: 'DELETE'
        });
    },

    uploadFile(url, formData) {
        return $.ajax({
            url: this.apiBaseUrl + url,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            error: function(xhr) {
                if (xhr.responseJSON?.message) {
                    AppCommon.showAlert(xhr.responseJSON.message, 'danger');
                } else {
                    AppCommon.showAlert('上传失败', 'danger');
                }
            }
        });
    },

    showAlert(message, type = 'info', duration = 3000) {
        const alertId = 'alert-' + Date.now();
        const icons = {
            success: 'bi-check-circle-fill',
            danger: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };
        const icon = icons[type] || icons.info;
        
        const alertHtml = `
            <div id="${alertId}" class="alert alert-float alert-${type} d-flex align-items-center" role="alert">
                <i class="bi ${icon} me-2 fs-5"></i>
                <div>${message}</div>
            </div>
        `;
        $('body').append(alertHtml);
        
        if (duration > 0) {
            setTimeout(() => {
                $(`#${alertId}`).fadeOut(300, function() {
                    $(this).remove();
                });
            }, duration);
        }
        
        return alertId;
    },

    showConfirm(title, message, onConfirm) {
        const modalId = 'confirm-modal-' + Date.now();
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title fw-bold">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body py-3">
                            <p class="mb-0">${message}</p>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary btn-confirm">确认</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
        
        $(`#${modalId} .btn-confirm`).on('click', function() {
            modal.hide();
            onConfirm && onConfirm();
            setTimeout(() => $(`#${modalId}`).remove(), 300);
        });
        
        $(`#${modalId}`).on('hidden.bs.modal', function() {
            setTimeout(() => $(this).remove(), 300);
        });
    },

    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    formatTime(hour, minute = 0) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    },

    getLevelColor(levelId) {
        const colors = { 1: 'info', 2: 'success', 3: 'warning', 4: 'danger' };
        return colors[levelId] || 'secondary';
    },

    getLevelName(levelId) {
        const names = { 1: '初级消防员', 2: '中级消防员', 3: '高级消防员', 4: '消防指挥员' };
        return names[levelId] || '未知';
    },

    getSpecialtyName(specialtyId) {
        const names = { 1: '灭火救援', 2: '危化品处置', 3: '高层建筑救援', 4: '水域救援', 5: '地震搜救' };
        return names[specialtyId] || '未知';
    },

    getQuestionTypeName(type) {
        const names = { single: '单选题', multiple: '多选题', judge: '判断题', scenario: '情景分析' };
        return names[type] || type;
    },

    getDifficultyName(level) {
        const names = { 1: '简单', 2: '中等', 3: '困难' };
        return names[level] || '未知';
    },

    getDifficultyColor(level) {
        const colors = { 1: 'success', 2: 'warning', 3: 'danger' };
        return colors[level] || 'secondary';
    },

    debounce(fn, delay = 300) {
        let timer = null;
        return function(...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    getWeekDates(baseDate = new Date()) {
        const dates = [];
        const day = baseDate.getDay();
        const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(baseDate);
        monday.setDate(diff);
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d);
        }
        return dates;
    },

    getDayName(dayIndex) {
        const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        return names[dayIndex] || '';
    }
};
