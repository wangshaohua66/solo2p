/* ==========================================================================
   validator.js — 表单校验工具（基于 jQuery Validation）
   ========================================================================== */
(function (global) {
  'use strict';

  var Validator = {};

  /* 通用规则集 */
  Validator.rules = {
    required: { required: true, messages: { required: '此项为必填项' } },
    date: {
      required: true,
      dateISO: true,
      messages: { required: '请选择日期', dateISO: '日期格式应为 YYYY-MM-DD' }
    },
    percent: {
      required: true,
      number: true,
      range: [0, 100],
      messages: { required: '请输入百分比', number: '必须为数字', range: '范围 0-100' }
    },
    positiveNumber: {
      required: true,
      number: true,
      min: 0,
      messages: { required: '此项必填', number: '必须为数字', min: '不能为负数' }
    },
    phone: {
      required: true,
      pattern: /^1[3-9]\d{9}$/,
      messages: { required: '请输入手机号', pattern: '手机号格式不正确' }
    }
  };

  /* 应用校验：返回 validator 实例 */
  Validator.apply = function (formSelector, rules, messages, submitHandler) {
    var $form = $(formSelector);
    if (!$form.length) return null;
    var mergedRules = rules || {};
    // 应用浮动标签样式：错误时为 form-control 添加红色边框（CSS 已处理 .is-invalid）
    var v = $form.validate({
      rules: mergedRules,
      messages: messages || {},
      errorElement: 'div',
      errorClass: 'is-invalid',
      validClass: 'is-valid',
      errorPlacement: function (error, element) {
        var $el = $(element);
        if ($el.hasClass('form-control') || $el.hasClass('form-select')) {
          $el.addClass('is-invalid');
          error.addClass('invalid-feedback d-block');
          if ($el.parent().hasClass('input-group')) {
            $el.parent().after(error);
          } else if ($el.closest('.form-floating').length) {
            $el.closest('.form-floating').after(error);
          } else {
            $el.after(error);
          }
        } else {
          error.insertAfter($el);
        }
      },
      success: function (label, element) {
        $(element).removeClass('is-invalid').addClass('is-valid');
        $(label).remove();
      },
      highlight: function (element) { $(element).addClass('is-invalid').removeClass('is-valid'); },
      unhighlight: function (element) { $(element).removeClass('is-invalid'); },
      submitHandler: function (form) {
        if (submitHandler) { submitHandler(form, v); return false; }
        return false;
      }
    });
    return v;
  };

  /* 便捷：校验并返回是否通过（不真正提交） */
  Validator.isValid = function (formSelector) {
    var v = $(formSelector).data('validator') || $(formSelector).validate();
    return v.form();
  };

  global.App = global.App || {};
  global.App.Validator = Validator;
})(window);
