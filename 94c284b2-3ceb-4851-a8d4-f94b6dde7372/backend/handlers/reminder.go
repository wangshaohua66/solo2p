package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type ReminderHandler struct{}

func NewReminderHandler() *ReminderHandler {
	return &ReminderHandler{}
}

func (h *ReminderHandler) List(c echo.Context) error {
	var reminders []models.Reminder
	query := config.DB.Preload("Patient")

	if patientID := c.QueryParam("patientId"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}
	if status := c.QueryParam("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if doctorID := c.QueryParam("doctorId"); doctorID != "" {
		query = query.Where("doctor_id = ?", doctorID)
	}

	query.Order("remind_at DESC").Limit(100).Find(&reminders)
	return c.JSON(http.StatusOK, reminders)
}

func (h *ReminderHandler) Create(c echo.Context) error {
	var r models.Reminder
	if err := c.Bind(&r); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	r.ID = uuid.New()
	r.CreatedAt = time.Now()
	if r.Status == "" {
		r.Status = "pending"
	}

	if err := config.DB.Create(&r).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, r)
}

func (h *ReminderHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var r models.Reminder
	if err := config.DB.First(&r, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Reminder not found")
	}
	if err := c.Bind(&r); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	config.DB.Save(&r)
	return c.JSON(http.StatusOK, r)
}

func (h *ReminderHandler) MarkSent(c echo.Context) error {
	id := c.Param("id")
	now := time.Now()
	result := config.DB.Model(&models.Reminder{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":  "sent",
			"sent_at": now,
		})
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Reminder not found")
	}
	return c.NoContent(http.StatusOK)
}

func (h *ReminderHandler) GetPendingReminders(c echo.Context) error {
	now := time.Now()
	var reminders []models.Reminder
	config.DB.Where("status = 'pending' AND remind_at <= ?", now).
		Order("remind_at ASC").
		Find(&reminders)
	return c.JSON(http.StatusOK, reminders)
}

func StartReminderScheduler() {
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for range ticker.C {
			processPendingReminders()
		}
	}()
	log.Println("Reminder scheduler started")
}

func processPendingReminders() {
	now := time.Now()
	var reminders []models.Reminder
	if err := config.DB.Where("status = 'pending' AND remind_at <= ?", now).Find(&reminders).Error; err != nil {
		log.Printf("[Reminder] query pending failed: %v", err)
		return
	}

	for _, r := range reminders {
		sentAt := time.Now()
		config.DB.Model(&models.Reminder{}).Where("id = ?", r.ID).
			Updates(map[string]interface{}{
				"status":  "sent",
				"sent_at": sentAt,
			})
		log.Printf("[Reminder] sent: id=%s patientId=%s title=%s", r.ID, r.PatientID, r.Title)
	}
}
