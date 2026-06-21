(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.components = App.components || {};

    function renderServicePanel(options) {
        options = options || {};
        var pet = options.pet;
        var historyServices = options.history || [];
        var types = App.store.getServiceTypes();
        var recommended = pet ? App.calculator.recommendPackages(pet, historyServices) : [];

        var typeHtml = '';
        types.forEach(function(t) {
            var priceInfo = pet ? App.calculator.estimatePriceByPet(t.id, pet) : { min: t.priceMin, max: t.priceMax, base: Math.round((t.priceMin + t.priceMax)/2) };
            typeHtml += '<div class="accordion-item service-item" data-type-id="' + t.id + '">' +
                '<h2 class="accordion-header">' +
                '<button class="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target="#type_' + t.id + '">' +
                '<span class="service-color-dot" style="background-color:' + t.color + '"></span>' +
                '<span class="fw-bold me-2">' + t.name + '</span>' +
                '<span class="badge bg-secondary-subtle text-secondary-emphasis me-2">预估 ' + t.duration + ' 分钟</span>' +
                '<span class="text-success fw-bold ms-auto">' +
                App.calculator.formatMoney(priceInfo.min) + ' ~ ' + App.calculator.formatMoney(priceInfo.max) +
                '</span>' +
                '</button>' +
                '</h2>' +
                '<div id="type_' + t.id + '" class="accordion-collapse collapse">' +
                '<div class="accordion-body p-3">' +
                '<div class="row g-3 align-items-center">' +
                '<div class="col-md-4">' +
                '<label class="form-label small text-muted mb-0">服务价格</label>' +
                '<div class="input-group input-group-sm">' +
                '<span class="input-group-text">¥</span>' +
                '<input type="number" class="form-control service-price-input" data-type="' + t.id + '" value="' + priceInfo.base + '" min="0" step="1">' +
                '</div>' +
                '<small class="text-muted d-block mt-1">基准价：' + App.calculator.formatMoney(priceInfo.base) +
                (pet && pet.weight ? '（按体重 ' + pet.weight + 'kg 估算）' : '') + '</small>' +
                '</div>' +
                '<div class="col-md-4">' +
                '<label class="form-label small text-muted mb-0">价格调整</label>' +
                '<div class="input-group input-group-sm">' +
                '<span class="input-group-text">±¥</span>' +
                '<input type="number" class="form-control service-adjust-input" data-type="' + t.id + '" value="0" step="1">' +
                '</div>' +
                '<small class="text-muted d-block mt-1">可根据实际情况上调或下调</small>' +
                '</div>' +
                '<div class="col-md-4 d-flex align-items-end">' +
                '<button class="btn btn-sm btn-outline-primary w-100 service-add-btn" data-type="' + t.id + '" data-category="' + t.category + '" data-name="' + t.name + '" data-color="' + t.color + '" data-duration="' + t.duration + '">' +
                '<i class="bi bi-plus-circle me-1"></i>添加此服务</button>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>';
        });

        var recHtml = '';
        if (recommended.length) {
            recHtml = '<div class="mb-4">' +
                '<h6 class="text-primary mb-3"><i class="bi bi-lightbulb me-2"></i>智能推荐套餐</h6>' +
                '<div class="row g-3">';
            recommended.forEach(function(pkg) {
                var saveAmount = pkg.originalPrice - pkg.discountPrice;
                recHtml += '<div class="col-md-4">' +
                    '<div class="card border-primary-subtle shadow-sm package-card transition-hover h-100" data-package-id="' + pkg.id + '">' +
                    '<div class="card-body p-3">' +
                    '<div class="d-flex justify-content-between align-items-start mb-2">' +
                    '<h6 class="fw-bold text-primary mb-0"><i class="bi bi-star-fill text-warning me-1"></i>' + pkg.name + '</h6>' +
                    '<span class="badge bg-danger">' + Math.round((1 - pkg.discount) * 100) + '% OFF</span>' +
                    '</div>' +
                    '<p class="small text-muted mb-2">' + pkg.desc + '</p>' +
                    '<div class="mb-2">' + pkg.services.map(function(s) {
                        return '<span class="badge bg-light text-dark me-1 mb-1">' + s + '</span>';
                    }).join('') + '</div>' +
                    '<div class="d-flex align-items-baseline gap-2 mb-2">' +
                    '<span class="text-decoration-line-through text-muted small">' + App.calculator.formatMoney(pkg.originalPrice) + '</span>' +
                    '<span class="text-success fw-bold fs-5">' + App.calculator.formatMoney(pkg.discountPrice) + '</span>' +
                    '<span class="text-success small">省' + App.calculator.formatMoney(saveAmount) + '</span>' +
                    '</div>' +
                    '<small class="text-muted d-block mb-2"><i class="bi bi-clock me-1"></i>总时长约 ' + App.calculator.formatMinutes(pkg.duration) + '</small>' +
                    '<button class="btn btn-sm btn-primary w-100 package-apply-btn" data-id="' + pkg.id + '" data-name="' + pkg.name + '">' +
                    '<i class="bi bi-check-circle me-1"></i>立即选用套餐</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
            });
            recHtml += '</div></div>';
        }

        return '<div id="servicePanel">' +
            recHtml +
            '<h6 class="mb-3"><i class="bi bi-list-check me-2"></i>单项服务选择</h6>' +
            '<div class="accordion" id="serviceTypesAccordion">' + typeHtml + '</div>' +
            '</div>';
    }

    function renderSelectedItems(selected) {
        selected = selected || { package: null, items: [] };
        var html = '';
        var calc = null;

        if (selected.package) {
            html += '<div class="card border-warning mb-3">' +
                '<div class="card-header bg-warning-subtle py-2 d-flex justify-content-between align-items-center">' +
                '<span class="fw-bold text-warning-emphasis"><i class="bi bi-gift me-1"></i>套餐：' + selected.package.name + '</span>' +
                '<button class="btn btn-sm btn-outline-danger remove-package-btn"><i class="bi bi-x-circle me-1"></i>移除</button>' +
                '</div></div>';
        }

        if (selected.items.length) {
            html += '<div class="list-group list-group-flush mb-3">';
            selected.items.forEach(function(item, idx) {
                html += '<div class="list-group-item d-flex align-items-center px-0">' +
                    '<span class="service-color-dot me-2" style="background-color:' + item.color + '"></span>' +
                    '<div class="flex-grow-1">' +
                    '<div class="fw-bold">' + item.name + '</div>' +
                    '<small class="text-muted">' + App.calculator.formatMinutes(item.duration) + ' · 单价' + App.calculator.formatMoney(item.price) + '</small>' +
                    '</div>' +
                    '<div class="fw-bold text-success me-3">' + App.calculator.formatMoney(item.subtotal) + '</div>' +
                    '<button class="btn btn-sm btn-outline-danger remove-item-btn" data-idx="' + idx + '">' +
                    '<i class="bi bi-trash"></i></button>' +
                    '</div>';
            });
            html += '</div>';
        }

        if (!selected.package && !selected.items.length) {
            html += '<div class="alert alert-secondary text-center py-4">' +
                '<i class="bi bi-bag-x fs-1 d-block text-muted mb-2"></i>' +
                '<span class="text-muted">请先从左侧选择服务项目</span></div>';
            return html;
        }

        return html;
    }

    function renderCheckoutSummary(calcResult) {
        if (!calcResult) return '';
        return '<div class="card bg-white border-0 shadow-sm">' +
            '<div class="card-body">' +
            '<div class="d-flex justify-content-between mb-2">' +
            '<span class="text-muted">商品小计</span>' +
            '<span>' + App.calculator.formatMoney(calcResult.subtotal) + '</span></div>';
        if (calcResult.packageApplied) {
            var x = calcResult.packageApplied;
            renderCheckoutSummary += '';
        }
        if (calcResult.memberDiscountAmount > 0) {
            var html = '<div class="d-flex justify-content-between mb-2 text-success"><span>' +
                '<i class="bi bi-person-vcard me-1"></i>' + calcResult.memberLevelName + '优惠</span>' +
                '<span>- ' + App.calculator.formatMoney(calcResult.memberDiscountAmount) + '</span></div>';
        } else {
            var html = '';
        }
        html += '<hr class="my-2">' +
            '<div class="d-flex justify-content-between align-items-baseline">' +
            '<span class="fw-bold">应付金额</span>' +
            '<span class="text-danger fs-4 fw-bold">' + App.calculator.formatMoney(calcResult.finalTotal) + '</span>' +
            '</div>' +
            '<small class="text-muted d-block text-end mt-1">' +
            '预计总时长：' + App.calculator.formatMinutes(calcResult.duration) +
            ' · 可得积分：<span class="text-primary fw-bold">' + calcResult.pointsEarned + '</span>' +
            '</small>' +
            '</div></div>';
        return html;
    }

    App.components.servicePanel = {
        render: renderServicePanel,
        renderSelectedItems: renderSelectedItems,
        renderCheckoutSummary: renderCheckoutSummary
    };

})(typeof window !== 'undefined' ? window : this);
