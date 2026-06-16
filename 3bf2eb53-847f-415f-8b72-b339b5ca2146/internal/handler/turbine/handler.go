package turbine

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"offshore-wind-ops/internal/handler"
	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/model"
	healthsvc "offshore-wind-ops/internal/service/health"
	"offshore-wind-ops/internal/service/workorder"
)

type Handler struct {
	healthSvc    *healthsvc.Service
	workOrderSvc *workorder.Service
}

func NewHandler(healthSvc *healthsvc.Service, workOrderSvc *workorder.Service) *Handler {
	return &Handler{
		healthSvc:    healthSvc,
		workOrderSvc: workOrderSvc,
	}
}

func (h *Handler) RegisterRoutes(e *echo.Group, jwtSecret string) {
	g := e.Group("/turbines", middleware.JWTAuth(jwtSecret))

	g.GET("", h.ListTurbines)
	g.GET("/:id", h.GetTurbine)
	g.GET("/:id/health", h.GetHealthScore)
	g.POST("/:id/health/calculate", h.CalculateHealth)
	g.GET("/:id/scada", h.GetSCADAData)
	g.POST("/scada/batch", h.BatchSCADAData)
	g.GET("/:id/health-history", h.GetHealthHistory)
	g.GET("/:id/work-orders", h.GetTurbineWorkOrders)

	config := g.Group("/health-configs")
	config.GET("", h.ListHealthConfigs)
	config.GET("/:model", h.GetHealthConfig)
	config.PUT("/:model", h.UpdateHealthConfig, middleware.RequireRole(model.RoleOpsManager))

	wo := g.Group("/work-orders")
	wo.GET("", h.ListWorkOrders)
	wo.POST("", h.CreateWorkOrder)
	wo.GET("/:id", h.GetWorkOrder)
	wo.PUT("/:id/status", h.UpdateWorkOrderStatus)
	wo.POST("/:id/inspection-report", h.SubmitInspectionReport)

	overview := e.Group("/overview", middleware.JWTAuth(jwtSecret))
	overview.GET("/health", h.GetHealthOverview)
}

func (h *Handler) ListTurbines(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	status := c.QueryParam("status")
	page := handler.QueryInt(c, "page", 1)
	pageSize := handler.QueryInt(c, "page_size", 20)

	filter := map[string]interface{}{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}
	if status != "" {
		filter["status"] = status
	}

	turbines, total, err := h.healthSvc.ListTurbines(c.Request().Context(), filter, page, pageSize)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(model.PageResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     turbines,
	}))
}

func (h *Handler) GetTurbine(c echo.Context) error {
	id := c.Param("id")
	turbine, err := h.healthSvc.GetTurbine(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "turbine not found"))
	}
	return c.JSON(http.StatusOK, model.Success(turbine))
}

func (h *Handler) GetHealthScore(c echo.Context) error {
	id := c.Param("id")
	turbine, err := h.healthSvc.GetTurbine(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "turbine not found"))
	}

	records, err := h.healthSvc.GetRecentHealthRecords(c.Request().Context(), id, 10)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	result := map[string]interface{}{
		"turbine": turbine,
		"records": records,
	}
	return c.JSON(http.StatusOK, model.Success(result))
}

func (h *Handler) CalculateHealth(c echo.Context) error {
	id := c.Param("id")
	record, err := h.healthSvc.CalculateHealthScore(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(record))
}

func (h *Handler) GetSCADAData(c echo.Context) error {
	id := c.Param("id")
	limit := handler.QueryInt(c, "limit", 100)
	if limit > 1000 {
		limit = 1000
	}

	data, err := h.healthSvc.GetLatestSCADA(c.Request().Context(), id, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(data))
}

