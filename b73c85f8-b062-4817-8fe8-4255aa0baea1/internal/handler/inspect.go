package handler

import (
	"gas-network-system/internal/alarm"
	"gas-network-system/internal/model"
	"gas-network-system/internal/service"
	"gas-network-system/pkg/response"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"go.uber.org/zap"
)

type InspectHandler struct {
	scheduler    *service.SchedulerService
	trackService *service.TrackService
	logger       *zap.Logger
}

func NewInspectHandler(scheduler *service.SchedulerService, trackService *service.TrackService, logger *zap.Logger) *InspectHandler {
	return &InspectHandler{
		scheduler:    scheduler,
		trackService: trackService,
		logger:       logger,
	}
}

type GeneratePlanRequest struct {
	Date string `json:"date" form:"date" binding:"omitempty,datetime=2006-01-02"`
}

// GeneratePlan godoc
// @Summary 生成巡检计划
// @Description 按管段等级自动生成巡检任务，一级每日、二级每周、三级每月
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param request body GeneratePlanRequest false "生成日期"
// @Success 200 {object} response.Response{data=service.PlanGenerationResult}
// @Router /api/v1/inspect/plans/generate [post]
func (h *InspectHandler) GeneratePlan(c *gin.Context) {
	var req GeneratePlanRequest
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	result, err := h.scheduler.GenerateDailyPlans()
	if err != nil {
		h.logger.Error("生成巡检计划失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "生成巡检计划失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(result))
}

// ListTasks godoc
// @Summary 查询巡检任务列表
// @Description 分页查询巡检任务，支持按巡检员、状态、日期范围筛选
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param inspector_id query int false "巡检员ID"
// @Param status query string false "任务状态"
// @Param date_from query string false "开始日期(2006-01-02)"
// @Param date_to query string false "结束日期(2006-01-02)"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.InspectionTask}}
// @Router /api/v1/inspect/tasks [get]
func (h *InspectHandler) ListTasks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var inspectorID *uint
	if idStr := c.Query("inspector_id"); idStr != "" {
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err == nil {
			uid := uint(id)
			inspectorID = &uid
		}
	}

	status := c.Query("status")

	var dateFrom, dateTo *time.Time
	if dateStr := c.Query("date_from"); dateStr != "" {
		t, err := time.ParseInLocation("2006-01-02", dateStr, time.Local)
		if err == nil {
			dateFrom = &t
		}
	}
	if dateStr := c.Query("date_to"); dateStr != "" {
		t, err := time.ParseInLocation("2006-01-02", dateStr, time.Local)
		if err == nil {
			dateTo = &t
		}
	}

	total, tasks, err := h.scheduler.Repo.Inspector.ListTasks(page, pageSize, inspectorID, &status, dateFrom, dateTo)
	if err != nil {
		h.logger.Error("查询巡检任务失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, tasks))
}

// GetTask godoc
// @Summary 获取巡检任务详情
// @Description 根据ID获取巡检任务详情
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param id path int true "任务ID"
// @Success 200 {object} response.Response{data=model.InspectionTask}
// @Router /api/v1/inspect/tasks/{id} [get]
func (h *InspectHandler) GetTask(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的任务ID"))
		return
	}

	task, err := h.scheduler.Repo.Inspector.GetTaskByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Error(404, "任务不存在"))
		return
	}

	c.JSON(http.StatusOK, response.Success(task))
}

type AcceptTaskRequest struct {
	InspectorID uint `json:"inspector_id" binding:"required"`
}

// AcceptTask godoc
// @Summary 接单
// @Description 巡检员接单
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param id path int true "任务ID"
// @Param request body AcceptTaskRequest true "接单信息"
// @Success 200 {object} response.Response
// @Router /api/v1/inspect/tasks/{id}/accept [post]
func (h *InspectHandler) AcceptTask(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的任务ID"))
		return
	}

	var req AcceptTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.scheduler.AcceptTask(uint(id), req.InspectorID); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(nil))
}

type CompleteTaskRequest struct {
	Remark string `json:"remark"`
}

// CompleteTask godoc
// @Summary 完成任务
// @Description 巡检员完成任务
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param id path int true "任务ID"
// @Param request body CompleteTaskRequest true "完成信息"
// @Success 200 {object} response.Response
// @Router /api/v1/inspect/tasks/{id}/complete [post]
func (h *InspectHandler) CompleteTask(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的任务ID"))
		return
	}

	var req CompleteTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.scheduler.CompleteTask(uint(id), req.Remark); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(nil))
}

