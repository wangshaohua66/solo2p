package controller

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type DeviceController struct {
	deviceService *service.DeviceService
	deviceRepo    *repository.DeviceRepo
	alertEngine   *service.AlertEngine
}

func NewDeviceController(
	deviceService *service.DeviceService,
	deviceRepo *repository.DeviceRepo,
	alertEngine *service.AlertEngine) *DeviceController {
	return &DeviceController{
		deviceService: deviceService,
		deviceRepo:    deviceRepo,
		alertEngine:   alertEngine,
	}
}

func (c *DeviceController) getContext(e echo.Context) context.Context {
	return e.Request().Context()
}

func (c *DeviceController) respondSuccess(e echo.Context, data interface{}) error {
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      data,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

func (c *DeviceController) respondError(e echo.Context, code int, message string) error {
	return e.JSON(code, model.Response{
		Code:      code,
		Message:   message,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

type listDeviceQuery struct {
	AreaID     int64  `query:"area_id"`
	CabinetID  int64  `query:"cabinet_id"`
	DeviceType string `query:"device_type"`
	Status     string `query:"status"`
	IsOn       string `query:"is_on"`
	Keyword    string `query:"keyword"`
	Page       int    `query:"page"`
	PageSize   int    `query:"page_size"`
	Sort       string `query:"sort"`
}

func (c *DeviceController) ListDevices(e echo.Context) error {
	ctx := c.getContext(e)
	var q listDeviceQuery
	if err := e.Bind(&q); err != nil {
		return err
	}

	var isOn *bool
	if q.IsOn != "" {
		b := q.IsOn == "1" || q.IsOn == "true"
		isOn = &b
	}

	params := &repository.DeviceQueryParams{
		AreaID:     q.AreaID,
		CabinetID:  q.CabinetID,
		DeviceType: q.DeviceType,
		Status:     q.Status,
		IsOn:       isOn,
		Keyword:    q.Keyword,
		Page:       q.Page,
		PageSize:   q.PageSize,
		Sort:       q.Sort,
	}

	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	list, total, err := c.deviceRepo.List(ctx, params, areaIDs)
	if err != nil {
		pkg.Error(ctx, "list devices failed", zap.Error(err))
		return c.respondError(e, http.StatusInternalServerError, "查询设备列表失败")
	}

	page := q.Page
	if page <= 0 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	pageCount := int((total + int64(pageSize) - 1) / int64(pageSize))

	return c.respondSuccess(e, model.PageResult{
		List:      list,
		Total:     total,
		Page:      page,
		PageSize:  pageSize,
		PageCount: pageCount,
	})
}

func (c *DeviceController) GetDevice(e echo.Context) error {
	ctx := c.getContext(e)
	idStr := e.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, "设备ID格式错误")
	}
	device, err := c.deviceRepo.GetByID(ctx, id)
	if err != nil {
		return c.respondError(e, http.StatusNotFound, "设备不存在")
	}
	return c.respondSuccess(e, device)
}

func (c *DeviceController) CreateDevice(e echo.Context) error {
	ctx := c.getContext(e)
	var req service.RegisterDeviceRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	device, err := c.deviceService.RegisterDevice(ctx, &req)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, err.Error())
	}
	return c.respondSuccess(e, device)
}

func (c *DeviceController) UpdateDevice(e echo.Context) error {
	ctx := c.getContext(e)
	idStr := e.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, "设备ID格式错误")
	}
	device, err := c.deviceRepo.GetByID(ctx, id)
	if err != nil {
		return c.respondError(e, http.StatusNotFound, "设备不存在")
	}

	if err := e.Bind(device); err != nil {
		return err
	}
	device.UpdatedAt = time.Now()

	if err := c.deviceRepo.Update(ctx, device); err != nil {
		return c.respondError(e, http.StatusInternalServerError, "更新设备失败")
	}
	return c.respondSuccess(e, device)
}

func (c *DeviceController) DeleteDevice(e echo.Context) error {
	ctx := c.getContext(e)
	idStr := e.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, "设备ID格式错误")
	}
	if err := c.deviceRepo.Delete(ctx, id); err != nil {
		return c.respondError(e, http.StatusInternalServerError, "删除设备失败")
	}
	return c.respondSuccess(e, nil)
}

