package main

import (
	"log"

	"fishery-api/config"
	"fishery-api/handler"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg := config.LoadConfig()

	if err := config.InitDB(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer config.DB.Close()

	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	v1 := e.Group("/v1")

	vesselHandler := handler.NewVesselHandler()
	catchHandler := handler.NewCatchHandler()
	tradeHandler := handler.NewTradeHandler()
	supplyHandler := handler.NewSupplyHandler()
	forbiddenHandler := handler.NewForbiddenHandler()

	vessels := v1.Group("/vessels")
	{
		vessels.POST("", vesselHandler.CreateVessel)
		vessels.GET("", vesselHandler.ListVessels)
		vessels.GET("/:id", vesselHandler.GetVessel)
		vessels.PUT("/:id", vesselHandler.UpdateVessel)
		vessels.DELETE("/:id", vesselHandler.DeleteVessel)

		vessels.POST("/position", vesselHandler.ReportPosition)
		vessels.GET("/:id/track", vesselHandler.GetTrackHistory)
		vessels.GET("/:id/track/72h", vesselHandler.Get72HourTrack)
		vessels.GET("/:id/position/latest", vesselHandler.GetLatestPosition)
	}

	yawAlerts := v1.Group("/yaw-alerts")
	{
		yawAlerts.GET("", vesselHandler.ListYawAlerts)
		yawAlerts.PUT("/:id/handle", vesselHandler.HandleYawAlert)
	}

	catch := v1.Group("/catch")
	{
		catch.POST("", catchHandler.ReportCatch)
		catch.GET("", catchHandler.ListCatchRecords)
		catch.GET("/:id", catchHandler.GetCatchRecord)
	}

	quotas := v1.Group("/quotas")
	{
		quotas.POST("/annual", catchHandler.CreateAnnualQuota)
		quotas.GET("/annual", catchHandler.ListAnnualQuotas)
		quotas.GET("/annual/detail", catchHandler.GetAnnualQuota)

		quotas.POST("/vessel", catchHandler.CreateVesselQuota)
		quotas.GET("/vessel", catchHandler.ListVesselQuotas)
		quotas.GET("/vessel/:vessel_id/detail", catchHandler.GetVesselQuota)

		quotas.POST("/transfer", catchHandler.CreateQuotaTransfer)
		quotas.GET("/transfer", catchHandler.ListQuotaTransfers)
		quotas.PUT("/transfer/:id/approve", catchHandler.ApproveQuotaTransfer)

		quotas.GET("/warnings/:vessel_id", catchHandler.CheckQuotaWarnings)
	}

	trades := v1.Group("/trades")
	{
		trades.POST("", tradeHandler.CreateTrade)
		trades.GET("", tradeHandler.ListTrades)
		trades.GET("/:id", tradeHandler.GetTrade)
		trades.PUT("/:id/confirm", tradeHandler.ConfirmTrade)
		trades.PUT("/:id/reject", tradeHandler.RejectTrade)

		trades.POST("/settlement/:vessel_id", tradeHandler.GenerateSettlement)
		trades.GET("/settlements", tradeHandler.ListSettlements)

		trades.POST("/disputes", tradeHandler.CreateDispute)
		trades.PUT("/disputes/:id/resolve", tradeHandler.ResolveDispute)
	}

	supply := v1.Group("/supply")
	{
		supply.POST("/fuel-records", supplyHandler.AddFuelRecord)
		supply.GET("/fuel-records", supplyHandler.ListFuelRecords)
		supply.GET("/fuel-status/:vessel_id", supplyHandler.GetVesselFuelStatus)
		supply.POST("/refuel/:vessel_id", supplyHandler.RefuelVessel)

		supply.POST("/points", supplyHandler.CreateSupplyPoint)
		supply.GET("/points", supplyHandler.ListSupplyPoints)
		supply.GET("/points/nearest", supplyHandler.FindNearestSupplyPoint)

		supply.POST("/plans/:vessel_id", supplyHandler.GenerateSupplyPlan)
		supply.GET("/plans", supplyHandler.ListSupplyPlans)
		supply.PUT("/plans/:id/status", supplyHandler.UpdateSupplyPlanStatus)
	}

	forbidden := v1.Group("/forbidden")
	{
		forbidden.POST("/zones", forbiddenHandler.CreateZone)
		forbidden.GET("/zones", forbiddenHandler.ListZones)
		forbidden.GET("/zones/active", forbiddenHandler.GetActiveZones)
		forbidden.PUT("/zones/:id", forbiddenHandler.UpdateZone)

		forbidden.POST("/check", forbiddenHandler.CheckForbiddenZone)

		forbidden.GET("/violations", forbiddenHandler.ListViolations)
		forbidden.PUT("/violations/:id/handle", forbiddenHandler.HandleViolation)
	}

	log.Printf("Server starting on port %s", cfg.Server.Port)
	if err := e.Start(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
