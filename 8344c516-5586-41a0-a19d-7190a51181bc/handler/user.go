package handler

import (
	"net/http"

	"exam-system/model"

	"github.com/gin-gonic/gin"
)

type ChangePasswordRequest struct {
	OldPassword string `json:"oldPassword" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required"`
}

func GetProfile(c *gin.Context) {
	userID := GetUserID(c)
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	var user model.User
	if err := model.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		Error(c, http.StatusNotFound, "用户不存在")
		return
	}

	userInfo := map[string]interface{}{
		"id":            user.ID,
		"username":      user.Username,
		"realName":      user.RealName,
		"role":          user.Role,
		"phone":         user.Phone,
		"idCard":        user.IDCard,
		"email":         user.Email,
		"avatar":        user.Avatar,
		"institutionId": user.InstitutionID,
		"createdAt":     user.CreatedAt,
	}

	Success(c, userInfo)
}

func ChangePassword(c *gin.Context) {
	userID := GetUserID(c)
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var user model.User
	if err := model.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		Error(c, http.StatusNotFound, "用户不存在")
		return
	}

	if !CheckPassword(req.OldPassword, user.Password) {
		Error(c, http.StatusBadRequest, "旧密码错误")
		return
	}

	hashedPassword, err := HashPassword(req.NewPassword)
	if err != nil {
		Error(c, http.StatusInternalServerError, "密码加密失败")
		return
	}

	user.Password = hashedPassword
	if err := model.DB.Save(&user).Error; err != nil {
		Error(c, http.StatusInternalServerError, "修改密码失败")
		return
	}

	SuccessWithMsg(c, "密码修改成功", nil)
}

func GetUserList(c *gin.Context) {
	userRole := GetUserRole(c)
	if userRole != RoleAdmin {
		Error(c, http.StatusForbidden, "无权限访问")
		return
	}

	page, pageSize := GetPageParams(c)
	role := c.Query("role")

	query := model.DB.Model(&model.User{})
	if role != "" {
		query = query.Where("role = ?", role)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	var users []model.User
	if err := query.Offset((page - 1) * pageSize).Limit(pageSize).Find(&users).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	userList := make([]map[string]interface{}, 0, len(users))
	for _, user := range users {
		userList = append(userList, map[string]interface{}{
			"id":            user.ID,
			"username":      user.Username,
			"realName":      user.RealName,
			"role":          user.Role,
			"phone":         user.Phone,
			"idCard":        user.IDCard,
			"email":         user.Email,
			"status":        user.Status,
			"institutionId": user.InstitutionID,
			"createdAt":     user.CreatedAt,
		})
	}

	PageSuccess(c, userList, total, page, pageSize)
}
