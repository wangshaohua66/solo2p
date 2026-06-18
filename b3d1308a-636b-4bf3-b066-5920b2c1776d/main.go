package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"smart-lighting-api/config"
	"smart-lighting-api/controller"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"
	"smart-lighting-api/router"
	"smart-lighting-api/service"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	config.Load()
	pkg.InitLogger()
	defer pkg.SyncLogger()

	db := initDB()
	if db == nil {
		log.Fatal("Failed to initialize database")
		os.Exit(1)
	}

	autoMigrate(db)

	deviceRepo := repository.NewDeviceRepo(db)
	faultRepo := repository.NewFaultRepo(db)
	workOrderRepo := repository.NewWorkOrderRepo(db)
	inspectionRepo := repository.NewInspectionRepo(db)
	energyRepo := repository.NewEnergyRepo(db)
	commandRepo := repository.NewCommandRepo(db)
	userRepo := repository.NewUserRepo(db)
	areaRepo := repository.NewAreaRepo(db)
	cabinetRepo := repository.NewCabinetRepo(db)

	authService := service.NewAuthService(db, userRepo)
	deviceService := service.NewDeviceService(db, deviceRepo, commandRepo, areaRepo, cabinetRepo)
	alertEngine := service.NewAlertEngine(db, deviceRepo, faultRepo, workOrderRepo, userRepo, areaRepo)
	workOrderService := service.NewWorkOrderService(db, workOrderRepo, deviceRepo, faultRepo, userRepo)
	scheduleService := service.NewScheduleService(db, inspectionRepo, deviceRepo, workOrderRepo, userRepo)
	energyService := service.NewEnergyService(db, energyRepo, deviceRepo, inspectionRepo, areaRepo)
	statsService := service.NewStatsService(db, deviceRepo, faultRepo, workOrderRepo, energyRepo, areaRepo)

	ctx := context.Background()
	if err := authService.InitDefaultAdmin(ctx); err != nil {
		pkg.Warn(ctx, "Failed to init default admin", zap.Error(err))
	}
	if err := alertEngine.InitDefaultRules(ctx); err != nil {
		pkg.Warn(ctx, "Failed to init default rules", zap.Error(err))
	}

	deviceCtl := controller.NewDeviceController(deviceService, deviceRepo, alertEngine)
	faultCtl := controller.NewFaultController(db, faultRepo, alertEngine, deviceService)
	workOrderCtl := controller.NewWorkOrderController(workOrderRepo, workOrderService, deviceService)
	inspectionCtl := controller.NewInspectionController(inspectionRepo, scheduleService, deviceService)
	energyCtl := controller.NewEnergyController(energyService, deviceService)
	statsCtl := controller.NewStatsController(statsService, deviceService, commandRepo)
	authCtl := controller.NewAuthController(authService, userRepo)
	userCtl := controller.NewUserController(userRepo, authService)

	ctlSet := &router.ControllerSet{
		DeviceCtl:     deviceCtl,
		FaultCtl:      faultCtl,
		WorkOrderCtl:  workOrderCtl,
		InspectionCtl: inspectionCtl,
		EnergyCtl:     energyCtl,
		StatsCtl:      statsCtl,
		AuthCtl:       authCtl,
		UserCtl:       userCtl,
		CommandRepo:   commandRepo,
		CabinetRepo:   cabinetRepo,
		AreaRepo:      areaRepo,
		UserRepo:      userRepo,
	}

	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	router.Setup(e, db, ctlSet)

	startBackgroundJobs(ctx, db, alertEngine, energyService, userRepo)

	serverPort := config.AppConf.Server.Port
	addr := fmt.Sprintf(":%d", serverPort)

	go func() {
		pkg.Info(ctx, fmt.Sprintf("Server starting on %s", addr))
		if err := e.Start(addr); err != nil {
			pkg.Info(ctx, fmt.Sprintf("Server stopped: %v", err)))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	pkg.Info(ctx, "Shutting down server...")

	shutdownCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := e.Shutdown(shutdownCtx); err != nil {
		pkg.Error(ctx, "Server forced to shutdown", zap.Error(err))
	}

	pkg.Info(ctx, "Server exited properly")
}

