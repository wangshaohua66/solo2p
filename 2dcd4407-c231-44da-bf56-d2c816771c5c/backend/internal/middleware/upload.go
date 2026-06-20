package middleware

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"exhibition-center/config"
)

const (
	MaxUploadSizeDefault = 50 * 1024 * 1024
)

type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func FileUploadLimit(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		contentLen := c.Request().ContentLength
		maxSize := config.AppConfig.MaxUploadSize
		if maxSize == 0 {
			maxSize = MaxUploadSizeDefault
		}

		if contentLen > maxSize {
			return c.JSON(http.StatusRequestEntityTooLarge, APIError{
				Code:    413,
				Message: fmt.Sprintf("文件大小超过限制，最大允许 %d MB", maxSize/(1024*1024)),
			})
		}

		c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, maxSize)

		return next(c)
	}
}

func RequestLogger(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		return next(c)
	}
}

func CORSMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		c.Response().Header().Set("Access-Control-Allow-Origin", "*")
		c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Response().Header().Set("Access-Control-Expose-Headers", "Content-Disposition")

		if c.Request().Method == "OPTIONS" {
			return c.NoContent(http.StatusNoContent)
		}

		return next(c)
	}
}
