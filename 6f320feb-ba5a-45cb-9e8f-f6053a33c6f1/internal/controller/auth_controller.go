package controller

import (
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/internal/util"

	"github.com/gin-gonic/gin"
)

type AuthController struct {
	userService *service.UserService
}

func NewAuthController() *AuthController {
	return &AuthController{
		userService: service.NewUserService(),
	}
}

func (ctrl *AuthController) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	user, err := ctrl.userService.Register(&req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, user)
}

func (ctrl *AuthController) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	resp, err := ctrl.userService.Login(&req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, resp)
}

func (ctrl *AuthController) GetCurrentUser(c *gin.Context) {
	userID := util.GetUserID(c)
	user, err := ctrl.userService.GetByID(userID)
	if err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, user)
}

func (ctrl *AuthController) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	userID := util.GetUserID(c)
	if err := ctrl.userService.ChangePassword(userID, req.OldPassword, req.NewPassword); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *AuthController) ListRoles(c *gin.Context) {
	roles, err := ctrl.userService.ListRoles()
	if err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, roles)
}
