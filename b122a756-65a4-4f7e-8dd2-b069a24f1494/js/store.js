var Store = (function () {
  var PREFIX = 'bakery_';
  var VERSION = '1.0.0';
  var KEYS = [
    'data_version', 'stores', 'products', 'processes',
    'workorders', 'inventory', 'members', 'membertx',
    'sales', 'sale_items', 'transfers', 'settings'
  ];
  var listeners = {};

  function key(k) { return PREFIX + k; }

  function get(k, def) {
    try {
      var raw = localStorage.getItem(key(k));
      return raw ? JSON.parse(raw) : (def !== undefined ? def : null);
    } catch (e) {
      console.error('Store.get error', k, e);
      return def !== undefined ? def : null;
    }
  }

  function set(k, v) {
    try {
      localStorage.setItem(key(k), JSON.stringify(v));
      emit(k, v);
      return true;
    } catch (e) {
      console.error('Store.set error', k, e);
      return false;
    }
  }

  function on(ev, fn) {
    if (!listeners[ev]) listeners[ev] = [];
    listeners[ev].push(fn);
  }

  function off(ev, fn) {
    if (!listeners[ev]) return;
    listeners[ev] = listeners[ev].filter(function (f) { return f !== fn; });
  }

  function emit(ev, data) {
    if (!listeners[ev]) return;
    listeners[ev].forEach(function (fn) {
      try { fn(data); } catch (e) { console.error(e); }
    });
  }

  function batchUpdate(patch) {
    Object.keys(patch).forEach(function (k) {
      localStorage.setItem(key(k), JSON.stringify(patch[k]));
    });
    Object.keys(patch).forEach(function (k) { emit(k, patch[k]); });
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function migrate() {
    var v = get('data_version');
    if (v === VERSION) return;
    if (!v) {
      set('data_version', VERSION);
      return;
    }
    set('data_version', VERSION);
  }

  function exportAll() {
    var data = { version: VERSION, exportedAt: new Date().toISOString() };
    KEYS.forEach(function (k) {
      data[k] = get(k);
    });
    return data;
  }

  function importAll(data, overwrite) {
    if (!data || typeof data !== 'object') throw new Error('无效的JSON数据');
    if (!data.version) throw new Error('缺少数据版本号');
    KEYS.forEach(function (k) {
      if (data[k] !== undefined) {
        set(k, data[k]);
      }
    });
    migrate();
    return true;
  }

  function clearAll() {
    KEYS.forEach(function (k) { localStorage.removeItem(key(k)); });
  }

  function exists() {
    return !!get('stores') && !!get('products');
  }

  function listPush(k, item) {
    var arr = get(k, []);
    arr.push(item);
    set(k, arr);
    return item;
  }

  function listUpdate(k, id, patch) {
    var arr = get(k, []);
    var idx = arr.findIndex(function (x) { return x.id === id; });
    if (idx >= 0) {
      arr[idx] = Object.assign({}, arr[idx], patch);
      set(k, arr);
      return arr[idx];
    }
    return null;
  }

  function listRemove(k, id) {
    var arr = get(k, []);
    var filtered = arr.filter(function (x) { return x.id !== id; });
    set(k, filtered);
    return filtered.length < arr.length;
  }

  function listFind(k, predicate) {
    var arr = get(k, []);
    return arr.find(predicate) || null;
  }

  function listFilter(k, predicate) {
    var arr = get(k, []);
    return arr.filter(predicate);
  }

  return {
    PREFIX: PREFIX,
    VERSION: VERSION,
    get: get,
    set: set,
    on: on,
    off: off,
    batchUpdate: batchUpdate,
    uid: uid,
    migrate: migrate,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    exists: exists,
    listPush: listPush,
    listUpdate: listUpdate,
    listRemove: listRemove,
    listFind: listFind,
    listFilter: listFilter
  };
})();
