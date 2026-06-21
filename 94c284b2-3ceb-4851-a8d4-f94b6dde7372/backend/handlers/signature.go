package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"mental-health-backend/config"
	"mental-health-backend/models"
)

type SignatureHandler struct{}

func NewSignatureHandler() *SignatureHandler {
	return &SignatureHandler{}
}

func (h *SignatureHandler) List(c echo.Context) error {
	var signatures []models.Signature
	query := config.DB

	if patientID := c.Param("id"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	} else if patientID := c.QueryParam("patientId"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}
	if resourceID := c.QueryParam("resourceId"); resourceID != "" {
		query = query.Where("resource_id = ?", resourceID)
	}
	if resourceType := c.QueryParam("resourceType"); resourceType != "" {
		query = query.Where("resource_type = ?", resourceType)
	}

	query.Order("created_at DESC").Limit(200).Find(&signatures)
	return c.JSON(http.StatusOK, signatures)
}

func (h *SignatureHandler) Create(c echo.Context) error {
	var sig models.Signature
	if err := c.Bind(&sig); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	sig.ID = uuid.New()
	sig.CreatedAt = time.Now()
	if sig.IPAddress == "" {
		sig.IPAddress = c.RealIP()
	}

	if err := config.DB.Create(&sig).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, sig)
}

func (h *SignatureHandler) Get(c echo.Context) error {
	id := c.Param("id")
	var sig models.Signature
	if err := config.DB.First(&sig, "id = ?", id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Signature not found")
	}
	return c.JSON(http.StatusOK, sig)
}
