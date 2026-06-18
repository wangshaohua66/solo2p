package handler

import (
	"net/http"

	"fishery-api/model"

	"github.com/labstack/echo/v4"
)

func successResponse(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, model.Response{
		Code:    model.ErrCodeSuccess,
		Message: "success",
		Data:    data,
	})
}

func errorResponse(c echo.Context, code int, message string) error {
	return c.JSON(http.StatusOK, model.Response{
		Code:    code,
		Message: message,
	})
}

func badRequestResponse(c echo.Context, message string) error {
	return errorResponse(c, model.ErrCodeParamInvalid, message)
}

func notFoundResponse(c echo.Context, message string) error {
	return errorResponse(c, model.ErrCodeNotFound, message)
}

func systemErrorResponse(c echo.Context, message string) error {
	return errorResponse(c, model.ErrCodeSystemError, message)
}
