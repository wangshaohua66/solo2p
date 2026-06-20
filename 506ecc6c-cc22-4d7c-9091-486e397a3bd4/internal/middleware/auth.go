package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/labelops/backend/internal/config"
	"github.com/labelops/backend/internal/model"
)

type Claims struct {
	UserID    string          `json:"user_id"`
	Username  string          `json:"username"`
	Role      model.UserRole  `json:"role"`
	ArtistID  *string         `json:"artist_id,omitempty"`
	jwt.RegisteredClaims
}

type ContextKey string

const (
	ContextUserKey ContextKey = "user"
)

func JWTAuth(cfg *config.JWTConfig) echo.MiddlewareFunc {
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

			token, err := jwt.ParseWithClaims(parts[1], &Claims{}, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, echo.NewHTTPError(http.StatusUnauthorized, "invalid signing method")
				}
				return []byte(cfg.Secret), nil
			})

			if err != nil || !token.Valid {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}

			claims, ok := token.Claims.(*Claims)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token claims")
			}

			c.Set(string(ContextUserKey), claims)
			return next(c)
		}
	}
}

func RequireRoles(roles ...model.UserRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := GetUserFromContext(c)
			if claims == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated")
			}

			for _, role := range roles {
				if claims.Role == role {
					return next(c)
				}
			}

			return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
		}
	}
}

func GenerateToken(cfg *config.JWTConfig, user *model.User) (string, error) {
	exp := time.Now().Add(time.Duration(cfg.ExpireHours) * time.Hour)
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		ArtistID: user.ArtistID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    cfg.Issuer,
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.Secret))
}

func GetUserFromContext(c echo.Context) *Claims {
	v := c.Get(string(ContextUserKey))
	if claims, ok := v.(*Claims); ok {
		return claims
	}
	return nil
}

func ValidateArtistAccess(c echo.Context, artistID string) error {
	claims := GetUserFromContext(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated")
	}

	if claims.Role == model.RoleAdmin || claims.Role == model.RoleFinance || claims.Role == model.RoleCopyright {
		return nil
	}

	if claims.Role == model.RoleArtist && claims.ArtistID != nil && *claims.ArtistID == artistID {
		return nil
	}

	if claims.Role == model.RoleUserProducer {
		return nil
	}

	return echo.NewHTTPError(http.StatusForbidden, "cannot access this artist's data")
}

func CORS(origins string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("Access-Control-Allow-Origin", origins)
			c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Response().Header().Set("Access-Control-Allow-Credentials", "true")

			if c.Request().Method == http.MethodOptions {
				return c.NoContent(http.StatusNoContent)
			}

			return next(c)
		}
	}
}

var ErrNotFound = errors.New("not found")
var ErrInvalidParam = errors.New("invalid parameter")
