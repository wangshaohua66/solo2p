package alert

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"offshore-wind-ops/internal/handler"
	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/model"
	reportsvc "offshore-wind-ops/internal/service/report"
	"offshore-wind-ops/internal/repository"
)

type Handler struct {
	alertRepo  *repository.AlertRepository
	reportSvc  *reportsvc.Service
}

func NewHandler(alertRepo *repository.AlertRepository, reportSvc *reportsvc.Service) *Handler {
	return &Handler{
		alertRepo: alertRepo,
		reportSvc: reportSvc,
	}
}

func (h *Handler) RegisterRoutes(e *echo.Group, jwtSecret string) {
	g := e.Group("/alerts", middleware.JWTAuth(jwtSecret))

	g.GET("", h.ListAlerts)
	g.GET("/:id", h.GetAlert)
	g.PUT("/:id/acknowledge", h.AcknowledgeAlert)
	g.PUT("/:id/resolve", h.ResolveAlert)
	g.PUT("/:id/assign", h.AssignAlert)
	g.GET("/stats/summary", h.GetAlertStats)

	report := e.Group("/reports", middleware.JWTAuth(jwtSecret))
	report.GET("/mtbf", h.GetMTBFReport)
	report.GET("/mttr", h.GetMTTRReport)
	report.GET("/dashboard", h.GetDashboardSummary)
	report.GET("/health-trend", h.GetHealthTrend)
	report.GET("/turbine-ranking", h.GetTurbineRanking)
}

func (h *Handler) ListAlerts(c echo.Context) error {
	req := &model.AlertListRequest{
		Type:       model.AlertType(c.QueryParam("type")),
		Severity:   model.AlertSeverity(c.QueryParam("severity")),
		Status:     model.AlertStatus(c.QueryParam("status")),
		WindFarmID: c.QueryParam("wind_farm_id"),
		Page:       handler.QueryInt(c, "page", 1),
		PageSize:   handler.QueryInt(c, "page_size", 20),
	}

	startStr := c.QueryParam("start_time")
	endStr := c.QueryParam("end_time")
	if startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			req.StartTime = &t
		}
	}
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			req.EndTime = &t
		}
	}

	filter := map[string]interface{}{}
	if req.Type != "" {
		filter["type"] = req.Type
	}
	if req.Severity != "" {
		filter["severity"] = req.Severity
	}
	if req.Status != "" {
		filter["status"] = req.Status
	}
	if req.WindFarmID != "" {
		filter["wind_farm_id"] = req.WindFarmID
	}

	list, total, err := h.alertRepo.List(c.Request().Context(), filter, req.Page, req.PageSize)
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

func (h *Handler) GetAlert(c echo.Context) error {
	id := c.Param("id")
	alert, err := h.alertRepo.GetByID(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "alert not found"))
	}
	return c.JSON(http.StatusOK, model.Success(alert))
}

func (h *Handler) AcknowledgeAlert(c echo.Context) error {
	id := c.Param("id")
	userID := middleware.GetUserID(c)

	if err := h.alertRepo.Acknowledge(c.Request().Context(), id, userID); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) ResolveAlert(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Resolution string `json:"resolution"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	userID := middleware.GetUserID(c)
	if err := h.alertRepo.Resolve(c.Request().Context(), id, userID, req.Resolution); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) AssignAlert(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		AssignedTo string `json:"assigned_to" validate:"required"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.alertRepo.Assign(c.Request().Context(), id, req.AssignedTo); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) GetAlertStats(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	filter := map[string]interface{}{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}

	stats, err := h.alertRepo.CountByStatus(c.Request().Context(), filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(stats))
}

func (h *Handler) GetMTBFReport(c echo.Context) error {
	req := &model.ReportRequest{
		WindFarmID:   c.QueryParam("wind_farm_id"),
		TurbineModel: c.QueryParam("turbine_model"),
		FaultType:    c.QueryParam("fault_type"),
		GroupBy:      c.QueryParam("group_by"),
	}

	startStr := c.QueryParam("start_time")
	endStr := c.QueryParam("end_time")
	if startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			req.StartTime = &t
		}
	}
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			req.EndTime = &t
		}
	}

	report, err := h.reportSvc.GetMTBFReport(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(report))
}

func (h *Handler) GetMTTRReport(c echo.Context) error {
	req := &model.ReportRequest{
		WindFarmID:   c.QueryParam("wind_farm_id"),
		TurbineModel: c.QueryParam("turbine_model"),
		FaultType:    c.QueryParam("fault_type"),
		GroupBy:      c.QueryParam("group_by"),
	}

	startStr := c.QueryParam("start_time")
	endStr := c.QueryParam("end_time")
	if startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			req.StartTime = &t
		}
	}
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			req.EndTime = &t
		}
	}

	report, err := h.reportSvc.GetMTTRReport(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(report))
}

func (h *Handler) GetDashboardSummary(c echo.Context) error {
	summary, err := h.reportSvc.GetDashboardSummary(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(summary))
}

func (h *Handler) GetHealthTrend(c echo.Context) error {
	turbineID := c.QueryParam("turbine_id")
	days := handler.QueryInt(c, "days", 30)

	if turbineID == "" {
		return c.JSON(http.StatusBadRequest, model.Error(400, "turbine_id is required"))
	}

	trend, err := h.reportSvc.GetHealthTrend(c.Request().Context(), turbineID, days)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(trend))
}

func (h *Handler) GetTurbineRanking(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	limit := handler.QueryInt(c, "limit", 10)

	turbines, err := h.reportSvc.GetTurbineHealthRanking(c.Request().Context(), windFarmID, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(turbines))
}
