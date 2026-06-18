const OrderPage = (function() {
    let currentOrderItems = [];
    let selectedVehicle = null;
    let selectedMember = null;
    let currentOrder = null;

    function render() {
        const html = `
            <div class="fade-in">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">工单管理</h1>
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <button type="button" class="btn btn-primary" id="btnAddOrder">
                            <i class="bi bi-plus-circle me-1"></i>新建工单
                        </button>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-3">
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                                    <input type="text" class="form-control" id="searchKeyword" placeholder="搜索工单编号、车牌号、车主">
                                </div>
                            </div>
                            <div class="col-md-2">
                                <select class="form-select" id="filterStatus">
                                    <option value="">全部状态</option>
                                    <option value="pending">待接车</option>
                                    <option value="repairing">维修中</option>
                                    <option value="settlement">待结算</option>
                                    <option value="completed">已完成</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <input type="text" class="form-control datepicker" id="startDate" placeholder="开始日期">
                            </div>
                            <div class="col-md-2">
                                <input type="text" class="form-control datepicker" id="endDate" placeholder="结束日期">
                            </div>
                            <div class="col-md-2">
                                <button class="btn btn-outline-secondary w-100" id="btnResetSearch">
                                    <i class="bi bi-arrow-clockwise me-1"></i>重置
                                </button>
                            </div>
                            <div class="col-md-1">
                                <button class="btn btn-outline-success w-100" id="btnExport">
                                    <i class="bi bi-download"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>工单编号</th>
                                        <th>车牌号</th>
                                        <th>车主</th>
                                        <th>服务项目</th>
                                        <th>金额</th>
                                        <th>状态</th>
                                        <th>操作人</th>
                                        <th>创建时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="orderTableBody">
                                    <tr>
                                        <td colspan="9" class="text-center py-4 text-muted">加载中...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <nav class="p-3 border-top">
                            <ul class="pagination justify-content-center mb-0" id="pagination">
                            </ul>
                        </nav>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="orderModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="orderModalTitle">新建工单</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3 mb-4">
                                <div class="col-md-8">
                                    <div class="card h-100">
                                        <div class="card-header d-flex justify-content-between align-items-center">
                                            <h6 class="mb-0"><i class="bi bi-car-front me-2"></i>车辆信息</h6>
                                            <button type="button" class="btn btn-sm btn-outline-primary" id="btnSelectVehicle">
                                                <i class="bi bi-search me-1"></i>选择车辆
                                            </button>
                                        </div>
                                        <div class="card-body" id="vehicleInfoSection">
                                            <div class="text-center text-muted py-4">
                                                <i class="bi bi-car-front fs-1 d-block mb-2"></i>
                                                <p class="mb-0">请先选择车辆</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card h-100">
                                        <div class="card-header d-flex justify-content-between align-items-center">
                                            <h6 class="mb-0"><i class="bi bi-person me-2"></i>会员信息</h6>
                                            <button type="button" class="btn btn-sm btn-outline-primary" id="btnSelectMember">
                                                <i class="bi bi-search me-1"></i>选择会员
                                            </button>
                                        </div>
                                        <div class="card-body" id="memberInfoSection">
                                            <div class="text-center text-muted py-4">
                                                <i class="bi bi-person fs-1 d-block mb-2"></i>
                                                <p class="mb-0">非会员</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="row g-3 mb-4">
                                <div class="col-md-4">
                                    <div class="card h-100">
                                        <div class="card-header">
                                            <h6 class="mb-0"><i class="bi bi-box-seam me-2"></i>服务套餐</h6>
                                        </div>
                                        <div class="card-body p-2" style="max-height: 300px; overflow-y: auto;">
                                            <div id="packageList">
                                                <div class="text-center text-muted py-3">
                                                    <div class="spinner-border spinner-border-sm"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card h-100">
                                        <div class="card-header">
                                            <ul class="nav nav-tabs card-header-tabs" id="serviceItemTabs">
                                                <li class="nav-item">
                                                    <button class="nav-link active" data-category="maintenance">保养类</button>
                                                </li>
                                                <li class="nav-item">
                                                    <button class="nav-link" data-category="repair">维修类</button>
                                                </li>
                                                <li class="nav-item">
                                                    <button class="nav-link" data-category="beauty">美容类</button>
                                                </li>
                                            </ul>
                                        </div>
                                        <div class="card-body p-2" style="max-height: 300px; overflow-y: auto;">
                                            <div id="serviceItemList">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card h-100">
                                        <div class="card-header d-flex justify-content-between align-items-center">
                                            <h6 class="mb-0"><i class="bi bi-cart-check me-2"></i>已选项目</h6>
                                            <span class="badge bg-primary" id="selectedCount">0 项</span>
                                        </div>
                                        <div class="card-body p-0" style="max-height: 300px; overflow-y: auto;">
                                            <table class="table table-sm mb-0" id="selectedItemsTable">
                                                <thead class="table-light sticky-top">
                                                    <tr>
                                                        <th>项目</th>
                                                        <th style="width: 60px;">数量</th>
                                                        <th style="width: 70px;">折扣</th>
                                                        <th style="width: 80px;">小计</th>
                                                        <th style="width: 40px;"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td colspan="5" class="text-center text-muted py-3">暂无项目</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card mb-4">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0"><i class="bi bi-calculator me-2"></i>费用明细</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-3">
                                            <div class="text-center">
                                                <small class="text-muted d-block">工时费合计</small>
                                                <h4 class="text-primary mb-0" id="totalLaborFee">¥0.00</h4>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="text-center">
                                                <small class="text-muted d-block">材料费合计</small>
                                                <h4 class="text-info mb-0" id="totalMaterialFee">¥0.00</h4>
                                            </div>
                                        </div>
                                        <div class="col-md-2">
                                            <div class="text-center">
                                                <small class="text-muted d-block">优惠金额</small>
                                                <h4 class="text-success mb-0" id="discountAmount">¥0.00</h4>
                                            </div>
                                        </div>
                                        <div class="col-md-2">
                                            <div class="text-center">
                                                <small class="text-muted d-block">应收金额</small>
                                                <h4 class="text-danger fw-bold mb-0" id="actualAmount">¥0.00</h4>
                                            </div>
                                        </div>
                                        <div class="col-md-2">
                                            <label class="form-label small text-muted">支付方式</label>
                                            <select class="form-select" id="paymentMethod">
                                                <option value="cash">现金</option>
                                                <option value="wechat">微信</option>
                                                <option value="alipay">支付宝</option>
                                                <option value="card">刷卡</option>
                                                <option value="prepaid">储值卡</option>
                                                <option value="count">次卡</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <label class="form-label">服务备注</label>
                                        <textarea class="form-control" id="orderRemark" rows="2" placeholder="客户需求、特殊说明等"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="btnSaveOrder">
                                <i class="bi bi-save me-1"></i>保存工单
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="orderDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">工单详情</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="orderDetailContent">
                        </div>
                        <div class="modal-footer" id="orderDetailFooter">
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="vehicleSelectModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">选择车辆</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="input-group mb-3">
                                <span class="input-group-text"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control" id="vehicleSearchInput" placeholder="输入车牌号、车主姓名或手机号搜索">
                            </div>
                            <div style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-hover">
                                    <thead class="table-light sticky-top">
                                        <tr>
                                            <th>车牌号</th>
                                            <th>车型</th>
                                            <th>车主</th>
                                            <th>联系电话</th>
                                            <th>里程</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody id="vehicleSelectTableBody">
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="memberSelectModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">选择会员</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="input-group mb-3">
                                <span class="input-group-text"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control" id="memberSearchInput" placeholder="输入会员姓名、手机号或卡号搜索">
                            </div>
                            <div style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-hover">
                                    <thead class="table-light sticky-top">
                                        <tr>
                                            <th>会员卡号</th>
                                            <th>姓名</th>
                                            <th>卡类型</th>
                                            <th>余额/次数</th>
                                            <th>积分</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody id="memberSelectTableBody">
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#main-content').html(html);
        initDatePicker();
        bindEvents();
        loadOrders();
        checkUrlParams();
    }

    function checkUrlParams() {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.split('?')[1] || '');
        const action = params.get('action');
        const vehicleId = params.get('vehicleId');
        const status = params.get('status');

        if (status) {
            $('#filterStatus').val(status);
            loadOrders();
        }

        if (action === 'create') {
            if (vehicleId) {
                const vehicle = VehicleService.findById(vehicleId);
                if (vehicle) {
                    showModal();
                    selectVehicle(vehicle);
                } else {
                    showModal();
                }
            } else {
                showModal();
            }
            history.replaceState(null, '', window.location.pathname + '#/order');
        }
    }

    function initDatePicker() {
        $('.datepicker').datepicker({
            format: 'yyyy-mm-dd',
            autoclose: true,
            todayHighlight: true,
            language: 'zh-CN'
        });
    }

    function bindEvents() {
        $('#btnAddOrder').on('click', () => showModal());

        $('#searchKeyword').on('input', Helpers.debounce(function() {
            loadOrders();
        }, 300));

        $('#filterStatus').on('change', function() {
            loadOrders();
        });

        $('#startDate, #endDate').on('change', function() {
            loadOrders();
        });

        $('#btnResetSearch').on('click', function() {
            $('#searchKeyword').val('');
            $('#filterStatus').val('');
            $('#startDate').val('');
            $('#endDate').val('');
            loadOrders();
        });

        $('#btnExport').on('click', function() {
            const orders = getFilteredOrders();
            const exportData = orders.map(order => ({
                工单编号: order.id,
                车牌号: order.vehicle ? order.vehicle.plateNo : '-',
                车主: order.vehicle ? order.vehicle.ownerName : '-',
                服务项目: order.items ? order.items.map(i => i.itemName).join('、') : '-',
                工时费: order.totalLaborFee,
                材料费: order.totalMaterialFee,
                优惠金额: order.discountAmount,
                实收金额: order.actualAmount,
                状态: Helpers.getStatusText(order.status),
                操作人: order.operator,
                创建时间: Helpers.formatDateTime(order.createdAt)
            }));
            Helpers.downloadCSV(exportData, '工单列表');
        });

        $('#serviceItemTabs .nav-link').on('click', function() {
            $('#serviceItemTabs .nav-link').removeClass('active');
            $(this).addClass('active');
            loadServiceItems($(this).data('category'));
        });

        $('#btnSelectVehicle').on('click', function() {
            showVehicleSelectModal();
        });

        $('#btnSelectMember').on('click', function() {
            showMemberSelectModal();
        });

        $('#vehicleSearchInput').on('input', Helpers.debounce(function() {
            loadVehicleSelectList($(this).val());
        }, 200));

        $('#memberSearchInput').on('input', Helpers.debounce(function() {
            loadMemberSelectList($(this).val());
        }, 200));

        $('#btnSaveOrder').on('click', saveOrder);
    }

    function showModal() {
        currentOrderItems = [];
        selectedVehicle = null;
        selectedMember = null;
        currentOrder = null;

        $('#orderModalTitle').text('新建工单');
        $('#vehicleInfoSection').html(`
            <div class="text-center text-muted py-4">
                <i class="bi bi-car-front fs-1 d-block mb-2"></i>
                <p class="mb-0">请先选择车辆</p>
            </div>
        `);
        $('#memberInfoSection').html(`
            <div class="text-center text-muted py-4">
                <i class="bi bi-person fs-1 d-block mb-2"></i>
                <p class="mb-0">非会员</p>
            </div>
        `);
        $('#orderRemark').val('');
        $('#paymentMethod').val('cash');

        loadPackages();
        loadServiceItems('maintenance');
        updateSelectedItems();
        updateAmounts();

        const modal = new bootstrap.Modal(document.getElementById('orderModal'));
        modal.show();
    }

    function loadPackages() {
        const packages = PackageService.findAll({ isActive: true });
        const html = packages.map(pkg => `
            <div class="card mb-2 cursor-pointer package-card" data-package-id="${pkg.id}" onclick="OrderPage.selectPackage('${pkg.id}')">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${pkg.name}</h6>
                            <small class="text-muted">${pkg.typeText} · ${pkg.priceInfo.discountText}</small>
                            <p class="mb-0 small mt-1">${pkg.items.length} 项服务</p>
                        </div>
                        <div class="text-end">
                            <div class="text-decoration-line-through text-muted small">${Helpers.formatCurrency(pkg.priceInfo.originalPrice)}</div>
                            <div class="text-primary fw-bold">${Helpers.formatCurrency(pkg.priceInfo.actualPrice)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        $('#packageList').html(html || '<div class="text-center text-muted py-3">暂无套餐</div>');
    }

    function selectPackage(packageId) {
        const priceInfo = PackageService.calculatePackagePrice(packageId);

        priceInfo.items.forEach(item => {
            const existingIndex = currentOrderItems.findIndex(i => i.itemId === item.itemId || i.id === item.id);
            if (existingIndex === -1) {
                currentOrderItems.push({
                    ...item,
                    id: item.itemId || item.id,
                    itemId: item.itemId || item.id,
                    itemName: item.itemName || item.name,
                    quantity: item.quantity || 1,
                    discount: priceInfo.discountRate,
                    fromPackage: true,
                    packageName: priceInfo.packageName
                });
            }
        });

        Helpers.showToast(`已添加套餐: ${priceInfo.packageName}`, 'success');
        updateSelectedItems();
        updateAmounts();
    }

    function loadServiceItems(category) {
        const serviceItems = Helpers.getServiceItems();
        const items = serviceItems[category] || [];

        const html = items.map(item => {
            const isSelected = currentOrderItems.some(i => i.id === item.id || i.itemId === item.id);
            return `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-2 ${isSelected ? 'active' : ''}"
                     onclick="OrderPage.toggleServiceItem('${category}', '${item.id}')">
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

        $('#serviceItemList').html(html);
    }

    function toggleServiceItem(category, itemId) {
        const serviceItems = Helpers.getServiceItems();
        const items = serviceItems[category] || [];
        const item = items.find(i => i.id === itemId);

        if (!item) return;

        const existingIndex = currentOrderItems.findIndex(i => i.id === itemId || i.itemId === itemId);

        if (existingIndex !== -1) {
            currentOrderItems.splice(existingIndex, 1);
        } else {
            currentOrderItems.push({
                ...item,
                category: category,
                itemId: item.id,
                itemName: item.name,
                quantity: item.defaultQty || 1,
                discount: 1
            });
        }

        loadServiceItems(category);
        updateSelectedItems();
        updateAmounts();
    }

    function updateSelectedItems() {
        const tbody = $('#selectedItemsTable tbody');
        $('#selectedCount').text(currentOrderItems.length + ' 项');

        if (currentOrderItems.length === 0) {
            tbody.html('<tr><td colspan="5" class="text-center text-muted py-3">暂无项目</td></tr>');
            return;
        }

        tbody.html(currentOrderItems.map((item, index) => {
            const laborFee = item.laborFee * item.quantity;
            const materialFee = item.materialFee * item.quantity;
            const subtotal = (laborFee + materialFee) * item.discount;
            const discountPercent = (item.discount * 10).toFixed(1);

            return `
                <tr>
                    <td>
                        <div class="fw-bold">${item.itemName}</div>
                        ${item.fromPackage ? `<small class="text-info">${item.packageName}</small>` : ''}
                        <div class="small text-muted">
                            工时: ¥${item.laborFee.toFixed(2)} · 材料: ¥${item.materialFee.toFixed(2)}
                        </div>
                    </td>
                    <td>
                        <input type="number" class="form-control form-control-sm" value="${item.quantity}" min="1"
                               onchange="OrderPage.updateItemQuantity(${index}, this.value)">
                    </td>
                    <td>
                        <select class="form-select form-select-sm" onchange="OrderPage.updateItemDiscount(${index}, this.value)">
                            <option value="1" ${item.discount === 1 ? 'selected' : ''}>无折</option>
                            <option value="0.95" ${item.discount === 0.95 ? 'selected' : ''}>9.5折</option>
                            <option value="0.9" ${item.discount === 0.9 ? 'selected' : ''}>9折</option>
                            <option value="0.85" ${item.discount === 0.85 ? 'selected' : ''}>8.5折</option>
                            <option value="0.8" ${item.discount === 0.8 ? 'selected' : ''}>8折</option>
                            <option value="0.7" ${item.discount === 0.7 ? 'selected' : ''}>7折</option>
                        </select>
                    </td>
                    <td class="fw-bold text-primary">¥${subtotal.toFixed(2)}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="OrderPage.removeItem(${index})">
                            <i class="bi bi-x"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join(''));
    }

    function updateItemQuantity(index, value) {
        const qty = parseInt(value, 10) || 1;
        currentOrderItems[index].quantity = Math.max(1, qty);
        updateSelectedItems();
        updateAmounts();
    }

    function updateItemDiscount(index, value) {
        currentOrderItems[index].discount = parseFloat(value) || 1;
        updateSelectedItems();
        updateAmounts();
    }

    function removeItem(index) {
        const item = currentOrderItems[index];
        currentOrderItems.splice(index, 1);

        if (item.category) {
            const activeTab = $('#serviceItemTabs .nav-link.active').data('category');
            if (activeTab === item.category) {
                loadServiceItems(item.category);
            }
        }

        updateSelectedItems();
        updateAmounts();
    }

    function updateAmounts() {
        const amounts = OrderService.calculateAmount(currentOrderItems);
        $('#totalLaborFee').text(Helpers.formatCurrency(amounts.totalLaborFee));
        $('#totalMaterialFee').text(Helpers.formatCurrency(amounts.totalMaterialFee));
        $('#discountAmount').text(Helpers.formatCurrency(amounts.discountAmount));
        $('#actualAmount').text(Helpers.formatCurrency(amounts.actualAmount));
    }

    function showVehicleSelectModal() {
        loadVehicleSelectList('');
        const modal = new bootstrap.Modal(document.getElementById('vehicleSelectModal'));
        modal.show();
    }

    function loadVehicleSelectList(keyword) {
        let vehicles = VehicleService.findAll();

        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            vehicles = vehicles.filter(v =>
                v.plateNo.toLowerCase().includes(lowerKeyword) ||
                (v.ownerName && v.ownerName.toLowerCase().includes(lowerKeyword)) ||
                (v.ownerPhone && v.ownerPhone.includes(keyword))
            );
        }

        const tbody = $('#vehicleSelectTableBody');
        if (vehicles.length === 0) {
            tbody.html('<tr><td colspan="6" class="text-center text-muted py-4">暂无车辆数据</td></tr>');
            return;
        }

        tbody.html(vehicles.slice(0, 50).map(vehicle => `
            <tr>
                <td class="fw-bold text-primary">${vehicle.plateNo}</td>
                <td>${vehicle.brand} ${vehicle.series} ${vehicle.model}</td>
                <td>${vehicle.ownerName}</td>
                <td>${vehicle.ownerPhone}</td>
                <td>${vehicle.mileage.toLocaleString()} km</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="OrderPage.selectVehicleById('${vehicle.id}')">
                        选择
                    </button>
                </td>
            </tr>
        `).join(''));
    }

    function selectVehicleById(vehicleId) {
        const vehicle = VehicleService.findById(vehicleId);
        if (vehicle) {
            selectVehicle(vehicle);
            bootstrap.Modal.getInstance(document.getElementById('vehicleSelectModal')).hide();
        }
    }

    function selectVehicle(vehicle) {
        selectedVehicle = vehicle;

        const lastService = VehicleService.getLastService(vehicle.id);
        const lastServiceText = lastService
            ? `上次服务: ${Helpers.formatDate(lastService.date, 'YYYY-MM-DD')} · ${lastService.items.join('、')}`
            : '暂无服务记录';

        $('#vehicleInfoSection').html(`
            <div class="row g-2">
                <div class="col-12">
                    <h5 class="mb-0">
                        <span class="text-primary fw-bold">${vehicle.plateNo}</span>
                        ${vehicle.vin ? `<small class="text-muted ms-2">${vehicle.vin}</small>` : ''}
                    </h5>
                    <p class="mb-1">${vehicle.brand} ${vehicle.series} ${vehicle.model}</p>
                </div>
                <div class="col-6">
                    <small class="text-muted d-block">车主</small>
                    <div>${vehicle.ownerName}</div>
                </div>
                <div class="col-6">
                    <small class="text-muted d-block">联系电话</small>
                    <div>${vehicle.ownerPhone}</div>
                </div>
                <div class="col-6">
                    <small class="text-muted d-block">当前里程</small>
                    <div>${vehicle.mileage.toLocaleString()} km</div>
                </div>
                <div class="col-12">
                    <div class="alert alert-info py-2 px-3 mb-0">
                        <small><i class="bi bi-info-circle me-1"></i>${lastServiceText}</small>
                    </div>
                </div>
            </div>
        `);
    }

    function showMemberSelectModal() {
        loadMemberSelectList('');
        const modal = new bootstrap.Modal(document.getElementById('memberSelectModal'));
        modal.show();
    }

    function loadMemberSelectList(keyword) {
        let members = MemberService.findAll();

        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            members = members.filter(m =>
                (m.name && m.name.toLowerCase().includes(lowerKeyword)) ||
                (m.phone && m.phone.includes(keyword)) ||
                (m.cardNo && m.cardNo.toLowerCase().includes(lowerKeyword))
            );
        }

        const tbody = $('#memberSelectTableBody');
        if (members.length === 0) {
            tbody.html('<tr><td colspan="6" class="text-center text-muted py-4">暂无会员数据</td></tr>');
            return;
        }

        tbody.html(members.slice(0, 50).map(member => {
            let balanceText = '';
            if (member.cardType === 'prepaid') {
                balanceText = `余额: ${Helpers.formatCurrency(member.balance || 0)}`;
            } else if (member.cardType === 'count') {
                balanceText = `剩余: ${member.remainingTimes || 0} 次`;
            } else if (member.cardType === 'year') {
                balanceText = member.expiryDate ? `有效期至: ${member.expiryDate}` : '年卡';
            }

            return `
                <tr>
                    <td>${member.cardNo || '-'}</td>
                    <td>${member.name}</td>
                    <td><span class="${Helpers.getMemberCardTypeClass(member.cardType)}">${Helpers.getMemberCardTypeText(member.cardType)}</span></td>
                    <td>${balanceText}</td>
                    <td>${member.points || 0} 分</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="OrderPage.selectMemberById('${member.id}')">
                            选择
                        </button>
                    </td>
                </tr>
            `;
        }).join(''));
    }

    function selectMemberById(memberId) {
        const member = MemberService.findById(memberId);
        if (member) {
            selectMember(member);
            bootstrap.Modal.getInstance(document.getElementById('memberSelectModal')).hide();
        }
    }

    function selectMember(member) {
        selectedMember = member;

        let cardInfo = '';
        let alertClass = 'alert-info';

        if (member.cardType === 'prepaid') {
            const balance = member.balance || 0;
            cardInfo = `储值余额: ${Helpers.formatCurrency(balance)}`;
            if (balance < 100) {
                alertClass = 'alert-warning';
                cardInfo += ' (余额不足100元)';
            }
        } else if (member.cardType === 'count') {
            cardInfo = `剩余次数: ${member.remainingTimes || 0} 次`;
        } else if (member.cardType === 'year') {
            if (member.expiryDate) {
                const expiryDate = new Date(member.expiryDate);
                const now = new Date();
                const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                cardInfo = `有效期至: ${member.expiryDate}`;
                if (daysLeft <= 30) {
                    alertClass = 'alert-warning';
                    cardInfo += ` (剩余${daysLeft}天)`;
                }
            }
        }

        $('#memberInfoSection').html(`
            <div class="row g-2">
                <div class="col-12">
                    <h5 class="mb-0">${member.name}</h5>
                    <p class="mb-1 text-muted">${member.cardNo || '普通会员'}</p>
                </div>
                <div class="col-12">
                    <span class="badge ${member.cardType === 'prepaid' ? 'bg-primary' : member.cardType === 'count' ? 'bg-success' : 'bg-warning'}">
                        ${Helpers.getMemberCardTypeText(member.cardType)}
                    </span>
                    <span class="badge bg-info ms-1">${member.points || 0} 积分</span>
                </div>
                <div class="col-12">
                    <small class="text-muted d-block">联系电话</small>
                    <div>${member.phone}</div>
                </div>
                <div class="col-12 mt-2">
                    <div class="alert ${alertClass} py-2 px-3 mb-0">
                        <small><i class="bi bi-info-circle me-1"></i>${cardInfo}</small>
                    </div>
                </div>
            </div>
        `);
    }

    function saveOrder() {
        if (!selectedVehicle) {
            Helpers.showToast('请先选择车辆', 'error');
            return;
        }

        if (currentOrderItems.length === 0) {
            Helpers.showToast('请至少选择一个服务项目', 'error');
            return;
        }

        const paymentMethod = $('#paymentMethod').val();

        if (paymentMethod === 'prepaid' && !selectedMember) {
            Helpers.showToast('使用储值卡支付请先选择会员', 'error');
            return;
        }

        if (paymentMethod === 'count' && !selectedMember) {
            Helpers.showToast('使用次卡支付请先选择会员', 'error');
            return;
        }

        if (paymentMethod === 'prepaid' && selectedMember) {
            const amounts = OrderService.calculateAmount(currentOrderItems);
            const balance = selectedMember.balance || 0;
            if (balance < amounts.actualAmount) {
                Helpers.showToast('储值卡余额不足', 'error');
                return;
            }
        }

        if (paymentMethod === 'count' && selectedMember) {
            const remainingTimes = selectedMember.remainingTimes || 0;
            if (remainingTimes < 1) {
                Helpers.showToast('次卡次数不足', 'error');
                return;
            }
        }

        try {
            Helpers.showLoading(true, '保存中...');

            const orderData = {
                vehicleId: selectedVehicle.id,
                memberId: selectedMember ? selectedMember.id : null,
                remark: $('#orderRemark').val(),
                paymentMethod: paymentMethod,
                currentMileage: selectedVehicle.mileage
            };

            const order = OrderService.create(orderData, currentOrderItems, '前台接待');

            Helpers.showToast('工单创建成功', 'success');
            bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
            loadOrders();

            if (confirm('是否立即打印工单？')) {
                printOrder(order.id);
            }
        } catch (error) {
            Helpers.showToast(error.message, 'error');
        } finally {
            Helpers.showLoading(false);
        }
    }

    function getFilteredOrders() {
        const keyword = $('#searchKeyword').val().trim();
        const status = $('#filterStatus').val();
        const startDate = $('#startDate').val();
        const endDate = $('#endDate').val();
        const storeId = DataStore.getCurrentStore();

        let orders = OrderService.findAll({ storeId });

        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            orders = orders.filter(o => {
                const matchId = o.id.toLowerCase().includes(lowerKeyword);
                const matchPlate = o.vehicle && o.vehicle.plateNo.toLowerCase().includes(lowerKeyword);
                const matchOwner = o.vehicle && o.vehicle.ownerName.toLowerCase().includes(lowerKeyword);
                return matchId || matchPlate || matchOwner;
            });
        }

        if (status) {
            orders = orders.filter(o => o.status === status);
        }

        if (startDate) {
            orders = orders.filter(o => new Date(o.createdAt) >= new Date(startDate));
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            orders = orders.filter(o => new Date(o.createdAt) <= end);
        }

        return orders.map(order => {
            const items = OrderService.getOrderItems(order.id);
            const vehicle = VehicleService.findById(order.vehicleId);
            return { ...order, items, vehicle };
        });
    }

    function loadOrders(page = 1) {
        const pageSize = 10;
        const orders = getFilteredOrders();

        const totalPages = Math.ceil(orders.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const pageData = orders.slice(startIndex, startIndex + pageSize);

        renderOrderTable(pageData);
        renderPagination(page, totalPages);
    }

    function renderOrderTable(orders) {
        const tbody = $('#orderTableBody');

        if (orders.length === 0) {
            tbody.html('<tr><td colspan="9" class="text-center py-4 text-muted">暂无工单数据</td></tr>');
            return;
        }

        tbody.html(orders.map(order => {
            const itemNames = order.items.slice(0, 2).map(i => i.itemName).join('、');
            const moreItems = order.items.length > 2 ? ` +${order.items.length - 2}项` : '';

            const statusTransitions = OrderService.STATUS_TRANSITIONS[order.status] || [];
            const nextStatus = statusTransitions[0];

            return `
                <tr>
                    <td class="fw-bold text-primary">${order.id}</td>
                    <td>${order.vehicle ? order.vehicle.plateNo : '-'}</td>
                    <td>${order.vehicle ? order.vehicle.ownerName : '-'}</td>
                    <td>
                        <div title="${order.items.map(i => i.itemName).join('、')}">
                            ${itemNames}${moreItems}
                        </div>
                    </td>
                    <td class="fw-bold text-danger">${Helpers.formatCurrency(order.actualAmount)}</td>
                    <td>${Helpers.getStatusBadge(order.status)}</td>
                    <td>${order.operator || '-'}</td>
                    <td>${Helpers.formatDate(order.createdAt, 'MM-DD HH:mm')}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="OrderPage.viewDetail('${order.id}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${nextStatus ? `
                                <button class="btn btn-outline-success" onclick="OrderPage.updateStatus('${order.id}', '${nextStatus}')" title="更新为: ${Helpers.getStatusText(nextStatus)}">
                                    <i class="bi bi-arrow-right-circle"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-outline-secondary" onclick="OrderPage.printOrder('${order.id}')">
                                <i class="bi bi-printer"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join(''));
    }

    function renderPagination(currentPage, totalPages) {
        const pagination = $('#pagination');
        if (totalPages <= 1) {
            pagination.empty();
            return;
        }

        let html = '';

        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="OrderPage.loadPage(${currentPage - 1}); return false;">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="OrderPage.loadPage(${i}); return false;">${i}</a>
                    </li>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }

        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="OrderPage.loadPage(${currentPage + 1}); return false;">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;

        pagination.html(html);
    }

    function loadPage(page) {
        loadOrders(page);
    }

    function viewDetail(orderId) {
        const order = OrderService.findById(orderId);
        if (!order) return;

        currentOrder = order;

        const itemsHtml = order.items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${Helpers.getServiceCategoryText(item.category)}</td>
                <td>${item.itemName}</td>
                <td>${item.quantity}</td>
                <td>¥${item.laborFee.toFixed(2)}</td>
                <td>¥${item.materialFee.toFixed(2)}</td>
                <td>${(item.discount * 10).toFixed(1)}折</td>
                <td>¥${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        const statusHistory = OrderService.getStatusHistory(orderId);
        const historyHtml = statusHistory.map(h => `
            <div class="d-flex mb-2">
                <div class="flex-shrink-0">
                    <span class="badge ${h.statusClass}">${h.statusText}</span>
                </div>
                <div class="ms-3">
                    <div>${h.formattedTime}</div>
                    <small class="text-muted">操作人: ${h.operator}</small>
                </div>
            </div>
        `).join('');

        const statusTransitions = OrderService.STATUS_TRANSITIONS[order.status] || [];

        $('#orderDetailContent').html(`
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <h6 class="border-bottom pb-2">基本信息</h6>
                    <div class="row g-2">
                        <div class="col-4 text-muted">工单编号</div>
                        <div class="col-8 fw-bold">${order.id}</div>
                        <div class="col-4 text-muted">创建时间</div>
                        <div class="col-8">${Helpers.formatDateTime(order.createdAt)}</div>
                        <div class="col-4 text-muted">当前状态</div>
                        <div class="col-8">${Helpers.getStatusBadge(order.status)}</div>
                        <div class="col-4 text-muted">操作人</div>
                        <div class="col-8">${order.operator || '-'}</div>
                    </div>
                </div>
                <div class="col-md-6">
                    <h6 class="border-bottom pb-2">车辆信息</h6>
                    <div class="row g-2">
                        <div class="col-4 text-muted">车牌号</div>
                        <div class="col-8 fw-bold text-primary">${order.vehicle ? order.vehicle.plateNo : '-'}</div>
                        <div class="col-4 text-muted">车型</div>
                        <div class="col-8">${order.vehicle ? (order.vehicle.brand + ' ' + order.vehicle.series + ' ' + order.vehicle.model) : '-'}</div>
                        <div class="col-4 text-muted">车主</div>
                        <div class="col-8">${order.vehicle ? order.vehicle.ownerName : '-'}</div>
                        <div class="col-4 text-muted">联系电话</div>
                        <div class="col-8">${order.vehicle ? order.vehicle.ownerPhone : '-'}</div>
                    </div>
                </div>
            </div>

            <h6 class="border-bottom pb-2">服务项目</h6>
            <div class="table-responsive mb-3">
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th width="5%">序号</th>
                            <th width="10%">类别</th>
                            <th>项目名称</th>
                            <th width="8%">数量</th>
                            <th width="12%">工时费</th>
                            <th width="12%">材料费</th>
                            <th width="8%">折扣</th>
                            <th width="12%">小计</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
            </div>

            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="text-center">
                        <small class="text-muted d-block">工时费合计</small>
                        <h5 class="text-primary mb-0">${Helpers.formatCurrency(order.totalLaborFee)}</h5>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="text-center">
                        <small class="text-muted d-block">材料费合计</small>
                        <h5 class="text-info mb-0">${Helpers.formatCurrency(order.totalMaterialFee)}</h5>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="text-center">
                        <small class="text-muted d-block">优惠金额</small>
                        <h5 class="text-success mb-0">${Helpers.formatCurrency(order.discountAmount)}</h5>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="text-center">
                        <small class="text-muted d-block">应收金额</small>
                        <h4 class="text-danger fw-bold mb-0">${Helpers.formatCurrency(order.actualAmount)}</h4>
                    </div>
                </div>
            </div>

            ${order.remark ? `
                <div class="mb-3">
                    <h6 class="border-bottom pb-2">备注</h6>
                    <p class="mb-0">${order.remark}</p>
                </div>
            ` : ''}

            <h6 class="border-bottom pb-2">状态流转</h6>
            <div>${historyHtml || '<div class="text-muted">暂无记录</div>'}</div>
        `);

        let footerHtml = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
            <button type="button" class="btn btn-outline-secondary" onclick="OrderPage.printOrder('${orderId}')">
                <i class="bi bi-printer me-1"></i>打印
            </button>
        `;

        statusTransitions.forEach(status => {
            footerHtml += `
                <button type="button" class="btn btn-primary" onclick="OrderPage.updateStatus('${orderId}', '${status}')">
                    <i class="bi bi-arrow-right-circle me-1"></i>${Helpers.getStatusText(status)}
                </button>
            `;
        });

        $('#orderDetailFooter').html(footerHtml);

        const modal = new bootstrap.Modal(document.getElementById('orderDetailModal'));
        modal.show();
    }

    function updateStatus(orderId, newStatus) {
        Helpers.showConfirm(`确定要将工单状态更新为"${Helpers.getStatusText(newStatus)}"吗？`, '确认更新').then(confirmed => {
            if (confirmed) {
                try {
                    OrderService.updateStatus(orderId, newStatus, '前台接待');
                    Helpers.showToast(`状态已更新为: ${Helpers.getStatusText(newStatus)}`, 'success');

                    const detailModal = bootstrap.Modal.getInstance(document.getElementById('orderDetailModal'));
                    if (detailModal) detailModal.hide();

                    loadOrders();
                } catch (error) {
                    Helpers.showToast(error.message, 'error');
                }
            }
        });
    }

    function printOrder(orderId) {
        const printHtml = OrderService.generatePrintHtml(orderId);
        if (!printHtml) {
            Helpers.showToast('工单不存在', 'error');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(printHtml);
        printWindow.document.close();
    }

    function init() {
        $(document).off('dataSynced.order').on('dataSynced.order', function(e, data) {
            if (data.key === 'orders') {
                loadOrders();
            }
        });

        $(document).off('orderStatusChanged.order').on('orderStatusChanged.order', function() {
            loadOrders();
        });
    }

    return {
        render,
        init,
        loadPage,
        selectPackage,
        toggleServiceItem,
        updateItemQuantity,
        updateItemDiscount,
        removeItem,
        selectVehicleById,
        selectMemberById,
        viewDetail,
        updateStatus,
        printOrder
    };
})();
