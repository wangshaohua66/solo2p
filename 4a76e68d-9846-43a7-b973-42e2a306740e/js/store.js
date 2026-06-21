var Store = window.Store = (function () {
    const DB_NAME = 'MaternityCenterDB';
    const DB_VERSION = 1;
    let db = null;
    const cache = new Map();

    const STORES = {
        STORES: 'stores',
        ROOMS: 'rooms',
        MOTHERS: 'mothers',
        BOOKINGS: 'bookings',
        STAFF: 'staff',
        NURSING_SHIFTS: 'nursing_shifts',
        MEAL_PLANS: 'meal_plans',
        VISITORS: 'visitors',
        REHAB_APPOINTMENTS: 'rehab_appointments',
        OPERATION_LOGS: 'operation_logs'
    };

    const STORE_CONFIG = [
        { name: STORES.STORES, keyPath: 'id' },
        { name: STORES.ROOMS, keyPath: 'id', indexes: [['storeId', 'storeId'], ['status', 'status'], ['type', 'type']] },
        { name: STORES.MOTHERS, keyPath: 'id', indexes: [['storeId', 'storeId'], ['roomId', 'roomId']] },
        { name: STORES.BOOKINGS, keyPath: 'id', indexes: [['roomId', 'roomId'], ['storeId', 'storeId'], ['status', 'status']] },
        { name: STORES.STAFF, keyPath: 'id', indexes: [['storeId', 'storeId'], ['role', 'role']] },
        { name: STORES.NURSING_SHIFTS, keyPath: 'id', indexes: [['storeId', 'storeId'], ['staffId', 'staffId'], ['shiftDate', 'shiftDate']] },
        { name: STORES.MEAL_PLANS, keyPath: 'id', indexes: [['motherId', 'motherId'], ['date', 'date']] },
        { name: STORES.VISITORS, keyPath: 'id', indexes: [['motherId', 'motherId'], ['storeId', 'storeId'], ['visitDate', 'visitDate']] },
        { name: STORES.REHAB_APPOINTMENTS, keyPath: 'id', indexes: [['staffId', 'staffId'], ['storeId', 'storeId'], ['motherId', 'motherId']] },
        { name: STORES.OPERATION_LOGS, keyPath: 'id', indexes: [['storeId', 'storeId'], ['date', 'date']] }
    ];

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function (e) {
                const database = e.target.result;
                STORE_CONFIG.forEach(function (cfg) {
                    if (!database.objectStoreNames.contains(cfg.name)) {
                        const store = database.createObjectStore(cfg.name, { keyPath: cfg.keyPath });
                        if (cfg.indexes) {
                            cfg.indexes.forEach(function (idx) {
                                store.createIndex(idx[0], idx[1], { unique: false });
                            });
                        }
                    }
                });
            };
            request.onsuccess = function (e) {
                db = e.target.result;
                resolve(db);
            };
            request.onerror = function (e) {
                reject(e.target.error);
            };
        });
    }

    function tx(storeName, mode) {
        return db.transaction(storeName, mode).objectStore(storeName);
    }

    function getAll(storeName) {
        const cacheKey = 'all_' + storeName;
        if (cache.has(cacheKey)) {
            return Promise.resolve(cache.get(cacheKey));
        }
        return new Promise(function (resolve, reject) {
            const request = tx(storeName, 'readonly').getAll();
            request.onsuccess = function (e) {
                const result = e.target.result;
                cache.set(cacheKey, result);
                resolve(result);
            };
            request.onerror = function (e) { reject(e.target.error); };
        });
    }

    function getById(storeName, id) {
        return new Promise(function (resolve, reject) {
            const request = tx(storeName, 'readonly').get(id);
            request.onsuccess = function (e) { resolve(e.target.result); };
            request.onerror = function (e) { reject(e.target.error); };
        });
    }

    function getByIndex(storeName, indexName, value) {
        return new Promise(function (resolve, reject) {
            const store = tx(storeName, 'readonly');
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = function (e) { resolve(e.target.result); };
            request.onerror = function (e) { reject(e.target.error); };
        });
    }

    function add(storeName, data) {
        return new Promise(function (resolve, reject) {
            const request = tx(storeName, 'readwrite').add(data);
            request.onsuccess = function (e) {
                invalidateCache(storeName);
                resolve(data);
            };
            request.onerror = function (e) { reject(e.target.error); };
        });
    }

    function put(storeName, data) {
        return new Promise(function (resolve, reject) {
            const request = tx(storeName, 'readwrite').put(data);
            request.onsuccess = function (e) {
                invalidateCache(storeName);
                resolve(data);
            };
            request.onerror = function (e) { reject(e.target.error); };
        });
    }

    function bulkPut(storeName, dataList) {
        return new Promise(function (resolve, reject) {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            dataList.forEach(function (data) { store.put(data); });
            transaction.oncomplete = function () {
                invalidateCache(storeName);
                resolve(dataList.length);
            };
            transaction.onerror = function (e) { reject(e.target.error); };
        });
    }

    function remove(storeName, id) {
        return new Promise(function (resolve, reject) {
            const request = tx(storeName, 'readwrite').delete(id);
            request.onsuccess = function (e) {
                invalidateCache(storeName);
                resolve(true);
            };
            request.onerror = function (e) { reject(e.target.error); };
        });
    }

    function invalidateCache(storeName) {
        cache.delete('all_' + storeName);
        for (const key of cache.keys()) {
            if (key.startsWith('idx_' + storeName + '_')) {
                cache.delete(key);
            }
        }
    }

    function getCachedByIndex(storeName, indexName, value) {
        const cacheKey = 'idx_' + storeName + '_' + indexName + '_' + value;
        if (cache.has(cacheKey)) {
            return Promise.resolve(cache.get(cacheKey));
        }
        return getByIndex(storeName, indexName, value).then(function (result) {
            cache.set(cacheKey, result);
            return result;
        });
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function addDays(dateStr, days) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        return formatDate(d);
    }

    const STORE_NAMES = ['朝阳旗舰店', '海淀中心店', '西城月坛店', '东城王府井店', '丰台方庄店', '通州北苑店', '昌平回龙观店', '大兴黄村店'];
    const STORE_ADDRESSES = ['朝阳区建国路88号', '海淀区中关村大街15号', '西城区月坛北街12号', '东城区王府井大街33号', '丰台区方庄芳古园2区', '通州区北苑南路66号', '昌平区回龙观西大街18号', '大兴区黄村兴华大街9号'];

    const MOTHER_SURNAMES = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗'];
    const MOTHER_GIVEN = ['晓雯', '梦琪', '雨萱', '思颖', '佳怡', '欣怡', '诗涵', '梦瑶', '雨桐', '若曦', '婉清', '语嫣', '紫萱', '心怡', '雅婷', '静雯', '婉君', '梦洁', '琳萱', '晓燕'];
    const CONFINEMENT_INGREDIENTS = ['小米', '红枣', '枸杞', '花生', '猪蹄', '鲫鱼', '乌鸡', '当归', '黄芪', '山药', '莲藕', '鸡蛋', '红糖', '姜', '酒酿', '木瓜', '通草', '丝瓜', '红豆', '黑芝麻'];

    const CONSTITUTION_MEALS = {
        qi: [
            { type: 'morning', name: '黄芪小米粥', ingredients: ['小米', '黄芪', '红枣'] },
            { type: 'morning_snack', name: '红枣银耳羹', ingredients: ['红枣', '银耳', '枸杞'] },
            { type: 'noon', name: '山药炖乌鸡', ingredients: ['乌鸡', '山药', '枸杞'] },
            { type: 'noon_snack', name: '花生红豆汤', ingredients: ['花生', '红豆', '红糖'] },
            { type: 'evening', name: '当归鲫鱼汤', ingredients: ['鲫鱼', '当归', '姜'] },
            { type: 'evening_snack', name: '酒酿圆子', ingredients: ['酒酿', '糯米', '红糖'] }
        ],
        blood: [
            { type: 'morning', name: '红枣小米粥', ingredients: ['小米', '红枣', '红糖'] },
            { type: 'morning_snack', name: '桂圆红枣茶', ingredients: ['桂圆', '红枣', '枸杞'] },
            { type: 'noon', name: '花生猪蹄汤', ingredients: ['猪蹄', '花生', '红枣'] },
            { type: 'noon_snack', name: '黑芝麻糊', ingredients: ['黑芝麻', '核桃', '红糖'] },
            { type: 'evening', name: '莲藕排骨汤', ingredients: ['莲藕', '排骨', '红枣'] },
            { type: 'evening_snack', name: '红豆酒酿', ingredients: ['红豆', '酒酿', '红糖'] }
        ],
        yin: [
            { type: 'morning', name: '百合莲子粥', ingredients: ['百合', '莲子', '小米'] },
            { type: 'morning_snack', name: '木瓜炖银耳', ingredients: ['木瓜', '银耳', '枸杞'] },
            { type: 'noon', name: '丝瓜鲫鱼汤', ingredients: ['鲫鱼', '丝瓜', '姜'] },
            { type: 'noon_snack', name: '山药百合羹', ingredients: ['山药', '百合', '冰糖'] },
            { type: 'evening', name: '莲藕乌鸡汤', ingredients: ['乌鸡', '莲藕', '枸杞'] },
            { type: 'evening_snack', name: '银耳莲子羹', ingredients: ['银耳', '莲子', '枸杞'] }
        ],
        yang: [
            { type: 'morning', name: '姜枣小米粥', ingredients: ['小米', '姜', '红枣'] },
            { type: 'morning_snack', name: '桂圆姜茶', ingredients: ['桂圆', '姜', '红枣'] },
            { type: 'noon', name: '当归羊肉汤', ingredients: ['羊肉', '当归', '姜'] },
            { type: 'noon_snack', name: '核桃红枣汤', ingredients: ['核桃', '红枣', '红糖'] },
            { type: 'evening', name: '黄花猪蹄汤', ingredients: ['猪蹄', '黄花菜', '姜'] },
            { type: 'evening_snack', name: '姜酒酿蛋', ingredients: ['酒酿', '鸡蛋', '姜'] }
        ]
    };

    const MEAL_TYPE_LABELS = {
        morning: '早餐',
        morning_snack: '早点',
        noon: '午餐',
        noon_snack: '午点',
        evening: '晚餐',
        evening_snack: '晚点'
    };

    function randomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function generateSeedData() {
        const seedStores = [];
        const seedRooms = [];
        const seedStaff = [];
        const seedMothers = [];
        const seedBookings = [];
        const seedShifts = [];
        const seedMeals = [];
        const seedVisitors = [];
        const seedRehab = [];
        const seedLogs = [];

        const today = formatDate(new Date());

        STORE_NAMES.forEach(function (storeName, idx) {
            const storeId = 'S' + String(idx + 1).padStart(2, '0');
            seedStores.push({
                id: storeId,
                name: storeName,
                address: STORE_ADDRESSES[idx],
                phone: '010-' + randomInt(60000000, 69999999),
                suiteLuxuryCount: 15,
                suiteStandardCount: 35
            });

            for (let i = 1; i <= 15; i++) {
                const roomNum = 'L' + String(i).padStart(3, '0');
                const statuses = ['idle', 'booked', 'occupied', 'maintenance'];
                const weights = [0.3, 0.2, 0.4, 0.1];
                let r = Math.random();
                let status = 'idle';
                for (let s = 0; s < statuses.length; s++) {
                    r -= weights[s];
                    if (r <= 0) { status = statuses[s]; break; }
                }
                if (i <= 2) status = 'idle';
                seedRooms.push({
                    id: storeId + '_R_' + roomNum,
                    storeId: storeId,
                    roomNumber: roomNum,
                    type: 'luxury',
                    status: status,
                    floor: Math.ceil(i / 5)
                });
            }
            for (let i = 1; i <= 35; i++) {
                const roomNum = 'S' + String(i).padStart(3, '0');
                const statuses = ['idle', 'booked', 'occupied', 'maintenance'];
                const weights = [0.35, 0.15, 0.4, 0.1];
                let r = Math.random();
                let status = 'idle';
                for (let s = 0; s < statuses.length; s++) {
                    r -= weights[s];
                    if (r <= 0) { status = statuses[s]; break; }
                }
                if (i <= 5) status = 'idle';
                seedRooms.push({
                    id: storeId + '_R_' + roomNum,
                    storeId: storeId,
                    roomNumber: roomNum,
                    type: 'standard',
                    status: status,
                    floor: Math.ceil(i / 10) + 3
                });
            }

            seedStaff.push({
                id: 'M' + String(idx + 1).padStart(3, '0'),
                storeId: storeId,
                name: ['张店长', '李店长', '王店长', '赵店长', '陈店长', '杨店长', '黄店长', '周店长'][idx],
                role: 'manager',
                qualifications: [],
                phone: '138' + randomInt(10000000, 99999999),
                password: '123456'
            });
            seedStaff.push({
                id: 'NS' + String(idx + 1).padStart(3, '0'),
                storeId: storeId,
                name: ['刘主管', '孙主管', '马主管', '朱主管', '胡主管', '林主管', '郭主管', '何主管'][idx],
                role: 'nursing_supervisor',
                qualifications: ['新生儿护理证', '产后护理证'],
                phone: '139' + randomInt(10000000, 99999999),
                password: '123456'
            });
            for (let n = 1; n <= 20; n++) {
                const quals = [];
                if (Math.random() > 0.3) quals.push('新生儿护理证');
                if (Math.random() > 0.4) quals.push('产后护理证');
                seedStaff.push({
                    id: 'N' + String(idx + 1).padStart(2, '0') + String(n).padStart(2, '0'),
                    storeId: storeId,
                    name: randomItem(MOTHER_SURNAMES) + randomItem(MOTHER_GIVEN),
                    role: 'nurse',
                    qualifications: quals,
                    phone: '150' + randomInt(10000000, 99999999),
                    password: '123456'
                });
            }
            for (let d = 1; d <= 3; d++) {
                seedStaff.push({
                    id: 'D' + String(idx + 1).padStart(2, '0') + String(d).padStart(2, '0'),
                    storeId: storeId,
                    name: randomItem(MOTHER_SURNAMES) + randomItem(MOTHER_GIVEN),
                    role: 'nutritionist',
                    qualifications: ['营养师证'],
                    phone: '151' + randomInt(10000000, 99999999),
                    password: '123456'
                });
            }
            for (let r = 1; r <= 4; r++) {
                seedStaff.push({
                    id: 'R' + String(idx + 1).padStart(2, '0') + String(r).padStart(2, '0'),
                    storeId: storeId,
                    name: randomItem(MOTHER_SURNAMES) + randomItem(MOTHER_GIVEN),
                    role: 'rehab',
                    qualifications: ['康复师证'],
                    phone: '152' + randomInt(10000000, 99999999),
                    password: '123456'
                });
            }
        });

        const occupiedRooms = seedRooms.filter(function (r) { return r.status === 'occupied'; });
        occupiedRooms.forEach(function (room, i) {
            const constitutions = ['qi', 'blood', 'yin', 'yang'];
            const constitution = constitutions[i % 4];
            const motherName = randomItem(MOTHER_SURNAMES) + randomItem(MOTHER_GIVEN);
            const motherId = 'MOM' + String(i + 1).padStart(4, '0');
            const checkInDate = addDays(today, -randomInt(1, 27));
            const checkOutDate = addDays(checkInDate, 28);
            const allergies = [];
            if (Math.random() > 0.6) {
                allergies.push(randomItem(['花生', '海鲜', '芒果', '鸡蛋', '牛奶']));
            }

            seedMothers.push({
                id: motherId,
                name: motherName,
                phone: '13' + randomInt(100000000, 999999999),
                constitution: constitution,
                checkInDate: checkInDate,
                checkOutDate: checkOutDate,
                roomId: room.id,
                roomNumber: room.roomNumber,
                storeId: room.storeId,
                allergies: allergies,
                babyGender: Math.random() > 0.5 ? '男' : '女',
                babyBirthDate: checkInDate,
                emergencyContact: randomItem(MOTHER_SURNAMES) + '先生'
            });

            seedBookings.push({
                id: 'BK' + String(i + 1).padStart(4, '0'),
                roomId: room.id,
                storeId: room.storeId,
                motherId: motherId,
                motherName: motherName,
                roomNumber: room.roomNumber,
                startDate: checkInDate,
                endDate: checkOutDate,
                status: 'checkedIn',
                createdAt: addDays(checkInDate, -7)
            });
        });

        const bookedRooms = seedRooms.filter(function (r) { return r.status === 'booked'; });
        bookedRooms.forEach(function (room, i) {
            const motherName = randomItem(MOTHER_SURNAMES) + randomItem(MOTHER_GIVEN);
            const motherId = 'MBK' + String(i + 1).padStart(4, '0');
            const startDate = addDays(today, randomInt(1, 14));
            const endDate = addDays(startDate, 28);

            seedMothers.push({
                id: motherId,
                name: motherName,
                phone: '13' + randomInt(100000000, 999999999),
                constitution: randomItem(['qi', 'blood', 'yin', 'yang']),
                checkInDate: startDate,
                checkOutDate: endDate,
                roomId: room.id,
                roomNumber: room.roomNumber,
                storeId: room.storeId,
                allergies: [],
                babyGender: '',
                babyBirthDate: '',
                emergencyContact: ''
            });

            seedBookings.push({
                id: 'PBK' + String(i + 1).padStart(4, '0'),
                roomId: room.id,
                storeId: room.storeId,
                motherId: motherId,
                motherName: motherName,
                roomNumber: room.roomNumber,
                startDate: startDate,
                endDate: endDate,
                status: 'confirmed',
                createdAt: today
            });
        });

        const dayTypes = ['day', 'night'];
        const currentMothers = seedMothers.filter(function (m) {
            const b = seedBookings.find(function (bk) { return bk.motherId === m.id; });
            return b && b.status === 'checkedIn';
        });

        for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
            const shiftDate = addDays(today, dayOffset);
            seedStores.forEach(function (store) {
                const storeNurses = seedStaff.filter(function (s) {
                    return s.storeId === store.id && s.role === 'nurse';
                });
                const storeMothers = currentMothers.filter(function (m) { return m.storeId === store.id; });
                const nursesPerShift = Math.min(6, storeNurses.length);
                const dayNurses = storeNurses.slice(0, nursesPerShift);
                const nightNurses = storeNurses.slice(nursesPerShift, nursesPerShift + Math.min(4, storeNurses.length - nursesPerShift));

                dayNurses.forEach(function (nurse, ni) {
                    const mother = storeMothers[ni % Math.max(1, storeMothers.length)];
                    const isPast = dayOffset < 0;
                    const isToday = dayOffset === 0;
                    seedShifts.push({
                        id: generateId(),
                        storeId: store.id,
                        staffId: nurse.id,
                        staffName: nurse.name,
                        motherId: mother ? mother.id : '',
                        motherName: mother ? mother.name : '',
                        roomId: mother ? mother.roomId : '',
                        roomNumber: mother ? mother.roomNumber : '',
                        shiftDate: shiftDate,
                        shiftType: 'day',
                        status: isPast || (isToday && new Date().getHours() >= 14) ? 'signed' : 'scheduled',
                        handoverNote: isPast ? '婴儿喂养3次，体温正常，睡眠良好。' : '',
                        signedBy: isPast ? nurse.name : '',
                        signedAt: isPast ? shiftDate + ' 14:30' : '',
                        qualifications: nurse.qualifications
                    });
                });

                nightNurses.forEach(function (nurse, ni) {
                    const mother = storeMothers[(ni + 3) % Math.max(1, storeMothers.length)];
                    const isPast = dayOffset < 0;
                    seedShifts.push({
                        id: generateId(),
                        storeId: store.id,
                        staffId: nurse.id,
                        staffName: nurse.name,
                        motherId: mother ? mother.id : '',
                        motherName: mother ? mother.name : '',
                        roomId: mother ? mother.roomId : '',
                        roomNumber: mother ? mother.roomNumber : '',
                        shiftDate: shiftDate,
                        shiftType: 'night',
                        status: isPast ? 'unsigned' : 'scheduled',
                        handoverNote: isPast && Math.random() > 0.5 ? '' : (isPast ? '夜班婴儿喂奶2次，无异常。' : ''),
                        signedBy: '',
                        signedAt: '',
                        qualifications: nurse.qualifications,
                        nightRecordMissing: isPast && Math.random() > 0.5
                    });
                });
            });
        }

        currentMothers.forEach(function (mother) {
            const meals = CONSTITUTION_MEALS[mother.constitution] || CONSTITUTION_MEALS.qi;
            const mealItems = meals.map(function (meal) {
                return {
                    id: generateId(),
                    type: meal.type,
                    name: meal.name,
                    ingredients: meal.ingredients,
                    status: 'pending',
                    scanCode: 'SC' + generateId().toUpperCase().substr(0, 8),
                    completedAt: ''
                };
            });
            seedMeals.push({
                id: generateId(),
                motherId: mother.id,
                motherName: mother.name,
                roomId: mother.roomId,
                roomNumber: mother.roomNumber,
                storeId: mother.storeId,
                date: today,
                constitution: mother.constitution,
                allergies: mother.allergies,
                meals: mealItems
            });
        });

        currentMothers.forEach(function (mother) {
            const visitCount = randomInt(0, 2);
            for (let v = 0; v < visitCount; v++) {
                const slots = ['10:00-10:30', '10:30-11:00', '14:00-14:30', '15:00-15:30', '16:00-16:30', '19:00-19:30'];
                const slot = slots[randomInt(0, slots.length - 1)];
                const isVisited = Math.random() > 0.3;
                seedVisitors.push({
                    id: generateId(),
                    motherId: mother.id,
                    motherName: mother.name,
                    roomId: mother.roomId,
                    roomNumber: mother.roomNumber,
                    storeId: mother.storeId,
                    visitorName: randomItem(MOTHER_SURNAMES) + randomItem(['先生', '女士', '阿姨', '叔叔']),
                    relation: randomItem(['丈夫', '母亲', '婆婆', '父亲', '姐妹']),
                    visitDate: today,
                    timeSlot: slot,
                    phone: '13' + randomInt(100000000, 999999999),
                    photo: '',
                    checkInTime: isVisited ? slot.split('-')[0] : '',
                    checkOutTime: isVisited && Math.random() > 0.4 ? slot.split('-')[1] : '',
                    status: isVisited ? (Math.random() > 0.4 ? 'completed' : 'visiting') : 'registered'
                });
            }
        });

        const rehabProjects = [
            { type: 'pelvic', name: '骨盆修复', duration: 45, color: 'pelvic' },
            { type: 'abdominal', name: '腹直肌分离修复', duration: 40, color: 'abdominal' },
            { type: 'breast', name: '乳房护理', duration: 30, color: 'breast' },
            { type: 'tcm', name: '中医调理', duration: 50, color: 'tcm' }
        ];
        const rehabStaff = seedStaff.filter(function (s) { return s.role === 'rehab'; });
        let rehabCounter = 0;
        for (let dayOffset = -2; dayOffset <= 5; dayOffset++) {
            const apptDate = addDays(today, dayOffset);
            currentMothers.forEach(function (mother) {
                if (Math.random() > 0.6) {
                    const project = rehabProjects[rehabCounter % rehabProjects.length];
                    const therapist = rehabStaff.find(function (s) { return s.storeId === mother.storeId; });
                    if (!therapist) return;
                    rehabCounter++;
                    const hour = randomInt(9, 16);
                    const startTime = apptDate + ' ' + String(hour).padStart(2, '0') + ':00';
                    const endTime = apptDate + ' ' + String(hour).padStart(2, '0') + ':' + String(project.duration).padStart(2, '0');
                    seedRehab.push({
                        id: generateId(),
                        motherId: mother.id,
                        motherName: mother.name,
                        staffId: therapist.id,
                        staffName: therapist.name,
                        storeId: mother.storeId,
                        projectType: project.type,
                        projectName: project.name,
                        startTime: startTime,
                        endTime: endTime,
                        duration: project.duration,
                        status: dayOffset < 0 ? 'completed' : 'scheduled',
                        sessionNumber: randomInt(2, 8),
                        totalSessions: 10,
                        progressNote: dayOffset < 0 ? '恢复良好，继续治疗。' : ''
                    });
                }
            });
        }

        for (let dayOffset = -89; dayOffset <= 0; dayOffset++) {
            const logDate = addDays(today, dayOffset);
            seedStores.forEach(function (store) {
                const storeRooms = seedRooms.filter(function (r) { return r.storeId === store.id; });
                const occupied = storeRooms.filter(function (r) { return r.status === 'occupied'; }).length;
                const luxuryRooms = storeRooms.filter(function (r) { return r.type === 'luxury'; });
                const stdRooms = storeRooms.filter(function (r) { return r.type === 'standard'; });
                const luxuryOcc = Math.round(luxuryRooms.length * (0.6 + Math.random() * 0.3));
                const stdOcc = Math.round(stdRooms.length * (0.5 + Math.random() * 0.4));
                seedLogs.push({
                    id: generateId(),
                    storeId: store.id,
                    date: logDate,
                    occupancyRate: Math.round((luxuryOcc + stdOcc) / storeRooms.length * 100),
                    nursingCount: randomInt(40, 80),
                    mealCount: randomInt(120, 200),
                    rehabRevenue: randomInt(3000, 8000),
                    luxuryOccupied: luxuryOcc,
                    standardOccupied: stdOcc,
                    luxuryTotal: luxuryRooms.length,
                    standardTotal: stdRooms.length,
                    newCheckIns: randomInt(0, 3),
                    checkOuts: randomInt(0, 2)
                });
            });
        }

        return Promise.all([
            bulkPut(STORES.STORES, seedStores),
            bulkPut(STORES.ROOMS, seedRooms),
            bulkPut(STORES.STAFF, seedStaff),
            bulkPut(STORES.MOTHERS, seedMothers),
            bulkPut(STORES.BOOKINGS, seedBookings),
            bulkPut(STORES.NURSING_SHIFTS, seedShifts),
            bulkPut(STORES.MEAL_PLANS, seedMeals),
            bulkPut(STORES.VISITORS, seedVisitors),
            bulkPut(STORES.REHAB_APPOINTMENTS, seedRehab),
            bulkPut(STORES.OPERATION_LOGS, seedLogs)
        ]);
    }

    function init() {
        return openDB().then(function () {
            return getAll(STORES.STORES);
        }).then(function (existingStores) {
            if (!existingStores || existingStores.length === 0) {
                return generateSeedData();
            }
            return Promise.resolve();
        }).then(function () {
            return getAll(STORES.STAFF);
        }).then(function (staff) {
            return staff;
        });
    }

    function login(empId, password) {
        return getAll(STORES.STAFF).then(function (staff) {
            const user = staff.find(function (s) { return s.id === empId && s.password === password; });
            if (user) {
                return { success: true, user: user };
            }
            return { success: false, message: '工号或密码错误' };
        });
    }

    function getStores() {
        return getAll(STORES.STORES);
    }

    function getRoomsByStore(storeId) {
        return getCachedByIndex(STORES.ROOMS, 'storeId', storeId);
    }

    function getStaffByStore(storeId) {
        return getCachedByIndex(STORES.STAFF, 'storeId', storeId);
    }

    function getStaffByStoreAndRole(storeId, role) {
        return getStaffByStore(storeId).then(function (staff) {
            return staff.filter(function (s) { return s.role === role; });
        });
    }

    function getMothersByStore(storeId) {
        return getCachedByIndex(STORES.MOTHERS, 'storeId', storeId);
    }

    function getBookingsByStore(storeId) {
        return getCachedByIndex(STORES.BOOKINGS, 'storeId', storeId);
    }

    function getShiftsByStore(storeId) {
        return getCachedByIndex(STORES.NURSING_SHIFTS, 'storeId', storeId);
    }

    function getMealPlansByStore(storeId) {
        return getAll(STORES.MEAL_PLANS).then(function (plans) {
            return plans.filter(function (p) { return p.storeId === storeId; });
        });
    }

    function getVisitorsByStore(storeId) {
        return getCachedByIndex(STORES.VISITORS, 'storeId', storeId);
    }

    function getRehabByStore(storeId) {
        return getCachedByIndex(STORES.REHAB_APPOINTMENTS, 'storeId', storeId);
    }

    function getLogsByStore(storeId) {
        return getCachedByIndex(STORES.OPERATION_LOGS, 'storeId', storeId);
    }

    function getRoomById(roomId) {
        return getById(STORES.ROOMS, roomId);
    }

    function updateRoom(room) {
        return put(STORES.ROOMS, room);
    }

    function addBooking(booking) {
        return add(STORES.BOOKINGS, booking);
    }

    function updateBooking(booking) {
        return put(STORES.BOOKINGS, booking);
    }

    function addMother(mother) {
        return add(STORES.MOTHERS, mother);
    }

    function updateMother(mother) {
        return put(STORES.MOTHERS, mother);
    }

    function addShift(shift) {
        return add(STORES.NURSING_SHIFTS, shift);
    }

    function updateShift(shift) {
        return put(STORES.NURSING_SHIFTS, shift);
    }

    function addMealPlan(plan) {
        return add(STORES.MEAL_PLANS, plan);
    }

    function updateMealPlan(plan) {
        return put(STORES.MEAL_PLANS, plan);
    }

    function addVisitor(visitor) {
        return add(STORES.VISITORS, visitor);
    }

    function updateVisitor(visitor) {
        return put(STORES.VISITORS, visitor);
    }

    function addRehab(appt) {
        return add(STORES.REHAB_APPOINTMENTS, appt);
    }

    function updateRehab(appt) {
        return put(STORES.REHAB_APPOINTMENTS, appt);
    }

    function getAllStores() {
        return getAll(STORES.STORES);
    }

    function checkBookingConflict(roomId, startDate, endDate, excludeBookingId) {
        return getCachedByIndex(STORES.BOOKINGS, 'roomId', roomId).then(function (bookings) {
            return bookings.some(function (b) {
                if (excludeBookingId && b.id === excludeBookingId) return false;
                if (b.status === 'checkedOut' || b.status === 'cancelled') return false;
                return !(endDate < b.startDate || startDate > b.endDate);
            });
        });
    }

    function checkRehabConflict(staffId, startTime, endTime, excludeId) {
        return getCachedByIndex(STORES.REHAB_APPOINTMENTS, 'staffId', staffId).then(function (appts) {
            return appts.some(function (a) {
                if (excludeId && a.id === excludeId) return false;
                if (a.status === 'cancelled') return false;
                return !(endTime < a.startTime || startTime > a.endTime);
            });
        });
    }

    return {
        STORES: STORES,
        MEAL_TYPE_LABELS: MEAL_TYPE_LABELS,
        init: init,
        login: login,
        generateId: generateId,
        formatDate: formatDate,
        addDays: addDays,
        getAll: getAll,
        getById: getById,
        getByIndex: getByIndex,
        add: add,
        put: put,
        bulkPut: bulkPut,
        remove: remove,
        getStores: getStores,
        getAllStores: getAllStores,
        getRoomsByStore: getRoomsByStore,
        getStaffByStore: getStaffByStore,
        getStaffByStoreAndRole: getStaffByStoreAndRole,
        getMothersByStore: getMothersByStore,
        getBookingsByStore: getBookingsByStore,
        getShiftsByStore: getShiftsByStore,
        getMealPlansByStore: getMealPlansByStore,
        getVisitorsByStore: getVisitorsByStore,
        getRehabByStore: getRehabByStore,
        getLogsByStore: getLogsByStore,
        getRoomById: getRoomById,
        updateRoom: updateRoom,
        addBooking: addBooking,
        updateBooking: updateBooking,
        addMother: addMother,
        updateMother: updateMother,
        addShift: addShift,
        updateShift: updateShift,
        addMealPlan: addMealPlan,
        updateMealPlan: updateMealPlan,
        addVisitor: addVisitor,
        updateVisitor: updateVisitor,
        addRehab: addRehab,
        updateRehab: updateRehab,
        checkBookingConflict: checkBookingConflict,
        checkRehabConflict: checkRehabConflict
    };
})();
