package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"lab-management/internal/model"
	appErr "lab-management/internal/pkg/errors"
	"lab-management/internal/pkg/response"
	"lab-management/internal/pkg/utils"
	"lab-management/internal/pkg/config"
	"lab-management/internal/repository"
)

type AuthMiddleware struct {
	userRepo  *repository.UserRepository
	jwtSecret string
}

func NewAuthMiddleware(userRepo *repository.UserRepository, jwtSecret string) *AuthMiddleware {
	return &AuthMiddleware{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

type JwtClaims struct {
	UserID        uint   `json:"user_id"`
	Username      string `json:"username"`
	Role          string `json:"role"`
	InstitutionID uint   `json:"institution_id"`
	jwt.RegisteredClaims
}

func (m *AuthMiddleware) Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Fail(c, appErr.ErrUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			response.Fail(c, appErr.ErrUnauthorized.WithMessage("认证格式错误"))
			return
		}

		tokenStr := parts[1]
		claims := &JwtClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(m.jwtSecret), nil
		})

		if err != nil || !token.Valid {
			response.Fail(c, appErr.ErrUnauthorized.WithMessage("Token无效或已过期"))
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("institution_id", claims.InstitutionID)
		c.Next()
	}
}

func (m *AuthMiddleware) RoleAuth(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			response.Fail(c, appErr.ErrUnauthorized)
			return
		}
		userRole := role.(string)
		allowed := false
		for _, r := range roles {
			if r == userRole {
				allowed = true
				break
			}
		}
		if !allowed {
			response.Fail(c, appErr.ErrForbidden)
			return
		}
		c.Next()
	}
}

func (m *AuthMiddleware) InstitutionOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		instID, exists := c.Get("institution_id")
		if !exists || instID.(uint) == 0 {
			response.Fail(c, appErr.ErrForbidden.WithMessage("仅机构用户可访问"))
			return
		}
		c.Next()
	}
}

type RateLimitMiddleware struct {
	limitPerSec int
	tokens      chan struct{}
}

func NewRateLimitMiddleware(limitPerSec int) *RateLimitMiddleware {
	m := &RateLimitMiddleware{
		limitPerSec: limitPerSec,
		tokens:      make(chan struct{}, limitPerSec),
	}
	go m.refill()
	return m
}

func (m *RateLimitMiddleware) refill() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for range ticker.C {
		for i := 0; i < m.limitPerSec; i++ {
			select {
			case m.tokens <- struct{}{}:
			default:
			}
		}
	}
}

func (m *RateLimitMiddleware) RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		select {
		case <-m.tokens:
			c.Next()
		default:
			response.Fail(c, appErr.ErrTooManyRequests)
		}
	}
}

type TraceIDMiddleware struct{}

func NewTraceIDMiddleware() *TraceIDMiddleware {
	return &TraceIDMiddleware{}
}

func (m *TraceIDMiddleware) Handle() gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = utils.GenerateTraceID()
		}
		c.Set("trace_id", traceID)
		c.Header("X-Trace-ID", traceID)
		c.Next()
	}
}

type CORSMiddleware struct{}

func NewCORSMiddleware() *CORSMiddleware {
	return &CORSMiddleware{}
}

func (m *CORSMiddleware) Handle() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-ID")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

type AuditMiddleware struct {
	auditLogRepo *repository.AuditLogRepository
	authMw       *AuthMiddleware
}

