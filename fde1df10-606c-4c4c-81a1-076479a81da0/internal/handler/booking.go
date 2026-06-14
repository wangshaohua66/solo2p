package handler

import (
	"net/http"
	"strconv"
	"time"

	"venue-scheduler/internal/middleware"
	"venue-scheduler/internal/pkg/response"
	"venue-scheduler/internal/repository"
	"venue-scheduler/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BookingHandler struct {
	db              *gorm.DB
	scheduleService *service.ScheduleService
}

func NewBookingHandler(db *gorm.DB, scheduleService *service.ScheduleService) *BookingHandler {
	return &BookingHandler{
		db:              db,
		scheduleService: scheduleService,
	}
}

type CreateBookingRequest struct {
	VenueID     uint                   `json:"venue_id" binding:"required"`
	Title       string                 `json:"title" binding:"required"`
	Description string                 `json:"description"`
	StartTime   time.Time              `json:"start_time" binding:"required"`
	EndTime     time.Time              `json:"end_time" binding:"required"`
	Type        repository.BookingType `json:"type" binding:"required"`
}

// CreateBooking godoc
// @Summary 创建档期申请
// @Description 提交演出时段申请，自动检测三重冲突（排期/维护/设备），冲突时返回409及推荐档期
// @Tags bookings
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateBookingRequest true "档期申请参数"
// @Success 201 {object} repository.Booking
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "冲突，返回冲突详情和推荐档期"
// @Failure 500 {object} map[string]interface{}
// @Router /api/bookings [post]
func (h *BookingHandler) CreateBooking(c *gin.Context) {
	userID, exists := c.Get(middleware.ContextUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "user not authenticated"))
		return
	}
	uid, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.Fail(http.StatusUnauthorized, "invalid user id"))
		return
	}

	var req CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	if req.StartTime.IsZero() || req.EndTime.IsZero() {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "start time and end time are required"))
		return
	}
	if !req.EndTime.After(req.StartTime) {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "end time must be after start time"))
		return
	}
	if req.StartTime.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "start time cannot be in the past"))
		return
	}

	var venue repository.Venue
	if err := h.db.First(&venue, req.VenueID).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "venue not found"))
		return
	}
	if venue.Status != repository.VenueStatusActive {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "venue is not available for booking"))
		return
	}

	conflicts, err := h.scheduleService.CheckConflict(h.db, req.VenueID, req.StartTime, req.EndTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to check conflicts"))
		return
	}
	if len(conflicts) > 0 {
		recommendedSlots, err := h.scheduleService.RecommendSlots(h.db, req.VenueID, req.StartTime, req.EndTime, 3)
		if err != nil {
			recommendedSlots = []service.TimeSlot{}
		}
		c.JSON(http.StatusConflict, response.FailWithData(http.StatusConflict, "booking conflicts detected", gin.H{
			"conflicts":         conflicts,
			"recommended_slots": recommendedSlots,
		}))
		return
	}

	booking := repository.Booking{
		VenueID:     req.VenueID,
		UserID:      uid,
		Title:       req.Title,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Status:      repository.BookingStatusPending,
		Type:        req.Type,
	}

	if err := h.db.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create booking"))
		return
	}

	c.JSON(http.StatusCreated, response.Success(booking))
}

// GetBookings godoc
// @Summary 获取档期列表
// @Description 查询档期列表，支持按场馆、时间范围、状态筛选
// @Tags bookings
// @Accept json
// @Produce json
// @Security Bearer
// @Param venue_id query int false "场馆ID"
// @Param start_date query string false "开始日期(YYYY-MM-DD)"
// @Param end_date query string false "结束日期(YYYY-MM-DD)"
// @Param status query string false "状态(pending/confirmed/conflict/maintenance/cancelled)"
// @Success 200 {array} repository.Booking
// @Failure 500 {object} map[string]interface{}
// @Router /api/bookings [get]
func (h *BookingHandler) GetBookings(c *gin.Context) {
	query := h.db.Model(&repository.Booking{}).Preload("Venue").Preload("User")

	venueIDStr := c.Query("venue_id")
	if venueIDStr != "" {
		venueID, err := strconv.ParseUint(venueIDStr, 10, 32)
		if err == nil {
			query = query.Where("venue_id = ?", uint(venueID))
		}
	}

	startDateStr := c.Query("start_date")
	if startDateStr != "" {
		if startDate, err := time.Parse("2006-01-02", startDateStr); err == nil {
			query = query.Where("start_time >= ?", startDate)
		}
	}

	endDateStr := c.Query("end_date")
	if endDateStr != "" {
		if endDate, err := time.Parse("2006-01-02", endDateStr); err == nil {
			endOfDay := endDate.Add(24*time.Hour - time.Second)
			query = query.Where("end_time <= ?", endOfDay)
		}
	}

	statusStr := c.Query("status")
	if statusStr != "" {
		query = query.Where("status = ?", statusStr)
	}

	var bookings []repository.Booking
	if err := query.Order("start_time ASC").Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query bookings"))
		return
	}

	c.JSON(http.StatusOK, response.Success(bookings))
}

