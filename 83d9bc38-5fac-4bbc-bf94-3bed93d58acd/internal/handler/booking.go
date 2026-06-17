package handler

import (
	"net/http"
	"strconv"
	"time"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/service"

	"github.com/labstack/echo/v4"
)

type BookingHandler struct {
	bookingService service.BookingService
}

func NewBookingHandler(bookingService service.BookingService) *BookingHandler {
	return &BookingHandler{
		bookingService: bookingService,
	}
}

type createBookingRequest struct {
	EquipmentID uint64    `json:"equipmentId" form:"equipmentId"`
	StartTime   time.Time `json:"startTime" form:"startTime"`
	EndTime     time.Time `json:"endTime" form:"endTime"`
}

type createSeriesBookingRequest struct {
	EquipmentID uint64    `json:"equipmentId" form:"equipmentId"`
	StartTime   time.Time `json:"startTime" form:"startTime"`
	EndTime     time.Time `json:"endTime" form:"endTime"`
	SeriesWeeks int       `json:"seriesWeeks" form:"seriesWeeks"`
}

type cancelBookingRequest struct {
	Reason string `json:"reason" form:"reason"`
}

type conflictCheckResponse struct {
	HasConflict       bool           `json:"hasConflict"`
	ConflictingBookings []model.Booking `json:"conflictingBookings"`
}

func (h *BookingHandler) RegisterRoutes(e *echo.Group) {
	booking := e.Group("/booking")
	{
		booking.GET("", h.GetBookingList, middleware.RBAC("booking:read"))
		booking.POST("", h.CreateBooking, middleware.RBAC("booking:create"))
		booking.POST("/series", h.CreateSeriesBooking, middleware.RBAC("booking:create"))
		booking.POST("/:id/cancel", h.CancelBooking, middleware.RBAC("booking:cancel"))
		booking.GET("/conflict", h.CheckConflict, middleware.RBAC("booking:read"))
		booking.POST("/waitlist", h.AddToWaitlist, middleware.RBAC("booking:waitlist"))
	}
}

func (h *BookingHandler) GetBookingList(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	var req service.GetBookingListRequest

	if equipmentIDStr := c.QueryParam("equipment_id"); equipmentIDStr != "" {
		equipmentID, err := strconv.ParseUint(equipmentIDStr, 10, 64)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, "无效的设备ID")
		}
		req.EquipmentID = &equipmentID
	}

	if userIDStr := c.QueryParam("user_id"); userIDStr != "" {
		userID, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, "无效的用户ID")
		}
		req.UserID = &userID
	}

	if startTimeStr := c.QueryParam("start_time"); startTimeStr != "" {
		startTime, err := time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, "无效的开始时间格式，请使用RFC3339格式")
		}
		req.StartTime = &startTime
	}

	if endTimeStr := c.QueryParam("end_time"); endTimeStr != "" {
		endTime, err := time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			return errorResponse(c, http.StatusBadRequest, "无效的结束时间格式，请使用RFC3339格式")
		}
		req.EndTime = &endTime
	}

	if status := c.QueryParam("status"); status != "" {
		req.Status = &status
	}

	if !middleware.HasRole(c.Request().Context(), middleware.RoleSuperAdmin, middleware.RoleCenterAdmin, middleware.RoleOperator) {
		req.UserID = &user.UserID
	}

	pagination := &model.PaginationParams{}
	if err := c.Bind(pagination); err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的分页参数")
	}
	req.Pagination = pagination

	result, err := h.bookingService.GetBookingList(c.Request().Context(), &req)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "获取预约列表失败: "+err.Error())
	}

	return successResponse(c, result)
}

func (h *BookingHandler) CreateBooking(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	var req createBookingRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的请求参数: "+err.Error())
	}

	if req.EquipmentID == 0 {
		return errorResponse(c, http.StatusBadRequest, "设备ID不能为空")
	}

	if req.StartTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "开始时间不能为空")
	}

	if req.EndTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能为空")
	}

	if req.EndTime.Before(req.StartTime) {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能早于开始时间")
	}

	if req.EndTime.Sub(req.StartTime).Minutes() < 30 {
		return errorResponse(c, http.StatusBadRequest, "预约时长至少为30分钟")
	}

	ipAddress := c.RealIP()

	bookingReq := &service.CreateBookingRequest{
		UserID:      user.UserID,
		EquipmentID: req.EquipmentID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		IsSeries:    false,
		IPAddress:   ipAddress,
	}

	booking, err := h.bookingService.CreateBooking(c.Request().Context(), bookingReq)
	if err != nil {
		switch err {
		case service.ErrEquipmentUnavailable:
			return errorResponse(c, http.StatusBadRequest, err.Error())
		case service.ErrBookingConflict:
			return errorResponse(c, http.StatusConflict, err.Error())
		case service.ErrInsufficientBudget:
			return errorResponse(c, http.StatusBadRequest, err.Error())
		case service.ErrInvalidTimeRange:
			return errorResponse(c, http.StatusBadRequest, err.Error())
		default:
			return errorResponse(c, http.StatusInternalServerError, "创建预约失败: "+err.Error())
		}
	}

	return successResponse(c, booking)
}

