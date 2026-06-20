/* 展位平面图：SVG 渲染、点击详情、拖拽框选批量操作、预订/释放 */
(function ($) {
    'use strict';
    var NS = 'http://www.w3.org/2000/svg';
    var state = { booths: [], selected: {}, modal: null };
    var $svg = $('#plan');

    function el(tag, attrs) {
        var n = document.createElementNS(NS, tag);
        for (var k in attrs) { n.setAttribute(k, attrs[k]); }
        return n;
    }

    function svgPoint(x, y) {
        var pt = $svg[0].createSVGPoint();
        pt.x = x; pt.y = y;
        return pt.matrixTransform($svg[0].getScreenCTM().inverse());
    }

    function load() {
        Exh.get(window.EXH_ROUTES.api).then(function (d) {
            state.booths = d.booths || [];
            render(d.viewBox || { w: 1000, h: 700 });
        });
    }

    function render(vb) {
        $svg.empty();
        $svg.attr('viewBox', '0 0 ' + vb.w + ' ' + vb.h);
        state.booths.forEach(function (b) {
            var g = el('g', { 'data-id': b.id, style: 'cursor:pointer' });
            var rect = el('rect', {
                x: b.x, y: b.y, width: b.w, height: b.h, rx: 5,
                class: 'booth-rect s-' + b.status + (state.selected[b.id] ? ' sel' : '')
            });
            var t = el('text', { x: b.x + b.w / 2, y: b.y + b.h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'booth-label' });
            t.textContent = b.code;
            g.appendChild(rect);
            g.appendChild(t);
            $(g).on('click', function (e) {
                e.stopPropagation();
                openModal(b);
            });
            $svg[0].appendChild(g);
        });
        // marquee selection overlay
        var marquee = el('rect', { class: 'marquee-box', x: 0, y: 0, width: 0, height: 0, fill: 'none' });
        marquee.id = 'marquee';
        $svg[0].appendChild(marquee);
    }

    function rectsIntersect(a, b) {
        return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    }

    function initMarquee() {
        var dragging = false, start = null, $m = null;
        $svg.on('mousedown', function (e) {
            if (e.target.tagName === 'rect' && $(e.target).hasClass('booth-rect')) { return; }
            dragging = true;
            start = svgPoint(e.clientX, e.clientY);
            $m = $('#marquee');
            $m.attr({ x: start.x, y: start.y, width: 0, height: 0 }).addClass('sel');
        });
        $(document).on('mousemove', function (e) {
            if (!dragging) { return; }
            var cur = svgPoint(e.clientX, e.clientY);
            var x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y);
            var w = Math.abs(cur.x - start.x), h = Math.abs(cur.y - start.y);
            $m.attr({ x: x, y: y, width: w, height: h });
            var box = { x: x, y: y, w: w, h: h };
            state.booths.forEach(function (b) {
                if (w > 4 && h > 4 && rectsIntersect({ x: b.x, y: b.y, w: b.w, h: b.h }, box)) {
                    state.selected[b.id] = true;
                }
            });
            updateSelection();
        });
        $(document).on('mouseup', function () {
            if (dragging) {
                dragging = false;
                $m.attr({ width: 0, height: 0 }).removeClass('sel');
                render(state._vb || { w: 1000, h: 700 });
            }
        });
    }

    function updateSelection() {
        var n = Object.keys(state.selected).length;
        $('#selCount').text(n);
        $('.booth-rect').removeClass('sel');
        Object.keys(state.selected).forEach(function (id) {
            $('[data-id="' + id + '"] .booth-rect').addClass('sel');
        });
    }

    function openModal(b) {
        var body = '<table class="table table-borderless mb-0"><tbody>' +
            '<tr><td class="text-muted" style="width:90px">展位号</td><td class="fw-bold">' + b.code + '</td></tr>' +
            '<tr><td class="text-muted">类型</td><td>' + b.typeLabel + '（' + b.area + '㎡）</td></tr>' +
            '<tr><td class="text-muted">朝向</td><td>' + (b.orientation || '-') + '</td></tr>' +
            '<tr><td class="text-muted">行业分区</td><td>' + (b.industry || '-') + '</td></tr>' +
            '<tr><td class="text-muted">价格</td><td class="fw-bold text-accent">¥' + Number(b.price).toLocaleString('zh-CN') + '</td></tr>' +
            '<tr><td class="text-muted">当前状态</td><td><span class="badge status-badge status-' + b.status + '">' + b.statusLabel + '</span></td></tr>' +
            (b.exhibitor ? '<tr><td class="text-muted">预订参展商</td><td class="fw-semibold">' + b.exhibitor + '</td></tr>' : '') +
            '</tbody></table>';
        $('#boothModalBody').html(body);

        var foot = '';
        if (b.status === 'available') {
            var opts = window.EXH_DATA.exhibitors.map(function (e) {
                return '<option value="' + e.id + '">' + e.name + '（' + e.industry + '）</option>';
            }).join('');
            foot = '<select id="mExhibitor" class="form-select form-select-sm" style="width:auto">' + opts + '</select>' +
                '<button class="btn btn-sm btn-accent" id="mReserve"><i class="bi bi-bookmark-check me-1"></i>预订</button>';
        } else if (b.status === 'reserved') {
            foot = '<button class="btn btn-sm btn-outline-deep" id="mRelease"><i class="bi bi-x-circle me-1"></i>释放展位</button>' +
                '<a href="' + window.EXH_ROUTES.contractNew + '" class="btn btn-sm btn-accent ms-auto"><i class="bi bi-file-earmark-plus me-1"></i>生成合同</a>';
        } else {
            foot = '<span class="text-muted small ms-auto">已签约/付款展位，请到合同管理维护</span>';
        }
        $('#boothModalFoot').html(foot);

        state.modal = state.modal || new bootstrap.Modal($('#boothModal')[0]);
        state.modal.show();

        $('#mReserve').off('click').on('click', function () {
            var eid = $('#mExhibitor').val();
            if (!eid) { Exh.toast('请选择参展商', 'warn'); return; }
            var unmask = Exh.mask(this, '预订中');
            Exh.post(window.EXH_ROUTES.reserve(b.id), { exhibitorId: eid }).then(function (r) {
                unmask();
                b.status = r.data.status; b.statusLabel = r.data.statusLabel; b.exhibitor = r.data.exhibitor;
                state.modal.hide();
                Exh.toast(r.msg);
                load();
            }).fail(function (r) { unmask(); Exh.toast((r && r.error) || '预订失败', 'error'); });
        });
        $('#mRelease').off('click').on('click', function () {
            var unmask = Exh.mask(this, '释放中');
            Exh.post(window.EXH_ROUTES.release(b.id)).then(function (r) {
                unmask();
                b.status = r.data.status; b.statusLabel = r.data.statusLabel; b.exhibitor = null;
                state.modal.hide();
                Exh.toast(r.msg);
                load();
            }).fail(function (r) { unmask(); Exh.toast((r && r.error) || '释放失败', 'error'); });
        });
    }

    function batch(action) {
        var ids = Object.keys(state.selected);
        if (!ids.length) { Exh.toast('请先框选展位', 'warn'); return; }
        var exhibitorId = $('#batchExhibitor').val();
        if (action === 'reserve' && !exhibitorId) { Exh.toast('批量预订请选择参展商', 'warn'); return; }
        Exh.confirm(action === 'reserve' ? '批量预订' : '批量释放', '确认对选中的 ' + ids.length + ' 个展位执行' + (action === 'reserve' ? '预订' : '释放') + '操作？', function () {
            Exh.post(window.EXH_ROUTES.batch, { ids: ids, action: action, exhibitorId: exhibitorId }).then(function (r) {
                Exh.toast(r.msg);
                state.selected = {};
                load();
            }).fail(function (r) { Exh.toast((r && r.error) || '操作失败', 'error'); });
        });
    }

    $(function () {
        if (!$svg.length) { return; }
        load();
        initMarquee();
        $('#refreshBtn').on('click', load);
        $('#clearSelBtn').on('click', function () { state.selected = {}; updateSelection(); });
        $('#batchReserveBtn').on('click', function () { batch('reserve'); });
        $('#batchReleaseBtn').on('click', function () { batch('release'); });
    });
})(jQuery);