// GetBooking godoc
// @Summary 获取档期详情
// @Description 根据ID获取档期详情，包含关联场馆和用户信息
// @Tags bookings
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "档期ID"
// @Success 200 {object} repository.Booking
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /api/bookings/{id} [get]
func (h *BookingHandler) GetBooking(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid booking id"))
		return
	}

	var booking repository.Booking
	if err := h.db.Preload("Venue").Preload("User").First(&booking, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "booking not found"))
		return
	}

	c.JSON(http.StatusOK, response.Success(booking))
}

type ApproveBookingRequest struct {
	Action string `json:"action" binding:"required,oneof=approve reject"`
}

// ApproveBooking godoc
// @Summary 审批档期
// @Description 场馆经理审批档期申请（通过/驳回），通过时自动创建预算记录
// @Tags bookings
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "档期ID"
// @Param request body ApproveBookingRequest true "审批操作"
// @Success 200 {object} repository.Booking
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/bookings/{id}/approve [put]
func (h *BookingHandler) ApproveBooking(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid booking id"))
		return
	}

	var req ApproveBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	var booking repository.Booking
	if err := h.db.First(&booking, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "booking not found"))
		return
	}

	if booking.Status != repository.BookingStatusPending {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "only pending bookings can be approved/rejected"))
		return
	}

	var newStatus repository.BookingStatus
	if req.Action == "approve" {
		newStatus = repository.BookingStatusConfirmed
	} else {
		newStatus = repository.BookingStatusCancelled
	}

	tx := h.db.Begin()

	if err := tx.Model(&booking).Update("status", newStatus).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update booking status"))
		return
	}

	if req.Action == "approve" {
		var existingBudget repository.Budget
		result := tx.Where("booking_id = ?", booking.ID).First(&existingBudget)
		if result.Error == gorm.ErrRecordNotFound {
			budget := repository.Budget{
				BookingID: booking.ID,
			}
			if err := tx.Create(&budget).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to create budget record"))
				return
			}
		}
	}

	tx.Commit()

	if err := h.db.Preload("Venue").Preload("User").First(&booking, uint(id)).Error; err == nil {
		c.JSON(http.StatusOK, response.Success(booking))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{"id": booking.ID, "status": newStatus}))
}

type UpdateBookingRequest struct {
	Title       *string                 `json:"title"`
	Description *string                 `json:"description"`
	StartTime   *time.Time              `json:"start_time"`
	EndTime     *time.Time              `json:"end_time"`
	Type        *repository.BookingType `json:"type"`
}

