package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labelops/backend/internal/middleware"
	"github.com/labelops/backend/internal/model"
	"github.com/labelops/backend/internal/service"
	"github.com/labelops/backend/internal/store"
)

type RoyaltyHandler struct {
	repo  *store.MockRepo
	redis *store.RedisStore
	calc  *service.CalcService
}

func NewRoyaltyHandler(repo *store.MockRepo, redis *store.RedisStore, calc *service.CalcService) *RoyaltyHandler {
	return &RoyaltyHandler{repo: repo, redis: redis, calc: calc}
}

type ListSettlementsRequest struct {
	ArtistID string               `query:"artist_id"`
	Status   model.SettlementStatus `query:"status"`
	Brand    model.Brand          `query:"brand"`
	Page     int                  `query:"page"`
	PageSize int                  `query:"page_size"`
}

func (h *RoyaltyHandler) ListSettlements(c echo.Context) error {
	req := ListSettlementsRequest{Page: 1, PageSize: 20}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid parameters")
	}
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 || req.PageSize > 100 {
		req.PageSize = 20
	}

	claims := middleware.GetUserFromContext(c)
	if claims != nil && claims.Role == model.RoleArtist && claims.ArtistID != nil {
		req.ArtistID = *claims.ArtistID
	}
	offset := (req.Page - 1) * req.PageSize

	list, total := h.repo.ListSettlements(req.ArtistID, req.Status, req.Brand, offset, req.PageSize)
	return c.JSON(http.StatusOK, PagedResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     list,
	})
}

func (h *RoyaltyHandler) GetSettlement(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing id")
	}
	s := h.repo.GetSettlement(id)
	if s == nil {
		return echo.NewHTTPError(http.StatusNotFound, "settlement not found")
	}

	claims := middleware.GetUserFromContext(c)
	if claims != nil && claims.Role == model.RoleArtist {
		if err := middleware.ValidateArtistAccess(c, s.ArtistID); err != nil {
			return err
		}
	}

	return c.JSON(http.StatusOK, s)
}

type GenerateSettlementRequest struct {
	ArtistID  string                  `json:"artist_id"`
	Period    model.SettlementPeriod  `json:"period"`
	RefDate   string                  `json:"ref_date"`
}

func (h *RoyaltyHandler) GenerateSettlement(c echo.Context) error {
	var req GenerateSettlementRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.ArtistID == "" || req.Period == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "artist_id and period are required")
	}

	ref := time.Now()
	if req.RefDate != "" {
		if t, err := time.Parse("2006-01-02", req.RefDate); err == nil {
			ref = t
		}
	}

	result, err := h.calc.GenerateArtistSettlement(c.Request().Context(), req.ArtistID, req.Period, ref)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "generate settlement failed: "+err.Error())
	}

	saved := h.calc.SaveSettlement(result.Settlement, result.Details)

	claims := middleware.GetUserFromContext(c)
	if claims != nil {
		ip := c.RealIP()
		_ = ip
	}

	return c.JSON(http.StatusCreated, saved)
}

type UpdateSettlementStatusRequest struct {
	Action string `json:"action"`
	Remark string `json:"remark"`
}

func (h *RoyaltyHandler) UpdateSettlementStatus(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing id")
	}
	var req UpdateSettlementStatusRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	s := h.repo.GetSettlement(id)
	if s == nil {
		return echo.NewHTTPError(http.StatusNotFound, "settlement not found")
	}

	switch req.Action {
	case "approve":
		s.Status = model.SettlePending
		h.repo.SaveSettlement(s)
		if err := h.calc.ApproveSettlement(id); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
	case "paid":
		if err := h.calc.MarkPaid(id); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
	case "reject":
		s.Status = model.SettleRejected
		if req.Remark != "" {
			s.Remark = req.Remark
		}
		h.repo.SaveSettlement(s)
	case "submit":
		if s.Status == model.SettleDraft {
			s.Status = model.SettlePending
			h.repo.SaveSettlement(s)
		}
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "invalid action")
	}

	return c.JSON(http.StatusOK, h.repo.GetSettlement(id))
}

type CompareSettlementsRequest struct {
	IDs []string `json:"ids"`
}

type SettlementComparison struct {
	BaseID       string             `json:"base_id"`
	ComparedIDs  []string           `json:"compared_ids"`
	TotalRevenue map[string]float64 `json:"total_revenue"`
	DiffMap      map[string]float64 `json:"diff_map"`
	PlatformDiff map[string]map[model.Platform]float64 `json:"platform_diff"`
}

