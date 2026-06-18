const AppLayout = {
  currentPage: 'dashboard',

  init() {
    this.renderSidebar();
    this.renderHeader();
    this.bindEvents();
    PageRouter.go(this.currentPage);
  },

  renderSidebar() {
    const $sidebar = $('#sidebar');
    let html = `
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">⚖️</div>
          <span class="sidebar-logo-text">检验检测认证中心</span>
        </div>
      </div>
      <div class="sidebar-menu">
    `;

    MockData.menuConfig.forEach(group => {
      html += `<div class="menu-group-title">${group.group}</div>`;
      group.items.forEach(item => {
        html += `
          <div class="menu-item ${this.currentPage === item.key ? 'active' : ''}" data-page="${item.key}">
            <span class="menu-item-icon">${item.icon}</span>
            <span class="menu-item-text">${item.text}</span>
            ${item.badge ? `<span class="menu-item-badge">${item.badge}</span>` : ''}
          </div>
        `;
      });
    });

    html += '</div>';
    $sidebar.html(html);
  },

  renderHeader() {
    const unreadCount = MockData.notifications.filter(n => !n.read).length;
    const user = MockData.currentUser;
    const html = `
      <button class="header-toggle" id="sidebarToggle">☰</button>
      <div class="header-search">
        <span class="header-search-icon">🔍</span>
        <input type="text" class="header-search-input" placeholder="搜索样品编号、报告、证书、企业名称...">
      </div>
      <div class="header-actions">
        <button class="header-action-btn" id="notificationBtn" title="消息通知">
          🔔
          ${unreadCount > 0 ? '<span class="header-action-dot"></span>' : ''}
        </button>
        <button class="header-action-btn" title="帮助中心">
          ❓
        </button>
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
    MockData.notifications.forEach(n => {
      const icons = { warning: '⚠️', info: 'ℹ️', success: '✅', error: '❌' };
      listHtml += `
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
      `;
    });

    AppUtils.showModal({
      title: '🔔 消息通知',
      content: `<div style="margin:-20px;">${listHtml}</div>`,
      width: '480px',
      confirmText: '全部已读',
      cancelText: '关闭',
      onConfirm: () => {
        MockData.notifications.forEach(n => n.read = true);
        this.renderHeader();
        AppUtils.showToast('成功', '已全部标记为已读', 'success');
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
});
