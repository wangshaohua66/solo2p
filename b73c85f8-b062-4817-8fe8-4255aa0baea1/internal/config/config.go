package config

import (
	"time"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Log      LogConfig      `yaml:"log"`
	Alarm    AlarmConfig    `yaml:"alarm"`
	Pressure PressureConfig `yaml:"pressure"`
	Inspect  InspectConfig  `yaml:"inspect"`
}

type ServerConfig struct {
	Host         string        `yaml:"host"`
	Port         int           `yaml:"port"`
	ReadTimeout  time.Duration `yaml:"read_timeout"`
	WriteTimeout time.Duration `yaml:"write_timeout"`
}

type DatabaseConfig struct {
	Path       string `yaml:"path"`
	Mode       string `yaml:"mode"`
	JournalMode string `yaml:"journal_mode"`
	BusyTimeout int    `yaml:"busy_timeout"`
}

type LogConfig struct {
	Level    string `yaml:"level"`
	FilePath string `yaml:"file_path"`
	MaxSize  int    `yaml:"max_size"`
	MaxAge   int    `yaml:"max_age"`
}

type AlarmConfig struct {
	DispatchTimeout    int     `yaml:"dispatch_timeout"`
	DistanceWeight     float64 `yaml:"distance_weight"`
	WorkloadWeight     float64 `yaml:"workload_weight"`
	VolatilityThreshold float64 `yaml:"volatility_threshold"`
}

type PressureConfig struct {
	DataRetentionDays int `yaml:"data_retention_days"`
	ArchiveBatchSize  int `yaml:"archive_batch_size"`
}

type InspectConfig struct {
	AcceptTimeoutHours   int     `yaml:"accept_timeout_hours"`
	MaxDeviationMeters   float64 `yaml:"max_deviation_meters"`
	HazardMajorDeadlineHours int `yaml:"hazard_major_deadline_hours"`
}

func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Host:         "0.0.0.0",
			Port:         8080,
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 30 * time.Second,
		},
		Database: DatabaseConfig{
			Path:        "./data/gas_system.db",
			Mode:        "rwc",
			JournalMode: "WAL",
			BusyTimeout: 5000,
		},
		Log: LogConfig{
			Level:    "info",
			FilePath: "./logs/app.log",
			MaxSize:  100,
			MaxAge:   30,
		},
		Alarm: AlarmConfig{
			DispatchTimeout:    300,
			DistanceWeight:     0.6,
			WorkloadWeight:     0.4,
			VolatilityThreshold: 0.15,
		},
		Pressure: PressureConfig{
			DataRetentionDays: 180,
			ArchiveBatchSize:  1000,
		},
		Inspect: InspectConfig{
			AcceptTimeoutHours:   2,
			MaxDeviationMeters:   200,
			HazardMajorDeadlineHours: 48,
		},
	}
}
