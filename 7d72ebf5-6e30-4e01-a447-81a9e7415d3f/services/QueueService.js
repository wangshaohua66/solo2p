const QueueService = {
  pollInterval: 2000,
  pollTimer: null,
  eventBus: null,

  init(eventBus) {
    this.eventBus = eventBus;
    this.startPolling();
  },

  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollQueueStatus(), this.pollInterval);
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  async pollQueueStatus() {
    try {
      const [queueRes, myQueueRes] = await Promise.all([
        ApiService.getQueueStatus(),
        ApiService.getMyQueue()
      ]);

      if (queueRes.code === 200) {
        this.eventBus.emit('queue:update', queueRes.data);
      }

      if (myQueueRes.code === 200 && myQueueRes.data) {
        const myQueue = myQueueRes.data;
        this.eventBus.emit('queue:my-update', myQueue);

        if (myQueue.position === 1 && myQueue.status === 'waiting') {
          this.eventBus.emit('queue:call', {
            queueNumber: myQueue.number,
            windowId: myQueue.windowId,
            windowName: myQueue.windowName
          });
        }
      }
    } catch (e) {
      console.error('Queue poll error:', e);
    }
  },

  async joinQueue(windowId) {
    const res = await ApiService.joinQueue(windowId);
    if (res.code === 200) {
      this.eventBus.emit('queue:joined', res.data);
    }
    return res;
  },

  async leaveQueue() {
    const res = await ApiService.cancelQueue();
    if (res.code === 200) {
      this.eventBus.emit('queue:left');
    }
    return res;
  },

  async requeue(queueId) {
    const res = await ApiService.requeue(queueId);
    if (res.code === 200) {
      this.eventBus.emit('queue:requeued', res.data);
    }
    return res;
  },

  getHeatColor(queueLength, maxLength = 25) {
    const ratio = Math.min(queueLength / maxLength, 1);
    if (ratio < 0.3) return 'heat-low';
    if (ratio < 0.6) return 'heat-medium';
    return 'heat-high';
  },

  getWindowStatusLabel(status) {
    const labels = {
      idle: { text: '空闲', class: 'status-idle' },
      busy: { text: '办理中', class: 'status-busy' },
      paused: { text: '暂停', class: 'status-paused' }
    };
    return labels[status] || labels.idle;
  },

  formatEstimatedWait(minutes) {
    return DateUtils.formatWaitTime(minutes);
  },

  destroy() {
    this.stopPolling();
  }
};

window.QueueService = QueueService;
