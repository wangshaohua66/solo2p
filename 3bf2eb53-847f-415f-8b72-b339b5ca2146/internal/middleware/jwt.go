package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	"offshore-wind-ops/internal/model"
)

type JWTCustomClaims struct {
	UserID   string           `json:"user_id"`
	Username string           `json:"username"`
	Role     model.UserRole   `json:"role"`
	jwt.RegisteredClaims
}

type JWTConfig struct {
	Secret            string
	AccessTokenExpiry int
	RefreshTokenExpiry int
	Issuer            string
}

func GenerateAccessToken(user *model.User, cfg *JWTConfig) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(cfg.AccessTokenExpiry) * time.Hour)

	claims := JWTCustomClaims{
		UserID:   user.ID.Hex(),
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    cfg.Issuer,
			Subject:   user.ID.Hex(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(cfg.Secret))
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expiresAt, nil
}

func GenerateRefreshToken(user *model.User, cfg *JWTConfig) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(cfg.RefreshTokenExpiry) * 24 * time.Hour)

	claims := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(expiresAt),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    cfg.Issuer,
		Subject:   user.ID.Hex(),
		ID:        "refresh-" + user.ID.Hex(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(cfg.Secret))
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expiresAt, nil
}

func JWTAuth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization format")
			}

			tokenString := parts[1]

			token, err := jwt.ParseWithClaims(tokenString, &JWTCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("unexpected signing method")
				}
				return []byte(secret), nil
			})

			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}

			if claims, ok := token.Claims.(*JWTCustomClaims); ok && token.Valid {
				c.Set("user_id", claims.UserID)
				c.Set("username", claims.Username)
				c.Set("role", claims.Role)
			} else {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token claims")
			}

			return next(c)
		}
	}
}

func RequireRole(roles ...model.UserRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userRole, ok := c.Get("role").(model.UserRole)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid role")
			}

			for _, role := range roles {
				if userRole == role {
					return next(c)
				}
			}

			return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
		}
	}
}

func GetUserID(c echo.Context) string {
	id, _ := c.Get("user_id").(string)
	return id
}

func GetUserRole(c echo.Context) model.UserRole {
	role, _ := c.Get("role").(model.UserRole)
	return role
}

func GetUsername(c echo.Context) string {
	username, _ := c.Get("username").(string)
	return username
}

func ParseRefreshToken(tokenString, secret string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userID, ok := claims["sub"].(string)
		if !ok {
			return "", errors.New("invalid subject claim")
		}
		return userID, nil
	}

	return "", errors.New("invalid token")
}
