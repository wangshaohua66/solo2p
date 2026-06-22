define(['jquery', 'bootstrap', 'dataStore'], function ($, bootstrap, dataStore) {
    'use strict';

    var container = null;
    var ctx = null;
    var recentTable = null;
    var currentBarcode = '';

    function render() {
        var factories = dataStore.getFactories();
        var productTypes = dataStore.getProductTypes();
        var processes = dataStore.getProcesses();

        var html = '' +
            '<div class="row mb-3">' +
            '<div class="col-12">' +
            '<h3 class="mb-3"><i class="bi bi-clipboard-plus text-primary me-2"></i>样本登记</h3>' +
            '</div>' +
            '</div>' +

            '<div class="row g-4">' +
            '<div class="col-lg-7">' +
            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-card-text me-2"></i>样本信息录入</h5>' +
            '</div>' +
            '<div class="card-body">' +
            '<form id="sampleForm" novalidate>' +

            '<div class="row mb-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label">印刷厂 <span class="text-danger">*</span></label>' +
            '<select class="form-select" id="factory" required>' +
            '<option value="">请选择印刷厂</option>';
        factories.forEach(function (f) {
            html += '<option value="' + f + '">' + f + '</option>';
        });
        html += '</select>' +
            '<div class="invalid-feedback">请选择印刷厂</div>' +
            '</div>' +

            '<div class="col-md-6">' +
            '<label class="form-label">印品类型 <span class="text-danger">*</span></label>' +
            '<select class="form-select" id="productType" required>' +
            '<option value="">请选择印品类型</option>';
        productTypes.forEach(function (p) {
            html += '<option value="' + p + '">' + p + '</option>';
        });
        html += '</select>' +
            '<div class="invalid-feedback">请选择印品类型</div>' +
            '</div>' +
            '</div>' +

            '<div class="row mb-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label">工艺类型 <span class="text-danger">*</span></label>' +
            '<select class="form-select" id="process" required>' +
            '<option value="">请选择工艺类型</option>';
        processes.forEach(function (p) {
            html += '<option value="' + p + '">' + p + '</option>';
        });
        html += '</select>' +
            '<div class="invalid-feedback">请选择工艺类型</div>' +
            '</div>' +

            '<div class="col-md-6">' +
            '<label class="form-label">规格描述</label>' +
            '<input type="text" class="form-control" id="spec" placeholder="例：4色印刷、250g铜版纸">' +
            '</div>' +
            '</div>' +

            '<div class="row mb-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label">批次号 <span class="text-danger">*</span>' +
            '<small class="text-muted ms-1">(格式：3字母+6位日期+3位序号)</small>' +
            '</label>' +
            '<input type="text" class="form-control" id="batchNo" maxlength="12" required ' +
            'pattern="^[A-Z]{3}\\d{9}$" placeholder="例：XYZ240601001">' +
            '<div class="invalid-feedback">批次号格式应为3个大写字母加9位数字</div>' +
            '</div>' +

            '<div class="col-md-6">' +
            '<label class="form-label">批量数量</label>' +
            '<div class="input-group">' +
            '<input type="number" class="form-control" id="quantity" min="0" placeholder="请输入数量">' +
            '<span class="input-group-text">份</span>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="row mb-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label">送检日期 <span class="text-danger">*</span></label>' +
            '<input type="date" class="form-control" id="submitDate" required>' +
            '<div class="invalid-feedback">请选择送检日期</div>' +
            '</div>' +

            '<div class="col-md-6">' +
            '<label class="form-label">送检人 <span class="text-danger">*</span></label>' +
            '<input type="text" class="form-control" id="submitter" required placeholder="请输入送检人姓名">' +
            '<div class="invalid-feedback">请输入送检人</div>' +
            '</div>' +
            '</div>' +

            '<hr class="my-4">' +

            '<div class="row align-items-center mb-4">' +
            '<div class="col-md-8">' +
            '<label class="form-label">样本条码（自动生成）</label>' +
            '<div class="input-group">' +
            '<input type="text" class="form-control form-control-lg fw-bold text-primary ' +
            'bg-light" id="barcode" readonly placeholder="点击下方按钮生成">' +
            '<button type="button" class="btn btn-outline-primary" id="genBarcodeBtn" title="重新生成">' +
            '<i class="bi bi-arrow-repeat"></i></button>' +
            '</div>' +
            '<small class="text-muted mt-1 d-block"><i class="bi bi-barcode me-1"></i>' +
            '支持条码扫描枪直接扫描输入（将覆盖自动生成）</small>' +
            '</div>' +
            '<div class="col-md-4 text-center">' +
            '<div id="barcodeVisual" class="border rounded p-3 bg-white d-inline-block" style="min-width:160px;">' +
            '<div class="barcode-lines mb-1">' + generateBarcodeLines('PY0000000000000') + '</div>' +
            '<small class="text-muted" id="barcodeText">-- 未生成 --</small>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="d-flex gap-2 justify-content-end">' +
            '<button type="reset" class="btn btn-outline-secondary" id="resetBtn">' +
            '<i class="bi bi-arrow-counterclockwise me-1"></i>重置</button>' +
            '<button type="submit" class="btn btn-primary px-4">' +
            '<i class="bi bi-check2 me-1"></i>提交登记</button>' +
            '</div>' +

            '</form>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="col-lg-5">' +
            '<div class="card shadow-sm mb-4">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-card-list me-2"></i>最近登记</h5>' +
            '</div>' +
            '<div class="card-body p-0">' +
            '<div class="table-responsive">' +
            '<table class="table table-hover mb-0" id="recentTable">' +
            '<thead class="table-light">' +
            '<tr><th>条码</th><th>印刷厂</th><th>类型</th><th>日期</th><th>状态</th></tr>' +
            '</thead>' +
            '<tbody></tbody>' +
            '</table>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white">' +
            '<h5 class="mb-0"><i class="bi bi-info-circle me-2"></i>快速统计</h5>' +
            '</div>' +
            '<div class="card-body">' +
            '<div class="row g-3 text-center">' +
            '<div class="col-6">' +
            '<div class="p-3 bg-primary bg-opacity-10 rounded">' +
            '<div class="fs-3 fw-bold text-primary" id="stat-total">0</div>' +
            '<div class="small text-muted">样本总数</div>' +
            '</div>' +
            '</div>' +
            '<div class="col-6">' +
            '<div class="p-3 bg-warning bg-opacity-10 rounded">' +
            '<div class="fs-3 fw-bold text-warning" id="stat-pending">0</div>' +
            '<div class="small text-muted">待检测</div>' +
            '</div>' +
            '</div>' +
            '<div class="col-6">' +
            '<div class="p-3 bg-info bg-opacity-10 rounded">' +
            '<div class="fs-3 fw-bold text-info" id="stat-today">0</div>' +
            '<div class="small text-muted">今日登记</div>' +
            '</div>' +
            '</div>' +
            '<div class="col-6">' +
            '<div class="p-3 bg-success bg-opacity-10 rounded">' +
            '<div class="fs-3 fw-bold text-success" id="stat-factory">0</div>' +
            '<div class="small text-muted">涉及厂家</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        container.html(html);
    }

    function generateBarcodeLines(code) {
        var html = '';
        for (var i = 0; i < code.length * 3; i++) {
            var w = (i % 3 === 0) ? 3 : 1;
            var h = (i % 5 === 0) ? 32 : 26;
            html += '<span style="display:inline-block;width:' + w + 'px;height:' + h +
                'px;background:#000;vertical-align:bottom;margin:0 0.5px;"></span>';
        }
        return html;
    }

    function refreshBarcode() {
        var code = 'PY' + new Date().getFullYear() +
            String(new Date().getMonth() + 1).padStart(2, '0') +
            String(new Date().getDate()).padStart(2, '0') +
            String(Math.floor(Math.random() * 100000)).padStart(5, '0');
        currentBarcode = code;
        $('#barcode').val(code);
        $('#barcodeText').text(code);
        $('.barcode-lines').html(generateBarcodeLines(code));
    }

    function loadRecent() {
        var all = dataStore.getAllSamples().slice(0, 10);
        var $tbody = $('#recentTable tbody').empty();
        if (all.length === 0) {
            $tbody.append('<tr><td colspan="5" class="text-center text-muted py-4">暂无数据</td></tr>');
            return;
        }
        all.forEach(function (s) {
            var badgeClass = 'bg-secondary';
            if (s.status === '待检测') badgeClass = 'bg-warning';
            else if (s.status === '已检测待判定') badgeClass = 'bg-info';
            else if (s.status === '已判定待报告') badgeClass = 'bg-primary';
            else if (s.status === '报告已生成') badgeClass = 'bg-success';

            $tbody.append(
                '<tr style="cursor:pointer;" data-link="detectInput/' + s.barcode + '">' +
                '<td class="fw-bold text-primary small">' + s.barcode + '</td>' +
                '<td class="small">' + s.factory.substring(0, 8) + (s.factory.length > 8 ? '..' : '') + '</td>' +
                '<td class="small">' + s.productType + '</td>' +
                '<td class="small">' + s.submitDate + '</td>' +
                '<td><span class="badge ' + badgeClass + '">' + s.status + '</span></td>' +
                '</tr>'
            );
        });
    }

    function updateStats() {
        var all = dataStore.getAllSamples();
        var today = new Date().toISOString().split('T')[0];
        var factories = new Set();
        var pending = 0;
        var todayCount = 0;

        all.forEach(function (s) {
            factories.add(s.factory);
            if (s.status === '待检测') pending++;
            if (s.submitDate === today) todayCount++;
        });

        $('#stat-total').text(all.length);
        $('#stat-pending').text(pending);
        $('#stat-today').text(todayCount);
        $('#stat-factory').text(factories.size);
    }

    function bindEvents() {
        $('#submitDate').val(new Date().toISOString().split('T')[0]);
        refreshBarcode();

        $('#genBarcodeBtn').on('click', refreshBarcode);

        $('#resetBtn').on('click', function () {
            setTimeout(function () {
                $('#submitDate').val(new Date().toISOString().split('T')[0]);
                refreshBarcode();
            }, 10);
        });

        var $barcodeInput = $('#barcode');
        var scanTimer = null;
        $barcodeInput.on('input', function () {
            clearTimeout(scanTimer);
            var val = $(this).val();
            scanTimer = setTimeout(function () {
                if (val.length >= 12) {
                    currentBarcode = val;
                    $('#barcodeText').text(val);
                    $('.barcode-lines').html(generateBarcodeLines(val));
                    if (dataStore.getSampleByBarcode(val)) {
                        ctx.showToast('警告：条码已存在: ' + val);
                    }
                }
            }, 300);
        });

        $('#sampleForm').on('submit', function (e) {
            e.preventDefault();
            var form = e.currentTarget;
            form.classList.remove('was-validated');

            var batchNo = $('#batchNo').val().trim();
            if (!dataStore.validateBatchNo(batchNo)) {
                form.classList.add('was-validated');
                $('#batchNo').addClass('is-invalid');
                ctx.showToast('批次号格式不正确');
                return;
            }
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                ctx.showToast('请填写所有必填项');
                return;
            }

            if (dataStore.getSampleByBarcode(currentBarcode)) {
                ctx.showToast('条码已存在，请重新生成');
                return;
            }

            try {
                var sample = dataStore.addSample({
                    factory: $('#factory').val(),
                    productType: $('#productType').val(),
                    process: $('#process').val(),
                    batchNo: batchNo,
                    submitDate: $('#submitDate').val(),
                    submitter: $('#submitter').val().trim(),
                    quantity: parseInt($('#quantity').val()) || 0,
                    spec: $('#spec').val().trim()
                });
                dataStore.updateSample(sample.barcode, { barcode: currentBarcode });

                ctx.showToast('样本登记成功！条码：' + currentBarcode);
                ctx.updateDataCount();
                loadRecent();
                updateStats();
                refreshBarcode();
                form.reset();
                $('#submitDate').val(new Date().toISOString().split('T')[0]);

                setTimeout(function () {
                    ctx.showModal(
                        '登记成功',
                        '<div class="text-center py-3">' +
                        '<div class="mb-3"><i class="bi bi-check-circle-fill text-success" style="font-size:3rem;"></i></div>' +
                        '<h5>样本信息已录入</h5>' +
                        '<p class="text-muted mb-3">条码：<strong class="text-primary">' + currentBarcode + '</strong></p>' +
                        '<p>印刷厂：' + sample.factory + '</p>' +
                        '<p>批次号：' + sample.batchNo + '</p>' +
                        '<p class="small text-muted">状态：<span class="badge bg-warning">待检测</span></p>' +
                        '</div>',
                        '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>' +
                        '<button type="button" class="btn btn-primary" id="goDetectBtn">前往检测录入</button>'
                    );
                    $('#goDetectBtn').on('click', function () {
                        bootstrap.Modal.getInstance(document.getElementById('globalModal')).hide();
                        ctx.navigate('detectInput', [currentBarcode]);
                    });
                }, 200);
            } catch (err) {
                ctx.showToast(err.message || '保存失败');
            }
        });
    }

    function init(context) {
        ctx = context;
        container = $(context.container);
        render();
        bindEvents();
        loadRecent();
        updateStats();
    }

    function destroy() {
        if (recentTable) {
            if ($.fn.DataTable) {
                var t = $('#recentTable').DataTable();
                if (t) t.destroy();
            }
        }
    }

    return { init: init, destroy: destroy };
});
