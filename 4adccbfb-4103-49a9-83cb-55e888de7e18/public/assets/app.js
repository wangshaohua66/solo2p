/* 会展运营平台前端核心脚本：jQuery AJAX 封装、CSRF 头、Toast、确认框 */
window.Exh = (function ($) {
    'use strict';

    $.ajaxSetup({
        beforeSend: function (xhr) {
            if (window.CSRF_TOKEN) {
                xhr.setRequestHeader('X-CSRF-Token', window.CSRF_TOKEN);
            }
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        }
    });

    function api(method, url, data) {
        var opt = { type: method, url: url, dataType: 'json' };
        if (data instanceof FormData) {
            opt.data = data;
            opt.processData = false;
            opt.contentType = false;
        } else {
            opt.data = data || {};
        }
        return $.ajax(opt).then(function (resp) {
            if (resp && resp.ok === false) {
                return $.Deferred().reject(resp);
            }
            return resp;
        });
    }

    function toast(msg, type) {
        type = type || 'success';
        var bg = type === 'error' ? 'bg-danger' : (type === 'warn' ? 'bg-warning' : 'bg-success');
        var icon = type === 'error' ? 'bi-x-circle' : (type === 'warn' ? 'bi-exclamation-triangle' : 'bi-check-circle');
        var $t = $(
            '<div class="toast align-items-center text-white ' + bg + ' border-0" role="alert">' +
            '<div class="d-flex"><div class="toast-body"><i class="bi ' + icon + ' me-2"></i>' + msg + '</div>' +
            '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>'
        );
        $('#toastZone').append($t);
        var inst = new bootstrap.Toast($t[0], { delay: 3200 });
        inst.show();
        $t.on('hidden.bs.toast', function () { $t.remove(); });
    }

    function confirmDialog(title, msg, onOk) {
        var html =
            '<div class="modal fade" tabindex="-1">' +
            '<div class="modal-dialog modal-dialog-centered">' +
            '<div class="modal-content"><div class="modal-header"><h6 class="modal-title"><i class="bi bi-shield-exclamation text-accent me-2"></i>' + title + '</h6>' +
            '<button class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body">' + msg + '</div>' +
            '<div class="modal-footer"><button class="btn btn-outline-deep btn-sm" data-bs-dismiss="modal">取消</button>' +
            '<button class="btn btn-accent btn-sm" id="cfOk">确认</button></div></div></div></div>';
        var $m = $(html).appendTo('body');
        var inst = new bootstrap.Modal($m[0]);
        inst.show();
        $m.find('#cfOk').on('click', function () {
            inst.hide();
            onOk && onOk();
        });
        $m.on('hidden.bs.modal', function () { $m.remove(); });
    }

    function mask(btn, label) {
        var $b = $(btn), old = $b.html();
        $b.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>' + (label || '处理中'));
        return function () { $b.prop('disabled', false).html(old); };
    }

    function fmtMoney(n) {
        n = Number(n) || 0;
        return '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
    }

    function statusLabel(code) {
        var map = {
            preparing: '筹备中', recruiting: '招商中', ongoing: '进行中', ended: '已结束',
            available: '可预订', reserved: '已预订', contracted: '已签约', paid: '已付款',
            draft: '草稿', pending_sm: '待销售审批', pending_finance: '待财务审批',
            pending_gm: '待总经理审批', signed: '已签署', paid: '已付款', rejected: '已驳回'
        };
        return map[code] || code;
    }

    return {
        api: api,
        get: function (u, d) { return api('GET', u, d); },
        post: function (u, d) { return api('POST', u, d); },
        toast: toast,
        confirm: confirmDialog,
        mask: mask,
        fmtMoney: fmtMoney,
        statusLabel: statusLabel
    };
})(jQuery);

/* DOM-ready 行为：AJAX 表单、确认按钮、POST 链接 */
(function ($) {
    'use strict';
    $(function () {
        // AJAX 表单：拦截提交，序列化后经 Exh.api 发送，携带 CSRF 头
        $(document).on('submit', 'form[data-exh-ajax]', function (e) {
            e.preventDefault();
            var $f = $(this);
            var url = $f.attr('action') || window.location.pathname;
            var method = ($f.attr('method') || 'POST').toUpperCase();
            var redirect = $f.data('redirect');
            var btn = $f.find('[type=submit]')[0];
            var unmask = btn ? Exh.mask(btn, '提交中') : function () {};
            Exh.api(method, url, $f.serialize()).then(function (resp) {
                unmask();
                if (resp.redirect) { window.location.href = resp.redirect; return; }
                if (redirect) { window.location.href = redirect; return; }
                Exh.toast(resp.msg || '操作成功');
                if (resp.reload !== false) { setTimeout(function () { window.location.reload(); }, 700); }
            }).fail(function (resp) {
                unmask();
                Exh.toast((resp && resp.error) || '操作失败，请重试', 'error');
            });
        });

        // 确认型 POST 按钮：<button data-exh-post="url" data-exh-params="k=v&k2=v2" data-confirm="..." data-title="..." data-redirect="url">
        $(document).on('click', '[data-exh-post]', function (e) {
            e.preventDefault();
            var $b = $(this);
            var confirmMsg = $b.data('confirm');
            var params = $b.data('exhParams') || '';
            var doPost = function () {
                var unmask = Exh.mask(this, '处理中');
                Exh.post($b.data('exhPost'), params).then(function (resp) {
                    unmask();
                    Exh.toast(resp.msg || '操作成功');
                    if (resp.redirect) { window.location.href = resp.redirect; return; }
                    if ($b.data('redirect')) { window.location.href = $b.data('redirect'); return; }
                    setTimeout(function () { window.location.reload(); }, 700);
                }).fail(function (resp) {
                    unmask();
                    Exh.toast((resp && resp.error) || '操作失败', 'error');
                });
            };
            if (confirmMsg) {
                Exh.confirm($b.data('title') || '确认操作', confirmMsg, doPost.bind(this));
            } else {
                doPost.call(this);
            }
        });
    });
})(jQuery);
