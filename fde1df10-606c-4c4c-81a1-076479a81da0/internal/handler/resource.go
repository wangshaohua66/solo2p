package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-scheduler/internal/middleware"
	"venue-scheduler/internal/pkg/response"
	"venue-scheduler/internal/repository"
)

type ResourceHandler struct {
	db *gorm.DB
}

func NewResourceHandler(db *gorm.DB) *ResourceHandler {
	return &ResourceHandler{db: db}
}

func GetUserID(c *gin.Context) (uint, bool) {
	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		return 0, false
	}
	uid, ok := userID.(uint)
	if !ok {
		return 0, false
	}
	return uid, true
}

func GetUserRole(c *gin.Context) (string, bool) {
	role, exists := c.Get(middleware.ContextUserRole)
	if !exists {
		return "", false
	}
	userRole, ok := role.(string)
	if !ok {
		return "", false
	}
	return userRole, true
}

func (h *ResourceHandler) ListVenues(c *gin.Context) {
	venueType := c.Query("type")
	query := h.db.Model(&repository.Venue{})

	if venueType != "" {
		query = query.Where("type = ?", venueType)
	}

	var venues []repository.Venue
	if err := query.Find(&venues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query venues"))
		return
	}

	c.JSON(http.StatusOK, response.Success(venues))
}

func (h *ResourceHandler) GetVenue(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid venue id"))
		return
	}

	var venue repository.Venue
	if err := h.db.First(&venue, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "venue not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(venue))
}

func (h *ResourceHandler) CreateVenue(c *gin.Context) {
	var venue repository.Venue
	if err := c.ShouldBindJSON(&venue); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	if venue.Name == "" {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "venue name is required"))
		return
	}
	if venue.Type == "" {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "venue type is required"))
		return
	}
	if venue.Capacity <= 0 {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "venue capacity must be greater than 0"))
		return
	}

	if venue.Status == "" {
		venue.Status = repository.VenueStatusActive
	}

	if err := h.db.Create(&venue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create venue"))
		return
	}

	c.JSON(http.StatusCreated, response.Success(venue))
}

func (h *ResourceHandler) UpdateVenue(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid venue id"))
		return
	}

	var venue repository.Venue
	if err := h.db.First(&venue, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "venue not found"))
		return
	}

	if err := c.ShouldBindJSON(&venue); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	venue.ID = uint(id)
	if err := h.db.Save(&venue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update venue"))
		return
	}

	c.JSON(http.StatusOK, response.Success(venue))
}

type SetVenueMaintenanceRequest struct {
	StartTime time.Time `json:"start_time" binding:"required"`
	EndTime   time.Time `json:"end_time" binding:"required"`
	Reason    string    `json:"reason"`
}

func (h *ResourceHandler) SetVenueMaintenance(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid venue id"))
		return
	}

	var venue repository.Venue
	if err := h.db.First(&venue, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "venue not found"))
		return
	}

	var req SetVenueMaintenanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	if !req.EndTime.After(req.StartTime) {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "end time must be after start time"))
		return
	}

	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	booking := repository.Booking{
		VenueID:     uint(id),
		UserID:      userID,
		Title:       fmt.Sprintf("场馆维护: %s", venue.Name),
		Description: req.Reason,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Status:      repository.BookingStatusMaintenance,
		Type:        repository.BookingTypeMaintenance,
	}

	tx := h.db.Begin()
	if err := tx.Create(&booking).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create maintenance booking"))
		return
	}

	venue.Status = repository.VenueStatusMaintenance
	if err := tx.Save(&venue).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update venue status"))
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, response.Success(gin.H{
		"venue":   venue,
		"booking": booking,
	}))
}

func (h *ResourceHandler) ListEquipments(c *gin.Context) {
	category := c.Query("category")
	status := c.Query("status")

	query := h.db.Model(&repository.Equipment{})

	if category != "" {
		query = query.Where("category = ?", category)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var equipments []repository.Equipment
	if err := query.Find(&equipments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query equipments"))
		return
	}

	c.JSON(http.StatusOK, response.Success(equipments))
}

func (h *ResourceHandler) GetEquipment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid equipment id"))
		return
	}

	var equipment repository.Equipment
	if err := h.db.First(&equipment, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "equipment not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(equipment))
}

