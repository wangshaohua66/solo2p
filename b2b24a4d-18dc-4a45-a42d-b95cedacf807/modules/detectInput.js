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
            '</div>' +

            '<div class="modal fade" id="csvImportModal" tabindex="-1" aria-hidden="true">' +
            '<div class="modal-dialog modal-lg modal-dialog-centered">' +
            '<div class="modal-content">' +
            '<div class="modal-header bg-primary text-white">' +
            '<h5 class="modal-title"><i class="bi bi-filetype-csv me-2"></i>CSV批量导入结果</h5>' +
            '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<div class="row mb-3 g-3">' +
            '<div class="col-md-3"><div class="card border-success text-center p-2"><div class="small text-muted">总解析行数</div><div class="fs-2 fw-bold text-success" id="csvTotalCount">0</div></div></div>' +
            '<div class="col-md-3"><div class="card border-primary text-center p-2"><div class="small text-muted">匹配成功</div><div class="fs-2 fw-bold text-primary" id="csvMatchCount">0</div></div></div>' +
            '<div class="col-md-3"><div class="card border-warning text-center p-2"><div class="small text-muted">未找到样本</div><div class="fs-2 fw-bold text-warning" id="csvMissCount">0</div></div></div>' +
            '<div class="col-md-3"><div class="card border-danger text-center p-2"><div class="small text-muted">导入失败</div><div class="fs-2 fw-bold text-danger" id="csvFailCount">0</div></div></div>' +
            '</div>' +
            '<h6 class="mb-2 border-bottom pb-2"><i class="bi bi-list-check me-1"></i>导入明细</h6>' +
            '<div class="table-responsive" style="max-height:340px;overflow-y:auto;"><table class="table table-sm table-hover mb-0" id="csvResultTable"><thead class="table-light sticky-top"><tr>' +
            '<th>行号</th><th>条码/批次</th><th>匹配样本</th><th>状态</th><th>说明</th>' +
            '</tr></thead><tbody></tbody></table></div>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">关闭</button>' +
            '<button type="button" class="btn btn-primary" id="csvLoadFirstBtn" disabled><i class="bi bi-box-arrow-in-up-right me-1"></i>加载第一条成功样本</button>' +
            '</div></div></div></div>';

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

    function polyfit(x, y, degree) {
        var n = x.length;
        var m = degree + 1;
        var X = [];
        var Y = y.slice();

        for (var i = 0; i < n; i++) {
            var row = [];
            for (var j = 0; j < m; j++) {
                row.push(Math.pow(x[i], j));
            }
            X.push(row);
        }

        function multiply(A, B) {
            var result = [];
            for (var i = 0; i < A.length; i++) {
                result[i] = [];
                for (var j = 0; j < B[0].length; j++) {
                    var sum = 0;
                    for (var k = 0; k < A[0].length; k++) {
                        sum += A[i][k] * B[k][j];
                    }
                    result[i][j] = sum;
                }
            }
            return result;
        }

        function transpose(A) {
            var result = [];
            for (var i = 0; i < A[0].length; i++) {
                result[i] = [];
                for (var j = 0; j < A.length; j++) {
                    result[i][j] = A[j][i];
                }
            }
            return result;
        }

        function invert(A) {
            var n = A.length;
            var aug = [];
            for (var i = 0; i < n; i++) {
                aug[i] = A[i].slice();
                for (var j = 0; j < n; j++) {
                    aug[i].push(i === j ? 1 : 0);
                }
            }

            for (var col = 0; col < n; col++) {
                var maxRow = col;
                for (var row = col + 1; row < n; row++) {
                    if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
                        maxRow = row;
                    }
                }
                var temp = aug[col];
                aug[col] = aug[maxRow];
                aug[maxRow] = temp;

                var pivot = aug[col][col];
                for (var j = col; j < 2 * n; j++) {
                    aug[col][j] /= pivot;
                }

                for (var row = 0; row < n; row++) {
                    if (row !== col && aug[row][col] !== 0) {
                        var factor = aug[row][col];
                        for (var j = col; j < 2 * n; j++) {
                            aug[row][j] -= factor * aug[col][j];
                        }
                    }
                }
            }

            var result = [];
            for (var i = 0; i < n; i++) {
                result[i] = aug[i].slice(n);
            }
            return result;
        }

        var Xt = transpose(X);
        var XtX = multiply(Xt, X);
        var XtX_inv = invert(XtX);
        var XtY = multiply(Xt, Y.map(function (v) { return [v]; }));
        var coeffs = multiply(XtX_inv, XtY);

        return coeffs.map(function (v) { return v[0]; });
    }

    function polyval(coeffs, x) {
        var y = 0;
        for (var i = 0; i < coeffs.length; i++) {
            y += coeffs[i] * Math.pow(x, i);
        }
        return y;
    }

    function calcDotScore(rates) {
        var rawVals = [+rates.expandRate5, +rates.expandRate50, +rates.expandRate75];
        var vals = rawVals.filter(function (v) { return !isNaN(v); });
        if (vals.length < 2) return null;

        var x = [];
        var y = [];
        if (!isNaN(rawVals[0])) { x.push(5); y.push(rawVals[0]); }
        if (!isNaN(rawVals[1])) { x.push(50); y.push(rawVals[1]); }
        if (!isNaN(rawVals[2])) { x.push(75); y.push(rawVals[2]); }

        var ideal5 = 4;
        var ideal50 = 12;
        var ideal75 = 8;

        var idealCoeffs = polyfit([5, 50, 75], [ideal5, ideal50, ideal75], 2);

        var actualCoeffs = polyfit(x, y, Math.min(2, x.length - 1));

        var samplePoints = [10, 20, 30, 40, 50, 60, 70, 80, 90];
        var totalDeviation = 0;
        var maxDeviation = 0;
        var validPoints = 0;

        samplePoints.forEach(function (xp) {
            var idealVal = polyval(idealCoeffs, xp);
            var actualVal = polyval(actualCoeffs, xp);
            var dev = Math.abs(actualVal - idealVal);
            totalDeviation += dev;
            maxDeviation = Math.max(maxDeviation, dev);
            validPoints++;
        });

        x.forEach(function (xp, idx) {
            var idealVal = polyval(idealCoeffs, xp);
            var dev = Math.abs(y[idx] - idealVal);
            totalDeviation += dev * 2;
            maxDeviation = Math.max(maxDeviation, dev);
            validPoints += 2;
        });

        var avgDeviation = totalDeviation / validPoints;

        var yMean = y.reduce(function (a, b) { return a + b; }, 0) / y.length;
        var ssTotal = y.reduce(function (s, v) { return s + Math.pow(v - yMean, 2); }, 0);
        var ssResidual = 0;
        for (var i = 0; i < x.length; i++) {
            var predicted = polyval(actualCoeffs, x[i]);
            ssResidual += Math.pow(y[i] - predicted, 2);
        }
        var rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 1;

        var devScore = Math.max(0, 100 - avgDeviation * 6 - maxDeviation * 2);
        var curveScore = Math.max(0, 60 + rSquared * 40);

        var rawScore5 = rawVals[0] >= 0 && rawVals[0] <= 8 ? 100 - rawVals[0] * 3 : Math.max(0, 100 - (rawVals[0] - 8) * 10);
        var rawScore50 = rawVals[1] >= 0 && rawVals[1] <= 15 ? 100 - Math.abs(rawVals[1] - 12) * 5 : Math.max(0, 100 - (rawVals[1] - 15) * 8);
        var rawScore75 = rawVals[2] >= 0 && rawVals[2] <= 12 ? 100 - Math.abs(rawVals[2] - 8) * 4 : Math.max(0, 100 - (rawVals[2] - 12) * 8);

        var keyPointScores = [];
        if (!isNaN(rawVals[0])) keyPointScores.push(rawScore5);
        if (!isNaN(rawVals[1])) keyPointScores.push(rawScore50);
        if (!isNaN(rawVals[2])) keyPointScores.push(rawScore75);

        var keyPointAvg = keyPointScores.reduce(function (a, b) { return a + b; }, 0) / keyPointScores.length;

        var finalScore = devScore * 0.35 + curveScore * 0.25 + keyPointAvg * 0.40;

        var dotIndex = 'R²=' + rSquared.toFixed(3) + ', avgΔ=' + avgDeviation.toFixed(2) + '%';
        $('#dotIndex').val(dotIndex);

        return Math.round(Math.max(0, Math.min(100, finalScore)));
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

        function findSampleFromRow(row) {
            if (!row) return null;
            var keys = Object.keys(row);
            var barcode = '';
            var batchNo = '';
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var kl = k.toLowerCase();
                if (!barcode && (kl === 'barcode' || kl === '条码' || kl === 'sampleid' || kl === 'sample_id' || kl === 'pycode')) {
                    barcode = (row[k] || '').toString().trim();
                }
                if (!batchNo && (kl === 'batchno' || kl === 'batch_no' || kl === 'batch' || kl === '批次号' || kl === 'lot')) {
                    batchNo = (row[k] || '').toString().trim();
                }
            }
            if (barcode) {
                var s = dataStore.getSampleByBarcode(barcode);
                if (s) return { sample: s, matchedBy: 'barcode', matchKey: barcode };
            }
            if (batchNo) {
                var list = dataStore.getSamplesByBatch(batchNo);
                if (list && list.length > 0) return { sample: list[0], matchedBy: 'batchNo', matchKey: batchNo };
            }
            return null;
        }

        function parseRowToDetectData(row) {
            if (!row) return null;
            var dd = { color: {}, register: {}, dot: {}, density: { points: [] }, surface: { defects: {} } };
            var anyData = false;
            var keys = Object.keys(row);

            function getVal(names) {
                for (var i = 0; i < names.length; i++) {
                    for (var j = 0; j < keys.length; j++) {
                        if (keys[j].toLowerCase() === names[i].toLowerCase() && row[keys[j]] !== '' && row[keys[j]] !== undefined) {
                            return row[keys[j]];
                        }
                    }
                }
                return undefined;
            }

            var v;
            v = getVal(['DeltaE', 'delta_e', 'DE', '色差', 'ΔE']);
            if (v !== undefined && v !== '') { dd.color.deltaE = v; anyData = true; }
            v = getVal(['L', 'Lstar', 'L*']); if (v !== undefined && v !== '') { dd.color.labL = v; anyData = true; }
            v = getVal(['A', 'Astar', 'A*']); if (v !== undefined && v !== '') { dd.color.labA = v; anyData = true; }
            v = getVal(['B', 'Bstar', 'B*']); if (v !== undefined && v !== '') { dd.color.labB = v; anyData = true; }

            v = getVal(['c_m', 'CM', 'CM误差', 'C-M']); if (v !== undefined && v !== '') { dd.register.c_m = v; anyData = true; }
            v = getVal(['c_y', 'CY', 'CY误差', 'C-Y']); if (v !== undefined && v !== '') { dd.register.c_y = v; anyData = true; }
            v = getVal(['c_k', 'CK', 'CK误差', 'C-K']); if (v !== undefined && v !== '') { dd.register.c_k = v; anyData = true; }
            v = getVal(['m_y', 'MY', 'MY误差', 'M-Y']); if (v !== undefined && v !== '') { dd.register.m_y = v; anyData = true; }

            v = getVal(['D5', 'e5', 'E5', 'expand5', '网点扩大5']); if (v !== undefined && v !== '') { dd.dot.expandRate5 = v; anyData = true; }
            v = getVal(['D50', 'e50', 'E50', 'expand50', '网点扩大50']); if (v !== undefined && v !== '') { dd.dot.expandRate50 = v; anyData = true; }
            v = getVal(['D75', 'e75', 'E75', 'expand75', '网点扩大75']); if (v !== undefined && v !== '') { dd.dot.expandRate75 = v; anyData = true; }

            for (var pi = 1; pi <= 12; pi++) {
                v = getVal(['P' + pi, '密度' + pi, 'Density' + pi, '测点' + pi]);
                if (v !== undefined && v !== '') { dd.density.points[pi - 1] = v; anyData = true; }
            }

            v = getVal(['DefectCount', 'defect_count', '瑕疵数', '瑕疵数量']);
            if (v !== undefined && v !== '') {
                dd.surface.defectCount = +v || 0;
                anyData = true;
            }
            v = getVal(['Inspector', 'inspector', '检测员', '质检员']);
            if (v !== undefined && v !== '') dd.inspector = v;

            dd.color.remark = dd.color.remark || '';
            dd.register.remark = dd.register.remark || '';
            dd.dot.remark = dd.dot.remark || '';
            dd.density.remark = dd.density.remark || '';
            dd.surface.remark = dd.surface.remark || '';
            dd.detectDate = new Date().toISOString().split('T')[0];

            return anyData ? dd : null;
        }

        function applyDetectDataToSample(sample, dd, extraRow) {
            if (!sample || !dd) return false;
            var fakeEvent = { target: { value: '' } };

            if (dd.color.deltaE) fakeEvent.target.value = dd.color.deltaE;
            if (dd.color.deltaE) $('[data-field="deltaE"]').val(dd.color.deltaE);
            if (dd.color.labL) $('[data-field="labL"]').val(dd.color.labL);
            if (dd.color.labA) $('[data-field="labA"]').val(dd.color.labA);
            if (dd.color.labB) $('[data-field="labB"]').val(dd.color.labB);

            if (dd.register.c_m) $('[data-field="c_m"]').val(dd.register.c_m);
            if (dd.register.c_y) $('[data-field="c_y"]').val(dd.register.c_y);
            if (dd.register.c_k) $('[data-field="c_k"]').val(dd.register.c_k);
            if (dd.register.m_y) $('[data-field="m_y"]').val(dd.register.m_y);

            if (dd.dot.expandRate5) $('[data-field="expandRate5"]').val(dd.dot.expandRate5);
            if (dd.dot.expandRate50) $('[data-field="expandRate50"]').val(dd.dot.expandRate50);
            if (dd.dot.expandRate75) $('[data-field="expandRate75"]').val(dd.dot.expandRate75);

            var dp = dd.density.points || [];
            for (var i = 0; i < dp.length; i++) {
                var $inp = $('.density-point[data-idx="' + i + '"]');
                if ($inp.length && dp[i]) $inp.val(dp[i]);
            }
            if (dd.inspector) $('#inspectorName').val(dd.inspector);
            updateAllScores();
            return true;
        }

        var lastCsvImportResults = [];

        $('#csvFile').on('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    var rows = dataStore.parseCSV(ev.target.result);
                    if (rows.length === 0) { ctx.showToast('CSV为空或格式错误'); return; }

                    var results = [];
                    var total = rows.length, matched = 0, missed = 0, failed = 0;
                    var firstSuccessBarcode = null;

                    rows.forEach(function (row, idx) {
                        var rowNum = idx + 1;
                        var findRes = findSampleFromRow(row);
                        var dd = parseRowToDetectData(row);
                        var displayKey = '';
                        var keys = Object.keys(row || {});
                        for (var ki = 0; ki < keys.length; ki++) {
                            var kl = keys[ki].toLowerCase();
                            if (kl === 'barcode' || kl === '条码' || kl === 'batchno' || kl === '批次号' || kl === 'batch') {
                                displayKey = (row[keys[ki]] || '').toString();
                                break;
                            }
                        }
                        if (!displayKey) displayKey = '第' + rowNum + '行';

                        if (!dd) {
                            failed++;
                            results.push({ row: rowNum, key: displayKey, matched: '-', status: 'fail', note: '未检测到有效测量数据' });
                            return;
                        }
                        if (!findRes) {
                            missed++;
                            results.push({ row: rowNum, key: displayKey, matched: '-', status: 'miss', note: '未找到对应样本，可手动加载后填充' });
                            return;
                        }

                        matched++;
                        var sample = findRes.sample;
                        var tmpDetectData = $.extend(true, {}, sample.detectData || {});

                        if (dd.color) tmpDetectData.color = $.extend({}, tmpDetectData.color || {}, dd.color);
                        if (dd.register) tmpDetectData.register = $.extend({}, tmpDetectData.register || {}, dd.register);
                        if (dd.dot) tmpDetectData.dot = $.extend({}, tmpDetectData.dot || {}, dd.dot);
                        if (dd.density && dd.density.points && dd.density.points.length > 0) {
                            tmpDetectData.density = tmpDetectData.density || {};
                            var oldPts = tmpDetectData.density.points || [];
                            var newPts = dd.density.points.slice();
                            for (var pi = 0; pi < newPts.length; pi++) {
                                if (newPts[pi]) oldPts[pi] = newPts[pi];
                            }
                            tmpDetectData.density.points = oldPts;
                        }
                        if (dd.surface) tmpDetectData.surface = $.extend({}, tmpDetectData.surface || {}, dd.surface);
                        if (dd.inspector) tmpDetectData.inspector = dd.inspector;
                        if (dd.detectDate) tmpDetectData.detectDate = dd.detectDate;

                        var scores = {
                            color: calcColorScore(tmpDetectData.color.deltaE),
                            register: calcRegisterScore(tmpDetectData.register || {}),
                            dot: calcDotScore(tmpDetectData.dot || {}),
                            density: null,
                            surface: null
                        };
                        var denResult = calcDensityScore((tmpDetectData.density && tmpDetectData.density.points) || []);
                        if (denResult) { scores.density = denResult.score; tmpDetectData.density.dispersion = denResult.dispersion; }
                        scores.surface = calcSurfaceScore(tmpDetectData.surface?.defects || {});
                        if (scores.color !== null && scores.color !== undefined) tmpDetectData.color.score = scores.color;
                        if (scores.register !== null && scores.register !== undefined) tmpDetectData.register.score = scores.register;
                        if (scores.dot !== null && scores.dot !== undefined) tmpDetectData.dot.score = scores.dot;
                        if (scores.density !== null && scores.density !== undefined) tmpDetectData.density.score = scores.density;
                        if (scores.surface !== null && scores.surface !== undefined) tmpDetectData.surface.score = scores.surface;

                        var missing = 0;
                        Object.keys(scores).forEach(function (k) { if (scores[k] === null || scores[k] === undefined) missing++; });
                        var newStatus = missing > 0 ? '待检测' : '已检测待判定';
                        tmpDetectData.surface.defectCount = tmpDetectData.surface.defectCount ||
                            Object.values(tmpDetectData.surface.defects || {}).reduce(function (a, b) { return a + (+b || 0); }, 0);

                        dataStore.updateSample(sample.barcode, { detectData: tmpDetectData, status: newStatus });

                        if (!firstSuccessBarcode) firstSuccessBarcode = sample.barcode;
                        var matchType = findRes.matchedBy === 'barcode' ? '条码匹配' : '批次匹配';
                        results.push({
                            row: rowNum, key: displayKey,
                            matched: sample.barcode + '<br><small class="text-muted">' + sample.factory.substring(0, 8) + '</small>',
                            status: 'ok', note: matchType + '，状态更新为：' + newStatus
                        });
                    });

                    lastCsvImportResults = { results: results, firstBarcode: firstSuccessBarcode };

                    $('#csvTotalCount').text(total);
                    $('#csvMatchCount').text(matched);
                    $('#csvMissCount').text(missed);
                    $('#csvFailCount').text(failed);
                    $('#csvLoadFirstBtn').prop('disabled', !firstSuccessBarcode);

                    var $tbody = $('#csvResultTable tbody').empty();
                    results.forEach(function (r) {
                        var statusBadge = '';
                        if (r.status === 'ok') statusBadge = '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>成功</span>';
                        else if (r.status === 'miss') statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-question-circle me-1"></i>未匹配</span>';
                        else statusBadge = '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>失败</span>';
                        $tbody.append(
                            '<tr><td class="text-center fw-bold">' + r.row + '</td>' +
                            '<td class="small">' + r.key + '</td>' +
                            '<td class="small">' + r.matched + '</td>' +
                            '<td>' + statusBadge + '</td>' +
                            '<td class="small text-muted">' + r.note + '</td></tr>'
                        );
                    });

                    try {
                        var modal = new bootstrap.Modal(document.getElementById('csvImportModal'));
                        modal.show();
                    } catch (ex) {
                        $('#csvImportModal').modal('show');
                    }

                    ctx.showToast('CSV批量导入完成：成功' + matched + ' / 未匹配' + missed + ' / 失败' + failed);

                } catch (err) {
                    console.error(err);
                    ctx.showToast('CSV解析失败：' + err.message);
                }
            };
            reader.readAsText(file, 'UTF-8');
            e.target.value = '';
        });

        $(document).on('click', '#csvLoadFirstBtn', function () {
            if (!lastCsvImportResults || !lastCsvImportResults.firstBarcode) return;
            var bc = lastCsvImportResults.firstBarcode;
            $('#csvImportModal').modal('hide');
            $('#barcodeInput').val(bc);
            setTimeout(function () { $('#loadBtn').click(); }, 200);
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
