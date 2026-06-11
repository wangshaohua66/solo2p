var AppState = (function() {
    var listeners = {};
    var state = {
        selectedExperimentId: null,
        compareIds: [],
        filters: {
            glazeCategories: [],
            atmospheres: [],
            kilnType: '',
            coneMin: '',
            coneMax: '',
            materials: [],
            keyword: ''
        },
        sortBy: 'createdAt_desc',
        materialsCache: [],
        experimentsCache: []
    };

    function subscribe(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        return function() {
            listeners[event] = listeners[event].filter(function(cb) { return cb !== callback; });
        };
    }

    function publish(event, data) {
        if (!listeners[event]) return;
        listeners[event].forEach(function(cb) {
            try { cb(data); } catch (e) { console.error('Event error [' + event + ']:', e); }
        });
    }

    function get(key) {
        return key ? state[key] : state;
    }

    function set(key, value) {
        state[key] = value;
    }

    function toggleCompare(id) {
        var idx = state.compareIds.indexOf(id);
        if (idx > -1) {
            state.compareIds.splice(idx, 1);
            publish('exp:compare:remove', id);
        } else {
            if (state.compareIds.length >= 4) {
                publish('toast:show', { type: 'warning', message: '最多只能对比4张图片' });
                return;
            }
            state.compareIds.push(id);
            publish('exp:compare:add', id);
        }
        publish('compare:changed', state.compareIds);
    }

    function isInCompare(id) {
        return state.compareIds.indexOf(id) > -1;
    }

    function clearCompare() {
        state.compareIds = [];
        publish('compare:changed', state.compareIds);
    }

    function setFilters(newFilters) {
        state.filters = $.extend({}, state.filters, newFilters);
        publish('filter:changed', state.filters);
    }

    function resetFilters() {
        state.filters = {
            glazeCategories: [],
            atmospheres: [],
            kilnType: '',
            coneMin: '',
            coneMax: '',
            materials: [],
            keyword: ''
        };
        publish('filter:changed', state.filters);
    }

    return {
        subscribe: subscribe,
        publish: publish,
        get: get,
        set: set,
        toggleCompare: toggleCompare,
        isInCompare: isInCompare,
        clearCompare: clearCompare,
        setFilters: setFilters,
        resetFilters: resetFilters
    };
})();
