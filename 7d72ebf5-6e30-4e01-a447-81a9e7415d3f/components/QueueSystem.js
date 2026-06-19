class QueueSystem extends BaseComponent {
  constructor() {
    super();
    this.state = {
      windows: [],
      myQueue: null,
      showCallModal: false,
      callInfo: null,
      selectedWindowId: null,
      hallLayout: { terminals: [], waitingAreas: [] },
      hallLoading: true
    };
  }

  init() {
    this.subscribe('queue:update', (data) => {
      this.setState({ windows: data.windows || [] });
    });

    this.subscribe('queue:my-update', (data) => {
      this.setState({ myQueue: data });
    });

    this.subscribe('queue:call', (data) => {
      this.setState({
        showCallModal: true,
        callInfo: data
      });
      this.playCallAlert();
    });

    this.subscribe('queue:joined', (data) => {
      this.setState({ myQueue: data });
    });

    this.subscribe('queue:left', () => {
      this.setState({ myQueue: null });
    });

    this.subscribe('queue:requeued', (data) => {
      this.setState({ myQueue: data });
    });

    this.startPolling();
    this.loadHallLayout();
  }

  async loadHallLayout() {
    try {
      const res = await ApiService.getHallLayout();
      if (res.code === 200 && res.data) {
        this.setState({
          hallLayout: {
            terminals: res.data.terminals || [],
            waitingAreas: res.data.waitingAreas || []
          },
          hallLoading: false
        });
      } else {
        this.setState({ hallLoading: false });
      }
    } catch (e) {
      console.error('加载大厅布局失败:', e);
      this.setState({ hallLoading: false });
    }
  }

  startPolling() {
    this.pollTimer = this.setInterval(() => {
      QueueService.pollQueueStatus();
    }, 2000);
  }

  stopPolling() {
    if (this.pollTimer) {
      this.clearTimer(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async playCallAlert() {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = '请' + this.state.callInfo.queueNumber + '号到' + this.state.callInfo.windowName + '办理';
        utterance.lang = 'zh-CN';
        speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.log('Speech not supported');
    }
  }

  async handleJoinQueue(windowId) {
    if (this.state.myQueue && this.state.myQueue.status === 'waiting') {
      alert('您已在排队中，请先取消当前排队');
      return;
    }
    const res = await QueueService.joinQueue(windowId);
    if (res.code !== 200) {
      alert(res.message || '取号失败');
    }
  }

  async handleLeaveQueue() {
    if (!confirm('确定要放弃当前排队吗？')) return;
    const res = await QueueService.leaveQueue();
    if (res.code !== 200) {
      alert(res.message || '取消失败');
    }
  }

  async handleRequeue() {
    if (!this.state.myQueue) return;
    const res = await QueueService.requeue(this.state.myQueue.id);
    if (res.code !== 200) {
      alert(res.message || '重排失败');
    }
  }

  closeCallModal() {
    this.setState({ showCallModal: false, callInfo: null });
  }

  getHeatColorClass(queueLength) {
    return QueueService.getHeatColor(queueLength);
  }

  getWindowStatus(status) {
    return QueueService.getWindowStatusLabel(status);
  }

  formatWaitTime(minutes) {
    return QueueService.formatEstimatedWait(minutes);
  }

  getStyles() {
    return `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #333;
        }
        .queue-container {
          padding: 20px;
          background: #f5f7fa;
          min-height: 100vh;
        }
        .queue-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .queue-header h2 {
          margin: 0 0 8px 0;
          color: #2c3e50;
          font-size: 28px;
        }
        .queue-header p {
          margin: 0;
          color: #7f8c8d;
          font-size: 14px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
          margin: 24px 0 16px 0;
          padding-left: 12px;
          border-left: 4px solid #3498db;
        }
        .windows-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .window-card {
          background: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
        }
        .window-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .window-card .heat-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }
        .heat-low { background: #27ae60; }
        .heat-medium { background: #f39c12; }
        .heat-high { background: #e74c3c; }
        .window-name {
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
        }
        .window-number {
          font-size: 32px;
          font-weight: bold;
          color: #3498db;
          text-align: center;
          padding: 12px 0;
          background: #ecf0f1;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .window-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #7f8c8d;
          margin-bottom: 8px;
        }
        .window-info .value {
          font-weight: 600;
          color: #2c3e50;
        }
        .status-tag {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        .status-idle { background: #d5f5e3; color: #1e8449; }
        .status-busy { background: #fdebd0; color: #d35400; }
        .status-paused { background: #ecf0f1; color: #7f8c8d; }
        .window-actions {
          margin-top: 12px;
        }
        .btn {
          width: 100%;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary {
          background: #3498db;
          color: white;
        }
        .btn-primary:hover {
          background: #2980b9;
        }
        .btn-primary:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        .btn-danger {
          background: #e74c3c;
          color: white;
        }
        .btn-danger:hover {
          background: #c0392b;
        }
        .btn-warning {
          background: #f39c12;
          color: white;
        }
        .btn-warning:hover {
          background: #d68910;
        }
        .my-queue-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
        }
        .my-queue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .my-queue-title {
          font-size: 18px;
          font-weight: 600;
        }
        .my-queue-number {
          font-size: 48px;
          font-weight: bold;
          text-align: center;
          margin: 16px 0;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .my-queue-info {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .my-queue-info-item {
          text-align: center;
          background: rgba(255,255,255,0.15);
          padding: 12px;
          border-radius: 8px;
        }
        .my-queue-info-item .label {
          font-size: 12px;
          opacity: 0.9;
          margin-bottom: 4px;
        }
        .my-queue-info-item .value {
          font-size: 20px;
          font-weight: 600;
        }
        .progress-container {
          margin-bottom: 20px;
        }
        .progress-bar {
          height: 12px;
          background: rgba(255,255,255,0.2);
          border-radius: 6px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2ecc71, #27ae60);
          border-radius: 6px;
          transition: width 0.5s ease;
          animation: progressPulse 2s ease-in-out infinite;
        }
        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .progress-text {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-top: 8px;
          opacity: 0.9;
        }
        .my-queue-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .no-queue {
          background: white;
          border-radius: 12px;
          padding: 40px;
          text-align: center;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .no-queue i {
          font-size: 48px;
          color: #bdc3c7;
          margin-bottom: 16px;
        }
        .no-queue p {
          color: #7f8c8d;
          margin: 0;
        }
        .heat-legend {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .heat-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .heat-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .call-modal {
          background: white;
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          max-width: 500px;
          width: 90%;
          animation: callModalPulse 1s ease-in-out infinite;
        }
        @keyframes callModalPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 0 20px rgba(231, 76, 60, 0); }
        }
        .call-modal-title {
          font-size: 24px;
          color: #e74c3c;
          margin-bottom: 24px;
          font-weight: 600;
        }
        .call-modal-number {
          font-size: 72px;
          font-weight: bold;
          color: #e74c3c;
          margin: 24px 0;
          animation: numberBlink 0.5s ease-in-out infinite alternate;
        }
        @keyframes numberBlink {
          from { opacity: 1; }
          to { opacity: 0.5; }
        }
        .call-modal-window {
          font-size: 20px;
          color: #2c3e50;
          margin-bottom: 32px;
        }
        .call-modal-window span {
          color: #3498db;
          font-weight: 600;
        }
        .window-type-section {
          margin-bottom: 8px;
        }
        .window-type-label {
          display: inline-block;
          padding: 4px 12px;
          background: #34495e;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .hall-layout-section {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          margin-top: 24px;
        }
        .hall-layout-title {
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 16px;
          padding-left: 12px;
          border-left: 4px solid #16a085;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hall-sub-title {
          font-size: 14px;
          font-weight: 600;
          color: #34495e;
          margin: 20px 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #ecf0f1;
        }
        .hall-sub-title:first-child { margin-top: 0; }
        .terminals-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        @media (max-width: 900px) {
          .terminals-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .terminal-card {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          padding: 14px 12px;
          text-align: center;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
        }
        .terminal-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }
        .terminal-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }
        .terminal-card.status-available::before { background: #27ae60; }
        .terminal-card.status-busy::before { background: #f39c12; }
        .terminal-card.status-maintenance::before { background: #95a5a6; }
        .terminal-card.status-available { border-color: #d5f5e3; }
        .terminal-card.status-busy { border-color: #fdebd0; }
        .terminal-card.status-maintenance { border-color: #e0e0e0; opacity: 0.75; }
        .terminal-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          margin: 0 auto 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .status-available .terminal-icon { background: #eafaf1; color: #27ae60; }
        .status-busy .terminal-icon { background: #fef5e7; color: #f39c12; }
        .status-maintenance .terminal-icon { background: #f4f6f7; color: #95a5a6; }
        .terminal-id {
          font-size: 16px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 4px;
        }
        .terminal-type {
          font-size: 12px;
          color: #7f8c8d;
          margin-bottom: 8px;
        }
        .terminal-status-badge {
          display: inline-block;
          font-size: 11px;
          padding: 2px 10px;
          border-radius: 10px;
          margin-bottom: 6px;
        }
        .status-available .terminal-status-badge {
          background: #eafaf1; color: #1e8449;
        }
        .status-busy .terminal-status-badge {
          background: #fef5e7; color: #d35400;
        }
        .status-maintenance .terminal-status-badge {
          background: #f4f6f7; color: #616161;
        }
        .terminal-queue-info {
          font-size: 12px;
          color: #7f8c8d;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid #f0f0f0;
        }
        .terminal-queue-info .queue-num {
          font-weight: 700;
          color: #f39c12;
        }
        .waiting-areas-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (max-width: 640px) {
          .waiting-areas-grid { grid-template-columns: 1fr; }
        }
        .waiting-area-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 18px;
          transition: all 0.25s;
        }
        .waiting-area-card:hover {
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
        }
        .area-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .area-name {
          font-size: 15px;
          font-weight: 600;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .area-name i { color: #3498db; }
        .area-rate-badge {
          padding: 3px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .area-rate-low { background: #eafaf1; color: #1e8449; }
        .area-rate-medium { background: #fef9e7; color: #b7950b; }
        .area-rate-high { background: #fadbd8; color: #c0392b; }
        .area-seat-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .area-seat-progress {
          flex: 1;
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          overflow: hidden;
        }
        .area-seat-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s;
        }
        .area-seat-fill.rate-low { background: linear-gradient(90deg, #abebc6, #27ae60); }
        .area-seat-fill.rate-medium { background: linear-gradient(90deg, #f9e79f, #f39c12); }
        .area-seat-fill.rate-high { background: linear-gradient(90deg, #f5b7b1, #e74c3c); }
        .area-seat-text {
          font-size: 13px;
          color: #7f8c8d;
          min-width: 90px;
          text-align: right;
        }
        .area-seat-text .num {
          font-weight: 700;
          color: #2c3e50;
        }
        .area-seats-grid {
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          gap: 3px;
          margin-bottom: 12px;
        }
        .seat-dot {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 3px;
        }
        .seat-dot.occupied { background: #e57373; }
        .seat-dot.empty { background: #a5d6a7; }
        .area-facilities {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 10px;
          border-top: 1px solid #f0f0f0;
        }
        .area-facility {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: #ebf5fb;
          border-radius: 12px;
          font-size: 12px;
          color: #2980b9;
        }
        .area-facility i { font-size: 12px; }
      </style>
    `;
  }

  renderWindows(windows, type) {
    if (!windows || windows.length === 0) return '';

    const filtered = windows.filter(w => w.type === type);
    const typeLabel = type === 'comprehensive' ? '综合窗口' : '专业窗口';

    return `
      <div class="window-type-section">
        <span class="window-type-label">${typeLabel}</span>
        <div class="windows-grid">
          ${filtered.map(win => {
            const heatClass = this.getHeatColorClass(win.queueLength);
            const status = this.getWindowStatus(win.status);
            const canJoin = !this.state.myQueue || this.state.myQueue.status !== 'waiting';
            
            return `
              <div class="window-card">
                <div class="heat-bar ${heatClass}"></div>
                <div class="window-name">${this.escapeHtml(win.name)}</div>
                <div class="window-number">${this.escapeHtml(win.currentNumber)}</div>
                <div class="window-info">
                  <span>排队人数</span>
                  <span class="value">${win.queueLength} 人</span>
                </div>
                <div class="window-info">
                  <span>预计等待</span>
                  <span class="value">${this.formatWaitTime(win.averageWaitTime * win.queueLength)}</span>
                </div>
                <div style="margin-top: 12px;">
                  <span class="status-tag ${status.class}">${status.text}</span>
                </div>
                <div class="window-actions">
                  <button 
                    class="btn btn-primary" 
                    onclick="this.getRootNode().host.handleJoinQueue('${win.id}')"
                    ${!canJoin || win.status === 'paused' ? 'disabled' : ''}
                  >
                    ${win.status === 'paused' ? '窗口暂停' : '取号排队'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderMyQueue() {
    const myQueue = this.state.myQueue;
    
    if (!myQueue) {
      return `
        <div class="no-queue">
          <i class="fas fa-clock"></i>
          <p>您当前没有排队，请从下方窗口选择取号</p>
        </div>
      `;
    }

    const progress = myQueue.position > 0 ? Math.max(0, Math.min(100, (1 - (myQueue.position - 1) / Math.max(myQueue.position, 10)) * 100)) : 100;
    const canRequeue = myQueue.status === 'missed' || myQueue.position > 3;

    return `
      <div class="my-queue-card">
        <div class="my-queue-header">
          <span class="my-queue-title">我的排队</span>
          <span class="status-tag ${myQueue.status === 'waiting' ? 'status-busy' : 'status-idle'}">
            ${myQueue.status === 'waiting' ? '排队中' : myQueue.status === 'missed' ? '已过号' : '已取消'}
          </span>
        </div>
        <div class="my-queue-number">${this.escapeHtml(myQueue.number)}</div>
        <div class="my-queue-info">
          <div class="my-queue-info-item">
            <div class="label">前方等待</div>
            <div class="value">${Math.max(0, myQueue.position - 1)} 人</div>
          </div>
          <div class="my-queue-info-item">
            <div class="label">预计等待</div>
            <div class="value">${this.formatWaitTime(myQueue.estimatedWaitTime)}</div>
          </div>
          <div class="my-queue-info-item">
            <div class="label">办理窗口</div>
            <div class="value">${this.escapeHtml(myQueue.windowName || '待分配')}</div>
          </div>
        </div>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">
            <span>排队进度</span>
            <span>${progress.toFixed(0)}%</span>
          </div>
        </div>
        <div class="my-queue-actions">
          ${canRequeue ? `
            <button class="btn btn-warning" onclick="this.getRootNode().host.handleRequeue()">
              过号重排
            </button>
          ` : ''}
          <button class="btn btn-danger" onclick="this.getRootNode().host.handleLeaveQueue()">
            放弃排队
          </button>
        </div>
      </div>
    `;
  }

  renderCallModal() {
    if (!this.state.showCallModal || !this.state.callInfo) return '';

    const { queueNumber, windowName } = this.state.callInfo;

    return `
      <div class="modal-overlay" onclick="this.getRootNode().host.closeCallModal()">
        <div class="call-modal" onclick="event.stopPropagation()">
          <div class="call-modal-title">
            <i class="fas fa-bell"></i> 叫号提醒
          </div>
          <div class="call-modal-number">${this.escapeHtml(queueNumber)}</div>
          <div class="call-modal-window">
            请到 <span>${this.escapeHtml(windowName)}</span> 办理
          </div>
          <button class="btn btn-primary" onclick="this.getRootNode().host.closeCallModal()">
            我知道了
          </button>
        </div>
      </div>
    `;
  }

  renderHallLayout() {
    const { terminals, waitingAreas } = this.state.hallLayout;

    if (this.state.hallLoading) {
      return `
        <div class="hall-layout-section">
          <div class="hall-layout-title">
            <i class="fa fa-map-o"></i> 大厅场景布局
          </div>
          <div class="loading">正在加载大厅数据...</div>
        </div>
      `;
    }

    const statusText = { available: '空闲', busy: '使用中', maintenance: '维护中' };
    const typeIcon = {
      '综合业务': 'fa-desktop',
      '身份证业务': 'fa-id-card-o',
      '社保业务': 'fa-address-card-o',
      '证照打印': 'fa-print',
      '不动产查询': 'fa-home'
    };

    const terminalsHtml = terminals && terminals.length > 0 ? `
      <div class="hall-sub-title">自助服务终端 (共 ${terminals.length} 台)</div>
      <div class="terminals-grid">
        ${terminals.map(t => `
          <div class="terminal-card status-${t.status}">
            <div class="terminal-icon">
              <i class="fa ${typeIcon[t.type] || 'fa-desktop'}"></i>
            </div>
            <div class="terminal-id">${this.escapeHtml(t.id)}</div>
            <div class="terminal-type">${this.escapeHtml(t.name || t.type)}</div>
            <span class="terminal-status-badge">${statusText[t.status] || t.status}</span>
            <div class="terminal-queue-info">
              ${t.status === 'maintenance'
                ? '<i class="fa fa-wrench"></i> 维护中'
                : `<span>排队等待 <span class="queue-num">${t.waitQueue || 0}</span> 人</span>`
              }
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    const getRateClass = (rate) => {
      if (rate < 50) return 'low';
      if (rate < 80) return 'medium';
      return 'high';
    };

    const renderSeats = (total, occupied) => {
      let seats = '';
      for (let i = 0; i < Math.min(total, 30); i++) {
        seats += `<div class="seat-dot ${i < occupied ? 'occupied' : 'empty'}"></div>`;
      }
      return seats;
    };

    const areasHtml = waitingAreas && waitingAreas.length > 0 ? `
      <div class="hall-sub-title">等候休息区 (共 ${waitingAreas.length} 个)</div>
      <div class="waiting-areas-grid">
        ${waitingAreas.map(area => {
          const rate = area.occupancyRate || 0;
          const rateClass = getRateClass(rate);
          const total = area.totalSeats || 0;
          const occupied = area.occupiedSeats || 0;
          return `
            <div class="waiting-area-card">
              <div class="area-header">
                <div class="area-name">
                  <i class="fa fa-users"></i>
                  ${this.escapeHtml(area.name)}
                </div>
                <span class="area-rate-badge area-rate-${rateClass}">${rate}%</span>
              </div>
              <div class="area-seat-info">
                <div class="area-seat-progress">
                  <div class="area-seat-fill rate-${rateClass}" style="width: ${rate}%"></div>
                </div>
                <div class="area-seat-text">
                  <span class="num">${occupied}</span>/${total} 已坐
                </div>
              </div>
              <div class="area-seats-grid">
                ${renderSeats(total, occupied)}
              </div>
              ${area.facilities && area.facilities.length > 0 ? `
                <div class="area-facilities">
                  ${area.facilities.map(f => `
                    <span class="area-facility">
                      <i class="fa fa-plug"></i>
                      ${this.escapeHtml(f.name)} ${f.available !== undefined ? `(剩${f.available})` : ''}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      <div class="hall-layout-section">
        <div class="hall-layout-title">
          <i class="fa fa-map-o"></i> 大厅场景布局
        </div>
        ${terminalsHtml}
        ${areasHtml}
      </div>
    `;
  }

  render() {
    const comprehensiveWindows = this.renderWindows(this.state.windows, 'comprehensive');
    const specializedWindows = this.renderWindows(this.state.windows, 'specialized');

    this.shadowRoot.innerHTML = this.getStyles() + `
      <div class="queue-container">
        <div class="queue-header">
          <h2>排队叫号系统</h2>
          <p>实时查看各窗口排队状态，在线取号更便捷</p>
        </div>

        ${this.renderMyQueue()}

        <div class="heat-legend">
          <div class="heat-legend-item">
            <div class="heat-dot heat-low"></div>
            <span>空闲 (0-7人)</span>
          </div>
          <div class="heat-legend-item">
            <div class="heat-dot heat-medium"></div>
            <span>适中 (8-15人)</span>
          </div>
          <div class="heat-legend-item">
            <div class="heat-dot heat-high"></div>
            <span>繁忙 (16人以上)</span>
          </div>
        </div>

        <div class="section-title">窗口热力图</div>
        ${comprehensiveWindows}
        ${specializedWindows}

        ${this.renderHallLayout()}

        ${this.renderCallModal()}
      </div>
    `;
  }

  destroy() {
    this.stopPolling();
    super.destroy();
  }
}

customElements.define('queue-system', QueueSystem);
window.QueueSystem = QueueSystem;
