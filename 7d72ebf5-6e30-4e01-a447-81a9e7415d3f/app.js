const App = {
  eventBus: null,
  stateManager: null,
  currentComponent: null,
  currentPage: null,
  currentRole: null,

  citizenNavItems: [
    { id: 'home', name: '首页', icon: 'fa-home' },
    { id: 'guide', name: '智能导办', icon: 'fa-compass' },
    { id: 'appointment', name: '在线预约', icon: 'fa-calendar-check-o' },
    { id: 'queue', name: '实时排队', icon: 'fa-list-ol' },
    { id: 'progress', name: '办理进度', icon: 'fa-clock-o' },
    { id: 'selfservice', name: '自助终端', icon: 'fa-desktop' },
    { id: 'evaluation', name: '满意度评价', icon: 'fa-star' }
  ],

  staffNavItems: [
    { id: 'window', name: '窗口工作台', icon: 'fa-tasks' }
  ],

  adminNavItems: [
    { id: 'dashboard', name: '数据看板', icon: 'fa-tachometer' }
  ],

  roleLabels: {
    citizen: '办事群众',
    staff: '窗口工作人员',
    admin: '系统管理员'
  },

  init() {
    this.eventBus = new EventBus();
    this.stateManager = new StateManager(this.eventBus);
    window.eventBus = this.eventBus;
    window.stateManager = this.stateManager;

    QueueService.init(this.eventBus);
    this.bindGlobalEvents();
    this.setupEventListeners();

    const savedRole = Storage.get('currentRole');
    if (savedRole) {
      this.selectRole(savedRole);
    }

    console.log('[App] 政务服务中心智能导办系统已启动');
  },

  bindGlobalEvents() {
    $(document).on('click', '[data-navigate]', (e) => {
      const page = $(e.currentTarget).data('navigate');
      this.navigate(page);
    });
  },

  setupEventListeners() {
    this.eventBus.on('role:changed', (role) => {
      this.currentRole = role;
      this.stateManager.setState('currentRole', role);
      Storage.set('currentRole', role);
      this.updateNavbar();
      this.showMainContent();
      this.navigate(this.getDefaultPage());
    });

    this.eventBus.on('page:navigate', (page) => {
      this.navigate(page);
    });

    this.eventBus.on('queue:call', (data) => {
      this.showCallToast(data);
      this.playNotification();
    });

    this.eventBus.on('appointment:created', (data) => {
      this.showAppointmentNotification(data);
    });

    this.eventBus.on('satisfaction:submitted', () => {
      this.showNotification('感谢您的评价', '您的反馈是我们改进的动力', 'success');
    });

    this.eventBus.on('window:call', (data) => {
      this.showNotification('叫号成功', `当前叫号：${data.number}`, 'info');
    });

    this.eventBus.on('window:complete', () => {
      this.showNotification('办理完成', '请提醒办事群众进行评价', 'success');
    });

    this.eventBus.on('appointment:start', (data) => {
      this.stateManager.setState('selectedItem', data.itemId || data);
      this.stateManager.setState('selectedItemData', data);
      this.navigate('appointment');
    });

    this.eventBus.on('search:query', (keyword) => {
      this.navigate('guide');
    });

    this.stateManager.subscribe('currentPage', (page) => {
      this.currentPage = page;
      this.updateNavActive();
    });

    this.stateManager.subscribe('currentRole', (role) => {
      $('#user-role-label').text(role ? this.roleLabels[role] : '请选择角色');
    });
  },

  selectRole(role) {
    this.eventBus.emit('role:changed', role);
  },

  getDefaultPage() {
    switch (this.currentRole) {
      case 'citizen': return 'home';
      case 'staff': return 'window';
      case 'admin': return 'dashboard';
      default: return 'home';
    }
  },

  getNavItems() {
    switch (this.currentRole) {
      case 'citizen': return this.citizenNavItems;
      case 'staff': return this.staffNavItems;
      case 'admin': return this.adminNavItems;
      default: return [];
    }
  },

  updateNavbar() {
    const navItems = this.getNavItems();
    const $navItems = $('#nav-items');
    $navItems.empty();

    navItems.forEach(item => {
      const $li = $('<li>', { class: 'nav-item' });
      const $a = $('<a>', {
        class: 'nav-link',
        href: 'javascript:void(0)',
        'data-page': item.id,
        html: `<i class="fa ${item.icon}"></i> ${item.name}`
      });
      $a.on('click', () => this.navigate(item.id));
      $li.append($a);
      $navItems.append($li);
    });

    if (this.currentRole) {
      const $logoutLi = $('<li>', { class: 'nav-item' });
      const $logoutA = $('<a>', {
        class: 'nav-link',
        href: 'javascript:void(0)',
        html: '<i class="fa fa-sign-out"></i> 退出'
      });
      $logoutA.on('click', () => this.logout());
      $logoutLi.append($logoutA);
      $navItems.append($logoutLi);
    }
  },

  updateNavActive() {
    $('.nav-link').removeClass('active');
    $(`.nav-link[data-page="${this.currentPage}"]`).addClass('active');
    $('.bottom-nav-item').removeClass('active');
    $(`.bottom-nav-item[data-page="${this.currentPage}"]`).addClass('active');
  },

  showMainContent() {
    $('#role-select-page').hide();
    $('#main-content').show();
    if (this.currentRole === 'citizen') {
      $('#bottom-nav').show();
    } else {
      $('#bottom-nav').hide();
    }
  },

  showRoleSelect() {
    $('#role-select-page').show();
    $('#main-content').hide();
    $('#bottom-nav').hide();
  },

  logout() {
    this.currentRole = null;
    this.currentPage = null;
    this.currentComponent = null;
    Storage.remove('currentRole');
    this.stateManager.reset();
    this.showRoleSelect();
    $('#user-role-label').text('请选择角色');
    QueueService.stopPolling();
  },

  navigate(page) {
    if (this.currentPage === page && this.currentComponent) return;

    if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
      this.currentComponent.destroy();
    }

    this.stateManager.setState('currentPage', page);
    const $mainContent = $('#main-content');
    $mainContent.empty();

    let componentTag = '';
    let componentClass = null;

    switch (page) {
      case 'home':
        this.renderCitizenHome($mainContent);
        break;
      case 'guide':
        componentTag = 'smart-guide';
        componentClass = 'SmartGuide';
        break;
      case 'appointment':
        componentTag = 'business-query';
        componentClass = 'BusinessQuery';
        break;
      case 'queue':
        componentTag = 'queue-system';
        componentClass = 'QueueSystem';
        break;
      case 'progress':
        this.renderProgressPage($mainContent);
        break;
      case 'selfservice':
        componentTag = 'self-service';
        componentClass = 'SelfService';
        break;
      case 'evaluation':
        componentTag = 'satisfaction-evaluation';
        componentClass = 'Satisfaction';
        break;
      case 'window':
        componentTag = 'window-manage';
        componentClass = 'WindowManage';
        break;
      case 'dashboard':
        componentTag = 'data-dashboard';
        componentClass = 'DataDashboard';
        break;
      default:
        this.renderCitizenHome($mainContent);
    }

    if (componentTag && componentClass) {
      const component = document.createElement(componentTag);
      $mainContent.append(component);

      if (window[componentClass]) {
        this.currentComponent = component;
      }
    }

    window.scrollTo(0, 0);
  },

  renderCitizenHome($container) {
    const hero = `
      <div class="hero-section animate-fade-in">
        <h2 class="hero-title">您好，欢迎来到政务服务中心</h2>
        <p class="hero-subtitle">今天是 ${DateUtils.format(new Date(), 'YYYY年MM月DD日 WW')}</p>
      </div>
      <div class="home-grid">
        <div class="home-card animate-slide-up" onclick="App.navigate('guide')">
          <div class="home-card-icon"><i class="fa fa-compass"></i></div>
          <h3>智能导办</h3>
          <p>输入办事意图，获取材料清单和办理指南</p>
        </div>
        <div class="home-card animate-slide-up" style="animation-delay: 0.1s;" onclick="App.navigate('appointment')">
          <div class="home-card-icon"><i class="fa fa-calendar-check-o"></i></div>
          <h3>在线预约</h3>
          <p>选择事项和时段，预约成功后直接办理</p>
        </div>
        <div class="home-card animate-slide-up" style="animation-delay: 0.2s;" onclick="App.navigate('queue')">
          <div class="home-card-icon"><i class="fa fa-list-ol"></i></div>
          <h3>实时排队</h3>
          <p>查看各窗口排队情况，在线取号不等待</p>
        </div>
        <div class="home-card animate-slide-up" style="animation-delay: 0.3s;" onclick="App.navigate('progress')">
          <div class="home-card-icon"><i class="fa fa-clock-o"></i></div>
          <h3>办理进度</h3>
          <p>实时查看办理状态，各环节时间可追溯</p>
        </div>
        <div class="home-card animate-slide-up" style="animation-delay: 0.4s;" onclick="App.navigate('selfservice')">
          <div class="home-card-icon"><i class="fa fa-desktop"></i></div>
          <h3>自助终端</h3>
          <p>模拟自助终端操作，全流程触屏办理</p>
        </div>
        <div class="home-card animate-slide-up" style="animation-delay: 0.5s;" onclick="App.navigate('evaluation')">
          <div class="home-card-icon"><i class="fa fa-star"></i></div>
          <h3>满意度评价</h3>
          <p>对服务进行评价，您的意见很重要</p>
        </div>
      </div>
    `;

    const quickInfo = `
      <div class="row">
        <div class="col-md-6">
          <div class="card animate-slide-up">
            <div class="card-header">
              <span><i class="fa fa-bell"></i> 最新通知</span>
            </div>
            <div class="card-body">
              <div class="list-group list-group-flush">
                <div class="list-group-item border-0 px-0 py-2">
                  <div class="d-flex justify-content-between align-items-center">
                    <span><i class="fa fa-angle-right text-primary mr-2"></i>关于调整政务服务时间的通知</span>
                    <small class="text-muted">今天</small>
                  </div>
                </div>
                <div class="list-group-item border-0 px-0 py-2">
                  <div class="d-flex justify-content-between align-items-center">
                    <span><i class="fa fa-angle-right text-primary mr-2"></i>社保业务办理指南更新</span>
                    <small class="text-muted">昨天</small>
                  </div>
                </div>
                <div class="list-group-item border-0 px-0 py-2">
                  <div class="d-flex justify-content-between align-items-center">
                    <span><i class="fa fa-angle-right text-primary mr-2"></i>不动产登记"一窗受理"正式上线</span>
                    <small class="text-muted">3天前</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card animate-slide-up">
            <div class="card-header">
              <span><i class="fa fa-fire"></i> 热门办理事项</span>
            </div>
            <div class="card-body">
              <div class="d-flex flex-wrap">
                <span class="tag">身份证办理</span>
                <span class="tag">社保卡申领</span>
                <span class="tag">不动产登记</span>
                <span class="tag">营业执照</span>
                <span class="tag">公积金提取</span>
                <span class="tag">户口迁移</span>
                <span class="tag">驾驶证换证</span>
                <span class="tag">税务登记</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $container.html(hero + quickInfo);
  },

  async renderProgressPage($container) {
    const res = await ApiService.getProgress();
    const items = res.data || [];

    let html = `
      <div class="card animate-fade-in">
        <div class="card-header">
          <span><i class="fa fa-clock-o"></i> 办理进度查询</span>
        </div>
        <div class="card-body">
    `;

    if (items.length === 0) {
      html += `
        <div class="empty-state">
          <i class="fa fa-inbox"></i>
          <h4>暂无办理中的事项</h4>
          <p>您可以通过智能导办查询所需材料并开始办理</p>
          <button class="btn btn-primary btn-lg mt-3" onclick="App.navigate('guide')">
            <i class="fa fa-compass"></i> 智能导办
          </button>
        </div>
      `;
    } else {
      items.forEach(item => {
        html += this.renderProgressItem(item);
      });
    }

    html += `</div></div>`;
    $container.html(html);
  },

  renderProgressItem(item) {
    const currentIndex = item.timeline.findIndex(t => !t.completed);
    const progress = currentIndex === -1 ? 100 : (currentIndex / item.timeline.length) * 100;

    let timelineHtml = '';
    item.timeline.forEach((step, index) => {
      const isCompleted = step.completed;
      const isActive = !isCompleted && (index === currentIndex || (currentIndex === -1 && index === item.timeline.length - 1));
      const itemClass = isCompleted ? 'completed' : (isActive ? 'active' : '');

      timelineHtml += `
        <div class="timeline-item ${itemClass}">
          <div class="timeline-time">${step.time ? DateUtils.formatDateTime(step.time) : '等待中'}</div>
          <div class="timeline-title">
            <i class="fa ${isCompleted ? 'fa-check' : (isActive ? 'fa-spinner fa-spin' : 'fa-circle-o')} mr-2"></i>
            ${step.name}
          </div>
          ${isActive ? '<div class="timeline-desc">正在处理中，请耐心等待...</div>' : ''}
        </div>
      `;
    });

    return `
      <div class="card mb-4">
        <div class="card-header">
          <div class="d-flex justify-content-between align-items-center w-100">
            <span><i class="fa fa-file-text-o mr-2"></i>${item.itemName}</span>
            <span class="status-badge ${item.status === 'completed' ? 'idle' : 'busy'}">
              ${item.status === 'completed' ? '已办结' : '办理中'}
            </span>
          </div>
        </div>
        <div class="card-body">
          <div class="mb-4">
            <div class="d-flex justify-content-between mb-2">
              <small class="text-muted">办理进度</small>
              <small class="text-primary">${Math.round(progress)}%</small>
            </div>
            <div class="progress">
              <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>
          <div class="timeline">
            ${timelineHtml}
          </div>
          ${item.status === 'completed' ? `
            <div class="mt-4 text-center">
              <button class="btn btn-primary" onclick="App.navigate('evaluation')">
                <i class="fa fa-star mr-2"></i>进行满意度评价
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  showCallToast(data) {
    const $toast = $('#call-toast');
    $toast.html(`
      <div class="call-number animate-pulse">${data.queueNumber}</div>
      <div class="call-window">请前往 ${data.windowName} 办理</div>
      <div class="mt-2">
        <button class="btn btn-light btn-sm" onclick="$('#call-toast').hide()">知道了</button>
      </div>
    `);
    $toast.show();

    setTimeout(() => {
      $toast.hide();
    }, 10000);
  },

  showNotification(title, message, type = 'info') {
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const colors = {
      success: '#4CAF50',
      error: '#F44336',
      warning: '#FF9800',
      info: '#1E88E5'
    };

    const id = 'notif-' + Date.now();
    const $container = $('#notification-container');
    const $notif = $(`
      <div id="${id}" class="animate-slide-up" style="
        position: fixed;
        top: 80px;
        right: 20px;
        background: #fff;
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 9998;
        min-width: 280px;
        border-left: 4px solid ${colors[type]};
      ">
        <div class="d-flex align-items-start">
          <i class="fa ${icons[type]}" style="color: ${colors[type]}; font-size: 20px; margin-right: 12px;"></i>
          <div class="flex-1">
            <div style="font-weight: 600; color: #263238; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 13px; color: #546E7A;">${message}</div>
          </div>
        </div>
      </div>
    `);

    $container.append($notif);

    setTimeout(() => {
      $notif.fadeOut(300, () => $notif.remove());
    }, 3000);
  },

  showAppointmentNotification(data) {
    const id = 'apt-notif-' + Date.now();
    const $container = $('#notification-container');

    const windowName = data.windowName || '综合窗口 1-12';
    const formattedDate = data.date ? DateUtils.format(new Date(data.date), 'YYYY年MM月DD日') : '';

    const $notif = $(`
      <div id="${id}" class="apt-notification animate-slide-up">
        <div class="apt-notif-header">
          <div class="apt-notif-icon">
            <i class="fa fa-check-circle"></i>
          </div>
          <div class="apt-notif-title">
            <div class="apt-success-text">预约成功！</div>
            <div class="apt-sub-text">您的办理预约已确认</div>
          </div>
          <button class="apt-close-btn" onclick="document.getElementById('${id}').remove()">&times;</button>
        </div>
        <div class="apt-notif-body">
          <div class="apt-info-row">
            <span class="apt-label">事项名称</span>
            <span class="apt-value apt-highlight">${this.escapeHtml(data.itemName || '政务服务事项')}</span>
          </div>
          <div class="apt-info-grid">
            <div class="apt-info-cell">
              <span class="apt-cell-label"><i class="fa fa-calendar"></i> 预约日期</span>
              <span class="apt-cell-value">${formattedDate}</span>
            </div>
            <div class="apt-info-cell">
              <span class="apt-cell-label"><i class="fa fa-clock-o"></i> 预约时段</span>
              <span class="apt-cell-value">${this.escapeHtml(data.timeSlot || '--')}</span>
            </div>
            <div class="apt-info-cell">
              <span class="apt-cell-label"><i class="fa fa-map-marker"></i> 办理地点</span>
              <span class="apt-cell-value">${this.escapeHtml(windowName)}</span>
            </div>
            <div class="apt-info-cell">
              <span class="apt-cell-label"><i class="fa fa-list-ol"></i> 预约排队号</span>
              <span class="apt-cell-value apt-queue-number">${this.escapeHtml(data.queueNumber || 'A000')}</span>
            </div>
          </div>
          <div class="apt-code-box">
            <div class="apt-code-label">预约码</div>
            <div class="apt-code-value">${this.escapeHtml(data.code || '--')}</div>
          </div>
          <div class="apt-tips">
            <i class="fa fa-lightbulb-o"></i>
            <span>请提前15分钟到达办理窗口，携带身份证和相关材料</span>
          </div>
        </div>
        <div class="apt-notif-footer">
          <button class="apt-btn apt-btn-outline" onclick="App.navigate('queue')">
            <i class="fa fa-eye"></i> 查看排队
          </button>
          <button class="apt-btn apt-btn-primary" onclick="document.getElementById('${id}').remove()">
            <i class="fa fa-check"></i> 知道了
          </button>
        </div>
      </div>
    `);

    $container.append($notif);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification('预约成功 - 政务服务中心', {
          body: `您已成功预约${data.itemName || '政务服务事项'}，预约码：${data.code || '--'}，请准时前往办理。`,
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBmaWxsPSIjMWE3M2U4IiBkPSJNMjU2IDhDMTE5IDggOCAxMTkgOCAyNTZzMTExIDI0OCAyNDggMjQ4IDI0OC0xMTEgMjQ4LTI0OFMzOTMgOCAyNTYgOHptMCA0NDJjLTEwNyAwLTE5NC04Ny0xOTQtMTk0UzE0OSA2MiAyNTYgNjJzMTk0IDg3IDE5NCAxOTQtODcgMTk0LTE5NCAxOTR6Ii8+PHBhdGggZmlsbD0iIzNhYWE1MyIgZD0iTTM3MCAyMTBjLTYtNi0xNS02LTIxIDBsLTEwNyAxMDctNDctNDdjLTYtNi0xNS02LTIxIDBsLTIxIDIxYy02IDYtNiAxNSAwIDIxbDU4IDU4YzMgMyA3IDQgMTAgNHM3LTEgMTAtNGwxMjgtMTI4YzYtNiA2LTE1IDAtMjFsLTIxLTIxeiIvPjwvc3ZnPg=='
        });
        setTimeout(() => notification.close(), 8000);
      } catch (e) {
        console.log('系统通知推送失败', e);
      }
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          try {
            new Notification('预约成功 - 政务服务中心', {
              body: `您已成功预约${data.itemName || '政务服务事项'}，预约码：${data.code || '--'}`,
            });
          } catch (e) {}
        }
      });
    }

    setTimeout(() => {
      const $el = $(`#${id}`);
      if ($el.length) {
        $el.fadeOut(400, () => $el.remove());
      }
    }, 15000);
  },

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  playNotification() {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('请前往对应窗口办理业务');
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.log('语音播报不支持');
    }
  },

  destroy() {
    QueueService.destroy();
    this.eventBus.clear();
  }
};

$(document).ready(() => {
  App.init();
});

window.App = App;
