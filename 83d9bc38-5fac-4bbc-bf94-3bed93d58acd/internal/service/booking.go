package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
)

type bookingService struct {
	repos               *repository.Repositories
	billingService      BillingService
	notificationService NotificationService
	auditLogService     AuditLogService
}

func NewBookingService(
	repos *repository.Repositories,
	billingService BillingService,
	notificationService NotificationService,
	auditLogService AuditLogService,
) BookingService {
	return &bookingService{
		repos:               repos,
		billingService:      billingService,
		notificationService: notificationService,
		auditLogService:     auditLogService,
	}
}

func (s *bookingService) CreateBooking(ctx context.Context, req *CreateBookingRequest) (*model.Booking, error) {
	if req.EndTime.Before(req.StartTime) {
		return nil, ErrInvalidTimeRange
	}
	if req.EndTime.Sub(req.StartTime).Minutes() < 30 {
		return nil, ErrInvalidTimeRange
	}

	hasConflict, _, err := s.repos.Booking.CheckConflictWithLock(ctx, req.EquipmentID, req.StartTime, req.EndTime, nil)
	if err != nil {
		return nil, fmt.Errorf("检查冲突失败: %w", err)
	}
	if hasConflict {
		return nil, ErrBookingConflict
	}

	equipment, err := s.repos.Equipment.GetByID(ctx, req.EquipmentID)
	if err != nil {
		return nil, fmt.Errorf("获取设备信息失败: %w", err)
	}
	if equipment.Status != "available" {
		return nil, ErrEquipmentUnavailable
	}

	user, err := s.repos.User.GetByID(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("获取用户信息失败: %w", err)
	}

	totalAmount := s.calculateAmount(equipment, req.StartTime, req.EndTime)

	if user.Budget < totalAmount {
		return nil, ErrInsufficientBudget
	}

	booking := &model.Booking{
		EquipmentID: req.EquipmentID,
		UserID:      req.UserID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Status:      "confirmed",
		IsSeries:    req.IsSeries,
		SeriesID:    req.SeriesID,
	}

	if err := s.repos.Booking.Create(ctx, booking); err != nil {
		return nil, fmt.Errorf("创建预约失败: %w", err)
	}

	bookingID := booking.ID
	var userIDPtr *uint64
	billing, err := s.billingService.CreateBilling(ctx, bookingID, userIDPtr, req.IPAddress)
	if err != nil {
		_ = s.repos.Booking.Delete(ctx, booking.ID)
		return nil, fmt.Errorf("创建账单失败: %w", err)
	}

	booking.Billing = billing

	notificationTitle := "预约成功"
	notificationContent := fmt.Sprintf("您已成功预约设备[%s]，时间：%s 至 %s，费用：%.2f元",
		equipment.Name,
		req.StartTime.Format("2006-01-02 15:04"),
		req.EndTime.Format("2006-01-02 15:04"),
		totalAmount,
	)
	_ = s.notificationService.SendNotification(ctx, req.UserID, "booking_created", notificationTitle, notificationContent)

	userID := req.UserID
	_ = s.auditLogService.LogAction(ctx, "create_booking", "bookings", &booking.ID, nil, booking, &userID, req.IPAddress)

	return booking, nil
}

func (s *bookingService) CreateSeriesBooking(ctx context.Context, req *CreateSeriesBookingRequest) ([]*model.Booking, error) {
	if req.WeekCount <= 0 || req.WeekCount > 52 {
		return nil, errors.New("系列预约周数必须在1-52周之间")
	}

	seriesID := ""
	bookings := make([]*model.Booking, 0, req.WeekCount)

	for i := 0; i < req.WeekCount; i++ {
		bookingReq := &CreateBookingRequest{
			UserID:      req.UserID,
			EquipmentID: req.EquipmentID,
			StartTime:   req.StartTime.AddDate(0, 0, 7*i),
			EndTime:     req.EndTime.AddDate(0, 0, 7*i),
			IsSeries:    true,
			SeriesID:    seriesID,
			IPAddress:   req.IPAddress,
		}

		booking, err := s.CreateBooking(ctx, bookingReq)
		if err != nil {
			for _, b := range bookings {
				_ = s.CancelBooking(ctx, b.ID, req.UserID, "系列预约创建失败，回滚已创建的预约")
			}
			return nil, fmt.Errorf("第%d周预约失败: %w", i+1, err)
		}

		if i == 0 {
			seriesID = booking.SeriesID
		}

		bookings = append(bookings, booking)
	}

	return bookings, nil
}

