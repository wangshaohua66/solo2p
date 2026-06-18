package handler

import (
	"gas-network-system/internal/service"
	"gas-network-system/pkg/response"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AssessmentHandler struct {
	service *service.AssessmentService
	logger  *zap.Logger
}

func NewAssessmentHandler(assessmentService *service.AssessmentService, logger *zap.Logger) *AssessmentHandler {
	return &AssessmentHandler{
		service: assessmentService,
		logger:  logger,
	}
}

// GenerateAssessment godoc
// @Summary 生成月度考核
// @Description 根据年份和月份生成巡检员月度考核，包含统计、评分和报告生成。如不指定巡检员ID则为所有巡检员生成
// @Tags 月度考核
// @Accept json
// @Produce json
// @Param request body service.GenerateAssessmentRequest true "考核生成请求"
// @Success 200 {object} response.Response{data=service.AssessmentResult}
// @Router /api/v1/assessment/generate [post]
func (h *AssessmentHandler) GenerateAssessment(c *gin.Context) {
	var req service.GenerateAssessmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "参数错误: "+err.Error()))
		return
	}

	if req.Year < 2000 || req.Year > 2100 {
		c.JSON(http.StatusBadRequest, response.Error(400, "年份范围应在2000-2100之间"))
		return
	}

	now := time.Now()
	if req.Year > now.Year() || (req.Year == now.Year() && time.Month(req.Month) > now.Month()) {
		c.JSON(http.StatusBadRequest, response.Error(400, "不能生成未来月份的考核"))
		return
	}

	result, err := h.service.GenerateMonthlyAssessment(req)
	if err != nil {
		h.logger.Error("生成月度考核失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "生成失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.Success(result))
}

// ListAssessments godoc
// @Summary 查询月度考核列表
// @Description 分页查询月度考核记录，支持按巡检员、年月、是否通过筛选
// @Tags 月度考核
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页条数" default(20)
// @Param inspector_id query int false "巡检员ID"
// @Param year query int false "年份"
// @Param month query int false "月份(1-12)"
// @Param is_passed query bool false "是否通过"
// @Success 200 {object} response.Response{data=response.PageResult{list=[]model.MonthlyAssessment}}
// @Router /api/v1/assessment [get]
func (h *AssessmentHandler) ListAssessments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var inspectorID *uint
	if idStr := c.Query("inspector_id"); idStr != "" {
		id, _ := strconv.ParseUint(idStr, 10, 32)
		uid := uint(id)
		inspectorID = &uid
	}

	var year *int
	if yearStr := c.Query("year"); yearStr != "" {
		y, _ := strconv.Atoi(yearStr)
		year = &y
	}

	var month *int
	if monthStr := c.Query("month"); monthStr != "" {
		m, _ := strconv.Atoi(monthStr)
		month = &m
	}

	var isPassed *bool
	if passedStr := c.Query("is_passed"); passedStr != "" {
		b := passedStr == "true" || passedStr == "1"
		isPassed = &b
	}

	total, assessments, err := h.service.Repo.Assessment.List(page, pageSize, inspectorID, year, month, isPassed)
	if err != nil {
		h.logger.Error("查询考核列表失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.Error(500, "查询失败: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, response.SuccessPage(total, assessments))
}

// GetAssessment godoc
// @Summary 获取考核详情
// @Description 根据ID获取月度考核详情，包含完整报告
// @Tags 月度考核
// @Accept json
// @Produce json
// @Param id path int true "考核记录ID"
// @Success 200 {object} response.Response{data=model.MonthlyAssessment}
// @Router /api/v1/assessment/{id} [get]
func (h *AssessmentHandler) GetAssessment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Error(400, "无效的记录ID"))
		return
	}

	assessment, err := h.service.Repo.Assessment.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Error(404, "记录不存在"))
		return
	}

	c.JSON(http.StatusOK, response.Success(assessment))
}
