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
	"gorm.io/gorm"
)

type FaultController struct {
	db            *gorm.DB
	faultRepo     *repository.FaultRepo
	alertEngine   *service.AlertEngine
	deviceService *service.DeviceService
}

func NewFaultController(
	db *gorm.DB,
	faultRepo *repository.FaultRepo,
	alertEngine *service.AlertEngine,
	deviceService *service.DeviceService) *FaultController {
	return &FaultController{
		db:            db,
		faultRepo:     faultRepo,
		alertEngine:   alertEngine,
		deviceService: deviceService,
	}
}

type listFaultQuery struct {
	DeviceID   int64  `query:"device_id"`
	AreaID     int64  `query:"area_id"`
	FaultType  string `query:"fault_type"`
	FaultLevel string `query:"fault_level"`
	Status     string `query:"status"`
	StartDate  string `query:"start_date"`
	EndDate    string `query:"end_date"`
	Page       int    `query:"page"`
	PageSize   int    `query:"page_size"`
	Sort       string `query:"sort"`
}

func (c *FaultController) ListFaults(e echo.Context) error {
	ctx := e.Request().Context()
	var q listFaultQuery
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
	params := &repository.FaultQueryParams{
		DeviceID:   q.DeviceID,
		AreaID:     q.AreaID,
		FaultType:  q.FaultType,
		FaultLevel: q.FaultLevel,
		Status:     q.Status,
		StartDate:  startDate,
		EndDate:    endDate,
		Page:       q.Page,
		PageSize:   q.PageSize,
		Sort:       q.Sort,
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	list, total, err := c.faultRepo.List(ctx, params, areaIDs)
	if err != nil {
		pkg.Error(ctx, "list faults failed", zap.Error(err))
		return c.respErr(e, http.StatusInternalServerError, "查询故障列表失败")
	}
	return c.respOk(e, pageResult(list, total, q.Page, q.PageSize))
}

func (c *FaultController) GetFault(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "故障ID格式错误")
	}
	fault, err := c.faultRepo.GetByID(ctx, id)
	if err != nil {
		return c.respErr(e, http.StatusNotFound, "故障不存在")
	}
	return c.respOk(e, fault)
}

func (c *FaultController) HandleFault(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "故障ID格式错误")
	}
	fault, err := c.faultRepo.GetByID(ctx, id)
	if err != nil {
		return c.respErr(e, http.StatusNotFound, "故障不存在")
	}
	fault.Status = model.AlertStatusHandled
	fault.RecoveredAt = time.Now()
	fault.UpdatedAt = time.Now()
	if err := c.faultRepo.Update(ctx, fault); err != nil {
		return c.respErr(e, http.StatusInternalServerError, "处理故障失败")
	}
	return c.respOk(e, fault)
}

func (c *FaultController) ListFaultRules(e echo.Context) error {
	ctx := e.Request().Context()
	var rules []*model.FaultRule
	if err := c.db.WithContext(ctx).Where("1=1").Order("id ASC").Find(&rules).Error; err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取故障规则失败")
	}
	return c.respOk(e, rules)
}

type updateRuleRequest struct {
	ThresholdMin float64 `json:"threshold_min"`
	ThresholdMax float64 `json:"threshold_max"`
	Weight       int     `json:"weight" validate:"gte=1,lte=10"`
	FaultLevel   string  `json:"fault_level" validate:"fault_level"`
	Duration     int     `json:"duration"`
	Enabled      *bool   `json:"enabled"`
}

func (c *FaultController) UpdateFaultRule(e echo.Context) error {
	ctx := e.Request().Context()
	id, err := parseInt64(e.Param("id"))
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "规则ID格式错误")
	}
	var req updateRuleRequest
	if err := e.Bind(&req); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&req); err != nil {
		return err
	}
	var rule model.FaultRule
	if err := c.db.WithContext(ctx).First(&rule, id).Error; err != nil {
		return c.respErr(e, http.StatusNotFound, "规则不存在")
	}
	rule.ThresholdMin = req.ThresholdMin
	rule.ThresholdMax = req.ThresholdMax
	rule.Weight = req.Weight
	rule.FaultLevel = req.FaultLevel
	rule.Duration = req.Duration
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}
	rule.UpdatedAt = time.Now()
	if err := c.db.WithContext(ctx).Save(&rule).Error; err != nil {
		return c.respErr(e, http.StatusInternalServerError, "更新规则失败")
	}
	return c.respOk(e, rule)
}

type listAlertQuery struct {
	Status   string `query:"status"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

func (c *FaultController) ListAlerts(e echo.Context) error {
	ctx := e.Request().Context()
	var q listAlertQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	list, total, err := c.faultRepo.ListAlerts(ctx, q.Status, q.Page, q.PageSize, areaIDs)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "查询告警列表失败")
	}
	return c.respOk(e, pageResult(list, total, q.Page, q.PageSize))
}

func (c *FaultController) TriggerScan(e echo.Context) error {
	ctx := e.Request().Context()
	go func() {
		count, err := c.alertEngine.ScanAndDetectFaults(context.Background())
		if err != nil {
			pkg.Error(ctx, "manual fault scan failed", zap.Error(err))
			return
		}
		pkg.Info(ctx, "manual fault scan completed", zap.Int("new_faults", count))
	}()
	return c.respOk(e, map[string]string{"status": "scanning started"})
}

func (c *FaultController) respOk(e echo.Context, data interface{}) error {
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      data,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

func (c *FaultController) respErr(e echo.Context, code int, msg string) error {
	return e.JSON(code, model.Response{
		Code:      code,
		Message:   msg,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

func parseInt64(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}

func pageResult(list interface{}, total int64, page, pageSize int) model.PageResult {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	pageCount := int((total + int64(pageSize) - 1) / int64(pageSize))
	return model.PageResult{
		List:      list,
		Total:     total,
		Page:      page,
		PageSize:  pageSize,
		PageCount: pageCount,
	}
}
