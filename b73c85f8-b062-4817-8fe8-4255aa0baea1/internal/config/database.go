package config

import (
	"fmt"
	"gas-network-system/internal/model"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg *DatabaseConfig, log *zap.Logger) (*gorm.DB, error) {
	dbDir := filepath.Dir(cfg.Path)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据库目录失败: %w", err)
	}

	dsn := fmt.Sprintf("%s?_journal=%s&_busy_timeout=%d&_mode=%s",
		cfg.Path, cfg.JournalMode, cfg.BusyTimeout, cfg.Mode)

	newLogger := logger.New(
		zap.NewStdLog(log),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取数据库连接失败: %w", err)
	}

	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(1 * time.Hour)

	if err := autoMigrate(db); err != nil {
		return nil, fmt.Errorf("数据库迁移失败: %w", err)
	}

	log.Info("数据库初始化成功", zap.String("path", cfg.Path))

	return db, nil
}

func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.Pipeline{},
		&model.GateStation{},
		&model.PressureRegulatingStation{},
		&model.ValveWell{},
		&model.Inspector{},
		&model.InspectionTask{},
		&model.RepairTeam{},
		&model.Alarm{},
		&model.RepairOrder{},
		&model.ValveOperation{},
		&model.Hazard{},
		&model.PressureData{},
		&model.PressureDailyStats{},
		&model.InspectionTrack{},
		&model.OperationLog{},
		&model.User{},
	)
}

func InitLogger(cfg *LogConfig) (*zap.Logger, error) {
	logDir := filepath.Dir(cfg.FilePath)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, fmt.Errorf("创建日志目录失败: %w", err)
	}

	zapConfig := zap.NewProductionConfig()
	zapConfig.OutputPaths = []string{"stdout", cfg.FilePath}
	zapConfig.ErrorOutputPaths = []string{"stderr", cfg.FilePath}

	level, err := zap.ParseAtomicLevel(cfg.Level)
	if err != nil {
		level = zap.NewAtomicLevelAt(zap.InfoLevel)
	}
	zapConfig.Level = level

	logger, err := zapConfig.Build()
	if err != nil {
		return nil, fmt.Errorf("创建日志失败: %w", err)
	}

	zap.ReplaceGlobals(logger)

	return logger, nil
}
