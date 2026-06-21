// Package api exposes the scheduling assistant over a small REST surface built
// on Echo v4, so downstream SCADA/MES/finance systems can integrate without the
// CLI. The same repository, calculator and scheduler components back every
// endpoint, keeping behaviour consistent between interactive and API use.
package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"scheduler/internal/calculator"
	"scheduler/internal/config"
	"scheduler/internal/export"
	"scheduler/internal/models"
	"scheduler/internal/scheduler"
	"scheduler/internal/scada"
	"scheduler/internal/storage"
)

// Deps bundles the runtime dependencies the handlers need. Cfg returns the
// currently active configuration snapshot (which may change after a hot
// reload), so each request sees a consistent view.
type Deps struct {
	Repo *storage.Repository
	Cfg  func() config.Config
}

// Handler holds Echo group-registered route functions.
type Handler struct {
	deps Deps
}

// New returns a Handler bound to the given dependencies.
func New(d Deps) *Handler { return &Handler{deps: d} }

// Register wires every route onto the provided Echo instance under /api.
func (h *Handler) Register(e *echo.Echo) {
	g := e.Group("/api")
	g.GET("/health", h.health)
	g.GET("/stations", h.stations)
	g.GET("/readings", h.readings)
	g.POST("/collect", h.collect)
	g.GET("/pressure-loss", h.pressureLoss)
	g.POST("/balance", h.balance)
	g.POST("/dispatch", h.dispatch)
	g.GET("/dispatches", h.dispatches)
	g.PATCH("/dispatches/:id", h.updateDispatch)
	g.GET("/audit", h.audit)
	g.GET("/report/settlement", h.settlement)
}

func (h *Handler) health(c echo.Context) error {
	return c.JSON(http.StatusOK, echo.Map{"status": "ok", "time": time.Now()})
}

func (h *Handler) stations(c echo.Context) error {
	return c.JSON(http.StatusOK, h.deps.Cfg().Stations)
}

func (h *Handler) readings(c echo.Context) error {
	f := storage.ReadingFilter{
		StationID: c.QueryParam("station_id"),
		OnlyValid: c.QueryParam("valid") == "1",
	}
	if v := c.QueryParam("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.From = t
		}
	}
	if v := c.QueryParam("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.To = t
		}
	}
	page, _ := strconv.Atoi(c.QueryParam("page"))
	size, _ := strconv.Atoi(c.QueryParam("size"))
	p, err := h.deps.Repo.QueryReadings(c.Request().Context(), f, page, size)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, p)
}

func (h *Handler) collect(c echo.Context) error {
	cfg := h.deps.Cfg()
	cl := scada.New(cfg)
	ctx, cancel := context.WithTimeout(c.Request().Context(), 3*time.Second)
	defer cancel()
	rs, err := cl.Collect(ctx, cfg.Stations, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
	if err := h.deps.Repo.SaveReadings(c.Request().Context(), rs); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, echo.Map{"collected": len(rs), "readings": rs})
}

func (h *Handler) pressureLoss(c echo.Context) error {
	cfg := h.deps.Cfg()
	latest, err := h.deps.Repo.LatestReadings(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	eng := calculator.New(cfg)
	return c.JSON(http.StatusOK, eng.AllPressureLosses(latest))
}

type balanceReq struct {
	Demands []models.DemandPlan `json:"demands"`
	N       int                 `json:"n"`
}

func (h *Handler) balance(c echo.Context) error {
	var req balanceReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	cfg := h.deps.Cfg()
	eng := calculator.New(cfg)
	res, err := eng.Balance(req.Demands, req.N)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

type dispatchReq struct {
	PlanID      string `json:"plan_id"`
	FromLosses  bool   `json:"from_losses"`
}

func (h *Handler) dispatch(c echo.Context) error {
	var req dispatchReq
	_ = c.Bind(&req)
	cfg := h.deps.Cfg()
	gen := scheduler.New(cfg)
	var out []models.DispatchInstruction
	if req.FromLosses {
		latest, err := h.deps.Repo.LatestReadings(c.Request().Context())
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		eng := calculator.New(cfg)
		losses := eng.AllPressureLosses(latest)
		out = gen.FromPressureLosses(losses)
	}
	scheduler.SortByUrgency(out)
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) dispatches(c echo.Context) error {
	f := storage.DispatchFilter{
		StationID: c.QueryParam("station_id"),
		Operator: c.QueryParam("operator"),
		Status:    c.QueryParam("status"),
	}
	page, _ := strconv.Atoi(c.QueryParam("page"))
	size, _ := strconv.Atoi(c.QueryParam("size"))
	p, err := h.deps.Repo.QueryDispatches(c.Request().Context(), f, page, size)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, p)
}

type dispatchUpdate struct {
	Status   string `json:"status"`
	Operator string `json:"operator"`
}

func (h *Handler) updateDispatch(c echo.Context) error {
	var u dispatchUpdate
	if err := c.Bind(&u); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := h.deps.Repo.UpdateDispatchStatus(c.Request().Context(), c.Param("id"), u.Status, u.Operator); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}
	_ = h.deps.Repo.WriteAudit(u.Operator, "dispatch_update", "dispatch "+c.Param("id")+" -> "+u.Status)
	return c.JSON(http.StatusOK, echo.Map{"id": c.Param("id"), "status": u.Status})
}

func (h *Handler) audit(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	logs, err := h.deps.Repo.QueryAudit(c.Request().Context(), limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, logs)
}

func (h *Handler) settlement(c echo.Context) error {
	month := c.QueryParam("month")
	if month == "" {
		month = time.Now().Format("2006-01")
	}
	vols, err := h.deps.Repo.MonthlyVolumes(c.Request().Context(), month)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	cfg := h.deps.Cfg()
	contracts := make(map[string]models.PriceContract, len(cfg.Contracts))
	for _, ct := range cfg.Contracts {
		contracts[ct.UserID] = ct
	}
	rows := make([]models.SettlementRow, 0, len(vols))
	for _, v := range vols {
		ct, ok := contracts[v.StationID]
		if !ok {
			continue
		}
		amount := v.Volume * ct.UnitPrice
		tax := amount * ct.TaxRate
		rows = append(rows, models.SettlementRow{
			UserID:      ct.UserID,
			UserName:    ct.UserName,
			Volume:      v.Volume,
			UnitPrice:   ct.UnitPrice,
			Amount:      amount,
			TaxAmount:   tax,
			TotalAmount: amount + tax,
			Month:       month,
		})
	}
	c.Response().Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=settlement_"+month+".csv")
	return export.ExportSettlementCSV(rows, c.Response())
}
