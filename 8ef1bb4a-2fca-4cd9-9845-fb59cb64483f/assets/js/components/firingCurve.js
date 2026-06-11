var FiringCurve = (function() {
    var previewChart, detailChart, compareChart, multiCompareChart;
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

    function renderMultiCompare(experiments) {
        var canvas = document.getElementById('multiCurveChart');
        if (!canvas) return;
        if (multiCompareChart) {
            multiCompareChart.destroy();
            multiCompareChart = null;
        }
        var ctx = canvas.getContext('2d');
        if (!experiments || experiments.length < 2) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        var datasets = experiments.map(function(exp, idx) {
            var points = buildCurvePoints(exp.curveSegments || []);
            return {
                label: exp.name || ('实验' + (idx + 1)),
                data: points,
                borderColor: COLOR_PALETTE[idx % COLOR_PALETTE.length],
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.2,
                pointRadius: 3,
                pointBackgroundColor: COLOR_PALETTE[idx % COLOR_PALETTE.length],
                borderWidth: 2
            };
        });
        multiCompareChart = new Chart(canvas, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataset.label + ': ' + ctx.parsed.y + '℃ / ' + ctx.parsed.x + '分钟';
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

    function renderHeatmapMatrix(canvas, title, rowLabels, colLabels, dataMatrix) {
        var parent = canvas.parentElement;
        $(parent).find('.heatmap-matrix').remove();
        canvas.style.display = 'none';

        var maxFreq = 0;
        for (var i = 0; i < dataMatrix.length; i++) {
            for (var j = 0; j < dataMatrix[i].length; j++) {
                if (dataMatrix[i][j] > maxFreq) maxFreq = dataMatrix[i][j];
            }
        }
        if (maxFreq === 0) maxFreq = 1;

        var html = '<div class="heatmap-matrix" style="overflow-x:auto; padding: 10px;">';
        html += '<div style="font-size:14px; font-weight:bold; font-family:\'Noto Serif SC\'; margin-bottom:10px; color:#3D2B1F;">' + title + '</div>';
        html += '<table style="border-collapse: collapse; font-size: 12px;">';

        html += '<tr>';
        html += '<th style="border:1px solid #d4c4b0; padding:6px 10px; background:#f5efe8; min-width:80px; text-align:center;"></th>';
        for (var ci = 0; ci < colLabels.length; ci++) {
            html += '<th style="border:1px solid #d4c4b0; padding:6px 10px; background:#f5efe8; min-width:60px; text-align:center; white-space:nowrap;">' + colLabels[ci] + '</th>';
        }
        html += '</tr>';

        for (var ri = 0; ri < rowLabels.length; ri++) {
            html += '<tr>';
            html += '<th style="border:1px solid #d4c4b0; padding:6px 10px; background:#f5efe8; text-align:left; white-space:nowrap; font-weight:normal;">' + rowLabels[ri] + '</th>';
            for (var cj = 0; cj < colLabels.length; cj++) {
                var val = dataMatrix[ri][cj];
                var bgStyle = '';
                var textColor = '#3D2B1F';
                if (val > 0) {
                    var alpha = Math.min(1, val / maxFreq * 0.85 + 0.1);
                    bgStyle = 'background: rgba(160,82,45,' + alpha + ');';
                    if (alpha > 0.5) textColor = '#ffffff';
                }
                html += '<td style="border:1px solid #d4c4b0; padding:6px 10px; text-align:center; ' + bgStyle + ' color:' + textColor + ';">' + (val > 0 ? val : '') + '</td>';
            }
            html += '</tr>';
        }
        html += '</table>';
        html += '</div>';

        $(parent).append(html);
    }

    function renderStatsTab(tab) {
        if (statsChart) { statsChart.destroy(); statsChart = null; }
        var canvas = document.getElementById('statsChart');
        var overview = $('#overviewStats');
        var parent = canvas.parentElement;
        $(parent).find('.heatmap-matrix').remove();

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
        var dataMatrix = mats.map(function(m) {
            return cats.map(function(c) { return matMap[m][c] || 0; });
        });
        renderHeatmapMatrix(canvas, '原料 × 釉色分类 使用频次', mats, cats, dataMatrix);
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
        var dataMatrix = mats.map(function(m) {
            return defects.map(function(d) { return matMap[m][d] || 0; });
        });
        renderHeatmapMatrix(canvas, '原料 × 缺陷 关联频次', mats, defects, dataMatrix);
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
        buildCurvePoints: buildCurvePoints,
        renderMultiCompare: renderMultiCompare
    };
})();
