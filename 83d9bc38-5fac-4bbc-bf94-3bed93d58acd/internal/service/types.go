package service

import (
	"time"

	"equipment-booking/internal/model"
)

const (
	BillingStatusPaid     = "paid"
	BillingStatusRefunded = "refunded"
	BillingStatusPartial  = "partial"
)

type BillingFilter struct {
	UserID *uint64
	Year   *int
	Month  *int
	Status *string
}

type CreateBookingRequest struct {
	UserID      uint64
	EquipmentID uint64
	StartTime   time.Time
	EndTime     time.Time
	IsSeries    bool
	SeriesID    string
	IPAddress   string
}

type CreateSeriesBookingRequest struct {
	UserID      uint64
	EquipmentID uint64
	StartTime   time.Time
	EndTime     time.Time
	WeekCount   int
	IPAddress   string
}

type CheckConflictRequest struct {
	EquipmentID          uint64
	StartTime            time.Time
	EndTime              time.Time
	ExcludeMaintenanceID *uint64
}

type AddToWaitlistRequest struct {
	UserID      uint64
	EquipmentID uint64
	StartTime   time.Time
	EndTime     time.Time
	IPAddress   string
}

type GetBookingListRequest struct {
	UserID      *uint64
	EquipmentID *uint64
	Status      *string
	StartTime   *time.Time
	EndTime     *time.Time
	Pagination  *model.PaginationParams
}

type EquipmentFilter struct {
	CenterID   *uint64
	Category   *string
	Status     *string
	SearchTerm *string
}

type EquipmentStats struct {
	TotalCount      int64
	AvailableCount  int64
	MaintenanceCount int64
	ScrappedCount   int64
}

type EquipmentDetail struct {
	model.Equipment
	CurrentBooking    *model.Booking  `json:"currentBooking,omitempty"`
	NextFreeTime      *time.Time      `json:"nextFreeTime,omitempty"`
	UpcomingBookings  []model.Booking `json:"upcomingBookings,omitempty"`
}

type EquipmentUtilizationStats struct {
	EquipmentID     uint64  `json:"equipmentId"`
	EquipmentName   string  `json:"equipmentName"`
	CenterID        uint64  `json:"centerId"`
	CenterName      string  `json:"centerName"`
	Category        string  `json:"category"`
	BookingCount    int64   `json:"bookingCount"`
	TotalHours      float64 `json:"totalHours"`
	BookedHours     float64 `json:"bookedHours"`
	UtilizationRate float64 `json:"utilizationRate"`
	Period          string  `json:"period"`
}
