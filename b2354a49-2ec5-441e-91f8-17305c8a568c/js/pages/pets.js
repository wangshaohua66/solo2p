(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    var filter = { keyword: '', species: '' };
    var selectedPetId = null;
    var cardVirtualScroller = null;
    var tableVirtualScroller = null;

    function render() {
        return '<div class="container-fluid p-0">' +
            '<div class="card bg-gradient-danger text-white shadow-sm mb-4">' +
            '<div class="card-body py-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto"><h4 class="mb-0 fw-bold"><i class="bi bi-heart me-2"></i>跨店宠物档案中心</h4>' +
            '<small class="opacity-75">支持LocalStorage导出导入 · 全门店数据互通</small>' +
            '</div>' +
            '<div class="col-md-2 d-flex gap-2 ms-auto">' +
            '<button class="btn btn-light flex-grow-1" id="btnExportPets"><i class="bi bi-download me-1"></i>导出</button>' +
            '<button class="btn btn-outline-light flex-grow-1" id="btnImportPets"><i class="bi bi-upload me-1"></i>导入</button>' +
            '</div>' +
            '<div class="col-md-2"><button class="btn btn-success w-100" id="btnNewPet"><i class="bi bi-plus-circle me-1"></i>新建档案</button></div>' +
            '</div></div></div>' +

            '<div class="card shadow-sm mb-4"><div class="card-body py-3">' +
            '<div class="row g-3">' +
            '<div class="col-md-6"><div class="input-group">' +
            '<span class="input-group-text bg-white"><i class="bi bi-search"></i></span>' +
            '<input id="petSearchInput" type="text" class="form-control" placeholder="搜索宠物名/品种/主人...">' +
            '</div></div>' +
            '<div class="col-md-2"><select id="filterSpecies" class="form-select">' +
            '<option value="">全部物种</option>' +
            '<option value="dog">狗狗</option>' +
            '<option value="cat">猫咪</option>' +
            '</select></div>' +
            '<div class="col-md-2"><select id="filterSort" class="form-select">' +
            '<option value="name">按名称排序</option>' +
            '<option value="breed">按品种分组</option>' +
            '<option value="recent">最近服务</option>' +
            '</select></div>' +
            '<div class="col-md-2"><div class="d-flex gap-2">' +
            '<button class="btn btn-outline-secondary flex-grow-1 view-mode-btn active" data-mode="card"><i class="bi bi-grid-3x3-gap me-1"></i>卡片</button>' +
            '<button class="btn btn-outline-secondary flex-grow-1 view-mode-btn" data-mode="table"><i class="bi bi-list me-1"></i>列表</button>' +
            '</div></div>' +
            '</div></div></div>' +

            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-archive me-2 text-primary"></i>宠物档案库</h6>' +
            '<span class="badge bg-secondary" id="petCount">0</span>' +
            '</div>' +
            '<div class="card-body p-3" id="petDataHost">' +
            '<div id="cardView"></div>' +
            '<div id="tableView" class="d-none"></div>' +
            '</div></div>' +

            '<input type="file" id="importFileInput" accept=".json" class="d-none">';
    }

    function bind() {
        refreshView();

        $('#petSearchInput').on('input', function() {
            filter.keyword = $(this).val().trim().toLowerCase();
            refreshView();
        });

        $('#filterSpecies').on('change', function() {
            filter.species = $(this).val();
            refreshView();
        });

        $('#filterSort').on('change', refreshView);

        $('.view-mode-btn').on('click', function() {
            $('.view-mode-btn').removeClass('active');
            $(this).addClass('active');
            var mode = $(this).data('mode');
            if (mode === 'card') {
                $('#cardView').removeClass('d-none');
                $('#tableView').addClass('d-none');
            } else {
                $('#cardView').addClass('d-none');
                $('#tableView').removeClass('d-none');
            }
        });

        $('#btnNewPet').on('click', function() { openPetModal(); });

        $('#btnExportPets').on('click', function() {
            var data = App.store.exportData();
            var blob = new Blob([data], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'pet_records_' + Date.now() + '.json';
            a.click();
            App.showToast('档案数据导出成功（约 ' + App.store.getStorageSize() + '）', 'success');
        });

        $('#btnImportPets').on('click', function() { $('#importFileInput').click(); });
        $('#importFileInput').on('change', function(e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var ok = App.store.importData(ev.target.result);
                    if (ok) { App.showToast('导入成功！请刷新页面确认数据', 'success'); refreshView(); }
                    else App.showToast('文件格式错误或数据不完整', 'error', '导入失败');
                } catch(err) { App.showToast('解析失败：' + err.message, 'error'); }
            };
            reader.readAsText(file);
        });
    }

    function renderPetCardItem(pet) {
        return '<div class="col-md-6 col-xl-4" style="min-height:320px;">' +
            App.components.petCard.render(pet, { onEdit: true, onSelect: true }) +
            '</div>';
    }

    function renderPetTableRow(p, idx) {
        var owner = p.ownerId ? App.store.getCustomerById(p.ownerId) : null;
        var age = '';
        if (p.birthday) {
            var bd = new Date(p.birthday);
            var y = Math.floor((Date.now() - bd.getTime()) / (365 * 24 * 3600 * 1000));
            age = y + '岁';
        }
        return '<tr data-id="' + p.id + '" style="height:60px;">' +
            '<td><img src="' + (p.photos && p.photos[0] ? p.photos[0] : 'https://placehold.co/40x40/ddd/999?text=' + (p.species === 'cat' ? '猫' : '犬')) + '" style="width:40px;height:40px;object-fit:cover;border-radius:8px;" onerror="this.src=\'https://placehold.co/40x40/ddd/999?text=宠物\'"></td>' +
            '<td class="fw-bold">' + p.name + '</td>' +
            '<td><span class="badge ' + (p.species === 'cat' ? 'bg-info' : 'bg-warning') + '">' + (p.species === 'cat' ? '猫咪' : '狗狗') + '</span></td>' +
            '<td class="small">' + (p.breed || '-') + '</td>' +
            '<td>' + (p.gender || '-') + '</td>' +
            '<td>' + age + '</td>' +
            '<td>' + (p.weight ? p.weight + 'kg' : '-') + '</td>' +
            '<td class="small">' + (owner ? owner.name + ' (' + owner.phone + ')' : '<span class="text-muted">未绑定</span>') + '</td>' +
            '<td><span class="badge bg-light text-dark">' + (p.serviceHistory ? p.serviceHistory.length : 0) + '</span></td>' +
            '<td><button class="btn btn-sm btn-outline-primary btn-edit-row" data-id="' + p.id + '"><i class="bi bi-pencil"></i></button></td>' +
            '</tr>';
    }

    function bindPetCardEvents() {
        $('#cardView').off('click', '.pet-action-edit').on('click', '.pet-action-edit', function() {
            var id = $(this).data('id');
            var pet = App.store.getPetById(id);
            openPetModal(pet);
        });
        $('#cardView').off('click', '.pet-action-select').on('click', '.pet-action-select', function() {
            selectedPetId = $(this).data('id');
            refreshView();
            App.showToast('已选中宠物', 'success');
        });
        $('#cardView').off('click', '.pet-card').on('click', '.pet-card', function() {
            selectedPetId = $(this).data('petId');
            refreshView();
        });
    }

    function bindPetTableEvents() {
        $('#tableView').off('click', '.btn-edit-row').on('click', '.btn-edit-row', function() {
            var id = $(this).data('id');
            var pet = App.store.getPetById(id);
            openPetModal(pet);
        });
    }

    function refreshView() {
        var list = App.store.getPets(filter);
        var sort = $('#filterSort').val() || 'name';
        if (sort === 'name') list.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh'); });
        else if (sort === 'breed') list.sort(function(a, b) { return (a.breed || '').localeCompare(b.breed || '', 'zh'); });
        else {
            list.sort(function(a, b) {
                var la = a.serviceHistory ? a.serviceHistory.length : 0;
                var lb = b.serviceHistory ? b.serviceHistory.length : 0;
                return lb - la;
            });
        }

        $('#petCount').text(list.length + ' 只');

        var useVirtual = App.utils && App.utils.shouldUseVirtualScroll && App.utils.shouldUseVirtualScroll(list.length);
        var $cardView = $('#cardView');
        var $tableView = $('#tableView');

        if (!list.length) {
            var emptyHtml = '<div class="text-center py-5 text-muted"><i class="bi bi-search-heart fs-1 d-block mb-2"></i>未找到匹配的宠物档案</div>';
            $cardView.html(emptyHtml);
            $tableView.html(emptyHtml);
            if (cardVirtualScroller) { cardVirtualScroller = null; }
            if (tableVirtualScroller) { tableVirtualScroller = null; }
            return;
        }

        if (useVirtual) {
            $cardView.css({
                'max-height': '600px',
                'overflow-y': 'auto',
                '-webkit-overflow-scrolling': 'touch',
                'padding': '0'
            });
            $tableView.css({
                'max-height': '600px',
                'overflow-y': 'auto',
                '-webkit-overflow-scrolling': 'touch',
                'padding': '0'
            });

            if (!cardVirtualScroller) {
                cardVirtualScroller = App.utils.createVirtualScroller({
                    container: $cardView[0],
                    items: list,
                    itemHeight: 320,
                    containerHeight: 600,
                    renderItem: function(pet) {
                        return '<div class="row g-3"><div class="col-12">' + renderPetCardItem(pet) + '</div></div>';
                    },
                    onItemsRendered: bindPetCardEvents
                });
                cardVirtualScroller.render();

                $cardView.off('scroll.virtual').on('scroll.virtual', function() {
                    if (cardVirtualScroller) {
                        cardVirtualScroller.updateScrollTop(this.scrollTop);
                        bindPetCardEvents();
                        if (selectedPetId) {
                            $cardView.find('.pet-card[data-pet-id="' + selectedPetId + '"]').addClass('border-primary border-2');
                        }
                    }
                });
            } else {
                cardVirtualScroller.updateItems(list);
                bindPetCardEvents();
            }

            if (!tableVirtualScroller) {
                tableVirtualScroller = App.utils.createVirtualScroller({
                    container: $tableView[0],
                    items: list,
                    itemHeight: 60,
                    containerHeight: 600,
                    renderItem: function(pet, idx) {
                        return renderPetTableRow(pet, idx);
                    },
                    onItemsRendered: function(range, visibleItems) {
                        var html = '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light" style="position:sticky;top:0;z-index:1;"><tr>' +
                            '<th>照片</th><th>名字</th><th>物种</th><th>品种</th><th>性别</th><th>年龄</th><th>体重</th><th>主人</th><th>服务次数</th><th>操作</th>' +
                            '</tr></thead><tbody>';
                        visibleItems.forEach(function(p, i) {
                            var globalIdx = range.start + i;
                            html += renderPetTableRow(p, globalIdx);
                        });
                        html += '</tbody></table></div>';
                        return html;
                    }
                });
                tableVirtualScroller.render();

                $tableView.off('scroll.virtual').on('scroll.virtual', function() {
                    if (tableVirtualScroller) {
                        tableVirtualScroller.updateScrollTop(this.scrollTop);
                        bindPetTableEvents();
                    }
                });
            } else {
                tableVirtualScroller.updateItems(list);
                bindPetTableEvents();
            }

            $cardView.prepend('<div class="alert alert-info py-2 px-3 mb-2 small" style="margin:8px;"><i class="bi bi-info-circle me-1"></i>虚拟滚动已启用（' + list.length + ' 条记录）</div>');
            $tableView.prepend('<div class="alert alert-info py-2 px-3 mb-2 small" style="margin:8px;"><i class="bi bi-info-circle me-1"></i>虚拟滚动已启用（' + list.length + ' 条记录）</div>');

            if (selectedPetId) {
                $cardView.find('.pet-card[data-pet-id="' + selectedPetId + '"]').addClass('border-primary border-2');
            }
        } else {
            if (cardVirtualScroller) {
                cardVirtualScroller = null;
                $cardView.off('scroll.virtual');
            }
            if (tableVirtualScroller) {
                tableVirtualScroller = null;
                $tableView.off('scroll.virtual');
            }
            $cardView.css({
                'max-height': 'none',
                'overflow-y': 'visible',
                'padding': '0'
            });
            $tableView.css({
                'max-height': 'none',
                'overflow-y': 'visible',
                'padding': '0'
            });

            var cardHtml = '<div class="row g-3">';
            list.forEach(function(pet) {
                cardHtml += renderPetCardItem(pet);
            });
            cardHtml += '</div>';
            $cardView.html(cardHtml);
            if (selectedPetId) {
                $cardView.find('.pet-card[data-pet-id="' + selectedPetId + '"]').addClass('border-primary border-2');
            }
            bindPetCardEvents();

            var tableHtml = '';
            if (list.length) {
                tableHtml = '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr>' +
                    '<th>照片</th><th>名字</th><th>物种</th><th>品种</th><th>性别</th><th>年龄</th><th>体重</th><th>主人</th><th>服务次数</th><th>操作</th>' +
                    '</tr></thead><tbody>';
                list.forEach(function(p, idx) {
                    tableHtml += renderPetTableRow(p, idx);
                });
                tableHtml += '</tbody></table></div>';
            }
            $tableView.html(tableHtml);
            bindPetTableEvents();
        }
    }

    function openPetModal(pet) {
        var customers = App.store.getCustomers();
        var isEdit = pet && pet.id;
        var body = App.components.petCard.renderForm(pet || {}, customers);
        var footer = '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button class="btn btn-primary" id="btnSavePet"><i class="bi bi-check2 me-1"></i>' + (isEdit ? '保存修改' : '创建档案') + '</button>';
        App.showModal(isEdit ? '编辑宠物档案' : '新建宠物档案', body, footer);

        $('#btnSavePet').on('click', function() {
            var data = App.components.petCard.collectForm();
            if (!data.name) { App.showToast('请填写宠物名', 'warning'); return; }
            if (isEdit) data.id = pet.id;
            App.store.savePet(data);
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast((isEdit ? '修改' : '创建') + '成功', 'success');
            refreshView();
        });
    }

    App.pages.pets = {
        render: render,
        bind: bind
    };

})(typeof window !== 'undefined' ? window : this);
