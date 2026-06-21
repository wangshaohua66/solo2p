package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type ReferralHandler struct{}

func NewReferralHandler() *ReferralHandler {
	return &ReferralHandler{}
}

func (h *ReferralHandler) List(c echo.Context) error {
	var referrals []models.Referral
	query := config.DB
	if status := c.QueryParam("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	query.Order("created_at DESC").Limit(100).Find(&referrals)
	return c.JSON(http.StatusOK, referrals)
}

func (h *ReferralHandler) Create(c echo.Context) error {
	var r models.Referral
	if err := c.Bind(&r); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	r.ID = uuid.New()
	r.Status = "pending"
	r.CreatedAt = time.Now()
	config.DB.Create(&r)
	return c.JSON(http.StatusCreated, r)
}

func (h *ReferralHandler) Accept(c echo.Context) error {
	id := c.Param("id")
	now := time.Now()
	result := config.DB.Model(&models.Referral{}).
		Where("id = ? AND status = 'pending'", id).
		Updates(map[string]interface{}{
			"status":      "accepted",
			"accepted_at": now,
		})
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Not found")
	}
	return c.NoContent(http.StatusOK)
}

func (h *ReferralHandler) Reject(c echo.Context) error {
	id := c.Param("id")
	var body struct {
		RejectReason string `json:"rejectReason"`
	}
	c.Bind(&body)
	result := config.DB.Model(&models.Referral{}).
		Where("id = ? AND status = 'pending'", id).
		Updates(map[string]interface{}{
			"status":        "rejected",
			"reject_reason": body.RejectReason,
		})
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Not found")
	}
	return c.NoContent(http.StatusOK)
}
