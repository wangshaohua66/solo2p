package main

import (
	"context"
	"equipment-trading-platform/internal/config"
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/pkg/cache"
	"equipment-trading-platform/pkg/database"
	"equipment-trading-platform/pkg/logger"
	"equipment-trading-platform/pkg/search"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg := config.Load()

	logger.Init(&cfg.Log)
	defer logger.Sync()

	logger.Infof("Starting Equipment Trading Platform...")
	logger.Infof("Server Mode: %s, Port: %d", cfg.Server.Mode, cfg.Server.Port)

	if err := database.Init(&cfg.Database); err != nil {
		logger.Fatalf("init database failed: %v", err)
	}
	logger.Infof("Database connected successfully")

	if err := cache.Init(&cfg.Redis); err != nil {
		logger.Warnf("init redis failed: %v, continue without cache", err)
	} else {
		logger.Infof("Redis connected successfully")
	}

	if err := search.Init(&cfg.Elasticsearch); err != nil {
		logger.Warnf("init elasticsearch failed: %v, continue without full-text search", err)
	} else {
		logger.Infof("Elasticsearch connected successfully")
	}

	userService := service.NewUserService()
	if err := userService.InitRoles(); err != nil {
		logger.Errorf("init roles failed: %v", err)
	} else {
		logger.Infof("Roles initialized")
	}

	deviceService := service.NewDeviceService()
	if err := deviceService.InitCategories(); err != nil {
		logger.Errorf("init device categories failed: %v", err)
	} else {
		logger.Infof("Device categories initialized")
	}

	router := SetupRouter()

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	go func() {
		logger.Infof("Server listening on :%d", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Infof("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Errorf("server shutdown error: %v", err)
	}

	logger.Infof("Server exited")
}
