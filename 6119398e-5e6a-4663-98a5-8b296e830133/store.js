class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(event, callback, priority = 10) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push({ callback, priority });
        this._listeners.get(event).sort((a, b) => a.priority - b.priority);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this._listeners.has(event)) return;
        const stack = this._listeners.get(event);
        const idx = stack.findIndex(l => l.callback === callback);
        if (idx > -1) stack.splice(idx, 1);
    }

    emit(event, data = {}) {
        if (!this._listeners.has(event)) return;
        const stack = this._listeners.get(event);
        for (const { callback } of stack) {
            try {
                callback(data, event);
            } catch (err) {
                console.error(`[EventBus] 事件 ${event} 处理器错误:`, err);
            }
        }
    }

    once(event, callback) {
        const wrapper = (data, evt) => {
            this.off(event, wrapper);
            callback(data, evt);
        };
        this.on(event, wrapper);
    }
}

class IndexedDBAdapter {
    constructor(dbName = 'jewelry_recycle', version = 3) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this._ready = this._init();
        this._storePrefix = '';
    }

    setStorePrefix(storeId) {
        this._storePrefix = storeId ? (storeId + ':') : '';
    }

    _scopedStoreName(baseName) {
        return this._storePrefix ? `${this._storePrefix}${baseName}` : baseName;
    }

    _init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.version);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
                this.db = req.result;
                resolve(this.db);
            };
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                const createStoresForPrefix = (prefix) => {
                    const recName = prefix ? `${prefix}records` : 'records';
                    const prcName = prefix ? `${prefix}prices` : 'prices';
                    const dftName = prefix ? `${prefix}drafts` : 'drafts';
                    if (!db.objectStoreNames.contains(recName)) {
                        const os = db.createObjectStore(recName, { keyPath: 'orderNo' });
                        os.createIndex('storeId', 'storeId', { unique: false });
                        os.createIndex('customer', 'customer.name', { unique: false });
                        os.createIndex('category', 'category', { unique: false });
                        os.createIndex('createdAt', 'createdAt', { unique: false });
                        os.createIndex('status', 'status', { unique: false });
                        os.createIndex('synced', 'synced', { unique: false });
                    }
                    if (!db.objectStoreNames.contains(prcName)) {
                        const p = db.createObjectStore(prcName, { keyPath: 'key' });
                        p.createIndex('fetchedAt', 'fetchedAt', { unique: false });
                    }
                    if (!db.objectStoreNames.contains(dftName)) {
                        db.createObjectStore(dftName, { keyPath: 'id' });
                    }
                };
                createStoresForPrefix('');
                const storeIds = ['store001','store002','store003','store004','store005','store006','store007','store008','store009','store010','store011','store012','store013','store014','store015','store016','store017','store018'];
                storeIds.forEach(sid => createStoresForPrefix(sid + ':'));
            };
        });
    }

    async ready() { await this._ready; return this; }

    _tx(storeName, mode = 'readonly') {
        const scoped = this._scopedStoreName(storeName);
        if (!this.db.objectStoreNames.contains(scoped)) {
            console.warn(`[IDB] 对象存储 ${scoped} 不存在, 回退到默认`);
            return this.db.transaction(storeName, mode).objectStore(storeName);
        }
        return this.db.transaction(scoped, mode).objectStore(scoped);
    }

    async put(storeName, value) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const req = this._tx(storeName, 'readwrite').put(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async get(storeName, key) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const req = this._tx(storeName).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getAll(storeName) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const req = this._tx(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async delete(storeName, key) {
        await this.ready();
        return new Promise((resolve, reject) => {
            const req = this._tx(storeName, 'readwrite').delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async query(storeName, predicate) {
        const all = await this.getAll(storeName);
        const t0 = performance.now();
        const result = all.filter(predicate || (() => true));
        const t1 = performance.now();
        if (t1 - t0 > 80) console.warn(`[Store] 查询耗时偏高: ${(t1 - t0).toFixed(1)}ms, 记录数: ${all.length}`);
        return result;
    }

    async count(storeName, predicate) {
        const data = predicate ? await this.query(storeName, predicate) : await this.getAll(storeName);
        return data.length;
    }
}

class LocalStorageAdapter {
    constructor(basePrefix = 'jw_') {
        this.basePrefix = basePrefix;
        this._storePrefix = '';
    }

    setStorePrefix(storeId) {
        this._storePrefix = storeId ? (storeId + '_') : '';
    }

    _fullKey(key) {
        return this.basePrefix + this._storePrefix + key;
    }

    set(key, value) {
        try {
            localStorage.setItem(this._fullKey(key), JSON.stringify(value));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[LocalStorage] 存储空间已满, 尝试清理...');
                this._cleanup();
                try { localStorage.setItem(this._fullKey(key), JSON.stringify(value)); return true; }
                catch (_) { return false; }
            }
            return false;
        }
    }

    get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(this._fullKey(key));
            return raw ? JSON.parse(raw) : fallback;
        } catch { return fallback; }
    }

    remove(key) { localStorage.removeItem(this._fullKey(key)); }

    _cleanup() {
        const fullPfx = this.basePrefix + this._storePrefix;
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(fullPfx)) keys.push(k);
        }
        keys.sort((a, b) => {
            try {
                const va = JSON.parse(localStorage.getItem(a) || '{}');
                const vb = JSON.parse(localStorage.getItem(b) || '{}');
                return (va._ts || 0) - (vb._ts || 0);
            } catch { return 0; }
        });
        for (let i = 0; i < Math.ceil(keys.length * 0.3); i++) {
            localStorage.removeItem(keys[i]);
        }
    }
}

