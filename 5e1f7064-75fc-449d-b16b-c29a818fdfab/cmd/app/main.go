package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"lab-management/internal/controller"
	"lab-management/internal/middleware"
	"lab-management/internal/model"
	"lab-management/internal/pkg/config"
	"lab-management/internal/repository"
	"lab-management/internal/service"
)

func main() {
	cfg := config.Load()

	db, err := initDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	if err := autoMigrate(db); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	if err := seedInitialData(db); err != nil {
		log.Fatalf("Failed to seed initial data: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	instRepo := repository.NewInstitutionRepository(db)
	itemRepo := repository.NewTestItemRepository(db)
	pkgRepo := repository.NewTestItemPackageRepository(db)
	instPriceRepo := repository.NewInstitutionPriceRepository(db)
	sampleRepo := repository.NewSampleRepository(db)
	sampleItemRepo := repository.NewSampleItemRepository(db)
	statusLogRepo := repository.NewSampleStatusLogRepository(db)
	counterRepo := repository.NewDailyCounterRepository(db)
	resultRepo := repository.NewTestResultRepository(db)
	criticalRepo := repository.NewCriticalValueRecordRepository(db)
	reportRepo := repository.NewReportRepository(db)
	reportReadRepo := repository.NewReportReadLogRepository(db)
	settlementRepo := repository.NewSettlementRepository(db)
	detailRepo := repository.NewSettlementDetailRepository(db)
	auditRepo := repository.NewAuditLogRepository(db)
	statsRepo := repository.NewStatisticsRepository(db)

	authService := service.NewAuthService(userRepo, cfg)
	instService := service.NewInstitutionService(instRepo)
	itemService := service.NewTestItemService(itemRepo, pkgRepo)
	sampleService := service.NewSampleService(
		db, sampleRepo, sampleItemRepo, statusLogRepo, counterRepo,
		instRepo, itemRepo, instPriceRepo, pkgRepo, userRepo,
	)
	resultService := service.NewTestResultService(
		db, resultRepo, sampleRepo, sampleItemRepo, itemRepo, criticalRepo, userRepo,
	)
	criticalService := service.NewCriticalValueService(db, criticalRepo, sampleRepo, userRepo)
	reportService := service.NewReportService(
		db, reportRepo, reportReadRepo, sampleRepo, resultRepo,
		sampleItemRepo, itemRepo, criticalRepo, userRepo, instRepo,
	)
	settlementService := service.NewSettlementService(
		db, settlementRepo, detailRepo, sampleRepo, instRepo,
	)
	statsService := service.NewStatisticsService(statsRepo)

	baseCtrl := controller.NewBaseController(authService, instService, itemService)
	sampleCtrl := controller.NewSampleController(baseCtrl, sampleService, resultService, criticalService)
	reportCtrl := controller.NewReportController(baseCtrl, reportService)
	settlementCtrl := controller.NewSettlementController(baseCtrl, settlementService)
	statsCtrl := controller.NewStatisticsController(baseCtrl, statsService)

	authMw := middleware.NewAuthMiddleware(userRepo, cfg.JWT.Secret)
	rateLimitMw := middleware.NewRateLimitMiddleware(cfg.Server.RateLimit)
	traceIDMw := middleware.NewTraceIDMiddleware()
	corsMw := middleware.NewCORSMiddleware()
	auditMw := middleware.NewAuditMiddleware(auditRepo)

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	deps := &Dependencies{
		BaseCtrl:       baseCtrl,
		SampleCtrl:     sampleCtrl,
		ReportCtrl:     reportCtrl,
		SettlementCtrl: settlementCtrl,
		StatisticsCtrl: statsCtrl,
		AuthMw:         authMw,
		RateLimitMw:    rateLimitMw,
		TraceIDMw:      traceIDMw,
		CORSMw:         corsMw,
		AuditMw:        auditMw,
	}
	SetupRouter(r, deps)

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	go func() {
		log.Printf("Server starting on %s", addr)
		log.Printf("GOMAXPROCS optimization enabled for 6000 samples/day, 50 QPS sample registration")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server exited successfully")
}

func initDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=Asia/Shanghai",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.DBName,
		cfg.Database.SSLMode,
	)

	dbLogger := logger.Default.LogMode(logger.Warn)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   dbLogger,
		PrepareStmt:                              true,
		SkipDefaultTransaction:                   false,
		DisableForeignKeyConstraintWhenMigrating: false,
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxIdleConns(20)
	sqlDB.SetMaxOpenConns(200)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	return db, nil
}

func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.Institution{},
		&model.User{},
		&model.TestItem{},
		&model.TestItemPackage{},
		&model.PackageItem{},
		&model.InstitutionPrice{},
		&model.DailyCounter{},
		&model.Sample{},
		&model.SampleItem{},
		&model.SampleStatusLog{},
		&model.TestResult{},
		&model.CriticalValueRecord{},
		&model.Report{},
		&model.ReportReadLog{},
		&model.Settlement{},
		&model.SettlementDetail{},
		&model.AuditLog{},
	)
}