func (h *ResourceHandler) CreateEquipment(c *gin.Context) {
	var equipment repository.Equipment
	if err := c.ShouldBindJSON(&equipment); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	if equipment.Name == "" {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "equipment name is required"))
		return
	}
	if equipment.Category == "" {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "equipment category is required"))
		return
	}

	if equipment.Status == "" {
		equipment.Status = repository.EquipmentStatusAvailable
	}

	if err := h.db.Create(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create equipment"))
		return
	}

	c.JSON(http.StatusCreated, response.Success(equipment))
}

func (h *ResourceHandler) UpdateEquipment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid equipment id"))
		return
	}

	var equipment repository.Equipment
	if err := h.db.First(&equipment, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "equipment not found"))
		return
	}

	if err := c.ShouldBindJSON(&equipment); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	equipment.ID = uint(id)
	if err := h.db.Save(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update equipment"))
		return
	}

	c.JSON(http.StatusOK, response.Success(equipment))
}

type SetEquipmentMaintenanceRequest struct {
	Reason string `json:"reason"`
}

func (h *ResourceHandler) SetEquipmentMaintenance(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid equipment id"))
		return
	}

	var equipment repository.Equipment
	if err := h.db.First(&equipment, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "equipment not found"))
		return
	}

	var req SetEquipmentMaintenanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	tx := h.db.Begin()

	equipment.Status = repository.EquipmentStatusMaintenance
	if err := tx.Save(&equipment).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update equipment status"))
		return
	}

	var equipmentBookings []repository.EquipmentBooking
	if err := tx.Where("equipment_id = ? AND status IN ?", uint(id),
		[]repository.BookingStatus{repository.BookingStatusPending, repository.BookingStatusConfirmed}).
		Preload("Booking").Find(&equipmentBookings).Error; err == nil {
		producerUserIDs := make(map[uint]bool)
		for _, eb := range equipmentBookings {
			if eb.Booking.ID > 0 {
				producerUserIDs[eb.Booking.UserID] = true
			}
		}

		for userID := range producerUserIDs {
			notification := repository.Notification{
				UserID:  userID,
				Type:    "equipment_maintenance",
				Title:   fmt.Sprintf("设备维修通知: %s", equipment.Name),
				Content: fmt.Sprintf("设备「%s」已被标记为维修状态。原因: %s", equipment.Name, req.Reason),
				IsRead:  false,
			}
			tx.Create(&notification)
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, response.Success(equipment))
}

func (h *ResourceHandler) GetAvailableEquipments(c *gin.Context) {
	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")
	category := c.Query("category")

	if startTimeStr == "" || endTimeStr == "" {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "start_time and end_time are required"))
		return
	}

	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid start_time format, use RFC3339"))
		return
	}

	endTime, err := time.Parse(time.RFC3339, endTimeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid end_time format, use RFC3339"))
		return
	}

	if !endTime.After(startTime) {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "end_time must be after start_time"))
		return
	}

	var bookedEquipmentIDs []uint
	h.db.Model(&repository.EquipmentBooking{}).
		Where("status IN ? AND start_time < ? AND end_time > ?",
			[]repository.BookingStatus{repository.BookingStatusPending, repository.BookingStatusConfirmed},
			endTime, startTime).
		Pluck("equipment_id", &bookedEquipmentIDs)

	query := h.db.Model(&repository.Equipment{}).
		Where("status = ? AND id NOT IN ?",
			repository.EquipmentStatusAvailable, bookedEquipmentIDs)

	if category != "" {
		query = query.Where("category = ?", category)
	}

	var equipments []repository.Equipment
	if err := query.Find(&equipments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query available equipments"))
		return
	}

	c.JSON(http.StatusOK, response.Success(equipments))
}

type BindEquipmentsRequest struct {
	EquipmentIDs []uint    `json:"equipment_ids" binding:"required"`
	StartTime    time.Time `json:"start_time" binding:"required"`
	EndTime      time.Time `json:"end_time" binding:"required"`
}

