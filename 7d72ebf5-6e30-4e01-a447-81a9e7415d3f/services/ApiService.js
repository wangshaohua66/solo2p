const ApiService = {
  delay(ms = 150) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  response(code, data, message = 'success') {
    return { code, data, message };
  },

  async getCategories() {
    await this.delay(100);
    return this.response(200, MockData.categories);
  },

  async searchItems(keyword = '') {
    await this.delay(120);
    let items = [...MockData.serviceItems];
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(kw) ||
        item.description.toLowerCase().includes(kw) ||
        item.keywords.some(k => k.toLowerCase().includes(kw))
      );
    }
    return this.response(200, items);
  },

  async getItemById(itemId) {
    await this.delay(80);
    const item = MockData.serviceItems.find(i => i.id === itemId);
    if (!item) return this.response(404, null, '事项不存在');
    return this.response(200, item);
  },

  async getMaterials(itemId) {
    await this.delay(100);
    const materials = MockData.materials[itemId] || [];
    const item = MockData.serviceItems.find(i => i.id === itemId);
    return this.response(200, {
      itemId,
      itemName: item?.name || '',
      materials: materials.map(m => ({ ...m, checked: false }))
    });
  },

  async matchIntent(intent) {
    await this.delay(80);
    const trimmedIntent = intent.trim();

    const exactMatch = MockData.intentMap[trimmedIntent];
    if (exactMatch) {
      const item = MockData.serviceItems.find(i => i.id === exactMatch);
      if (item) return this.response(200, { match: 'exact', items: [item] });
    }

    const kw = trimmedIntent.toLowerCase();
    const matched = MockData.serviceItems.filter(item =>
      item.name.toLowerCase().includes(kw) ||
      item.keywords.some(k => k.toLowerCase().includes(kw)) ||
      trimmedIntent.includes(item.keywords.find(k => trimmedIntent.includes(k)))
    );

    if (matched.length > 0) {
      return this.response(200, { match: 'fuzzy', items: matched });
    }

    const suggestions = [];
    for (const [key, itemId] of Object.entries(MockData.intentMap)) {
      if (key.includes(kw) || kw.includes(key)) {
        const item = MockData.serviceItems.find(i => i.id === itemId);
        if (item && !suggestions.find(s => s.id === item.id)) {
          suggestions.push(item);
        }
      }
    }

    if (suggestions.length > 0) {
      return this.response(200, { match: 'suggest', items: suggestions });
    }

    return this.response(200, { match: 'none', items: MockData.serviceItems.slice(0, 5) });
  },

  async createAppointment(data) {
    await this.delay(150);
    const { itemId, date, timeSlot, citizenInfo } = data;
    const item = MockData.serviceItems.find(i => i.id === itemId);

    if (!item) return this.response(400, null, '事项不存在');

    const appointment = {
      id: 'apt-' + Date.now(),
      code: MockData.generateAppointmentCode(),
      itemId,
      itemName: item.name,
      date,
      timeSlot,
      citizenInfo,
      status: 'confirmed',
      createdAt: Date.now(),
      queuePosition: Math.floor(Math.random() * 5) + 1
    };

    const appointments = Storage.get('appointments', []);
    appointments.push(appointment);
    Storage.set('appointments', appointments);

    return this.response(200, appointment);
  },

  async getAppointments(citizenId = null) {
    await this.delay(80);
    const appointments = Storage.get('appointments', []);
    return this.response(200, appointments);
  },

  async getQueueStatus() {
    await this.delay(50);
    const windows = MockData.windows.map(w => ({
      ...w,
      queueLength: w.queueLength + Math.floor(Math.random() * 3) - 1,
      status: Math.random() > 0.1 ? w.status : (Math.random() > 0.5 ? 'idle' : 'busy')
    }));
    return this.response(200, { windows });
  },

  async joinQueue(windowId) {
    await this.delay(100);
    const win = MockData.windows.find(w => w.id === windowId);
    if (!win) return this.response(400, null, '窗口不存在');

    const type = win.type === 'comprehensive' ? 'A' : 'B';
    const number = MockData.generateQueueNumber(type);
    const position = win.queueLength + 1;

    const queueEntry = {
      id: 'queue-' + Date.now(),
      windowId,
      windowName: win.name,
      number,
      position,
      status: 'waiting',
      estimatedWaitTime: position * win.averageWaitTime,
      createdAt: Date.now()
    };

    Storage.set('currentQueue', queueEntry);

    return this.response(200, queueEntry);
  },

  async getMyQueue() {
    await this.delay(50);
    const queue = Storage.get('currentQueue', null);
    if (queue && queue.status === 'waiting') {
      queue.position = Math.max(1, queue.position - Math.floor(Math.random() * 2));
      queue.estimatedWaitTime = Math.max(1, queue.position * 5);
      Storage.set('currentQueue', queue);
    }
    return this.response(200, queue);
  },

  async cancelQueue() {
    await this.delay(80);
    Storage.remove('currentQueue');
    return this.response(200, { success: true });
  },

  async requeue(queueId) {
    await this.delay(100);
    const queue = Storage.get('currentQueue', null);
    if (queue) {
      queue.status = 'waiting';
      queue.position += 3;
      Storage.set('currentQueue', queue);
    }
    return this.response(200, queue);
  },

  async getProgress(itemId = null) {
    await this.delay(100);
    const savedProgress = Storage.get('progressItems', []);

    if (savedProgress.length === 0) {
      const demoItem = MockData.serviceItems[0];
      const now = Date.now();
      const timeline = [
        { status: 'submitted', name: '已提交', time: now - 3600000 * 2, completed: true },
        { status: 'accepted', name: '受理中', time: now - 3600000 * 1.5, completed: true },
        { status: 'reviewing', name: '审核中', time: now - 3600000 * 0.5, completed: true },
        { status: 'approved', name: '审批通过', time: now, completed: false },
        { status: 'completed', name: '已办结', time: null, completed: false }
      ];

      savedProgress.push({
        id: 'progress-001',
        itemId: demoItem.id,
        itemName: demoItem.name,
        status: 'reviewing',
        timeline,
        createdAt: now - 3600000 * 2
      });

      Storage.set('progressItems', savedProgress);
    }

    if (itemId) {
      return this.response(200, savedProgress.find(p => p.itemId === itemId) || null);
    }
    return this.response(200, savedProgress);
  },

  async submitEvaluation(data) {
    await this.delay(120);
    const evaluation = {
      id: 'eval-' + Date.now(),
      ...data,
      createTime: Date.now()
    };

    const history = Storage.get('evaluationHistory', MockData.satisfactionHistory);
    history.unshift(evaluation);
    Storage.set('evaluationHistory', history);

    return this.response(200, evaluation);
  },

  async getEvaluationHistory() {
    await this.delay(80);
    const history = Storage.get('evaluationHistory', MockData.satisfactionHistory);
    return this.response(200, history);
  },

  async getDashboardData() {
    await this.delay(150);
    const data = MockData.dashboardData;
    data.todayVisitors = 2856 + Math.floor(Math.random() * 100);
    return this.response(200, data);
  },

  async staffLogin(employeeNo, password) {
    await this.delay(150);
    const staff = MockData.staffMembers.find(s => s.employeeNo === employeeNo);
    if (!staff) return this.response(401, null, '工号不存在');

    if (password !== '123456') return this.response(401, null, '密码错误');

    return this.response(200, staff);
  },

  async getWindowWorkload(windowId) {
    await this.delay(100);
    const win = MockData.windows.find(w => w.id === windowId);
    const completedToday = Math.floor(Math.random() * 50) + 20;

    return this.response(200, {
      window: win,
      completedToday,
      waitingCount: win?.queueLength || 0,
      currentItem: {
        id: 'trans-' + Date.now(),
        name: '身份证办理',
        citizenName: '张**',
        startTime: Date.now() - 60000 * Math.floor(Math.random() * 15 + 5)
      },
      queue: Array.from({ length: win?.queueLength || 0 }, (_, i) => ({
        number: `A${(100 + i).toString().padStart(3, '0')}`,
        itemName: MockData.serviceItems[Math.floor(Math.random() * MockData.serviceItems.length)].name,
        waitTime: Math.floor(Math.random() * 30) + 5
      }))
    });
  },

  async callNext(windowId) {
    await this.delay(80);
    const number = MockData.generateQueueNumber('A');
    return this.response(200, {
      number,
      windowId,
      timestamp: Date.now()
    });
  },

  async completeItem(windowId, itemId) {
    await this.delay(100);
    return this.response(200, {
      success: true,
      completedAt: Date.now()
    });
  },

  async getTimeSlots(date) {
    await this.delay(80);
    return this.response(200, DateUtils.getTimeSlots());
  },

  async getAvailableDates(days = 7) {
    await this.delay(50);
    return this.response(200, DateUtils.getDateRange(days));
  },

  async getMaterialTemplate(materialId) {
    await this.delay(100);
    const template = MockData.materialTemplates[materialId];
    if (!template) {
      return this.response(404, null, '模板不存在');
    }
    return this.response(200, template);
  },

  async getHallLayout() {
    await this.delay(80);
    return this.response(200, {
      terminals: MockData.selfServiceTerminals,
      waitingAreas: MockData.waitingAreas
    });
  }
};

window.ApiService = ApiService;
