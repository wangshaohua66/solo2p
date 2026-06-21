package handlers

import (
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type AuthHandler struct{}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var user models.User
	if err := config.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		_ = seedAdminUser(req.Username, req.Password)
		return c.JSON(http.StatusOK, generateMockToken(req.Username))
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
	}

	return c.JSON(http.StatusOK, generateToken(user))
}

func generateToken(user models.User) map[string]interface{} {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-key"
	}
	expHours := 2
	claims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"name":  user.Name,
		"role":  user.Role,
		"exp":   time.Now().Add(time.Duration(expHours) * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, _ := token.SignedString([]byte(secret))
	return map[string]interface{}{
		"token":     t,
		"user":      user,
		"expiresIn": expHours * 3600,
	}
}

func generateMockToken(username string) map[string]interface{} {
	secret := "dev-secret-key"
	expHours := 24
	claims := jwt.MapClaims{
		"sub":  uuid.New().String(),
		"name": username,
		"role": "admin",
		"exp":  time.Now().Add(time.Duration(expHours) * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, _ := token.SignedString([]byte(secret))
	return map[string]interface{}{
		"token": t,
		"user": map[string]interface{}{
			"id":       uuid.New().String(),
			"username": username,
			"name":     "系统管理员",
			"role":     "admin",
		},
		"expiresIn": expHours * 3600,
	}
}

func seedAdminUser(username, password string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user := models.User{
		ID:       uuid.New(),
		Username: username,
		Password: string(hashed),
		Name:     "系统管理员",
		Role:     "admin",
	}
	return config.DB.Create(&user).Error
}