// UpdateBooking godoc
// @Summary 更新档期
// @Description 更新档期信息，时间变更时重新检测冲突，支持拖拽调整场景；时间变更时自动排除当前档期进行冲突检测
// @Tags bookings
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "档期ID"
// @Param request body UpdateBookingRequest true "档期更新参数（所有字段可选）"
// @Success 200 {object} repository.Booking
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "时间冲突，返回冲突详情和推荐档期"
// @Failure 500 {object} map[string]interface{}
// @Router /api/bookings/{id} [put]
func (h *BookingHandler) UpdateBooking(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid booking id"))
		return
	}

	var booking repository.Booking
	if err := h.db.First(&booking, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "booking not found"))
		return
	}

	var req UpdateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid request parameters: "+err.Error()))
		return
	}

	newStartTime := booking.StartTime
	newEndTime := booking.EndTime
	if req.StartTime != nil {
		newStartTime = *req.StartTime
	}
	if req.EndTime != nil {
		newEndTime = *req.EndTime
	}

	if req.StartTime != nil || req.EndTime != nil {
		if newStartTime.IsZero() || newEndTime.IsZero() {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "start time and end time are required"))
			return
		}
		if !newEndTime.After(newStartTime) {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "end time must be after start time"))
			return
		}
		if newStartTime.Before(time.Now()) {
			c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "start time cannot be in the past"))
			return
		}

		conflicts, err := h.scheduleService.CheckConflict(h.db, booking.VenueID, newStartTime, newEndTime, booking.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to check conflicts"))
			return
		}
		if len(conflicts) > 0 {
			recommendedSlots, err := h.scheduleService.RecommendSlots(h.db, booking.VenueID, newStartTime, newEndTime, 3)
			if err != nil {
				recommendedSlots = []service.TimeSlot{}
			}
			c.JSON(http.StatusConflict, response.FailWithData(http.StatusConflict, "booking conflicts detected", gin.H{
				"conflicts":         conflicts,
				"recommended_slots": recommendedSlots,
			}))
			return
		}
	}

	if req.Title != nil {
		booking.Title = *req.Title
	}
	if req.Description != nil {
		booking.Description = *req.Description
	}
	if req.StartTime != nil {
		booking.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		booking.EndTime = *req.EndTime
	}
	if req.Type != nil {
		booking.Type = *req.Type
	}

	if err := h.db.Save(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to update booking"))
		return
	}

	if err := h.db.Preload("Venue").Preload("User").First(&booking, booking.ID).Error; err == nil {
		c.JSON(http.StatusOK, response.Success(booking))
		return
	}

	c.JSON(http.StatusOK, response.Success(booking))
}

// DeleteBooking godoc
// @Summary 删除档期
// @Description 软删除档期，将状态改为 cancelled，不从数据库中物理删除
// @Tags bookings
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "档期ID"
// @Success 200 {object} map[string]interface{} "返回档期ID和取消状态"
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/bookings/{id} [delete]
func (h *BookingHandler) DeleteBooking(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.Fail(http.StatusBadRequest, "invalid booking id"))
		return
	}

	var booking repository.Booking
	if err := h.db.First(&booking, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, response.Fail(http.StatusNotFound, "booking not found"))
		return
	}

	if booking.Status == repository.BookingStatusCancelled {
		c.JSON(http.StatusOK, response.Success(gin.H{"message": "booking already cancelled"}))
		return
	}

	if err := h.db.Model(&booking).Update("status", repository.BookingStatusCancelled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to cancel booking"))
		return
	}

	c.JSON(http.StatusOK, response.Success(gin.H{"id": booking.ID, "status": repository.BookingStatusCancelled}))
}

type BookingStats struct {
	VenueUtilizationRate float64                    `json:"venue_utilization_rate"`
	EquipmentIdleRate    float64                    `json:"equipment_idle_rate"`
	VenueStats           []VenueUtilizationStat     `json:"venue_stats"`
	EquipmentStats       []EquipmentUtilizationStat `json:"equipment_stats"`
	Month                string                     `json:"month"`
	TotalBookings        int64                      `json:"total_bookings"`
	ConfirmedBookings    int64                      `json:"confirmed_bookings"`
}

type VenueUtilizationStat struct {
	VenueID     uint    `json:"venue_id"`
	VenueName   string  `json:"venue_name"`
	TotalHours  float64 `json:"total_hours"`
	BookedHours float64 `json:"booked_hours"`
	Utilization float64 `json:"utilization"`
}

type EquipmentUtilizationStat struct {
	EquipmentID   uint    `json:"equipment_id"`
	EquipmentName string  `json:"equipment_name"`
	TotalHours    float64 `json:"total_hours"`
	UsedHours     float64 `json:"used_hours"`
	IdleRate      float64 `json:"idle_rate"`
}

