package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"smart-lighting-api/config"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	UsernameKey  contextKey = "username"
	RoleKey      contextKey = "role"
	AreaIDKey    contextKey = "area_id"
	RequestIDKey contextKey = "request_id"
)

type UserClaims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	AreaID   int64  `json:"area_id"`
	jwt.RegisteredClaims
}

func GenerateToken(user *model.User) (string, time.Time, error) {
	jwtCfg := config.AppConf.JWT
	expireAt := time.Now().Add(time.Duration(jwtCfg.ExpireHours) * time.Hour)

	claims := UserClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		AreaID:   user.AreaID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expireAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    jwtCfg.Issuer,
			Subject:   user.Username,
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(jwtCfg.Secret))
	return tokenStr, expireAt, err
}

func ParseToken(tokenStr string) (*UserClaims, error) {
	jwtCfg := config.AppConf.JWT
	token, err := jwt.ParseWithClaims(tokenStr, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(jwtCfg.Secret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, errors.New("invalid token")
}

func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func AuthMiddleware(db *gorm.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ctx := c.Request().Context()
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				pkg.Warn(ctx, "missing authorization header")
				return c.JSON(http.StatusUnauthorized, model.Response{
					Code:    401,
					Message: "未提供认证凭证",
					Timestamp: time.Now().Unix(),
				})
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				pkg.Warn(ctx, "invalid authorization header format", zap.String("header", authHeader))
				return c.JSON(http.StatusUnauthorized, model.Response{
					Code:    401,
					Message: "认证凭证格式错误",
					Timestamp: time.Now().Unix(),
				})
			}

			tokenStr := parts[1]
			hashedToken := HashToken(tokenStr)
			var count int64
			_ = db.Model(&model.TokenBlacklist{}).Where("token = ? AND expires_at > ?", hashedToken, time.Now()).Count(&count)
			if count > 0 {
				pkg.Warn(ctx, "token is blacklisted")
				return c.JSON(http.StatusUnauthorized, model.Response{
					Code:    401,
					Message: "登录状态已失效，请重新登录",
					Timestamp: time.Now().Unix(),
				})
			}

			claims, err := ParseToken(tokenStr)
			if err != nil {
				pkg.Warn(ctx, "parse token failed", zap.Error(err))
				return c.JSON(http.StatusUnauthorized, model.Response{
					Code:    401,
					Message: "无效的认证凭证",
					Timestamp: time.Now().Unix(),
				})
			}

			req := c.Request()
			newCtx := context.WithValue(req.Context(), UserIDKey, claims.UserID)
			newCtx = context.WithValue(newCtx, UsernameKey, claims.Username)
			newCtx = context.WithValue(newCtx, RoleKey, claims.Role)
			newCtx = context.WithValue(newCtx, AreaIDKey, claims.AreaID)
			c.SetRequest(req.WithContext(newCtx))

			pkg.Debug(ctx, "user authenticated",
				zap.Int64("user_id", claims.UserID),
				zap.String("username", claims.Username),
				zap.String("role", claims.Role))

			return next(c)
		}
	}
}

func RoleMiddleware(allowedRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ctx := c.Request().Context()
			userRole, ok := ctx.Value(RoleKey).(string)
			if !ok {
				return c.JSON(http.StatusForbidden, model.Response{
					Code:    403,
					Message: "用户角色信息缺失",
					Timestamp: time.Now().Unix(),
				})
			}
			for _, role := range allowedRoles {
				if role == userRole {
					return next(c)
				}
			}
			pkg.Warn(ctx, "permission denied",
				zap.String("user_role", userRole),
				zap.Strings("allowed_roles", allowedRoles))
			return c.JSON(http.StatusForbidden, model.Response{
				Code:    403,
				Message: "当前用户无权限执行此操作",
				Timestamp: time.Now().Unix(),
			})
		}
	}
}

func GetUserID(ctx context.Context) int64 {
	if v, ok := ctx.Value(UserIDKey).(int64); ok {
		return v
	}
	return 0
}

func GetUsername(ctx context.Context) string {
	if v, ok := ctx.Value(UsernameKey).(string); ok {
		return v
	}
	return ""
}

func GetRole(ctx context.Context) string {
	if v, ok := ctx.Value(RoleKey).(string); ok {
		return v
	}
	return ""
}

func GetAreaID(ctx context.Context) int64 {
	if v, ok := ctx.Value(AreaIDKey).(int64); ok {
		return v
	}
	return 0
}

func GetRequestID(ctx context.Context) string {
	if v, ok := ctx.Value(RequestIDKey).(string); ok {
		return v
	}
	return ""
}
