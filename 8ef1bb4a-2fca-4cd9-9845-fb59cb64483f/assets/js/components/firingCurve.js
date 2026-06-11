var FiringCurve = (function() {
    var previewChart, detailChart, compareChart;
    var statsChart;

    var COLOR_PALETTE = [
        '#A0522D', '#5F9EA0', '#2E8B57', '#B8860B',
        '#8B4513', '#4682B4', '#708090', '#CD5C5C'
    ];

    function initGlobalCharts() {
        Chart.defaults.font.family = "'Noto Sans SC', sans-serif";
        Chart.defaults.color = '#3D2B1F';

        $('#statsTabs').on('click', 'button[data-tab]', function() {
            var tab = $(this).data('tab');
            $('#statsTabs button').removeClass('active');
            $(this).addClass('active');
            renderStatsTab(tab);
        });

        $('#statsModal').on('shown.bs.modal', function() {
            renderStatsTab('glaze');
        });
    }

    function buildCurvePoints(curveSegments) {
        var points = [{ x: 0, y: 25 }];
        var curTime = 0;
        var curTemp = 25;
        (curveSegments || []).forEach(function(seg) {
            if (seg.type === '保温') {
                curTime += (seg.durationMin || 0);
                points.push({ x: curTime, y: curTemp });
            } else {
                var from = seg.tempFrom != null ? seg.tempFrom : curTemp;
                var to = seg.tempTo != null ? seg.tempTo : from;
                var dur = seg.durationMin || 0;
                curTime += dur;
                curTemp = to;
                points.push({ x: curTime, y: curTemp });
            }
        });
        return points;
    }

    function renderPreview(curveSegments) {
        var ctx = document.getElementById('curvePreviewChart');
        if (!ctx) return;
        if (previewChart) previewChart.destroy();
        var points = buildCurvePoints(curveSegments);
        previewChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '烧成温度',
                    data: points,
                    borderColor: '#A0522D',
                    backgroundColor: 'rgba(160, 82, 45, 0.1)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 4,
                    pointBackgroundColor: '#A0522D'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.parsed.y + '℃ / ' + ctx.parsed.x + '分钟';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: '时间 (分钟)' },
                        grid: { color: 'rgba(160,82,45,0.08)' }
                    },
                    y: {
                        title: { display: true, text: '温度 (℃)' },
                        min: 0,
                        grid: { color: 'rgba(160,82,45,0.08)' }
                    }
                }
            }
        });
    }

    function renderDetail(canvasId, curveSegments, label) {
        var ctx = document.getElementById(canvasId);
        if (!ctx) return null;
        var points = buildCurvePoints(curveSegments);
        return new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: label || '烧成温度',
                    data: points,
                    borderColor: '#5F9EA0',
                    backgroundColor: 'rgba(95, 158, 160, 0.1)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 3,
                    pointBackgroundColor: '#5F9EA0'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: '分钟', font: { size: 10 } },
                        grid: { color: 'rgba(160,82,45,0.06)' },
                        ticks: { font: { size: 10 } }
                    },
                    y: {
                        title: { display: true, text: '℃', font: { size: 10 } },
                        grid: { color: 'rgba(160,82,45,0.06)' },
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    }

    function renderStatsTab(tab) {
        if (statsChart) { statsChart.destroy(); statsChart = null; }
        var canvas = document.getElementById('statsChart');
        var overview = $('#overviewStats');

        if (tab === 'overview') {
            canvas.style.display = 'none';
            overview.removeClass('d-none');
            renderOverview();
            return;
        }
        canvas.style.display = '';
        overview.addClass('d-none');

        AppDB.getAllExperiments().then(function(exps) {
            if (tab === 'glaze') renderGlazeHeatmap(canvas, exps);
            else if (tab === 'defect') renderDefectHeatmap(canvas, exps);
        });
    }

    function renderGlazeHeatmap(canvas, exps) {
        var matMap = {}, catSet = {};
        exps.forEach(function(exp) {
            catSet[exp.glazeCategory] = true;
            (exp.recipe || []).forEach(function(r) {
                if (!matMap[r.materialName]) matMap[r.materialName] = {};
                matMap[r.materialName][exp.glazeCategory] = (matMap[r.materialName][exp.glazeCategory] || 0) + 1;
            });
        });
        var mats = Object.keys(matMap).slice(0, 15);
        var cats = Object.keys(catSet);
        if (mats.length === 0 || cats.length === 0) {
            AppState.publish('toast:show', { type: 'info', message: '数据不足，暂无法生成热力图' });
            return;
        }
        var datasets = cats.map(function(cat, ci) {
            return {
                label: cat,
                data: mats.map(function(m) { return matMap[m][cat] || 0; }),
                backgroundColor: COLOR_PALETTE[ci % COLOR_PALETTE.length]
            };
        });
        statsChart = new Chart(canvas, {
            type: 'bar',
            data: { labels: mats, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: '原料 × 釉色分类 使用频次', font: { size: 14, family: "'Noto Serif SC'" } },
                    legend: { position: 'bottom' }
                },
                scales: {
                    x: { stacked: true, ticks: { maxRotation: 45, minRotation: 30, font: { size: 10 } } },
                    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }

    function renderDefectHeatmap(canvas, exps) {
        var matMap = {}, defectSet = {};
        exps.forEach(function(exp) {
            (exp.defectTags || []).forEach(function(d) { defectSet[d] = true; });
            (exp.recipe || []).forEach(function(r) {
                if (!matMap[r.materialName]) matMap[r.materialName] = {};
                (exp.defectTags || []).forEach(function(d) {
                    matMap[r.materialName][d] = (matMap[r.materialName][d] || 0) + 1;
                });
            });
        });
        var mats = Object.keys(matMap).slice(0, 15);
        var defects = Object.keys(defectSet);
        if (mats.length === 0 || defects.length === 0) {
            AppState.publish('toast:show', { type: 'info', message: '暂无缺陷标签数据' });
            return;
        }
        var datasets = defects.map(function(d, ci) {
            return {
                label: d,
                data: mats.map(function(m) { return matMap[m][d] || 0; }),
                backgroundColor: COLOR_PALETTE[ci % COLOR_PALETTE.length]
            };
        });
        statsChart = new Chart(canvas, {
            type: 'bar',
            data: { labels: mats, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: '原料 × 缺陷 关联频次', font: { size: 14, family: "'Noto Serif SC'" } },
                    legend: { position: 'bottom' }
                },
                scales: {
                    x: { stacked: true, ticks: { maxRotation: 45, minRotation: 30, font: { size: 10 } } },
                    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }

    function renderOverview() {
        AppDB.getAllExperiments().then(function(exps) {
            return AppDB.getMaterials().then(function(mats) {
                var categoryCount = {};
                var atmosphereCount = { '氧化': 0, '还原': 0 };
                var totalPhotos = 0;
                exps.forEach(function(exp) {
                    categoryCount[exp.glazeCategory] = (categoryCount[exp.glazeCategory] || 0) + 1;
                    if (exp.atmosphere) atmosphereCount[exp.atmosphere] = (atmosphereCount[exp.atmosphere] || 0) + 1;
                    totalPhotos += (exp.mediaIds || []).length;
                });
                var catsHtml = Object.keys(categoryCount).map(function(c) {
                    return '<div class="col-6 col-md-3"><div class="card p-3 text-center border-clay">' +
                        '<div class="display-6 text-clay" style="color:#A0522D;">' + categoryCount[c] + '</div>' +
                        '<small class="text-muted">' + c + '</small></div></div>';
                }).join('');
                var html = '<div class="row g-3 mb-3">' +
                    '<div class="col-6 col-md-3"><div class="card p-3 text-center border-clay">' +
                    '<div class="display-6" style="color:#A0522D;">' + exps.length + '</div>' +
                    '<small class="text-muted">实验总数</small></div></div>' +
                    '<div class="col-6 col-md-3"><div class="card p-3 text-center border-clay">' +
                    '<div class="display-6" style="color:#5F9EA0;">' + mats.length + '</div>' +
                    '<small class="text-muted">原料种类</small></div></div>' +
                    '<div class="col-6 col-md-3"><div class="card p-3 text-center border-clay">' +
                    '<div class="display-6" style="color:#2E8B57;">' + (atmosphereCount['氧化'] || 0) + ' / ' + (atmosphereCount['还原'] || 0) + '</div>' +
                    '<small class="text-muted">氧化 / 还原</small></div></div>' +
                    '<div class="col-6 col-md-3"><div class="card p-3 text-center border-clay">' +
                    '<div class="display-6" style="color:#B8860B;">' + totalPhotos + '</div>' +
                    '<small class="text-muted">釉面照片</small></div></div>' +
                    catsHtml + '</div>';
                $('#overviewStats').html(html);
            });
        });
    }

    return {
        initGlobalCharts: initGlobalCharts,
        renderPreview: renderPreview,
        renderDetail: renderDetail,
        buildCurvePoints: buildCurvePoints
    };
})();
