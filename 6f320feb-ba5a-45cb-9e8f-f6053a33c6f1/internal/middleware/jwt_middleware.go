package middleware

import (
	"equipment-trading-platform/internal/util"
	"strings"

	"github.com/gin-gonic/gin"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			util.Fail(c, util.ErrUnauthorized)
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			util.FailWithMsg(c, 401, "Token格式错误")
			c.Abort()
			return
		}

		claims, err := util.ParseToken(parts[1])
		if err != nil {
			util.Fail(c, util.ErrUnauthorized)
			c.Abort()
			return
		}

		util.SetUserContext(c, claims.UserID, claims.Username, claims.Roles)
		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !util.HasAnyRole(c, roles...) {
			util.Fail(c, util.ErrForbidden)
			c.Abort()
			return
		}
		c.Next()
	}
}
