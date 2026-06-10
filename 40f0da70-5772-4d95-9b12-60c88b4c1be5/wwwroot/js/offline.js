(function ($) {
  'use strict';

  const DB_NAME = 'CampHub_Offline';
  const DB_VERSION = 1;
  const STORE_OUTBOX = 'outbox';
  const STORE_CACHE = 'cache';

  var db = null;
  var onlineStatus = navigator.onLine;
  var syncInProgress = false;

  function initDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_OUTBOX)) {
          var outbox = d.createObjectStore(STORE_OUTBOX, { keyPath: 'id', autoIncrement: true });
          outbox.createIndex('entityType', 'entityType', { unique: false });
          outbox.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!d.objectStoreNames.contains(STORE_CACHE)) {
          var cache = d.createObjectStore(STORE_CACHE, { keyPath: 'key' });
          cache.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = function (e) { db = e.target.result; resolve(db); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function addOutbox(entityType, operation, data, endpoint, method) {
    return new Promise(function (resolve, reject) {
      if (!db) { reject(new Error('DB not ready')); return; }
      var tx = db.transaction(STORE_OUTBOX, 'readwrite');
      var store = tx.objectStore(STORE_OUTBOX);
      var item = {
        entityType: entityType,
        operation: operation,
        data: data,
        endpoint: endpoint,
        method: method || 'POST',
        createdAt: Date.now(),
        retries: 0,
        status: 'pending'
      };
      var req = store.add(item);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getAllOutbox() {
    return new Promise(function (resolve, reject) {
      if (!db) { resolve([]); return; }
      var tx = db.transaction(STORE_OUTBOX, 'readonly');
      var store = tx.objectStore(STORE_OUTBOX);
      var req = store.getAll();
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function removeOutboxItem(id) {
    return new Promise(function (resolve) {
      if (!db) { resolve(); return; }
      var tx = db.transaction(STORE_OUTBOX, 'readwrite');
      tx.objectStore(STORE_OUTBOX).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { resolve(); };
    });
  }

  function updateOutboxItem(id, updates) {
    return new Promise(function (resolve, reject) {
      if (!db) { reject(); return; }
      var tx = db.transaction(STORE_OUTBOX, 'readwrite');
      var store = tx.objectStore(STORE_OUTBOX);
      var getReq = store.get(id);
      getReq.onsuccess = function () {
        var item = getReq.result;
        if (!item) { resolve(null); return; }
        Object.assign(item, updates);
        var putReq = store.put(item);
        putReq.onsuccess = function () { resolve(item); };
        putReq.onerror = function () { reject(putReq.error); };
      };
    });
  }

  async function syncAll() {
    if (syncInProgress || !onlineStatus) return [];
    syncInProgress = true;

    var results = [];
    try {
      var items = await getAllOutbox();
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        try {
          await CampHub.ajax.request(item.method, item.endpoint, item.data, { skipOfflineQueue: true });
          await removeOutboxItem(item.id);
          results.push({ id: item.id, success: true });
        } catch (err) {
          item.retries = (item.retries || 0) + 1;
          item.lastError = err.message || 'failed';
          if (item.retries >= 5) item.status = 'failed';
          await updateOutboxItem(item.id, item);
          results.push({ id: item.id, success: false, error: err.message });
        }
      }
    } finally {
      syncInProgress = false;
    }

    if (results.length > 0) {
      $(document).trigger('campHub:syncComplete', [results]);
    }
    return results;
  }

  function isOnline() { return onlineStatus; }

  function setCache(key, value) {
    return new Promise(function (resolve) {
      if (!db) { resolve(); return; }
      var tx = db.transaction(STORE_CACHE, 'readwrite');
      tx.objectStore(STORE_CACHE).put({ key: key, value: value, updatedAt: Date.now() });
      tx.oncomplete = function () { resolve(); };
    });
  }

  function getCache(key) {
    return new Promise(function (resolve) {
      if (!db) { resolve(null); return; }
      var tx = db.transaction(STORE_CACHE, 'readonly');
      var req = tx.objectStore(STORE_CACHE).get(key);
      req.onsuccess = function () { resolve(req.result ? req.result.value : null); };
      req.onerror = function () { resolve(null); };
    });
  }

  $(window).on('online', function () {
    onlineStatus = true;
    CampHub.ui.toast('网络已恢复，正在同步离线数据...', 'success');
    setTimeout(syncAll, 1000);
  });

  $(window).on('offline', function () {
    onlineStatus = false;
    CampHub.ui.toast('网络已断开，操作将在恢复后自动同步', 'warning');
  });

  window.CampHub = window.CampHub || {};
  CampHub.offline = {
    init: initDB,
    addOutbox: addOutbox,
    getAll: getAllOutbox,
    remove: removeOutboxItem,
    syncAll: syncAll,
    isOnline: isOnline,
    setCache: setCache,
    getCache: getCache
  };

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').then(function (reg) {
        console.log('ServiceWorker registered:', reg.scope);
      }).catch(function (err) {
        console.warn('ServiceWorker registration failed:', err);
      });
    });
  }

  initDB().catch(function (err) {
    console.warn('IndexedDB init failed:', err);
  });

  if (navigator.serviceWorker && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(function (reg) {
      $(document).on('campHub:offlineAction', function () {
        reg.sync.register('sync-outbox').catch(function () {});
      });
    }).catch(function () {});
  }

  $(function () {
    if (!onlineStatus) {
      setTimeout(function () {
        CampHub.ui.toast('当前处于离线模式，数据将在网络恢复后同步', 'warning');
      }, 800);
    }
  });
})(jQuery);
