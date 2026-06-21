(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.utils = App.utils || {};

    var VIRTUAL_THRESHOLD = 100;
    var BUFFER_SIZE = 5;
    var DEFAULT_ITEM_HEIGHT = 80;

    function isMobile() {
        return window.innerWidth < 768;
    }

    function shouldUseVirtualScroll(totalItems) {
        return isMobile() && totalItems > VIRTUAL_THRESHOLD;
    }

    function createVirtualScroller(options) {
        var container = options.container;
        var items = options.items || [];
        var renderItem = options.renderItem;
        var itemHeight = options.itemHeight || DEFAULT_ITEM_HEIGHT;
        var containerHeight = options.containerHeight || 500;
        var onItemsRendered = options.onItemsRendered || function() {};

        var scrollTop = 0;
        var visibleCount = Math.ceil(containerHeight / itemHeight) + BUFFER_SIZE * 2;
        var totalHeight = items.length * itemHeight;

        function getVisibleRange() {
            var startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - BUFFER_SIZE);
            var endIndex = Math.min(items.length, startIndex + visibleCount + BUFFER_SIZE);
            return { start: startIndex, end: endIndex };
        }

        function render() {
            if (!container) return;

            var range = getVisibleRange();
            var visibleItems = items.slice(range.start, range.end);

            var html = '';
            visibleItems.forEach(function(item, idx) {
                var globalIndex = range.start + idx;
                html += renderItem(item, globalIndex);
            });

            var contentHtml =
                '<div style="height:' + totalHeight + 'px;position:relative;">' +
                '<div style="position:absolute;top:' + (range.start * itemHeight) + 'px;left:0;right:0;">' +
                html +
                '</div></div>';

            var customHtml = onItemsRendered(range, visibleItems);
            if (typeof customHtml === 'string' && customHtml.length > 0) {
                container.innerHTML =
                    '<div style="height:' + totalHeight + 'px;position:relative;">' +
                    '<div style="position:absolute;top:' + (range.start * itemHeight) + 'px;left:0;right:0;">' +
                    customHtml +
                    '</div></div>';
            } else {
                container.innerHTML = contentHtml;
            }
        }

        function updateScrollTop(st) {
            scrollTop = st;
            render();
        }

        function updateItems(newItems) {
            items = newItems;
            totalHeight = items.length * itemHeight;
            visibleCount = Math.ceil(containerHeight / itemHeight) + BUFFER_SIZE * 2;
            scrollTop = 0;
            render();
        }

        function updateItemHeight(newHeight) {
            itemHeight = newHeight;
            totalHeight = items.length * itemHeight;
            visibleCount = Math.ceil(containerHeight / itemHeight) + BUFFER_SIZE * 2;
            render();
        }

        function getCurrentRange() {
            return getVisibleRange();
        }

        return {
            render: render,
            updateScrollTop: updateScrollTop,
            updateItems: updateItems,
            updateItemHeight: updateItemHeight,
            getCurrentRange: getCurrentRange,
            getScrollTop: function() { return scrollTop; },
            getTotalHeight: function() { return totalHeight; },
            isVirtual: function() { return shouldUseVirtualScroll(items.length); }
        };
    }

    App.utils.createVirtualScroller = createVirtualScroller;
    App.utils.shouldUseVirtualScroll = shouldUseVirtualScroll;
    App.utils.isMobile = isMobile;
    App.utils.VIRTUAL_THRESHOLD = VIRTUAL_THRESHOLD;

})(typeof window !== 'undefined' ? window : this);
