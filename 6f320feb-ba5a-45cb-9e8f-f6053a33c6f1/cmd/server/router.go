package main

import (
	"equipment-trading-platform/internal/controller"
	"equipment-trading-platform/internal/middleware"
	"equipment-trading-platform/internal/model"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.New()

	r.Use(middleware.ErrorHandler())
	r.Use(middleware.CORSMiddleware())
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	authCtrl := controller.NewAuthController()
	userCtrl := controller.NewUserController()
	deviceCtrl := controller.NewDeviceController()
	valuationCtrl := controller.NewValuationController()
	txCtrl := controller.NewTransactionController()
	disputeCtrl := controller.NewDisputeController()
	statsCtrl := controller.NewStatsController()

	api := r.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"code": 0, "message": "ok", "data": gin.H{"status": "running"}})
		})

		auth := api.Group("/auth")
		{
			auth.POST("/register", authCtrl.Register)
			auth.POST("/login", authCtrl.Login)
			auth.GET("/roles", authCtrl.ListRoles)

			auth.Use(middleware.JWTAuth())
			{
				auth.GET("/me", authCtrl.GetCurrentUser)
				auth.POST("/change-password", authCtrl.ChangePassword)
			}
		}

		users := api.Group("/users")
		users.Use(middleware.JWTAuth())
		{
			users.GET("", middleware.RequireRole(model.RoleAdmin), userCtrl.List)
			users.GET("/:id", userCtrl.GetByID)
			users.PUT("/:id", userCtrl.Update)
			users.PATCH("/:id/status", middleware.RequireRole(model.RoleAdmin), userCtrl.UpdateStatus)
			users.GET("/:id/credit-rating", userCtrl.GetCreditRating)
			users.GET("/:id/credit-records", userCtrl.ListCreditRecords)
			users.POST("/review", userCtrl.Review)
		}

		devices := api.Group("/devices")
		{
			devices.GET("", deviceCtrl.List)
			devices.GET("/search", deviceCtrl.Search)
			devices.GET("/categories", deviceCtrl.ListCategories)
			devices.GET("/:id", deviceCtrl.GetByID)
			devices.GET("/:id/maintenance-records", deviceCtrl.ListMaintenanceRecords)
			devices.GET("/:id/ownership-changes", deviceCtrl.ListOwnershipChanges)

			devices.Use(middleware.JWTAuth())
			{
				devices.POST("", middleware.RequireRole(model.RoleSeller, model.RoleAdmin), deviceCtrl.Create)
				devices.PUT("/:id", middleware.RequireRole(model.RoleSeller, model.RoleAdmin), deviceCtrl.Update)
				devices.PATCH("/:id/approve", middleware.RequireRole(model.RoleAdmin), deviceCtrl.Approve)
				devices.PATCH("/:id/status", middleware.RequireRole(model.RoleAdmin), deviceCtrl.UpdateStatus)
				devices.PATCH("/:id/off-shelf", middleware.RequireRole(model.RoleSeller, model.RoleAdmin), deviceCtrl.OffShelf)
				devices.DELETE("/:id", middleware.RequireRole(model.RoleAdmin), deviceCtrl.Delete)
				devices.POST("/:id/maintenance-records", middleware.RequireRole(model.RoleSeller, model.RoleAdmin), deviceCtrl.AddMaintenanceRecord)
				devices.POST("/:id/media", middleware.RequireRole(model.RoleSeller, model.RoleAdmin), deviceCtrl.AddMedia)
				devices.DELETE("/:id/media/:media_id", middleware.RequireRole(model.RoleSeller, model.RoleAdmin), deviceCtrl.DeleteMedia)
			}
		}

		valuations := api.Group("/valuations")
		valuations.Use(middleware.JWTAuth())
		{
			valuations.POST("/:device_id", middleware.RequireRole(model.RoleAssessor, model.RoleAdmin), valuationCtrl.Evaluate)
			valuations.GET("", valuationCtrl.List)
			valuations.GET("/:id", valuationCtrl.GetByID)
			valuations.GET("/device/:device_id", valuationCtrl.GetByDevice)
			valuations.DELETE("/:device_id/invalidate", middleware.RequireRole(model.RoleAssessor, model.RoleAdmin), valuationCtrl.Invalidate)
		}

		transactions := api.Group("/transactions")
		transactions.Use(middleware.JWTAuth())
		{
			transactions.POST("", middleware.RequireRole(model.RoleBuyer, model.RoleSeller, model.RoleAdmin), txCtrl.Create)
			transactions.GET("", txCtrl.List)
			transactions.GET("/:id", txCtrl.GetByID)
			transactions.POST("/:id/negotiate", middleware.RequireRole(model.RoleBuyer, model.RoleSeller, model.RoleAdmin), txCtrl.Negotiate)
			transactions.POST("/:id/freeze-fund", middleware.RequireRole(model.RoleBuyer, model.RoleAdmin), txCtrl.FreezeFund)
			transactions.POST("/:id/confirm-transfer", middleware.RequireRole(model.RoleSeller, model.RoleAdmin), txCtrl.ConfirmTransfer)
			transactions.POST("/:id/complete", middleware.RequireRole(model.RoleBuyer, model.RoleAdmin), txCtrl.Complete)
			transactions.POST("/:id/cancel", middleware.RequireRole(model.RoleBuyer, model.RoleSeller, model.RoleAdmin), txCtrl.Cancel)
			transactions.GET("/:id/funds", txCtrl.ListFunds)
		}

		disputes := api.Group("/disputes")
		disputes.Use(middleware.JWTAuth())
		{
			disputes.POST("", disputeCtrl.FileDispute)
			disputes.GET("", disputeCtrl.List)
			disputes.GET("/:id", disputeCtrl.GetByID)
			disputes.POST("/:id/evidence", disputeCtrl.AddEvidence)
			disputes.GET("/:id/evidence", disputeCtrl.ListEvidence)
			disputes.POST("/:id/assign-arbitrator", middleware.RequireRole(model.RoleAdmin), disputeCtrl.AssignArbitrator)
			disputes.POST("/:id/resolve", middleware.RequireRole(model.RoleArbitrator, model.RoleAdmin), disputeCtrl.Resolve)
		}

		stats := api.Group("/stats")
		stats.Use(middleware.JWTAuth(), middleware.RequireRole(model.RoleAdmin))
		{
			stats.GET("/daily", statsCtrl.DailyStats)
			stats.GET("/category", statsCtrl.CategoryStats)
			stats.GET("/region", statsCtrl.RegionStats)
			stats.GET("/summary", statsCtrl.Summary)
		}
	}

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"code":    0,
			"message": "Equipment Trading Platform API",
			"version": "v1.0.0",
			"docs":    "/api/v1/health",
		})
	})

	return r
}