func (c *DeviceController) GetDeviceStatusHistory(e echo.Context) error {
	ctx := c.getContext(e)
	idStr := e.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, "设备ID格式错误")
	}

	page, _ := strconv.Atoi(e.QueryParam("page"))
	pageSize, _ := strconv.Atoi(e.QueryParam("page_size"))
	startStr := e.QueryParam("start_time")
	endStr := e.QueryParam("end_time")

	var startTime, endTime time.Time
	if startStr != "" {
		startTime, _ = time.Parse("2006-01-02 15:04:05", startStr)
	}
	if endStr != "" {
		endTime, _ = time.Parse("2006-01-02 15:04:05", endStr)
	}

	list, total, err := c.deviceRepo.GetStatusHistory(ctx, id, startTime, endTime, page, pageSize)
	if err != nil {
		return c.respondError(e, http.StatusInternalServerError, "查询历史数据失败")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	pageCount := int((total + int64(pageSize) - 1) / int64(pageSize))

	return c.respondSuccess(e, model.PageResult{
		List:      list,
		Total:     total,
		Page:      page,
		PageSize:  pageSize,
		PageCount: pageCount,
	})
}

func (c *DeviceController) ReportDeviceStatus(e echo.Context) error {
	ctx := c.getContext(e)
	var req service.ReportDeviceStatusRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	if err := c.deviceService.ReportStatus(ctx, &req); err != nil {
		return c.respondError(e, http.StatusBadRequest, err.Error())
	}
	return c.respondSuccess(e, nil)
}

func (c *DeviceController) BatchControl(e echo.Context) error {
	ctx := c.getContext(e)
	var req service.BatchControlRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	userID := middleware.GetUserID(ctx)
	cmd, err := c.deviceService.BatchControl(ctx, userID, &req)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, err.Error())
	}
	return c.respondSuccess(e, cmd)
}

func (c *DeviceController) GetCommandStatus(e echo.Context) error {
	ctx := c.getContext(e)
	idStr := e.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, "指令ID格式错误")
	}
	cmd, details, total, err := c.deviceService.GetCommandStatus(ctx, id)
	if err != nil {
		return c.respondError(e, http.StatusNotFound, "指令不存在")
	}
	return c.respondSuccess(e, map[string]interface{}{
		"command": cmd,
		"details": details,
		"total":   total,
	})
}

func (c *DeviceController) RetryCommand(e echo.Context) error {
	ctx := c.getContext(e)
	idStr := e.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.respondError(e, http.StatusBadRequest, "指令ID格式错误")
	}
	if err := c.deviceService.RetryFailedCommand(ctx, id); err != nil {
		return c.respondError(e, http.StatusBadRequest, err.Error())
	}
	return c.respondSuccess(e, nil)
}

type listCommandQuery struct {
	AreaID   int64  `query:"area_id"`
	Status   string `query:"status"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

func (c *DeviceController) ListCommands(e echo.Context, cmdRepo *repository.CommandRepo) error {
	ctx := c.getContext(e)
	var q listCommandQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	list, total, err := cmdRepo.ListCommands(ctx, q.AreaID, q.Status, q.Page, q.PageSize, areaIDs)
	if err != nil {
		return c.respondError(e, http.StatusInternalServerError, "查询指令列表失败")
	}
	page := q.Page
	if page <= 0 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	pageCount := int((total + int64(pageSize) - 1) / int64(pageSize))
	return c.respondSuccess(e, model.PageResult{
		List:      list,
		Total:     total,
		Page:      page,
		PageSize:  pageSize,
		PageCount: pageCount,
	})
}

type cabinetQuery struct {
	AreaID int64 `query:"area_id"`
}

func (c *DeviceController) ListCabinets(e echo.Context, cabRepo *repository.CabinetRepo) error {
	ctx := c.getContext(e)
	var q cabinetQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	var list []*model.Cabinet
	var err error
	if q.AreaID > 0 {
		list, err = cabRepo.ListByArea(ctx, q.AreaID)
	} else {
		list, err = cabRepo.ListAll(ctx)
	}
	if err != nil {
		return c.respondError(e, http.StatusInternalServerError, "查询配电柜列表失败")
	}
	return c.respondSuccess(e, list)
}

func (c *DeviceController) ListAreas(e echo.Context, areaRepo *repository.AreaRepo) error {
	ctx := c.getContext(e)
	list, err := areaRepo.ListAll(ctx)
	if err != nil {
		return c.respondError(e, http.StatusInternalServerError, "查询区域列表失败")
	}
	return c.respondSuccess(e, list)
}
