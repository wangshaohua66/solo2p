package handler

import (
	"strconv"
	"time"

	"fishery-api/model"
	"fishery-api/service"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type SupplyHandler struct {
	supplyService *service.SupplyService
}

func NewSupplyHandler() *SupplyHandler {
	return &SupplyHandler{
		supplyService: service.NewSupplyService(),
	}
}

func (h *SupplyHandler) AddFuelRecord(c echo.Context) error {
	ctx := c.Request().Context()

	var record model.FuelRecord
	if err := c.Bind(&record); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if record.VesselID == "" || record.FuelAmount <= 0 {
		return badRequestResponse(c, "vessel_id and fuel_amount are required")
	}

	if record.RecordedAt.IsZero() {
		record.RecordedAt = time.Now()
	}

	if err := h.supplyService.AddFuelRecord(ctx, &record); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, record)
}

func (h *SupplyHandler) GetVesselFuelStatus(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("vessel_id")

	thresholdStr := c.QueryParam("safe_threshold_mileage")
	safeThresholdMileage := 300.0
	if thresholdStr != "" {
		if t, err := strconv.ParseFloat(thresholdStr, 64); err == nil && t > 0 {
			safeThresholdMileage = t
		}
	}

	status, err := h.supplyService.GetVesselFuelStatus(ctx, vesselID, safeThresholdMileage)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, status)
}

func (h *SupplyHandler) ListFuelRecords(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	startTimeStr := c.QueryParam("start_time")
	endTimeStr := c.QueryParam("end_time")
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

	var startTime, endTime time.Time
	if startTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			startTime = t
		}
	}
	if endTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			endTime = t
		}
	}

	records, total, err := h.supplyService.ListFuelRecords(ctx, vesselID, startTime, endTime, page, pageSize)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := model.PaginationResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     records,
	}

	return successResponse(c, result)
}

func (h *SupplyHandler) RefuelVessel(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("vessel_id")

	var req struct {
		Amount          float64 `json:"amount"`
		SupplyPointID   string  `json:"supply_point_id"`
		SupplyPointName string  `json:"supply_point_name"`
		UnitPrice       float64 `json:"unit_price"`
		RecordedBy      string  `json:"recorded_by"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.Amount <= 0 {
		return badRequestResponse(c, "amount must be greater than 0")
	}

	if err := h.supplyService.RefuelVessel(ctx, vesselID, req.Amount, req.SupplyPointID, req.SupplyPointName, req.UnitPrice, req.RecordedBy); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, nil)
}

func (h *SupplyHandler) CreateSupplyPoint(c echo.Context) error {
	ctx := c.Request().Context()

	var point model.SupplyPoint
	if err := c.Bind(&point); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if point.Name == "" {
		return badRequestResponse(c, "name is required")
	}

	point.ID = bson.NewObjectID().Hex()
	if point.Status == "" {
		point.Status = "active"
	}

	if err := h.supplyService.CreateSupplyPoint(ctx, &point); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, point)
}

func (h *SupplyHandler) ListSupplyPoints(c echo.Context) error {
	ctx := c.Request().Context()

	pointType := c.QueryParam("type")
	status := c.QueryParam("status")

	points, err := h.supplyService.ListSupplyPoints(ctx, pointType, status)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, points)
}

func (h *SupplyHandler) FindNearestSupplyPoint(c echo.Context) error {
	ctx := c.Request().Context()

	lngStr := c.QueryParam("longitude")
	latStr := c.QueryParam("latitude")

	var lng, lat float64
	var err error

	if lngStr != "" {
		lng, err = strconv.ParseFloat(lngStr, 64)
		if err != nil {
			return badRequestResponse(c, "invalid longitude")
		}
	}
	if latStr != "" {
		lat, err = strconv.ParseFloat(latStr, 64)
		if err != nil {
			return badRequestResponse(c, "invalid latitude")
		}
	}

	point, distance, err := h.supplyService.FindNearestSupplyPoint(ctx, lng, lat)
	if err != nil {
		return notFoundResponse(c, "no supply points found")
	}

	result := map[string]interface{}{
		"supply_point": point,
		"distance_km":  distance,
	}

	return successResponse(c, result)
}

func (h *SupplyHandler) GenerateSupplyPlan(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("vessel_id")

	var req struct {
		Longitude float64 `json:"longitude"`
		Latitude  float64 `json:"latitude"`
		PlannedBy string  `json:"planned_by"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	location := model.NewPoint(req.Longitude, req.Latitude)

	plan, err := h.supplyService.GenerateSupplyPlan(ctx, vesselID, location, req.PlannedBy)
	if err != nil {
		if err.Error() == "fuel level is sufficient, no supply needed" {
			return errorResponse(c, model.ErrCodeSupplyShort, err.Error())
		}
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, plan)
}

func (h *SupplyHandler) ListSupplyPlans(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	status := c.QueryParam("status")
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

	plans, total, err := h.supplyService.ListSupplyPlans(ctx, vesselID, status, page, pageSize)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := model.PaginationResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     plans,
	}

	return successResponse(c, result)
}

func (h *SupplyHandler) UpdateSupplyPlanStatus(c echo.Context) error {
	ctx := c.Request().Context()
	planID := c.Param("id")

	var req struct {
		Status string `json:"status"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.Status == "" {
		return badRequestResponse(c, "status is required")
	}

	if err := h.supplyService.UpdateSupplyPlanStatus(ctx, planID, req.Status); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, nil)
}
