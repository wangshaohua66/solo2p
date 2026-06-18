package handler

import (
	"time"

	"fishery-api/config"
	"fishery-api/model"
	"fishery-api/service"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type VesselHandler struct {
	trackerService   *service.TrackerService
	forbiddenService *service.ForbiddenService
	vesselCol        *mongo.Collection
}

func NewVesselHandler() *VesselHandler {
	return &VesselHandler{
		trackerService:   service.NewTrackerService(),
		forbiddenService: service.NewForbiddenService(),
		vesselCol:        config.DB.Collection(config.ColVessels),
	}
}

func (h *VesselHandler) CreateVessel(c echo.Context) error {
	ctx := c.Request().Context()
	var vessel model.Vessel
	if err := c.Bind(&vessel); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if vessel.VesselNo == "" || vessel.Name == "" {
		return badRequestResponse(c, "vessel_no and name are required")
	}

	vessel.ID = bson.NewObjectID().Hex()
	now := time.Now()
	vessel.CreatedAt = now
	vessel.UpdatedAt = now
	if vessel.Status == "" {
		vessel.Status = model.VesselStatusActive
	}

	_, err := h.vesselCol.InsertOne(ctx, &vessel)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, vessel)
}

func (h *VesselHandler) GetVessel(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")

	var vessel model.Vessel
	err := h.vesselCol.FindOne(ctx, bson.M{"_id": id}).Decode(&vessel)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return notFoundResponse(c, "vessel not found")
		}
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, vessel)
}

func (h *VesselHandler) ListVessels(c echo.Context) error {
	ctx := c.Request().Context()

	vesselType := c.QueryParam("type")
	status := c.QueryParam("status")
	fishingGround := c.QueryParam("fishing_ground")

	filter := bson.M{}
	if vesselType != "" {
		filter["type"] = vesselType
	}
	if status != "" {
		filter["status"] = status
	}
	if fishingGround != "" {
		filter["fishing_ground"] = fishingGround
	}

	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := h.vesselCol.Find(ctx, filter, opts)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}
	defer cursor.Close(ctx)

	var vessels []model.Vessel
	if err := cursor.All(ctx, &vessels); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, vessels)
}

func (h *VesselHandler) UpdateVessel(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")

	var vessel model.Vessel
	if err := c.Bind(&vessel); err != nil {
		return badRequestResponse(c, err.Error())
	}

	update := bson.M{
		"$set": bson.M{
			"name":                      vessel.Name,
			"type":                      vessel.Type,
			"tonnage":                   vessel.Tonnage,
			"captain":                   vessel.Captain,
			"company":                   vessel.Company,
			"fishing_ground":            vessel.FishingGround,
			"status":                   vessel.Status,
			"beidou_id":                vessel.BeidouID,
			"fuel_tank_capacity":        vessel.FuelTankCapacity,
			"daily_fuel_consumption":    vessel.DailyFuelConsumption,
			"updated_at":                time.Now(),
		},
	}

	result := h.vesselCol.FindOneAndUpdate(ctx, bson.M{"_id": id}, update)
	if result.Err() != nil {
		if result.Err() == mongo.ErrNoDocuments {
			return notFoundResponse(c, "vessel not found")
		}
		return systemErrorResponse(c, result.Err().Error())
	}

	return successResponse(c, nil)
}

func (h *VesselHandler) DeleteVessel(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")

	result, err := h.vesselCol.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}
	if result.DeletedCount == 0 {
		return notFoundResponse(c, "vessel not found")
	}

	return successResponse(c, nil)
}

