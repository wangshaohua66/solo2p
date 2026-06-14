(function (global) {
    'use strict';

    const Storage = {};
    const KEYS = Utils.CONSTANTS.STORAGE_KEYS;

    Storage.isAvailable = function () {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    };

    Storage.get = function (key, defaultValue) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return defaultValue !== undefined ? defaultValue : null;
            return JSON.parse(raw);
        } catch (e) {
            console.error('Storage get error:', key, e);
            return defaultValue !== undefined ? defaultValue : null;
        }
    };

    Storage.set = function (key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', key, e);
            Utils.showToast('本地存储失败：' + e.message, 'danger');
            return false;
        }
    };

    Storage.remove = function (key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', key, e);
            return false;
        }
    };

    Storage.clearAll = function () {
        const keysToKeep = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('vet_clinic_')) {
                keysToKeep.push(key);
            }
        }
        keysToKeep.forEach(function (k) { localStorage.removeItem(k); });
    };

    Storage.getSize = function () {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2;
            }
        }
        return total;
    };

    Storage.getVersion = function () {
        return Storage.get(KEYS.VERSION, '0.0.0');
    };

    Storage.setVersion = function (version) {
        Storage.set(KEYS.VERSION, version);
    };

    Storage.migrate = function () {
        const currentVersion = Storage.getVersion();
        const targetVersion = Utils.CONSTANTS.CURRENT_VERSION;
        if (currentVersion === targetVersion) return;

        if (currentVersion === '0.0.0') {
            Storage.initializeWithSeedData();
        }

        Storage.setVersion(targetVersion);
    };

    Storage.initializeWithSeedData = function () {
        const branchNames = ['总院', '朝阳分院', '海淀分院', '东城分院', '西城分院', '丰台分院',
            '通州分院', '昌平分院', '大兴分院', '顺义分院', '房山分院', '石景山分院'];
        const branches = branchNames.map(function (name, idx) {
            return {
                id: 'branch_' + (idx + 1),
                name: name,
                address: '北京市XX区XX路' + (idx + 1) + '号',
                phone: '010-' + String(80000000 + idx * 111).slice(0, 8)
            };
        });
        Storage.set(KEYS.BRANCHES, branches);

        const vetNames = [
            '张明华', '李芳', '王建国', '刘婷婷', '陈伟', '杨雪',
            '赵志强', '黄丽', '周涛', '吴敏', '徐磊', '孙静',
            '马超', '朱琳', '胡斌', '郭燕', '林峰', '何雯'
        ];
        const qualIds = ['chief_vet', 'senior_vet', 'vet', 'vet', 'associate_vet', 'vet'];
        const receptionistNames = ['王小丽', '李娜', '张雪', '刘芳'];
        const assistantNames = ['陈小明', '李小红', '张小强', '刘小花'];
        const directorNames = ['总院院长', '朝阳院长'];

        const users = [];
        let uid = 1;

        branches.slice(0, 3).forEach(function (branch, bi) {
            directorNames.forEach(function (name, idx) {
                if (bi === 0 && idx === 0) {
                    users.push({
                        id: 'user_' + uid++,
                        name: '王院长',
                        role: 'director',
                        branchId: branch.id,
                        qualification: null,
                        phone: '13800000001'
                    });
                }
            });
        });

        users.push({
            id: 'user_' + uid++,
            name: '李院长',
            role: 'director',
            branchId: 'branch_2',
            qualification: null,
            phone: '13800000002'
        });

        branches.slice(0, 6).forEach(function (branch) {
            vetNames.slice(0, 4).forEach(function (name, idx) {
                users.push({
                    id: 'user_' + uid++,
                    name: name + '(' + branch.name.slice(0, 2) + ')',
                    role: 'vet',
                    branchId: branch.id,
                    qualification: qualIds[idx % qualIds.length],
                    phone: '138' + String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)
                });
            });
        });

        branches.slice(0, 4).forEach(function (branch) {
            receptionistNames.slice(0, 2).forEach(function (name) {
                users.push({
                    id: 'user_' + uid++,
                    name: name,
                    role: 'receptionist',
                    branchId: branch.id,
                    qualification: null,
                    phone: '138' + String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)
                });
            });
        });

        branches.slice(0, 4).forEach(function (branch) {
            assistantNames.slice(0, 2).forEach(function (name) {
                users.push({
                    id: 'user_' + uid++,
                    name: name,
                    role: 'assistant',
                    branchId: branch.id,
                    qualification: null,
                    supervisorId: users.find(function (u) { return u.branchId === branch.id && u.role === 'vet'; })?.id,
                    phone: '138' + String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)
                });
            });
        });

        Storage.set(KEYS.USERS, users);

        const shifts = [];
        const vetUsers = users.filter(function (u) { return u.role === 'vet'; });
        const weekDates = Utils.getWeekDates(new Date());
        vetUsers.forEach(function (vet) {
            weekDates.forEach(function (date, dayIdx) {
                if (dayIdx === 6) return;
                if (Math.random() < 0.7) {
                    const slotIdx = Math.floor(Math.random() * 3);
                    shifts.push({
                        id: 'shift_' + Utils.generateId(),
                        userId: vet.id,
                        branchId: vet.branchId,
                        date: Utils.formatDate(date),
                        slotId: Utils.CONSTANTS.TIME_SLOTS[slotIdx].id,
                        createdAt: new Date().toISOString()
                    });
                }
            });
        });
        Storage.set(KEYS.SHIFTS, shifts);

        const appointments = [];
        const petOwners = ['王先生', '李女士', '张阿姨', '刘先生', '陈小姐', '杨先生',
            '赵女士', '黄先生', '周女士', '吴先生'];
        const petNames = ['豆豆', '小白', '旺财', '咪咪', '大黄', '小黑', '花花', '球球'];
        const petTypes = ['dog', 'cat', 'other'];
        const aptTypes = ['first', 'followup', 'checkup', 'vaccine'];
        const statuses = ['confirmed', 'completed', 'cancelled'];

        for (let i = 0; i < 40; i++) {
            const vet = vetUsers[Math.floor(Math.random() * vetUsers.length)];
            const aptDate = Utils.addDays(new Date(), Math.floor(Math.random() * 10) - 3);
            if (Utils.isPast(aptDate) && Math.random() < 0.3) continue;
            const slotIdx = Math.floor(Math.random() * Utils.CONSTANTS.APPOINTMENT_SLOTS.length);
            appointments.push({
                id: 'apt_' + Utils.generateId(),
                ownerName: petOwners[Math.floor(Math.random() * petOwners.length)],
                phone: '138' + String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8),
                petName: petNames[Math.floor(Math.random() * petNames.length)],
                petType: petTypes[Math.floor(Math.random() * petTypes.length)],
                type: aptTypes[Math.floor(Math.random() * aptTypes.length)],
                vetId: vet.id,
                branchId: vet.branchId,
                date: Utils.formatDate(aptDate),
                time: Utils.CONSTANTS.APPOINTMENT_SLOTS[slotIdx],
                notes: Math.random() < 0.3 ? '常规检查' : '',
                status: statuses[Math.floor(Math.random() * statuses.length)],
                createdAt: new Date().toISOString()
            });
        }
        Storage.set(KEYS.APPOINTMENTS, appointments);

        Storage.set(KEYS.WAITLIST, []);
        Storage.set(KEYS.UNAVAILABLE, []);

        const swapRequests = [];
        if (vetUsers.length >= 2) {
            swapRequests.push({
                id: 'swap_' + Utils.generateId(),
                requesterId: vetUsers[0].id,
                targetId: vetUsers[1].id,
                originalDate: Utils.formatDate(Utils.addDays(new Date(), 2)),
                originalSlot: 'morning',
                targetDate: Utils.formatDate(Utils.addDays(new Date(), 3)),
                targetSlot: 'afternoon',
                reason: '家中有事需要调班',
                status: 'pending',
                createdAt: new Date().toISOString()
            });
        }
        Storage.set(KEYS.SWAP_REQUESTS, swapRequests);

        Storage.set(KEYS.OFFLINE_LOG, []);
        Storage.set(KEYS.SETTINGS, {
            currentBranchId: branches[0].id,
            currentUserId: users.find(function (u) { return u.role === 'director'; })?.id || users[0].id,
            scheduleView: 'week'
        });
    };

    Storage.getBranches = function () { return Storage.get(KEYS.BRANCHES, []); };
    Storage.setBranches = function (v) { return Storage.set(KEYS.BRANCHES, v); };
    Storage.getUsers = function () { return Storage.get(KEYS.USERS, []); };
    Storage.setUsers = function (v) { return Storage.set(KEYS.USERS, v); };
    Storage.getShifts = function () { return Storage.get(KEYS.SHIFTS, []); };
    Storage.setShifts = function (v) { return Storage.set(KEYS.SHIFTS, v); };
    Storage.getAppointments = function () { return Storage.get(KEYS.APPOINTMENTS, []); };
    Storage.setAppointments = function (v) { return Storage.set(KEYS.APPOINTMENTS, v); };
    Storage.getWaitlist = function () { return Storage.get(KEYS.WAITLIST, []); };
    Storage.setWaitlist = function (v) { return Storage.set(KEYS.WAITLIST, v); };
    Storage.getUnavailable = function () { return Storage.get(KEYS.UNAVAILABLE, []); };
    Storage.setUnavailable = function (v) { return Storage.set(KEYS.UNAVAILABLE, v); };
    Storage.getSwapRequests = function () { return Storage.get(KEYS.SWAP_REQUESTS, []); };
    Storage.setSwapRequests = function (v) { return Storage.set(KEYS.SWAP_REQUESTS, v); };
    Storage.getOfflineLog = function () { return Storage.get(KEYS.OFFLINE_LOG, []); };
    Storage.setOfflineLog = function (v) { return Storage.set(KEYS.OFFLINE_LOG, v); };
    Storage.getSettings = function () {
        return Storage.get(KEYS.SETTINGS, { currentBranchId: null, currentUserId: null, scheduleView: 'week' });
    };
    Storage.setSettings = function (v) { return Storage.set(KEYS.SETTINGS, v); };

    Storage.addOfflineLog = function (action, dataType, data) {
        const log = Storage.getOfflineLog();
        log.push({
            id: 'log_' + Utils.generateId(),
            action: action,
            dataType: dataType,
            data: Utils.deepClone(data),
            timestamp: Date.now(),
            synced: false
        });
        Storage.setOfflineLog(log);
    };

    Storage.clearSyncedOfflineLogs = function () {
        const log = Storage.getOfflineLog().filter(function (l) { return !l.synced; });
        Storage.setOfflineLog(log);
    };

    Storage.replayOfflineLogs = function () {
        const log = Utils.sortBy(Storage.getOfflineLog(), 'timestamp');
        const results = [];
        const conflicts = [];

        for (let i = 0; i < log.length; i++) {
            const entry = log[i];
            try {
                let mergeResult = Storage.mergeOfflineChange(entry);
                if (mergeResult.conflict) {
                    conflicts.push({ entry: entry, current: mergeResult.current });
                } else {
                    results.push({ entry: entry, success: true });
                }
            } catch (e) {
                results.push({ entry: entry, success: false, error: e.message });
            }
        }

        return { applied: results, conflicts: conflicts };
    };

    Storage.mergeOfflineChange = function (entry) {
        const getterMap = {
            shifts: Storage.getShifts,
            appointments: Storage.getAppointments,
            waitlist: Storage.getWaitlist,
            unavailable: Storage.getUnavailable,
            swapRequests: Storage.getSwapRequests
        };
        const setterMap = {
            shifts: Storage.setShifts,
            appointments: Storage.setAppointments,
            waitlist: Storage.setWaitlist,
            unavailable: Storage.setUnavailable,
            swapRequests: Storage.setSwapRequests
        };
        const getter = getterMap[entry.dataType];
        const setter = setterMap[entry.dataType];
        if (!getter || !setter) return { conflict: false };

        const list = getter();
        const idx = list.findIndex(function (item) { return item.id === entry.data.id; });

        if (entry.action === 'create' || entry.action === 'update') {
            if (idx >= 0) {
                const existing = list[idx];
                if (existing.updatedAt && entry.data.updatedAt && existing.updatedAt > entry.data.updatedAt) {
                    return { conflict: true, current: existing };
                }
            }
            if (idx >= 0) list[idx] = entry.data; else list.push(entry.data);
            setter(list);
        } else if (entry.action === 'delete') {
            if (idx >= 0) {
                list.splice(idx, 1);
                setter(list);
            }
        }
        return { conflict: false };
    };

    global.Storage = Storage;

})(window);
