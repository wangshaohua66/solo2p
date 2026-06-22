define(['jquery', 'bootstrap', 'dataStore', 'jspdf', 'datatables-bs5'], function ($, bootstrap, dataStore) {
    'use strict';

    var container = null;
    var ctx = null;
    var dtInstance = null;
    var currentSample = null;
    var initialBarcodes = [];

    function render() {
        var factories = dataStore.getFactories();
        var productTypes = dataStore.getProductTypes();

        var html = '' +
            '<div class="row mb-3">' +
            '<div class="col-12">' +
            '<h3 class="mb-3"><i class="bi bi-file-earmark-pdf text-primary me-2"></i>报告生成</h3>' +
            '</div></div>' +

            '<div class="card shadow-sm mb-4">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">' +
            '<h5 class="mb-0"><i class="bi bi-list-check me-2"></i>待出报告样本</h5>' +
            '<div class="d-flex gap-2 align-items-center">' +
            '<select class="form-select form-select-sm" id="reportStatusFilter" style="width:160px;">' +
            '<option value="已判定待报告">待出报告</option>' +
            '<option value="报告已生成">已出报告</option>' +
            '<option value="全部">全部</option>' +
            '</select>' +
            '<button class="btn btn-primary btn-sm" id="batchPdfBtn" disabled>' +
            '<i class="bi bi-download me-1"></i>批量导出PDF</button>' +
            '</div></div>' +
            '<div class="card-body p-0">' +
            '<div class="table-responsive">' +
            '<table class="table table-hover align-middle mb-0" id="reportTable">' +
            '<thead class="table-light"><tr>' +
            '<th style="width:40px;"><input type="checkbox" id="checkAllReports"></th>' +
            '<th>报告编号</th><th>条码</th><th>印刷厂</th><th>印品类型</th>' +
            '<th>批次号</th><th>等级</th><th>状态</th><th>操作</th>' +
            '</tr></thead><tbody></tbody>' +
            '</table></div></div></div>' +

            '<div class="card shadow-sm" id="previewCard" style="display:none;">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<div><h5 class="mb-0"><i class="bi bi-eye me-2"></i>报告预览</h5>' +
            '<small class="text-muted ms-2" id="previewMeta"></small></div>' +
            '<div class="d-flex gap-2">' +
            '<button class="btn btn-outline-secondary btn-sm" id="printBtn">' +
            '<i class="bi bi-printer me-1"></i>打印</button>' +
            '<button class="btn btn-primary btn-sm" id="exportPdfBtn">' +
            '<i class="bi bi-download me-1"></i>导出PDF</button>' +
            '<button class="btn btn-outline-secondary btn-sm" id="closePreviewBtn">关闭</button>' +
            '</div></div>' +
            '<div class="card-body bg-light" id="reportPreviewWrap">' +
            '<div class="report-page mx-auto bg-white shadow" id="reportPage">' +
            '</div></div>' +
            '<div class="card-footer bg-white d-flex justify-content-end gap-2">' +
            '<button class="btn btn-outline-secondary" id="prevSampleBtn">' +
            '<i class="bi bi-chevron-left me-1"></i>上一个</button>' +
            '<button class="btn btn-outline-secondary" id="nextSampleBtn">' +
            '下一个<i class="bi bi-chevron-right ms-1"></i></button>' +
            '</div></div>';

        container.html(html);
    }

    function gradeClass(g) {
        return g === '优等品' ? 'bg-success' :
            g === '一等品' ? 'bg-primary' :
                g === '合格品' ? 'bg-warning text-dark' :
                    g === '不合格品' ? 'bg-danger' : 'bg-secondary';
    }

    function statusClass(s) {
        return s === '已判定待报告' ? 'bg-primary' :
            s === '报告已生成' ? 'bg-success' : 'bg-secondary';
    }

    function loadTable() {
        var status = $('#reportStatusFilter').val();
        var samples;
        if (status === '全部') {
            samples = dataStore.getAllSamples().filter(function (s) { return s.judgement; });
        } else {
            samples = dataStore.getSamplesByStatus(status).filter(function (s) { return s.judgement; });
        }

        if (dtInstance) { try { dtInstance.destroy(); } catch (e) { } }
        var $tbody = $('#reportTable tbody').empty();

        if (samples.length === 0) {
            $tbody.append('<tr><td colspan="9" class="text-center text-muted py-5">' +
                '<i class="bi bi-inbox display-4 d-block mb-2"></i>暂无数据</td></tr>');
            initDataTable();
            return;
        }

        samples.forEach(function (s) {
            var reportNo = s.reportNo || '<span class="text-muted">未生成</span>';
            $tbody.append(
                '<tr data-barcode="' + s.barcode + '">' +
                '<td onclick="event.stopPropagation();"><input type="checkbox" class="report-check" value="' + s.barcode + '"></td>' +
                '<td class="fw-bold small">' + reportNo + '</td>' +
                '<td class="small text-primary">' + s.barcode + '</td>' +
                '<td class="small">' + s.factory + '</td>' +
                '<td><small class="text-muted">' + s.productType + '</small></td>' +
                '<td class="small">' + s.batchNo + '</td>' +
                '<td><span class="badge ' + gradeClass(s.judgement.grade) + '">' + s.judgement.grade + '</span></td>' +
                '<td><span class="badge ' + statusClass(s.status) + '">' + s.status + '</span></td>' +
                '<td>' +
                '<button class="btn btn-sm btn-outline-primary preview-btn me-1" title="预览">' +
                '<i class="bi bi-eye"></i></button>' +
                '<button class="btn btn-sm btn-outline-success pdf-btn" title="导出PDF">' +
                '<i class="bi bi-download"></i></button>' +
                '</td></tr>'
            );
        });

        initDataTable();
        updateBatchBtn();
    }

    function initDataTable() {
        if (!$.fn.DataTable) return;
        try {
            dtInstance = $('#reportTable').DataTable({
                pageLength: 10,
                language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/zh.json' },
                columnDefs: [{ orderable: false, targets: 0 }, { orderable: false, targets: 8 }],
                order: [[3, 'desc']]
            });
        } catch (e) { }
    }

    function updateBatchBtn() {
        var count = $('.report-check:checked').length;
        $('#batchPdfBtn').prop('disabled', count === 0)
            .html('<i class="bi bi-download me-1"></i>批量导出PDF（' + count + '）');
    }

    function generateReportHtml(sample) {
        if (!sample || !sample.judgement) return '';
        var j = sample.judgement;
        var dd = sample.detectData;

        var gradeText = sample.judgement.grade;
        var gradeColor = gradeText === '优等品' ? '#198754' :
            gradeText === '一等品' ? '#0d6efd' :
                gradeText === '合格品' ? '#ffc107' : '#dc3545';

        var reportNo = sample.reportNo || '预编-' + sample.barcode;
        var reportDate = sample.reportDate || new Date().toISOString().split('T')[0];

        var dimNames = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };

        var html = '' +
            '<div class="report-inner p-4">' +
            '<div class="report-header text-center mb-4 border-bottom pb-3">' +
            '<h4 class="mb-1">印品质量检测报告</h4>' +
            '<h6 class="text-muted mb-2">Print Quality Inspection Report</h6>' +
            '<div class="d-flex justify-content-between small">' +
            '<span>报告编号：<strong>' + reportNo + '</strong></span>' +
            '<span>报告日期：' + reportDate + '</span>' +
            '</div>' +
            '</div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-primary border-4 ps-2 mb-2">一、样本基本信息</h6>' +
            '<table class="table table-bordered table-sm">' +
            '<tbody>' +
            '<tr><th class="table-light" style="width:25%;">样本条码</th><td style="width:25%;" class="text-primary fw-bold">' + sample.barcode + '</td>' +
            '<th class="table-light" style="width:25%;">批次号</th><td style="width:25%;">' + sample.batchNo + '</td></tr>' +
            '<tr><th class="table-light">送检单位</th><td colspan="3">' + sample.factory + '</td></tr>' +
            '<tr><th class="table-light">印品类型</th><td>' + sample.productType + '</td>' +
            '<th class="table-light">工艺类型</th><td>' + sample.process + '</td></tr>' +
            '<tr><th class="table-light">规格</th><td>' + (sample.spec || '-') + '</td>' +
            '<th class="table-light">批量</th><td>' + (sample.quantity || 0) + ' 份</td></tr>' +
            '<tr><th class="table-light">送检日期</th><td>' + sample.submitDate + '</td>' +
            '<th class="table-light">送检人</th><td>' + sample.submitter + '</td></tr>' +
            '</tbody></table>' +
            '</div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-primary border-4 ps-2 mb-2">二、检测结果汇总</h6>' +
            '<table class="table table-bordered table-sm text-center">' +
            '<thead class="table-light">' +
            '<tr><th>检测项目</th><th>技术要求</th><th>检测结果</th><th>单项得分</th><th>权重</th><th>加权得分</th></tr>' +
            '</thead><tbody>';

        var dimKeys = ['color', 'register', 'dot', 'density', 'surface'];
        dimKeys.forEach(function (k) {
            var sc = j.scores[k];
            var wt = j.weights[k];
            var weighted = +(sc * wt).toFixed(2);
            var scCls = sc >= 90 ? 'text-success' : sc >= 75 ? 'text-primary' : sc >= 60 ? 'text-warning' : 'text-danger';
            var reqs = { color: 'ΔE≤2 优', register: '误差≤0.05mm 优', dot: '扩大率≤10% 优', density: '离散度≤0.01 优', surface: '无明显瑕疵' };
            var results = {
                color: 'ΔE = ' + (dd?.color?.deltaE || '-'),
                register: '最大误差 ' + (Math.max.apply(null, [+dd?.register?.c_m, +dd?.register?.c_y, +dd?.register?.c_k, +dd?.register?.m_y].filter(function (v) { return !isNaN(v); })) || 0).toFixed(3) + 'mm',
                dot: '50%扩大 ' + (dd?.dot?.expandRate50 || '-') + '%',
                density: '离散度σ=' + (dd?.density?.dispersion || '-'),
                surface: (dd?.surface?.defectCount || 0) + ' 处瑕疵'
            };
            html += '<tr><td>' + dimNames[k] + '</td><td class="small text-muted">' + reqs[k] + '</td>' +
                '<td class="small">' + results[k] + '</td>' +
                '<td class="fw-bold ' + scCls + '">' + sc + '</td>' +
                '<td>' + (wt * 100).toFixed(0) + '%</td>' +
                '<td class="fw-bold">' + weighted + '</td></tr>';
        });

        html += '<tr class="table-active fw-bold"><td colspan="5" class="text-end">综合总分</td>' +
            '<td class="text-primary fs-5">' + j.totalScore + ' 分</td></tr>' +
            '</tbody></table>' +
            '</div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-primary border-4 ps-2 mb-2">三、判定结论</h6>' +
            '<div class="text-center p-4 border rounded" style="background-color:' + gradeColor + '15;">' +
            '<div class="mb-2"><span class="badge fs-5 px-4 py-2" style="background-color:' + gradeColor + ';">' + gradeText + '</span></div>' +
            '<div class="small text-muted">依据《' + (sample.productType || '印刷品') + '质量检验规范》判定</div>' +
            '</div></div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-primary border-4 ps-2 mb-2">四、检测明细数据</h6>' +
            '<div class="row g-2 small">' +
            '<div class="col-md-6"><div class="p-2 bg-light rounded">' +
            '<strong>色彩准确度：</strong>L*=' + (dd?.color?.labL || '-') +
            ', a*=' + (dd?.color?.labA || '-') +
            ', b*=' + (dd?.color?.labB || '-') +
            ', ΔE=' + (dd?.color?.deltaE || '-') +
            '</div></div>' +
            '<div class="col-md-6"><div class="p-2 bg-light rounded">' +
            '<strong>套印精度：</strong>C-M:' + (dd?.register?.c_m || '-') +
            ', C-Y:' + (dd?.register?.c_y || '-') +
            ', C-K:' + (dd?.register?.c_k || '-') +
            ', M-Y:' + (dd?.register?.m_y || '-') + ' mm' +
            '</div></div>' +
            '<div class="col-md-6"><div class="p-2 bg-light rounded">' +
            '<strong>网点再现：</strong>5%:' + (dd?.dot?.expandRate5 || '-') +
            '%, 50%:' + (dd?.dot?.expandRate50 || '-') +
            '%, 75%:' + (dd?.dot?.expandRate75 || '-') + '%' +
            '</div></div>' +
            '<div class="col-md-6"><div class="p-2 bg-light rounded">' +
            '<strong>密度均匀性：</strong>测点' + ((dd?.density?.points?.length) || 0) +
            '个，离散度σ=' + (dd?.density?.dispersion || '-') +
            '</div></div>' +
            '</div></div>' +

            '<div class="mt-5 pt-4">' +
            '<div class="row text-center small">' +
            '<div class="col-4">' +
            '<div class="border-bottom border-dark mb-2" style="width:140px;margin:0 auto;height:50px;"></div>' +
            '<div>检测员：</div>' +
            '<div class="text-muted">' + (dd?.inspector || '') + '</div>' +
            '</div>' +
            '<div class="col-4">' +
            '<div class="border-bottom border-dark mb-2" style="width:140px;margin:0 auto;height:50px;"></div>' +
            '<div>复核员：</div>' +
            '<div class="text-muted">' + (j?.judge || '') + '</div>' +
            '</div>' +
            '<div class="col-4">' +
            '<div class="border-bottom border-dark mb-2" style="width:140px;margin:0 auto;height:50px;">' +
            '<div class="text-muted pt-3">（公章）</div></div>' +
            '<div>检测单位：</div>' +
            '<div class="text-muted">印刷质量控制中心</div>' +
            '</div></div></div>' +

            '<div class="mt-3 text-center text-muted small">' +
            '本报告加盖检测专用章有效，复制未重新盖章无效' +
            '</div>' +
            '</div>';

        return html;
    }

    function previewReport(barcode) {
        var s = dataStore.getSampleByBarcode(barcode);
        if (!s || !s.judgement) { ctx.showToast('样本不存在或未判定'); return; }
        currentSample = s;

        $('#previewCard').show();
        $('#reportPage').html(generateReportHtml(s));

        var meta = s.barcode + ' / ' + s.factory + ' / ' + s.batchNo;
        $('#previewMeta').text(meta);

        $('html, body').animate({ scrollTop: $('#previewCard').offset().top - 70 }, 300);
    }

    function exportPdf(sample) {
        if (!sample) { ctx.showToast('请选择样本'); return; }
        if (!window.jspdf && !window.jsPDF) { ctx.showToast('PDF组件未加载'); return; }

        var jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        var doc = new jsPDF('p', 'mm', 'a4');

        var reportNo = sample.reportNo || '预编-' + sample.barcode;
        var gradeText = sample.judgement.grade;
        var j = sample.judgement;
        var dd = sample.detectData;

        var pageW = 210;
        var margin = 15;
        var y = 20;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Print Quality Inspection Report', pageW / 2, y, { align: 'center' });
        y += 8;
        doc.setFontSize(14);
        doc.text('印品质量检测报告', pageW / 2, y, { align: 'center' });
        y += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Report No: ' + reportNo, margin, y);
        doc.text('Date: ' + (sample.reportDate || new Date().toISOString().split('T')[0]), pageW - margin - 50, y, { align: 'right' });
        y += 6;

        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('1. Sample Info 基本信息', margin, y);
        y += 7;

        doc.setFontSize(10);
        var infoItems = [
            ['Barcode 条码', sample.barcode, 'Batch 批次', sample.batchNo],
            ['Factory 厂家', sample.factory.substring(0, 20), 'Type 类型', sample.productType],
            ['Process 工艺', sample.process, 'Qty 数量', (sample.quantity || 0) + ' pcs'],
            ['Submit Date 送检日期', sample.submitDate, 'Submitter 送检人', sample.submitter]
        ];

        infoItems.forEach(function (row) {
            doc.setFont('helvetica', 'bold');
            doc.text(row[0], margin + 2, y);
            doc.setFont('helvetica', 'normal');
            doc.text(row[1], margin + 30, y);
            doc.setFont('helvetica', 'bold');
            doc.text(row[2], margin + 95, y);
            doc.setFont('helvetica', 'normal');
            doc.text(row[3], margin + 120, y);
            y += 7;
        });

        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('2. Test Results 检测结果', margin, y);
        y += 8;

        var headers = ['Item 项目', 'Result 结果', 'Score 得分', 'Weight 权重', 'Weighted 加权'];
        var colX = [margin, margin + 45, margin + 95, margin + 125, margin + 155];

        doc.setFillColor(230, 240, 255);
        doc.rect(margin, y - 5, pageW - 2 * margin, 7, 'F');
        headers.forEach(function (h, i) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(h, colX[i], y);
        });
        y += 4;

        var dims = [
            ['Color 色彩', 'ΔE=' + (dd?.color?.deltaE || '-'), j.scores.color, (j.weights.color * 100).toFixed(0) + '%', (j.scores.color * j.weights.color).toFixed(1)],
            ['Register 套印', 'max ' + (Math.max.apply(null, [+dd?.register?.c_m, +dd?.register?.c_y, +dd?.register?.c_k, +dd?.register?.m_y].filter(function (v) { return !isNaN(v); })) || 0).toFixed(3) + 'mm', j.scores.register, (j.weights.register * 100).toFixed(0) + '%', (j.scores.register * j.weights.register).toFixed(1)],
            ['Dot 网点', '50% ' + (dd?.dot?.expandRate50 || '-') + '%', j.scores.dot, (j.weights.dot * 100).toFixed(0) + '%', (j.scores.dot * j.weights.dot).toFixed(1)],
            ['Density 密度', 'σ=' + (dd?.density?.dispersion || '-'), j.scores.density, (j.weights.density * 100).toFixed(0) + '%', (j.scores.density * j.weights.density).toFixed(1)],
            ['Surface 表面', (dd?.surface?.defectCount || 0) + ' defects', j.scores.surface, (j.weights.surface * 100).toFixed(0) + '%', (j.scores.surface * j.weights.surface).toFixed(1)]
        ];

        doc.setFont('helvetica', 'normal');
        dims.forEach(function (row) {
            row.forEach(function (v, i) {
                doc.text(String(v), colX[i], y + 5);
            });
            y += 7;
        });

        y += 3;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(margin, y - 2, pageW - margin, y - 2);
        doc.setFont('helvetica', 'bold');
        doc.text('Total 综合总分', margin + 95, y + 4);
        doc.setFontSize(14);
        doc.setTextColor(13, 110, 253);
        doc.text(j.totalScore + ' pts', margin + 155, y + 4, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 10;

        y += 5;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('3. Conclusion 判定结论', margin, y);
        y += 8;

        var gradeColor = gradeText === '优等品' ? [25, 135, 84] :
            gradeText === '一等品' ? [13, 110, 253] :
                gradeText === '合格品' ? [255, 193, 7] : [220, 53, 69];

        doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
        doc.rect(pageW / 2 - 30, y - 4, 60, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text(gradeText, pageW / 2, y + 5, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        y += 18;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('Judged by print quality inspection standard.', pageW / 2, y, { align: 'center' });
        y += 15;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('4. Signatures 签章', margin, y);
        y += 10;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        var sigs = [
            ['Inspector\n检测员', dd?.inspector || ''],
            ['Reviewer\n复核员', j?.judge || ''],
            ['Official\n检测机构', 'Print Quality Center\n印刷质量控制中心']
        ];

        sigs.forEach(function (s, i) {
            var x = margin + i * 60;
            doc.rect(x, y, 50, 25);
            doc.setFontSize(8);
            doc.text(s[1] || '', x + 25, y + 15, { align: 'center' });
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.text(s[0], x + 25, y + 30, { align: 'center' });
            doc.setTextColor(0, 0, 0);
        });

        y += 40;
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('This report is valid with official seal. Unauthorized copying is prohibited.',
            pageW / 2, y, { align: 'center' });

        var fileName = '检测报告_' + (sample.reportNo || sample.barcode) + '.pdf';
        doc.save(fileName);

        if (!sample.reportNo) {
            var newNo = dataStore.generateReportNo();
            dataStore.updateSample(sample.barcode, {
                reportNo: newNo,
                reportDate: new Date().toISOString().split('T')[0],
                status: '报告已生成'
            });
            ctx.showToast('报告已生成：' + newNo);
            ctx.updateDataCount();
            loadTable();
        } else {
            ctx.showToast('PDF已导出');
        }
    }

    function batchExport() {
        var barcodes = [];
        $('.report-check:checked').each(function () { barcodes.push($(this).val()); });
        if (barcodes.length === 0) { ctx.showToast('请选择要导出的样本'); return; }

        if (!confirm('将导出 ' + barcodes.length + ' 份报告的PDF，是否继续？')) return;

        var success = 0;
        var fail = 0;

        function doExport(idx) {
            if (idx >= barcodes.length) {
                ctx.showToast('批量导出完成：成功' + success + '份，失败' + fail + '份');
                loadTable();
                return;
            }
            try {
                var s = dataStore.getSampleByBarcode(barcodes[idx]);
                if (s && s.judgement) {
                    exportPdf(s);
                    success++;
                } else {
                    fail++;
                }
            } catch (e) { fail++; }
            setTimeout(function () { doExport(idx + 1); }, 800);
        }
        doExport(0);
    }

    function bindEvents() {
        $('#reportStatusFilter').on('change', loadTable);

        $('#checkAllReports').on('change', function () {
            $('.report-check').prop('checked', $(this).prop('checked'));
            updateBatchBtn();
        });
        $(document).on('change', '.report-check', function () { updateBatchBtn(); });

        $(document).on('click', '.preview-btn', function (e) {
            e.stopPropagation();
            previewReport($(this).closest('tr').attr('data-barcode'));
        });

        $(document).on('click', '.pdf-btn', function (e) {
            e.stopPropagation();
            var bc = $(this).closest('tr').attr('data-barcode');
            var s = dataStore.getSampleByBarcode(bc);
            exportPdf(s);
        });

        $(document).on('click', '#reportTable tbody tr', function () {
            previewReport($(this).attr('data-barcode'));
        });

        $('#closePreviewBtn').on('click', function () {
            $('#previewCard').hide();
            currentSample = null;
        });

        $('#printBtn').on('click', function () {
            window.print();
        });

        $('#exportPdfBtn').on('click', function () {
            if (currentSample) exportPdf(currentSample);
        });

        $('#batchPdfBtn').on('click', batchExport);

        $('#prevSampleBtn').on('click', function () {
            if (!currentSample) return;
            var rows = $('#reportTable tbody tr');
            var idx = -1;
            rows.each(function (i) { if ($(this).attr('data-barcode') === currentSample.barcode) idx = i; });
            if (idx > 0) previewReport($(rows[idx - 1]).attr('data-barcode'));
        });

        $('#nextSampleBtn').on('click', function () {
            if (!currentSample) return;
            var rows = $('#reportTable tbody tr');
            var idx = -1;
            rows.each(function (i) { if ($(this).attr('data-barcode') === currentSample.barcode) idx = i; });
            if (idx >= 0 && idx < rows.length - 1) previewReport($(rows[idx + 1]).attr('data-barcode'));
        });

        $(document).on('click', '#sideApplyFilter', function () {
            var factory = $('#sideFactoryFilter').val();
            var grade = $('#sideGradeFilter').val();
            if (grade) { /* grade filter could be added */ }
            loadTable();
        });
    }

    function init(context) {
        ctx = context;
        container = $(context.container);
        if (context.params && context.params.length > 0) {
            initialBarcodes = context.params.join(',').split(',').filter(Boolean);
        }
        render();
        bindEvents();
        loadTable();

        if (initialBarcodes.length > 0) {
            setTimeout(function () {
                previewReport(initialBarcodes[0]);
                if (initialBarcodes.length > 1) {
                    ctx.showToast('共加载 ' + initialBarcodes.length + ' 份报告，使用上下按钮切换');
                }
            }, 500);
        }
    }

    function destroy() {
        if (dtInstance) { try { dtInstance.destroy(); } catch (e) { } }
    }

    return { init: init, destroy: destroy };
});
