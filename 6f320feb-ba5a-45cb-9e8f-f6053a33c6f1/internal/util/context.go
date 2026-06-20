package util

import (
	"github.com/gin-gonic/gin"
)

type ContextKey string

const (
	UserIDKey   ContextKey = "user_id"
	UsernameKey ContextKey = "username"
	RolesKey    ContextKey = "roles"
)

func SetUserContext(c *gin.Context, userID uint64, username string, roles []string) {
	c.Set(string(UserIDKey), userID)
	c.Set(string(UsernameKey), username)
	c.Set(string(RolesKey), roles)
}

func GetUserID(c *gin.Context) uint64 {
	if v, exists := c.Get(string(UserIDKey)); exists {
		if id, ok := v.(uint64); ok {
			return id
		}
	}
	return 0
}

func GetUsername(c *gin.Context) string {
	if v, exists := c.Get(string(UsernameKey)); exists {
		if username, ok := v.(string); ok {
			return username
		}
	}
	return ""
}

func GetRoles(c *gin.Context) []string {
	if v, exists := c.Get(string(RolesKey)); exists {
		if roles, ok := v.([]string); ok {
			return roles
		}
	}
	return []string{}
}

func HasRole(c *gin.Context, role string) bool {
	roles := GetRoles(c)
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

func HasAnyRole(c *gin.Context, roles ...string) bool {
	userRoles := GetRoles(c)
	for _, r := range userRoles {
		for _, target := range roles {
			if r == target {
				return true
			}
		}
	}
	return false
}
