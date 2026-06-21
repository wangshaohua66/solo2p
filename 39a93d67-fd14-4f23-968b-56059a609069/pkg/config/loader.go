package config

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Database DatabaseConfig `yaml:"database"`
	Log      LogConfig      `yaml:"log"`
	Warning  WarningConfig  `yaml:"warning"`
	App      AppConfig      `yaml:"app"`
}

type DatabaseConfig struct {
	Path     string `yaml:"path"`
	MaxSizeMB int   `yaml:"max_size_mb"`
}

type LogConfig struct {
	Level      string `yaml:"level"`
	Dir        string `yaml:"dir"`
	MaxSizeMB  int    `yaml:"max_size_mb"`
	MaxBackups int    `yaml:"max_backups"`
}

type WarningConfig struct {
	Levels []int `yaml:"levels"`
	Cron   string `yaml:"cron"`
}

type AppConfig struct {
	DefaultDeadlineDays int `yaml:"default_deadline_days"`
	PageSize            int `yaml:"page_size"`
}

func Default() *Config {
	return &Config{
		Database: DatabaseConfig{
			Path:      "data/eco_inspector.db",
			MaxSizeMB: 500,
		},
		Log: LogConfig{
			Level:      "info",
			Dir:        "logs",
			MaxSizeMB:  50,
			MaxBackups: 30,
		},
		Warning: WarningConfig{
			Levels: []int{7, 3, 1},
			Cron:   "0 8 * * *",
		},
		App: AppConfig{
			DefaultDeadlineDays: 30,
			PageSize:            20,
		},
	}
}

func Load(path string) (*Config, error) {
	cfg := Default()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, fmt.Errorf("read config file: %w", err)
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config file: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validate config: %w", err)
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.Database.Path == "" {
		return fmt.Errorf("database path is required")
	}
	if c.Database.MaxSizeMB <= 0 {
		return fmt.Errorf("database max_size_mb must be positive")
	}
	if c.Log.Level == "" {
		return fmt.Errorf("log level is required")
	}
	validLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
	if !validLevels[strings.ToLower(c.Log.Level)] {
		return fmt.Errorf("invalid log level: %s", c.Log.Level)
	}
	if c.Log.MaxSizeMB <= 0 {
		return fmt.Errorf("log max_size_mb must be positive")
	}
	if len(c.Warning.Levels) == 0 {
		return fmt.Errorf("at least one warning level is required")
	}
	if c.App.PageSize <= 0 {
		return fmt.Errorf("page_size must be positive")
	}
	return nil
}

func (c *Config) Save(path string) error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write config file: %w", err)
	}
	return nil
}
