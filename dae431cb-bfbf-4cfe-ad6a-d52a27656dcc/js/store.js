(function(global) {
  'use strict';

  const DB_NAME = 'BrickVaultDB';
  const DB_VERSION = 1;

  const STORES = {
    parts: {
      keyPath: 'id',
      indexes: [
        { name: 'partNumber', keyPath: 'partNumber', unique: false },
        { name: 'color', keyPath: 'color', unique: false },
        { name: 'category', keyPath: 'category', unique: false },
        { name: 'shape', keyPath: 'shape', unique: false }
      ]
    },
    sets: {
      keyPath: 'id',
      indexes: [
        { name: 'setNumber', keyPath: 'setNumber', unique: true },
        { name: 'status', keyPath: 'status', unique: false }
      ]
    },
    setParts: {
      keyPath: 'id',
      indexes: [
        { name: 'setId', keyPath: 'setId', unique: false },
        { name: 'partId', keyPath: 'partId', unique: false }
      ]
    },
    mocs: {
      keyPath: 'id',
      indexes: [
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },
    mocTimelines: {
      keyPath: 'id',
      indexes: [
        { name: 'mocId', keyPath: 'mocId', unique: false }
      ]
    },
    mocModLogs: {
      keyPath: 'id',
      indexes: [
        { name: 'mocId', keyPath: 'mocId', unique: false },
        { name: 'date', keyPath: 'date', unique: false }
      ]
    },
    mocParts: {
      keyPath: 'id',
      indexes: [
        { name: 'mocId', keyPath: 'mocId', unique: false },
        { name: 'partId', keyPath: 'partId', unique: false }
      ]
    },
    auctions: {
      keyPath: 'id',
      indexes: [
        { name: 'platform', keyPath: 'platform', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'endTime', keyPath: 'endTime', unique: false }
      ]
    },
    auctionPrices: {
      keyPath: 'id',
      indexes: [
        { name: 'auctionId', keyPath: 'auctionId', unique: false },
        { name: 'recordedAt', keyPath: 'recordedAt', unique: false }
      ]
    },
    events: {
      keyPath: 'id',
      indexes: [
        { name: 'type', keyPath: 'type', unique: false },
        { name: 'startDate', keyPath: 'startDate', unique: false }
      ]
    },
    config: {
      keyPath: 'key',
      indexes: []
    }
  };

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  class BrickVaultStore {
    constructor() {
      this.db = null;
      this._initPromise = null;
    }

    init() {
      if (this._initPromise) return this._initPromise;
      this._initPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          Object.keys(STORES).forEach(storeName => {
            const cfg = STORES[storeName];
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: cfg.keyPath });
              (cfg.indexes || []).forEach(idx => {
                store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique });
              });
            }
          });
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this);
        };
        request.onerror = (e) => reject(e.target.error);
      });
      return this._initPromise;
    }

    _tx(storeName, mode) {
      return this.db.transaction(storeName, mode).objectStore(storeName);
    }

    _wrapRequest(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async add(storeName, data) {
      if (!data.id) data.id = uuid();
      if (!data.createdAt) data.createdAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();
      return this._wrapRequest(this._tx(storeName, 'readwrite').add(data));
    }

    async put(storeName, data) {
      data.updatedAt = new Date().toISOString();
      if (!data.createdAt) data.createdAt = new Date().toISOString();
      return this._wrapRequest(this._tx(storeName, 'readwrite').put(data));
    }

    async get(storeName, id) {
      return this._wrapRequest(this._tx(storeName, 'readonly').get(id));
    }

    async getAll(storeName) {
      return this._wrapRequest(this._tx(storeName, 'readonly').getAll());
    }

    async delete(storeName, id) {
      return this._wrapRequest(this._tx(storeName, 'readwrite').delete(id));
    }

    async count(storeName) {
      return this._wrapRequest(this._tx(storeName, 'readonly').count());
    }

    async getByIndex(storeName, indexName, value) {
      const store = this._tx(storeName, 'readonly');
      const index = store.index(indexName);
      return this._wrapRequest(index.getAll(value));
    }

    async query(storeName, filters) {
      const all = await this.getAll(storeName);
      if (!filters || Object.keys(filters).length === 0) return all;
      return all.filter(item => {
        return Object.keys(filters).every(key => {
          const filterVal = filters[key];
          const itemVal = item[key];
          if (filterVal === undefined || filterVal === null || filterVal === '') return true;
          if (typeof filterVal === 'string' && typeof itemVal === 'string') {
            return itemVal.toLowerCase().includes(filterVal.toLowerCase());
          }
          return itemVal === filterVal;
        });
      });
    }

    async bulkAdd(storeName, items) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach(item => {
          if (!item.id) item.id = uuid();
          if (!item.createdAt) item.createdAt = new Date().toISOString();
          item.updatedAt = new Date().toISOString();
          store.put(item);
        });
        tx.oncomplete = () => resolve(items.length);
        tx.onerror = () => reject(tx.error);
      });
    }

    async clear(storeName) {
      return this._wrapRequest(this._tx(storeName, 'readwrite').clear());
    }

    async getConfig(key, defaultValue) {
      try {
        const val = await this.get('config', key);
        return val ? val.value : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    }

    async setConfig(key, value) {
      return this.put('config', { key, value });
    }
  }

  global.BrickVaultStore = BrickVaultStore;
  global.BV = { store: new BrickVaultStore(), uuid };
})(window);