export const AppStore = (() => {
    const bus = new EventBus();
    const GLOBAL_STORE_KEY = '__global_store__';

    const globalLs = (() => {
        const PFX = 'jw_';
        return {
            get(k, fb = null) { try { const r = localStorage.getItem(PFX + GLOBAL_STORE_KEY + '_' + k); return r ? JSON.parse(r) : fb; } catch { return fb; } },
            set(k, v) { try { localStorage.setItem(PFX + GLOBAL_STORE_KEY + '_' + k, JSON.stringify(v)); return true; } catch { return false; } }
        };
    })();

    const idb = new IndexedDBAdapter();
    const ls = new LocalStorageAdapter('jw_');

    const defaultState = () => ({
        currentStoreId: globalLs.get('currentStore', 'store001'),
        currentInspector: globalLs.get('inspector', { id: 'INS001', name: '张鉴定师' }),
        goldPrices: { au9999: 0, au9995: 0, pt950: 0, pd999: 0, fetchedAt: null },
        diamondPriceList: null,
        adjustCoefficients: { gold: 0.96, platinum: 0.95, diamond: 0.92, jade: 0.85, pearl: 0.8 },
        depreciationConfig: {
            '9999': 0.98, '9995': 0.97, '990': 0.95, '916': 0.90, '750': 0.80, '585': 0.65,
            PT950: 0.95, PT900: 0.90, PD950: 0.92
        },
        approvalThreshold: 30000,
        currentRecycle: null,
        filters: {},
        uiState: {
            currentPage: 'recycle',
            showFilter: false,
            manualAdjust: false
        },
        sync: {
            pending: [],
            conflicts: [],
            isOnline: navigator.onLine
        },
        priceAdjustOverride: {},
        managerAuthCodes: { MGR001: '臻品汇2024', MGR002: '臻品汇2024', MGR003: '臻品汇2024' }
    });

    let _state = null;

    function _loadStoreScopedState(storeId) {
        idb.setStorePrefix(storeId);
        ls.setStorePrefix(storeId);
        const base = defaultState();
        _state = {
            ...base,
            currentStoreId: storeId,
            goldPrices: ls.get('goldPrices', base.goldPrices),
            diamondPriceList: ls.get('diamondPrices', null),
            adjustCoefficients: ls.get('adjustCoef', base.adjustCoefficients),
            depreciationConfig: ls.get('depreciation', base.depreciationConfig),
            approvalThreshold: ls.get('threshold', 30000),
            filters: ls.get('historyFilters', {})
        };
    }

    _loadStoreScopedState(globalLs.get('currentStore', 'store001'));

    function _getState() { return _state; }

    function _setState(patch) {
        _state = Object.assign({}, _state, patch);
        bus.emit('state:change', { state: _state, patch });
        Object.keys(patch).forEach(k => bus.emit(`state:${k}`, { key: k, value: patch[k] }));
    }

    function generateOrderNo(storeId) {
        const sid = (storeId || _state.currentStoreId).replace(/[^\d]/g, '').padStart(3, '0');
        const d = new Date();
        const ds = d.getFullYear().toString().slice(2) +
            String(d.getMonth() + 1).padStart(2, '0') +
            String(d.getDate()).padStart(2, '0');
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `HC${sid}${ds}${rand}`;
    }

    async function saveRecord(record) {
        record.storeId = record.storeId || _state.currentStoreId;
        record.inspector = record.inspector || _state.currentInspector;
        record.updatedAt = Date.now();
        if (!record.createdAt) record.createdAt = Date.now();
        if (!record.orderNo) record.orderNo = generateOrderNo(record.storeId);
        record.synced = navigator.onLine ? (record.synced || false) : false;

        await idb.put('records', record);
        _cacheUpdate(record);

        bus.emit('record:saved', { record });
        if (record.status === 'pending' && (record.finalPrice || 0) > _state.approvalThreshold) {
            bus.emit('approval:requested', { record });
        }
        return record;
    }

    function _cacheUpdate(record) {
        const cache = ls.get('recentRecords', []);
        const idx = cache.findIndex(r => r.orderNo === record.orderNo);
        const mini = {
            orderNo: record.orderNo, category: record.category, customerName: record.customer?.name,
            finalPrice: record.finalPrice, status: record.status, createdAt: record.createdAt, storeId: record.storeId
        };
        if (idx > -1) cache[idx] = mini;
        else cache.unshift(mini);
        ls.set('recentRecords', cache.slice(0, 100));
    }

    async function getRecord(orderNo) {
        let r = await idb.get('records', orderNo);
        if (!r) {
            const cache = ls.get('recentRecords', []);
            const m = cache.find(x => x.orderNo === orderNo);
            if (m) r = await idb.get('records', orderNo);
        }
        return r;
    }

    async function queryRecords(filters = {}) {
        const predicate = (r) => {
            if (filters.storeId && r.storeId !== filters.storeId) return false;
            if (filters.status && r.status !== filters.status) return false;
            if (filters.category && r.category !== filters.category) return false;
            if (filters.orderNo && !r.orderNo.toLowerCase().includes(filters.orderNo.toLowerCase())) return false;
            if (filters.customer && r.customer?.name && !r.customer.name.includes(filters.customer)) return false;
            if (filters.startDate && r.createdAt < filters.startDate) return false;
            if (filters.endDate && r.createdAt > filters.endDate + 86400000) return false;
            return true;
        };
        const t0 = performance.now();
        const list = await idb.query('records', predicate);
        const t1 = performance.now();
        console.debug(`[Store] 查询完成, 返回 ${list.length} 条, 耗时 ${(t1 - t0).toFixed(1)}ms`);
        return list.sort((a, b) => b.createdAt - a.createdAt);
    }

    async function updateRecordStatus(orderNo, status, extra = {}) {
        const r = await getRecord(orderNo);
        if (!r) return null;
        Object.assign(r, { status }, extra, { updatedAt: Date.now() });
        await saveRecord(r);
        bus.emit('record:statusChanged', { orderNo, status, record: r });
        return r;
    }

    async function saveGoldPrices(prices) {
        prices.key = 'current';
        prices.fetchedAt = Date.now();
        try { await idb.put('prices', prices); } catch {}
        _setState({ goldPrices: prices });
        ls.set('goldPrices', { ...prices, _ts: Date.now() });
        bus.emit('goldPrices:updated', prices);
    }

    async function saveDiamondPriceList(data) {
        _setState({ diamondPriceList: data });
        ls.set('diamondPrices', { ...data, _ts: Date.now() });
        bus.emit('diamondPrices:updated', data);
    }

    function setAdjustCoefficients(coef) {
        _setState({ adjustCoefficients: Object.assign({}, _state.adjustCoefficients, coef) });
        ls.set('adjustCoef', _state.adjustCoefficients);
        bus.emit('config:adjustChanged', _state.adjustCoefficients);
    }

    function setDepreciationConfig(cfg) {
        _setState({ depreciationConfig: Object.assign({}, _state.depreciationConfig, cfg) });
        ls.set('depreciation', _state.depreciationConfig);
    }

    function setCurrentStore(storeId) {
        globalLs.set('currentStore', storeId);
        _loadStoreScopedState(storeId);
        bus.emit('store:changed', { storeId });
        bus.emit('state:change', { state: _state, patch: { currentStoreId: storeId } });
    }

    function verifyManagerAuth(tokenOrCode) {
        const s = String(tokenOrCode || '').trim();
        if (!s) return { success: false, reason: 'empty' };
        const codes = _state.managerAuthCodes || {};
        for (const [mgrId, expectedCode] of Object.entries(codes)) {
            if (s === expectedCode || s === mgrId + ':' + expectedCode) {
                return { success: true, managerId: mgrId, authorizedAt: Date.now() };
            }
        }
        if (/^MGR\d{3,}/.test(s)) {
            const testCode = s.replace(/^MGR\d+[:#]?/, '');
            for (const expected of Object.values(codes)) {
                if (testCode === expected) {
                    return { success: true, managerId: s.split(/[:#]/)[0], authorizedAt: Date.now() };
                }
            }
        }
        return { success: false, reason: 'invalid' };
    }

    function setCurrentPage(page) {
        _state.uiState.currentPage = page;
        bus.emit('ui:pageChanged', { page });
    }

    async function saveDraft(draft) {
        draft.id = draft.id || 'draft_' + Date.now();
        draft._ts = Date.now();
        await idb.put('drafts', draft);
        return draft;
    }

    async function getDrafts() {
        return (await idb.getAll('drafts')).sort((a, b) => (b._ts || 0) - (a._ts || 0));
    }

    async function deleteDraft(id) { return idb.delete('drafts', id); }

    async function getAllStats() {
        const all = await idb.getAll('records');
        const local = all.length;
        const pendingSync = all.filter(r => !r.synced).length;
        const conflicts = _state.sync.conflicts.length;
        return { local, pendingSync, conflicts, online: navigator.onLine };
    }

    async function markSynced(orderNos) {
        for (const no of orderNos) {
            const r = await getRecord(no);
            if (r) { r.synced = true; await idb.put('records', r); }
        }
        bus.emit('sync:done', { count: orderNos.length });
    }

    async function simulateSync() {
        const pending = (await idb.getAll('records')).filter(r => !r.synced);
        const randFail = pending.filter(() => Math.random() < 0.05);
        const conflicts = randFail.map(r => ({
            orderNo: r.orderNo,
            local: r,
            remote: { ...r, finalPrice: Math.round(r.finalPrice * (0.95 + Math.random() * 0.1)), lastModified: Date.now() + Math.floor(Math.random() * 3600000) },
            resolved: false
        }));
        _state.sync.conflicts.push(...conflicts);
        const success = pending.filter(r => !conflicts.find(c => c.orderNo === r.orderNo));
        await markSynced(success.map(r => r.orderNo));
        bus.emit('sync:completed', { successCount: success.length, conflicts: conflicts.length });
        return { success: success.length, conflicts: conflicts.length };
    }

    function resolveConflict(orderNo, choose = 'local') {
        const idx = _state.sync.conflicts.findIndex(c => c.orderNo === orderNo);
        if (idx === -1) return null;
        const c = _state.sync.conflicts[idx];
        const result = choose === 'local' ? c.local : c.remote;
        result.synced = true;
        result.resolvedConflict = true;
        _state.sync.conflicts.splice(idx, 1);
        saveRecord(result);
        bus.emit('sync:conflictResolved', { orderNo, choice: choose });
        return result;
    }

    return {
        events: bus,
        idb,
        ls,
        globalLs,
        getState: _getState,
        setState: _setState,
        generateOrderNo,
        saveRecord,
        getRecord,
        queryRecords,
        updateRecordStatus,
        saveGoldPrices,
        saveDiamondPriceList,
        setAdjustCoefficients,
        setDepreciationConfig,
        setCurrentStore,
        verifyManagerAuth,
        setCurrentPage,
        saveDraft,
        getDrafts,
        deleteDraft,
        getAllStats,
        markSynced,
        simulateSync,
        resolveConflict
    };
})();

export default AppStore;
