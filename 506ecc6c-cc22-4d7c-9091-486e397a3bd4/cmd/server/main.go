package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gopkg.in/yaml.v3"

	cfgpkg "github.com/labelops/backend/internal/config"
	hdl "github.com/labelops/backend/internal/handler"
	mw "github.com/labelops/backend/internal/middleware"
	"github.com/labelops/backend/internal/model"
	svc "github.com/labelops/backend/internal/service"
	"github.com/labelops/backend/internal/store"
)

func main() {
	cfgFile := "config.yaml"
	if env := os.Getenv("CONFIG_FILE"); env != "" {
		cfgFile = env
	}

	cfg, err := loadConfig(cfgFile)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	redisStore := store.NewRedisStore(&cfg.Redis)
	repo := store.GetDefaultRepo()

	calcSvc := svc.NewCalcService(repo, redisStore)
	crawlerSvc := svc.NewCrawlerService(repo, redisStore)
	monitorSvc := svc.NewMonitorService(repo, redisStore)

	authHdl := hdl.NewAuthHandler(repo, redisStore, &cfg.JWT)
	workHdl := hdl.NewWorkHandler(repo, redisStore)
	royaltyHdl := hdl.NewRoyaltyHandler(repo, redisStore, calcSvc)
	monitorHdl := hdl.NewMonitorHandler(repo, redisStore, crawlerSvc, monitorSvc)

	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(mw.CORS(cfg.Server.CORSOrigins))
	e.Use(middleware.RequestID())

	api := e.Group("/api")

	authGroup := api.Group("/auth")
	{
		authGroup.POST("/login", authHdl.Login)
		authGroup.GET("/validate", authHdl.ValidateToken, mw.JWTAuth(&cfg.JWT))
		authGroup.GET("/me", authHdl.Me, mw.JWTAuth(&cfg.JWT))
		authGroup.POST("/logout", authHdl.Logout, mw.JWTAuth(&cfg.JWT))
		authGroup.GET("/users", authHdl.ListUsers, mw.JWTAuth(&cfg.JWT), mw.RequireRoles(model.RoleAdmin))
		authGroup.GET("/audit-logs", authHdl.ListAuditLogs, mw.JWTAuth(&cfg.JWT), mw.RequireRoles(model.RoleAdmin))
	}

	workGroup := api.Group("/works")
	workGroup.Use(mw.JWTAuth(&cfg.JWT))
	{
		workGroup.GET("", workHdl.ListWorks)
		workGroup.POST("", workHdl.CreateWork, mw.RequireRoles(model.RoleAdmin, model.RoleUserProducer, model.RoleCopyright))
		workGroup.GET("/:id", workHdl.GetWork)
		workGroup.PATCH("/:id/status", workHdl.UpdateWorkStatus, mw.RequireRoles(model.RoleAdmin, model.RoleUserProducer, model.RoleCopyright))
		workGroup.POST("/:id/versions", workHdl.UploadVersion, mw.RequireRoles(model.RoleAdmin, model.RoleUserProducer))
		workGroup.POST("/:id/auth-chain", workHdl.CreateAuthLink, mw.RequireRoles(model.RoleAdmin, model.RoleCopyright))
		workGroup.GET("/:id/validate-cover", workHdl.ValidateCoverAuth)
	}

	artistGroup := api.Group("/artists")
	artistGroup.Use(mw.JWTAuth(&cfg.JWT))
	{
		artistGroup.GET("", workHdl.ListArtists)
		artistGroup.GET("/:id", workHdl.GetArtist)
	}

	royaltyGroup := api.Group("/royalty")
	royaltyGroup.Use(mw.JWTAuth(&cfg.JWT))
	{
		royaltyGroup.GET("/settlements", royaltyHdl.ListSettlements)
		royaltyGroup.POST("/settlements/generate", royaltyHdl.GenerateSettlement, mw.RequireRoles(model.RoleAdmin, model.RoleFinance))
		royaltyGroup.GET("/settlements/:id", royaltyHdl.GetSettlement)
		royaltyGroup.POST("/settlements/:id/status", royaltyHdl.UpdateSettlementStatus, mw.RequireRoles(model.RoleAdmin, model.RoleFinance))
		royaltyGroup.POST("/settlements/compare", royaltyHdl.CompareSettlements)
		royaltyGroup.GET("/rules", royaltyHdl.ListRules)
		royaltyGroup.GET("/rules/:id", royaltyHdl.GetRule)
		royaltyGroup.POST("/rules", royaltyHdl.CreateRule, mw.RequireRoles(model.RoleAdmin, model.RoleFinance))
		royaltyGroup.GET("/dashboard", royaltyHdl.DashboardSummary)
	}

	monitorGroup := api.Group("/monitor")
	monitorGroup.Use(mw.JWTAuth(&cfg.JWT))
	{
		monitorGroup.GET("/piracies", monitorHdl.ListPiracies)
		monitorGroup.GET("/piracies/:id", monitorHdl.GetPiracy)
		monitorGroup.POST("/piracies/scan", monitorHdl.ScanPiracy, mw.RequireRoles(model.RoleAdmin, model.RoleCopyright))
		monitorGroup.POST("/piracies/:id/resolve", monitorHdl.ResolvePiracy, mw.RequireRoles(model.RoleAdmin, model.RoleCopyright))
		monitorGroup.POST("/crawl", monitorHdl.TriggerCrawl, mw.RequireRoles(model.RoleAdmin, model.RoleFinance))
		monitorGroup.GET("/crawl/:id", monitorHdl.GetCrawlerTask)
		monitorGroup.POST("/compare-fingerprint", monitorHdl.CompareFingerprint)
		monitorGroup.GET("/platform-summary", monitorHdl.PlatformDataSummary)
	}

	api.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "1.0.0",
		})
	})

	go scheduleBackgroundTasks(crawlerSvc, monitorSvc, repo, redisStore)

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("LabelOps backend starting on %s...", addr)
	log.Printf("  - CORS origins: %s", cfg.Server.CORSOrigins)
	log.Printf("  - Redis: %s (DB %d)", cfg.Redis.Addr, cfg.Redis.DB)
	log.Printf("  - Mock data: %d works, %d artists, %d piracy records",
		len(repo.GetAllWorkIDs()), len(repo.GetAllArtistIDs()), func() int {
			p, _ := repo.ListPiracies("", "", 0, 10000)
			return len(p)
		}())

	srv := &http.Server{
		Addr:         addr,
		Handler:      e,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}
	log.Println("Server exited gracefully")
}

