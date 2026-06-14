package handler

import (
	"net/http"

	"venue-scheduler/internal/middleware"
	"venue-scheduler/internal/pkg/response"
	"venue-scheduler/internal/repository"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db  *gorm.DB
	jwt *middleware.JWT
}

func NewAuthHandler(db *gorm.DB, jwt *middleware.JWT) *AuthHandler {
	return &AuthHandler{
		db:  db,
		jwt: jwt,
	}
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Login godoc
// @Summary 用户登录
// @Description 用户通过用户名和密码登录获取JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "登录参数"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var user repository.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid username or password"))
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid username or password"))
		return
	}

	token, err := h.jwt.GenerateToken(user.ID, user.Username, string(user.Role))
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to generate token"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"token": token,
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"real_name": user.RealName,
			"role":      user.Role,
			"email":     user.Email,
			"phone":     user.Phone,
		},
	}))
}

type RegisterRequest struct {
	Username string              `json:"username" binding:"required"`
	Password string              `json:"password" binding:"required,min=6"`
	RealName string              `json:"real_name"`
	Role     repository.UserRole `json:"role" binding:"required"`
	Email    string              `json:"email"`
	Phone    string              `json:"phone"`
}

// Register godoc
// @Summary 用户注册
// @Description 注册新用户（演示用，生产环境应关闭）
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "注册参数"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var existingUser repository.User
	if err := h.db.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "username already exists"))
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to hash password"))
		return
	}

	user := repository.User{
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		RealName:     req.RealName,
		Role:         req.Role,
		Email:        req.Email,
		Phone:        req.Phone,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create user"))
		return
	}

	c.JSON(http.StatusCreated, response.Success(gin.H{
		"id":        user.ID,
		"username":  user.Username,
		"real_name": user.RealName,
		"role":      user.Role,
		"email":     user.Email,
		"phone":     user.Phone,
	}))
}

// GetCurrentUser godoc
// @Summary 获取当前登录用户信息
// @Description 获取当前登录用户的详细信息
// @Tags auth
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/auth/me [get]
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	var user repository.User
	if err := h.db.First(&user, uid).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "user not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"id":        user.ID,
		"username":  user.Username,
		"real_name": user.RealName,
		"role":      user.Role,
		"email":     user.Email,
		"phone":     user.Phone,
	}))
}
