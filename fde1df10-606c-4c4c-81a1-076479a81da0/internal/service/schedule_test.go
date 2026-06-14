package service

import (
	"fmt"
	"math/rand"
	"testing"
	"time"
	"venue-scheduler/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to sqlite: %v", err)
	}

	err = db.AutoMigrate(
		&repository.User{},
		&repository.Venue{},
		&repository.Booking{},
		&repository.Equipment{},
		&repository.EquipmentBooking{},
		&repository.Contract{},
		&repository.ContractApproval{},
		&repository.Budget{},
		&repository.Expense{},
		&repository.RehearsalBooking{},
		&repository.Notification{},
	)
	if err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}

	return db
}

func seedTestData(db *gorm.DB, venueID uint, baseTime time.Time) {
	user := repository.User{
		Username:     "testuser",
		PasswordHash: "hash",
		RealName:     "Test User",
		Role:         repository.UserRoleProducer,
		Email:        "test@example.com",
	}
	db.Create(&user)

	venue := repository.Venue{
		Name:        "测试剧场",
		Type:        repository.VenueTypeTheater,
		Capacity:    500,
		Location:    "北京市朝阳区",
		Status:      repository.VenueStatusActive,
		Description: "测试用剧场",
	}
	venue.ID = venueID
	db.Create(&venue)

	rng := rand.New(rand.NewSource(42))
	statuses := []repository.BookingStatus{
		repository.BookingStatusPending,
		repository.BookingStatusConfirmed,
		repository.BookingStatusCancelled,
	}
	types := []repository.BookingType{
		repository.BookingTypePerformance,
		repository.BookingTypeRehearsal,
	}

	for i := 0; i < 500; i++ {
		dayOffset := rng.Intn(30)
		hour := 9 + rng.Intn(12)
		duration := 1 + rng.Intn(4)
		startTime := baseTime.AddDate(0, 0, dayOffset).Add(time.Duration(hour) * time.Hour)
		endTime := startTime.Add(time.Duration(duration) * time.Hour)
		status := statuses[rng.Intn(len(statuses))]
		bookingType := types[rng.Intn(len(types))]

		booking := repository.Booking{
			VenueID:     venueID,
			UserID:      user.ID,
			Title:       fmt.Sprintf("档期-%d", i+1),
			Description: fmt.Sprintf("测试档期描述 %d", i+1),
			StartTime:   startTime,
			EndTime:     endTime,
			Status:      status,
			Type:        bookingType,
		}
		db.Create(&booking)
	}

	for i := 0; i < 10; i++ {
		dayOffset := rng.Intn(30)
		startTime := baseTime.AddDate(0, 0, dayOffset).Add(8 * time.Hour)
		endTime := startTime.Add(4 * time.Hour)

		booking := repository.Booking{
			VenueID:     venueID,
			UserID:      user.ID,
			Title:       fmt.Sprintf("场馆维护-%d", i+1),
			Description: fmt.Sprintf("场馆维护描述 %d", i+1),
			StartTime:   startTime,
			EndTime:     endTime,
			Status:      repository.BookingStatusMaintenance,
			Type:        repository.BookingTypeMaintenance,
		}
		db.Create(&booking)
	}

	equipments := make([]repository.Equipment, 0, 20)
	for i := 0; i < 20; i++ {
		eq := repository.Equipment{
			Name:         fmt.Sprintf("设备-%d", i+1),
			Category:     []repository.EquipmentCategory{repository.EquipmentCategoryLighting, repository.EquipmentCategorySound, repository.EquipmentCategoryStage}[i%3],
			ModelName:    fmt.Sprintf("Model-%d", i+1),
			Status:       repository.EquipmentStatusAvailable,
			Location:     "剧场仓库",
			Description:  fmt.Sprintf("设备描述 %d", i+1),
			SerialNumber: fmt.Sprintf("SN-%05d", i+1),
		}
		db.Create(&eq)
		equipments = append(equipments, eq)
	}

	var confirmedBookings []repository.Booking
	db.Where("venue_id = ? AND status = ?", venueID, repository.BookingStatusConfirmed).
		Limit(100).
		Find(&confirmedBookings)

	ebCount := 0
	for _, b := range confirmedBookings {
		if ebCount >= 200 {
			break
		}
		eqCount := 1 + rng.Intn(3)
		for j := 0; j < eqCount && ebCount < 200; j++ {
			eq := equipments[rng.Intn(len(equipments))]
			eb := repository.EquipmentBooking{
				EquipmentID: eq.ID,
				BookingID:   b.ID,
				StartTime:   b.StartTime,
				EndTime:     b.EndTime,
				Status:      repository.BookingStatusConfirmed,
			}
			db.Create(&eb)
			ebCount++
		}
	}
}

