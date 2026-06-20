package controller

import (
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/internal/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ValuationController struct {
	valuationService *service.ValuationService
}

func NewValuationController() *ValuationController {
	return &ValuationController{
		valuationService: service.NewValuationService(),
	}
}

func (ctrl *ValuationController) Evaluate(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("device_id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	assessorID := util.GetUserID(c)

	report, err := ctrl.valuationService.Evaluate(deviceID, assessorID)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, report)
}

func (ctrl *ValuationController) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的报告ID")
		return
	}

	report, err := ctrl.valuationService.GetByID(id)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, report)
}

func (ctrl *ValuationController) GetByDevice(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("device_id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	report, err := ctrl.valuationService.GetByDevice(deviceID)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, report)
}

func (ctrl *ValuationController) List(c *gin.Context) {
	var deviceID, assessorID *uint64

	if v := c.Query("device_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			deviceID = &id
		}
	}
	if v := c.Query("assessor_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			assessorID = &id
		}
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	reports, total, err := ctrl.valuationService.List(deviceID, assessorID, page, pageSize)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.SuccessWithPage(c, reports, total, page, pageSize)
}

func (ctrl *ValuationController) Invalidate(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("device_id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	if err := ctrl.valuationService.Invalidate(deviceID); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}
