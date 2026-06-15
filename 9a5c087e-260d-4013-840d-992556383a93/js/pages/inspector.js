var InspectorPage = (function () {
    var _unsubs = [];
    var _selectedImages = [];
    var _statusFilter = 'all';

    function _renderForm($form) {
        var fps = Store.get('floodPoints') || [];
        var optionsHtml = fps.map(function (fp) {
            var levelText = ['正常', '轻度', '中度', '重度'][fp.level];
            return '<option value="' + fp.id + '" data-name="' + fp.name + '" data-level="' + fp.level + '">'
                + fp.id + ' - ' + fp.name + ' [' + levelText + ']</option>';
        }).join('');

        var dangerTypesHtml = MockData.DANGER_TYPES.map(function (t) {
            return '<option value="' + t + '">' + t + '</option>';
        }).join('');

        var inspectorsHtml = MockData.INSPECTOR_NAMES.map(function (n, i) {
            return '<option value="' + n + '"' + (i === 0 ? ' selected' : '') + '>' + n + '</option>';
        }).join('');

        var html = [
            '<div class="card card-dashboard">',
            '<div class="card-header">',
            '<h6 class="mb-0 fw-bold"><i class="bi bi-pencil-square me-1 text-success"></i>巡查险情上报</h6>',
            '<span class="text-muted small">巡查员现场登记</span>',
            '</div>',
            '<div class="card-body">',
            '<form id="inspectionForm" novalidate>',
            '<div class="row g-3">',
            '<div class="col-md-6">',
            '<label class="form-label small fw-bold">巡查员 <span class="text-danger">*</span></label>',
            '<select class="form-select" id="inspInspector" required>' + inspectorsHtml + '</select>',
            '</div>',
            '<div class="col-md-6">',
            '<label class="form-label small fw-bold">易涝点位 <span class="text-danger">*</span></label>',
            '<select class="form-select" id="inspFloodPoint" required>'
            + '<option value="">请选择点位</option>'
            + optionsHtml + '</select>',
            '</div>',
            '<div class="col-md-4">',
            '<label class="form-label small fw-bold">险情类型 <span class="text-danger">*</span></label>',
            '<select class="form-select" id="inspDangerType" required>'
            + '<option value="">请选择类型</option>'
            + dangerTypesHtml + '</select>',
            '</div>',
            '<div class="col-md-4">',
            '<label class="form-label small fw-bold">积水深度 (cm) <span class="text-danger">*</span></label>',
            '<div class="input-group">',
            '<input type="number" class="form-control" id="inspDepth" min="0" max="500" step="1" placeholder="0-500" required>',
            '<span class="input-group-text">cm</span>',
            '</div>',
            '</div>',
            '<div class="col-md-4">',
            '<label class="form-label small fw-bold">影响范围 (m²)</label>',
            '<div class="input-group">',
            '<input type="number" class="form-control" id="inspAffected" min="0" placeholder="估算面积" value="200">',
            '<span class="input-group-text">m²</span>',
            '</div>',
            '</div>',
            '<div class="col-12">',
            '<label class="form-label small fw-bold">现场描述</label>',
            '<textarea class="form-control" id="inspDescription" rows="3" placeholder="描述现场情况、人员受困、财产损失等..."></textarea>',
            '</div>',
            '<div class="col-12">',
            '<label class="form-label small fw-bold">现场照片 <span class="text-muted small">(可多选，最多6张)</span></label>',
            '<div class="border-2 border-dashed rounded p-3 text-center bg-light" style="border-style:dashed;border-color:#dee2e6;">',
            '<input type="file" class="d-none" id="inspImageInput" accept="image/*" multiple>',
            '<button type="button" class="btn btn-outline-secondary btn-sm" id="inspChooseBtn">',
            '<i class="bi bi-camera me-1"></i>选择照片',
            '</button>',
            '<div class="mt-3 d-flex flex-wrap gap-2" id="imagePreviewArea"></div>',
            '</div>',
            '</div>',
            '<div class="col-12 d-flex justify-content-between align-items-center pt-2">',
            '<div id="inspValidationMsg" class="text-danger small"></div>',
            '<div class="d-flex gap-2">',
            '<button type="reset" class="btn btn-outline-secondary" id="inspResetBtn">重置</button>',
            '<button type="submit" class="btn btn-primary">',
            '<i class="bi bi-send me-1"></i>提交上报',
            '</button>',
            '</div>',
            '</div>',
            '</div>',
            '</form>',
            '</div>',
            '</div>'
        ].join('');

        $form.html(html);

        $('#inspChooseBtn').on('click', function () {
            $('#inspImageInput').click();
        });

        $('#inspImageInput').on('change', function (e) {
            var files = Array.from(e.target.files || []);
            files.forEach(function (file) {
                if (_selectedImages.length >= 6) return;
                var reader = new FileReader();
                reader.onload = function (ev) {
                    _selectedImages.push({
                        name: file.name,
                        size: file.size,
                        data: ev.target.result
                    });
                    _renderImagePreviews();
                };
                reader.readAsDataURL(file);
            });
            $(this).val('');
        });

        $('#inspResetBtn').on('click', function () {
            setTimeout(function () {
                _selectedImages = [];
                _renderImagePreviews();
            }, 50);
        });

        $('#inspectionForm').on('submit', function (e) {
            e.preventDefault();
            var inspector = $('#inspInspector').val();
            var floodPoint = $('#inspFloodPoint').val();
            var dangerType = $('#inspDangerType').val();
            var depth = parseInt($('#inspDepth').val(), 10);
            var affected = parseInt($('#inspAffected').val(), 10) || 0;
            var description = $('#inspDescription').val().trim();
            var fpName = $('#inspFloodPoint option:selected').data('name');

            if (!floodPoint || !dangerType || isNaN(depth) || depth < 0) {
                $('#inspValidationMsg').text('请填写所有必填项（点位、类型、深度）').addClass('alert-flash');
                setTimeout(function () { $('#inspValidationMsg').removeClass('alert-flash'); }, 600);
                return;
            }

            var newInsp = Store.addInspection({
                inspector: inspector,
                floodPoint: floodPoint,
                floodPointName: fpName,
                dangerType: dangerType,
                depth: depth,
                affected: affected,
                description: description,
                images: _selectedImages.map(function (img) { return { name: img.name, data: img.data }; })
            });

            if (newInsp) {
                App.showToast('success', '上报成功', inspector + ' 的险情已提交，相关部门将尽快处理');
                $(this).trigger('reset');
                _selectedImages = [];
                _renderImagePreviews();
            } else {
                App.showToast('danger', '上报失败', '请稍后重试');
            }
        });
    }

    function _renderImagePreviews() {
        var $area = $('#imagePreviewArea');
        if (!_selectedImages.length) {
            $area.html('<div class="text-muted small w-100">暂未选择照片</div>');
            return;
        }
        var html = '';
        _selectedImages.forEach(function (img, idx) {
            var sizeKb = (img.size / 1024).toFixed(1);
            html += '<div class="position-relative">'
                + '<img src="' + img.data + '" class="image-preview" alt="' + img.name + '">'
                + '<button type="button" class="btn-close position-absolute top-0 end-0 m-1 remove-image" '
                + 'data-index="' + idx + '" style="background-color:rgba(0,0,0,0.6);"></button>'
                + '<div class="xsmall text-muted text-center mt-1">' + sizeKb + 'KB</div>'
                + '</div>';
        });
        $area.html(html);
        $area.find('.remove-image').on('click', function () {
            var idx = $(this).data('index');
            _selectedImages.splice(idx, 1);
            _renderImagePreviews();
        });
    }

    function _renderList($list) {
        var inspections = Store.get('inspections') || [];
        var filtered = _statusFilter === 'all'
            ? inspections
            : inspections.filter(function (i) { return i.status === _statusFilter; });

        var counts = { all: inspections.length };
        inspections.forEach(function (i) { counts[i.status] = (counts[i.status] || 0) + 1; });

        var headerHtml = '<div class="d-flex gap-2 mb-3 flex-wrap">'
            + ['all', '待处理', '处理中', '已解决'].map(function (s) {
                var label = s === 'all' ? '全部' : s;
                var count = counts[s] || 0;
                var active = _statusFilter === s ? 'btn-primary' : 'btn-outline-secondary';
                return '<button class="btn btn-sm ' + active + ' filter-btn" data-status="' + s + '">'
                    + label + ' <span class="badge bg-white text-dark ms-1">' + count + '</span></button>';
            }).join('')
            + '</div>';

        if (!filtered.length) {
            $list.html(headerHtml + '<div class="text-center text-muted py-5"><i class="bi bi-inbox display-4 d-block mb-2 opacity-30"></i>暂无记录</div>');
        } else {
            var itemsHtml = filtered.map(function (i) {
                var levelBadge = i.depth > 50 ? 'bg-danger' : i.depth > 20 ? 'bg-warning' : 'bg-info';
                var statusBadge = i.status === '已解决' ? 'bg-success'
                    : i.status === '处理中' ? 'bg-primary' : 'bg-secondary';
                var imagesHtml = (i.images || []).slice(0, 3).map(function (img) {
                    return '<img src="' + img.data + '" class="image-preview me-1" style="width:56px;height:56px;" alt="现场照片">';
                }).join('');

                return '<div class="card mb-2 inspection-card border-'
                    + (i.status === '已解决' ? 'success' : i.status === '处理中' ? 'primary' : 'secondary') + '">'
                    + '<div class="card-body p-3">'
                    + '<div class="d-flex justify-content-between align-items-start mb-2">'
                    + '<div>'
                    + '<strong class="me-2"><i class="bi bi-person me-1"></i>' + i.inspector + '</strong>'
                    + '<span class="badge ' + statusBadge + ' me-1">' + i.status + '</span>'
                    + '<span class="badge ' + levelBadge + '">水深 ' + i.depth + 'cm</span>'
                    + '</div>'
                    + '<small class="text-muted">' + i.time + '</small>'
                    + '</div>'
                    + '<div class="mb-2"><i class="bi bi-geo-alt me-1 text-danger"></i><strong>' + i.floodPointName + '</strong> <span class="text-muted">- ' + i.dangerType + '</span></div>'
                    + '<div class="small mb-2">' + (i.description || '（无描述）') + '</div>'
                    + (i.affected ? '<div class="small text-muted mb-2">影响范围：约 ' + i.affected + ' m²</div>' : '')
                    + (imagesHtml ? '<div class="mb-2">' + imagesHtml + '</div>' : '')
                    + '<div class="d-flex justify-content-end gap-2">'
                    + (i.status !== '已解决'
                        ? '<button class="btn btn-sm btn-outline-success resolve-btn" data-id="' + i.id + '"><i class="bi bi-check-circle me-1"></i>标记已解决</button>'
                        + '<button class="btn btn-sm btn-outline-primary processing-btn" data-id="' + i.id + '"><i class="bi bi-arrow-repeat me-1"></i>处理中</button>'
                        : '')
                    + '<a href="#/dashboard?fp=' + i.floodPoint + '" class="btn btn-sm btn-outline-secondary"><i class="bi bi-geo me-1"></i>查看点位</a>'
                    + '</div>'
                    + '</div></div>';
            }).join('');

            $list.html(headerHtml + '<div style="max-height:70vh;overflow-y:auto;" class="pe-1">' + itemsHtml + '</div>');
        }

        $list.find('.filter-btn').on('click', function () {
            _statusFilter = $(this).data('status');
            _renderList($list);
        });

        $list.find('.resolve-btn').on('click', function () {
            Store.updateInspectionStatus($(this).data('id'), '已解决');
            App.showToast('success', '状态更新', '该险情已标记为已解决');
        });

        $list.find('.processing-btn').on('click', function () {
            Store.updateInspectionStatus($(this).data('id'), '处理中');
            App.showToast('info', '状态更新', '该险情已标记为处理中');
        });
    }

    function render($app, params) {
        var html = [
            '<div class="container-fluid p-0">',
            '<div class="row g-3">',
            '<div class="col-lg-5">',
            '<div id="inspectionFormContainer"></div>',
            '</div>',
            '<div class="col-lg-7">',
            '<div class="card card-dashboard">',
            '<div class="card-header">',
            '<h6 class="mb-0 fw-bold"><i class="bi bi-clipboard-data me-1 text-info"></i>巡查上报记录</h6>',
            '<span class="text-muted small">按状态筛选</span>',
            '</div>',
            '<div class="card-body" id="inspectionListContainer"></div>',
            '</div>',
            '</div>',
            '</div></div>'
        ].join('');

        $app.html(html);

        _selectedImages = [];
        _renderForm($('#inspectionFormContainer'));
        _renderList($('#inspectionListContainer'));

        _unsubs.push(Store.on('inspections', function () {
            _renderList($('#inspectionListContainer'));
        }));

        _unsubs.push(Store.on('floodPoints', function () {
            _renderForm($('#inspectionFormContainer'));
        }));
    }

    function cleanup() {
        _unsubs.forEach(function (fn) { try { fn(); } catch (e) { } });
        _unsubs = [];
        _selectedImages = [];
    }

    return { render: render, cleanup: cleanup };
})();

Router.register('inspector', InspectorPage.render, {
    title: '巡查上报',
    cleanup: InspectorPage.cleanup
});