func (h *VesselHandler) ReportPosition(c echo.Context) error {
	ctx := c.Request().Context()

	var req struct {
		VesselID  string  `json:"vessel_id"`
		VesselNo  string  `json:"vessel_no"`
		Longitude float64 `json:"longitude"`
		Latitude  float64 `json:"latitude"`
		Speed     float64 `json:"speed"`
		Heading   float64 `json:"heading"`
		Timestamp string  `json:"timestamp"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.VesselID == "" {
		return badRequestResponse(c, "vessel_id is required")
	}

	if err := model.ValidateCoordinates(req.Longitude, req.Latitude); err != nil {
		return badRequestResponse(c, err.Error())
	}

	timestamp := time.Now()
	if req.Timestamp != "" {
		parsed, err := time.Parse(time.RFC3339, req.Timestamp)
		if err == nil {
			timestamp = parsed
		}
	}

	point := &model.TrackPoint{
		ID:        bson.NewObjectID().Hex(),
		VesselID:  req.VesselID,
		VesselNo:  req.VesselNo,
		Location:  model.NewPoint(req.Longitude, req.Latitude),
		Speed:     req.Speed,
		Heading:   req.Heading,
		Timestamp: timestamp,
		CreatedAt: time.Now(),
	}

	if err := h.trackerService.AddTrackPoint(ctx, point); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	var vessel model.Vessel
	var yawAlert *model.YawAlert
	var forbiddenViolation *model.ForbiddenViolation

	err := h.vesselCol.FindOne(ctx, bson.M{"_id": req.VesselID}).Decode(&vessel)
	if err == nil {
		basePoint := vessel.OperationBasePoint
		if basePoint.Coordinates == nil {
			basePoint = model.NewPoint(req.Longitude, req.Latitude)
		}
		maxDistance := vessel.MaxYawDistance
		if maxDistance <= 0 {
			maxDistance = 5.0
		}

		yawAlert, _ = h.trackerService.CheckYaw(ctx, point, basePoint, maxDistance)

		forbiddenViolation, _ = h.forbiddenService.CheckForbiddenZone(
			ctx, req.VesselID, req.VesselNo, point.Location, timestamp,
		)
	}

	result := map[string]interface{}{
		"track_point":         point,
		"yaw_alert":           yawAlert,
		"forbidden_violation": forbiddenViolation,
	}

	return successResponse(c, result)
}

func (h *VesselHandler) GetTrackHistory(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("id")

	startTimeStr := c.QueryParam("start_time")
	endTimeStr := c.QueryParam("end_time")

	var startTime, endTime time.Time
	var err error

	if startTimeStr != "" {
		startTime, err = time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			return badRequestResponse(c, "invalid start_time format")
		}
	} else {
		startTime = time.Now().Add(-72 * time.Hour)
	}

	if endTimeStr != "" {
		endTime, err = time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			return badRequestResponse(c, "invalid end_time format")
		}
	} else {
		endTime = time.Now()
	}

	points, err := h.trackerService.GetTrackHistory(ctx, vesselID, startTime, endTime)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, points)
}

func (h *VesselHandler) GetLatestPosition(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("id")

	point, err := h.trackerService.GetLatestPosition(ctx, vesselID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return notFoundResponse(c, "no track data found")
		}
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, point)
}

func (h *VesselHandler) Get72HourTrack(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("id")

	points, err := h.trackerService.Get72HourTrack(ctx, vesselID)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, points)
}

func (h *VesselHandler) ListYawAlerts(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	handledStr := c.QueryParam("handled")
	page := int64(1)
	pageSize := int64(20)

	var handled *bool
	if handledStr != "" {
		h := handledStr == "true"
		handled = &h
	}

	alerts, total, err := h.trackerService.ListYawAlerts(ctx, vesselID, handled, page, pageSize)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := model.PaginationResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     alerts,
	}

	return successResponse(c, result)
}

func (h *VesselHandler) HandleYawAlert(c echo.Context) error {
	ctx := c.Request().Context()
	alertID := c.Param("id")

	var req struct {
		HandledBy string `json:"handled_by"`
		Remark    string `json:"remark"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if err := h.trackerService.HandleYawAlert(ctx, alertID, req.HandledBy, req.Remark); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, nil)
}
