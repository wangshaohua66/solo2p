package handlers

import (
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type PatientHandler struct {
	db *gorm.DB
}

func NewPatientHandler() *PatientHandler {
	return &PatientHandler{db: config.DB}
}

func (h *PatientHandler) List(c echo.Context) error {
	var patients []models.Patient
	query := h.db.Preload("Station")

	if keyword := c.QueryParam("keyword"); keyword != "" {
		q := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR phone LIKE ?", q, q)
	}
	if risk := c.QueryParam("riskLevel"); risk != "" {
		query = query.Where("risk_level = ?", risk)
	}
	if stationID := c.QueryParam("stationId"); stationID != "" {
		query = query.Where("station_id = ?", stationID)
	}

	query.Order("created_at DESC").Limit(100).Find(&patients)
	return c.JSON(http.StatusOK, patients)
}

func (h *PatientHandler) Get(c echo.Context) error {
	id := c.Param("id")
	var patient models.Patient
	if err := h.db.Preload("Station").First(&patient, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Patient not found")
	}
	return c.JSON(http.StatusOK, patient)
}

func (h *PatientHandler) Create(c echo.Context) error {
	var patient models.Patient
	if err := c.Bind(&patient); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	patient.ID = uuid.New()
	patient.RiskLevel = "low"
	patient.RiskScore = 0
	patient.CreatedAt = time.Now()
	patient.UpdatedAt = time.Now()

	if err := h.db.Create(&patient).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, patient)
}

func (h *PatientHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var patient models.Patient
	if err := h.db.First(&patient, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Not found")
	}
	if err := c.Bind(&patient); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	patient.UpdatedAt = time.Now()
	h.db.Save(&patient)
	return c.JSON(http.StatusOK, patient)
}

func (h *PatientHandler) ListDiagnoses(c echo.Context) error {
	patientID := c.Param("id")
	var records []models.DiagnosisRecord
	h.db.Where("patient_id = ?", patientID).Order("diagnosis_date DESC").Find(&records)
	return c.JSON(http.StatusOK, records)
}

func (h *PatientHandler) CreateDiagnosis(c echo.Context) error {
	patientID := c.Param("id")
	var record models.DiagnosisRecord
	if err := c.Bind(&record); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	record.ID = uuid.New()
	record.PatientID, _ = uuid.Parse(patientID)
	record.CreatedAt = time.Now()
	if record.DiagnosisDate.IsZero() {
		record.DiagnosisDate = time.Now()
	}
	h.db.Create(&record)
	go recalculateRiskScore(h.db, record.PatientID)
	return c.JSON(http.StatusCreated, record)
}

func (h *PatientHandler) ListMedications(c echo.Context) error {
	patientID := c.Param("id")
	var meds []models.Medication
	h.db.Where("patient_id = ?", patientID).Order("created_at DESC").Find(&meds)
	return c.JSON(http.StatusOK, meds)
}

func (h *PatientHandler) CreateMedication(c echo.Context) error {
	patientID := c.Param("id")
	var med models.Medication
	if err := c.Bind(&med); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	med.ID = uuid.New()
	med.PatientID, _ = uuid.Parse(patientID)
	med.CreatedAt = time.Now()
	med.UpdatedAt = time.Now()
	h.db.Create(&med)
	go recalculateRiskScore(h.db, med.PatientID)
	return c.JSON(http.StatusCreated, med)
}

func (h *PatientHandler) ListAssessments(c echo.Context) error {
	patientID := c.Param("id")
	var assessments []models.Assessment
	h.db.Where("patient_id = ?", patientID).Order("assessed_at DESC").Find(&assessments)
	return c.JSON(http.StatusOK, assessments)
}

func (h *PatientHandler) CreateAssessment(c echo.Context) error {
	patientID := c.Param("id")
	var assessment models.Assessment
	if err := c.Bind(&assessment); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	assessment.ID = uuid.New()
	assessment.PatientID, _ = uuid.Parse(patientID)
	if assessment.AssessedAt.IsZero() {
		assessment.AssessedAt = time.Now()
	}
	assessment.CreatedAt = time.Now()

	assessment.TotalScore = calculateScaleScore(assessment.ScaleCode, assessment.Answers)
	assessment.Severity = classifySeverity(assessment.ScaleCode, assessment.TotalScore)

	h.db.Create(&assessment)
	go recalculateRiskScore(h.db, assessment.PatientID)
	return c.JSON(http.StatusCreated, assessment)
}

func (h *PatientHandler) ListFollowups(c echo.Context) error {
	patientID := c.Param("id")
	var records []models.Followup
	h.db.Where("patient_id = ?", patientID).Order("planned_date DESC").Find(&records)
	return c.JSON(http.StatusOK, records)
}

func (h *PatientHandler) CreateFollowup(c echo.Context) error {
	patientID := c.Param("id")
	var f models.Followup
	if err := c.Bind(&f); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	f.ID = uuid.New()
	f.PatientID, _ = uuid.Parse(patientID)
	f.CreatedAt = time.Now()
	f.UpdatedAt = time.Now()
	if f.Status == "" {
		f.Status = "pending"
	}
	h.db.Create(&f)
	return c.JSON(http.StatusCreated, f)
}

