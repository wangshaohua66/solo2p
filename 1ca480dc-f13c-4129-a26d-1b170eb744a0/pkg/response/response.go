package response

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PageData struct {
	List      interface{} `json:"list"`
	Total     int64       `json:"total"`
	Page      int         `json:"page"`
	PageSize  int         `json:"page_size"`
	TotalPage int         `json:"total_page"`
}

const (
	CodeSuccess        = 0
	CodeBadRequest     = 40000
	CodeUnauthorized   = 40100
	CodeForbidden      = 40300
	CodeNotFound       = 40400
	CodeConflict       = 40900
	CodeInternalError  = 50000

	CodeContainerBase  = 10000
	CodeContainerNotFound  = 10001
	CodeContainerInvalid   = 10002
	CodeSlotOccupied       = 10003

	CodeBerthBase      = 20000
	CodeBerthOccupied      = 20001
	CodeBerthConflict      = 20002

	CodeAppointmentBase = 30000
	CodeAppointmentFull   = 30001
	CodeAppointmentBlacklist = 30002

	CodeReferBase           = 40000
	CodeReferNotFound       = 40001
	CodeReferCodeDuplicate  = 40002
	CodeReferBlacklisted    = 40003
	CodeReferCreditExceeded = 40004
	CodeBookingNotFound     = 40005
	CodeBookingNoDuplicate  = 40006
	CodeBookingStatusInvalid = 40007

	CodeDangerousBase   = 50000
	CodeDangerousCustomsError = 50001

	CodeBillingBase     = 60000
	CodeBillingInvoiceNotFound = 60001
)

var codeMessages = map[int]string{
	CodeSuccess:       "success",
	CodeBadRequest:    "bad request",
	CodeUnauthorized:  "unauthorized",
	CodeForbidden:     "forbidden",
	CodeNotFound:      "resource not found",
	CodeConflict:      "resource conflict",
	CodeInternalError: "internal server error",
}

func Success(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: codeMessages[CodeSuccess],
		Data:    data,
	})
}

func SuccessWithPage(c echo.Context, list interface{}, total int64, page, pageSize int) error {
	totalPage := 0
	if pageSize > 0 {
		totalPage = int((total + int64(pageSize) - 1) / int64(pageSize))
	}
	return c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: codeMessages[CodeSuccess],
		Data: PageData{
			List:      list,
			Total:     total,
			Page:      page,
			PageSize:  pageSize,
			TotalPage: totalPage,
		},
	})
}

func Fail(c echo.Context, code int, message string) error {
	httpStatus := http.StatusInternalServerError
	switch {
	case code >= 40000 && code < 50000:
		httpStatus = http.StatusBadRequest
		if code >= 40100 && code < 40200 {
			httpStatus = http.StatusUnauthorized
		} else if code >= 40300 && code < 40400 {
			httpStatus = http.StatusForbidden
		} else if code >= 40400 && code < 40500 {
			httpStatus = http.StatusNotFound
		} else if code >= 40900 && code < 41000 {
			httpStatus = http.StatusConflict
		}
	case code >= 50000:
		httpStatus = http.StatusInternalServerError
	}

	if message == "" {
		if msg, ok := codeMessages[code]; ok {
			message = msg
		} else {
			message = "business error"
		}
	}

	return c.JSON(httpStatus, Response{
		Code:    code,
		Message: message,
	})
}
