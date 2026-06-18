package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type StorageType string

const (
	StorageTypeS3  StorageType = "s3"
	StorageTypeOSS StorageType = "oss"
	StorageTypeGCS StorageType = "gcs"
)

type ConflictStrategy string

const (
	ConflictOverwrite  ConflictStrategy = "overwrite"
	ConflictSkip       ConflictStrategy = "skip"
	ConflictRename     ConflictStrategy = "rename"
)

type ChecksumAlgorithm string

const (
	ChecksumMD5    ChecksumAlgorithm = "md5"
	ChecksumSHA256 ChecksumAlgorithm = "sha256"
)

type LogLevel string

const (
	LogDebug LogLevel = "debug"
	LogInfo  LogLevel = "info"
	LogWarn  LogLevel = "warn"
	LogError LogLevel = "error"
)

type S3Config struct {
	AccessKeyID     string `mapstructure:"access_key_id"`
	SecretAccessKey string `mapstructure:"secret_access_key"`
	Region          string `mapstructure:"region"`
	Bucket          string `mapstructure:"bucket"`
	Endpoint        string `mapstructure:"endpoint"`
	ForcePathStyle  bool   `mapstructure:"force_path_style"`
}

type OSSConfig struct {
	AccessKeyID     string `mapstructure:"access_key_id"`
	AccessKeySecret string `mapstructure:"access_key_secret"`
	Endpoint        string `mapstructure:"endpoint"`
	Bucket          string `mapstructure:"bucket"`
}

type GCSConfig struct {
	ProjectID      string `mapstructure:"project_id"`
	CredentialsFile string `mapstructure:"credentials_file"`
	Bucket        string `mapstructure:"bucket"`
}

type StorageConfig struct {
	Type     StorageType `mapstructure:"type"`
	Prefix   string      `mapstructure:"prefix"`
	S3       S3Config     `mapstructure:"s3,omitempty"`
	OSS      OSSConfig    `mapstructure:"oss,omitempty"`
	GCS      GCSConfig    `mapstructure:"gcs,omitempty"`
}

type SyncConfig struct {
	Concurrency       int               `mapstructure:"concurrency"`
	RetryCount      int               `mapstructure:"retry_count"`
	RetryInterval   time.Duration     `mapstructure:"retry_interval"`
	Timeout         time.Duration     `mapstructure:"timeout"`
	ChunkSize       int64             `mapstructure:"chunk_size"`
	IncludePatterns []string          `mapstructure:"include_patterns"`
	ExcludePatterns []string          `mapstructure:"exclude_patterns"`
	DeleteMissing   bool              `mapstructure:"delete_missing"`
	SyncMode        string            `mapstructure:"sync_mode"`
	TimeFilterStart *time.Time        `mapstructure:"time_filter_start,omitempty"`
	TimeFilterEnd   *time.Time        `mapstructure:"time_filter_end,omitempty"`
}

type ChecksumConfig struct {
	Algorithm   ChecksumAlgorithm `mapstructure:"algorithm"`
	VerifyAfterSync bool               `mapstructure:"verify_after_sync"`
}

type ConflictConfig struct {
	Strategy       ConflictStrategy `mapstructure:"strategy"`
	ConflictDir    string           `mapstructure:"conflict_dir"`
	KeepBackup     bool             `mapstructure:"keep_backup"`
}

type ProgressConfig struct {
	DBPath          string `mapstructure:"db_path"`
	MaxDBSizeMB     int64  `mapstructure:"max_db_size_mb"`
}

type LoggerConfig struct {
	Level       LogLevel `mapstructure:"level"`
	LogDir      string   `mapstructure:"log_dir"`
	MaxSizeMB   int      `mapstructure:"max_size_mb"`
	MaxBackups  int      `mapstructure:"max_backups"`
	MaxAgeDays  int      `mapstructure:"max_age_days"`
	Compress    bool     `mapstructure:"compress"`
}

type EmailConfig struct {
	Enabled      bool     `mapstructure:"enabled"`
	SMTPHost    string   `mapstructure:"smtp_host"`
	SMTPPort    int      `mapstructure:"smtp_port"`
	Username    string   `mapstructure:"username"`
	Password    string   `mapstructure:"password"`
	FromAddress string   `mapstructure:"from_address"`
	ToAddresses []string `mapstructure:"to_addresses"`
	UseTLS      bool     `mapstructure:"use_tls"`
}

type ReportConfig struct {
	OutputDir    string   `mapstructure:"output_dir"`
	Formats      []string `mapstructure:"formats"`
	Detailed     bool     `mapstructure:"detailed"`
	Email        EmailConfig `mapstructure:"email"`
}

type Config struct {
	Env        string         `mapstructure:"env"`
	Source     StorageConfig `mapstructure:"source"`
	Target     StorageConfig `mapstructure:"target"`
	Sync       SyncConfig    `mapstructure:"sync"`
	Checksum   ChecksumConfig `mapstructure:"checksum"`
	Conflict   ConflictConfig `mapstructure:"conflict"`
	Progress   ProgressConfig `mapstructure:"progress"`
	Logger     LoggerConfig `mapstructure:"logger"`
	Report     ReportConfig `mapstructure:"report"`

	configPath string
}

