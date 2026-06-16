package service

import (
	"context"
	"time"

	"equipment-booking/internal/model"
)

type BillingService interface {
	CalculateFee(startTime, endTime time.Time, hourlyRate float64) (float64, error)
	CreateBilling(ctx context.Context, bookingID uint64, userID *uint64, ipAddress string) (*model.Billing, error)
	RefundBilling(ctx context.Context, billingID uint64, cancelTime time.Time, userID *uint64, ipAddress string) (*model.Billing, error)
	GetBillingList(ctx context.Context, filter *BillingFilter, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error)
	ExportMonthlyReport(ctx context.Context, year, month int) ([][]string, error)
	GenerateCSV(ctx context.Context, records [][]string) ([]byte, error)
	GetUserBudget(ctx context.Context, userID uint64) (float64, error)
	UpdateBudget(ctx context.Context, userID uint64, amount float64, operator string, userIDPtr *uint64, ipAddress string) (float64, error)
	GetByBookingID(ctx context.Context, bookingID uint64) (*model.Billing, error)
}

type BookingService interface {
	CreateBooking(ctx context.Context, req *CreateBookingRequest) (*model.Booking, error)
	CreateSeriesBooking(ctx context.Context, req *CreateSeriesBookingRequest) ([]*model.Booking, error)
	CancelBooking(ctx context.Context, bookingID uint64, operatorID uint64, reason string) error
	CheckConflict(ctx context.Context, req *CheckConflictRequest) ([]model.Booking, error)
	AddToWaitlist(ctx context.Context, req *AddToWaitlistRequest) (*model.Waitlist, error)
	ProcessWaitlist(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, ipAddress string) error
	GetBookingList(ctx context.Context, req *GetBookingListRequest) (*model.PaginatedResult[model.Booking], error)
	GetBookingsInRange(ctx context.Context, equipmentID uint64, startTime, endTime time.Time) ([]model.Booking, error)
}

type NotificationService interface {
	SendNotification(ctx context.Context, userID uint64, notificationType, title, content string) error
	SendBookingConfirm(ctx context.Context, bookingID uint64) error
	SendBookingCancel(ctx context.Context, bookingID uint64, operator string) error
	SendWaitlistAdvance(ctx context.Context, waitlist *model.Waitlist) error
	SendMaintenanceComplete(ctx context.Context, maintenanceID uint64) error
	SendBillingGenerated(ctx context.Context, billingID uint64) error
	GetNotificationList(ctx context.Context, userID uint64, isRead *bool, pagination *model.PaginationParams) (*model.PaginatedResult[model.Notification], error)
	MarkAsRead(ctx context.Context, userID, notificationID uint64) error
	MarkAllAsRead(ctx context.Context, userID uint64) error
	CountUnread(ctx context.Context, userID uint64) (*model.UnreadNotificationStats, error)
}

type MaintenanceService interface {
	CreateMaintenance(ctx context.Context, maintenance *model.Maintenance, operatorID uint64) (*model.Maintenance, error)
	CompleteMaintenance(ctx context.Context, maintenanceID uint64, operatorID uint64, remark string) (*model.Maintenance, error)
	GetMaintenanceList(ctx context.Context, equipmentID *uint64, startTime, endTime *time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error)
	UpdateMaintenance(ctx context.Context, maintenanceID uint64, updates *model.Maintenance, operatorID uint64) (*model.Maintenance, error)
	CancelMaintenance(ctx context.Context, maintenanceID uint64, operatorID uint64) (*model.Maintenance, error)
	CheckMaintenanceConflict(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, excludeMaintenanceID *uint64) (bool, []model.Maintenance, error)
}

type EquipmentService interface {
	CreateEquipment(ctx context.Context, equipment *model.Equipment, userID *uint64, ipAddress string) (*model.Equipment, error)
	UpdateEquipment(ctx context.Context, equipment *model.Equipment, userID *uint64, ipAddress string) (*model.Equipment, error)
	GetEquipmentList(ctx context.Context, centerID, category, status *string, pagination *model.PaginationParams) (*model.PaginatedResult[model.Equipment], error)
	GetEquipmentDetail(ctx context.Context, id uint64) (*EquipmentDetail, error)
	UpdateEquipmentStatus(ctx context.Context, id uint64, status string, operatorID uint64, remark string) (*model.Equipment, error)
	GetNextFreeTime(ctx context.Context, equipmentID uint64, fromTime time.Time) (*time.Time, error)
	GetEquipmentStats(ctx context.Context, equipmentIDs []uint64, startTime, endTime time.Time) ([]EquipmentUtilizationStats, error)
}

type AuditLogService interface {
	LogCreate(ctx context.Context, tableName string, recordID uint64, newValue interface{}, userID *uint64, ipAddress string) error
	LogUpdate(ctx context.Context, tableName string, recordID uint64, oldValue, newValue interface{}, userID *uint64, ipAddress string) error
	LogDelete(ctx context.Context, tableName string, recordID uint64, oldValue interface{}, userID *uint64, ipAddress string) error
	LogAction(ctx context.Context, action, tableName string, recordID *uint64, oldValue, newValue interface{}, userID *uint64, ipAddress string) error
	GetAuditLogList(ctx context.Context, userID *uint64, tableName, action *string, startDate, endDate *time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error)
	GetAuditLogDetail(ctx context.Context, id uint64) (*model.AuditLog, error)
}
