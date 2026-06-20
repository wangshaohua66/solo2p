package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"exhibition-center/config"
	"exhibition-center/internal/models"
)

type JWTCustomClaims struct {
	UserID      string            `json:"userId"`
	Username    string            `json:"username"`
	Name        string            `json:"name"`
	Role        models.UserRole   `json:"role"`
	Permissions map[string]bool   `json:"permissions"`
	jwt.RegisteredClaims
}

func JWTAuthentication(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "未提供认证令牌")
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			return echo.NewHTTPError(http.StatusUnauthorized, "认证令牌格式错误")
		}

		token, err := jwt.ParseWithClaims(tokenParts[1], &JWTCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("签名方法不匹配")
			}
			return []byte(config.AppConfig.JWTSecret), nil
		})

		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "无效的认证令牌")
		}

		if claims, ok := token.Claims.(*JWTCustomClaims); ok && token.Valid {
			c.Set("user", claims)
			return next(c)
		}

		return echo.NewHTTPError(http.StatusUnauthorized, "认证令牌已过期或无效")
	}
}

func GenerateToken(user *models.User) (string, error) {
	expirationTime := time.Now().Add(time.Duration(config.AppConfig.JWTExpireHours) * time.Hour)

	claims := &JWTCustomClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Name:        user.Name,
		Role:        user.Role,
		Permissions: user.Permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "exhibition-center",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func RequireRole(roles ...models.UserRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get("user").(*JWTCustomClaims)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "用户未认证")
			}

			for _, role := range roles {
				if user.Role == role {
					return next(c)
				}
			}

			return echo.NewHTTPError(http.StatusForbidden, "权限不足")
		}
	}
}

func RequirePermission(permission string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get("user").(*JWTCustomClaims)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "用户未认证")
			}

			if user.Role == "admin" {
				return next(c)
			}

			if user.Permissions[permission] {
				return next(c)
			}

			return echo.NewHTTPError(http.StatusForbidden, "权限不足")
		}
	}
}

func GetCurrentUser(c echo.Context) *JWTCustomClaims {
	user, _ := c.Get("user").(*JWTCustomClaims)
	return user
}
