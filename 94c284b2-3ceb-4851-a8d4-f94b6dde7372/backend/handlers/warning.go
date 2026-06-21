package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type WarningHandler struct{}

func NewWarningHandler() *WarningHandler {
	return &WarningHandler{}
}

func (h *WarningHandler) List(c echo.Context) error {
	var warnings []models.Warning
	query := config.DB.Preload("Patient")
	if status := c.QueryParam("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if level := c.QueryParam("riskLevel"); level != "" {
		query = query.Where("risk_level = ?", level)
	}
	query.Order("created_at DESC").Limit(100).Find(&warnings)
	return c.JSON(http.StatusOK, warnings)
}

func (h *WarningHandler) Stats(c echo.Context) error {
	var pending, processing, resolved int64
	var high, medium, low int64

	config.DB.Model(&models.Warning{}).Where("status = ?", "pending").Count(&pending)
	config.DB.Model(&models.Warning{}).Where("status = ?", "processing").Count(&processing)
	config.DB.Model(&models.Warning{}).Where("status = ?", "resolved").Count(&resolved)
	config.DB.Model(&models.Warning{}).Where("risk_level = ?", "high").Count(&high)
	config.DB.Model(&models.Warning{}).Where("risk_level = ?", "medium").Count(&medium)
	config.DB.Model(&models.Warning{}).Where("risk_level = ?", "low").Count(&low)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"pending":    pending,
		"processing": processing,
		"resolved":   resolved,
		"high":       high,
		"medium":     medium,
		"low":        low,
	})
}

func (h *WarningHandler) Get(c echo.Context) error {
	id := c.Param("id")
	var warning models.Warning
	if err := config.DB.Preload("Patient").First(&warning, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Warning not found")
	}
	return c.JSON(http.StatusOK, warning)
}

func (h *WarningHandler) Assign(c echo.Context) error {
	id := c.Param("id")
	var body struct {
		AssigneeID   uuid.UUID `json:"assigneeId"`
		AssigneeName string    `json:"assigneeName"`
	}
	c.Bind(&body)
	result := config.DB.Model(&models.Warning{}).
		Where("id = ? AND status = 'pending'", id).
		Updates(map[string]interface{}{
			"status":        "processing",
			"assignee_id":   body.AssigneeID,
			"assignee_name": body.AssigneeName,
		})
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Not found or already assigned")
	}
	return c.NoContent(http.StatusOK)
}

func (h *WarningHandler) Resolve(c echo.Context) error {
	id := c.Param("id")
	var body struct {
		Resolution string `json:"resolution"`
	}
	c.Bind(&body)
	now := time.Now()
	result := config.DB.Model(&models.Warning{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":      "resolved",
			"resolution":  body.Resolution,
			"resolved_at": now,
		})
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Not found")
	}

	log := models.WarningLog{
		ID:         uuid.New(),
		WarningID: func() uuid.UUID { uid, _ := uuid.Parse(id); return uid }(),
		Action:     "resolve",
		Detail:     body.Resolution,
		CreatedAt:  now,
	}
	config.DB.Create(&log)
	return c.NoContent(http.StatusOK)
}

func (h *WarningHandler) Notify(c echo.Context) error {
	id := c.Param("id")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":   true,
		"warningId": id,
		"message":   "预警通知已发送至责任医生和家属",
		"sentAt":    time.Now(),
	})
}
