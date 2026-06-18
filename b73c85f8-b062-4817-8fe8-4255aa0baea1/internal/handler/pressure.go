package handler

import (
	"gas-network-system/internal/model"
	"gas-network-system/internal/service"
	"gas-network-system/pkg/response"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type PressureHandler struct {
	service *service.PressureAnalysisService
	logger  *zap.Logger
}

func NewPressureHandler(pressureService *service.PressureAnalysisService, logger *zap.Logger) *PressureHandler {
	return &PressureHandler{
		service: pressureService,
		logger:  logger,
	}
}

// GetHourlyStats godoc
// @Summary 获取小时压力统计
// @Description 获取指定调压站指定日期的小时压力统计
// @Tags 压力分析
// @Accept json
// @Produce json
// @Param station_id query int true "调压站ID"
// @Param date query string true "日期(2006-01-02)"
// @Success 200 {object} response.Response{data=[]service.HourlyStatsResponse}
// @Router /api/v1/pressure/stats/hourly [get]
func (h *PressureHandler) GetHourlyStats(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Query("station_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的调压站ID"))
		return
	}

	dateStr := c.Query("date")
	date, err := time.ParseInLocation("2006-01-02", dateStr, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的日期格式，应为2006-01-02"))
		return
	}

	stats, err := h.service.GetHourlyStats(uint(stationID), date)
	if err != nil {
		h.logger.Error("获取小时统计失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(stats))
}

// GetDailyStats godoc
// @Summary 获取日压力统计
// @Description 获取指定调压站指定日期范围的日压力统计
// @Tags 压力分析
// @Accept json
// @Produce json
// @Param station_id query int true "调压站ID"
// @Param start_date query string true "开始日期(2006-01-02)"
// @Param end_date query string true "结束日期(2006-01-02)"
// @Success 200 {object} response.Response{data=[]service.DailyStatsResponse}
// @Router /api/v1/pressure/stats/daily [get]
func (h *PressureHandler) GetDailyStats(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Query("station_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的调压站ID"))
		return
	}

	startDateStr := c.Query("start_date")
	startDate, err := time.ParseInLocation("2006-01-02", startDateStr, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的开始日期格式，应为2006-01-02"))
		return
	}

	endDateStr := c.Query("end_date")
	endDate, err := time.ParseInLocation("2006-01-02", endDateStr, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的结束日期格式，应为2006-01-02"))
		return
	}

	stats, err := h.service.GetDailyStats(uint(stationID), startDate, endDate)
	if err != nil {
		h.logger.Error("获取日统计失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(stats))
}

// GetMonthlyStats godoc
// @Summary 获取月压力统计
// @Description 获取指定调压站指定年份的月压力统计
// @Tags 压力分析
// @Accept json
// @Produce json
// @Param station_id query int true "调压站ID"
// @Param year query int true "年份"
// @Success 200 {object} response.Response{data=[]service.MonthlyStatsResponse}
// @Router /api/v1/pressure/stats/monthly [get]
func (h *PressureHandler) GetMonthlyStats(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Query("station_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的调压站ID"))
		return
	}

	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 || year > 2100 {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的年份"))
		return
	}

	stats, err := h.service.GetMonthlyStats(uint(stationID), year)
	if err != nil {
		h.logger.Error("获取月统计失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(stats))
}

// ListPressureData godoc
// @Summary 查询压力原始数据
// @Description 分页查询压力原始数据
// @Tags 压力分析
// @Accept json
// @Produce json
// @Param station_id query int true "调压站ID"
// @Param start_time query string true "开始时间(2006-01-02 15:04:05)"
// @Param end_time query string true "结束时间(2006-01-02 15:04:05)"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(288)
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.PressureData}}
// @Router /api/v1/pressure/data [get]
func (h *PressureHandler) ListPressureData(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Query("station_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的调压站ID"))
		return
	}

	startTimeStr := c.Query("start_time")
	startTime, err := time.ParseInLocation("2006-01-02 15:04:05", startTimeStr, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的开始时间格式"))
		return
	}

	endTimeStr := c.Query("end_time")
	endTime, err := time.ParseInLocation("2006-01-02 15:04:05", endTimeStr, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的结束时间格式"))
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "288"))

	total, data, err := h.service.Repo.Pressure.GetDataByStation(uint(stationID), startTime, endTime, page, pageSize)
	if err != nil {
		h.logger.Error("查询压力数据失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, data))
}

// GetLatestPressure godoc
// @Summary 获取最新压力数据
// @Description 获取指定调压站最新的压力数据
// @Tags 压力分析
// @Accept json
// @Produce json
// @Param station_id query int true "调压站ID"
// @Success 200 {object} response.Response{data=model.PressureData}
// @Router /api/v1/pressure/data/latest [get]
func (h *PressureHandler) GetLatestPressure(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Query("station_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的调压站ID"))
		return
	}

	data, err := h.service.Repo.Pressure.GetLatestData(uint(stationID))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Error(404, "无数据"))
		return
	}

	c.JSON(http.StatusOK, response.Success(data))
}

// ListStations godoc
// @Summary 查询调压站列表
// @Description 查询所有调压站
// @Tags 压力分析
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]model.PressureRegulatingStation}
// @Router /api/v1/pressure/stations [get]
func (h *PressureHandler) ListStations(c *gin.Context) {
	stations, err := h.service.Repo.Pressure.GetAllStations()
	if err != nil {
		h.logger.Error("查询调压站失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(stations))
}

// ListPipelines godoc
// @Summary 查询管段列表
// @Description 查询所有管段
// @Tags 基础数据
// @Accept json
// @Produce json
// @Param level query string false "管段等级"
// @Success 200 {object} response.Response{data=[]model.Pipeline}
// @Router /api/v1/basic/pipelines [get]
func (h *PressureHandler) ListPipelines(c *gin.Context) {
	level := c.Query("level")

	var pipelines []model.Pipeline
	var err error

	if level != "" {
		pipelines, err = h.service.Repo.Pipeline.GetPipelinesByLevel(model.PipelineLevel(level))
	} else {
		pipelines, err = h.service.Repo.Pipeline.GetAllPipelines()
	}

	if err != nil {
		h.logger.Error("查询管段失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(pipelines))
}

// CreatePipeline godoc
// @Summary 创建管段
// @Description 创建新的管段
// @Tags 基础数据
// @Accept json
// @Produce json
// @Param pipeline body model.Pipeline true "管段信息"
// @Success 200 {object} response.Response{data=model.Pipeline}
// @Router /api/v1/basic/pipelines [post]
func (h *PressureHandler) CreatePipeline(c *gin.Context) {
	var pipeline model.Pipeline
	if err := c.ShouldBindJSON(&pipeline); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.service.Repo.Pipeline.Create(&pipeline); err != nil {
		h.logger.Error("创建管段失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "创建失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(pipeline))
}
