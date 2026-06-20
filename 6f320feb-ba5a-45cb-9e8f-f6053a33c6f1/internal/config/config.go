package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server        ServerConfig
	Database      DatabaseConfig
	Redis         RedisConfig
	Elasticsearch ElasticsearchConfig
	JWT           JWTConfig
	Log           LogConfig
}

type ServerConfig struct {
	Port         int
	Mode         string
	ReadTimeout  int
	WriteTimeout int
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	Charset  string
	MaxOpen  int
	MaxIdle  int
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
	PoolSize int
}

type ElasticsearchConfig struct {
	Addresses []string
	Username  string
	Password  string
	Index     string
}

type JWTConfig struct {
	Secret     string
	ExpireTime int
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

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			Mode:         getEnvStr("SERVER_MODE", "release"),
			ReadTimeout:  getEnvInt("SERVER_READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("SERVER_WRITE_TIMEOUT", 30),
		},
		Database: DatabaseConfig{
			Host:     getEnvStr("DB_HOST", "127.0.0.1"),
			Port:     getEnvInt("DB_PORT", 3306),
			User:     getEnvStr("DB_USER", "root"),
			Password: getEnvStr("DB_PASSWORD", "root"),
			DBName:   getEnvStr("DB_NAME", "equipment_trading"),
			Charset:  getEnvStr("DB_CHARSET", "utf8mb4"),
			MaxOpen:  getEnvInt("DB_MAX_OPEN", 100),
			MaxIdle:  getEnvInt("DB_MAX_IDLE", 20),
		},
		Redis: RedisConfig{
			Host:     getEnvStr("REDIS_HOST", "127.0.0.1"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnvStr("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
			PoolSize: getEnvInt("REDIS_POOL_SIZE", 50),
		},
		Elasticsearch: ElasticsearchConfig{
			Addresses: []string{getEnvStr("ES_ADDR", "http://127.0.0.1:9200")},
			Username:  getEnvStr("ES_USER", ""),
			Password:  getEnvStr("ES_PASSWORD", ""),
			Index:     getEnvStr("ES_INDEX", "equipment"),
		},
		JWT: JWTConfig{
			Secret:     getEnvStr("JWT_SECRET", "equipment-trading-secret-key-2024"),
			ExpireTime: getEnvInt("JWT_EXPIRE_TIME", 86400),
			Issuer:     getEnvStr("JWT_ISSUER", "equipment-trading-platform"),
		},
		Log: LogConfig{
			Level:      getEnvStr("LOG_LEVEL", "info"),
			Filename:   getEnvStr("LOG_FILENAME", "logs/app.log"),
			MaxSize:    getEnvInt("LOG_MAX_SIZE", 100),
			MaxBackups: getEnvInt("LOG_MAX_BACKUPS", 10),
			MaxAge:     getEnvInt("LOG_MAX_AGE", 30),
			Compress:   getEnvBool("LOG_COMPRESS", true),
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

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if v, err := strconv.ParseBool(value); err == nil {
			return v
		}
	}
	return defaultValue
}
