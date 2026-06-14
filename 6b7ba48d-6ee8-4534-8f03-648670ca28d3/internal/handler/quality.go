package handler

import (
	"craftbrew-tracker/internal/dto"
	"craftbrew-tracker/internal/middleware"
	"craftbrew-tracker/internal/model"
	"craftbrew-tracker/internal/service"
	"craftbrew-tracker/internal/util"
	"craftbrew-tracker/internal/repository"

	"github.com/labstack/echo/v4"
)

// ---------- Quality Items ----------
// CreateQualityItem godoc
// @Summary 创建检测项目
// @Tags 质检测试
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.CreateQualityItemRequest true "检测项目信息"
// @Success 201 {object} util.Response{data=map[string]int64}
// @Router /api/v1/quality/items [post]
func (h *Handler) CreateQualityItem(c echo.Context) error {
	user := middleware.GetAuth(c)
	req := &dto.CreateQualityItemRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	qi := &model.QualityItem{
		Code: req.Code, Name: req.Name, Category: req.Category, Method: req.Method,
		MinValue: util.Float64Ptr(req.MinValue), MaxValue: util.Float64Ptr(req.MaxValue),
		TargetValue: util.Float64Ptr(req.TargetValue), Unit: req.Unit,
		Required: req.Required, ApplicableStages: req.ApplicableStages,
		CreatedBy: user.UserID, Active: true,
	}
	id, err := h.svc.Quality.CreateItem(qi)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": id})
}

// GetQualityItem godoc
// @Summary 查询检测项目
// @Tags 质检测试
// @Param Authorization header string true "Bearer token"
// @Param id path int true "检测项目ID"
// @Success 200 {object} util.Response{data=model.QualityItem}
// @Router /api/v1/quality/items/{id} [get]
func (h *Handler) GetQualityItem(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	qi, err := h.svc.Quality.GetItem(id)
	if err != nil {
		if repository.IsNoRows(err) {
			return util.FailNotFound(c, "检测项目不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, qi)
}

// ListQualityItems godoc
// @Summary 分页查询检测项目
// @Tags 质检测试
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/quality/items [get]
func (h *Handler) ListQualityItems(c echo.Context) error {
	active := c.QueryParam("active") != "false"
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Quality.ListItems(active, page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// ---------- Quality Samples ----------
// SubmitSample godoc
// @Summary 提交质检样本
// @Tags 质检测试
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.SubmitSampleRequest true "样本信息及检测结果"
// @Success 201 {object} util.Response{data=map[string]int64}
// @Router /api/v1/quality/samples [post]
func (h *Handler) SubmitSample(c echo.Context) error {
	user := middleware.GetAuth(c)
	req := &dto.SubmitSampleRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	id, err := h.svc.SubmitSample(req, user.UserID, user.RealName)
	if err != nil {
		switch err {
		case service.ErrBatchNotFound:
			return util.FailNotFound(c, "批次不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": id})
}

// GetSample godoc
// @Summary 查询质检样本详情（含结果）
// @Tags 质检测试
// @Param Authorization header string true "Bearer token"
// @Param id path int true "样本ID"
// @Success 200 {object} util.Response
// @Router /api/v1/quality/samples/{id} [get]
func (h *Handler) GetSample(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	sample, err := h.svc.Quality.GetSample(id)
	if err != nil {
		if repository.IsNoRows(err) {
			return util.FailNotFound(c, "样本不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	results, _ := h.svc.Quality.GetSampleResults(id)
	return util.Success(c, map[string]interface{}{
		"sample":  sample,
		"results": results,
	})
}

// ListSamples godoc
// @Summary 分页查询质检样本
// @Tags 质检测试
// @Param Authorization header string true "Bearer token"
// @Param batchId query int false "批次ID"
// @Param status query string false "样本状态"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/quality/samples [get]
func (h *Handler) ListSamples(c echo.Context) error {
	batchID := parseInt64(c.QueryParam("batchId"), 0)
	status := model.QualityStatus(c.QueryParam("status"))
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Quality.ListSamples(batchID, status, page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// ReviewSample godoc
// @Summary 审核质检样本（合格判定/冻结/复检）
// @Tags 质检测试
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param id path int true "样本ID"
// @Param request body dto.ReviewSampleRequest true "审核结论"
// @Success 200 {object} util.Response
// @Router /api/v1/quality/samples/{id}/review [post]
func (h *Handler) ReviewSample(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的样本ID")
	}
	req := &dto.ReviewSampleRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	user := middleware.GetAuth(c)
	err := h.svc.ReviewSample(id, req, user.UserID)
	if err != nil {
		switch err {
		case service.ErrSampleNotFound:
			return util.FailNotFound(c, "样本不存在")
		case service.ErrSampleAlreadyReviewed:
			return util.FailConflict(c, "样本已审核")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, nil)
}
