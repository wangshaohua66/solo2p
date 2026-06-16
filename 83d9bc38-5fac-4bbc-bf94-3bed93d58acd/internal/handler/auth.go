package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
)

type AuthHandler struct {
	userRepo repository.UserRepository
	jwtSecret string
}

func NewAuthHandler(userRepo repository.UserRepository, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		userRepo: userRepo,
		jwtSecret: jwtSecret,
	}
}

// Login 登录
// @Summary 登录
// @Description 用户登录获取token
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body model.LoginRequest true "登录信息"
// @Success 200 {object} model.LoginResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/auth/login [post]
func (h *AuthHandler) Login(c echo.Context) error {
	var req model.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的请求参数"})
	}

	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "用户名和密码不能为空"})
	}

	user, err := h.userRepo.GetByUsername(c.Request().Context(), req.Username)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}

	permissions, err := h.getPermissions(user.Role)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取权限失败"})
	}

	token, err := h.generateToken(user, permissions)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "生成Token失败"})
	}

	return c.JSON(http.StatusOK, model.LoginResponse{
		Token:       token,
		User:        *user,
		Permissions: permissions,
	})
}

// RefreshToken 刷新Token
// @Summary 刷新Token
// @Description 刷新访问令牌
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body model.RefreshTokenRequest true "刷新Token请求"
// @Success 200 {object} model.RefreshTokenResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/auth/refresh [post]
func (h *AuthHandler) RefreshToken(c echo.Context) error {
	var req model.RefreshTokenRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的请求参数"})
	}

	if req.Token == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Token不能为空"})
	}

	claims := &middleware.JWTClaims{}
	token, err := jwt.ParseWithClaims(req.Token, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(h.jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "无效的Token"})
	}

	userWithDetails, err := h.userRepo.GetByIDWithDetails(c.Request().Context(), claims.UserID)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户不存在"})
	}

	permissions, err := h.getPermissions(userWithDetails.Role)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取权限失败"})
	}

	newToken, err := h.generateToken(userWithDetails, permissions)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "生成Token失败"})
	}

	return c.JSON(http.StatusOK, model.RefreshTokenResponse{
		Token: newToken,
	})
}

// Logout 登出
// @Summary 登出
// @Description 用户登出（前端清除Token即可）
// @Tags 认证
// @Accept json
// @Produce json
// @Success 200 {object} model.LogoutResponse
// @Router /api/auth/logout [post]
func (h *AuthHandler) Logout(c echo.Context) error {
	return c.JSON(http.StatusOK, model.LogoutResponse{
		Message: "登出成功",
	})
}

// GetCurrentUser 获取当前登录用户信息
// @Summary 获取当前登录用户信息
// @Description 获取当前登录用户的详细信息
// @Tags 认证
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} model.User
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/auth/me [get]
func (h *AuthHandler) GetCurrentUser(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "未登录"})
	}

	userDetails, err := h.userRepo.GetByIDWithDetails(c.Request().Context(), user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取用户信息失败"})
	}

	return c.JSON(http.StatusOK, userDetails)
}

func (h *AuthHandler) generateToken(user *model.User, permissions []string) (string, error) {
	roleName := ""
	if user.Role != nil {
		roleName = user.Role.Name
	}

	claims := middleware.JWTClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Name:        user.Name,
		Role:        middleware.Role(roleName),
		RoleID:      user.RoleID,
		CenterID:    user.CenterID,
		Permissions: permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "equipment-booking",
			Subject:   user.Username,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

func (h *AuthHandler) getPermissions(role *model.Role) ([]string, error) {
	if role == nil || len(role.Permissions) == 0 {
		return []string{}, nil
	}

	var permissions []string
	if err := json.Unmarshal([]byte(role.Permissions), &permissions); err != nil {
		var permMap map[string]interface{}
		if err2 := json.Unmarshal([]byte(role.Permissions), &permMap); err2 != nil {
			return nil, errors.New("权限格式错误")
		}
		permissions = h.extractPermissions(permMap)
	}

	return permissions, nil
}

func (h *AuthHandler) extractPermissions(permMap map[string]interface{}) []string {
	var permissions []string
	for key, value := range permMap {
		if v, ok := value.(bool); ok && v {
			permissions = append(permissions, key)
		} else if v, ok := value.(map[string]interface{}); ok {
			subPerms := h.extractPermissions(v)
			for _, sp := range subPerms {
				permissions = append(permissions, key+":"+sp)
			}
		} else if v, ok := value.(datatypes.JSON); ok {
			var subMap map[string]interface{}
			if err := json.Unmarshal([]byte(v), &subMap); err == nil {
				subPerms := h.extractPermissions(subMap)
				for _, sp := range subPerms {
					permissions = append(permissions, key+":"+sp)
				}
			}
		}
	}
	return permissions
}
