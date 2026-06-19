package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	echoSwagger "github.com/swaggo/echo-swagger"

	"port-ops-system/internal/handler"
	appMiddleware "port-ops-system/internal/middleware"
	"port-ops-system/internal/repository"
	"port-ops-system/internal/service"
)

// @title Port Operations Management System API
// @version 1.0.0
// @description 港口集装箱码头智能运营管理系统 RESTful API
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found: %v", err)
	}

	e := echo.New()

	e.Use(appMiddleware.ErrorHandler())
	e.Use(appMiddleware.RequestLogger())
	e.Use(appMiddleware.CORSMiddleware())
	e.Use(middleware.Recover())

	repo, err := repository.NewRepository()
	if err != nil {
		log.Printf("Warning: Repository initialization issue: %v", err)
	}

	containerRepo := repository.NewContainerRepository(repo)
	yardRepo := repository.NewYardRepository(repo)
	yardSlotRepo := repository.NewYardSlotRepository(repo)

	berthRepo := repository.NewBerthRepository(repo)
	craneRepo := repository.NewQuayCraneRepository(repo)
	vesselRepo := repository.NewVesselRepository(repo)
	vesselCallRepo := repository.NewVesselCallRepository(repo)
	berthPlanRepo := repository.NewBerthPlanRepository(repo)
	craneAssignmentRepo := repository.NewCraneAssignmentRepository(repo)

	reeferRepo := repository.NewReeferRepository(repo)
	tempReadingRepo := repository.NewTemperatureReadingRepository(repo)
	alertRepo := repository.NewAlertRepository(repo)

	appointmentRepo := repository.NewAppointmentRepository(repo)
	dangerousRepo := repository.NewDangerousRepository(repo)
	statsRepo := repository.NewStatisticsRepository(repo)
	billingRepo := repository.NewBillingRepository(repo)

	containerSvc := service.NewContainerService(containerRepo, yardRepo, yardSlotRepo)
	berthSvc := service.NewBerthService(berthRepo, craneRepo, vesselRepo, vesselCallRepo, berthPlanRepo, craneAssignmentRepo)
	reeferSvc := service.NewReeferService(reeferRepo, tempReadingRepo, alertRepo, containerRepo)
	appointmentSvc := service.NewAppointmentService(appointmentRepo)
	dangerousSvc := service.NewDangerousService(dangerousRepo)
	statsSvc := service.NewStatisticsService(statsRepo)
	billingSvc := service.NewBillingService(billingRepo, containerRepo)

	containerHandler := handler.NewContainerHandler(containerSvc)
	berthHandler := handler.NewBerthHandler(berthSvc)
	reeferHandler := handler.NewReeferHandler(reeferSvc)
	appointmentHandler := handler.NewAppointmentHandler(appointmentSvc)
	dangerousHandler := handler.NewDangerousHandler(dangerousSvc)
	statisticsHandler := handler.NewStatisticsHandler(statsSvc)
	billingHandler := handler.NewBillingHandler(billingSvc)
	authHandler := handler.NewAuthHandler()

	api := e.Group("/api/v1")

	auth := api.Group("")
	auth.POST("/auth/login", authHandler.Login)
	auth.POST("/auth/logout", authHandler.Logout, appMiddleware.AuthMiddleware())

	containers := api.Group("/containers", appMiddleware.AuthMiddleware())
	containers.POST("", containerHandler.Create)
	containers.GET("", containerHandler.List)
	containers.GET("/:id", containerHandler.Get)
	containers.GET("/no/:no", containerHandler.GetByNo)
	containers.PUT("/:id", containerHandler.Update)
	containers.POST("/recommend-slot", containerHandler.RecommendSlot)
	containers.POST("/assign-slot", containerHandler.AssignSlot)
	containers.GET("/:id/reshuffle-plan", containerHandler.GetReshufflePlan)
	containers.GET("/yards", containerHandler.ListYards)
	containers.GET("/yards/:id", containerHandler.GetYard)

	berths := api.Group("/berths", appMiddleware.AuthMiddleware())
	berths.GET("", berthHandler.ListBerths)
	berths.GET("/:id", berthHandler.GetBerth)
	berths.GET("/cranes", berthHandler.ListCranes)
	berths.GET("/cranes/:id", berthHandler.GetCrane)
	berths.GET("/vessel-calls", berthHandler.ListVesselCalls)
	berths.GET("/vessel-calls/:id", berthHandler.GetVesselCall)
	berths.POST("/vessel-calls", berthHandler.CreateVesselCall)
	berths.POST("/generate-schedule", berthHandler.GenerateSchedule)
	berths.POST("/plans", berthHandler.ConfirmPlan)
	berths.GET("/plans", berthHandler.ListPlans)
	berths.PUT("/plans/:id", berthHandler.AdjustPlan)
	berths.DELETE("/plans/:id", berthHandler.DeletePlan)

	appointments := api.Group("/appointments", appMiddleware.AuthMiddleware())
	appointments.POST("", appointmentHandler.Create)
	appointments.GET("", appointmentHandler.List)
	appointments.GET("/:id", appointmentHandler.Get)
	appointments.GET("/no/:no", appointmentHandler.GetByNo)
	appointments.POST("/:id/check-in", appointmentHandler.CheckIn)
	appointments.POST("/:id/check-out", appointmentHandler.CheckOut)
	appointments.POST("/:id/cancel", appointmentHandler.Cancel)
	appointments.POST("/verify", appointmentHandler.Verify)
	appointments.GET("/gates/list", appointmentHandler.ListGates)
	appointments.POST("/blacklist", appointmentHandler.AddBlacklist)

	referrers := api.Group("/referrers", appMiddleware.AuthMiddleware())
	referrers.POST("", reeferHandler.RegisterReefer)
	referrers.GET("/container/:container_id", reeferHandler.GetReeferByContainer)
	referrers.POST("/temperature", reeferHandler.ReportTemperature)
	referrers.POST("/temperature/batch", reeferHandler.BatchReportTemperature)
	referrers.GET("/alerts/active", reeferHandler.ListActiveAlerts)
	referrers.GET("/work-orders", reeferHandler.ListWorkOrders)
	referrers.POST("/work-orders/:id/handle", reeferHandler.HandleWorkOrder)
	referrers.POST("/alerts/:id/escalate", reeferHandler.EscalateAlert)
	referrers.GET("/container/:container_id/temperature-history", reeferHandler.GetTemperatureHistory)
	referrers.GET("/with-alerts", reeferHandler.ListReefersWithAlert)

	dangerous := api.Group("/dangerous", appMiddleware.AuthMiddleware())
	dangerous.POST("", dangerousHandler.CreateDangerousGoods)
	dangerous.GET("/container/:container_id", dangerousHandler.GetDangerousByContainer)
	dangerous.POST("/declarations", dangerousHandler.SubmitDeclaration)
	dangerous.GET("/declarations", dangerousHandler.ListDeclarations)
	dangerous.GET("/declarations/:id", dangerousHandler.GetDeclaration)
	dangerous.PUT("/declarations/:id/status", dangerousHandler.UpdateDeclarationStatus)
	dangerous.POST("/inspections", dangerousHandler.CreateInspection)

	statistics := api.Group("/statistics", appMiddleware.AuthMiddleware())
	statistics.GET("/overview", statisticsHandler.GetPortOverview)
	statistics.GET("/yard", statisticsHandler.GetYardStatistics)
	statistics.GET("/throughput/daily", statisticsHandler.GetDailyThroughput)
	statistics.GET("/berth/utilization", statisticsHandler.GetBerthUtilization)
	statistics.GET("/crane/performance", statisticsHandler.GetCranePerformance)
	statistics.GET("/container-types", statisticsHandler.GetContainerTypeStats)

	billing := api.Group("/billing", appMiddleware.AuthMiddleware())
	billing.GET("/calculate/:container_id", billingHandler.CalculateStorageFee)
	billing.POST("/bills", billingHandler.CreateBill)
	billing.GET("/bills", billingHandler.ListBills)
	billing.GET("/bills/:id", billingHandler.GetBill)
	billing.POST("/rates", billingHandler.CreateRate)
	billing.GET("/rates", billingHandler.ListRates)
	billing.POST("/invoices", billingHandler.CreateInvoice)
	billing.GET("/invoices", billingHandler.ListInvoices)
	billing.GET("/invoices/:id", billingHandler.GetInvoice)
	billing.POST("/payments", billingHandler.RecordPayment)

	e.GET("/swagger/*", echoSwagger.WrapHandler)

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]interface{}{
			"status":    "ok",
			"db_status": repo.IsConnected(),
		})
	})

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}
	host := os.Getenv("SERVER_HOST")
	if host == "" {
		host = "0.0.0.0"
	}

	addr := fmt.Sprintf("%s:%s", host, port)
	log.Printf("Server starting on %s", addr)
	log.Printf("Swagger UI: http://localhost:%s/swagger/index.html", port)

	if err := e.Start(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
