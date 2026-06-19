package repository

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"port-ops-system/internal/model"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository() (*Repository, error) {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslmode := os.Getenv("DB_SSLMODE")

	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "5432"
	}
	if user == "" {
		user = "postgres"
	}
	if password == "" {
		password = "postgres"
	}
	if dbname == "" {
		dbname = "port_ops"
	}
	if sslmode == "" {
		sslmode = "disable"
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	gormLogger := logger.Default.LogMode(logger.Info)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v", err)
		log.Println("Continuing with nil database connection for API structure validation")
		return &Repository{db: nil}, nil
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
	}

	maxOpenConns := 100
	if s := os.Getenv("DB_MAX_OPEN_CONNS"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			maxOpenConns = v
		}
	}
	maxIdleConns := 20
	if s := os.Getenv("DB_MAX_IDLE_CONNS"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			maxIdleConns = v
		}
	}

	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := autoMigrate(db); err != nil {
		log.Printf("Warning: Auto migration failed: %v", err)
	}

	log.Println("Database connected successfully")
	return &Repository{db: db}, nil
}

func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.Container{},
		&model.Yard{},
		&model.YardSlot{},
		&model.Berth{},
		&model.QuayCrane{},
		&model.Vessel{},
		&model.VesselCall{},
		&model.BerthPlan{},
		&model.CraneAssignment{},
		&model.ReeferContainer{},
		&model.TemperatureReading{},
		&model.TemperatureAlert{},
		&model.AlertWorkOrder{},
		&model.AlertNotification{},
		&model.TruckAppointment{},
		&model.Gate{},
		&model.GateSlotConfig{},
		&model.Blacklist{},
		&model.GatePassRecord{},
		&model.DangerousGoods{},
		&model.CustomsDeclaration{},
		&model.InspectionRecord{},
		&model.CustomsSyncLog{},
		&model.StorageRate{},
		&model.StorageBill{},
		&model.Invoice{},
		&model.Payment{},
	)
}

func (r *Repository) DB() *gorm.DB {
	return r.db
}

func (r *Repository) IsConnected() bool {
	return r.db != nil
}
