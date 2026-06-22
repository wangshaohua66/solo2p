define(['jquery', 'bootstrap', 'dataStore', 'chart'], function ($, bootstrap, dataStore, Chart) {
    'use strict';

    var container = null;
    var ctx = null;
    var currentSample = null;
    var initialBarcode = '';

    var defectTypes = dataStore.getDefectTypes();

    function render() {
        var html = '' +
            '<div class="row mb-3">' +
            '<div class="col-12">' +
            '<h3 class="mb-3"><i class="bi bi-rulers text-primary me-2"></i>检测录入</h3>' +
            '</div>' +
            '</div>' +

            '<div class="row g-4">' +
            '<div class="col-lg-4">' +
            '<div class="card shadow-sm mb-4">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-barcode me-2"></i>样本加载</h5>' +
            '</div>' +
            '<div class="card-body">' +
            '<label class="form-label">扫描或输入样本条码</label>' +
            '<div class="input-group mb-3">' +
            '<input type="text" class="form-control form-control-lg" id="barcodeInput" placeholder="PY...">' +
            '<button class="btn btn-primary" id="loadBtn" type="button">' +
            '<i class="bi bi-search me-1"></i>加载</button>' +
            '</div>' +
            '<div class="d-flex justify-content-between align-items-center mb-3">' +
            '<small class="text-muted"><i class="bi bi-upload me-1"></i>批量导入仪器数据</small>' +
            '<label class="btn btn-outline-secondary btn-sm mb-0">' +
            '<input type="file" id="csvFile" accept=".csv" class="d-none">选择CSV' +
            '</label>' +
            '</div>' +
            '<div id="sampleInfo" class="border rounded p-3 bg-light d-none">' +
            '<h6 class="mb-2"><i class="bi bi-info-circle me-1"></i>样本信息</h6>' +
            '<div class="small lh-lg" id="sampleInfoDetail"></div>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h5 class="mb-0"><i class="bi bi-stars me-2"></i>实时评分预览</h5>' +
            '</div>' +
            '<div class="card-body">' +
            '<div class="row g-2 mb-3">' +
            '<div class="col-6"><div class="score-box" data-dim="color"><div class="score-label">色彩</div>' +
            '<div class="score-value" id="pv-color">--</div></div></div>' +
            '<div class="col-6"><div class="score-box" data-dim="register"><div class="score-label">套印</div>' +
            '<div class="score-value" id="pv-register">--</div></div></div>' +
            '<div class="col-6"><div class="score-box" data-dim="dot"><div class="score-label">网点</div>' +
            '<div class="score-value" id="pv-dot">--</div></div></div>' +
            '<div class="col-6"><div class="score-box" data-dim="density"><div class="score-label">密度</div>' +
            '<div class="score-value" id="pv-density">--</div></div></div>' +
            '<div class="col-12"><div class="score-box" data-dim="surface"><div class="score-label">表面</div>' +
            '<div class="score-value" id="pv-surface">--</div></div></div>' +
            '</div>' +
            '<hr>' +
            '<div class="text-center">' +
            '<div class="text-muted small mb-1">加权总分</div>' +
            '<div class="fs-1 fw-bold" id="pv-total" style="color:#6c757d;">--</div>' +
            '<div class="badge fs-6 mt-1" id="pv-grade" style="display:none;">--</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="col-lg-8">' +
            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white">' +
            '<ul class="nav nav-tabs nav-pills card-header-pills" id="detectTabs" role="tablist">' +
            '<li class="nav-item me-1">' +
            '<button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-color">' +
            '<i class="bi bi-palette-fill me-1"></i>色彩准确度</button></li>' +
            '<li class="nav-item me-1">' +
            '<button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-register">' +
            '<i class="bi bi-grid-3x3 me-1"></i>套印精度</button></li>' +
            '<li class="nav-item me-1">' +
            '<button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-dot">' +
            '<i class="bi bi-dice-5 me-1"></i>网点再现</button></li>' +
            '<li class="nav-item me-1">' +
            '<button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-density">' +
            '<i class="bi bi-arrow-down-up me-1"></i>密度均匀性</button></li>' +
            '<li class="nav-item">' +
            '<button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-surface">' +
            '<i class="bi bi-magic me-1"></i>表面质量</button></li>' +
            '</ul>' +
            '</div>' +
            '<div class="card-body tab-content" id="detectTabContent">' +

            '<div class="tab-pane fade show active" id="tab-color">' +
            '<h6 class="mb-3">色彩准确度（Lab色差仪数据）</h6>' +
            '<div class="row g-3 mb-3">' +
            '<div class="col-md-4"><label class="form-label">L*实测值</label>' +
            '<input type="number" step="0.01" class="form-control detect-field" data-dim="color" data-field="labL"></div>' +
            '<div class="col-md-4"><label class="form-label">a*实测值</label>' +
            '<input type="number" step="0.01" class="form-control detect-field" data-dim="color" data-field="labA"></div>' +
            '<div class="col-md-4"><label class="form-label">b*实测值</label>' +
            '<input type="number" step="0.01" class="form-control detect-field" data-dim="color" data-field="labB"></div>' +
            '</div>' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-md-4"><label class="form-label">ΔE*总色差 <span class="text-danger">*</span></label>' +
            '<div class="input-group"><input type="number" step="0.01" class="form-control detect-field required" ' +
            'data-dim="color" data-field="deltaE" placeholder="0-10"><span class="input-group-text">ΔE</span></div></div>' +
            '<div class="col-md-4"><label class="form-label">自动评分</label>' +
            '<input type="number" class="form-control bg-light fw-bold text-primary" id="score-color" readonly></div>' +
            '<div class="col-md-4"><label class="form-label">标准参考</label>' +
            '<div class="form-control bg-light"><small class="text-muted">ΔE≤2优 2-5良 5-8合格 >8差</small></div></div>' +
            '</div>' +
            '<div><label class="form-label">备注说明</label>' +
            '<textarea class="form-control" rows="2" data-dim="color" data-field="remark" placeholder="如：青墨偏色等"></textarea></div>' +
            '</div>' +

            '<div class="tab-pane fade" id="tab-register">' +
            '<h6 class="mb-3">套印精度（各色组套印误差，单位：mm）</h6>' +
            '<div class="row g-3 mb-3">' +
            '<div class="col-md-3"><label class="form-label">C-M误差</label>' +
            '<div class="input-group"><input type="number" step="0.001" class="form-control detect-field" ' +
            'data-dim="register" data-field="c_m"><span class="input-group-text">mm</span></div></div>' +
            '<div class="col-md-3"><label class="form-label">C-Y误差</label>' +
            '<div class="input-group"><input type="number" step="0.001" class="form-control detect-field" ' +
            'data-dim="register" data-field="c_y"><span class="input-group-text">mm</span></div></div>' +
            '<div class="col-md-3"><label class="form-label">C-K误差</label>' +
            '<div class="input-group"><input type="number" step="0.001" class="form-control detect-field" ' +
            'data-dim="register" data-field="c_k"><span class="input-group-text">mm</span></div></div>' +
            '<div class="col-md-3"><label class="form-label">M-Y误差</label>' +
            '<div class="input-group"><input type="number" step="0.001" class="form-control detect-field" ' +
            'data-dim="register" data-field="m_y"><span class="input-group-text">mm</span></div></div>' +
            '</div>' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-md-6"><label class="form-label">综合最大误差</label>' +
            '<input type="text" class="form-control bg-light fw-bold text-warning" id="maxRegisterErr" readonly></div>' +
            '<div class="col-md-6"><label class="form-label">自动评分</label>' +
            '<input type="number" class="form-control bg-light fw-bold text-primary" id="score-register" readonly></div>' +
            '</div>' +
            '<div class="alert alert-info small"><i class="bi bi-info-circle me-1"></i>' +
            '评分规则：误差≤0.05mm优；0.05-0.1mm良；0.1-0.15mm合格；>0.15mm不合格。误差越大加权扣分越多。</div>' +
            '<div><label class="form-label">备注说明</label>' +
            '<textarea class="form-control" rows="2" data-dim="register" data-field="remark"></textarea></div>' +
            '</div>' +

            '<div class="tab-pane fade" id="tab-dot">' +
            '<h6 class="mb-3">网点再现（网点扩大率测量，单位：%）</h6>' +
            '<div class="row g-3 mb-3">' +
            '<div class="col-md-4"><label class="form-label">5%网点扩大</label>' +
            '<div class="input-group"><input type="number" step="0.01" class="form-control detect-field" ' +
            'data-dim="dot" data-field="expandRate5"><span class="input-group-text">%</span></div></div>' +
            '<div class="col-md-4"><label class="form-label">50%网点扩大</label>' +
            '<div class="input-group"><input type="number" step="0.01" class="form-control detect-field" ' +
            'data-dim="dot" data-field="expandRate50"><span class="input-group-text">%</span></div></div>' +
            '<div class="col-md-4"><label class="form-label">75%网点扩大</label>' +
            '<div class="input-group"><input type="number" step="0.01" class="form-control detect-field" ' +
            'data-dim="dot" data-field="expandRate75"><span class="input-group-text">%</span></div></div>' +
            '</div>' +
            '<div class="mb-4">' +
            '<canvas id="dotChart" height="120"></canvas>' +
            '</div>' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-md-6"><label class="form-label">扩大率综合指数</label>' +
            '<input type="text" class="form-control bg-light fw-bold text-warning" id="dotIndex" readonly></div>' +
            '<div class="col-md-6"><label class="form-label">自动评分</label>' +
            '<input type="number" class="form-control bg-light fw-bold text-primary" id="score-dot" readonly></div>' +
            '</div>' +
            '<div><label class="form-label">备注说明</label>' +
            '<textarea class="form-control" rows="2" data-dim="dot" data-field="remark"></textarea></div>' +
            '</div>' +

            '<div class="tab-pane fade" id="tab-density">' +
            '<h6 class="mb-3">密度均匀性（多点密度测量）</h6>' +
            '<div class="row g-3 mb-3">' +
            '<div class="col-md-4 col-6"><label class="form-label">测点1</label>' +
            '<input type="number" step="0.001" class="form-control density-point detect-field" ' +
            'data-dim="density" data-field="p1" data-idx="0"></div>' +
            '<div class="col-md-4 col-6"><label class="form-label">测点2</label>' +
            '<input type="number" step="0.001" class="form-control density-point detect-field" ' +
            'data-dim="density" data-field="p2" data-idx="1"></div>' +
            '<div class="col-md-4 col-6"><label class="form-label">测点3</label>' +
            '<input type="number" step="0.001" class="form-control density-point detect-field" ' +
            'data-dim="density" data-field="p3" data-idx="2"></div>' +
            '<div class="col-md-4 col-6"><label class="form-label">测点4</label>' +
            '<input type="number" step="0.001" class="form-control density-point detect-field" ' +
            'data-dim="density" data-field="p4" data-idx="3"></div>' +
            '<div class="col-md-4 col-6"><label class="form-label">测点5</label>' +
            '<input type="number" step="0.001" class="form-control density-point detect-field" ' +
            'data-dim="density" data-field="p5" data-idx="4"></div>' +
            '<div class="col-md-4 col-6 d-flex align-items-end">' +
            '<button type="button" class="btn btn-outline-secondary w-100" id="addDensityPoint">+ 添加测点</button>' +
            '</div>' +
            '</div>' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-md-3"><label class="form-label">平均密度</label>' +
            '<input type="text" class="form-control bg-light" id="densityAvg" readonly></div>' +
            '<div class="col-md-3"><label class="form-label">离散度σ</label>' +
            '<input type="text" class="form-control bg-light fw-bold text-warning" id="densityDispersion" readonly></div>' +
            '<div class="col-md-6"><label class="form-label">自动评分</label>' +
            '<input type="number" class="form-control bg-light fw-bold text-primary" id="score-density" readonly></div>' +
            '</div>' +
            '<div><label class="form-label">备注说明</label>' +
            '<textarea class="form-control" rows="2" data-dim="density" data-field="remark"></textarea></div>' +
            '</div>' +

            '<div class="tab-pane fade" id="tab-surface">' +
            '<h6 class="mb-3">表面质量（目视检测瑕疵记录）</h6>' +
            '<div class="mb-4">' +
            '<label class="form-label">瑕疵类型 <small class="text-muted">(点击添加)</small></label>' +
            '<div class="row g-2" id="defectTypesBox">';
        defectTypes.forEach(function (d) {
            html += '<div class="col-md-3 col-6">' +
                '<div class="defect-chip" data-type="' + d + '">' +
                '<span class="d-name">' + d + '</span>' +
                '<span class="d-count">0</span>' +
                '<div class="d-ctrl">' +
                '<button type="button" class="btn btn-sm btn-outline-danger d-minus">−</button>' +
                '<button type="button" class="btn btn-sm btn-outline-success d-plus">+</button>' +
                '</div>' +
                '</div></div>';
        });
        html += '</div>' +
            '</div>' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-md-6"><label class="form-label">瑕疵总数</label>' +
            '<input type="number" class="form-control bg-light fw-bold text-warning" id="defectCount" readonly></div>' +
            '<div class="col-md-6"><label class="form-label">自动评分</label>' +
            '<input type="number" class="form-control bg-light fw-bold text-primary" id="score-surface" readonly></div>' +
            '</div>' +
            '<div class="alert alert-info small"><i class="bi bi-info-circle me-1"></i>' +
            '评分规则：每处瑕疵扣2分，严重瑕疵加倍扣分，扣完为止（满分100）。</div>' +
            '<div><label class="form-label">备注说明</label>' +
            '<textarea class="form-control" rows="2" data-dim="surface" data-field="remark"></textarea></div>' +
            '</div>' +

            '</div>' +
            '<div class="card-footer bg-white d-flex justify-content-between align-items-center">' +
            '<div class="small text-muted" id="detectMeta">' +
            '<i class="bi bi-calendar3 me-1"></i>检测日期：' + new Date().toISOString().split('T')[0] +
            ' &nbsp; <i class="bi bi-person me-1"></i>质检员：' +
            '<input type="text" id="inspectorName" class="form-control d-inline-block" style="width:120px;padding:2px 6px;" value="张工">' +
            '</div>' +
            '<div class="d-flex gap-2">' +
            '<button type="button" class="btn btn-outline-secondary" id="resetDetectBtn">清空录入</button>' +
            '<button type="button" class="btn btn-primary px-4" id="saveDetectBtn">' +
            '<i class="bi bi-save me-1"></i>保存检测数据</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        container.html(html);
    }

    function calcColorScore(deltaE) {
        deltaE = +deltaE;
        if (isNaN(deltaE)) return null;
        if (deltaE <= 0.5) return 100;
        if (deltaE <= 1) return 95 + (1 - deltaE) * 10;
        if (deltaE <= 2) return 90 + (2 - deltaE) * 5;
        if (deltaE <= 4) return 80 + (4 - deltaE) * 5;
        if (deltaE <= 6) return 70 + (6 - deltaE) * 5;
        if (deltaE <= 8) return 60 + (8 - deltaE) * 5;
        if (deltaE <= 10) return 40 + (10 - deltaE) * 10;
        return Math.max(0, 40 - (deltaE - 10) * 5);
    }

    function calcRegisterScore(errors) {
        var vals = Object.values(errors).map(function (v) { return Math.abs(+v); }).filter(function (v) { return !isNaN(v); });
        if (vals.length === 0) return null;
        var maxE = Math.max.apply(null, vals);
        var avgE = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        var score = 100;
        if (maxE <= 0.03) score = 100;
        else if (maxE <= 0.05) score = 95 + (0.05 - maxE) * 200;
        else if (maxE <= 0.08) score = 85 + (0.08 - maxE) * 333;
        else if (maxE <= 0.1) score = 75 + (0.1 - maxE) * 500;
        else if (maxE <= 0.15) score = 60 + (0.15 - maxE) * 300;
        else if (maxE <= 0.2) score = 40 + (0.2 - maxE) * 400;
        else score = Math.max(0, 40 - (maxE - 0.2) * 200);
        score = score - avgE * 100;
        return Math.round(Math.max(0, Math.min(100, score)));
    }

    function calcDotScore(rates) {
        var vals = [+rates.expandRate5, +rates.expandRate50, +rates.expandRate75]
            .filter(function (v) { return !isNaN(v); });
        if (vals.length === 0) return null;
        var weights = [0.2, 0.5, 0.3];
        var weighted = 0, weightSum = 0;
        vals.forEach(function (v, i) {
            var w = weights[i] || 0.33;
            var s = 100;
            if (v <= 5) s = 100;
            else if (v <= 10) s = 95 + (10 - v);
            else if (v <= 15) s = 80 + (15 - v) * 3;
            else if (v <= 20) s = 65 + (20 - v) * 3;
            else if (v <= 25) s = 50 + (25 - v) * 3;
            else s = Math.max(0, 50 - (v - 25) * 2);
            weighted += s * w;
            weightSum += w;
        });
        return Math.round(weighted / weightSum);
    }

    function calcDensityScore(points) {
        var nums = points.map(function (v) { return +v; }).filter(function (v) { return !isNaN(v) && v > 0; });
        if (nums.length < 2) return null;
        var avg = nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
        var variance = nums.reduce(function (s, v) { return s + Math.pow(v - avg, 2); }, 0) / nums.length;
        var sigma = Math.sqrt(variance);
        var cv = sigma / avg;
        var score;
        if (cv <= 0.01) score = 100;
        else if (cv <= 0.02) score = 90 + (0.02 - cv) * 1000;
        else if (cv <= 0.03) score = 75 + (0.03 - cv) * 1500;
        else if (cv <= 0.05) score = 55 + (0.05 - cv) * 1000;
        else score = Math.max(0, 55 - (cv - 0.05) * 500);
        return { score: Math.round(score), dispersion: +sigma.toFixed(4), avg: +avg.toFixed(3) };
    }

    function calcSurfaceScore(defects) {
        var total = 0;
        Object.values(defects).forEach(function (c) { total += +c || 0; });
        var deduct = total * 2;
        if (total >= 3) deduct += 3;
        if (total >= 6) deduct += 5;
        if (total >= 10) deduct += 10;
        return Math.max(0, 100 - deduct);
    }

    function getDensityPoints() {
        var pts = [];
        $('.density-point').each(function () {
            var v = $(this).val();
            if (v !== '' && !isNaN(+v)) pts.push(+v);
        });
        return pts;
    }

    function getDefects() {
        var result = {};
        $('.defect-chip').each(function () {
            var type = $(this).data('type');
            var cnt = +$(this).find('.d-count').text();
            if (cnt > 0) result[type] = cnt;
        });
        return result;
    }

    function updateAllScores() {
        var scores = {};
        var deltaE = $('[data-dim="color"][data-field="deltaE"]').val();
        scores.color = calcColorScore(deltaE);
        setScoreDisplay('color', scores.color);

        var regErrors = {
            c_m: $('[data-field="c_m"]').val(),
            c_y: $('[data-field="c_y"]').val(),
            c_k: $('[data-field="c_k"]').val(),
            m_y: $('[data-field="m_y"]').val()
        };
        scores.register = calcRegisterScore(regErrors);
        setScoreDisplay('register', scores.register);
        var maxReg = Math.max.apply(null, Object.values(regErrors).map(function (v) { return Math.abs(+v || 0); }));
        $('#maxRegisterErr').val(maxReg ? maxReg.toFixed(3) + ' mm' : '');

        var dotRates = {
            expandRate5: $('[data-field="expandRate5"]').val(),
            expandRate50: $('[data-field="expandRate50"]').val(),
            expandRate75: $('[data-field="expandRate75"]').val()
        };
        scores.dot = calcDotScore(dotRates);
        setScoreDisplay('dot', scores.dot);

        var pts = getDensityPoints();
        var densityResult = calcDensityScore(pts);
        if (densityResult) {
            scores.density = densityResult.score;
            $('#densityAvg').val(densityResult.avg);
            $('#densityDispersion').val(densityResult.dispersion);
        } else {
            scores.density = null;
            $('#densityAvg').val('');
            $('#densityDispersion').val('');
        }
        setScoreDisplay('density', scores.density);

        var defects = getDefects();
        var defectCount = Object.values(defects).reduce(function (a, b) { return a + b; }, 0);
        $('#defectCount').val(defectCount);
        scores.surface = calcSurfaceScore(defects);
        setScoreDisplay('surface', scores.surface);

        var thresholds = dataStore.getThresholds();
        var productType = currentSample ? currentSample.productType : null;
        var rule = thresholds[productType] || thresholds.default;
        var dims = rule.dimensions;

        var anyNull = false;
        var total = 0;
        Object.keys(scores).forEach(function (k) {
            if (scores[k] === null) anyNull = true;
            else total += (scores[k] * (dims[k]?.weight || 0.2));
        });

        var $total = $('#pv-total');
        var $grade = $('#pv-grade');
        if (anyNull) {
            $total.text('--').css('color', '#6c757d');
            $grade.hide();
        } else {
            total = Math.round(total * 10) / 10;
            $total.text(total);
            if (total >= rule.totalExcellent) { $total.css('color', '#198754'); $grade.text('优等品').addClass('bg-success').removeClass('bg-primary bg-warning bg-danger').show(); }
            else if (total >= rule.totalGood) { $total.css('color', '#0d6efd'); $grade.text('一等品').addClass('bg-primary').removeClass('bg-success bg-warning bg-danger').show(); }
            else if (total >= rule.totalPass) { $total.css('color', '#ffc107'); $grade.text('合格品').addClass('bg-warning').removeClass('bg-success bg-primary bg-danger').show(); }
            else { $total.css('color', '#dc3545'); $grade.text('不合格品').addClass('bg-danger').removeClass('bg-success bg-primary bg-warning').show(); }
        }

        updateDotChart();
    }

    function setScoreDisplay(dim, score) {
        var $field = $('#score-' + dim);
        var $pv = $('#pv-' + dim);
        if (score === null || isNaN(score)) {
            $field.val('');
            $pv.text('--').css('color', '#6c757d');
            return;
        }
        score = Math.round(score);
        $field.val(score);
        $pv.text(score);
        if (score >= 90) $pv.css('color', '#198754');
        else if (score >= 75) $pv.css('color', '#0d6efd');
        else if (score >= 60) $pv.css('color', '#ffc107');
        else $pv.css('color', '#dc3545');
    }

    var dotChartInstance = null;
    function updateDotChart() {
        var v5 = +$('[data-field="expandRate5"]').val() || 0;
        var v50 = +$('[data-field="expandRate50"]').val() || 0;
        var v75 = +$('[data-field="expandRate75"]').val() || 0;
        var values = [v5, v50, v75];
        var labels = ['5%', '50%', '75%'];

        var ctx2 = document.getElementById('dotChart');
        if (!ctx2) return;
        if (typeof Chart === 'undefined') return;

        if (dotChartInstance) dotChartInstance.destroy();
        dotChartInstance = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '扩大率(%)',
                    data: values,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13,110,253,0.1)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 30, title: { display: true, text: '%' } } }
            }
        });
    }

    function loadSample(barcode) {
        var sample = dataStore.getSampleByBarcode(barcode.trim());
        if (!sample) {
            ctx.showToast('未找到样本：' + barcode);
            return;
        }
        currentSample = sample;

        var badgeClass = 'bg-secondary';
        if (sample.status === '待检测') badgeClass = 'bg-warning';
        else if (sample.status === '已检测待判定') badgeClass = 'bg-info';
        else if (sample.status === '已判定待报告') badgeClass = 'bg-primary';
        else if (sample.status === '报告已生成') badgeClass = 'bg-success';

        $('#sampleInfo').removeClass('d-none');
        $('#sampleInfoDetail').html(
            '<div><strong>条码：</strong><span class="text-primary">' + sample.barcode + '</span></div>' +
            '<div><strong>印刷厂：</strong>' + sample.factory + '</div>' +
            '<div><strong>印品/工艺：</strong>' + sample.productType + ' / ' + sample.process + '</div>' +
            '<div><strong>批次号：</strong>' + sample.batchNo + '</div>' +
            '<div><strong>送检日期：</strong>' + sample.submitDate + '</div>' +
            '<div><strong>送检人：</strong>' + sample.submitter + '</div>' +
            '<div><strong>当前状态：</strong><span class="badge ' + badgeClass + ' ms-1">' + sample.status + '</span></div>'
        );

        if (sample.detectData) {
            fillDetectData(sample.detectData);
            ctx.showToast('已加载历史检测数据，可直接编辑更新');
        } else {
            resetDetectForm();
        }

        if (sample.status !== '待检测' && sample.status !== '已检测待判定') {
            $('#saveDetectBtn').prop('disabled', true).text('已归档，无法编辑');
        } else {
            $('#saveDetectBtn').prop('disabled', false).html('<i class="bi bi-save me-1"></i>保存检测数据');
        }
    }

    function fillDetectData(dd) {
        resetDetectForm();
        if (dd.color) {
            $('[data-dim="color"][data-field="labL"]').val(dd.color.labL);
            $('[data-dim="color"][data-field="labA"]').val(dd.color.labA);
            $('[data-dim="color"][data-field="labB"]').val(dd.color.labB);
            $('[data-dim="color"][data-field="deltaE"]').val(dd.color.deltaE);
            $('[data-dim="color"][data-field="remark"]').val(dd.color.remark || '');
        }
        if (dd.register) {
            $('[data-field="c_m"]').val(dd.register.c_m);
            $('[data-field="c_y"]').val(dd.register.c_y);
            $('[data-field="c_k"]').val(dd.register.c_k);
            $('[data-field="m_y"]').val(dd.register.m_y);
            $('[data-dim="register"][data-field="remark"]').val(dd.register.remark || '');
        }
        if (dd.dot) {
            $('[data-field="expandRate5"]').val(dd.dot.expandRate5);
            $('[data-field="expandRate50"]').val(dd.dot.expandRate50);
            $('[data-field="expandRate75"]').val(dd.dot.expandRate75);
            $('[data-dim="dot"][data-field="remark"]').val(dd.dot.remark || '');
        }
        if (dd.density) {
            var pts = dd.density.points || [];
            $('.density-point').each(function (idx) {
                if (pts[idx]) $(this).val(pts[idx]);
            });
            $('[data-dim="density"][data-field="remark"]').val(dd.density.remark || '');
        }
        if (dd.surface) {
            var defects = dd.surface.defects || {};
            $('.defect-chip').each(function () {
                var type = $(this).data('type');
                if (defects[type]) $(this).find('.d-count').text(defects[type]);
            });
            $('[data-dim="surface"][data-field="remark"]').val(dd.surface.remark || '');
        }
        if (dd.inspector) $('#inspectorName').val(dd.inspector);
        updateAllScores();
    }

    function resetDetectForm() {
        $('.detect-field').val('');
        $('textarea[data-dim]').val('');
        $('.defect-chip .d-count').text('0');
        updateAllScores();
    }

    function bindEvents() {
        $('#loadBtn').on('click', function () {
            var code = $('#barcodeInput').val().trim();
            if (!code) { ctx.showToast('请输入条码'); return; }
            loadSample(code);
        });

        $('#barcodeInput').on('keypress', function (e) {
            if (e.which === 13) { e.preventDefault(); $('#loadBtn').click(); }
        });

        $(document).on('input', '.detect-field', function () { updateAllScores(); });
        $(document).on('input', '.density-point', function () { updateAllScores(); });

        $(document).on('click', '.d-plus', function () {
            var $chip = $(this).closest('.defect-chip');
            var c = +$chip.find('.d-count').text();
            $chip.find('.d-count').text(c + 1);
            updateAllScores();
        });
        $(document).on('click', '.d-minus', function () {
            var $chip = $(this).closest('.defect-chip');
            var c = +$chip.find('.d-count').text();
            $chip.find('.d-count').text(Math.max(0, c - 1));
            updateAllScores();
        });

        $('#resetDetectBtn').on('click', function () {
            if (confirm('确认清空当前录入数据？')) resetDetectForm();
        });

        $('#addDensityPoint').on('click', function () {
            var num = $('.density-point').length + 1;
            if (num > 12) { ctx.showToast('最多12个测点'); return; }
            var col = $('<div class="col-md-4 col-6"></div>');
            col.html('<label class="form-label">测点' + num + '</label>' +
                '<input type="number" step="0.001" class="form-control density-point detect-field" ' +
                'data-dim="density" data-field="p' + num + '" data-idx="' + (num - 1) + '">');
            col.insertBefore('#addDensityPoint').closest('.row');
            col.insertBefore($(this).closest('.col-md-4'));
        });

        $('#csvFile').on('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    var rows = dataStore.parseCSV(ev.target.result);
                    if (rows.length === 0) { ctx.showToast('CSV为空或格式错误'); return; }
                    var first = rows[0];
                    if (first['DeltaE'] || first['deltaE']) $('[data-field="deltaE"]').val(first['DeltaE'] || first['deltaE']);
                    if (first['L']) $('[data-field="labL"]').val(first['L']);
                    if (first['A']) $('[data-field="labA"]').val(first['A']);
                    if (first['B']) $('[data-field="labB"]').val(first['B']);
                    var regFields = ['c_m', 'c_y', 'c_k', 'm_y', 'CM', 'CY', 'CK', 'MY'];
                    regFields.forEach(function (f) {
                        if (first[f] !== undefined) {
                            var map = { c_m: 'c_m', CM: 'c_m', c_y: 'c_y', CY: 'c_y', c_k: 'c_k', CK: 'c_k', m_y: 'm_y', MY: 'm_y' };
                            $('[data-field="' + map[f] + '"]').val(first[f]);
                        }
                    });
                    if (first['D5'] || first['e5']) $('[data-field="expandRate5"]').val(first['D5'] || first['e5']);
                    if (first['D50'] || first['e50']) $('[data-field="expandRate50"]').val(first['D50'] || first['e50']);
                    if (first['D75'] || first['e75']) $('[data-field="expandRate75"]').val(first['D75'] || first['e75']);
                    for (var i = 1; i <= 12; i++) {
                        if (first['P' + i] !== undefined) {
                            var $input = $('.density-point[data-idx="' + (i - 1) + '"]');
                            if ($input.length) $input.val(first['P' + i]);
                        }
                    }
                    updateAllScores();
                    ctx.showToast('CSV导入成功，已填充' + rows.length + '行数据');
                } catch (err) {
                    ctx.showToast('CSV解析失败：' + err.message);
                }
            };
            reader.readAsText(file, 'UTF-8');
            e.target.value = '';
        });

        $('#saveDetectBtn').on('click', function () {
            if (!currentSample) {
                ctx.showToast('请先加载样本');
                return;
            }
            if (currentSample.status === '报告已生成') {
                ctx.showToast('报告已生成，不能修改检测数据');
                return;
            }
            var scores = {
                color: calcColorScore($('[data-field="deltaE"]').val()),
                register: calcRegisterScore({
                    c_m: $('[data-field="c_m"]').val(),
                    c_y: $('[data-field="c_y"]').val(),
                    c_k: $('[data-field="c_k"]').val(),
                    m_y: $('[data-field="m_y"]').val()
                }),
                dot: calcDotScore({
                    expandRate5: $('[data-field="expandRate5"]').val(),
                    expandRate50: $('[data-field="expandRate50"]').val(),
                    expandRate75: $('[data-field="expandRate75"]').val()
                }),
                surface: calcSurfaceScore(getDefects())
            };
            var den = calcDensityScore(getDensityPoints());
            scores.density = den ? den.score : null;

            var missing = [];
            Object.keys(scores).forEach(function (k) {
                if (scores[k] === null) {
                    var names = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };
                    missing.push(names[k]);
                }
            });

            if (missing.length > 0) {
                if (!confirm('以下维度未完成：' + missing.join('、') + '\n确定保存吗？')) return;
            }

            var densityPts = [];
            $('.density-point').each(function () {
                var v = $(this).val();
                densityPts.push(v === '' ? '' : (+v).toFixed(3));
            });

            var detectData = {
                color: {
                    labL: $('[data-field="labL"]').val() || '',
                    labA: $('[data-field="labA"]').val() || '',
                    labB: $('[data-field="labB"]').val() || '',
                    deltaE: $('[data-field="deltaE"]').val() || '',
                    score: scores.color === null ? '' : scores.color,
                    remark: $('[data-dim="color"][data-field="remark"]').val()
                },
                register: {
                    c_m: $('[data-field="c_m"]').val() || '',
                    c_y: $('[data-field="c_y"]').val() || '',
                    c_k: $('[data-field="c_k"]').val() || '',
                    m_y: $('[data-field="m_y"]').val() || '',
                    score: scores.register === null ? '' : scores.register,
                    remark: $('[data-dim="register"][data-field="remark"]').val()
                },
                dot: {
                    expandRate5: $('[data-field="expandRate5"]').val() || '',
                    expandRate50: $('[data-field="expandRate50"]').val() || '',
                    expandRate75: $('[data-field="expandRate75"]').val() || '',
                    score: scores.dot === null ? '' : scores.dot,
                    remark: $('[data-dim="dot"][data-field="remark"]').val()
                },
                density: {
                    points: densityPts,
                    dispersion: den ? den.dispersion : '',
                    score: scores.density === null ? '' : scores.density,
                    remark: $('[data-dim="density"][data-field="remark"]').val()
                },
                surface: {
                    defects: getDefects(),
                    defectCount: Object.values(getDefects()).reduce(function (a, b) { return a + b; }, 0),
                    score: scores.surface === null ? '' : scores.surface,
                    remark: $('[data-dim="surface"][data-field="remark"]').val()
                },
                detectDate: new Date().toISOString().split('T')[0],
                inspector: $('#inspectorName').val() || '未指定'
            };

            var newStatus = missing.length > 0 ? '待检测' : '已检测待判定';
            var updated = dataStore.updateSample(currentSample.barcode, {
                detectData: detectData,
                status: newStatus
            });

            if (updated) {
                currentSample = updated;
                ctx.showToast('检测数据保存成功！状态：' + newStatus);
                ctx.updateDataCount();

                if (newStatus === '已检测待判定' && confirm('保存成功，是否立即前往智能判定？')) {
                    ctx.navigate('scoreJudge', [currentSample.barcode]);
                }
            } else {
                ctx.showToast('保存失败');
            }
        });
    }

    function init(context) {
        ctx = context;
        container = $(context.container);
        if (context.params && context.params.length > 0) {
            initialBarcode = context.params[0];
        }
        render();
        bindEvents();

        if (initialBarcode) {
            $('#barcodeInput').val(initialBarcode);
            setTimeout(function () { $('#loadBtn').click(); }, 200);
        }
    }

    function destroy() {
        if (dotChartInstance) { try { dotChartInstance.destroy(); } catch (e) { } }
    }

    return { init: init, destroy: destroy };
});
