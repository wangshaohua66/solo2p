const DataStore = (function() {
    const STORAGE_KEYS = {
        STORES: 'auto_repair_stores',
        VEHICLES: 'auto_repair_vehicles',
        ORDERS: 'auto_repair_orders',
        ORDER_ITEMS: 'auto_repair_order_items',
        PACKAGES: 'auto_repair_packages',
        PACKAGE_ITEMS: 'auto_repair_package_items',
        MEMBERS: 'auto_repair_members',
        MEMBER_TRANSACTIONS: 'auto_repair_member_transactions',
        SERVICE_ITEMS: 'auto_repair_service_items',
        TECHNICIANS: 'auto_repair_technicians',
        CURRENT_STORE: 'auto_repair_current_store',
        STATUS_HISTORY: 'auto_repair_status_history',
        ORDERS_ARCHIVE: 'auto_repair_orders_archive'
    };

    const MAX_VEHICLES = 2000;
    const MAX_ORDERS = 10000;
    const STORAGE_LIMIT = 5 * 1024 * 1024;
    const STORAGE_WARNING = 4.5 * 1024 * 1024;

    let dataCache = {};
    let indexes = {
        vehicles: {
            byPlateNo: new Map(),
            byPhone: new Map()
        },
        orders: {
            byId: new Map(),
            byVehicleId: new Map(),
            byMemberId: new Map(),
            byStoreAndDate: new Map(),
            byStatus: new Map()
        },
        members: {
            byPhone: new Map(),
            byId: new Map()
        },
        packages: {
            byId: new Map(),
            byType: new Map()
        },
        orderItems: {
            byOrderId: new Map()
        },
        packageItems: {
            byPackageId: new Map()
        }
    };

    function generateId(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function getStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith('auto_repair_')) {
                total += localStorage[key].length * 2;
            }
        }
        return total;
    }

    function checkStorageCapacity() {
        const size = getStorageSize();
        if (size > STORAGE_WARNING) {
            console.warn('LocalStorage usage exceeds 4.5MB, current:', (size / 1024 / 1024).toFixed(2), 'MB');
            archiveOldData();
        }
        if (size > STORAGE_LIMIT) {
            throw new Error('LocalStorage capacity exceeded 5MB');
        }
    }

    function archiveOldData() {
        const orders = getData('orders');
        if (orders.length > MAX_ORDERS) {
            const toArchive = orders.slice(0, 1000);
            const remaining = orders.slice(1000);
            const archive = getData('orders_archive') || [];
            saveData('orders_archive', [...archive, ...toArchive]);
            saveData('orders', remaining);
            rebuildIndexes();
        }
    }

    function saveData(key, data) {
        checkStorageCapacity();
        const storageKey = STORAGE_KEYS[key.toUpperCase()] || key;
        localStorage.setItem(storageKey, JSON.stringify(data));
        dataCache[key] = data;
    }

    function getData(key) {
        if (dataCache[key] !== undefined) {
            return dataCache[key];
        }
        const storageKey = STORAGE_KEYS[key.toUpperCase()] || key;
        const data = localStorage.getItem(storageKey);
        dataCache[key] = data ? JSON.parse(data) : [];
        return dataCache[key];
    }

    function removeData(key) {
        const storageKey = STORAGE_KEYS[key.toUpperCase()] || key;
        localStorage.removeItem(storageKey);
        delete dataCache[key];
    }

    function buildVehicleIndexes() {
        indexes.vehicles.byPlateNo.clear();
        indexes.vehicles.byPhone.clear();
        const vehicles = getData('vehicles');
        vehicles.forEach(v => {
            indexes.vehicles.byPlateNo.set(v.plateNo, v);
            const existing = indexes.vehicles.byPhone.get(v.ownerPhone) || [];
            existing.push(v);
            indexes.vehicles.byPhone.set(v.ownerPhone, existing);
        });
    }

    function buildOrderIndexes() {
        indexes.orders.byId.clear();
        indexes.orders.byVehicleId.clear();
        indexes.orders.byMemberId.clear();
        indexes.orders.byStoreAndDate.clear();
        indexes.orders.byStatus.clear();

        const orders = getData('orders');
        orders.forEach(o => {
            indexes.orders.byId.set(o.id, o);

            const vehicleOrders = indexes.orders.byVehicleId.get(o.vehicleId) || [];
            vehicleOrders.push(o);
            indexes.orders.byVehicleId.set(o.vehicleId, vehicleOrders);

            if (o.memberId) {
                const memberOrders = indexes.orders.byMemberId.get(o.memberId) || [];
                memberOrders.push(o);
                indexes.orders.byMemberId.set(o.memberId, memberOrders);
            }

            const dateKey = o.storeId + '_' + new Date(o.createdAt).toISOString().split('T')[0];
            const dateOrders = indexes.orders.byStoreAndDate.get(dateKey) || [];
            dateOrders.push(o);
            indexes.orders.byStoreAndDate.set(dateKey, dateOrders);

            const statusOrders = indexes.orders.byStatus.get(o.status) || [];
            statusOrders.push(o);
            indexes.orders.byStatus.set(o.status, statusOrders);
        });
    }

    function buildMemberIndexes() {
        indexes.members.byPhone.clear();
        indexes.members.byId.clear();
        const members = getData('members');
        members.forEach(m => {
            indexes.members.byPhone.set(m.phone, m);
            indexes.members.byId.set(m.id, m);
        });
    }

    function buildPackageIndexes() {
        indexes.packages.byId.clear();
        indexes.packages.byType.clear();
        const packages = getData('packages');
        packages.forEach(p => {
            indexes.packages.byId.set(p.id, p);
            const typePackages = indexes.packages.byType.get(p.type) || [];
            typePackages.push(p);
            indexes.packages.byType.set(p.type, typePackages);
        });

        indexes.packageItems.byPackageId.clear();
        const packageItems = getData('package_items');
        packageItems.forEach(pi => {
            const items = indexes.packageItems.byPackageId.get(pi.packageId) || [];
            items.push(pi);
            indexes.packageItems.byPackageId.set(pi.packageId, items);
        });
    }

    function buildOrderItemIndexes() {
        indexes.orderItems.byOrderId.clear();
        const orderItems = getData('order_items');
        orderItems.forEach(oi => {
            const items = indexes.orderItems.byOrderId.get(oi.orderId) || [];
            items.push(oi);
            indexes.orderItems.byOrderId.set(oi.orderId, items);
        });
    }

    function rebuildIndexes() {
        buildVehicleIndexes();
        buildOrderIndexes();
        buildMemberIndexes();
        buildPackageIndexes();
        buildOrderItemIndexes();
    }

    function hasData() {
        return localStorage.getItem(STORAGE_KEYS.VEHICLES) !== null;
    }

    function loadInitialData(initialData) {
        Object.keys(initialData).forEach(key => {
            saveData(key, initialData[key]);
        });
        rebuildIndexes();
    }

    function create(type, data) {
        const items = getData(type);
        if (type === 'vehicles' && items.length >= MAX_VEHICLES) {
            throw new Error('Vehicle record limit reached (' + MAX_VEHICLES + ')');
        }
        if (type === 'orders' && items.length >= MAX_ORDERS) {
            archiveOldData();
        }
        const newItem = {
            id: data.id || generateId(type),
            ...data,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        items.push(newItem);
        saveData(type, items);
        rebuildIndexes();
        return newItem;
    }

    function update(type, id, data) {
        const items = getData(type);
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return null;
        items[index] = {
            ...items[index],
            ...data,
            updatedAt: new Date().toISOString()
        };
        saveData(type, items);
        rebuildIndexes();
        return items[index];
    }

    function remove(type, id) {
        const items = getData(type);
        const filtered = items.filter(item => item.id !== id);
        if (filtered.length === items.length) return false;
        saveData(type, filtered);
        rebuildIndexes();
        return true;
    }

    function findById(type, id) {
        if (type === 'orders') {
            return indexes.orders.byId.get(id) || null;
        }
        if (type === 'members') {
            return indexes.members.byId.get(id) || null;
        }
        if (type === 'packages') {
            return indexes.packages.byId.get(id) || null;
        }
        return getData(type).find(item => item.id === id) || null;
    }

    function findByIndex(type, indexName, key) {
        if (indexes[type] && indexes[type][indexName]) {
            return indexes[type][indexName].get(key) || null;
        }
        return null;
    }

    function findAll(type, filters = {}) {
        let items = getData(type);
        Object.keys(filters).forEach(key => {
            items = items.filter(item => item[key] === filters[key]);
        });
        return items;
    }

    function searchVehicles(keyword) {
        const startTime = performance.now();
        keyword = keyword.toUpperCase();
        let results;

        if (keyword.length <= 2) {
            results = Array.from(indexes.vehicles.byPlateNo.values())
                .filter(v => v.plateNo.startsWith(keyword));
        } else {
            results = Array.from(indexes.vehicles.byPlateNo.values())
                .filter(v => v.plateNo.includes(keyword) ||
                    v.ownerName.includes(keyword) ||
                    v.ownerPhone.includes(keyword));
        }

        const elapsed = performance.now() - startTime;
        if (elapsed > 200) {
            console.warn('Vehicle search took', elapsed, 'ms, exceeds 200ms limit');
        }
        return results;
    }

    function getCurrentStore() {
        return localStorage.getItem(STORAGE_KEYS.CURRENT_STORE) || 'store_1';
    }

    function setCurrentStore(storeId) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_STORE, storeId);
    }

    function addStatusHistory(orderId, status, operator) {
        const history = getData('status_history');
        history.push({
            id: generateId('history'),
            orderId,
            status,
            operator,
            timestamp: new Date().toISOString()
        });
        saveData('status_history', history);
    }

    function getStatusHistory(orderId) {
        return getData('status_history')
            .filter(h => h.orderId === orderId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    function exportBackup() {
        const backup = {};
        Object.keys(STORAGE_KEYS).forEach(key => {
            const storageKey = STORAGE_KEYS[key];
            const data = localStorage.getItem(storageKey);
            if (data) {
                backup[storageKey] = JSON.parse(data);
            }
        });
        return JSON.stringify(backup, null, 2);
    }

    function importBackup(backupJson) {
        try {
            const backup = JSON.parse(backupJson);
            Object.keys(backup).forEach(key => {
                localStorage.setItem(key, JSON.stringify(backup[key]));
            });
            dataCache = {};
            rebuildIndexes();
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    }

    function clearAll() {
        Object.keys(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(STORAGE_KEYS[key]);
        });
        dataCache = {};
        rebuildIndexes();
    }

    function init() {
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('auto_repair_')) {
                const key = Object.keys(STORAGE_KEYS).find(k => STORAGE_KEYS[k] === e.key);
                if (key) {
                    dataCache[key.toLowerCase()] = e.newValue ? JSON.parse(e.newValue) : [];
                    rebuildIndexes();
                    $(document).trigger('dataSynced', { key: key.toLowerCase() });
                }
            }
        });
    }

    return {
        STORAGE_KEYS,
        generateId,
        hasData,
        loadInitialData,
        buildIndexes: rebuildIndexes,
        create,
        update,
        remove,
        findById,
        findByIndex,
        findAll,
        searchVehicles,
        getCurrentStore,
        setCurrentStore,
        addStatusHistory,
        getStatusHistory,
        getStorageSize,
        exportBackup,
        importBackup,
        clearAll,
        init,
        indexes
    };
})();
