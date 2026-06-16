package service

import (
	"context"
	"errors"
	"time"

	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
)

type equipmentService struct {
	equipmentRepo    repository.EquipmentRepository
	bookingRepo      repository.BookingRepository
	statsRepo        repository.StatsRepository
	equipmentLogRepo repository.EquipmentLogRepository
	auditLogService  AuditLogService
}

func NewEquipmentService(
	equipmentRepo repository.EquipmentRepository,
	bookingRepo repository.BookingRepository,
	statsRepo repository.StatsRepository,
	equipmentLogRepo repository.EquipmentLogRepository,
	auditLogService AuditLogService,
) EquipmentService {
	return &equipmentService{
		equipmentRepo:    equipmentRepo,
		bookingRepo:      bookingRepo,
		statsRepo:        statsRepo,
		equipmentLogRepo: equipmentLogRepo,
		auditLogService:  auditLogService,
	}
}

func (s *equipmentService) CreateEquipment(ctx context.Context, equipment *model.Equipment, userID *uint64, ipAddress string) (*model.Equipment, error) {
	if equipment == nil {
		return nil, errors.New("equipment cannot be nil")
	}
	if equipment.Name == "" {
		return nil, errors.New("equipment name is required")
	}
	if equipment.Category == "" {
		return nil, errors.New("equipment category is required")
	}
	if equipment.CenterID == 0 {
		return nil, errors.New("center ID is required")
	}
	if equipment.HourlyRate < 0 {
		return nil, errors.New("hourly rate cannot be negative")
	}

	if equipment.Status == "" {
		equipment.Status = "available"
	}

	if err := s.equipmentRepo.Create(ctx, equipment); err != nil {
		return nil, err
	}

	_ = s.auditLogService.LogCreate(ctx, "equipment", equipment.ID, equipment, userID, ipAddress)

	return equipment, nil
}

func (s *equipmentService) UpdateEquipment(ctx context.Context, equipment *model.Equipment, userID *uint64, ipAddress string) (*model.Equipment, error) {
	if equipment == nil || equipment.ID == 0 {
		return nil, errors.New("equipment ID is required")
	}

	oldEquipment, err := s.equipmentRepo.GetByID(ctx, equipment.ID)
	if err != nil {
		return nil, err
	}

	oldSnapshot := *oldEquipment

	if err := s.equipmentRepo.Update(ctx, equipment); err != nil {
		return nil, err
	}

	_ = s.auditLogService.LogUpdate(ctx, "equipment", equipment.ID, oldSnapshot, equipment, userID, ipAddress)

	return equipment, nil
}

func (s *equipmentService) GetEquipmentList(ctx context.Context, centerID, category, status *string, pagination *model.PaginationParams) (*model.PaginatedResult[model.Equipment], error) {
	if pagination == nil {
		pagination = &model.PaginationParams{Page: 1, PageSize: 10}
	}
	return s.equipmentRepo.ListWithFilter(ctx, centerID, category, status, pagination)
}

func (s *equipmentService) GetEquipmentDetail(ctx context.Context, id uint64) (*EquipmentDetail, error) {
	if id == 0 {
		return nil, errors.New("equipment ID is required")
	}

	equipment, err := s.equipmentRepo.GetByIDWithCenter(ctx, id)
	if err != nil {
		return nil, err
	}

	detail := &EquipmentDetail{
		Equipment: *equipment,
	}

	now := time.Now()
	currentBooking, err := s.getCurrentBooking(ctx, id, now)
	if err != nil {
		return nil, err
	}
	detail.CurrentBooking = currentBooking

	nextFreeTime, err := s.GetNextFreeTime(ctx, id, now)
	if err != nil {
		return nil, err
	}
	detail.NextFreeTime = nextFreeTime

	upcomingBookings, err := s.getUpcomingBookings(ctx, id, now)
	if err != nil {
		return nil, err
	}
	detail.UpcomingBookings = upcomingBookings

	return detail, nil
}

func (s *equipmentService) getCurrentBooking(ctx context.Context, equipmentID uint64, now time.Time) (*model.Booking, error) {
	bookings, err := s.bookingRepo.ListByEquipmentAndTimeRange(ctx, equipmentID, now, now.Add(time.Second), nil)
	if err != nil {
		return nil, err
	}

	if len(bookings.Items) > 0 {
		return &bookings.Items[0], nil
	}
	return nil, nil
}

