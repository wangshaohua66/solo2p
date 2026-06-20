package util

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PageData struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func SuccessWithPage(c *gin.Context, list interface{}, total int64, page, pageSize int) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data: PageData{
			List:     list,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		},
	})
}

func Fail(c *gin.Context, err error) {
	appErr, ok := err.(*AppError)
	if !ok {
		appErr = NewAppError(http.StatusInternalServerError, 500, err.Error())
	}
	c.JSON(appErr.HTTPStatus, Response{
		Code:    appErr.Code,
		Message: appErr.Message,
	})
}

func FailWithMsg(c *gin.Context, code int, message string) {
	httpStatus := http.StatusBadRequest
	if code >= 500 {
		httpStatus = http.StatusInternalServerError
	} else if code >= 401 && code < 403 {
		httpStatus = http.StatusUnauthorized
	} else if code >= 403 && code < 404 {
		httpStatus = http.StatusForbidden
	} else if code >= 404 && code < 500 {
		httpStatus = http.StatusNotFound
	}
	c.JSON(httpStatus, Response{
		Code:    code,
		Message: message,
	})
}
