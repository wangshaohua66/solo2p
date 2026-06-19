class EventBus {
  constructor() {
    this.events = {};
    this.onceEvents = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback.apply(this, args);
    };
    this.on(event, wrapper);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    if (!callback) {
      delete this.events[event];
      return;
    }
    const index = this.events[event].indexOf(callback);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    const callbacks = [...this.events[event]];
    callbacks.forEach(callback => {
      try {
        callback.apply(this, args);
      } catch (e) {
        console.error(`EventBus error for event "${event}":`, e);
      }
    });
  }

  throttle(event, callback, delay = 200) {
    let lastCall = 0;
    const throttled = (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        callback.apply(this, args);
      }
    };
    return this.on(event, throttled);
  }

  debounce(event, callback, delay = 200) {
    let timeoutId = null;
    const debounced = (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        callback.apply(this, args);
      }, delay);
    };
    return this.on(event, debounced);
  }

  clear() {
    this.events = {};
    this.onceEvents = {};
  }
}

window.EventBus = EventBus;
