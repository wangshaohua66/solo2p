package service

import (
	"context"
	"fmt"
	"time"

	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
)

type notificationServiceImpl struct {
	notificationRepo repository.NotificationRepository
	bookingRepo      repository.BookingRepository
	equipmentRepo    repository.EquipmentRepository
	maintenanceRepo  repository.MaintenanceRepository
	billingRepo      repository.BillingRepository
}

func NewNotificationService(repos *repository.Repositories) NotificationService {
	return &notificationServiceImpl{
		notificationRepo: repos.Notification,
		bookingRepo:      repos.Booking,
		equipmentRepo:    repos.Equipment,
		maintenanceRepo:  repos.Maintenance,
		billingRepo:      repos.Billing,
	}
}

func (s *notificationServiceImpl) SendNotification(ctx context.Context, userID uint64, notificationType, title, content string) error {
	notification := &model.Notification{
		UserID:  userID,
		Type:    notificationType,
		Title:   title,
		Content: content,
		IsRead:  false,
	}
	return s.notificationRepo.Create(ctx, notification)
}

func (s *notificationServiceImpl) SendBookingConfirm(ctx context.Context, bookingID uint64) error {
	booking, err := s.bookingRepo.GetByIDWithDetails(ctx, bookingID)
	if err != nil {
		return err
	}

	title := "预约确认通知"
	content := fmt.Sprintf(
		"您的【%s】预约已确认。\n预约时间：%s 至 %s\n设备位置：%s",
		booking.Equipment.Name,
		booking.StartTime.Format("2006-01-02 15:04"),
		booking.EndTime.Format("2006-01-02 15:04"),
		booking.Equipment.Center.Name,
	)

	return s.SendNotification(ctx, booking.UserID, "booking_confirm", title, content)
}

func (s *notificationServiceImpl) SendBookingCancel(ctx context.Context, bookingID uint64, operator string) error {
	booking, err := s.bookingRepo.GetByIDWithDetails(ctx, bookingID)
	if err != nil {
		return err
	}

	title := "预约取消通知"
	content := fmt.Sprintf(
		"您的【%s】预约已被取消。\n原预约时间：%s 至 %s\n操作人：%s",
		booking.Equipment.Name,
		booking.StartTime.Format("2006-01-02 15:04"),
		booking.EndTime.Format("2006-01-02 15:04"),
		operator,
	)

	return s.SendNotification(ctx, booking.UserID, "booking_cancel", title, content)
}

func (s *notificationServiceImpl) SendWaitlistAdvance(ctx context.Context, waitlist *model.Waitlist) error {
	equipment, err := s.equipmentRepo.GetByIDWithCenter(ctx, waitlist.EquipmentID)
	if err != nil {
		return err
	}

	title := "等待队列补位成功"
	content := fmt.Sprintf(
		"恭喜！您已成功补位【%s】。\n预约时间：%s 至 %s\n设备位置：%s\n请及时登录系统确认预约。",
		equipment.Name,
		waitlist.StartTime.Format("2006-01-02 15:04"),
		waitlist.EndTime.Format("2006-01-02 15:04"),
		equipment.Center.Name,
	)

	return s.SendNotification(ctx, waitlist.UserID, "waitlist_advance", title, content)
}

func (s *notificationServiceImpl) SendMaintenanceComplete(ctx context.Context, maintenanceID uint64) error {
	maintenance, err := s.maintenanceRepo.GetByIDWithDetails(ctx, maintenanceID)
	if err != nil {
		return err
	}

	title := "维护完成通知"
	content := fmt.Sprintf(
		"【%s】的维护已完成。\n维护类型：%s\n维护时间：%s 至 %s\n备注：%s\n设备已恢复可用状态。",
		maintenance.Equipment.Name,
		maintenance.Type,
		maintenance.StartTime.Format("2006-01-02 15:04"),
		maintenance.EndTime.Format("2006-01-02 15:04"),
		maintenance.Remark,
	)

	affectedUsers, err := s.getAffectedUsersByEquipment(ctx, maintenance.EquipmentID, maintenance.StartTime, maintenance.EndTime)
	if err != nil {
		return err
	}

	for _, userID := range affectedUsers {
		if err := s.SendNotification(ctx, userID, "maintenance_complete", title, content); err != nil {
			return err
		}
	}

	return nil
}

func (s *notificationServiceImpl) SendBillingGenerated(ctx context.Context, billingID uint64) error {
	billing, err := s.billingRepo.GetByIDWithDetails(ctx, billingID)
	if err != nil {
		return err
	}

	var equipmentName string
	if billing.Booking != nil && billing.Booking.Equipment != nil {
		equipmentName = billing.Booking.Equipment.Name
	} else {
		equipmentName = "系统费用"
	}

	title := "账单生成通知"
	content := fmt.Sprintf(
		"您有新的账单已生成。\n账单日期：%s\n费用项目：%s\n金额：¥%.2f\n请及时核对并处理。",
		billing.BillingDate.Format("2006-01-02"),
		equipmentName,
		billing.Amount,
	)

	return s.SendNotification(ctx, billing.UserID, "billing_generated", title, content)
}

func (s *notificationServiceImpl) GetNotificationList(ctx context.Context, userID uint64, isRead *bool, pagination *model.PaginationParams) (*model.PaginatedResult[model.Notification], error) {
	return s.notificationRepo.ListByUser(ctx, userID, isRead, pagination)
}

func (s *notificationServiceImpl) MarkAsRead(ctx context.Context, userID, notificationID uint64) error {
	return s.notificationRepo.MarkAsRead(ctx, userID, notificationID)
}

func (s *notificationServiceImpl) MarkAllAsRead(ctx context.Context, userID uint64) error {
	return s.notificationRepo.MarkAllAsRead(ctx, userID)
}

func (s *notificationServiceImpl) CountUnread(ctx context.Context, userID uint64) (*model.UnreadNotificationStats, error) {
	return s.notificationRepo.CountUnread(ctx, userID)
}

func (s *notificationServiceImpl) getAffectedUsersByEquipment(ctx context.Context, equipmentID uint64, startTime, endTime time.Time) ([]uint64, error) {
	pagination := &model.PaginationParams{Page: 1, PageSize: 1000}
	result, err := s.bookingRepo.ListByEquipmentAndTimeRange(ctx, equipmentID, startTime, endTime, pagination)
	if err != nil {
		return nil, err
	}

	userMap := make(map[uint64]bool)
	for _, booking := range result.Items {
		if booking.Status == "confirmed" {
			userMap[booking.UserID] = true
		}
	}

	userIDs := make([]uint64, 0, len(userMap))
	for userID := range userMap {
		userIDs = append(userIDs, userID)
	}

	return userIDs, nil
}
