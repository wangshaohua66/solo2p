var ExpDetail = (function() {
    var currentExpId = null;
    var compareZoom = 100;
    var compareShowLabels = false;
    var comparePanX = 0;
    var comparePanY = 0;
    var isDragging = false;
    var dragStartX = 0;
    var dragStartY = 0;
    var dragStartPanX = 0;
    var dragStartPanY = 0;

    function init() {
        AppState.subscribe('exp:selected', function(id) {
            currentExpId = id;
            if (window.innerWidth >= 1200) {
                AppDB.getExperimentWithMedia(id).then(function(exp) {
                    if (!exp) return;
                    $('#detailPanelHint').text('');
                    renderDetailTo('#detailPanelBody', exp);
                });
            } else {
                showDetail(id);
            }
        });
        AppState.subscribe('exp:updated', function() {
            if (currentExpId) {
                if (window.innerWidth >= 1200) {
                    AppDB.getExperimentWithMedia(currentExpId).then(function(exp) {
                        if (exp) renderDetailTo('#detailPanelBody', exp);
                    });
                } else {
                    showDetail(currentExpId);
                }
            }
        });
        AppState.subscribe('compare:changed', function() {
            if ($('#compareModal').hasClass('show')) renderCompare();
        });

        $('#detailOffcanvas').on('hidden.bs.offcanvas', function() {
            currentExpId = null;
            var lastChart = $('#detailBody').data('lastCurveChart');
            if (lastChart) { lastChart.destroy(); $('#detailBody').removeData('lastCurveChart'); }
        });

        $('#compareZoom').on('input', function() {
            compareZoom = parseInt($(this).val());
            $('#compareZoomVal').text(compareZoom + '%');
            applyCompareTransform();
        });
        $('#compareShowLabels').on('change', function() {
            compareShowLabels = $(this).prop('checked');
            $('.compare-label-overlay').toggle(compareShowLabels);
        });

        $('#compareModal').on('shown.bs.modal', function() {
            renderCompare();
        });

        bindCompareDrag();
    }

    function renderDetailTo(target, exp) {
        var $target = $(target);
        var isPanel = target === '#detailPanelBody';

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
                '<canvas class="detail-curve-canvas" height="200"></canvas>' +
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
            '<button class="btn btn-sm ' + (inCompare ? 'btn-clay' : 'btn-outline-celadon') + '" data-action="compare" data-id="' + exp.id + '">' +
            '<i class="bi ' + (inCompare ? 'bi-check2' : 'bi-plus') + ' me-1"></i>' + (inCompare ? '已加入对比' : '加入对比') + '</button>' +
            '<button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="' + exp.id + '"><i class="bi bi-pencil me-1"></i>编辑</button>' +
            '<button class="btn btn-sm btn-outline-danger ms-auto" data-action="delete" data-id="' + exp.id + '"><i class="bi bi-trash me-1"></i>删除</button>' +
            '</div>';

        var lastChart = $target.data('lastCurveChart');
        if (lastChart) { lastChart.destroy(); $target.removeData('lastCurveChart'); }

        $target.html(metaHtml + mediaHtml + recipeHtml + curveHtml + defectHtml + notesHtml + actionsHtml);

        if (exp.firingCurve && exp.firingCurve.length > 0) {
            setTimeout(function() {
                var $canvas = $target.find('.detail-curve-canvas');
                if ($canvas.length > 0) {
                    var canvasEl = $canvas[0];
                    if (!canvasEl.id) {
                        canvasEl.id = 'curve_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
                    }
                    var chart = FiringCurve.renderDetail(canvasEl.id, exp.firingCurve, exp.name);
                    $target.data('lastCurveChart', chart);
                }
            }, 100);
        }

        $target.off('click', '[data-action]').on('click', '[data-action]', function() {
            var action = $(this).data('action');
            var eid = $(this).data('id');
            if (action === 'edit') {
                if (!isPanel) {
                    bootstrap.Offcanvas.getInstance(document.getElementById('detailOffcanvas')).hide();
                }
                ExpForm.openForEdit(eid);
            } else if (action === 'delete') {
                Exporter.showConfirm('确定删除实验「' + exp.name + '」吗？', function() {
                    AppDB.deleteExperiment(eid).then(function() {
                        if (AppState.isInCompare(eid)) AppState.toggleCompare(eid);
                        if (!isPanel) {
                            bootstrap.Offcanvas.getInstance(document.getElementById('detailOffcanvas')).hide();
                        } else {
                            var panelChart = $target.data('lastCurveChart');
                            if (panelChart) { panelChart.destroy(); $target.removeData('lastCurveChart'); }
                            $target.html('<div class="text-center text-muted py-5"><i class="bi bi-journal-text display-4 opacity-50"></i><p class="mt-3">请选择一条记录</p></div>');
                            $('#detailPanelHint').text('请选择一条记录');
                        }
                        AppState.publish('exp:deleted', eid);
                        AppState.publish('toast:show', { type: 'success', message: '实验已删除' });
                    });
                });
            } else if (action === 'compare') {
                AppState.toggleCompare(eid);
                var nowIn = AppState.isInCompare(eid);
                $(this).toggleClass('btn-clay btn-outline-celadon')
                    .html('<i class="bi bi-' + (nowIn ? 'check2' : 'plus') + ' me-1"></i>' +
                          (nowIn ? '已加入对比' : '加入对比'));
            }
        });
    }

    function showDetail(id) {
        currentExpId = id;
        AppDB.getExperimentWithMedia(id).then(function(exp) {
            if (!exp) return;
            renderDetailTo('#detailBody', exp);
            new bootstrap.Offcanvas(document.getElementById('detailOffcanvas')).show();
        });
    }

    function renderCompare() {
        var ids = AppState.get('compareIds');
        var $modalBody = $('#compareModal .modal-body');
        if (ids.length <= 1) {
            $modalBody.find('.compare-toolbar').remove();
            $modalBody.find('.compare-grid-wrapper').remove();
            $modalBody.html('<div class="text-center text-muted py-5"><i class="bi bi-layers display-4 opacity-50"></i><p class="mt-3">请在列表中按住Ctrl/Shift点击选择2-4条实验进行对比</p></div>');
            return;
        }

        var cols = ids.length === 2 ? 2 : ids.length === 3 ? 3 : 4;
        comparePanX = 0;
        comparePanY = 0;

        Promise.all(ids.map(function(id) { return AppDB.getExperimentWithMedia(id); })).then(function(exps) {
            var toolbarHtml = '<div class="compare-toolbar d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">' +
                '<div class="d-flex align-items-center gap-2">' +
                    '<label class="form-label small mb-0">缩放:</label>' +
                    '<input type="range" min="50" max="300" value="' + compareZoom + '" id="compareZoom" class="form-range" style="width: 160px;">' +
                    '<span class="small text-muted" id="compareZoomVal">' + compareZoom + '%</span>' +
                '</div>' +
                '<div class="form-check form-switch">' +
                    '<input class="form-check-input" type="checkbox" id="compareShowLabels" ' + (compareShowLabels ? 'checked' : '') + '>' +
                    '<label class="form-check-label small" for="compareShowLabels">显示标签叠加</label>' +
                '</div>' +
            '</div>';

            var gridInner = '';
            exps.forEach(function(exp, idx) {
                if (!exp) return;
                var firstMedia = (exp.media && exp.media[0]) ? exp.media[0].dataBase64 : null;
                var defectTags = (exp.defectTags || []).map(function(d) {
                    return '<span class="mini-tag" style="background:rgba(220,53,69,0.85);color:#fff;">' + d + '</span>';
                }).join('');
                var glazeTags = '<span class="mini-tag celadon">' + (exp.glazeCategory || '-') + '</span>' +
                    '<span class="mini-tag">锥' + (exp.cone || '-') + '</span>' +
                    '<span class="mini-tag">' + (exp.atmosphere || '-') + '</span>';

                gridInner += '<div class="compare-item" data-exp-id="' + exp.id + '">' +
                    '<div class="compare-img-wrap" data-idx="' + idx + '">' +
                        (firstMedia ? '<img src="' + firstMedia + '" alt="" style="transform: translate(-50%, -50%) translate(' + comparePanX + 'px, ' + comparePanY + 'px) scale(' + (compareZoom / 100) + ');">' :
                            '<div class="text-muted text-center w-100"><i class="bi bi-image display-4 opacity-30"></i><p class="small mt-2">无照片</p></div>') +
                        '<div class="compare-caption">' + escapeHtml(truncate(exp.name || '未命名', 18)) + '</div>' +
                        '<button class="btn-compare-remove" data-remove="' + exp.id + '" title="从对比移除"><i class="bi bi-x"></i></button>' +
                        '<div class="compare-label-overlay" style="display:' + (compareShowLabels ? 'flex' : 'none') + ';">' +
                            glazeTags + defectTags +
                        '</div>' +
                    '</div>' +
                '</div>';
            });

            var colPercents = [];
            for (var i = 0; i < cols; i++) colPercents.push((100 / cols).toFixed(4) + '%');

            var draggersHtml = '';
            for (var d = 1; d < cols; d++) {
                draggersHtml += '<div class="compare-dragger" data-col-index="' + d + '" style="left: calc(' + colPercents.slice(0, d).reduce(function(a, b) { return a + parseFloat(b); }, 0) + '% - 3px);"></div>';
            }

            var gridHtml = '<div class="compare-grid-wrapper position-relative" style="width:100%;">' +
                '<div class="compare-grid cols-' + cols + '" id="compareGrid" style="grid-template-columns: ' + colPercents.join(' ') + ';">' +
                    gridInner +
                '</div>' +
                draggersHtml +
            '</div>';

            $modalBody.html(toolbarHtml + gridHtml);

            $modalBody.off('input', '#compareZoom').on('input', '#compareZoom', function() {
                compareZoom = parseInt($(this).val());
                $('#compareZoomVal').text(compareZoom + '%');
                applyCompareTransform();
            });

            $modalBody.off('change', '#compareShowLabels').on('change', '#compareShowLabels', function() {
                compareShowLabels = $(this).prop('checked');
                $('.compare-label-overlay').toggle(compareShowLabels);
            });

            $modalBody.off('click', '[data-remove]').on('click', '[data-remove]', function(e) {
                e.stopPropagation();
                var rid = parseInt($(this).data('remove'));
                AppState.toggleCompare(rid);
            });

            bindCompareDrag();
        });
    }

    function applyCompareTransform() {
        var s = compareZoom / 100;
        $('.compare-img-wrap img').each(function() {
            $(this).css('transform', 'translate(-50%, -50%) translate(' + comparePanX + 'px, ' + comparePanY + 'px) scale(' + s + ')');
        });
    }

    function bindCompareDrag() {
        $(document).off('mousedown.compare').on('mousedown.compare', '.compare-img-wrap img', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartPanX = comparePanX;
            dragStartPanY = comparePanY;
            $('body').css('cursor', 'grabbing');
        });

        $(document).off('mousemove.compare').on('mousemove.compare', function(e) {
            if (!isDragging) return;
            var dx = e.clientX - dragStartX;
            var dy = e.clientY - dragStartY;
            comparePanX = dragStartPanX + dx;
            comparePanY = dragStartPanY + dy;
            applyCompareTransform();
        });

        $(document).off('mouseup.compare').on('mouseup.compare mouseleave.compare', function() {
            if (isDragging) {
                isDragging = false;
                $('body').css('cursor', '');
            }
        });

        var colDragData = null;
        $(document).off('mousedown.dragger').on('mousedown.dragger', '.compare-dragger', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            var $dragger = $(this);
            $dragger.addClass('dragging');
            var colIndex = parseInt($dragger.data('col-index'));
            var $grid = $dragger.parent().find('.compare-grid');
            var gridWidth = $grid.width();
            var cols = $grid.children('.compare-item').length;
            var numCols = $grid.hasClass('cols-4') ? 4 : $grid.hasClass('cols-3') ? 3 : 2;

            var currentCols = [];
            var styleCols = $grid.css('grid-template-columns');
            if (styleCols && styleCols.indexOf('px') > -1) {
                var parts = styleCols.split(' ');
                parts.forEach(function(p) {
                    currentCols.push((parseFloat(p) / gridWidth * 100));
                });
            } else {
                for (var i = 0; i < numCols; i++) currentCols.push(100 / numCols);
            }

            colDragData = {
                dragger: $dragger,
                colIndex: colIndex,
                grid: $grid,
                gridWidth: gridWidth,
                currentCols: currentCols,
                startX: e.clientX,
                numCols: numCols
            };

            $('body').css('cursor', 'col-resize');
        });

        $(document).off('mousemove.dragger').on('mousemove.dragger', function(e) {
            if (!colDragData) return;
            e.preventDefault();
            var dx = e.clientX - colDragData.startX;
            var dxPct = dx / colDragData.gridWidth * 100;

            var leftIdx = colDragData.colIndex - 1;
            var rightIdx = colDragData.colIndex;
            var newLeft = colDragData.currentCols[leftIdx] + dxPct;
            var newRight = colDragData.currentCols[rightIdx] - dxPct;
            var minPct = 10;

            if (newLeft >= minPct && newRight >= minPct) {
                colDragData.currentCols[leftIdx] = newLeft;
                colDragData.currentCols[rightIdx] = newRight;
                var pctStr = colDragData.currentCols.map(function(c) { return c.toFixed(4) + '%'; }).join(' ');
                colDragData.grid.css('grid-template-columns', pctStr);

                colDragData.grid.parent().find('.compare-dragger').each(function(i) {
                    if (i < colDragData.numCols - 1) {
                        var sum = 0;
                        for (var j = 0; j <= i; j++) sum += colDragData.currentCols[j];
                        $(this).css('left', 'calc(' + sum + '% - 3px)');
                    }
                });
            }
        });

        $(document).off('mouseup.dragger').on('mouseup.dragger mouseleave.dragger', function() {
            if (colDragData) {
                colDragData.dragger.removeClass('dragging');
                colDragData = null;
                $('body').css('cursor', '');
            }
        });
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
        showDetail: showDetail,
        renderDetailTo: renderDetailTo,
        renderCompare: renderCompare
    };
})();
