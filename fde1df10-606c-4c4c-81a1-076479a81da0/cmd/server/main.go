package main

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"venue-scheduler/internal/config"
	"venue-scheduler/internal/handler"
	"venue-scheduler/internal/middleware"
	"venue-scheduler/internal/pkg/response"
	"venue-scheduler/internal/repository"
	"venue-scheduler/internal/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	_ "venue-scheduler/docs"
)

// @title 场馆调度系统 API
// @version 1.0
// @description 剧院场馆调度与资源管理系统 API 文档
// @host localhost:8080
// @BasePath /
// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
func main() {
	cfg := config.LoadConfig()

	db, err := gorm.Open(mysql.Open(cfg.DB.DSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get sql DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(cfg.DB.MaxOpen)
	sqlDB.SetMaxIdleConns(cfg.DB.MaxIdle)

	err = db.AutoMigrate(
		&repository.User{},
		&repository.Venue{},
		&repository.Booking{},
		&repository.Equipment{},
		&repository.EquipmentBooking{},
		&repository.Contract{},
		&repository.ContractApproval{},
		&repository.Budget{},
		&repository.Expense{},
		&repository.RehearsalBooking{},
		&repository.Notification{},
	)
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	seedData(db)

	jwt := middleware.NewJWT(cfg.JWT.Secret, cfg.JWT.ExpireHours)

	scheduleService := service.NewScheduleService(db)
	budgetService := service.NewBudgetService(db)

	authHandler := handler.NewAuthHandler(db, jwt)
	bookingHandler := handler.NewBookingHandler(db, scheduleService)
	resourceHandler := handler.NewResourceHandler(db)
	contractHandler := NewContractHandler(db)
	budgetHandler := NewBudgetHandler(db, budgetService)
	notificationHandler := NewNotificationHandler(db)

	gin.SetMode(cfg.Server.Mode)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	public := r.Group("/api")
	{
		public.POST("/auth/login", authHandler.Login)
		public.POST("/auth/register", authHandler.Register)
	}

	url := ginSwagger.URL("http://localhost:8080/swagger/doc.json")
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler, url))

	api := r.Group("/api")
	api.Use(jwt.JWTAuth())
	{
		auth := api.Group("/auth")
		{
			auth.GET("/me", authHandler.GetCurrentUser)
		}

		venues := api.Group("/venues")
		{
			venues.GET("", resourceHandler.ListVenues)
			venues.POST("", resourceHandler.CreateVenue)
			venues.PUT("", resourceHandler.UpdateVenue)
			venues.PUT("/:id/maintenance", resourceHandler.SetVenueMaintenance)
		}

		bookings := api.Group("/bookings")
		{
			bookings.GET("", bookingHandler.GetBookings)
			bookings.POST("", bookingHandler.CreateBooking)
			bookings.PUT("", bookingHandler.UpdateBooking)
			bookings.DELETE("/:id", bookingHandler.DeleteBooking)
			bookings.GET("/:id", bookingHandler.GetBooking)
			bookings.PUT("/:id/approve", bookingHandler.ApproveBooking)
			bookings.GET("/stats", bookingHandler.GetStats)
			bookings.POST("/:id/equipments", resourceHandler.BindEquipmentsToBooking)
			bookings.DELETE("/:id/equipments/:equipment_id", resourceHandler.UnbindEquipment)
		}

		equipments := api.Group("/equipments")
		{
			equipments.GET("", resourceHandler.ListEquipments)
			equipments.POST("", resourceHandler.CreateEquipment)
			equipments.PUT("", resourceHandler.UpdateEquipment)
			equipments.GET("/:id", resourceHandler.GetEquipment)
			equipments.PUT("/:id/maintenance", resourceHandler.SetEquipmentMaintenance)
			equipments.GET("/available", resourceHandler.GetAvailableEquipments)
		}

		rehearsals := api.Group("/rehearsals")
		{
			rehearsals.GET("", resourceHandler.ListRehearsalBookings)
			rehearsals.POST("", resourceHandler.CreateRehearsalBooking)
			rehearsals.DELETE("/:id", resourceHandler.CancelRehearsalBooking)
		}

		contracts := api.Group("/contracts")
		{
			contracts.GET("", contractHandler.ListContracts)
			contracts.POST("", contractHandler.CreateContract)
			contracts.PUT("", contractHandler.UpdateContract)
			contracts.GET("/:id", contractHandler.GetContract)
			contracts.PUT("/:id/approve", contractHandler.ApproveContract)
		}

		budgets := api.Group("/budgets")
		{
			budgets.GET("", budgetHandler.ListBudgets)
			budgets.POST("", budgetHandler.CreateBudget)
			budgets.GET("/:id", budgetHandler.GetBudget)
			budgets.POST("/:id/expenses", budgetHandler.AddExpense)
			budgets.GET("/:id/expenses", budgetHandler.ListExpenses)
			budgets.GET("/:id/settlement", budgetHandler.GetSettlement)
			budgets.GET("/:id/settlement/pdf", budgetHandler.GetSettlementPDF)
		}

		notifications := api.Group("/notifications")
		{
			notifications.GET("", notificationHandler.ListNotifications)
			notifications.PUT("/:id/read", notificationHandler.MarkAsRead)
		}
	}

	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func seedData(db *gorm.DB) {
	var venueCount int64
	db.Model(&repository.Venue{}).Count(&venueCount)
	if venueCount == 0 {
		venues := []repository.Venue{
			{Name: "大剧院", Type: repository.VenueTypeTheater, Capacity: 1200, Location: "主楼一层", Status: repository.VenueStatusActive, Description: "大型歌剧、舞剧、交响乐演出场地"},
			{Name: "音乐厅", Type: repository.VenueTypeConcertHall, Capacity: 800, Location: "主楼二层", Status: repository.VenueStatusActive, Description: "室内乐、独奏、独唱音乐会场地"},
			{Name: "实验剧场", Type: repository.VenueTypeExperimentalTheater, Capacity: 300, Location: "东楼", Status: repository.VenueStatusActive, Description: "小剧场戏剧、先锋艺术演出场地"},
			{Name: "排练厅1号", Type: repository.VenueTypeRehearsalRoom, Capacity: 50, Location: "西楼一层", Status: repository.VenueStatusActive, Description: "大型剧目排练场地"},
			{Name: "排练厅2号", Type: repository.VenueTypeRehearsalRoom, Capacity: 40, Location: "西楼一层", Status: repository.VenueStatusActive, Description: "中型剧目排练场地"},
			{Name: "排练厅3号", Type: repository.VenueTypeRehearsalRoom, Capacity: 30, Location: "西楼二层", Status: repository.VenueStatusActive, Description: "小型剧目排练场地"},
			{Name: "排练厅4号", Type: repository.VenueTypeRehearsalRoom, Capacity: 30, Location: "西楼二层", Status: repository.VenueStatusActive, Description: "舞蹈排练场地"},
			{Name: "排练厅5号", Type: repository.VenueTypeRehearsalRoom, Capacity: 20, Location: "西楼三层", Status: repository.VenueStatusActive, Description: "声乐排练场地"},
			{Name: "排练厅6号", Type: repository.VenueTypeRehearsalRoom, Capacity: 20, Location: "西楼三层", Status: repository.VenueStatusActive, Description: "器乐排练场地"},
		}
		for _, v := range venues {
			db.Create(&v)
		}
		log.Println("Seed venues created successfully")
	}

	var userCount int64
	db.Model(&repository.User{}).Count(&userCount)
	if userCount == 0 {
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
		users := []repository.User{
			{Username: "venue_manager", PasswordHash: string(hashedPassword), RealName: "场馆管理员", Role: repository.UserRoleVenueManager, Email: "venue_manager@example.com", Phone: "13800000001"},
			{Username: "producer", PasswordHash: string(hashedPassword), RealName: "制作人", Role: repository.UserRoleProducer, Email: "producer@example.com", Phone: "13800000002"},
			{Username: "tech_director", PasswordHash: string(hashedPassword), RealName: "技术总监", Role: repository.UserRoleTechDirector, Email: "tech_director@example.com", Phone: "13800000003"},
			{Username: "finance", PasswordHash: string(hashedPassword), RealName: "财务人员", Role: repository.UserRoleFinance, Email: "finance@example.com", Phone: "13800000004"},
			{Username: "troupe_admin", PasswordHash: string(hashedPassword), RealName: "剧团管理员", Role: repository.UserRoleTroupeAdmin, Email: "troupe_admin@example.com", Phone: "13800000005"},
		}
		for _, u := range users {
			db.Create(&u)
		}
		log.Println("Seed users created successfully")
	}
}

type ContractHandler struct {
	db *gorm.DB
}

func NewContractHandler(db *gorm.DB) *ContractHandler {
	return &ContractHandler{db: db}
}

func (h *ContractHandler) ListContracts(c *gin.Context) {
	var contracts []repository.Contract
	if err := h.db.Preload("Booking").Preload("Submitter").Find(&contracts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query contracts"))
		return
	}
	c.JSON(http.StatusOK, response.Success(contracts))
}

type CreateContractRequest struct {
	BookingID uint   `json:"booking_id" binding:"required"`
	Title     string `json:"title" binding:"required"`
	Content   string `json:"content"`
}

func (h *ContractHandler) CreateContract(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	var req CreateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	contract := repository.Contract{
		BookingID:   req.BookingID,
		SubmitterID: userID,
		Title:       req.Title,
		Content:     req.Content,
		Status:      repository.ContractStatusPendingTech,
		CurrentStep: 0,
	}

	if err := h.db.Create(&contract).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create contract"))
		return
	}

	c.JSON(http.StatusCreated, response.Success(contract))
}