// GetStats godoc
// @Summary 获取本月统计数据
// @Description 获取本月场馆利用率和设备空闲率统计，包含各场馆和各设备的详细利用率数据
// @Tags bookings
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} BookingStats
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/bookings/stats [get]
func (h *BookingHandler) GetStats(c *gin.Context) {
	now := time.Now()
	year, month, _ := now.Date()
	monthStart := time.Date(year, month, 1, 0, 0, 0, 0, now.Location())
	nextMonth := monthStart.AddDate(0, 1, 0)
	monthEnd := nextMonth.Add(-time.Second)

	daysInMonth := nextMonth.Sub(monthStart).Hours() / 24
	totalHoursPerVenue := daysInMonth * 24

	var venues []repository.Venue
	if err := h.db.Where("status = ?", repository.VenueStatusActive).Find(&venues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query venues"))
		return
	}

	var venueStats []VenueUtilizationStat
	totalBookedHours := 0.0
	totalAvailableHours := float64(len(venues)) * totalHoursPerVenue

	for _, venue := range venues {
		var bookings []repository.Booking
		if err := h.db.Where(
			"venue_id = ? AND status = ? AND start_time >= ? AND end_time <= ?",
			venue.ID, repository.BookingStatusConfirmed, monthStart, monthEnd,
		).Find(&bookings).Error; err != nil {
			continue
		}

		bookedHours := 0.0
		for _, b := range bookings {
			duration := b.EndTime.Sub(b.StartTime).Hours()
			if duration > 0 {
				bookedHours += duration
			}
		}

		utilization := 0.0
		if totalHoursPerVenue > 0 {
			utilization = (bookedHours / totalHoursPerVenue) * 100
		}

		venueStats = append(venueStats, VenueUtilizationStat{
			VenueID:     venue.ID,
			VenueName:   venue.Name,
			TotalHours:  totalHoursPerVenue,
			BookedHours: bookedHours,
			Utilization: utilization,
		})

		totalBookedHours += bookedHours
	}

	venueUtilizationRate := 0.0
	if totalAvailableHours > 0 {
		venueUtilizationRate = (totalBookedHours / totalAvailableHours) * 100
	}

	var equipment []repository.Equipment
	if err := h.db.Where("status != ?", repository.EquipmentStatusMaintenance).Find(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, response.Fail(http.StatusInternalServerError, "failed to query equipment"))
		return
	}

	var equipmentStats []EquipmentUtilizationStat
	totalEquipmentUsedHours := 0.0
	totalEquipmentAvailableHours := float64(len(equipment)) * totalHoursPerVenue

	for _, eq := range equipment {
		var equipmentBookings []repository.EquipmentBooking
		if err := h.db.Where(
			"equipment_id = ? AND status = ? AND start_time >= ? AND end_time <= ?",
			eq.ID, repository.BookingStatusConfirmed, monthStart, monthEnd,
		).Find(&equipmentBookings).Error; err != nil {
			continue
		}

		usedHours := 0.0
		for _, eb := range equipmentBookings {
			duration := eb.EndTime.Sub(eb.StartTime).Hours()
			if duration > 0 {
				usedHours += duration
			}
		}

		idleRate := 100.0
		if totalHoursPerVenue > 0 {
			idleRate = (1 - usedHours/totalHoursPerVenue) * 100
		}

		equipmentStats = append(equipmentStats, EquipmentUtilizationStat{
			EquipmentID:   eq.ID,
			EquipmentName: eq.Name,
			TotalHours:    totalHoursPerVenue,
			UsedHours:     usedHours,
			IdleRate:      idleRate,
		})

		totalEquipmentUsedHours += usedHours
	}

	equipmentIdleRate := 100.0
	if totalEquipmentAvailableHours > 0 {
		equipmentIdleRate = (1 - totalEquipmentUsedHours/totalEquipmentAvailableHours) * 100
	}

	var totalBookings int64
	h.db.Model(&repository.Booking{}).
		Where("created_at >= ? AND created_at <= ?", monthStart, monthEnd).
		Count(&totalBookings)

	var confirmedBookings int64
	h.db.Model(&repository.Booking{}).
		Where("status = ? AND created_at >= ? AND created_at <= ?", repository.BookingStatusConfirmed, monthStart, monthEnd).
		Count(&confirmedBookings)

	stats := BookingStats{
		VenueUtilizationRate: venueUtilizationRate,
		EquipmentIdleRate:    equipmentIdleRate,
		VenueStats:           venueStats,
		EquipmentStats:       equipmentStats,
		Month:                monthStart.Format("2006-01"),
		TotalBookings:        totalBookings,
		ConfirmedBookings:    confirmedBookings,
	}

	c.JSON(http.StatusOK, response.Success(stats))
}
