package handler

import (
	"net/http"
	"strconv"

	"venue-scheduler/internal/middleware"
	"venue-scheduler/internal/pkg/response"
	"venue-scheduler/internal/repository"
	"venue-scheduler/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FinanceHandler struct {
	db            *gorm.DB
	budgetService *service.BudgetService
}

func NewFinanceHandler(db *gorm.DB, budgetService *service.BudgetService) *FinanceHandler {
	return &FinanceHandler{
		db:            db,
		budgetService: budgetService,
	}
}

type CreateBudgetRequest struct {
	BookingID       uint    `json:"booking_id" binding:"required"`
	StageBudget     float64 `json:"stage_budget"`
	StaffBudget     float64 `json:"staff_budget"`
	MarketingBudget float64 `json:"marketing_budget"`
	VenueBudget     float64 `json:"venue_budget"`
}

func (h *FinanceHandler) CreateBudget(c *gin.Context) {
	_, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	var req CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var booking repository.Booking
	if err := h.db.First(&booking, req.BookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "booking not found"))
		return
	}

	var existingBudget repository.Budget
	result := h.db.Where("booking_id = ?", req.BookingID).First(&existingBudget)
	if result.Error == nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "budget already exists for this booking"))
		return
	}
	if result.Error != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to check existing budget"))
		return
	}

	totalBudget := req.StageBudget + req.StaffBudget + req.MarketingBudget + req.VenueBudget

	budget := repository.Budget{
		BookingID:       req.BookingID,
		StageBudget:     req.StageBudget,
		StaffBudget:     req.StaffBudget,
		MarketingBudget: req.MarketingBudget,
		VenueBudget:     req.VenueBudget,
		TotalBudget:     totalBudget,
		TotalSpent:      0,
		Status:          repository.BudgetStatusNormal,
	}

	if err := h.db.Create(&budget).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create budget"))
		return
	}

	if err := h.db.Preload("Booking").First(&budget, budget.ID).Error; err == nil {
		c.JSON(http.StatusCreated, response.Success(budget))
		return
	}

	c.JSON(http.StatusCreated, response.Success(budget))
}

func (h *FinanceHandler) GetBudget(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	var budget repository.Budget
	if err := h.db.Preload("Booking").First(&budget, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "budget not found"))
		return
	}

	var expenses []repository.Expense
	if err := h.db.Where("budget_id = ?", budget.ID).Preload("Submitter").
		Order("created_at DESC").Find(&expenses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query expenses"))
		return
	}

	warnings := h.budgetService.CheckBudgetWarning(&budget)

	c.JSON(http.StatusOK, response.Success(gin.H{
		"budget":   budget,
		"expenses": expenses,
		"warnings": warnings,
	}))
}

type AddExpenseRequest struct {
	Category    string  `json:"category" binding:"required,oneof=stage staff marketing venue"`
	Amount      float64 `json:"amount" binding:"required,gt=0"`
	Description string  `json:"description"`
}

func (h *FinanceHandler) AddExpense(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	var req AddExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var budget repository.Budget
	if err := h.db.First(&budget, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "budget not found"))
		return
	}

	expense := &repository.Expense{
		BudgetID:    uint(id),
		Category:    repository.ExpenseCategory(req.Category),
		Amount:      req.Amount,
		Description: req.Description,
		SubmittedBy: uid,
	}

	if err := h.budgetService.AddExpense(expense); err != nil {
		if budgetErr, ok := err.(*service.BudgetError); ok {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, budgetErr.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to add expense"))
		return
	}

	if err := h.db.Preload("Submitter").First(expense, expense.ID).Error; err == nil {
		c.JSON(http.StatusCreated, response.Success(expense))
		return
	}

	c.JSON(http.StatusCreated, response.Success(expense))
}

func (h *FinanceHandler) GetExpenses(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	var budget repository.Budget
	if err := h.db.First(&budget, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "budget not found"))
		return
	}

	query := h.db.Model(&repository.Expense{}).Where("budget_id = ?", id).Preload("Submitter")

	category := c.Query("category")
	if category != "" {
		query = query.Where("category = ?", category)
	}

	var expenses []repository.Expense
	if err := query.Order("created_at DESC").Find(&expenses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query expenses"))
		return
	}

	c.JSON(http.StatusOK, response.Success(expenses))
}

