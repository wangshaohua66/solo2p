package handlers

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type StatsHandler struct{}

func NewStatsHandler() *StatsHandler {
	return &StatsHandler{}
}

func (h *StatsHandler) Overview(c echo.Context) error {
	var todayAppointments, pendingWarnings, totalPatients, highRiskPatients int64
	today := time.Now().Format("2006-01-02")

	config.DB.Model(&models.Appointment{}).Where("appointment_date = ?", today).Count(&todayAppointments)
	config.DB.Model(&models.Warning{}).Where("status != ?", "resolved").Count(&pendingWarnings)
	config.DB.Model(&models.Patient{}).Count(&totalPatients)
	config.DB.Model(&models.Patient{}).Where("risk_level = ?", "high").Count(&highRiskPatients)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"todayAppointments": todayAppointments,
		"pendingWarnings":   pendingWarnings,
		"totalPatients":     totalPatients,
		"highRiskPatients":  highRiskPatients,
	})
}

func (h *StatsHandler) Appointments(c echo.Context) error {
	type Result struct {
		Date  string `json:"date"`
		Count int64  `json:"count"`
	}
	var results []Result

	start := time.Now().AddDate(0, 0, -29).Format("2006-01-02")
	config.DB.Model(&models.Appointment{}).
		Select("DATE(appointment_date) as date, COUNT(*) as count").
		Where("appointment_date >= ?", start).
		Group("DATE(appointment_date)").
		Order("date ASC").
		Scan(&results)

	return c.JSON(http.StatusOK, results)
}

func (h *StatsHandler) Warnings(c echo.Context) error {
	type Result struct {
		Date       string `json:"date"`
		HighCount  int64  `json:"highCount"`
		MedCount   int64  `json:"mediumCount"`
		LowCount   int64  `json:"lowCount"`
	}
	var results []Result

	start := time.Now().AddDate(0, 0, -29).Format("2006-01-02")
	config.DB.Model(&models.Warning{}).
		Select("DATE(created_at) as date, "+
			"SUM(CASE WHEN risk_level='high' THEN 1 ELSE 0 END) as high_count, "+
			"SUM(CASE WHEN risk_level='medium' THEN 1 ELSE 0 END) as med_count, "+
			"SUM(CASE WHEN risk_level='low' THEN 1 ELSE 0 END) as low_count").
		Where("DATE(created_at) >= ?", start).
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&results)

	return c.JSON(http.StatusOK, results)
}

func (h *StatsHandler) Export(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":     true,
		"downloadUrl": "/exports/stats-report.xlsx",
		"exportedAt":  time.Now(),
	})
}
