package controller

import (
	"context"
	"net/http"
	"time"

	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type InspectionController struct {
	inspectionRepo *repository.InspectionRepo
	scheduleSvc    *service.ScheduleService
	deviceService  *service.DeviceService
}

func NewInspectionController(
	inspectionRepo *repository.InspectionRepo,
	scheduleSvc *service.ScheduleService,
	deviceService *service.DeviceService) *InspectionController {
	return &InspectionController{
		inspectionRepo: inspectionRepo,
		scheduleSvc:    scheduleSvc,
		deviceService:  deviceService,
	}
}

type listPlanQuery struct {
	AreaID     int64  `query:"area_id"`
	AssigneeID int64  `query:"assignee_id"`
	Status     string `query:"status"`
	Keyword    string `query:"keyword"`
	StartDate  string `query:"start_date"`
	EndDate    string `query:"end_date"`
	Page       int    `query:"page"`
	PageSize   int    `query:"page_size"`
}

func (c *InspectionController) ListPlans(e echo.Context) error {
	ctx := e.Request().Context()
	var q listPlanQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	var startDate, endDate time.Time
	if q.StartDate != "" {
		startDate, _ = time.Parse("2006-01-02", q.StartDate)
	}
	if q.EndDate != "" {
		endDate, _ = time.Parse("2006-01-02 15:04:05", q.EndDate+" 23:59:59")
	}
	params := &repository.InspectionQueryParams{
		AreaID:     q.AreaID,
		AssigneeID: q.AssigneeID,
		Status:     q.Status,
		Keyword:    q.Keyword,
		StartDate:  startDate,
		EndDate:    endDate,
		Page:       q.Page,
		PageSize:   q.PageSize,
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	_ = areaIDs
	list, total, err := c.inspectionRepo.ListPlans(ctx, params, areaIDs)
	if err != nil {
		pkg.Error(ctx, "list inspection plans failed", zap.Error(err))
		return c.respErr(e, http.StatusInternalServerError, "查询巡检计划失败")
	}
	return c.respOk(e, pageResult(list, total, q.Page, q.PageSize))
}

func (c *InspectionController) GetPlan(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "计划ID格式错误")
	}
	plan, err := c.inspectionRepo.GetPlanByID(ctx, id)
	if err != nil {
		return c.respErr(e, http.StatusNotFound, "巡检计划不存在")
	}
	records, _ := c.inspectionRepo.GetRecordsByPlan(ctx, id)
	return c.respOk(e, map[string]interface{}{
		"plan":    plan,
		"records": records,
	})
}

func (c *InspectionController) CreatePlan(e echo.Context) error {
	ctx := e.Request().Context()
	var req service.CreatePlanRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	userID := middleware.GetUserID(ctx)
	plan, err := c.scheduleSvc.CreatePlan(ctx, userID, &req)
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, err.Error())
	}
	return c.respOk(e, plan)
}

type updatePlanStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=pending in_progress completed"`
}

func (c *InspectionController) UpdatePlanStatus(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "计划ID格式错误")
	}
	var req updatePlanStatusRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	userID := middleware.GetUserID(ctx)
	if err := c.scheduleSvc.UpdatePlanStatus(ctx, id, req.Status, userID); err != nil {
		return c.respErr(e, http.StatusBadRequest, err.Error())
	}
	return c.respOk(e, nil)
}

type recommendQuery struct {
	AreaID int64 `query:"area_id" validate:"required,gt=0"`
	Days   int   `query:"days" validate:"gte=30,lte=365"`
	Count  int   `query:"count" validate:"gte=1,lte=500"`
}

func (c *InspectionController) RecommendDevices(e echo.Context) error {
	ctx := e.Request().Context()
	var q recommendQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&q); err != nil {
		return err
	}
	if q.Days == 0 {
		q.Days = 90
	}
	if q.Count == 0 {
		q.Count = 50
	}
	ids, err := c.scheduleSvc.RecommendInspectionDevices(context.Background(), q.AreaID, q.Days, q.Count)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "推荐设备失败")
	}
	return c.respOk(e, map[string]interface{}{
		"device_ids": ids,
		"count":      len(ids),
	})
}

func (c *InspectionController) SubmitInspectionResult(e echo.Context) error {
	ctx := e.Request().Context()
	var req service.SubmitInspectionRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	record, err := c.scheduleSvc.SubmitInspectionResult(ctx, &req)
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, err.Error())
	}
	return c.respOk(e, record)
}

type deviceRecordsQuery struct {
	Page     int `query:"page"`
	PageSize int `query:"page_size"`
}

func (c *InspectionController) GetDeviceRecords(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "设备ID格式错误")
	}
	var q deviceRecordsQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	list, total, err := c.inspectionRepo.GetRecordsByDevice(ctx, id, q.Page, q.PageSize)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "查询巡检记录失败")
	}
	return c.respOk(e, pageResult(list, total, q.Page, q.PageSize))
}

func (c *InspectionController) respOk(e echo.Context, data interface{}) error {
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      data,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

func (c *InspectionController) respErr(e echo.Context, code int, msg string) error {
	return e.JSON(code, model.Response{
		Code:      code,
		Message:   msg,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}
