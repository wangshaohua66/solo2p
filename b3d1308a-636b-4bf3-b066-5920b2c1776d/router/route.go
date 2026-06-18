package router

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"smart-lighting-api/controller"
	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"gorm.io/gorm"
)

type ControllerSet struct {
	DeviceCtl     *controller.DeviceController
	FaultCtl      *controller.FaultController
	WorkOrderCtl  *controller.WorkOrderController
	InspectionCtl *controller.InspectionController
	EnergyCtl     *controller.EnergyController
	StatsCtl      *controller.StatsController
	AuthCtl       *controller.AuthController
	UserCtl       *controller.UserController
	CommandRepo   *repository.CommandRepo
	CabinetRepo   *repository.CabinetRepo
	AreaRepo      *repository.AreaRepo
	UserRepo      *repository.UserRepo
}

func Setup(e *echo.Echo, db *gorm.DB, ctl *ControllerSet) {
	e.Use(middleware.RecoveryMiddleware())
	e.Use(middleware.RequestIDMiddleware())
	e.Use(middleware.LoggerMiddleware(db))
	e.Use(middleware.ErrorHandlerMiddleware())

	e.Use(echomiddleware.CORSWithConfig(echomiddleware.CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-Request-ID"},
		ExposeHeaders:    []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           86400,
	}))

	e.GET("/health", healthHandler)

	api := e.Group("/api/v1")

	api.POST("/auth/login", ctl.AuthCtl.Login)
	api.GET("/devices/report", buildDeviceReportHandler(db))
	api.POST("/devices/report", buildDeviceReportHandler(db))

	auth := api.Group("")
	auth.Use(middleware.AuthMiddleware(db))

	setupAuthRoutes(auth, ctl)
	setupStatsRoutes(auth, ctl)
	setupDeviceRoutes(auth, ctl, db)
	setupCabinetRoutes(auth, ctl)
	setupAreaRoutes(auth, ctl)
	setupFaultRoutes(auth, ctl)
	setupWorkOrderRoutes(auth, ctl)
	setupInspectionRoutes(auth, ctl)
	setupEnergyRoutes(auth, ctl)
	setupUserRoutes(auth, ctl)
}

func healthHandler(c echo.Context) error {
	return c.JSON(http.StatusOK, model.Response{
		Code:      0,
		Message:   "ok",
		Data:      map[string]string{"status": "running", "time": time.Now().Format("2006-01-02 15:04:05")},
		Timestamp: time.Now().Unix(),
	})
}

func buildDeviceReportHandler(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var req service.ReportDeviceStatusRequest
		if err := c.Bind(&req); err != nil {
			return err
		}
		if err := pkg.ValidateStruct(&req); err != nil {
			return err
		}
		ds := service.NewDeviceService(db,
			repository.NewDeviceRepo(db),
			repository.NewCommandRepo(db),
			repository.NewAreaRepo(db),
			repository.NewCabinetRepo(db))
		if err := ds.ReportStatus(context.Background(), &req); err != nil {
			return c.JSON(http.StatusBadRequest, model.Response{
				Code:      400,
				Message:   err.Error(),
				Timestamp: time.Now().Unix(),
			})
		}
		return c.JSON(http.StatusOK, model.Response{
			Code:      0,
			Message:   fmt.Sprintf("device %s report success", req.DeviceCode),
			Timestamp: time.Now().Unix(),
		})
	}
}

func setupAuthRoutes(g *echo.Group, ctl *ControllerSet) {
	g.POST("/auth/logout", ctl.AuthCtl.Logout)
	g.POST("/auth/change-password", ctl.AuthCtl.ChangePassword)
	g.GET("/auth/profile", ctl.AuthCtl.GetProfile)
}

func setupStatsRoutes(g *echo.Group, ctl *ControllerSet) {
	stats := g.Group("/stats")
	stats.GET("/overview", ctl.StatsCtl.GetOverview)
	stats.GET("/lighting-rate-trend", ctl.StatsCtl.GetLightingRateTrend)
	stats.GET("/energy-trend", ctl.StatsCtl.GetEnergyTrend)
	stats.GET("/fault-distribution", ctl.StatsCtl.GetFaultTypeDistribution)
	stats.GET("/area-ranking", ctl.StatsCtl.GetAreaRanking)
}