func (h *RoyaltyHandler) CompareSettlements(c echo.Context) error {
	var req CompareSettlementsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if len(req.IDs) < 2 {
		return echo.NewHTTPError(http.StatusBadRequest, "at least 2 settlement ids are required")
	}

	totalRev := make(map[string]float64)
	platformData := make(map[string]map[model.Platform]float64)
	baseID := req.IDs[0]

	for _, id := range req.IDs {
		s := h.repo.GetSettlement(id)
		if s == nil {
			return echo.NewHTTPError(http.StatusNotFound, "settlement "+id+" not found")
		}
		totalRev[id] = s.TotalRevenue
		platformData[id] = s.PlatformBreakdown
	}

	diffMap := make(map[string]float64)
	platformDiff := make(map[string]map[model.Platform]float64)
	baseTotal := totalRev[baseID]

	for i := 1; i < len(req.IDs); i++ {
		id := req.IDs[i]
		diffMap[id] = totalRev[id] - baseTotal
		pd := make(map[model.Platform]float64)
		for p, v := range platformData[id] {
			pd[p] = v - platformData[baseID][p]
		}
		platformDiff[id] = pd
	}

	return c.JSON(http.StatusOK, SettlementComparison{
		BaseID:       baseID,
		ComparedIDs:  req.IDs[1:],
		TotalRevenue: totalRev,
		DiffMap:      diffMap,
		PlatformDiff: platformDiff,
	})
}

type ListRulesRequest struct {
	WorkID   string `query:"work_id"`
	ArtistID string `query:"artist_id"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

func (h *RoyaltyHandler) ListRules(c echo.Context) error {
	req := ListRulesRequest{Page: 1, PageSize: 100}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid parameters")
	}

	rules := h.repo.ListRules(req.WorkID, req.ArtistID)
	start := (req.Page - 1) * req.PageSize
	end := start + req.PageSize
	if start >= len(rules) {
		return c.JSON(http.StatusOK, PagedResponse{Total: int64(len(rules)), Page: req.Page, PageSize: req.PageSize, Data: []model.RoyaltyRule{}})
	}
	if end > len(rules) {
		end = len(rules)
	}

	return c.JSON(http.StatusOK, PagedResponse{
		Total:    int64(len(rules)),
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     rules[start:end],
	})
}

func (h *RoyaltyHandler) GetRule(c echo.Context) error {
	id := c.Param("id")
	rule := h.repo.GetRule(id)
	if rule == nil {
		return echo.NewHTTPError(http.StatusNotFound, "rule not found")
	}
	return c.JSON(http.StatusOK, rule)
}

type CreateRuleRequest struct {
	Name            string                 `json:"name"`
	WorkID          *string                `json:"work_id"`
	ArtistID        *string                `json:"artist_id"`
	ContributorRole model.ContributorRole  `json:"contributor_role"`
	RuleType        model.RoyaltyRuleType  `json:"rule_type"`
	FixedRate       *float64               `json:"fixed_rate"`
	TieredRates     []model.TieredRate     `json:"tiered_rates"`
	Guaranteed      *float64               `json:"guaranteed"`
	Period          model.SettlementPeriod `json:"period"`
}

func (h *RoyaltyHandler) CreateRule(c echo.Context) error {
	var req CreateRuleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	id := store.KeyWork("")
	_ = id
	rule := &model.RoyaltyRule{
		ID:              "rule-" + strconv.FormatInt(time.Now().UnixNano(), 36),
		Name:            req.Name,
		WorkID:          req.WorkID,
		ArtistID:        req.ArtistID,
		ContributorRole: req.ContributorRole,
		RuleType:        req.RuleType,
		FixedRate:       req.FixedRate,
		TieredRates:     req.TieredRates,
		Guaranteed:      req.Guaranteed,
		Period:          req.Period,
	}
	if rule.Period == "" {
		rule.Period = model.PeriodMonthly
	}
	h.repo.SaveRule(rule)
	return c.JSON(http.StatusCreated, rule)
}

type DashboardRequest struct {
	StartDate string      `query:"start_date"`
	EndDate   string      `query:"end_date"`
	Brand     model.Brand `query:"brand"`
}

func (h *RoyaltyHandler) DashboardSummary(c echo.Context) error {
	req := DashboardRequest{}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid parameters")
	}

	end := time.Now()
	if req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			end = t
		}
	}
	start := end.AddDate(0, -3, 0)
	if req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			start = t
		}
	}

	summary, err := h.calc.DashboardSummary(c.Request().Context(), start, end, req.Brand)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, summary)
}

func (h *RoyaltyHandler) DashboardSummary2(c context.Context, start, end time.Time, brand model.Brand) (*model.DashboardSummary, error) {
	_ = c
	return h.calc.DashboardSummary(context.Background(), start, end, brand)
}
