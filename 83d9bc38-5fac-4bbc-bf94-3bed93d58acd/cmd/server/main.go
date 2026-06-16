// @title 科研仪器预约管理系统 API
// @version 1.0
// @description 高校科研仪器共享预约管理系统，提供设备管理、预约调度、自动计费、维护保养、统计分析等功能。
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.university.edu.cn/support
// @contact.email support@university.edu.cn

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api
// @schemes http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

// @tag.name 认证
// @tag.description 用户认证相关接口

// @tag.name 设备管理
// @tag.description 设备CRUD、状态管理、统计

// @tag.name 预约管理
// @tag.description 预约创建、取消、冲突检测、等待队列

// @tag.name 计费管理
// @tag.description 账单查询、经费管理、报表导出

// @tag.name 维护管理
// @tag.description 维护计划、完成、取消

// @tag.name 统计分析
// @tag.description 利用率统计、趋势分析、峰谷分布

// @tag.name 通知管理
// @tag.description 站内信通知、未读统计

// @tag.name 用户管理
// @tag.description 用户CRUD、角色分配（仅超管）

// @tag.name 审计日志
// @tag.description 操作日志查询、变更追踪（仅超管）

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"equipment-booking/internal/handler"
	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
	"equipment-booking/internal/service"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	_ "equipment-booking/docs"
	echoSwagger "github.com/swaggo/echo-swagger"
)

// @title 设备预约管理系统 API
// @version 1.0
// @description 设备预约管理系统的 RESTful API 文档
// @host localhost:8080
// @BasePath /api
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	if err := run(); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}

