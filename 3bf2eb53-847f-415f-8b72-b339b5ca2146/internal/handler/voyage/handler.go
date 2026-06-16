package voyage

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"offshore-wind-ops/internal/handler"
	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/model"
	voyagesvc "offshore-wind-ops/internal/service/voyage"
	weathersvc "offshore-wind-ops/internal/service/weather"
)

type Handler struct {
	voyageSvc  *voyagesvc.Service
	weatherSvc *weathersvc.Service
}

func NewHandler(voyageSvc *voyagesvc.Service, weatherSvc *weathersvc.Service) *Handler {
	return &Handler{
		voyageSvc:  voyageSvc,
		weatherSvc: weatherSvc,
	}
}

func (h *Handler) RegisterRoutes(e *echo.Group, jwtSecret string) {
	g := e.Group("/voyages", middleware.JWTAuth(jwtSecret))

	g.GET("", h.ListVoyages)
	g.POST("", h.CreateVoyage, middleware.RequireRole(model.RoleShipDispatcher))
	g.GET("/:id", h.GetVoyage)
	g.PUT("/:id/approve", h.ApproveVoyage, middleware.RequireRole(model.RoleSafetyOfficer))
	g.PUT("/:id/start", h.StartVoyage, middleware.RequireRole(model.RoleShipDispatcher))
	g.PUT("/:id/complete", h.CompleteVoyage, middleware.RequireRole(model.RoleShipDispatcher))
	g.PUT("/:id/cancel", h.CancelVoyage)
	g.POST("/check-conflicts", h.CheckConflicts)

	ships := e.Group("/ships", middleware.JWTAuth(jwtSecret))
	ships.GET("", h.ListShips)
	ships.POST("", h.CreateShip, middleware.RequireRole(model.RoleShipDispatcher))
	ships.GET("/:id", h.GetShip)
	ships.PUT("/:id", h.UpdateShip, middleware.RequireRole(model.RoleShipDispatcher))

	weather := e.Group("/weather", middleware.JWTAuth(jwtSecret))
	weather.GET("/forecast", h.GetForecast)
	weather.GET("/windows", h.GetWeatherWindows)
	weather.POST("/windows/calculate", h.CalculateWeatherWindows)
	weather.POST("/forecast/fetch", h.FetchForecast, middleware.RequireRole(model.RoleShipDispatcher))
}

func (h *Handler) ListVoyages(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	status := c.QueryParam("status")
	shipID := c.QueryParam("ship_id")
	page := handler.QueryInt(c, "page", 1)
	pageSize := handler.QueryInt(c, "page_size", 20)

	filter := map[string]interface{}{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}
	if status != "" {
		filter["status"] = status
	}
	if shipID != "" {
		filter["ship_id"] = shipID
	}

	voyages, total, err := h.voyageSvc.ListVoyages(c.Request().Context(), filter, page, pageSize)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(model.PageResult{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     voyages,
	}))
}

func (h *Handler) CreateVoyage(c echo.Context) error {
	var req model.VoyageCreateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	dispatcherID := middleware.GetUserID(c)
	voyage, err := h.voyageSvc.CreateVoyage(c.Request().Context(), &req, dispatcherID)
	if err != nil {
		if ce, ok := err.(*voyagesvc.ConflictError); ok {
			return c.JSON(http.StatusConflict, model.Response{
				Code:    409,
				Message: "voyage conflicts detected",
				Data:    ce.Conflicts,
			})
		}
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusCreated, model.Success(voyage))
}

func (h *Handler) GetVoyage(c echo.Context) error {
	id := c.Param("id")
	voyage, err := h.voyageSvc.GetVoyage(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "voyage not found"))
	}
	return c.JSON(http.StatusOK, model.Success(voyage))
}

func (h *Handler) ApproveVoyage(c echo.Context) error {
	id := c.Param("id")
	safetyOfficerID := middleware.GetUserID(c)

	voyage, err := h.voyageSvc.ApproveVoyage(c.Request().Context(), id, safetyOfficerID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(voyage))
}

