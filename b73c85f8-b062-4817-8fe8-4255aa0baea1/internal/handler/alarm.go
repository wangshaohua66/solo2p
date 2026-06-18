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

type AlarmHandler struct {
	engine     *alarm.AlarmEngine
	dispatch   *service.DispatchService
	logger     *zap.Logger
}

func NewAlarmHandler(engine *alarm.AlarmEngine, dispatch *service.DispatchService, logger *zap.Logger) *AlarmHandler {
	return &AlarmHandler{
		engine:   engine,
		dispatch: dispatch,
		logger:   logger,
	}
}

// PushPressureData godoc
// @Summary 推送压力数据
// @Description SCADA系统推送压力数据，引擎自动匹配规则生成告警
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param data body alarm.PressureDataInput true "压力数据"
// @Success 200 {object} response.Response{data=[]alarm.MatchResult}
// @Router /api/v1/alarm/pressure-data [post]
func (h *AlarmHandler) PushPressureData(c *gin.Context) {
	var data alarm.PressureDataInput
	if err := c.ShouldBindBodyWith(&data, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	results, err := h.engine.ProcessPressureData(data)
	if err != nil {
		h.logger.Error("处理压力数据失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "处理失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(results))
}

// BatchPushPressureData godoc
// @Summary 批量推送压力数据
// @Description 批量推送压力数据
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param data body []alarm.PressureDataInput true "压力数据列表"
// @Success 200 {object} response.Response{data=[]alarm.MatchResult}
// @Router /api/v1/alarm/pressure-data/batch [post]
func (h *AlarmHandler) BatchPushPressureData(c *gin.Context) {
	var dataList []alarm.PressureDataInput
	if err := c.ShouldBindJSON(&dataList); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	results, err := h.engine.BatchProcess(dataList)
	if err != nil {
		h.logger.Error("批量处理压力数据失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "处理失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(results))
}

// ListAlarms godoc
// @Summary 查询告警列表
// @Description 分页查询告警列表
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param status query string false "告警状态"
// @Param level query string false "告警级别"
// @Param type query string false "告警类型"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.Alarm}}
// @Router /api/v1/alarm/alarms [get]
func (h *AlarmHandler) ListAlarms(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	level := c.Query("level")
	alarmType := c.Query("type")

	total, alarms, err := h.dispatch.Repo.Alarm.List(page, pageSize, &status, &level, &alarmType)
	if err != nil {
		h.logger.Error("查询告警列表失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, alarms))
}

// GetAlarm godoc
// @Summary 获取告警详情
// @Description 根据ID获取告警详情
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param id path int true "告警ID"
// @Success 200 {object} response.Response{data=model.Alarm}
// @Router /api/v1/alarm/alarms/{id} [get]
func (h *AlarmHandler) GetAlarm(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的告警ID"))
		return
	}

	alarm, err := h.dispatch.Repo.Alarm.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Error(404, "告警不存在"))
		return
	}

	c.JSON(http.StatusOK, response.Success(alarm))
}

type DispatchAlarmRequest struct {
	Location string `json:"location" binding:"required"`
}

// DispatchAlarm godoc
// @Summary 调度抢修
// @Description 对告警进行抢修调度，自动计算最优抢修队
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param id path int true "告警ID"
// @Param request body DispatchAlarmRequest true "位置信息"
// @Success 200 {object} response.Response{data=service.DispatchResult}
// @Router /api/v1/alarm/alarms/{id}/dispatch [post]
func (h *AlarmHandler) DispatchAlarm(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的告警ID"))
		return
	}

	var req DispatchAlarmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	result, err := h.dispatch.DispatchAlarm(service.DispatchRequest{
		AlarmID:  uint(id),
		Location: req.Location,
	})
	if err != nil {
		h.logger.Error("调度抢修失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(result))
}

// ListRepairOrders godoc
// @Summary 查询抢修工单列表
// @Description 分页查询抢修工单列表
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param team_id query int false "抢修队ID"
// @Param status query string false "工单状态"
// @Param alarm_id query int false "告警ID"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.RepairOrder}}
// @Router /api/v1/alarm/repair-orders [get]
func (h *AlarmHandler) ListRepairOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var teamID *uint
	if idStr := c.Query("team_id"); idStr != "" {
		id, _ := strconv.ParseUint(idStr, 10, 32)
		uid := uint(id)
		teamID = &uid
	}

	var alarmID *uint
	if idStr := c.Query("alarm_id"); idStr != "" {
		id, _ := strconv.ParseUint(idStr, 10, 32)
		uid := uint(id)
		alarmID = &uid
	}

	status := c.Query("status")

	total, orders, err := h.dispatch.Repo.Repair.ListOrders(page, pageSize, teamID, &status, alarmID)
	if err != nil {
		h.logger.Error("查询抢修工单失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, orders))
}

// GetRepairOrder godoc
// @Summary 获取抢修工单详情
// @Description 根据ID获取抢修工单详情
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param id path int true "工单ID"
// @Success 200 {object} response.Response{data=model.RepairOrder}
// @Router /api/v1/alarm/repair-orders/{id} [get]
func (h *AlarmHandler) GetRepairOrder(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的工单ID"))
		return
	}

	order, err := h.dispatch.Repo.Repair.GetOrderByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Error(404, "工单不存在"))
		return
	}

	c.JSON(http.StatusOK, response.Success(order))
}

type UpdateOrderStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=DISPATCHED ARRIVED PROCESSING COMPLETED"`
	Remark string `json:"remark"`
}

