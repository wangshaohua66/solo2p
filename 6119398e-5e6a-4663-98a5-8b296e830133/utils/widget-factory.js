(function initWidgetFactory($) {
    if (typeof $ === 'undefined') {
        console.warn('[WidgetFactory] jQuery 未定义, 稍后重试...');
        setTimeout(() => initWidgetFactory(window.jQuery), 50);
        return;
    }
    if ($.widget) {
        window.__widgetFactoryReady = true;
        return;
    }

    $.widget = function (fullName, base, prototype) {
        if (typeof base !== 'function') {
            prototype = base;
            base = Object;
        }

        var namespace = fullName.split('.');
        var name = namespace.pop();
        var ns = namespace.join('.') || 'jw';

        if (!$[ns]) $[ns] = {};

        function WidgetConstructor(element, options) {
            this.element = $(element);
            this.options = $.extend(true, {},
                (WidgetConstructor.prototype.options || {}),
                options || {});
            this.uuid = 'widget-' + (++$.uuid);
            this.element.data(fullName, this);
            if (this._create && typeof this._create === 'function') {
                try { this._create(); } catch (err) { console.error('[Widget] _create error:', err); }
            }
            if (this._init && typeof this._init === 'function') {
                try { this._init(); } catch (err) { console.error('[Widget] _init error:', err); }
            }
        }

        var baseProto = (base && base.prototype) || {};
        WidgetConstructor.prototype = Object.create(baseProto);
        $.extend(WidgetConstructor.prototype, {
            options: {},
            widgetName: name,
            widgetFullName: fullName,
            namespace: ns,
            widgetEventPrefix: name,
            _super: function (method) {
                var fn = baseProto[method] || this[method];
                if (typeof fn === 'function')
                    return fn.apply(this, Array.prototype.slice.call(arguments, 1));
            },
            _setOption: function (key, value) {
                this.options[key] = value;
                return this;
            },
            _setOptions: function (opts) {
                for (var k in opts) { if (opts.hasOwnProperty(k)) this._setOption(k, opts[k]); }
                return this;
            },
            option: function (key, value) {
                if (arguments.length === 0) return $.extend({}, this.options);
                if (typeof key === 'object') {
                    this._setOptions(key);
                    return this;
                }
                if (arguments.length === 1) return this.options[key];
                return this._setOption(key, value);
            },
            enable: function () { return this._setOption('disabled', false); },
            disable: function () { return this._setOption('disabled', true); },
            widget: function () { return this.element; },
            destroy: function () {
                if (this._destroy && typeof this._destroy === 'function') this._destroy();
                this.element.removeData(fullName);
            }
        }, prototype || {});

        WidgetConstructor.prototype.constructor = WidgetConstructor;
        $[ns][name] = WidgetConstructor;

        if (!$.fn) return;

        $.fn[name] = function (opts) {
            var args = Array.prototype.slice.call(arguments, 1);
            var returns;
            var isMethod = typeof opts === 'string';
            var allInstances = [];

            this.each(function () {
                var instance = $.data(this, fullName);
                if (!instance) {
                    if (isMethod) {
                        if (opts === 'instance') returns = null;
                        return;
                    }
                    instance = new WidgetConstructor(this, opts);
                    allInstances.push(instance);
                } else if (isMethod) {
                    if (opts === 'instance') {
                        returns = instance;
                        return false;
                    }
                    if (opts.charAt(0) !== '_' && typeof instance[opts] === 'function') {
                        var res = instance[opts].apply(instance, args);
                        if (res !== instance && res !== undefined) {
                            returns = res;
                            return false;
                        }
                    }
                } else {
                    if (instance.option) instance.option(opts);
                    if (instance._init && typeof instance._init === 'function') instance._init();
                }
            });

            return returns !== undefined ? returns : this;
        };
    };

    if (!$.noop) $.noop = function () {};
    if (!$.uuid) $.uuid = Date.now() % 1000000;

    window.__widgetFactoryReady = true;
    $(document).trigger('widgetfactory:ready');
    console.debug('[WidgetFactory] 初始化完成');
})(window.jQuery);

export default true;
