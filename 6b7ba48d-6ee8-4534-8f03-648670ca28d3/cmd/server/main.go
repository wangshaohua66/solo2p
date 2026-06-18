// Package main CraftBrew Tracker API
//
// @title 精酿啤酒批次生产追踪与质量合规系统 API
// @version 1.0.0
// @description 支撑从原料入库到灌装出库的全链路批次管理与质检 RESTful API。
// @BasePath /
// @schemes http https
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @contact.name API Support
// @contact.email support@craftbrew.local
// @host localhost:8080
package main

import (
	"craftbrew-tracker/internal/config"
	"craftbrew-tracker/internal/handler"
	"craftbrew-tracker/internal/middleware"
	"craftbrew-tracker/internal/model"
	"craftbrew-tracker/internal/repository"
	"craftbrew-tracker/internal/scheduler"
	"craftbrew-tracker/internal/service"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	emw "github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	echoSwagger "github.com/swaggo/echo-swagger"

	_ "craftbrew-tracker/docs"
)

func main() {
	// 1. zerolog 配置
	zerolog.TimeFieldFormat = time.RFC3339Nano
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: "15:04:05.000"})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	if os.Getenv("DEBUG") == "1" {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	}

	// 2. 读取配置
	cfg := config.Load()
	log.Info().Int("port", cfg.Server.Port).Str("db", cfg.Database.Path).Msg("config loaded")

	// 3. 初始化数据库
	db, err := repository.New(&cfg.Database)
	if err != nil {
		log.Fatal().Err(err).Msg("database init failed")
	}
	defer repository.CloseOrLog(db.DB)

	// 4. Service / Handler / Scheduler
	svc := service.New(cfg, db)
	h := handler.New(cfg, svc)

	// 启动时立即执行一次库存预警和偏差检查
	if err := svc.RunInventoryAlerts(); err != nil {
		log.Warn().Err(err).Msg("initial inventory check failed")
	}
	if err := svc.RunDeviationCheck(); err != nil {
		log.Warn().Err(err).Msg("initial deviation check failed")
	}
	log.Info().Msg("initial inventory & deviation check completed")

	sch := scheduler.New(&cfg.Scheduler, svc)
	sch.Start()
	defer sch.Stop()

	// 5. Echo
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.HTTPErrorHandler = customHTTPErrorHandler

	// 6. 内置中间件
	e.Use(emw.CORSWithConfig(emw.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS, echo.PATCH},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-Request-Id"},
	}))
	e.Use(emw.RequestIDWithConfig(emw.RequestIDConfig{
		TargetHeader: echo.HeaderXRequestID,
	}))
	e.Use(middleware.RequestLogger())
	e.Use(middleware.RecoverMiddleware())

	// 7. 健康检查
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status": "ok",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	})

	// 8. Swagger (swaggo/swag auto-generated)
	e.GET("/swagger/*", echoSwagger.WrapHandler)
	e.GET("/", func(c echo.Context) error {
		return c.Redirect(http.StatusFound, "/swagger/index.html")
	})

	// 9. API 路由分组
	v1 := e.Group("/api/v1")

	// 认证（开放）
	auth := v1.Group("/auth")
	auth.POST("/login", h.Login)

	// 以下接口需 JWT 认证
	api := v1.Group("")
	api.Use(middleware.JWTAuth(&cfg.JWT))

	// 用户 & 自身信息
	api.GET("/me", h.Me)
	api.GET("/users", h.ListUsers, middleware.RequireRoles(model.RoleAdmin))
	api.POST("/users", h.CreateUser, middleware.RequireRoles(model.RoleAdmin))

	// 配方（酿酒师/品控可查看）
	recipes := api.Group("/recipes")
	recipes.GET("", h.ListRecipes, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleCompliance, model.RoleAdmin))
	recipes.GET("/:id", h.GetRecipe, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleCompliance, model.RoleAdmin))
	recipes.POST("", h.CreateRecipe, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleAdmin))

	// 批次
	batches := api.Group("/batches")
	batches.GET("", h.ListBatches, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleWarehouse, model.RoleCompliance, model.RoleAdmin))
	batches.POST("", h.CreateBatch, middleware.RequireRoles(model.RoleBrewer, model.RoleAdmin))
	batches.GET("/:id", h.GetBatch, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleWarehouse, model.RoleCompliance, model.RoleAdmin))
	batches.POST("/:id/transition", h.TransitionStage, middleware.RequireRoles(model.RoleBrewer, model.RoleAdmin))
	batches.GET("/:id/params", h.ListStageParams, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleCompliance, model.RoleAdmin))
	batches.POST("/:id/params", h.RecordParam, middleware.RequireRoles(model.RoleBrewer, model.RoleAdmin))
	batches.GET("/:id/materials", h.ListBatchMaterials, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleWarehouse, model.RoleCompliance, model.RoleAdmin))
	batches.POST("/:id/materials", h.LinkBatchMaterials, middleware.RequireRoles(model.RoleBrewer, model.RoleWarehouse, model.RoleAdmin))

	// 质检
	quality := api.Group("/quality")
	quality.GET("/items", h.ListQualityItems, middleware.RequireRoles(model.RoleQC, model.RoleBrewer, model.RoleCompliance, model.RoleAdmin))
	quality.GET("/items/:id", h.GetQualityItem, middleware.RequireRoles(model.RoleQC, model.RoleCompliance, model.RoleAdmin))
	quality.POST("/items", h.CreateQualityItem, middleware.RequireRoles(model.RoleQC, model.RoleAdmin))
	quality.GET("/samples", h.ListSamples, middleware.RequireRoles(model.RoleQC, model.RoleBrewer, model.RoleCompliance, model.RoleAdmin))
	quality.GET("/samples/:id", h.GetSample, middleware.RequireRoles(model.RoleQC, model.RoleCompliance, model.RoleAdmin))
	quality.POST("/samples", h.SubmitSample, middleware.RequireRoles(model.RoleBrewer, model.RoleQC, model.RoleAdmin))
	quality.POST("/samples/:id/review", h.ReviewSample, middleware.RequireRoles(model.RoleQC, model.RoleAdmin))

	// 库存
	inv := api.Group("/inventory")
	inv.GET("/materials", h.ListMaterials, middleware.RequireRoles(model.RoleWarehouse, model.RoleBrewer, model.RoleCompliance, model.RoleAdmin))
	inv.GET("/materials/:id", h.GetMaterial, middleware.RequireRoles(model.RoleWarehouse, model.RoleBrewer, model.RoleCompliance, model.RoleAdmin))
	inv.POST("/materials", h.CreateMaterial, middleware.RequireRoles(model.RoleWarehouse, model.RoleAdmin))
	inv.POST("/materials/inbound", h.InboundMaterial, middleware.RequireRoles(model.RoleWarehouse, model.RoleAdmin))
	inv.GET("/finished", h.ListFinished, middleware.RequireRoles(model.RoleWarehouse, model.RoleCompliance, model.RoleAdmin))
	inv.POST("/finished/inbound", h.InboundFinished, middleware.RequireRoles(model.RoleWarehouse, model.RoleAdmin))
	inv.POST("/finished/outbound", h.OutboundFinished, middleware.RequireRoles(model.RoleWarehouse, model.RoleAdmin))
	inv.GET("/movements", h.ListMovements, middleware.RequireRoles(model.RoleWarehouse, model.RoleCompliance, model.RoleAdmin))
	inv.POST("/check", h.TriggerInventoryCheck, middleware.RequireRoles(model.RoleWarehouse, model.RoleQC, model.RoleAdmin))

	// 告警 / 偏差
	api.GET("/alerts", h.ListAlerts, middleware.RequireRoles(model.RoleQC, model.RoleCompliance, model.RoleBrewer, model.RoleWarehouse, model.RoleAdmin))
	api.POST("/alerts/:id/resolve", h.ResolveAlert, middleware.RequireRoles(model.RoleQC, model.RoleAdmin))
	api.GET("/deviations", h.ListDeviations, middleware.RequireRoles(model.RoleQC, model.RoleBrewer, model.RoleCompliance, model.RoleAdmin))

	// 追溯
	trace := api.Group("/trace")
	trace.GET("", h.TraceQuery, middleware.RequireRoles(model.RoleCompliance, model.RoleQC, model.RoleBrewer, model.RoleAdmin))
	trace.GET("/:id", h.GetTraceChain, middleware.RequireRoles(model.RoleCompliance, model.RoleQC, model.RoleBrewer, model.RoleAdmin))

	// 合规报告
	reports := api.Group("/reports")
	reports.GET("", h.ListReports, middleware.RequireRoles(model.RoleCompliance, model.RoleAdmin))
	reports.GET("/:id", h.GetReport, middleware.RequireRoles(model.RoleCompliance, model.RoleAdmin))
	reports.POST("/export", h.ExportReport, middleware.RequireRoles(model.RoleCompliance, model.RoleAdmin))

	// 异步任务状态
	api.GET("/tasks/:taskId", h.GetTaskStatus, middleware.RequireRoles(
		model.RoleBrewer, model.RoleQC, model.RoleWarehouse, model.RoleCompliance, model.RoleAdmin,
	))

	// 10. 启动服务
	go func() {
		addr := ":" + strconv.Itoa(cfg.Server.Port)
		log.Info().Str("addr", addr).Msg("starting HTTP server")
		srv := &http.Server{
			Addr:         addr,
			Handler:      e,
			ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
			WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
			IdleTimeout:  120 * time.Second,
		}
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server crashed")
		}
	}()

	// 11. 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Info().Str("signal", sig.String()).Msg("shutdown signal received")

	ctx, cancel := func() (interface{}, func()) {
		// 使用匿名函数避免 context import 冲突
		type Ctx interface{}
		return Ctx(nil), func() {}
	}()
	_ = ctx
	_ = cancel
	// 由于已经用 defer 关闭 scheduler/db，这里简单等待
	time.Sleep(500 * time.Millisecond)
	log.Info().Msg("craftbrew tracker shutdown complete")
}

func customHTTPErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}
	code := http.StatusInternalServerError
	msg := err.Error()
	if he, ok := err.(*echo.HTTPError); ok {
		code = he.Code
		if he.Internal != nil {
			msg = he.Internal.Error()
		} else if m, ok := he.Message.(string); ok {
			msg = m
		} else {
			msg = fmt.Sprintf("%v", he.Message)
		}
	}
	log.Warn().Str("path", c.Path()).Str("err", err.Error()).Int("status", code).Msg("http error")

	traceID := ""
	if v := c.Get("traceId"); v != nil {
		traceID = v.(string)
	}
	_ = c.JSON(code, map[string]interface{}{
		"code":    code,
		"message": msg,
		"traceId": traceID,
	})
}
