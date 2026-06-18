package handler

import (
	"strconv"
	"time"

	"fishery-api/config"
	"fishery-api/model"
	"fishery-api/service"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type CatchHandler struct {
	quotaService *service.QuotaService
	catchCol     *mongo.Collection
}

func NewCatchHandler() *CatchHandler {
	return &CatchHandler{
		quotaService: service.NewQuotaService(),
		catchCol:     config.DB.Collection(config.ColCatchRecords),
	}
}

func (h *CatchHandler) ReportCatch(c echo.Context) error {
	ctx := c.Request().Context()

	var req struct {
		VesselID     string  `json:"vessel_id"`
		VesselNo     string  `json:"vessel_no"`
		SpeciesCode  string  `json:"species_code"`
		SpeciesName  string  `json:"species_name"`
		Weight       float64 `json:"weight"`
		LengthMin    float64 `json:"length_min"`
		LengthMax    float64 `json:"length_max"`
		Longitude    float64 `json:"longitude"`
		Latitude     float64 `json:"latitude"`
		WaterTemp    float64 `json:"water_temp"`
		FishingGround string  `json:"fishing_ground"`
		CatchTime    string  `json:"catch_time"`
		ReportedBy   string  `json:"reported_by"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.VesselID == "" || req.SpeciesCode == "" || req.Weight <= 0 {
		return badRequestResponse(c, "vessel_id, species_code and weight are required")
	}

	if err := model.ValidateCoordinates(req.Longitude, req.Latitude); err != nil {
		return badRequestResponse(c, err.Error())
	}

	catchTime := time.Now()
	if req.CatchTime != "" {
		parsed, err := time.Parse(time.RFC3339, req.CatchTime)
		if err == nil {
			catchTime = parsed
		}
	}

	warning, err := h.quotaService.DeductQuota(ctx, req.VesselID, req.SpeciesCode, req.Weight, req.FishingGround)
	if err != nil {
		if err.Error() == "quota not found or locked" {
			return errorResponse(c, model.ErrCodeQuotaLocked, "quota is locked or not found")
		}
		if err.Error() == "insufficient quota" {
			return errorResponse(c, model.ErrCodeQuotaExceeded, "insufficient quota")
		}
		return systemErrorResponse(c, err.Error())
	}

	record := &model.CatchRecord{
		ID:           bson.NewObjectID().Hex(),
		VesselID:     req.VesselID,
		VesselNo:     req.VesselNo,
		SpeciesCode:  req.SpeciesCode,
		SpeciesName:  req.SpeciesName,
		Weight:       req.Weight,
		LengthMin:    req.LengthMin,
		LengthMax:    req.LengthMax,
		Location:     model.NewPoint(req.Longitude, req.Latitude),
		WaterTemp:    req.WaterTemp,
		FishingGround: req.FishingGround,
		CatchTime:    catchTime,
		ReportedBy:   req.ReportedBy,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	_, err = h.catchCol.InsertOne(ctx, record)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := map[string]interface{}{
		"record":         record,
		"quota_warning":  warning,
	}

	return successResponse(c, result)
}

func (h *CatchHandler) ListCatchRecords(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	speciesCode := c.QueryParam("species_code")
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

	filter := bson.M{}
	if vesselID != "" {
		filter["vessel_id"] = vesselID
	}
	if speciesCode != "" {
		filter["species_code"] = speciesCode
	}

	if startTimeStr != "" || endTimeStr != "" {
		timeFilter := bson.M{}
		if startTimeStr != "" {
			if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
				timeFilter["$gte"] = t
			}
		}
		if endTimeStr != "" {
			if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
				timeFilter["$lte"] = t
			}
		}
		if len(timeFilter) > 0 {
			filter["catch_time"] = timeFilter
		}
	}

	total, err := h.catchCol.CountDocuments(ctx, filter)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "catch_time", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := h.catchCol.Find(ctx, filter, opts)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}
	defer cursor.Close(ctx)

	var records []model.CatchRecord
	if err := cursor.All(ctx, &records); err != nil {
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

func (h *CatchHandler) GetCatchRecord(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")

	var record model.CatchRecord
	err := h.catchCol.FindOne(ctx, bson.M{"_id": id}).Decode(&record)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return notFoundResponse(c, "catch record not found")
		}
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, record)
}

func (h *CatchHandler) CreateAnnualQuota(c echo.Context) error {
	ctx := c.Request().Context()

	var quota model.AnnualQuota
	if err := c.Bind(&quota); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if quota.Year == 0 || quota.SpeciesCode == "" || quota.FishingGround == "" || quota.TotalQuota <= 0 {
		return badRequestResponse(c, "year, species_code, fishing_ground and total_quota are required")
	}

	quota.ID = bson.NewObjectID().Hex()
	if err := h.quotaService.CreateAnnualQuota(ctx, &quota); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, quota)
}

func (h *CatchHandler) GetAnnualQuota(c echo.Context) error {
	ctx := c.Request().Context()

	yearStr := c.QueryParam("year")
	speciesCode := c.QueryParam("species_code")
	fishingGround := c.QueryParam("fishing_ground")

	year := 0
	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}

	if year == 0 || speciesCode == "" || fishingGround == "" {
		return badRequestResponse(c, "year, species_code and fishing_ground are required")
	}

	quota, err := h.quotaService.GetAnnualQuota(ctx, year, speciesCode, fishingGround)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return notFoundResponse(c, "annual quota not found")
		}
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, quota)
}

func (h *CatchHandler) ListAnnualQuotas(c echo.Context) error {
	ctx := c.Request().Context()

	yearStr := c.QueryParam("year")
	fishingGround := c.QueryParam("fishing_ground")

	filter := bson.M{}
	if yearStr != "" {
		if year, err := strconv.Atoi(yearStr); err == nil {
			filter["year"] = year
		}
	}
	if fishingGround != "" {
		filter["fishing_ground"] = fishingGround
	}

	col := config.DB.Collection(config.ColAnnualQuotas)
	cursor, err := col.Find(ctx, filter)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}
	defer cursor.Close(ctx)

	var quotas []model.AnnualQuota
	if err := cursor.All(ctx, &quotas); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, quotas)
}

func (h *CatchHandler) CreateVesselQuota(c echo.Context) error {
	ctx := c.Request().Context()

	var quota model.VesselQuota
	if err := c.Bind(&quota); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if quota.VesselID == "" || quota.SpeciesCode == "" || quota.TotalQuota <= 0 {
		return badRequestResponse(c, "vessel_id, species_code and total_quota are required")
	}

	quota.ID = bson.NewObjectID().Hex()
	if err := h.quotaService.CreateVesselQuota(ctx, &quota); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, quota)
}

func (h *CatchHandler) ListVesselQuotas(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	yearStr := c.QueryParam("year")

	year := 0
	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}

	quotas, err := h.quotaService.ListVesselQuotas(ctx, vesselID, year)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, quotas)
}

func (h *CatchHandler) GetVesselQuota(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("vessel_id")
	speciesCode := c.QueryParam("species_code")

	year := time.Now().Year()

	quota, err := h.quotaService.GetVesselQuota(ctx, vesselID, year, speciesCode)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return notFoundResponse(c, "vessel quota not found")
		}
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, quota)
}

func (h *CatchHandler) CreateQuotaTransfer(c echo.Context) error {
	ctx := c.Request().Context()

	var transfer model.QuotaTransfer
	if err := c.Bind(&transfer); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if transfer.FromVesselID == "" || transfer.ToVesselID == "" || transfer.SpeciesCode == "" || transfer.Amount <= 0 {
		return badRequestResponse(c, "from_vessel_id, to_vessel_id, species_code and amount are required")
	}

	transfer.ID = bson.NewObjectID().Hex()
	if transfer.Year == 0 {
		transfer.Year = time.Now().Year()
	}

	if err := h.quotaService.CreateTransfer(ctx, &transfer); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, transfer)
}

func (h *CatchHandler) ApproveQuotaTransfer(c echo.Context) error {
	ctx := c.Request().Context()
	transferID := c.Param("id")

	var req struct {
		Approved bool   `json:"approved"`
		ApprovedBy string `json:"approved_by"`
		Remark   string `json:"remark"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if err := h.quotaService.ApproveTransfer(ctx, transferID, req.Approved, req.ApprovedBy, req.Remark); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, nil)
}

func (h *CatchHandler) ListQuotaTransfers(c echo.Context) error {
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

	transfers, total, err := h.quotaService.ListTransfers(ctx, vesselID, status, page, pageSize)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := model.PaginationResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     transfers,
	}

	return successResponse(c, result)
}

func (h *CatchHandler) CheckQuotaWarnings(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("vessel_id")

	warnings, err := h.quotaService.CheckQuotaWarning(ctx, vesselID)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, warnings)
}
