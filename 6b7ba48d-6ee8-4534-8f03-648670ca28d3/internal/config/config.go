package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	Scheduler SchedulerConfig
}

type ServerConfig struct {
	Port         int
	ReadTimeout  int
	WriteTimeout int
}

type DatabaseConfig struct {
	Path         string
	MaxOpenConns int
	MaxIdleConns int
	WALEnabled   bool
}

type JWTConfig struct {
	Secret     string
	ExpireHours int
	Issuer     string
}

type SchedulerConfig struct {
	DeviationCheckIntervalSec int
	InventoryCheckIntervalSec int
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnvInt("PORT", 8080),
			ReadTimeout:  getEnvInt("READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("WRITE_TIMEOUT", 30),
		},
		Database: DatabaseConfig{
			Path:         getEnvStr("DB_PATH", "./craftbrew.db"),
			MaxOpenConns: getEnvInt("DB_MAX_OPEN", 100),
			MaxIdleConns: getEnvInt("DB_MAX_IDLE", 25),
			WALEnabled:   getEnvBool("DB_WAL", true),
		},
		JWT: JWTConfig{
			Secret:      getEnvStr("JWT_SECRET", "craftbrew-secret-key-change-in-production"),
			ExpireHours: getEnvInt("JWT_EXPIRE_HOURS", 24),
			Issuer:      getEnvStr("JWT_ISSUER", "craftbrew-tracker"),
		},
		Scheduler: SchedulerConfig{
			DeviationCheckIntervalSec: getEnvInt("DEVIATION_CHECK_SEC", 30),
			InventoryCheckIntervalSec: getEnvInt("INVENTORY_CHECK_SEC", 60),
		},
	}
}

func getEnvStr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}
