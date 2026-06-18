package config

import (
	"fmt"
	"os"
	"sync"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Database  DatabaseConfig  `yaml:"database"`
	Scraper   ScraperConfig   `yaml:"scraper"`
	Platforms PlatformsConfig `yaml:"platforms"`
	Alert     AlertConfig     `yaml:"alert"`
	Scheduler SchedulerConfig `yaml:"scheduler"`
	Budget    BudgetConfig    `yaml:"budget"`
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

type DatabaseConfig struct {
	Path           string `yaml:"path"`
	MaxOpenConns   int    `yaml:"max_open_conns"`
	MaxIdleConns   int    `yaml:"max_idle_conns"`
	ArchiveMonthly bool   `yaml:"archive_monthly"`
}

type ScraperConfig struct {
	MaxBrowsers         int           `yaml:"max_browsers"`
	RequestIntervalMin  int           `yaml:"request_interval_min"`
	RequestIntervalMax  int           `yaml:"request_interval_max"`
	MaxRetries          int           `yaml:"max_retries"`
	TimeoutSeconds      int           `yaml:"timeout_seconds"`
	Headless            bool          `yaml:"headless"`
	ProxyPool           ProxyPoolConfig  `yaml:"proxy_pool"`
	UserAgents          []string      `yaml:"user_agents"`
}

type ProxyPoolConfig struct {
	Enabled bool     `yaml:"enabled"`
	Proxies []string `yaml:"proxies"`
}

type PlatformConfig struct {
	Name     string `yaml:"name"`
	BaseURL  string `yaml:"base_url"`
	Enabled  bool   `yaml:"enabled"`
	Priority int    `yaml:"priority"`
}

type PlatformsConfig struct {
	CtripFlight  PlatformConfig `yaml:"ctrip_flight"`
	QunarFlight  PlatformConfig `yaml:"qunar_flight"`
	FliggyFlight PlatformConfig `yaml:"fliggy_flight"`
	Train12306   PlatformConfig `yaml:"train12306"`
	MeituanHotel PlatformConfig `yaml:"meituan_hotel"`
	CtripHotel   PlatformConfig `yaml:"ctrip_hotel"`
}

type AlertConfig struct {
	Email     EmailAlertConfig  `yaml:"email"`
	DingTalk  DingTalkConfig    `yaml:"dingtalk"`
	WeWork    WeWorkConfig      `yaml:"wework"`
	Threshold ThresholdConfig   `yaml:"threshold"`
}

type EmailAlertConfig struct {
	Enabled  bool     `yaml:"enabled"`
	SMTPHost string   `yaml:"smtp_host"`
	SMTPPort int      `yaml:"smtp_port"`
	Username string   `yaml:"username"`
	Password string   `yaml:"password"`
	From     string   `yaml:"from"`
	To       []string `yaml:"to"`
}

type DingTalkConfig struct {
	Enabled    bool   `yaml:"enabled"`
	WebhookURL string `yaml:"webhook_url"`
	Secret     string `yaml:"secret"`
}

type WeWorkConfig struct {
	Enabled    bool   `yaml:"enabled"`
	WebhookURL string `yaml:"webhook_url"`
}

type ThresholdConfig struct {
	PriceDropPercent   float64 `yaml:"price_drop_percent"`
	BudgetUsagePercent float64 `yaml:"budget_usage_percent"`
}

type SchedulerConfig struct {
	Jobs []JobConfig `yaml:"jobs"`
}

type JobConfig struct {
	Name    string `yaml:"name"`
	Cron    string `yaml:"cron"`
	Type    string `yaml:"type"`
	Enabled bool   `yaml:"enabled"`
}

type BudgetConfig struct {
	Departments []DepartmentConfig `yaml:"departments"`
}

type DepartmentConfig struct {
	Name          string  `yaml:"name"`
	MonthlyBudget float64 `yaml:"monthly_budget"`
}

var (
	globalConfig *Config
	once         sync.Once
	configPath   = "config.yaml"
)

func Load(path ...string) (*Config, error) {
	if len(path) > 0 {
		configPath = path[0]
	}

	var loadErr error
	once.Do(func() {
		data, err := os.ReadFile(configPath)
		if err != nil {
			loadErr = fmt.Errorf("读取配置文件失败: %w", err)
			return
		}

		var cfg Config
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			loadErr = fmt.Errorf("解析配置文件失败: %w", err)
			return
		}

		if err := cfg.validate(); err != nil {
			loadErr = fmt.Errorf("配置校验失败: %w", err)
			return
		}

		globalConfig = &cfg
	})

	if loadErr != nil {
		return nil, loadErr
	}

	return globalConfig, nil
}

func Get() *Config {
	if globalConfig == nil {
		_, _ = Load()
	}
	return globalConfig
}

func (c *Config) validate() error {
	if c.Server.Port <= 0 || c.Server.Port > 65535 {
		return fmt.Errorf("服务器端口不合法: %d", c.Server.Port)
	}
	if c.Scraper.MaxBrowsers <= 0 {
		return fmt.Errorf("最大浏览器实例数必须大于0")
	}
	if c.Database.Path == "" {
		return fmt.Errorf("数据库路径不能为空")
	}
	return nil
}

func (c *Config) GetEnabledPlatforms() map[string]PlatformConfig {
	result := make(map[string]PlatformConfig)
	all := map[string]PlatformConfig{
		"ctrip_flight":  c.Platforms.CtripFlight,
		"qunar_flight":  c.Platforms.QunarFlight,
		"fliggy_flight": c.Platforms.FliggyFlight,
		"train12306":    c.Platforms.Train12306,
		"meituan_hotel": c.Platforms.MeituanHotel,
		"ctrip_hotel":   c.Platforms.CtripHotel,
	}
	for k, v := range all {
		if v.Enabled {
			result[k] = v
		}
	}
	return result
}

func (c *Config) GetRandomUserAgent() string {
	if len(c.Scraper.UserAgents) == 0 {
		return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
	}
	return c.Scraper.UserAgents[0]
}
