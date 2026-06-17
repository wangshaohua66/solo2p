const PackagePage = (function() {
    let currentPackage = null;
    let currentPackageItems = [];

    function render() {
        const html = `
            <div class="fade-in">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">服务套餐</h1>
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <button type="button" class="btn btn-primary" id="btnAddPackage">
                            <i class="bi bi-plus-circle me-1"></i>新增套餐
                        </button>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-4">
                                <input type="text" class="form-control" id="searchKeyword" placeholder="搜索套餐名称">
                            </div>
                            <div class="col-md-3">
                                <select class="form-select" id="filterType">
                                    <option value="">全部类型</option>
                                    <option value="standard">标准保养</option>
                                    <option value="seasonal">季节性套餐</option>
                                    <option value="member">会员专享</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <select class="form-select" id="filterStatus">
                                    <option value="">全部状态</option>
                                    <option value="true">启用中</option>
                                    <option value="false">已停用</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <button class="btn btn-outline-secondary w-100" id="btnResetSearch">
                                    <i class="bi bi-arrow-clockwise me-1"></i>重置
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3" id="packageGrid">
                </div>
            </div>

            <div class="modal fade" id="packageModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="packageModalTitle">新增套餐</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3 mb-4">
                                <div class="col-md-4">
                                    <label class="form-label">套餐名称 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="packageName" placeholder="请输入套餐名称">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">套餐类型 <span class="text-danger">*</span></label>
                                    <select class="form-select" id="packageType">
                                        <option value="standard">标准保养 (9折)</option>
                                        <option value="seasonal">季节性套餐 (8.5折)</option>
                                        <option value="member">会员专享 (8折)</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">自定义折扣</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="customDiscount" min="0.5" max="1" step="0.05" placeholder="留空用默认">
                                        <span class="input-group-text">折</span>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">状态</label>
                                    <select class="form-select" id="packageStatus">
                                        <option value="true">启用</option>
                                        <option value="false">停用</option>
                                    </select>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">套餐描述</label>
                                    <textarea class="form-control" id="packageDescription" rows="2" placeholder="请输入套餐描述、适用场景等"></textarea>
                                </div>
                            </div>

                            <div class="card mb-4">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0"><i class="bi bi-list-check me-2"></i>套餐项目</h6>
                                    <span class="badge bg-primary" id="packageItemCount">0 项</span>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-6">
                                            <div class="card h-100">
                                                <div class="card-header">
                                                    <ul class="nav nav-tabs card-header-tabs" id="pkgItemTabs">
                                                        <li class="nav-item">
                                                            <button class="nav-link active" data-category="maintenance">保养类 (12项)</button>
                                                        </li>
                                                        <li class="nav-item">
                                                            <button class="nav-link" data-category="repair">维修类 (25项)</button>
                                                        </li>
                                                        <li class="nav-item">
                                                            <button class="nav-link" data-category="beauty">美容类 (8项)</button>
                                                        </li>
                                                    </ul>
                                                </div>
                                                <div class="card-body p-2" style="max-height: 300px; overflow-y: auto;">
                                                    <div id="pkgServiceItemList">
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="card h-100">
                                                <div class="card-header d-flex justify-content-between align-items-center">
                                                    <h6 class="mb-0">已选项目</h6>
                                                    <button type="button" class="btn btn-sm btn-outline-danger" id="btnClearItems">
                                                        <i class="bi bi-x-circle me-1"></i>清空
                                                    </button>
                                                </div>
                                                <div class="card-body p-0" style="max-height: 300px; overflow-y: auto;">
                                                    <table class="table table-sm mb-0" id="pkgSelectedItemsTable">
                                                        <thead class="table-light sticky-top">
                                                            <tr>
                                                                <th>项目名称</th>
                                                                <th style="width: 80px;">工时费</th>
                                                                <th style="width: 80px;">材料费</th>
                                                                <th style="width: 40px;"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr>
                                                                <td colspan="4" class="text-center text-muted py-3">请从左侧选择服务项目</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0"><i class="bi bi-calculator me-2"></i>价格明细</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3 text-center">
                                        <div class="col-md-3">
                                            <small class="text-muted d-block">工时费合计</small>
                                            <h4 class="text-primary mb-0" id="pkgTotalLaborFee">¥0.00</h4>
                                        </div>
                                        <div class="col-md-3">
                                            <small class="text-muted d-block">材料费合计</small>
                                            <h4 class="text-info mb-0" id="pkgTotalMaterialFee">¥0.00</h4>
                                        </div>
                                        <div class="col-md-2">
                                            <small class="text-muted d-block">套餐折扣</small>
                                            <h4 class="text-warning mb-0" id="pkgDiscountText">9折</h4>
                                        </div>
                                        <div class="col-md-2">
                                            <small class="text-muted d-block">优惠金额</small>
                                            <h4 class="text-success mb-0" id="pkgDiscountAmount">¥0.00</h4>
                                        </div>
                                        <div class="col-md-2">
                                            <small class="text-muted d-block">套餐价</small>
                                            <h4 class="text-danger fw-bold mb-0" id="pkgActualPrice">¥0.00</h4>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="btnSavePackage">
                                <i class="bi bi-save me-1"></i>保存套餐
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#main-content').html(html);
        bindEvents();
        loadPackages();
    }

    function bindEvents() {
        $('#btnAddPackage').on('click', () => showModal());

        $('#searchKeyword').on('input', Helpers.debounce(function() {
            loadPackages();
        }, 300));

        $('#filterType, #filterStatus').on('change', function() {
            loadPackages();
        });

        $('#btnResetSearch').on('click', function() {
            $('#searchKeyword').val('');
            $('#filterType').val('');
            $('#filterStatus').val('');
            loadPackages();
        });

        $('#pkgItemTabs .nav-link').on('click', function() {
            $('#pkgItemTabs .nav-link').removeClass('active');
            $(this).addClass('active');
            loadPkgServiceItems($(this).data('category'));
        });

        $('#btnClearItems').on('click', function() {
            currentPackageItems = [];
            const activeTab = $('#pkgItemTabs .nav-link.active').data('category');
            loadPkgServiceItems(activeTab);
            updatePkgSelectedItems();
            updatePkgPrice();
        });

        $('#btnSavePackage').on('click', savePackage);

        $('#packageType').on('change', function() {
            updatePkgPrice();
        });

        $('#customDiscount').on('input', function() {
            updatePkgPrice();
        });
    }

    function showModal(packageId = null) {
        currentPackage = null;
        currentPackageItems = [];

        $('#packageModalTitle').text('新增套餐');
        $('#packageName').val('');
        $('#packageType').val('standard');
        $('#customDiscount').val('');
        $('#packageStatus').val('true');
        $('#packageDescription').val('');

        loadPkgServiceItems('maintenance');
        updatePkgSelectedItems();
        updatePkgPrice();

        if (packageId) {
            const pkg = PackageService.findById(packageId);
            if (pkg) {
                currentPackage = pkg;
                $('#packageModalTitle').text('编辑套餐');
                $('#packageName').val(pkg.name);
                $('#packageType').val(pkg.type);
                $('#customDiscount').val(pkg.discountRate && pkg.discountRate !== PackageService.DISCOUNT_RATES[pkg.type] ? pkg.discountRate : '');
                $('#packageStatus').val(pkg.isActive ? 'true' : 'false');
                $('#packageDescription').val(pkg.description || '');

                const items = DataStore.indexes.packageItems.byPackageId.get(packageId) || [];
                currentPackageItems = items.map(item => ({
                    ...item,
                    id: item.itemId,
                    name: item.itemName
                }));

                updatePkgSelectedItems();
                updatePkgPrice();
            }
        }

        const modal = new bootstrap.Modal(document.getElementById('packageModal'));
        modal.show();
    }

    function loadPkgServiceItems(category) {
        const serviceItems = Helpers.getServiceItems();
        const items = serviceItems[category] || [];

        const html = items.map(item => {
            const isSelected = currentPackageItems.some(i => i.itemId === item.id || i.id === item.id);
            return `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-2 ${isSelected ? 'active' : ''}"
                     onclick="PackagePage.togglePkgItem('${category}', '${item.id}')">
                    <div>
                        <div>${item.name}</div>
                        <small class="text-muted ${isSelected ? 'text-white-50' : ''}">
                            工时: ¥${item.laborFee} · 材料: ¥${item.materialFee}
                        </small>
                    </div>
                    <i class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-plus-circle'} ${isSelected ? 'text-white' : 'text-primary'}"></i>
                </div>
            `;
        }).join('');

        $('#pkgServiceItemList').html(html);
    }

    function togglePkgItem(category, itemId) {
        const serviceItems = Helpers.getServiceItems();
        const items = serviceItems[category] || [];
        const item = items.find(i => i.id === itemId);

        if (!item) return;

        const existingIndex = currentPackageItems.findIndex(i => i.itemId === itemId || i.id === itemId);

        if (existingIndex !== -1) {
            currentPackageItems.splice(existingIndex, 1);
        } else {
            currentPackageItems.push({
                ...item,
                category: category,
                itemId: item.id,
                itemName: item.name
            });
        }

        loadPkgServiceItems(category);
        updatePkgSelectedItems();
        updatePkgPrice();
    }

    function updatePkgSelectedItems() {
        const tbody = $('#pkgSelectedItemsTable tbody');
        $('#packageItemCount').text(currentPackageItems.length + ' 项');

        if (currentPackageItems.length === 0) {
            tbody.html('<tr><td colspan="4" class="text-center text-muted py-3">请从左侧选择服务项目</td></tr>');
            return;
        }

        tbody.html(currentPackageItems.map((item, index) => `
            <tr>
                <td>
                    <div class="fw-bold">${item.itemName || item.name}</div>
                    <small class="text-muted">${Helpers.getServiceCategoryText(item.category)}</small>
                </td>
                <td>¥${item.laborFee.toFixed(2)}</td>
                <td>¥${item.materialFee.toFixed(2)}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="PackagePage.removePkgItem(${index})">
                        <i class="bi bi-x"></i>
                    </button>
                </td>
            </tr>
        `).join(''));
    }

    function removePkgItem(index) {
        const item = currentPackageItems[index];
        currentPackageItems.splice(index, 1);

        if (item.category) {
            const activeTab = $('#pkgItemTabs .nav-link.active').data('category');
            if (activeTab === item.category) {
                loadPkgServiceItems(item.category);
            }
        }

        updatePkgSelectedItems();
        updatePkgPrice();
    }

    function updatePkgPrice() {
        const type = $('#packageType').val();
        const customDiscount = $('#customDiscount').val();

        let discountRate = PackageService.DISCOUNT_RATES[type] || 1;
        if (customDiscount) {
            discountRate = parseFloat(customDiscount) || discountRate;
        }

        $('#pkgDiscountText').text((discountRate * 10).toFixed(1) + '折');

        let totalLaborFee = 0;
        let totalMaterialFee = 0;

        currentPackageItems.forEach(item => {
            totalLaborFee += item.laborFee || 0;
            totalMaterialFee += item.materialFee || 0;
        });

        const originalPrice = totalLaborFee + totalMaterialFee;
        const discountAmount = originalPrice * (1 - discountRate);
        const actualPrice = originalPrice - discountAmount;

        $('#pkgTotalLaborFee').text(Helpers.formatCurrency(totalLaborFee));
        $('#pkgTotalMaterialFee').text(Helpers.formatCurrency(totalMaterialFee));
        $('#pkgDiscountAmount').text(Helpers.formatCurrency(discountAmount));
        $('#pkgActualPrice').text(Helpers.formatCurrency(actualPrice));
    }

    function savePackage() {
        const name = $('#packageName').val().trim();
        if (!name) {
            Helpers.showToast('请输入套餐名称', 'error');
            return;
        }

        if (currentPackageItems.length === 0) {
            Helpers.showToast('请至少选择一个服务项目', 'error');
            return;
        }

        const type = $('#packageType').val();
        const customDiscount = $('#customDiscount').val();
        const isActive = $('#packageStatus').val() === 'true';
        const description = $('#packageDescription').val().trim();

        let discountRate = PackageService.DISCOUNT_RATES[type];
        if (customDiscount) {
            discountRate = parseFloat(customDiscount) || discountRate;
        }

        try {
            Helpers.showLoading(true, '保存中...');

            const packageData = {
                name,
                type,
                discountRate,
                description,
                isActive
            };

            const items = currentPackageItems.map(item => ({
                id: item.itemId || item.id,
                name: item.itemName || item.name,
                category: item.category,
                laborFee: item.laborFee,
                materialFee: item.materialFee
            }));

            if (currentPackage) {
                PackageService.updatePackage(currentPackage.id, packageData, items);
                Helpers.showToast('套餐更新成功', 'success');
            } else {
                PackageService.createPackage(packageData, items);
                Helpers.showToast('套餐创建成功', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('packageModal')).hide();
            loadPackages();
        } catch (error) {
            Helpers.showToast(error.message, 'error');
        } finally {
            Helpers.showLoading(false);
        }
    }

    function loadPackages() {
        const keyword = $('#searchKeyword').val().trim().toLowerCase();
        const typeFilter = $('#filterType').val();
        const statusFilter = $('#filterStatus').val();

        let packages = PackageService.findAll();

        if (keyword) {
            packages = packages.filter(p => p.name.toLowerCase().includes(keyword));
        }

        if (typeFilter) {
            packages = packages.filter(p => p.type === typeFilter);
        }

        if (statusFilter !== '') {
            const isActive = statusFilter === 'true';
            packages = packages.filter(p => p.isActive === isActive);
        }

        renderPackageGrid(packages);
    }

    function renderPackageGrid(packages) {
        const grid = $('#packageGrid');

        if (packages.length === 0) {
            grid.html(`
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center py-5 text-muted">
                            <i class="bi bi-box-seam fs-1 d-block mb-3"></i>
                            <p class="mb-0">暂无套餐数据</p>
                        </div>
                    </div>
                </div>
            `);
            return;
        }

        grid.html(packages.map(pkg => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 ${!pkg.isActive ? 'opacity-50' : ''}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge ${pkg.type === 'standard' ? 'bg-primary' : pkg.type === 'seasonal' ? 'bg-info' : 'bg-warning'} me-2">
                                ${pkg.typeText}
                            </span>
                            <span class="badge ${pkg.isActive ? 'bg-success' : 'bg-secondary'}">
                                ${pkg.isActive ? '启用' : '停用'}
                            </span>
                        </div>
                        <small class="text-muted">${pkg.priceInfo.discountText}</small>
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">${pkg.name}</h5>
                        <p class="card-text small text-muted mb-3">${pkg.description || '暂无描述'}</p>
                        <div class="mb-3">
                            <small class="text-muted d-block mb-1">包含项目 (${pkg.items.length}项):</small>
                            <div class="d-flex flex-wrap gap-1">
                                ${pkg.items.slice(0, 4).map(item => `
                                    <span class="badge bg-light text-dark">${item.itemName || item.name}</span>
                                `).join('')}
                                ${pkg.items.length > 4 ? `<span class="badge bg-light text-dark">+${pkg.items.length - 4}项</span>` : ''}
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-decoration-line-through text-muted">${Helpers.formatCurrency(pkg.priceInfo.originalPrice)}</small>
                                <h4 class="text-danger fw-bold mb-0">${Helpers.formatCurrency(pkg.priceInfo.actualPrice)}</h4>
                            </div>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-outline-primary" onclick="PackagePage.edit('${pkg.id}')">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="PackagePage.remove('${pkg.id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join(''));
    }

    function edit(id) {
        showModal(id);
    }

    function remove(id) {
        Helpers.showConfirm('确定要删除该套餐吗？删除后无法恢复。', '确认删除').then(confirmed => {
            if (confirmed) {
                try {
                    PackageService.removePackage(id);
                    Helpers.showToast('删除成功', 'success');
                    loadPackages();
                } catch (error) {
                    Helpers.showToast(error.message, 'error');
                }
            }
        });
    }

    function init() {
        $(document).off('dataSynced.package').on('dataSynced.package', function(e, data) {
            if (data.key === 'packages') {
                loadPackages();
            }
        });
    }

    return {
        render,
        init,
        edit,
        remove,
        togglePkgItem,
        removePkgItem
    };
})();
