var ResourcePage = (function () {
    var _unsubs = [];
    var _filterCategory = 'all';
    var _filterWarehouse = 'all';
    var _filterLowStock = false;
    var _searchKeyword = '';

    function _renderMaterials($table) {
        var materials = Store.get('materials') || [];
        var warehouses = Store.get('warehouses') || [];
        var fps = Store.get('floodPoints') || [];

        var filtered = materials.filter(function (m) {
            if (_filterCategory !== 'all' && m.category !== _filterCategory) return false;
            if (_filterWarehouse !== 'all' && m.warehouse !== _filterWarehouse) return false;
            if (_filterLowStock && !m.lowStock) return false;
            if (_searchKeyword && !(m.name.indexOf(_searchKeyword) >= 0 || m.id.indexOf(_searchKeyword) >= 0)) return false;
            return true;
        });

        var catTotal = {};
        var whTotal = {};
        materials.forEach(function (m) {
            catTotal[m.category] = (catTotal[m.category] || 0) + m.stock;
            whTotal[m.warehouseName] = (whTotal[m.warehouseName] || 0) + m.stock;
        });

        var statsHtml = '<div class="row g-2 mb-3">'
            + '<div class="col-md-4"><div class="stat-card info"><div class="small opacity-80">品类数</div><div class="stat-value">' + Object.keys(catTotal).length + '</div></div></div>'
            + '<div class="col-md-4"><div class="stat-card"><div class="small opacity-80">物资种类</div><div class="stat-value">' + materials.length + '</div></div></div>'
            + '<div class="col-md-4"><div class="stat-card success"><div class="small opacity-80">库存总量</div><div class="stat-value">' + materials.reduce(function (s, m) { return s + m.stock; }, 0).toLocaleString() + '</div></div></div>'
            + '</div>';

        var catBtns = '<div class="mb-2">'
            + '<div class="btn-group btn-group-sm me-2 mb-2 flex-wrap" role="group">'
            + '<button class="btn btn-sm ' + (_filterCategory === 'all' ? 'btn-primary' : 'btn-outline-secondary') + ' category-btn" data-cat="all">全部品类</button>'
            + MockData.MATERIAL_CATEGORIES.map(function (c) {
                return '<button class="btn btn-sm ' + (_filterCategory === c ? 'btn-primary' : 'btn-outline-secondary') + ' category-btn" data-cat="' + c + '">' + c + '</button>';
            }).join('')
            + '</button></div>';

        var whBtns = '<div class="mb-2"><div class="btn-group btn-group-sm me-2 mb-2 flex-wrap" role="group">'
            + '<button class="btn btn-sm ' + (_filterWarehouse === 'all' ? 'btn-primary' : 'btn-outline-secondary') + ' warehouse-btn" data-wh="all">全部仓库</button>'
            + warehouses.map(function (w) {
                return '<button class="btn btn-sm ' + (_filterWarehouse === w.id ? 'btn-primary' : 'btn-outline-secondary') + ' warehouse-btn" data-wh="' + w.id + '">' + w.name + '</button>';
            }).join('')
            + '</button></div>';

        var searchHtml = '<div class="row g-2 mb-3">'
            + '<div class="col-md-6"><div class="input-group input-group-sm">'
            + '<span class="input-group-text"><i class="bi bi-search"></i></span>'
            + '<input type="text" class="form-control" id="matSearch" placeholder="搜索物资名称..." value="' + _searchKeyword + '">'
            + '</div></div>'
            + '<div class="col-md-6 d-flex justify-content-md-end align-items-center gap-2">'
            + '<label class="form-check form-check-inline mb-0">'
            + '<input class="form-check-input low-stock-check" type="checkbox" ' + (_filterLowStock ? 'checked' : '') + '>'
            + '<span class="form-check-label small">仅看预警</span></label>'
            + '<span class="badge bg-secondary">' + filtered.length + ' / ' + materials.length + ' 条</span>'
            + '</div></div>';

        if (!filtered.length) {
            tableHtml = '<div class="text-center text-muted py-5"><i class="bi bi-inbox display-4 d-block mb-2 opacity-30"></i>没有符合条件的物资</div>';
        } else {
            tableHtml = '<div style="max-height:58vh;overflow-y:auto;"><table class="table table-hover table-sm align-middle mb-0">'
                + '<thead class="table-light sticky-top">'
                + '<tr><th style="width:60px;">编号</th>'
                + '<th>物资名称</th>'
                + '<th>品类</th>'
                + '<th>仓库</th>'
                + '<th style="width:90px;">库存</th>'
                + '<th style="width:80px;">单位</th>'
                + '<th style="width:110px;">库存状态</th>'
                + '<th style="width:80px;">单价</th>'
                + '<th style="width:180px;">操作</th></tr></thead><tbody>';
            filtered.forEach(function (m) {
                var stockColor = m.lowStock ? 'text-danger fw-bold' : m.stock < m.minStock * 2 ? 'text-warning' : 'text-success';
                tableHtml += '<tr>'
                    + '<td class="text-muted small">' + m.id + '</td>'
                    + '<td><strong>' + m.name + '</strong></td>'
                    + '<td><span class="badge bg-light text-dark">' + m.category + '</span></td>'
                    + '<td class="small">' + m.warehouseName + '</td>'
                    + '<td><span class="' + stockColor + '">' + m.stock.toLocaleString() + '</span></td>'
                    + '<td class="small text-muted">' + m.unit + '</td>'
                    + '<td>' + (m.lowStock ? '<span class="badge bg-danger">低于阈值</span>' : '<span class="badge bg-success">充足</span>') + '</td>'
                    + '<td class="small">¥' + m.unitPrice + '</td>'
                    + '<td><button class="btn btn-sm btn-outline-primary allocate-btn" '
                    + 'data-id="' + m.id + '" data-name="' + m.name + '" data-unit="' + m.unit + '" data-stock="' + m.stock + '" data-warehouse="' + m.warehouseName + '">'
                    + '<i class="bi bi-send me-1"></i>调拨</button></td>'
                    + '</tr>';
            });
            tableHtml += '</tbody></table></div>';
        }

        $table.html(statsHtml + '<div class="card card-dashboard mb-3"><div class="card-body">' + catBtns + whBtns + searchHtml + tableHtml + '</div></div>');

        $table.find('.category-btn').on('click', function () {
            _filterCategory = $(this).data('cat');
            _renderMaterials($table);
        });

        $table.find('.warehouse-btn').on('click', function () {
            _filterWarehouse = $(this).data('wh');
            _renderMaterials($table);
        });

        $table.find('#matSearch').on('input', function () {
            _searchKeyword = $(this).val();
            clearTimeout(window.__resSearch);
            window.__resSearch = setTimeout(function () { _renderMaterials($table); }, 250);
        });

        $table.find('.low-stock-check').on('change', function () {
            _filterLowStock = $(this).prop('checked');
            _renderMaterials($table);
        });

        $table.find('.allocate-btn').on('click', function () {
            _showAllocateModal({
                id: $(this).data('id'),
                name: $(this).data('name'),
                unit: $(this).data('unit'),
                stock: parseInt($(this).data('stock'), 10),
                warehouse: $(this).data('warehouse')
            }, fps);
        });
    }

    function _showAllocateModal(mat, fps) {
        var $modal = $('#allocateModal');
        if (!$modal.length) {
            $('body').append('<div class="modal fade" id="allocateModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">'
                + '<div class="modal-header"><h5 class="modal-title">物资调拨</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
                + '<div class="modal-body" id="allocateModalBody"></div>'
                + '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>'
                + '<button type="button" class="btn btn-primary" id="confirmAllocateBtn">确认调拨</button></div>'
                + '</div></div></div>');
        }

        var fpOptions = fps.map(function (fp) {
            return '<option value="' + fp.id + '">' + fp.id + ' - ' + fp.name + ' [' + ['正常', '轻度', '中度', '重度'][fp.level] + '</option>';
        }).join('');

        $('#allocateModalBody').html(
            '<div class="mb-3"><label class="form-label small fw-bold">物资信息</label>'
            + '<div class="p-3 bg-light rounded"><div class="row g-2 small">'
            + '<div class="col-6"><span class="text-muted">编号：</span><strong>' + mat.id + '</strong></div>'
            + '<div class="col-6"><span class="text-muted">仓库：</span>' + mat.warehouse + '</div>'
            + '<div class="col-6"><span class="text-muted">名称：</span><strong>' + mat.name + '</strong></div>'
            + '<div class="col-6"><span class="text-muted">可用库存：</span><span class="text-success fw-bold">' + mat.stock.toLocaleString() + ' ' + mat.unit + '</span></div>'
            + '</div></div></div>'
            + '<div class="mb-3"><label class="form-label small fw-bold">调拨数量 <span class="text-danger">*</span></label>'
            + '<div class="input-group"><input type="number" class="form-control" id="allocQty" min="1" max="' + mat.stock + '" value="10"><span class="input-group-text">' + mat.unit + '</span></div>'
            + '<div class="form-text">最大可调拨 ' + mat.stock + ' ' + mat.unit + '</div></div>'
            + '<div class="mb-3"><label class="form-label small fw-bold">目标地点</label>'
            + '<select class="form-select" id="allocTarget"><option value="">请选择</option>' + fpOptions + '</select></div>'
            + '<div class="mb-3"><label class="form-label small fw-bold">调拨说明</label>'
            + '<input type="text" class="form-control" id="allocReason" placeholder="调拨原因..." value="应急处置"></div>'
        );

        var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('allocateModal'));
        modal.show();

        $('#confirmAllocateBtn').off('click').on('click', function () {
            var qty = parseInt($('#allocQty').val(), 10);
            var target = $('#allocTarget option:selected').text();
            var reason = $('#allocReason').val();
            if (!qty || qty < 1 || qty > mat.stock) {
                App.showToast('warning', '数量无效', '请输入 1-' + mat.stock + ' 之间的数量');
                return;
            }
            var flow = Store.allocateMaterial(mat.id, qty, target === '请选择' ? '抢险现场' : target);
            if (flow) {
                modal.hide();
                App.showToast('success', '调拨成功', '已从' + mat.warehouse + '调出 ' + qty + mat.unit + ' ' + mat.name);
            } else {
                App.showToast('danger', '调拨失败', '库存不足');
            }
        });
    }

    function _renderFlows($container) {
        var flows = Store.get('materialFlows') || [];
        var html = '<div class="card card-dashboard h-100"><div class="card-header">'
            + '<h6 class="mb-0 fw-bold"><i class="bi bi-clock-history me-1 text-warning"></i>调拨流水记录</h6>'
            + '<span class="text-muted small">最近 30条</span></div>'
            + '<div class="card-body p-0"><div class="resource-feed p-3">';

        if (!flows.length) {
            html += '<div class="text-center text-muted py-5 small">暂无流水</div>';
        } else {
            flows.slice(0, 30).forEach(function (f) {
                var color = f.type.indexOf('入库') >= 0 ? 'success' : f.type === '应急出库' ? 'danger' : 'warning';
                var icon = f.type.indexOf('入库') >= 0 ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up-right';
                html += '<div class="resource-feed-item d-flex gap-2">'
                    + '<div class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style="width:36px;height:36px;">'
                    + '<i class="bi ' + icon + ' text-' + color + '"></i></div>'
                    + '<div class="flex-grow-1 min-w-0">'
                    + '<div class="d-flex justify-content-between align-items-start">'
                    + '<div class="fw-medium small">' + f.materialName
                    + ' <span class="badge bg-' + color + '">' + f.type + '</span></div>'
                    + '<span class="text-muted xsmall ms-2">' + f.time.split(' ')[1].slice(0, 5) + '</span></div>'
                    + '<div class="small mt-1"><span class="fw-bold">' + f.quantity + '</span> 件 · '
                    + '<span class="text-muted">' + f.from + '</span> <i class="bi bi-arrow-right mx-1 text-muted"></i> <span class="text-muted">' + f.to + '</span></div>'
                    + '<div class="xsmall text-muted mt-1"><i class="bi bi-person me-1"></i>' + f.operator + ' · ' + f.reason + '</div>'
                    + '</div></div>';
            });
        }
        html += '</div></div></div>';
        $container.html(html);
    }

    function _renderSidebarFeed($container) {
        var flows = Store.get('materialFlows') || [];
        var alerts = Store.get('alerts') || [];
        var timeline = Store.get('timeline') || [];
        var events = [].concat(
            flows.slice(0, 8).map(function (f) { return { time: f.time, type: 'flow', data: f }; }),
            alerts.slice(0, 5).map(function (a) { return { time: a.time, type: 'alert', data: a }; }),
            timeline.slice(0, 8).map(function (t) { return { time: t.time, type: 'event', data: t }; })
        ).sort(function (a, b) { return new Date(b.time) - new Date(a.time); }).slice(0, 12);

        html = '<div class="card card-dashboard h-100"><div class="card-header">'
            + '<h6 class="mb-0 fw-bold"><i class="bi bi-activity me-1 text-danger"></i>实时动态</h6>'
            + '<span class="spinner-grow spinner-grow-sm text-danger"></span></div>'
            + '<div class="card-body p-0"><div class="resource-feed p-3">';

        if (!events.length) {
            html += '<div class="text-center text-muted py-5 small">暂无动态</div>';
        } else {
            events.forEach(function (ev) {
                if (ev.type === 'flow') {
                    var f = ev.data;
                    var c = f.type.indexOf('入库') >= 0 ? 'bi-box-arrow-in-down text-success'
                        : f.type === '应急出库' ? 'bi-box-arrow-up-right text-danger'
                        : 'bi-arrow-left-right text-warning';
                    html += '<div class="resource-feed-item">'
                        + '<div class="d-flex gap-2"><i class="bi ' + c + ' mt-1"></i>'
                        + '<div class="flex-grow-1 min-w-0"><div class="fw-bold small">物资' + f.type + '</div>'
                        + '<div class="small">' + f.quantity + ' ' + f.materialName + '</div>'
                        + '<div class="xsmall text-muted">' + f.time.split(' ')[1].slice(0, 5) + '</div>'
                        + '</div></div></div>';
                } else if (ev.type === 'alert') {
                    var a = ev.data;
                    var ac = a.level === 'danger' ? 'bi-exclamation-octagon text-danger'
                        : a.level === 'warning' ? 'bi-exclamation-triangle text-warning'
                        : 'bi-info-circle text-info';
                    html += '<div class="resource-feed-item">'
                        + '<div class="d-flex gap-2"><i class="bi ' + ac + ' mt-1"></i>'
                        + '<div class="flex-grow-1 min-w-0"><div class="fw-bold small">' + a.title + '</div>'
                        + '<div class="small text-truncate" style="max-width:200px;">' + a.content + '</div>'
                        + '<div class="xsmall text-muted">' + a.time.split(' ')[1].slice(0, 5) + '</div>'
                        + '</div></div></div>';
                } else {
                    var t = ev.data;
                    var tc = t.type === 'success' ? 'bi-check2-circle text-success'
                        : t.type === 'danger' ? 'bi-x-circle text-danger'
                        : t.type === 'warning' ? 'bi-exclamation-diamond text-warning'
                        : 'bi-info-circle text-info';
                    html += '<div class="resource-feed-item">'
                        + '<div class="d-flex gap-2"><i class="bi ' + tc + ' mt-1"></i>'
                        + '<div class="flex-grow-1 min-w-0"><div class="fw-bold small">' + t.title + '</div>'
                        + '<div class="small text-truncate" style="max-width:200px;">' + t.description + '</div>'
                        + '<div class="xsmall text-muted">' + t.time.split(' ')[1].slice(0, 5) + '</div>'
                        + '</div></div></div>';
                }
            });
        }
        html += '</div></div></div>';
        $container.html(html);
    }

    function _renderWarehouses($container) {
        var warehouses = Store.get('warehouses') || [];
        var materials = Store.get('materials') || [];
        html = '<div class="card card-dashboard"><div class="card-header">'
            + '<h6 class="mb-0 fw-bold"><i class="bi bi-geo-alt me-1 text-primary"></i>仓库分布</h6></div>'
            + '<div class="card-body p-0"><div class="list-group list-group-flush">';
        warehouses.forEach(function (w) {
            var whMats = materials.filter(function (m) { return m.warehouse === w.id; });
            var total = whMats.reduce(function (s, m) { return s + m.stock; }, 0);
            var low = whMats.filter(function (m) { return m.lowStock; }).length;
            html += '<div class="list-group-item p-3">'
                + '<div class="d-flex justify-content-between align-items-start">'
                + '<div><strong class="d-block">' + w.name + '</strong>'
                + '<small class="text-muted d-block"><i class="bi bi-geo-alt me-1"></i>' + w.address + '</small></div>'
                + '<div class="text-end"><div class="small text-muted">物资 <span class="fw-bold text-primary">' + total.toLocaleString() + '</span> 件</div>'
                + (low > 0 ? '<div class="xsmall text-danger"><i class="bi bi-exclamation-triangle me-1"></i>' + low + ' 项预警</div>' : '<div class="xsmall text-success"><i class="bi bi-check-circle me-1"></i>库存健康</div>')
                + '</div></div></div>';
        });
        html += '</div></div></div>';
        $container.html(html);
    }

    function render($app, params) {
        var html = [
            '<div class="container-fluid p-0">',
            '<div class="row g-3">',
            '<div class="col-xl-8">',
            '<div id="materialContainer"></div>',
            '<div class="row g-3 mt-0">',
            '<div class="col-md-6"><div id="flowsContainer"></div></div>',
            '<div class="col-md-6"><div id="warehouseContainer"></div></div>',
            '</div>',
            '</div>',
            '<div class="col-xl-4">',
            '<div id="feedContainer"></div>',
            '</div>',
            '</div></div>'
        ].join('');

        $app.html(html);

        _renderMaterials($('#materialContainer'));
        _renderFlows($('#flowsContainer'));
        _renderSidebarFeed($('#feedContainer'));
        _renderWarehouses($('#warehouseContainer'));

        _unsubs.push(Store.on('materials', function () { _renderMaterials($('#materialContainer')); }));
        _unsubs.push(Store.on('materialFlows', function () {
            _renderFlows($('#flowsContainer'));
            _renderSidebarFeed($('#feedContainer'));
        }));
        _unsubs.push(Store.on('alerts', function () { _renderSidebarFeed($('#feedContainer')); }));
        _unsubs.push(Store.on('timeline', function () { _renderSidebarFeed($('#feedContainer')); }));
        _unsubs.push(Store.on('newFlow', function () {
            $('#feedContainer .card-header').addClass('drawer-pulse');
            setTimeout(function () { $('#feedContainer .card-header').removeClass('drawer-pulse'); }, 1200);
        }));
    }

    function cleanup() {
        _unsubs.forEach(function (fn) { try { fn(); } catch (e) { } });
        _unsubs = [];
        var $m = $('#allocateModal');
        if ($m.length) { $m.remove(); }
    }

    return { render: render, cleanup: cleanup };
})();

Router.register('resource', ResourcePage.render, {
    title: '应急资源',
    cleanup: ResourcePage.cleanup
});
