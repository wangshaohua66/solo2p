const MockData = {
    fireStations: [
        { id: 1, name: '一站', firefighters: 78 },
        { id: 2, name: '二站', firefighters: 72 },
        { id: 3, name: '三站', firefighters: 80 },
        { id: 4, name: '四站', firefighters: 75 },
        { id: 5, name: '五站', firefighters: 68 },
        { id: 6, name: '六站', firefighters: 82 },
        { id: 7, name: '七站', firefighters: 70 },
        { id: 8, name: '八站', firefighters: 75 }
    ],

    levels: [
        { id: 1, name: '初级消防员', color: 'info' },
        { id: 2, name: '中级消防员', color: 'success' },
        { id: 3, name: '高级消防员', color: 'warning' },
        { id: 4, name: '消防指挥员', color: 'danger' }
    ],

    specialties: [
        { id: 1, name: '灭火救援', icon: 'fire', color: 'danger' },
        { id: 2, name: '危险化学品处置', icon: 'exclamation-triangle', color: 'warning' },
        { id: 3, name: '高层建筑救援', icon: 'building', color: 'primary' },
        { id: 4, name: '水域救援', icon: 'water', color: 'info' },
        { id: 5, name: '地震搜救', icon: 'geo-alt', color: 'success' }
    ],

    classrooms: Array.from({ length: 18 }, (_, i) => ({
        id: i + 1,
        name: `教室${String(i + 1).padStart(2, '0')}`,
        capacity: 30 + Math.floor(Math.random() * 30),
        type: 'classroom',
        building: i < 9 ? 'A栋' : 'B栋'
    })),

    trainingFields: [
        { id: 101, name: '模拟火场训练场', type: 'field', capacity: 20 },
        { id: 102, name: '危化品处置场', type: 'field', capacity: 15 },
        { id: 103, name: '高空训练塔', type: 'field', capacity: 12 },
        { id: 104, name: '水域救援池', type: 'field', capacity: 16 },
        { id: 105, name: '地震废墟训练场', type: 'field', capacity: 18 },
        { id: 106, name: '综合体能训练场', type: 'field', capacity: 50 }
    ],

    trainingCourses: [
        { id: 1, title: '灭火战术基础', specialtyId: 1, levelId: 1, duration: 3, type: 'theory', defaultLocation: 'classroom' },
        { id: 2, title: '水带连接实操', specialtyId: 1, levelId: 1, duration: 2, type: 'practical', defaultLocation: 'field' },
        { id: 3, title: '危化品识别与防护', specialtyId: 2, levelId: 2, duration: 4, type: 'theory', defaultLocation: 'classroom' },
        { id: 4, title: '堵漏技术实操', specialtyId: 2, levelId: 2, duration: 3, type: 'practical', defaultLocation: 'field' },
        { id: 5, title: '高层建筑供水', specialtyId: 3, levelId: 2, duration: 3, type: 'theory', defaultLocation: 'classroom' },
        { id: 6, title: '绳索救援技术', specialtyId: 3, levelId: 3, duration: 4, type: 'practical', defaultLocation: 'field' },
        { id: 7, title: '水域救援基础', specialtyId: 4, levelId: 1, duration: 2, type: 'theory', defaultLocation: 'classroom' },
        { id: 8, title: '舟艇驾驶实操', specialtyId: 4, levelId: 2, duration: 3, type: 'practical', defaultLocation: 'field' },
        { id: 9, title: '建筑结构与坍塌', specialtyId: 5, levelId: 3, duration: 4, type: 'theory', defaultLocation: 'classroom' },
        { id: 10, title: '搜救犬指挥', specialtyId: 5, levelId: 3, duration: 3, type: 'practical', defaultLocation: 'field' },
        { id: 11, title: '指挥决策与战术', specialtyId: 1, levelId: 4, duration: 6, type: 'theory', defaultLocation: 'classroom' },
        { id: 12, title: '应急通信系统', specialtyId: 1, levelId: 3, duration: 3, type: 'theory', defaultLocation: 'classroom' }
    ],

    schedules: [
        { id: 1, courseId: 1, roomId: 1, dayIndex: 1, startHour: 8, endHour: 11, stationIds: [1, 2], levelId: 1 },
        { id: 2, courseId: 2, roomId: 101, dayIndex: 1, startHour: 14, endHour: 16, stationIds: [1], levelId: 1 },
        { id: 3, courseId: 3, roomId: 5, dayIndex: 2, startHour: 9, endHour: 12, stationIds: [3, 4], levelId: 2 },
        { id: 4, courseId: 5, roomId: 8, dayIndex: 2, startHour: 14, endHour: 17, stationIds: [5, 6], levelId: 2 },
        { id: 5, courseId: 6, roomId: 103, dayIndex: 3, startHour: 8, endHour: 12, stationIds: [3], levelId: 3 },
        { id: 6, courseId: 7, roomId: 3, dayIndex: 3, startHour: 9, endHour: 11, stationIds: [7, 8], levelId: 1 },
        { id: 7, courseId: 8, roomId: 104, dayIndex: 4, startHour: 8, endHour: 11, stationIds: [4], levelId: 2 },
        { id: 8, courseId: 4, roomId: 102, dayIndex: 4, startHour: 13, endHour: 16, stationIds: [2, 5], levelId: 2 },
        { id: 9, courseId: 9, roomId: 10, dayIndex: 5, startHour: 8, endHour: 12, stationIds: [6, 7], levelId: 3 },
        { id: 10, courseId: 11, roomId: 15, dayIndex: 5, startHour: 14, endHour: 20, stationIds: [1, 2, 3, 4], levelId: 4 }
    ],

    questionBank: {
        categories: [
            { id: 1, name: '灭火救援', children: [
                { id: 11, name: '灭火战术', count: 320 },
                { id: 12, name: '消防装备', count: 280 },
                { id: 13, name: '火场供水', count: 180 }
            ]},
            { id: 2, name: '危险化学品', children: [
                { id: 21, name: '危化品分类', count: 240 },
                { id: 22, name: '堵漏技术', count: 160 },
                { id: 23, name: '洗消处理', count: 140 }
            ]},
            { id: 3, name: '高层建筑救援', children: [
                { id: 31, name: '登高作业', count: 200 },
                { id: 32, name: '绳索救援', count: 180 }
            ]},
            { id: 4, name: '水域救援', children: [
                { id: 41, name: '游泳技能', count: 120 },
                { id: 42, name: '舟艇驾驶', count: 100 }
            ]},
            { id: 5, name: '地震搜救', children: [
                { id: 51, name: '建筑结构', count: 150 },
                { id: 52, name: '生命探测', count: 90 }
            ]}
        ],

        questions: [
            { id: 1, type: 'single', categoryId: 11, difficulty: 1, content: '使用直流水扑救火灾时，水枪的有效射程一般不小于多少米？', options: ['A. 5米', 'B. 10米', 'C. 15米', 'D. 20米'], answer: 'C', score: 2 },
            { id: 2, type: 'single', categoryId: 11, difficulty: 2, content: '扑救精密仪器火灾应选择哪种灭火剂？', options: ['A. 水', 'B. 干粉', 'C. 二氧化碳', 'D. 泡沫'], answer: 'C', score: 2 },
            { id: 3, type: 'multiple', categoryId: 12, difficulty: 2, content: '空气呼吸器的主要组成部分包括？', options: ['A. 气瓶', 'B. 减压器', 'C. 面罩', 'D. 供气阀', 'E. 背托'], answer: ['A', 'B', 'C', 'D', 'E'], score: 3 },
            { id: 4, type: 'judge', categoryId: 13, difficulty: 1, content: '火场供水应优先使用天然水源，以节约消防用水。', answer: false, score: 1 },
            { id: 5, type: 'single', categoryId: 21, difficulty: 2, content: '下列哪种物质属于遇水燃烧物质？', options: ['A. 木材', 'B. 金属钠', 'C. 汽油', 'D. 硫磺'], answer: 'B', score: 2 },
            { id: 6, type: 'scenario', categoryId: 11, difficulty: 3, content: '某高层住宅发生火灾，起火层为15层，有人员被困。请制定灭火救援战术方案。', score: 10, hasImage: true },
            { id: 7, type: 'multiple', categoryId: 22, difficulty: 3, content: '常用的堵漏方法有哪些？', options: ['A. 楔塞法', 'B. 捆扎法', 'C. 焊补法', 'D. 粘补法', 'E. 顶压法'], answer: ['A', 'B', 'D', 'E'], score: 3 },
            { id: 8, type: 'judge', categoryId: 31, difficulty: 2, content: '登高作业时，安全带应高挂低用。', answer: true, score: 1 },
            { id: 9, type: 'single', categoryId: 32, difficulty: 2, content: '静力绳的延伸率一般不超过多少？', options: ['A. 2%', 'B. 5%', 'C. 10%', 'D. 15%'], answer: 'B', score: 2 },
            { id: 10, type: 'single', categoryId: 42, difficulty: 2, content: '救生艇在静水载满额定乘员时的航速应不低于多少节？', options: ['A. 4节', 'B. 6节', 'C. 8节', 'D. 10节'], answer: 'B', score: 2 },
            { id: 11, type: 'scenario', categoryId: 52, difficulty: 3, content: '地震废墟救援中，发现一名被困者被预制板压住腿部，请制定救援方案并说明注意事项。', score: 15, hasImage: false },
            { id: 12, type: 'judge', categoryId: 41, difficulty: 1, content: '侧泳是水域救援中常用的游泳姿势。', answer: true, score: 1 }
        ]
    },

    practicalExams: [
        {
            id: 1,
            name: '空气呼吸器佩戴操作',
            levelId: 1,
            specialtyId: 1,
            totalScore: 100,
            passScore: 80,
            items: [
                { id: 101, name: '装备检查', weight: 20, maxScore: 20, description: '检查气瓶压力、面罩密封性、供气阀功能' },
                { id: 102, name: '穿戴速度', weight: 25, maxScore: 25, description: '从开始到完成佩戴的时间（30秒内满分）' },
                { id: 103, name: '操作规范', weight: 30, maxScore: 30, description: '背带调整、面罩贴合、供气连接' },
                { id: 104, name: '安全意识', weight: 25, maxScore: 25, description: '操作流程安全、应急处理' }
            ]
        },
        {
            id: 2,
            name: '水带连接操',
            levelId: 1,
            specialtyId: 1,
            totalScore: 100,
            passScore: 75,
            items: [
                { id: 201, name: '器材准备', weight: 15, maxScore: 15, description: '水带、接口、分水器检查' },
                { id: 202, name: '动作标准', weight: 35, maxScore: 35, description: '抛带、连接、收带动作规范' },
                { id: 203, name: '完成时间', weight: 30, maxScore: 30, description: '规定时间内完成' },
                { id: 204, name: '操作质量', weight: 20, maxScore: 20, description: '接口牢固、水带无扭曲' }
            ]
        },
        {
            id: 3,
            name: '绳索救援技术',
            levelId: 3,
            specialtyId: 3,
            totalScore: 100,
            passScore: 85,
            items: [
                { id: 301, name: '绳结打法', weight: 20, maxScore: 20, description: '八字结、双套结、蝴蝶结等' },
                { id: 302, name: '锚点设置', weight: 25, maxScore: 25, description: '锚点选择与设置规范' },
                { id: 303, name: '上升下降', weight: 30, maxScore: 30, description: '沿绳上升下降操作' },
                { id: 304, name: '安全防护', weight: 25, maxScore: 25, description: '安全检查、防护装备' }
            ]
        }
    ],

    examScores: [
        { firefighterId: 1, name: '张伟', stationId: 1, examId: 1, examName: '空气呼吸器佩戴', theoryScore: 88, practicalScore: 92, totalScore: 90, status: 'passed', date: '2025-01-15' },
        { firefighterId: 2, name: '李强', stationId: 1, examId: 1, examName: '空气呼吸器佩戴', theoryScore: 76, practicalScore: 85, totalScore: 80.5, status: 'passed', date: '2025-01-15' },
        { firefighterId: 3, name: '王磊', stationId: 2, examId: 1, examName: '空气呼吸器佩戴', theoryScore: 65, practicalScore: 70, totalScore: 67.5, status: 'failed', date: '2025-01-16' },
        { firefighterId: 4, name: '刘洋', stationId: 2, examId: 2, examName: '水带连接操', theoryScore: 90, practicalScore: 88, totalScore: 89, status: 'passed', date: '2025-01-18' },
        { firefighterId: 5, name: '陈明', stationId: 3, examId: 2, examName: '水带连接操', theoryScore: 82, practicalScore: 79, totalScore: 80.5, status: 'passed', date: '2025-01-20' }
    ],

    equipment: [
        { id: 1, name: '空气呼吸器', category: '呼吸防护', totalQty: 50, availableQty: 35, icon: 'shield-check', unit: '套', status: 'normal' },
        { id: 2, name: '液压破拆工具组', category: '破拆器材', totalQty: 20, availableQty: 12, icon: 'wrench', unit: '套', status: 'normal' },
        { id: 3, name: '水域救援舟艇', category: '水域救援', totalQty: 8, availableQty: 5, icon: 'boat', unit: '艘', status: 'normal' },
        { id: 4, name: '生命探测仪', category: '搜救装备', totalQty: 6, availableQty: 4, icon: 'search-heart', unit: '台', status: 'normal' },
        { id: 5, name: '个人防护装备', category: '防护装备', totalQty: 200, availableQty: 150, icon: 'person-check', unit: '套', status: 'normal' },
        { id: 6, name: '移动式水炮', category: '灭火装备', totalQty: 15, availableQty: 10, icon: 'droplet', unit: '台', status: 'normal' },
        { id: 7, name: '无人机', category: '侦查装备', totalQty: 4, availableQty: 3, icon: 'drone', unit: '架', status: 'maintenance' },
        { id: 8, name: '化学防护服', category: '防护装备', totalQty: 30, availableQty: 22, icon: 'hazmat', unit: '套', status: 'normal' }
    ],

    equipmentReservations: [
        { id: 1, equipmentId: 1, equipmentName: '空气呼吸器', qty: 5, stationId: 1, stationName: '一站', firefighter: '张伟', purpose: '灭火救援训练', startTime: '2025-01-20 08:00', endTime: '2025-01-20 12:00', status: 'approved', priority: 2 },
        { id: 2, equipmentId: 1, equipmentName: '空气呼吸器', qty: 8, stationId: 2, stationName: '二站', firefighter: '李强', purpose: '实操考核', startTime: '2025-01-20 09:00', endTime: '2025-01-20 16:00', status: 'pending', priority: 3 },
        { id: 3, equipmentId: 3, equipmentName: '水域救援舟艇', qty: 2, stationId: 4, stationName: '四站', firefighter: '赵刚', purpose: '水域救援训练', startTime: '2025-01-21 08:00', endTime: '2025-01-21 17:00', status: 'approved', priority: 2 },
        { id: 4, equipmentId: 2, equipmentName: '液压破拆工具组', qty: 3, stationId: 3, stationName: '三站', firefighter: '王磊', purpose: '破拆技术训练', startTime: '2025-01-22 14:00', endTime: '2025-01-22 17:00', status: 'pending', priority: 1 },
        { id: 5, equipmentId: 5, equipmentName: '个人防护装备', qty: 20, stationId: 5, stationName: '五站', firefighter: '孙明', purpose: '新训队训练', startTime: '2025-01-19 08:00', endTime: '2025-01-25 18:00', status: 'overdue', priority: 1 }
    ],

    firefighters: Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        name: ['张伟', '李强', '王磊', '刘洋', '陈明', '赵刚', '孙明', '周涛', '吴鹏', '郑伟'][i % 10] + (i < 10 ? '' : Math.floor(i / 10)),
        stationId: (i % 8) + 1,
        stationName: `${(i % 8) + 1}站`,
        levelId: (i % 4) + 1,
        levelName: ['初级消防员', '中级消防员', '高级消防员', '消防指挥员'][i % 4],
        theoryHours: { completed: 80 + Math.floor(Math.random() * 60), required: 120 },
        practicalCount: { completed: 8 + Math.floor(Math.random() * 15), required: 20 },
        examPassed: Math.random() > 0.25
    })),

    statistics: {
        overview: {
            totalFirefighters: 600,
            trainingCoverage: 92.5,
            examPassRate: 78.3,
            equipmentUtilization: 68.7
        },
        monthlyTrend: [
            { month: '1月', coverage: 78, passRate: 72, utilization: 55 },
            { month: '2月', coverage: 82, passRate: 75, utilization: 60 },
            { month: '3月', coverage: 85, passRate: 77, utilization: 62 },
            { month: '4月', coverage: 88, passRate: 80, utilization: 65 },
            { month: '5月', coverage: 90, passRate: 79, utilization: 68 },
            { month: '6月', coverage: 92, passRate: 78, utilization: 70 },
            { month: '7月', coverage: 91, passRate: 76, utilization: 72 },
            { month: '8月', coverage: 89, passRate: 74, utilization: 69 },
            { month: '9月', coverage: 93, passRate: 80, utilization: 67 },
            { month: '10月', coverage: 94, passRate: 82, utilization: 71 },
            { month: '11月', coverage: 92, passRate: 79, utilization: 68 },
            { month: '12月', coverage: 92.5, passRate: 78.3, utilization: 68.7 }
        ],
        byStation: [
            { station: '一站', coverage: 95, passRate: 82, utilization: 72, firefighters: 78 },
            { station: '二站', coverage: 90, passRate: 75, utilization: 65, firefighters: 72 },
            { station: '三站', coverage: 93, passRate: 80, utilization: 70, firefighters: 80 },
            { station: '四站', coverage: 88, passRate: 73, utilization: 62, firefighters: 75 },
            { station: '五站', coverage: 94, passRate: 85, utilization: 75, firefighters: 68 },
            { station: '六站', coverage: 91, passRate: 77, utilization: 67, firefighters: 82 },
            { station: '七站', coverage: 87, passRate: 72, utilization: 60, firefighters: 70 },
            { station: '八站', coverage: 92, passRate: 79, utilization: 68, firefighters: 75 }
        ],
        byLevel: [
            { level: '初级消防员', count: 210, passRate: 85, coverage: 95 },
            { level: '中级消防员', count: 180, passRate: 78, coverage: 92 },
            { level: '高级消防员', count: 140, passRate: 70, coverage: 88 },
            { level: '消防指挥员', count: 70, passRate: 65, coverage: 85 }
        ],
        bySpecialty: [
            { specialty: '灭火救援', count: 180, utilization: 75 },
            { specialty: '危化品处置', count: 100, utilization: 62 },
            { specialty: '高层建筑救援', count: 120, utilization: 68 },
            { specialty: '水域救援', count: 90, utilization: 55 },
            { specialty: '地震搜救', count: 110, utilization: 60 }
        ]
    }
};
