var ExpForm = (function() {
    var formState = {
        editingId: null,
        recipe: [],
        curve: [],
        photos: [],
        existingMedia: [],
        removeMediaIds: [],
        selectedDefects: []
    };

    function init() {
        $('#btnAddRecipeRow').on('click', function() { addRecipeRow(); });
        $('#btnAddCurveRow').on('click', function() { addCurveRow(); });
        $('#btnCurvePreview').on('click', function() {
            var curve = collectCurve();
            if (curve.length === 0) {
                AppState.publish('toast:show', { type: 'warning', message: '请先配置烧成曲线' });
                return;
            }
            FiringCurve.renderPreview(curve);
            new bootstrap.Modal(document.getElementById('curvePreviewModal')).show();
        });
        $('#btnSaveExp').on('click', saveExperiment);

        $('#defectTagsContainer').on('click', '.defect-tag-btn', function() {
            $(this).toggleClass('active');
        });

        $('#photoDropArea').on('click', function() { $('#photoInput').click(); });
        $('#photoInput').on('change', handlePhotoSelect);
        $('#photoDropArea').on('dragover', function(e) {
            e.preventDefault(); $(this).addClass('dragover');
        }).on('dragleave drop', function(e) {
            e.preventDefault(); $(this).removeClass('dragover');
        }).on('drop', function(e) {
            e.preventDefault();
            handleFiles(e.originalEvent.dataTransfer.files);
        });

        $('#materialModal').on('shown.bs.modal', function() { loadMaterialTable(); });
        $('#materialForm').on('submit', handleMaterialSubmit);
        $('#materialTableBody').on('click', '.btn-mat-edit', function() {
            var id = $(this).data('id');
            editMaterial(id);
        }).on('click', '.btn-mat-del', function() {
            var id = $(this).data('id');
            var name = $(this).data('name');
            Exporter.showConfirm('删除原料「' + name + '」？', function() {
                AppDB.deleteMaterial(id).then(function() {
                    loadMaterialTable();
                    AppState.publish('toast:show', { type: 'success', message: '原料已删除' });
                });
            });
        });
        $('#btnMaterials').on('click', function() {
            new bootstrap.Modal(document.getElementById('materialModal')).show();
        });
        $('#btnStats').on('click', function() {
            new bootstrap.Modal(document.getElementById('statsModal')).show();
        });

        $('#expFormModal').on('shown.bs.modal', function() {
            if (!formState.editingId) resetForm();
        }).on('hidden.bs.modal', function() {
            formState.editingId = null;
        });

        AppState.subscribe('material:changed', function() {
            populateMaterialDatalist();
        });
        populateMaterialDatalist();
    }

    function populateMaterialDatalist() {
        var mats = AppState.get('materialsCache') || [];
        var html = mats.map(function(m) { return '<option value="' + m.name + '">'; }).join('');
        $('#materialDatalist').html(html);
    }

    function resetForm() {
        $('#expForm')[0].reset();
        $('#expId').val('');
        $('#expFormTitle').html('<i class="bi bi-journal-plus me-2"></i>新建实验');
        $('#expDate').val(new Date().toISOString().split('T')[0]);
        formState.recipe = [];
        formState.curve = [];
        formState.photos = [];
        formState.existingMedia = [];
        formState.removeMediaIds = [];
        formState.selectedDefects = [];
        $('#recipeBody').empty();
        $('#curveBody').empty();
        $('#photoPreview').empty();
        $('.defect-tag-btn').removeClass('active');
        addRecipeRow();
        addRecipeRow();
        addRecipeRow();
        addCurveRow({ type: '升温', tempFrom: 25, tempTo: 600, durationMin: 120 });
        addCurveRow({ type: '升温', tempFrom: 600, tempTo: 1220, durationMin: 180 });
        addCurveRow({ type: '保温', tempFrom: 1220, tempTo: 1220, durationMin: 30 });
        addCurveRow({ type: '降温', tempFrom: 1220, tempTo: 200, durationMin: 240 });
        updateRecipeTotal();
    }

    function openForEdit(expId) {
        AppDB.getExperimentWithMedia(expId).then(function(exp) {
            if (!exp) return;
            formState.editingId = expId;
            $('#expId').val(expId);
            $('#expFormTitle').html('<i class="bi bi-pencil-square me-2"></i>编辑实验');
            $('#expName').val(exp.name || '');
            $('#expDate').val(exp.date || '');
            $('#expCategory').val(exp.glazeCategory || '青瓷');
            $('#expKiln').val(exp.kilnType || '电窑');
            $('#expAtmosphere').val(exp.atmosphere || '氧化');
            $('#expCone').val(exp.cone || '6');
            $('#expNotes').val(exp.notes || '');

            $('#recipeBody').empty();
            (exp.recipe || []).forEach(function(r) { addRecipeRow(r); });
            if ((exp.recipe || []).length === 0) addRecipeRow();

            $('#curveBody').empty();
            (exp.firingCurve || []).forEach(function(c) { addCurveRow(c); });
            if ((exp.firingCurve || []).length === 0) addCurveRow();

            formState.existingMedia = exp.media || [];
            formState.photos = [];
            formState.removeMediaIds = [];
            renderPhotoPreview();

            $('.defect-tag-btn').removeClass('active');
            (exp.defectTags || []).forEach(function(t) {
                $('.defect-tag-btn[data-value="' + t + '"]').addClass('active');
            });

            updateRecipeTotal();
            new bootstrap.Modal(document.getElementById('expFormModal')).show();
        });
    }

    function addRecipeRow(data) {
        data = data || {};
        var mats = AppState.get('materialsCache') || [];
        var rowId = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        var tr = $('<tr data-rowid="' + rowId + '"></tr>');
        var matOptions = mats.map(function(m) {
            return '<option value="' + m.name + '"' + (data.materialName === m.name ? ' selected' : '') + '>' + m.name + '</option>';
        }).join('');
        tr.html(
            '<td style="position:relative;">' +
                '<div class="input-group input-group-sm">' +
                    '<input type="text" class="form-control mat-name" list="matList_' + rowId + '" placeholder="原料名" value="' + (data.materialName || '') + '">' +
                    '<datalist id="matList_' + rowId + '">' + matOptions + '</datalist>' +
                '</div>' +
            '</td>' +
            '<td><input type="number" class="form-control form-control-sm mat-percent" min="0" max="100" step="0.1" value="' + (data.percentage || '') + '" placeholder="%"></td>' +
            '<td><small class="mat-range text-muted">--</small></td>' +
            '<td><button type="button" class="btn btn-sm btn-outline-danger btn-del-row"><i class="bi bi-x"></i></button></td>'
        );
        $('#recipeBody').append(tr);
        bindRecipeRowEvents(tr, rowId);
        updateMatRange(tr.find('.mat-name').val(), tr);
    }

    function bindRecipeRowEvents(tr) {
        tr.find('.mat-name').on('input', function() {
            updateMatRange($(this).val(), tr);
            updateRecipeTotal();
        });
        tr.find('.mat-percent').on('input', updateRecipeTotal);
        tr.find('.btn-del-row').on('click', function() {
            tr.remove();
            updateRecipeTotal();
        });
    }

    function updateMatRange(name, tr) {
        var mats = AppState.get('materialsCache') || [];
        var mat = mats.find(function(m) { return m.name === name; });
        if (mat && (mat.minRange != null || mat.maxRange != null)) {
            tr.find('.mat-range').text(mat.minRange + ' ~ ' + mat.maxRange + '%');
        } else {
            tr.find('.mat-range').text('--');
        }
    }

    function updateRecipeTotal() {
        var total = 0;
        $('#recipeBody tr').each(function() {
            var v = parseFloat($(this).find('.mat-percent').val());
            if (!isNaN(v)) total += v;
        });
        $('#recipeTotalVal').text(total.toFixed(1));
        var badge = $('#recipeTotalBadge');
        badge.removeClass('badge-total-ok badge-total-warn badge-total-err bg-secondary');
        if (total === 0) { badge.addClass('bg-secondary').text('--'); }
        else if (Math.abs(total - 100) < 0.5) { badge.addClass('badge-total-ok').text('✓ 标准'); }
        else if (Math.abs(total - 100) < 5) { badge.addClass('badge-total-warn').text('±' + (total - 100).toFixed(1) + '%'); }
        else { badge.addClass('badge-total-err').text((total > 100 ? '+' : '') + (total - 100).toFixed(1) + '%'); }
    }

    function addCurveRow(data) {
        data = data || { type: '升温', tempFrom: '', tempTo: '', durationMin: '' };
        var idx = $('#curveBody tr').length + 1;
        var tr = $('<tr></tr>');
        tr.html(
            '<td><span class="curve-idx">' + idx + '</span></td>' +
            '<td><select class="form-select form-select-sm curve-type">' +
                '<option value="升温"' + (data.type === '升温' ? ' selected' : '') + '>升温</option>' +
                '<option value="保温"' + (data.type === '保温' ? ' selected' : '') + '>保温</option>' +
                '<option value="降温"' + (data.type === '降温' ? ' selected' : '') + '>降温</option>' +
            '</select></td>' +
            '<td><input type="number" class="form-control form-control-sm curve-from" min="0" max="1400" value="' + (data.tempFrom != null ? data.tempFrom : '') + '"></td>' +
            '<td><input type="number" class="form-control form-control-sm curve-to" min="0" max="1400" value="' + (data.tempTo != null ? data.tempTo : '') + '"></td>' +
            '<td><input type="number" class="form-control form-control-sm curve-dur" min="0" value="' + (data.durationMin != null ? data.durationMin : '') + '"></td>' +
            '<td><button type="button" class="btn btn-sm btn-outline-danger btn-del-curve"><i class="bi bi-x"></i></button></td>'
        );
        $('#curveBody').append(tr);
        tr.find('.btn-del-curve').on('click', function() {
            tr.remove();
            $('#curveBody tr').each(function(i) { $(this).find('.curve-idx').text(i + 1); });
        });
        tr.find('.curve-type').on('change', function() {
            if ($(this).val() === '保温') {
                tr.find('.curve-to').prop('disabled', true);
            } else {
                tr.find('.curve-to').prop('disabled', false);
            }
        }).trigger('change');
    }

    function handlePhotoSelect(e) {
        handleFiles(e.target.files);
        e.target.value = '';
    }

    function handleFiles(files) {
        var arr = Array.from(files || []).filter(function(f) { return f.type.startsWith('image/'); });
        if (arr.length === 0) return;
        if ((formState.photos.length + formState.existingMedia.length) >= 6) {
            AppState.publish('toast:show', { type: 'warning', message: '最多上传6张照片' });
            return;
        }
        var remaining = 6 - formState.photos.length - formState.existingMedia.length;
        arr = arr.slice(0, remaining);
        arr.forEach(function(file) {
            Exporter.compressImage(file, 1024).then(function(result) {
                formState.photos.push({ dataBase64: result.dataBase64, caption: file.name });
                renderPhotoPreview();
            }).catch(function(err) {
                AppState.publish('toast:show', { type: 'error', message: '图片处理失败：' + err.message });
            });
        });
    }

    function renderPhotoPreview() {
        var html = '';
        formState.existingMedia.forEach(function(m, i) {
            html += '<div class="col-4 col-sm-3"><div class="photo-thumb">' +
                '<img src="' + m.dataBase64 + '">' +
                '<button type="button" class="remove-btn" data-type="existing" data-idx="' + i + '"><i class="bi bi-x"></i></button>' +
                '</div></div>';
        });
        formState.photos.forEach(function(m, i) {
            html += '<div class="col-4 col-sm-3"><div class="photo-thumb">' +
                '<img src="' + m.dataBase64 + '">' +
                '<button type="button" class="remove-btn" data-type="new" data-idx="' + i + '"><i class="bi bi-x"></i></button>' +
                '</div></div>';
        });
        $('#photoPreview').html(html);
        $('#photoPreview').off('click', '.remove-btn').on('click', '.remove-btn', function() {
            var type = $(this).data('type');
            var idx = parseInt($(this).data('idx'));
            if (type === 'existing') {
                var removed = formState.existingMedia.splice(idx, 1)[0];
                if (removed && removed.id) formState.removeMediaIds.push(removed.id);
            } else {
                formState.photos.splice(idx, 1);
            }
            renderPhotoPreview();
        });
    }

    function collectRecipe() {
        var result = [];
        $('#recipeBody tr').each(function() {
            var name = $(this).find('.mat-name').val().trim();
            var pct = parseFloat($(this).find('.mat-percent').val());
            if (name && !isNaN(pct) && pct > 0) {
                result.push({ materialName: name, percentage: pct });
            }
        });
        return result;
    }

    function collectCurve() {
        var result = [];
        $('#curveBody tr').each(function() {
            var seg = {
                type: $(this).find('.curve-type').val(),
                tempFrom: parseFloat($(this).find('.curve-from').val()),
                tempTo: parseFloat($(this).find('.curve-to').val()),
                durationMin: parseFloat($(this).find('.curve-dur').val())
            };
            if (seg.type && !isNaN(seg.durationMin) && seg.durationMin > 0) {
                if (isNaN(seg.tempFrom)) seg.tempFrom = 0;
                if (seg.type === '保温') seg.tempTo = seg.tempFrom;
                else if (isNaN(seg.tempTo)) seg.tempTo = seg.tempFrom;
                result.push(seg);
            }
        });
        return result;
    }

    function collectDefects() {
        var tags = [];
        $('.defect-tag-btn.active').each(function() { tags.push($(this).data('value')); });
        return tags;
    }

    function saveExperiment() {
        var name = $('#expName').val().trim();
        var date = $('#expDate').val();
        if (!name) { AppState.publish('toast:show', { type: 'error', message: '请填写实验名称' }); return; }
        if (!date) { AppState.publish('toast:show', { type: 'error', message: '请选择实验日期' }); return; }

        var expDate = new Date(date);
        var today = new Date();
        today.setHours(23, 59, 59, 999);
        if (expDate > today) {
            AppState.publish('toast:show', { type: 'error', message: '实验日期不能晚于今天' });
            return;
        }

        var recipe = collectRecipe();
        if (recipe.length === 0) { AppState.publish('toast:show', { type: 'error', message: '请至少添加一种原料' }); return; }

        var recipeTotal = 0;
        recipe.forEach(function(r) { recipeTotal += r.percentage; });
        if (recipeTotal <= 0) {
            AppState.publish('toast:show', { type: 'error', message: '配方合计不能为0%' });
            return;
        }

        var curve = collectCurve();
        for (var ci = 0; ci < curve.length; ci++) {
            var seg = curve[ci];
            var segIdx = ci + 1;
            if (seg.type === '升温') {
                if (!(seg.tempFrom < seg.tempTo)) {
                    AppState.publish('toast:show', { type: 'error', message: '第' + segIdx + '阶段（升温）温度不合法：起始温度需低于结束温度' });
                    return;
                }
            } else if (seg.type === '保温') {
                if (Math.abs(seg.tempFrom - seg.tempTo) > 0.5) {
                    AppState.publish('toast:show', { type: 'error', message: '第' + segIdx + '阶段（保温）温度不合法：起始温度需等于结束温度' });
                    return;
                }
            } else if (seg.type === '降温') {
                if (!(seg.tempFrom > seg.tempTo)) {
                    AppState.publish('toast:show', { type: 'error', message: '第' + segIdx + '阶段（降温）温度不合法：起始温度需高于结束温度' });
                    return;
                }
            }
        }

        function doSave() {
            var expData = {
                name: name,
                date: date,
                glazeCategory: $('#expCategory').val(),
                kilnType: $('#expKiln').val(),
                atmosphere: $('#expAtmosphere').val(),
                cone: $('#expCone').val(),
                recipe: recipe,
                firingCurve: curve,
                defectTags: collectDefects(),
                notes: $('#expNotes').val().trim()
            };

            var allMedia = formState.existingMedia.concat(formState.photos.map(function(p) { return { dataBase64: p.dataBase64 }; }));
            var mediaIds = allMedia.map(function(m) { return m.id; }).filter(function(x) { return x; });
            expData.mediaIds = mediaIds;
            expData.firstMediaThumb = allMedia[0] ? allMedia[0].dataBase64 : null;

            var promise;
            if (formState.editingId) {
                expData.updatedAt = new Date().toISOString();
                promise = AppDB.updateExperiment(formState.editingId, expData, formState.photos, formState.removeMediaIds);
            } else {
                expData.createdAt = new Date().toISOString();
                expData.updatedAt = expData.createdAt;
                promise = AppDB.createExperiment(expData, formState.photos);
            }

            promise.then(function() {
                bootstrap.Modal.getInstance(document.getElementById('expFormModal')).hide();
                AppState.publish(formState.editingId ? 'exp:updated' : 'exp:created', expData);
                AppState.publish('toast:show', { type: 'success', message: formState.editingId ? '实验已更新' : '实验已保存' });
                formState.editingId = null;
            }).catch(function(err) {
                console.error(err);
                AppState.publish('toast:show', { type: 'error', message: '保存失败：' + err.message });
            });
        }

        if (Math.abs(recipeTotal - 100) > 5) {
            Exporter.showConfirm('配方合计为 ' + recipeTotal.toFixed(1) + '%，是否仍然保存？', doSave);
        } else {
            doSave();
        }
    }

    function loadMaterialTable() {
        AppDB.getMaterials().then(function(mats) {
            var html = mats.map(function(m) {
                return '<tr>' +
                    '<td><strong>' + m.name + '</strong></td>' +
                    '<td><code class="small">' + (m.chemicalFormula || '-') + '</code></td>' +
                    '<td><small class="text-muted">' + (m.minRange != null ? m.minRange : '-') + ' ~ ' + (m.maxRange != null ? m.maxRange : '-') + '%</small></td>' +
                    '<td><span class="badge bg-clay">' + (m.usageCount || 0) + '</span></td>' +
                    '<td><small class="text-muted">' + (m.notes || '-') + '</small></td>' +
                    '<td class="text-end">' +
                        '<button class="btn btn-sm btn-outline-secondary btn-mat-edit me-1" data-id="' + m.id + '"><i class="bi bi-pencil"></i></button>' +
                        '<button class="btn btn-sm btn-outline-danger btn-mat-del" data-id="' + m.id + '" data-name="' + m.name + '"><i class="bi bi-trash"></i></button>' +
                    '</td></tr>';
            }).join('');
            $('#materialTableBody').html(html || '<tr><td colspan="6" class="text-center text-muted py-3">暂无原料</td></tr>');
        });
    }

    function editMaterial(id) {
        AppDB.getDB().materials.get(parseInt(id)).then(function(m) {
            if (!m) return;
            $('#matId').val(m.id);
            $('#matName').val(m.name || '');
            $('#matFormula').val(m.chemicalFormula || '');
            $('#matMin').val(m.minRange != null ? m.minRange : '');
            $('#matMax').val(m.maxRange != null ? m.maxRange : '');
            $('#matNotes').val(m.notes || '');
        });
    }

    function handleMaterialSubmit(e) {
        e.preventDefault();
        var id = $('#matId').val();
        var data = {
            name: $('#matName').val().trim(),
            chemicalFormula: $('#matFormula').val().trim(),
            minRange: $('#matMin').val() !== '' ? parseFloat($('#matMin').val()) : null,
            maxRange: $('#matMax').val() !== '' ? parseFloat($('#matMax').val()) : null,
            notes: $('#matNotes').val().trim()
        };
        if (!data.name) {
            AppState.publish('toast:show', { type: 'error', message: '请输入原料名称' });
            return;
        }
        var p = id ? AppDB.updateMaterial(id, data) : AppDB.createMaterial($.extend({ usageCount: 0 }, data));
        p.then(function() {
            AppState.publish('toast:show', { type: 'success', message: id ? '原料已更新' : '原料已添加' });
            $('#materialForm')[0].reset();
            $('#matId').val('');
            loadMaterialTable();
        }).catch(function(err) {
            AppState.publish('toast:show', { type: 'error', message: err.message || '保存失败' });
        });
    }

    return {
        init: init,
        openForEdit: openForEdit,
        resetForm: resetForm
    };
})();
