class StateManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.state = this.getDefaultState();
    this.listeners = new Map();
  }

  getDefaultState() {
    return {
      currentRole: null,
      currentPage: 'role-select',
      currentUser: null,
      queueState: {
        windows: [],
        myQueue: null
      },
      appointments: [],
      progressItems: [],
      materials: {},
      selectedItem: null,
      dashboard: {
        todayVisitors: 0,
        avgSatisfaction: 0,
        avgHandleTime: 0,
        windowsLoad: [],
        visitorTrend: [],
        satisfactionTrend: []
      },
      notifications: []
    };
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  setState(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    this.notify(path, value);
  }

  get(path) {
    const keys = path.split('.');
    let current = this.state;
    for (const key of keys) {
      if (current === undefined || current === null) return null;
      current = current[key];
    }
    return current;
  }

  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path).push(callback);
    return () => this.unsubscribe(path, callback);
  }

  unsubscribe(path, callback) {
    if (!this.listeners.has(path)) return;
    const callbacks = this.listeners.get(path);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  notify(path, value) {
    const notifyPath = (p) => {
      if (this.listeners.has(p)) {
        this.listeners.get(p).forEach(cb => {
          try {
            cb(value, this.getState());
          } catch (e) {
            console.error(`State listener error for "${p}":`, e);
          }
        });
      }
    };

    const keys = path.split('.');
    for (let i = keys.length; i > 0; i--) {
      notifyPath(keys.slice(0, i).join('.'));
    }
    notifyPath('*');

    this.eventBus.emit('state:changed', { path, value, state: this.getState() });
  }

  reset() {
    this.state = this.getDefaultState();
    this.eventBus.emit('state:reset', this.getState());
  }

  persist(key) {
    try {
      localStorage.setItem(key, JSON.stringify(this.state));
    } catch (e) {
      console.warn('State persist failed:', e);
    }
  }

  restore(key) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        this.state = Object.assign(this.getDefaultState(), JSON.parse(saved));
        this.eventBus.emit('state:restored', this.getState());
        return true;
      }
    } catch (e) {
      console.warn('State restore failed:', e);
    }
    return false;
  }
}

window.StateManager = StateManager;