func run() error {
	if err := godotenv.Load(); err != nil {
		log.Printf("警告: 未找到 .env 文件，使用系统环境变量: %v", err)
	}

	db, err := initDB()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	}()

	if err := model.AutoMigrate(db); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}

	repos := repository.NewRepositories(db)

	auditLogService := service.NewAuditLogService(repos.AuditLog)
	notificationService := service.NewNotificationService(repos)
	billingService := service.NewBillingService(
		repos.Billing,
		repos.Booking,
		repos.User,
		repos.Equipment,
		auditLogService,
		db,
	)
	bookingService := service.NewBookingService(
		repos,
		billingService,
		notificationService,
		auditLogService,
	)
	equipmentService := service.NewEquipmentService(
		repos.Equipment,
		repos.Booking,
		repos.Stats,
		repos.EquipmentLog,
		auditLogService,
	)
	maintenanceService := service.NewMaintenanceService(
		repos,
		bookingService,
		notificationService,
		auditLogService,
	)
	statsService := service.NewStatsService(repos)

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "default-secret-key-change-in-production"
	}

	authHandler := handler.NewAuthHandler(repos.User, jwtSecret)
	bookingHandler := handler.NewBookingHandler(bookingService)
	billingHandler := handler.NewBillingHandler(db, repos.Billing, repos.User, billingService, auditLogService)
	equipmentHandler := handler.NewEquipmentHandler(equipmentService)
	maintenanceHandler := handler.NewMaintenanceHandler(maintenanceService)
	notificationHandler := handler.NewNotificationHandler(notificationService)
	statsHandler := handler.NewStatsHandler(statsService)
	userHandler := handler.NewUserHandler(db, repos.User, repos.Role, repos.Center, auditLogService)
	auditHandler := handler.NewAuditHandler(auditLogService)

	e := echo.New()

	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.PATCH, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAccept,
			echo.HeaderAuthorization,
			echo.HeaderXRequestedWith,
		},
		ExposeHeaders: []string{
			echo.HeaderContentLength,
			echo.HeaderContentDisposition,
		},
		AllowCredentials: true,
		MaxAge:           86400,
	}))

	e.Use(echoMiddleware.LoggerWithConfig(echoMiddleware.LoggerConfig{
		Format: `[${time_rfc3339}] ${status} ${method} ${path} ${latency_human} ${remote_ip} ${user_agent}` + "\n",
	}))

	e.Use(echoMiddleware.RecoverWithConfig(echoMiddleware.RecoverConfig{
		StackSize: 4 << 10,
		LogErrorFunc: func(c echo.Context, err error, stack []byte) error {
			log.Printf("PANIC RECOVERED: %v\n%s", err, stack)
			return nil
		},
	}))

	e.Use(echoMiddleware.RequestID())

	authMiddleware := middleware.JWTAuth(jwtSecret)

	e.GET("/swagger/*", echoSwagger.WrapHandler)

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	api := e.Group("/api")

	auth := api.Group("/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", authHandler.Logout)
		auth.GET("/me", authHandler.GetCurrentUser, authMiddleware)
	}

	booking := api.Group("/booking", authMiddleware)
	{
		booking.GET("", bookingHandler.GetBookingList, middleware.RBAC("booking:read"))
		booking.POST("", bookingHandler.CreateBooking, middleware.RBAC("booking:create"))
		booking.POST("/series", bookingHandler.CreateSeriesBooking, middleware.RBAC("booking:create"))
		booking.POST("/:id/cancel", bookingHandler.CancelBooking, middleware.RBAC("booking:cancel"))
		booking.GET("/conflict", bookingHandler.CheckConflict, middleware.RBAC("booking:read"))
		booking.POST("/waitlist", bookingHandler.AddToWaitlist, middleware.RBAC("booking:waitlist"))
	}

	billing := api.Group("/billing", authMiddleware)
	{
		billing.GET("", billingHandler.GetBillingList)
		billing.GET("/:id", billingHandler.GetBillingDetail)
		billing.POST("/export", billingHandler.ExportMonthlyReport, middleware.RBAC("billing:export"))
		billing.GET("/budget", billingHandler.GetUserBudget)
		billing.POST("/budget", billingHandler.UpdateBudget, middleware.RBAC("billing:update_budget"))
	}

	equipmentHandler.RegisterRoutes(api, authMiddleware)

	maintenance := api.Group("/maintenance", authMiddleware)
	{
		maintenance.GET("", maintenanceHandler.GetList, middleware.RBAC("maintenance:read"))
		maintenance.POST("", maintenanceHandler.Create, middleware.RBAC("maintenance:create"))
		maintenance.PUT("/:id", maintenanceHandler.Update, middleware.RBAC("maintenance:update"))
		maintenance.POST("/:id/complete", maintenanceHandler.Complete, middleware.RBAC("maintenance:complete"))
		maintenance.DELETE("/:id", maintenanceHandler.Cancel, middleware.RBAC("maintenance:delete"))
	}

	notification := api.Group("/notification", authMiddleware, middleware.RBAC("notification:read"))
	{
		notification.GET("", notificationHandler.GetNotificationList)
		notification.GET("/unread-count", notificationHandler.GetUnreadCount)
		notification.PATCH("/:id/read", notificationHandler.MarkAsRead, middleware.RBAC("notification:update"))
		notification.PATCH("/read-all", notificationHandler.MarkAllAsRead, middleware.RBAC("notification:update"))
	}

	stats := api.Group("/stats", authMiddleware, middleware.RBACAny("stats:view", "admin:all"))
	{
		stats.GET("/dashboard", statsHandler.GetDashboardStats)
		stats.GET("/utilization", statsHandler.GetUtilizationStats)
		stats.GET("/peak-valley", statsHandler.GetPeakValleyStats)
		stats.GET("/trend", statsHandler.GetTrendStats)
		stats.GET("/ranking", statsHandler.GetEquipmentRanking)
		stats.GET("/center", statsHandler.GetCenterStats)
	}

	userHandler.RegisterRoutes(api, authMiddleware)

	audit := api.Group("/audit", authMiddleware, middleware.RBAC("audit:read"), handler.SuperAdminRequired())
	{
		audit.GET("/logs", auditHandler.GetAuditLogs)
		audit.GET("/logs/:id", auditHandler.GetAuditLogDetail)
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}
	host := os.Getenv("SERVER_HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	addr := fmt.Sprintf("%s:%s", host, port)

	server := &http.Server{
		Addr:         addr,
		Handler:      e,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("服务器启动成功，监听地址: %s", addr)
		log.Printf("Swagger 文档地址: http://%s/swagger/index.html", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- fmt.Errorf("服务器错误: %w", err)
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case sig := <-quit:
		log.Printf("收到信号 %s，开始优雅关闭服务器...", sig)

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			return fmt.Errorf("服务器优雅关闭失败: %w", err)
		}

		log.Println("服务器已优雅关闭")
		return nil
	}
}

func initDB() (*gorm.DB, error) {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")

	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "5432"
	}
	if user == "" {
		user = "postgres"
	}
	if password == "" {
		password = "postgres"
	}
	if dbname == "" {
		dbname = "equipment_booking"
	}

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Shanghai",
		host, port, user, password, dbname,
	)

	logLevel := logger.Info
	if os.Getenv("GO_ENV") == "production" {
		logLevel = logger.Warn
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取数据库连接池失败: %w", err)
	}

	maxIdleConns := 10
	if v := os.Getenv("DB_MAX_IDLE_CONNS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			maxIdleConns = n
		}
	}

	maxOpenConns := 100
	if v := os.Getenv("DB_MAX_OPEN_CONNS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			maxOpenConns = n
		}
	}

	connMaxLifetime := 1 * time.Hour
	if v := os.Getenv("DB_CONN_MAX_LIFETIME"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			connMaxLifetime = d
		}
	}

	sqlDB.SetMaxIdleConns(maxIdleConns)
	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetConnMaxLifetime(connMaxLifetime)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("数据库连接测试失败: %w", err)
	}

	log.Printf("数据库连接成功: %s:%s/%s", host, port, dbname)
	log.Printf("连接池配置: MaxIdleConns=%d, MaxOpenConns=%d, ConnMaxLifetime=%v",
		maxIdleConns, maxOpenConns, connMaxLifetime)

	return db, nil
}
