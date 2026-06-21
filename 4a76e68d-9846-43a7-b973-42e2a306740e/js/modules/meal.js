var Meal = window.Meal = (function () {
    var mealPlans = [];
    var mothers = [];
    var today = '';
    var scanVideoStream = null;
    var scanCanvas = null;
    var scanAnimationId = null;

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
        var actionsHtml = '<button class="btn btn-soft-pink" id="btn-scan-code"><i class="bi bi-qr-code-scan me-1"></i>扫码确认</button>' +
            ' <button class="btn btn-pink" id="btn-diagnosis"><i class="bi bi-clipboard2-pulse me-1"></i>体质辨证</button>';
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
            '<span class="badge-pink"><i class="bi bi-info-circle me-1"></i>点击卡片查看详情、二维码和扫码确认</span>' +
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

        return '<div class="kanban-card meal-card-clickable" data-plan-id="' + plan.id + '" data-meal-id="' + meal.id + '" style="border-left:3px solid ' + cardColor + ';">' +
            '<div class="kanban-card-title">' +
            meal.name + allergyWarning +
            '</div>' +
            '<div class="mb-2">' +
            '<span class="meal-tag ' + typeClass + '">' + mealTypeLabel + '</span>' +
            '<span class="badge-pink" style="margin-left:4px;">' + constitutionLabel + '</span>' +
            (meal.scanCode ? '<span class="badge bg-secondary" style="margin-left:4px;font-size:10px;"><i class="bi bi-qr-code"></i> ' + meal.scanCode + '</span>' : '') +
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

        $('#btn-scan-code').on('click', function () {
            openScanModal(null, null);
        });

        bindKanbanEvents();
    }

    function bindKanbanEvents() {
        $('.meal-card-clickable').off('click').on('click', function () {
            var planId = $(this).data('plan-id');
            var mealId = $(this).data('meal-id');
            openMealDetail(planId, mealId);
        });
    }

    function openMealDetail(planId, mealId) {
        var plan = mealPlans.find(function (p) { return p.id === planId; });
        if (!plan) return;
        var meal = plan.meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;

        var mealTypeLabel = Store.MEAL_TYPE_LABELS[meal.type] || meal.type;
        var constitutionLabel = CONSTITUTION_LABELS[plan.constitution] || plan.constitution;
        var statusLabel = STATUS_LABELS[meal.status] || meal.status;
        var statusBadge = meal.status === 'pending' ? '<span class="badge-yellow">待制作</span>'
            : meal.status === 'cooking' ? '<span class="badge bg-info text-white">制作中</span>'
            : '<span class="badge-green">已送达</span>';

        var hasAllergy = false;
        if (plan.allergies && plan.allergies.length > 0) {
            meal.ingredients.forEach(function (ing) {
                plan.allergies.forEach(function (allergy) {
                    if (ing.indexOf(allergy) >= 0 || allergy.indexOf(ing) >= 0) hasAllergy = true;
                });
            });
        }

        var scanCode = meal.scanCode || ('SC' + Store.generateId().toUpperCase().substr(0, 8));
        if (!meal.scanCode) meal.scanCode = scanCode;

        var bodyHtml = '';
        if (hasAllergy) {
            bodyHtml += '<div class="alert alert-danger d-flex align-items-center mb-3" style="border-radius:10px;">' +
                '<i class="bi bi-exclamation-triangle-fill me-2" style="font-size:20px;"></i>' +
                '<div><strong>忌口拦截</strong>：餐品含产妇忌口食材（' + plan.allergies.join('、') + '），请更换餐品！</div></div>';
        }

        bodyHtml += '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<div class="mb-2"><label class="form-label text-muted">餐品名称</label><div class="fw-medium fs-5 text-primary-pink">' + meal.name + '</div></div>' +
            '<div class="mb-2"><label class="form-label text-muted">餐次</label><div class="fw-medium">' + mealTypeLabel + '</div></div>' +
            '<div class="mb-2"><label class="form-label text-muted">体质方案</label><div class="fw-medium">' + constitutionLabel + '</div></div>' +
            '<div class="mb-2"><label class="form-label text-muted">食材</label><div class="fw-medium">' + meal.ingredients.join('、') + '</div></div>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<div class="mb-2"><label class="form-label text-muted">产妇</label><div class="fw-medium">' + plan.motherName + '</div></div>' +
            '<div class="mb-2"><label class="form-label text-muted">房间</label><div class="fw-medium">' + plan.roomNumber + '</div></div>' +
            '<div class="mb-2"><label class="form-label text-muted">状态</label><div class="fw-medium">' + statusBadge + '</div></div>' +
            (meal.completedAt ? '<div class="mb-2"><label class="form-label text-muted">送达时间</label><div class="fw-medium" style="color:var(--color-success);">' + meal.completedAt + '</div></div>' : '') +
            '</div></div>' +
            '<div class="divider-pink"></div>' +
            '<div class="row g-3 align-items-center">' +
            '<div class="col-md-6 text-center">' +
            '<label class="form-label fw-bold"><i class="bi bi-qr-code"></i> 餐品二维码</label>' +
            '<div id="qrcode-container" style="padding:10px;background:#fff;border:1px solid var(--color-border);border-radius:10px;display:inline-block;"></div>' +
            '<div class="mt-2 text-muted" style="font-size:12px;">编号：<span class="fw-bold text-primary-pink">' + scanCode + '</span></div>' +
            '<div class="mt-1" style="font-size:11px;color:#999;">扫码即可流转餐品状态</div>' +
            '</div>' +
            '<div class="col-md-6 text-center">' +
            '<p style="font-size:13px;" class="text-muted">扫码确认当前餐品状态流转：</p>' +
            '<div class="d-grid gap-2">' +
            (meal.status === 'pending' ?
                '<button class="btn btn-pink" id="btn-scan-this" data-plan-id="' + plan.id + '" data-meal-id="' + meal.id + '"><i class="bi bi-qr-code-scan me-1"></i>扫码 → 开始制作</button>' :
                meal.status === 'cooking' ?
                '<button class="btn btn-pink" id="btn-scan-this" data-plan-id="' + plan.id + '" data-meal-id="' + meal.id + '"><i class="bi bi-qr-code-scan me-1"></i>扫码 → 确认送达</button>' :
                '<button class="btn btn-outline-pink" disabled><i class="bi bi-check2 me-1"></i>已送达完成</button>') +
            '</div>' +
            (meal.status !== 'delivered' ? '<div class="mt-3"><small class="text-muted">或直接操作：</small><br>' +
                '<button class="btn btn-sm btn-soft-pink mt-2" id="btn-quick-next"><i class="bi bi-arrow-right-short"></i>' +
                (meal.status === 'pending' ? ' 标记为制作中' : ' 标记为已送达') + '</button></div>' : '') +
            '</div></div>';

        var footerHtml = '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';

        App.showGlobalModal('餐品详情 - ' + meal.name, bodyHtml, footerHtml, function () {
            try {
                if (window.QRCode) {
                    $('#qrcode-container').empty();
                    new QRCode(document.getElementById('qrcode-container'), {
                        text: JSON.stringify({ planId: plan.id, mealId: meal.id, scanCode: scanCode, type: 'meal' }),
                        width: 180,
                        height: 180,
                        colorDark: '#E891A8',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } else {
                    $('#qrcode-container').html('<div class="text-muted p-3">二维码库未加载</div>');
                }
            } catch (e) {
                $('#qrcode-container').html('<div class="text-muted p-3">二维码生成失败</div>');
            }

            $('#btn-scan-this').off('click').on('click', function () {
                var pid = $(this).data('plan-id');
                var mid = $(this).data('meal-id');
                App.closeModal();
                setTimeout(function () {
                    openScanModal(pid, mid);
                }, 200);
            });

            $('#btn-quick-next').off('click').on('click', function () {
                advanceMealStatus(plan.id, meal.id);
            });
        });
    }

    function openScanModal(targetPlanId, targetMealId) {
        stopScanCamera();

        var bodyHtml = '<div class="row g-3">' +
            '<div class="col-12">' +
            '<div class="alert alert-info" style="background:#e6f7ff;border:1px solid #91d5ff;border-radius:10px;font-size:13px;">' +
            '<i class="bi bi-camera me-1"></i>请将餐品二维码对准摄像头，系统将自动识别并流转状态。' +
            '</div></div>' +
            '<div class="col-12 text-center">' +
            '<div id="scan-video-wrapper" style="position:relative;max-width:400px;margin:0 auto;border:3px solid var(--color-primary);border-radius:12px;overflow:hidden;background:#000;">' +
            '<video id="scan-video" playsinline autoplay style="width:100%;display:block;"></video>' +
            '<canvas id="scan-canvas" style="display:none;"></canvas>' +
            '<div id="scan-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">' +
            '<div style="position:absolute;top:20%;left:10%;right:10%;bottom:20%;border:2px dashed #fff;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.3);"></div>' +
            '<div style="position:absolute;top:50%;left:0;right:0;text-align:center;color:#fff;transform:translateY(-50%);"><i class="bi bi-qr-code-scan" style="font-size:48px;opacity:0.8;"></i></div>' +
            '</div></div>' +
            '<div id="scan-status" class="mt-2 text-muted" style="font-size:13px;"><i class="bi bi-hourglass-split"></i>正在启动摄像头...</div>' +
            '</div>' +
            '<div class="col-12"><div class="divider-pink"></div>' +
            '<label class="form-label">或手动输入餐品编号 (SCXXXXXXXX)</label>' +
            '<div class="input-group">' +
            '<input type="text" class="form-control" id="manual-scan-code" placeholder="输入二维码编号，如 SC12345678">' +
            '<button class="btn btn-pink" id="btn-manual-scan">确认</button>' +
            '</div></div></div>';

        var footerHtml = '<button type="button" class="btn btn-outline-pink" id="btn-close-scan">关闭</button>';

        App.showGlobalModal('扫码确认餐品', bodyHtml, footerHtml, function () {
            startScanCamera(targetPlanId, targetMealId);

            $('#btn-close-scan').off('click').on('click', function () {
                stopScanCamera();
                App.closeModal();
            });

            $('#btn-manual-scan').off('click').on('click', function () {
                var code = $('#manual-scan-code').val().trim().toUpperCase();
                if (!code) { App.showToast('请输入餐品编号', 'warning'); return; }
                handleScanResultByCode(code, targetPlanId, targetMealId);
            });
        });
    }

    function startScanCamera(targetPlanId, targetMealId) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('#scan-status').html('<span style="color:#cf1322;"><i class="bi bi-x-circle me-1"></i>当前浏览器不支持摄像头，请手动输入编号</span>');
            return;
        }

        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
            scanVideoStream = stream;
            var video = document.getElementById('scan-video');
            if (video) {
                video.srcObject = stream;
                video.setAttribute('playsinline', true);
                video.play().then(function () {
                    $('#scan-status').html('<span style="color:var(--color-success);"><i class="bi bi-check-circle me-1"></i>摄像头已启动，请将二维码对准扫描框</span>');
                    scanCanvas = document.getElementById('scan-canvas');
                    tickScan(targetPlanId, targetMealId);
                }).catch(function () {
                    $('#scan-status').html('<span style="color:#cf1322;"><i class="bi bi-x-circle me-1"></i>视频启动失败，请手动输入编号</span>');
                });
            }
        }).catch(function (err) {
            console.warn('摄像头访问失败:', err);
            $('#scan-status').html('<span style="color:#d48806;"><i class="bi bi-exclamation-triangle me-1"></i>无法访问摄像头（' + (err.message || '用户拒绝') + '），请手动输入编号</span>');
        });
    }

    function stopScanCamera() {
        if (scanAnimationId) {
            cancelAnimationFrame(scanAnimationId);
            scanAnimationId = null;
        }
        if (scanVideoStream) {
            scanVideoStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
            scanVideoStream = null;
        }
        scanCanvas = null;
    }

    function tickScan(targetPlanId, targetMealId) {
        var video = document.getElementById('scan-video');
        if (!video || !scanCanvas) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            scanCanvas.height = video.videoHeight;
            scanCanvas.width = video.videoWidth;
            var ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
            var imageData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
            try {
                if (window.jsQR) {
                    var code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                    if (code && code.data) {
                        stopScanCamera();
                        handleScanResult(code.data, targetPlanId, targetMealId);
                        return;
                    }
                }
            } catch (e) { console.warn(e); }
        }
        scanAnimationId = requestAnimationFrame(function () { tickScan(targetPlanId, targetMealId); });
    }

    function handleScanResult(data, targetPlanId, targetMealId) {
        var payload = null;
        try {
            payload = JSON.parse(data);
        } catch (e) {
            payload = { scanCode: data };
        }
        if (payload && payload.scanCode) {
            handleScanResultByCode(payload.scanCode, payload.planId || targetPlanId, payload.mealId || targetMealId);
        } else {
            App.showToast('无法识别的二维码内容', 'danger');
            setTimeout(function () {
                startScanCamera(targetPlanId, targetMealId);
            }, 1500);
        }
    }

    function handleScanResultByCode(scanCode, planId, mealId) {
        var foundPlan = null;
        var foundMeal = null;
        scanCode = String(scanCode).toUpperCase();

        if (planId && mealId) {
            foundPlan = mealPlans.find(function (p) { return p.id === planId; });
            if (foundPlan) foundMeal = foundPlan.meals.find(function (m) { return m.id === mealId; });
        }
        if (!foundMeal) {
            for (var i = 0; i < mealPlans.length; i++) {
                var m = mealPlans[i].meals.find(function (mm) { return mm.scanCode && mm.scanCode.toUpperCase() === scanCode; });
                if (m) { foundPlan = mealPlans[i]; foundMeal = m; break; }
            }
        }
        if (!foundMeal) {
            App.showToast('未找到对应餐品（编号：' + scanCode + '）', 'danger');
            if (scanVideoStream) setTimeout(function () { startScanCamera(planId, mealId); }, 1500);
            return;
        }

        $('#scan-status').html('<span style="color:var(--color-success);"><i class="bi bi-check-circle me-1"></i>识别成功：' + foundMeal.name + '，正在流转状态...</span>');

        setTimeout(function () {
            advanceMealStatus(foundPlan.id, foundMeal.id, true);
        }, 600);
    }

    function advanceMealStatus(planId, mealId, fromScan) {
        var plan = mealPlans.find(function (p) { return p.id === planId; });
        if (!plan) return;
        var meal = plan.meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;

        if (plan.allergies && plan.allergies.length > 0 && meal.status !== 'delivered') {
            var hasAllergy = false;
            meal.ingredients.forEach(function (ing) {
                plan.allergies.forEach(function (allergy) {
                    if (ing.indexOf(allergy) >= 0 || allergy.indexOf(ing) >= 0) hasAllergy = true;
                });
            });
            if (hasAllergy) {
                App.showToast('⚠️ 忌口拦截：餐品 "' + meal.name + '" 含产妇忌口食材！无法流转', 'danger');
                return;
            }
        }

        var nextStatus = meal.status === 'pending' ? 'cooking'
            : meal.status === 'cooking' ? 'delivered' : null;
        if (!nextStatus) { App.showToast('该餐品已送达完成', 'info'); return; }

        var actionMsg = nextStatus === 'cooking' ? '开始制作' : '确认送达';
        if (nextStatus === 'delivered') {
            var now = new Date();
            meal.completedAt = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        }
        meal.status = nextStatus;
        if (!meal.scanCode) meal.scanCode = 'SC' + Store.generateId().toUpperCase().substr(0, 8);

        Store.updateMealPlan(plan).then(function () {
            stopScanCamera();
            App.showToast((fromScan ? '[扫码] ' : '') + '餐品"' + meal.name + '"已' + actionMsg + '！', 'success');
            App.closeModal();
            render();
        }).catch(function () {
            App.showToast('状态更新失败', 'danger');
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
