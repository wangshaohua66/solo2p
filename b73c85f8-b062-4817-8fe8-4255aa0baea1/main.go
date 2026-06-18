// @title 燃气管网巡检与抢修调度系统
// @version 1.0
// @description 城市燃气管网巡检计划、泄漏报警抢修调度、阀门操作台账、隐患闭环管理、压力趋势分析、巡检轨迹核查的综合管理系统
// @host localhost:8080
// @BasePath /
// @schemes http
package main

import (
	"fmt"
	"gas-network-system/internal/alarm"
	"gas-network-system/internal/config"
	"gas-network-system/internal/handler"
	"gas-network-system/internal/repository"
	"gas-network-system/internal/service"
	"gas-network-system/pkg/response"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	_ "gas-network-system/docs"
	"go.uber.org/zap"
)

// @contact.name API Support
// @contact.url http://www.example.com/support
// @contact.email support@example.com

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

func main() {
	cfg := config.DefaultConfig()

	logger, err := config.InitLogger(&cfg.Log)
	if err != nil {
		panic(fmt.Sprintf("初始化日志失败: %v", err))
	}
	defer logger.Sync()

	db, err := config.InitDB(&cfg.Database, logger)
	if err != nil {
		logger.Fatal("初始化数据库失败", zap.Error(err))
	}

	repo := repository.NewRepository(db, logger)

	alarmEngine := alarm.NewAlarmEngine(repo, logger, cfg)

	schedulerService := service.NewSchedulerService(repo, logger, cfg)
	dispatchService := service.NewDispatchService(repo, logger, cfg)
	trackService := service.NewTrackService(repo, logger, cfg)
	hazardService := service.NewHazardService(repo, logger, cfg)
	pressureService := service.NewPressureAnalysisService(repo, logger, cfg)

	inspectHandler := handler.NewInspectHandler(schedulerService, trackService, logger)
	alarmHandler := handler.NewAlarmHandler(alarmEngine, dispatchService, logger)
	valveHandler := handler.NewValveHandler(repo, logger)
	hazardHandler := handler.NewHazardHandler(hazardService, logger)
	pressureHandler := handler.NewPressureHandler(pressureService, logger)

	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterValidation("datetime", validateDatetime)
	}

	r := gin.Default()

	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())
	r.Use(validationErrorMiddleware())

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.GET("/health", healthCheck)

	apiV1 := r.Group("/api/v1")
	{
		inspect := apiV1.Group("/inspect")
		{
			inspect.POST("/plans/generate", inspectHandler.GeneratePlan)
			inspect.POST("/plans/reassign", inspectHandler.ReassignTasks)

			inspect.GET("/tasks", inspectHandler.ListTasks)
			inspect.GET("/tasks/:id", inspectHandler.GetTask)
			inspect.POST("/tasks/:id/accept", inspectHandler.AcceptTask)
			inspect.POST("/tasks/:id/complete", inspectHandler.CompleteTask)
			inspect.POST("/tasks/check-expired", inspectHandler.CheckExpiredTasks)

			inspect.GET("/inspectors", inspectHandler.ListInspectors)
			inspect.POST("/inspectors", inspectHandler.CreateInspector)

			inspect.POST("/tracks", inspectHandler.SubmitTrack)
			inspect.GET("/tracks", inspectHandler.ListTracks)
		}

		alarmGroup := apiV1.Group("/alarm")
		{
			alarmGroup.POST("/pressure-data", alarmHandler.PushPressureData)
			alarmGroup.POST("/pressure-data/batch", alarmHandler.BatchPushPressureData)
			alarmGroup.POST("/pressure-data/archive", alarmHandler.ArchivePressureData)
			alarmGroup.POST("/pressure-data/daily-stats", alarmHandler.CalculateDailyStats)

			alarmGroup.GET("/rules", alarmHandler.GetRules)

			alarmGroup.GET("/alarms", alarmHandler.ListAlarms)
			alarmGroup.GET("/alarms/:id", alarmHandler.GetAlarm)
			alarmGroup.POST("/alarms/:id/dispatch", alarmHandler.DispatchAlarm)

			alarmGroup.GET("/repair-orders", alarmHandler.ListRepairOrders)
			alarmGroup.GET("/repair-orders/:id", alarmHandler.GetRepairOrder)
			alarmGroup.PUT("/repair-orders/:id/status", alarmHandler.UpdateRepairOrderStatus)

			alarmGroup.GET("/repair-teams", alarmHandler.ListRepairTeams)
			alarmGroup.POST("/repair-teams", alarmHandler.CreateRepairTeam)
		}

		valve := apiV1.Group("/valve")
		{
			valve.POST("/operations", valveHandler.CreateOperation)
			valve.GET("/operations", valveHandler.ListOperations)
			valve.GET("/operations/:id", valveHandler.GetOperation)

			valve.GET("/wells", valveHandler.ListValveWells)
			valve.POST("/wells", valveHandler.CreateValveWell)
		}

		hazard := apiV1.Group("/hazard")
		{
			hazard.POST("/hazards", hazardHandler.RegisterHazard)
			hazard.GET("/hazards", hazardHandler.ListHazards)
			hazard.GET("/hazards/:id", hazardHandler.GetHazard)
			hazard.POST("/hazards/assign", hazardHandler.AssignHazard)
			hazard.POST("/hazards/rectify", hazardHandler.RectifyHazard)
			hazard.POST("/hazards/accept", hazardHandler.AcceptHazard)
			hazard.POST("/hazards/check-overdue", hazardHandler.CheckOverdueHazards)
		}

		pressure := apiV1.Group("/pressure")
		{
			pressure.GET("/stats/hourly", pressureHandler.GetHourlyStats)
			pressure.GET("/stats/daily", pressureHandler.GetDailyStats)
			pressure.GET("/stats/monthly", pressureHandler.GetMonthlyStats)

			pressure.GET("/data", pressureHandler.ListPressureData)
			pressure.GET("/data/latest", pressureHandler.GetLatestPressure)

			pressure.GET("/stations", pressureHandler.ListStations)
		}

		basic := apiV1.Group("/basic")
		{
			basic.GET("/pipelines", pressureHandler.ListPipelines)
			basic.POST("/pipelines", pressureHandler.CreatePipeline)
		}
	}

	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	logger.Info("服务启动", zap.String("addr", addr))

	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatal("服务启动失败", zap.Error(err))
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, response.Success(map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
	}))
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func validationErrorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			var validationErrors []response.ValidationError

			for _, err := range c.Errors {
				if ve, ok := err.Err.(validator.ValidationErrors); ok {
					for _, fieldErr := range ve {
						validationErrors = append(validationErrors, response.ValidationError{
							Field:   fieldErr.Field(),
							Rule:    fieldErr.Tag(),
							Message: getValidationMessage(fieldErr),
						})
					}
				}
			}

			if len(validationErrors) > 0 {
				c.JSON(http.StatusBadRequest, response.ValidationErrors(validationErrors))
				c.Abort()
				return
			}
		}
	}
}

func getValidationMessage(fieldErr validator.FieldError) string {
	switch fieldErr.Tag() {
	case "required":
		return "该字段为必填项"
	case "oneof":
		return fmt.Sprintf("该字段的值必须是以下之一: %s", fieldErr.Param())
	case "min":
		return fmt.Sprintf("该字段的最小值为 %s", fieldErr.Param())
	case "max":
		return fmt.Sprintf("该字段的最大值为 %s", fieldErr.Param())
	case "gte":
		return fmt.Sprintf("该字段必须大于等于 %s", fieldErr.Param())
	case "lte":
		return fmt.Sprintf("该字段必须小于等于 %s", fieldErr.Param())
	case "email":
		return "请输入有效的邮箱地址"
	case "datetime":
		return fmt.Sprintf("请输入有效的日期时间格式: %s", fieldErr.Param())
	default:
		return fmt.Sprintf("字段验证失败，规则: %s", fieldErr.Tag())
	}
}

func validateDatetime(fl validator.FieldLevel) bool {
	format := fl.Param()
	if format == "" {
		format = "2006-01-02"
	}
	_, err := time.ParseInLocation(format, fl.Field().String(), time.Local)
	return err == nil
}
