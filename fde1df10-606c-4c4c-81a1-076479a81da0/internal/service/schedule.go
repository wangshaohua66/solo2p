package service

import (
	"time"

	"venue-scheduler/internal/repository"

	"gorm.io/gorm"
)

type ScheduleService struct {
	db *gorm.DB
}

func NewScheduleService(db *gorm.DB) *ScheduleService {
	return &ScheduleService{db: db}
}

// 性能约束: P99 ≤ 200ms
// CheckConflict 档期冲突检测（三重校验）
// 检测维度：1) 同场馆排期档期时间重叠(pending/confirmed)
//  2. 场馆维护时段重叠(maintenance)
//  3. 场馆关联设备被占用(EquipmentBooking关联)
func (s *ScheduleService) CheckConflict(db *gorm.DB, venueID uint, startTime, endTime time.Time, excludeBookingIDs ...uint) ([]repository.Booking, error) {
	seenIDs := make(map[uint]struct{})
	var result []repository.Booking

	// 1) 排期档期冲突：pending/confirmed 状态，排除 cancelled，时间重叠
	var bookingConflicts []repository.Booking
	query := db.Where(
		"venue_id = ? AND status IN ? AND start_time < ? AND end_time > ?",
		venueID,
		[]repository.BookingStatus{repository.BookingStatusPending, repository.BookingStatusConfirmed},
		endTime,
		startTime,
	)
	if len(excludeBookingIDs) > 0 {
		query = query.Where("id NOT IN ?", excludeBookingIDs)
	}
	if err := query.Preload("Venue").Preload("User").Find(&bookingConflicts).Error; err != nil {
		return nil, err
	}
	for _, b := range bookingConflicts {
		if _, exists := seenIDs[b.ID]; !exists {
			seenIDs[b.ID] = struct{}{}
			result = append(result, b)
		}
	}

	// 2) 场馆维护冲突：status=maintenance 或 type=maintenance，时间重叠
	var maintenanceConflicts []repository.Booking
	maintenanceQuery := db.Where(
		"venue_id = ? AND (status = ? OR type = ?) AND start_time < ? AND end_time > ?",
		venueID,
		repository.BookingStatusMaintenance,
		repository.BookingTypeMaintenance,
		endTime,
		startTime,
	)
	if len(excludeBookingIDs) > 0 {
		maintenanceQuery = maintenanceQuery.Where("id NOT IN ?", excludeBookingIDs)
	}
	if err := maintenanceQuery.Preload("Venue").Preload("User").Find(&maintenanceConflicts).Error; err != nil {
		return nil, err
	}
	for _, b := range maintenanceConflicts {
		if _, exists := seenIDs[b.ID]; !exists {
			seenIDs[b.ID] = struct{}{}
			result = append(result, b)
		}
	}

	// 3) 设备占用冲突：通过 EquipmentBooking 关联 Booking，筛选 venue_id=venueID 且时间重叠
	var equipmentConflicts []repository.Booking
	equipmentSubQuery := db.Model(&repository.EquipmentBooking{}).
		Select("bookings.*").
		Joins("JOIN bookings ON bookings.id = equipment_bookings.booking_id").
		Where(
			"bookings.venue_id = ? AND equipment_bookings.start_time < ? AND equipment_bookings.end_time > ?",
			venueID,
			endTime,
			startTime,
		)
	if len(excludeBookingIDs) > 0 {
		equipmentSubQuery = equipmentSubQuery.Where("bookings.id NOT IN ?", excludeBookingIDs)
	}
	if err := equipmentSubQuery.Preload("Venue").Preload("User").Find(&equipmentConflicts).Error; err != nil {
		return nil, err
	}
	for _, b := range equipmentConflicts {
		if _, exists := seenIDs[b.ID]; !exists {
			seenIDs[b.ID] = struct{}{}
			result = append(result, b)
		}
	}

	return result, nil
}

type TimeSlot struct {
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
}

func (s *ScheduleService) RecommendSlots(db *gorm.DB, venueID uint, preferredStart, preferredEnd time.Time, count int) ([]TimeSlot, error) {
	if count <= 0 {
		count = 3
	}

	duration := preferredEnd.Sub(preferredStart)
	if duration <= 0 {
		duration = 2 * time.Hour
	}

	var slots []TimeSlot
	searchDays := 7
	slotInterval := 30 * time.Minute

	currentDate := preferredStart.Truncate(24 * time.Hour)
	workStart := 9
	workEnd := 22

	for day := 0; day < searchDays && len(slots) < count; day++ {
		searchDate := currentDate.AddDate(0, 0, day)

		for hour := workStart; hour < workEnd && len(slots) < count; hour++ {
			for minute := 0; minute < 60 && len(slots) < count; minute += int(slotInterval.Minutes()) {
				candidateStart := time.Date(
					searchDate.Year(), searchDate.Month(), searchDate.Day(),
					hour, minute, 0, 0, preferredStart.Location(),
				)

				if candidateStart.Before(time.Now()) {
					continue
				}

				candidateEnd := candidateStart.Add(duration)

				conflicts, err := s.CheckConflict(db, venueID, candidateStart, candidateEnd)
				if err != nil {
					return nil, err
				}

				if len(conflicts) == 0 {
					slots = append(slots, TimeSlot{
						StartTime: candidateStart,
						EndTime:   candidateEnd,
					})
				}
			}
		}
	}

	return slots, nil
}
