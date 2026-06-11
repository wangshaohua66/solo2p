var ExpDetail = (function() {
    var currentExpId = null;
    var detailCurveChart = null;
    var compareZoom = 100;
    var compareShowLabels = false;

    function init() {
        AppState.subscribe('exp:selected', function(id) {
            showDetail(id);
        });
        AppState.subscribe('exp:updated', function() {
            if (currentExpId) showDetail(currentExpId);
        });
        AppState.subscribe('compare:changed', function() {
            if ($('#compareModal').hasClass('show')) renderCompareGrid();
        });

        $('#detailOffcanvas').on('hidden.bs.offcanvas', function() {
            currentExpId = null;
            if (detailCurveChart) { detailCurveChart.destroy(); detailCurveChart = null; }
        });

        $('#compareZoom').on('input', function() {
            compareZoom = parseInt($(this).val());
            $('#compareZoomVal').text(compareZoom + '%');
            applyCompareZoom();
        });
        $('#compareShowLabels').on('change', function() {
            compareShowLabels = $(this).prop('checked');
            $('.compare-label-overlay').toggle(compareShowLabels);
        });

        $('#compareModal').on('shown.bs.modal', renderCompareGrid);
    }

    function showDetail(id) {
        currentExpId = id;
        AppDB.getExperimentWithMedia(id).then(function(exp) {
            if (!exp) return;
            $('#detailTitle').text(exp.name || '实验详情');

            var mediaHtml = '';
            if (exp.media && exp.media.length > 0) {
                mediaHtml = '<div class="detail-section">' +
                    '<h6><i class="bi bi-image me-2"></i>釉面照片 (' + exp.media.length + ')</h6>';
                if (exp.media.length === 1) {
                    mediaHtml += '<img src="' + exp.media[0].dataBase64 + '" class="detail-img mb-2" alt="">';
                } else {
                    mediaHtml += '<div class="row g-2">';
                    exp.media.forEach(function(m) {
                        mediaHtml += '<div class="col-6"><img src="' + m.dataBase64 + '" class="detail-img" alt="" style="max-height:180px;"></div>';
                    });
                    mediaHtml += '</div>';
                }
                mediaHtml += '</div>';
            }

            var recipeHtml = '<div class="detail-section">' +
                '<h6><i class="bi bi-flask me-2"></i>原料配方</h6>' +
                '<table class="table table-sm recipe-table">' +
                '<thead><tr><th>原料</th><th class="text-end">百分比</th><th class="text-end">占比</th></tr></thead><tbody>';
            var total = 0;
            (exp.recipe || []).forEach(function(r) { total += r.percentage || 0; });
            (exp.recipe || []).forEach(function(r) {
                var pct = r.percentage || 0;
                var w = total > 0 ? (pct / total * 100) : 0;
                recipeHtml += '<tr><td>' + escapeHtml(r.materialName) + '</td>' +
                    '<td class="text-end"><strong>' + pct.toFixed(1) + '%</strong></td>' +
                    '<td class="text-end" style="width:40%;"><div class="progress" style="height:6px;"><div class="progress-bar bg-clay" style="width:' + w + '%"></div></div></td></tr>';
            });
            recipeHtml += '<tr class="table-active"><td><strong>合计</strong></td><td class="text-end"><strong>' + total.toFixed(1) + '%</strong></td><td></td></tr>';
            recipeHtml += '</tbody></table></div>';

            var curveHtml = '';
            if (exp.firingCurve && exp.firingCurve.length > 0) {
                curveHtml = '<div class="detail-section">' +
                    '<h6><i class="bi bi-graph-up me-2"></i>烧成曲线</h6>' +
                    '<canvas id="detailCurveChart" height="200"></canvas>' +
                    '<div class="mt-2"><small class="text-muted">';
                exp.firingCurve.forEach(function(seg, i) {
                    curveHtml += '<span class="badge bg-secondary me-1 mb-1">#' + (i + 1) + ' ' + seg.type + ' ' +
                        (seg.tempFrom || '?') + '→' + (seg.tempTo || '?') + '℃ / ' + seg.durationMin + 'min</span>';
                });
                curveHtml += '</small></div></div>';
            }

            var defectHtml = '';
            if (exp.defectTags && exp.defectTags.length > 0) {
                defectHtml = '<div class="detail-section"><h6><i class="bi bi-exclamation-triangle me-2"></i>缺陷标签</h6><div class="d-flex flex-wrap gap-1">';
                exp.defectTags.forEach(function(d) {
                    defectHtml += '<span class="mini-tag" style="background:#FDE0E0;color:#842029;">' + d + '</span>';
                });
                defectHtml += '</div></div>';
            }

            var notesHtml = '';
            if (exp.notes) {
                notesHtml = '<div class="detail-section"><h6><i class="bi bi-journal-text me-2"></i>备注</h6>' +
                    '<p class="small text-muted mb-0" style="white-space:pre-wrap;">' + escapeHtml(exp.notes) + '</p></div>';
            }

            var metaHtml = '<div class="detail-section">' +
                '<h6><i class="bi bi-info-circle me-2"></i>基础信息</h6>' +
                '<div class="row g-2 small">' +
                '<div class="col-6"><span class="text-muted">日期：</span>' + (exp.date || '-') + '</div>' +
                '<div class="col-6"><span class="text-muted">分类：</span>' + (exp.glazeCategory || '-') + '</div>' +
                '<div class="col-6"><span class="text-muted">窑炉：</span>' + (exp.kilnType || '-') + '</div>' +
                '<div class="col-6"><span class="text-muted">锥号：</span>' + (exp.cone ? '锥' + exp.cone : '-') + '</div>' +
                '<div class="col-6"><span class="text-muted">气氛：</span>' + (exp.atmosphere || '-') + '</div>' +
                '<div class="col-6"><span class="text-muted">创建：</span>' + formatDateTime(exp.createdAt) + '</div>' +
                '</div></div>';

            var inCompare = AppState.isInCompare(exp.id);
            var actionsHtml = '<div class="d-flex gap-2 mt-3">' +
                '<button class="btn btn-sm ' + (inCompare ? 'btn-clay' : 'btn-outline-celadon') + '" id="btnDetailCompare">' +
                '<i class="bi ' + (inCompare ? 'bi-check2' : 'bi-plus') + ' me-1"></i>' + (inCompare ? '已加入对比' : '加入对比') + '</button>' +
                '<button class="btn btn-sm btn-outline-secondary" id="btnDetailEdit"><i class="bi bi-pencil me-1"></i>编辑</button>' +
                '<button class="btn btn-sm btn-outline-danger ms-auto" id="btnDetailDelete"><i class="bi bi-trash me-1"></i>删除</button>' +
                '</div>';

            $('#detailBody').html(metaHtml + mediaHtml + recipeHtml + curveHtml + defectHtml + notesHtml + actionsHtml);

            if (exp.firingCurve && exp.firingCurve.length > 0) {
                setTimeout(function() {
                    if (detailCurveChart) detailCurveChart.destroy();
                    detailCurveChart = FiringCurve.renderDetail('detailCurveChart', exp.firingCurve, exp.name);
                }, 100);
            }

            $('#btnDetailEdit').on('click', function() {
                bootstrap.Offcanvas.getInstance(document.getElementById('detailOffcanvas')).hide();
                ExpForm.openForEdit(exp.id);
            });
            $('#btnDetailDelete').on('click', function() {
                Exporter.showConfirm('确定删除实验「' + exp.name + '」吗？', function() {
                    AppDB.deleteExperiment(exp.id).then(function() {
                        if (AppState.isInCompare(exp.id)) AppState.toggleCompare(exp.id);
                        bootstrap.Offcanvas.getInstance(document.getElementById('detailOffcanvas')).hide();
                        AppState.publish('exp:deleted', exp.id);
                        AppState.publish('toast:show', { type: 'success', message: '实验已删除' });
                    });
                });
            });
            $('#btnDetailCompare').on('click', function() {
                AppState.toggleCompare(exp.id);
                $(this).toggleClass('btn-clay btn-outline-celadon')
                    .html('<i class="bi bi-' + (AppState.isInCompare(exp.id) ? 'check2' : 'plus') + ' me-1"></i>' +
                          (AppState.isInCompare(exp.id) ? '已加入对比' : '加入对比'));
            });

            new bootstrap.Offcanvas(document.getElementById('detailOffcanvas')).show();
        });
    }

    function renderCompareGrid() {
        var ids = AppState.get('compareIds');
        var $grid = $('#compareGrid');
        $grid.removeClass('cols-2 cols-3 cols-4');
        if (ids.length <= 1) {
            $grid.html('<div class="text-center text-muted py-5"><i class="bi bi-layers display-4 opacity-50"></i><p class="mt-3">请在列表中按住Ctrl/Shift点击选择2-4条实验进行对比</p></div>');
            return;
        }
        var cols = ids.length === 2 ? 2 : ids.length === 3 ? 3 : 4;
        $grid.addClass('cols-' + cols);

        Promise.all(ids.map(function(id) { return AppDB.getExperimentWithMedia(id); })).then(function(exps) {
            var html = '';
            exps.forEach(function(exp, idx) {
                if (!exp) return;
                var firstMedia = (exp.media && exp.media[0]) ? exp.media[0].dataBase64 : null;
                var defectTags = (exp.defectTags || []).map(function(d) {
                    return '<span class="mini-tag" style="background:rgba(220,53,69,0.85);color:#fff;">' + d + '</span>';
                }).join('');
                var glazeTags = '<span class="mini-tag celadon">' + (exp.glazeCategory || '-') + '</span>' +
                    '<span class="mini-tag">锥' + (exp.cone || '-') + '</span>' +
                    '<span class="mini-tag">' + (exp.atmosphere || '-') + '</span>';
                html += '<div class="compare-item">' +
                    '<div class="compare-item-header">' +
                        '<span title="' + escapeHtml(exp.name || '') + '">' + (idx + 1) + '. ' + escapeHtml(truncate(exp.name || '未命名', 24)) + '</span>' +
                        '<button class="btn btn-sm btn-outline-danger py-0 px-2" data-remove="' + exp.id + '"><i class="bi bi-x"></i></button>' +
                    '</div>' +
                    '<div class="compare-item-body">' +
                        (firstMedia ? '<img src="' + firstMedia + '" alt="" style="transform: scale(' + (compareZoom / 100) + ');">' :
                            '<div class="text-muted text-center"><i class="bi bi-image display-4 opacity-30"></i><p class="small mt-2">无照片</p></div>') +
                        '<div class="compare-label-overlay" style="display:' + (compareShowLabels ? 'flex' : 'none') + ';">' +
                            glazeTags + defectTags +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
            $grid.html(html);
            $grid.off('click', '[data-remove]').on('click', '[data-remove]', function() {
                var id = parseInt($(this).data('remove'));
                AppState.toggleCompare(id);
            });
        });
    }

    function applyCompareZoom() {
        $('.compare-item-body img').css('transform', 'scale(' + (compareZoom / 100) + ')');
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
    function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
    function formatDateTime(iso) {
        if (!iso) return '-';
        var d = new Date(iso);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    return {
        init: init,
        showDetail: showDetail
    };
})();