func (h *ResourceHandler) BindEquipmentsToBooking(c *gin.Context) {
	bookingID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid booking id"))
		return
	}

	var booking repository.Booking
	if err := h.db.First(&booking, uint(bookingID)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "booking not found"))
		return
	}

	var req BindEquipmentsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	if len(req.EquipmentIDs) == 0 {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "equipment_ids cannot be empty"))
		return
	}

	if !req.EndTime.After(req.StartTime) {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "end_time must be after start_time"))
		return
	}

	tx := h.db.Begin()

	var equipments []repository.Equipment
	if err := tx.Where("id IN ? AND status = ?", req.EquipmentIDs, repository.EquipmentStatusAvailable).
		Find(&equipments).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query equipments"))
		return
	}

	if len(equipments) != len(req.EquipmentIDs) {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "some equipments are not available"))
		return
	}

	var conflictBookedIDs []uint
	tx.Model(&repository.EquipmentBooking{}).
		Where("equipment_id IN ? AND status IN ? AND start_time < ? AND end_time > ?",
			req.EquipmentIDs,
			[]repository.BookingStatus{repository.BookingStatusPending, repository.BookingStatusConfirmed},
			req.EndTime, req.StartTime).
		Pluck("equipment_id", &conflictBookedIDs)

	if len(conflictBookedIDs) > 0 {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, response.FailWithData(http.StatusBadRequest, "some equipments have time conflicts", conflictBookedIDs))
		return
	}

	for _, eq := range equipments {
		equipmentBooking := repository.EquipmentBooking{
			EquipmentID: eq.ID,
			BookingID:   uint(bookingID),
			StartTime:   req.StartTime,
			EndTime:     req.EndTime,
			Status:      repository.BookingStatusConfirmed,
		}
		if err := tx.Create(&equipmentBooking).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create equipment booking"))
			return
		}

		if err := tx.Model(&eq).Update("status", repository.EquipmentStatusInUse).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update equipment status"))
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, response.Success(gin.H{
		"message":       "equipments bound successfully",
		"equipment_ids": req.EquipmentIDs,
	}))
}

func (h *ResourceHandler) UnbindEquipment(c *gin.Context) {
	bookingID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid booking id"))
		return
	}

	equipmentID, err := strconv.ParseUint(c.Param("equipment_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid equipment id"))
		return
	}

	tx := h.db.Begin()

	var equipmentBooking repository.EquipmentBooking
	if err := tx.Where("booking_id = ? AND equipment_id = ?", uint(bookingID), uint(equipmentID)).
		First(&equipmentBooking).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "equipment booking not found"))
		return
	}

	if err := tx.Delete(&equipmentBooking).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to unbind equipment"))
		return
	}

	var otherBookings int64
	tx.Model(&repository.EquipmentBooking{}).
		Where("equipment_id = ? AND status IN ?", uint(equipmentID),
			[]repository.BookingStatus{repository.BookingStatusPending, repository.BookingStatusConfirmed}).
		Count(&otherBookings)

	if otherBookings == 0 {
		if err := tx.Model(&repository.Equipment{}).
			Where("id = ?", uint(equipmentID)).
			Update("status", repository.EquipmentStatusAvailable).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update equipment status"))
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, response.Success(gin.H{
		"message": "equipment unbound successfully",
	}))
}

type CreateRehearsalBookingRequest struct {
	VenueID         uint                     `json:"venue_id" binding:"required"`
	TroupeName      string                   `json:"troupe_name" binding:"required"`
	StartTime       time.Time                `json:"start_time" binding:"required"`
	EndTime         time.Time                `json:"end_time" binding:"required"`
	RecurrenceRule  repository.RecurrenceRule `json:"recurrence_rule"`
	RecurrenceDays  string                   `json:"recurrence_days"`
	RecurrenceWeeks int                      `json:"recurrence_weeks"`
}