func (h *FinanceHandler) GenerateSettlement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	budget, categorySpent, err := h.budgetService.GetBudgetSummary(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "budget not found"))
		return
	}

	var expenses []repository.Expense
	if err := h.db.Where("budget_id = ?", id).Find(&expenses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query expenses"))
		return
	}

	calcDeviationRate := func(budgeted, actual float64) float64 {
		if budgeted == 0 {
			if actual == 0 {
				return 0
			}
			return 100
		}
		return ((actual - budgeted) / budgeted) * 100
	}

	budgetDetails := []gin.H{
		{
			"category":        "stage",
			"budgeted":        budget.StageBudget,
			"actual":          categorySpent["stage"],
			"deviation_rate":  calcDeviationRate(budget.StageBudget, categorySpent["stage"]),
			"deviation":       categorySpent["stage"] - budget.StageBudget,
		},
		{
			"category":        "staff",
			"budgeted":        budget.StaffBudget,
			"actual":          categorySpent["staff"],
			"deviation_rate":  calcDeviationRate(budget.StaffBudget, categorySpent["staff"]),
			"deviation":       categorySpent["staff"] - budget.StaffBudget,
		},
		{
			"category":        "marketing",
			"budgeted":        budget.MarketingBudget,
			"actual":          categorySpent["marketing"],
			"deviation_rate":  calcDeviationRate(budget.MarketingBudget, categorySpent["marketing"]),
			"deviation":       categorySpent["marketing"] - budget.MarketingBudget,
		},
		{
			"category":        "venue",
			"budgeted":        budget.VenueBudget,
			"actual":          categorySpent["venue"],
			"deviation_rate":  calcDeviationRate(budget.VenueBudget, categorySpent["venue"]),
			"deviation":       categorySpent["venue"] - budget.VenueBudget,
		},
	}

	totalDeviationRate := calcDeviationRate(budget.TotalBudget, budget.TotalSpent)

	c.JSON(http.StatusOK, response.Success(gin.H{
		"budget_id":         budget.ID,
		"booking_id":        budget.BookingID,
		"total_budgeted":    budget.TotalBudget,
		"total_actual":      budget.TotalSpent,
		"total_deviation":   budget.TotalSpent - budget.TotalBudget,
		"total_deviation_rate": totalDeviationRate,
		"status":            budget.Status,
		"budget_details":    budgetDetails,
		"expenses":          expenses,
	}))
}

func (h *FinanceHandler) GetNotifications(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	query := h.db.Model(&repository.Notification{}).Where("user_id = ?", uid)

	isRead := c.Query("is_read")
	if isRead != "" {
		if isRead == "true" {
			query = query.Where("is_read = ?", true)
		} else if isRead == "false" {
			query = query.Where("is_read = ?", false)
		}
	}

	var notifications []repository.Notification
	if err := query.Order("created_at DESC").Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query notifications"))
		return
	}

	c.JSON(http.StatusOK, response.Success(notifications))
}

func (h *FinanceHandler) MarkNotificationRead(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid notification id"))
		return
	}

	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	var notification repository.Notification
	if err := h.db.First(&notification, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "notification not found"))
		return
	}

	if notification.UserID != uid {
		c.JSON(http.StatusForbidden, response.Fail(http.StatusForbidden, "you don't have permission to update this notification"))
		return
	}

	if err := h.db.Model(&notification).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to mark notification as read"))
		return
	}

	notification.IsRead = true
	c.JSON(http.StatusOK, response.Success(notification))
}

func (h *FinanceHandler) GetSettlementPDF(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid budget id"))
		return
	}

	budget, categorySpent, err := h.budgetService.GetBudgetSummary(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "budget not found"))
		return
	}

	calcDeviationRate := func(budgeted, actual float64) float64 {
		if budgeted == 0 {
			if actual == 0 {
				return 0
			}
			return 100
		}
		return ((actual - budgeted) / budgeted) * 100
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"_type":       "pdf_export",
		"_description": "结算单PDF导出接口（模拟返回JSON数据）",
		"budget_id":   budget.ID,
		"booking_id":  budget.BookingID,
		"generated_at": nil,
		"content": gin.H{
			"title":            "演出预算结算单",
			"total_budgeted":   budget.TotalBudget,
			"total_actual":     budget.TotalSpent,
			"total_deviation":  budget.TotalSpent - budget.TotalBudget,
			"total_deviation_rate": calcDeviationRate(budget.TotalBudget, budget.TotalSpent),
			"status":           budget.Status,
			"breakdown": []gin.H{
				{
					"category":       "舞台制作",
					"budgeted":       budget.StageBudget,
					"actual":         categorySpent["stage"],
					"deviation":      categorySpent["stage"] - budget.StageBudget,
					"deviation_rate": calcDeviationRate(budget.StageBudget, categorySpent["stage"]),
				},
				{
					"category":       "人员费用",
					"budgeted":       budget.StaffBudget,
					"actual":         categorySpent["staff"],
					"deviation":      categorySpent["staff"] - budget.StaffBudget,
					"deviation_rate": calcDeviationRate(budget.StaffBudget, categorySpent["staff"]),
				},
				{
					"category":       "市场推广",
					"budgeted":       budget.MarketingBudget,
					"actual":         categorySpent["marketing"],
					"deviation":      categorySpent["marketing"] - budget.MarketingBudget,
					"deviation_rate": calcDeviationRate(budget.MarketingBudget, categorySpent["marketing"]),
				},
				{
					"category":       "场地费用",
					"budgeted":       budget.VenueBudget,
					"actual":         categorySpent["venue"],
					"deviation":      categorySpent["venue"] - budget.VenueBudget,
					"deviation_rate": calcDeviationRate(budget.VenueBudget, categorySpent["venue"]),
				},
			},
		},
	}))
}
