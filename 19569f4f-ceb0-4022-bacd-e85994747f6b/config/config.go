package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"credit-monitor/models"

	"github.com/fsnotify/fsnotify"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

type AppConfig struct {
	App struct {
		Name        string        `mapstructure:"name"`
		Environment string        `mapstructure:"environment"`
		LogLevel    string        `mapstructure:"log_level"`
		LogDir      string        `mapstructure:"log_dir"`
		LogRetentionDays int     `mapstructure:"log_retention_days"`
	} `mapstructure:"app"`

	Server struct {
		Host string `mapstructure:"host"`
		Port int    `mapstructure:"port"`
	} `mapstructure:"server"`

	Database struct {
		Type     string `mapstructure:"type"`
		Host     string `mapstructure:"host"`
		Port     int    `mapstructure:"port"`
		User     string `mapstructure:"user"`
		Password string `mapstructure:"password"`
		DBName   string `mapstructure:"dbname"`
		SSLMode  string `mapstructure:"sslmode"`
	} `mapstructure:"database"`

	Pool struct {
		MaxBrowsers    int           `mapstructure:"max_browsers"`
		MaxPages     int           `mapstructure:"max_pages"`
		IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
		TotalMaxConcurrency int `mapstructure:"total_max_concurrency"`
	} `mapstructure:"pool"`

	CAPTCHA struct {
		OCRAPIKey    string `mapstructure:"ocr_api_key"`
		OCRAPIURL    string `mapstructure:"ocr_api_url"`
		MaxRetries   int    `mapstructure:"max_retries"`
	} `mapstructure:"captcha"`

	Alert struct {
		WeChatWebhook string `mapstructure:"wechat_webhook"`
		EmailFrom     string `mapstructure:"email_from"`
		EmailSMTP    string `mapstructure:"email_smtp"`
		EmailPassword string `mapstructure:"email_password"`
	} `mapstructure:"alert"`

	Storage struct {
		DataDir     string `mapstructure:"data_dir"`
		ExportDir   string `mapstructure:"export_dir"`
	} `mapstructure:"storage"`

	Systems    []models.SystemConfig `mapstructure:"systems"`
	FieldMappings map[string][]models.FieldMapping `mapstructure:"field_mappings"`
}

var (
	instance *AppConfig
	once     sync.Once
	mu       sync.RWMutex
	watcher  *fsnotify.Watcher
)

func Load(configPath string) (*AppConfig, error) {
	var err error
	once.Do(func() {
		instance = &AppConfig{}
		err = loadConfig(configPath, instance)
		if err != nil {
			return
		}
		err = setupHotReload(configPath)
	})
	return instance, err
}

func loadConfig(configPath string, cfg *AppConfig) error {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")

	v.AutomaticEnv()
	v.SetEnvPrefix("CM")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	viper.SetDefault("app.name", "credit-monitor")
	viper.SetDefault("app.environment", "production")
	viper.SetDefault("app.log_level", "info")
	viper.SetDefault("app.log_retention_days", 180)
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("pool.max_browsers", 12)
	viper.SetDefault("pool.max_pages", 3)
	viper.SetDefault("pool.total_max_concurrency", 20)
	viper.SetDefault("captcha.max_retries", 3)

	if err := v.ReadInConfig(); err != nil {
		return fmt.Errorf("read config failed: %w", err)
	}

	if err := v.Unmarshal(cfg); err != nil {
		return fmt.Errorf("unmarshal config failed: %w", err)
	}

	absLogDir, err := filepath.Abs(cfg.App.LogDir)
	if err == nil {
		cfg.App.LogDir = absLogDir
	}
	if err := os.MkdirAll(cfg.App.LogDir, 0755); err != nil {
		logrus.Warnf("create log dir failed: %v", err)
	}

	absDataDir, err := filepath.Abs(cfg.Storage.DataDir)
	if err == nil {
		cfg.Storage.DataDir = absDataDir
	}
	if err := os.MkdirAll(cfg.Storage.DataDir, 0755); err != nil {
		logrus.Warnf("create data dir failed: %v", err)
	}

	absExportDir, err := filepath.Abs(cfg.Storage.ExportDir)
	if err == nil {
		cfg.Storage.ExportDir = absExportDir
	}
	if err := os.MkdirAll(cfg.Storage.ExportDir, 0755); err != nil {
		logrus.Warnf("create export dir failed: %v", err)
	}

	for i := range cfg.Systems {
		if cfg.Systems[i].SessionTimeout == 0 {
			cfg.Systems[i].SessionTimeout = 30 * time.Minute
		}
		if cfg.Systems[i].KeepAliveInterval == 0 {
			cfg.Systems[i].KeepAliveInterval = 5 * time.Minute
		}
		if cfg.Systems[i].MaxConcurrency == 0 {
			cfg.Systems[i].MaxConcurrency = 3
		}
	}

	logrus.Infof("config loaded: %d systems configured", len(cfg.Systems))
	return nil
}

func setupHotReload(configPath string) error {
	var err error
	watcher, err = fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("create watcher failed: %w", err)
	}

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Op&fsnotify.Write == fsnotify.Write {
					logrus.Infof("config file changed: %s, reloading...", event.Name)
					mu.Lock()
					newCfg := &AppConfig{}
					if err := loadConfig(configPath, newCfg); err == nil {
						*instance = *newCfg
						logrus.Info("config hot reload successful")
					} else {
						logrus.Errorf("config hot reload failed: %v", err)
					}
					mu.Unlock()
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				logrus.Errorf("config watcher error: %v", err)
			}
		}
	}()

	configDir := filepath.Dir(configPath)
	if err := watcher.Add(configDir); err != nil {
		return fmt.Errorf("watch config dir failed: %w", err)
	}

	logrus.Info("config hot reload enabled")
	return nil
}

func Get() *AppConfig {
	mu.RLock()
	defer mu.RUnlock()
	return instance
}

func GetSystem(systemID string) *models.SystemConfig {
	mu.RLock()
	defer mu.RUnlock()
	for _, s := range instance.Systems {
		if s.ID == systemID {
			sCopy := s
			return &sCopy
		}
	}
	return nil
}

func GetEnabledSystems() []models.SystemConfig {
	mu.RLock()
	defer mu.RUnlock()
	enabled := make([]models.SystemConfig, 0)
	for _, s := range instance.Systems {
		if s.Enabled {
			enabled = append(enabled, s)
		}
	}
	return enabled
}

func GetFieldMappings(systemID string) []models.FieldMapping {
	mu.RLock()
	defer mu.RUnlock()
	if mappings, ok := instance.FieldMappings[systemID]; ok {
		return mappings
	}
	return nil
}

func IsInMaintenanceWindow(systemID string) bool {
	sys := GetSystem(systemID)
	if sys == nil || sys.MaintenanceStart == "" {
		return false
	}

	now := time.Now()
	currentTime := now.Format("15:04")

	start, err1 := time.Parse("15:04", sys.MaintenanceStart)
	if err1 != nil {
		return false
	}
	end, err2 := time.Parse("15:04", sys.MaintenanceEnd)
	if err2 != nil {
		return false
	}

	current, _ := time.Parse("15:04", currentTime)

	if start.After(end) {
		return current.After(start) || current.Before(end)
	}
	return current.After(start) && current.Before(end)
}

func Close() {
	if watcher != nil {
		watcher.Close()
	}
}
