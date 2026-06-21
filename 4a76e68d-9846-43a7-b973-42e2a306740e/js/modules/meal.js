var Meal = window.Meal = (function () {
    var mealPlans = [];
    var mothers = [];
    var today = '';

    var CONSTITUTION_LABELS = {
        qi: '气虚体质',
        blood: '血虚体质',
        yin: '阴虚体质',
        yang: '阳虚体质'
    };

    var STATUS_LABELS = {
        pending: '待制作',
        cooking: '制作中',
        delivered: '已送达'
    };

    var MEAL_ORDER = ['morning', 'morning_snack', 'noon', 'noon_snack', 'evening', 'evening_snack'];

    var DEFAULT_MEALS = {
        qi: [
            { type: 'morning', name: '黄芪小米粥', ingredients: ['小米', '黄芪', '红枣'] },
            { type: 'morning_snack', name: '红枣银耳羹', ingredients: ['红枣', '银耳', '枸杞'] },
            { type: 'noon', name: '山药炖乌鸡', ingredients: ['乌鸡', '山药', '枸杞'] },
            { type: 'noon_snack', name: '花生红豆汤', ingredients: ['花生', '红豆', '红糖'] },
            { type: 'evening', name: '当归鲫鱼汤', ingredients: ['鲫鱼', '当归', '姜'] },
            { type: 'evening_snack', name: '酒酿圆子', ingredients: ['酒酿', '糯米', '红糖'] }
        ],
        blood: [
            { type: 'morning', name: '红枣小米粥', ingredients: ['小米', '红枣', '红糖'] },
            { type: 'morning_snack', name: '桂圆红枣茶', ingredients: ['桂圆', '红枣', '枸杞'] },
            { type: 'noon', name: '花生猪蹄汤', ingredients: ['猪蹄', '花生', '红枣'] },
            { type: 'noon_snack', name: '黑芝麻糊', ingredients: ['黑芝麻', '核桃', '红糖'] },
            { type: 'evening', name: '莲藕排骨汤', ingredients: ['莲藕', '排骨', '红枣'] },
            { type: 'evening_snack', name: '红豆酒酿', ingredients: ['红豆', '酒酿', '红糖'] }
        ],
        yin: [
            { type: 'morning', name: '百合莲子粥', ingredients: ['百合', '莲子', '小米'] },
            { type: 'morning_snack', name: '木瓜炖银耳', ingredients: ['木瓜', '银耳', '枸杞'] },
            { type: 'noon', name: '丝瓜鲫鱼汤', ingredients: ['鲫鱼', '丝瓜', '姜'] },
            { type: 'noon_snack', name: '山药百合羹', ingredients: ['山药', '百合', '冰糖'] },
            { type: 'evening', name: '莲藕乌鸡汤', ingredients: ['乌鸡', '莲藕', '枸杞'] },
            { type: 'evening_snack', name: '银耳莲子羹', ingredients: ['银耳', '莲子', '枸杞'] }
        ],
        yang: [
            { type: 'morning', name: '姜枣小米粥', ingredients: ['小米', '姜', '红枣'] },
            { type: 'morning_snack', name: '桂圆姜茶', ingredients: ['桂圆', '姜', '红枣'] },
            { type: 'noon', name: '当归羊肉汤', ingredients: ['羊肉', '当归', '姜'] },
            { type: 'noon_snack', name: '核桃红枣汤', ingredients: ['核桃', '红枣', '红糖'] },
            { type: 'evening', name: '黄花猪蹄汤', ingredients: ['猪蹄', '黄花菜', '姜'] },
            { type: 'evening_snack', name: '姜酒酿蛋', ingredients: ['酒酿', '鸡蛋', '姜'] }
        ]
    };

    function render() {
        today = Store.formatDate(new Date());
        var storeId = App.state.storeId;
        if (!storeId) return;

        Promise.all([
            Store.getMealPlansByStore(storeId),
            Store.getMothersByStore(storeId)
        ]).then(function (results) {
            mealPlans = (results[0] || []).filter(function (p) { return p.date === today; });
            mothers = results[1] || [];
            renderPage();
        }).catch(function (err) {
            console.error('加载月子餐数据失败:', err);
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>数据加载失败，请刷新重试</p></div>');
        });
    }

    function renderPage() {
        var html = '';
        html += renderMissingMealWarning();
        html += renderPageHeader();
        html += renderStatCards();
        html += renderFilterBar();
        html += renderKanbanBoard();

        $('#app-content').html(html);
        bindEvents();
    }

    function renderMissingMealWarning() {
        var now = new Date();
        var hour = now.getHours();
        var missingMeals = [];

        mealPlans.forEach(function (plan) {
            plan.meals.forEach(function (meal) {
                if (meal.status !== 'delivered' && meal.status !== 'cooking') {
                    if (meal.type === 'morning' && hour >= 8) missingMeals.push(plan.motherName + ' - 早餐');
                    if (meal.type === 'noon' && hour >= 12) missingMeals.push(plan.motherName + ' - 午餐');
                    if (meal.type === 'evening' && hour >= 18) missingMeals.push(plan.motherName + ' - 晚餐');
                }
            });
        });

        if (missingMeals.length === 0) return '';

        return '<div class="alert alert-warning d-flex align-items-center fade-in mb-3" style="border-radius:var(--radius-md);border-color:var(--color-warning);background:rgba(240,173,78,0.1);">' +
            '<i class="bi bi-exclamation-triangle-fill me-2" style="color:var(--color-warning);font-size:20px;"></i>' +
            '<div><strong>漏餐预警</strong>：以下餐品已超过正常制作时间，请尽快处理：<br>' +
            '<small class="text-danger">' + missingMeals.slice(0, 5).join('、') + (missingMeals.length > 5 ? '...共' + missingMeals.length + '条' : '') + '</small>' +
            '</div></div>';
    }

    function renderPageHeader() {
        var actionsHtml = '<button class="btn btn-pink" id="btn-diagnosis"><i class="bi bi-clipboard2-pulse me-1"></i>体质辨证</button>';
        return App.renderPageHeader('bi-cup-hot', '月子餐管理', App.state.storeName + ' · ' + today, actionsHtml);
    }

    function renderStatCards() {
        var totalPlans = mealPlans.length;
        var pendingCount = 0;
        var cookingCount = 0;
        var deliveredCount = 0;

        mealPlans.forEach(function (plan) {
            plan.meals.forEach(function (meal) {
                if (meal.status === 'pending') pendingCount++;
                else if (meal.status === 'cooking') cookingCount++;
                else if (meal.status === 'delivered') deliveredCount++;
            });
        });

        return '<div class="row g-3 mb-4 fade-in">' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon pink"><i class="bi bi-receipt"></i></div>' +
            '<div class="stat-value">' + totalPlans + '</div>' +
            '<div class="stat-label">今日食谱数</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon yellow"><i class="bi bi-hourglass-split"></i></div>' +
            '<div class="stat-value">' + pendingCount + '</div>' +
            '<div class="stat-label">待制作</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon blue"><i class="bi bi-fire"></i></div>' +
            '<div class="stat-value">' + cookingCount + '</div>' +
            '<div class="stat-label">制作中</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon green"><i class="bi bi-check2-circle"></i></div>' +
            '<div class="stat-value">' + deliveredCount + '</div>' +
            '<div class="stat-label">已送达</div>' +
            '</div></div>' +
            '</div>';
    }

    function renderFilterBar() {
        var mealTypes = [
            { value: 'all', label: '全部餐次' },
            { value: 'morning', label: '早餐' },
            { value: 'morning_snack', label: '早点' },
            { value: 'noon', label: '午餐' },
            { value: 'noon_snack', label: '午点' },
            { value: 'evening', label: '晚餐' },
            { value: 'evening_snack', label: '晚点' }
        ];

        return '<div class="filter-bar fade-in">' +
            '<select class="form-select form-select-sm" id="meal-type-filter">' +
            mealTypes.map(function (t) { return '<option value="' + t.value + '">' + t.label + '</option>'; }).join('') +
            '</select>' +
            '<span class="badge-pink"><i class="bi bi-info-circle me-1"></i>点击卡片可流转状态</span>' +
            '</div>';
    }

    function renderKanbanBoard() {
        return '<div class="kanban-board fade-in">' +
            renderKanbanColumn('pending', '待制作', 'bi-hourglass-split', 'yellow') +
            renderKanbanColumn('cooking', '制作中', 'bi-fire', 'blue') +
            renderKanbanColumn('delivered', '已送达', 'bi-check2-circle', 'green') +
            '</div>';
    }

    function renderKanbanColumn(status, title, icon, iconColor) {
        var filter = $('#meal-type-filter').val() || 'all';
        var allMeals = [];

        mealPlans.forEach(function (plan) {
            plan.meals.forEach(function (meal) {
                if (meal.status === status && (filter === 'all' || meal.type === filter)) {
                    allMeals.push({
                        plan: plan,
                        meal: meal
                    });
                }
            });
        });

        allMeals.sort(function (a, b) {
            return MEAL_ORDER.indexOf(a.meal.type) - MEAL_ORDER.indexOf(b.meal.type);
        });

        var cardsHtml = allMeals.length > 0
            ? allMeals.map(renderKanbanCard).join('')
            : '<div class="empty-state" style="padding:32px 16px;"><i class="bi bi-inbox"></i><p>暂无' + title + '餐品</p></div>';

        return '<div class="kanban-column" data-status="' + status + '">' +
            '<div class="kanban-column-header">' +
            '<div class="kanban-column-title"><i class="bi ' + icon + '"></i>' + title + '</div>' +
            '<div class="kanban-column-count">' + allMeals.length + '</div>' +
            '</div>' +
            cardsHtml +
            '</div>';
    }

    function renderKanbanCard(item) {
        var plan = item.plan;
        var meal = item.meal;
        var typeClass = 'meal-tag-' + meal.type.replace('_', '-');
        var mealTypeLabel = Store.MEAL_TYPE_LABELS[meal.type] || meal.type;
        var constitutionLabel = CONSTITUTION_LABELS[plan.constitution] || plan.constitution;

        var hasAllergy = false;
        var allergyWarning = '';
        if (plan.allergies && plan.allergies.length > 0) {
            meal.ingredients.forEach(function (ing) {
                plan.allergies.forEach(function (allergy) {
                    if (ing.indexOf(allergy) >= 0 || allergy.indexOf(ing) >= 0) {
                        hasAllergy = true;
                    }
                });
            });
        }

        if (hasAllergy) {
            allergyWarning = '<span class="badge-red" style="margin-left:4px;"><i class="bi bi-exclamation-triangle"></i>忌口</span>';
        }

        var cardColor = meal.status === 'pending' ? 'var(--color-primary)'
            : meal.status === 'cooking' ? 'var(--color-info)'
            : 'var(--color-success)';

        return '<div class="kanban-card" data-plan-id="' + plan.id + '" data-meal-id="' + meal.id + '" style="border-left:3px solid ' + cardColor + ';">' +
            '<div class="kanban-card-title">' +
            meal.name + allergyWarning +
            '</div>' +
            '<div class="mb-2">' +
            '<span class="meal-tag ' + typeClass + '">' + mealTypeLabel + '</span>' +
            '<span class="badge-pink" style="margin-left:4px;">' + constitutionLabel + '</span>' +
            '</div>' +
            '<div class="kanban-card-meta">' +
            '<i class="bi bi-person"></i>' + plan.motherName +
            '<i class="bi bi-house-door ms-2"></i>' + plan.roomNumber +
            '</div>' +
            '<div class="kanban-card-meta mt-1" style="font-size:11px;">' +
            '<i class="bi bi-list-ul"></i>' + meal.ingredients.join('、') +
            '</div>' +
            meal.completedAt ?
                '<div class="kanban-card-meta mt-1" style="font-size:11px;color:var(--color-success);">' +
                '<i class="bi bi-clock"></i>送达时间：' + meal.completedAt +
                '</div>' : '' +
            '</div>';
    }

    function bindEvents() {
        $('#meal-type-filter').on('change', function () {
            $('.kanban-board').replaceWith(renderKanbanBoard());
            bindKanbanEvents();
        });

        $('#btn-diagnosis').on('click', function () {
            openDiagnosisModal();
        });

        bindKanbanEvents();
    }

    function bindKanbanEvents() {
        $('.kanban-card').on('click', function () {
            var planId = $(this).data('plan-id');
            var mealId = $(this).data('meal-id');
            handleMealCardClick(planId, mealId);
        });
    }

    function handleMealCardClick(planId, mealId) {
        var plan = mealPlans.find(function (p) { return p.id === planId; });
        if (!plan) return;
        var meal = plan.meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;

        if (plan.allergies && plan.allergies.length > 0) {
            var hasAllergy = false;
            meal.ingredients.forEach(function (ing) {
                plan.allergies.forEach(function (allergy) {
                    if (ing.indexOf(allergy) >= 0 || allergy.indexOf(ing) >= 0) {
                        hasAllergy = true;
                    }
                });
            });
            if (hasAllergy) {
                App.showToast('⚠️ 忌口拦截：餐品 "' + meal.name + '" 含产妇忌口食材！请更换餐品', 'danger');
                return;
            }
        }

        var nextStatus = meal.status === 'pending' ? 'cooking'
            : meal.status === 'cooking' ? 'delivered' : null;

        if (!nextStatus) {
            App.showToast('该餐品已送达', 'info');
            return;
        }

        var actionMsg = nextStatus === 'cooking' ? '开始制作' : '确认送达';

        if (nextStatus === 'delivered') {
            var now = new Date();
            meal.completedAt = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        }

        meal.status = nextStatus;
        Store.updateMealPlan(plan).then(function () {
            App.showToast('餐品"' + meal.name + '"已' + actionMsg + '！', 'success');
            renderPage();
        });
    }

    function openDiagnosisModal() {
        var checkedInMothers = mothers.filter(function (m) {
            var mdate = new Date(m.checkInDate);
            var tdate = new Date(today);
            return mdate <= tdate;
        });

        if (checkedInMothers.length === 0) {
            App.showToast('暂无可辨证的产妇', 'warning');
            return;
        }

        var html = '<div class="row g-3">' +
            '<div class="col-12">' +
            '<label class="form-label"><span class="text-danger">*</span> 选择产妇</label>' +
            '<select class="form-select" id="dg-mother">' +
            checkedInMothers.map(function (m) {
                return '<option value="' + m.id + '">' + m.name + ' - ' + m.roomNumber + '</option>';
            }).join('') +
            '</select>' +
            '</div>' +
            '<div class="col-12">' +
            '<label class="form-label"><span class="text-danger">*</span> 体质辨证</label>' +
            '<div class="row g-2">' +
            ['qi:气虚', 'blood:血虚', 'yin:阴虚', 'yang:阳虚'].map(function (c) {
                var parts = c.split(':');
                return '<div class="col-sm-6 col-6">' +
                    '<div class="form-check p-3 rounded" style="background:var(--color-primary-lighter);border:1px solid var(--color-border);">' +
                    '<input class="form-check-input" type="radio" name="dg-constitution" id="dg-' + parts[0] + '" value="' + parts[0] + '"' + (parts[0] === 'qi' ? ' checked' : '') + '>' +
                    '<label class="form-check-label" for="dg-' + parts[0] + '">' +
                    '<strong>' + parts[1] + '</strong><br><small class="text-muted">' + getConstitutionDesc(parts[0]) + '</small>' +
                    '</label></div></div>';
            }).join('') +
            '</div></div>' +
            '<div class="col-12">' +
            '<label class="form-label">忌口食材（可多选）</label>' +
            '<div class="d-flex flex-wrap gap-2">' +
            ['花生', '海鲜', '鸡蛋', '牛奶', '芒果', '辛辣', '生冷'].map(function (a) {
                return '<div class="form-check">' +
                    '<input class="form-check-input" type="checkbox" id="dg-allergy-' + a + '" value="' + a + '">' +
                    '<label class="form-check-label" for="dg-allergy-' + a + '">' + a + '</label>' +
                    '</div>';
            }).join('') +
            '</div></div></div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-submit-diagnosis"><i class="bi bi-check2 me-1"></i>确认辨证并生成食谱</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal(
            '产妇体质辨证',
            html,
            footerHtml,
            function () {
                $('#btn-submit-diagnosis').on('click', function () {
                    submitDiagnosis();
                });
            }
        );
    }

    function getConstitutionDesc(type) {
        var descs = {
            qi: '气短乏力、易出汗',
            blood: '面色苍白、头晕',
            yin: '口干舌燥、失眠',
            yang: '畏寒怕冷、手脚冰凉'
        };
        return descs[type] || '';
    }

    function submitDiagnosis() {
        var motherId = $('#dg-mother').val();
        var constitution = $('input[name="dg-constitution"]:checked').val();
        var allergies = [];
        $('input[id^="dg-allergy-"]:checked').each(function () { allergies.push($(this).val()); });

        if (!motherId || !constitution) {
            App.showToast('请完善辨证信息', 'warning');
            return;
        }

        var mother = mothers.find(function (m) { return m.id === motherId; });
        if (!mother) return;

        mother.constitution = constitution;
        mother.allergies = allergies;

        var existingPlan = mealPlans.find(function (p) { return p.motherId === motherId && p.date === today; });

        var mealItems = (DEFAULT_MEALS[constitution] || DEFAULT_MEALS.qi).map(function (m) {
            return {
                id: Store.generateId(),
                type: m.type,
                name: m.name,
                ingredients: m.ingredients,
                status: 'pending',
                scanCode: 'SC' + Store.generateId().toUpperCase().substr(0, 8),
                completedAt: ''
            };
        });

        if (existingPlan) {
            existingPlan.constitution = constitution;
            existingPlan.allergies = allergies;
            existingPlan.meals = mealItems;
            Store.updateMealPlan(existingPlan).then(function () {
                return Store.updateMother(mother);
            }).then(function () {
                App.closeModal();
                App.showToast('辨证完成，食谱已更新！', 'success');
                render();
            });
        } else {
            var newPlan = {
                id: Store.generateId(),
                motherId: motherId,
                motherName: mother.name,
                roomId: mother.roomId,
                roomNumber: mother.roomNumber,
                storeId: App.state.storeId,
                date: today,
                constitution: constitution,
                allergies: allergies,
                meals: mealItems
            };
            Store.addMealPlan(newPlan).then(function () {
                return Store.updateMother(mother);
            }).then(function () {
                App.closeModal();
                App.showToast('辨证完成，已生成今日食谱！', 'success');
                render();
            });
        }
    }

    return { render: render };
})();
