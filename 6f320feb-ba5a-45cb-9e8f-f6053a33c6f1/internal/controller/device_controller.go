package controller

import (
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/internal/util"
	"equipment-trading-platform/pkg/search"
	"strconv"

	"github.com/gin-gonic/gin"
)

type DeviceController struct {
	deviceService *service.DeviceService
}

func NewDeviceController() *DeviceController {
	return &DeviceController{
		deviceService: service.NewDeviceService(),
	}
}

func (ctrl *DeviceController) Create(c *gin.Context) {
	var req service.CreateDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	req.SellerID = util.GetUserID(c)

	device, err := ctrl.deviceService.Create(&req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, device)
}

func (ctrl *DeviceController) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	var req service.CreateDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	device, err := ctrl.deviceService.Update(id, &req)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, device)
}

func (ctrl *DeviceController) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	withDetail := c.Query("detail") == "true"

	device, err := ctrl.deviceService.GetByID(id, withDetail)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, device)
}

func (ctrl *DeviceController) List(c *gin.Context) {
	q := &repository.DeviceQuery{}

	if v := c.Query("category_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.CategoryID = &id
		}
	}
	q.Brand = c.Query("brand")
	q.Model = c.Query("model")
	q.Status = c.Query("status")
	q.Region = c.Query("region")
	q.Keyword = c.Query("keyword")

	if v := c.Query("seller_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.SellerID = &id
		}
	}
	if v := c.Query("min_price"); v != "" {
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			q.MinPrice = &p
		}
	}
	if v := c.Query("max_price"); v != "" {
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			q.MaxPrice = &p
		}
	}
	if v := c.Query("min_year"); v != "" {
		if y, err := strconv.Atoi(v); err == nil {
			q.MinYear = &y
		}
	}
	if v := c.Query("max_year"); v != "" {
		if y, err := strconv.Atoi(v); err == nil {
			q.MaxYear = &y
		}
	}

	q.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	q.PageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))

	devices, total, err := ctrl.deviceService.List(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.SuccessWithPage(c, devices, total, q.Page, q.PageSize)
}

func (ctrl *DeviceController) Search(c *gin.Context) {
	q := &search.SearchQuery{}
	q.Keyword = c.Query("keyword")
	q.Brand = c.Query("brand")
	q.Model = c.Query("model")
	q.Region = c.Query("region")
	q.Status = c.Query("status")

	if v := c.Query("category_id"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			q.CategoryID = &id
		}
	}
	if v := c.Query("min_price"); v != "" {
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			q.MinPrice = &p
		}
	}
	if v := c.Query("max_price"); v != "" {
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			q.MaxPrice = &p
		}
	}
	if v := c.Query("min_year"); v != "" {
		if y, err := strconv.Atoi(v); err == nil {
			q.MinYear = &y
		}
	}
	if v := c.Query("max_year"); v != "" {
		if y, err := strconv.Atoi(v); err == nil {
			q.MaxYear = &y
		}
	}

	q.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	q.PageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))

	result, err := ctrl.deviceService.Search(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, result)
}

func (ctrl *DeviceController) Approve(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	approverID := util.GetUserID(c)

	if err := ctrl.deviceService.Approve(id, approverID); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DeviceController) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	if err := ctrl.deviceService.UpdateStatus(id, req.Status); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DeviceController) OffShelf(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	sellerID := util.GetUserID(c)

	if err := ctrl.deviceService.OffShelf(id, sellerID); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DeviceController) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	sellerID := util.GetUserID(c)

	if err := ctrl.deviceService.Delete(id, sellerID); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DeviceController) AddMaintenanceRecord(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	var record model.MaintenanceRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	record.DeviceID = deviceID

	if err := ctrl.deviceService.AddMaintenanceRecord(&record); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, record)
}

func (ctrl *DeviceController) ListMaintenanceRecords(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	records, err := ctrl.deviceService.ListMaintenanceRecords(deviceID)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, records)
}

func (ctrl *DeviceController) ListOwnershipChanges(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	changes, err := ctrl.deviceService.ListOwnershipChanges(deviceID)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, changes)
}

func (ctrl *DeviceController) AddMedia(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的设备ID")
		return
	}

	var media model.DeviceMedia
	if err := c.ShouldBindJSON(&media); err != nil {
		util.FailWithMsg(c, 400, "参数错误: "+err.Error())
		return
	}

	media.DeviceID = deviceID

	if err := ctrl.deviceService.AddMedia(&media); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, media)
}

func (ctrl *DeviceController) DeleteMedia(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("media_id"), 10, 64)
	if err != nil {
		util.FailWithMsg(c, 400, "无效的媒体ID")
		return
	}

	sellerID := util.GetUserID(c)

	if err := ctrl.deviceService.DeleteMedia(id, sellerID); err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, nil)
}

func (ctrl *DeviceController) ListCategories(c *gin.Context) {
	categories, err := ctrl.deviceService.ListCategories()
	if err != nil {
		util.Fail(c, err)
		return
	}
	util.Success(c, categories)
}
