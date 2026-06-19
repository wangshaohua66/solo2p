package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/middleware"
	"port-ops-system/pkg/response"
)

type AuthHandler struct{}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Token    string `json:"token"`
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return response.Fail(c, response.CodeBadRequest, "invalid request body")
	}

	if req.Username == "" || req.Password == "" {
		return response.Fail(c, response.CodeBadRequest, "username and password are required")
	}

	var userID int64 = 1
	role := "ADMIN"
	if req.Username == "operator" {
		role = "OPERATOR"
		userID = 2
	} else if req.Username == "viewer" {
		role = "VIEWER"
		userID = 3
	}

	token, err := middleware.GenerateToken(userID, req.Username, role)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, "generate token failed")
	}

	return c.JSON(http.StatusOK, response.Response{
		Code:    response.CodeSuccess,
		Message: "success",
		Data: LoginResponse{
			Token:    token,
			UserID:   userID,
			Username: req.Username,
			Role:     role,
		},
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	return response.Success(c, map[string]interface{}{"logout": true})
}
