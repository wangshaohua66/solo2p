var SearchUtil = (function() {
    var CONE_VALUES = {
        '022': 580, '018': 700, '012': 840, '011': 875, '010': 890,
        '09': 900, '08': 920, '07': 945, '06': 990, '05': 1030, '04': 1050,
        '03': 1080, '02': 1100, '01': 1115, '1': 1135, '2': 1150, '3': 1170,
        '4': 1190, '5': 1210, '6': 1222, '7': 1240, '8': 1260, '9': 1280, '10': 1300
    };

    function init() {
        $('#globalSearch').on('input', debounce(function() {
            var kw = $(this).val().trim();
            AppState.setFilters({ keyword: kw });
        }, 250));
    }

    function debounce(fn, delay) {
        var timer;
        return function() {
            var ctx = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
        };
    }

    function applyFilters(experiments, filters) {
        return experiments.filter(function(exp) {
            if (filters.glazeCategories && filters.glazeCategories.length > 0) {
                if (filters.glazeCategories.indexOf(exp.glazeCategory) === -1) return false;
            }
            if (filters.atmospheres && filters.atmospheres.length > 0) {
                if (filters.atmospheres.indexOf(exp.atmosphere) === -1) return false;
            }
            if (filters.kilnType) {
                if (exp.kilnType !== filters.kilnType) return false;
            }
            if (filters.coneMin || filters.coneMax) {
                var expVal = CONE_VALUES[exp.cone] || 0;
                if (filters.coneMin && expVal < (CONE_VALUES[filters.coneMin] || 0)) return false;
                if (filters.coneMax && expVal > (CONE_VALUES[filters.coneMax] || 9999)) return false;
            }
            if (filters.materials && filters.materials.length > 0) {
                var expMatNames = (exp.recipe || []).map(function(r) { return r.materialName; });
                for (var i = 0; i < filters.materials.length; i++) {
                    var found = false;
                    for (var j = 0; j < expMatNames.length; j++) {
                        if (expMatNames[j] && expMatNames[j].indexOf(filters.materials[i]) > -1) { found = true; break; }
                    }
                    if (!found) return false;
                }
            }
            if (filters.keyword) {
                var kw = filters.keyword.toLowerCase();
                var haystack = [
                    exp.name || '',
                    exp.notes || '',
                    ((exp.recipe || []).map(function(r) { return r.materialName || ''; }).join(' ')),
                    ((exp.defectTags || []).join(' '))
                ].join(' ').toLowerCase();
                if (haystack.indexOf(kw) === -1) return false;
            }
            return true;
        });
    }

    function sortExperiments(experiments, sortBy) {
        var arr = experiments.slice();
        switch (sortBy) {
            case 'createdAt_asc':
                arr.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); }); break;
            case 'date_desc':
                arr.sort(function(a, b) { return new Date(b.date) - new Date(a.date); }); break;
            case 'date_asc':
                arr.sort(function(a, b) { return new Date(a.date) - new Date(b.date); }); break;
            case 'name_asc':
                arr.sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'zh'); }); break;
            default:
                arr.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        }
        return arr;
    }

    return {
        init: init,
        applyFilters: applyFilters,
        sortExperiments: sortExperiments,
        CONE_VALUES: CONE_VALUES
    };
})();