func (h *PatientHandler) ExportPDF(c echo.Context) error {
	patientID := c.Param("id")
	var patient models.Patient
	h.db.Preload("Station").First(&patient, "id = ?", patientID)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"downloadUrl": "/exports/patient-" + patientID + ".pdf",
		"exportedAt": time.Now(),
		"patient":    patient.Name,
	})
}

func calculateScaleScore(scaleCode string, answers map[string]interface{}) int {
	total := 0
	for _, v := range answers {
		switch val := v.(type) {
		case float64:
			total += int(val)
		case int:
			total += val
		}
	}
	return total
}

func classifySeverity(scaleCode string, score int) string {
	code := strings.ToUpper(scaleCode)
	switch code {
	case "PHQ-9":
		if score >= 20 {
			return "severe"
		} else if score >= 15 {
			return "moderate"
		} else if score >= 5 {
			return "mild"
		}
	case "GAD-7":
		if score >= 15 {
			return "severe"
		} else if score >= 10 {
			return "moderate"
		} else if score >= 5 {
			return "mild"
		}
	case "SCL-90":
		if score >= 200 {
			return "severe"
		} else if score >= 150 {
			return "moderate"
		} else if score >= 100 {
			return "mild"
		}
	default:
		if score >= 70 {
			return "severe"
		} else if score >= 40 {
			return "moderate"
		} else if score >= 20 {
			return "mild"
		}
	}
	return "normal"
}

func recalculateRiskScore(db *gorm.DB, patientID uuid.UUID) {
	var assessments []models.Assessment
	db.Where("patient_id = ?", patientID).Order("assessed_at DESC").Limit(5).Find(&assessments)

	riskScore := 0
	triggers := []string{}

	phq9Score := latestScaleScore(assessments, "PHQ-9")
	if phq9Score >= 15 {
		riskScore += 25
		triggers = append(triggers, "PHQ-9量表提示重度抑郁")
	} else if phq9Score >= 10 {
		riskScore += 15
		triggers = append(triggers, "PHQ-9量表提示中度抑郁")
	}

	gad7Score := latestScaleScore(assessments, "GAD-7")
	if gad7Score >= 10 {
		riskScore += 15
		triggers = append(triggers, "GAD-7量表提示中度以上焦虑")
	}

	var lowAdherenceMeds []models.Medication
	db.Where("patient_id = ? AND adherence_percent < 70 AND end_date IS NULL", patientID).Find(&lowAdherenceMeds)
	if len(lowAdherenceMeds) > 0 {
		riskScore += 15
		triggers = append(triggers, "用药依从性低于70%")
	}

	var lastAppt models.Appointment
	db.Where("patient_id = ? AND status IN ('confirmed','completed')", patientID).
		Order("appointment_date DESC").First(&lastAppt)
	if !lastAppt.AppointmentDate.IsZero() && time.Since(lastAppt.AppointmentDate) > 30*24*time.Hour {
		riskScore += 10
		triggers = append(triggers, "超过30天未就诊")
	}

	var patient models.Patient
	db.First(&patient, "id = ?", patientID)
	if patient.ID != uuid.Nil {
		medHist := strings.ToLower(patient.MedicalHistory)
		if strings.Contains(medHist, "自杀") || strings.Contains(medHist, "suicide") {
			riskScore += 20
			triggers = append(triggers, "既往自杀史")
		}
		if strings.Contains(medHist, "自伤") {
			riskScore += 15
			triggers = append(triggers, "既往自伤史")
		}
	}

	riskLevel := "low"
	if riskScore >= 60 {
		riskLevel = "high"
	} else if riskScore >= 35 {
		riskLevel = "medium"
	}

	db.Model(&patient).Updates(map[string]interface{}{
		"risk_score": riskScore,
		"risk_level": riskLevel,
		"updated_at": time.Now(),
	})

	if riskScore >= 60 {
		var existingWarning models.Warning
		db.Where("patient_id = ? AND status != 'resolved'", patientID).First(&existingWarning)
		if existingWarning.ID == uuid.Nil {
			warning := models.Warning{
				ID:             uuid.New(),
				PatientID:      patientID,
				RiskScore:      riskScore,
				RiskLevel:      riskLevel,
				Status:         "pending",
				FamilyNotified: true,
				CreatedAt:      time.Now(),
			}
			warning.TriggerFactors, _ = serializeTriggers(triggers)
			warning.NotifiedDoctors, _ = serializeTriggers([]string{"auto-assign"})
			db.Create(&warning)
		}
	}
}

func latestScaleScore(assessments []models.Assessment, code string) int {
	for _, a := range assessments {
		if strings.EqualFold(a.ScaleCode, code) {
			return a.TotalScore
		}
	}
	return 0
}

func serializeTriggers(items []string) ([]byte, error) {
	jsonStr := `["` + strings.Join(items, `","`) + `"]`
	return []byte(jsonStr), nil
}

func roundFloat(val float64, precision uint) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}
