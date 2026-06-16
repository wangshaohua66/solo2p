package config

import (
	"os"
	"strconv"

	"offshore-wind-ops/internal/model"
)

func Load() *model.Config {
	return &model.Config{
		Server: model.ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			Mode:         getEnv("SERVER_MODE", "debug"),
			ReadTimeout:  getEnvInt("SERVER_READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("SERVER_WRITE_TIMEOUT", 30),
		},
		MongoDB: model.MongoDBConfig{
			URI:            getEnv("MONGODB_URI", "mongodb://localhost:27017"),
			Database:       getEnv("MONGODB_DATABASE", "offshore_wind_ops"),
			MaxPoolSize:    uint64(getEnvInt("MONGODB_MAX_POOL_SIZE", 100)),
			MinPoolSize:    uint64(getEnvInt("MONGODB_MIN_POOL_SIZE", 10)),
			ConnectTimeout: getEnvInt("MONGODB_CONNECT_TIMEOUT", 10),
		},
		JWT: model.JWTConfig{
			Secret:             getEnv("JWT_SECRET", "offshore-wind-ops-secret-key-change-in-production"),
			AccessTokenExpiry:  getEnvInt("JWT_ACCESS_TOKEN_EXPIRY", 2),
			RefreshTokenExpiry: getEnvInt("JWT_REFRESH_TOKEN_EXPIRY", 7),
			Issuer:             getEnv("JWT_ISSUER", "offshore-wind-ops"),
		},
		Weather: model.WeatherConfig{
			APIKey:   getEnv("WEATHER_API_KEY", ""),
			Endpoint: getEnv("WEATHER_API_ENDPOINT", "https://api.open-meteo.com/v1"),
			Timeout:  getEnvInt("WEATHER_API_TIMEOUT", 30),
		},
		RateLimit: model.RateLimitConfig{
			RequestsPerMinute: getEnvInt("RATE_LIMIT_REQUESTS", 600),
			BurstSize:         getEnvInt("RATE_LIMIT_BURST", 100),
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
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