func setupDeviceRoutes(g *echo.Group, ctl *ControllerSet, db *gorm.DB) {
	devices := g.Group("/devices")
	devices.GET("", ctl.DeviceCtl.ListDevices)
	devices.GET("/:id", ctl.DeviceCtl.GetDevice)
	devices.POST("", ctl.DeviceCtl.CreateDevice, middleware.RoleMiddleware(model.RoleAdmin, model.RoleAreaManager))
	devices.PUT("/:id", ctl.DeviceCtl.UpdateDevice, middleware.RoleMiddleware(model.RoleAdmin, model.RoleAreaManager))
	devices.DELETE("/:id", ctl.DeviceCtl.DeleteDevice, middleware.RoleMiddleware(model.RoleAdmin))
	devices.GET("/:id/status-history", ctl.DeviceCtl.GetDeviceStatusHistory)
	devices.POST("/control", ctl.DeviceCtl.BatchControl, middleware.RoleMiddleware(model.RoleAdmin, model.RoleAreaManager))
	devices.GET("/commands", listCommandsHandler(ctl))
	devices.GET("/commands/:id", ctl.DeviceCtl.GetCommandStatus)
	devices.POST("/commands/:id/retry", ctl.DeviceCtl.RetryCommand)
}

func listCommandsHandler(ctl *ControllerSet) echo.HandlerFunc {
	return func(c echo.Context) error {
		return ctl.DeviceCtl.ListCommands(c, ctl.CommandRepo)
	}
}

func setupCabinetRoutes(g *echo.Group, ctl *ControllerSet) {
	g.GET("/cabinets", func(c echo.Context) error {
		return ctl.DeviceCtl.ListCabinets(c, ctl.CabinetRepo)
	})
}

func setupAreaRoutes(g *echo.Group, ctl *ControllerSet) {
	g.GET("/areas", func(c echo.Context) error {
		return ctl.DeviceCtl.ListAreas(c, ctl.AreaRepo)
	})
}

func setupFaultRoutes(g *echo.Group, ctl *ControllerSet) {
	faults := g.Group("/faults")
	faults.GET("", ctl.FaultCtl.ListFaults)
	faults.GET("/:id", ctl.FaultCtl.GetFault)
	faults.PUT("/:id/handle", ctl.FaultCtl.HandleFault)
	faults.GET("/rules", ctl.FaultCtl.ListFaultRules)
	faults.PUT("/rules/:id", ctl.FaultCtl.UpdateFaultRule, middleware.RoleMiddleware(model.RoleAdmin))
	faults.GET("/alerts", ctl.FaultCtl.ListAlerts)
	faults.POST("/scan", ctl.FaultCtl.TriggerScan, middleware.RoleMiddleware(model.RoleAdmin))
}

func setupWorkOrderRoutes(g *echo.Group, ctl *ControllerSet) {
	wo := g.Group("/workorders")
	wo.GET("", ctl.WorkOrderCtl.ListWorkOrders)
	wo.GET("/mine", ctl.WorkOrderCtl.MyWorkOrders)
	wo.GET("/stats", ctl.WorkOrderCtl.GetStatistics)
	wo.GET("/:id", ctl.WorkOrderCtl.GetWorkOrder)
	wo.POST("", ctl.WorkOrderCtl.CreateWorkOrder)
	wo.PUT("/:id/status", ctl.WorkOrderCtl.TransitionStatus)
	wo.PUT("/:id/assign", ctl.WorkOrderCtl.AssignWorkOrder, middleware.RoleMiddleware(model.RoleAdmin, model.RoleAreaManager))
}

func setupInspectionRoutes(g *echo.Group, ctl *ControllerSet) {
	insp := g.Group("/inspections")
	insp.GET("/plans", ctl.InspectionCtl.ListPlans)
	insp.POST("/plans", ctl.InspectionCtl.CreatePlan, middleware.RoleMiddleware(model.RoleAdmin, model.RoleAreaManager))
	insp.GET("/plans/recommend", ctl.InspectionCtl.RecommendDevices)
	insp.GET("/plans/:id", ctl.InspectionCtl.GetPlan)
	insp.PUT("/plans/:id/status", ctl.InspectionCtl.UpdatePlanStatus)
	insp.POST("/result", ctl.InspectionCtl.SubmitInspectionResult)
	insp.GET("/devices/:id/records", ctl.InspectionCtl.GetDeviceRecords)
}

func setupEnergyRoutes(g *echo.Group, ctl *ControllerSet) {
	energy := g.Group("/energy")
	energy.GET("/stats", ctl.EnergyCtl.GetEnergyStats)
	energy.GET("/yoy", ctl.EnergyCtl.GetYoYComparison)
	energy.GET("/optimization", ctl.EnergyCtl.GetOptimizationReport)
	energy.GET("/abnormal-devices", ctl.EnergyCtl.GetAbnormalDevices)
}

func setupUserRoutes(g *echo.Group, ctl *ControllerSet) {
	users := g.Group("/users", middleware.RoleMiddleware(model.RoleAdmin, model.RoleAreaManager))
	users.GET("", ctl.AuthCtl.ListUsers)
	users.POST("", ctl.AuthCtl.CreateUser, middleware.RoleMiddleware(model.RoleAdmin))
	users.GET("/:id", ctl.UserCtl.GetUser)
	users.PUT("/:id", ctl.AuthCtl.UpdateUser, middleware.RoleMiddleware(model.RoleAdmin))
	users.GET("/operators/list", ctl.UserCtl.ListOperators)
}