func (s *equipmentService) getUpcomingBookings(ctx context.Context, equipmentID uint64, now time.Time) ([]model.Booking, error) {
	endTime := now.AddDate(0, 0, 7)
	bookings, err := s.bookingRepo.ListByEquipmentAndTimeRange(ctx, equipmentID, now, endTime, &model.PaginationParams{Page: 1, PageSize: 10})
	if err != nil {
		return nil, err
	}

	upcoming := make([]model.Booking, 0, len(bookings.Items))
	for _, booking := range bookings.Items {
		if booking.StartTime.After(now) {
			upcoming = append(upcoming, booking)
		}
	}
	return upcoming, nil
}

func (s *equipmentService) UpdateEquipmentStatus(ctx context.Context, id uint64, status string, operatorID uint64, remark string) (*model.Equipment, error) {
	if id == 0 {
		return nil, errors.New("equipment ID is required")
	}
	if status != "available" && status != "maintenance" && status != "scrapped" {
		return nil, errors.New("invalid equipment status, must be one of: available, maintenance, scrapped")
	}

	equipment, err := s.equipmentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	oldStatus := equipment.Status
	if oldStatus == status {
		return equipment, nil
	}

	equipment.Status = status
	if err := s.equipmentRepo.Update(ctx, equipment); err != nil {
		return nil, err
	}

	equipmentLog := &model.EquipmentLog{
		EquipmentID: id,
		OldStatus:   oldStatus,
		NewStatus:   status,
		OperatorID:  operatorID,
		Remark:      remark,
	}
	if err := s.equipmentLogRepo.Create(ctx, equipmentLog); err != nil {
		return equipment, err
	}

	return equipment, nil
}

func (s *equipmentService) GetNextFreeTime(ctx context.Context, equipmentID uint64, fromTime time.Time) (*time.Time, error) {
	if equipmentID == 0 {
		return nil, errors.New("equipment ID is required")
	}

	equipment, err := s.equipmentRepo.GetByID(ctx, equipmentID)
	if err != nil {
		return nil, err
	}

	if equipment.Status != "available" {
		return nil, nil
	}

	searchEnd := fromTime.AddDate(0, 0, 30)
	bookings, err := s.bookingRepo.ListByEquipmentAndTimeRange(ctx, equipmentID, fromTime, searchEnd, nil)
	if err != nil {
		return nil, err
	}

	if len(bookings.Items) == 0 {
		return &fromTime, nil
	}

	var lastEndTime time.Time
	for _, booking := range bookings.Items {
		if booking.Status != "confirmed" {
			continue
		}
		if lastEndTime.IsZero() {
			if booking.StartTime.After(fromTime) {
				gap := booking.StartTime.Sub(fromTime)
				if gap >= time.Minute {
					return &fromTime, nil
				}
			}
			lastEndTime = booking.EndTime
		} else {
			if booking.StartTime.After(lastEndTime) {
				gap := booking.StartTime.Sub(lastEndTime)
				if gap >= time.Minute {
					return &lastEndTime, nil
				}
			}
			if booking.EndTime.After(lastEndTime) {
				lastEndTime = booking.EndTime
			}
		}
	}

	if !lastEndTime.IsZero() && lastEndTime.After(fromTime) {
		return &lastEndTime, nil
	}

	return &fromTime, nil
}

func (s *equipmentService) GetEquipmentStats(ctx context.Context, equipmentIDs []uint64, startTime, endTime time.Time) ([]EquipmentUtilizationStats, error) {
	if startTime.IsZero() || endTime.IsZero() {
		return nil, errors.New("start time and end time are required")
	}
	if endTime.Before(startTime) {
		return nil, errors.New("end time cannot be before start time")
	}

	utilizationStats, err := s.statsRepo.GetUtilizationByEquipment(ctx, startTime, endTime, equipmentIDs, nil)
	if err != nil {
		return nil, err
	}

	stats := make([]EquipmentUtilizationStats, 0, len(utilizationStats))
	for _, us := range utilizationStats {
		bookingCount, err := s.getBookingCount(ctx, us.EquipmentID, startTime, endTime)
		if err != nil {
			return nil, err
		}

		stats = append(stats, EquipmentUtilizationStats{
			EquipmentID:     us.EquipmentID,
			EquipmentName:   us.EquipmentName,
			CenterID:        us.CenterID,
			CenterName:      us.CenterName,
			Category:        us.Category,
			BookingCount:    bookingCount,
			TotalHours:      us.TotalHours,
			BookedHours:     us.BookedHours,
			UtilizationRate: us.UtilizationRate,
			Period:          us.Period,
		})
	}

	return stats, nil
}

func (s *equipmentService) getBookingCount(ctx context.Context, equipmentID uint64, startTime, endTime time.Time) (int64, error) {
	bookings, err := s.bookingRepo.ListByEquipmentAndTimeRange(ctx, equipmentID, startTime, endTime, nil)
	if err != nil {
		return 0, err
	}
	return bookings.Total, nil
}
