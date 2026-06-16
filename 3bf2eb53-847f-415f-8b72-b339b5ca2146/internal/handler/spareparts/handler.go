package spareparts

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"offshore-wind-ops/internal/handler"
	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/model"
	sparesvc "offshore-wind-ops/internal/service/spareparts"
)

type Handler struct {
	spareSvc *sparesvc.Service
}

func NewHandler(spareSvc *sparesvc.Service) *Handler {
	return &Handler{
		spareSvc: spareSvc,
	}
}

func (h *Handler) RegisterRoutes(e *echo.Group, jwtSecret string) {
	g := e.Group("/spare-parts", middleware.JWTAuth(jwtSecret))

	g.GET("", h.ListParts)
	g.POST("", h.CreatePart, middleware.RequireRole(model.RoleOpsManager))
	g.GET("/:id", h.GetPart)
	g.PUT("/:id", h.UpdatePart, middleware.RequireRole(model.RoleOpsManager))

	warehouses := e.Group("/warehouses", middleware.JWTAuth(jwtSecret))
	warehouses.GET("", h.ListWarehouses)
	warehouses.POST("", h.CreateWarehouse, middleware.RequireRole(model.RoleOpsManager))

	inventory := e.Group("/inventory", middleware.JWTAuth(jwtSecret))
	inventory.GET("", h.GetInventory)
	inventory.POST("/stock-update", h.UpdateStock, middleware.RequireRole(model.RoleOpsManager))
	inventory.GET("/low-stock", h.GetLowStock)

	transfers := e.Group("/transfers", middleware.JWTAuth(jwtSecret))
	transfers.GET("", h.ListTransfers)
	transfers.POST("", h.CreateTransfer)
	transfers.GET("/:id", h.GetTransfer)
	transfers.PUT("/:id/approve", h.ApproveTransfer, middleware.RequireRole(model.RoleOpsManager))
	transfers.PUT("/:id/reject", h.RejectTransfer, middleware.RequireRole(model.RoleOpsManager))
	transfers.PUT("/:id/dispatch", h.DispatchTransfer)
	transfers.PUT("/:id/receive", h.ReceiveTransfer)
}

func (h *Handler) ListParts(c echo.Context) error {
	category := c.QueryParam("category")
	page := handler.QueryInt(c, "page", 1)
	pageSize := handler.QueryInt(c, "page_size", 20)

	parts, total, err := h.spareSvc.ListParts(c.Request().Context(), category, page, pageSize)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(model.PageResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     parts,
	}))
}

func (h *Handler) CreatePart(c echo.Context) error {
	var part model.SparePart
	if err := c.Bind(&part); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	result, err := h.spareSvc.CreatePart(c.Request().Context(), &part)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusCreated, model.Success(result))
}

func (h *Handler) GetPart(c echo.Context) error {
	id := c.Param("id")
	part, err := h.spareSvc.GetPart(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "part not found"))
	}
	return c.JSON(http.StatusOK, model.Success(part))
}

func (h *Handler) UpdatePart(c echo.Context) error {
	id := c.Param("id")
	var part model.SparePart
	if err := c.Bind(&part); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}
	part.ID = idToObjectID(id)

	if err := h.spareSvc.UpdatePart(c.Request().Context(), &part); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) ListWarehouses(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	warehouses, err := h.spareSvc.ListWarehouses(c.Request().Context(), windFarmID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(warehouses))
}

func (h *Handler) CreateWarehouse(c echo.Context) error {
	var wh model.Warehouse
	if err := c.Bind(&wh); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	result, err := h.spareSvc.CreateWarehouse(c.Request().Context(), &wh)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusCreated, model.Success(result))
}

func (h *Handler) GetInventory(c echo.Context) error {
	warehouseID := c.QueryParam("warehouse_id")
	page := handler.QueryInt(c, "page", 1)
	pageSize := handler.QueryInt(c, "page_size", 20)

	list, total, err := h.spareSvc.GetInventory(c.Request().Context(), warehouseID, page, pageSize)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(model.PageResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     list,
	}))
}

func (h *Handler) UpdateStock(c echo.Context) error {
	var req struct {
		PartID      string `json:"part_id" validate:"required"`
		WarehouseID string `json:"warehouse_id" validate:"required"`
		Quantity    int    `json:"quantity" validate:"required"`
		Note        string `json:"note"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.spareSvc.UpdateStock(c.Request().Context(), req.PartID, req.WarehouseID, req.Quantity, req.Note); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) GetLowStock(c echo.Context) error {
	warehouseID := c.QueryParam("warehouse_id")
	items, err := h.spareSvc.CheckLowStock(c.Request().Context(), warehouseID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(items))
}

func (h *Handler) ListTransfers(c echo.Context) error {
	status := c.QueryParam("status")
	warehouseID := c.QueryParam("warehouse_id")
	page := handler.QueryInt(c, "page", 1)
	pageSize := handler.QueryInt(c, "page_size", 20)

	list, total, err := h.spareSvc.ListTransfers(c.Request().Context(), status, warehouseID, page, pageSize)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(model.PageResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     list,
	}))
}

func (h *Handler) CreateTransfer(c echo.Context) error {
	var req model.TransferCreateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	applicantID := middleware.GetUserID(c)
	transfer, err := h.spareSvc.CreateTransfer(c.Request().Context(), &req, applicantID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusCreated, model.Success(transfer))
}

func (h *Handler) GetTransfer(c echo.Context) error {
	id := c.Param("id")
	transfer, err := h.spareSvc.GetTransfer(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "transfer not found"))
	}
	return c.JSON(http.StatusOK, model.Success(transfer))
}

func (h *Handler) ApproveTransfer(c echo.Context) error {
	id := c.Param("id")
	approverID := middleware.GetUserID(c)

	if err := h.spareSvc.ApproveTransfer(c.Request().Context(), id, approverID); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) RejectTransfer(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason" validate:"required"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	approverID := middleware.GetUserID(c)
	if err := h.spareSvc.RejectTransfer(c.Request().Context(), id, approverID, req.Reason); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) DispatchTransfer(c echo.Context) error {
	id := c.Param("id")
	if err := h.spareSvc.DispatchTransfer(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) ReceiveTransfer(c echo.Context) error {
	id := c.Param("id")
	if err := h.spareSvc.ReceiveTransfer(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func idToObjectID(id string) primitive.ObjectID {
	oid, _ := primitive.ObjectIDFromHex(id)
	return oid
}
