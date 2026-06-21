let currentScores = [];
let parsedScores = [];
let currentPage = 1;
let pageSize = 10;

$(function() {
    if (!checkLogin()) return;
    renderNavbar('score');
    loadScores();
    bindDragEvents();
    bindEvents();
    loadExams();
});

function loadScores() {
    showLoading();
    
    const params = {
        page: currentPage,
        pageSize: pageSize,
        keyword: $('#searchKeyword').val().trim(),
        exam_id: $('#examFilter').val(),
        status: $('#statusFilter').val()
    };

    ajax({
        url: API_BASE + '/scores',
        type: 'GET',
        data: params,
        success: function(res) {
            if (res.code === 0) {
                currentScores = res.data.items || [];
                renderScoreList(currentScores);
                renderPagination(res.data.total || 0);
            } else {
                showError(res.message || '加载成绩失败');
            }
        },
        error: function() {
            showError('加载成绩失败，请稍后重试');
        },
        complete: function() {
            hideLoading();
        }
    });
}

function loadExams() {
    ajax({
        url: API_BASE + '/exams/finished',
        type: 'GET',
        success: function(res) {
            if (res.code === 0) {
                const exams = res.data || [];
                const options = exams.map(function(e) {
                    return `<option value="${e.id}">${escapeHtml(e.exam_code)} - ${escapeHtml(e.trade_name)}</option>`;
                }).join('');
                $('#examFilter, #importExam').append(options);
            }
        }
    });
}

function renderScoreList(scores) {
    const container = $('#scoreList');
    if (!container.length) return;

    if (scores.length === 0) {
        container.html('<tr><td colspan="9" class="text-center text-muted py-4">暂无成绩数据</td></tr>');
        return;
    }

    const html = scores.map(function(s, index) {
        return `
            <tr class="${s.has_error ? 'error-row' : ''}">
                <td>${(currentPage - 1) * pageSize + index + 1}</td>
                <td>${escapeHtml(s.exam_code || '-')}</td>
                <td>${escapeHtml(s.trade_name || '-')}</td>
                <td>${escapeHtml(s.id_card || '-')}</td>
                <td>${escapeHtml(s.name || '-')}</td>
                <td>${s.score != null ? s.score : '-'}</td>
                <td>${s.pass_score != null ? s.pass_score : 60}</td>
                <td><span class="badge ${s.is_pass ? 'badge-success' : 'badge-danger'}">${s.is_pass ? '通过' : '未通过'}</span></td>
                <td>
                    <span class="badge ${getStatusBadgeClass(s.status)}">${getStatusText(s.status)}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editScore(${s.id})">
                            <i class="bi bi-pencil"></i> 编辑
                        </button>
                        ${s.status === 1 ? `
                        <button class="btn btn-sm btn-success" onclick="approveScore(${s.id})">
                            <i class="bi bi-check-circle"></i> 复核
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
    loadScores();
}

function bindDragEvents() {
    const dropZone = $('#dropZone');
    if (!dropZone.length) return;

    dropZone.on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.addClass('dragover');
    });

    dropZone.on('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.removeClass('dragover');
    });

    dropZone.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.removeClass('dragover');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    dropZone.on('click', function() {
        $('#scoreFile').click();
    });

    $('#scoreFile').on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });
}

function handleFileUpload(file) {
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        showError('请上传Excel文件（.xlsx或.xls格式）');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showError('文件大小不能超过10MB');
        return;
    }

    $('#uploadFileName').text(file.name);
    $('#uploadFileSize').text(formatFileSize(file.size));
    
    parseExcelFile(file);
}

function parseExcelFile(file) {
    showLoading();
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            if (jsonData.length < 2) {
                hideLoading();
                showError('Excel文件数据格式不正确，请确保包含表头和数据行');
                return;
            }

            const headers = jsonData[0].map(function(h) {
                return String(h || '').trim();
            });
            
            parsedScores = validateAndParseData(jsonData.slice(1), headers);
            
            renderPreviewData(parsedScores);
            
            const errorCount = parsedScores.filter(function(s) {
                return s.has_error;
            }).length;
            
            if (errorCount > 0) {
                showWarning(`数据解析完成，发现 ${errorCount} 条错误数据，请检查后再提交`);
            } else {
                showSuccess(`数据解析完成，共 ${parsedScores.length} 条数据，全部校验通过`);
            }
            
        } catch (err) {
            showError('Excel文件解析失败：' + err.message);
        } finally {
            hideLoading();
        }
    };
    
    reader.onerror = function() {
        hideLoading();
        showError('文件读取失败');
    };
    
    reader.readAsArrayBuffer(file);
}

function validateAndParseData(rows, headers) {
    const idCardIdx = headers.findIndex(function(h) {
        return /身份证|身份证号|idcard/i.test(h);
    });
    const nameIdx = headers.findIndex(function(h) {
        return /姓名|name/i.test(h);
    });
    const scoreIdx = headers.findIndex(function(h) {
        return /成绩|分数|score/i.test(h);
    });

    return rows.map(function(row, rowIdx) {
        const item = {
            row_num: rowIdx + 2,
            id_card: String(row[idCardIdx] || '').trim(),
            name: String(row[nameIdx] || '').trim(),
            score: parseFloat(row[scoreIdx]) || 0,
            errors: []
        };

        if (!item.id_card) {
            item.errors.push('身份证号不能为空');
        } else if (!/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(item.id_card)) {
            item.errors.push('身份证号格式不正确');
        }

        if (!item.name) {
            item.errors.push('姓名不能为空');
        }

        if (item.score === 0 && row[scoreIdx] !== 0) {
            item.errors.push('成绩格式不正确');
        } else if (item.score < 0 || item.score > 100) {
            item.errors.push('成绩必须在0-100之间');
        }

        item.has_error = item.errors.length > 0;
        item.error_message = item.errors.join('；');

        return item;
    });
}