func (c *Config) Validate() error {
	if err := c.validateStorage(&c.Source, "source"); err != nil {
		return err
	}
	if err := c.validateStorage(&c.Target, "target"); err != nil {
		return err
	}
	if c.Sync.Concurrency <= 0 || c.Sync.Concurrency > 1000 {
		return fmt.Errorf("sync.concurrency must be between 1 and 1000")
	}
	if c.Sync.RetryCount < 0 || c.Sync.RetryCount > 10 {
		return fmt.Errorf("sync.retry_count must be between 0 and 10")
	}
	if c.Checksum.Algorithm != ChecksumMD5 && c.Checksum.Algorithm != ChecksumSHA256 {
		return fmt.Errorf("checksum.algorithm must be md5 or sha256")
	}
	if c.Conflict.Strategy != ConflictOverwrite &&
		c.Conflict.Strategy != ConflictSkip &&
		c.Conflict.Strategy != ConflictRename {
		return fmt.Errorf("conflict.strategy must be overwrite, skip or rename")
	}
	return nil
}

func (c *Config) validateStorage(s *StorageConfig, name string) error {
	switch s.Type {
	case StorageTypeS3:
		if s.S3.Bucket == "" {
			return fmt.Errorf("%s.s3.bucket is required", name)
		}
		if s.S3.Region == "" {
			return fmt.Errorf("%s.s3.region is required", name)
		}
	case StorageTypeOSS:
		if s.OSS.Bucket == "" {
			return fmt.Errorf("%s.oss.bucket is required", name)
		}
		if s.OSS.Endpoint == "" {
			return fmt.Errorf("%s.oss.endpoint is required", name)
		}
	case StorageTypeGCS:
		if s.GCS.Bucket == "" {
			return fmt.Errorf("%s.gcs.bucket is required", name)
		}
	default:
		return fmt.Errorf("%s.type must be s3, oss or gcs", name)
	}
	return nil
}

func (c *Config) GetConfigPath() string {
	return c.configPath
}

func DefaultConfig() *Config {
	return &Config{
		Env: "development",
		Source: StorageConfig{
			Type: StorageTypeS3,
		},
		Target: StorageConfig{
			Type: StorageTypeOSS,
		},
		Sync: SyncConfig{
			Concurrency:     100,
			RetryCount:      3,
			RetryInterval:   2 * time.Second,
			Timeout:         30 * time.Minute,
			ChunkSize:       8 * 1024 * 1024,
			IncludePatterns: []string{"*"},
			ExcludePatterns: []string{},
			DeleteMissing:   false,
			SyncMode:        "incremental",
		},
		Checksum: ChecksumConfig{
			Algorithm:   ChecksumMD5,
			VerifyAfterSync: true,
		},
		Conflict: ConflictConfig{
			Strategy:    ConflictOverwrite,
			ConflictDir: "./conflicts",
			KeepBackup:  true,
		},
		Progress: ProgressConfig{
			DBPath:      "./progress.db",
			MaxDBSizeMB: 500,
		},
		Logger: LoggerConfig{
			Level:      LogInfo,
			LogDir:     "./logs",
			MaxSizeMB:  100,
			MaxBackups: 30,
			MaxAgeDays: 90,
			Compress:   true,
		},
		Report: ReportConfig{
			OutputDir: "./reports",
			Formats:   []string{"json"},
			Detailed:  true,
		},
	}
}

func Load(configPath string, env string) (*Config, error) {
	cfg := DefaultConfig()
	cfg.configPath = configPath

	v := viper.New()
	v.SetConfigType("yaml")

	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		v.SetConfigName("config")
		v.AddConfigPath(".")
		v.AddConfigPath("./configs")
		v.AddConfigPath("$HOME/.cloudsync")
	}

	if env != "" {
		cfg.Env = env
	}

	v.SetEnvPrefix("CLOUDSYNC")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	applyEnvOverrides(cfg)

	if err := os.MkdirAll(cfg.Logger.LogDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create log dir: %w", err)
	}
	if err := os.MkdirAll(cfg.Report.OutputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create report dir: %w", err)
	}
	if cfg.Conflict.ConflictDir != "" {
		if err := os.MkdirAll(cfg.Conflict.ConflictDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create conflict dir: %w", err)
		}
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

func applyEnvOverrides(cfg *Config) {
	if v := os.Getenv("CLOUDSYNC_ENV"); v != "" {
		cfg.Env = v
	}
	if v := os.Getenv("CLOUDSYNC_SOURCE_TYPE"); v != "" {
		cfg.Source.Type = StorageType(v)
	}
	if v := os.Getenv("CLOUDSYNC_TARGET_TYPE"); v != "" {
		cfg.Target.Type = StorageType(v)
	}
	if v := os.Getenv("CLOUDSYNC_SYNC_CONCURRENCY"); v != "" {
		var n int
		if _, err := fmt.Sscanf(v, "%d", &n); err == nil {
			cfg.Sync.Concurrency = n
		}
	}
	if v := os.Getenv("CLOUDSYNC_LOGGER_LEVEL"); v != "" {
		cfg.Logger.Level = LogLevel(v)
	}
}

func Save(cfg *Config, path string) error {
	if path == "" {
		path = cfg.configPath
	}
	if path == "" {
		path = "./configs/config.yaml"
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config dir: %w", err)
	}
	v := viper.New()
	v.SetConfigType("yaml")
	v.Set("env", cfg.Env)
	v.Set("source", cfg.Source)
	v.Set("target", cfg.Target)
	v.Set("sync", cfg.Sync)
	v.Set("checksum", cfg.Checksum)
	v.Set("conflict", cfg.Conflict)
	v.Set("progress", cfg.Progress)
	v.Set("logger", cfg.Logger)
	v.Set("report", cfg.Report)
	return v.WriteConfigAs(path)
}
