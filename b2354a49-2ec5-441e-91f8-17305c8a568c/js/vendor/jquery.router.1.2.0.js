/*
 * jQuery Router Plugin v1.2.0
 * https://github.com/camme/jquery-router-plugin
 *
 * Copyright 2011, Camilo Tapia (camilo.tapia@gmail.com)
 * Dual licensed under the GPL Version 2 or MIT licenses.
 *
 * Plugin to handle routes with both hash and push state
 * Supports: hash routing (#/path), pushState, and timer-based fallback
 * API: $.router.add(route, [id], callback), $.router.go(url, [title]), $.router.reset()
 */

(function($){
    
    var hasPushState = (history && history.pushState);    
    var hasHashState = !hasPushState && ("onhashchange" in window);
    var router = {};
    var routeList = [];
    var eventAdded = false;
    var currentUsedUrl = location.href;
    var firstRoute = true;
    var errorCallback = function () {};
    
    router.currentId = "";
    router.currentParameters = {};
    
    router.errorCallback = errorCallback;
    
    router.capabilities = {
        hash: hasHashState,
        pushState: hasPushState,
        timer: !hasHashState && !hasPushState
    };
    
    router.reset = function()
    {
        routeList = [];
        router.currentId = "";
        router.currentParameters = {};
    }
 
    router.add = function(route, id, callback)
    {
        if (typeof id == "function")
        {
            callback = id;
            delete id;
        }
        
        var isRegExp = typeof route == "object";
        
        if (!isRegExp)
        {
            if (route.lastIndexOf("/") == route.length - 1)
            {
                route = route.substring(0, route.length - 1);
            }
            route = route.replace(location.protocol + "//", "").replace(location.hostname, "");
        }
        var routeItem = {
            route: route,
            callback: callback,
            type: isRegExp ? "regexp" : "string",
            id: id
        }
        routeList.push(routeItem);
        
        if (!eventAdded)
        {
            bindStateEvents();
        }
    };
    
    router.addErrorHandler = function (callback)
    {
        this.errorCallback = callback;
    };
    
    function bindStateEvents()
    {
        eventAdded = true;
        router.fromHash = false;
        
        if (hasPushState)
        {
            if (location.hash.indexOf("#!/") === 0)
            {
                var url = location.pathname + location.hash.replace(/^#!\//gi, "");
                history.replaceState({}, "", url);
                router.fromHash = true;
            }
            $(window).bind("popstate", handleRoutes);
        }
        else if (hasHashState)
        {
            $(window).bind("hashchange.router", handleRoutes);
        }
        else
        {
            setInterval(
                function()
                {
                    if (location.href != currentUsedUrl)
                    {
                        handleRoutes();
                        currentUsedUrl = location.href;
                    }
                }, 500
            );
        }
    }
    
    bindStateEvents();
    
    router.go = function(url, title)
    {   
        if (hasPushState)
        {
            history.pushState({}, title, url);
            checkRoutes();
        }
        else
        {
            url = url.replace(location.protocol + "//", "").replace(location.hostname, "");
            var hash = url.replace(location.pathname, "");
            
            if (hash.indexOf("!") < 0)
            {
                hash = "!/" + hash;
            }
            location.hash = hash;
        }
    };
    
    router.check = router.redo = function()
    {   
        checkRoutes(true);
    };
    
    function parseUrl(url)
    {
        var currentUrl = url ? url : location.pathname;
        currentUrl = decodeURI(currentUrl);
        
        if (!hasPushState)
        {   
            if (location.hash.indexOf("#!/") === 0)
            {
                currentUrl += location.hash.substring(3);
            }
            else if (location.hash.indexOf("#/") === 0)
            {
                currentUrl = location.hash.substring(2);
            }
            else
            {
                return '';
            }
        }
        
        currentUrl = currentUrl.replace(/\/$/, "");
        return currentUrl;
    }
    
    router.parameters = function(url)
    {
        var currentUrl = parseUrl(url);
        var list = getParameters(currentUrl);
        
        if (list.length == 0)
        {
            router.currentParameters = {};
        }
        else 
        {
            router.currentParameters = list[0].data;
        }
        
        return router.currentParameters;
    }
    
    function getParameters(url)
    {
        var dataList = [];
        
        for(var i = 0, ii = routeList.length; i < ii; i++)
        {
            var route = routeList[i];
            
            if (route.type == "regexp")
            {
                var result = url.match(route.route);
                if (result)
                {
                    var data = {};
                    data.matches = result;
                    
                    dataList.push(
                        {
                            route: route,
                            data: data
                        }
                    );
                    router.currentId = route.id;
                    break;
                }
            }
            else
            {
                var currentUrlParts = url.split("/");
                var routeParts = route.route.split("/");
                
                if (routeParts.length == currentUrlParts.length)
                {
                    var data = {};
                    var matched = true;
                    var matchCounter = 0;
                    for(var j = 0, jj = routeParts.length; j < jj; j++)
                    {
                        var isParam = routeParts[j].indexOf(":") === 0;
                        if (isParam)
                        {
                            data[routeParts[j].substring(1)] = decodeURI(currentUrlParts[j]);
                            matchCounter++;
                        }
                        else
                        {
                            if (routeParts[j] == currentUrlParts[j])
                            {
                                matchCounter++;
                            }
                        }
                    }
                    if (routeParts.length == matchCounter)
                    {
                        dataList.push(
                            {
                                route: route,
                                data: data
                            }
                        );
                        router.currentId = route.id;
                        router.currentParameters = data;
                        break; 
                    }
                }
            }
        }
        
        return dataList;
    }
    
    function checkRoutes()
    {
        var currentUrl = parseUrl(location.pathname);
        var actionList = getParameters(currentUrl);
        
        if (actionList.length == 0) {
            return router.errorCallback(currentUrl);
        }
        
        for(var i = 0, ii = actionList.length; i < ii; i++)
        {
            actionList[i].route.callback(actionList[i].data);
        }
    }
    
    function handleRoutes(e)
    {
        if (e != null && e.originalEvent && e.originalEvent.state !== undefined)
        {
            checkRoutes();
        }
        else if (hasHashState)
        {
            checkRoutes();
        }
        else if (!hasHashState && !hasPushState)
        {
            checkRoutes();
        }
    }
    
    router.init = function()
    {
        checkRoutes();
    };
    
    if (!$) {
        console.error("jQuery Router requires jQuery");
        return;
    }
    
    if (!$.router)
    {
        $.router = router;
    }
        
})( jQuery );
