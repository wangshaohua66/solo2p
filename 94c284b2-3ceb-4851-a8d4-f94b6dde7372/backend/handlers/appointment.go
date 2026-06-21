package handlers

import (
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type AppointmentHandler struct {
	db *gorm.DB
}

func NewAppointmentHandler() *AppointmentHandler {
	return &AppointmentHandler{db: config.DB}
}

type MatchRequest struct {
	PatientID          uuid.UUID `json:"patientId"`
	Department         string    `json:"department"`
	PreferredDate      string    `json:"preferredDate"`
	PreferredTimeRange string    `json:"preferredTimeRange"`
	DoctorGender       string    `json:"doctorGender"`
	DoctorTitle        string    `json:"doctorTitle"`
	Language           string    `json:"language"`
}

type MatchResult struct {
	DoctorID         uuid.UUID `json:"doctorId"`
	DoctorName       string    `json:"doctorName"`
	DoctorTitle      string    `json:"doctorTitle"`
	Department       string    `json:"department"`
	StationName      string    `json:"stationName"`
	Date             string    `json:"date"`
	TimeSlot         string    `json:"timeSlot"`
	MatchScore       int       `json:"matchScore"`
	MatchReasons     []string  `json:"matchReasons"`
	DistanceKm       float64   `json:"distanceKm,omitempty"`
	HistoricalVisits int       `json:"historicalVisits"`
}

func (h *AppointmentHandler) List(c echo.Context) error {
	var appointments []models.Appointment
	query := h.db.Preload("Patient").Preload("Doctor").Preload("Doctor.Station")

	if status := c.QueryParam("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if doctorID := c.QueryParam("doctorId"); doctorID != "" {
		query = query.Where("doctor_id = ?", doctorID)
	}
	if date := c.QueryParam("date"); date != "" {
		query = query.Where("appointment_date = ?", date)
	}

	query.Order("created_at DESC").Limit(100).Find(&appointments)
	return c.JSON(http.StatusOK, appointments)
}

func (h *AppointmentHandler) Get(c echo.Context) error {
	id := c.Param("id")
	var appointment models.Appointment
	if err := h.db.Preload("Patient").Preload("Doctor").Preload("Doctor.Station").
		First(&appointment, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Appointment not found")
	}
	return c.JSON(http.StatusOK, appointment)
}

func (h *AppointmentHandler) Match(c echo.Context) error {
	var req MatchRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var patient models.Patient
	if err := h.db.First(&patient, "id = ?", req.PatientID).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Patient not found")
	}

	var doctors []models.Doctor
	q := h.db.Preload("Station").Where("department = ?", req.Department)
	if req.DoctorGender != "" && req.DoctorGender != "any" {
		q = q.Where("gender = ?", req.DoctorGender)
	}
	if req.DoctorTitle != "" {
		q = q.Where("title = ?", req.DoctorTitle)
	}
	q.Find(&doctors)

	timeSlots := generateTimeSlots(req.PreferredTimeRange)
	prefDate, _ := time.Parse("2006-01-02", req.PreferredDate)
	if prefDate.IsZero() {
		prefDate = time.Now().AddDate(0, 0, 1)
	}

	var results []MatchResult
	for _, doctor := range doctors {
		for i := 0; i < 7; i++ {
			apptDate := prefDate.AddDate(0, 0, i)
			for _, slot := range timeSlots {
				var count int64
				h.db.Model(&models.Appointment{}).
					Where("doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status NOT IN ('cancelled')",
						doctor.ID, apptDate, slot).Count(&count)
				if count > 0 {
					continue
				}

				score := 0
				var reasons []string

				if i == 0 {
					score += 40
					reasons = append(reasons, "符合期望日期")
				} else if i <= 2 {
					score += 20
					reasons = append(reasons, "接近期望日期")
				}

				distance := haversine(patient.Lat, patient.Lng, doctor.Station.Lat, doctor.Station.Lng)
				if distance < 2 {
					score += 25
					reasons = append(reasons, "距离较近")
				} else if distance < 5 {
					score += 15
				}

				var histCount int64
				h.db.Model(&models.Appointment{}).
					Where("patient_id = ? AND doctor_id = ?", patient.ID, doctor.ID).Count(&histCount)
				if histCount > 0 {
					score += 20
					reasons = append(reasons, "历史就诊医生")
				}

				if req.Language != "" && doctor.Languages != "" {
					score += 10
					reasons = append(reasons, "语言匹配")
				}

				if score >= 30 {
					results = append(results, MatchResult{
						DoctorID:         doctor.ID,
						DoctorName:       doctor.Name,
						DoctorTitle:      doctor.Title,
						Department:       doctor.Department,
						StationName:      doctor.Station.Name,
						Date:             apptDate.Format("2006-01-02"),
						TimeSlot:         slot,
						MatchScore:       score,
						MatchReasons:     reasons,
						DistanceKm:       math.Round(distance*100) / 100,
						HistoricalVisits: int(histCount),
					})
				}
			}
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].MatchScore > results[j].MatchScore
	})
	if len(results) > 3 {
		results = results[:3]
	}
	return c.JSON(http.StatusOK, results)
}

func (h *AppointmentHandler) Create(c echo.Context) error {
	var appt models.Appointment
	if err := c.Bind(&appt); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	appt.ID = uuid.New()
	appt.Status = "confirmed"
	appt.CreatedAt = time.Now()
	appt.UpdatedAt = time.Now()

	if err := h.db.Create(&appt).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var patient models.Patient
	h.db.First(&patient, "id = ?", appt.PatientID)
	if patient.ID != uuid.Nil {
		go recalculateRiskScore(h.db, patient.ID)
	}

	return c.JSON(http.StatusCreated, appt)
}

func (h *AppointmentHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var appt models.Appointment
	if err := h.db.First(&appt, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Not found")
	}
	if err := c.Bind(&appt); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	appt.UpdatedAt = time.Now()
	h.db.Save(&appt)
	return c.JSON(http.StatusOK, appt)
}

func (h *AppointmentHandler) UpdateStatus(c echo.Context) error {
	id := c.Param("id")
	var body struct {
		Status string `json:"status"`
	}
	c.Bind(&body)
	result := h.db.Model(&models.Appointment{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": body.Status, "updated_at": time.Now()})
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Not found")
	}
	return c.NoContent(http.StatusOK)
}

func (h *AppointmentHandler) Cancel(c echo.Context) error {
	id := c.Param("id")
	result := h.db.Model(&models.Appointment{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": "cancelled", "updated_at": time.Now()})
	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Not found")
	}
	return c.NoContent(http.StatusOK)
}

func generateTimeSlots(timeRange string) []string {
	morning := []string{"08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"}
	afternoon := []string{"14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"}
	evening := []string{"18:00", "18:30", "19:00", "19:30", "20:00"}

	switch timeRange {
	case "morning":
		return morning
	case "afternoon":
		return afternoon
	case "evening":
		return evening
	default:
		return append(append(morning, afternoon...), evening...)
	}
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func ListStations(c echo.Context) error {
	var stations []models.Station
	config.DB.Find(&stations)
	return c.JSON(http.StatusOK, stations)
}

func ListDoctors(c echo.Context) error {
	var doctors []models.Doctor
	query := config.DB.Preload("Station")
	if dept := c.QueryParam("department"); dept != "" {
		query = query.Where("department = ?", dept)
	}
	query.Find(&doctors)
	return c.JSON(http.StatusOK, doctors)
}
