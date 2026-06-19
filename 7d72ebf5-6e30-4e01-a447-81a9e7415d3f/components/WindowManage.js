class WindowManage extends BaseComponent {
  constructor() {
    super();
    this.timer = null;
    this.voiceTimer = null;
  }

  init() {
    this.state = {
      isLoggedIn: false,
      staff: null,
      windowId: null,
      windowName: '',
      employeeNo: 'GZ001',
      password: '123456',
      todayCount: 0,
      waitingCount: 0,
      avgHandleTime: 0,
      currentItem: null,
      elapsedTime: 0,
      queue: [],
      showVoiceAnimation: false,
      voiceText: ''
    };
  }

  async loadWindowData() {
    if (!this.state.windowId) return;
    const result = await ApiService.getWindowWorkload(this.state.windowId);
    if (result.code === 200) {
      const data = result.data;
      this.setState({
        todayCount: data.completedToday,
        waitingCount: data.waitingCount,
        avgHandleTime: data.window?.averageWaitTime || 15,
        currentItem: data.currentItem,
        queue: data.queue,
        windowName: data.window?.name || ''
      });
      if (data.currentItem) {
        this.startTimer(data.currentItem.startTime);
      }
    }
  }

  startTimer(startTime) {
    if (this.timer) this.clearTimer(this.timer);
    this.updateElapsedTime(startTime);
    this.timer = this.setInterval(() => {
      this.updateElapsedTime(startTime);
    }, 1000);
  }

  updateElapsedTime(startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    this.state.elapsedTime = elapsed;
    const timerEl = this.query('.timer-display');
    if (timerEl) {
      timerEl.textContent = this.formatTime(elapsed);
    }
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async handleLogin(e) {
    e.preventDefault();
    const { employeeNo, password } = this.state;
    const result = await ApiService.staffLogin(employeeNo, password);
    if (result.code === 200) {
      this.setState({
        isLoggedIn: true,
        staff: result.data,
        windowId: result.data.windowId
      });
      await this.loadWindowData();
    } else {
      alert(result.message);
    }
  }

  async handleCallNext() {
    if (!this.state.windowId) return;
    const result = await ApiService.callNext(this.state.windowId);
    if (result.code === 200) {
      const data = result.data;
      this.showVoiceAnimation(`请 ${data.number} 号到 ${this.state.windowName} 办理`);
      this.emit('window:call', data);
      const newItem = {
        id: 'trans-' + Date.now(),
        name: this.state.queue[0]?.itemName || '待办理事项',
        citizenName: '李**',
        startTime: Date.now()
      };
      this.setState({
        currentItem: newItem,
        queue: this.state.queue.slice(1),
        waitingCount: Math.max(0, this.state.waitingCount - 1)
      });
      this.startTimer(newItem.startTime);
    }
  }

  async handleComplete() {
    if (!this.state.currentItem || !this.state.windowId) return;
    const result = await ApiService.completeItem(this.state.windowId, this.state.currentItem.id);
    if (result.code === 200) {
      this.emit('window:complete', {
        item: this.state.currentItem,
        completedAt: result.data.completedAt
      });
      if (this.timer) {
        this.clearTimer(this.timer);
        this.timer = null;
      }
      this.setState({
        currentItem: null,
        elapsedTime: 0,
        todayCount: this.state.todayCount + 1
      });
    }
  }

  showVoiceAnimation(text) {
    this.setState({
      showVoiceAnimation: true,
      voiceText: text
    });
    if (this.voiceTimer) this.clearTimer(this.voiceTimer);
    this.voiceTimer = this.setTimeout(() => {
      this.setState({ showVoiceAnimation: false });
    }, 3000);
  }

  destroy() {
    super.destroy();
  }

  getStyles() {
    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :host {
          display: block;
          width: 100%;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .login-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .login-card {
          background: white;
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .login-title {
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }
        .login-subtitle {
          text-align: center;
          color: #999;
          margin-bottom: 30px;
          font-size: 14px;
        }
        .form-group {
          margin-bottom: 20px;
          position: relative;
        }
        .form-label {
          display: block;
          font-size: 14px;
          color: #555;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .form-input {
          width: 100%;
          padding: 12px 40px 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: all 0.3s;
          outline: none;
          box-sizing: border-box;
        }
        .form-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 20px 30px;
          margin-bottom: 20px;
          color: white;
        }
        .header-left h1 {
          font-size: 20px;
          font-weight: 600;
        }
        .header-left p {
          font-size: 13px;
          opacity: 0.8;
          margin-top: 4px;
        }
        .header-right {
          text-align: right;
        }
        .window-number {
          font-size: 28px;
          font-weight: 700;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin-bottom: 12px;
        }
        .stat-icon.blue { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .stat-icon.green { background: linear-gradient(135deg, #11998e, #38ef7d); color: white; }
        .stat-icon.orange { background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
        .stat-icon.purple { background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #333;
        }
        .stat-label {
          font-size: 13px;
          color: #999;
          margin-top: 4px;
        }
        .main-content {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 20px;
        }
        .current-card {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        .card-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-badge {
          padding: 6px 14px;
          background: linear-gradient(135deg, #11998e, #38ef7d);
          color: white;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-badge.idle {
          background: linear-gradient(135deg, #999, #bbb);
        }
        .citizen-info {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }
        .citizen-avatar {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 600;
        }
        .citizen-detail h3 {
          font-size: 22px;
          color: #333;
          margin-bottom: 6px;
        }
        .citizen-detail p {
          color: #666;
          font-size: 14px;
        }
        .timer-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          color: white;
        }
        .timer-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 8px;
        }
        .timer-display {
          font-size: 48px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          letter-spacing: 4px;
        }
        .queue-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .queue-header {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .queue-count {
          background: #ff6b6b;
          color: white;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 12px;
        }
        .queue-list {
          max-height: 400px;
          overflow-y: auto;
        }
        .queue-item {
          display: flex;
          align-items: center;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 10px;
          transition: all 0.2s;
        }
        .queue-item:hover {
          background: #e9ecef;
          transform: translateX(4px);
        }
        .queue-number {
          width: 60px;
          height: 40px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          margin-right: 15px;
        }
        .queue-info {
          flex: 1;
        }
        .queue-item-name {
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }
        .queue-wait-time {
          font-size: 12px;
          color: #999;
          margin-top: 3px;
        }
        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 20px;
        }
        .action-btn {
          padding: 20px;
          border: none;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 700;
          color: white;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .action-btn.call {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .action-btn.call:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(79, 172, 254, 0.5);
        }
        .action-btn.complete {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        .action-btn.complete:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(17, 153, 142, 0.5);
        }
        .voice-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.85);
          color: white;
          padding: 40px 60px;
          border-radius: 20px;
          z-index: 1000;
          text-align: center;
          animation: voiceIn 0.3s ease-out;
        }
        @keyframes voiceIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .voice-wave {
          display: flex;
          justify-content: center;
          gap: 4px;
          margin-bottom: 20px;
        }
        .voice-bar {
          width: 6px;
          background: linear-gradient(to top, #4facfe, #00f2fe);
          border-radius: 3px;
          animation: wave 0.5s ease-in-out infinite;
        }
        .voice-bar:nth-child(1) { animation-delay: 0s; height: 30px; }
        .voice-bar:nth-child(2) { animation-delay: 0.1s; height: 50px; }
        .voice-bar:nth-child(3) { animation-delay: 0.2s; height: 70px; }
        .voice-bar:nth-child(4) { animation-delay: 0.3s; height: 50px; }
        .voice-bar:nth-child(5) { animation-delay: 0.4s; height: 30px; }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
        .voice-text {
          font-size: 20px;
          font-weight: 600;
        }
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 15px;
          opacity: 0.5;
        }
        .input-icon {
          position: absolute;
          right: 12px;
          top: 38px;
          color: #999;
        }
      </style>
    `;
  }

  renderLoginForm() {
    return `
      <div class="login-wrapper">
        <div class="login-card">
          <h2 class="login-title">窗口工作台</h2>
          <p class="login-subtitle">请使用工号登录系统</p>
          <form id="loginForm">
            <div class="form-group">
              <label class="form-label">工号</label>
              <input type="text" class="form-input" id="employeeNo" value="${this.escapeHtml(this.state.employeeNo)}" placeholder="请输入工号" oninput="this.getRootNode().host.handleInputChange('employeeNo', this.value)">
              <span class="input-icon">👤</span>
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="password" value="${this.escapeHtml(this.state.password)}" placeholder="请输入密码" oninput="this.getRootNode().host.handleInputChange('password', this.value)">
              <span class="input-icon">🔒</span>
            </div>
            <button type="button" class="login-btn" onclick="this.getRootNode().host.handleLogin(event)">登 录</button>
          </form>
        </div>
      </div>
    `;
  }

  renderStatsGrid() {
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">📊</div>
          <div class="stat-value">${this.state.todayCount}</div>
          <div class="stat-label">今日办理量</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">👥</div>
          <div class="stat-value">${this.state.waitingCount}</div>
          <div class="stat-label">当前等待人数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">⏱️</div>
          <div class="stat-value">${this.state.avgHandleTime}<span style="font-size:14px;">分</span></div>
          <div class="stat-label">平均办理时间</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">🪟</div>
          <div class="stat-value">${this.escapeHtml(this.state.windowName.replace(/[^0-9]/g, ''))}</div>
          <div class="stat-label">当前窗口号</div>
        </div>
      </div>
    `;
  }

  renderCurrentItem() {
    if (!this.state.currentItem) {
      return `
        <div class="empty-state">
          <div class="empty-icon">⏳</div>
          <p>暂无正在办理的业务</p>
          <p style="font-size:13px;margin-top:8px;">点击"叫号"按钮开始下一位</p>
        </div>
      `;
    }
    return `
      <div class="citizen-info">
        <div class="citizen-avatar">${this.escapeHtml(this.state.currentItem.citizenName?.charAt(0) || '李')}</div>
        <div class="citizen-detail">
          <h3>${this.escapeHtml(this.state.currentItem.citizenName || '李**')}</h3>
          <p>办理事项：${this.escapeHtml(this.state.currentItem.name || '身份证办理')}</p>
        </div>
      </div>
      <div class="timer-section">
        <div class="timer-label">已办理时长</div>
        <div class="timer-display">${this.formatTime(this.state.elapsedTime)}</div>
      </div>
    `;
  }

  renderQueueList() {
    if (this.state.queue.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <p>暂无排队人员</p>
        </div>
      `;
    }
    return this.state.queue.map(item => `
      <div class="queue-item">
        <div class="queue-number">${this.escapeHtml(item.number)}</div>
        <div class="queue-info">
          <div class="queue-item-name">${this.escapeHtml(item.itemName)}</div>
          <div class="queue-wait-time">已等待 ${item.waitTime} 分钟</div>
        </div>
      </div>
    `).join('');
  }

  renderVoiceOverlay() {
    if (!this.state.showVoiceAnimation) return '';
    return `
      <div class="voice-overlay">
        <div class="voice-wave">
          <div class="voice-bar"></div>
          <div class="voice-bar"></div>
          <div class="voice-bar"></div>
          <div class="voice-bar"></div>
          <div class="voice-bar"></div>
        </div>
        <div class="voice-text">${this.escapeHtml(this.state.voiceText)}</div>
      </div>
    `;
  }

  renderWorkbench() {
    return `
      <div class="container">
        <div class="header">
          <div class="header-left">
            <h1>窗口工作台</h1>
            <p>欢迎您，${this.escapeHtml(this.state.staff?.name || '工作人员')} | ${window.DateUtils?.formatDateTime(Date.now()) || ''}</p>
          </div>
          <div class="header-right">
            <div class="window-number">${this.escapeHtml(this.state.windowName)}</div>
          </div>
        </div>

        ${this.renderStatsGrid()}

        <div class="main-content">
          <div>
            <div class="current-card">
              <div class="card-header">
                <span class="card-title">📋 当前办理</span>
                <span class="status-badge ${this.state.currentItem ? '' : 'idle'}">
                  ${this.state.currentItem ? '办理中' : '空闲中'}
                </span>
              </div>
              ${this.renderCurrentItem()}
            </div>

            <div class="actions">
              <button class="action-btn call" ${this.state.currentItem ? 'disabled' : ''} onclick="this.getRootNode().host.handleCallNext()">
                🔔 叫号
              </button>
              <button class="action-btn complete" ${!this.state.currentItem ? 'disabled' : ''} onclick="this.getRootNode().host.handleComplete()">
                ✅ 完成
              </button>
            </div>
          </div>

          <div class="queue-card">
            <div class="queue-header">
              <span>📝 排队列表</span>
              <span class="queue-count">${this.state.queue.length} 人</span>
            </div>
            <div class="queue-list">
              ${this.renderQueueList()}
            </div>
          </div>
        </div>
      </div>

      ${this.renderVoiceOverlay()}
    `;
  }

  render() {
    this.shadowRoot.innerHTML = this.getStyles() + `
      ${!this.state.isLoggedIn ? this.renderLoginForm() : this.renderWorkbench()}
    `;
  }

  handleInputChange(field, value) {
    this.state[field] = value;
  }
}

customElements.define('window-manage', WindowManage);
window.WindowManage = WindowManage;