func (h *BookingHandler) CreateSeriesBooking(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	var req createSeriesBookingRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的请求参数: "+err.Error())
	}

	if req.EquipmentID == 0 {
		return errorResponse(c, http.StatusBadRequest, "设备ID不能为空")
	}

	if req.StartTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "开始时间不能为空")
	}

	if req.EndTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能为空")
	}

	if req.EndTime.Before(req.StartTime) {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能早于开始时间")
	}

	if req.EndTime.Sub(req.StartTime).Minutes() < 30 {
		return errorResponse(c, http.StatusBadRequest, "预约时长至少为30分钟")
	}

	if req.SeriesWeeks <= 0 || req.SeriesWeeks > 52 {
		return errorResponse(c, http.StatusBadRequest, "系列预约周数必须在1-52周之间")
	}

	ipAddress := c.RealIP()

	seriesReq := &service.CreateSeriesBookingRequest{
		UserID:      user.UserID,
		EquipmentID: req.EquipmentID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		WeekCount:   req.SeriesWeeks,
		IPAddress:   ipAddress,
	}

	bookings, err := h.bookingService.CreateSeriesBooking(c.Request().Context(), seriesReq)
	if err != nil {
		switch err {
		case service.ErrEquipmentUnavailable:
			return errorResponse(c, http.StatusBadRequest, err.Error())
		case service.ErrBookingConflict:
			return errorResponse(c, http.StatusConflict, err.Error())
		case service.ErrInsufficientBudget:
			return errorResponse(c, http.StatusBadRequest, err.Error())
		case service.ErrInvalidTimeRange:
			return errorResponse(c, http.StatusBadRequest, err.Error())
		default:
			return errorResponse(c, http.StatusInternalServerError, "创建系列预约失败: "+err.Error())
		}
	}

	return successResponse(c, bookings)
}

func (h *BookingHandler) CancelBooking(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	bookingIDStr := c.Param("id")
	bookingID, err := strconv.ParseUint(bookingIDStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的预约ID")
	}

	var req cancelBookingRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的请求参数: "+err.Error())
	}

	reason := req.Reason
	if reason == "" {
		reason = "用户取消"
	}

	err = h.bookingService.CancelBooking(c.Request().Context(), bookingID, user.UserID, reason)
	if err != nil {
		switch err {
		case service.ErrBookingNotFound:
			return errorResponse(c, http.StatusNotFound, err.Error())
		case service.ErrBookingAlreadyCancelled:
			return errorResponse(c, http.StatusBadRequest, err.Error())
		default:
			return errorResponse(c, http.StatusInternalServerError, "取消预约失败: "+err.Error())
		}
	}

	return successResponse(c, map[string]string{"message": "预约取消成功"})
}

func (h *BookingHandler) CheckConflict(c echo.Context) error {
	_, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	equipmentIDStr := c.QueryParam("equipment_id")
	if equipmentIDStr == "" {
		equipmentIDStr = c.QueryParam("equipmentId")
	}
	if equipmentIDStr == "" {
		return errorResponse(c, http.StatusBadRequest, "设备ID不能为空")
	}

	equipmentID, err := strconv.ParseUint(equipmentIDStr, 10, 64)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的设备ID")
	}

	startTimeStr := c.QueryParam("start_time")
	if startTimeStr == "" {
		startTimeStr = c.QueryParam("startTime")
	}
	if startTimeStr == "" {
		return errorResponse(c, http.StatusBadRequest, "开始时间不能为空")
	}

	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的开始时间格式，请使用RFC3339格式")
	}

	endTimeStr := c.QueryParam("end_time")
	if endTimeStr == "" {
		endTimeStr = c.QueryParam("endTime")
	}
	if endTimeStr == "" {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能为空")
	}

	endTime, err := time.Parse(time.RFC3339, endTimeStr)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的结束时间格式，请使用RFC3339格式")
	}

	if endTime.Before(startTime) {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能早于开始时间")
	}

	conflictReq := &service.CheckConflictRequest{
		EquipmentID: equipmentID,
		StartTime:   startTime,
		EndTime:     endTime,
	}

	conflicts, err := h.bookingService.CheckConflict(c.Request().Context(), conflictReq)
	if err != nil {
		return errorResponse(c, http.StatusInternalServerError, "冲突检测失败: "+err.Error())
	}

	response := conflictCheckResponse{
		HasConflict:       len(conflicts) > 0,
		ConflictingBookings: conflicts,
	}

	return successResponse(c, response)
}

func (h *BookingHandler) AddToWaitlist(c echo.Context) error {
	user, ok := middleware.GetUser(c.Request().Context())
	if !ok {
		return errorResponse(c, http.StatusUnauthorized, "用户信息不存在")
	}

	var req createBookingRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "无效的请求参数: "+err.Error())
	}

	if req.EquipmentID == 0 {
		return errorResponse(c, http.StatusBadRequest, "设备ID不能为空")
	}

	if req.StartTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "开始时间不能为空")
	}

	if req.EndTime.IsZero() {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能为空")
	}

	if req.EndTime.Before(req.StartTime) {
		return errorResponse(c, http.StatusBadRequest, "结束时间不能早于开始时间")
	}

	ipAddress := c.RealIP()

	waitlistReq := &service.AddToWaitlistRequest{
		UserID:      user.UserID,
		EquipmentID: req.EquipmentID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		IPAddress:   ipAddress,
	}

	waitlist, err := h.bookingService.AddToWaitlist(c.Request().Context(), waitlistReq)
	if err != nil {
		return errorResponse(c, http.StatusBadRequest, err.Error())
	}

	return successResponse(c, waitlist)
}
