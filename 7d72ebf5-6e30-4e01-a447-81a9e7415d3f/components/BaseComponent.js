class BaseComponent extends HTMLElement {
  constructor() {
    super();
    this.eventBus = window.eventBus;
    this.stateManager = window.stateManager;
    this.eventSubscriptions = [];
    this._boundEvents = [];
    this.timers = [];
    this.state = {};
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (typeof this.init === 'function') {
      this.init();
    }
    if (typeof this.render === 'function') {
      this.render();
    }
  }

  disconnectedCallback() {
    if (typeof this.destroy === 'function') {
      this.destroy();
    }
  }

  init() {
  }

  render() {
  }

  destroy() {
    this.eventSubscriptions.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.eventSubscriptions = [];

    this._boundEvents.forEach(({ element, event, handler }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(event, handler);
      }
    });
    this._boundEvents = [];

    this.timers.forEach(timer => {
      clearInterval(timer);
      clearTimeout(timer);
    });
    this.timers = [];
  }

  on(event, callback) {
    const unsub = this.eventBus.on(event, callback);
    this.eventSubscriptions.push(unsub);
    return unsub;
  }

  subscribe(event, callback) {
    return this.on(event, callback);
  }

  emit(event, data) {
    this.eventBus.emit(event, data);
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  getState(path) {
    if (!path) return this.state;
    const keys = path.split('.');
    let current = this.state;
    for (const key of keys) {
      if (current === undefined || current === null) return null;
      current = current[key];
    }
    return current;
  }

  setInterval(callback, delay) {
    const timer = setInterval(callback, delay);
    this.timers.push(timer);
    return timer;
  }

  setTimeout(callback, delay) {
    const timer = setTimeout(callback, delay);
    this.timers.push(timer);
    return timer;
  }

  clearTimer(timer) {
    clearInterval(timer);
    clearTimeout(timer);
    this.timers = this.timers.filter(t => t !== timer);
  }

  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  $$(selector) {
    return this.shadowRoot.querySelectorAll(selector);
  }

  query(selector) {
    return this.$(selector);
  }

  queryAll(selector) {
    return this.$$(selector);
  }

  _bindEvent(element, event, handler, options) {
    if (!element) return;
    const boundHandler = handler.bind(this);
    element.addEventListener(event, boundHandler, options);
    this._boundEvents.push({ element, event, handler: boundHandler, options });
  }

  _debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  _throttle(func, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  html(strings, ...values) {
    return strings.reduce((acc, str, i) => {
      const value = values[i] !== undefined ? values[i] : '';
      return acc + str + value;
    }, '');
  }
}

window.BaseComponent = BaseComponent;
