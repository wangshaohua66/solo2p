(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    var STORAGE_KEY = 'pet_grooming_db_v1';
    var CURRENT_STORE_KEY = 'current_store_id';
    var db = null;

    var DEFAULT_DATA = {
        stores: [
            { id: 's1', name: '朝阳旗舰店', address: '北京市朝阳区望京SOHO', phone: '010-88881001' },
            { id: 's2', name: '海淀分店', address: '北京市海淀区中关村大街', phone: '010-88881002' },
            { id: 's3', name: '西城分店', address: '北京市西城区金融街', phone: '010-88881003' },
            { id: 's4', name: '东城分店', address: '北京市东城区王府井', phone: '010-88881004' },
            { id: 's5', name: '丰台分店', address: '北京市丰台区丽泽商务区', phone: '010-88881005' },
            { id: 's6', name: '通州分店', address: '北京市通州区万达广场', phone: '010-88881006' }
        ],
        operators: [
            { id: 'op1', name: '张经理', role: 'manager', storeId: 's1' },
            { id: 'op2', name: '李前台', role: 'reception', storeId: 's1' }
        ],
        groomers: [
            { id: 'g1', name: '王小美', level: '高级美容师', storeId: 's1', avatar: '', skills: ['贵宾造型', '萨摩洗护', '染色'], workDays: [1,2,3,4,5,6] },
            { id: 'g2', name: '刘芳芳', level: '首席美容师', storeId: 's1', avatar: '', skills: ['比熊造型', '金毛SPA', '医疗美容'], workDays: [1,2,3,4,5] },
            { id: 'g3', name: '陈小雅', level: '中级美容师', storeId: 's1', avatar: '', skills: ['基础洗护', '剪指甲', '泰迪造型'], workDays: [1,2,3,5,6,7] },
            { id: 'g4', name: '赵丽丽', level: '高级美容师', storeId: 's2', avatar: '', skills: ['雪纳瑞造型', '哈士奇洗护', 'SPA'], workDays: [1,2,3,4,5,6] },
            { id: 'g5', name: '孙小娟', level: '首席美容师', storeId: 's2', avatar: '', skills: ['柯基造型', '柴犬美容', '染色'], workDays: [1,2,3,4,6,7] },
            { id: 'g6', name: '周小静', level: '中级美容师', storeId: 's3', avatar: '', skills: ['布偶洗护', '英短美容', '猫咪SPA'], workDays: [1,2,3,4,5] },
            { id: 'g7', name: '吴晓美', level: '高级美容师', storeId: 's3', avatar: '', skills: ['古牧造型', '阿拉斯加洗护'], workDays: [2,3,4,5,6,7] }
        ],
        serviceTypes: [
            { id: 'bath', name: '基础洗护', category: '洗护', duration: 45, priceMin: 80, priceMax: 280, color: '#28a745' },
            { id: 'style', name: '造型修剪', category: '造型', duration: 90, priceMin: 150, priceMax: 580, color: '#007bff' },
            { id: 'dye', name: '创意染色', category: '染色', duration: 120, priceMin: 200, priceMax: 880, color: '#e83e8c' },
            { id: 'spa', name: '精油SPA', category: 'SPA', duration: 60, priceMin: 180, priceMax: 480, color: '#6f42c1' },
            { id: 'nail', name: '美甲护理', category: '附加', duration: 20, priceMin: 30, priceMax: 80, color: '#fd7e14' },
            { id: 'ear', name: '耳道清洁', category: '附加', duration: 15, priceMin: 40, priceMax: 100, color: '#17a2b8' }
        ],
        packages: [
            { id: 'pkg1', name: '新手洗护套餐', services: ['bath', 'nail', 'ear'], discount: 0.85, petType: ['dog', 'cat'], desc: '适合首次到店体验，含基础洗护+美甲+耳道' },
            { id: 'pkg2', name: '贵宾造型套餐', services: ['bath', 'style'], discount: 0.88, petType: ['dog'], breed: ['贵宾', '泰迪'], desc: '专业泰迪/贵宾造型，含洗护修剪' },
            { id: 'pkg3', name: '猫咪舒缓套餐', services: ['bath', 'spa'], discount: 0.9, petType: ['cat'], desc: '猫咪专用低敏洗护+精油SPA放松' },
            { id: 'pkg4', name: '金毛豪华套餐', services: ['bath', 'style', 'spa'], discount: 0.82, petType: ['dog'], breed: ['金毛', '拉布拉多'], desc: '长毛犬深层护理+造型+SPA全套' },
            { id: 'pkg5', name: '柴犬造型套餐', services: ['bath', 'style', 'nail'], discount: 0.86, petType: ['dog'], breed: ['柴犬'], desc: '柴犬专属蓬松造型+基础护理' }
        ],
        customers: [
            { id: 'c1', name: '陈女士', phone: '13800138001', memberLevel: 'gold', balance: 1580.00, points: 3250, registerDate: '2024-06-15', address: '朝阳区望京西园' },
            { id: 'c2', name: '王先生', phone: '13900139002', memberLevel: 'silver', balance: 560.00, points: 1120, registerDate: '2024-08-22', address: '海淀区上地西里' },
            { id: 'c3', name: '刘小姐', phone: '13700137003', memberLevel: 'diamond', balance: 4280.00, points: 8760, registerDate: '2024-03-10', address: '西城区金融街' },
            { id: 'c4', name: '赵先生', phone: '13600136004', memberLevel: 'normal', balance: 0, points: 280, registerDate: '2025-01-05', address: '东城区东直门' },
            { id: 'c5', name: '孙女士', phone: '13500135005', memberLevel: 'gold', balance: 1280.00, points: 4580, registerDate: '2024-09-18', address: '丰台区方庄' }
        ],
        pets: [
            { id: 'p1', ownerId: 'c1', name: '豆豆', species: 'dog', breed: '贵宾（泰迪）', gender: '母', birthday: '2021-03-15', weight: 4.2, hairType: '卷毛', personality: ['温顺', '黏人', '活泼'], allergy: ['鸡肝'], specialNotes: '恐水，需要耐心安抚', vaccines: [{name:'狂犬疫苗', date:'2025-02-10'}, {name:'六联疫苗', date:'2025-02-10'}], photos: [generatePetPhoto('poodle', 'brown')], serviceHistory: ['sv1', 'sv5', 'sv9'] },
            { id: 'p2', ownerId: 'c2', name: '大黄', species: 'dog', breed: '金毛寻回犬', gender: '公', birthday: '2020-07-20', weight: 32.5, hairType: '长毛', personality: ['温顺', '护主', '贪吃'], allergy: [], specialNotes: '尾巴受伤恢复期，不要用力拉扯', vaccines: [{name:'狂犬疫苗', date:'2025-01-15'}, {name:'八联疫苗', date:'2025-01-15'}], photos: [generatePetPhoto('golden', 'gold')], serviceHistory: ['sv2', 'sv6'] },
            { id: 'p3', ownerId: 'c3', name: '咪咪', species: 'cat', breed: '英国短毛猫', gender: '母', birthday: '2022-11-08', weight: 4.8, hairType: '短毛', personality: ['高冷', '怕生', '爱干净'], allergy: ['鱼香精'], specialNotes: '洗澡时需要用毛巾包裹，攻击性较强', vaccines: [{name:'狂犬疫苗', date:'2025-03-01'}, {name:'猫三联', date:'2025-03-01'}], photos: [generatePetPhoto('cat', 'gray')], serviceHistory: ['sv3', 'sv7'] },
            { id: 'p4', ownerId: 'c4', name: '旺财', species: 'dog', breed: '柴犬', gender: '公', birthday: '2021-09-01', weight: 11.2, hairType: '短毛', personality: ['独立', '傲娇', '机灵'], allergy: [], specialNotes: '讨厌吹风机，喜欢自然晾干', vaccines: [{name:'狂犬疫苗', date:'2025-02-20'}, {name:'六联疫苗', date:'2025-02-20'}], photos: [generatePetPhoto('shiba', 'red')], serviceHistory: ['sv4', 'sv8'] },
            { id: 'p5', ownerId: 'c1', name: '雪球', species: 'cat', breed: '布偶猫', gender: '公', birthday: '2023-01-12', weight: 5.6, hairType: '长毛', personality: ['黏人', '温顺', '爱撒娇'], allergy: [], specialNotes: '梳毛需要耐心，毛容易打结', vaccines: [{name:'狂犬疫苗', date:'2025-02-05'}, {name:'猫三联', date:'2025-02-05'}], photos: [generatePetPhoto('ragdoll', 'blue')], serviceHistory: ['sv10'] },
            { id: 'p6', ownerId: 'c5', name: '乐乐', species: 'dog', breed: '比熊犬', gender: '母', birthday: '2022-05-18', weight: 5.1, hairType: '卷毛', personality: ['活泼', '亲人', '爱撒娇'], allergy: ['牛肉'], specialNotes: '眼睛容易流泪，需注意护理', vaccines: [{name:'狂犬疫苗', date:'2025-01-28'}, {name:'六联疫苗', date:'2025-01-28'}], photos: [generatePetPhoto('bichon', 'white')], serviceHistory: ['sv11'] }
        ],
        services: generateMockServices(),
        schedules: generateMockSchedules(),
        receipts: generateMockReceipts()
    };

    function generatePetPhoto(type, color) {
        var map = {
            'poodle': 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=200&h=200&fit=crop',
            'golden': 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=200&h=200&fit=crop',
            'cat': 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=200&fit=crop',
            'shiba': 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=200&h=200&fit=crop',
            'ragdoll': 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=200&h=200&fit=crop',
            'bichon': 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop'
        };
        return map[type] || map.poodle;
    }

    function generateMockServices() {
        var list = [];
        var pets = ['p1','p2','p3','p4','p5','p6'];
        var groomers = ['g1','g2','g3','g4','g5','g6','g7'];
        var types = ['bath','style','dye','spa'];
        var statuses = ['completed','completed','completed','in_progress','pending'];
        var base = new Date();
        for (var i = 1; i <= 35; i++) {
            var d = new Date(base);
            d.setDate(d.getDate() - Math.floor(Math.random()*30));
            var petId = pets[i % pets.length];
            var type = types[i % types.length];
            list.push({
                id: 'sv' + i,
                petId: petId,
                ownerId: '',
                groomerId: groomers[i % groomers.length],
                storeId: 's1',
                type: type,
                packageId: i % 4 === 0 ? 'pkg' + ((i % 5) + 1) : null,
                status: statuses[i % statuses.length],
                startTime: formatDate(d),
                duration: 45 + Math.floor(Math.random()*90),
                price: 120 + Math.floor(Math.random()*500),
                discount: Math.random() > 0.6 ? 0.85 + Math.random()*0.1 : 1,
                points: 20 + Math.floor(Math.random()*80),
                notes: i % 3 === 0 ? '主人要求修剪得短一些' : '',
                photos: []
            });
        }
        return list;
    }

    function generateMockSchedules() {
        var list = [];
        var groomers = ['g1','g2','g3'];
        var base = new Date();
        base.setHours(0,0,0,0);
        for (var day = 0; day < 7; day++) {
            var d = new Date(base);
            d.setDate(d.getDate() + day);
            var dateStr = formatDate(d).split(' ')[0];
            for (var gi = 0; gi < groomers.length; gi++) {
                for (var slot = 0; slot < 4; slot++) {
                    if (Math.random() > 0.4) continue;
                    var hour = 9 + slot * 2 + (Math.random() > 0.5 ? 1 : 0);
                    list.push({
                        id: 'sch_' + day + '_' + gi + '_' + slot,
                        groomerId: groomers[gi],
                        storeId: 's1',
                        date: dateStr,
                        startTime: dateStr + ' ' + String(hour).padStart(2,'0') + ':00',
                        duration: 90 + Math.floor(Math.random()*60),
                        serviceId: 'sv' + (Math.floor(Math.random()*35)+1),
                        status: 'booked'
                    });
                }
            }
        }
        return list;
    }

    function generateMockReceipts() {
        var list = [];
        for (var i = 1; i <= 30; i++) {
            var d = new Date();
            d.setDate(d.getDate() - Math.floor(Math.random()*30));
            var total = 200 + Math.floor(Math.random()*800);
            list.push({
                id: 'rc' + i,
                storeId: i % 2 === 0 ? 's2' : 's1',
                serviceId: 'sv' + ((i % 35) + 1),
                customerId: 'c' + ((i % 5) + 1),
                items: [{name:'基础洗护', price: 180, qty: 1}, {name:'造型修剪', price: total - 180, qty: 1}],
                subtotal: total,
                discount: Math.random() > 0.5 ? Math.floor(total * 0.1) : 0,
                pointsUsed: 0,
                total: total - (Math.random() > 0.5 ? Math.floor(total * 0.1) : 0),
                payMethod: i % 3 === 0 ? 'stored' : (i % 3 === 1 ? 'cash' : 'qr'),
                pointsEarned: Math.floor(total / 10),
                date: formatDate(d),
                operatorId: 'op2'
            });
        }
        return list;
    }

    function formatDate(d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        return y + '-' + m + '-' + day + ' ' + h + ':' + min;
    }

    function loadDb() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                db = JSON.parse(raw);
            }
        } catch(e) {
            console.error('Failed to parse DB:', e);
        }
        if (!db) {
            db = JSON.parse(JSON.stringify(DEFAULT_DATA));
            saveDb();
        }
        return db;
    }

    function saveDb() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch(e) {
            console.error('Storage quota exceeded:', e);
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('本地存储空间不足，请清理历史数据', 'error', '存储警告');
            }
        }
    }

    function uid(prefix) {
        return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    App.store = {
        init: function() {
            loadDb();
        },

        getStores: function() {
            return db.stores.slice();
        },

        getCurrentStore: function() {
            var id = localStorage.getItem(CURRENT_STORE_KEY) || db.stores[0].id;
            return db.stores.find(function(s) { return s.id === id; }) || db.stores[0];
        },

        setCurrentStore: function(id) {
            localStorage.setItem(CURRENT_STORE_KEY, id);
        },

        exportData: function() {
            return JSON.stringify(db, null, 2);
        },

        importData: function(jsonStr) {
            try {
                var data = JSON.parse(jsonStr);
                if (data && data.stores && data.pets) {
                    db = data;
                    saveDb();
                    return true;
                }
            } catch(e) {
                console.error(e);
            }
            return false;
        },

        resetDefaults: function() {
            localStorage.removeItem(STORAGE_KEY);
            db = JSON.parse(JSON.stringify(DEFAULT_DATA));
            saveDb();
        },

        getStorageSize: function() {
            try {
                var data = JSON.stringify(db);
                return (data.length * 2 / 1024 / 1024).toFixed(2) + ' MB';
            } catch(e) {
                return 'Unknown';
            }
        },

        getCustomers: function(filter) {
            filter = filter || {};
            var list = db.customers.slice();
            if (filter.keyword) {
                var kw = filter.keyword.toLowerCase();
                list = list.filter(function(c) {
                    return c.name.toLowerCase().includes(kw) || c.phone.includes(kw);
                });
            }
            if (filter.level) {
                list = list.filter(function(c) { return c.memberLevel === filter.level; });
            }
            return list;
        },

        getCustomerById: function(id) {
            return db.customers.find(function(c) { return c.id === id; });
        },

        saveCustomer: function(c) {
            if (!c.id) {
                c.id = uid('c');
                c.registerDate = formatDate(new Date()).split(' ')[0];
                c.balance = c.balance || 0;
                c.points = c.points || 0;
                c.memberLevel = c.memberLevel || 'normal';
                db.customers.push(c);
            } else {
                var idx = db.customers.findIndex(function(x) { return x.id === c.id; });
                if (idx >= 0) db.customers[idx] = Object.assign({}, db.customers[idx], c);
            }
            saveDb();
            return c;
        },

        getPets: function(filter) {
            filter = filter || {};
            var list = db.pets.slice();
            if (filter.ownerId) {
                list = list.filter(function(p) { return p.ownerId === filter.ownerId; });
            }
            if (filter.keyword) {
                var kw = filter.keyword.toLowerCase();
                list = list.filter(function(p) {
                    return p.name.toLowerCase().includes(kw) || p.breed.toLowerCase().includes(kw);
                });
            }
            return list;
        },

        getPetById: function(id) {
            return db.pets.find(function(p) { return p.id === id; });
        },

        savePet: function(p) {
            if (!p.id) {
                p.id = uid('p');
                p.serviceHistory = p.serviceHistory || [];
                p.vaccines = p.vaccines || [];
                p.photos = p.photos || [];
                db.pets.push(p);
            } else {
                var idx = db.pets.findIndex(function(x) { return x.id === p.id; });
                if (idx >= 0) db.pets[idx] = Object.assign({}, db.pets[idx], p);
            }
            saveDb();
            return p;
        },

        getPetServices: function(petId, limit) {
            var list = db.services
                .filter(function(s) { return s.petId === petId; })
                .sort(function(a, b) { return new Date(b.startTime) - new Date(a.startTime); });
            return limit ? list.slice(0, limit) : list;
        },

        getGroomers: function(filter) {
            filter = filter || {};
            var list = db.groomers.slice();
            if (filter.storeId) {
                list = list.filter(function(g) { return g.storeId === filter.storeId; });
            }
            return list;
        },

        getGroomerById: function(id) {
            return db.groomers.find(function(g) { return g.id === id; });
        },

        getServiceTypes: function() {
            return db.serviceTypes.slice();
        },

        getPackages: function(filter) {
            filter = filter || {};
            var list = db.packages.slice();
            if (filter.petType) {
                list = list.filter(function(p) { return !p.petType || p.petType.indexOf(filter.petType) >= 0; });
            }
            if (filter.breed) {
                list = list.filter(function(p) {
                    if (!p.breed) return true;
                    var b = filter.breed.toLowerCase();
                    return p.breed.some(function(x) { return b.indexOf(x.toLowerCase()) >= 0 || x.toLowerCase().indexOf(b) >= 0; });
                });
            }
            return list;
        },

        getServices: function(filter) {
            filter = filter || {};
            var list = db.services.slice();
            if (filter.storeId) list = list.filter(function(s) { return s.storeId === filter.storeId; });
            if (filter.status) list = list.filter(function(s) { return s.status === filter.status; });
            if (filter.groomerId) list = list.filter(function(s) { return s.groomerId === filter.groomerId; });
            if (filter.date) {
                list = list.filter(function(s) { return s.startTime.indexOf(filter.date) === 0; });
            }
            list.sort(function(a, b) { return new Date(b.startTime) - new Date(a.startTime); });
            return list;
        },

        getServiceById: function(id) {
            return db.services.find(function(s) { return s.id === id; });
        },

        saveService: function(s) {
            if (!s.id) {
                s.id = uid('sv');
                s.status = s.status || 'pending';
                db.services.push(s);
                var pet = this.getPetById(s.petId);
                if (pet && pet.serviceHistory.indexOf(s.id) < 0) {
                    pet.serviceHistory.push(s.id);
                }
            } else {
                var idx = db.services.findIndex(function(x) { return x.id === s.id; });
                if (idx >= 0) db.services[idx] = Object.assign({}, db.services[idx], s);
            }
            saveDb();
            return s;
        },

        updateServiceStatus: function(id, status) {
            var s = this.getServiceById(id);
            if (s) {
                s.status = status;
                saveDb();
            }
            return s;
        },

        getSchedules: function(filter) {
            filter = filter || {};
            var list = db.schedules.slice();
            if (filter.storeId) list = list.filter(function(s) { return s.storeId === filter.storeId; });
            if (filter.groomerId) list = list.filter(function(s) { return s.groomerId === filter.groomerId; });
            if (filter.date) list = list.filter(function(s) { return s.date === filter.date; });
            if (filter.dateRange) {
                list = list.filter(function(s) {
                    return s.date >= filter.dateRange.start && s.date <= filter.dateRange.end;
                });
            }
            return list;
        },

        saveSchedule: function(sch) {
            if (!sch.id) {
                sch.id = uid('sch');
                sch.status = sch.status || 'booked';
                db.schedules.push(sch);
            } else {
                var idx = db.schedules.findIndex(function(x) { return x.id === sch.id; });
                if (idx >= 0) db.schedules[idx] = Object.assign({}, db.schedules[idx], sch);
            }
            saveDb();
            return sch;
        },

        deleteSchedule: function(id) {
            db.schedules = db.schedules.filter(function(s) { return s.id !== id; });
            saveDb();
        },

        checkScheduleConflict: function(groomerId, date, startMinutes, durationMinutes) {
            var list = db.schedules.filter(function(s) { return s.groomerId === groomerId && s.date === date; });
            var endMinutes = startMinutes + durationMinutes;
            for (var i = 0; i < list.length; i++) {
                var t = list[i];
                var tParts = t.startTime.split(' ')[1].split(':');
                var tStart = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
                var tEnd = tStart + t.duration;
                if (startMinutes < tEnd && endMinutes > tStart) {
                    return t;
                }
            }
            return null;
        },

        getReceipts: function(filter) {
            filter = filter || {};
            var list = db.receipts.slice();
            if (filter.storeId) list = list.filter(function(r) { return r.storeId === filter.storeId; });
            if (filter.customerId) list = list.filter(function(r) { return r.customerId === filter.customerId; });
            if (filter.dateRange) {
                list = list.filter(function(r) {
                    return r.date.substring(0,10) >= filter.dateRange.start && r.date.substring(0,10) <= filter.dateRange.end;
                });
            }
            list.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
            return list;
        },

        saveReceipt: function(r) {
            if (!r.id) {
                r.id = uid('rc');
                r.date = formatDate(new Date());
                db.receipts.push(r);
            } else {
                var idx = db.receipts.findIndex(function(x) { return x.id === r.id; });
                if (idx >= 0) db.receipts[idx] = Object.assign({}, db.receipts[idx], r);
            }
            saveDb();
            return r;
        },

        rechargeCustomer: function(customerId, amount) {
            var c = this.getCustomerById(customerId);
            if (c) {
                c.balance = Number(c.balance) + Number(amount);
                saveDb();
                return c;
            }
            return null;
        },

        deductCustomer: function(customerId, amount, usePoints) {
            var c = this.getCustomerById(customerId);
            if (!c) return null;
            var pay = Number(amount);
            if (usePoints && c.points >= usePoints) {
                var pointsPay = Math.min(usePoints * 0.01, pay);
                c.points -= pointsPay / 0.01;
                pay -= pointsPay;
            }
            if (pay > 0) {
                if (c.balance < pay) return null;
                c.balance -= pay;
            }
            saveDb();
            return c;
        },

        addPoints: function(customerId, points) {
            var c = this.getCustomerById(customerId);
            if (c) {
                c.points = Number(c.points) + Number(points);
                saveDb();
            }
            return c;
        },

        getDashboardStats: function(filter) {
            filter = filter || {};
            var startDate = filter.startDate;
            var endDate = filter.endDate;
            var storeId = filter.storeId;

            var services = db.services.filter(function(s) {
                if (storeId && s.storeId !== storeId) return false;
                if (startDate && s.startTime.substring(0,10) < startDate) return false;
                if (endDate && s.startTime.substring(0,10) > endDate) return false;
                return true;
            });

            var receipts = db.receipts.filter(function(r) {
                if (storeId && r.storeId !== storeId) return false;
                if (startDate && r.date.substring(0,10) < startDate) return false;
                if (endDate && r.date.substring(0,10) > endDate) return false;
                return true;
            });

            var totalRevenue = receipts.reduce(function(sum, r) { return sum + Number(r.total); }, 0);
            var serviceCount = services.length;
            var completedCount = services.filter(function(s) { return s.status === 'completed'; }).length;
            var avgPrice = serviceCount > 0 ? totalRevenue / completedCount : 0;

            var groomerPerf = {};
            services.forEach(function(s) {
                if (!groomerPerf[s.groomerId]) {
                    var g = this.getGroomerById(s.groomerId);
                    groomerPerf[s.groomerId] = { id: s.groomerId, name: g ? g.name : '未知', count: 0, revenue: 0 };
                }
                groomerPerf[s.groomerId].count++;
            }.bind(this));

            receipts.forEach(function(r) {
                var sv = this.getServiceById(r.serviceId);
                if (sv && groomerPerf[sv.groomerId]) {
                    groomerPerf[sv.groomerId].revenue += Number(r.total);
                }
            }.bind(this));

            var groomerRank = Object.values(groomerPerf).sort(function(a, b) { return b.revenue - a.revenue; });

            var typeDist = {};
            services.forEach(function(s) {
                if (!typeDist[s.type]) typeDist[s.type] = 0;
                typeDist[s.type]++;
            });

            var typeDistribution = Object.keys(typeDist).map(function(k) {
                var st = this.getServiceTypes().find(function(t) { return t.id === k; });
                return { id: k, name: st ? st.name : k, count: typeDist[k] };
            }.bind(this));

            return {
                totalRevenue: totalRevenue,
                serviceCount: serviceCount,
                completedCount: completedCount,
                avgPrice: Math.round(avgPrice * 100) / 100,
                groomerRank: groomerRank,
                typeDistribution: typeDistribution,
                petCount: db.pets.length,
                memberCount: db.customers.length
            };
        }
    };

})(typeof window !== 'undefined' ? window : this);
