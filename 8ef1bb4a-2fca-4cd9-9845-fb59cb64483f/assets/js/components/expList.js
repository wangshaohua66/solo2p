var ExpList = (function() {
    var allExperiments = [];
    var filteredExperiments = [];
    var PAGE_SIZE = 50;
    var selectedDetailId = null;

    function init() {
        if (AppState.get('currentPage') == null) {
            AppState.set('currentPage', 1);
        }

        bindFilterEvents();
        bindMdViewToggle();
        applyMdViewPref();
        loadAndRender();

        AppState.subscribe('exp:created', loadAndRender);
        AppState.subscribe('exp:updated', function() {
            loadAndRender();
            if (selectedDetailId != null) {
                AppDB.getExperimentWithMedia(selectedDetailId).then(function(exp) {
                    if (exp) ExpDetail.renderDetailTo('#detailPanelBody', exp);
                });
            }
        });
        AppState.subscribe('exp:deleted', function() {
            loadAndRender();
            if (selectedDetailId != null) {
                if ($('#detailPanelBody').children().length > 0) {
                    AppDB.getExperiment(selectedDetailId).then(function(exp) {
                        if (!exp) {
                            selectedDetailId = null;
                            var panelChart = $('#detailPanelBody').data('lastCurveChart');
                            if (panelChart) { panelChart.destroy(); $('#detailPanelBody').removeData('lastCurveChart'); }
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
        renderSearchMatches(filters);
    }

    function renderSearchMatches(filters) {
        var keyword = (filters || {}).keyword || '';
        var $container = $('#searchMatches');
        if (!keyword) {
            $container.addClass('d-none').empty();
            return;
        }
        var matchedIds = SearchUtil.getMatchedExperiments(allExperiments, keyword);
        if (!matchedIds || matchedIds.length === 0) {
            $container.addClass('d-none').empty();
            return;
        }
        var matchedExps = allExperiments.filter(function(e) {
            return matchedIds.indexOf(e.id) > -1;
        });
        var html = '<small class="text-muted me-2">匹配 ' + matchedExps.length + ' 条：</small>';
        matchedExps.forEach(function(exp) {
            var nameHtml = highlightText(exp.name, keyword);
            html += '<button type="button" class="btn btn-sm btn-outline-clay search-match-btn" data-id="' + exp.id + '">' + nameHtml + '</button>';
        });
        $container.html(html).removeClass('d-none');
        $container.off('click', '.search-match-btn').on('click', '.search-match-btn', function() {
            var id = parseInt($(this).data('id'));
            jumpToExperiment(id);
        });
    }

    function jumpToExperiment(id) {
        var expIndex = -1;
        for (var i = 0; i < filteredExperiments.length; i++) {
            if (filteredExperiments[i].id === id) {
                expIndex = i;
                break;
            }
        }
        if (expIndex < 0) return;
        var targetPage = Math.floor(expIndex / PAGE_SIZE) + 1;
        var currentPage = AppState.get('currentPage') || 1;
        if (targetPage !== currentPage) {
            AppState.set('currentPage', targetPage);
            renderList();
        }
        setTimeout(function() {
            var $card = $('.exp-card[data-id="' + id + '"]');
            if ($card.length > 0) {
                $('.list-scroll').animate({
                    scrollTop: $card.offset().top - $('.list-scroll').offset().top + $('.list-scroll').scrollTop() - 20
                }, 300, function() {
                    $card.addClass('jump-anchor');
                    setTimeout(function() {
                        $card.removeClass('jump-anchor');
                    }, 3000);
                });
            }
        }, 200);
    }

    function bindMdViewToggle() {
        $('#mdViewToggle').on('click', 'button[data-md-view]', function() {
            var view = $(this).data('md-view');
            applyMdView(view);
            try { localStorage.setItem('mdViewPref', view); } catch(e) {}
        });
    }

    function applyMdViewPref() {
        var pref = null;
        try { pref = localStorage.getItem('mdViewPref'); } catch(e) {}
        if (pref) applyMdView(pref);
    }

    function applyMdView(view) {
        var $filter = $('#filterSidebar');
        var $list = $('.list-area');
        var $detail = $('#detailPanel');
        $filter.removeClass('d-none');
        $list.removeClass('d-none');
        if (view === 'filter') {
            $list.addClass('d-none');
            $detail.addClass('d-none');
        } else if (view === 'list') {
            $filter.addClass('d-none');
        }
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
            $('#detailPanelHint').text('加载中...');
            AppDB.getExperimentWithMedia(id).then(function(exp) {
                if (!exp) return;
                $('#detailPanelHint').text('');
                ExpDetail.renderDetailTo('#detailPanelBody', exp);
            });
        } else {
            AppState.publish('exp:selected', id);
        }
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

    return {
        init: init,
        loadAndRender: loadAndRender,
        getFiltered: function() { return filteredExperiments; }
    };
})();
