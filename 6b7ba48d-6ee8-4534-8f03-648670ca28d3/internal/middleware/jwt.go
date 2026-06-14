package middleware

import (
	"craftbrew-tracker/internal/config"
	"craftbrew-tracker/internal/model"
	"craftbrew-tracker/internal/util"
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
)

type JWTClaims struct {
	UserID   int64      `json:"uid"`
	Username string     `json:"username"`
	Role     model.Role `json:"role"`
	RealName string     `json:"realName"`
	jwt.RegisteredClaims
}

type AuthContext struct {
	echo.Context
	UserID   int64
	Username string
	Role     model.Role
	RealName string
}

func GenerateToken(cfg *config.JWTConfig, user *model.User) (string, time.Time, error) {
	exp := time.Now().Add(time.Duration(cfg.ExpireHours) * time.Hour)
	claims := JWTClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RealName: user.RealName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    cfg.Issuer,
			Subject:   user.Username,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(cfg.Secret))
	return signed, exp, err
}

func JWTAuth(cfg *config.JWTConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return util.FailUnauthorized(c, "missing authorization header")
			}
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				return util.FailUnauthorized(c, "invalid authorization header format")
			}
			tokenStr := parts[1]

			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("unexpected signing method")
				}
				return []byte(cfg.Secret), nil
			})
			if err != nil {
				log.Warn().Err(err).Str("token", tokenStr[:min(8, len(tokenStr))]).Msg("jwt parse failed")
				return util.FailUnauthorized(c, "invalid or expired token")
			}
			if !token.Valid {
				return util.FailUnauthorized(c, "invalid token")
			}

			ac := &AuthContext{
				Context:  c,
				UserID:   claims.UserID,
				Username: claims.Username,
				Role:     claims.Role,
				RealName: claims.RealName,
			}
			c.Set("authUser", ac)
			return next(ac)
		}
	}
}

func RequireRoles(allowedRoles ...model.Role) echo.MiddlewareFunc {
	roleSet := make(map[model.Role]bool, len(allowedRoles))
	for _, r := range allowedRoles {
		roleSet[r] = true
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get("authUser").(*AuthContext)
			if !ok {
				return util.FailUnauthorized(c, "unauthenticated")
			}
			if roleSet[model.RoleAdmin] {
				return next(c)
			}
			if !roleSet[user.Role] {
				return util.FailForbidden(c, "insufficient permission: role "+string(user.Role))
			}
			return next(c)
		}
	}
}

func GetAuth(c echo.Context) *AuthContext {
	if v := c.Get("authUser"); v != nil {
		if u, ok := v.(*AuthContext); ok {
			return u
		}
	}
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
