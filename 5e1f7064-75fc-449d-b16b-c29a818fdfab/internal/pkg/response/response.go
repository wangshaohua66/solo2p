package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
	appErr "lab-management/internal/pkg/errors"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	TraceID string      `json:"trace_id,omitempty"`
}

type PageResponse struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

func Success(c *gin.Context, data interface{}) {
	traceID, _ := c.Get("trace_id")
	c.JSON(http.StatusOK, Response{
		Code:    appErr.Success.Code,
		Message: appErr.Success.Message,
		Data:    data,
		TraceID: toString(traceID),
	})
}

func SuccessPage(c *gin.Context, list interface{}, total int64, page, pageSize int) {
	Success(c, PageResponse{
		List:     list,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func Fail(c *gin.Context, err *appErr.ErrorCode) {
	traceID, _ := c.Get("trace_id")
	c.JSON(err.HTTPCode, Response{
		Code:    err.Code,
		Message: err.Message,
		TraceID: toString(traceID),
	})
	c.Abort()
}

func FailWithDetail(c *gin.Context, err *appErr.ErrorCode, detail string) {
	traceID, _ := c.Get("trace_id")
	c.JSON(err.HTTPCode, Response{
		Code:    err.Code,
		Message: err.Message + ": " + detail,
		TraceID: toString(traceID),
	})
	c.Abort()
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