func initDB() *gorm.DB {
	cfg := config.AppConf.MySQL
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local&timeout=10s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)

	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	var db *gorm.DB
	var err error
	for i := 0; i < 5; i++ {
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: newLogger,
		})
		if err == nil {
			break
		}
		log.Printf("Failed to connect database (attempt %d/5): %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		log.Printf("Database connection failed after 5 attempts")
		return nil
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Printf("Failed to get sql.DB: %v", err)
		return nil
	}

	sqlDB.SetMaxOpenConns(config.AppConf.MySQL.MaxOpenConns)
	sqlDB.SetMaxIdleConns(config.AppConf.MySQL.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(config.AppConf.MySQL.MaxLifetime) * time.Second)

	log.Println("Database connected successfully")
	return db
}

func autoMigrate(db *gorm.DB) {
	entities := []interface{}{
		&model.User{},
		&model.Area{},
		&model.Cabinet{},
		&model.Device{},
		&model.DeviceStatus{},
		&model.FaultRule{},
		&model.Fault{},
		&model.Alert{},
		&model.WorkOrder{},
		&model.WorkOrderLog{},
		&model.InspectionPlan{},
		&model.InspectionRecord{},
		&model.EnergyDaily{},
		&model.ControlCommand{},
		&model.ControlCommandDetail{},
		&model.TokenBlacklist{},
		&model.OperationLog{},
	}
	if err := db.AutoMigrate(entities...); err != nil {
		log.Printf("Auto migration failed: %v", err)
	} else {
		log.Println("Database migration completed")
	}
}

func startBackgroundJobs(ctx context.Context, db *gorm.DB,
	alertEngine *service.AlertEngine,
	energyService *service.EnergyService,
	userRepo *repository.UserRepo) {

	scanInterval := time.Duration(config.AppConf.App.DeviceScanInterval) * time.Minute
	energyHour := config.AppConf.App.EnergyCalcHour
	retentionDays := config.AppConf.App.DataRetentionDays

	go func() {
		ticker := time.NewTicker(scanInterval)
		defer ticker.Stop()
		for range ticker.C {
			_, err := alertEngine.ScanAndDetectFaults(ctx)
			if err != nil {
				pkg.Error(ctx, "Periodic fault scan failed", zap.Error(err))
			}
		}
	}()
	pkg.Info(ctx, fmt.Sprintf("Fault scan job started, interval: %v", scanInterval))

	go func() {
		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day(), energyHour, 0, 0, 0, now.Location())
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			wait := next.Sub(now)
			pkg.Info(ctx, fmt.Sprintf("Energy calc job will run at %s (in %v)", next.Format("15:04:05"), wait))
			time.Sleep(wait)

			yesterday := time.Now().AddDate(0, 0, -1)
			if err := energyService.CalculateDailyEnergy(ctx, yesterday); err != nil {
				pkg.Error(ctx, "Daily energy calc failed", zap.Error(err))
			}

			deviceRepo := repository.NewDeviceRepo(db)
			if rows, err := deviceRepo.CleanOldStatus(ctx, retentionDays); err != nil {
				pkg.Error(ctx, "Clean old status failed", zap.Error(err))
			} else {
				pkg.Info(ctx, fmt.Sprintf("Cleaned %d old device status records", rows))
			}

			if rows, err := userRepo.CleanExpiredTokens(ctx); err != nil {
				pkg.Error(ctx, "Clean expired tokens failed", zap.Error(err))
			} else {
				pkg.Info(ctx, fmt.Sprintf("Cleaned %d expired tokens", rows))
			}

			time.Sleep(25 * time.Hour)
		}
	}()
	pkg.Info(ctx, "Energy calc scheduler started")
}
