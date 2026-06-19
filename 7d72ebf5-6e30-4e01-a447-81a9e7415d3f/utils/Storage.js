const Storage = {
  MAX_SIZE: 5 * 1024 * 1024,

  set(key, value, { expire = null, encrypt = false } = {}) {
    try {
      const data = {
        value,
        timestamp: Date.now(),
        expire
      };

      let serialized = JSON.stringify(data);

      if (this.getSize() + serialized.length > this.MAX_SIZE) {
        this.cleanup();
      }

      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      console.warn('Storage set failed:', e);
      return false;
    }
  },

  get(key, defaultValue = null) {
    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return defaultValue;

      const data = JSON.parse(serialized);

      if (data.expire && Date.now() > data.expire) {
        this.remove(key);
        return defaultValue;
      }

      return data.value;
    } catch (e) {
      console.warn('Storage get failed:', e);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  },

  has(key) {
    return localStorage.getItem(key) !== null;
  },

  clear(prefix = null) {
    try {
      if (prefix) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        });
      } else {
        localStorage.clear();
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  getSize() {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length * 2;
      }
    }
    return total;
  },

  getSizeMB() {
    return (this.getSize() / (1024 * 1024)).toFixed(2);
  },

  cleanup() {
    const items = [];
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        try {
          const data = JSON.parse(localStorage[key]);
          items.push({
            key,
            timestamp: data.timestamp || 0,
            expire: data.expire || Infinity
          });
        } catch (e) {
          items.push({ key, timestamp: 0, expire: Infinity });
        }
      }
    }

    const expired = items.filter(item => item.expire !== Infinity && Date.now() > item.expire);
    expired.forEach(item => this.remove(item.key));

    if (this.getSize() > this.MAX_SIZE * 0.9) {
      items.sort((a, b) => a.timestamp - b.timestamp);
      for (const item of items) {
        this.remove(item.key);
        if (this.getSize() <= this.MAX_SIZE * 0.7) break;
      }
    }
  },

  getKeys(prefix = null) {
    const keys = [];
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        if (!prefix || key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    }
    return keys;
  },

  getAll(prefix = null) {
    const result = {};
    const keys = this.getKeys(prefix);
    keys.forEach(key => {
      result[key] = this.get(key);
    });
    return result;
  }
};

window.Storage = Storage;
