const ExamModule = {
    activeTab: 'questionBank',
    currentCategory: null,
    questionFilter: { type: '', difficulty: '', keyword: '' },
    paperConfig: {
        levelId: 1,
        specialtyId: 1,
        totalScore: 100,
        questionCount: 50,
        difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
        typeDistribution: { single: 40, multiple: 30, judge: 20, scenario: 10 }
    },
    generatedPaper: null,
    currentPracticalExam: null,
    scoringData: {},

    init() {
        this.render();
    },

    render() {
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <h5 class="mb-0"><i class="bi bi-file-earmark-text me-2 text-primary"></i>考试中心</h5>
                </div>
            </div>

            <ul class="nav nav-tabs" id="exam-tabs">
                <li class="nav-item">
                    <button class="nav-link active" data-tab="questionBank">题库管理</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="paperGeneration">智能组卷</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="practicalScoring">实操评分</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="scoreManagement">成绩管理</button>
                </li>
            </ul>

            <div id="tab-questionBank" class="tab-content"></div>
            <div id="tab-paperGeneration" class="tab-content d-none"></div>
            <div id="tab-practicalScoring" class="tab-content d-none"></div>
            <div id="tab-scoreManagement" class="tab-content d-none"></div>
        `;

        $('#page-exam').html(html);
        this.bindEvents();
        this.renderQuestionBank();
    },

    bindEvents() {
        const self = this;

        $('#exam-tabs .nav-link').on('click', function() {
            const tab = $(this).data('tab');
            self.activeTab = tab;
            
            $('#exam-tabs .nav-link').removeClass('active');
            $(this).addClass('active');
            
            $('.tab-content').addClass('d-none');
            $(`#tab-${tab}`).removeClass('d-none');

            switch (tab) {
                case 'questionBank':
                    self.renderQuestionBank();
                    break;
                case 'paperGeneration':
                    self.renderPaperGeneration();
                    break;
                case 'practicalScoring':
                    self.renderPracticalScoring();
                    break;
                case 'scoreManagement':
                    self.renderScoreManagement();
                    break;
            }
        });
    },

    renderQuestionBank() {
        const self = this;
        const html = `
            <div class="row g-3" style="height: calc(100vh - 200px); min-height: 500px;">
                <div class="col-md-3">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>知识点分类</span>
                            <button class="btn btn-sm btn-outline-primary" id="btn-add-category">
                                <i class="bi bi-plus"></i>
                            </button>
                        </div>
                        <div class="card-body overflow-auto scrollbar-thin p-2" id="category-tree">
                            ${this.renderCategoryTree()}
                        </div>
                    </div>
                </div>

                <div class="col-md-9">
                    <div class="card h-100 d-flex flex-column">
                        <div class="card-header">
                            <div class="d-flex flex-wrap gap-2 align-items-center">
                                <div class="flex-grow-1">
                                    <input type="text" class="form-control form-control-sm" id="question-search" placeholder="搜索题目...">
                                </div>
                                <select class="form-select form-select-sm" style="width: auto;" id="filter-type">
                                    <option value="">全部题型</option>
                                    <option value="single">单选题</option>
                                    <option value="multiple">多选题</option>
                                    <option value="judge">判断题</option>
                                    <option value="scenario">情景分析</option>
                                </select>
                                <select class="form-select form-select-sm" style="width: auto;" id="filter-difficulty">
                                    <option value="">全部难度</option>
                                    <option value="1">简单</option>
                                    <option value="2">中等</option>
                                    <option value="3">困难</option>
                                </select>
                                <button class="btn btn-primary btn-sm" id="btn-add-question">
                                    <i class="bi bi-plus-lg me-1"></i>新增题目
                                </button>
                                <button class="btn btn-outline-secondary btn-sm" id="btn-import-questions">
                                    <i class="bi bi-upload me-1"></i>批量导入
                                </button>
                            </div>
                        </div>
                        <div class="card-body flex-1 overflow-auto scrollbar-thin" id="question-list">
                            ${this.renderQuestionList()}
                        </div>
                        <div class="card-footer text-muted small text-center">
                            共 ${MockData.questionBank.questions.length} 道题目
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#tab-questionBank').html(html);

        $('.tree-toggle').on('click', function(e) {
            e.stopPropagation();
            const $children = $(this).closest('.tree-node').next('.tree-children');
            const $icon = $(this).find('i');
            if ($children.is(':visible')) {
                $children.hide();
                $icon.removeClass('bi-chevron-down').addClass('bi-chevron-right');
            } else {
                $children.show();
                $icon.removeClass('bi-chevron-right').addClass('bi-chevron-down');
            }
        });

        $('.tree-node').on('click', function() {
            $('.tree-node').removeClass('active');
            $(this).addClass('active');
            self.currentCategory = $(this).data('category-id');
            self.renderQuestionListInPlace();
        });

        $('#question-search').on('input', AppCommon.debounce(function() {
            self.questionFilter.keyword = $(this).val();
            self.renderQuestionListInPlace();
        }, 300));

        $('#filter-type, #filter-difficulty').on('change', function() {
            self.questionFilter.type = $('#filter-type').val();
            self.questionFilter.difficulty = $('#filter-difficulty').val();
            self.renderQuestionListInPlace();
        });

        $('#btn-add-question').on('click', () => {
            this.showQuestionEditor();
        });
    },

    renderCategoryTree() {
        const categories = MockData.questionBank.categories;
        return categories.map(cat => `
            <div class="tree-node" data-category-id="${cat.id}">
                <span class="tree-toggle"><i class="bi bi-chevron-down"></i></span>
                <i class="bi bi-folder me-1 text-warning"></i>
                ${cat.name}
                <span class="badge bg-secondary float-end mt-1">${cat.children.reduce((s, c) => s + c.count, 0)}</span>
            </div>
            <div class="tree-children ps-4">
                ${cat.children.map(child => `
                    <div class="tree-node" data-category-id="${child.id}">
                        <span class="tree-toggle" style="visibility: hidden;"><i class="bi bi-chevron-right"></i></span>
                        <i class="bi bi-file-earmark me-1 text-primary"></i>
                        ${child.name}
                        <span class="badge bg-light text-dark float-end mt-1">${child.count}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');
    },

    renderQuestionList() {
        const questions = this.filterQuestions();
        
        if (questions.length === 0) {
            return '<div class="text-center text-muted py-5"><i class="bi bi-inbox display-4"></i><p class="mt-3 mb-0">暂无题目</p></div>';
        }

        return questions.map(q => {
            const typeName = AppCommon.getQuestionTypeName(q.type);
            const diffName = AppCommon.getDifficultyName(q.difficulty);
            const diffColor = AppCommon.getDifficultyColor(q.difficulty);
            
            let optionsPreview = '';
            if (q.type === 'single' || q.type === 'multiple') {
                optionsPreview = q.options.slice(0, 2).map(o => `<div class="text-muted small">${o}</div>`).join('');
            } else if (q.type === 'judge') {
                optionsPreview = `<div class="text-muted small">正确答案：${q.answer ? '正确' : '错误'}</div>`;
            }

            return `
                <div class="question-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1 me-3">
                            <div class="question-text">
                                <span class="badge bg-${diffColor} me-2">${diffName}</span>
                                <span class="badge bg-info me-2">${typeName}</span>
                                ${q.hasImage ? '<i class="bi bi-image text-primary me-1" title="含图片"></i>' : ''}
                                ${q.content}
                            </div>
                            ${optionsPreview}
                            <div class="question-meta">
                                <span><i class="bi bi-hash me-1"></i>ID: ${q.id}</span>
                                <span><i class="bi bi-star me-1"></i>${q.score}分</span>
                                <span><i class="bi bi-tag me-1"></i>知识点：${this.getCategoryName(q.categoryId)}</span>
                            </div>
                        </div>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-primary" onclick="ExamModule.editQuestion(${q.id})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="ExamModule.deleteQuestion(${q.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderQuestionListInPlace() {
        $('#question-list').html(this.renderQuestionList());
    },

    filterQuestions() {
        let questions = [...MockData.questionBank.questions];

        if (this.currentCategory) {
            const catId = this.currentCategory;
            const allChildIds = [];
            MockData.questionBank.categories.forEach(cat => {
                if (cat.id === catId) {
                    cat.children.forEach(c => allChildIds.push(c.id));
                } else if (cat.children.some(c => c.id === catId)) {
                    allChildIds.push(catId);
                }
            });
            if (allChildIds.length > 0) {
                questions = questions.filter(q => allChildIds.includes(q.categoryId));
            }
        }

        if (this.questionFilter.type) {
            questions = questions.filter(q => q.type === this.questionFilter.type);
        }

        if (this.questionFilter.difficulty) {
            questions = questions.filter(q => q.difficulty == this.questionFilter.difficulty);
        }

        if (this.questionFilter.keyword) {
            const keyword = this.questionFilter.keyword.toLowerCase();
            questions = questions.filter(q => q.content.toLowerCase().includes(keyword));
        }

        return questions;
    },

    getCategoryName(categoryId) {
        for (const cat of MockData.questionBank.categories) {
            const child = cat.children.find(c => c.id === categoryId);
            if (child) return `${cat.name} - ${child.name}`;
        }
        return '未知分类';
    },

    showQuestionEditor(questionId = null) {
        const q = questionId ? MockData.questionBank.questions.find(q => q.id === questionId) : null;
        const isEdit = !!q;

        const modalHtml = `
            <div class="modal fade" id="questionEditorModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">${isEdit ? '编辑题目' : '新增题目'}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label fw-medium">题目类型</label>
                                <select class="form-select" id="q-type">
                                    <option value="single" ${q?.type === 'single' ? 'selected' : ''}>单选题</option>
                                    <option value="multiple" ${q?.type === 'multiple' ? 'selected' : ''}>多选题</option>
                                    <option value="judge" ${q?.type === 'judge' ? 'selected' : ''}>判断题</option>
                                    <option value="scenario" ${q?.type === 'scenario' ? 'selected' : ''}>情景分析</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-medium">知识点分类</label>
                                <select class="form-select" id="q-category">
                                    ${MockData.questionBank.categories.flatMap(cat => 
                                        cat.children.map(child => 
                                            `<option value="${child.id}" ${q?.categoryId === child.id ? 'selected' : ''}>${cat.name} - ${child.name}</option>`
                                        )
                                    ).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-medium">难度</label>
                                <select class="form-select" id="q-difficulty">
                                    <option value="1" ${q?.difficulty === 1 ? 'selected' : ''}>简单</option>
                                    <option value="2" ${q?.difficulty === 2 ? 'selected' : ''}>中等</option>
                                    <option value="3" ${q?.difficulty === 3 ? 'selected' : ''}>困难</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-medium">题目内容</label>
                                <textarea class="form-control" id="q-content" rows="3">${q?.content || ''}</textarea>
                            </div>
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-medium">分值</label>
                                    <input type="number" class="form-control" id="q-score" value="${q?.score || 2}" min="1">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-medium">图片附件</label>
                                    <input type="file" class="form-control form-control-sm" id="q-image" accept="image/*">
                                </div>
                            </div>
                            <div id="q-options-container">
                                <label class="form-label fw-medium">选项设置</label>
                                <div id="q-options-list"></div>
                                <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="btn-add-option">
                                    <i class="bi bi-plus me-1"></i>添加选项
                                </button>
                            </div>
                            <div class="mb-3" id="q-answer-container">
                                <label class="form-label fw-medium">正确答案</label>
                                <div id="q-answer"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="btn-save-question">保存</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('questionEditorModal'));
        modal.show();

        const renderOptions = () => {
            const type = $('#q-type').val();
            const $optionsList = $('#q-options-list');
            const $answerDiv = $('#q-answer');

            if (type === 'judge') {
                $optionsList.html('');
                $answerDiv.html(`
                    <div class="d-flex gap-3">
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="q-answer-radio" id="ans-true" value="true" ${q?.answer === true ? 'checked' : ''}>
                            <label class="form-check-label" for="ans-true">正确</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="q-answer-radio" id="ans-false" value="false" ${q?.answer === false ? 'checked' : ''}>
                            <label class="form-check-label" for="ans-false">错误</label>
                        </div>
                    </div>
                `);
            } else if (type === 'scenario') {
                $optionsList.html('<p class="text-muted small mb-0">情景分析题不需要选项，由考官主观评分</p>');
                $answerDiv.html('<p class="text-muted small mb-0">参考答案要点将在考试后提供给考官</p>');
            } else {
                const options = q?.options || ['A. 选项一', 'B. 选项二', 'C. 选项三', 'D. 选项四'];
                $optionsList.html(options.map((opt, i) => `
                    <div class="input-group input-group-sm mb-2">
                        <span class="input-group-text">${String.fromCharCode(65 + i)}.</span>
                        <input type="text" class="form-control" value="${opt.replace(/^[A-D]\.\s*/, '')}" data-option-index="${i}">
                        <button class="btn btn-outline-danger btn-remove-option" type="button" data-index="${i}">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `).join(''));

                const isMultiple = type === 'multiple';
                $answerDiv.html(isMultiple ? `
                    <div class="d-flex flex-wrap gap-3">
                        ${options.map((_, i) => `
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="q-answer-check" value="${String.fromCharCode(65 + i)}" ${q?.answer?.includes(String.fromCharCode(65 + i)) ? 'checked' : ''}>
                                <label class="form-check-label">${String.fromCharCode(65 + i)}</label>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="d-flex gap-3">
                        ${options.map((_, i) => `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="q-answer-radio" value="${String.fromCharCode(65 + i)}" ${q?.answer === String.fromCharCode(65 + i) ? 'checked' : ''}>
                                <label class="form-check-label">${String.fromCharCode(65 + i)}</label>
                            </div>
                        `).join('')}
                    </div>
                `);

                $('.btn-remove-option').on('click', function() {
                    $(this).closest('.input-group').remove();
                });
            }
        };

        $('#q-type').on('change', renderOptions);
        renderOptions();

        $('#btn-add-option').on('click', () => {
            const count = $('#q-options-list .input-group').length;
            if (count >= 8) {
                AppCommon.showAlert('最多8个选项', 'warning');
                return;
            }
            const letter = String.fromCharCode(65 + count);
            $('#q-options-list').append(`
                <div class="input-group input-group-sm mb-2">
                    <span class="input-group-text">${letter}.</span>
                    <input type="text" class="form-control" placeholder="请输入选项内容" data-option-index="${count}">
                    <button class="btn btn-outline-danger btn-remove-option" type="button">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `);
            $('.btn-remove-option').off('click').on('click', function() {
                $(this).closest('.input-group').remove();
            });
        });

        $('#btn-save-question').on('click', () => {
            modal.hide();
            AppCommon.showAlert(isEdit ? '题目已更新' : '题目已添加', 'success');
            setTimeout(() => $('#questionEditorModal').remove(), 300);
        });
    },

    editQuestion(id) {
        this.showQuestionEditor(id);
    },

    deleteQuestion(id) {
        AppCommon.showConfirm('删除确认', '确定要删除此题目吗？删除后无法恢复。', () => {
            MockData.questionBank.questions = MockData.questionBank.questions.filter(q => q.id !== id);
            this.renderQuestionListInPlace();
            AppCommon.showAlert('题目已删除', 'success');
        });
    },

    renderPaperGeneration() {
        const html = `
            <div class="row g-3" style="height: calc(100vh - 200px); min-height: 500px;">
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-header">组卷配置</div>
                        <div class="card-body overflow-auto scrollbar-thin">
                            <div class="mb-3">
                                <label class="form-label fw-medium">考试等级</label>
                                <select class="form-select" id="paper-level">
                                    ${MockData.levels.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-medium">专业方向</label>
                                <select class="form-select" id="paper-specialty">
                                    ${MockData.specialties.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-medium">试卷总分</label>
                                <input type="number" class="form-control" id="paper-total-score" value="100" min="50" max="200">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-medium">题目总数</label>
                                <input type="number" class="form-control" id="paper-question-count" value="50" min="10" max="200">
                            </div>
                            
                            <hr>
                            <h6 class="fw-bold mb-3">难度分布</h6>
                            <div class="mb-2 d-flex justify-content-between align-items-center">
                                <span class="text-success">简单</span>
                                <div class="flex-grow-1 mx-3">
                                    <input type="range" class="form-range" id="diff-easy" min="0" max="100" value="30">
                                </div>
                                <span id="diff-easy-val" class="fw-medium" style="width: 40px; text-align: right;">30%</span>
                            </div>
                            <div class="mb-2 d-flex justify-content-between align-items-center">
                                <span class="text-warning">中等</span>
                                <div class="flex-grow-1 mx-3">
                                    <input type="range" class="form-range" id="diff-medium" min="0" max="100" value="50">
                                </div>
                                <span id="diff-medium-val" class="fw-medium" style="width: 40px; text-align: right;">50%</span>
                            </div>
                            <div class="mb-3 d-flex justify-content-between align-items-center">
                                <span class="text-danger">困难</span>
                                <div class="flex-grow-1 mx-3">
                                    <input type="range" class="form-range" id="diff-hard" min="0" max="100" value="20">
                                </div>
                                <span id="diff-hard-val" class="fw-medium" style="width: 40px; text-align: right;">20%</span>
                            </div>

                            <hr>
                            <h6 class="fw-bold mb-3">题型分布</h6>
                            <div class="mb-2 d-flex justify-content-between align-items-center">
                                <span>单选题</span>
                                <div class="flex-grow-1 mx-3">
                                    <input type="range" class="form-range" id="type-single" min="0" max="100" value="40">
                                </div>
                                <span id="type-single-val" class="fw-medium" style="width: 40px; text-align: right;">40%</span>
                            </div>
                            <div class="mb-2 d-flex justify-content-between align-items-center">
                                <span>多选题</span>
                                <div class="flex-grow-1 mx-3">
                                    <input type="range" class="form-range" id="type-multiple" min="0" max="100" value="30">
                                </div>
                                <span id="type-multiple-val" class="fw-medium" style="width: 40px; text-align: right;">30%</span>
                            </div>
                            <div class="mb-2 d-flex justify-content-between align-items-center">
                                <span>判断题</span>
                                <div class="flex-grow-1 mx-3">
                                    <input type="range" class="form-range" id="type-judge" min="0" max="100" value="20">
                                </div>
                                <span id="type-judge-val" class="fw-medium" style="width: 40px; text-align: right;">20%</span>
                            </div>
                            <div class="mb-3 d-flex justify-content-between align-items-center">
                                <span>情景分析</span>
                                <div class="flex-grow-1 mx-3">
                                    <input type="range" class="form-range" id="type-scenario" min="0" max="100" value="10">
                                </div>
                                <span id="type-scenario-val" class="fw-medium" style="width: 40px; text-align: right;">10%</span>
                            </div>

                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="gen-ab-paper" checked>
                                <label class="form-check-label" for="gen-ab-paper">生成A/B卷（等价试卷）</label>
                            </div>

                            <div class="d-grid gap-2">
                                <button class="btn btn-primary" id="btn-generate-paper">
                                    <i class="bi bi-magic me-1"></i>智能组卷
                                </button>
                                <button class="btn btn-outline-secondary" id="btn-save-paper-config">
                                    <i class="bi bi-save me-1"></i>保存配置
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-8">
                    <div class="card h-100 d-flex flex-column">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>试卷预览</span>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary active" data-paper="A">A卷</button>
                                <button class="btn btn-outline-primary" data-paper="B">B卷</button>
                            </div>
                        </div>
                        <div class="card-body flex-1 overflow-auto scrollbar-thin" id="paper-preview">
                            <div class="paper-preview">
                                <div class="text-center text-muted py-5">
                                    <i class="bi bi-file-earmark-text display-4"></i>
                                    <p class="mt-3 mb-0">请在左侧配置组卷参数，点击"智能组卷"生成试卷</p>
                                </div>
                            </div>
                        </div>
                        <div class="card-footer d-flex justify-content-between align-items-center">
                            <div class="small text-muted" id="paper-stats">
                                共 0 道题，总分 0 分
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-secondary" id="btn-export-paper">
                                    <i class="bi bi-download me-1"></i>导出
                                </button>
                                <button class="btn btn-sm btn-primary" id="btn-publish-paper" disabled>
                                    <i class="bi bi-send me-1"></i>发布考试
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#tab-paperGeneration').html(html);
        this.bindPaperGenerationEvents();
    },

    bindPaperGenerationEvents() {
        const self = this;

        const updateDiffDisplay = () => {
            $('#diff-easy-val').text($('#diff-easy').val() + '%');
            $('#diff-medium-val').text($('#diff-medium').val() + '%');
            $('#diff-hard-val').text($('#diff-hard').val() + '%');
        };

        const updateTypeDisplay = () => {
            $('#type-single-val').text($('#type-single').val() + '%');
            $('#type-multiple-val').text($('#type-multiple').val() + '%');
            $('#type-judge-val').text($('#type-judge').val() + '%');
            $('#type-scenario-val').text($('#type-scenario').val() + '%');
        };

        $('#diff-easy, #diff-medium, #diff-hard').on('input', updateDiffDisplay);
        $('#type-single, #type-multiple, #type-judge, #type-scenario').on('input', updateTypeDisplay);

        $('#btn-generate-paper').on('click', () => {
            self.generatePaper();
        });

        $('[data-paper]').on('click', function() {
            $('[data-paper]').removeClass('active');
            $(this).addClass('active');
            const paper = $(this).data('paper');
            self.showPaper(paper);
        });

        $('#btn-export-paper').on('click', () => {
            AppCommon.showAlert('试卷导出功能开发中', 'info');
        });

        $('#btn-publish-paper').on('click', () => {
            AppCommon.showAlert('考试已发布', 'success');
        });
    },

    generatePaper() {
        const questions = MockData.questionBank.questions;
        const totalCount = parseInt($('#paper-question-count').val());
        const totalScore = parseInt($('#paper-total-score').val());

        if (questions.length < totalCount) {
            AppCommon.showAlert(`题库题目不足，当前只有${questions.length}道题`, 'warning');
            return;
        }

        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        const paperA = shuffled.slice(0, totalCount);
        const paperB = shuffled.slice(Math.floor(shuffled.length / 2), Math.floor(shuffled.length / 2) + totalCount);

        this.generatedPaper = { paperA, paperB, totalScore, totalCount };
        this.showPaper('A');
        
        $('#btn-publish-paper').prop('disabled', false);
        AppCommon.showAlert(`试卷生成成功，共${totalCount}道题，${totalScore}分`, 'success');
    },

    showPaper(paperKey) {
        if (!this.generatedPaper) return;
        
        const paper = paperKey === 'A' ? this.generatedPaper.paperA : this.generatedPaper.paperB;
        const totalScore = this.generatedPaper.totalScore;
        
        const grouped = {
            single: paper.filter(q => q.type === 'single'),
            multiple: paper.filter(q => q.type === 'multiple'),
            judge: paper.filter(q => q.type === 'judge'),
            scenario: paper.filter(q => q.type === 'scenario')
        };

        let html = '';
        let questionNum = 1;
        let calculatedScore = 0;

        const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', scenario: '情景分析题' };

        for (const [type, questions] of Object.entries(grouped)) {
            if (questions.length === 0) continue;
            
            const sectionScore = questions.reduce((s, q) => s + q.score, 0);
            calculatedScore += sectionScore;

            html += `
                <div class="paper-section">
                    <div class="paper-section-title">
                        ${typeNames[type]}（共${questions.length}题，${sectionScore}分）
                    </div>
                    ${questions.map(q => `
                        <div class="mb-3 pb-2 border-bottom">
                            <div class="fw-medium mb-2">
                                ${questionNum++}. ${q.content}
                                <span class="badge bg-secondary ms-2">${q.score}分</span>
                            </div>
                            ${q.options ? `
                                <div class="ps-3">
                                    ${q.options.map(opt => `<div class="mb-1 small">${opt}</div>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        $('#paper-preview').html(`<div class="paper-preview">${html}</div>`);
        $('#paper-stats').text(`共 ${paper.length} 道题，总分 ${calculatedScore} 分`);
    },

    renderPracticalScoring() {
        const html = `
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">实操考核项目</div>
                        <div class="card-body">
                            <div class="list-group list-group-flush" id="exam-list">
                                ${MockData.practicalExams.map((exam, idx) => `
                                    <div class="list-group-item list-group-item-action ${idx === 0 ? 'active' : ''}" 
                                         data-exam-id="${exam.id}"
                                         style="cursor: pointer;">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <div class="fw-medium">${exam.name}</div>
                                                <div class="small text-muted">
                                                    ${AppCommon.getLevelName(exam.levelId)} | 满分${exam.totalScore}
                                                </div>
                                            </div>
                                            <i class="bi bi-chevron-right"></i>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">被考核人员</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <select class="form-select" id="score-firefighter">
                                    <option value="">选择消防员...</option>
                                    ${MockData.firefighters.slice(0, 20).map(f => `
                                        <option value="${f.id}">${f.name} - ${f.stationName}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="small text-muted" id="firefighter-info">
                                请选择被考核人员
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-8">
                    <div class="card" id="scoring-card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>评分面板</span>
                            <span class="badge bg-info" id="current-exam-name">空气呼吸器佩戴操作</span>
                        </div>
                        <div class="card-body" id="scoring-items">
                            ${this.renderScoringItems(MockData.practicalExams[0])}
                        </div>
                        <div class="card-footer">
                            <div class="total-score-card">
                                <div class="total-label">加权总分</div>
                                <div class="total-score" id="total-score">0</div>
                                <div class="mt-2">
                                    <span class="badge bg-white text-dark" id="score-level">未评分</span>
                                </div>
                            </div>
                            <div class="d-grid gap-2 mt-3">
                                <button class="btn btn-primary btn-lg" id="btn-submit-score">
                                    <i class="bi bi-check-circle me-2"></i>提交评分
                                </button>
                                <button class="btn btn-outline-secondary" id="btn-reset-score">
                                    <i class="bi bi-arrow-counterclockwise me-1"></i>重置评分
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#tab-practicalScoring').html(html);
        this.bindPracticalScoringEvents();
    },

    renderScoringItems(exam) {
        return exam.items.map((item, idx) => `
            <div class="mb-4 pb-3 border-bottom ${idx === exam.items.length - 1 ? 'border-bottom-0' : ''}">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <div class="fw-bold fs-5">${item.name}</div>
                        <div class="small text-muted">${item.description}</div>
                    </div>
                    <div class="text-end">
                        <div class="badge bg-primary">权重 ${item.weight}%</div>
                        <div class="small text-muted">满分 ${item.maxScore}分</div>
                    </div>
                </div>
                <div class="score-slider-container">
                    <input type="range" class="score-slider w-100" 
                           min="0" max="${item.maxScore}" step="0.5" value="0"
                           data-item-id="${item.id}"
                           data-weight="${item.weight}"
                           data-max="${item.maxScore}">
                    <div class="d-flex justify-content-between mt-2">
                        <span class="small text-muted">0</span>
                        <span class="score-display fs-3 fw-bold text-primary" id="score-display-${item.id}">0</span>
                        <span class="small text-muted">${item.maxScore}</span>
                    </div>
                </div>
                <div class="mt-2">
                    <label class="form-label small fw-medium">评分备注</label>
                    <textarea class="form-control form-control-sm" rows="2" 
                              placeholder="记录评分要点或扣分原因..."
                              data-item-note="${item.id}"></textarea>
                </div>
            </div>
        `).join('');
    },

    bindPracticalScoringEvents() {
        const self = this;

        $('#exam-list .list-group-item').on('click', function() {
            const examId = $(this).data('exam-id');
            const exam = MockData.practicalExams.find(e => e.id === examId);
            
            $('#exam-list .list-group-item').removeClass('active');
            $(this).addClass('active');
            $('#current-exam-name').text(exam.name);
            $('#scoring-items').html(self.renderScoringItems(exam));
            self.currentPracticalExam = exam;
            self.calculateTotalScore();
            self.bindSliderEvents();
        });

        this.currentPracticalExam = MockData.practicalExams[0];
        this.bindSliderEvents();

        $('#score-firefighter').on('change', function() {
            const id = $(this).val();
            if (!id) {
                $('#firefighter-info').text('请选择被考核人员');
                return;
            }
            const f = MockData.firefighters.find(ff => ff.id == id);
            if (f) {
                $('#firefighter-info').html(`
                    <div class="d-flex align-items-center">
                        <div class="me-2"><i class="bi bi-person-circle fs-4 text-primary"></i></div>
                        <div>
                            <div class="fw-medium">${f.name}</div>
                            <div class="text-muted">${f.stationName} | ${f.levelName}</div>
                        </div>
                    </div>
                `);
            }
        });

        $('#btn-submit-score').on('click', () => {
            const firefighterId = $('#score-firefighter').val();
            if (!firefighterId) {
                AppCommon.showAlert('请选择被考核人员', 'warning');
                return;
            }

            const totalScore = parseFloat($('#total-score').text());
            const exam = self.currentPracticalExam;
            
            if (totalScore === 0) {
                AppCommon.showAlert('请先进行评分', 'warning');
                return;
            }

            const deviation = self.checkScoreDeviation();
            if (deviation > 10) {
                AppCommon.showConfirm('评分偏差预警', 
                    `当前评分与历史平均评分偏差${deviation.toFixed(1)}%，超过阈值。是否触发复评流程？`, 
                    () => {
                        AppCommon.showAlert('已触发复评流程，将由另一名考官进行复核', 'warning');
                    });
            } else {
                AppCommon.showAlert(`评分提交成功，总分：${totalScore}分`, 'success');
            }
        });

        $('#btn-reset-score').on('click', () => {
            $('.score-slider').val(0);
            $('[id^="score-display-"]').text('0');
            $('#total-score').text('0');
            $('#score-level').text('未评分').removeClass().addClass('badge');
        });
    },

    bindSliderEvents() {
        const self = this;
        $('.score-slider').off('input').on('input', function() {
            const itemId = $(this).data('item-id');
            const value = $(this).val();
            $(`#score-display-${itemId}`).text(value);
            self.calculateTotalScore();
        });
    },

    calculateTotalScore() {
        let totalWeightedScore = 0;
        let totalWeight = 0;

        $('.score-slider').each(function() {
            const value = parseFloat($(this).val());
            const max = parseFloat($(this).data('max'));
            const weight = parseFloat($(this).data('weight'));
            
            if (max > 0) {
                const percentage = (value / max) * 100;
                totalWeightedScore += percentage * (weight / 100);
            }
            totalWeight += weight;
        });

        const finalScore = totalWeightedScore.toFixed(1);
        $('#total-score').text(finalScore);

        let level = '未评分';
        let levelClass = 'bg-secondary';
        
        if (finalScore >= 90) {
            level = '优秀';
            levelClass = 'bg-success';
        } else if (finalScore >= 80) {
            level = '良好';
            levelClass = 'bg-primary';
        } else if (finalScore >= 70) {
            level = '合格';
            levelClass = 'bg-info text-dark';
        } else if (finalScore > 0) {
            level = '不合格';
            levelClass = 'bg-danger';
        }

        $('#score-level').text(level).removeClass().addClass(`badge ${levelClass}`);
    },

    checkScoreDeviation() {
        return Math.random() * 20 - 5;
    },

    renderScoreManagement() {
        const html = `
            <div class="card">
                <div class="card-header">
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <div class="flex-grow-1">
                            <h6 class="mb-0">成绩列表</h6>
                        </div>
                        <select class="form-select form-select-sm" style="width: auto;" id="filter-exam">
                            <option value="">全部考试</option>
                            ${MockData.practicalExams.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
                        </select>
                        <select class="form-select form-select-sm" style="width: auto;" id="filter-station-score">
                            <option value="">全部站点</option>
                            ${MockData.fireStations.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                        <select class="form-select form-select-sm" style="width: auto;" id="filter-status">
                            <option value="">全部状态</option>
                            <option value="passed">已通过</option>
                            <option value="failed">未通过</option>
                        </select>
                        <button class="btn btn-outline-secondary btn-sm" id="btn-export-scores">
                            <i class="bi bi-download me-1"></i>导出成绩
                        </button>
                    </div>
                </div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>所属站点</th>
                                <th>考试项目</th>
                                <th>理论成绩</th>
                                <th>实操成绩</th>
                                <th>综合成绩</th>
                                <th>状态</th>
                                <th>考试日期</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="score-table-body">
                            ${this.renderScoreRows(MockData.examScores)}
                        </tbody>
                    </table>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <span class="small text-muted">共 ${MockData.examScores.length} 条记录</span>
                    <nav>
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item disabled"><a class="page-link" href="#">上一页</a></li>
                            <li class="page-item active"><a class="page-link" href="#">1</a></li>
                            <li class="page-item"><a class="page-link" href="#">2</a></li>
                            <li class="page-item"><a class="page-link" href="#">3</a></li>
                            <li class="page-item"><a class="page-link" href="#">下一页</a></li>
                        </ul>
                    </nav>
                </div>
            </div>
        `;

        $('#tab-scoreManagement').html(html);

        $('#btn-export-scores').on('click', () => {
            AppCommon.showAlert('成绩导出功能开发中', 'info');
        });
    },

    renderScoreRows(scores) {
        return scores.map(s => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px; font-size: 0.85rem;">
                            ${s.name.charAt(0)}
                        </div>
                        <span class="fw-medium">${s.name}</span>
                    </div>
                </td>
                <td>${MockData.fireStations.find(st => st.id === s.stationId)?.name || '-'}</td>
                <td>${s.examName}</td>
                <td>${s.theoryScore}</td>
                <td>${s.practicalScore}</td>
                <td class="fw-bold ${s.totalScore >= 80 ? 'text-success' : 'text-danger'}">${s.totalScore}</td>
                <td>
                    <span class="badge ${s.status === 'passed' ? 'bg-success' : 'bg-danger'}">
                        ${s.status === 'passed' ? '通过' : '未通过'}
                    </span>
                </td>
                <td>${s.date}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="ExamModule.viewScoreDetail(${s.firefighterId})">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    viewScoreDetail(id) {
        AppCommon.showAlert('查看成绩详情功能开发中', 'info');
    }
};
