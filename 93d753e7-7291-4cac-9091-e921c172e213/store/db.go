package store

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"travel-monitor/config"
	"travel-monitor/models"
)

var (
	dbInstance *gorm.DB
	dbOnce     sync.Once
)

func InitDB() (*gorm.DB, error) {
	var initErr error
	dbOnce.Do(func() {
		cfg := config.Get()
		dbPath := cfg.Database.Path

		dbDir := filepath.Dir(dbPath)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			initErr = fmt.Errorf("创建数据库目录失败: %w", err)
			return
		}

		db, err := gorm.Open(sqlite.Open(dbPath+"?_journal_mode=WAL&_busy_timeout=5000"), &gorm.Config{
			Logger:      logger.Default.LogMode(logger.Warn),
			PrepareStmt: true,
		})
		if err != nil {
			initErr = fmt.Errorf("打开数据库失败: %w", err)
			return
		}

		sqlDB, err := db.DB()
		if err != nil {
			initErr = fmt.Errorf("获取SQL数据库实例失败: %w", err)
			return
		}

		sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
		sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
		sqlDB.SetConnMaxLifetime(time.Hour)

		if err := migrateDB(db); err != nil {
			initErr = fmt.Errorf("数据库迁移失败: %w", err)
			return
		}

		if err := initDefaultData(db); err != nil {
			initErr = fmt.Errorf("初始化默认数据失败: %w", err)
			return
		}

		dbInstance = db
	})

	if initErr != nil {
		return nil, initErr
	}
	return dbInstance, nil
}

func GetDB() *gorm.DB {
	if dbInstance == nil {
		_, _ = InitDB()
	}
	return dbInstance
}

func migrateDB(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.FlightPrice{},
		&models.FlightPriceHistory{},
		&models.HotelPrice{},
		&models.HotelPriceHistory{},
		&models.PricePrediction{},
		&models.DepartmentBudget{},
		&models.BookingRecord{},
		&models.TaskLog{},
		&models.AlertRule{},
		&models.AlertRecord{},
		&models.ReconcileRecord{},
	)
}

