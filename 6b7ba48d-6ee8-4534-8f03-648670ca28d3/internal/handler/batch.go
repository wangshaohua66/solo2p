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

// ---------- Batch ----------
// CreateBatch godoc
// @Summary 创建酿造批次
// @Tags 批次管理
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.CreateBatchRequest true "批次信息"
// @Success 201 {object} util.Response{data=map[string]int64}
// @Router /api/v1/batches [post]
func (h *Handler) CreateBatch(c echo.Context) error {
	user := middleware.GetAuth(c)
	if user == nil {
		return util.FailUnauthorized(c, "未登录")
	}
	req := &dto.CreateBatchRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	id, err := h.svc.CreateBatch(req, user.UserID, user.RealName)
	if err != nil {
		if err == service.ErrRecipeNotFound {
			return util.FailNotFound(c, "配方不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": id})
}

// GetBatch godoc
// @Summary 查询批次详情
// @Tags 批次管理
// @Param Authorization header string true "Bearer token"
// @Param id path int true "批次ID"
// @Success 200 {object} util.Response{data=model.Batch}
// @Router /api/v1/batches/{id} [get]
func (h *Handler) GetBatch(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的批次ID")
	}
	batch, err := h.svc.Batches.GetByID(id)
	if err != nil {
		if repository.IsNoRows(err) {
			return util.FailNotFound(c, "批次不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, batch)
}

// ListBatches godoc
// @Summary 分页查询批次列表
// @Tags 批次管理
// @Param Authorization header string true "Bearer token"
// @Param status query string false "批次状态: active/frozen/completed/rejected"
// @Param page query int false "页码，默认1"
// @Param pageSize query int false "每页数量，默认20"
// @Success 200 {object} util.Response{data=util.PageResult{items=[]model.Batch}}
// @Router /api/v1/batches [get]
func (h *Handler) ListBatches(c echo.Context) error {
	status := model.BatchStatus(c.QueryParam("status"))
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Batches.List(status, page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// TransitionStage godoc
// @Summary 切换批次阶段（状态机流转）
// @Tags 批次管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param id path int true "批次ID"
// @Param request body dto.TransitionStageRequest true "目标阶段"
// @Success 200 {object} util.Response
// @Router /api/v1/batches/{id}/transition [post]
func (h *Handler) TransitionStage(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的批次ID")
	}
	req := &dto.TransitionStageRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	user := middleware.GetAuth(c)
	err := h.svc.TransitionStage(id, req.ToStage, user.UserID, req.Notes)
	if err != nil {
		switch err {
		case service.ErrBatchNotFound:
			return util.FailNotFound(c, "批次不存在")
		case service.ErrBatchFrozen:
			return util.FailConflict(c, "批次已冻结，无法流转")
		case service.ErrBatchNotActive:
			return util.FailConflict(c, "批次已结束，无法流转")
		case service.ErrInvalidTransition:
			return util.FailBadRequest(c, "阶段流转不合法")
		case service.ErrRequiredParamMissing:
			return util.FailValidation(c, err.Error())
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, nil)
}

// RecordParam godoc
// @Summary 录入阶段工艺参数
// @Tags 批次管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param id path int true "批次ID"
// @Param request body dto.RecordParamRequest true "参数信息"
// @Success 201 {object} util.Response{data=map[string]int64}
// @Router /api/v1/batches/{id}/params [post]
func (h *Handler) RecordParam(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的批次ID")
	}
	req := &dto.RecordParamRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	user := middleware.GetAuth(c)
	pid, err := h.svc.RecordParam(id, req, user.UserID)
	if err != nil {
		switch err {
		case service.ErrBatchNotFound:
			return util.FailNotFound(c, "批次不存在")
		case service.ErrBatchFrozen:
			return util.FailConflict(c, "批次已冻结")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": pid})
}

// ListStageParams godoc
// @Summary 查询批次某阶段的参数记录
// @Tags 批次管理
// @Param Authorization header string true "Bearer token"
// @Param id path int true "批次ID"
// @Param stage query string true "阶段: mashing/fermenting/aging/bottling"
// @Success 200 {object} util.Response{data=[]model.StageParam}
// @Router /api/v1/batches/{id}/params [get]
func (h *Handler) ListStageParams(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的批次ID")
	}
	stage := model.BatchStage(c.QueryParam("stage"))
	if stage == "" {
		params, err := h.svc.Batches.GetAllStageParams(id)
		if err != nil {
			return util.FailInternal(c, err.Error())
		}
		return util.Success(c, params)
	}
	params, err := h.svc.Batches.GetStageParams(id, stage)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, params)
}

// LinkBatchMaterials godoc
// @Summary 关联批次使用的原料批次并扣减库存
// @Tags 批次管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param id path int true "批次ID"
// @Param request body dto.LinkMaterialRequest true "原料列表"
// @Success 200 {object} util.Response
// @Router /api/v1/batches/{id}/materials [post]
func (h *Handler) LinkBatchMaterials(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的批次ID")
	}
	req := &dto.LinkMaterialRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	user := middleware.GetAuth(c)
	err := h.svc.LinkBatchMaterials(id, req, user.UserID, user.RealName)
	if err != nil {
		if err == service.ErrInsufficientStock {
			return util.FailConflict(c, "原料库存不足")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, nil)
}

// ListBatchMaterials godoc
// @Summary 查询批次关联的原料
// @Tags 批次管理
// @Param Authorization header string true "Bearer token"
// @Param id path int true "批次ID"
// @Success 200 {object} util.Response{data=[]model.BatchMaterial}
// @Router /api/v1/batches/{id}/materials [get]
func (h *Handler) ListBatchMaterials(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的批次ID")
	}
	list, err := h.svc.Batches.GetBatchMaterials(id)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, list)
}

// ---------- Recipe ----------
// CreateRecipe godoc
// @Summary 创建配方（自动生成新版本号）
// @Tags 配方管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.CreateRecipeRequest true "配方信息"
// @Success 201 {object} util.Response{data=map[string]int64}
// @Router /api/v1/recipes [post]
func (h *Handler) CreateRecipe(c echo.Context) error {
	user := middleware.GetAuth(c)
	req := &dto.CreateRecipeRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	id, err := h.svc.CreateRecipe(req, user.UserID)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": id})
}

// GetRecipe godoc
// @Summary 查询配方详情（含原料和参数）
// @Tags 配方管理
// @Param Authorization header string true "Bearer token"
// @Param id path int true "配方ID"
// @Success 200 {object} util.Response
// @Router /api/v1/recipes/{id} [get]
func (h *Handler) GetRecipe(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	if id == 0 {
		return util.FailBadRequest(c, "无效的配方ID")
	}
	recipe, err := h.svc.Recipes.GetByID(id)
	if err != nil {
		if repository.IsNoRows(err) {
			return util.FailNotFound(c, "配方不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	ings, _ := h.svc.Recipes.GetIngredients(id)
	params, _ := h.svc.Recipes.GetParams(id)
	return util.Success(c, map[string]interface{}{
		"recipe":      recipe,
		"ingredients": ings,
		"params":      params,
	})
}

// ListRecipes godoc
// @Summary 分页查询配方列表
// @Tags 配方管理
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/recipes [get]
func (h *Handler) ListRecipes(c echo.Context) error {
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Recipes.List(page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}
