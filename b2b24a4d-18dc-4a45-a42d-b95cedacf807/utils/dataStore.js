define(['jquery'], function ($) {
    'use strict';

    var STORAGE_KEY = 'print_quality_data_v1';
    var MAX_SAMPLES = 50000;
    var cache = null;

    var FACTORIES = [
        '北京新华印刷厂', '上海中华印刷有限公司', '广州南方印务', '深圳华图印刷',
        '杭州东信印刷', '南京金陵印刷', '天津北方印务', '成都蜀蓉彩印',
        '武汉长江印刷', '西安西京彩印', '重庆山城印刷', '沈阳东北印务',
        '青岛海洋印刷', '长沙潇湘彩印', '郑州中原印务', '哈尔滨龙印',
        '济南鲁信印刷', '福州闽东彩印'
    ];

    var PRODUCT_TYPES = ['出版物印刷', '包装印刷', '标签印刷', '票据印刷'];
    var PROCESSES = ['胶印', '柔印', '凹印', '数码印刷'];
    var GRADES = ['优等品', '一等品', '合格品', '不合格品'];
    var STATUSES = ['待检测', '已检测待判定', '已判定待报告', '报告已生成'];

    var DEFECT_TYPES = ['划痕', '脏点', '折皱', '墨皮', '拉毛', '套印不准', '糊版', '飞墨', '条痕', '起泡'];

    var THRESHOLDS = {
        default: {
            dimensions: {
                color: { weight: 0.25, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                register: { weight: 0.25, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                dot: { weight: 0.20, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                density: { weight: 0.15, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                surface: { weight: 0.15, maxScore: 100, pass: 70, excellent: 90, good: 80 }
            },
            totalPass: 75,
            totalGood: 85,
            totalExcellent: 92
        },
        '出版物印刷': {
            dimensions: {
                color: { weight: 0.25, maxScore: 100, pass: 72, excellent: 92, good: 82 },
                register: { weight: 0.20, maxScore: 100, pass: 72, excellent: 92, good: 82 },
                dot: { weight: 0.25, maxScore: 100, pass: 72, excellent: 92, good: 82 },
                density: { weight: 0.15, maxScore: 100, pass: 72, excellent: 92, good: 82 },
                surface: { weight: 0.15, maxScore: 100, pass: 72, excellent: 92, good: 82 }
            },
            totalPass: 76,
            totalGood: 86,
            totalExcellent: 93
        },
        '包装印刷': {
            dimensions: {
                color: { weight: 0.25, maxScore: 100, pass: 68, excellent: 88, good: 78 },
                register: { weight: 0.30, maxScore: 100, pass: 68, excellent: 88, good: 78 },
                dot: { weight: 0.15, maxScore: 100, pass: 68, excellent: 88, good: 78 },
                density: { weight: 0.15, maxScore: 100, pass: 68, excellent: 88, good: 78 },
                surface: { weight: 0.15, maxScore: 100, pass: 68, excellent: 88, good: 78 }
            },
            totalPass: 72,
            totalGood: 82,
            totalExcellent: 90
        },
        '标签印刷': {
            dimensions: {
                color: { weight: 0.20, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                register: { weight: 0.30, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                dot: { weight: 0.20, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                density: { weight: 0.10, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                surface: { weight: 0.20, maxScore: 100, pass: 70, excellent: 90, good: 80 }
            },
            totalPass: 74,
            totalGood: 84,
            totalExcellent: 92
        },
        '票据印刷': {
            dimensions: {
                color: { weight: 0.15, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                register: { weight: 0.35, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                dot: { weight: 0.20, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                density: { weight: 0.15, maxScore: 100, pass: 70, excellent: 90, good: 80 },
                surface: { weight: 0.15, maxScore: 100, pass: 70, excellent: 90, good: 80 }
            },
            totalPass: 75,
            totalGood: 85,
            totalExcellent: 92
        }
    };

    function loadData() {
        if (cache) return cache;
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                cache = JSON.parse(raw);
            } else {
                cache = createEmptyData();
                saveData();
            }
        } catch (e) {
            cache = createEmptyData();
        }
        return cache;
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        } catch (e) {
            console.error('存储失败:', e);
        }
    }

    function createEmptyData() {
        return {
            samples: [],
            reportCounter: 0,
            nextId: 1,
            createdAt: new Date().toISOString()
        };
    }

    function pad(n, len) {
        len = len || 4;
        var s = String(n);
        while (s.length < len) s = '0' + s;
        return s;
    }

    function generateBarcode() {
        var data = loadData();
        var now = new Date();
        var y = now.getFullYear();
        var m = pad(now.getMonth() + 1, 2);
        var d = pad(now.getDate(), 2);
        var seq = pad(data.nextId, 5);
        return 'PY' + y + m + d + seq;
    }

    function generateReportNo() {
        var data = loadData();
        data.reportCounter++;
        saveData();
        var now = new Date();
        return 'BG' + now.getFullYear() + pad(now.getMonth() + 1, 2) + pad(data.reportCounter, 5);
    }

    function validateBatchNo(batchNo) {
        var regex = /^[A-Z]{3}\d{6}\d{3}$/;
        return regex.test(batchNo);
    }

    function init() {
        loadData();
        if (cache.samples.length === 0) {
            generateMockData(50);
        }
    }

    function generateMockData(count) {
        var data = loadData();
        var now = new Date();

        for (var i = 0; i < count; i++) {
            var daysAgo = Math.floor(Math.random() * 180);
            var submitDate = new Date(now.getTime() - daysAgo * 86400000);

            var colorScore = Math.floor(Math.random() * 35) + 60;
            var registerScore = Math.floor(Math.random() * 35) + 60;
            var dotScore = Math.floor(Math.random() * 35) + 60;
            var densityScore = Math.floor(Math.random() * 35) + 60;
            var surfaceScore = Math.floor(Math.random() * 35) + 60;

            var sample = createSample({
                factory: FACTORIES[Math.floor(Math.random() * FACTORIES.length)],
                productType: PRODUCT_TYPES[Math.floor(Math.random() * PRODUCT_TYPES.length)],
                process: PROCESSES[Math.floor(Math.random() * PROCESSES.length)],
                batchNo: 'ABC' + pad(submitDate.getFullYear() % 100, 2) +
                    pad(submitDate.getMonth() + 1, 2) + pad(submitDate.getDate(), 2) +
                    pad(Math.floor(Math.random() * 1000), 3),
                submitDate: submitDate.toISOString().split('T')[0],
                submitter: '送检员' + (Math.floor(Math.random() * 10) + 1),
                quantity: Math.floor(Math.random() * 5000) + 500,
                spec: (Math.floor(Math.random() * 3) + 1) + '色印刷'
            });

            sample.status = '已检测待判定';
            sample.detectData = {
                color: {
                    labL: (45 + Math.random() * 10).toFixed(2),
                    labA: (10 + Math.random() * 5).toFixed(2),
                    labB: (-15 + Math.random() * 5).toFixed(2),
                    deltaE: (Math.random() * 5).toFixed(2),
                    score: colorScore,
                    remark: ''
                },
                register: {
                    c_m: (Math.random() * 0.3).toFixed(3),
                    c_y: (Math.random() * 0.3).toFixed(3),
                    c_k: (Math.random() * 0.3).toFixed(3),
                    m_y: (Math.random() * 0.3).toFixed(3),
                    score: registerScore,
                    remark: ''
                },
                dot: {
                    expandRate5: (5 + Math.random() * 10).toFixed(2),
                    expandRate50: (10 + Math.random() * 15).toFixed(2),
                    expandRate75: (5 + Math.random() * 8).toFixed(2),
                    score: dotScore,
                    remark: ''
                },
                density: {
                    points: [
                        (1.2 + Math.random() * 0.3).toFixed(3),
                        (1.2 + Math.random() * 0.3).toFixed(3),
                        (1.2 + Math.random() * 0.3).toFixed(3),
                        (1.2 + Math.random() * 0.3).toFixed(3),
                        (1.2 + Math.random() * 0.3).toFixed(3)
                    ],
                    dispersion: (Math.random() * 0.1).toFixed(3),
                    score: densityScore,
                    remark: ''
                },
                surface: {
                    defects: [],
                    defectCount: Math.floor(Math.random() * 5),
                    score: surfaceScore,
                    remark: ''
                },
                detectDate: submitDate.toISOString().split('T')[0],
                inspector: '质检员' + (Math.floor(Math.random() * 5) + 1)
            };

            if (i < count * 0.6) {
                sample.status = '已判定待报告';
                sample.judgement = calculateJudgement(sample);
                sample.judgement.judgeDate = submitDate.toISOString().split('T')[0];
                sample.judgement.judge = '判定员' + (Math.floor(Math.random() * 3) + 1);

                if (i < count * 0.3) {
                    sample.status = '报告已生成';
                    sample.reportNo = 'BG' + submitDate.getFullYear() +
                        pad(submitDate.getMonth() + 1, 2) + pad(i + 1, 5);
                    sample.reportDate = submitDate.toISOString().split('T')[0];
                }
            }

            data.samples.push(sample);
        }
        saveData();
    }

    function createSample(formData) {
        var data = loadData();
        var id = data.nextId++;
        var barcode = generateBarcode();

        return {
            id: id,
            barcode: barcode,
            factory: formData.factory,
            productType: formData.productType,
            process: formData.process,
            batchNo: formData.batchNo,
            submitDate: formData.submitDate,
            submitter: formData.submitter,
            quantity: formData.quantity || 0,
            spec: formData.spec || '',
            status: '待检测',
            detectData: null,
            judgement: null,
            reportNo: null,
            reportDate: null,
            createAt: new Date().toISOString(),
            updateAt: new Date().toISOString()
        };
    }

    function addSample(formData) {
        var data = loadData();
        if (data.samples.length >= MAX_SAMPLES) {
            throw new Error('样本数据已达上限（' + MAX_SAMPLES + '条）');
        }
        var sample = createSample(formData);
        data.samples.unshift(sample);
        saveData();
        return sample;
    }

    function getSampleByBarcode(barcode) {
        var data = loadData();
        for (var i = 0; i < data.samples.length; i++) {
            if (data.samples[i].barcode === barcode) {
                return data.samples[i];
            }
        }
        return null;
    }

    function getSampleById(id) {
        var data = loadData();
        for (var i = 0; i < data.samples.length; i++) {
            if (data.samples[i].id === id) {
                return data.samples[i];
            }
        }
        return null;
    }

    function updateSample(barcode, updates) {
        var data = loadData();
        for (var i = 0; i < data.samples.length; i++) {
            if (data.samples[i].barcode === barcode) {
                data.samples[i] = $.extend(true, {}, data.samples[i], updates);
                data.samples[i].updateAt = new Date().toISOString();
                saveData();
                return data.samples[i];
            }
        }
        return null;
    }

    function getAllSamples() {
        var data = loadData();
        return data.samples.slice();
    }

    function getSamplesByStatus(status) {
        var all = getAllSamples();
        return all.filter(function (s) { return s.status === status; });
    }

    function getSamplesByBatch(batchNo) {
        var all = getAllSamples();
        return all.filter(function (s) { return s.batchNo === batchNo; });
    }

    function getSamplesByFilter(filter) {
        var all = getAllSamples();
        return all.filter(function (s) {
            if (filter.factory && s.factory !== filter.factory) return false;
            if (filter.productType && s.productType !== filter.productType) return false;
            if (filter.process && s.process !== filter.process) return false;
            if (filter.status && s.status !== filter.status) return false;
            if (filter.grade && (!s.judgement || s.judgement.grade !== filter.grade)) return false;
            if (filter.batchNo && !s.batchNo.includes(filter.batchNo)) return false;
            if (filter.barcode && !s.barcode.includes(filter.barcode)) return false;
            if (filter.startDate) {
                if (s.submitDate < filter.startDate) return false;
            }
            if (filter.endDate) {
                if (s.submitDate > filter.endDate) return false;
            }
            return true;
        });
    }

    function calculateJudgement(sample) {
        if (!sample.detectData) return null;

        var dd = sample.detectData;
        var productType = sample.productType;
        var rule = THRESHOLDS[productType] || THRESHOLDS.default;
        var dims = rule.dimensions;

        var scores = {
            color: dd.color.score,
            register: dd.register.score,
            dot: dd.dot.score,
            density: dd.density.score,
            surface: dd.surface.score
        };

        var totalScore =
            scores.color * dims.color.weight +
            scores.register * dims.register.weight +
            scores.dot * dims.dot.weight +
            scores.density * dims.density.weight +
            scores.surface * dims.surface.weight;
        totalScore = Math.round(totalScore * 100) / 100;

        var dimAlerts = {};
        dimAlerts.color = scores.color < dims.color.pass;
        dimAlerts.register = scores.register < dims.register.pass;
        dimAlerts.dot = scores.dot < dims.dot.pass;
        dimAlerts.density = scores.density < dims.density.pass;
        dimAlerts.surface = scores.surface < dims.surface.pass;

        var hasSingleFail = Object.values(dimAlerts).some(function (v) { return v; });

        var grade;
        if (hasSingleFail || totalScore < rule.totalPass) {
            grade = '不合格品';
        } else if (totalScore >= rule.totalExcellent && scores.color >= dims.color.excellent &&
            scores.register >= dims.register.excellent && scores.dot >= dims.dot.excellent) {
            grade = '优等品';
        } else if (totalScore >= rule.totalGood) {
            grade = '一等品';
        } else {
            grade = '合格品';
        }

        return {
            scores: scores,
            totalScore: totalScore,
            grade: grade,
            dimAlerts: dimAlerts,
            rule: productType,
            weights: {
                color: dims.color.weight,
                register: dims.register.weight,
                dot: dims.dot.weight,
                density: dims.density.weight,
                surface: dims.surface.weight
            }
        };
    }

    function getFactories() { return FACTORIES.slice(); }
    function getProductTypes() { return PRODUCT_TYPES.slice(); }
    function getProcesses() { return PROCESSES.slice(); }
    function getGrades() { return GRADES.slice(); }
    function getStatuses() { return STATUSES.slice(); }
    function getDefectTypes() { return DEFECT_TYPES.slice(); }
    function getThresholds() { return $.extend(true, {}, THRESHOLDS); }

    function parseCSV(text) {
        var lines = text.trim().split(/\r?\n/);
        var result = [];
        if (lines.length < 2) return result;
        var headers = lines[0].split(',').map(function (h) { return h.trim(); });

        for (var i = 1; i < lines.length; i++) {
            var vals = lines[i].split(',');
            var obj = {};
            headers.forEach(function (h, idx) {
                obj[h] = (vals[idx] || '').trim();
            });
            result.push(obj);
        }
        return result;
    }

    function getStatistics(filter) {
        var samples = getSamplesByFilter(filter || {});
        var stats = {
            total: samples.length,
            gradeCount: { '优等品': 0, '一等品': 0, '合格品': 0, '不合格品': 0, '未判定': 0 },
            dimAvg: { color: 0, register: 0, dot: 0, density: 0, surface: 0, _count: 0 },
            dimAlertCount: { color: 0, register: 0, dot: 0, density: 0, surface: 0 },
            monthly: {},
            byFactory: {},
            byType: {},
            byProcess: {}
        };

        samples.forEach(function (s) {
            if (s.judgement) {
                stats.gradeCount[s.judgement.grade]++;
                var sc = s.judgement.scores;
                stats.dimAvg.color += sc.color;
                stats.dimAvg.register += sc.register;
                stats.dimAvg.dot += sc.dot;
                stats.dimAvg.density += sc.density;
                stats.dimAvg.surface += sc.surface;
                stats.dimAvg._count++;

                Object.keys(s.judgement.dimAlerts).forEach(function (k) {
                    if (s.judgement.dimAlerts[k]) stats.dimAlertCount[k]++;
                });
            } else {
                stats.gradeCount['未判定']++;
            }

            var ym = s.submitDate.substring(0, 7);
            if (!stats.monthly[ym]) stats.monthly[ym] = { total: 0, pass: 0 };
            stats.monthly[ym].total++;
            if (s.judgement && s.judgement.grade !== '不合格品') stats.monthly[ym].pass++;

            if (!stats.byFactory[s.factory]) stats.byFactory[s.factory] = { total: 0, pass: 0 };
            stats.byFactory[s.factory].total++;
            if (s.judgement && s.judgement.grade !== '不合格品') stats.byFactory[s.factory].pass++;

            if (!stats.byType[s.productType]) stats.byType[s.productType] = { total: 0, pass: 0 };
            stats.byType[s.productType].total++;
            if (s.judgement && s.judgement.grade !== '不合格品') stats.byType[s.productType].pass++;

            if (!stats.byProcess[s.process]) stats.byProcess[s.process] = { total: 0, pass: 0 };
            stats.byProcess[s.process].total++;
            if (s.judgement && s.judgement.grade !== '不合格品') stats.byProcess[s.process].pass++;
        });

        if (stats.dimAvg._count > 0) {
            Object.keys(stats.dimAvg).forEach(function (k) {
                if (k !== '_count') stats.dimAvg[k] = +(stats.dimAvg[k] / stats.dimAvg._count).toFixed(1);
            });
        }
        delete stats.dimAvg._count;

        return stats;
    }

    function clearAll() {
        cache = createEmptyData();
        saveData();
    }

    return {
        init: init,
        addSample: addSample,
        getSampleByBarcode: getSampleByBarcode,
        getSampleById: getSampleById,
        updateSample: updateSample,
        getAllSamples: getAllSamples,
        getSamplesByStatus: getSamplesByStatus,
        getSamplesByBatch: getSamplesByBatch,
        getSamplesByFilter: getSamplesByFilter,
        calculateJudgement: calculateJudgement,
        getFactories: getFactories,
        getProductTypes: getProductTypes,
        getProcesses: getProcesses,
        getGrades: getGrades,
        getStatuses: getStatuses,
        getDefectTypes: getDefectTypes,
        getThresholds: getThresholds,
        validateBatchNo: validateBatchNo,
        generateReportNo: generateReportNo,
        parseCSV: parseCSV,
        getStatistics: getStatistics,
        clearAll: clearAll
    };
});
