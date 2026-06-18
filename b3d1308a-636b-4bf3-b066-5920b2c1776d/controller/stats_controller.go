package controller

import (
	"net/http"
	"time"

	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/repository"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
)

type StatsController struct {
	statsSvc      *service.StatsService
	deviceService *service.DeviceService
	commandRepo *repository.CommandRepo
}

func NewStatsController(
	statsSvc *service.StatsService,
	deviceService *service.DeviceService,
	commandRepo *repository.CommandRepo) *StatsController {
	return &StatsController{
		statsSvc:      statsSvc,
		deviceService: deviceService,
		commandRepo: commandRepo,
	}
}

func (c *StatsController) GetOverview(e echo.Context) error {
	ctx := e.Request().Context()
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	stats, err := c.statsSvc.GetOverviewStats(ctx, areaIDs)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取概览数据失败")
	}
	return c.respOk(e, stats)
}

type trendQuery struct {
	Days int `query:"days" validate:"gte=7,lte=365"`
}

func (c *StatsController) GetLightingRateTrend(e echo.Context) error {
	ctx := e.Request().Context()
	var q trendQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	if q.Days == 0 {
		q.Days = 30
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	data, err := c.statsSvc.GetLightingRateTrend(ctx, areaIDs, q.Days)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取亮灯率趋势失败")
	}
	return c.respOk(e, data)
}

func (c *StatsController) GetEnergyTrend(e echo.Context) error {
	ctx := e.Request().Context()
	var q trendQuery
	if err := e.Bind(&q); err != nil {
		return err
	}
	if q.Days == 0 {
		q.Days = 30
	}
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	data, err := c.statsSvc.GetEnergyTrend(ctx, areaIDs, q.Days)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取能耗趋势失败")
	}
	return c.respOk(e, data)
}

func (c *StatsController) GetFaultTypeDistribution(e echo.Context) error {
	ctx := e.Request().Context()
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	data, err := c.statsSvc.GetFaultTypeDistribution(ctx, areaIDs)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取故障类型分布失败")
	}
	return c.respOk(e, data)
}

func (c *StatsController) GetAreaRanking(e echo.Context) error {
	ctx := e.Request().Context()
	areaIDs := c.deviceService.GetVisibleAreaIDs(ctx)
	data, err := c.statsSvc.GetAreaRanking(ctx, areaIDs)
	if err != nil {
		return c.respErr(e, http.StatusInternalServerError, "获取区域排名失败")
	}
	return c.respOk(e, data)
}

func (c *StatsController) respOk(e echo.Context, data interface{}) error {
	return e.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "success",
		Data:      data,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}

func (c *StatsController) respErr(e echo.Context, code int, msg string) error {
	return e.JSON(code, model.Response{
		Code:      code,
		Message:   msg,
		RequestID: middleware.GetRequestID(e.Request().Context()),
		Timestamp: time.Now().Unix(),
	})
}
