package personnel

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"offshore-wind-ops/internal/handler"
	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/model"
	personnelsvc "offshore-wind-ops/internal/service/personnel"
)

type Handler struct {
	personnelSvc *personnelsvc.Service
}

func NewHandler(personnelSvc *personnelsvc.Service) *Handler {
	return &Handler{
		personnelSvc: personnelSvc,
	}
}

func (h *Handler) RegisterRoutes(e *echo.Group, jwtSecret string) {
	g := e.Group("/personnel", middleware.JWTAuth(jwtSecret))

	g.GET("", h.ListPersonnel)
	g.POST("", h.CreatePersonnel, middleware.RequireRole(model.RoleAdmin, model.RoleSafetyOfficer))
	g.GET("/:id", h.GetPersonnel)
	g.PUT("/:id", h.UpdatePersonnel, middleware.RequireRole(model.RoleAdmin, model.RoleSafetyOfficer))

	certs := g.Group("/:id/certificates")
	certs.POST("", h.AddCertificate, middleware.RequireRole(model.RoleSafetyOfficer))
	certs.PUT("/:cert_id", h.UpdateCertificate, middleware.RequireRole(model.RoleSafetyOfficer))

	certAlerts := e.Group("/cert-alerts", middleware.JWTAuth(jwtSecret))
	certAlerts.GET("", h.ListCertAlerts)

	evac := e.Group("/evacuations", middleware.JWTAuth(jwtSecret))
	evac.GET("", h.ListEvacuations)
	evac.POST("", h.CreateEvacuation, middleware.RequireRole(model.RoleSafetyOfficer))
	evac.GET("/:id", h.GetEvacuation)
	evac.POST("/:id/acknowledge", h.AcknowledgeEvacuation)
	evac.POST("/:id/arrived", h.MarkArrived)
	evac.POST("/:id/complete", h.CompleteEvacuation, middleware.RequireRole(model.RoleSafetyOfficer))
}

func (h *Handler) ListPersonnel(c echo.Context) error {
	req := &model.PersonnelListRequest{
		Department:   c.QueryParam("department"),
		Status:       model.PersonnelStatus(c.QueryParam("status")),
		CertType:     model.CertificateType(c.QueryParam("cert_type")),
		ExpiringSoon: c.QueryParam("expiring_soon") == "true",
		Page:         handler.QueryInt(c, "page", 1),
		PageSize:     handler.QueryInt(c, "page_size", 20),
	}

	list, total, err := h.personnelSvc.ListPersonnel(c.Request().Context(), req)
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

func (h *Handler) CreatePersonnel(c echo.Context) error {
	var p model.Personnel
	if err := c.Bind(&p); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	result, err := h.personnelSvc.CreatePersonnel(c.Request().Context(), &p)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusCreated, model.Success(result))
}

func (h *Handler) GetPersonnel(c echo.Context) error {
	id := c.Param("id")
	p, err := h.personnelSvc.GetPersonnel(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "personnel not found"))
	}
	return c.JSON(http.StatusOK, model.Success(p))
}

func (h *Handler) UpdatePersonnel(c echo.Context) error {
	id := c.Param("id")
	var p model.Personnel
	if err := c.Bind(&p); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}
	p.ID = idToObjectID(id)

	if err := h.personnelSvc.UpdatePersonnel(c.Request().Context(), &p); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) AddCertificate(c echo.Context) error {
	id := c.Param("id")
	var cert model.Certificate
	if err := c.Bind(&cert); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.personnelSvc.AddCertificate(c.Request().Context(), id, cert); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) UpdateCertificate(c echo.Context) error {
	id := c.Param("id")
	certID := c.Param("cert_id")
	var cert model.Certificate
	if err := c.Bind(&cert); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.personnelSvc.UpdateCertificate(c.Request().Context(), id, certID, cert); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) ListCertAlerts(c echo.Context) error {
	status := c.QueryParam("status")
	page := handler.QueryInt(c, "page", 1)
	pageSize := handler.QueryInt(c, "page_size", 20)

	list, total, err := h.personnelSvc.ListCertAlerts(c.Request().Context(), status, page, pageSize)
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

func (h *Handler) ListEvacuations(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	page := handler.QueryInt(c, "page", 1)
	pageSize := handler.QueryInt(c, "page_size", 20)

	list, total, err := h.personnelSvc.ListEvacuations(c.Request().Context(), windFarmID, page, pageSize)
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

func (h *Handler) CreateEvacuation(c echo.Context) error {
	var req model.EvacuationCreateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	triggeredBy := middleware.GetUserID(c)
	evac, err := h.personnelSvc.CreateEvacuation(c.Request().Context(), &req, triggeredBy)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusCreated, model.Success(evac))
}

func (h *Handler) GetEvacuation(c echo.Context) error {
	id := c.Param("id")
	evac, err := h.personnelSvc.GetEvacuation(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "evacuation not found"))
	}
	return c.JSON(http.StatusOK, model.Success(evac))
}

func (h *Handler) AcknowledgeEvacuation(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		PersonnelID string `json:"personnel_id" validate:"required"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.personnelSvc.AcknowledgeEvacuation(c.Request().Context(), id, req.PersonnelID); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) MarkArrived(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		PersonnelID string `json:"personnel_id" validate:"required"`
		Notes       string `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.personnelSvc.MarkArrived(c.Request().Context(), id, req.PersonnelID, req.Notes); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) CompleteEvacuation(c echo.Context) error {
	id := c.Param("id")
	if err := h.personnelSvc.CompleteEvacuation(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func idToObjectID(id string) primitive.ObjectID {
	oid, _ := primitive.ObjectIDFromHex(id)
	return oid
}
