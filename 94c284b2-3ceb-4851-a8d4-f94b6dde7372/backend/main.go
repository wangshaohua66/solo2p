package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"mental-health-backend/config"
	"mental-health-backend/handlers"
	appMiddleware "mental-health-backend/middleware"
	"mental-health-backend/models"
)

func main() {
	_ = godotenv.Load()

	config.InitDB()

	if err := models.AutoMigrate(config.DB); err != nil {
		log.Fatalf("Failed to auto migrate: %v", err)
	}
	log.Println("Database migration completed")

	handlers.StartReminderScheduler()

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		ExposeHeaders:    []string{echo.HeaderContentLength},
		AllowCredentials: true,
	}))

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(appMiddleware.RateLimiter(300, time.Minute))

	api := e.Group("/api")

	auth := handlers.NewAuthHandler()
	api.POST("/auth/login", auth.Login)

	appointmentHandler := handlers.NewAppointmentHandler()
	appointments := api.Group("/appointments")
	appointments.GET("", appointmentHandler.List)
	appointments.GET("/:id", appointmentHandler.Get)
	appointments.POST("/match", appointmentHandler.Match)
	appointments.POST("", appointmentHandler.Create)
	appointments.PUT("/:id", appointmentHandler.Update)
	appointments.PUT("/:id/status", appointmentHandler.UpdateStatus)
	appointments.DELETE("/:id", appointmentHandler.Cancel)

	patientHandler := handlers.NewPatientHandler()
	patients := api.Group("/patients")
	patients.GET("", patientHandler.List)
	patients.GET("/:id", patientHandler.Get)
	patients.POST("", patientHandler.Create)
	patients.PUT("/:id", patientHandler.Update)
	patients.GET("/:id/diagnoses", patientHandler.ListDiagnoses)
	patients.POST("/:id/diagnoses", patientHandler.CreateDiagnosis)
	patients.GET("/:id/medications", patientHandler.ListMedications)
	patients.POST("/:id/medications", patientHandler.CreateMedication)
	patients.GET("/:id/assessments", patientHandler.ListAssessments)
	patients.POST("/:id/assessments", patientHandler.CreateAssessment)
	patients.GET("/:id/followups", patientHandler.ListFollowups)
	patients.POST("/:id/followups", patientHandler.CreateFollowup)
	patients.POST("/:id/export", patientHandler.ExportPDF)

	warningHandler := handlers.NewWarningHandler()
	warnings := api.Group("/warnings")
	warnings.GET("", warningHandler.List)
	warnings.GET("/stats", warningHandler.Stats)
	warnings.GET("/:id", warningHandler.Get)
	warnings.PUT("/:id/assign", warningHandler.Assign)
	warnings.PUT("/:id/resolve", warningHandler.Resolve)
	warnings.POST("/:id/notify", warningHandler.Notify)

	statsHandler := handlers.NewStatsHandler()
	stats := api.Group("/stats")
	stats.GET("/overview", statsHandler.Overview)
	stats.GET("/appointments", statsHandler.Appointments)
	stats.GET("/warnings", statsHandler.Warnings)
	stats.GET("/export", statsHandler.Export)

	referralHandler := handlers.NewReferralHandler()
	referrals := api.Group("/referrals")
	referrals.GET("", referralHandler.List)
	referrals.POST("", referralHandler.Create)
	referrals.PUT("/:id/accept", referralHandler.Accept)
	referrals.PUT("/:id/reject", referralHandler.Reject)
	referrals.GET("/:id/logs", referralHandler.ListLogs)

	signatureHandler := handlers.NewSignatureHandler()
	patients.GET("/:id/signatures", signatureHandler.List)
	api.POST("/signatures", signatureHandler.Create)
	api.GET("/signatures/:id", signatureHandler.Get)

	scheduleHandler := handlers.NewScheduleHandler()
	schedules := api.Group("/schedules")
	schedules.GET("", scheduleHandler.List)
	schedules.POST("", scheduleHandler.Create)
	schedules.PUT("/:id", scheduleHandler.Update)
	schedules.DELETE("/:id", scheduleHandler.Delete)
	schedules.GET("/by-date", scheduleHandler.ListByDate)

	reminderHandler := handlers.NewReminderHandler()
	reminders := api.Group("/reminders")
	reminders.GET("", reminderHandler.List)
	reminders.POST("", reminderHandler.Create)
	reminders.PUT("/:id", reminderHandler.Update)
	reminders.PUT("/:id/sent", reminderHandler.MarkSent)
	reminders.GET("/pending", reminderHandler.GetPendingReminders)

	auditHandler := handlers.NewAuditHandler()
	api.GET("/audit/logs", auditHandler.List)

	stations := api.Group("/stations")
	stations.GET("", handlers.ListStations)
	doctors := api.Group("/doctors")
	doctors.GET("", handlers.ListDoctors)

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	go func() {
		log.Printf("Server starting on %s", addr)
		if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server exited")
}
