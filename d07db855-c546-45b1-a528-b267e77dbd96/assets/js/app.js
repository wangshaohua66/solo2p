const AppLayout = {
  currentPage: 'dashboard',
  notifications: [],

  init() {
    if (!Auth.requireAuth()) return;
    this.renderSidebar();
    this.renderHeader();
    this.bindEvents();
    PageRouter.go(this.currentPage);
  },

  renderSidebar() {
    const $sidebar = $('#sidebar');
    const user = Auth.getCurrentUser();
    if (!user) { Auth.showLogin(); return; }
    const roleKey = user.roleKey;
    let html = `
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">⚖️</div>
          <span class="sidebar-logo-text">检验检测认证中心</span>
        </div>
      </div>
      <div class="sidebar-menu">
    `;

    UI_CONST.menuConfig.forEach(group => {
      if (group.roleKeys && !group.roleKeys.includes(roleKey)) return;
      const visibleItems = group.items.filter(it => !it.roleKeys || it.roleKeys.includes(roleKey));
      if (visibleItems.length === 0) return;
      html += `<div class="menu-group-title">${group.group}</div>`;
      visibleItems.forEach(item => {
        const badge = item.badge ? `<span class="menu-item-badge">${item.badge}</span>` : '';
        html += `
          <div class="menu-item ${this.currentPage === item.key ? 'active' : ''}" data-page="${item.key}">
            <span class="menu-item-icon">${item.icon}</span>
            <span class="menu-item-text">${item.text}</span>
            ${badge}
          </div>
        `;
      });
    });

    html += '</div>';
    $sidebar.html(html);
  },

  renderHeader() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const html = `
      <button class="header-toggle" id="sidebarToggle">☰</button>
      <div class="header-search">
        <span class="header-search-icon">🔍</span>
        <input type="text" class="header-search-input" placeholder="搜索样品编号、报告、证书、企业名称...">
      </div>
      <div class="header-actions">
        <button class="header-action-btn" id="notificationBtn" title="消息通知">
          🔔
          <span class="header-action-dot" id="notifDot" style="display:none;"></span>
        </button>
        <button class="header-action-btn" title="帮助中心">❓</button>
        <div class="header-user" id="userMenu">
          <div class="header-avatar">${user.avatar}</div>
          <div class="header-user-info">
            <div class="header-user-name">${user.name}</div>
            <div class="header-user-role">${user.role}</div>
          </div>
        </div>
      </div>
    `;
    $('#header').html(html);
    this.loadNotifications();
  },

  async loadNotifications() {
    try {
      const list = await ApiClient.task.unreadNotifications();
      this.notifications = (list || []).map(n => ({
        id: n.id,
        title: n.title || '系统通知',
        content: n.content || '',
        time: AppUtils.formatRelativeTime(n.createTime),
        type: this.notifType(n),
        rawType: n.notificationType,
        read: n.isRead === 1
      }));
      const unread = this.notifications.length;
      $('#notifDot').toggle(unread > 0);
    } catch (e) {
      this.notifications = [];
      $('#notifDot').hide();
    }
  },

  notifType(n) {
    const t = (n.notificationType || '').toUpperCase();
    const p = (n.priority || '').toUpperCase();
    if (t.includes('OVERDUE') || p === 'HIGH' || t.includes('WARNING')) return 'warning';
    if (t.includes('EXPIRE') || t.includes('CERT')) return 'info';
    if (t.includes('SUCCESS') || t.includes('ISSUE')) return 'success';
    return 'info';
  },

  bindEvents() {
    const self = this;

    $('#sidebarToggle').on('click', () => {
      if ($(window).width() <= 768) {
        $('#sidebar').toggleClass('mobile-open');
      } else {
        $('#sidebar').toggleClass('collapsed');
      }
    });

    $(document).on('click', '.menu-item', function() {
      const page = $(this).data('page');
      self.goToPage(page);
      if ($(window).width() <= 768) {
        $('#sidebar').removeClass('mobile-open');
      }
    });

    $(document).on('click', '#notificationBtn', () => {
      this.showNotifications();
    });

    $(document).on('keypress', '.header-search-input', function(e) {
      if (e.which === 13) {
        const keyword = $(this).val().trim();
        if (keyword) {
          AppUtils.showToast('搜索', `正在搜索: ${keyword}`, 'success');
        }
      }
    });

    $(document).on('click', '#userMenu', () => {
      this.showUserMenu();
    });
  },

  showUserMenu() {
    const user = Auth.getCurrentUser();
    if (!user) { Auth.showLogin(); return; }
    const rolesHtml = Object.keys(UI_CONST.roleMeta).map(k => {
      const isActive = k === user.roleKey;
      const r = UI_CONST.roleMeta[k];
      return `
        <div style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;
                    ${isActive ? 'background:rgba(37,99,235,0.08);' : ''}"
             onmouseover="this.style.background='var(--gray-50)'"
             onmouseout="this.style.background='${isActive ? 'rgba(37,99,235,0.08)' : ''}'"
             onclick="AppLayout.switchRole('${k}')">
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--dark);">${r.name}</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px;">${r.desc}</div>
          </div>
          ${isActive ? '<span style="color:var(--primary);">✓</span>' : ''}
        </div>
      `;
    }).join('');
    AppUtils.showModal({
      title: `👤 ${user.name}`,
      content: `
        <div style="margin:-20px -20px 0 -20px;">
          <div style="padding:14px 20px;border-bottom:1px solid var(--gray-200);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:44px;height:44px;border-radius:50%;background:var(--primary);color:#fff;
                          display:flex;align-items:center;justify-content:center;font-weight:600;font-size:18px;">${user.avatar}</div>
              <div>
                <div style="font-weight:600;">${user.name}</div>
                <div style="font-size:12px;color:var(--gray-500);">${user.department || user.role}</div>
              </div>
            </div>
          </div>
          <div style="padding:6px 0;">${rolesHtml}</div>
          <div style="padding:12px 20px;border-top:1px solid var(--gray-200);">
            <button class="btn btn-outline-danger btn-sm" onclick="Auth.logout()">🚪 退出登录</button>
          </div>
        </div>
      `,
      width: '420px',
      confirmText: null,
      cancelText: '关闭'
    });
  },

  switchRole(roleKey) {
    $('.modal-overlay, .modal-mask').remove();
    AppUtils.showToast('切换角色', '切换角色需重新登录，请在登录页选择对应用户', 'warning');
    Auth.logout();
  },

  goToPage(page) {
    this.currentPage = page;
    $('.menu-item').removeClass('active');
    $(`.menu-item[data-page="${page}"]`).addClass('active');
    PageRouter.go(page);
  },

  setPageHeader(title, breadcrumb = []) {
    const bc = ['首页', ...breadcrumb].join(' / ');
    $('#pageHeader').html(`
      <div>
        <h1 class="page-title">${title}</h1>
        <div class="page-breadcrumb">${bc}</div>
      </div>
    `);
  },

  showNotifications() {
    let listHtml = '';
    if (this.notifications.length === 0) {
      listHtml = `<div style="padding:40px;text-align:center;color:var(--gray-400);"><div style="font-size:36px;">🔕</div><div style="margin-top:8px;">暂无未读通知</div></div>`;
    } else {
      const icons = { warning: '⚠️', info: 'ℹ️', success: '✅', error: '❌' };
      listHtml = this.notifications.map(n => `
        <div style="padding:14px;border-bottom:1px solid var(--gray-100);cursor:pointer;${n.read ? 'opacity:0.7' : ''}"
             onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="font-size:18px;">${icons[n.type] || '📌'}</span>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:14px;color:var(--dark);">${n.title}</div>
              <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">${n.content}</div>
              <div style="font-size:12px;color:var(--gray-400);margin-top:6px;">${n.time}</div>
            </div>
            ${!n.read ? '<span style="width:8px;height:8px;background:var(--danger);border-radius:50%;"></span>' : ''}
          </div>
        </div>
      `).join('');
    }

    AppUtils.showModal({
      title: '🔔 消息通知',
      content: `<div style="margin:-20px;">${listHtml}</div>`,
      width: '480px',
      confirmText: '全部已读',
      cancelText: '关闭',
      onConfirm: async () => {
        try {
          for (const n of this.notifications) {
            if (!n.read) await ApiClient.task.markRead(n.id);
          }
          this.notifications = [];
          $('#notifDot').hide();
          AppUtils.showToast('成功', '已全部标记为已读', 'success');
        } catch (e) {
          ApiClient.handleError(e, '标记已读失败');
        }
      }
    });
  }
};

const PageRouter = {
  routes: {
    dashboard: DashboardPage,
    todo: TodoPage,
    samples: SamplesPage,
    tasks: TasksPage,
    reports: ReportsPage,
    customers: CustomersPage,
    lab: LabPage,
    trace: TracePage,
    analytics: AnalyticsPage
  },

  go(page) {
    const handler = this.routes[page];
    if (handler && handler.render) {
      handler.render();
    } else {
      $('#pageContent').html('<div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-text">页面开发中...</div></div>');
    }
  }
};

$(document).ready(() => {
  AppLayout.init();
  AppUtils.applyResponsiveColumns();
  $(window).on('resize', AppUtils.debounce(() => AppUtils.applyResponsiveColumns(), 150));
});
