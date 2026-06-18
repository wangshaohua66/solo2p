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

  /** 将后端时间（字符串或 Jackson LocalDateTime 数组）解析为 Date */
  parseDateTime(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (Array.isArray(v)) {
      const [y, mo, d, h = 0, mi = 0, s = 0] = v;
      return new Date(y, (mo || 1) - 1, d || 1, h, mi, s);
    }
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})([T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[5] || 0), +(m[6] || 0), +(m[7] || 0));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  },

  /** 相对时间（x分钟前 / x小时前 / x天前），超过7天返回日期 */
  formatRelativeTime(v) {
    const d = this.parseDateTime(v);
    if (!d) return '-';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + '天前';
    return this.formatDate(d, 'YYYY-MM-DD');
  },

  /** 格式化日期时间（兼容字符串/数组），默认 YYYY-MM-DD HH:mm:ss */
  formatDateTime(v, fmt = 'YYYY-MM-DD HH:mm:ss') {
    const d = this.parseDateTime(v);
    return d ? this.formatDate(d, fmt) : '-';
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
  },

  applyResponsiveColumns() {
    const w = $(window).width();
    const rules = [
      { break: 1400, hide: '.col-hide-xxl' },
      { break: 1200, hide: '.col-hide-xl' },
      { break: 992,  hide: '.col-hide-lg' },
      { break: 768,  hide: '.col-hide-md' },
      { break: 576,  hide: '.col-hide-sm' }
    ];
    rules.forEach(r => {
      if (w < r.break) $(r.hide).hide();
      else $(r.hide).show();
    });
  },

  renderAnnotations(reportId, annotations) {
    const list = annotations || [];
    if (list.length === 0) return `<div style="padding:30px;text-align:center;color:var(--gray-400);"><div style="font-size:36px;">💬</div><div style="margin-top:8px;">暂无批注</div></div>`;
    const typeIcon = { comment: '💬', highlight: '🖍️', stamp: '🖋️' };
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-weight:600;">批注列表 (${list.length})</div>
          <button class="btn btn-sm btn-primary" onclick="ReportsPage.addAnnotationPrompt('${reportId}')">➕ 添加批注</button>
        </div>
        <div style="max-height:320px;overflow-y:auto;">
          ${list.map(a => `
            <div style="padding:12px;border-radius:8px;margin-bottom:10px;background:rgba(245,158,11,0.08);border-left:3px solid ${a.color || '#f59e0b'};">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
                <div style="font-weight:600;font-size:13px;">${typeIcon[a.annotationType] || typeIcon[a.type] || '📝'} ${a.annotatorName || a.annotator || '-'} · 第${a.pageNo || a.page || 1}页</div>
                <div style="font-size:11px;color:var(--gray-400);">${a.createTime || a.time || ''}</div>
              </div>
              <div style="font-size:13px;color:var(--gray-700);line-height:1.6;">${a.content || a.annotationContent || ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /** 渲染加载占位 */
  renderLoading() {
    return `<div class="empty-state"><div class="empty-state-icon" style="animation:spin 1s linear infinite;display:inline-block;">⏳</div><div class="empty-state-text">数据加载中...</div></div>`;
  },

  /** 渲染空状态 */
  renderEmpty(text) {
    return `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">${text || '暂无数据'}</div></div>`;
  }
};
