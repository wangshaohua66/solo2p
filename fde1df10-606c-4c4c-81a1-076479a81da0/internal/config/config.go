package config

import (
	"os"
	"strconv"
)

type DBConfig struct {
	DSN     string
	MaxOpen int
	MaxIdle int
}

type ServerConfig struct {
	Port string
	Mode string
}

type JWTConfig struct {
	Secret      string
	ExpireHours int
}

type Config struct {
	DB     DBConfig
	Server ServerConfig
	JWT    JWTConfig
}

func LoadConfig() *Config {
	return &Config{
		DB: DBConfig{
			DSN:     getEnv("DB_DSN", "root:password@tcp(127.0.0.1:3306)/venue_scheduler?charset=utf8mb4&parseTime=True&loc=Local"),
			MaxOpen: getEnvInt("DB_MAX_OPEN", 100),
			MaxIdle: getEnvInt("DB_MAX_IDLE", 10),
		},
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
			Mode: getEnv("SERVER_MODE", "debug"),
		},
		JWT: JWTConfig{
			Secret:      getEnv("JWT_SECRET", "venue-scheduler-secret-key"),
			ExpireHours: getEnvInt("JWT_EXPIRE_HOURS", 24),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
