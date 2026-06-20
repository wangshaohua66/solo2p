package database

import (
	"equipment-trading-platform/internal/config"
	"equipment-trading-platform/internal/model"
	applogger "equipment-trading-platform/pkg/logger"
	"fmt"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(cfg *config.DatabaseConfig) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName, cfg.Charset)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Warn),
	})
	if err != nil {
		return fmt.Errorf("connect mysql failed: %w", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("get sql db failed: %w", err)
	}

	sqlDB.SetMaxOpenConns(cfg.MaxOpen)
	sqlDB.SetMaxIdleConns(cfg.MaxIdle)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := autoMigrate(); err != nil {
		return fmt.Errorf("auto migrate failed: %w", err)
	}

	applogger.Info("mysql initialized successfully")
	return nil
}

func autoMigrate() error {
	return DB.AutoMigrate(
		&model.User{},
		&model.Role{},
		&model.UserRole{},
		&model.Device{},
		&model.DeviceCategory{},
		&model.DeviceMedia{},
		&model.MaintenanceRecord{},
		&model.OwnershipChange{},
		&model.ValuationReport{},
		&model.Transaction{},
		&model.TransactionFund{},
		&model.Dispute{},
		&model.DisputeEvidence{},
		&model.CreditRating{},
		&model.CreditRecord{},
		&model.OperationLog{},
		&model.RegionMarket{},
	)
}

func GetDB() *gorm.DB {
	return DB
}
