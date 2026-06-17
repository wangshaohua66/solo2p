package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
}

type ServerConfig struct {
	Port         int
	ReadTimeout  int
	WriteTimeout int
	RateLimit    int
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type JWTConfig struct {
	Secret     string
	ExpireHours int
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:  getEnvInt("SERVER_READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("SERVER_WRITE_TIMEOUT", 30),
			RateLimit:    getEnvInt("SERVER_RATE_LIMIT", 100),
		},
		Database: DatabaseConfig{
			Host:     getEnvStr("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			User:     getEnvStr("DB_USER", "postgres"),
			Password: getEnvStr("DB_PASSWORD", "postgres"),
			DBName:   getEnvStr("DB_NAME", "lab_management"),
			SSLMode:  getEnvStr("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnvStr("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnvStr("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		JWT: JWTConfig{
			Secret:      getEnvStr("JWT_SECRET", "lab-management-secret-key-2024"),
			ExpireHours: getEnvInt("JWT_EXPIRE_HOURS", 24),
		},
	}
}

func getEnvStr(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if v, err := strconv.Atoi(value); err == nil {
			return v
		}
	}
	return defaultValue
}
