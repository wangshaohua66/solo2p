package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/service"

	"github.com/labstack/echo/v4"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AuditHandler struct {
	auditLogService service.AuditLogService
}

func NewAuditHandler(auditLogService service.AuditLogService) *AuditHandler {
	return &AuditHandler{
		auditLogService: auditLogService,
	}
}

func (h *AuditHandler) RegisterRoutes(g *echo.Group) {
	audit := g.Group("/audit", middleware.JWTAuth("your-secret-key"), middleware.RBAC("audit:read"), SuperAdminRequired())
	{
		audit.GET("/logs", h.GetAuditLogs)
		audit.GET("/logs/:id", h.GetAuditLogDetail)
	}
}

func SuperAdminRequired() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !middleware.HasRole(c.Request().Context(), middleware.RoleSuperAdmin) {
				return middleware.ErrPermissionDenied
			}
			return next(c)
		}
	}
}

type GetAuditLogsRequest struct {
	UserID    *uint64    `form:"user_id"`
	TableName *string    `form:"table_name"`
	Action    *string    `form:"action"`
	StartDate *time.Time `form:"start_date" time_format:"2006-01-02"`
	EndDate   *time.Time `form:"end_date" time_format:"2006-01-02"`
	model.PaginationParams
}

func (h *AuditHandler) GetAuditLogs(c echo.Context) error {
	var req GetAuditLogsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "参数错误")
	}

	result, err := h.auditLogService.GetAuditLogList(c.Request().Context(), req.UserID, req.TableName, req.Action, req.StartDate, req.EndDate, &req.PaginationParams)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "获取审计日志失败")
	}

	return c.JSON(http.StatusOK, result)
}

type FieldDiff struct {
	Field    string      `json:"field"`
	OldValue interface{} `json:"oldValue"`
	NewValue interface{} `json:"newValue"`
}

type AuditLogDetailResponse struct {
	model.AuditLog
	FieldDiffs []FieldDiff `json:"fieldDiffs"`
}

func (h *AuditHandler) GetAuditLogDetail(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "无效的日志ID")
	}

	log, err := h.auditLogService.GetAuditLogDetail(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, "日志不存在")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "获取日志详情失败")
	}

	fieldDiffs := calculateFieldDiffs(log.OldValue, log.NewValue)

	response := AuditLogDetailResponse{
		AuditLog:   *log,
		FieldDiffs: fieldDiffs,
	}

	return c.JSON(http.StatusOK, response)
}

func calculateFieldDiffs(oldValue, newValue datatypes.JSON) []FieldDiff {
	var oldMap map[string]interface{}
	var newMap map[string]interface{}

	if oldValue != nil {
		_ = json.Unmarshal(oldValue, &oldMap)
	}
	if newValue != nil {
		_ = json.Unmarshal(newValue, &newMap)
	}

	diffs := make([]FieldDiff, 0)
	allFields := make(map[string]bool)

	for k := range oldMap {
		allFields[k] = true
	}
	for k := range newMap {
		allFields[k] = true
	}

	for field := range allFields {
		oldVal := oldMap[field]
		newVal := newMap[field]

		if !valuesEqual(oldVal, newVal) {
			diffs = append(diffs, FieldDiff{
				Field:    field,
				OldValue: oldVal,
				NewValue: newVal,
			})
		}
	}

	return diffs
}

func valuesEqual(a, b interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}
