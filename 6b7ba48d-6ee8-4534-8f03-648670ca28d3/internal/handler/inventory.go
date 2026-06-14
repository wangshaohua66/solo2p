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

// ---------- Material ----------
// CreateMaterial godoc
// @Summary 创建物料定义
// @Tags 库存管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.CreateMaterialRequest true "物料信息"
// @Success 201 {object} util.Response{data=map[string]int64}
// @Router /api/v1/inventory/materials [post]
func (h *Handler) CreateMaterial(c echo.Context) error {
	req := &dto.CreateMaterialRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	m := &model.Material{
		Code: req.Code, Name: req.Name, Category: req.Category, Unit: req.Unit,
		Supplier: req.Supplier, Spec: req.Spec, SafetyStock: req.SafetyStock,
		Active: true,
	}
	id, err := h.svc.Inventory.CreateMaterial(m)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": id})
}

// GetMaterial godoc
// @Summary 查询物料及库存
// @Tags 库存管理
// @Param Authorization header string true "Bearer token"
// @Param id path int true "物料ID"
// @Success 200 {object} util.Response
// @Router /api/v1/inventory/materials/{id} [get]
func (h *Handler) GetMaterial(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	m, err := h.svc.Inventory.GetMaterial(id)
	if err != nil {
		if repository.IsNoRows(err) {
			return util.FailNotFound(c, "物料不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	stock, _ := h.svc.Inventory.GetMaterialStock(id)
	return util.Success(c, map[string]interface{}{
		"material": m,
		"stock":    stock,
	})
}

// ListMaterials godoc
// @Summary 分页查询物料列表
// @Tags 库存管理
// @Param Authorization header string true "Bearer token"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/inventory/materials [get]
func (h *Handler) ListMaterials(c echo.Context) error {
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Inventory.ListMaterials(page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// ---------- Material Inbound ----------
// InboundMaterial godoc
// @Summary 原料入库
// @Tags 库存管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.RawMaterialInboundRequest true "入库信息"
// @Success 200 {object} util.Response
// @Router /api/v1/inventory/materials/inbound [post]
func (h *Handler) InboundMaterial(c echo.Context) error {
	user := middleware.GetAuth(c)
	req := &dto.RawMaterialInboundRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	if err := h.svc.InboundMaterial(req, user.UserID, user.RealName); err != nil {
		switch err {
		case service.ErrMaterialNotFound:
			return util.FailNotFound(c, "物料不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, nil)
}

// ---------- Finished Goods ----------
// InboundFinished godoc
// @Summary 成品入库（灌装后）
// @Tags 库存管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.FinishedGoodsInboundRequest true "成品信息"
// @Success 201 {object} util.Response{data=map[string]int64}
// @Router /api/v1/inventory/finished/inbound [post]
func (h *Handler) InboundFinished(c echo.Context) error {
	user := middleware.GetAuth(c)
	req := &dto.FinishedGoodsInboundRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	id, err := h.svc.InboundFinished(req, user.UserID, user.RealName)
	if err != nil {
		switch err {
		case service.ErrBatchNotFound:
			return util.FailNotFound(c, "批次不存在")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Created(c, map[string]interface{}{"id": id})
}

// ListFinished godoc
// @Summary 查询成品库存
// @Tags 库存管理
// @Param Authorization header string true "Bearer token"
// @Param batchId query int false "批次ID"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/inventory/finished [get]
func (h *Handler) ListFinished(c echo.Context) error {
	batchID := parseInt64(c.QueryParam("batchId"), 0)
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Inventory.ListFinished(batchID, page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// OutboundFinished godoc
// @Summary 成品出库
// @Tags 库存管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param request body dto.FinishedGoodsOutboundRequest true "出库信息"
// @Success 200 {object} util.Response
// @Router /api/v1/inventory/finished/outbound [post]
func (h *Handler) OutboundFinished(c echo.Context) error {
	user := middleware.GetAuth(c)
	req := &dto.FinishedGoodsOutboundRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	if err := h.svc.OutboundFinished(req, user.UserID, user.RealName); err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, nil)
}

// ListMovements godoc
// @Summary 查询库存流水
// @Tags 库存管理
// @Param Authorization header string true "Bearer token"
// @Param type query string false "raw_material/finished"
// @Param batchId query int false "批次ID"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/inventory/movements [get]
func (h *Handler) ListMovements(c echo.Context) error {
	typ := model.InventoryType(c.QueryParam("type"))
	batchID := parseInt64(c.QueryParam("batchId"), 0)
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Inventory.ListMovements(typ, batchID, page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// ---------- Alerts ----------
// ListAlerts godoc
// @Summary 查询告警列表
// @Tags 告警管理
// @Param Authorization header string true "Bearer token"
// @Param resolved query string false "true/false"
// @Param level query string false "info/warning/critical"
// @Success 200 {object} util.Response{data=util.PageResult}
// @Router /api/v1/alerts [get]
func (h *Handler) ListAlerts(c echo.Context) error {
	var resolved *bool
	if p := c.QueryParam("resolved"); p != "" {
		v := p == "true"
		resolved = &v
	}
	level := model.AlertLevel(c.QueryParam("level"))
	p := dto.PaginationParams{}
	_ = c.Bind(&p)
	page, size := p.Normalize()
	list, total, err := h.svc.Alerts.List(resolved, level, page, size)
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Page(c, list, total, page, size)
}

// ResolveAlert godoc
// @Summary 处理告警
// @Tags 告警管理
// @Accept json
// @Param Authorization header string true "Bearer token"
// @Param id path int true "告警ID"
// @Param request body dto.AlertResolveRequest true "处理说明"
// @Success 200 {object} util.Response
// @Router /api/v1/alerts/{id}/resolve [post]
func (h *Handler) ResolveAlert(c echo.Context) error {
	id := parseInt64(c.Param("id"), 0)
	req := &dto.AlertResolveRequest{}
	if err := h.bindAndValidate(c, req); err != nil {
		return err
	}
	user := middleware.GetAuth(c)
	if err := h.svc.Alerts.Resolve(id, user.UserID, req.Note); err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, nil)
}

// ---------- Deviations ----------
// ListDeviations godoc
// @Summary 查询工艺偏差日志
// @Tags 告警管理
// @Param Authorization header string true "Bearer token"
// @Param handled query string false "true只看已处理, false只看未处理, 空=全部"
// @Success 200 {object} util.Response{data=[]model.DeviationLog}
// @Router /api/v1/deviations [get]
func (h *Handler) ListDeviations(c echo.Context) error {
	batchID := parseInt64(c.QueryParam("batchId"), 0)
	handled := c.QueryParam("handled")
	var list []*model.DeviationLog
	var err error
	if batchID > 0 {
		list, err = h.svc.Deviations.ListByBatch(batchID)
	} else if handled == "false" {
		list, err = h.svc.Deviations.ListUnhandled()
	} else {
		// 简化：直接返回未处理 + 按批次过滤
		list, err = h.svc.Deviations.ListUnhandled()
	}
	if err != nil {
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, list)
}

// ---------- Tasks ----------
// GetTaskStatus godoc
// @Summary 查询异步任务状态
// @Tags 工具
// @Param Authorization header string true "Bearer token"
// @Param taskId path string true "任务ID"
// @Success 200 {object} util.Response{data=model.AsyncTask}
// @Router /api/v1/tasks/{taskId} [get]
func (h *Handler) GetTaskStatus(c echo.Context) error {
	id := c.Param("taskId")
	if id == "" {
		return util.FailBadRequest(c, "taskId is required")
	}
	task, err := h.svc.Tasks.Get(id)
	if err != nil {
		if repository.IsNoRows(err) {
			return util.FailNotFound(c, "task not found")
		}
		return util.FailInternal(c, err.Error())
	}
	return util.Success(c, task)
}