// UpdateRepairOrderStatus godoc
// @Summary 更新抢修工单状态
// @Description 更新抢修工单状态
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param id path int true "工单ID"
// @Param request body UpdateOrderStatusRequest true "状态信息"
// @Success 200 {object} response.Response
// @Router /api/v1/alarm/repair-orders/{id}/status [put]
func (h *AlarmHandler) UpdateRepairOrderStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的工单ID"))
		return
	}

	var req UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.dispatch.UpdateRepairOrderStatus(uint(id), model.RepairOrderStatus(req.Status), req.Remark); err != nil {
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(nil))
}

// ListRepairTeams godoc
// @Summary 查询抢修队列表
// @Description 查询所有抢修队
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]model.RepairTeam}
// @Router /api/v1/alarm/repair-teams [get]
func (h *AlarmHandler) ListRepairTeams(c *gin.Context) {
	teams, err := h.dispatch.Repo.Repair.GetAllTeams()
	if err != nil {
		h.logger.Error("查询抢修队失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(teams))
}

// CreateRepairTeam godoc
// @Summary 创建抢修队
// @Description 创建新的抢修队
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param team body model.RepairTeam true "抢修队信息"
// @Success 200 {object} response.Response{data=model.RepairTeam}
// @Router /api/v1/alarm/repair-teams [post]
func (h *AlarmHandler) CreateRepairTeam(c *gin.Context) {
	var team model.RepairTeam
	if err := c.ShouldBindJSON(&team); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.dispatch.Repo.Repair.CreateTeam(&team); err != nil {
		h.logger.Error("创建抢修队失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "创建失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(team))
}

// ArchivePressureData godoc
// @Summary 归档压力数据
// @Description 归档超过180天的压力数据为日均值
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=int64}
// @Router /api/v1/alarm/pressure-data/archive [post]
func (h *AlarmHandler) ArchivePressureData(c *gin.Context) {
	count, err := h.engine.ArchiveOldData()
	if err != nil {
		h.logger.Error("归档压力数据失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(count))
}

// GetRules godoc
// @Summary 获取告警规则
// @Description 获取所有告警规则
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]alarm.PressureRule}
// @Router /api/v1/alarm/rules [get]
func (h *AlarmHandler) GetRules(c *gin.Context) {
	rules := h.engine.GetRules()
	c.JSON(http.StatusOK, response.Success(rules))
}

// CalculateDailyStats godoc
// @Summary 计算日统计数据
// @Description 计算指定调压站指定日期的压力统计数据
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Param station_id query int true "调压站ID"
// @Param date query string true "日期(2006-01-02)"
// @Success 200 {object} response.Response
// @Router /api/v1/alarm/pressure-data/daily-stats [post]
func (h *AlarmHandler) CalculateDailyStats(c *gin.Context) {
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

	if err := h.engine.CalculateDailyStats(uint(stationID), date); err != nil {
		h.logger.Error("计算日统计数据失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(nil))
}

// CheckOverdueAlarms godoc
// @Summary 检查超时未调度告警
// @Description 检查超过DispatchTimeout秒未调度的告警，自动升级通知主管
// @Tags 报警与抢修
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]model.Alarm}
// @Router /api/v1/alarm/alarms/check-overdue [post]
func (h *AlarmHandler) CheckOverdueAlarms(c *gin.Context) {
	alarms, err := h.dispatch.CheckOverdueAlarms()
	if err != nil {
		h.logger.Error("检查超时告警失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(alarms))
}
