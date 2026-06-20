var Store = (function () {
  var PREFIX = 'bakery_';
  var VERSION = '1.1.0';
  var KEYS = [
    'data_version', 'stores', 'products', 'processes',
    'workorders', 'inventory', 'members', 'membertx',
    'sales', 'sale_items', 'transfers', 'settings',
    'materials', 'materialtx'
  ];
  var KEY_TYPES = {
    data_version: 'string',
    stores: 'array',
    products: 'array',
    processes: 'array',
    workorders: 'array',
    inventory: 'array',
    members: 'array',
    membertx: 'array',
    sales: 'array',
    sale_items: 'array',
    transfers: 'array',
    settings: 'object',
    materials: 'array',
    materialtx: 'array'
  };
  var MIGRATIONS = {
    '1.0.0_to_1.1.0': function (data) {
      if (!data.materials) data.materials = [];
      if (!data.materialtx) data.materialtx = [];
      if (!data.settings) data.settings = {};
      if (data.products && data.products.length) {
        data.products.forEach(function (p) {
          if (!p.cost) p.cost = Math.round((p.price || 0) * 0.35);
          if (!p.barcode) p.barcode = '69' + String(1000000 + Math.floor(Math.random() * 9000000));
        });
      }
      data.data_version = '1.1.0';
      return data;
    }
  };
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

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function batchUpdate(patch) {
    var keys = Object.keys(patch);
    var backup = {};
    try {
      keys.forEach(function (k) {
        var raw = localStorage.getItem(key(k));
        backup[k] = raw !== null ? JSON.parse(raw) : null;
      });
      keys.forEach(function (k) {
        var serialized = JSON.stringify(patch[k]);
        localStorage.setItem(key(k), serialized);
        if (localStorage.getItem(key(k)) !== serialized) {
          throw new Error('写入失败：localStorage 可能已满');
        }
      });
    } catch (e) {
      console.error('batchUpdate 失败，正在回滚...', e);
      keys.forEach(function (k) {
        try {
          if (backup[k] === null) {
            localStorage.removeItem(key(k));
          } else {
            localStorage.setItem(key(k), JSON.stringify(backup[k]));
          }
        } catch (rbErr) {
          console.error('回滚失败', k, rbErr);
        }
      });
      throw e;
    }
    keys.forEach(function (k) { emit(k, patch[k]); });
    return true;
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getVersionNumber(v) {
    if (!v) return 0;
    var parts = v.split('.').map(Number);
    return parts[0] * 10000 + parts[1] * 100 + (parts[2] || 0);
  }

  function runMigrations(data) {
    var fromVer = data.data_version || '1.0.0';
    var targetVer = VERSION;
    if (fromVer === targetVer) return data;
    var migrationKeys = Object.keys(MIGRATIONS).sort(function (a, b) {
      var aFrom = a.split('_to_')[0];
      var bFrom = b.split('_to_')[0];
      return getVersionNumber(aFrom) - getVersionNumber(bFrom);
    });
    migrationKeys.forEach(function (key) {
      var parts = key.split('_to_');
      var migFrom = parts[0];
      var migTo = parts[1];
      if (getVersionNumber(data.data_version) >= getVersionNumber(migFrom) &&
          getVersionNumber(data.data_version) < getVersionNumber(migTo)) {
        console.log('执行数据迁移：' + migFrom + ' → ' + migTo);
        data = MIGRATIONS[key](data);
      }
    });
    if (data.data_version !== targetVer) {
      data.data_version = targetVer;
    }
    return data;
  }

  function migrate() {
    var v = get('data_version');
    if (v === VERSION) return;
    if (!v) {
      set('data_version', VERSION);
      return;
    }
    var data = {};
    KEYS.forEach(function (k) {
      data[k] = get(k);
    });
    data.data_version = v;
    try {
      var migrated = runMigrations(data);
      Object.keys(migrated).forEach(function (k) {
        if (KEYS.indexOf(k) >= 0 && migrated[k] !== undefined) {
          set(k, migrated[k]);
        }
      });
    } catch (e) {
      console.error('数据迁移失败', e);
      set('data_version', VERSION);
    }
  }

  function exportAll() {
    var data = { version: VERSION, exportedAt: new Date().toISOString() };
    KEYS.forEach(function (k) {
      data[k] = get(k);
    });
    return data;
  }

  function validateData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: '无效的JSON数据格式' };
    }
    if (!data.version) {
      return { valid: false, error: '缺少导出数据版本号' };
    }
    var missing = [];
    var typeErrors = [];
    KEYS.forEach(function (k) {
      if (k === 'data_version') return;
      if (data[k] === undefined) {
        missing.push(k);
        return;
      }
      var expectedType = KEY_TYPES[k];
      if (expectedType && typeOf(data[k]) !== expectedType) {
        typeErrors.push(k + ' 应为 ' + expectedType + '，实际为 ' + typeOf(data[k]));
      }
    });
    if (missing.length > 0) {
      return { valid: false, error: '缺少关键字段: ' + missing.join(', ') };
    }
    if (typeErrors.length > 0) {
      return { valid: false, error: '数据类型错误: ' + typeErrors.join('; ') };
    }
    if (data.stores && data.stores.length > 0) {
      var first = data.stores[0];
      if (!first.id || !first.name) {
        return { valid: false, error: '门店数据格式不正确' };
      }
    }
    if (data.products && data.products.length > 0) {
      var first = data.products[0];
      if (!first.id || !first.name || !first.category) {
        return { valid: false, error: '产品数据格式不正确' };
      }
    }
    return { valid: true, error: null };
  }

  function importAll(data, overwrite) {
    var validation = validateData(data);
    if (!validation.valid) {
      throw new Error('数据校验失败: ' + validation.error);
    }
    var importData = JSON.parse(JSON.stringify(data));
    importData.data_version = data.version || '1.0.0';
    try {
      importData = runMigrations(importData);
    } catch (e) {
      console.error('数据迁移失败', e);
      throw new Error('数据迁移失败: ' + e.message);
    }
    var patch = {};
    KEYS.forEach(function (k) {
      if (importData[k] !== undefined) {
        patch[k] = importData[k];
      }
    });
    try {
      batchUpdate(patch);
    } catch (e) {
      throw new Error('写入失败，已回滚: ' + e.message);
    }
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