func initDefaultData(db *gorm.DB) error {
	cfg := config.Get()
	now := time.Now()
	currentMonth := now.Format("2006-01")

	for _, dept := range cfg.Budget.Departments {
		var existing models.DepartmentBudget
		result := db.Where("department = ? AND month = ?", dept.Name, currentMonth).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			budget := models.DepartmentBudget{
				Department:      dept.Name,
				Month:           currentMonth,
				TotalBudget:     dept.MonthlyBudget,
				RemainingAmount: dept.MonthlyBudget,
			}
			if err := db.Create(&budget).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func SaveFlightPrices(prices []models.FlightPrice) error {
	if len(prices) == 0 {
		return nil
	}

	db := GetDB()
	return db.Transaction(func(tx *gorm.DB) error {
		for _, price := range prices {
			if price.QueryKey == "" {
				price.QueryKey = price.GenerateQueryKey()
			}

			var existing models.FlightPrice
			result := tx.Where(
				"platform = ? AND flight_no = ? AND depart_time = ? AND cabin_class = ?",
				price.Platform, price.FlightNo, price.DepartTime, price.CabinClass,
			).Order("created_at DESC").First(&existing)

			if result.Error == nil {
				if existing.Price != price.Price {
					price.IsLowest = false
					if err := tx.Create(&price).Error; err != nil {
						return err
					}
				}
			} else if result.Error == gorm.ErrRecordNotFound {
				if err := tx.Create(&price).Error; err != nil {
					return err
				}
			} else {
				return result.Error
			}
		}
		return nil
	})
}

func SaveHotelPrices(prices []models.HotelPrice) error {
	if len(prices) == 0 {
		return nil
	}

	db := GetDB()
	return db.Transaction(func(tx *gorm.DB) error {
		for _, price := range prices {
			if price.QueryKey == "" {
				price.QueryKey = price.GenerateQueryKey()
			}

			var existing models.HotelPrice
			result := tx.Where(
				"platform = ? AND hotel_id = ? AND room_type_id = ? AND check_in_date = ?",
				price.Platform, price.HotelID, price.RoomTypeID, price.CheckInDate,
			).Order("created_at DESC").First(&existing)

			if result.Error == nil {
				if existing.Price != price.Price {
					price.IsLowest = false
					if err := tx.Create(&price).Error; err != nil {
						return err
					}
				}
			} else if result.Error == gorm.ErrRecordNotFound {
				if err := tx.Create(&price).Error; err != nil {
					return err
				}
			} else {
				return result.Error
			}
		}
		return nil
	})
}

func UpdateLowestPrices(queryKey string, itemType string) error {
	db := GetDB()
	if itemType == "flight" || itemType == "" {
		if err := db.Model(&models.FlightPrice{}).
			Where("query_key = ?", queryKey).
			Update("is_lowest", false).Error; err != nil {
			return err
		}

		type Result struct {
			ID    uint
			Price float64
		}
		var results []Result
		db.Raw(`
			SELECT fp1.id, fp1.price
			FROM flight_prices fp1
			WHERE fp1.query_key = ? AND fp1.price = (
				SELECT MIN(fp2.price)
				FROM flight_prices fp2
				WHERE fp2.query_key = fp1.query_key
				AND fp2.depart_time = fp1.depart_time
				AND fp2.cabin_class = fp1.cabin_class
			)
		`, queryKey).Scan(&results)

		for _, r := range results {
			db.Model(&models.FlightPrice{}).Where("id = ?", r.ID).Update("is_lowest", true)
		}
	}

	if itemType == "hotel" || itemType == "" {
		if err := db.Model(&models.HotelPrice{}).
			Where("query_key = ?", queryKey).
			Update("is_lowest", false).Error; err != nil {
			return err
		}

		type Result struct {
			ID    uint
			Price float64
		}
		var results []Result
		db.Raw(`
			SELECT hp1.id, hp1.price
			FROM hotel_prices hp1
			WHERE hp1.query_key = ? AND hp1.price = (
				SELECT MIN(hp2.price)
				FROM hotel_prices hp2
				WHERE hp2.query_key = hp1.query_key
				AND hp2.hotel_id = hp1.hotel_id
				AND hp2.room_type_id = hp1.room_type_id
			)
		`, queryKey).Scan(&results)

		for _, r := range results {
			db.Model(&models.HotelPrice{}).Where("id = ?", r.ID).Update("is_lowest", true)
		}
	}
	return nil
}

func GetFlightPriceHistory(queryKey string, days int) ([]models.FlightPrice, error) {
	db := GetDB()
	var prices []models.FlightPrice
	since := time.Now().AddDate(0, 0, -days)
	err := db.Where("query_key = ? AND created_at >= ?", queryKey, since).
		Order("created_at ASC").Find(&prices).Error
	return prices, err
}

func GetHotelPriceHistory(queryKey string, days int) ([]models.HotelPrice, error) {
	db := GetDB()
	var prices []models.HotelPrice
	since := time.Now().AddDate(0, 0, -days)
	err := db.Where("query_key = ? AND created_at >= ?", queryKey, since).
		Order("created_at ASC").Find(&prices).Error
	return prices, err
}

func GetFlightComparison(queryKey string) ([]models.PriceComparison, error) {
	db := GetDB()
	var prices []models.FlightPrice
	err := db.Where("query_key = ?", queryKey).
		Order("depart_time ASC, price ASC").Find(&prices).Error
	if err != nil {
		return nil, err
	}

	comparisonMap := make(map[string]*models.PriceComparison)
	for _, p := range prices {
		key := p.GetDedupKey()
		if comp, ok := comparisonMap[key]; ok {
			comp.PlatformPrices[p.Platform] = p.Price
		} else {
			comparisonMap[key] = &models.PriceComparison{
				QueryKey:       queryKey,
				FlightKey:      key,
				FlightNo:       p.FlightNo,
				FromCity:       p.FromCity,
				ToCity:         p.ToCity,
				DepartTime:     p.DepartTime,
				PlatformPrices: map[string]float64{p.Platform: p.Price},
			}
		}
	}

	result := make([]models.PriceComparison, 0, len(comparisonMap))
	for _, comp := range comparisonMap {
		comp.CalculateDiff()
		result = append(result, *comp)
	}
	return result, nil
}

func GetHotelComparison(queryKey string) ([]models.HotelComparison, error) {
	db := GetDB()
	var prices []models.HotelPrice
	err := db.Where("query_key = ?", queryKey).
		Order("price ASC").Find(&prices).Error
	if err != nil {
		return nil, err
	}

	comparisonMap := make(map[string]*models.HotelComparison)
	for _, p := range prices {
		key := p.GetDedupKey()
		if comp, ok := comparisonMap[key]; ok {
			comp.PlatformPrices[p.Platform] = p.Price
		} else {
			comparisonMap[key] = &models.HotelComparison{
				QueryKey:       queryKey,
				HotelDedupKey:  key,
				HotelName:      p.HotelName,
				City:           p.City,
				RoomTypeName:   p.RoomTypeName,
				CheckInDate:    p.CheckInDate,
				CheckOutDate:   p.CheckOutDate,
				PlatformPrices: map[string]float64{p.Platform: p.Price},
			}
		}
	}

	result := make([]models.HotelComparison, 0, len(comparisonMap))
	for _, comp := range comparisonMap {
		comp.CalculateDiff()
		result = append(result, *comp)
	}
	return result, nil
}

func CreateTaskLog(log *models.TaskLog) error {
	db := GetDB()
	return db.Create(log).Error
}

func UpdateTaskLog(id uint, updates map[string]interface{}) error {
	db := GetDB()
	return db.Model(&models.TaskLog{}).Where("id = ?", id).Updates(updates).Error
}

func GetBudgets(month string) ([]models.DepartmentBudget, error) {
	db := GetDB()
	var budgets []models.DepartmentBudget
	if month == "" {
		month = time.Now().Format("2006-01")
	}
	err := db.Where("month = ?", month).Find(&budgets).Error
	return budgets, err
}

func UpdateBudgetUsed(department string, month string, amount float64) error {
	db := GetDB()
	return db.Transaction(func(tx *gorm.DB) error {
		var budget models.DepartmentBudget
		if err := tx.Where("department = ? AND month = ?", department, month).
			First(&budget).Error; err != nil {
			return err
		}

		budget.UsedAmount += amount
		budget.RemainingAmount = budget.TotalBudget - budget.UsedAmount - budget.ReservedAmount
		if budget.TotalBudget > 0 {
			budget.UsagePercent = (budget.UsedAmount / budget.TotalBudget) * 100
		}

		return tx.Save(&budget).Error
	})
}

func CreateAlertRecord(record *models.AlertRecord) error {
	db := GetDB()
	return db.Create(record).Error
}

func GetUnreadAlerts() ([]models.AlertRecord, error) {
	db := GetDB()
	var alerts []models.AlertRecord
	err := db.Where("is_read = ?", false).Order("created_at DESC").Limit(100).Find(&alerts).Error
	return alerts, err
}

func MarkAlertRead(id uint) error {
	db := GetDB()
	return db.Model(&models.AlertRecord{}).Where("id = ?", id).Update("is_read", true).Error
}

func ArchiveOldData(days int) (int64, error) {
	db := GetDB()
	cutoff := time.Now().AddDate(0, 0, -days)
	var totalDeleted int64

	tables := []string{
		"flight_prices",
		"hotel_prices",
		"task_logs",
	}

	for _, table := range tables {
		result := db.Table(table).Where("created_at < ?", cutoff).Delete(nil)
		if result.Error != nil {
			return totalDeleted, result.Error
		}
		totalDeleted += result.RowsAffected
	}

	return totalDeleted, nil
}

func CreateBookingRecord(record *models.BookingRecord) error {
	db := GetDB()
	return db.Create(record).Error
}

func GetReconcileData(month string) ([]models.BookingRecord, error) {
	db := GetDB()
	var records []models.BookingRecord
	if month == "" {
		month = time.Now().Format("2006-01")
	}
	startDate := month + "-01"
	endDate := time.Now().Format("2006-01-02")
	err := db.Where("travel_date >= ? AND travel_date < ?", startDate, endDate).
		Find(&records).Error
	return records, err
}

func GetTaskLogs(taskType string, limit int) ([]models.TaskLog, error) {
	db := GetDB()
	var logs []models.TaskLog
	query := db.Order("created_at DESC")
	if taskType != "" {
		query = query.Where("task_type = ?", taskType)
	}
	if limit <= 0 {
		limit = 100
	}
	err := query.Limit(limit).Find(&logs).Error
	return logs, err
}
