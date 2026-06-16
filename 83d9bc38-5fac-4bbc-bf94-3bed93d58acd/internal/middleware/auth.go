package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type Role string

const (
	RoleSuperAdmin  Role = "super_admin"
	RoleCenterAdmin Role = "center_admin"
	RoleOperator    Role = "operator"
	RoleTeacher     Role = "teacher"
	RoleStudent     Role = "student"
)

type UserInfo struct {
	UserID      uint64   `json:"user_id"`
	Username    string   `json:"username"`
	Name        string   `json:"name"`
	Role        Role     `json:"role"`
	RoleID      uint64   `json:"role_id"`
	CenterID    uint64   `json:"center_id"`
	Permissions []string `json:"permissions"`
}

type JWTClaims struct {
	UserID      uint64   `json:"user_id"`
	Username    string   `json:"username"`
	Name        string   `json:"name"`
	Role        Role     `json:"role"`
	RoleID      uint64   `json:"role_id"`
	CenterID    uint64   `json:"center_id"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

type contextKey string

const userContextKey contextKey = "user"

var (
	ErrMissingAuthHeader = echo.NewHTTPError(http.StatusUnauthorized, "缺少认证头")
	ErrInvalidAuthFormat = echo.NewHTTPError(http.StatusUnauthorized, "认证格式错误")
	ErrInvalidToken      = echo.NewHTTPError(http.StatusUnauthorized, "无效的Token")
	ErrExpiredToken      = echo.NewHTTPError(http.StatusUnauthorized, "Token已过期")
	ErrPermissionDenied  = echo.NewHTTPError(http.StatusForbidden, "权限不足")
	ErrUserNotFound      = echo.NewHTTPError(http.StatusUnauthorized, "用户信息不存在")
)

func JWTAuth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return ErrMissingAuthHeader
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return ErrInvalidAuthFormat
			}

			tokenStr := parts[1]
			claims := &JWTClaims{}

			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})

			if err != nil {
				if strings.Contains(err.Error(), "expired") {
					return ErrExpiredToken
				}
				return ErrInvalidToken
			}

			if !token.Valid {
				return ErrInvalidToken
			}

			user := &UserInfo{
				UserID:      claims.UserID,
				Username:    claims.Username,
				Name:        claims.Name,
				Role:        claims.Role,
				RoleID:      claims.RoleID,
				CenterID:    claims.CenterID,
				Permissions: claims.Permissions,
			}

			ctx := context.WithValue(c.Request().Context(), userContextKey, user)
			c.SetRequest(c.Request().WithContext(ctx))

			return next(c)
		}
	}
}

func RBAC(requiredPermission string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := GetUser(c.Request().Context())
			if !ok {
				return ErrUserNotFound
			}

			if hasPermission(user.Permissions, requiredPermission) {
				return next(c)
			}

			return ErrPermissionDenied
		}
	}
}

func RBACAny(requiredPermissions ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := GetUser(c.Request().Context())
			if !ok {
				return ErrUserNotFound
			}

			for _, perm := range requiredPermissions {
				if hasPermission(user.Permissions, perm) {
					return next(c)
				}
			}

			return ErrPermissionDenied
		}
	}
}

func RBACAll(requiredPermissions ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := GetUser(c.Request().Context())
			if !ok {
				return ErrUserNotFound
			}

			for _, perm := range requiredPermissions {
				if !hasPermission(user.Permissions, perm) {
					return ErrPermissionDenied
				}
			}

			return next(c)
		}
	}
}

func hasPermission(userPermissions []string, requiredPermission string) bool {
	for _, perm := range userPermissions {
		if perm == "*" || perm == requiredPermission {
			return true
		}

		if strings.HasSuffix(perm, ":*") {
			prefix := strings.TrimSuffix(perm, ":*")
			if strings.HasPrefix(requiredPermission, prefix+":") {
				return true
			}
		}
	}
	return false
}

func GetUser(ctx context.Context) (*UserInfo, bool) {
	user, ok := ctx.Value(userContextKey).(*UserInfo)
	return user, ok
}

func MustGetUser(ctx context.Context) *UserInfo {
	user, ok := GetUser(ctx)
	if !ok {
		panic("user not found in context")
	}
	return user
}

func HasRole(ctx context.Context, roles ...Role) bool {
	user, ok := GetUser(ctx)
	if !ok {
		return false
	}
	for _, role := range roles {
		if user.Role == role {
			return true
		}
	}
	return false
}
