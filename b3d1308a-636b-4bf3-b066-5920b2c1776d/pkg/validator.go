package pkg

import (
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"sync"

	"github.com/go-playground/validator/v10"
)

var (
	validate     *validator.Validate
	validateOnce sync.Once
)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationErrors []ValidationError

func (v ValidationErrors) Error() string {
	if len(v) == 0 {
		return ""
	}
	var msgs []string
	for _, e := range v {
		msgs = append(msgs, fmt.Sprintf("%s: %s", e.Field, e.Message))
	}
	return strings.Join(msgs, "; ")
}

func GetValidator() *validator.Validate {
	validateOnce.Do(func() {
		validate = validator.New()

		validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
			name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
			if name == "-" {
				return ""
			}
			return name
		})

		_ = validate.RegisterValidation("phone", validatePhone)
		_ = validate.RegisterValidation("device_code", validateDeviceCode)
		_ = validate.RegisterValidation("device_type", validateDeviceType)
		_ = validate.RegisterValidation("device_status", validateDeviceStatus)
		_ = validate.RegisterValidation("fault_type", validateFaultType)
		_ = validate.RegisterValidation("fault_level", validateFaultLevel)
		_ = validate.RegisterValidation("workorder_status", validateWorkOrderStatus)
		_ = validate.RegisterValidation("priority", validatePriority)
		_ = validate.RegisterValidation("role", validateRole)
		_ = validate.RegisterValidation("command_type", validateCommandType)
		_ = validate.RegisterValidation("command_status", validateCommandStatus)
	})
	return validate
}

func ValidateStruct(s interface{}) error {
	err := GetValidator().Struct(s)
	if err == nil {
		return nil
	}
	var validationErrs ValidationErrors
	if ve, ok := err.(validator.ValidationErrors); ok {
		for _, fe := range ve {
			validationErrs = append(validationErrs, ValidationError{
				Field:   fe.Field(),
				Message: getValidationMessage(fe),
			})
		}
	}
	if len(validationErrs) > 0 {
		return validationErrs
	}
	return err
}

func ValidateVar(field interface{}, tag string, fieldName string) error {
	err := GetValidator().Var(field, tag)
	if err == nil {
		return nil
	}
	if ve, ok := err.(validator.ValidationErrors); ok {
		var validationErrs ValidationErrors
		for _, fe := range ve {
			validationErrs = append(validationErrs, ValidationError{
				Field:   fieldName,
				Message: getValidationMessage(fe),
			})
		}
		return validationErrs
	}
	return err
}

func getValidationMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "该字段为必填项"
	case "required_if":
		return "该字段为必填项"
	case "email":
		return "邮箱格式不正确"
	case "phone":
		return "手机号格式不正确"
	case "min":
		if fe.Type().Kind() == reflect.String {
			return fmt.Sprintf("长度不能少于 %s 个字符", fe.Param())
		}
		return fmt.Sprintf("不能小于 %s", fe.Param())
	case "max":
		if fe.Type().Kind() == reflect.String {
			return fmt.Sprintf("长度不能超过 %s 个字符", fe.Param())
		}
		return fmt.Sprintf("不能大于 %s", fe.Param())
	case "len":
		return fmt.Sprintf("长度必须等于 %s", fe.Param())
	case "gte":
		return fmt.Sprintf("必须大于等于 %s", fe.Param())
	case "lte":
		return fmt.Sprintf("必须小于等于 %s", fe.Param())
	case "gt":
		return fmt.Sprintf("必须大于 %s", fe.Param())
	case "lt":
		return fmt.Sprintf("必须小于 %s", fe.Param())
	case "oneof":
		return fmt.Sprintf("取值必须为 [%s] 之一", strings.Replace(fe.Param(), " ", "/", -1))
	case "numeric":
		return "必须为数字"
	case "alpha":
		return "只能包含字母"
	case "alphanum":
		return "只能包含字母和数字"
	case "alphaunicode":
		return "只能包含Unicode字母"
	case "device_code":
		return "设备编码格式不正确，应为字母数字组成的6-64位字符串"
	case "device_type":
		return "设备类型必须为 hps、led 或 view"
	case "device_status":
		return "设备状态必须为 online、offline 或 fault"
	case "fault_type":
		return "故障类型不合法"
	case "fault_level":
		return "故障级别必须为 critical、major、minor 或 warning"
	case "workorder_status":
		return "工单状态不合法"
	case "priority":
		return "优先级必须为 high、medium 或 low"
	case "role":
		return "角色必须为 admin、area_manager 或 operator"
	case "command_type":
		return "指令类型必须为 on 或 off"
	case "command_status":
		return "指令状态不合法"
	case "url":
		return "URL格式不正确"
	case "ip":
		return "IP地址格式不正确"
	case "datetime":
		return "日期时间格式不正确"
	case "uuid":
		return "UUID格式不正确"
	default:
		return fmt.Sprintf("字段验证失败 [%s]", fe.Tag())
	}
}

func ParseValidationError(err error) ValidationErrors {
	if err == nil {
		return nil
	}
	var ve ValidationErrors
	if errors.As(err, &ve) {
		return ve
	}
	return ValidationErrors{
		{Field: "unknown", Message: err.Error()},
	}
}

var phoneRegex = regexp.MustCompile(`^1[3-9]\d{9}$`)

func validatePhone(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	if value == "" {
		return true
	}
	return phoneRegex.MatchString(value)
}

var deviceCodeRegex = regexp.MustCompile(`^[A-Za-z0-9_-]{6,64}$`)

func validateDeviceCode(fl validator.FieldLevel) bool {
	value := fl.Field().String()
	if value == "" {
		return true
	}
	return deviceCodeRegex.MatchString(value)
}

func validateDeviceType(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "hps", "led", "view", "":
		return true
	default:
		return false
	}
}

func validateDeviceStatus(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "online", "offline", "fault", "":
		return true
	default:
		return false
	}
}

func validateFaultType(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "voltage_abnormal", "over_current", "brightness_decay", "comm_interrupt",
		"over_temperature", "power_abnormal", "light_off", "other", "":
		return true
	default:
		return false
	}
}

func validateFaultLevel(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "critical", "major", "minor", "warning", "":
		return true
	default:
		return false
	}
}

func validateWorkOrderStatus(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "created", "accepted", "processing", "reviewing", "completed", "":
		return true
	default:
		return false
	}
}

func validatePriority(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "high", "medium", "low", "":
		return true
	default:
		return false
	}
}

func validateRole(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "admin", "area_manager", "operator", "":
		return true
	default:
		return false
	}
}

func validateCommandType(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "on", "off":
		return true
	default:
		return false
	}
}

func validateCommandStatus(fl validator.FieldLevel) bool {
	switch fl.Field().String() {
	case "pending", "executing", "success", "failed", "timeout", "":
		return true
	default:
		return false
	}
}
