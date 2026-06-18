package middleware

import (
	"context"
	"fmt"
	"net/http"
	"runtime/debug"
	"time"

	"smart-lighting-api/model"
	"smart-lighting-api/pkg"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func RequestIDMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			requestID := c.Request().Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = uuid.New().String()
			}
			c.Response().Header().Set("X-Request-ID", requestID)
			req := c.Request()
			newCtx := context.WithValue(req.Context(), RequestIDKey, requestID)
			newCtx = pkg.WithRequestID(newCtx, requestID)
			c.SetRequest(req.WithContext(newCtx))
			return next(c)
		}
	}
}

func LoggerMiddleware(db *gorm.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			ctx := c.Request().Context()
			requestID := GetRequestID(ctx)
			userID := GetUserID(ctx)
			username := GetUsername(ctx)

			err := next(c)

			duration := time.Since(start).Milliseconds()
			status := c.Response().Status
			method := c.Request().Method
			uri := c.Request().RequestURI
			ip := c.RealIP()

			if err != nil {
				pkg.Error(ctx, "api request failed",
					zap.String("method", method),
					zap.String("uri", uri),
					zap.Int("status", status),
					zap.Int64("duration_ms", duration),
					zap.String("ip", ip),
					zap.Error(err))
			} else {
				pkg.Info(ctx, "api request completed",
					zap.String("method", method),
					zap.String("uri", uri),
					zap.Int("status", status),
					zap.Int64("duration_ms", duration),
					zap.String("ip", ip))
			}

			module := extractModule(uri)
			operation := extractOperation(method, uri)

			opLog := model.OperationLog{
				RequestID:  requestID,
				UserID:     userID,
				Username:   username,
				Module:     module,
				Operation:  operation,
				Method:     method,
				URL:        uri,
				IP:         ip,
				StatusCode: status,
				Duration:   duration,
				CreatedAt:  time.Now(),
			}
			if db != nil {
				go func() {
					_ = db.Create(&opLog).Error
				}()
			}
			return err
		}
	}
}

func extractModule(uri string) string {
	if len(uri) < 2 {
		return "unknown"
	}
	parts := splitPath(uri)
	if len(parts) >= 2 && parts[1] == "api" && len(parts) >= 3 {
		return parts[2]
	}
	if len(parts) >= 1 {
		return parts[0]
	}
	return "unknown"
}

func extractOperation(method, uri string) string {
	return fmt.Sprintf("%s %s", method, uri)
}

func splitPath(path string) []string {
	var parts []string
	path = trimLeadingSlash(path)
	if path == "" {
		return parts
	}
	start := 0
	for i := 0; i < len(path); i++ {
		if path[i] == '/' {
			if i > start {
				parts = append(parts, path[start:i])
			}
			start = i + 1
		}
	}
	if start < len(path) {
		parts = append(parts, path[start:])
	}
	return parts
}

func trimLeadingSlash(s string) string {
	for len(s) > 0 && s[0] == '/' {
		s = s[1:]
	}
	return s
}

func RecoveryMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (err error) {
			defer func() {
				if r := recover(); r != nil {
					ctx := c.Request().Context()
					stack := debug.Stack()
					pkg.Error(ctx, "panic recovered",
						zap.Any("panic", r),
						zap.ByteString("stack", stack))

					err = c.JSON(http.StatusInternalServerError, model.Response{
						Code:      500,
						Message:   "服务器内部错误，请稍后重试",
						RequestID: GetRequestID(ctx),
						Timestamp: time.Now().Unix(),
					})
				}
			}()
			return next(c)
		}
	}
}

func ErrorHandlerMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)
			if err == nil {
				return nil
			}

			ctx := c.Request().Context()
			requestID := GetRequestID(ctx)

			if he, ok := err.(*echo.HTTPError); ok {
				return c.JSON(he.Code, model.Response{
					Code:      he.Code,
					Message:   fmt.Sprintf("%v", he.Message),
					RequestID: requestID,
					Timestamp: time.Now().Unix(),
				})
			}

			if ve, ok := err.(pkg.ValidationErrors); ok {
				msg := ""
				if len(ve) > 0 {
					msg = ve[0].Message
				}
				return c.JSON(http.StatusBadRequest, model.Response{
					Code:      400,
					Message:   "参数校验失败: " + msg,
					Data:      ve,
					RequestID: requestID,
					Timestamp: time.Now().Unix(),
				})
			}

			pkg.Warn(ctx, "unhandled error", zap.Error(err))
			return c.JSON(http.StatusInternalServerError, model.Response{
				Code:      500,
				Message:   err.Error(),
				RequestID: requestID,
				Timestamp: time.Now().Unix(),
			})
		}
	}
}
