let currentCertificates = [];
let currentPage = 1;
let pageSize = 10;

$(function() {
    if (!checkLogin()) return;
    renderNavbar('certificate');
    loadCertificates();
    bindEvents();
    loadExams();
});

function loadCertificates() {
    showLoading();
    
    const params = {
        page: currentPage,
        pageSize: pageSize,
        keyword: $('#searchKeyword').val().trim(),
        exam_id: $('#examFilter').val(),
        status: $('#statusFilter').val()
    };

    ajax({
        url: API_BASE + '/certificates',
        type: 'GET',
        data: params,
        success: function(res) {
            if (res.code === 0) {
                currentCertificates = res.data.items || [];
                renderCertificateList(currentCertificates);
                renderPagination(res.data.total || 0);
            } else {
                showError(res.message || '加载证书失败');
            }
        },
        error: function() {
            showError('加载证书失败，请稍后重试');
        },
        complete: function() {
            hideLoading();
        }
    });
}

function loadExams() {
    ajax({
        url: API_BASE + '/exams/completed',
        type: 'GET',
        success: function(res) {
            if (res.code === 0) {
                const exams = res.data || [];
                const options = exams.map(function(e) {
                    return `<option value="${e.id}">${escapeHtml(e.exam_code)} - ${escapeHtml(e.trade_name)}</option>`;
                }).join('');
                $('#examFilter, #generateExam').append(options);
            }
        }
    });
}

function renderCertificateList(certificates) {
    const container = $('#certificateList');
    if (!container.length) return;

    if (certificates.length === 0) {
        container.html('<tr><td colspan="10" class="text-center text-muted py-4">暂无证书数据</td></tr>');
        return;
    }

    const html = certificates.map(function(c, index) {
        return `
            <tr>
                <td>${(currentPage - 1) * pageSize + index + 1}</td>
                <td>${escapeHtml(c.certificate_no || '-')}</td>
                <td>${escapeHtml(c.id_card || '-')}</td>
                <td>${escapeHtml(c.name || '-')}</td>
                <td>${escapeHtml(c.trade_name || '-')}</td>
                <td>${escapeHtml(c.level || '-')}</td>
                <td>${c.score != null ? c.score : '-'}</td>
                <td><span class="badge ${getStatusBadgeClass(c.status)}">${getStatusText(c.status)}</span></td>
                <td>${formatDate(c.issue_date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewCertificate(${c.id})">
                            <i class="bi bi-eye"></i> 查看
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="downloadCertificate(${c.id})">
                            <i class="bi bi-download"></i> 下载
                        </button>
                        ${c.status === 1 ? `
                        <button class="btn btn-sm btn-danger" onclick="revokeCertificate(${c.id})">
                            <i class="bi bi-x-circle"></i> 吊销
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    container.html(html);
}

function renderPagination(total) {
    const container = $('#pagination');
    if (!container.length) return;

    const totalPages = Math.ceil(total / pageSize);
    
    if (totalPages <= 1) {
        container.html('');
        return;
    }

    let html = '';
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)" onclick="goToPage(${currentPage - 1})">上一页</a></li>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="javascript:void(0)" onclick="goToPage(${i})">${i}</a></li>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }
    
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)" onclick="goToPage(${currentPage + 1})">下一页</a></li>`;
    
    container.html(html);
}

function goToPage(page) {
    currentPage = page;
    loadCertificates();
}

function viewCertificate(id) {
    const cert = currentCertificates.find(function(c) {
        return c.id == id;
    });

    if (!cert) return;

    const modal = new bootstrap.Modal($('#viewModal')[0]);
    $('#certNo').text(cert.certificate_no || '-');
    $('#certName').text(cert.name || '-');
    $('#certIDCard').text(cert.id_card || '-');
    $('#certTrade').text(cert.trade_name || '-');
    $('#certLevel').text(cert.level || '-');
    $('#certScore').text(cert.score || '-');
    $('#certIssueDate').text(formatDate(cert.issue_date));
    $('#certValidDate').text(formatDate(cert.valid_date));
    $('#certStatus').html(`<span class="badge ${getStatusBadgeClass(cert.status)}">${getStatusText(cert.status)}</span>`);
    
    if (cert.photo) {
        $('#certPhoto').attr('src', cert.photo).show();
    } else {
        $('#certPhoto').hide();
    }
    
    modal.show();
}

function downloadCertificate(id) {
    showLoading();
    ajax({
        url: API_BASE + '/certificates/' + id + '/download',
        type: 'GET',
        xhrFields: {
            responseType: 'blob'
        },
        success: function(blob, status, xhr) {
            const filename = xhr.getResponseHeader('Content-Disposition') || 'certificate.pdf';
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace(/attachment; filename=/, '');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showSuccess('证书下载成功');
        },
        error: function() {
            showError('下载失败，请稍后重试');
        },
        complete: function() {
            hideLoading();
        }
    });
}

