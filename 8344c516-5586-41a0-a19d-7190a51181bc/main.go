package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	_ "exam-system/docs"
	"exam-system/handler"
	"exam-system/middleware"
	"exam-system/model"
)

func main() {
	if err := model.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	r.Static("/static", "./static")
	r.StaticFile("/", "./static/index.html")
	r.StaticFile("/login", "./static/login.html")
	r.StaticFile("/dashboard", "./static/dashboard.html")
	r.StaticFile("/exams", "./static/exams.html")
	r.StaticFile("/questions", "./static/questions.html")
	r.StaticFile("/scores", "./static/scores.html")
	r.StaticFile("/certificates", "./static/certificates.html")
	r.StaticFile("/statistics", "./static/statistics.html")
	r.StaticFile("/verify", "./static/verify.html")

	r.GET("/api-docs", func(c *gin.Context) {
		c.File("./static/swagger.json")
	})
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler,
		ginSwagger.URL("/api-docs"),
	))

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", handler.Login)
			auth.POST("/register", handler.Register)
		}

		api.Use(middleware.JWTAuth())

		user := api.Group("/users")
		{
			user.GET("/profile", handler.GetProfile)
			user.PUT("/password", handler.ChangePassword)
			user.GET("", middleware.RequireRole("admin"), handler.GetUserList)
		}

		exam := api.Group("/exams")
		{
			exam.GET("", middleware.RequireRole("admin", "institution", "examiner"), handler.GetExamList)
			exam.POST("", middleware.RequireRole("institution", "admin"), handler.CreateExam)
			exam.GET("/calendar", middleware.RequireRole("admin", "institution"), handler.GetCalendarData)
			exam.GET("/:id", handler.GetExamDetail)
			exam.PUT("/:id", middleware.RequireRole("admin"), handler.UpdateExam)
			exam.PUT("/:id/time", middleware.RequireRole("admin", "institution"), handler.UpdateExamTime)
			exam.GET("/:id/conflicts", middleware.RequireRole("admin", "institution"), handler.CheckConflicts)
			exam.POST("/:id/apply", middleware.RequireRole("examinee"), handler.ApplyExam)
			exam.POST("/:id/approve", middleware.RequireRole("admin"), handler.ApproveExam)
		}

		question := api.Group("/questions")
		{
			question.GET("", middleware.RequireRole("admin", "institution"), handler.GetQuestionList)
			question.POST("", middleware.RequireRole("admin"), handler.CreateQuestion)
			question.PUT("/:id", middleware.RequireRole("admin"), handler.UpdateQuestion)
			question.DELETE("/:id", middleware.RequireRole("admin"), handler.DeleteQuestion)
			question.POST("/batch", middleware.RequireRole("admin"), handler.BatchImportQuestions)
		}

		paper := api.Group("/papers")
		{
			paper.POST("/generate", middleware.RequireRole("admin", "institution"), handler.GeneratePaper)
			paper.GET("/:id", middleware.RequireRole("admin", "institution"), handler.GetPaperDetail)
		}

		schedule := api.Group("/schedule")
		{
			schedule.GET("/workstations", middleware.RequireRole("admin"), handler.GetWorkstations)
			schedule.GET("/examiners/available", middleware.RequireRole("admin"), handler.GetAvailableExaminers)
			schedule.GET("/conflicts", middleware.RequireRole("admin"), handler.BatchCheckConflicts)
			schedule.POST("/assign", middleware.RequireRole("admin"), handler.AssignSchedule)
		}

		examiner := api.Group("/examiners")
		{
			examiner.GET("", middleware.RequireRole("admin"), handler.GetExaminerList)
			examiner.GET("/:id/warnings", middleware.RequireRole("admin"), handler.GetExaminerWarnings)
		}

		score := api.Group("/scores")
		{
			score.GET("", middleware.RequireRole("admin", "institution", "examiner"), handler.GetScoreList)
			score.POST("/batch", middleware.RequireRole("institution", "examiner"), handler.BatchImportScores)
			score.POST("/validate", middleware.RequireRole("institution", "examiner"), handler.ValidateScores)
			score.PUT("/:id", middleware.RequireRole("admin"), handler.ReviewScore)
			score.POST("/:id/publish", middleware.RequireRole("admin"), handler.PublishScore)
			score.GET("/public", middleware.RequireRole("examinee"), handler.GetMyScores)
		}

		certificate := api.Group("/certificates")
		{
			certificate.GET("", middleware.RequireRole("admin", "examinee"), handler.GetCertificateList)
			certificate.POST("/generate", middleware.RequireRole("admin"), handler.GenerateCertificates)
			certificate.GET("/:id/download", middleware.RequireRole("examinee", "admin"), handler.DownloadCertificate)
		}

		api.GET("/certificates/verify/:code", handler.VerifyCertificate)

		payment := api.Group("/payments")
		{
			payment.POST("", middleware.RequireRole("examinee"), handler.CreatePayment)
			payment.GET("", middleware.RequireRole("examinee", "admin"), handler.GetPaymentList)
			payment.GET("/order/:orderNo", middleware.RequireRole("examinee", "admin"), handler.GetPaymentDetail)
			payment.POST("/order/:orderNo/mock", middleware.RequireRole("examinee"), handler.MockPay)
			payment.POST("/refund/:id", middleware.RequireRole("admin"), handler.RefundPayment)
		}

		api.POST("/payment/notify", handler.PaymentNotify)

		statistics := api.Group("/statistics")
		{
			statistics.GET("/overview", middleware.RequireRole("admin"), handler.GetStatisticsOverview)
			statistics.GET("/monthly", middleware.RequireRole("admin"), handler.GetMonthlyStatistics)
			statistics.GET("/trade", middleware.RequireRole("admin"), handler.GetTradeStatistics)
			statistics.GET("/institution", middleware.RequireRole("admin"), handler.GetInstitutionStatistics)
			statistics.GET("/export", middleware.RequireRole("admin"), handler.ExportStatistics)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s...", port)
	log.Printf("API Documentation: http://localhost:%s/swagger/index.html", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