func (h *ResourceHandler) CreateRehearsalBooking(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}

	var req CreateRehearsalBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	if !req.EndTime.After(req.StartTime) {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "end_time must be after start_time"))
		return
	}

	var venue repository.Venue
	if err := h.db.First(&venue, req.VenueID).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "venue not found"))
		return
	}

	if venue.Status != repository.VenueStatusActive {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "venue is not available"))
		return
	}

	var targetDays []int
	if req.RecurrenceRule == repository.RecurrenceRuleWeekly {
		if req.RecurrenceDays == "" {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "recurrence_days is required for weekly booking"))
			return
		}
		if req.RecurrenceWeeks <= 0 {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "recurrence_weeks must be greater than 0"))
			return
		}

		dayStrs := strings.Split(req.RecurrenceDays, ",")
		for _, ds := range dayStrs {
			d, err := strconv.Atoi(strings.TrimSpace(ds))
			if err != nil || d < 0 || d > 6 {
				c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid recurrence_days, should be 0-6 (Sunday-Saturday)"))
				return
			}
			targetDays = append(targetDays, d)
		}
	}

	tx := h.db.Begin()

	createBooking := func(start, end time.Time) error {
		var maintenanceCount int64
		tx.Model(&repository.Booking{}).
			Where("venue_id = ? AND type = ? AND status = ? AND start_time < ? AND end_time > ?",
				req.VenueID,
				repository.BookingTypeMaintenance,
				repository.BookingStatusMaintenance,
				end, start).
			Count(&maintenanceCount)
		if maintenanceCount > 0 {
			return nil
		}

		var conflictCount int64
		tx.Model(&repository.Booking{}).
			Where("venue_id = ? AND status IN ? AND start_time < ? AND end_time > ?",
				req.VenueID,
				[]repository.BookingStatus{repository.BookingStatusPending, repository.BookingStatusConfirmed, repository.BookingStatusMaintenance},
				end, start).
			Count(&conflictCount)
		if conflictCount > 0 {
			return fmt.Errorf("time conflict on %s", start.Format("2006-01-02"))
		}

		booking := repository.RehearsalBooking{
			VenueID:         req.VenueID,
			UserID:          userID,
			TroupeName:      req.TroupeName,
			StartTime:       start,
			EndTime:         end,
			RecurrenceRule:  req.RecurrenceRule,
			RecurrenceDays:  req.RecurrenceDays,
			RecurrenceWeeks: req.RecurrenceWeeks,
			Status:          repository.BookingStatusConfirmed,
		}
		return tx.Create(&booking).Error
	}

	if req.RecurrenceRule == repository.RecurrenceRuleWeekly {
		startDuration := req.StartTime.Sub(req.StartTime.Truncate(24 * time.Hour))
		endDuration := req.EndTime.Sub(req.EndTime.Truncate(24 * time.Hour))

		firstDate := req.StartTime.Truncate(24 * time.Hour)
		createdCount := 0

		for week := 0; week < req.RecurrenceWeeks; week++ {
			weekStart := firstDate.AddDate(0, 0, week*7)
			for _, dayOffset := range targetDays {
				currentDate := weekStart.AddDate(0, 0, (dayOffset-int(weekStart.Weekday())+7)%7)
				if currentDate.Before(firstDate) {
					continue
				}

				bookingStart := currentDate.Add(startDuration)
				bookingEnd := currentDate.Add(endDuration)

				if err := createBooking(bookingStart, bookingEnd); err != nil {
					tx.Rollback()
					c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, err.Error()))
					return
				}
				createdCount++
			}
		}

		if createdCount == 0 {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "no valid booking dates generated"))
			return
		}
	} else {
		if err := createBooking(req.StartTime, req.EndTime); err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, err.Error()))
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusCreated, response.Success(gin.H{
		"message": "rehearsal booking(s) created successfully",
	}))
}

func (h *ResourceHandler) ListRehearsalBookings(c *gin.Context) {
	weekStartStr := c.Query("week_start")
	venueIDStr := c.Query("venue_id")

	var weekStart time.Time
	var err error
	if weekStartStr != "" {
		weekStart, err = time.Parse("2006-01-02", weekStartStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid week_start format, use YYYY-MM-DD"))
			return
		}
	} else {
		now := time.Now()
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		weekStart = now.AddDate(0, 0, -(weekday - 1)).Truncate(24 * time.Hour)
	}

	weekEnd := weekStart.AddDate(0, 0, 7)

	query := h.db.Model(&repository.RehearsalBooking{}).
		Where("start_time >= ? AND start_time < ?", weekStart, weekEnd).
		Preload("Venue").Preload("User")

	if venueIDStr != "" {
		venueID, err := strconv.ParseUint(venueIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid venue_id"))
			return
		}
		query = query.Where("venue_id = ?", uint(venueID))
	}

	var bookings []repository.RehearsalBooking
	if err := query.Order("start_time ASC").Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query rehearsal bookings"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{
		"week_start": weekStart.Format("2006-01-02"),
		"week_end":   weekEnd.Format("2006-01-02"),
		"bookings":   bookings,
	}))
}

func (h *ResourceHandler) CancelRehearsalBooking(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid rehearsal booking id"))
		return
	}

	var booking repository.RehearsalBooking
	if err := h.db.First(&booking, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "rehearsal booking not found"))
		return
	}

	if booking.Status == repository.BookingStatusCancelled {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "booking already cancelled"))
		return
	}

	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	userRole, ok := GetUserRole(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user role not found"))
		return
	}

	if booking.UserID != userID && userRole != string(repository.UserRoleVenueManager) {
		c.JSON(http.StatusForbidden, response.Fail(http.StatusForbidden, "permission denied"))
		return
	}

	booking.Status = repository.BookingStatusCancelled
	if err := h.db.Save(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to cancel booking"))
		return
	}

	c.JSON(http.StatusOK, response.Success(booking))
}
