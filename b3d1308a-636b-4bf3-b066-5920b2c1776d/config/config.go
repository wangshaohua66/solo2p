package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	MySQL    MySQLConfig
	Redis    RedisConfig
	JWT      JWTConfig
	Log      LogConfig
	App      AppConfig
}

type ServerConfig struct {
	Port         int
	Mode         string
	ReadTimeout  int
	WriteTimeout int
}

type MySQLConfig struct {
	Host         string
	Port         int
	User         string
	Password     string
	Database     string
	MaxOpenConns int
	MaxIdleConns int
	MaxLifetime  int
}

type RedisConfig struct {
	Host         string
	Port         int
	Password     string
	DB           int
	PoolSize     int
	MinIdleConns int
}

type JWTConfig struct {
	Secret     string
	ExpireHours int
	Issuer     string
}

type LogConfig struct {
	Level      string
	Filename   string
	MaxSize    int
	MaxBackups int
	MaxAge     int
	Compress   bool
}

type AppConfig struct {
	DeviceScanInterval    int
	EnergyCalcHour        int
	DataRetentionDays     int
	BatchControlSize      int
	CommandTimeoutSeconds int
}

var AppConf *Config

func Load() {
	_ = godotenv.Load()

	AppConf = &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			Mode:         getEnvStr("SERVER_MODE", "production"),
			ReadTimeout:  getEnvInt("SERVER_READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("SERVER_WRITE_TIMEOUT", 30),
		},
		MySQL: MySQLConfig{
			Host:         getEnvStr("MYSQL_HOST", "127.0.0.1"),
			Port:         getEnvInt("MYSQL_PORT", 3306),
			User:         getEnvStr("MYSQL_USER", "root"),
			Password:     getEnvStr("MYSQL_PASSWORD", "root"),
			Database:     getEnvStr("MYSQL_DATABASE", "smart_lighting"),
			MaxOpenConns: getEnvInt("MYSQL_MAX_OPEN_CONNS", 100),
			MaxIdleConns: getEnvInt("MYSQL_MAX_IDLE_CONNS", 20),
			MaxLifetime:  getEnvInt("MYSQL_MAX_LIFETIME", 3600),
		},
		Redis: RedisConfig{
			Host:         getEnvStr("REDIS_HOST", "127.0.0.1"),
			Port:         getEnvInt("REDIS_PORT", 6379),
			Password:     getEnvStr("REDIS_PASSWORD", ""),
			DB:           getEnvInt("REDIS_DB", 0),
			PoolSize:     getEnvInt("REDIS_POOL_SIZE", 50),
			MinIdleConns: getEnvInt("REDIS_MIN_IDLE", 10),
		},
		JWT: JWTConfig{
			Secret:      getEnvStr("JWT_SECRET", "smart-lighting-jwt-secret-key-2024"),
			ExpireHours: getEnvInt("JWT_EXPIRE_HOURS", 12),
			Issuer:      getEnvStr("JWT_ISSUER", "smart-lighting-api"),
		},
		Log: LogConfig{
			Level:      getEnvStr("LOG_LEVEL", "info"),
			Filename:   getEnvStr("LOG_FILENAME", "./logs/app.log"),
			MaxSize:    getEnvInt("LOG_MAX_SIZE", 100),
			MaxBackups: getEnvInt("LOG_MAX_BACKUPS", 30),
			MaxAge:     getEnvInt("LOG_MAX_AGE", 30),
			Compress:   getEnvBool("LOG_COMPRESS", true),
		},
		App: AppConfig{
			DeviceScanInterval:    getEnvInt("APP_DEVICE_SCAN_INTERVAL", 5),
			EnergyCalcHour:        getEnvInt("APP_ENERGY_CALC_HOUR", 2),
			DataRetentionDays:     getEnvInt("APP_DATA_RETENTION_DAYS", 180),
			BatchControlSize:      getEnvInt("APP_BATCH_CONTROL_SIZE", 5000),
			CommandTimeoutSeconds: getEnvInt("APP_COMMAND_TIMEOUT", 60),
		},
	}

	log.Println("[Config] Configuration loaded successfully")
}

func getEnvStr(key, defaultValue string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if v, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if v, ok := os.LookupEnv(key); ok {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return defaultValue
}