function revokeCertificate(id) {
    confirmDialog('确定要吊销该证书吗？此操作不可撤销。', function() {
        showLoading();
        ajax({
            url: API_BASE + '/certificates/' + id + '/revoke',
            type: 'POST',
            data: {
                reason: $('#revokeReason').val() || ''
            },
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('证书已吊销');
                    loadCertificates();
                } else {
                    showError(res.message || '操作失败');
                }
            },
            error: function() {
                showError('操作失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });
}

function generateCertificates() {
    const examId = $('#generateExam').val();
    if (!examId) {
        showWarning('请选择考期');
        return;
    }

    confirmDialog('确定要为该考期所有通过人员生成证书吗？', function() {
        showLoading();
        ajax({
            url: API_BASE + '/certificates/batch-generate',
            type: 'POST',
            data: {
                exam_id: examId
            },
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('证书生成成功，共生成 ' + (res.data.count || 0) + ' 本证书');
                    bootstrap.Modal.getInstance($('#generateModal')[0]).hide();
                    loadCertificates();
                } else {
                    showError(res.message || '生成失败');
                }
            },
            error: function() {
                showError('生成失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });
}

function bindEvents() {
    $('#searchBtn').on('click', function() {
        currentPage = 1;
        loadCertificates();
    });

    $('#generateBtn').on('click', function() {
        const modal = new bootstrap.Modal($('#generateModal')[0]);
        modal.show();
    });

    $('#confirmGenerateBtn').on('click', function() {
        generateCertificates();
    });

    $('#exportBtn').on('click', function() {
        const params = {
            keyword: $('#searchKeyword').val().trim(),
            exam_id: $('#examFilter').val(),
            status: $('#statusFilter').val()
        };

        window.location.href = API_BASE + '/certificates/export?' + $.param(params);
    });

    $('#verifyBtn').on('click', function() {
        const verifyNo = $('#verifyNo').val().trim();
        const verifyIDCard = $('#verifyIDCard').val().trim();

        if (!verifyNo) {
            showWarning('请输入证书编号');
            return;
        }

        showLoading();
        ajax({
            url: API_BASE + '/certificates/verify',
            type: 'GET',
            data: {
                certificate_no: verifyNo,
                id_card: verifyIDCard
            },
            success: function(res) {
                if (res.code === 0) {
                    const cert = res.data;
                    const modal = new bootstrap.Modal($('#verifyResultModal')[0]);
                    $('#verifyResult').html(`
                        <div class="text-center mb-4">
                            <div class="text-success display-1 mb-3">
                                <i class="bi bi-check-circle-fill"></i>
                            </div>
                            <h4 class="text-success">证书有效</h4>
                        </div>
                        <table class="table table-bordered">
                            <tr><th style="width: 30%">证书编号</th><td>${escapeHtml(cert.certificate_no || '-')}</td></tr>
                            <tr><th>持证人</th><td>${escapeHtml(cert.name || '-')}</td></tr>
                            <tr><th>身份证号</th><td>${escapeHtml(cert.id_card || '-')}</td></tr>
                            <tr><th>工种</th><td>${escapeHtml(cert.trade_name || '-')}</td></tr>
                            <tr><th>等级</th><td>${escapeHtml(cert.level || '-')}</td></tr>
                            <tr><th>发证日期</th><td>${formatDate(cert.issue_date)}</td></tr>
                            <tr><th>有效期至</th><td>${formatDate(cert.valid_date)}</td></tr>
                            <tr><th>状态</th><td><span class="badge ${getStatusBadgeClass(cert.status)}">${getStatusText(cert.status)}</span></td></tr>
                        </table>
                    `);
                    modal.show();
                } else {
                    const modal = new bootstrap.Modal($('#verifyResultModal')[0]);
                    $('#verifyResult').html(`
                        <div class="text-center">
                            <div class="text-danger display-1 mb-3">
                                <i class="bi bi-x-circle-fill"></i>
                            </div>
                            <h4 class="text-danger">证书无效</h4>
                            <p class="text-muted mt-3">${escapeHtml(res.message || '未找到该证书信息')}</p>
                        </div>
                    `);
                    modal.show();
                }
            },
            error: function() {
                showError('查询失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });

    $('#batchPrintBtn').on('click', function() {
        const ids = [];
        $('.cert-checkbox:checked').each(function() {
            ids.push($(this).val());
        });

        if (ids.length === 0) {
            showWarning('请选择要打印的证书');
            return;
        }

        showLoading();
        ajax({
            url: API_BASE + '/certificates/batch-print',
            type: 'POST',
            data: {
                ids: ids
            },
            xhrFields: {
                responseType: 'blob'
            },
            success: function(blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'certificates.zip';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showSuccess('批量打印成功');
            },
            error: function() {
                showError('批量打印失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });

    $('#selectAll').on('change', function() {
        $('.cert-checkbox').prop('checked', $(this).is(':checked'));
    });
}

function getStatusBadgeClass(status) {
    const map = {
        0: 'badge-secondary',
        1: 'badge-success',
        2: 'badge-danger',
        3: 'badge-warning'
    };
    return map[status] || 'badge-secondary';
}

function getStatusText(status) {
    const map = {
        0: '待生成',
        1: '已生效',
        2: '已吊销',
        3: '已过期'
    };
    return map[status] || '未知';
}
