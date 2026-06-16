package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"

	"offshore-wind-ops/internal/config"
	"offshore-wind-ops/internal/handler"
	alertHandler "offshore-wind-ops/internal/handler/alert"
	sparepartsHandler "offshore-wind-ops/internal/handler/spareparts"
	turbineHandler "offshore-wind-ops/internal/handler/turbine"
	voyageHandler "offshore-wind-ops/internal/handler/voyage"
	personnelHandler "offshore-wind-ops/internal/handler/personnel"
	"offshore-wind-ops/internal/middleware"
	"offshore-wind-ops/internal/repository"
	authService "offshore-wind-ops/internal/service/auth"
	healthService "offshore-wind-ops/internal/service/health"
	personnelService "offshore-wind-ops/internal/service/personnel"
	reportService "offshore-wind-ops/internal/service/report"
	sparepartsService "offshore-wind-ops/internal/service/spareparts"
	voyageService "offshore-wind-ops/internal/service/voyage"
	weatherService "offshore-wind-ops/internal/service/weather"
	workorderService "offshore-wind-ops/internal/service/workorder"
	weatherClient "offshore-wind-ops/pkg/weather"
)

func main() {
	cfg := config.Load()

	mongoClient, err := repository.NewMongoClient(&cfg.MongoDB)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer mongoClient.Close(context.Background())

	db := mongoClient.GetDatabase()

	userRepo := repository.NewUserRepository(db)
	authRepo := repository.NewAuthRepository(db)
	turbineRepo := repository.NewTurbineRepository(db)
	woRepo := repository.NewWorkOrderRepository(db)
	voyageRepo := repository.NewVoyageRepository(db)
	personnelRepo := repository.NewPersonnelRepository(db)
	sparePartsRepo := repository.NewSparePartsRepository(db)
	alertRepo := repository.NewAlertRepository(db)
	reportRepo := repository.NewReportRepository(db)

	jwtCfg := &middleware.JWTConfig{
		Secret:            cfg.JWT.Secret,
		AccessTokenExpiry: cfg.JWT.AccessTokenExpiry,
		RefreshTokenExpiry: cfg.JWT.RefreshTokenExpiry,
		Issuer:            cfg.JWT.Issuer,
	}

	weatherAPIClient := weatherClient.NewMockClient()

	authSvc := authService.NewService(userRepo, authRepo, jwtCfg)
	healthSvc := healthService.NewService(turbineRepo, woRepo, alertRepo)
	weatherSvc := weatherService.NewService(voyageRepo, alertRepo, weatherAPIClient)
	personnelSvc := personnelService.NewService(personnelRepo, alertRepo, voyageRepo)
	spareSvc := sparepartsService.NewService(sparePartsRepo, alertRepo)
	woSvc := workorderService.NewService(woRepo, turbineRepo, spareSvc)
	voyageSvc := voyageService.NewService(voyageRepo, personnelRepo, weatherSvc)
	reportSvc := reportService.NewService(reportRepo, turbineRepo, alertRepo)

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.CORS())
	e.Use(middleware.RequestID())
	e.Use(middleware.Recover())
	e.Use(middleware.Gzip())
	e.Use(middleware.BodyLimit("10MB"))
	e.Use(middleware.RateLimit(cfg.RateLimit.RequestsPerMinute))

	api := e.Group("/api/v1")

	authHdl := handler.NewAuthHandler(authSvc)
	authHdl.RegisterRoutes(api)

	turbineHdl := turbineHandler.NewHandler(healthSvc, woSvc)
	turbineHdl.RegisterRoutes(api, cfg.JWT.Secret)

	voyageHdl := voyageHandler.NewHandler(voyageSvc, weatherSvc)
	voyageHdl.RegisterRoutes(api, cfg.JWT.Secret)

	personnelHdl := personnelHandler.NewHandler(personnelSvc)
	personnelHdl.RegisterRoutes(api, cfg.JWT.Secret)

	alertHdl := alertHandler.NewHandler(alertRepo, reportSvc)
	alertHdl.RegisterRoutes(api, cfg.JWT.Secret)

	spareHdl := sparepartsHandler.NewHandler(spareSvc)
	spareHdl.RegisterRoutes(api, cfg.JWT.Secret)

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	go startHealthCheckScheduler(healthSvc)
	go startCertificateMonitor(personnelSvc)
	go startInventoryMonitor(spareSvc)
	go startWeatherStatusUpdater(weatherSvc)
	go startEvacuationAlerter(personnelSvc)

	server := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	go func() {
		log.Printf("Server starting on port %s", cfg.Server.Port)
		if err := e.StartServer(server); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}

func startHealthCheckScheduler(healthSvc *healthService.Service) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	log.Println("Health check scheduler started")
	for range ticker.C {
		_, err := healthSvc.BatchCalculateHealth(context.Background(), "")
		if err != nil {
			log.Printf("Batch health check error: %v", err)
		}
	}
}

func startCertificateMonitor(personnelSvc *personnelService.Service) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	log.Println("Certificate monitor started")
	for range ticker.C {
		_, err := personnelSvc.CheckExpiringCertificates(context.Background(), 30)
		if err != nil {
			log.Printf("Certificate check error: %v", err)
		}
	}
}

func startInventoryMonitor(spareSvc *sparepartsService.Service) {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	log.Println("Inventory monitor started")
	for range ticker.C {
		_, err := spareSvc.CheckAndGenerateRestockAlerts(context.Background(), "")
		if err != nil {
			log.Printf("Inventory monitor error: %v", err)
		}
	}
}

func startWeatherStatusUpdater(weatherSvc *weatherService.Service) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	log.Println("Weather status updater started")
	for range ticker.C {
		start := time.Now()
		count, err := weatherSvc.UpdateVoyagesWeatherStatus(context.Background(), "")
		if err != nil {
			log.Printf("Weather status update error: %v", err)
		} else {
			log.Printf("Weather status update complete: %d voyages updated, elapsed=%v", count, time.Since(start))
		}
	}
}

func startEvacuationAlerter(personnelSvc *personnelService.Service) {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	log.Println("Evacuation alerter started")
	for range ticker.C {
		start := time.Now()
		count, err := personnelSvc.CheckUnacknowledgedEvacuations(context.Background())
		if err != nil {
			log.Printf("Evacuation check error: %v", err)
		} else if count > 0 {
			log.Printf("Evacuation check complete: %d unacknowledged alerts generated, elapsed=%v", count, time.Since(start))
		}
	}
}
