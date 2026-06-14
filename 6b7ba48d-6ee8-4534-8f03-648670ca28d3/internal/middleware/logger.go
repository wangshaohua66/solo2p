package middleware

import (
	"craftbrew-tracker/internal/util"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type StatusRecorder struct {
	echo.Response
	Status int
}

func (r *StatusRecorder) WriteHeader(code int) {
	r.Status = code
	r.Response.WriteHeader(code)
}

func RequestLogger() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			path := c.Request().URL.Path
			raw := c.Request().URL.RawQuery
			if raw != "" {
				path = path + "?" + raw
			}

			traceID := util.GenerateTraceID()
			c.Set("traceId", traceID)

			rec := &StatusRecorder{Response: *c.Response()}
			c.Response().Writer = rec

			reqID := c.Request().Header.Get("X-Request-Id")
			if reqID == "" {
				reqID = traceID
			}

			chainErr := next(c)
			if chainErr != nil {
				c.Error(chainErr)
			}

			latency := time.Since(start)
			status := rec.Status
			if status == 0 {
				status = c.Response().Status
			}

			var event *zerolog.Event
			switch {
			case status >= 500:
				event = log.Error()
			case status >= 400:
				event = log.Warn()
			default:
				event = log.Info()
			}

			username := "-"
			if u := GetAuth(c); u != nil {
				username = u.Username
			}

			event.
				Str("traceId", traceID).
				Str("requestId", reqID).
				Str("method", c.Request().Method).
				Str("path", path).
				Int("status", status).
				Str("latency", latency.String()).
				Int("latencyMs", int(latency.Milliseconds())).
				Str("remoteIP", c.RealIP()).
				Str("user", username).
				Str("userAgent", c.Request().UserAgent()).
				Str("resSize", strconv.FormatInt(c.Response().Size, 10)).
				Msg("http_request")

			return nil
		}
	}
}

func RecoverMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			defer func() {
				if r := recover(); r != nil {
					var err error
					switch t := r.(type) {
					case error:
						err = t
					default:
						err = echo.NewHTTPError(500, "internal error")
					}
					log.Error().
						Interface("panic", r).
						Str("traceId", getTraceID(c)).
						Str("path", c.Request().URL.Path).
						Stack().
						Msg("panic recovered")
					_ = util.FailInternal(c, err.Error())
				}
			}()
			return next(c)
		}
	}
}

func getTraceID(c echo.Context) string {
	if v := c.Get("traceId"); v != nil {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return "-"
}
