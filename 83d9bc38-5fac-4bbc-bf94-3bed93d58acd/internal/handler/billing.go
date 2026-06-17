package handler

import (
	"errors"
	"fmt"
	"net/http"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
	"equipment-booking/internal/service"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type BillingHandler struct {
	db              *gorm.DB
	billingRepo     repository.BillingRepository
	userRepo        repository.UserRepository
	billingService  service.BillingService
	auditLogService service.AuditLogService
}

func NewBillingHandler(
	db *gorm.DB,
	billingRepo repository.BillingRepository,
	userRepo repository.UserRepository,
	billingService service.BillingService,
	auditLogService service.AuditLogService,
) *BillingHandler {
	return &BillingHandler{
		db:              db,
		billingRepo:     billingRepo,
		userRepo:        userRepo,
		billingService:  billingService,
		auditLogService: auditLogService,
	}
}

type BillingListQuery struct {
	UserID   *uint64 `form:"user_id"`
	Year     *int    `form:"year"`
	Month    *int    `form:"month"`
	Status   *string `form:"status"`
	Page     int     `form:"page"`
	PageSize int     `form:"page_size"`
}

type ExportBillingRequest struct {
	Year  int `json:"year"`
	Month int `json:"month"`
}

type UpdateBudgetRequest struct {
	UserID uint64  `json:"user_id"`
	Amount float64 `json:"amount"`
	Remark string  `json:"remark"`
}

func (h *BillingHandler) getCurrentUser(c echo.Context) (*middleware.UserInfo, bool) {
	return middleware.GetUser(c.Request().Context())
}

func (h *BillingHandler) isAdmin(c echo.Context) bool {
	user, ok := h.getCurrentUser(c)
	if !ok {
		return false
	}
	return user.Role == middleware.RoleSuperAdmin ||
		user.Role == middleware.RoleCenterAdmin ||
		user.Role == middleware.RoleOperator
}

func (h *BillingHandler) getClientIP(c echo.Context) string {
	ip := c.Request().Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = c.RealIP()
	}
	return ip
}

func (h *BillingHandler) GetBillingList(c echo.Context) error {
	currentUser, ok := h.getCurrentUser(c)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户未登录")
	}

	var query BillingListQuery
	if err := c.Bind(&query); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误")
	}

	filter := &service.BillingFilter{}

	if !h.isAdmin(c) {
		filter.UserID = &currentUser.UserID
	} else {
		filter.UserID = query.UserID
	}

	filter.Year = query.Year
	filter.Month = query.Month
	filter.Status = query.Status

	pagination := &model.PaginationParams{
		Page:     query.Page,
		PageSize: query.PageSize,
	}

	result, err := h.billingService.GetBillingList(c.Request().Context(), filter, pagination)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	return successResponse(c, result)
}

func (h *BillingHandler) GetBillingDetail(c echo.Context) error {
	currentUser, ok := h.getCurrentUser(c)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户未登录")
	}

	id, err := parseUint64Param(c, "id")
	if err != nil {
		return err
	}

	billing, err := h.billingRepo.GetByIDWithDetails(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusNotFound, "账单不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	if !h.isAdmin(c) && billing.UserID != currentUser.UserID {
		return errorResponse(c, http.StatusForbidden, "权限不足")
	}

	return successResponse(c, billing)
}

func (h *BillingHandler) ExportMonthlyReport(c echo.Context) error {
	currentUser, ok := h.getCurrentUser(c)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户未登录")
	}

	var req ExportBillingRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误")
	}

	if req.Year == 0 {
		return errorResponse(c, http.StatusBadRequest, "年份不能为空")
	}
	if req.Month < 1 || req.Month > 12 {
		return errorResponse(c, http.StatusBadRequest, "月份必须在1-12之间")
	}

	if !h.isAdmin(c) {
		return errorResponse(c, http.StatusForbidden, "仅管理员可导出报表")
	}

	records, err := h.billingService.ExportMonthlyReport(c.Request().Context(), req.Year, req.Month)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "导出失败")
	}

	csvData, err := h.billingService.GenerateCSV(c.Request().Context(), records)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "生成CSV失败")
	}

	filename := fmt.Sprintf("billing_report_%04d_%02d.csv", req.Year, req.Month)
	c.Response().Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	_ = h.auditLogService.LogAction(
		c.Request().Context(),
		"export_billing",
		"billings",
		nil,
		nil,
		map[string]interface{}{
			"year":  req.Year,
			"month": req.Month,
		},
		&currentUser.UserID,
		h.getClientIP(c),
	)

	return c.Blob(http.StatusOK, "text/csv; charset=utf-8", csvData)
}

func (h *BillingHandler) GetUserBudget(c echo.Context) error {
	currentUser, ok := h.getCurrentUser(c)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户未登录")
	}

	budget, err := h.billingService.GetUserBudget(c.Request().Context(), currentUser.UserID)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return errorResponse(c, http.StatusNotFound, "用户不存在")
		}
		return errorResponse(c, http.StatusInternalServerError, "查询失败")
	}

	return successResponse(c, map[string]interface{}{
		"user_id": currentUser.UserID,
		"budget":  budget,
	})
}

func (h *BillingHandler) UpdateBudget(c echo.Context) error {
	currentUser, ok := h.getCurrentUser(c)
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户未登录")
	}

	if !h.isAdmin(c) {
		return errorResponse(c, http.StatusForbidden, "仅管理员可调整经费")
	}

	var req UpdateBudgetRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "参数错误")
	}

	if req.UserID == 0 {
		return errorResponse(c, http.StatusBadRequest, "用户ID不能为空")
	}
	if req.Amount == 0 {
		return errorResponse(c, http.StatusBadRequest, "调整金额不能为0")
	}

	newBudget, err := h.billingService.UpdateBudget(
		c.Request().Context(),
		req.UserID,
		req.Amount,
		req.Remark,
		&currentUser.UserID,
		h.getClientIP(c),
	)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return errorResponse(c, http.StatusNotFound, "用户不存在")
		}
		if errors.Is(err, service.ErrInsufficientBudget) {
			return errorResponse(c, http.StatusBadRequest, "经费余额不足")
		}
		return errorResponse(c, http.StatusInternalServerError, "调整失败")
	}

	return successResponse(c, map[string]interface{}{
		"user_id":    req.UserID,
		"new_budget": newBudget,
		"amount":     req.Amount,
	})
}