type UpdateContractRequest struct {
	ID      uint   `json:"id" binding:"required"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

func (h *ContractHandler) UpdateContract(c *gin.Context) {
	var req UpdateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var contract repository.Contract
	if err := h.db.First(&contract, req.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "contract not found"))
		return
	}

	if req.Title != "" {
		contract.Title = req.Title
	}
	if req.Content != "" {
		contract.Content = req.Content
	}

	if err := h.db.Save(&contract).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update contract"))
		return
	}

	c.JSON(http.StatusOK, response.Success(contract))
}

func (h *ContractHandler) GetContract(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid contract id"))
		return
	}

	var contract repository.Contract
	if err := h.db.Preload("Booking").Preload("Submitter").First(&contract, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "contract not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(contract))
}

type ApproveContractRequest struct {
	Action  string `json:"action" binding:"required,oneof=approve reject return"`
	Comment string `json:"comment"`
}

func (h *ContractHandler) ApproveContract(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid contract id"))
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	var req ApproveContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var contract repository.Contract
	if err := h.db.First(&contract, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "contract not found"))
		return
	}

	tx := h.db.Begin()

	approval := repository.ContractApproval{
		ContractID: uint(id),
		ApproverID: userID,
		Step:       contract.CurrentStep,
		Action:     repository.ContractApprovalAction(req.Action),
		Comment:    req.Comment,
	}
	if err := tx.Create(&approval).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create approval record"))
		return
	}

	switch req.Action {
	case "approve":
		steps := []repository.ContractStatus{
			repository.ContractStatusPendingTech,
			repository.ContractStatusPendingFinance,
			repository.ContractStatusPendingVenue,
			repository.ContractStatusApproved,
		}
		if contract.CurrentStep < len(steps)-1 {
			contract.CurrentStep++
			contract.Status = steps[contract.CurrentStep]
		} else {
			contract.Status = repository.ContractStatusApproved
		}
	case "reject":
		contract.Status = repository.ContractStatusRejected
	case "return":
		contract.Status = repository.ContractStatusReturned
	}

	if err := tx.Save(&contract).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update contract status"))
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, response.Success(contract))
}

type BudgetHandler struct {
	db            *gorm.DB
	budgetService *service.BudgetService
}

func NewBudgetHandler(db *gorm.DB, budgetService *service.BudgetService) *BudgetHandler {
	return &BudgetHandler{db: db, budgetService: budgetService}
}

func (h *BudgetHandler) ListBudgets(c *gin.Context) {
	var budgets []repository.Budget
	if err := h.db.Preload("Booking").Find(&budgets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query budgets"))
		return
	}
	c.JSON(http.StatusOK, response.Success(budgets))
}

type CreateBudgetRequest struct {
	BookingID       uint    `json:"booking_id" binding:"required"`
	StageBudget     float64 `json:"stage_budget"`
	StaffBudget     float64 `json:"staff_budget"`
	MarketingBudget float64 `json:"marketing_budget"`
	VenueBudget     float64 `json:"venue_budget"`
	TotalBudget     float64 `json:"total_budget"`
}

func (h *BudgetHandler) CreateBudget(c *gin.Context) {
	var req CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	budget := repository.Budget{
		BookingID:       req.BookingID,
		StageBudget:     req.StageBudget,
		StaffBudget:     req.StaffBudget,
		MarketingBudget: req.MarketingBudget,
		VenueBudget:     req.VenueBudget,
		TotalBudget:     req.TotalBudget,
	}

	if err := h.db.Create(&budget).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create budget"))
		return
	}

	c.JSON(http.StatusCreated, response.Success(budget))
}

func (h *BudgetHandler) GetBudget(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	budget, categorySpent, err := h.budgetService.GetBudgetSummary(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "budget not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"budget":         budget,
		"category_spent": categorySpent,
	}))
}

type AddExpenseRequest struct {
	Category    repository.ExpenseCategory `json:"category" binding:"required"`
	Amount      float64                    `json:"amount" binding:"required,gt=0"`
	Description string                     `json:"description"`
}

func (h *BudgetHandler) AddExpense(c *gin.Context) {
	budgetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	var req AddExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	expense := &repository.Expense{
		BudgetID:    uint(budgetID),
		Category:    req.Category,
		Amount:      req.Amount,
		Description: req.Description,
		SubmittedBy: userID,
	}

	if err := h.budgetService.AddExpense(expense); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, err.Error()))
		return
	}

	c.JSON(http.StatusCreated, response.Success(expense))
}

func (h *BudgetHandler) ListExpenses(c *gin.Context) {
	budgetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	var expenses []repository.Expense
	if err := h.db.Where("budget_id = ?", uint(budgetID)).Preload("Submitter").Find(&expenses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query expenses"))
		return
	}

	c.JSON(http.StatusOK, response.Success(expenses))
}

func (h *BudgetHandler) GetSettlement(c *gin.Context) {
	budgetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	budget, categorySpent, err := h.budgetService.GetBudgetSummary(uint(budgetID))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "budget not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"budget":         budget,
		"category_spent": categorySpent,
		"remaining":      budget.TotalBudget - budget.TotalSpent,
	}))
}

func (h *BudgetHandler) GetSettlementPDF(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, response.Success(gin.H{
		"message":      "PDF generation endpoint",
		"budget_id":    id,
		"format":       "pdf",
		"download_url": fmt.Sprintf("/api/budgets/%s/settlement/pdf/download", id),
	}))
}

type NotificationHandler struct {
	db *gorm.DB
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	var notifications []repository.Notification
	if err := h.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query notifications"))
		return
	}

	c.JSON(http.StatusOK, response.Success(notifications))
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid notification id"))
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	result := h.db.Model(&repository.Notification{}).
		Where("id = ? AND user_id = ?", uint(id), userID).
		Update("is_read", true)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to mark notification as read"))
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "notification not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{"id": id, "is_read": true}))
}
