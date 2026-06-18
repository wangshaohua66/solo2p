package handler

import (
	"fmt"
	"gas-network-system/internal/model"
	"gas-network-system/internal/repository"
	"gas-network-system/pkg/response"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type ValveHandler struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewValveHandler(repo *repository.Repository, logger *zap.Logger) *ValveHandler {
	return &ValveHandler{
		repo:   repo,
		logger: logger,
	}
}

type CreateValveOperationRequest struct {
	ValveWellID    uint                    `json:"valve_well_id" binding:"required"`
	ValveNo        string                  `json:"valve_no" binding:"required"`
	OperatorID     uint                    `json:"operator_id" binding:"required"`
	OperatorName   string                  `json:"operator_name" binding:"required"`
	OperationType  model.ValveOperationType `json:"operation_type" binding:"required,oneof=OPEN CLOSE ADJUST"`
	Reason         string                  `json:"reason" binding:"required"`
	PressureBefore float64                 `json:"pressure_before" binding:"required,gte=0"`
	PressureAfter  float64                 `json:"pressure_after" binding:"required,gte=0"`
	OperationTime  time.Time               `json:"operation_time"`
	Remark         string                  `json:"remark"`
}

// CreateValveOperation godoc
// @Summary 记录阀门操作
// @Description 记录每次阀门开闭操作，形成电子台账
// @Tags 阀门管理
// @Accept json
// @Produce json
// @Param request body CreateValveOperationRequest true "阀门操作信息"
// @Success 200 {object} response.Response{data=model.ValveOperation}
// @Router /api/v1/valve/operations [post]
func (h *ValveHandler) CreateOperation(c *gin.Context) {
	var req CreateValveOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if req.OperationTime.IsZero() {
		req.OperationTime = time.Now()
	}

	opNo := fmt.Sprintf("VOP-%s", uuid.New().String()[:8])

	op := &model.ValveOperation{
		OperationNo:    opNo,
		ValveWellID:    req.ValveWellID,
		ValveNo:        req.ValveNo,
		OperatorID:     req.OperatorID,
		OperatorName:   req.OperatorName,
		OperationType:  req.OperationType,
		Reason:         req.Reason,
		PressureBefore: req.PressureBefore,
		PressureAfter:  req.PressureAfter,
		OperationTime:  req.OperationTime,
		Remark:         req.Remark,
		CreatedAt:      time.Now(),
	}

	if err := h.repo.Valve.CreateOperation(op); err != nil {
		h.logger.Error("记录阀门操作失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "记录失败: "+err.Error()))
		return
	}

	h.logOperation(op.ID, "VALVE", fmt.Sprintf("阀门%s操作: %s", req.ValveNo, req.OperationType))

	c.JSON(http.StatusOK, response.Success(op))
}

// ListValveOperations godoc
// @Summary 查询阀门操作历史
// @Description 分页查询阀门操作历史，支持按时间范围和管段筛选
// @Tags 阀门管理
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param valve_well_id query int false "阀井ID"
// @Param valve_no query string false "阀门编号"
// @Param start_time query string false "开始时间(2006-01-02 15:04:05)"
// @Param end_time query string false "结束时间(2006-01-02 15:04:05)"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.ValveOperation}}
// @Router /api/v1/valve/operations [get]
func (h *ValveHandler) ListOperations(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var valveWellID *uint
	if idStr := c.Query("valve_well_id"); idStr != "" {
		id, _ := strconv.ParseUint(idStr, 10, 32)
		uid := uint(id)
		valveWellID = &uid
	}

	valveNo := c.Query("valve_no")

	var startTime, endTime *time.Time
	if timeStr := c.Query("start_time"); timeStr != "" {
		t, err := time.ParseInLocation("2006-01-02 15:04:05", timeStr, time.Local)
		if err == nil {
			startTime = &t
		}
	}
	if timeStr := c.Query("end_time"); timeStr != "" {
		t, err := time.ParseInLocation("2006-01-02 15:04:05", timeStr, time.Local)
		if err == nil {
			endTime = &t
		}
	}

	total, ops, err := h.repo.Valve.ListOperations(page, pageSize, valveWellID, &valveNo, startTime, endTime)
	if err != nil {
		h.logger.Error("查询阀门操作失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, ops))
}

// GetValveOperation godoc
// @Summary 获取阀门操作详情
// @Description 根据ID获取阀门操作详情
// @Tags 阀门管理
// @Accept json
// @Produce json
// @Param id path int true "操作记录ID"
// @Success 200 {object} response.Response{data=model.ValveOperation}
// @Router /api/v1/valve/operations/{id} [get]
func (h *ValveHandler) GetOperation(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的记录ID"))
		return
	}

	op, err := h.repo.Valve.GetOperationByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Error(404, "记录不存在"))
		return
	}

	c.JSON(http.StatusOK, response.Success(op))
}

// ListValveWells godoc
// @Summary 查询阀井列表
// @Description 查询所有阀井
// @Tags 阀门管理
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]model.ValveWell}
// @Router /api/v1/valve/wells [get]
func (h *ValveHandler) ListValveWells(c *gin.Context) {
	// TODO: 实现ListValveWells
	c.JSON(http.StatusOK, response.Success([]model.ValveWell{}))
}

// CreateValveWell godoc
// @Summary 创建阀井
// @Description 创建新的阀井
// @Tags 阀门管理
// @Accept json
// @Produce json
// @Param valve_well body model.ValveWell true "阀井信息"
// @Success 200 {object} response.Response{data=model.ValveWell}
// @Router /api/v1/valve/wells [post]
func (h *ValveHandler) CreateValveWell(c *gin.Context) {
	var vw model.ValveWell
	if err := c.ShouldBindJSON(&vw); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.repo.Valve.CreateValveWell(&vw); err != nil {
		h.logger.Error("创建阀井失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "创建失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(vw))
}

func (h *ValveHandler) logOperation(resourceID uint, module string, operation string) {
	log := &model.OperationLog{
		UserID:     0,
		UserName:   "SYSTEM",
		Operation:  operation,
		Module:     module,
		ResourceID: resourceID,
		IPAddress:  "127.0.0.1",
		CreatedAt:  time.Now(),
	}
	_ = h.repo.Log.Create(log)
}