// ReassignTasks godoc
// @Summary 任务重分配
// @Description 巡检员请假时基于负荷均衡重分配任务
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param request body service.ReassignRequest true "重分配请求"
// @Success 200 {object} response.Response{data=service.ReassignResult}
// @Router /api/v1/inspect/plans/reassign [post]
func (h *InspectHandler) ReassignTasks(c *gin.Context) {
	var req service.ReassignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	result, err := h.scheduler.ReassignInspectorTasks(req)
	if err != nil {
		h.logger.Error("任务重分配失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(result))
}

// ListInspectors godoc
// @Summary 查询巡检员列表
// @Description 分页查询巡检员列表
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param status query string false "状态"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.Inspector}}
// @Router /api/v1/inspect/inspectors [get]
func (h *InspectHandler) ListInspectors(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	total, inspectors, err := h.scheduler.Repo.Inspector.List(page, pageSize, &status)
	if err != nil {
		h.logger.Error("查询巡检员失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, inspectors))
}

// CreateInspector godoc
// @Summary 创建巡检员
// @Description 创建新的巡检员
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param inspector body model.Inspector true "巡检员信息"
// @Success 200 {object} response.Response{data=model.Inspector}
// @Router /api/v1/inspect/inspectors [post]
func (h *InspectHandler) CreateInspector(c *gin.Context) {
	var inspector model.Inspector
	if err := c.ShouldBindJSON(&inspector); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.scheduler.Repo.Inspector.Create(&inspector); err != nil {
		h.logger.Error("创建巡检员失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "创建失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(inspector))
}

type SubmitTrackRequest struct {
	TaskID      uint                `json:"task_id" binding:"required"`
	InspectorID uint               `json:"inspector_id" binding:"required"`
	TrackPoints []service.TrackPoint `json:"track_points" binding:"required,min=1"`
}

// SubmitTrack godoc
// @Summary 提交巡检轨迹
// @Description 巡检员提交GPS轨迹点序列，系统自动核查轨迹偏差
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param request body SubmitTrackRequest true "轨迹数据"
// @Success 200 {object} response.Response{data=service.TrackCheckResult}
// @Router /api/v1/inspect/tracks [post]
func (h *InspectHandler) SubmitTrack(c *gin.Context) {
	var req SubmitTrackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	result, err := h.trackService.SubmitAndCheckTrack(service.SubmitTrackRequest(req))
	if err != nil {
		h.logger.Error("提交巡检轨迹失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(result))
}

// ListTracks godoc
// @Summary 查询轨迹核查记录
// @Description 分页查询巡检轨迹核查记录
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param inspector_id query int false "巡检员ID"
// @Param is_deviated query bool false "是否偏航"
// @Param start_date query string false "开始日期(2006-01-02)"
// @Param end_date query string false "结束日期(2006-01-02)"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.InspectionTrack}}
// @Router /api/v1/inspect/tracks [get]
func (h *InspectHandler) ListTracks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var inspectorID *uint
	if idStr := c.Query("inspector_id"); idStr != "" {
		id, _ := strconv.ParseUint(idStr, 10, 32)
		uid := uint(id)
		inspectorID = &uid
	}

	var isDeviated *bool
	if devStr := c.Query("is_deviated"); devStr != "" {
		d, _ := strconv.ParseBool(devStr)
		isDeviated = &d
	}

	var startDate, endDate *time.Time
	if dateStr := c.Query("start_date"); dateStr != "" {
		t, _ := time.ParseInLocation("2006-01-02", dateStr, time.Local)
		startDate = &t
	}
	if dateStr := c.Query("end_date"); dateStr != "" {
		t, _ := time.ParseInLocation("2006-01-02", dateStr, time.Local)
		endDate = &t
	}

	total, tracks, err := h.scheduler.Repo.Track.List(page, pageSize, inspectorID, isDeviated, startDate, endDate)
	if err != nil {
		h.logger.Error("查询轨迹记录失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, tracks))
}

// CheckExpiredTasks godoc
// @Summary 检查超时任务
// @Description 检查任务逾期2小时未接单，触发升级提醒
// @Tags 巡检管理
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]model.InspectionTask}
// @Router /api/v1/inspect/tasks/check-expired [post]
func (h *InspectHandler) CheckExpiredTasks(c *gin.Context) {
	tasks, err := h.scheduler.CheckExpiredTasks()
	if err != nil {
		h.logger.Error("检查超时任务失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(tasks))
}

var _ = alarm.PressureRule{}