function renderPreviewData(scores) {
    const container = $('#previewList');
    if (!container.length) return;

    if (scores.length === 0) {
        container.html('<tr><td colspan="6" class="text-center text-muted py-4">暂无数据</td></tr>');
        return;
    }

    const html = scores.map(function(s, index) {
        return `
            <tr class="${s.has_error ? 'error-row' : ''}">
                <td>${index + 1}</td>
                <td>${escapeHtml(s.id_card || '-')}</td>
                <td>${escapeHtml(s.name || '-')}</td>
                <td>${s.score != null ? s.score : '-'}</td>
                <td><span class="badge ${s.score >= 60 ? 'badge-success' : 'badge-danger'}">${s.score >= 60 ? '通过' : '未通过'}</span></td>
                <td>${s.has_error ? '<span class="text-danger">' + escapeHtml(s.error_message) + '</span>' : '<span class="text-success"><i class="bi bi-check-circle"></i> 校验通过</span>'}</td>
            </tr>
        `;
    }).join('');

    container.html(html);
    
    const validCount = scores.filter(function(s) {
        return !s.has_error;
    }).length;
    const errorCount = scores.length - validCount;
    
    $('#validCount').text(validCount);
    $('#errorCount').text(errorCount);
}

function bindEvents() {
    $('#searchBtn').on('click', function() {
        currentPage = 1;
        loadScores();
    });

    $('#importBtn').on('click', function() {
        const modal = new bootstrap.Modal($('#importModal')[0]);
        modal.show();
    });

    $('#submitImportBtn').on('click', function() {
        const examId = $('#importExam').val();
        if (!examId) {
            showWarning('请选择考期');
            return;
        }

        if (parsedScores.length === 0) {
            showWarning('请先上传并解析Excel文件');
            return;
        }

        const validScores = parsedScores.filter(function(s) {
            return !s.has_error;
        });

        if (validScores.length === 0) {
            showError('没有可提交的有效数据');
            return;
        }

        showLoading();
        ajax({
            url: API_BASE + '/scores/batch',
            type: 'POST',
            data: {
                exam_id: examId,
                scores: validScores
            },
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('成绩导入成功，共导入 ' + (res.data.count || 0) + ' 条');
                    bootstrap.Modal.getInstance($('#importModal')[0]).hide();
                    parsedScores = [];
                    loadScores();
                } else {
                    showError(res.message || '导入失败');
                }
            },
            error: function() {
                showError('导入失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });

    $('#scoreForm').submit(function(e) {
        e.preventDefault();
        
        const scoreId = $('#scoreId').val();
        const data = {
            exam_id: $('#scoreExam').val(),
            id_card: $('#scoreIdCard').val().trim(),
            name: $('#scoreName').val().trim(),
            score: $('#scoreValue').val(),
            pass_score: $('#passScore').val() || 60
        };

        showLoading();
        const url = scoreId ? API_BASE + '/scores/' + scoreId : API_BASE + '/scores';
        const method = scoreId ? 'PUT' : 'POST';

        ajax({
            url: url,
            type: method,
            data: data,
            success: function(res) {
                if (res.code === 0) {
                    showSuccess(scoreId ? '成绩已更新' : '成绩已创建');
                    bootstrap.Modal.getInstance($('#scoreModal')[0]).hide();
                    loadScores();
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

    $('#exportBtn').on('click', function() {
        const params = {
            keyword: $('#searchKeyword').val().trim(),
            exam_id: $('#examFilter').val(),
            status: $('#statusFilter').val()
        };

        window.location.href = API_BASE + '/scores/export?' + $.param(params);
    });
}

function editScore(id) {
    const score = currentScores.find(function(s) {
        return s.id == id;
    });

    if (!score) return;

    const modal = new bootstrap.Modal($('#scoreModal')[0]);
    $('#scoreId').val(score.id);
    $('#scoreExam').val(score.exam_id || '');
    $('#scoreIdCard').val(score.id_card || '');
    $('#scoreName').val(score.name || '');
    $('#scoreValue').val(score.score || '');
    $('#passScore').val(score.pass_score || 60);
    modal.show();
}

function approveScore(id) {
    confirmDialog('确定要复核通过该成绩吗？', function() {
        showLoading();
        ajax({
            url: API_BASE + '/scores/' + id + '/approve',
            type: 'POST',
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('成绩复核通过');
                    loadScores();
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

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getStatusBadgeClass(status) {
    const map = {
        0: 'badge-secondary',
        1: 'badge-warning',
        2: 'badge-success',
        3: 'badge-danger'
    };
    return map[status] || 'badge-secondary';
}

function getStatusText(status) {
    const map = {
        0: '待录入',
        1: '待复核',
        2: '已通过',
        3: '已驳回'
    };
    return map[status] || '未知';
}
