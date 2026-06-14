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

func (s *ScheduleService) CheckConflict(db *gorm.DB, venueID uint, startTime, endTime time.Time, excludeBookingIDs ...uint) ([]repository.Booking, error) {
	var conflicts []repository.Booking

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

	if err := query.Preload("Venue").Preload("User").Find(&conflicts).Error; err != nil {
		return nil, err
	}

	return conflicts, nil
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