func loadConfig(path string) (*cfgpkg.Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var cfg cfgpkg.Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return &cfg, nil
}

func scheduleBackgroundTasks(crawler *svc.CrawlerService, monitor *svc.MonitorService, repo *store.MockRepo, redis *store.RedisStore) {
	crawlTicker := time.NewTicker(6 * time.Hour)
	scanTicker := time.NewTicker(24 * time.Hour)
	cacheTicker := time.NewTicker(30 * time.Minute)

	defer func() {
		crawlTicker.Stop()
		scanTicker.Stop()
		cacheTicker.Stop()
	}()

	platforms := []model.Platform{
		model.PlatformNetEase, model.PlatformQQMusic, model.PlatformKugou,
		model.PlatformKuwo, model.PlatformSpotify, model.PlatformAppleMusic,
	}

	log.Println("Background scheduler started")

	for {
		select {
		case <-crawlTicker.C:
			log.Println("[Scheduler] Running daily platform data crawl...")
			start := time.Now().AddDate(0, 0, -2)
			end := time.Now().AddDate(0, 0, -1)
			for _, p := range platforms {
				_, _ = crawler.CrawlPlatformData(context.Background(), p, nil, start, end, 3)
			}

		case <-scanTicker.C:
			log.Println("[Scheduler] Running piracy scan for all works...")
			count, err := monitor.ScanAllWorks(context.Background(), 0.8)
			if err != nil {
				log.Printf("[Scheduler] Piracy scan error: %v", err)
			} else {
				log.Printf("[Scheduler] Piracy scan completed, detected %d suspects", count)
			}

		case <-cacheTicker.C:
			ctx := context.Background()
			keys, _ := redis.Keys(ctx, store.KeyDashboardCache+"*")
			for _, k := range keys {
				_ = redis.Delete(ctx, k)
			}
		}
	}
}
