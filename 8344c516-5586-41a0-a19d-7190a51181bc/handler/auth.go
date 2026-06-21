package handler

import (
	"net/http"

	"exam-system/middleware"
	"exam-system/model"

	"github.com/gin-gonic/gin"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  interface{} `json:"user"`
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Phone    string `json:"phone" binding:"required"`
	IDCard   string `json:"idCard" binding:"required"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var user model.User
	if err := model.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	if !CheckPassword(req.Password, user.Password) {
		Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	if user.Status != 1 {
		Error(c, http.StatusForbidden, "账号已被禁用")
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Username, user.Role, user.RealName)
	if err != nil {
		Error(c, http.StatusInternalServerError, "生成token失败")
		return
	}

	userInfo := map[string]interface{}{
		"id":       user.ID,
		"username": user.Username,
		"realName": user.RealName,
		"role":     user.Role,
		"phone":    user.Phone,
		"idCard":   user.IDCard,
		"email":    user.Email,
	}

	Success(c, LoginResponse{
		Token: token,
		User:  userInfo,
	})
}

func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var count int64
	model.DB.Model(&model.User{}).Where("username = ?", req.Username).Count(&count)
	if count > 0 {
		Error(c, http.StatusBadRequest, "用户名已存在")
		return
	}

	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		Error(c, http.StatusInternalServerError, "密码加密失败")
		return
	}

	user := model.User{
		Username: req.Username,
		Password: hashedPassword,
		RealName: req.Name,
		Phone:    req.Phone,
		IDCard:   req.IDCard,
		Role:     RoleExaminee,
		Status:   1,
	}

	if err := model.DB.Create(&user).Error; err != nil {
		Error(c, http.StatusInternalServerError, "注册失败")
		return
	}

	SuccessWithMsg(c, "注册成功", nil)
}
