package errors

import "net/http"

type ErrorCode struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	HTTPCode int   `json:"-"`
}

var (
	Success = &ErrorCode{Code: 0, Message: "success", HTTPCode: http.StatusOK}

	ErrInvalidParams     = &ErrorCode{Code: 10001, Message: "参数校验失败", HTTPCode: http.StatusBadRequest}
	ErrUnauthorized      = &ErrorCode{Code: 10002, Message: "未授权访问", HTTPCode: http.StatusUnauthorized}
	ErrForbidden         = &ErrorCode{Code: 10003, Message: "无权限访问", HTTPCode: http.StatusForbidden}
	ErrNotFound          = &ErrorCode{Code: 10004, Message: "资源不存在", HTTPCode: http.StatusNotFound}
	ErrTooManyRequests   = &ErrorCode{Code: 10005, Message: "请求过于频繁", HTTPCode: http.StatusTooManyRequests}
	ErrConflict          = &ErrorCode{Code: 10006, Message: "资源冲突", HTTPCode: http.StatusConflict}

	ErrSampleNotFound     = &ErrorCode{Code: 20001, Message: "样本不存在", HTTPCode: http.StatusNotFound}
	ErrSampleStatusInvalid = &ErrorCode{Code: 20002, Message: "样本状态不合法", HTTPCode: http.StatusBadRequest}
	ErrSampleBarcodeExist  = &ErrorCode{Code: 20003, Message: "样本条码已存在", HTTPCode: http.StatusConflict}
	ErrSampleTypeInvalid   = &ErrorCode{Code: 20004, Message: "标本类型不合法", HTTPCode: http.StatusBadRequest}
	ErrSampleTimeInvalid   = &ErrorCode{Code: 20005, Message: "采集时间不合法", HTTPCode: http.StatusBadRequest}
	ErrSampleCannotCancel  = &ErrorCode{Code: 20006, Message: "当前状态无法取消", HTTPCode: http.StatusBadRequest}

	ErrInstitutionNotFound = &ErrorCode{Code: 21001, Message: "机构不存在", HTTPCode: http.StatusNotFound}
	ErrInstitutionDisabled = &ErrorCode{Code: 21002, Message: "机构已停用", HTTPCode: http.StatusBadRequest}

	ErrTestItemNotFound   = &ErrorCode{Code: 22001, Message: "检验项目不存在", HTTPCode: http.StatusNotFound}
	ErrTestItemDisabled   = &ErrorCode{Code: 22002, Message: "检验项目已停用", HTTPCode: http.StatusBadRequest}

	ErrCriticalValueUnreviewed = &ErrorCode{Code: 23001, Message: "危急值需双人复核", HTTPCode: http.StatusBadRequest}
	ErrCriticalValueReviewed   = &ErrorCode{Code: 23002, Message: "危急值已复核", HTTPCode: http.StatusBadRequest}

	ErrReportNotFound     = &ErrorCode{Code: 24001, Message: "报告不存在", HTTPCode: http.StatusNotFound}
	ErrReportNotGenerated = &ErrorCode{Code: 24002, Message: "报告未生成", HTTPCode: http.StatusBadRequest}
	ErrReportSigned       = &ErrorCode{Code: 24003, Message: "报告已签发不可修改", HTTPCode: http.StatusBadRequest}

	ErrSettlementNotFound  = &ErrorCode{Code: 25001, Message: "结算单不存在", HTTPCode: http.StatusNotFound}
	ErrSettlementConfirmed = &ErrorCode{Code: 25002, Message: "结算单已确认不可修改", HTTPCode: http.StatusBadRequest}
	ErrSettlementExist     = &ErrorCode{Code: 25003, Message: "当月结算单已存在", HTTPCode: http.StatusConflict}

	ErrDatabaseError  = &ErrorCode{Code: 50001, Message: "数据库操作异常", HTTPCode: http.StatusInternalServerError}
	ErrSystemError    = &ErrorCode{Code: 50002, Message: "系统内部错误", HTTPCode: http.StatusInternalServerError}
	ErrGenerateReport = &ErrorCode{Code: 50003, Message: "报告生成失败", HTTPCode: http.StatusInternalServerError}
	ErrFileUpload     = &ErrorCode{Code: 50004, Message: "文件上传失败", HTTPCode: http.StatusInternalServerError}
)

func (e *ErrorCode) Error() string {
	return e.Message
}

func (e *ErrorCode) WithMessage(msg string) *ErrorCode {
	return &ErrorCode{
		Code:     e.Code,
		Message:  msg,
		HTTPCode: e.HTTPCode,
	}
}
