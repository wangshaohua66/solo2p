package util

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/google/uuid"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	TraceID string      `json:"traceId,omitempty"`
}

type PageResult struct {
	Items    interface{} `json:"items"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type ErrorResponse struct {
	Code    int           `json:"code"`
	Message string        `json:"message"`
	Errors  []ErrorDetail `json:"errors,omitempty"`
	TraceID string        `json:"traceId,omitempty"`
}

const (
	CodeSuccess           = 0
	CodeBadRequest        = 40000
	CodeUnauthorized      = 40100
	CodeForbidden         = 40300
	CodeNotFound          = 40400
	CodeConflict          = 40900
	CodeValidation        = 42200
	CodeInternalError     = 50000
)

func Success(c echo.Context, data interface{}) error {
	traceID := getTraceID(c)
	return c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: "success",
		Data:    data,
		TraceID: traceID,
	})
}

func Created(c echo.Context, data interface{}) error {
	traceID := getTraceID(c)
	return c.JSON(http.StatusCreated, Response{
		Code:    CodeSuccess,
		Message: "created",
		Data:    data,
		TraceID: traceID,
	})
}

func Page(c echo.Context, items interface{}, total int64, page, pageSize int) error {
	return Success(c, PageResult{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func Fail(c echo.Context, httpStatus int, code int, message string, errors ...ErrorDetail) error {
	traceID := getTraceID(c)
	return c.JSON(httpStatus, ErrorResponse{
		Code:    code,
		Message: message,
		Errors:  errors,
		TraceID: traceID,
	})
}

func FailBadRequest(c echo.Context, message string, errors ...ErrorDetail) error {
	return Fail(c, http.StatusBadRequest, CodeBadRequest, message, errors...)
}

func FailUnauthorized(c echo.Context, message string) error {
	return Fail(c, http.StatusUnauthorized, CodeUnauthorized, message)
}

func FailForbidden(c echo.Context, message string) error {
	return Fail(c, http.StatusForbidden, CodeForbidden, message)
}

func FailNotFound(c echo.Context, message string) error {
	return Fail(c, http.StatusNotFound, CodeNotFound, message)
}

func FailConflict(c echo.Context, message string) error {
	return Fail(c, http.StatusConflict, CodeConflict, message)
}

func FailValidation(c echo.Context, message string, errors ...ErrorDetail) error {
	return Fail(c, http.StatusUnprocessableEntity, CodeValidation, message, errors...)
}

func FailInternal(c echo.Context, message string) error {
	return Fail(c, http.StatusInternalServerError, CodeInternalError, message)
}

func getTraceID(c echo.Context) string {
	if c == nil {
		return uuid.NewString()
	}
	if v := c.Get("traceId"); v != nil {
		if id, ok := v.(string); ok {
			return id
		}
	}
	id := uuid.NewString()
	c.Set("traceId", id)
	return id
}

func GenerateTraceID() string {
	return uuid.NewString()
}

func Now() time.Time {
	return time.Now().UTC()
}

func StringPtr(s string) *string { return &s }
func Int64Ptr(i int64) *int64   { return &i }
func Float64Ptr(f float64) *float64 { return &f }
func BoolPtr(b bool) *bool      { return &b }
func TimePtr(t time.Time) *time.Time { return &t }
