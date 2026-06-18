package handler

import (
	"gas-network-system/internal/service"
	"gas-network-system/pkg/response"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type HazardHandler struct {
	service *service.HazardService
	logger  *zap.Logger
}

func NewHazardHandler(hazardService *service.HazardService, logger *zap.Logger) *HazardHandler {
	return &HazardHandler{
		service: hazardService,
		logger:  logger,
	}
}

// RegisterHazard godoc
// @Summary 登记隐患
// @Description 巡检发现隐患进行登记
// @Tags 隐患管理
// @Accept json
// @Produce json
// @Param request body service.RegisterHazardRequest true "隐患信息"
// @Success 200 {object} response.Response{data=model.Hazard}
// @Router /api/v1/hazard/hazards [post]
func (h *HazardHandler) RegisterHazard(c *gin.Context) {
	var req service.RegisterHazardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	hazard, err := h.service.RegisterHazard(req)
	if err != nil {
		h.logger.Error("登记隐患失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "登记失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(hazard))
}

// ListHazards godoc
// @Summary 查询隐患列表
// @Description 分页查询隐患列表
// @Tags 隐患管理
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param level query string false "隐患等级"
// @Param status query string false "隐患状态"
// @Param pipeline_id query int false "管段ID"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.Hazard}}
// @Router /api/v1/hazard/hazards [get]
func (h *HazardHandler) ListHazards(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	level := c.Query("level")
	status := c.Query("status")

	var pipelineID *uint
	if idStr := c.Query("pipeline_id"); idStr != "" {
		id, _ := strconv.ParseUint(idStr, 10, 32)
		uid := uint(id)
		pipelineID = &uid
	}

	total, hazards, err := h.service.Repo.Hazard.List(page, pageSize, &level, &status, pipelineID)
	if err != nil {
		h.logger.Error("查询隐患失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, hazards))
}

// GetHazard godoc
// @Summary 获取隐患详情
// @Description 根据ID获取隐患详情
// @Tags 隐患管理
// @Accept json
// @Produce json
// @Param id path int true "隐患ID"
// @Success 200 {object} response.Response{data=model.Hazard}
// @Router /api/v1/hazard/hazards/{id} [get]
func (h *HazardHandler) GetHazard(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的隐患ID"))
		return
	}

	hazard, err := h.service.Repo.Hazard.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Error(404, "隐患不存在"))
		return
	}

	c.JSON(http.StatusOK, response.Success(hazard))
}

// AssignHazard godoc
// @Summary 指派整改人
// @Description 为隐患指派整改责任人
// @Tags 隐患管理
// @Accept json
// @Produce json
// @Param request body service.AssignHazardRequest true "指派信息"
// @Success 200 {object} response.Response
// @Router /api/v1/hazard/hazards/assign [post]
func (h *HazardHandler) AssignHazard(c *gin.Context) {
	var req service.AssignHazardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.service.AssignHazard(req); err != nil {
		h.logger.Error("指派隐患失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(nil))
}

// RectifyHazard godoc
// @Summary 提交整改
// @Description 整改完成后提交整改信息
// @Tags 隐患管理
// @Accept json
// @Produce json
// @Param request body service.RectifyHazardRequest true "整改信息"
// @Success 200 {object} response.Response
// @Router /api/v1/hazard/hazards/rectify [post]
func (h *HazardHandler) RectifyHazard(c *gin.Context) {
	var req service.RectifyHazardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.service.RectifyHazard(req); err != nil {
		h.logger.Error("提交整改失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(nil))
}

// AcceptHazard godoc
// @Summary 验收隐患
// @Description 对整改完成的隐患进行验收
// @Tags 隐患管理
// @Accept json
// @Produce json
// @Param request body service.AcceptHazardRequest true "验收信息"
// @Success 200 {object} response.Response
// @Router /api/v1/hazard/hazards/accept [post]
func (h *HazardHandler) AcceptHazard(c *gin.Context) {
	var req service.AcceptHazardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if err := h.service.AcceptHazard(req); err != nil {
		h.logger.Error("验收隐患失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(nil))
}

// CheckOverdueHazards godoc
// @Summary 检查超期隐患
// @Description 检查重大隐患超48小时未整改，自动升级通知主管
// @Tags 隐患管理
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]model.Hazard}
// @Router /api/v1/hazard/hazards/check-overdue [post]
func (h *HazardHandler) CheckOverdueHazards(c *gin.Context) {
	hazards, err := h.service.CheckOverdueHazards()
	if err != nil {
		h.logger.Error("检查超期隐患失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(hazards))
}
