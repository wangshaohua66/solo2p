define(['jquery', 'bootstrap', 'dataStore', 'datatables-bs5'], function ($, bootstrap, dataStore) {
    'use strict';

    var container = null;
    var ctx = null;
    var dtInstance = null;
    var selectedForCompare = [];
    var compareChart = null;

    function render() {
        var factories = dataStore.getFactories();
        var productTypes = dataStore.getProductTypes();
        var processes = dataStore.getProcesses();
        var grades = dataStore.getGrades();
        var statuses = dataStore.getStatuses();

        var html = '' +
            '<div class="row mb-3">' +
            '<div class="col-12">' +
            '<h3 class="mb-3"><i class="bi bi-search text-primary me-2"></i>历史查询</h3>' +
            '</div></div>' +

            '<div class="card shadow-sm mb-4">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h5 class="mb-0"><i class="bi bi-funnel me-2"></i>复合检索条件</h5>' +
            '<div class="d-flex gap-2">' +
            '<button class="btn btn-outline-secondary btn-sm" id="toggleFilter">' +
            '<i class="bi bi-chevron-down me-1"></i>展开/收起</button>' +
            '<button class="btn btn-primary btn-sm" id="doSearch">' +
            '<i class="bi bi-search me-1"></i>查询</button>' +
            '<button class="btn btn-outline-secondary btn-sm" id="resetSearch">' +
            '<i class="bi bi-arrow-repeat"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="card-body" id="filterPanel">' +
            '<div class="row g-3">' +
            '<div class="col-md-3"><label class="form-label small">样本条码</label>' +
            '<input type="text" class="form-control" id="fBarcode" placeholder="输入条码关键词"></div>' +
            '<div class="col-md-3"><label class="form-label small">批次号</label>' +
            '<input type="text" class="form-control" id="fBatch" placeholder="输入批次号关键词"></div>' +
            '<div class="col-md-3"><label class="form-label small">印刷厂</label>' +
            '<select class="form-select" id="fFactory"><option value="">全部</option>';
        factories.forEach(function (f) { html += '<option value="' + f + '">' + f + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-3"><label class="form-label small">印品类型</label>' +
            '<select class="form-select" id="fType"><option value="">全部</option>';
        productTypes.forEach(function (p) { html += '<option value="' + p + '">' + p + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-3"><label class="form-label small">工艺类型</label>' +
            '<select class="form-select" id="fProcess"><option value="">全部</option>';
        processes.forEach(function (p) { html += '<option value="' + p + '">' + p + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-2"><label class="form-label small">判定等级</label>' +
            '<select class="form-select" id="fGrade"><option value="">全部</option>';
        grades.forEach(function (g) { html += '<option value="' + g + '">' + g + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-2"><label class="form-label small">状态</label>' +
            '<select class="form-select" id="fStatus"><option value="">全部</option>';
        statuses.forEach(function (s) { html += '<option value="' + s + '">' + s + '</option>'; });
        html += '</select></div>' +
            '<div class="col-md-2"><label class="form-label small">开始日期</label>' +
            '<input type="date" class="form-control" id="fStart"></div>' +
            '<div class="col-md-3"><label class="form-label small">结束日期</label>' +
            '<input type="date" class="form-control" id="fEnd"></div>' +
            '</div></div></div>' +

            '<div class="card shadow-sm mb-4">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">' +
            '<div><h5 class="mb-0"><i class="bi bi-list-check me-2"></i>查询结果</h5>' +
            '<small class="text-muted ms-2" id="resultCount">共 0 条记录</small></div>' +
            '<div class="d-flex gap-2">' +
            '<button class="btn btn-sm btn-outline-primary" id="batchCompareBtn" disabled>' +
            '<i class="bi bi-arrow-left-right me-1"></i>样本对比（0选中）</button>' +
            '<button class="btn btn-sm btn-outline-info" id="batchReportBtn" disabled>' +
            '<i class="bi bi-file-earmark-pdf me-1"></i>批量生成报告</button>' +
            '</div></div>' +
            '<div class="card-body p-0">' +
            '<div class="table-responsive">' +
            '<table class="table table-hover align-middle mb-0" id="historyTable">' +
            '<thead class="table-light"><tr>' +
            '<th style="width:40px;"><input type="checkbox" id="checkAllRows"></th>' +
            '<th>条码</th><th>印刷厂</th><th>印品/工艺</th><th>批次号</th>' +
            '<th>送检日期</th><th>总分</th><th>等级</th><th>状态</th><th>操作</th>' +
            '</tr></thead><tbody></tbody>' +
            '</table></div></div></div>' +

            '<div class="modal fade" id="compareModal" tabindex="-1" style="z-index:2000;">' +
            '<div class="modal-dialog modal-xl"><div class="modal-content">' +
            '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-arrow-left-right me-2"></i>样本对比</h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body" id="compareModalBody"></div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>' +
            '</div></div></div></div>' +

            '<div class="modal fade" id="batchDetailModal" tabindex="-1" style="z-index:2000;">' +
            '<div class="modal-dialog modal-lg"><div class="modal-content">' +
            '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-boxes me-2"></i>同批次样本</h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body" id="batchDetailBody"></div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>' +
            '</div></div></div></div>' +

            '<div class="modal fade" id="sampleDetailModal" tabindex="-1" style="z-index:2000;">' +
            '<div class="modal-dialog modal-lg"><div class="modal-content">' +
            '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-info-circle me-2"></i>样本详情</h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body" id="sampleDetailBody"></div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>' +
            '<button type="button" class="btn btn-primary" id="toReportBtn">生成报告</button>' +
            '</div></div></div></div>';

        container.html(html);
    }

    function getFilter() {
        return {
            barcode: $('#fBarcode').val().trim(),
            batchNo: $('#fBatch').val().trim(),
            factory: $('#fFactory').val(),
            productType: $('#fType').val(),
            process: $('#fProcess').val(),
            grade: $('#fGrade').val(),
            status: $('#fStatus').val(),
            startDate: $('#fStart').val(),
            endDate: $('#fEnd').val()
        };
    }

    function gradeClass(g) {
        return g === '优等品' ? 'bg-success' :
            g === '一等品' ? 'bg-primary' :
                g === '合格品' ? 'bg-warning text-dark' :
                    g === '不合格品' ? 'bg-danger' : 'bg-secondary';
    }
    function statusClass(s) {
        return s === '待检测' ? 'bg-warning' :
            s === '已检测待判定' ? 'bg-info' :
                s === '已判定待报告' ? 'bg-primary' :
                    s === '报告已生成' ? 'bg-success' : 'bg-secondary';
    }

    function loadTable() {
        var filter = getFilter();
        var samples = dataStore.getSamplesByFilter(filter);

        if (dtInstance) { try { dtInstance.destroy(); } catch (e) { } }
        var $tbody = $('#historyTable tbody').empty();

        $('#resultCount').text('共 ' + samples.length + ' 条记录');

        if (samples.length === 0) {
            $tbody.append('<tr><td colspan="10" class="text-center text-muted py-5">' +
                '<i class="bi bi-inbox display-4 d-block mb-2"></i>未找到匹配的样本</td></tr>');
            initDataTable();
            return;
        }

        samples.forEach(function (s) {
            var totalScore = '--';
            var gradeBadge = '<span class="badge bg-secondary">未判定</span>';
            if (s.judgement) {
                totalScore = s.judgement.totalScore;
                gradeBadge = '<span class="badge ' + gradeClass(s.judgement.grade) + '">' + s.judgement.grade + '</span>';
            }

            $tbody.append(
                '<tr data-barcode="' + s.barcode + '" data-id="' + s.id + '">' +
                '<td onclick="event.stopPropagation();">' +
                '<input type="checkbox" class="row-check" value="' + s.barcode + '"></td>' +
                '<td class="fw-bold text-primary small">' + s.barcode + '</td>' +
                '<td class="small">' + s.factory + '</td>' +
                '<td><small class="text-muted">' + s.productType + ' / ' + s.process + '</small></td>' +
                '<td class="small">' + s.batchNo + '</td>' +
                '<td class="small">' + s.submitDate + '</td>' +
                '<td class="fw-bold">' + totalScore + '</td>' +
                '<td>' + gradeBadge + '</td>' +
                '<td><span class="badge ' + statusClass(s.status) + '">' + s.status + '</span></td>' +
                '<td>' +
                '<button class="btn btn-sm btn-outline-primary detail-btn me-1" title="查看详情">' +
                '<i class="bi bi-eye"></i></button>' +
                '<button class="btn btn-sm btn-outline-info batch-btn me-1" title="同批次">' +
                '<i class="bi bi-boxes"></i></button>' +
                '<button class="btn btn-sm btn-outline-warning report-btn" title="生成报告">' +
                '<i class="bi bi-file-earmark-pdf"></i></button>' +
                '</td></tr>'
            );
        });

        initDataTable();
        updateCompareButton();
    }

    function initDataTable() {
        if (!$.fn.DataTable) return;
        try {
            dtInstance = $('#historyTable').DataTable({
                pageLength: 15,
                language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/zh.json' },
                columnDefs: [
                    { orderable: false, targets: 0 },
                    { orderable: false, targets: 9 }
                ],
                order: [[5, 'desc']]
            });
        } catch (e) { console.warn('DataTables init:', e); }
    }

    function updateCompareButton() {
        var count = $('.row-check:checked').length;
        selectedForCompare = [];
        $('.row-check:checked').each(function () { selectedForCompare.push($(this).val()); });
        $('#batchCompareBtn')
            .prop('disabled', count !== 2)
            .html('<i class="bi bi-arrow-left-right me-1"></i>样本对比（' + count + '选中）');
        $('#batchReportBtn').prop('disabled', count === 0)
            .html('<i class="bi bi-file-earmark-pdf me-1"></i>批量生成报告（' + count + '）');
    }

    function showSampleDetail(barcode) {
        var s = dataStore.getSampleByBarcode(barcode);
        if (!s) return;

        var html = '<div class="row g-4">';
        html += '<div class="col-md-6">';
        html += '<h6 class="border-bottom pb-2 mb-3"><i class="bi bi-card-text me-1"></i>基本信息</h6>';
        html += '<table class="table table-sm small table-borderless">';
        var fields = [
            ['条码', s.barcode, 'text-primary fw-bold'],
            ['印刷厂', s.factory, ''],
            ['印品类型', s.productType, ''],
            ['工艺类型', s.process, ''],
            ['批次号', s.batchNo, ''],
            ['规格', s.spec || '-', ''],
            ['数量', (s.quantity || 0) + ' 份', ''],
            ['送检日期', s.submitDate, ''],
            ['送检人', s.submitter, ''],
            ['状态', '<span class="badge ' + statusClass(s.status) + '">' + s.status + '</span>', '']
        ];
        fields.forEach(function (f) {
            html += '<tr><th class="text-muted w-30" style="width:100px;">' + f[0] + '</th><td class="' + f[2] + '">' + f[1] + '</td></tr>';
        });
        html += '</table></div>';

        if (s.judgement) {
            html += '<div class="col-md-6">';
            html += '<h6 class="border-bottom pb-2 mb-3"><i class="bi bi-award me-1"></i>判定信息</h6>';
            html += '<div class="text-center mb-3">' +
                '<div class="fs-4 fw-bold mb-2">' + s.judgement.totalScore + ' 分</div>' +
                '<span class="badge ' + gradeClass(s.judgement.grade) + ' fs-5 px-4 py-2">' + s.judgement.grade + '</span>' +
                '</div>';
            html += '<table class="table table-sm small table-borderless">';
            var dimNames = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };
            Object.keys(dimNames).forEach(function (k) {
                var sc = s.judgement.scores[k];
                var scCls = sc >= 90 ? 'text-success' : sc >= 75 ? 'text-primary' : sc >= 60 ? 'text-warning' : 'text-danger';
                var alertIcon = s.judgement.dimAlerts[k] ? '<i class="bi bi-exclamation-triangle text-danger ms-1"></i>' : '';
                html += '<tr><th class="text-muted">' + dimNames[k] + alertIcon + '</th><td class="fw-bold ' + scCls + '">' + sc + ' 分</td></tr>';
            });
            html += '</table>';
            if (s.judgement.overridden) {
                html += '<div class="alert alert-warning small mt-2">' +
                    '<i class="bi bi-shield-check me-1"></i>' +
                    '原等级 ' + s.judgement.originalGrade + '，调整原因：' + s.judgement.overrideReason +
                    '</div>';
            }
            html += '</div>';
        }

        if (s.detectData) {
            html += '<div class="col-12">';
            html += '<h6 class="border-bottom pb-2 mb-3"><i class="bi bi-rulers me-1"></i>检测数据</h6>';
            html += '<div class="row g-3">';

            var dd = s.detectData;
            html += '<div class="col-md-4"><div class="border rounded p-3 bg-light">' +
                '<div class="fw-semibold mb-2">色彩准确度</div>' +
                '<div class="small text-muted">L*: ' + (dd.color.labL || '-') + ' / a*: ' + (dd.color.labA || '-') + ' / b*: ' + (dd.color.labB || '-') + '</div>' +
                '<div class="fw-bold text-primary">ΔE: ' + (dd.color.deltaE || '-') + ' / ' + (dd.color.score || '-') + '分</div>' +
                '</div></div>';
            html += '<div class="col-md-4"><div class="border rounded p-3 bg-light">' +
                '<div class="fw-semibold mb-2">套印精度 (mm)</div>' +
                '<div class="small text-muted">C-M:' + (dd.register.c_m || '-') + ' / C-Y:' + (dd.register.c_y || '-') + ' / C-K:' + (dd.register.c_k || '-') + '</div>' +
                '<div class="fw-bold text-primary">' + (dd.register.score || '-') + ' 分</div>' +
                '</div></div>';
            html += '<div class="col-md-4"><div class="border rounded p-3 bg-light">' +
                '<div class="fw-semibold mb-2">网点再现 (%)</div>' +
                '<div class="small text-muted">5%:' + (dd.dot.expandRate5 || '-') + ' / 50%:' + (dd.dot.expandRate50 || '-') + ' / 75%:' + (dd.dot.expandRate75 || '-') + '</div>' +
                '<div class="fw-bold text-primary">' + (dd.dot.score || '-') + ' 分</div>' +
                '</div></div>';
            html += '<div class="col-md-4"><div class="border rounded p-3 bg-light">' +
                '<div class="fw-semibold mb-2">密度均匀性</div>' +
                '<div class="small text-muted">离散度σ: ' + (dd.density.dispersion || '-') + '</div>' +
                '<div class="fw-bold text-primary">' + (dd.density.score || '-') + ' 分</div>' +
                '</div></div>';
            html += '<div class="col-md-4"><div class="border rounded p-3 bg-light">' +
                '<div class="fw-semibold mb-2">表面质量</div>' +
                '<div class="small text-muted">瑕疵数: ' + (dd.surface.defectCount || 0) + ' 处</div>' +
                '<div class="fw-bold text-primary">' + (dd.surface.score || '-') + ' 分</div>' +
                '</div></div>';
            html += '<div class="col-md-4"><div class="border rounded p-3 bg-light">' +
                '<div class="fw-semibold mb-2">检测信息</div>' +
                '<div class="small text-muted">检测员: ' + (dd.inspector || '-') + '</div>' +
                '<div class="small text-muted">日期: ' + (dd.detectDate || '-') + '</div>' +
                '</div></div>';
            html += '</div></div>';
        }

        html += '</div>';

        $('#sampleDetailBody').html(html);
        $('#toReportBtn').off('click').on('click', function () {
            var modalEl = document.getElementById('sampleDetailModal');
            var modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            ctx.navigate('reportGen', [s.barcode]);
        });
        var modalEl = document.getElementById('sampleDetailModal');
        var modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    function showBatchDetail(batchNo) {
        var list = dataStore.getSamplesByBatch(batchNo);
        var html = '<p class="small text-muted mb-3">批次号 <strong class="text-primary">' + batchNo + '</strong 共 ' + list.length + ' 份样本</p>';

        if (list.length === 0) {
            html += '<div class="text-center text-muted py-4">无同批次样本</div>';
        } else {
            html += '<div class="table-responsive"><table class="table table-sm table-hover">' +
                '<thead class="table-light"><tr><th>条码</th><th>印刷厂</th><th>类型</th>' +
                '<th>总分</th><th>等级</th><th>状态</th><th>操作</th></tr></thead><tbody>';
            list.forEach(function (s) {
                var sc = s.judgement ? s.judgement.totalScore : '--';
                var gr = s.judgement ? '<span class="badge ' + gradeClass(s.judgement.grade) + '">' + s.judgement.grade + '</span>' : '<span class="badge bg-secondary">未判定</span>';
                html += '<tr><td class="fw-bold small">' + s.barcode + '</td>' +
                    '<td class="small">' + s.factory + '</td>' +
                    '<td><small class="text-muted">' + s.productType + '</small></td>' +
                    '<td class="fw-bold">' + sc + '</td>' +
                    '<td>' + gr + '</td>' +
                    '<td><span class="badge ' + statusClass(s.status) + '">' + s.status + '</span></td>' +
                    '<td><button class="btn btn-sm btn-outline-primary view-detail-btn" data-barcode="' + s.barcode + '">详情</button></td>' +
                    '</tr>';
            });
            html += '</tbody></table></div>';
        }

        $('#batchDetailBody').html(html);
        $(document).off('click', '.view-detail-btn').on('click', '.view-detail-btn', function () {
            var bc = $(this).data('barcode');
            var modalEl = document.getElementById('batchDetailModal');
            var modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            setTimeout(function () { showSampleDetail(bc); }, 300);
        });
        var modalEl = document.getElementById('batchDetailModal');
        var modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    function showCompare() {
        if (selectedForCompare.length !== 2) return;
        var s1 = dataStore.getSampleByBarcode(selectedForCompare[0]);
        var s2 = dataStore.getSampleByBarcode(selectedForCompare[1]);
        if (!s1 || !s2) return;

        var html = '' +
            '<div class="row g-4">' +
            '<div class="col-md-5">' +
            '<div class="card border-primary">' +
            '<div class="card-header bg-primary text-white">' +
            '<h6 class="mb-0"><i class="bi bi-1-circle me-1"></i>样本 A</h6></div>' +
            '<div class="card-body p-2 small">' +
            '<div class="mb-1"><strong>条码：</strong><span class="text-primary">' + s1.barcode + '</span></div>' +
            '<div class="mb-1"><strong>厂家：</strong>' + s1.factory + '</div>' +
            '<div class="mb-1"><strong>类型：</strong>' + s1.productType + ' / ' + s1.process + '</div>' +
            '<div class="mb-1"><strong>批次：</strong>' + s1.batchNo + '</div>' +
            '<div><strong>等级：</strong>' +
            (s1.judgement ? '<span class="badge ' + gradeClass(s1.judgement.grade) + '">' + s1.judgement.grade + '</span>' : '未判定') +
            '</div>' +
            '</div></div></div>' +
            '<div class="col-md-2 d-flex align-items-center justify-content-center">' +
            '<div class="fs-3 fw-bold text-muted">VS</div></div>' +
            '<div class="col-md-5">' +
            '<div class="card border-warning">' +
            '<div class="card-header bg-warning text-dark">' +
            '<h6 class="mb-0"><i class="bi bi-2-circle me-1"></i>样本 B</h6></div>' +
            '<div class="card-body p-2 small">' +
            '<div class="mb-1"><strong>条码：</strong><span class="text-warning">' + s2.barcode + '</span></div>' +
            '<div class="mb-1"><strong>厂家：</strong>' + s2.factory + '</div>' +
            '<div class="mb-1"><strong>类型：</strong>' + s2.productType + ' / ' + s2.process + '</div>' +
            '<div class="mb-1"><strong>批次：</strong>' + s2.batchNo + '</div>' +
            '<div><strong>等级：</strong>' +
            (s2.judgement ? '<span class="badge ' + gradeClass(s2.judgement.grade) + '">' + s2.judgement.grade + '</span>' : '未判定') +
            '</div>' +
            '</div></div></div>' +
            '</div>' +

            '<div class="mt-4">' +
            '<canvas id="compareRadar" height="300"></canvas>' +
            '</div>' +

            '<div class="mt-4">' +
            '<table class="table table-sm table-hover">' +
            '<thead class="table-light"><tr><th>维度</th><th>样本A</th><th>样本B</th><th>差异</th></tr></thead>' +
            '<tbody>';

        var dims = ['color', 'register', 'dot', 'density', 'surface'];
        var dimNames = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };
        dims.forEach(function (d) {
            var v1 = s1.judgement ? s1.judgement.scores[d] : '-';
            var v2 = s2.judgement ? s2.judgement.scores[d] : '-';
            var diff = '-';
            var diffCls = '';
            if (typeof v1 === 'number' && typeof v2 === 'number') {
                diff = v1 - v2;
                diffCls = diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-muted';
                diff = (diff > 0 ? '+' : '') + diff.toFixed(1);
            }
            html += '<tr><td>' + dimNames[d] + '</td><td>' + v1 + '</td><td>' + v2 + '</td><td class="fw-bold ' + diffCls + '">' + diff + '</td></tr>';
        });
        if (s1.judgement && s2.judgement) {
            var t1 = s1.judgement.totalScore;
            var t2 = s2.judgement.totalScore;
            var td = t1 - t2;
            html += '<tr class="table-active fw-bold"><td>加权总分</td><td>' + t1 + '</td><td>' + t2 + '</td>' +
                '<td class="' + (td > 0 ? 'text-success' : td < 0 ? 'text-danger' : 'text-muted') + '">' +
                (td > 0 ? '+' : '') + td.toFixed(1) + '</td></tr>';
        }
        html += '</tbody></table></div>';

        $('#compareModalBody').html(html);
        var modal = new bootstrap.Modal(document.getElementById('compareModal'));
        modal.show();

        if (s1.judgement && s2.judgement) {
            setTimeout(function () {
                var el = document.getElementById('compareRadar');
                if (compareChart) { try { compareChart.destroy(); } catch (e) { } }
                if (el && typeof Chart !== 'undefined') {
                    compareChart = new Chart(el, {
                        type: 'radar',
                        data: {
                            labels: ['色彩', '套印', '网点', '密度', '表面'],
                            datasets: [
                                { label: s1.barcode, data: [s1.judgement.scores.color, s1.judgement.scores.register, s1.judgement.scores.dot, s1.judgement.scores.density, s1.judgement.scores.surface],
                                    borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.2)' },
                                { label: s2.barcode, data: [s2.judgement.scores.color, s2.judgement.scores.register, s2.judgement.scores.dot, s2.judgement.scores.density, s2.judgement.scores.surface],
                                    borderColor: '#fd7e14', backgroundColor: 'rgba(253,126,20,0.2)' }
                            ]
                        },
                        options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } } }
                    });
                }
            }, 300);
        }
    }

    function bindEvents() {
        $('#doSearch').on('click', loadTable);
        $('#resetSearch').on('click', function () {
            $('#fBarcode, #fBatch, #fFactory, #fType, #fProcess, #fGrade, #fStatus, #fStart, #fEnd').val('');
            loadTable();
        });

        $('#toggleFilter').on('click', function () {
            $('#filterPanel').slideToggle(200);
        });

        $('#checkAllRows').on('change', function () {
            var checked = $(this).prop('checked');
            $('.row-check').prop('checked', checked);
            updateCompareButton();
        });

        $(document).on('change', '.row-check', function () { updateCompareButton(); });

        $(document).on('click', '.detail-btn', function (e) {
            e.stopPropagation();
            showSampleDetail($(this).closest('tr').attr('data-barcode'));
        });
        $(document).on('click', '.batch-btn', function (e) {
            e.stopPropagation();
            var s = dataStore.getSampleByBarcode($(this).closest('tr').attr('data-barcode'));
            if (s) showBatchDetail(s.batchNo);
        });
        $(document).on('click', '.report-btn', function (e) {
            e.stopPropagation();
            var bc = $(this).closest('tr').attr('data-barcode');
            ctx.navigate('reportGen', [bc]);
        });

        $('#batchCompareBtn').on('click', showCompare);

        $('#batchReportBtn').on('click', function () {
            if (selectedForCompare.length === 0) return;
            ctx.navigate('reportGen', selectedForCompare.join(','));
        });

        $(document).on('click', '#historyTable tbody tr', function () {
            var bc = $(this).attr('data-barcode');
            if (bc) showSampleDetail(bc);
        });

        $(document).on('click', '#sideApplyFilter', function () {
            var factory = $('#sideFactoryFilter').val();
            var grade = $('#sideGradeFilter').val();
            var timeRange = $('#sideTimeFilter').val();
            if (factory) $('#fFactory').val(factory);
            if (grade) $('#fGrade').val(grade);
            if (timeRange && timeRange !== 'all') {
                var now = new Date();
                var days = +timeRange;
                var start = new Date(now.getTime() - days * 86400000);
                $('#fStart').val(start.toISOString().split('T')[0]);
                $('#fEnd').val(now.toISOString().split('T')[0]);
            }
            loadTable();
        });
    }

    function init(context) {
        ctx = context;
        container = $(context.container);
        render();
        bindEvents();
        loadTable();
    }

    function destroy() {
        if (dtInstance) { try { dtInstance.destroy(); } catch (e) { } }
        if (compareChart) { try { compareChart.destroy(); } catch (e) { } }
    }

    return { init: init, destroy: destroy };
});