func (s *bookingService) CancelBooking(ctx context.Context, bookingID uint64, operatorID uint64, reason string) error {
	booking, err := s.repos.Booking.GetByIDWithDetails(ctx, bookingID)
	if err != nil {
		return ErrBookingNotFound
	}

	if booking.Status == "cancelled" {
		return ErrBookingAlreadyCancelled
	}

	oldBooking := *booking

	now := time.Now()
	hoursUntilStart := booking.StartTime.Sub(now).Hours()

	refundRate := 0.0
	if hoursUntilStart >= 24 {
		refundRate = 1.0
	} else if hoursUntilStart > 0 {
		refundRate = 0.5
	}

	if booking.Billing != nil && refundRate > 0 {
		var userIDPtr *uint64
		ipAddress := ""
		if _, err := s.billingService.RefundBilling(ctx, booking.Billing.ID, now, userIDPtr, ipAddress); err != nil {
			return fmt.Errorf("退费失败: %w", err)
		}
	}

	booking.Status = "cancelled"
	if err := s.repos.Booking.Update(ctx, booking); err != nil {
		return fmt.Errorf("取消预约失败: %w", err)
	}

	ipAddress := ""
	_ = s.auditLogService.LogAction(ctx, "cancel_booking", "bookings", &bookingID, oldBooking, booking, &operatorID, ipAddress)

	if booking.Equipment != nil {
		notificationTitle := "预约已取消"
		notificationContent := fmt.Sprintf("您的设备[%s]预约已取消，退款%.0f%%费用已退回。原因：%s",
			booking.Equipment.Name,
			refundRate*100,
			reason,
		)
		_ = s.notificationService.SendNotification(ctx, booking.UserID, "booking_cancelled", notificationTitle, notificationContent)
	}

	go func() {
		_ = s.ProcessWaitlist(context.Background(), booking.EquipmentID, booking.StartTime, booking.EndTime, "")
	}()

	return nil
}

func (s *bookingService) CheckConflict(ctx context.Context, req *CheckConflictRequest) ([]model.Booking, error) {
	_, conflicts, err := s.repos.Booking.CheckConflictWithLock(ctx, req.EquipmentID, req.StartTime, req.EndTime, req.ExcludeMaintenanceID)
	if err != nil {
		return nil, fmt.Errorf("检查冲突失败: %w", err)
	}
	return conflicts, nil
}

func (s *bookingService) AddToWaitlist(ctx context.Context, req *AddToWaitlistRequest) (*model.Waitlist, error) {
	hasConflict, _, err := s.repos.Booking.CheckConflictWithLock(ctx, req.EquipmentID, req.StartTime, req.EndTime, nil)
	if err != nil {
		return nil, fmt.Errorf("检查冲突失败: %w", err)
	}
	if !hasConflict {
		return nil, errors.New("该时段设备可用，无需加入等待队列")
	}

	waitlists, err := s.repos.Waitlist.ListByEquipment(ctx, req.EquipmentID, nil)
	if err != nil {
		return nil, fmt.Errorf("获取等待队列失败: %w", err)
	}

	waitlist := &model.Waitlist{
		EquipmentID: req.EquipmentID,
		UserID:      req.UserID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Position:    int(waitlists.Total) + 1,
	}

	if err := s.repos.Waitlist.Create(ctx, waitlist); err != nil {
		return nil, fmt.Errorf("加入等待队列失败: %w", err)
	}

	notificationTitle := "已加入等待队列"
	notificationContent := fmt.Sprintf("您已加入设备[%d]等待队列，当前排位：%d",
		req.EquipmentID,
		waitlist.Position,
	)
	_ = s.notificationService.SendNotification(ctx, req.UserID, "waitlist_added", notificationTitle, notificationContent)

	userID := req.UserID
	_ = s.auditLogService.LogAction(ctx, "add_to_waitlist", "waitlists", &waitlist.ID, nil, waitlist, &userID, req.IPAddress)

	return waitlist, nil
}

