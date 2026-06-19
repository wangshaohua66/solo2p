package middleware

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"port-ops-system/pkg/response"
)

type JWTClaims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func ErrorHandler() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)
			if err != nil {
				log.Printf("[ERROR] %v", err)
				if he, ok := err.(*echo.HTTPError); ok {
					return response.Fail(c, he.Code, he.Message.(string))
				}
				return response.Fail(c, response.CodeInternalError, err.Error())
			}
			return nil
		}
	}
}

func RequestLogger() echo.MiddlewareFunc {
	return echomiddleware.RequestLoggerWithConfig(echomiddleware.RequestLoggerConfig{
		LogURI:       true,
		LogStatus:    true,
		LogLatency:   true,
		LogMethod:    true,
		LogRemoteIP:  true,
		LogUserAgent: true,
		LogValuesFunc: func(c echo.Context, v echomiddleware.RequestLoggerValues) error {
			log.Printf("[REQUEST] %s %s status=%d latency=%v ip=%s ua=%s",
				v.Method, v.URI, v.Status, v.Latency, v.RemoteIP, v.UserAgent)
			return nil
		},
	})
}

func CORSMiddleware() echo.MiddlewareFunc {
	return echomiddleware.CORSWithConfig(echomiddleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.PATCH, echo.OPTIONS},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	})
}

func AuthMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return response.Fail(c, response.CodeUnauthorized, "missing authorization header")
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return response.Fail(c, response.CodeUnauthorized, "invalid authorization format")
			}

			secret := os.Getenv("JWT_SECRET")
			if secret == "" {
				secret = "port-ops-super-secret-key-2024"
			}

			token, err := jwt.ParseWithClaims(parts[1], &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				return response.Fail(c, response.CodeUnauthorized, "invalid or expired token")
			}

			claims, ok := token.Claims.(*JWTClaims)
			if !ok {
				return response.Fail(c, response.CodeUnauthorized, "invalid token claims")
			}

			c.Set("user_id", claims.UserID)
			c.Set("username", claims.Username)
			c.Set("role", claims.Role)

			return next(c)
		}
	}
}

func RoleMiddleware(roles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userRole, ok := c.Get("role").(string)
			if !ok {
				return response.Fail(c, response.CodeForbidden, "role not found")
			}

			for _, role := range roles {
				if userRole == role {
					return next(c)
				}
			}

			return response.Fail(c, response.CodeForbidden, "insufficient permissions")
		}
	}
}

func GenerateToken(userID int64, username, role string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "port-ops-super-secret-key-2024"
	}
	expireHours := 24

	claims := JWTClaims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "port-ops-system",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
