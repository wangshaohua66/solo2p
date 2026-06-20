(function(global) {
  'use strict';

  const Validator = {
    init() {
      if (global.$ && $.validator) {
        $.validator.setDefaults({
          errorElement: 'span',
          errorPlacement: function(error, element) {
            error.addClass('invalid-feedback d-block');
            element.closest('.form-group, .mb-3').append(error);
          },
          highlight: function(element) {
            $(element).addClass('is-invalid').removeClass('is-valid');
          },
          unhighlight: function(element) {
            $(element).removeClass('is-invalid').addClass('is-valid');
          }
        });

        $.validator.addMethod('temperature', function(value, element) {
          const num = parseFloat(value);
          return this.optional(element) || (!isNaN(num) && num >= -10 && num <= 50);
        }, '请输入有效温度(-10℃~50℃)');

        $.validator.addMethod('humidity', function(value, element) {
          const num = parseFloat(value);
          return this.optional(element) || (!isNaN(num) && num >= 0 && num <= 100);
        }, '请输入有效湿度(0%~100%)');

        $.validator.addMethod('score', function(value, element) {
          const num = parseFloat(value);
          return this.optional(element) || (!isNaN(num) && num >= 0 && num <= 100);
        }, '请输入0-100之间的分值');

        $.validator.addMethod('futureDate', function(value, element) {
          return this.optional(element) || new Date(value) >= new Date(new Date().toDateString());
        }, '日期不能早于今天');
      }
    },

    validateTastingScores(scores) {
      const errors = [];
      ['aromaQuality', 'aromaAmount', 'impurity', 'aftertaste', 'irritation'].forEach(key => {
        const v = scores[key];
        if (v === undefined || v === null || v === '') errors.push(`${this.scoreLabel(key)}不能为空`);
        else if (isNaN(v) || v < 0 || v > 100) errors.push(`${this.scoreLabel(key)}必须在0-100之间`);
      });
      return { valid: errors.length === 0, errors };
    },

    scoreLabel(key) {
      return {
        aromaQuality: '香气质', aromaAmount: '香气量',
        impurity: '杂气', aftertaste: '余味', irritation: '刺激性'
      }[key] || key;
    },

    validateFlipPlan(data) {
      const errors = [];
      if (!data.batchId) errors.push('请选择烟叶批次');
      if (!data.date) errors.push('请选择翻垛日期');
      if (!data.operator) errors.push('请选择操作人员');
      if (!errors.length && global.Store) {
        if (global.Store.checkFlipConflict(data.operator, data.date, data.id)) {
          errors.push('该操作人员当日已分配其他库房');
        }
      }
      return { valid: errors.length === 0, errors };
    }
  };

  global.Validator = Validator;
})(window);
