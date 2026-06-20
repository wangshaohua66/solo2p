package main

// @title 市级国际会展中心智慧运营管理系统 API
// @version 1.0.0
// @description 会展中心智慧运营管理系统后端API接口文档，包含档期管理、合同管理、财务结算、展位管理、服务商管理、观众服务、数据分析、系统管理等模块。
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.example.com/support
// @contact.email support@example.com

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

// @schemes http https

import (
	"fmt"
	"log"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/swaggo/echo-swagger"
	_ "exhibition-center/docs" // Swagger文档，由swag init生成

	"exhibition-center/config"
	"exhibition-center/internal/handlers"
	mymiddleware "exhibition-center/internal/middleware"
	"exhibition-center/internal/models"
)

func main() {
	config.Load()
	models.InitDB()

	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(mymiddleware.CORSMiddleware)

	e.GET("/swagger/*", echoSwagger.WrapHandler)

	authHandler := handlers.NewAuthHandler()
	scheduleHandler := handlers.NewScheduleHandler()
	contractHandler := handlers.NewContractHandler()
	financeHandler := handlers.NewFinanceHandler()
	boothHandler := handlers.NewBoothHandler()
	visitorHandler := handlers.NewVisitorHandler()

	api := e.Group("/api")
	api.POST("/upload", handlers.UploadFile, mymiddleware.FileUploadLimit)

	auth := api.Group("/auth")
	auth.POST("/login", authHandler.Login)
	auth.POST("/logout", authHandler.Logout, mymiddleware.JWTAuthentication)
	auth.GET("/me", authHandler.GetCurrentUser, mymiddleware.JWTAuthentication)

	schedules := api.Group("/schedules", mymiddleware.JWTAuthentication)
	schedules.GET("", scheduleHandler.List)
	schedules.GET("/check-conflict", scheduleHandler.CheckConflict)
	schedules.GET("/:id", scheduleHandler.Get)
	schedules.POST("", scheduleHandler.Create)
	schedules.PUT("/:id", scheduleHandler.Update)
	schedules.DELETE("/:id", scheduleHandler.Delete)
	schedules.POST("/:id/approve", scheduleHandler.Approve)
	schedules.POST("/:id/lock", scheduleHandler.Lock)
	schedules.POST("/:id/cancel", scheduleHandler.Cancel)

	contracts := api.Group("/contracts", mymiddleware.JWTAuthentication)
	contracts.GET("", contractHandler.List)
	contracts.GET("/templates", contractHandler.ListTemplates)
	contracts.GET("/:id", contractHandler.Get)
	contracts.POST("", contractHandler.Create)
	contracts.PUT("/:id", contractHandler.Update)
	contracts.DELETE("/:id", contractHandler.Delete)
	contracts.POST("/:id/submit-approval", contractHandler.SubmitApproval)
	contracts.POST("/:id/approve", contractHandler.Approve)
	contracts.POST("/:id/reject", contractHandler.Reject)
	contracts.POST("/:id/sign", contractHandler.Sign)
	contracts.POST("/:id/archive", contractHandler.Archive)

	finance := api.Group("/finance", mymiddleware.JWTAuthentication)
	finance.GET("/records", financeHandler.ListRecords)
	finance.GET("/records/export", financeHandler.ExportRecords)
	finance.GET("/records/:id", financeHandler.GetRecord)
	finance.POST("/records", financeHandler.CreateRecord, mymiddleware.FileUploadLimit)
	finance.PUT("/records/:id", financeHandler.UpdateRecord)
	finance.DELETE("/records/:id", financeHandler.DeleteRecord)
	finance.POST("/records/:id/confirm", financeHandler.ConfirmRecord)
	finance.GET("/summary", financeHandler.GetSummary)
	finance.GET("/deposits", financeHandler.ListDeposits)
	finance.POST("/deposit/:id/refund", financeHandler.RefundDeposit)
	finance.POST("/merge-settle", financeHandler.MergeSettle)
	finance.POST("/export-to-system", financeHandler.ExportToFinanceSystem)

	booths := api.Group("/booths", mymiddleware.JWTAuthentication)
	booths.GET("", boothHandler.List)
	booths.GET("/:id", boothHandler.Get)
	booths.POST("", boothHandler.Create)
	booths.POST("/batch", boothHandler.BatchCreate)
	booths.PUT("/:id", boothHandler.Update)
	booths.DELETE("/:id", boothHandler.Delete)

	api.GET("/venues", boothHandler.ListVenues, mymiddleware.JWTAuthentication)

	visitors := api.Group("/visitors", mymiddleware.JWTAuthentication)
	visitors.GET("", visitorHandler.List)
	visitors.GET("/:id", visitorHandler.Get)
	visitors.POST("", visitorHandler.Create)
	visitors.POST("/checkin", visitorHandler.CheckIn)
	visitors.POST("/:id/booth-visit", visitorHandler.RecordBoothVisit)

	providers := api.Group("/providers", mymiddleware.JWTAuthentication)
	providers.GET("", visitorHandler.ListProviders)
	providers.GET("/:id", visitorHandler.GetProvider)
	providers.POST("", visitorHandler.CreateProvider)
	providers.PUT("/:id", visitorHandler.UpdateProvider)

	log.Printf("服务器启动，端口: %s", config.AppConfig.ServerPort)
	log.Printf("Swagger文档: http://localhost:%s/swagger/index.html", config.AppConfig.ServerPort)
	e.Logger.Fatal(e.Start(fmt.Sprintf(":%s", config.AppConfig.ServerPort)))
}
