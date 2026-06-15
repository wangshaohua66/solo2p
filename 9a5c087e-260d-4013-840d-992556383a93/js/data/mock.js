var MockData = (function () {
    var RIVERS = [
        { id: 'R001', name: '东江干流', warningLevel: 12.5, dangerLevel: 14.0, guaranteedLevel: 15.2, stations: ['S001', 'S002', 'S003'] },
        { id: 'R002', name: '西江支流', warningLevel: 8.2, dangerLevel: 9.8, guaranteedLevel: 10.5, stations: ['S004', 'S005'] },
        { id: 'R003', name: '北江灌渠', warningLevel: 6.5, dangerLevel: 7.6, guaranteedLevel: 8.2, stations: ['S006', 'S007', 'S008'] }
    ];

    var STATIONS = [
        { id: 'S001', name: '东江-桥头站', river: 'R001', lng: 114.12, lat: 23.05 },
        { id: 'S002', name: '东江-塘厦站', river: 'R001', lng: 114.05, lat: 22.98 },
        { id: 'S003', name: '东江-石龙站', river: 'R001', lng: 113.92, lat: 23.10 },
        { id: 'S004', name: '西江-太平站', river: 'R002', lng: 113.65, lat: 22.85 },
        { id: 'S005', name: '西江-虎门站', river: 'R002', lng: 113.72, lat: 22.78 },
        { id: 'S006', name: '北江-松岗站', river: 'R003', lng: 113.88, lat: 23.22 },
        { id: 'S007', name: '北江-公明站', river: 'R003', lng: 113.95, lat: 23.15 },
        { id: 'S008', name: '北江-福永站', river: 'R003', lng: 113.82, lat: 23.08 }
    ];

    var RESERVOIRS = [
        { id: 'RS01', name: '石岩水库', capacity: 5200, currentLevel: 78, warningLevel: 85, lng: 113.92, lat: 22.68 },
        { id: 'RS02', name: '铁岗水库', capacity: 8400, currentLevel: 72, warningLevel: 88, lng: 113.88, lat: 22.72 },
        { id: 'RS03', name: '西丽水库', capacity: 4500, currentLevel: 65, warningLevel: 82, lng: 113.95, lat: 22.58 },
        { id: 'RS04', name: '长岭皮水库', capacity: 2800, currentLevel: 81, warningLevel: 85, lng: 114.02, lat: 22.62 },
        { id: 'RS05', name: '公明水库', capacity: 6200, currentLevel: 74, warningLevel: 86, lng: 113.98, lat: 22.78 }
    ];

    var PUMP_STATIONS = [
        { id: 'P001', name: '北环泵站', capacity: 45, status: 'running', load: 72 },
        { id: 'P002', name: '南头泵站', capacity: 60, status: 'running', load: 58 },
        { id: 'P003', name: '西乡泵站', capacity: 35, status: 'standby', load: 0 },
        { id: 'P004', name: '蛇口泵站', capacity: 50, status: 'running', load: 85 },
        { id: 'P005', name: '福永泵站', capacity: 40, status: 'maintenance', load: 0 }
    ];

    var FLOOD_AREA_NAMES = [
        '北环大道-新洲立交', '深南大道-科技园段', '滨海大道-后海立交', '北环-科苑立交',
        '深南-华侨城段', '滨海-深圳湾段', '107国道-西乡段', '广深高速-福永出口',
        '梅观高速-坂田出口', '南坪快速-塘朗段', '北环-安托山段', '深南-车公庙段',
        '滨海-红树林段', '北环-沙河西立交', '深南-世界之窗', '滨海-海上世界',
        '留仙大道-大学城', '南海大道-南油段', '创业路-南山中心区', '望海路-蛇口港',
        '兴海大道-前海段', '东滨路-南油立交', '后海大道-海岸城', '科苑路-科技园南',
        '高新南四道-创维大厦', '白石路-京基百纳', '沙河西路-西丽段', '龙珠大道-桃源村',
        '南光高速-白芒出口', '松白路-石岩段', '宝石路-应人石', '龙大高速-光明出口',
        '观光路-观澜段', '高尔夫大道-牛湖', '平龙路-平湖段', '丹平快速-白泥坑',
        '布沙路-大芬段', '深惠路-横岗段', '水官高速-布龙出口', '龙翔大道-中心城',
        '龙城大道-龙岗政府', '吉祥路-天虹商场', '龙平西路-回龙埔', '黄阁路-大运城',
        '盐田大道-北山立交', '深盐路-沙头角', '盘山公路-恩上村', '罗沙路-莲塘段',
        '沙湾路-东湖宾馆', '爱国路-水库新村', '沿河路-文锦渡', '深南-人民南立交',
        '建设路-火车站', '和平路-罗湖口岸', '红岭路-荔枝公园', '上步路-科学馆',
        '华强北-赛格广场', '福华路-会展中心', '金田路-市民中心', '益田路-购物公园',
        '新洲路-莲花山', '彩田路-中级法院', '皇岗路-福田口岸', '香蜜湖路-车公庙',
        '农林路-山姆会员店', '侨香路-香蜜北', '梅林路-下梅林', '北环-银湖立交',
        '泥岗路-红岗花园', '笋岗路-八卦岭', '红桂路-桂园中学', '解放路-地王大厦',
        '东门路-老街商圈', '文锦路-湖贝村', '布心路-翠竹段', '沙湾路-大望村',
        '丹沙路-南岭村', '布沙路-樟树布', '南湾路-沙湾关', '布澜路-李朗段',
        '平吉大道-华南城', '龙景立交-甘坑', '坂雪岗大道-万科城', '五和大道-民治段',
        '梅龙路-深圳北站', '民治大道-横岭', '福龙路-南坪出口', '新区大道-白石龙',
        '观澜大道-松元', '观光路-大水坑', '福前路-悦兴围', '泗黎路-黎光'
    ];

    var TEAM_NAMES = ['一连', '二连', '三连', '四连', '五连', '六连', '七连', '八连', '九连', '十连', '十一连', '十二连'];
    var TEAM_STATUS = ['ready', 'ready', 'ready', 'ready', 'working', 'working', 'busy'];

    var WAREHOUSES = [
        { id: 'W001', name: '中心仓库', address: '南山区北环大道8168号', lng: 113.93, lat: 22.57 },
        { id: 'W002', name: '东部分库', address: '龙岗区龙翔大道2001号', lng: 114.25, lat: 22.72 },
        { id: 'W003', name: '北部分库', address: '龙华区观澜大道358号', lng: 114.05, lat: 22.68 },
        { id: 'W004', name: '南部分库', address: '盐田区盐田大道1099号', lng: 114.28, lat: 22.55 }
    ];

    var MATERIAL_CATEGORIES = ['抢险设备', '防汛物资', '救生装备', '照明通讯', '后勤保障'];
    var MATERIAL_NAMES = {
        '抢险设备': ['移动式抽水泵', '推土机', '挖掘机', '装载机', '应急发电机'],
        '防汛物资': ['编织袋', '土工布', '防浪布', '铅丝笼', '木桩', '钢管扣件'],
        '救生装备': ['救生衣', '救生圈', '冲锋舟', '橡皮艇', '抛投器'],
        '照明通讯': ['应急照明灯', '探照灯', '对讲机', '卫星电话', '移动基站'],
        '后勤保障': ['折叠床', '棉被', '雨衣雨鞋', '安全帽', '应急食品']
    };

    var INSPECTOR_NAMES = ['张伟', '李明', '王强', '刘洋', '陈杰', '赵辉', '孙磊', '周鹏'];
    var DANGER_TYPES = ['道路积水', '地下车库进水', '河堤冲刷', '围墙倒塌', '树木倒伏', '管线破损', '交通中断', '人员受困'];

    function pad(n, len) {
        return String(n).padStart(len || 2, '0');
    }

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function randInt(min, max) {
        return Math.floor(rand(min, max + 1));
    }

    function pick(arr) {
        return arr[randInt(0, arr.length - 1)];
    }

    function formatDate(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    function generateTimeSeries(hours, stepMinutes, baseValue, volatility) {
        var points = [];
        var now = new Date();
        now.setMinutes(0, 0, 0);
        for (var h = hours; h >= 0; h--) {
            for (var m = 0; m < 60; m += stepMinutes) {
                var t = new Date(now.getTime() - h * 3600 * 1000 - m * 60 * 1000);
                var noise = (Math.random() - 0.5) * volatility;
                var trend = Math.sin((hours - h) / 4) * volatility * 0.8;
                var surge = (hours - h > 6 && hours - h < 14) ? Math.sin((hours - h - 6) / 4 * Math.PI) * volatility * 1.2 : 0;
                points.push({
                    time: formatDate(t),
                    value: +(baseValue + trend + noise + surge).toFixed(2)
                });
            }
        }
        return points;
    }

    function generateRiverData() {
        var result = {};
        RIVERS.forEach(function (r) {
            var riverBase = {
                'R001': 11.8, 'R002': 7.8, 'R003': 6.0
            }[r.id];
            result[r.id] = {
                info: r,
                stations: {},
                series: generateTimeSeries(24, 15, riverBase, 0.4)
            };
            r.stations.forEach(function (sid) {
                var s = STATIONS.find(function (st) { return st.id === sid; });
                var stationBase = riverBase + rand(-0.6, 0.6);
                result[r.id].stations[sid] = {
                    info: s,
                    current: +(stationBase + Math.sin(Date.now() / 500000) * 0.3).toFixed(2),
                    series: generateTimeSeries(24, 15, stationBase, 0.35),
                    flowRate: randInt(320, 1800),
                    velocity: +rand(1.2, 3.4).toFixed(1)
                };
            });
        });
        return result;
    }

    function generateRainfallData() {
        var result = {};
        STATIONS.forEach(function (s) {
            result[s.id] = {
                station: s,
                hourly: generateTimeSeries(24, 60, rand(4, 12), 6),
                accumulated: 0
            };
            result[s.id].accumulated = result[s.id].hourly.reduce(function (sum, p) {
                return sum + Math.max(0, p.value);
            }, 0).toFixed(1);
        });
        return result;
    }

    function generateFloodPoints() {
        var points = [];
        for (var i = 0; i < 86; i++) {
            var level = Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : Math.random() < 0.65 ? 2 : 3;
            var depth = level === 0 ? rand(0, 8)
                : level === 1 ? rand(8, 25)
                : level === 2 ? rand(25, 55)
                : rand(55, 120);
            points.push({
                id: 'FP' + pad(i + 1, 3),
                name: FLOOD_AREA_NAMES[i] || ('易涝点-' + (i + 1)),
                level: level,
                depth: +depth.toFixed(1),
                affectedArea: randInt(level * 120, level * 600 + 200),
                traffic: ['畅通', '缓行', '拥堵', '封闭'][Math.min(level, 3)],
                reported: !!Math.round(Math.random() * 0.7),
                lastUpdate: formatDate(new Date(Date.now() - randInt(3, 45) * 60000)),
                history: generateTimeSeries(48, 60, level * 15 + 5, 10).map(function (p) {
                    return { time: p.time, depth: Math.max(0, +(p.value).toFixed(1)) };
                }),
                nearbyPumps: [pick(PUMP_STATIONS).id, pick(PUMP_STATIONS).id].filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 2),
                lng: 113.8 + rand(0.1, 0.55),
                lat: 22.5 + rand(0.1, 0.35)
            });
        }
        return points;
    }

    function generateReservoirData() {
        return RESERVOIRS.map(function (r) {
            return {
                ...r,
                series: generateTimeSeries(24, 60, r.currentLevel, 3),
                inflow: randInt(18, 95),
                outflow: randInt(15, 78),
                discharge: r.currentLevel > r.warningLevel - 5 ? randInt(12, 45) : 0
            };
        });
    }

    function generateTeams() {
        var teams = [];
        for (var i = 0; i < 12; i++) {
            var status = pick(TEAM_STATUS);
            teams.push({
                id: 'T' + pad(i + 1, 2),
                name: '抢险' + TEAM_NAMES[i],
                leader: pick(INSPECTOR_NAMES),
                phone: '138' + pad(randInt(0, 99999999), 8),
                memberCount: randInt(8, 28),
                status: status,
                currentTask: status !== 'ready' ? pick(DANGER_TYPES) + '处置' : null,
                targetFloodPoint: status !== 'ready' ? 'FP' + pad(randInt(1, 86), 3) : null,
                progress: status === 'working' ? randInt(25, 75) : status === 'busy' ? randInt(80, 98) : 0,
                equipment: ['冲锋舟', '抽水泵', '应急灯', '救生绳'].slice(0, randInt(2, 4)),
                lng: 113.82 + rand(0.08, 0.48),
                lat: 22.52 + rand(0.06, 0.32),
                eta: 0
            });
        }
        return teams;
    }

    function generateMaterials() {
        var materials = [];
        var idx = 1;
        WAREHOUSES.forEach(function (w) {
            MATERIAL_CATEGORIES.forEach(function (cat) {
                MATERIAL_NAMES[cat].forEach(function (name) {
                    var stock = randInt(25, 1500);
                    var min = randInt(30, 180);
                    materials.push({
                        id: 'M' + pad(idx++, 4),
                        name: name,
                        category: cat,
                        warehouse: w.id,
                        warehouseName: w.name,
                        unit: ['台', '条', '件', '套', '米', '个', '只', '顶'][randInt(0, 7)],
                        stock: stock,
                        minStock: min,
                        lowStock: stock < min * 1.3,
                        unitPrice: randInt(25, 3800),
                        lastUpdate: formatDate(new Date(Date.now() - randInt(1, 240) * 3600 * 1000))
                    });
                });
            });
        });
        return materials;
    }

    function generateMaterialFlows(count) {
        var flows = [];
        var types = ['调拨入库', '调拨出库', '盘盈入库', '报损出库', '应急出库'];
        for (var i = 0; i < count; i++) {
            var type = pick(types);
            var from = type.indexOf('入库') >= 0 ? '供应商A' : pick(WAREHOUSES).name;
            var to = type.indexOf('出库') >= 0 ? '抢险现场' : pick(WAREHOUSES).name;
            flows.push({
                id: 'FL' + pad(i + 1, 5),
                type: type,
                materialName: pick(MATERIAL_NAMES[pick(MATERIAL_CATEGORIES)]),
                quantity: randInt(5, 200),
                from: from,
                to: to,
                operator: pick(INSPECTOR_NAMES),
                time: formatDate(new Date(Date.now() - i * randInt(12, 95) * 60000)),
                reason: type === '应急出库' ? pick(DANGER_TYPES) + '处置' : '正常调度'
            });
        }
        return flows.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
    }

    function generateAlerts() {
        var alerts = [];
        var types = [
            { type: 'water', icon: 'bi-water', level: 'danger', title: '水位超警戒' },
            { type: 'flood', icon: 'bi-droplet-half', level: 'warning', title: '易涝点积水告警' },
            { type: 'rain', icon: 'bi-cloud-rain-heavy', level: 'warning', title: '暴雨预警' },
            { type: 'danger', icon: 'bi-exclamation-octagon', level: 'danger', title: '险情上报' },
            { type: 'stock', icon: 'bi-box', level: 'warning', title: '物资库存预警' }
        ];
        for (var i = 0; i < 18; i++) {
            var t = pick(types);
            alerts.push({
                id: 'AL' + pad(i + 1, 4),
                type: t.type,
                icon: t.icon,
                level: t.level,
                title: t.title,
                content: pick(FLOOD_AREA_NAMES) + ' ' + t.title + '，当前等级：' + pick(['黄色', '橙色', '红色']),
                time: formatDate(new Date(Date.now() - i * randInt(3, 48) * 60000)),
                unread: i < 7,
                relatedId: 'FP' + pad(randInt(1, 86), 3)
            });
        }
        return alerts;
    }

    function generateInspections() {
        var inspections = [];
        for (var i = 0; i < 15; i++) {
            inspections.push({
                id: 'IN' + pad(i + 1, 5),
                inspector: pick(INSPECTOR_NAMES),
                floodPoint: 'FP' + pad(randInt(1, 86), 3),
                floodPointName: pick(FLOOD_AREA_NAMES),
                dangerType: pick(DANGER_TYPES),
                depth: randInt(5, 85),
                affected: randInt(80, 900),
                description: '现场巡查发现积水较深，已影响交通通行，建议立即安排抽排作业。',
                images: [],
                time: formatDate(new Date(Date.now() - i * randInt(10, 75) * 60000)),
                status: pick(['待处理', '处理中', '已解决'])
            });
        }
        return inspections;
    }

    function generateTimelineEvents() {
        var events = [];
        var templates = [
            { type: 'info', icon: 'bi-info-circle', build: function () {
                return { title: '自动监测', desc: pick(STATIONS).name + '水位上升至' + rand(8, 14).toFixed(2) + '米' };
            }},
            { type: 'warning', icon: 'bi-cloud-rain-heavy', build: function () {
                return { title: '气象预警', desc: '发布' + pick(['黄色', '橙色', '蓝色']) + '暴雨预警，预计未来3小时降水' + randInt(40, 140) + '毫米' };
            }},
            { type: 'danger', icon: 'bi-exclamation-triangle', build: function () {
                return { title: '险情上报', desc: pick(INSPECTOR_NAMES) + '在' + pick(FLOOD_AREA_NAMES).slice(0, 10) + '上报' + pick(DANGER_TYPES) };
            }},
            { type: 'success', icon: 'bi-truck', build: function () {
                return { title: '队伍调度', desc: '抢险' + pick(TEAM_NAMES) + '已出动前往' + pick(FLOOD_AREA_NAMES).slice(0, 10) };
            }},
            { type: 'success', icon: 'bi-box-arrow-right', build: function () {
                return { title: '物资调拨', desc: '从' + pick(WAREHOUSES).name + '调出' + randInt(20, 280) + '件物资至抢险现场' };
            }},
            { type: 'success', icon: 'bi-check-circle', build: function () {
                return { title: '处置完成', desc: pick(FLOOD_AREA_NAMES).slice(0, 10) + '险情已排除，交通恢复正常' };
            }}
        ];
        for (var i = 0; i < 25; i++) {
            var t = pick(templates);
            var data = t.build();
            events.push({
                id: 'EV' + pad(i + 1, 4),
                type: t.type,
                icon: t.icon,
                title: data.title,
                description: data.desc,
                time: formatDate(new Date(Date.now() - i * randInt(8, 65) * 60000)),
                causeOf: i > 5 && Math.random() < 0.25 ? 'EV' + pad(i - randInt(2, 5), 4) : null
            });
        }
        return events.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
    }

    function generateDispatchLogs() {
        var logs = [];
        for (var i = 0; i < 10; i++) {
            var teamId = 'T' + pad(randInt(1, 12), 2);
            logs.push({
                id: 'DL' + pad(i + 1, 4),
                teamId: teamId,
                teamName: '抢险' + TEAM_NAMES[parseInt(teamId.slice(1)) - 1],
                from: { lng: 113.82 + rand(0.08, 0.48), lat: 22.52 + rand(0.06, 0.32) },
                to: { lng: 113.82 + rand(0.08, 0.48), lat: 22.52 + rand(0.06, 0.32) },
                toFloodPoint: 'FP' + pad(randInt(1, 86), 3),
                distance: +rand(2.2, 18.6).toFixed(1),
                eta: randInt(8, 38),
                dispatcher: pick(INSPECTOR_NAMES),
                time: formatDate(new Date(Date.now() - i * randInt(15, 90) * 60000)),
                reason: pick(DANGER_TYPES)
            });
        }
        return logs;
    }

    function getResponseChecklist(level) {
        var checklists = {
            'I': [
                { text: '市委市政府主要领导坐镇指挥', checked: true },
                { text: '启动全市一级应急广播', checked: true },
                { text: '所有水库满负荷泄洪预排', checked: false },
                { text: '低洼地带居民全部转移', checked: false },
                { text: '全部应急队伍24小时待命', checked: true },
                { text: '关闭地下空间与易涝交通隧道', checked: false },
                { text: '请求省级应急支援力量', checked: false },
                { text: '停课停产停工停业通知', checked: true }
            ],
            'II': [
                { text: '分管副市长坐镇指挥中心', checked: true },
                { text: '全市泵站全部启动运行', checked: true },
                { text: '重点水库执行预泄调度', checked: true },
                { text: '易涝区周边队伍前置部署', checked: false },
                { text: '地下车库沙包封堵预备', checked: false },
                { text: '加密水文监测频率至每30分钟', checked: true }
            ],
            'III': [
                { text: '应急办主任坐镇指挥', checked: true },
                { text: '关键部位泵站启动', checked: true },
                { text: '巡查队伍加密巡查频次', checked: false },
                { text: '物资前置调拨准备', checked: true },
                { text: '重点水库监控运行状态', checked: true }
            ],
            'IV': [
                { text: '值班人员到岗到位', checked: true },
                { text: '保持常规监测频率', checked: true },
                { text: '应急队伍保持通讯畅通', checked: true },
                { text: '关注气象预报动态', checked: true }
            ]
        };
        return checklists[level] || [];
    }

    function getResponseThresholds(level) {
        return {
            'I': { waterWarning: 0.85, waterDanger: 0.92, floodWarning: 2 },
            'II': { waterWarning: 0.90, waterDanger: 0.96, floodWarning: 2 },
            'III': { waterWarning: 0.95, waterDanger: 1.0, floodWarning: 3 },
            'IV': { waterWarning: 1.0, waterDanger: 1.05, floodWarning: 3 }
        }[level];
    }

    return {
        RIVERS: RIVERS,
        STATIONS: STATIONS,
        RESERVOIRS: RESERVOIRS,
        PUMP_STATIONS: PUMP_STATIONS,
        WAREHOUSES: WAREHOUSES,
        MATERIAL_CATEGORIES: MATERIAL_CATEGORIES,
        MATERIAL_NAMES: MATERIAL_NAMES,
        INSPECTOR_NAMES: INSPECTOR_NAMES,
        DANGER_TYPES: DANGER_TYPES,
        generateRiverData: generateRiverData,
        generateRainfallData: generateRainfallData,
        generateFloodPoints: generateFloodPoints,
        generateReservoirData: generateReservoirData,
        generateTeams: generateTeams,
        generateMaterials: generateMaterials,
        generateMaterialFlows: generateMaterialFlows,
        generateAlerts: generateAlerts,
        generateInspections: generateInspections,
        generateTimelineEvents: generateTimelineEvents,
        generateDispatchLogs: generateDispatchLogs,
        getResponseChecklist: getResponseChecklist,
        getResponseThresholds: getResponseThresholds
    };
})();
