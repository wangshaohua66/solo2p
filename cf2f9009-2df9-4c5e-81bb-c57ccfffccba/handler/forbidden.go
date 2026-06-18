package handler

import (
	"strconv"
	"time"

	"fishery-api/model"
	"fishery-api/service"

	"github.com/labstack/echo/v4"
)

type ForbiddenHandler struct {
	forbiddenService *service.ForbiddenService
}

func NewForbiddenHandler() *ForbiddenHandler {
	return &ForbiddenHandler{
		forbiddenService: service.NewForbiddenService(),
	}
}

func (h *ForbiddenHandler) CreateZone(c echo.Context) error {
	ctx := c.Request().Context()

	var zone model.ForbiddenZone
	if err := c.Bind(&zone); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if zone.Name == "" {
		return badRequestResponse(c, "name is required")
	}

	if err := h.forbiddenService.CreateZone(ctx, &zone); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, zone)
}

func (h *ForbiddenHandler) ListZones(c echo.Context) error {
	ctx := c.Request().Context()

	zoneType := c.QueryParam("zone_type")
	status := c.QueryParam("status")

	zones, err := h.forbiddenService.ListZones(ctx, zoneType, status)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, zones)
}

func (h *ForbiddenHandler) GetActiveZones(c echo.Context) error {
	ctx := c.Request().Context()

	zones, err := h.forbiddenService.GetActiveZones(ctx)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, zones)
}

func (h *ForbiddenHandler) UpdateZone(c echo.Context) error {
	ctx := c.Request().Context()
	zoneID := c.Param("id")

	var zone model.ForbiddenZone
	if err := c.Bind(&zone); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if err := h.forbiddenService.UpdateZone(ctx, zoneID, &zone); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, nil)
}

func (h *ForbiddenHandler) CheckForbiddenZone(c echo.Context) error {
	ctx := c.Request().Context()

	var req struct {
		VesselID  string  `json:"vessel_id"`
		VesselNo  string  `json:"vessel_no"`
		Longitude float64 `json:"longitude"`
		Latitude  float64 `json:"latitude"`
		CheckTime string  `json:"check_time"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.VesselID == "" {
		return badRequestResponse(c, "vessel_id is required")
	}

	checkTime := time.Now()
	if req.CheckTime != "" {
		if t, err := time.Parse(time.RFC3339, req.CheckTime); err == nil {
			checkTime = t
		}
	}

	location := model.NewPoint(req.Longitude, req.Latitude)

	violation, err := h.forbiddenService.CheckForbiddenZone(ctx, req.VesselID, req.VesselNo, location, checkTime)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := map[string]interface{}{
		"in_forbidden_zone": violation != nil,
		"violation":         violation,
	}

	return successResponse(c, result)
}

func (h *ForbiddenHandler) ListViolations(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	status := c.QueryParam("status")
	handledStr := c.QueryParam("handled")
	pageStr := c.QueryParam("page")
	pageSizeStr := c.QueryParam("page_size")

	page := int64(1)
	pageSize := int64(20)
	if pageStr != "" {
		if p, err := strconv.ParseInt(pageStr, 10, 64); err == nil && p > 0 {
			page = p
		}
	}
	if pageSizeStr != "" {
		if ps, err := strconv.ParseInt(pageSizeStr, 10, 64); err == nil && ps > 0 {
			pageSize = ps
		}
	}

	var handled *bool
	if handledStr != "" {
		h := handledStr == "true"
		handled = &h
	}

	violations, total, err := h.forbiddenService.ListViolations(ctx, vesselID, status, handled, page, pageSize)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := model.PaginationResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     violations,
	}

	return successResponse(c, result)
}

func (h *ForbiddenHandler) HandleViolation(c echo.Context) error {
	ctx := c.Request().Context()
	violationID := c.Param("id")

	var req struct {
		HandledBy  string  `json:"handled_by"`
		FineAmount float64 `json:"fine_amount"`
		Remark     string  `json:"remark"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.HandledBy == "" {
		return badRequestResponse(c, "handled_by is required")
	}

	if err := h.forbiddenService.HandleViolation(ctx, violationID, req.HandledBy, req.FineAmount, req.Remark); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, nil)
}
