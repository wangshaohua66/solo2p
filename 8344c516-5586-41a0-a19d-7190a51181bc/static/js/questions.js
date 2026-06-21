let currentQuestions = [];
let currentPage = 1;
let pageSize = 10;

$(function() {
    if (!checkLogin()) return;
    renderNavbar('question');
    loadQuestions();
    bindEvents();
    loadTrades();
});

function loadQuestions() {
    showLoading();
    
    const params = {
        page: currentPage,
        pageSize: pageSize,
        keyword: $('#searchKeyword').val().trim(),
        trade_id: $('#tradeFilter').val(),
        type: $('#typeFilter').val(),
        difficulty: $('#difficultyFilter').val()
    };

    ajax({
        url: API_BASE + '/questions',
        type: 'GET',
        data: params,
        success: function(res) {
            if (res.code === 0) {
                currentQuestions = res.data.items || [];
                renderQuestionList(currentQuestions);
                renderPagination(res.data.total || 0);
            } else {
                showError(res.message || '加载题目失败');
            }
        },
        error: function() {
            showError('加载题目失败，请稍后重试');
        },
        complete: function() {
            hideLoading();
        }
    });
}

function loadTrades() {
    ajax({
        url: API_BASE + '/trades',
        type: 'GET',
        success: function(res) {
            if (res.code === 0) {
                const trades = res.data || [];
                const options = trades.map(function(t) {
                    return `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
                }).join('');
                $('#tradeFilter, #questionTrade').append(options);
            }
        }
    });
}

function renderQuestionList(questions) {
    const container = $('#questionList');
    if (!container.length) return;

    if (questions.length === 0) {
        container.html('<tr><td colspan="8" class="text-center text-muted py-4">暂无题目数据</td></tr>');
        return;
    }

    const html = questions.map(function(q, index) {
        return `
            <tr>
                <td>${(currentPage - 1) * pageSize + index + 1}</td>
                <td>${escapeHtml(q.trade_name || '-')}</td>
                <td><span class="badge ${getTypeBadgeClass(q.type)}">${getTypeText(q.type)}</span></td>
                <td><span class="badge ${getDifficultyBadgeClass(q.difficulty)}">${getDifficultyText(q.difficulty)}</span></td>
                <td class="question-content">${escapeHtml(q.content || '-')}</td>
                <td>${q.score || 0}分</td>
                <td><span class="badge ${getStatusBadgeClass(q.status)}">${getStatusText(q.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editQuestion(${q.id})">
                            <i class="bi bi-pencil"></i> 编辑
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="previewQuestion(${q.id})">
                            <i class="bi bi-eye"></i> 预览
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id})">
                            <i class="bi bi-trash"></i> 删除
                        </button>
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
    loadQuestions();
}

function showCreateQuestionModal() {
    const modal = new bootstrap.Modal($('#questionModal')[0]);
    $('#questionForm')[0].reset();
    $('#questionId').val('');
    $('#optionsContainer').empty();
    addOptionRow();
    modal.show();
}

function editQuestion(id) {
    const question = currentQuestions.find(function(q) {
        return q.id == id;
    });

    if (!question) return;

    const modal = new bootstrap.Modal($('#questionModal')[0]);
    $('#questionId').val(question.id);
    $('#questionTrade').val(question.trade_id || '');
    $('#questionType').val(question.type || '');
    $('#questionDifficulty').val(question.difficulty || '');
    $('#questionContent').val(question.content || '');
    $('#questionScore').val(question.score || 100);
    $('#questionAnswer').val(question.answer || '');
    $('#questionAnalysis').val(question.analysis || '');

    $('#optionsContainer').empty();
    if (question.options && question.options.length > 0) {
        question.options.forEach(function(opt, idx) {
            addOptionRow(opt.label, opt.content, opt.is_correct);
        });
    } else {
        addOptionRow();
    }

    modal.show();
}

function addOptionRow(label, content, isCorrect) {
    const container = $('#optionsContainer');
    const idx = container.children().length;
    const optionLabel = label || String.fromCharCode(65 + idx);
    
    const html = `
        <div class="option-row row g-2 mb-2">
            <div class="col-md-1">
                <input type="text" class="form-control option-label" value="${optionLabel}" maxlength="1" placeholder="选项">
            </div>
            <div class="col-md-9">
                <input type="text" class="form-control option-content" value="${content || ''}" placeholder="选项内容">
            </div>
            <div class="col-md-1">
                <div class="form-check mt-2">
                    <input type="checkbox" class="form-check-input option-correct" ${isCorrect ? 'checked' : ''}>
                    <label class="form-check-label">正确</label>
                </div>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-sm btn-outline-danger w-100" onclick="removeOptionRow(this)">
                    <i class="bi bi-dash"></i>
                </button>
            </div>
        </div>
    `;
    container.append(html);
}

function removeOptionRow(btn) {
    const container = $('#optionsContainer');
    if (container.children().length > 1) {
        $(btn).closest('.option-row').remove();
        updateOptionLabels();
    } else {
        showWarning('至少需要一个选项');
    }
}

function updateOptionLabels() {
    $('#optionsContainer .option-row').each(function(idx) {
        $(this).find('.option-label').val(String.fromCharCode(65 + idx));
    });
}

function deleteQuestion(id) {
    confirmDialog('确定要删除该题目吗？此操作不可撤销。', function() {
        showLoading();
        ajax({
            url: API_BASE + '/questions/' + id,
            type: 'DELETE',
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('题目已删除');
                    loadQuestions();
                } else {
                    showError(res.message || '删除失败');
                }
            },
            error: function() {
                showError('删除失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });
}

function previewQuestion(id) {
    const question = currentQuestions.find(function(q) {
        return q.id == id;
    });

    if (!question) return;

    const modal = new bootstrap.Modal($('#previewModal')[0]);
    $('#previewContent').html(`
        <div class="mb-3">
            <span class="badge ${getTypeBadgeClass(question.type)} me-2">${getTypeText(question.type)}</span>
            <span class="badge ${getDifficultyBadgeClass(question.difficulty)}">${getDifficultyText(question.difficulty)}</span>
            <span class="float-end">${question.score || 0}分</span>
        </div>
        <div class="mb-3">
            <h5>${escapeHtml(question.content || '')}</h5>
        </div>
        ${question.options && question.options.length > 0 ? `
        <div class="mb-3">
            ${question.options.map(function(opt) {
                return `
                <div class="form-check mb-2">
                    <input class="form-check-input" type="radio" name="previewOption" id="previewOpt${opt.label}">
                    <label class="form-check-label" for="previewOpt${opt.label}">
                        ${opt.label}. ${escapeHtml(opt.content)}
                    </label>
                </div>
                `;
            }).join('')}
        </div>
        ` : ''}
        <div class="alert alert-primary">
            <strong>正确答案：</strong>${escapeHtml(question.answer || '-')}
        </div>
        ${question.analysis ? `
        <div class="alert alert-info">
            <strong>解析：</strong>${escapeHtml(question.analysis)}
        </div>
        ` : ''}
    `);
    modal.show();
}

function bindEvents() {
    $('#addOptionBtn').on('click', function() {
        addOptionRow();
    });

    $('#questionForm').submit(function(e) {
        e.preventDefault();
        
        const questionId = $('#questionId').val();
        const options = [];
        $('#optionsContainer .option-row').each(function() {
            options.push({
                label: $(this).find('.option-label').val().trim(),
                content: $(this).find('.option-content').val().trim(),
                is_correct: $(this).find('.option-correct').is(':checked')
            });
        });

        const data = {
            trade_id: $('#questionTrade').val(),
            type: $('#questionType').val(),
            difficulty: $('#questionDifficulty').val(),
            content: $('#questionContent').val().trim(),
            score: $('#questionScore').val(),
            answer: $('#questionAnswer').val().trim(),
            analysis: $('#questionAnalysis').val().trim(),
            options: options
        };

        showLoading();
        const url = questionId ? API_BASE + '/questions/' + questionId : API_BASE + '/questions';
        const method = questionId ? 'PUT' : 'POST';

        ajax({
            url: url,
            type: method,
            data: data,
            success: function(res) {
                if (res.code === 0) {
                    showSuccess(questionId ? '题目已更新' : '题目已创建');
                    bootstrap.Modal.getInstance($('#questionModal')[0]).hide();
                    loadQuestions();
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

    $('#searchBtn').on('click', function() {
        currentPage = 1;
        loadQuestions();
    });

    $('#importBtn').on('click', function() {
        $('#importFile').click();
    });

    $('#importFile').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        showLoading();
        $.ajax({
            url: API_BASE + '/questions/import',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'Authorization': 'Bearer ' + getToken()
            },
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('导入成功，共导入 ' + (res.data.count || 0) + ' 道题目');
                    loadQuestions();
                } else {
                    showError(res.message || '导入失败');
                }
            },
            error: function() {
                showError('导入失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
                $('#importFile').val('');
            }
        });
    });

    $('#exportBtn').on('click', function() {
        const params = {
            keyword: $('#searchKeyword').val().trim(),
            trade_id: $('#tradeFilter').val(),
            type: $('#typeFilter').val(),
            difficulty: $('#difficultyFilter').val()
        };

        window.location.href = API_BASE + '/questions/export?' + $.param(params);
    });
}

function getTypeBadgeClass(type) {
    const map = {
        1: 'badge-primary',
        2: 'badge-success',
        3: 'badge-warning',
        4: 'badge-info'
    };
    return map[type] || 'badge-secondary';
}

function getTypeText(type) {
    const map = {
        1: '单选题',
        2: '多选题',
        3: '判断题',
        4: '简答题'
    };
    return map[type] || '未知';
}

function getDifficultyBadgeClass(difficulty) {
    const map = {
        1: 'badge-success',
        2: 'badge-warning',
        3: 'badge-danger'
    };
    return map[difficulty] || 'badge-secondary';
}

function getDifficultyText(difficulty) {
    const map = {
        1: '简单',
        2: '中等',
        3: '困难'
    };
    return map[difficulty] || '未知';
}

function getStatusBadgeClass(status) {
    const map = {
        0: 'badge-secondary',
        1: 'badge-primary',
        2: 'badge-success'
    };
    return map[status] || 'badge-secondary';
}

function getStatusText(status) {
    const map = {
        0: '草稿',
        1: '待审核',
        2: '已启用'
    };
    return map[status] || '未知';
}
