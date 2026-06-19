const FormValidator = {
  rules: {
    required: (value) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value.toString().trim() !== '';
    },
    phone: (value) => /^1[3-9]\d{9}$/.test(value),
    idCard: (value) => /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(value),
    email: (value) => /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(value),
    minLength: (value, min) => value && value.toString().length >= min,
    maxLength: (value, max) => value && value.toString().length <= max,
    number: (value) => !isNaN(Number(value)),
    min: (value, min) => Number(value) >= min,
    max: (value, max) => Number(value) <= max,
    pattern: (value, pattern) => new RegExp(pattern).test(value)
  },

  messages: {
    required: '此项为必填项',
    phone: '请输入正确的手机号码',
    idCard: '请输入正确的身份证号码',
    email: '请输入正确的邮箱地址',
    minLength: (min) => `最少输入${min}个字符`,
    maxLength: (max) => `最多输入${max}个字符`,
    number: '请输入数字',
    min: (min) => `不能小于${min}`,
    max: (max) => `不能大于${max}`,
    pattern: '格式不正确'
  },

  validate(value, rules) {
    const errors = [];
    for (const rule of rules) {
      let ruleName, params;
      if (typeof rule === 'string') {
        ruleName = rule;
        params = [];
      } else {
        ruleName = rule.rule;
        params = rule.params || [];
      }

      const validator = this.rules[ruleName];
      if (validator && !validator(value, ...params)) {
        let message = rule.message || this.messages[ruleName];
        if (typeof message === 'function') {
          message = message(...params);
        }
        errors.push(message);
      }
    }
    return errors;
  },

  validateForm(formData, schema) {
    const errors = {};
    let isValid = true;

    for (const [field, rules] of Object.entries(schema)) {
      const value = formData[field];
      const fieldErrors = this.validate(value, rules);
      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
        isValid = false;
      }
    }

    return { isValid, errors };
  },

  showErrors($form, errors) {
    $form.find('.is-invalid').removeClass('is-invalid');
    $form.find('.invalid-feedback').remove();

    for (const [field, messages] of Object.entries(errors)) {
      const $field = $form.find(`[name="${field}"]`);
      if ($field.length) {
        $field.addClass('is-invalid');
        $field.after(`<div class="invalid-feedback">${messages[0]}</div>`);
      }
    }
  },

  clearErrors($form) {
    $form.find('.is-invalid').removeClass('is-invalid');
    $form.find('.invalid-feedback').remove();
  }
};

window.FormValidator = FormValidator;