func (s *bookingService) ProcessWaitlist(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, ipAddress string) error {
	waitlistItem, err := s.repos.Waitlist.GetFirstWaitlistItem(ctx, equipmentID, startTime, endTime)
	if err != nil {
		return fmt.Errorf("获取等待队列首位失败: %w", err)
	}
	if waitlistItem == nil {
		return nil
	}

	hasConflict, _, err := s.repos.Booking.CheckConflictWithLock(ctx, equipmentID, startTime, endTime, nil)
	if err != nil {
		return fmt.Errorf("检查冲突失败: %w", err)
	}
	if hasConflict {
		return nil
	}

	bookingReq := &CreateBookingRequest{
		UserID:      waitlistItem.UserID,
		EquipmentID: equipmentID,
		StartTime:   startTime,
		EndTime:     endTime,
		IsSeries:    false,
		IPAddress:   ipAddress,
	}

	booking, err := s.CreateBooking(ctx, bookingReq)
	if err != nil {
		return fmt.Errorf("为等待队列用户创建预约失败: %w", err)
	}

	_ = s.repos.Waitlist.Delete(ctx, waitlistItem.ID)

	_ = s.notificationService.SendNotification(ctx, waitlistItem.UserID, "waitlist_promoted", "等待队列补位成功",
		fmt.Sprintf("您等待的设备时段已释放，已为您自动创建预约，预约ID：%d", booking.ID))

	userID := waitlistItem.UserID
	_ = s.auditLogService.LogAction(ctx, "process_waitlist", "bookings", &booking.ID, waitlistItem, booking, &userID, ipAddress)

	return nil
}

func (s *bookingService) GetBookingList(ctx context.Context, req *GetBookingListRequest) (*model.PaginatedResult[model.Booking], error) {
	if req.UserID != nil {
		result, err := s.repos.Booking.ListByUser(ctx, *req.UserID, req.Pagination)
		if err != nil {
			return nil, fmt.Errorf("查询用户预约列表失败: %w", err)
		}
		return s.filterBookings(ctx, result, req)
	}

	if req.EquipmentID != nil && req.StartTime != nil && req.EndTime != nil {
		result, err := s.repos.Booking.ListByEquipmentAndTimeRange(ctx, *req.EquipmentID, *req.StartTime, *req.EndTime, req.Pagination)
		if err != nil {
			return nil, fmt.Errorf("查询设备预约列表失败: %w", err)
		}
		return s.filterBookings(ctx, result, req)
	}

	result, err := s.repos.Booking.List(ctx, req.Pagination)
	if err != nil {
		return nil, fmt.Errorf("查询预约列表失败: %w", err)
	}
	return s.filterBookings(ctx, result, req)
}

func (s *bookingService) GetBookingsInRange(ctx context.Context, equipmentID uint64, startTime, endTime time.Time) ([]model.Booking, error) {
	result, err := s.repos.Booking.ListByEquipmentAndTimeRange(ctx, equipmentID, startTime, endTime, nil)
	if err != nil {
		return nil, fmt.Errorf("查询时段内预约失败: %w", err)
	}
	return result.Items, nil
}

func (s *bookingService) filterBookings(ctx context.Context, result *model.PaginatedResult[model.Booking], req *GetBookingListRequest) (*model.PaginatedResult[model.Booking], error) {
	filtered := make([]model.Booking, 0, len(result.Items))
	for _, booking := range result.Items {
		if req.Status != nil && booking.Status != *req.Status {
			continue
		}
		if req.EquipmentID != nil && booking.EquipmentID != *req.EquipmentID {
			continue
		}
		if req.UserID != nil && booking.UserID != *req.UserID {
			continue
		}
		filtered = append(filtered, booking)
	}

	result.Items = filtered
	result.Total = int64(len(filtered))
	return result, nil
}

func (s *bookingService) calculateAmount(equipment *model.Equipment, startTime, endTime time.Time) float64 {
	duration := endTime.Sub(startTime).Hours()
	amount := equipment.HourlyRate * duration
	return math.Round(amount*100) / 100
}