func (h *Handler) BatchSCADAData(c echo.Context) error {
	var data []model.SCADAData
	if err := c.Bind(&data); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if len(data) == 0 {
		return c.JSON(http.StatusBadRequest, model.Error(400, "empty data"))
	}

	if len(data) > 2000 {
		return c.JSON(http.StatusBadRequest, model.Error(400, "batch size exceeds 2000"))
	}

	if err := h.healthSvc.InsertSCADABatch(c.Request().Context(), data); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(map[string]int{"inserted": len(data)}))
}

func (h *Handler) GetHealthHistory(c echo.Context) error {
	id := c.Param("id")
	startStr := c.QueryParam("start_time")
	endStr := c.QueryParam("end_time")

	var startTime, endTime time.Time
	var err error

	if startStr != "" {
		startTime, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.Error(400, "invalid start_time"))
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -7)
	}

	if endStr != "" {
		endTime, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.Error(400, "invalid end_time"))
		}
	} else {
		endTime = time.Now()
	}

	records, err := h.healthSvc.GetHealthHistory(c.Request().Context(), id, startTime, endTime)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(records))
}

func (h *Handler) GetTurbineWorkOrders(c echo.Context) error {
	id := c.Param("id")
	status := c.QueryParam("status")
	limit := handler.QueryInt(c, "limit", 20)

	list, err := h.workOrderSvc.GetWorkOrdersByTurbine(c.Request().Context(), id, status, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(list))
}

func (h *Handler) ListWorkOrders(c echo.Context) error {
	req := &model.WorkOrderListRequest{
		WindFarmID: c.QueryParam("wind_farm_id"),
		Status:     model.WorkOrderStatus(c.QueryParam("status")),
		Type:       model.WorkOrderType(c.QueryParam("type")),
		Priority:   c.QueryParam("priority"),
		Page:       handler.QueryInt(c, "page", 1),
		PageSize:   handler.QueryInt(c, "page_size", 20),
	}

	list, total, err := h.workOrderSvc.ListWorkOrders(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(model.PageResult{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		List:     list,
	}))
}

func (h *Handler) CreateWorkOrder(c echo.Context) error {
	var req model.WorkOrderCreateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	userID := middleware.GetUserID(c)
	wo, err := h.workOrderSvc.CreateWorkOrder(c.Request().Context(), &req, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusCreated, model.Success(wo))
}

func (h *Handler) GetWorkOrder(c echo.Context) error {
	id := c.Param("id")
	wo, err := h.workOrderSvc.GetWorkOrder(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "work order not found"))
	}
	return c.JSON(http.StatusOK, model.Success(wo))
}

func (h *Handler) UpdateWorkOrderStatus(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Status model.WorkOrderStatus `json:"status" validate:"required"`
		Note   string                `json:"note"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	userID := middleware.GetUserID(c)
	if err := h.workOrderSvc.UpdateWorkOrderStatus(c.Request().Context(), id, req.Status, req.Note); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	_ = userID
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) SubmitInspectionReport(c echo.Context) error {
	id := c.Param("id")
	var report model.InspectionReport
	if err := c.Bind(&report); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	userID := middleware.GetUserID(c)
	if err := h.workOrderSvc.SubmitInspectionReport(c.Request().Context(), id, userID, &report); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) ListHealthConfigs(c echo.Context) error {
	configs, err := h.healthSvc.ListHealthConfigs(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(configs))
}

func (h *Handler) GetHealthConfig(c echo.Context) error {
	modelName := c.Param("model")
	config, err := h.healthSvc.GetHealthConfig(c.Request().Context(), model.TurbineModel(modelName))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(config))
}

func (h *Handler) UpdateHealthConfig(c echo.Context) error {
	modelName := c.Param("model")
	var config model.HealthScoreConfig
	if err := c.Bind(&config); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}
	config.TurbineModel = model.TurbineModel(modelName)

	userID := middleware.GetUserID(c)
	if err := h.healthSvc.UpdateHealthConfig(c.Request().Context(), &config, userID); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) GetHealthOverview(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	overviews, err := h.healthSvc.GetHealthOverview(c.Request().Context(), windFarmID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(overviews))
}
