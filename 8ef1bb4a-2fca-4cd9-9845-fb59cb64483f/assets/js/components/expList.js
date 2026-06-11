var ExpList = (function() {
    var allExperiments = [];
    var filteredExperiments = [];
    var PAGE_SIZE = 50;
    var selectedDetailId = null;
    var detailCurveChart = null;

    function init() {
        if (AppState.get('currentPage') == null) {
            AppState.set('currentPage', 1);
        }

        bindFilterEvents();
        loadAndRender();

        AppState.subscribe('exp:created', loadAndRender);
        AppState.subscribe('exp:updated', function() {
            loadAndRender();
            if (selectedDetailId != null) {
                renderDetailToPanel(selectedDetailId);
            }
        });
        AppState.subscribe('exp:deleted', function() {
            loadAndRender();
            if (selectedDetailId != null) {
                if ($('#detailPanelBody').children().length > 0) {
                    AppDB.getExperiment(selectedDetailId).then(function(exp) {
                        if (!exp) {
                            selectedDetailId = null;
                            $('#detailPanelBody').html('');
                            $('#detailPanelHint').text('请选择一条记录');
                        }
                    });
                }
            }
        });
        AppState.subscribe('filter:changed', function() {
            AppState.set('currentPage', 1);
            applyFilterAndRender();
        });
        AppState.subscribe('compare:changed', updateCompareBadge);

        $('#sortSelect').on('change', function() {
            AppState.set('sortBy', $(this).val());
            applyFilterAndRender();
        });

        $('#btnResetFilter').on('click', function() {
            AppState.resetFilters();
            resetFilterUI();
        });

        $('#btnAddMaterialFilter').on('click', addMaterialFilter);
        $('#filterMaterialInput').on('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); addMaterialFilter(); }
        });

        $('#btnOpenCompare').on('click', function() {
            if (AppState.get('compareIds').length >= 2) {
                new bootstrap.Modal(document.getElementById('compareModal')).show();
            }
        });

        updateCompareBadge();
    }

    function bindFilterEvents() {
        $('#filterGlaze').on('click', '.tag-btn', function() {
            $(this).toggleClass('active');
            collectAndApplyFilters();
        });
        $('#filterAtmosphere input[type="checkbox"]').on('change', collectAndApplyFilters);
        $('#filterKiln').on('change', collectAndApplyFilters);
        $('#filterConeMin, #filterConeMax').on('change', collectAndApplyFilters);
    }

    function collectAndApplyFilters() {
        var glazes = [];
        $('#filterGlaze .tag-btn.active').each(function() { glazes.push($(this).data('value')); });
        var atms = [];
        $('#filterAtmosphere input:checked').each(function() { atms.push($(this).val()); });
        var mats = [];
        $('#selectedMaterials .material-filter-chip').each(function() { mats.push($(this).data('value')); });

        AppState.setFilters({
            glazeCategories: glazes,
            atmospheres: atms,
            kilnType: $('#filterKiln').val(),
            coneMin: $('#filterConeMin').val(),
            coneMax: $('#filterConeMax').val(),
            materials: mats
        });
    }

    function addMaterialFilter() {
        var input = $('#filterMaterialInput');
        var val = input.val().trim();
        if (!val) return;
        var chips = $('#selectedMaterials .material-filter-chip');
        for (var i = 0; i < chips.length; i++) {
            if ($(chips[i]).data('value') === val) { input.val(''); return; }
        }
        $('#selectedMaterials').append(
            '<span class="material-filter-chip" data-value="' + val + '">' +
            val +
            '<button type="button"><i class="bi bi-x"></i></button>' +
            '</span>'
        );
        input.val('');
        collectAndApplyFilters();
    }

    function resetFilterUI() {
        $('#filterGlaze .tag-btn').removeClass('active');
        $('#filterAtmosphere input[type="checkbox"]').prop('checked', false);
        $('#filterKiln').val('');
        $('#filterConeMin').val('');
        $('#filterConeMax').val('');
        $('#selectedMaterials').empty();
        $('#globalSearch').val('');
    }

    function loadAndRender() {
        AppDB.getAllExperiments().then(function(exps) {
            allExperiments = exps;
            applyFilterAndRender();
        });
    }

    function applyFilterAndRender() {
        var filters = AppState.get('filters');
        var sortBy = AppState.get('sortBy');
        filteredExperiments = SearchUtil.applyFilters(allExperiments, filters);
        filteredExperiments = SearchUtil.sortExperiments(filteredExperiments, sortBy);
        renderList();
    }

    function highlightText(text, keyword) {
        if (!text || !keyword) return escapeHtml(text || '');
        var escaped = escapeHtml(text);
        var kw = escapeHtml(keyword);
        var re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return escaped.replace(re, "<span class='hl-match'>$1</span>");
    }

    function renderList() {
        $('#expCount').text(filteredExperiments.length);
        var $list = $('#expList');
        $list.empty();

        var currentPage = AppState.get('currentPage') || 1;
        var totalPages = Math.max(1, Math.ceil(filteredExperiments.length / PAGE_SIZE));
        if (currentPage > totalPages) {
            currentPage = totalPages;
            AppState.set('currentPage', currentPage);
        }
        var startIdx = (currentPage - 1) * PAGE_SIZE;
        var endIdx = Math.min(startIdx + PAGE_SIZE, filteredExperiments.length);
        var pageItems = filteredExperiments.slice(startIdx, endIdx);

        if (filteredExperiments.length === 0) {
            $('#emptyState').removeClass('d-none');
            $('#paginationBar').empty();
            return;
        }
        $('#emptyState').addClass('d-none');

        var keyword = (AppState.get('filters') || {}).keyword || '';

        pageItems.forEach(function(exp) {
            var inCompare = AppState.isInCompare(exp.id);
            var isSelected = (selectedDetailId === exp.id);
            var hasSelectedClass = inCompare || isSelected;

            var recipeSummary = (exp.recipe || []).slice(0, 3).map(function(r) {
                var matName = keyword ? highlightText(r.materialName, keyword) : escapeHtml(r.materialName);
                return '<span class="mini-tag">' + matName + '</span>';
            }).join('');
            var moreCount = (exp.recipe || []).length - 3;
            if (moreCount > 0) recipeSummary += '<span class="mini-tag celadon">+' + moreCount + '</span>';

            var defectHtml = (exp.defectTags || []).slice(0, 3).map(function(d) {
                var defectName = keyword ? highlightText(d, keyword) : escapeHtml(d);
                return '<span class="mini-tag" style="background:#FDE0E0;color:#842029;">' + defectName + '</span>';
            }).join('');

            var thumb = exp.firstMediaThumb ?
                '<img src="' + exp.firstMediaThumb + '" class="exp-card-img" alt="">' :
                '<div class="exp-card-img d-flex align-items-center justify-content-center"><i class="bi bi-image text-white-50 fs-2"></i></div>';

            var expTitle = keyword ? highlightText(exp.name, keyword) : escapeHtml(exp.name);

            var notesPreview = '';
            if (keyword && exp.notes) {
                var notesHtml = highlightText(exp.notes, keyword);
                if (notesHtml.indexOf("hl-match") > -1) {
                    notesPreview = '<div class="exp-card-meta mt-1 small" style="color:#8B7355;"><i class="bi bi-journal-text"></i>' + truncateHtml(notesHtml, 60) + '</div>';
                }
            }

            var card = $(
                '<div class="col-6 col-md-6 col-lg-4 col-xl-3 fade-in">' +
                    '<div class="exp-card' + (hasSelectedClass ? ' selected' : '') + '" data-id="' + exp.id + '">' +
                        thumb +
                        '<div class="exp-card-body">' +
                            '<div class="exp-card-title">' + expTitle + '</div>' +
                            '<div class="exp-card-meta">' +
                                '<i class="bi bi-calendar3"></i>' + (exp.date || '-') +
                                '<span class="mini-tag celadon">' + (exp.glazeCategory || '-') + '</span>' +
                            '</div>' +
                            '<div class="exp-card-meta mt-1">' +
                                '<i class="bi bi-thermometer-half"></i>' + (exp.cone ? '锥' + exp.cone : '-') +
                                ' · <i class="bi bi-fire"></i>' + (exp.atmosphere || '-') +
                                ' · <i class="bi bi-box"></i>' + (exp.kilnType || '-') +
                            '</div>' +
                            '<div class="exp-card-tags">' + recipeSummary + '</div>' +
                            (defectHtml ? '<div class="exp-card-tags mt-1">' + defectHtml + '</div>' : '') +
                            notesPreview +
                        '</div>' +
                    '</div>' +
                '</div>'
            );
            $list.append(card);
        });

        renderPagination(totalPages, currentPage);

        $list.off('click', '.exp-card').on('click', '.exp-card', function(e) {
            var id = parseInt($(this).data('id'));
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                AppState.toggleCompare(id);
            } else {
                handleCardSelect(id, $(this));
            }
        });
    }

    function truncateHtml(html, maxLen) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var text = tmp.textContent || '';
        if (text.length <= maxLen) return html;
        var count = 0;
        var result = '';
        function walk(node) {
            if (count >= maxLen) return;
            if (node.nodeType === 3) {
                var remaining = maxLen - count;
                var content = node.textContent;
                if (content.length <= remaining) {
                    result += escapeHtml(content);
                    count += content.length;
                } else {
                    result += escapeHtml(content.slice(0, remaining)) + '…';
                    count = maxLen;
                }
            } else if (node.nodeType === 1) {
                var tag = node.tagName.toLowerCase();
                result += '<' + tag;
                for (var i = 0; i < node.attributes.length; i++) {
                    result += ' ' + node.attributes[i].name + '="' + escapeHtml(node.attributes[i].value) + '"';
                }
                result += '>';
                for (var j = 0; j < node.childNodes.length; j++) {
                    walk(node.childNodes[j]);
                    if (count >= maxLen) break;
                }
                result += '</' + tag + '>';
            }
        }
        for (var k = 0; k < tmp.childNodes.length; k++) {
            walk(tmp.childNodes[k]);
            if (count >= maxLen) break;
        }
        return result;
    }

    function renderPagination(totalPages, currentPage) {
        var $bar = $('#paginationBar');
        $bar.empty();
        if (totalPages <= 1) return;

        $bar.addClass('pagination-bar');

        var html = '';

        html += '<button class="page-btn" data-page="prev"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i></button>';

        var maxVisible = 7;
        var startPage, endPage;
        if (totalPages <= maxVisible) {
            startPage = 1;
            endPage = totalPages;
        } else {
            var half = Math.floor(maxVisible / 2);
            if (currentPage <= half + 1) {
                startPage = 1;
                endPage = maxVisible;
            } else if (currentPage >= totalPages - half) {
                startPage = totalPages - maxVisible + 1;
                endPage = totalPages;
            } else {
                startPage = currentPage - half;
                endPage = currentPage + half;
            }
        }

        if (startPage > 1) {
            html += '<button class="page-btn" data-page="1">1</button>';
            if (startPage > 2) html += '<span class="page-btn" style="border:none;cursor:default;">…</span>';
        }

        for (var p = startPage; p <= endPage; p++) {
            html += '<button class="page-btn' + (p === currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span class="page-btn" style="border:none;cursor:default;">…</span>';
            html += '<button class="page-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
        }

        html += '<button class="page-btn" data-page="next"' + (currentPage >= totalPages ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>';

        $bar.html(html);

        $bar.off('click', '.page-btn').on('click', '.page-btn', function() {
            if ($(this).prop('disabled')) return;
            var page = $(this).data('page');
            if (page === 'prev') {
                page = Math.max(1, currentPage - 1);
            } else if (page === 'next') {
                page = Math.min(totalPages, currentPage + 1);
            }
            page = parseInt(page);
            if (page && page !== currentPage) {
                AppState.set('currentPage', page);
                renderList();
                $('.list-scroll').animate({ scrollTop: 0 }, 200);
            }
        });
    }

    function handleCardSelect(id, $card) {
        selectedDetailId = id;
        $('#expList .exp-card').each(function() {
            var cid = parseInt($(this).data('id'));
            var inCompare = AppState.isInCompare(cid);
            var isSelected = (cid === selectedDetailId);
            if (inCompare || isSelected) {
                $(this).addClass('selected');
            } else {
                $(this).removeClass('selected');
            }
        });

        var isDesktop = window.matchMedia('(min-width: 1200px)').matches;
        if (isDesktop) {
            renderDetailToPanel(id);
        } else {
            AppState.publish('exp:selected', id);
        }
    }

    function renderDetailToPanel(id) {
        $('#detailPanelHint').text('加载中...');
        AppDB.getExperimentWithMedia(id).then(function(exp) {
            if (!exp) return;
            selectedDetailId = id;

            $('#detailPanelHint').text('');

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
                    '<canvas id="detailPanelCurveChart" height="200"></canvas>' +
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
                '<button class="btn btn-sm ' + (inCompare ? 'btn-clay' : 'btn-outline-celadon') + '" id="btnPanelCompare">' +
                '<i class="bi ' + (inCompare ? 'bi-check2' : 'bi-plus') + ' me-1"></i>' + (inCompare ? '已加入对比' : '加入对比') + '</button>' +
                '<button class="btn btn-sm btn-outline-secondary" id="btnPanelEdit"><i class="bi bi-pencil me-1"></i>编辑</button>' +
                '<button class="btn btn-sm btn-outline-danger ms-auto" id="btnPanelDelete"><i class="bi bi-trash me-1"></i>删除</button>' +
                '</div>';

            $('#detailPanelBody').html(metaHtml + mediaHtml + recipeHtml + curveHtml + defectHtml + notesHtml + actionsHtml);

            if (exp.firingCurve && exp.firingCurve.length > 0) {
                setTimeout(function() {
                    if (detailCurveChart) detailCurveChart.destroy();
                    detailCurveChart = FiringCurve.renderDetail('detailPanelCurveChart', exp.firingCurve, exp.name);
                }, 100);
            }

            $('#btnPanelEdit').on('click', function() {
                ExpForm.openForEdit(exp.id);
            });
            $('#btnPanelDelete').on('click', function() {
                showConfirm('确定删除实验「' + exp.name + '」吗？', function() {
                    AppDB.deleteExperiment(exp.id).then(function() {
                        if (AppState.isInCompare(exp.id)) AppState.toggleCompare(exp.id);
                        selectedDetailId = null;
                        $('#detailPanelBody').html('');
                        $('#detailPanelHint').text('请选择一条记录');
                        AppState.publish('exp:deleted', exp.id);
                        AppState.publish('toast:show', { type: 'success', message: '实验已删除' });
                    });
                });
            });
            $('#btnPanelCompare').on('click', function() {
                AppState.toggleCompare(exp.id);
                $(this).toggleClass('btn-clay btn-outline-celadon')
                    .html('<i class="bi bi-' + (AppState.isInCompare(exp.id) ? 'check2' : 'plus') + ' me-1"></i>' +
                          (AppState.isInCompare(exp.id) ? '已加入对比' : '加入对比'));
            });
        });
    }

    function showConfirm(message, onOk) {
        $('#confirmMessage').text(message);
        new bootstrap.Modal(document.getElementById('confirmModal')).show();
        $('#confirmOk').off('click').on('click', function() {
            bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
            onOk && onOk();
        });
    }

    function updateCompareBadge() {
        var ids = AppState.get('compareIds');
        $('#compareCount').text(ids.length);
        $('#btnOpenCompare').prop('disabled', ids.length < 2);
        if (ids.length > 0) {
            $('#compareHint').text('（按住Ctrl/Shift+点击可多选加入对比）');
        } else {
            $('#compareHint').text('');
        }
        $('#expList .exp-card').each(function() {
            var id = parseInt($(this).data('id'));
            var inCompare = AppState.isInCompare(id);
            var isSelected = (id === selectedDetailId);
            if (inCompare || isSelected) {
                $(this).addClass('selected');
            } else {
                $(this).removeClass('selected');
            }
        });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function formatDateTime(iso) {
        if (!iso) return '-';
        var d = new Date(iso);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    return {
        init: init,
        loadAndRender: loadAndRender,
        getFiltered: function() { return filteredExperiments; }
    };
})();
