package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type AuditHandler struct{}

func NewAuditHandler() *AuditHandler {
	return &AuditHandler{}
}

func (h *AuditHandler) List(c echo.Context) error {
	var logs []models.AuditLog
	query := config.DB
	if action := c.QueryParam("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	if userID := c.QueryParam("userId"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	query.Order("created_at DESC").Limit(200).Find(&logs)
	return c.JSON(http.StatusOK, logs)
}
