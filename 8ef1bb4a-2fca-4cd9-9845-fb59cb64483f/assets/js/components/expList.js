var ExpList = (function() {
    var allExperiments = [];
    var filteredExperiments = [];

    function init() {
        bindFilterEvents();
        loadAndRender();

        AppState.subscribe('exp:created', loadAndRender);
        AppState.subscribe('exp:updated', loadAndRender);
        AppState.subscribe('exp:deleted', loadAndRender);
        AppState.subscribe('filter:changed', applyFilterAndRender);
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

    function renderList() {
        $('#expCount').text(filteredExperiments.length);
        var $list = $('#expList');
        $list.empty();

        if (filteredExperiments.length === 0) {
            $('#emptyState').removeClass('d-none');
            return;
        }
        $('#emptyState').addClass('d-none');

        filteredExperiments.forEach(function(exp) {
            var inCompare = AppState.isInCompare(exp.id);
            var recipeSummary = (exp.recipe || []).slice(0, 3).map(function(r) {
                return '<span class="mini-tag">' + r.materialName + '</span>';
            }).join('');
            var moreCount = (exp.recipe || []).length - 3;
            if (moreCount > 0) recipeSummary += '<span class="mini-tag celadon">+' + moreCount + '</span>';

            var defectHtml = (exp.defectTags || []).slice(0, 3).map(function(d) {
                return '<span class="mini-tag" style="background:#FDE0E0;color:#842029;">' + d + '</span>';
            }).join('');

            var thumb = exp.firstMediaThumb ?
                '<img src="' + exp.firstMediaThumb + '" class="exp-card-img" alt="">' :
                '<div class="exp-card-img d-flex align-items-center justify-content-center"><i class="bi bi-image text-white-50 fs-2"></i></div>';

            var card = $(
                '<div class="col-6 col-md-6 col-lg-4 col-xl-3 fade-in">' +
                    '<div class="exp-card' + (inCompare ? ' selected' : '') + '" data-id="' + exp.id + '">' +
                        thumb +
                        '<div class="exp-card-body">' +
                            '<div class="exp-card-title">' + escapeHtml(exp.name) + '</div>' +
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
                        '</div>' +
                    '</div>' +
                '</div>'
            );
            $list.append(card);
        });

        $list.off('click', '.exp-card').on('click', '.exp-card', function(e) {
            var id = parseInt($(this).data('id'));
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                AppState.toggleCompare(id);
                $(this).toggleClass('selected');
            } else {
                AppState.publish('exp:selected', id);
            }
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
            if (AppState.isInCompare(id)) $(this).addClass('selected');
            else $(this).removeClass('selected');
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
