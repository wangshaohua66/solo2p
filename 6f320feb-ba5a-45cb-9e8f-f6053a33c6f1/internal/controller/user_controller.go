package controller

import (
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/internal/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type UserController struct {
	userService   *service.UserService
	creditService *service.CreditService
}

func NewUserController() *UserController {
	return &UserController{
		userService:   service.NewUserService(),
		creditService: service.NewCreditService(),
	}
}

func (ctrl *UserController) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	users, total, err := ctrl.userService.List(page, pageSize)
	if err != nil {
		util.Fail(c, err)
		return
	}
	util.SuccessWithPage(c, users, total, page, pageSize)
}

func (ctrl *UserController) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的用户ID")
		return
	}

	user, err := ctrl.userService.GetByID(id)
	if err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, user)
}

func (ctrl *UserController) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的用户ID")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	if err := ctrl.userService.Update(id, updates); err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, nil)
}

func (ctrl *UserController) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的用户ID")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	if err := ctrl.userService.UpdateStatus(id, req.Status); err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, nil)
}

func (ctrl *UserController) GetCreditRating(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的用户ID")
		return
	}

	rating, err := ctrl.creditService.GetOrCreateRating(id)
	if err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, rating)
}

func (ctrl *UserController) ListCreditRecords(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的用户ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	records, total, err := ctrl.creditService.ListRecords(id, page, pageSize)
	if err != nil {
		util.Fail(c, err)
		return
	}
	util.SuccessWithPage(c, records, total, page, pageSize)
}

func (ctrl *UserController) Review(c *gin.Context) {
	var req service.ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.UserID = util.GetUserID(c)

	if err := ctrl.creditService.Review(&req); err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, nil)
}
