package handler

import (
	"strconv"
	"time"

	"fishery-api/model"
	"fishery-api/service"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type TradeHandler struct {
	tradeService *service.TradeService
}

func NewTradeHandler() *TradeHandler {
	return &TradeHandler{
		tradeService: service.NewTradeService(),
	}
}

func (h *TradeHandler) CreateTrade(c echo.Context) error {
	ctx := c.Request().Context()

	var trade model.SeaTrade
	if err := c.Bind(&trade); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if trade.SellerVesselID == "" || trade.BuyerVesselID == "" || trade.SpeciesCode == "" || trade.Weight <= 0 {
		return badRequestResponse(c, "seller_vessel_id, buyer_vessel_id, species_code and weight are required")
	}

	if trade.TradeTime.IsZero() {
		trade.TradeTime = time.Now()
	}

	if err := h.tradeService.CreateTrade(ctx, &trade); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, trade)
}

func (h *TradeHandler) GetTrade(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")

	trade, err := h.tradeService.GetTrade(ctx, id)
	if err != nil {
		return notFoundResponse(c, "trade not found")
	}

	return successResponse(c, trade)
}

func (h *TradeHandler) ConfirmTrade(c echo.Context) error {
	ctx := c.Request().Context()
	tradeID := c.Param("id")

	var req struct {
		VesselID string `json:"vessel_id"`
		Role     string `json:"role"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.VesselID == "" || req.Role == "" {
		return badRequestResponse(c, "vessel_id and role are required")
	}

	if err := h.tradeService.ConfirmTrade(ctx, tradeID, req.VesselID, req.Role); err != nil {
		return errorResponse(c, model.ErrCodeTradeConflict, err.Error())
	}

	return successResponse(c, nil)
}

func (h *TradeHandler) RejectTrade(c echo.Context) error {
	ctx := c.Request().Context()
	tradeID := c.Param("id")

	var req struct {
		VesselID string `json:"vessel_id"`
		Reason   string `json:"reason"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if err := h.tradeService.RejectTrade(ctx, tradeID, req.VesselID, req.Reason); err != nil {
		return errorResponse(c, model.ErrCodeTradeConflict, err.Error())
	}

	return successResponse(c, nil)
}

func (h *TradeHandler) ListTrades(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	status := c.QueryParam("status")
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

	trades, total, err := h.tradeService.ListTrades(ctx, vesselID, status, startTime, endTime, page, pageSize)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := model.PaginationResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     trades,
	}

	return successResponse(c, result)
}

func (h *TradeHandler) GenerateSettlement(c echo.Context) error {
	ctx := c.Request().Context()
	vesselID := c.Param("vessel_id")
	month := c.QueryParam("month")

	if month == "" {
		month = time.Now().Format("2006-01")
	}

	settlement, err := h.tradeService.GenerateMonthlySettlement(ctx, vesselID, month)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, settlement)
}

func (h *TradeHandler) ListSettlements(c echo.Context) error {
	ctx := c.Request().Context()

	vesselID := c.QueryParam("vessel_id")
	month := c.QueryParam("month")
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

	settlements, total, err := h.tradeService.ListSettlements(ctx, vesselID, month, page, pageSize)
	if err != nil {
		return systemErrorResponse(c, err.Error())
	}

	result := model.PaginationResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     settlements,
	}

	return successResponse(c, result)
}

func (h *TradeHandler) CreateDispute(c echo.Context) error {
	ctx := c.Request().Context()

	var dispute model.TradeDispute
	if err := c.Bind(&dispute); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if dispute.TradeID == "" || dispute.RaisedBy == "" || dispute.Reason == "" {
		return badRequestResponse(c, "trade_id, raised_by and reason are required")
	}

	dispute.ID = bson.NewObjectID().Hex()
	if err := h.tradeService.CreateDispute(ctx, &dispute); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, dispute)
}

func (h *TradeHandler) ResolveDispute(c echo.Context) error {
	ctx := c.Request().Context()
	disputeID := c.Param("id")

	var req struct {
		Resolution string `json:"resolution"`
		ResolvedBy string `json:"resolved_by"`
	}

	if err := c.Bind(&req); err != nil {
		return badRequestResponse(c, err.Error())
	}

	if req.Resolution == "" || req.ResolvedBy == "" {
		return badRequestResponse(c, "resolution and resolved_by are required")
	}

	if err := h.tradeService.ResolveDispute(ctx, disputeID, req.Resolution, req.ResolvedBy); err != nil {
		return systemErrorResponse(c, err.Error())
	}

	return successResponse(c, nil)
}
