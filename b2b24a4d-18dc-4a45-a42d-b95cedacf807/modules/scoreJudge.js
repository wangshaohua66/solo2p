define(['jquery', 'bootstrap', 'dataStore', 'chart', 'datatables-bs5'], function ($, bootstrap, dataStore, Chart) {
    'use strict';

    var container = null;
    var ctx = null;
    var dtInstance = null;
    var radarChart = null;
    var selectedSample = null;
    var initialBarcode = '';
    var pendingChanges = null;

    function render() {
        var thresholds = dataStore.getThresholds();
        var productTypes = dataStore.getProductTypes();

        var html = '' +
            '<div class="row mb-3">' +
            '<div class="col-12">' +
            '<h3 class="mb-3"><i class="bi bi-check2-circle text-primary me-2"></i>智能判定</h3>' +
            '</div>' +
            '</div>' +

            '<div class="row mb-4 g-3">' +
            '<div class="col-lg-9">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">' +
            '<h5 class="mb-0"><i class="bi bi-list-task me-2"></i>待判定样本列表</h5>' +
            '<div class="d-flex gap-2 align-items-center flex-wrap">' +
            '<select class="form-select form-select-sm" id="statusFilter" style="width:160px;">' +
            '<option value="已检测待判定" selected>待判定</option>' +
            '<option value="已判定待报告">已判定待报告</option>' +
            '<option value="全部">全部状态</option>' +
            '</select>' +
            '<button class="btn btn-outline-primary btn-sm" id="autoJudgeBtn">' +
            '<i class="bi bi-lightning me-1"></i>批量自动判定</button>' +
            '</div>' +
            '</div>' +
            '<div class="card-body p-0">' +
            '<div class="table-responsive">' +
            '<table class="table table-hover align-middle mb-0" id="judgeTable">' +
            '<thead class="table-light">' +
            '<tr>' +
            '<th><input type="checkbox" id="checkAll"></th>' +
            '<th>条码</th><th>印刷厂</th><th>印品类型</th>' +
            '<th>批次号</th><th>送检日期</th><th>总分</th><th>状态</th><th>操作</th>' +
            '</tr></thead><tbody></tbody>' +
            '</table></div></div></div></div>' +

            '<div class="col-lg-3">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-sliders me-2"></i>规则阈值</h5>' +
            '</div>' +
            '<div class="card-body">' +
            '<label class="form-label small text-muted">按印品类型切换查看</label>' +
            '<select class="form-select form-select-sm mb-3" id="ruleTypeSelect">' +
            '<option value="default">通用规则</option>';
        productTypes.forEach(function (p) {
            html += '<option value="' + p + '">' + p + '</option>';
        });
        html += '</select>' +
            '<div id="ruleDisplay"></div>' +
            '</div></div></div></div>' +

            '<div class="card shadow-sm" id="judgeDetailCard" style="display:none;">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">' +
            '<div>' +
            '<h5 class="mb-1"><i class="bi bi-eye me-2"></i>判定详情</h5>' +
            '<div class="small text-muted" id="detailSampleInfo"></div>' +
            '</div>' +
            '<div class="d-flex gap-2 align-items-center flex-wrap">' +
            '<div id="currentGradeDisplay"></div>' +
            '<button type="button" class="btn btn-outline-secondary btn-sm" id="closeDetailBtn">关闭</button>' +
            '</div>' +
            '</div>' +
            '<div class="card-body">' +
            '<div class="row g-4">' +
            '<div class="col-lg-6">' +
            '<h6 class="mb-3 border-bottom pb-2"><i class="bi bi-bar-chart-steps me-1"></i>五维度评分</h6>' +
            '<div class="row g-2 mb-3" id="dimScoresBox"></div>' +
            '<h6 class="mb-3 border-bottom pb-2"><i class="bi bi-info-square me-1"></i>规则依据</h6>' +
            '<div class="small lh-lg text-muted" id="ruleBasisBox"></div>' +
            '<h6 class="mt-4 mb-3 border-bottom pb-2"><i class="bi bi-award me-1"></i>手动调整等级</h6>' +
            '<div class="row g-3 align-items-center">' +
            '<div class="col-md-6">' +
            '<label class="form-label">指定等级 <span class="text-danger">*</span></label>' +
            '<select class="form-select" id="overrideGrade">' +
            '<option value="">请选择...</option>' +
            '<option value="优等品">优等品（绿色）</option>' +
            '<option value="一等品">一等品（蓝色）</option>' +
            '<option value="合格品">合格品（黄色）</option>' +
            '<option value="不合格品">不合格品（红色）</option>' +
            '</select></div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">调整理由 <span class="text-danger">*</span></label>' +
            '<input type="text" class="form-control" id="overrideReason" placeholder="例：经复核组确认放宽">' +
            '</div>' +
            '<div class="col-12">' +
            '<button type="button" class="btn btn-warning" id="submitOverrideBtn" disabled>' +
            '<i class="bi bi-shield-check me-1"></i>提交复核组确认</button>' +
            '</div></div></div>' +

            '<div class="col-lg-6">' +
            '<h6 class="mb-3 border-bottom pb-2"><i class="bi bi-diagram-3 me-1"></i>雷达图</h6>' +
            '<div style="position:relative;height:340px;"><canvas id="radarChart"></canvas></div>' +
            '<h6 class="mb-3 border-bottom pb-2"><i class="bi bi-exclamation-triangle me-1"></i>异常预警</h6>' +
            '<div id="alertBox"></div>' +
            '</div>' +

            '<div class="col-12 border-top pt-4">' +
            '<div class="d-flex justify-content-between align-items-center flex-wrap gap-2">' +
            '<div class="small text-muted">' +
            '<i class="bi bi-person me-1"></i>判定员：' +
            '<input type="text" id="judgeName" class="form-control d-inline-block" style="width:120px;padding:2px 6px;" value="李工">' +
            '&nbsp; <i class="bi bi-calendar3 me-1"></i>判定日期：' + new Date().toISOString().split('T')[0] +
            '</div>' +
            '<div class="d-flex gap-2">' +
            '<button type="button" class="btn btn-outline-secondary" id="backDetectBtn">' +
            '<i class="bi bi-pencil-square me-1"></i>返回修改检测</button>' +
            '<button type="button" class="btn btn-success px-4" id="confirmJudgeBtn">' +
            '<i class="bi bi-check2-circle me-1"></i>确认并保存判定</button>' +
            '</div></div></div>' +

            '</div></div></div>';

        container.html(html);
    }

    function getGradeClass(grade) {
        switch (grade) {
            case '优等品': return 'bg-success text-white';
            case '一等品': return 'bg-primary text-white';
            case '合格品': return 'bg-warning text-dark';
            case '不合格品': return 'bg-danger text-white';
            default: return 'bg-secondary text-white';
        }
    }

    function getScoreClass(score) {
        if (score >= 90) return 'success';
        if (score >= 75) return 'primary';
        if (score >= 60) return 'warning';
        return 'danger';
    }

    function renderRuleDisplay() {
        var type = $('#ruleTypeSelect').val() || 'default';
        var thresholds = dataStore.getThresholds();
        var rule = thresholds[type] || thresholds.default;
        var dims = rule.dimensions;

        var names = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };

        var html = '<table class="table table-sm table-borderless small mb-0">' +
            '<thead><tr class="text-muted"><th>维度</th><th>权重</th><th>及格</th><th>优良</th></tr></thead>' +
            '<tbody>';
        Object.keys(dims).forEach(function (k) {
            html += '<tr><td>' + names[k] + '</td>' +
                '<td class="fw-bold">' + (dims[k].weight * 100).toFixed(0) + '%</td>' +
                '<td class="text-danger">' + dims[k].pass + '分</td>' +
                '<td class="text-primary">' + dims[k].good + '分</td></tr>';
        });
        html += '</tbody></table>' +
            '<div class="mt-3 pt-2 border-top small">' +
            '<div>总分及格：<span class="fw-bold text-danger">' + rule.totalPass + '分</span></div>' +
            '<div>一等品线：<span class="fw-bold text-primary">' + rule.totalGood + '分</span></div>' +
            '<div>优等品线：<span class="fw-bold text-success">' + rule.totalExcellent + '分</span></div>' +
            '</div>';
        $('#ruleDisplay').html(html);
    }

    function loadList() {
        var status = $('#statusFilter').val();
        var samples;
        if (status === '全部') {
            samples = dataStore.getAllSamples().filter(function (s) { return s.detectData; });
        } else {
            samples = dataStore.getSamplesByStatus(status);
        }

        if (dtInstance) {
            try { dtInstance.destroy(); } catch (e) { }
        }
        var $tbody = $('#judgeTable tbody').empty();

        if (samples.length === 0) {
            $tbody.append('<tr><td colspan="9" class="text-center text-muted py-5">' +
                '<i class="bi bi-inbox display-4 d-block mb-2"></i>暂无数据</td></tr>');
            initDataTable();
            return;
        }

        samples.forEach(function (s) {
            var totalScore = '--';
            var previewGrade = '<span class="badge bg-secondary">未判定</span>';
            if (s.judgement) {
                totalScore = s.judgement.totalScore;
                previewGrade = '<span class="badge ' + getGradeClass(s.judgement.grade) + '">' + s.judgement.grade + '</span>';
            } else if (s.detectData) {
                var tmp = dataStore.calculateJudgement(s);
                if (tmp) {
                    totalScore = tmp.totalScore;
                    previewGrade = '<span class="badge ' + getGradeClass(tmp.grade) + ' border">' +
                        '<i class="bi bi-lightning me-1"></i>' + tmp.grade + ' (预)</span>';
                }
            }

            $tbody.append(
                '<tr data-barcode="' + s.barcode + '" class="sample-row" style="cursor:pointer;">' +
                '<td onclick="event.stopPropagation();"><input type="checkbox" class="row-check" value="' + s.barcode + '"></td>' +
                '<td class="fw-bold text-primary small">' + s.barcode + '</td>' +
                '<td class="small">' + s.factory + '</td>' +
                '<td><span class="badge bg-light text-dark">' + s.productType + '</span></td>' +
                '<td class="small">' + s.batchNo + '</td>' +
                '<td class="small">' + s.submitDate + '</td>' +
                '<td class="fw-bold text-' + (typeof totalScore === 'number' ? getScoreClass(totalScore) : 'muted') + '">' + totalScore + '</td>' +
                '<td>' + previewGrade + '</td>' +
                '<td>' +
                '<button type="button" class="btn btn-sm btn-outline-primary view-btn" data-barcode="' + s.barcode + '">' +
                '<i class="bi bi-eye me-1"></i>判定</button></td>' +
                '</tr>'
            );
        });

        initDataTable();
    }

    function initDataTable() {
        if (!$.fn.DataTable) return;
        try {
            dtInstance = $('#judgeTable').DataTable({
                pageLength: 10,
                language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/zh.json' },
                columnDefs: [{ orderable: false, targets: 0 }, { orderable: false, targets: 8 }],
                order: [[5, 'desc']]
            });
        } catch (e) {
            console.warn('DataTables init failed:', e);
        }
    }

    function viewSample(barcode) {
        var s = dataStore.getSampleByBarcode(barcode);
        if (!s) { ctx.showToast('样本不存在'); return; }
        selectedSample = s;
        var judge = s.judgement || dataStore.calculateJudgement(s);
        if (!judge) { ctx.showToast('检测数据不完整'); return; }

        pendingChanges = null;

        $('#judgeDetailCard').show();
        $('html, body').animate({ scrollTop: $('#judgeDetailCard').offset().top - 70 }, 300);

        $('#detailSampleInfo').html(
            '<i class="bi bi-upc-scan me-1"></i>' + s.barcode +
            ' &nbsp; <i class="bi bi-building me-1"></i>' + s.factory +
            ' &nbsp; <i class="bi bi-box me-1"></i>' + s.productType + ' / ' + s.process +
            ' &nbsp; <i class="bi bi-calendar me-1"></i>' + s.submitDate
        );

        renderCurrentGrade(judge);
        renderDimScores(judge, s.productType);
        renderRuleBasis(judge, s.productType);
        renderAlerts(judge, s);
        renderRadar(judge);

        $('#overrideGrade').val(judge.grade);
        $('#overrideReason').val('').off('input').on('input', checkOverride);
        $('#overrideGrade').off('change').on('change', checkOverride);
    }

    function renderCurrentGrade(judge) {
        var cls = getGradeClass(judge.grade);
        $('#currentGradeDisplay').html(
            '<div class="text-center">' +
            '<div class="small text-muted mb-1">当前等级（自动计算）</div>' +
            '<div class="fs-5 fw-bold mb-1">' + judge.totalScore + '分</div>' +
            '<span class="badge ' + cls + ' fs-6 px-3 py-2">' + judge.grade + '</span>' +
            '</div>'
        );
    }

    function renderDimScores(judge, productType) {
        var dims = judge.scores;
        var weights = judge.weights;
        var names = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };
        var icons = { color: 'bi-palette', register: 'bi-grid-3x3', dot: 'bi-dice-5', density: 'bi-arrow-down-up', surface: 'bi-magic' };

        var html = '';
        Object.keys(dims).forEach(function (k) {
            var sc = dims[k];
            var scCls = getScoreClass(sc);
            var pct = Math.min(100, Math.max(0, sc));
            var weightPct = (weights[k] * 100).toFixed(0);
            var alertBadge = judge.dimAlerts[k] ? '<i class="bi bi-exclamation-triangle-fill text-danger ms-1"></i>' : '';
            html += '' +
                '<div class="col-6">' +
                '<div class="border rounded p-2">' +
                '<div class="d-flex justify-content-between align-items-center mb-1">' +
                '<small class="fw-semibold"><i class="bi ' + icons[k] + ' me-1"></i>' + names[k] + alertBadge + '</small>' +
                '<small class="text-muted">占比' + weightPct + '%</small>' +
                '</div>' +
                '<div class="progress" style="height:18px;">' +
                '<div class="progress-bar bg-' + scCls + '" style="width:' + pct + '%;">' +
                '<span class="fw-bold">' + sc + '</span></div>' +
                '</div>' +
                '<div class="text-end small mt-1">加权: <strong>' + (sc * weights[k]).toFixed(1) + '</strong> 分</div>' +
                '</div></div>';
        });
        $('#dimScoresBox').html(html);
    }

    function renderRuleBasis(judge, productType) {
        var thresholds = dataStore.getThresholds();
        var rule = thresholds[productType] || thresholds.default;

        $('#ruleBasisBox').html(
            '<div class="mb-2"><i class="bi bi-chevron-right me-1"></i>使用规则：<strong>' +
            (productType || '通用') + '</strong> 判定标准</div>' +
            '<div class="mb-2"><i class="bi bi-chevron-right me-1"></i>总分计算：' +
            Object.keys(judge.weights).map(function (k) {
                return judge.scores[k] + '×' + (judge.weights[k] * 100).toFixed(0) + '%';
            }).join(' + ') + ' = <strong>' + judge.totalScore + '分</strong></div>' +
            '<div class="mb-2"><i class="bi bi-chevron-right me-1"></i>优等品线 ≥ <strong>' + rule.totalExcellent + '</strong>分</div>' +
            '<div class="mb-2"><i class="bi bi-chevron-right me-1"></i>一等品线 ≥ <strong>' + rule.totalGood + '</strong>分</div>' +
            '<div class="mb-2"><i class="bi bi-chevron-right me-1"></i>及格线 ≥ <strong>' + rule.totalPass + '</strong>分</div>' +
            '<div><i class="bi bi-chevron-right me-1"></i>单维度低于及格线自动判不合格</div>'
        );
    }

    function renderAlerts(judge, sample) {
        var alerts = [];
        var dimNames = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };
        Object.keys(judge.dimAlerts).forEach(function (k) {
            if (judge.dimAlerts[k]) {
                alerts.push({
                    type: 'danger', icon: 'bi-x-octagon-fill',
                    title: dimNames[k] + '评分不合格',
                    msg: dimNames[k] + '得分仅 ' + judge.scores[k] + ' 分，低于及格线'
                });
            }
        });

        if (sample.detectData) {
            if (sample.detectData.surface && sample.detectData.surface.defectCount >= 5) {
                alerts.push({ type: 'warning', icon: 'bi-exclamation-triangle-fill', title: '瑕疵数量过多', msg: '共' + sample.detectData.surface.defectCount + '处瑕疵，需重点关注' });
            }
            if (sample.detectData.register) {
                var regs = [+sample.detectData.register.c_m, +sample.detectData.register.c_y, +sample.detectData.register.c_k, +sample.detectData.register.m_y]
                    .filter(function (v) { return !isNaN(v); });
                if (regs.length && Math.max.apply(null, regs) > 0.12) {
                    alerts.push({ type: 'warning', icon: 'bi-exclamation-triangle-fill', title: '套印误差偏大', msg: '最大误差 > 0.12mm，超出常规范围' });
                }
            }
        }

        if (alerts.length === 0) {
            $('#alertBox').html(
                '<div class="alert alert-success mb-0 small">' +
                '<i class="bi bi-check-circle-fill me-2"></i>全部维度合格，无异常预警' +
                '</div>');
            return;
        }

        var html = '';
        alerts.forEach(function (a) {
            html += '<div class="alert alert-' + a.type + ' mb-2 small py-2">' +
                '<i class="bi ' + a.icon + ' me-2"></i>' +
                '<strong>' + a.title + '</strong>：' + a.msg + '</div>';
        });
        $('#alertBox').html(html);
    }

    function renderRadar(judge) {
        if (radarChart) { try { radarChart.destroy(); } catch (e) { } }
        var el = document.getElementById('radarChart');
        if (!el || typeof Chart === 'undefined') return;

        var labels = ['色彩准确度', '套印精度', '网点再现', '密度均匀性', '表面质量'];
        var data = [judge.scores.color, judge.scores.register, judge.scores.dot, judge.scores.density, judge.scores.surface];
        var thresholds = dataStore.getThresholds();
        var rule = thresholds[selectedSample?.productType] || thresholds.default;
        var passLine = [rule.dimensions.color.pass, rule.dimensions.register.pass, rule.dimensions.dot.pass, rule.dimensions.density.pass, rule.dimensions.surface.pass];

        var gradeColor = judge.grade === '优等品' ? '#198754' :
            judge.grade === '一等品' ? '#0d6efd' :
                judge.grade === '合格品' ? '#ffc107' : '#dc3545';

        radarChart = new Chart(el, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '样本得分',
                        data: data,
                        borderColor: gradeColor,
                        backgroundColor: gradeColor + '33',
                        borderWidth: 2,
                        pointRadius: 5
                    },
                    {
                        label: '及格线',
                        data: passLine,
                        borderColor: '#6c757d',
                        backgroundColor: 'rgba(108,117,125,0.05)',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        pointRadius: 2
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    function checkOverride() {
        var grade = $('#overrideGrade').val();
        var reason = $('#overrideReason').val().trim();
        $('#submitOverrideBtn').prop('disabled', !(grade && reason.length >= 2));
    }

    function bindEvents() {
        $('#statusFilter').on('change', loadList);
        $('#ruleTypeSelect').on('change', renderRuleDisplay);
        renderRuleDisplay();

        $('#checkAll').on('change', function () {
            $('.row-check').prop('checked', $(this).prop('checked'));
        });

        $(document).on('click', '.view-btn', function (e) {
            e.stopPropagation();
            viewSample($(this).data('barcode'));
        });
        $(document).on('click', '.sample-row', function () {
            viewSample($(this).data('barcode'));
        });

        $('#closeDetailBtn').on('click', function () {
            $('#judgeDetailCard').hide();
            selectedSample = null;
        });

        $('#backDetectBtn').on('click', function () {
            if (selectedSample) ctx.navigate('detectInput', [selectedSample.barcode]);
        });

        $('#autoJudgeBtn').on('click', function () {
            var checked = $('.row-check:checked');
            var samples;
            if (checked.length > 0) {
                samples = checked.map(function () { return $(this).val(); }).get();
            } else {
                samples = dataStore.getSamplesByStatus('已检测待判定').map(function (s) { return s.barcode; });
            }
            if (samples.length === 0) { ctx.showToast('没有待判定的样本'); return; }
            if (!confirm('将对 ' + samples.length + ' 份样本执行自动判定，是否继续？')) return;

            var success = 0, fail = 0;
            samples.forEach(function (bc) {
                var s = dataStore.getSampleByBarcode(bc);
                if (!s || !s.detectData) { fail++; return; }
                var j = dataStore.calculateJudgement(s);
                if (!j) { fail++; return; }
                j.judgeDate = new Date().toISOString().split('T')[0];
                j.judge = $('#judgeName').val() || '自动判定';
                j.autoJudged = true;
                dataStore.updateSample(bc, { judgement: j, status: '已判定待报告' });
                success++;
            });
            ctx.showToast('判定完成：成功' + success + '份，失败' + fail + '份');
            loadList();
        });

        $('#confirmJudgeBtn').on('click', function () {
            if (!selectedSample) return;
            var j = dataStore.calculateJudgement(selectedSample);
            j.judgeDate = new Date().toISOString().split('T')[0];
            j.judge = $('#judgeName').val() || '未指定';
            j.autoJudged = false;

            var overrideGrade = $('#overrideGrade').val();
            var overrideReason = $('#overrideReason').val().trim();
            if (overrideGrade && overrideReason && overrideGrade !== j.grade) {
                if (!confirm('将把等级从 "' + j.grade + '" 修改为 "' + overrideGrade + '"，需经复核组二次确认。\n确认提交？')) return;
                var final = prompt('请输入复核组确认码（演示用：输入"123"表示通过）：');
                if (final !== '123') { ctx.showToast('复核未通过，保持原等级'); }
                else {
                    j.originalGrade = j.grade;
                    j.grade = overrideGrade;
                    j.overrideReason = overrideReason;
                    j.overridden = true;
                    ctx.showToast('等级已调整为：' + overrideGrade);
                }
            }

            dataStore.updateSample(selectedSample.barcode, { judgement: j, status: '已判定待报告' });
            ctx.showToast('判定已保存：' + j.grade + '（' + j.totalScore + '分）');
            ctx.updateDataCount();
            loadList();

            if (confirm('判定成功，是否立即前往生成报告？')) {
                ctx.navigate('reportGen', [selectedSample.barcode]);
            } else {
                $('#judgeDetailCard').hide();
                selectedSample = null;
            }
        });

        $('#submitOverrideBtn').on('click', function () {
            var grade = $('#overrideGrade').val();
            var reason = $('#overrideReason').val().trim();
            pendingChanges = { grade: grade, reason: reason };
            ctx.showToast('等级调整方案已记录，请点击"确认并保存判定"按钮完成');
        });
    }

    function init(context) {
        ctx = context;
        container = $(context.container);
        if (context.params && context.params.length > 0) initialBarcode = context.params[0];
        render();
        bindEvents();
        loadList();
        if (initialBarcode) setTimeout(function () { viewSample(initialBarcode); }, 300);
    }

    function destroy() {
        if (dtInstance) { try { dtInstance.destroy(); } catch (e) { } }
        if (radarChart) { try { radarChart.destroy(); } catch (e) { } }
    }

    return { init: init, destroy: destroy };
});
