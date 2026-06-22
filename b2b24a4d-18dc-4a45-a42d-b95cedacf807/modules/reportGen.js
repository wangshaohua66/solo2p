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

    var STANDARDS = {
        GB30312: { code: 'GB/T 30312-2013', title: '平版印刷品质量要求及检验方法', items: ['印刷层次', '套印精度', '网点再现', '相对反差值', '中性灰', '色差', '密度均匀性', '外观质量'] },
        GB9851: { code: 'GB/T 9851.1-2019', title: '印刷技术术语 第1部分：基本术语' },
        GB7705: { code: 'GB/T 7705-2008', title: '平版装潢印刷品' },
        GB7706: { code: 'GB/T 7706-2008', title: '凸版装潢印刷品' },
        GB7707: { code: 'GB/T 7707-2008', title: '凹版装潢印刷品' },
        GB17497: { code: 'GB/T 17497.2-2012', title: '柔性版装潢印刷品 第2部分：纸张类' },
        CY3: { code: 'CY/T 3-1999', title: '色评价照明和观察条件' },
        CY5: { code: 'CY/T 5-1999', title: '平版印刷品质量要求及检验方法' }
    };

    function getStandardsByType(type) {
        var base = [STANDARDS.GB30312, STANDARDS.GB9851, STANDARDS.CY3];
        if (type === '包装印刷') base.push(STANDARDS.GB7705, STANDARDS.GB7707);
        else if (type === '标签印刷') base.push(STANDARDS.GB7705, STANDARDS.GB17497);
        else if (type === '票据印刷') base.push(STANDARDS.CY5);
        else if (type === '出版物印刷') base.push(STANDARDS.GB7705);
        return base;
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
        var detectDate = (dd?.detectDate || sample.submitDate || '-');

        var dimNames = { color: '色彩准确度', register: '套印精度', dot: '网点再现', density: '密度均匀性', surface: '表面质量' };
        var dimCodeNames = { color: 'Color', register: 'Register', dot: 'Dot Gain', density: 'Density', surface: 'Surface' };
        var standards = getStandardsByType(sample.productType);
        var standardClause = j.rule || 'default';
        var thresholdMap = {
            'default': STANDARDS.GB30312.code + ' 第5.3节',
            '出版物印刷': STANDARDS.GB30312.code + ' 第5.3.2节',
            '包装印刷': STANDARDS.GB7705.code + ' 第5.1节',
            '标签印刷': STANDARDS.GB17497.code + ' 第5.2节',
            '票据印刷': STANDARDS.CY5.code + ' 第4.2节'
        };

        var html = '' +
            '<div class="report-inner p-4">' +

            '<div class="report-header text-center mb-3 pb-3" style="border-bottom:3px double #333;">' +
            '<div class="d-flex justify-content-between align-items-start mb-2 small text-muted">' +
            '<div class="text-start">' +
            '<div><strong>CMA</strong> （2024）量认（国）字（XXXX）号</div>' +
            '<div>ILAC-MRA/CNAS CXXXXXX</div>' +
            '</div>' +
            '<div class="text-end">' +
            '<div>档案编号：DA-' + (reportNo.replace(/\D/g, '').substring(0, 8) || '00000001') + '</div>' +
            '<div>共 1 页 第 1 页</div>' +
            '</div></div>' +
            '<h3 class="mb-1 fw-bold" style="letter-spacing:3px;">印品质量检测报告</h3>' +
            '<h6 class="text-muted mb-2">PRINT QUALITY INSPECTION REPORT</h6>' +
            '<div class="d-flex justify-content-between small fw-semibold">' +
            '<span>报告编号 Report No.：<strong class="text-primary">' + reportNo + '</strong></span>' +
            '<span>报告日期 Issue Date：' + reportDate + '</span>' +
            '</div>' +
            '</div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-4 border-primary ps-2 mb-2 py-1" style="background:linear-gradient(90deg,#f0f7ff 0%,transparent 100%);">一、委托与检测信息</h6>' +
            '<table class="table table-bordered table-sm text-nowrap" style="font-size:12.5px;">' +
            '<colgroup><col style="width:14%"><col style="width:36%"><col style="width:14%"><col style="width:36%"></colgroup>' +
            '<tbody>' +
            '<tr><th class="table-light text-nowrap">委托单位</th><td colspan="3">' + sample.factory + '</td></tr>' +
            '<tr><th class="table-light">委托单位地址</th><td colspan="3">（见受检单位资质档案）</td></tr>' +
            '<tr><th class="table-light">样品名称</th><td>' + (sample.productType || '印刷品') + '</td>' +
            '<th class="table-light">样品条码</th><td class="text-primary fw-bold">' + sample.barcode + '</td></tr>' +
            '<tr><th class="table-light">规格型号</th><td>' + (sample.spec || '-') + '</td>' +
            '<th class="table-light">生产工艺</th><td>' + sample.process + '</td></tr>' +
            '<tr><th class="table-light">样品批号</th><td>' + sample.batchNo + '</td>' +
            '<th class="table-light">样品数量</th><td>' + (sample.quantity || 0) + ' 份（批量抽检）</td></tr>' +
            '<tr><th class="table-light">送检日期</th><td>' + sample.submitDate + '</td>' +
            '<th class="table-light">送检人</th><td>' + sample.submitter + '</td></tr>' +
            '<tr><th class="table-light">检测日期</th><td>' + detectDate + '</td>' +
            '<th class="table-light">检测环境</th><td>温度(23±1)℃ 湿度(50±5)%RH（符合' + STANDARDS.CY3.code + '）</td></tr>' +
            '<tr><th class="table-light">检测地点</th><td colspan="3">印刷质量控制中心实验室（第3检测室）</td></tr>' +
            '</tbody></table>' +
            '</div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-4 border-primary ps-2 mb-2 py-1" style="background:linear-gradient(90deg,#f0f7ff 0%,transparent 100%);">二、检测依据标准</h6>' +
            '<div class="card border-0 bg-light" style="border-radius:4px;">' +
            '<div class="card-body py-2 px-3 small">' +
            '<div class="mb-1 fw-semibold"><i class="bi bi-journal-text me-1 text-primary"></i>本次检测依据以下国家标准及行业规范：</div>';
        standards.forEach(function (st, i) {
            html += '<div class="d-flex lh-lg">' +
                '<span class="fw-bold text-primary me-2" style="min-width:20px;">' + (i + 1) + '.</span>' +
                '<span class="fw-semibold">' + st.code + '</span>，《' + st.title + '》' +
                (i === 0 ? ' <span class="text-danger">（主检标准）</span>' : '') +
                '</div>';
        });
        html += '<div class="mt-2 fw-semibold"><i class="bi bi-lightbulb me-1 text-warning"></i>' +
            '判定规则：依据 <strong>' + (thresholdMap[standardClause] || STANDARDS.GB30312.code + ' 第5.3节') + '</strong>' +
            ' 及中心《印品质量判定实施细则（V2.1）》执行</div>' +
            '</div></div></div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-4 border-primary ps-2 mb-2 py-1" style="background:linear-gradient(90deg,#f0f7ff 0%,transparent 100%);">三、检测设备与方法</h6>' +
            '<table class="table table-bordered table-sm small">' +
            '<thead class="table-light"><tr><th>序号</th><th>检测参数</th><th>检测设备/仪器</th><th>型号编号</th><th>检测方法标准</th></tr></thead>' +
            '<tbody>' +
            '<tr><td>1</td><td>色彩Lab值/色差ΔE</td><td>积分球式分光光度仪</td><td>X-Rite eXact（计量有效期内）</td><td>' + STANDARDS.GB30312.code + ' 附录A.2</td></tr>' +
            '<tr><td>2</td><td>各色组套印误差</td><td>CCD图像测量系统</td><td>QEA PD-300</td><td>' + STANDARDS.GB30312.code + ' 附录A.3</td></tr>' +
            '<tr><td>3</td><td>网点扩大率</td><td>密度计/印版测量仪</td><td>X-Rite 500系列</td><td>' + STANDARDS.GB30312.code + ' 附录A.4</td></tr>' +
            '<tr><td>4</td><td>密度均匀性</td><td>彩色透射密度计</td><td>X-Rite 341</td><td>' + STANDARDS.GB30312.code + ' 第5.4节</td></tr>' +
            '<tr><td>5</td><td>表面质量/瑕疵</td><td>标准光源目视+放大镜</td><td>D65对色光源箱</td><td>' + STANDARDS.GB30312.code + ' 第5.5节</td></tr>' +
            '</tbody></table>' +
            '</div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-4 border-primary ps-2 mb-2 py-1" style="background:linear-gradient(90deg,#f0f7ff 0%,transparent 100%);">四、检测结果与单项评分</h6>' +
            '<table class="table table-bordered table-sm text-center" style="font-size:12.5px;">' +
            '<thead class="table-light align-middle">' +
            '<tr><th rowspan="2">检测项目 Item</th><th colspan="2">标准技术要求（Limit）</th><th rowspan="2">实测结果 Result</th>' +
            '<th rowspan="2">单项得分 Score</th><th rowspan="2">权重 Wt.</th><th rowspan="2">加权得分 Weighted</th><th rowspan="2">单项判定 Eval.</th></tr>' +
            '<tr><th>优等品/一等品</th><th>合格品</th></tr></thead><tbody>';

        var dimKeys = ['color', 'register', 'dot', 'density', 'surface'];
        var reqMap = {
            color: { g: 'ΔE≤1.5 / ≤2.0', p: 'ΔE≤4.0', eval: function (sc) { return sc >= 80; } },
            register: { g: '≤0.03mm / ≤0.05mm', p: '≤0.10mm', eval: function (sc) { return sc >= 70; } },
            dot: { g: '50%扩大≤10% / ≤13%', p: '≤18%', eval: function (sc) { return sc >= 70; } },
            density: { g: 'CV≤0.010 / ≤0.015', p: 'CV≤0.030', eval: function (sc) { return sc >= 70; } },
            surface: { g: '无明显可见瑕疵', p: '瑕疵≤3处轻微', eval: function (sc) { return sc >= 60; } }
        };
        var resultsText = {
            color: 'ΔE<sub>ab</sub> = <strong>' + (dd?.color?.deltaE || '-') + '</strong>（L*=' + (dd?.color?.labL || '-') + ', a*=' + (dd?.color?.labA || '-') + ', b*=' + (dd?.color?.labB || '-') + '）',
            register: '最大误差 <strong>' + (Math.max.apply(null, [+dd?.register?.c_m, +dd?.register?.c_y, +dd?.register?.c_k, +dd?.register?.m_y].filter(function (v) { return !isNaN(v); })) || 0).toFixed(3) + '</strong>mm（C/M/Y/K四色）',
            dot: '50%处网点扩大 <strong>' + (dd?.dot?.expandRate50 || '-') + '</strong>%（5%→' + (dd?.dot?.expandRate5 || '-') + '%, 75%→' + (dd?.dot?.expandRate75 || '-') + '%）',
            density: 'σ=<strong>' + (dd?.density?.dispersion || '-') + '</strong>（' + ((dd?.density?.points?.length) || 0) + '个测点均值）',
            surface: '检出瑕疵 <strong>' + (dd?.surface?.defectCount || 0) + '</strong> 处' +
                (dd?.surface?.defects && Object.keys(dd.surface.defects).length ?
                    '（' + Object.entries(dd.surface.defects).map(function (e) { return e[0] + '×' + e[1]; }).join('，') + '）' : '')
        };

        dimKeys.forEach(function (k, idx) {
            var sc = j.scores[k];
            var wt = j.weights[k];
            var weighted = +(sc * wt).toFixed(2);
            var scCls = sc >= 90 ? 'text-success' : sc >= 75 ? 'text-primary' : sc >= 60 ? 'text-warning' : 'text-danger';
            var evalCls = reqMap[k].eval(sc) ? 'text-success' : 'text-danger';
            var evalTxt = reqMap[k].eval(sc) ? '合格 ✓' : '不合格 ✗';
            html += '<tr>' +
                '<td class="text-start"><strong>' + dimNames[k] + '</strong><br><small class="text-muted">(' + dimCodeNames[k] + ')</small></td>' +
                '<td class="small text-success"><strong>' + reqMap[k].g + '</strong></td>' +
                '<td class="small text-primary">' + reqMap[k].p + '</td>' +
                '<td class="small text-start">' + resultsText[k] + '</td>' +
                '<td class="fw-bold ' + scCls + ' fs-6">' + sc + '</td>' +
                '<td>' + (wt * 100).toFixed(0) + '%</td>' +
                '<td class="fw-bold">' + weighted + '</td>' +
                '<td class="fw-bold ' + evalCls + '">' + evalTxt + '</td>' +
                '</tr>';
        });

        html += '<tr class="table-active fw-bold align-middle" style="height:44px;">' +
            '<td colspan="5" class="text-end">综合总分 / Overall Score</td>' +
            '<td colspan="1">100%</td>' +
            '<td class="text-primary fs-5 fw-bold">' + j.totalScore + ' 分</td>' +
            '<td rowspan="2"><div class="px-2 py-1 rounded" style="background:' + gradeColor + ';color:#fff;font-weight:700;">' + gradeText + '</div></td>' +
            '</tr>' +
            '<tr class="table-light fw-bold"><td colspan="6" class="text-end">最终判定等级 / Final Grade</td>' +
            '<td class="fs-5" style="color:' + gradeColor + ';">' + gradeText + '</td></tr>' +
            '</tbody></table>' +
            '</div>' +

            '<div class="mb-3">' +
            '<h6 class="fw-bold border-start border-4 border-primary ps-2 mb-2 py-1" style="background:linear-gradient(90deg,#f0f7ff 0%,transparent 100%);">五、判定结论及说明</h6>' +
            '<div class="text-center p-4 rounded mb-2" style="background:linear-gradient(135deg,' + gradeColor + '12 0%,#fff 50%,' + gradeColor + '0a 100%);border:2px dashed ' + gradeColor + '55;">' +
            '<div class="mb-3">' +
            '<span class="badge fs-4 fw-bold px-5 py-3 shadow-sm" style="background-color:' + gradeColor + ';letter-spacing:2px;">' + gradeText + '</span>' +
            '</div>' +
            '<div class="lh-lg small">' +
            '<div class="mb-1">本批次送检样品经本中心依据 <strong>' + standards[0].code + '</strong>《' + standards[0].title + '》</div>' +
            '<div>及 <strong>' + (thresholdMap[standardClause] || STANDARDS.GB30312.code) + '</strong> 相关条款判定，综合得分为：<strong class="text-primary">' + j.totalScore + '</strong> 分</div>' +
            '<div>判定结论为：<strong style="color:' + gradeColor + ';">' + gradeText + '</strong>' +
            (j.overridden ? '（原等级：' + j.originalGrade + '，经复核组调整，理由：' + (j.overrideReason || '-') + '）' : '') +
            '</div></div>' +
            j.dimAlerts && Object.values(j.dimAlerts).some(function (v) { return v; }) ?
                '<div class="mt-2 alert alert-danger py-1 px-3 small d-inline-block text-start">' +
                '<i class="bi bi-exclamation-triangle me-1"></i>' +
                '警示：存在单项维度不合格，建议生产端及时整改后复检' +
                '</div>' : '' +
                (j.autoJudged ?
                    '<div class="mt-1 small text-muted"><i class="bi bi-lightning me-1 text-primary"></i>本报告由智能判定系统自动生成，已通过系统逻辑校验</div>' :
                    '<div class="mt-1 small text-muted"><i class="bi bi-person-check me-1 text-success"></i>本报告由人工判定，经判定员签字确认</div>') +
                '</div>' +
            '<div class="alert alert-light small py-2 mb-0 border-start border-4 border-info">' +
            '<div class="fw-semibold mb-1"><i class="bi bi-info-circle me-1 text-info"></i>重要声明：</div>' +
            '<div>1. 本报告仅对所检样品负责，检测结果仅反映样品在送检时的质量状态；</div>' +
            '<div>2. 未经本中心书面批准，不得部分复制本报告；完整复制需经重新加盖检测专用章；</div>' +
            '<div>3. 对检测结论有异议者，请于收到报告之日起15个工作日内向本中心提出复核申请。</div>' +
            '</div></div>' +

            '<div class="mt-5 pt-3">' +
            '<div class="row text-center small g-2 align-items-stretch">' +
            '<div class="col-4"><div class="h-100 border rounded p-2 bg-light">' +
            '<div class="border-bottom border-dashed mb-2" style="border-style:dashed;height:54px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;">' +
            '<span style="font-family:cursive;">' + (dd?.inspector || '（签字）') + '</span></div>' +
            '<div class="fw-semibold">检测员签字</div>' +
            '<div class="text-muted">Inspector</div>' +
            '<div class="text-muted mt-1">日期：' + detectDate + '</div>' +
            '</div></div>' +
            '<div class="col-4"><div class="h-100 border rounded p-2 bg-light">' +
            '<div class="border-bottom border-dashed mb-2" style="border-style:dashed;height:54px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;">' +
            '<span style="font-family:cursive;">' + (j?.judge || '（签字）') + '</span></div>' +
            '<div class="fw-semibold">复核/判定员签字</div>' +
            '<div class="text-muted">Reviewer / Judge</div>' +
            '<div class="text-muted mt-1">日期：' + (j?.judgeDate || reportDate) + '</div>' +
            '</div></div>' +
            '<div class="col-4"><div class="h-100 border rounded p-2 bg-light">' +
            '<div class="mb-2" style="height:54px;display:flex;align-items:center;justify-content:center;">' +
            '<div class="rounded-circle border-3 border-danger d-flex align-items-center justify-content-center fw-bold text-danger opacity-70" ' +
            'style="width:62px;height:62px;font-size:11px;line-height:1.1;">检测专用章<br>Sample Stamp</div></div>' +
            '<div class="fw-semibold">检测机构盖章</div>' +
            '<div class="text-muted">Official Seal</div>' +
            '<div class="text-muted mt-1">印刷质量控制中心</div>' +
            '</div></div></div></div>' +

            '<div class="mt-3 pt-3 text-center text-muted small border-top" style="border-top:1px solid #ddd;">' +
            '<div class="mb-1 fw-semibold text-dark">印刷质量控制中心 · 检测报告专用</div>' +
            '<div>地 址：检测中心大楼3层 &nbsp;|&nbsp; 邮 编：100000 &nbsp;|&nbsp; 电 话：010-XXXX-XXXX &nbsp;|&nbsp; 邮 箱：qc@print-center.example.cn</div>' +
            '<div>本报告共1页 · 无骑缝章无效 · 加盖"检测专用章"及骑缝章后方可生效</div>' +
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
        var reportNo = sample.reportNo || '预编-' + sample.barcode;
        var reportDate = sample.reportDate || new Date().toISOString().split('T')[0];
        var gradeText = sample.judgement.grade;
        var j = sample.judgement;
        var dd = sample.detectData;
        var detectDate = dd?.detectDate || sample.submitDate || '-';
        var standards = getStandardsByType(sample.productType);
        var thresholdMap = {
            'default': STANDARDS.GB30312.code + ' 5.3',
            '出版物印刷': STANDARDS.GB30312.code + ' 5.3.2',
            '包装印刷': STANDARDS.GB7705.code + ' 5.1',
            '标签印刷': STANDARDS.GB17497.code + ' 5.2',
            '票据印刷': STANDARDS.CY5.code + ' 4.2'
        };
        var jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        var doc = new jsPDF('p', 'mm', 'a4');
        var pageW = 210;
        var pageH = 297;
        var margin = 15;
        var y = 18;

        function drawCell(x, yy, w, h, text, opts) {
            opts = opts || {};
            if (opts.fill) { doc.setFillColor.apply(doc, opts.fill); doc.rect(x, yy, w, h, 'F'); }
            if (opts.border !== false) doc.rect(x, yy, w, h);
            doc.setFontSize(opts.fontSize || 8);
            doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
            doc.setTextColor.apply(doc, opts.color || [0, 0, 0]);
            var lines = doc.splitTextToSize(String(text || ''), Math.max(w - 3, 10));
            var ly = yy + (h / 2) - ((lines.length - 1) * 2);
            doc.text(lines, x + (opts.center ? w / 2 : 1.5), ly, { align: opts.center ? 'center' : 'left' });
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
        }

        function secTitle(num, zh, en) {
            doc.setFillColor(20, 110, 253);
            doc.rect(margin, y - 4.5, 2.2, 6, 'F');
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(40, 50, 80);
            doc.text(num + '. ' + zh + ' (' + en + ')', margin + 5, y);
            doc.setTextColor(0, 0, 0);
            y += 6;
        }

        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text('CMA  (2024)  No.XXXX', margin, y);
        doc.text('ILAC-MRA/CNAS  CXXXXXX', margin, y + 3.5);
        doc.text('File: DA-' + (reportNo.replace(/\D/g, '').substring(0, 8) || '00000001'), pageW - margin, y, { align: 'right' });
        doc.text('Page 1 / 1', pageW - margin, y + 3.5, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.text('Print Quality Inspection Report', pageW / 2, y, { align: 'center' });
        y += 6.5;
        doc.setFontSize(12.5);
        doc.setTextColor(40, 50, 80);
        doc.text('印 品 质 量 检 测 报 告', pageW / 2, y, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Report No.:  ' + reportNo, margin, y);
        doc.text('Issue Date:  ' + reportDate, pageW - margin, y, { align: 'right' });
        y += 5;
        doc.setLineWidth(0.7);
        doc.line(margin, y, pageW - margin, y);
        doc.setLineWidth(0.25);
        doc.line(margin, y + 1, pageW - margin, y + 1);
        doc.setLineWidth(0.2);
        y += 8;

        secTitle('1', '委托与检测信息', 'Client & Inspection Info');
        var cLW = 28, cVW = 62, tH = 5.8;
        var ig = [
            ['委托单位 Client', sample.factory.substring(0, 22), '样品条码', sample.barcode],
            ['样品名称', sample.productType || '印刷品', '样品批号', sample.batchNo],
            ['规格型号', sample.spec || '-', '生产工艺', sample.process],
            ['样品数量', (sample.quantity || 0) + ' 份 (抽样)', '送检日期', sample.submitDate],
            ['送检人', sample.submitter, '检测日期', detectDate],
            ['检测环境', 'T=23+-1C  RH=50+-5%', '检测地点', 'QC Center Lab#3']
        ];
        ig.forEach(function (r) {
            drawCell(margin, y, cLW, tH, r[0], { fill: [245, 247, 250], bold: true, fontSize: 7.5 });
            drawCell(margin + cLW, y, cVW, tH, r[1], { fontSize: 7.5 });
            drawCell(margin + cLW + cVW, y, cLW, tH, r[2], { fill: [245, 247, 250], bold: true, fontSize: 7.5 });
            drawCell(margin + cLW * 2 + cVW, y, cVW, tH, r[3], { fontSize: 7.5 });
            y += tH;
        });
        y += 5;

        secTitle('2', '检测依据标准', 'Standards Reference');
        doc.setFillColor(250, 252, 255);
        doc.rect(margin, y - 3, pageW - 2 * margin, standards.length * 4.8 + 9, 'F');
        doc.rect(margin, y - 3, pageW - 2 * margin, standards.length * 4.8 + 9);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Performing in accordance with following National / Industry Standards:', margin + 2, y);
        y += 4.8;
        standards.forEach(function (st, i) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(13, 110, 253);
            doc.text(String(i + 1) + '. ' + st.code, margin + 3, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(st.title + (i === 0 ? '  (Primary Standard)' : ''), margin + 3 + 27, y);
            y += 4.5;
        });
        y += 1;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(230, 140, 0);
        doc.text('Judgement Rule:  ', margin + 2, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(thresholdMap[j.rule || 'default'] + '  +  QC Center Criteria V2.1', margin + 2 + 23, y);
        y += 7;

        secTitle('3', '检测设备与方法', 'Equipment & Methods');
        var dev = [
            ['1', 'Color Lab/DeltaE', 'Spectrophotometer', 'X-Rite eXact', STANDARDS.GB30312.code + ' App.A.2'],
            ['2', 'Register Error', 'CCD Vision System', 'QEA PD-300', STANDARDS.GB30312.code + ' App.A.3'],
            ['3', 'Dot Gain %', 'Densitometer', 'X-Rite 500', STANDARDS.GB30312.code + ' App.A.4'],
            ['4', 'Density Uniform.', 'Transmission Dens.', 'X-Rite 341', STANDARDS.GB30312.code + ' 5.4'],
            ['5', 'Surface Defects', 'D65 Light Booth', 'Verivide CAC60', STANDARDS.GB30312.code + ' 5.5']
        ];
        var dCW = [8, 23, 34, 30, 74];
        var dCX = [margin];
        for (var zi = 0; zi < dCW.length; zi++) dCX.push(dCX[zi] + dCW[zi]);
        var dH = ['No', 'Parameter', 'Equipment', 'Model No.', 'Test Standard'];
        dH.forEach(function (h, i) { drawCell(dCX[i], y, dCW[i], 6, h, { fill: [235, 240, 250], bold: true, center: true, fontSize: 7.5 }); });
        y += 6;
        dev.forEach(function (r) {
            r.forEach(function (v, i) { drawCell(dCX[i], y, dCW[i], 5.5, v, { center: i === 0, fontSize: 7 }); });
            y += 5.5;
        });
        y += 7;

        secTitle('4', '检测结果与单项评分', 'Results & Score Summary');
        var mxReg = Math.max.apply(null, [+dd?.register?.c_m, +dd?.register?.c_y, +dd?.register?.c_k, +dd?.register?.m_y].filter(function (v) { return !isNaN(v); })) || 0;
        var dRows = [
            ['Color 色彩准确度', 'dE<=1.5 / <=2.0', 'dE<=4.0',
                'dE=' + (dd?.color?.deltaE || '-') + '  (L*=' + (dd?.color?.labL || '-') + ',a*=' + (dd?.color?.labA || '-') + ',b*=' + (dd?.color?.labB || '-') + ')',
                j.scores.color, (j.weights.color * 100) + '%', (j.scores.color * j.weights.color).toFixed(1), j.scores.color >= 80 ? 'Pass' : 'Fail', j.scores.color >= 80],
            ['Register 套印精度', '<=0.03 / <=0.05mm', '<=0.10mm',
                'Max ' + mxReg.toFixed(3) + 'mm  (C-M/C-Y/C-K/M-Y)',
                j.scores.register, (j.weights.register * 100) + '%', (j.scores.register * j.weights.register).toFixed(1), j.scores.register >= 70 ? 'Pass' : 'Fail', j.scores.register >= 70],
            ['Dot Gain 网点再现', '50%<=10 / <=13%', '<=18%',
                '50%=' + (dd?.dot?.expandRate50 || '-') + '%  (5%:' + (dd?.dot?.expandRate5 || '-') + ',75%:' + (dd?.dot?.expandRate75 || '-') + ')',
                j.scores.dot, (j.weights.dot * 100) + '%', (j.scores.dot * j.weights.dot).toFixed(1), j.scores.dot >= 70 ? 'Pass' : 'Fail', j.scores.dot >= 70],
            ['Density 密度均匀性', 's<=0.010 / <=0.015', '<=0.030',
                'sigma=' + (dd?.density?.dispersion || '-') + '  (' + ((dd?.density?.points?.length) || 0) + ' measured)',
                j.scores.density, (j.weights.density * 100) + '%', (j.scores.density * j.weights.density).toFixed(1), j.scores.density >= 70 ? 'Pass' : 'Fail', j.scores.density >= 70],
            ['Surface 表面质量', 'No visible defects', '<=3 minor',
                'Detected ' + (dd?.surface?.defectCount || 0) + ' defect point(s)',
                j.scores.surface, (j.weights.surface * 100) + '%', (j.scores.surface * j.weights.surface).toFixed(1), j.scores.surface >= 60 ? 'Pass' : 'Fail', j.scores.surface >= 60]
        ];
        var rCW = [28, 22, 20, 47, 13, 11, 13, 11];
        var rCX = [margin];
        for (var yi = 0; yi < rCW.length; yi++) rCX.push(rCX[yi] + rCW[yi]);
        var hdrs = ['Item', 'Limit (A/B)', 'Limit (C)', 'Measured Result', 'Score', 'Wt', 'Weighted', 'Eval'];
        hdrs.forEach(function (t, i) { drawCell(rCX[i], y, rCW[i], 6, t, { fill: [230, 235, 245], bold: true, center: true, fontSize: 7 }); });
        y += 6;
        dRows.forEach(function (r) {
            var sc = r[4];
            var sC = sc >= 90 ? [25, 135, 84] : sc >= 75 ? [13, 110, 253] : sc >= 60 ? [230, 150, 0] : [220, 53, 69];
            var eC = r[8] ? [25, 135, 84] : [220, 53, 69];
            drawCell(rCX[0], y, rCW[0], 6, r[0], { bold: true, fontSize: 7 });
            drawCell(rCX[1], y, rCW[1], 6, r[1], { color: [25, 135, 84], center: true, fontSize: 7 });
            drawCell(rCX[2], y, rCW[2], 6, r[2], { color: [13, 110, 253], center: true, fontSize: 7 });
            drawCell(rCX[3], y, rCW[3], 6, r[3], { fontSize: 6.8 });
            drawCell(rCX[4], y, rCW[4], 6, r[4], { bold: true, color: sC, center: true, fontSize: 8 });
            drawCell(rCX[5], y, rCW[5], 6, r[5], { center: true, fontSize: 7 });
            drawCell(rCX[6], y, rCW[6], 6, r[6], { bold: true, center: true, fontSize: 7.5 });
            drawCell(rCX[7], y, rCW[7], 6, r[7], { bold: true, color: eC, center: true, fontSize: 7.5 });
            y += 6;
        });
        var gRGB = gradeText === '优等品' ? [25, 135, 84] : gradeText === '一等品' ? [13, 110, 253] : gradeText === '合格品' ? [230, 150, 0] : [220, 53, 69];
        drawCell(rCX[0], y, rCW.slice(0, 4).reduce(function (a, b) { return a + b; }, 0), 8, 'OVERALL SCORE  综合总分', { bold: true, fill: [240, 240, 248], fontSize: 9 });
        drawCell(rCX[4], y, rCW[4] + rCW[5], 8, '100% Total', { center: true, bold: true, fill: [240, 240, 248], fontSize: 8 });
        drawCell(rCX[6], y, rCW[6], 8, j.totalScore, { bold: true, color: [13, 110, 253], center: true, fill: [240, 240, 248], fontSize: 13 });
        drawCell(rCX[7], y, rCW[7], 8, gradeText, { bold: true, color: [255, 255, 255], fill: gRGB, center: true, fontSize: 9 });
        y += 10;

        secTitle('5', '判定结论及说明', 'Conclusion & Declaration');
        var bH = 30, bY = y - 3;
        doc.setDrawColor(gRGB[0], gRGB[1], gRGB[2]);
        doc.setLineWidth(0.3);
        doc.setDashPattern([1.5, 1], 0);
        doc.rect(margin, bY, pageW - 2 * margin, bH);
        doc.setDashPattern([], 0);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.setFillColor(gRGB[0], gRGB[1], gRGB[2]);
        var gW = 46, gH = 11;
        doc.rect(pageW / 2 - gW / 2, bY + 4, gW, gH, 'F');
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(gradeText, pageW / 2, bY + 11, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7.8);
        doc.setFont('helvetica', 'normal');
        doc.text('Sample tested according to ' + standards[0].code + '  and  ' + (thresholdMap[j.rule || 'default']) + '.', pageW / 2, bY + 20, { align: 'center' });
        doc.text('Overall Score: ' + j.totalScore + ' / 100    Final Grade: ' + gradeText, pageW / 2, bY + 23.5, { align: 'center' });
        doc.text(j.overridden ? ('(Adjusted: ' + j.originalGrade + ' -> ' + gradeText + '; Reason: ' + (j.overrideReason || '-') + ')')
            : (j.autoJudged ? '(Auto-generated by Intelligent Judge System)' : '(Manual judgement by authorized inspector)'),
            pageW / 2, bY + 27, { align: 'center' });
        y = bY + bH + 3;

        if (j.dimAlerts && Object.values(j.dimAlerts).some(function (v) { return v; })) {
            doc.setFillColor(255, 235, 235);
            doc.rect(margin, y, pageW - 2 * margin, 6, 'F');
            doc.setFontSize(7.5);
            doc.setTextColor(220, 53, 69);
            doc.setFont('helvetica', 'bold');
            doc.text('WARNING: Some dimensions out of spec.  Recommend corrective action and re-inspection.', margin + 2, y + 3.5);
            doc.setTextColor(0, 0, 0);
            y += 8;
        }
        doc.setFillColor(250, 252, 255);
        doc.rect(margin, y, pageW - 2 * margin, 14);
        doc.setFillColor(23, 162, 184);
        doc.rect(margin, y, 1.2, 14, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('IMPORTANT NOTES / 重要声明:', margin + 3, y + 3);
        doc.setFont('helvetica', 'normal');
        doc.text('1) This report is only valid for the tested sample representing condition at inspection.', margin + 3, y + 6.5);
        doc.text('2) Partial reproduction prohibited; full copy requires re-stamping by this center.', margin + 3, y + 9.5);
        doc.text('3) Objections must be raised within 15 working days of report receipt date.', margin + 3, y + 12.5);
        y += 17;

        if (y + 45 > pageH - margin) { doc.addPage(); y = 25; }

        secTitle('6', '签章 / Signatures & Seal', 'Signatures & Seal');
        var sg = [
            ['Inspector 检测员', dd?.inspector || '（签字）', detectDate],
            ['Reviewer/Judge 复核/判定员', j?.judge || '（签字）', j?.judgeDate || reportDate],
            ['Official Seal 检测机构盖章', 'QC Center (专用章)', 'Seal Required']
        ];
        var sW = 55, sG = 6;
        sg.forEach(function (e, si) {
            var sx = margin + si * (sW + sG);
            doc.rect(sx, y, sW, 25);
            doc.setDrawColor(150, 150, 150);
            doc.setDashPattern([1, 1.2], 0);
            doc.line(sx + 4, y + 18, sx + sW - 4, y + 18);
            doc.setDashPattern([], 0);
            doc.setDrawColor(0, 0, 0);
            doc.setFont('cour');
            doc.setFontSize(8.5);
            doc.text(e[1], sx + sW / 2, y + 16, { align: 'center' });
            if (si === 2) {
                doc.setDrawColor(220, 53, 69);
                doc.setLineWidth(0.55);
                doc.circle(sx + sW / 2, y + 13, 10, 'S');
                doc.setLineWidth(0.2);
                doc.setDrawColor(0, 0, 0);
            }
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(90, 90, 90);
            doc.text(e[0], sx + sW / 2, y + 29, { align: 'center' });
            doc.text('Date: ' + e[2], sx + sW / 2, y + 32, { align: 'center' });
            doc.setTextColor(0, 0, 0);
        });
        y += 38;

        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Print Quality Control Center - Inspection Report  (印刷质量控制中心 - 检测报告专用)', pageW / 2, y, { align: 'center' });
        y += 3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 120, 120);
        doc.text('Addr: 3F QC Bldg, PC 100000  |  Tel: +86-10-XXXX-XXXX  |  Email: qc@print-center.example.cn', pageW / 2, y, { align: 'center' });
        y += 2.5;
        doc.text('Valid with center official seal (perforation seal required for multi-page reports).', pageW / 2, y, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

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