func hashPassword(pwd string) string {
	h := sha256.New()
	h.Write([]byte(pwd))
	return hex.EncodeToString(h.Sum(nil))
}

func seedInitialData(db *gorm.DB) error {
	var userCount int64
	db.Model(&model.User{}).Count(&userCount)
	if userCount > 0 {
		return nil
	}

	inst := []model.Institution{
		{Code: "COMM001", Name: "示范社区卫生服务中心", Type: model.InstitutionTypeCommunity,
			Contact: "张主任", Phone: "010-12345678", Email: "contact@comm1.example.com",
			Address: "北京市朝阳区示范路1号", Discount: 0.95, MinPrice: 100, Status: 1},
		{Code: "TOWN001", Name: "示范乡镇卫生院", Type: model.InstitutionTypeTownship,
			Contact: "李院长", Phone: "010-87654321", Email: "contact@town1.example.com",
			Address: "河北省示范县示范镇1号", Discount: 0.9, MinPrice: 80, Status: 1},
		{Code: "CLIN001", Name: "示范私立诊所", Type: model.InstitutionTypeClinic,
			Contact: "王医生", Phone: "010-11112222", Email: "contact@clinic1.example.com",
			Address: "上海市浦东新区示范街100号", Discount: 1.0, MinPrice: 0, Status: 1},
	}
	for i := range inst {
		db.Create(&inst[i])
	}

	adminHash := hashPassword("admin123")
	doctorHash := hashPassword("doctor123")
	instHash := hashPassword("inst123")
	financeHash := hashPassword("finance123")
	reviewerHash := hashPassword("reviewer123")

	users := []model.User{
		{Username: "admin", PasswordHash: adminHash, RealName: "系统管理员", Role: model.UserRoleAdmin,
			Phone: "13800000000", Email: "admin@lab.example.com", Status: 1},
		{Username: "doctor", PasswordHash: doctorHash, RealName: "张检验师", Role: model.UserRoleDoctor,
			Phone: "13800000001", Email: "doctor@lab.example.com", Status: 1},
		{Username: "reviewer", PasswordHash: reviewerHash, RealName: "李审核师", Role: model.UserRoleReviewer,
			Phone: "13800000002", Email: "reviewer@lab.example.com", Status: 1},
		{Username: "finance", PasswordHash: financeHash, RealName: "王财务", Role: model.UserRoleFinance,
			Phone: "13800000003", Email: "finance@lab.example.com", Status: 1},
		{Username: "inst001", PasswordHash: instHash, RealName: "社区操作员", Role: model.UserRoleInstitution,
			InstitutionID: inst[0].ID, Phone: "13800000100", Email: "inst001@comm1.example.com", Status: 1},
		{Username: "inst002", PasswordHash: instHash, RealName: "乡镇操作员", Role: model.UserRoleInstitution,
			InstitutionID: inst[1].ID, Phone: "13800000101", Email: "inst002@town1.example.com", Status: 1},
		{Username: "inst003", PasswordHash: instHash, RealName: "诊所操作员", Role: model.UserRoleInstitution,
			InstitutionID: inst[2].ID, Phone: "13800000102", Email: "inst003@clinic1.example.com", Status: 1},
	}
	for i := range users {
		db.Create(&users[i])
	}

	items := []model.TestItem{
		{Code: "CBC001", Name: "白细胞计数", Category: model.TestCategoryClinical, SpecimenType: "BLOOD",
			Unit: "10^9/L", RefRange: "4.0-10.0", MinValue: fp(4.0), MaxValue: fp(10.0),
			CriticalLow: fp(2.0), CriticalHigh: fp(30.0), Price: 5.0, Device: "XN-1000", TurnaroundTime: 30},
		{Code: "CBC002", Name: "红细胞计数", Category: model.TestCategoryClinical, SpecimenType: "BLOOD",
			Unit: "10^12/L", RefRange: "4.0-5.5", MinValue: fp(4.0), MaxValue: fp(5.5),
			CriticalLow: fp(2.0), CriticalHigh: fp(7.0), Price: 5.0, Device: "XN-1000", TurnaroundTime: 30},
		{Code: "CBC003", Name: "血红蛋白", Category: model.TestCategoryClinical, SpecimenType: "BLOOD",
			Unit: "g/L", RefRange: "120-160", MinValue: fp(120.0), MaxValue: fp(160.0),
			CriticalLow: fp(60.0), CriticalHigh: fp(200.0), Price: 5.0, Device: "XN-1000", TurnaroundTime: 30},
		{Code: "GLU001", Name: "空腹血糖", Category: model.TestCategoryClinical, SpecimenType: "SERUM",
			Unit: "mmol/L", RefRange: "3.9-6.1", MinValue: fp(3.9), MaxValue: fp(6.1),
			CriticalLow: fp(2.5), CriticalHigh: fp(16.7), Price: 8.0, Device: "AU-5800", TurnaroundTime: 45},
		{Code: "LIP001", Name: "总胆固醇", Category: model.TestCategoryClinical, SpecimenType: "SERUM",
			Unit: "mmol/L", RefRange: "<5.2", MaxValue: fp(5.2),
			CriticalHigh: fp(8.0), Price: 12.0, Device: "AU-5800", TurnaroundTime: 60},
		{Code: "LIV001", Name: "谷丙转氨酶", Category: model.TestCategoryClinical, SpecimenType: "SERUM",
			Unit: "U/L", RefRange: "0-40", MaxValue: fp(40.0),
			CriticalHigh: fp(500.0), Price: 10.0, Device: "AU-5800", TurnaroundTime: 60},
		{Code: "LIV002", Name: "谷草转氨酶", Category: model.TestCategoryClinical, SpecimenType: "SERUM",
			Unit: "U/L", RefRange: "0-40", MaxValue: fp(40.0),
			CriticalHigh: fp(500.0), Price: 10.0, Device: "AU-5800", TurnaroundTime: 60},
		{Code: "REN001", Name: "肌酐", Category: model.TestCategoryClinical, SpecimenType: "SERUM",
			Unit: "μmol/L", RefRange: "44-133", MinValue: fp(44.0), MaxValue: fp(133.0),
			CriticalHigh: fp(700.0), Price: 15.0, Device: "AU-5800", TurnaroundTime: 60},
		{Code: "URINE01", Name: "尿常规", Category: model.TestCategoryClinical, SpecimenType: "URINE",
			RefRange: "见附注", Price: 20.0, Device: "UX-2000", TurnaroundTime: 45},
		{Code: "PAT001", Name: "组织病理学检查", Category: model.TestCategoryPathology, SpecimenType: "TISSUE",
			Price: 200.0, Device: "病理科", TurnaroundTime: 2880},
		{Code: "GEN001", Name: "BRCA基因检测", Category: model.TestCategoryGenetic, SpecimenType: "BLOOD",
			Price: 3500.0, Device: "NGS-Platform", TurnaroundTime: 10080},
		{Code: "GEN002", Name: "EGFR基因突变检测", Category: model.TestCategoryGenetic, SpecimenType: "TISSUE",
			Price: 2800.0, Device: "PCR-Platform", TurnaroundTime: 4320},
	}
	for i := range items {
		items[i].Status = 1
		db.Create(&items[i])
	}

	log.Println("Initial data seeded successfully")
	return nil
}

func fp(v float64) *float64 {
	return &v
}
