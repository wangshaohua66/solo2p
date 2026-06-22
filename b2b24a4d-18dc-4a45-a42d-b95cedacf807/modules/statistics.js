define(['jquery', 'bootstrap', 'dataStore', 'chart', 'datatables-bs5'], function ($, bootstrap, dataStore, Chart) {
    'use strict';

    var container = null;
    var ctx = null;
    var charts = {};

    function render() {
        var factories = dataStore.getFactories();
        var productTypes = dataStore.getProductTypes();
        var processes = dataStore.getProcesses();

        var html = '' +
            '<div class="row mb-3">' +
            '<div class="col-12">' +
            '<h3 class="mb-3"><i class="bi bi-bar-chart-line text-primary me-2"></i>统计分析</h3>' +
            '</div></div>' +

            '<div class="card shadow-sm mb-4">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-funnel me-2"></i>筛选条件</h5>' +
            '</div>' +
            '<div class="card-body">' +
            '<div class="row g-3 align-items-end">' +
            '<div class="col-md-2"><label class="form-label small">印刷厂</label>' +
            '<select class="form-select form-select-sm" id="stFactory"><option value="">全部厂家</option>';
        factories.forEach(function (f) { html += '<option value="' + f + '">' + f + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-2"><label class="form-label small">印品类型</label>' +
            '<select class="form-select form-select-sm" id="stType"><option value="">全部类型</option>';
        productTypes.forEach(function (p) { html += '<option value="' + p + '">' + p + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-2"><label class="form-label small">工艺类型</label>' +
            '<select class="form-select form-select-sm" id="stProcess"><option value="">全部工艺</option>';
        processes.forEach(function (p) { html += '<option value="' + p + '">' + p + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-2"><label class="form-label small">开始日期</label>' +
            '<input type="date" class="form-control form-control-sm" id="stStart"></div>' +
            '<div class="col-md-2"><label class="form-label small">结束日期</label>' +
            '<input type="date" class="form-control form-control-sm" id="stEnd"></div>' +
            '<div class="col-md-2"><div class="d-flex gap-2">' +
            '<button class="btn btn-primary btn-sm flex-grow-1" id="stApply">' +
            '<i class="bi bi-search me-1"></i>查询</button>' +
            '<button class="btn btn-outline-secondary btn-sm" id="stReset">' +
            '<i class="bi bi-arrow-repeat"></i></button>' +
            '</div></div>' +
            '</div></div></div>' +

            '<div class="row g-4 mb-4">' +
            '<div class="col-lg-3 col-6"><div class="card shadow-sm border-start border-primary border-5">' +
            '<div class="card-body py-3">' +
            '<div class="d-flex justify-content-between align-items-center">' +
            '<div><div class="small text-muted mb-1">样本总数</div>' +
            '<div class="fs-3 fw-bold text-primary" id="stat-total">0</div></div>' +
            '<i class="bi bi-box-seam fs-2 text-primary opacity-50"></i>' +
            '</div></div></div></div>' +
            '<div class="col-lg-3 col-6"><div class="card shadow-sm border-start border-success border-5">' +
            '<div class="card-body py-3">' +
            '<div class="d-flex justify-content-between align-items-center">' +
            '<div><div class="small text-muted mb-1">合格率</div>' +
            '<div class="fs-3 fw-bold text-success" id="stat-passRate">0%</div></div>' +
            '<i class="bi bi-check-circle fs-2 text-success opacity-50"></i>' +
            '</div></div></div></div>' +
            '<div class="col-lg-3 col-6"><div class="card shadow-sm border-start border-warning border-5">' +
            '<div class="card-body py-3">' +
            '<div class="d-flex justify-content-between align-items-center">' +
            '<div><div class="small text-muted mb-1">优等品率</div>' +
            '<div class="fs-3 fw-bold text-warning" id="stat-excellent">0%</div></div>' +
            '<i class="bi bi-award fs-2 text-warning opacity-50"></i>' +
            '</div></div></div></div>' +
            '<div class="col-lg-3 col-6"><div class="card shadow-sm border-start border-danger border-5">' +
            '<div class="card-body py-3">' +
            '<div class="d-flex justify-content-between align-items-center">' +
            '<div><div class="small text-muted mb-1">不合格品</div>' +
            '<div class="fs-3 fw-bold text-danger" id="stat-fail">0</div></div>' +
            '<i class="bi bi-exclamation-triangle fs-2 text-danger opacity-50"></i>' +
            '</div></div></div></div>' +
            '</div>' +

            '<div class="row g-4 mb-4">' +
            '<div class="col-lg-5"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h5 class="mb-0"><i class="bi bi-pie-chart me-2"></i>等级分布</h5>' +
            '<select class="form-select form-select-sm" style="width:auto;" id="pieDim">' +
            '<option value="grade">判定等级</option><option value="type">印品类型</option>' +
            '<option value="process">工艺类型</option><option value="factoryTop">TOP10厂家</option>' +
            '</select></div>' +
            '<div class="card-body"><div style="position:relative;height:320px;"><canvas id="pieChart"></canvas></div></div>' +
            '</div></div>' +

            '<div class="col-lg-7"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h5 class="mb-0"><i class="bi bi-graph-up me-2"></i>月度趋势</h5>' +
            '<div class="btn-group btn-group-sm" role="group">' +
            '<input type="radio" class="btn-check" name="trendType" id="trendCount" autocomplete="off" checked>' +
            '<label class="btn btn-outline-primary" for="trendCount">检测数量</label>' +
            '<input type="radio" class="btn-check" name="trendType" id="trendRate" autocomplete="off">' +
            '<label class="btn btn-outline-primary" for="trendRate">合格率</label>' +
            '</div></div>' +
            '<div class="card-body"><div style="position:relative;height:320px;"><canvas id="trendChart"></canvas></div></div>' +
            '</div></div>' +
            '</div>' +

            '<div class="row g-4 mb-4">' +
            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-thermometer-half me-2"></i>维度异常分布</h5></div>' +
            '<div class="card-body">' +
            '<div style="position:relative;height:300px;"><canvas id="heatChart"></canvas></div>' +
            '<div class="mt-3 small text-muted text-center">' +
            '颜色越深表示该维度不合格频次越高' +
            '</div></div></div></div>' +

            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-diagram-3 me-2"></i>维度平均得分</h5></div>' +
            '<div class="card-body">' +
            '<div style="position:relative;height:300px;"><canvas id="dimAvgChart"></canvas></div>' +
            '</div></div></div>' +
            '</div>' +

            '<div class="row g-4 mb-4">' +
            '<div class="col-lg-4"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h5 class="mb-0"><i class="bi bi-building me-2"></i>厂家合格率排行</h5></div>' +
            '<div class="card-body p-0">' +
            '<div class="table-responsive" style="max-height:340px;overflow-y:auto;">' +
            '<table class="table table-sm table-hover mb-0" id="factoryRankTable">' +
            '<thead class="table-light sticky-top"><tr><th>排名</th><th>印刷厂</th><th>合格率</th><th>样本数</th></tr></thead>' +
            '<tbody></tbody></table></div></div></div></div>' +

            '<div class="col-lg-8"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h5 class="mb-0"><i class="bi bi-arrow-left-right me-2"></i>批次对比分析</h5>' +
            '<div class="d-flex gap-2"><select class="form-select form-select-sm" id="compare1" style="width:180px;"></select>' +
            '<span class="text-muted align-self-center">VS</span>' +
            '<select class="form-select form-select-sm" id="compare2" style="width:180px;"></select>' +
            '<button class="btn btn-primary btn-sm" id="doCompare">对比</button>' +
            '</div></div>' +
            '<div class="card-body">' +
            '<div style="position:relative;height:280px;"><canvas id="compareChart"></canvas></div>' +
            '<div id="compareResult" class="mt-3 small text-center text-muted">请选择两个批次进行对比</div>' +
            '</div></div></div>' +
            '</div>' +

            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-table me-2"></i>印品类型统计详情</h5></div>' +
            '<div class="card-body p-0">' +
            '<div class="table-responsive">' +
            '<table class="table table-hover mb-0" id="statsTable">' +
            '<thead class="table-light"><tr>' +
            '<th>类型</th><th>样本数</th><th>优等品</th><th>一等品</th><th>合格品</th><th>不合格品</th>' +
            '<th>合格率</th><th>平均分</th></tr></thead>' +
            '<tbody></tbody></table></div></div></div>';

        container.html(html);
    }

    function getFilter() {
        return {
            factory: $('#stFactory').val() || '',
            productType: $('#stType').val() || '',
            process: $('#stProcess').val() || '',
            startDate: $('#stStart').val() || '',
            endDate: $('#stEnd').val() || ''
        };
    }

    function updateSummary(stats) {
        var judged = stats.gradeCount['优等品'] + stats.gradeCount['一等品'] +
            stats.gradeCount['合格品'] + stats.gradeCount['不合格品'];
        var pass = stats.gradeCount['优等品'] + stats.gradeCount['一等品'] + stats.gradeCount['合格品'];
        var passRate = judged > 0 ? ((pass / judged) * 100).toFixed(1) : 0;
        var excellentRate = judged > 0 ? ((stats.gradeCount['优等品'] / judged) * 100).toFixed(1) : 0;

        $('#stat-total').text(stats.total);
        $('#stat-passRate').text(passRate + '%');
        $('#stat-excellent').text(excellentRate + '%');
        $('#stat-fail').text(stats.gradeCount['不合格品']);
    }

    function renderPieChart(stats, dim) {
        var ctx2 = document.getElementById('pieChart');
        if (!ctx2) return;
        if (charts.pie) { try { charts.pie.destroy(); } catch (e) { } }

        var labels = [], data = [], colors = [];
        var gradeColors = {
            '优等品': '#198754', '一等品': '#0d6efd', '合格品': '#ffc107',
            '不合格品': '#dc3545', '未判定': '#6c757d'
        };

        if (dim === 'grade') {
            Object.keys(stats.gradeCount).forEach(function (k) {
                if (stats.gradeCount[k] > 0) {
                    labels.push(k);
                    data.push(stats.gradeCount[k]);
                    colors.push(gradeColors[k] || '#6c757d');
                }
            });
        } else if (dim === 'type') {
            Object.keys(stats.byType).forEach(function (k) {
                labels.push(k);
                data.push(stats.byType[k].total);
            });
            colors = ['#0d6efd', '#198754', '#ffc107', '#dc3545'];
        } else if (dim === 'process') {
            Object.keys(stats.byProcess).forEach(function (k) {
                labels.push(k);
                data.push(stats.byProcess[k].total);
            });
            colors = ['#0dcaf0', '#0d6efd', '#6f42c1', '#198754'];
        } else if (dim === 'factoryTop') {
            var sorted = Object.entries(stats.byFactory)
                .sort(function (a, b) { return b[1].total - a[1].total; })
                .slice(0, 10);
            sorted.forEach(function (item) {
                labels.push(item[0].substring(0, 6) + '..');
                data.push(item[1].total);
            });
            colors = ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0'];
        }

        charts.pie = new Chart(ctx2, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
                    tooltip: { callbacks: {
                        label: function (ctx2) {
                            var total = ctx2.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                            var pct = ((ctx2.raw / total) * 100).toFixed(1);
                            return ctx2.label + ': ' + ctx2.raw + ' (' + pct + '%)';
                        }
                    }}
                }
            }
        });
    }

    function renderTrendChart(stats, type) {
        var ctx2 = document.getElementById('trendChart');
        if (!ctx2) return;
        if (charts.trend) { try { charts.trend.destroy(); } catch (e) { } }

        var months = Object.keys(stats.monthly).sort();
        if (months.length === 0) {
            charts.trend = new Chart(ctx2, {
                type: 'line',
                data: { labels: ['暂无数据'], datasets: [{ data: [0] }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
            return;
        }

        var data;
        var label, color, bgColor;

        if (type === 'count') {
            label = '检测数量';
            color = '#0d6efd';
            bgColor = 'rgba(13,110,253,0.15)';
            data = months.map(function (m) { return stats.monthly[m].total; });
        } else {
            label = '合格率';
            color = '#198754';
            bgColor = 'rgba(25,135,84,0.15)';
            data = months.map(function (m) {
                var m2 = stats.monthly[m];
                return m2.total > 0 ? +((m2.pass / m2.total) * 100).toFixed(1) : 0;
            });
        }

        charts.trend = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: bgColor,
                    fill: true, tension: 0.35,
                    pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: color
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: type === 'rate' ? '合格率(%)' : '数量' } },
                    x: { title: { display: true, text: '月份' } }
                }
            }
        });
    }

    function renderHeatChart(stats) {
        var ctx2 = document.getElementById('heatChart');
        if (!ctx2) return;
        if (charts.heat) { try { charts.heat.destroy(); } catch (e) { } }

        var dims = ['color', 'register', 'dot', 'density', 'surface'];
        var labels = ['色彩准确度', '套印精度', '网点再现', '密度均匀性', '表面质量'];
        var values = dims.map(function (d) { return stats.dimAlertCount[d] || 0; });
        var maxVal = Math.max.apply(null, values) || 1;

        charts.heat = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '不合格频次',
                    data: values,
                    backgroundColor: values.map(function (v) {
                        var intensity = 0.3 + (v / maxVal) * 0.7;
                        return 'rgba(220, 53, 69, ' + intensity.toFixed(2) + ')';
                    }),
                    borderRadius: 6, barThickness: 50
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { display: false } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    function renderDimAvgChart(stats) {
        var ctx2 = document.getElementById('dimAvgChart');
        if (!ctx2) return;
        if (charts.dimAvg) { try { charts.dimAvg.destroy(); } catch (e) { } }

        var labels = ['色彩准确度', '套印精度', '网点再现', '密度均匀性', '表面质量'];
        var data = [
            stats.dimAvg.color || 0,
            stats.dimAvg.register || 0,
            stats.dimAvg.dot || 0,
            stats.dimAvg.density || 0,
            stats.dimAvg.surface || 0
        ];

        var colors = data.map(function (v) {
            if (v >= 90) return '#198754';
            if (v >= 75) return '#0d6efd';
            if (v >= 60) return '#ffc107';
            return '#dc3545';
        });

        charts.dimAvg = new Chart(ctx2, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: '平均得分',
                    data: data,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13,110,253,0.25)',
                    borderWidth: 2,
                    pointBackgroundColor: colors,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderFactoryRank(stats) {
        var entries = Object.entries(stats.byFactory);
        entries.sort(function (a, b) {
            var rateA = a[1].total > 0 ? a[1].pass / a[1].total : 0;
            var rateB = b[1].total > 0 ? b[1].pass / b[1].total : 0;
            return rateB - rateA;
        });

        var $tbody = $('#factoryRankTable tbody').empty();
        if (entries.length === 0) {
            $tbody.append('<tr><td colspan="4" class="text-center text-muted py-4">暂无数据</td></tr>');
            return;
        }

        entries.forEach(function (item, idx) {
            var name = item[0];
            var info = item[1];
            var rate = info.total > 0 ? ((info.pass / info.total) * 100).toFixed(1) : '0.0';
            var rankBadge = idx === 0 ? '<i class="bi bi-trophy-fill text-warning"></i>' :
                idx === 1 ? '<i class="bi bi-trophy-fill text-secondary"></i>' :
                    idx === 2 ? '<i class="bi bi-trophy-fill text-danger"></i>' : (idx + 1);
            var rateCls = +rate >= 90 ? 'text-success' : +rate >= 75 ? 'text-primary' : +rate >= 60 ? 'text-warning' : 'text-danger';

            $tbody.append(
                '<tr><td class="text-center fw-bold" style="width:50px;">' + rankBadge + '</td>' +
                '<td class="small">' + name + '</td>' +
                '<td class="fw-bold ' + rateCls + '">' + rate + '%</td>' +
                '<td class="text-muted small">' + info.total + '</td></tr>'
            );
        });
    }

    function renderCompareChart(sample1, sample2) {
        var ctx2 = document.getElementById('compareChart');
        if (!ctx2) return;
        if (charts.compare) { try { charts.compare.destroy(); } catch (e) { } }

        var labels = ['色彩准确度', '套印精度', '网点再现', '密度均匀性', '表面质量'];

        if (!sample1 || !sample2 || !sample1.judgement || !sample2.judgement) {
            charts.compare = new Chart(ctx2, {
                type: 'radar',
                data: { labels: labels, datasets: [] },
                options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } } }
            });
            return;
        }

        var j1 = sample1.judgement.scores;
        var j2 = sample2.judgement.scores;
        var data1 = [j1.color, j1.register, j1.dot, j1.density, j1.surface];
        var data2 = [j2.color, j2.register, j2.dot, j2.density, j2.surface];

        charts.compare = new Chart(ctx2, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    { label: sample1.batchNo, data: data1, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.15)', borderWidth: 2 },
                    { label: sample2.batchNo, data: data2, borderColor: '#fd7e14', backgroundColor: 'rgba(253,126,20,0.15)', borderWidth: 2 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { r: { min: 0, max: 100 } },
                plugins: { legend: { position: 'bottom' } }
            }
        });

        var diff = [];
        labels.forEach(function (l, i) {
            var d = data1[i] - data2[i];
            diff.push(l + ': ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '分');
        });
        $('#compareResult').html(
            '<strong class="text-primary">' + sample1.batchNo + '</strong> 对比 <strong class="text-warning">' + sample2.batchNo + '</strong><br>' +
            '<small class="text-muted">' + diff.join(' | ') + '</small>'
        );
    }

    function renderStatsTable(stats) {
        var $tbody = $('#statsTable tbody').empty();
        var types = Object.keys(stats.byType);

        if (types.length === 0) {
            $tbody.append('<tr><td colspan="8" class="text-center text-muted py-4">暂无数据</td></tr>');
            return;
        }

        var all = dataStore.getSamplesByFilter(getFilter());

        types.forEach(function (type) {
            var info = stats.byType[type];
            var typeSamples = all.filter(function (s) { return s.productType === type && s.judgement; });
            var grades = { '优等品': 0, '一等品': 0, '合格品': 0, '不合格品': 0 };
            var totalScore = 0;
            typeSamples.forEach(function (s) {
                grades[s.judgement.grade]++;
                totalScore += s.judgement.totalScore;
            });

            var passCount = grades['优等品'] + grades['一等品'] + grades['合格品'];
            var passRate = info.total > 0 ? ((passCount / info.total) * 100).toFixed(1) : '0.0';
            var avgScore = typeSamples.length > 0 ? (totalScore / typeSamples.length).toFixed(1) : '0.0';
            var rateCls = +passRate >= 90 ? 'text-success' : +passRate >= 75 ? 'text-primary' : +passRate >= 60 ? 'text-warning' : 'text-danger';

            $tbody.append(
                '<tr>' +
                '<td class="fw-bold">' + type + '</td>' +
                '<td>' + info.total + '</td>' +
                '<td><span class="badge bg-success">' + grades['优等品'] + '</span></td>' +
                '<td><span class="badge bg-primary">' + grades['一等品'] + '</span></td>' +
                '<td><span class="badge bg-warning text-dark">' + grades['合格品'] + '</span></td>' +
                '<td><span class="badge bg-danger">' + grades['不合格品'] + '</span></td>' +
                '<td class="fw-bold ' + rateCls + '">' + passRate + '%</td>' +
                '<td class="fw-bold">' + avgScore + '</td>' +
                '</tr>'
            );
        });
    }

    function loadBatchOptions() {
        var all = dataStore.getSamplesByFilter(getFilter());
        var batchSet = new Set();
        var batchMap = {};
        all.forEach(function (s) {
            if (s.judgement && !batchSet.has(s.batchNo)) {
                batchSet.add(s.batchNo);
                batchMap[s.batchNo] = s;
            }
        });

        var batches = Array.from(batchSet).slice(0, 50);
        var html1 = '<option value="">选择批次A</option>';
        var html2 = '<option value="">选择批次B</option>';
        batches.forEach(function (b) {
            html1 += '<option value="' + b + '">' + b + ' - ' + batchMap[b].factory.substring(0, 6) + '</option>';
            html2 += '<option value="' + b + '">' + b + ' - ' + batchMap[b].factory.substring(0, 6) + '</option>';
        });
        $('#compare1').html(html1);
        $('#compare2').html(html2);
    }

    function refreshAll() {
        var filter = getFilter();
        var stats = dataStore.getStatistics(filter);

        updateSummary(stats);
        renderPieChart(stats, $('#pieDim').val() || 'grade');
        renderTrendChart(stats, $('#trendCount').prop('checked') ? 'count' : 'rate');
        renderHeatChart(stats);
        renderDimAvgChart(stats);
        renderFactoryRank(stats);
        renderStatsTable(stats);
        loadBatchOptions();
    }

    function bindEvents() {
        $('#stApply').on('click', refreshAll);
        $('#stReset').on('click', function () {
            $('#stFactory, #stType, #stProcess, #stStart, #stEnd').val('');
            refreshAll();
        });

        $('#pieDim').on('change', function () {
            var filter = getFilter();
            var stats = dataStore.getStatistics(filter);
            renderPieChart(stats, $(this).val());
        });

        $('input[name="trendType"]').on('change', function () {
            var filter = getFilter();
            var stats = dataStore.getStatistics(filter);
            renderTrendChart(stats, $('#trendCount').prop('checked') ? 'count' : 'rate');
        });

        $('#doCompare').on('click', function () {
            var b1 = $('#compare1').val();
            var b2 = $('#compare2').val();
            if (!b1 || !b2) { ctx.showToast('请选择两个批次'); return; }
            var s1 = dataStore.getSamplesByBatch(b1).find(function (s) { return s.judgement; });
            var s2 = dataStore.getSamplesByBatch(b2).find(function (s) { return s.judgement; });
            renderCompareChart(s1, s2);
        });

        $(document).on('click', '#sideApplyFilter', function () {
            var factory = $('#sideFactoryFilter').val();
            var grade = $('#sideGradeFilter').val();
            var timeRange = $('#sideTimeFilter').val();
            if (factory) $('#stFactory').val(factory);
            if (grade) { /* grade filter could be added */ }
            if (timeRange && timeRange !== 'all') {
                var now = new Date();
                var days = +timeRange;
                var start = new Date(now.getTime() - days * 86400000);
                $('#stStart').val(start.toISOString().split('T')[0]);
                $('#stEnd').val(now.toISOString().split('T')[0]);
            }
            refreshAll();
        });
    }

    function init(context) {
        ctx = context;
        container = $(context.container);
        render();
        bindEvents();

        var now = new Date();
        var start = new Date(now.getTime() - 90 * 86400000);
        $('#stStart').val(start.toISOString().split('T')[0]);
        $('#stEnd').val(now.toISOString().split('T')[0]);

        refreshAll();
    }

    function destroy() {
        Object.values(charts).forEach(function (c) {
            try { if (c && c.destroy) c.destroy(); } catch (e) { }
        });
        charts = {};
    }

    return { init: init, destroy: destroy };
});