func (h *Handler) StartVoyage(c echo.Context) error {
	id := c.Param("id")
	if err := h.voyageSvc.StartVoyage(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) CompleteVoyage(c echo.Context) error {
	id := c.Param("id")
	if err := h.voyageSvc.CompleteVoyage(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) CancelVoyage(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason" validate:"required"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if err := h.voyageSvc.CancelVoyage(c.Request().Context(), id, req.Reason); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) CheckConflicts(c echo.Context) error {
	var req struct {
		ShipID        string    `json:"ship_id" validate:"required"`
		Passengers    []string  `json:"passengers"`
		DepartureTime time.Time `json:"departure_time" validate:"required"`
		ReturnTime    time.Time `json:"return_time" validate:"required"`
		VoyageID      string    `json:"voyage_id"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	conflicts, err := h.voyageSvc.CheckConflicts(
		c.Request().Context(),
		req.VoyageID,
		req.ShipID,
		req.Passengers,
		req.DepartureTime,
		req.ReturnTime,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}

	return c.JSON(http.StatusOK, model.Success(conflicts))
}

func (h *Handler) ListShips(c echo.Context) error {
	status := c.QueryParam("status")
	filter := map[string]interface{}{}
	if status != "" {
		filter["status"] = status
	}

	ships, err := h.voyageSvc.ListShips(c.Request().Context(), filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(ships))
}

func (h *Handler) CreateShip(c echo.Context) error {
	var ship model.Ship
	if err := c.Bind(&ship); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	result, err := h.voyageSvc.CreateShip(c.Request().Context(), &ship)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusCreated, model.Success(result))
}

func (h *Handler) GetShip(c echo.Context) error {
	id := c.Param("id")
	ship, err := h.voyageSvc.GetShip(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, model.Error(404, "ship not found"))
	}
	return c.JSON(http.StatusOK, model.Success(ship))
}

func (h *Handler) UpdateShip(c echo.Context) error {
	id := c.Param("id")
	var ship model.Ship
	if err := c.Bind(&ship); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}
	ship.ID = idToObjectID(id)

	if err := h.voyageSvc.UpdateShip(c.Request().Context(), &ship); err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(nil))
}

func (h *Handler) GetForecast(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
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
		startTime = time.Now()
	}

	if endStr != "" {
		endTime, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.Error(400, "invalid end_time"))
		}
	} else {
		endTime = time.Now().Add(72 * time.Hour)
	}

	forecasts, err := h.weatherSvc.GetForecast(c.Request().Context(), windFarmID, startTime, endTime)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(forecasts))
}

func (h *Handler) GetWeatherWindows(c echo.Context) error {
	windFarmID := c.QueryParam("wind_farm_id")
	startStr := c.QueryParam("start_time")
	endStr := c.QueryParam("end_time")
	shipGrade := c.QueryParam("ship_grade")

	var startTime, endTime time.Time
	var err error

	if startStr != "" {
		startTime, err = time.Parse(time.RFC3339, startStr)
	} else {
		startTime = time.Now()
	}
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid start_time"))
	}

	if endStr != "" {
		endTime, err = time.Parse(time.RFC3339, endStr)
	} else {
		endTime = time.Now().Add(72 * time.Hour)
	}
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid end_time"))
	}

	windows, err := h.weatherSvc.GetAvailableWindows(c.Request().Context(), windFarmID, startTime, endTime, shipGrade)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(windows))
}

func (h *Handler) CalculateWeatherWindows(c echo.Context) error {
	var req model.WeatherWindowCalcRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	startTime := req.StartTime
	if startTime.IsZero() {
		startTime = time.Now()
	}
	endTime := req.EndTime
	if endTime.IsZero() {
		endTime = time.Now().Add(72 * time.Hour)
	}

	cfg := weathersvc.WindowCalcConfig{
		MaxWindSpeed:  req.MaxWindSpeed,
		MaxWaveHeight: req.MaxWaveHeight,
		MinVisibility: req.MinVisibility,
		ShipGrade:     req.ShipGrade,
		MinWindowHours: 2,
	}
	if cfg.MaxWindSpeed == 0 {
		cfg.MaxWindSpeed = 15
	}
	if cfg.MaxWaveHeight == 0 {
		cfg.MaxWaveHeight = 2.5
	}
	if cfg.MinVisibility == 0 {
		cfg.MinVisibility = 1000
	}

	windows, err := h.weatherSvc.CalculateWeatherWindows(c.Request().Context(), req.WindFarmID, startTime, endTime, cfg)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(windows))
}

func (h *Handler) FetchForecast(c echo.Context) error {
	var req struct {
		WindFarmID string  `json:"wind_farm_id" validate:"required"`
		Lat        float64 `json:"lat"`
		Lon        float64 `json:"lon"`
		Days       int     `json:"days"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Error(400, "invalid request"))
	}

	if req.Days <= 0 {
		req.Days = 3
	}

	forecasts, err := h.weatherSvc.FetchAndSaveForecast(c.Request().Context(), req.WindFarmID, req.Lat, req.Lon, req.Days)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.Error(500, err.Error()))
	}
	return c.JSON(http.StatusOK, model.Success(map[string]interface{}{
		"count": len(forecasts),
	}))
}

func idToObjectID(id string) primitive.ObjectID {
	oid, _ := primitive.ObjectIDFromHex(id)
	return oid
}
