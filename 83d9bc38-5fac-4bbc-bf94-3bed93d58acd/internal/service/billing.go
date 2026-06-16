package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"time"

	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type billingService struct {
	billingRepo     repository.BillingRepository
	bookingRepo     repository.BookingRepository
	userRepo        repository.UserRepository
	equipmentRepo   repository.EquipmentRepository
	auditLogService AuditLogService
	db              *gorm.DB
}

func NewBillingService(
	billingRepo repository.BillingRepository,
	bookingRepo repository.BookingRepository,
	userRepo repository.UserRepository,
	equipmentRepo repository.EquipmentRepository,
	auditLogService AuditLogService,
	db *gorm.DB,
) BillingService {
	return &billingService{
		billingRepo:     billingRepo,
		bookingRepo:     bookingRepo,
		userRepo:        userRepo,
		equipmentRepo:   equipmentRepo,
		auditLogService: auditLogService,
		db:              db,
	}
}

func (s *billingService) CalculateFee(startTime, endTime time.Time, hourlyRate float64) (float64, error) {
	if endTime.Before(startTime) || endTime.Equal(startTime) {
		return 0, ErrInvalidTimeRange
	}
	duration := endTime.Sub(startTime)
	hours := duration.Hours()
	return hours * hourlyRate, nil
}

func (s *billingService) CreateBilling(ctx context.Context, bookingID uint64, userID *uint64, ipAddress string) (*model.Billing, error) {
	booking, err := s.bookingRepo.GetByIDWithDetails(ctx, bookingID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBookingNotFound
		}
		return nil, err
	}

	if booking.Equipment == nil {
		return nil, ErrEquipmentNotFound
	}

	amount, err := s.CalculateFee(booking.StartTime, booking.EndTime, booking.Equipment.HourlyRate)
	if err != nil {
		return nil, err
	}

	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var user model.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, booking.UserID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	if user.Budget < amount {
		tx.Rollback()
		return nil, ErrInsufficientBudget
	}

	oldUser := user
	user.Budget -= amount
	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	billing := &model.Billing{
		BookingID:   &bookingID,
		UserID:      booking.UserID,
		Amount:      amount,
		Status:      BillingStatusPaid,
		BillingDate: time.Now(),
	}

	if err := tx.Create(billing).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	_ = s.auditLogService.LogAction(ctx, "update_budget", "users", &user.ID, oldUser, user, userID, ipAddress)
	_ = s.auditLogService.LogAction(ctx, "create_billing", "billings", &billing.ID, nil, billing, userID, ipAddress)

	return s.billingRepo.GetByIDWithDetails(ctx, billing.ID)
}

func (s *billingService) calculateRefundRatio(cancelTime, startTime time.Time) float64 {
	hoursBeforeStart := startTime.Sub(cancelTime).Hours()

	switch {
	case hoursBeforeStart >= 24:
		return 1.0
	case hoursBeforeStart >= 12:
		return 0.75
	case hoursBeforeStart >= 6:
		return 0.5
	case hoursBeforeStart >= 2:
		return 0.25
	default:
		return 0
	}
}

func (s *billingService) RefundBilling(ctx context.Context, billingID uint64, cancelTime time.Time, userID *uint64, ipAddress string) (*model.Billing, error) {
	billing, err := s.billingRepo.GetByIDWithDetails(ctx, billingID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBillingNotFound
		}
		return nil, err
	}

	if billing.Status == BillingStatusRefunded {
		return nil, ErrAlreadyRefunded
	}

	if billing.Status != BillingStatusPaid {
		return nil, ErrInvalidRefund
	}

	if billing.Booking == nil {
		return nil, ErrBookingNotFound
	}

	refundRatio := s.calculateRefundRatio(cancelTime, billing.Booking.StartTime)
	if refundRatio <= 0 {
		return nil, ErrInvalidRefund
	}

	refundAmount := billing.Amount * refundRatio

	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var user model.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, billing.UserID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	oldUser := user
	oldBilling := *billing

	user.Budget += refundAmount
	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if refundRatio == 1.0 {
		billing.Status = BillingStatusRefunded
	} else {
		billing.Status = BillingStatusPartial
		billing.Amount -= refundAmount
	}

	if err := tx.Save(billing).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	_ = s.auditLogService.LogAction(ctx, "refund_budget", "users", &user.ID, oldUser, user, userID, ipAddress)
	_ = s.auditLogService.LogAction(ctx, "refund_billing", "billings", &billing.ID, oldBilling, billing, userID, ipAddress)

	return s.billingRepo.GetByIDWithDetails(ctx, billing.ID)
}

