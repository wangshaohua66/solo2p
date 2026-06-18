package controller

import (
	"net/http"
	"time"

	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type EnergyController struct {
	energySvc     *service.EnergyService
	deviceService *service.DeviceService
}

func NewEnergyController(
	energySvc *service.EnergyService,
	deviceService *service.DeviceService) *EnergyController {
	return &EnergyController{
		energySvc:     energySvc,
		deviceService: deviceService,
	}
}

type statsQuery struct {
	AreaID     int64  `query:"area_id"`
	DeviceID   int64  `query:"device_id"`
	DeviceType string `query:"device_type"`
	Dimension  string `query:"dimension"`
	StartDate  string `query:"start_date"`
	EndDate    string `query:"end_date"`
}

func (c *EnergyController) GetEnergyStats(e echo.Context) error {
	ctx := e.Request().Context()
	var q statsQuery
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
	req := &service.EnergyStatsRequest{
		AreaID:     q.AreaID,
		DeviceID:   q.DeviceID,
		DeviceType: q.DeviceType,
		Dimension:  q.Dimension,
		StartDate:  startDate,
		EndDate:    endDate,
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	result, err := c.energySvc.GetEnergyStats(ctx, req, areaIDs)
	if err != nil {
		pkg.Error(ctx, "get energy stats failed", zap.Error(err))
		return c.respErr(e, http.StatusInternalServerError, "查询能耗统计失败")
	}
	return c.respOk(e, result)
}

type yoyQuery struct {
	AreaID    int64  `query:"area_id"`
	StartDate string `query:"start_date" validate:"required"`
	EndDate   string `query:"end_date" validate:"required"`
}

func (c *EnergyController) GetYoYComparison(e echo.Context) error {
	ctx := e.Request().Context()
	var q yoyQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&q); err != nil {
		return err
	}
	startDate, err := time.Parse("2006-01-02", q.StartDate)
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "开始日期格式错误")
	}
	endDate, err := time.Parse("2006-01-02 15:04:05", q.EndDate+" 23:59:59")
	if err != nil {
		return c.respErr(e, http.StatusBadRequest, "结束日期格式错误")
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	result, err := c.energySvc.GetYearOverYearComparison(ctx, q.AreaID, startDate, endDate, areaIDs)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "查询同比对比失败")
	}
	return c.respOk(e, result)
}

type reportQuery struct {
	AreaID int64 `query:"area_id"`
}

func (c *EnergyController) GetOptimizationReport(e echo.Context) error {
	ctx := e.Request().Context()
	var q reportQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	result, err := c.energySvc.GetOptimizationReport(ctx, q.AreaID, areaIDs)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取优化报告失败")
	}
	return c.respOk(e, result)
}

type abnormalQuery struct {
	AreaID int64 `query:"area_id"`
	Limit  int   `query:"limit" validate:"gte=1,lte=200"`
}

func (c *EnergyController) GetAbnormalDevices(e echo.Context) error {
	ctx := e.Request().Context()
	var q abnormalQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	if err := pkg.ValidateStruct(&q); err != nil {
		return err
	}
	if q.Limit == 0 {
		q.Limit = 50
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	if q.AreaID > 0 {
		areaIDs = []int64{q.AreaID}
	}
	result, err := c.energySvc.GetAbnormalDevices(ctx, areaIDs, q.Limit)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取异常设备失败")
	}
	return c.respOk(e, result)
}

func (c *EnergyController) respOk(e echo.Context, data interface{}) error {
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      data,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

func (c *EnergyController) respErr(e echo.Context, code int, msg string) error {
	return e.JSON(code, model.Response{
		Code:      code,
		Message:   msg,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}