func NewAuditMiddleware(auditLogRepo *repository.AuditLogRepository) *AuditMiddleware {
	return &AuditMiddleware{
		auditLogRepo: auditLogRepo,
	}
}

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (r responseBodyWriter) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func (m *AuditMiddleware) Handle() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "GET" {
			c.Next()
			return
		}

		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method
		module, action := parseModuleAction(path, method)

		var reqBody []byte
		if c.Request.Body != nil {
			reqBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(reqBody))
		}

		w := &responseBodyWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBufferString(""),
		}
		c.Writer = w

		c.Next()

		latency := time.Since(start)
		_ = latency

		traceID, _ := c.Get("trace_id")
		userID, _ := c.Get("user_id")
		username, _ := c.Get("username")

		respBody := w.body.String()
		respCode := 0
		respMessage := ""
		if respBody != "" {
			var respMap map[string]interface{}
			if err := json.Unmarshal([]byte(respBody), &respMap); err == nil {
				if code, ok := respMap["code"].(float64); ok {
					respCode = int(code)
				}
				if msg, ok := respMap["message"].(string); ok {
					respMessage = msg
				}
			}
		}

		resourceID := parseResourceID(c)

		uid := uint(0)
		if userID != nil {
			uid = userID.(uint)
		}
		uname := ""
		if username != nil {
			uname = username.(string)
		}
		tid := ""
		if traceID != nil {
			tid = traceID.(string)
		}

		reqBodyStr := string(reqBody)
		if len(reqBodyStr) > 2000 {
			reqBodyStr = reqBodyStr[:2000] + "..."
		}

		log := &model.AuditLog{
			TraceID:     tid,
			UserID:      uid,
			Username:    uname,
			Action:      action,
			Module:      module,
			ResourceID:  resourceID,
			IPAddress:   c.ClientIP(),
			UserAgent:   c.GetHeader("User-Agent"),
			Method:      method,
			Path:        path,
			ReqParams:   reqBodyStr,
			RespCode:    respCode,
			RespMessage: respMessage,
			CreatedAt:   start,
		}

		_ = m.auditLogRepo.Create(log)
	}
}

func parseModuleAction(path, method string) (string, string) {
	path = strings.TrimPrefix(path, "/api/v1/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 {
		return "UNKNOWN", method
	}
	module := strings.ToUpper(parts[0])

	action := method
	if len(parts) >= 2 {
		last := parts[len(parts)-1]
		switch last {
		case "login":
			return "AUTH", "LOGIN"
		case "register":
			return "AUTH", "REGISTER"
		case "status":
			action = "UPDATE_STATUS"
		case "cancel":
			action = "CANCEL"
		case "results":
			action = "SUBMIT_RESULTS"
		case "review":
			action = "REVIEW"
		case "generate":
			action = "GENERATE"
		case "publish":
			action = "PUBLISH"
		case "confirm":
			action = "CONFIRM"
		case "batch":
			action = "BATCH_CREATE"
		}
	}
	if action == method {
		switch method {
		case "POST":
			action = "CREATE"
		case "PUT", "PATCH":
			action = "UPDATE"
		case "DELETE":
			action = "DELETE"
		}
	}
	return module, action
}

func parseResourceID(c *gin.Context) string {
	id := c.Param("id")
	if id != "" {
		return id
	}
	id = c.Param("barcode")
	if id != "" {
		return id
	}
	id = c.Param("reportNo")
	if id != "" {
		return id
	}
	return ""
}

func GenerateToken(user *model.User, cfg *config.Config) (string, int, error) {
	expireHours := cfg.JWT.ExpireHours
	expireAt := time.Now().Add(time.Duration(expireHours) * time.Hour)
	claims := JwtClaims{
		UserID:        user.ID,
		Username:      user.Username,
		Role:          user.Role,
		InstitutionID: user.InstitutionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expireAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "lab-management",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(cfg.JWT.Secret))
	if err != nil {
		return "", 0, err
	}
	return tokenStr, expireHours * 3600, nil
}

func GetCurrentUserID(ctx context.Context) uint {
	if ctx == nil {
		return 0
	}
	if id, ok := ctx.Value("user_id").(uint); ok {
		return id
	}
	return 0
}

func GetCurrentUserRole(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if role, ok := ctx.Value("role").(string); ok {
		return role
	}
	return ""
}

func GetCurrentInstitutionID(ctx context.Context) uint {
	if ctx == nil {
		return 0
	}
	if id, ok := ctx.Value("institution_id").(uint); ok {
		return id
	}
	return 0
}
