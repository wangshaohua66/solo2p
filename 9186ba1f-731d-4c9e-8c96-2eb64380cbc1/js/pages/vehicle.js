const VehiclePage = (function() {
    let currentVehicle = null;
    let searchTimeout = null;

    function render() {
        const html = `
            <div class="fade-in">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">车辆管理</h1>
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <button type="button" class="btn btn-primary" id="btnAddVehicle">
                            <i class="bi bi-plus-circle me-1"></i>新增车辆
                        </button>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-4">
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                                    <input type="text" class="form-control" id="searchKeyword" placeholder="搜索车牌号、车主姓名、手机号">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <select class="form-select" id="filterBrand">
                                    <option value="">全部品牌</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <input type="text" class="form-control" id="quickPlateSearch" placeholder="快速查询车牌号（如：京A）">
                            </div>
                            <div class="col-md-2">
                                <button class="btn btn-outline-secondary w-100" id="btnResetSearch">
                                    <i class="bi bi-arrow-clockwise me-1"></i>重置
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
                                        <th>车牌号</th>
                                        <th>品牌车系</th>
                                        <th>车主姓名</th>
                                        <th>联系电话</th>
                                        <th>当前里程</th>
                                        <th>上次服务</th>
                                        <th>登记时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="vehicleTableBody">
                                    <tr>
                                        <td colspan="8" class="text-center py-4 text-muted">加载中...</td>
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

            <div class="modal fade" id="vehicleModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="vehicleModalTitle">新增车辆</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="vehicleForm" class="needs-validation" novalidate>
                            <input type="hidden" id="vehicleId">
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">车牌号 <span class="text-danger">*</span></label>
                                        <div class="input-group">
                                            <input type="text" class="form-control" id="plateNo" name="plateNo" placeholder="如：京A12345" maxlength="7">
                                            <button class="btn btn-outline-secondary" type="button" id="btnCheckPlate">
                                                <i class="bi bi-search me-1"></i>查询
                                            </button>
                                        </div>
                                        <div class="invalid-feedback"></div>
                                        <div class="form-text">支持省份简称+字母+5位数字/字母</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">VIN码</label>
                                        <input type="text" class="form-control" id="vin" name="vin" placeholder="17位车辆识别代号" maxlength="17">
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">品牌 <span class="text-danger">*</span></label>
                                        <select class="form-select" id="brand" name="brand" required>
                                            <option value="">请选择品牌</option>
                                        </select>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">车系 <span class="text-danger">*</span></label>
                                        <select class="form-select" id="series" name="series" required disabled>
                                            <option value="">请先选择品牌</option>
                                        </select>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">车型 <span class="text-danger">*</span></label>
                                        <select class="form-select" id="model" name="model" required disabled>
                                            <option value="">请先选择车系</option>
                                        </select>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">车主姓名 <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="ownerName" name="ownerName" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">联系电话 <span class="text-danger">*</span></label>
                                        <input type="tel" class="form-control" id="ownerPhone" name="ownerPhone" placeholder="11位手机号" maxlength="11">
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">当前里程 <span class="text-danger">*</span></label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="mileage" name="mileage" min="0" max="999999" placeholder="公里">
                                            <span class="input-group-text">km</span>
                                        </div>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label">备注</label>
                                        <textarea class="form-control" id="remark" name="remark" rows="2" placeholder="特殊需求、车辆状况等"></textarea>
                                    </div>
                                </div>

                                <div id="historySection" class="mt-4 d-none">
                                    <div class="card border-warning">
                                        <div class="card-header bg-warning bg-opacity-10 border-warning d-flex justify-content-between align-items-center">
                                            <h6 class="mb-0 text-warning">
                                                <i class="bi bi-info-circle me-2"></i>历史维修记录
                                            </h6>
                                            <span class="badge bg-warning" id="historyCount">0 条记录</span>
                                        </div>
                                        <div class="card-body">
                                            <div id="lastServiceAlert" class="alert alert-info mb-3">
                                                <i class="bi bi-clock-history me-2"></i>
                                                <span id="lastServiceText">暂无服务记录</span>
                                            </div>
                                            <div class="table-responsive">
                                                <table class="table table-sm table-bordered mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th>服务时间</th>
                                                            <th>服务项目</th>
                                                            <th>状态</th>
                                                            <th>金额</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody id="historyTableBody">
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-success me-auto" id="btnQuickOrder" style="display:none;">
                                    <i class="bi bi-plus-circle me-1"></i>快速开单
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-save me-1"></i>保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        $('#main-content').html(html);
        initBrandSelect();
        bindEvents();
        loadVehicles();
    }

    function initBrandSelect() {
        const data = Helpers.getBrandSeriesModelData();
        const brands = Object.keys(data);

        const brandSelect = $('#brand');
        const filterBrand = $('#filterBrand');

        brands.forEach(brand => {
            brandSelect.append(`<option value="${brand}">${brand}</option>`);
            filterBrand.append(`<option value="${brand}">${brand}</option>`);
        });
    }

    function bindEvents() {
        $('#btnAddVehicle').on('click', () => showModal());

        $('#brand').on('change', function() {
            const brand = $(this).val();
            const seriesSelect = $('#series');
            const modelSelect = $('#model');

            seriesSelect.html('<option value="">请选择车系</option>');
            modelSelect.html('<option value="">请先选择车系</option>').prop('disabled', true);

            if (brand) {
                const data = Helpers.getBrandSeriesModelData();
                const seriesList = Object.keys(data[brand]);
                seriesList.forEach(series => {
                    seriesSelect.append(`<option value="${series}">${series}</option>`);
                });
                seriesSelect.prop('disabled', false);
            } else {
                seriesSelect.prop('disabled', true);
            }
        });

        $('#series').on('change', function() {
            const brand = $('#brand').val();
            const series = $(this).val();
            const modelSelect = $('#model');

            modelSelect.html('<option value="">请选择车型</option>');

            if (brand && series) {
                const data = Helpers.getBrandSeriesModelData();
                const models = data[brand][series] || [];
                models.forEach(model => {
                    modelSelect.append(`<option value="${model}">${model}</option>`);
                });
                modelSelect.prop('disabled', false);
            } else {
                modelSelect.prop('disabled', true);
            }
        });

        $('#btnCheckPlate').on('click', checkPlateNumber);

        $('#plateNo').on('blur', Helpers.debounce(function() {
            if ($(this).val().length >= 6) {
                checkPlateNumber();
            }
        }, 300));

        $('#quickPlateSearch').on('input', Helpers.debounce(function() {
            loadVehicles();
        }, 200));

        $('#searchKeyword').on('input', Helpers.debounce(function() {
            loadVehicles();
        }, 300));

        $('#filterBrand').on('change', function() {
            loadVehicles();
        });

        $('#btnResetSearch').on('click', function() {
            $('#searchKeyword').val('');
            $('#filterBrand').val('');
            $('#quickPlateSearch').val('');
            loadVehicles();
        });

        $('#vehicleForm').on('submit', function(e) {
            e.preventDefault();
            saveVehicle();
        });

        $('#btnQuickOrder').on('click', function() {
            if (currentVehicle) {
                bootstrap.Modal.getInstance(document.getElementById('vehicleModal')).hide();
                location.hash = `#/order?action=create&vehicleId=${currentVehicle.id}`;
            }
        });

        Validator.extendJQueryValidation();
        $('#vehicleForm').validate({
            rules: {
                plateNo: {
                    required: true,
                    plateNo: true
                },
                vin: {
                    vinCode: true
                },
                brand: 'required',
                series: 'required',
                model: 'required',
                ownerName: 'required',
                ownerPhone: {
                    required: true,
                    cnMobile: true
                },
                mileage: {
                    required: true,
                    mileage: true
                }
            },
            messages: {
                plateNo: {
                    required: '请输入车牌号',
                    plateNo: '车牌号格式不正确'
                },
                vin: {
                    vinCode: 'VIN码格式不正确'
                },
                brand: '请选择品牌',
                series: '请选择车系',
                model: '请选择车型',
                ownerName: '请输入车主姓名',
                ownerPhone: {
                    required: '请输入联系电话',
                    cnMobile: '请输入正确的手机号'
                },
                mileage: {
                    required: '请输入当前里程',
                    mileage: '里程数应在0-999999之间'
                }
            },
            errorElement: 'div',
            errorClass: 'invalid-feedback',
            errorPlacement: function(error, element) {
                if (element.parent('.input-group').length) {
                    error.insertAfter(element.parent());
                } else {
                    error.insertAfter(element);
                }
            },
            highlight: function(element) {
                $(element).addClass('is-invalid').removeClass('is-valid');
            },
            unhighlight: function(element) {
                $(element).removeClass('is-invalid').addClass('is-valid');
            }
        });
    }

    function checkPlateNumber() {
        const plateNo = $('#plateNo').val().trim().toUpperCase();
        if (!plateNo) return;

        const startTime = performance.now();
        const vehicle = VehicleService.findByPlateNo(plateNo);
        const elapsed = performance.now() - startTime;

        if (elapsed > 200) {
            console.warn('Plate search took', elapsed, 'ms');
        }

        if (vehicle) {
            currentVehicle = vehicle;
            $('#vehicleId').val(vehicle.id);
            $('#plateNo').val(vehicle.plateNo);
            $('#vin').val(vehicle.vin || '');
            $('#brand').val(vehicle.brand).trigger('change');
            setTimeout(() => {
                $('#series').val(vehicle.series).trigger('change');
                setTimeout(() => {
                    $('#model').val(vehicle.model);
                }, 50);
            }, 50);
            $('#ownerName').val(vehicle.ownerName);
            $('#ownerPhone').val(vehicle.ownerPhone);
            $('#mileage').val(vehicle.mileage);
            $('#remark').val(vehicle.remark || '');

            $('#vehicleModalTitle').text('编辑车辆');
            $('#btnQuickOrder').show();

            showServiceHistory(vehicle.id);
            Helpers.showToast('已找到该车辆信息', 'info');
        } else {
            $('#historySection').addClass('d-none');
            $('#btnQuickOrder').hide();
        }
    }

    function showServiceHistory(vehicleId) {
        const lastService = VehicleService.getLastService(vehicleId);
        const history = VehicleService.getServiceHistory(vehicleId, 5);

        $('#historySection').removeClass('d-none');
        $('#historyCount').text(history.length + ' 条记录');

        if (lastService) {
            $('#lastServiceText').html(
                `上次服务：<strong>${Helpers.formatDate(lastService.date, 'YYYY-MM-DD')}</strong>，` +
                `项目：<strong>${lastService.items.join('、')}</strong>，` +
                `费用：<strong>${Helpers.formatCurrency(lastService.totalAmount)}</strong>`
            );
        } else {
            $('#lastServiceText').text('暂无服务记录');
        }

        const tbody = $('#historyTableBody');
        if (history.length === 0) {
            tbody.html('<tr><td colspan="4" class="text-center text-muted">暂无历史记录</td></tr>');
        } else {
            tbody.html(history.map(order => `
                <tr>
                    <td>${Helpers.formatDate(order.createdAt, 'YYYY-MM-DD HH:mm')}</td>
                    <td>${order.items.map(i => i.itemName).join('、')}</td>
                    <td>${Helpers.getStatusBadge(order.status)}</td>
                    <td>${Helpers.formatCurrency(order.actualAmount)}</td>
                </tr>
            `).join(''));
        }
    }

    function showModal(vehicleId = null) {
        $('#vehicleForm')[0].reset();
        $('#vehicleForm').find('.is-invalid, .is-valid').removeClass('is-invalid is-valid');
        $('#vehicleId').val('');
        $('#series').html('<option value="">请先选择品牌</option>').prop('disabled', true);
        $('#model').html('<option value="">请先选择车系</option>').prop('disabled', true);
        $('#historySection').addClass('d-none');
        $('#btnQuickOrder').hide();
        currentVehicle = null;

        if (vehicleId) {
            const vehicle = VehicleService.findById(vehicleId);
            if (vehicle) {
                currentVehicle = vehicle;
                $('#vehicleModalTitle').text('编辑车辆');
                $('#vehicleId').val(vehicle.id);
                $('#plateNo').val(vehicle.plateNo);
                $('#vin').val(vehicle.vin || '');
                $('#brand').val(vehicle.brand).trigger('change');
                setTimeout(() => {
                    $('#series').val(vehicle.series).trigger('change');
                    setTimeout(() => {
                        $('#model').val(vehicle.model);
                    }, 50);
                }, 50);
                $('#ownerName').val(vehicle.ownerName);
                $('#ownerPhone').val(vehicle.ownerPhone);
                $('#mileage').val(vehicle.mileage);
                $('#remark').val(vehicle.remark || '');
                $('#btnQuickOrder').show();
                showServiceHistory(vehicle.id);
            }
        } else {
            $('#vehicleModalTitle').text('新增车辆');
        }

        const modal = new bootstrap.Modal(document.getElementById('vehicleModal'));
        modal.show();

        setTimeout(() => {
            $('#plateNo').focus();
        }, 500);
    }

    function saveVehicle() {
        if (!$('#vehicleForm').valid()) return;

        const formData = Helpers.serializeForm('vehicleForm');
        formData.storeId = DataStore.getCurrentStore();

        try {
            Helpers.showLoading(true, '保存中...');
            const startTime = performance.now();

            if (formData.id || $('#vehicleId').val()) {
                const id = formData.id || $('#vehicleId').val();
                VehicleService.update(id, formData);
                Helpers.showToast('车辆信息更新成功', 'success');
            } else {
                VehicleService.create(formData);
                Helpers.showToast('车辆登记成功', 'success');
            }

            const elapsed = performance.now() - startTime;
            if (elapsed > 500) {
                console.warn('Vehicle save took', elapsed, 'ms');
            }

            bootstrap.Modal.getInstance(document.getElementById('vehicleModal')).hide();
            loadVehicles();
        } catch (error) {
            Helpers.showToast(error.message, 'error');
        } finally {
            Helpers.showLoading(false);
        }
    }

    function loadVehicles(page = 1) {
        const pageSize = 10;
        const keyword = $('#searchKeyword').val().trim();
        const brand = $('#filterBrand').val();
        const quickPlate = $('#quickPlateSearch').val().trim().toUpperCase();

        let vehicles = VehicleService.findAll();

        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            vehicles = vehicles.filter(v =>
                v.plateNo.toLowerCase().includes(lowerKeyword) ||
                (v.ownerName && v.ownerName.toLowerCase().includes(lowerKeyword)) ||
                (v.ownerPhone && v.ownerPhone.includes(keyword))
            );
        }

        if (quickPlate) {
            vehicles = vehicles.filter(v => v.plateNo.includes(quickPlate));
        }

        if (brand) {
            vehicles = vehicles.filter(v => v.brand === brand);
        }

        vehicles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const totalPages = Math.ceil(vehicles.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const pageData = vehicles.slice(startIndex, startIndex + pageSize);

        renderVehicleTable(pageData);
        renderPagination(page, totalPages);
    }

    function renderVehicleTable(vehicles) {
        const tbody = $('#vehicleTableBody');

        if (vehicles.length === 0) {
            tbody.html('<tr><td colspan="8" class="text-center py-4 text-muted">暂无车辆数据</td></tr>');
            return;
        }

        tbody.html(vehicles.map(vehicle => {
            const lastService = VehicleService.getLastService(vehicle.id);
            const lastServiceText = lastService
                ? `<span class="text-info">${Helpers.formatDate(lastService.date, 'MM-DD')}</span>`
                : '<span class="text-muted">未服务</span>';

            return `
                <tr>
                    <td>
                        <span class="fw-bold text-primary">${vehicle.plateNo}</span>
                        ${vehicle.vin ? `<br><small class="text-muted">${vehicle.vin}</small>` : ''}
                    </td>
                    <td>
                        ${vehicle.brand} ${vehicle.series}<br>
                        <small class="text-muted">${vehicle.model}</small>
                    </td>
                    <td>${vehicle.ownerName}</td>
                    <td>${vehicle.ownerPhone}</td>
                    <td>${vehicle.mileage.toLocaleString()} km</td>
                    <td>${lastServiceText}</td>
                    <td>${Helpers.formatDate(vehicle.createdAt, 'MM-DD')}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="VehiclePage.edit('${vehicle.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-info" onclick="VehiclePage.viewHistory('${vehicle.id}')">
                                <i class="bi bi-clock-history"></i>
                            </button>
                            <button class="btn btn-outline-success" onclick="VehiclePage.quickOrder('${vehicle.id}')">
                                <i class="bi bi-plus-circle"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="VehiclePage.remove('${vehicle.id}')">
                                <i class="bi bi-trash"></i>
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
                <a class="page-link" href="#" onclick="VehiclePage.loadPage(${currentPage - 1}); return false;">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="VehiclePage.loadPage(${i}); return false;">${i}</a>
                    </li>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }

        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="VehiclePage.loadPage(${currentPage + 1}); return false;">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;

        pagination.html(html);
    }

    function edit(id) {
        showModal(id);
    }

    function viewHistory(id) {
        showModal(id);
    }

    function quickOrder(id) {
        location.hash = `#/order?action=create&vehicleId=${id}`;
    }

    function remove(id) {
        Helpers.showConfirm('确定要删除该车辆信息吗？删除后无法恢复。', '确认删除').then(confirmed => {
            if (confirmed) {
                try {
                    VehicleService.remove(id);
                    Helpers.showToast('删除成功', 'success');
                    loadVehicles();
                } catch (error) {
                    Helpers.showToast(error.message, 'error');
                }
            }
        });
    }

    function loadPage(page) {
        loadVehicles(page);
    }

    function init() {
        $(document).off('dataSynced.vehicle').on('dataSynced.vehicle', function(e, data) {
            if (data.key === 'vehicles') {
                loadVehicles();
            }
        });
    }

    return {
        render,
        init,
        edit,
        viewHistory,
        quickOrder,
        remove,
        loadPage
    };
})();
