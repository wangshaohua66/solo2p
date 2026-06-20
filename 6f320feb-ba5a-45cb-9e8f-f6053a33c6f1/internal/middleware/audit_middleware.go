package middleware

import (
	"bytes"
	"encoding/json"
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/util"
	"equipment-trading-platform/pkg/database"
	"equipment-trading-platform/pkg/logger"
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (r responseBodyWriter) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func AuditLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		w := &responseBodyWriter{body: &bytes.Buffer{}, ResponseWriter: c.Writer}
		c.Writer = w

		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		c.Next()

		duration := time.Since(start).Milliseconds()

		userID := util.GetUserID(c)
		username := util.GetUsername(c)
		roles := util.GetRoles(c)

		module, action := extractModuleAction(c.FullPath(), c.Request.Method)

		logEntry := &model.OperationLog{
			UserID:       &userID,
			Username:     username,
			Role:         strings.Join(roles, ","),
			Module:       module,
			Action:       action,
			Method:       c.Request.Method,
			Path:         c.Request.URL.Path,
			IP:           c.ClientIP(),
			UserAgent:    c.Request.UserAgent(),
			Params:       truncateString(string(requestBody), 2000),
			Result:       truncateString(w.body.String(), 2000),
			Status:       "success",
			ExecTime:     duration,
		}

		if c.Writer.Status() >= 400 {
			logEntry.Status = "failed"
			var resp util.Response
			if err := json.Unmarshal(w.body.Bytes(), &resp); err == nil {
				logEntry.ErrorMsg = truncateString(resp.Message, 500)
			}
		}

		if userID > 0 || c.Writer.Status() >= 400 {
			if err := database.DB.Create(logEntry).Error; err != nil {
				logger.Errorf("create operation log failed: %v", err)
			}
		}
	}
}

func extractModuleAction(path, method string) (string, string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 2 {
		module := parts[1]
		action := method
		if len(parts) >= 3 {
			action = action + "_" + parts[2]
		}
		return module, action
	}
	return "system", method
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
