const Validator = (function() {
    const PROVINCES = '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领';
    const PLATE_PATTERN = new RegExp('^[' + PROVINCES + '][A-Z][A-HJ-NP-Z0-9]{5}$');
    const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
    const PHONE_PATTERN = /^1[3-9]\d{9}$/;

    const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
    const VIN_CHARS = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';

    function validatePlateNo(plateNo) {
        if (!plateNo) return { valid: false, message: '请输入车牌号' };
        plateNo = plateNo.toUpperCase().replace(/\s/g, '');
        if (!PLATE_PATTERN.test(plateNo)) {
            return { valid: false, message: '车牌号格式不正确，应为省份简称+字母+5位数字/字母' };
        }
        return { valid: true };
    }

    function validateVin(vin) {
        if (!vin) return { valid: false, message: '请输入VIN码' };
        vin = vin.toUpperCase().replace(/\s/g, '');
        if (!VIN_PATTERN.test(vin)) {
            return { valid: false, message: 'VIN码必须为17位，且不能包含I、O、Q' };
        }

        let sum = 0;
        for (let i = 0; i < 17; i++) {
            if (i === 8) continue;
            const charIndex = VIN_CHARS.indexOf(vin[i]);
            sum += charIndex * VIN_WEIGHTS[i];
        }

        const checkValue = sum % 11;
        const checkChar = checkValue === 10 ? 'X' : checkValue.toString();
        if (vin[8] !== checkChar) {
            return { valid: false, message: 'VIN码校验位不正确' };
        }

        return { valid: true };
    }

    function validatePhone(phone) {
        if (!phone) return { valid: false, message: '请输入手机号' };
        phone = phone.replace(/\s/g, '');
        if (!PHONE_PATTERN.test(phone)) {
            return { valid: false, message: '请输入有效的11位手机号码' };
        }
        return { valid: true };
    }

    function validateMileage(mileage) {
        if (mileage === '' || mileage === null || mileage === undefined) {
            return { valid: false, message: '请输入里程数' };
        }
        const num = parseInt(mileage, 10);
        if (isNaN(num)) {
            return { valid: false, message: '里程数必须为数字' };
        }
        if (num < 0 || num > 999999) {
            return { valid: false, message: '里程数必须在0-999999之间' };
        }
        return { valid: true };
    }

    function validateAmount(amount) {
        if (amount === '' || amount === null || amount === undefined) {
            return { valid: false, message: '请输入金额' };
        }
        const num = parseFloat(amount);
        if (isNaN(num) || num < 0) {
            return { valid: false, message: '金额必须为非负数' };
        }
        return { valid: true };
    }

    function validateRequired(value, fieldName) {
        if (value === '' || value === null || value === undefined ||
            (Array.isArray(value) && value.length === 0)) {
            return { valid: false, message: '请输入' + fieldName };
        }
        return { valid: true };
    }

    function validateNotFutureDate(dateStr) {
        if (!dateStr) return { valid: true };
        const inputDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (inputDate > today) {
            return { valid: false, message: '日期不能晚于今天' };
        }
        return { valid: true };
    }

    function extendJQueryValidation() {
        if ($.validator) {
            $.validator.addMethod('plateNo', function(value, element) {
                return validatePlateNo(value).valid;
            }, '车牌号格式不正确');

            $.validator.addMethod('vinCode', function(value, element) {
                return validateVin(value).valid;
            }, 'VIN码格式不正确');

            $.validator.addMethod('cnMobile', function(value, element) {
                return validatePhone(value).valid;
            }, '请输入有效的手机号码');

            $.validator.addMethod('mileage', function(value, element) {
                return validateMileage(value).valid;
            }, '请输入有效的里程数');

            $.validator.addMethod('notFutureDate', function(value, element) {
                return validateNotFutureDate(value).valid;
            }, '日期不能晚于今天');

            $.validator.setDefaults({
                errorElement: 'div',
                errorClass: 'invalid-feedback',
                errorPlacement: function(error, element) {
                    if (element.parent('.input-group').length) {
                        error.insertAfter(element.parent());
                    } else if (element.hasClass('select2-hidden-accessible')) {
                        error.insertAfter(element.next('.select2-container'));
                    } else {
                        error.insertAfter(element);
                    }
                },
                highlight: function(element) {
                    $(element).addClass('is-invalid').removeClass('is-valid');
                },
                unhighlight: function(element) {
                    $(element).removeClass('is-invalid').addClass('is-valid');
                }
            });
        }
    }

    function validateForm(formId, rules) {
        const $form = $('#' + formId);
        if ($.validator) {
            return $form.validate({
                rules: rules,
                submitHandler: function(form) {
                    return true;
                }
            }).form();
        }
        return true;
    }

    return {
        validatePlateNo,
        validateVin,
        validatePhone,
        validateMileage,
        validateAmount,
        validateRequired,
        validateNotFutureDate,
        extendJQueryValidation,
        validateForm,
        PLATE_PATTERN,
        VIN_PATTERN,
        PHONE_PATTERN
    };
})();
