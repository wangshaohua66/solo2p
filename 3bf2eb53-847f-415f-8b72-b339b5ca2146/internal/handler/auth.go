package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/service/auth"
)

type AuthHandler struct {
	authService *auth.Service
}

func NewAuthHandler(authService *auth.Service) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

func (h *AuthHandler) RegisterRoutes(e *echo.Group) {
	auth := e.Group("/auth")
	auth.POST("/login", h.Login)
	auth.POST("/refresh", h.RefreshToken)
	auth.POST("/logout", h.Logout, middleware.JWTAuth(""))

	users := e.Group("/users", middleware.JWTAuth(""))
	users.GET("", h.ListUsers)
	users.GET("/me", h.GetCurrentUser)
	users.POST("", h.CreateUser, middleware.RequireRole(model.RoleAdmin))
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req model.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	resp, err := h.authService.Login(c.Request().Context(), &req)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, model.Error(401, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(resp))
}

func (h *AuthHandler) RefreshToken(c echo.Context) error {
	var req model.RefreshTokenRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	resp, err := h.authService.RefreshToken(c.Request().Context(), req.RefreshToken)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, model.Error(401, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(resp))
}

func (h *AuthHandler) Logout(c echo.Context) error {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.authService.Logout(c.Request().Context(), req.RefreshToken); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, "logout failed"))
	}

	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *AuthHandler) GetCurrentUser(c echo.Context) error {
	userID := middleware.GetUserID(c)
	user, err := h.authService.GetUser(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "user not found"))
	}
	return c.JSON(http.StatusOK, model.Success(user))
}

func (h *AuthHandler) ListUsers(c echo.Context) error {
	page := QueryInt(c, "page", 1)
	pageSize := QueryInt(c, "page_size", 20)

	users, total, err := h.authService.ListUsers(c.Request().Context(), page, pageSize)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(model.PageResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     users,
	}))
}

func (h *AuthHandler) CreateUser(c echo.Context) error {
	var req struct {
		Username string          `json:"username" validate:"required"`
		Password string          `json:"password" validate:"required"`
		RealName string          `json:"real_name" validate:"required"`
		Email    string          `json:"email" validate:"required,email"`
		Phone    string          `json:"phone"`
		Role     model.UserRole  `json:"role" validate:"required"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	user := &model.User{
		Username: req.Username,
		RealName: req.RealName,
		Email:    req.Email,
		Phone:    req.Phone,
		Role:     req.Role,
	}

	result, err := h.authService.CreateUser(c.Request().Context(), user, req.Password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusCreated, model.Success(result))
}

func QueryInt(c echo.Context, name string, defaultValue int) int {
	val := c.QueryParam(name)
	if val == "" {
		return defaultValue
	}
	result := 0
	for _, ch := range val {
		if ch >= '0' && ch <= '9' {
			result = result*10 + int(ch-'0')
		}
	}
	if result <= 0 {
		return defaultValue
	}
	return result
}