func (s *billingService) GetBillingList(ctx context.Context, filter *BillingFilter, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error) {
	if pagination == nil {
		pagination = &model.PaginationParams{Page: 1, PageSize: 10}
	}

	if filter == nil {
		return s.billingRepo.List(ctx, pagination)
	}

	switch {
	case filter.UserID != nil && filter.Year != nil && filter.Month != nil:
		return s.billingRepo.ListByUserAndMonth(ctx, *filter.UserID, *filter.Year, *filter.Month, pagination)
	case filter.UserID != nil:
		return s.billingRepo.ListByUser(ctx, *filter.UserID, pagination)
	case filter.Year != nil && filter.Month != nil:
		return s.billingRepo.ListByMonth(ctx, *filter.Year, *filter.Month, pagination)
	case filter.Status != nil:
		return s.billingRepo.ListByStatus(ctx, *filter.Status, pagination)
	default:
		return s.billingRepo.List(ctx, pagination)
	}
}

func (s *billingService) ExportMonthlyReport(ctx context.Context, year, month int) ([][]string, error) {
	filter := &BillingFilter{
		Year:  &year,
		Month: &month,
	}

	pagination := &model.PaginationParams{
		Page:     1,
		PageSize: 10000,
	}

	result, err := s.GetBillingList(ctx, filter, pagination)
	if err != nil {
		return nil, err
	}

	records := make([][]string, 0, len(result.Items)+1)

	header := []string{
		"账单ID",
		"用户ID",
		"用户名",
		"设备ID",
		"设备名称",
		"预约开始时间",
		"预约结束时间",
		"时长(小时)",
		"小时费率",
		"金额",
		"状态",
		"账单日期",
	}
	records = append(records, header)

	for _, billing := range result.Items {
		var equipmentName, bookingStartTime, bookingEndTime string
		var durationHours, hourlyRate float64
		var equipmentID uint64

		if billing.Booking != nil {
			bookingStartTime = billing.Booking.StartTime.Format("2006-01-02 15:04:05")
			bookingEndTime = billing.Booking.EndTime.Format("2006-01-02 15:04:05")
			equipmentID = billing.Booking.EquipmentID

			if billing.Booking.Equipment != nil {
				equipmentName = billing.Booking.Equipment.Name
				hourlyRate = billing.Booking.Equipment.HourlyRate
			}

			durationHours = billing.Booking.EndTime.Sub(billing.Booking.StartTime).Hours()
		}

		record := []string{
			strconv.FormatUint(billing.ID, 10),
			strconv.FormatUint(billing.UserID, 10),
			billing.User.Name,
			strconv.FormatUint(equipmentID, 10),
			equipmentName,
			bookingStartTime,
			bookingEndTime,
			fmt.Sprintf("%.2f", durationHours),
			fmt.Sprintf("%.2f", hourlyRate),
			fmt.Sprintf("%.2f", billing.Amount),
			billing.Status,
			billing.BillingDate.Format("2006-01-02"),
		}
		records = append(records, record)
	}

	return records, nil
}

func (s *billingService) GenerateCSV(ctx context.Context, records [][]string) ([]byte, error) {
	buffer := &bytes.Buffer{}
	writer := csv.NewWriter(buffer)

	if err := writer.WriteAll(records); err != nil {
		return nil, err
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buffer.Bytes(), nil
}

func (s *billingService) GetUserBudget(ctx context.Context, userID uint64) (float64, error) {
	if userID == 0 {
		return 0, errors.New("user ID is required")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrUserNotFound
		}
		return 0, err
	}
	return user.Budget, nil
}

func (s *billingService) UpdateBudget(ctx context.Context, userID uint64, amount float64, operator string, userIDPtr *uint64, ipAddress string) (float64, error) {
	if userID == 0 {
		return 0, errors.New("user ID is required")
	}

	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var user model.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, userID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrUserNotFound
		}
		return 0, err
	}

	oldUser := user
	user.Budget += amount
	if user.Budget < 0 {
		tx.Rollback()
		return 0, ErrInsufficientBudget
	}

	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		return 0, err
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	_ = s.auditLogService.LogAction(ctx, "update_budget", "users", &user.ID, oldUser, user, userIDPtr, ipAddress)

	return user.Budget, nil
}

func (s *billingService) GetByBookingID(ctx context.Context, bookingID uint64) (*model.Billing, error) {
	return s.billingRepo.GetByBookingID(ctx, bookingID)
}
