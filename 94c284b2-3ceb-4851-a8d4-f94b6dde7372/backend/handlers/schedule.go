package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type ScheduleHandler struct{}

func NewScheduleHandler() *ScheduleHandler {
	return &ScheduleHandler{}
}

func (h *ScheduleHandler) List(c echo.Context) error {
	var schedules []models.Schedule
	query := config.DB.Preload("Doctor")

	if doctorID := c.QueryParam("doctorId"); doctorID != "" {
		query = query.Where("doctor_id = ?", doctorID)
	}
	if stationID := c.QueryParam("stationId"); stationID != "" {
		query = query.Where("station_id = ?", stationID)
	}
	if startDate := c.QueryParam("startDate"); startDate != "" {
		query = query.Where("schedule_date >= ?", startDate)
	}
	if endDate := c.QueryParam("endDate"); endDate != "" {
		query = query.Where("schedule_date <= ?", endDate)
	}
	if status := c.QueryParam("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	query.Order("schedule_date ASC, start_time ASC").Limit(200).Find(&schedules)
	return c.JSON(http.StatusOK, schedules)
}

func (h *ScheduleHandler) Create(c echo.Context) error {
	var s models.Schedule
	if err := c.Bind(&s); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	s.ID = uuid.New()
	s.CreatedAt = time.Now()
	s.UpdatedAt = time.Now()
	if s.Status == "" {
		s.Status = "active"
	}
	if s.ScheduleType == "" {
		s.ScheduleType = "regular"
	}
	if s.MaxPatients == 0 {
		s.MaxPatients = 20
	}

	if err := config.DB.Create(&s).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	syncScheduleTimeSlots(s)
	return c.JSON(http.StatusCreated, s)
}

func (h *ScheduleHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var s models.Schedule
	if err := config.DB.First(&s, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Schedule not found")
	}
	if err := c.Bind(&s); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	s.UpdatedAt = time.Now()
	config.DB.Save(&s)
	syncScheduleTimeSlots(s)
	return c.JSON(http.StatusOK, s)
}

func (h *ScheduleHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	result := config.DB.Delete(&models.Schedule{}, "id = ?", id)
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Schedule not found")
	}
	return c.NoContent(http.StatusOK)
}

func (h *ScheduleHandler) ListByDate(c echo.Context) error {
	date := c.QueryParam("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	var schedules []models.Schedule
	config.DB.Preload("Doctor").
		Where("schedule_date = ?", date).
		Order("start_time ASC").
		Find(&schedules)
	return c.JSON(http.StatusOK, schedules)
}

func syncScheduleTimeSlots(s models.Schedule) {
	config.DB.Model(&models.Appointment{}).
		Where("doctor_id = ? AND appointment_date = ? AND status = 'pending' AND (time_slot < ? OR time_slot > ?)",
			s.DoctorID, s.ScheduleDate, s.StartTime, s.EndTime).
		Update("status", "cancelled")
}
