package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	JWTSecret      string
	JWTExpireHours int
	ServerPort     string
	MaxUploadSize  int64
	FinanceAPIURL  string
	FinanceAPIKey  string
}

var AppConfig *Config

func Load() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	maxUpload, _ := strconv.ParseInt(getEnv("MAX_UPLOAD_SIZE", "52428800"), 10, 64)
	jwtExpire, _ := strconv.Atoi(getEnv("JWT_EXPIRE_HOURS", "24"))

	AppConfig = &Config{
		DBHost:         getEnv("DB_HOST", "localhost"),
		DBPort:         getEnv("DB_PORT", "5432"),
		DBUser:         getEnv("DB_USER", "postgres"),
		DBPassword:     getEnv("DB_PASSWORD", "postgres"),
		DBName:         getEnv("DB_NAME", "exhibition_center"),
		JWTSecret:      getEnv("JWT_SECRET", "dev-secret-key"),
		JWTExpireHours: jwtExpire,
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		MaxUploadSize:  maxUpload,
		FinanceAPIURL:  getEnv("FINANCE_API_URL", ""),
		FinanceAPIKey:  getEnv("FINANCE_API_KEY", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
