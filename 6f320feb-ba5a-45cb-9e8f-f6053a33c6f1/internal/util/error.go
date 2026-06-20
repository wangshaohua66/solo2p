package util

type AppError struct {
	HTTPStatus int
	Code       int
	Message    string
}

func (e *AppError) Error() string {
	return e.Message
}

func NewAppError(httpStatus, code int, message string) *AppError {
	return &AppError{
		HTTPStatus: httpStatus,
		Code:       code,
		Message:    message,
	}
}

var (
	ErrUnauthorized     = NewAppError(401, 401, "未授权或Token已过期")
	ErrForbidden        = NewAppError(403, 403, "无权限访问")
	ErrNotFound         = NewAppError(404, 404, "资源不存在")
	ErrBadRequest       = NewAppError(400, 400, "请求参数错误")
	ErrInternal         = NewAppError(500, 500, "服务器内部错误")
	ErrUserExists       = NewAppError(400, 1001, "用户已存在")
	ErrUserNotFound     = NewAppError(404, 1002, "用户不存在")
	ErrPassword         = NewAppError(400, 1003, "密码错误")
	ErrUserDisabled     = NewAppError(403, 1004, "账号已被禁用")
	ErrDeviceNotFound   = NewAppError(404, 2001, "设备不存在")
	ErrDeviceStatus     = NewAppError(400, 2002, "设备状态不允许此操作")
	ErrTxNotFound       = NewAppError(404, 3001, "交易不存在")
	ErrTxStatus         = NewAppError(400, 3002, "交易状态不允许此操作")
	ErrInsufficientFund = NewAppError(400, 3003, "资金不足")
	ErrValuationExists  = NewAppError(400, 4001, "该设备已有有效评估报告")
	ErrDisputeNotFound  = NewAppError(404, 5001, "纠纷不存在")
)
