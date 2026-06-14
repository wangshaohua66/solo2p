var Store = (function() {
    var STORAGE_KEY = 'powergrid_dispatch_state';
    var state = {};
    var subscribers = {};
    var memoryCache = {};

    var defaultState = {
        faults: [],
        crews: [],
        gridNodes: [],
        gridLinks: [],
        stats: {
            todayFaults: 0,
            avgRecoveryTime: 0,
            crewUtilization: 0,
            satisfaction: 95.2
        },
        currentRoute: 'dashboard',
        filters: {
            dateFrom: null,
            dateTo: null,
            level: 'all',
            line: 'all',
            crew: 'all',
            status: 'all'
        }
    };

    function loadState() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                var parsed = JSON.parse(saved);
                state = $.extend(true, {}, defaultState, parsed);
            } else {
                state = $.extend(true, {}, defaultState);
            }
        } catch (e) {
            console.error('Failed to load state:', e);
            state = $.extend(true, {}, defaultState);
        }
    }

    function saveState() {
        try {
            var start = performance.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            var elapsed = performance.now() - start;
            if (elapsed > 50) {
                console.warn('localStorage write exceeded 50ms:', elapsed);
            }
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }

    function get(path) {
        if (!path) return state;
        var parts = path.split('.');
        var result = state;
        for (var i = 0; i < parts.length; i++) {
            if (result == null) return undefined;
            result = result[parts[i]];
        }
        return result;
    }

    function mutate(path, value) {
        var parts = path.split('.');
        var obj = state;
        for (var i = 0; i < parts.length - 1; i++) {
            if (obj[parts[i]] == null) {
                obj[parts[i]] = {};
            }
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        saveState();
        notify(path, value);
    }

    function subscribe(event, callback) {
        if (!subscribers[event]) {
            subscribers[event] = [];
        }
        subscribers[event].push(callback);
        return function() {
            subscribers[event] = subscribers[event].filter(function(cb) {
                return cb !== callback;
            });
        };
    }

    function notify(path, value) {
        var start = performance.now();
        var parts = path.split('.');
        var events = [];
        for (var i = parts.length; i >= 1; i--) {
            events.push(parts.slice(0, i).join('.'));
        }
        events.push('*');
        events.forEach(function(event) {
            if (subscribers[event]) {
                subscribers[event].forEach(function(cb) {
                    try {
                        cb(value, path, state);
                    } catch (e) {
                        console.error('Subscriber error for', event, ':', e);
                    }
                });
            }
        });
        var elapsed = performance.now() - start;
        if (elapsed > 100) {
            console.warn('State notification exceeded 100ms:', elapsed);
        }
    }

    function reset() {
        localStorage.removeItem(STORAGE_KEY);
        state = $.extend(true, {}, defaultState);
        notify('*', state);
    }

    function addFault(fault) {
        state.faults.unshift(fault);
        saveState();
        notify('faults', state.faults);
        notify('faults.add', fault);
    }

    function updateFault(id, updates) {
        var index = state.faults.findIndex(function(f) { return f.id === id; });
        if (index !== -1) {
            state.faults[index] = $.extend(true, {}, state.faults[index], updates);
            saveState();
            notify('faults', state.faults);
            notify('faults.update', state.faults[index]);
        }
    }

    function getFault(id) {
        return state.faults.find(function(f) { return f.id === id; });
    }

    function updateCrew(id, updates) {
        var index = state.crews.findIndex(function(c) { return c.id === id; });
        if (index !== -1) {
            state.crews[index] = $.extend(true, {}, state.crews[index], updates);
            saveState();
            notify('crews', state.crews);
            notify('crews.update', state.crews[index]);
        }
    }

    function getCrew(id) {
        return state.crews.find(function(c) { return c.id === id; });
    }

    function setCache(key, value) {
        memoryCache[key] = {
            value: value,
            timestamp: Date.now()
        };
    }

    function getCache(key, maxAge) {
        var cached = memoryCache[key];
        if (!cached) return null;
        if (maxAge && Date.now() - cached.timestamp > maxAge) {
            delete memoryCache[key];
            return null;
        }
        return cached.value;
    }

    function clearCache(key) {
        if (key) {
            delete memoryCache[key];
        } else {
            memoryCache = {};
        }
    }

    loadState();

    return {
        get: get,
        mutate: mutate,
        subscribe: subscribe,
        reset: reset,
        addFault: addFault,
        updateFault: updateFault,
        getFault: getFault,
        updateCrew: updateCrew,
        getCrew: getCrew,
        setCache: setCache,
        getCache: getCache,
        clearCache: clearCache
    };
})();
