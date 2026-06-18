const AppUtils = {
  formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  formatMoney(num) {
    return '¥' + Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  },

  generateId(prefix = 'ID') {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6).toUpperCase();
  },

  showToast(title, message, type = 'success') {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '!'
    };
    const toast = $(`
      <div class="toast ${type}">
        <div class="toast-icon">${icons[type] || icons.success}</div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-msg">${message}</div>
        </div>
      </div>
    `);
    $('body').append(toast);
    setTimeout(() => {
      toast.fadeOut(300, () => toast.remove());
    }, 3000);
  },

  showModal(options) {
    const { title, content, onConfirm, onCancel, confirmText = '确认', cancelText = '取消', width } = options;
    const mask = $(`
      <div class="modal-mask show">
        <div class="modal" ${width ? `style="max-width:${width}"` : ''}>
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">${content}</div>
          <div class="modal-footer">
            <button class="btn btn-outline-primary modal-cancel">${cancelText}</button>
            <button class="btn btn-primary modal-confirm">${confirmText}</button>
          </div>
        </div>
      </div>
    `);
    $('body').append(mask);
    
    mask.find('.modal-close, .modal-cancel').on('click', () => {
      mask.removeClass('show');
      setTimeout(() => mask.remove(), 200);
      if (onCancel) onCancel();
    });
    
    mask.find('.modal-confirm').on('click', () => {
      if (onConfirm) {
        const result = onConfirm();
        if (result !== false) {
          mask.removeClass('show');
          setTimeout(() => mask.remove(), 200);
        }
      } else {
        mask.removeClass('show');
        setTimeout(() => mask.remove(), 200);
      }
    });
    
    mask.on('click', (e) => {
      if ($(e.target).hasClass('modal-mask')) {
        mask.removeClass('show');
        setTimeout(() => mask.remove(), 200);
        if (onCancel) onCancel();
      }
    });
    
    return mask;
  },

  closeModal($mask) {
    if ($mask && $mask.length) {
      $mask.removeClass('show');
      setTimeout(() => $mask.remove(), 200);
    } else {
      $('.modal-mask').removeClass('show');
      setTimeout(() => $('.modal-mask').remove(), 200);
    }
  },

  getAvatarColor(name) {
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  },

  getAvatar(name) {
    const color = this.getAvatarColor(name);
    const initial = name.charAt(0).toUpperCase();
    return `<span class="avatar-sm" style="background:${color}">${initial}</span>`;
  },

  getStatusBadge(status) {
    const map = {
      pending: { class: 'badge-warning', text: '待处理' },
      processing: { class: 'badge-primary', text: '处理中' },
      completed: { class: 'badge-success', text: '已完成' },
      cancelled: { class: 'badge-secondary', text: '已取消' },
      overdue: { class: 'badge-danger', text: '已超期' }
    };
    const s = map[status] || map.pending;
    return `<span class="badge ${s.class}">${s.text}</span>`;
  },

  getSampleStatusBadge(status) {
    const map = {
      received: { class: 'badge-info', text: '已接收' },
      registered: { class: 'badge-primary', text: '已登记' },
      testing: { class: 'badge-warning', text: '检测中' },
      reported: { class: 'badge-primary', text: '报告中' },
      certified: { class: 'badge-success', text: '已发证' },
      archived: { class: 'badge-secondary', text: '已归档' },
      destroyed: { class: 'badge-danger', text: '已销毁' }
    };
    const s = map[status] || map.received;
    return `<span class="badge ${s.class}">${s.text}</span>`;
  },

  debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};
