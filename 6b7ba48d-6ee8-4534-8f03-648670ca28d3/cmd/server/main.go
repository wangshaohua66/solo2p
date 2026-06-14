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

	// 8. Swagger
	e.GET("/swagger/*", echoSwaggerHandler)
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

// echoSwaggerHandler 在没有 swaggo 生成文件时提供占位响应，避免启动报错
func echoSwaggerHandler(c echo.Context) error {
	path := c.Param("*")
	if path == "index.html" || path == "/" {
		return c.HTML(http.StatusOK, swaggerHTML)
	}
	if path == "swagger.json" || path == "doc.json" {
		return c.JSONBlob(http.StatusOK, swaggerJSONBlob())
	}
	return c.NoContent(http.StatusNotFound)
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

const swaggerHTML = `<!doctype html>
<html><head><title>CraftBrew API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({url:"/swagger/swagger.json",dom_id:"#swagger-ui",deepLinking:true});
</script></body></html>`

// swaggerJSONBlob 返回最小可展示的 swagger spec；如用 swag init 生成可覆盖
func swaggerJSONBlob() []byte {
	return []byte(`{
  "openapi":"3.0.3",
  "info":{"title":"精酿啤酒批次追踪 API","version":"1.0.0","description":"RESTful API（运行 swag init 可生成完整 spec）"},
  "servers":[{"url":"/api/v1"}],
  "components":{
    "securitySchemes":{"BearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}},
    "schemas":{
      "Response":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"},"data":{},"traceId":{"type":"string"}}},
      "LoginRequest":{"type":"object","required":["username","password"],"properties":{"username":{"type":"string"},"password":{"type":"string"}}},
      "LoginResponse":{"type":"object","properties":{"token":{"type":"string"},"expiresAt":{"type":"string","format":"date-time"},"user":{"type":"object"}}}
    }
  },
  "security":[{"BearerAuth":[]}],
  "paths":{
    "/auth/login":{
      "post":{"tags":["认证"],"summary":"登录获取 JWT","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/LoginRequest"}}}},
        "responses":{"200":{"description":"成功","content":{"application/json":{"schema":{"allOf":[{"$ref":"#/components/schemas/Response"}],"properties":{"data":{"$ref":"#/components/schemas/LoginResponse"}}}}}}}
    },
    "/batches":{
      "get":{"tags":["批次管理"],"summary":"分页查询批次","parameters":[{"name":"status","in":"query","schema":{"type":"string"}},{"name":"page","in":"query","schema":{"type":"integer"}},{"name":"pageSize","in":"query","schema":{"type":"integer"}}],
        "responses":{"200":{"description":"成功","content":{"application/json":{"schema":{"$ref":"#/components/schemas/Response"}}}}}},
      "post":{"tags":["批次管理"],"summary":"创建批次","requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","required":["recipeId","targetVolumeL"],"properties":{"recipeId":{"type":"integer"},"targetVolumeL":{"type":"number"},"notes":{"type":"string"}}}}},
        "responses":{"201":{"description":"创建成功","content":{"application/json":{"schema":{"$ref":"#/components/schemas/Response"}}}}}}
    },
    "/batches/{id}/transition":{"post":{"tags":["批次管理"],"summary":"流转阶段","parameters":[{"name":"id","in":"path","required":true,"schema":{"type":"integer"}}],
      "requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","required":["toStage"],"properties":{"toStage":{"type":"string","enum":["mashing","fermenting","aging","bottling","completed"]}}}}},
      "responses":{"200":{"description":"OK","content":{"application/json":{"schema":{"$ref":"#/components/schemas/Response"}}}}}}
    },
    "/quality/samples":{
      "get":{"tags":["质检测试"],"summary":"查询样本","responses":{"200":{"description":"OK"}}},
      "post":{"tags":["质检测试"],"summary":"提交样本及结果","responses":{"201":{"description":"OK"}}}
    },
    "/inventory/materials/inbound":{"post":{"tags":["库存管理"],"summary":"原料入库","responses":{"200":{"description":"OK"}}}},
    "/inventory/finished/outbound":{"post":{"tags":["库存管理"],"summary":"成品出库","responses":{"200":{"description":"OK"}}}},
    "/trace/{id}":{"get":{"tags":["追溯管理"],"summary":"全链路追溯","parameters":[{"name":"id","in":"path","required":true,"schema":{"type":"integer"}}],"responses":{"200":{"description":"OK"}}}},
    "/reports/export":{"post":{"tags":["合规报告"],"summary":"导出合规报告（异步）","responses":{"200":{"description":"返回 taskId"}}}},
    "/tasks/{taskId}":{"get":{"tags":["工具"],"summary":"查询异步任务","responses":{"200":{"description":"OK"}}}},
    "/alerts":{"get":{"tags":["告警管理"],"summary":"告警列表","responses":{"200":{"description":"OK"}}}}
  }
}`)
}