func TestCheckConflict(t *testing.T) {
	db := setupTestDB(t)
	service := NewScheduleService(db)
	baseTime := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	venueID := uint(1)
	seedTestData(db, venueID, baseTime)

	t.Run("无冲突检测", func(t *testing.T) {
		startTime := baseTime.AddDate(0, 0, 31).Add(10 * time.Hour)
		endTime := startTime.Add(2 * time.Hour)

		conflicts, err := service.CheckConflict(db, venueID, startTime, endTime)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(conflicts) != 0 {
			t.Errorf("expected 0 conflicts, got %d", len(conflicts))
		}
	})

	t.Run("排期档期冲突检测", func(t *testing.T) {
		var pendingBooking repository.Booking
		db.Where("venue_id = ? AND status = ?", venueID, repository.BookingStatusPending).
			First(&pendingBooking)
		if pendingBooking.ID == 0 {
			t.Skip("no pending booking found for test")
		}

		conflicts, err := service.CheckConflict(db, venueID, pendingBooking.StartTime, pendingBooking.EndTime)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(conflicts) == 0 {
			t.Error("expected booking conflicts, got 0")
		}

		found := false
		for _, c := range conflicts {
			if c.ID == pendingBooking.ID {
				found = true
				break
			}
		}
		if !found {
			t.Error("expected pending booking to be in conflicts")
		}
	})

	t.Run("场馆维护冲突检测", func(t *testing.T) {
		var maintenanceBooking repository.Booking
		db.Where("venue_id = ? AND status = ?", venueID, repository.BookingStatusMaintenance).
			First(&maintenanceBooking)
		if maintenanceBooking.ID == 0 {
			t.Skip("no maintenance booking found for test")
		}

		conflicts, err := service.CheckConflict(db, venueID, maintenanceBooking.StartTime, maintenanceBooking.EndTime)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		found := false
		for _, c := range conflicts {
			if c.ID == maintenanceBooking.ID && (c.Status == repository.BookingStatusMaintenance || c.Type == repository.BookingTypeMaintenance) {
				found = true
				break
			}
		}
		if !found {
			t.Error("expected maintenance booking to be in conflicts")
		}
	})

	t.Run("设备占用冲突检测", func(t *testing.T) {
		var eb repository.EquipmentBooking
		var relatedBooking repository.Booking
		db.Joins("JOIN bookings ON bookings.id = equipment_bookings.booking_id").
			Where("bookings.venue_id = ?", venueID).
			First(&eb)
		if eb.ID == 0 {
			t.Skip("no equipment booking found for test")
		}
		db.First(&relatedBooking, eb.BookingID)

		var existingRegular []repository.Booking
		db.Where("venue_id = ? AND id = ? AND status IN ?", venueID, relatedBooking.ID,
			[]repository.BookingStatus{repository.BookingStatusPending, repository.BookingStatusConfirmed}).
			Find(&existingRegular)

		conflicts, err := service.CheckConflict(db, venueID, eb.StartTime, eb.EndTime)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(existingRegular) == 0 {
			found := false
			for _, c := range conflicts {
				if c.ID == relatedBooking.ID {
					found = true
					break
				}
			}
			if !found {
				t.Error("expected equipment-related booking to be in conflicts")
			}
		}
	})

	t.Run("排除指定bookingID", func(t *testing.T) {
		var confirmedBooking repository.Booking
		db.Where("venue_id = ? AND status = ?", venueID, repository.BookingStatusConfirmed).
			First(&confirmedBooking)
		if confirmedBooking.ID == 0 {
			t.Skip("no confirmed booking found for test")
		}

		conflicts, err := service.CheckConflict(db, venueID, confirmedBooking.StartTime, confirmedBooking.EndTime, confirmedBooking.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, c := range conflicts {
			if c.ID == confirmedBooking.ID {
				t.Error("excluded booking should not appear in conflicts")
			}
		}
	})

	t.Run("已取消档期不产生冲突", func(t *testing.T) {
		var cancelledBooking repository.Booking
		db.Where("venue_id = ? AND status = ?", venueID, repository.BookingStatusCancelled).
			First(&cancelledBooking)
		if cancelledBooking.ID == 0 {
			t.Skip("no cancelled booking found for test")
		}

		conflicts, err := service.CheckConflict(db, venueID, cancelledBooking.StartTime, cancelledBooking.EndTime)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, c := range conflicts {
			if c.ID == cancelledBooking.ID {
				t.Error("cancelled booking should not appear in conflicts")
			}
		}
	})
}

func BenchmarkCheckConflict(b *testing.B) {
	t := &testing.T{}
	db := setupTestDB(t)
	if t.Failed() {
		b.Fatal("failed to setup test DB")
	}
	service := NewScheduleService(db)
	baseTime := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	venueID := uint(1)
	seedTestData(db, venueID, baseTime)

	rng := rand.New(rand.NewSource(12345))
	testCases := make([]struct {
		start time.Time
		end   time.Time
	}, b.N)

	for i := 0; i < b.N; i++ {
		dayOffset := rng.Intn(35)
		hour := 9 + rng.Intn(12)
		duration := 1 + rng.Intn(4)
		start := baseTime.AddDate(0, 0, dayOffset).Add(time.Duration(hour) * time.Hour)
		end := start.Add(time.Duration(duration) * time.Hour)
		testCases[i] = struct {
			start time.Time
			end   time.Time
		}{start, end}
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := service.CheckConflict(db, venueID, testCases[i].start, testCases[i].end)
		if err != nil {
			b.Fatalf("unexpected error in benchmark: %v", err)
		}
	}
}
