package main

import (
	"github.com/gin-gonic/gin"
	"lab-management/internal/controller"
	"lab-management/internal/middleware"
	"lab-management/internal/model"
)

type Dependencies struct {
	BaseCtrl       *controller.BaseController
	SampleCtrl     *controller.SampleController
	ReportCtrl     *controller.ReportController
	SettlementCtrl *controller.SettlementController
	StatisticsCtrl *controller.StatisticsController
	AuthMw         *middleware.AuthMiddleware
	RateLimitMw    *middleware.RateLimitMiddleware
	TraceIDMw      *middleware.TraceIDMiddleware
	CORSMw         *middleware.CORSMiddleware
	AuditMw        *middleware.AuditMiddleware
}

func SetupRouter(r *gin.Engine, deps *Dependencies) {
	r.Use(deps.CORSMw.Handle())
	r.Use(deps.TraceIDMw.Handle())
	r.Use(deps.RateLimitMw.RateLimit())

	api := r.Group("/api/v1")
	api.Use(deps.AuditMw.Handle())

	api.POST("/auth/login", deps.BaseCtrl.Login)

	auth := api.Group("")
	auth.Use(deps.AuthMw.Auth())

	inst := auth.Group("/institutions")
	{
		inst.GET("", deps.BaseCtrl.ListInstitution)
		inst.GET("/:id", deps.BaseCtrl.GetInstitution)
		admin := inst.Group("")
		admin.Use(deps.AuthMw.RoleAuth(model.UserRoleAdmin, model.UserRoleFinance))
		{
			admin.POST("", deps.BaseCtrl.CreateInstitution)
			admin.PUT("/:id", deps.BaseCtrl.UpdateInstitution)
		}
	}

	items := auth.Group("/test-items")
	{
		items.GET("", deps.BaseCtrl.ListTestItem)
		items.GET("/:id", deps.BaseCtrl.GetTestItem)
		admin := items.Group("")
		admin.Use(deps.AuthMw.RoleAuth(model.UserRoleAdmin))
		{
			admin.POST("", deps.BaseCtrl.CreateTestItem)
			admin.PUT("/:id", deps.BaseCtrl.UpdateTestItem)
		}
	}

	samples := auth.Group("/samples")
	{
		samples.GET("", deps.SampleCtrl.ListSample)
		samples.GET("/:id", deps.SampleCtrl.GetSample)
		samples.GET("/barcode/:barcode", deps.SampleCtrl.GetSampleByBarcode)
		samples.GET("/:id/status-logs", deps.SampleCtrl.GetStatusLogs)
		samples.GET("/:id/results", deps.SampleCtrl.GetTestResults)
		samples.GET("/:id/critical-values", deps.SampleCtrl.GetCriticalValues)

		instOnly := samples.Group("")
		instOnly.Use(deps.AuthMw.RoleAuth(model.UserRoleInstitution, model.UserRoleAdmin))
		{
			instOnly.POST("", deps.SampleCtrl.CreateSample)
			instOnly.POST("/batch", deps.SampleCtrl.BatchCreateSample)
			instOnly.PUT("/:id/status", deps.SampleCtrl.UpdateStatus)
			instOnly.POST("/:id/cancel", deps.SampleCtrl.CancelSample)
		}

		doctor := samples.Group("")
		doctor.Use(deps.AuthMw.RoleAuth(model.UserRoleDoctor, model.UserRoleAdmin))
		{
			doctor.POST("/results", deps.SampleCtrl.SubmitTestResults)
		}

		reviewer := samples.Group("")
		reviewer.Use(deps.AuthMw.RoleAuth(model.UserRoleReviewer, model.UserRoleDoctor, model.UserRoleAdmin))
		{
			reviewer.POST("/critical-values/review", deps.SampleCtrl.ReviewCriticalValue)
		}
	}

	reports := auth.Group("/reports")
	{
		reports.GET("", deps.ReportCtrl.ListReport)
		reports.GET("/:id", deps.ReportCtrl.GetReport)
		reports.GET("/no/:reportNo", deps.ReportCtrl.GetReportByReportNo)
		reports.GET("/sample/:id", deps.ReportCtrl.GetReportBySample)
		reports.GET("/:id/download", deps.ReportCtrl.DownloadReport)
		reports.GET("/:id/preview", deps.ReportCtrl.PreviewReport)
		reports.POST("/:id/read", deps.ReportCtrl.MarkReportRead)

		staff := reports.Group("")
		staff.Use(deps.AuthMw.RoleAuth(model.UserRoleDoctor, model.UserRoleReviewer, model.UserRoleAdmin))
		{
			staff.POST("/:id/generate", deps.ReportCtrl.GenerateReport)
			staff.POST("/:id/publish", deps.ReportCtrl.PublishReport)
		}
	}

	settlements := auth.Group("/settlements")
	{
		settlements.GET("", deps.SettlementCtrl.ListSettlement)
		settlements.GET("/:id", deps.SettlementCtrl.GetSettlement)
		settlements.GET("/month/:institutionId", deps.SettlementCtrl.GetSettlementByMonth)
		settlements.GET("/:id/details", deps.SettlementCtrl.GetSettlementDetails)

		finance := settlements.Group("")
		finance.Use(deps.AuthMw.RoleAuth(model.UserRoleFinance, model.UserRoleAdmin))
		{
			finance.POST("", deps.SettlementCtrl.CreateSettlement)
			finance.POST("/:id/confirm", deps.SettlementCtrl.ConfirmSettlement)
		}
	}

	stats := auth.Group("/statistics")
	{
		stats.GET("", deps.StatisticsCtrl.QueryStats)
		stats.GET("/dashboard", deps.StatisticsCtrl.DashboardSummary)
	}
}
