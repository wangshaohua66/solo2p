package config

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type GlobalConfig struct {
	Concurrency       int      `yaml:"concurrency"`
	Timeout           int      `yaml:"timeout"`
	MaxRetries        int      `yaml:"max_retries"`
	RetryInterval     []int    `yaml:"retry_interval"`
	UserAgentRotation bool     `yaml:"user_agent_rotation"`
	RequestRateLimit  float64  `yaml:"request_rate_limit"`
	ProxyList         []string `yaml:"proxy_list"`
}

type AlertMailConfig struct {
	SMTPHost     string   `yaml:"smtp_host"`
	SMTPPort     int      `yaml:"smtp_port"`
	SMTPUser     string   `yaml:"smtp_user"`
	SMTPPassword string   `yaml:"smtp_password"`
	From         string   `yaml:"from"`
	To           []string `yaml:"to"`
}

type AlertWebhookConfig struct {
	Enabled bool   `yaml:"enabled"`
	URL     string `yaml:"url"`
}

type AlertConfig struct {
	Enabled              bool               `yaml:"enabled"`
	Mode                 string             `yaml:"mode"`
	PriceChangeThreshold float64            `yaml:"price_change_threshold"`
	Mail                 AlertMailConfig    `yaml:"mail"`
	Webhook              AlertWebhookConfig `yaml:"webhook"`
}

type DatabaseConfig struct {
	Path string `yaml:"path"`
}

type LogConfig struct {
	Level         string `yaml:"level"`
	Dir           string `yaml:"dir"`
	RetentionDays int    `yaml:"retention_days"`
}

type CaptchaSolverConfig struct {
	Enabled  bool   `yaml:"enabled"`
	Provider string `yaml:"provider"`
	APIKey   string `yaml:"api_key"`
	APIURL   string `yaml:"api_url"`
	Language string `yaml:"language"`
	Timeout  int    `yaml:"timeout"`
}

type Selectors struct {
	PriceOriginal string `yaml:"price_original"`
	PricePromo    string `yaml:"price_promo"`
	PriceMember   string `yaml:"price_member"`
	Title         string `yaml:"title"`
	SKUId         string `yaml:"sku_id"`
	Stock         string `yaml:"stock"`
}

type SiteConfig struct {
	ID        string    `yaml:"id"`
	Name      string    `yaml:"name"`
	BaseURL   string    `yaml:"base_url"`
	SearchURL string    `yaml:"search_url"`
	Currency  string    `yaml:"currency"`
	Enabled   bool      `yaml:"enabled"`
	RateLimit float64   `yaml:"rate_limit"`
	Selectors Selectors `yaml:"selectors"`
}

type SKUConfig struct {
	SKUId          string   `yaml:"sku_id"`
	Name           string   `yaml:"name"`
	Brand          string   `yaml:"brand"`
	Category       string   `yaml:"category"`
	Keywords       []string `yaml:"keywords"`
	ReferencePrice float64  `yaml:"reference_price"`
}

type AppConfig struct {
	Global        GlobalConfig        `yaml:"global"`
	Alert         AlertConfig         `yaml:"alert"`
	Database      DatabaseConfig      `yaml:"database"`
	Log           LogConfig           `yaml:"log"`
	CaptchaSolver CaptchaSolverConfig `yaml:"captcha_solver"`
	Sites         []SiteConfig        `yaml:"sites"`
	SKUs          []SKUConfig         `yaml:"skus"`
}

var UserAgentPool = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
	"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

var CurrencyRates = map[string]float64{
	"CNY": 1.0,
	"USD": 7.24,
	"EUR": 7.86,
	"JPY": 0.048,
	"HKD": 0.93,
}

var Config *AppConfig

func Load(configPath string) (*AppConfig, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg AppConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	Config = &cfg
	return &cfg, nil
}

func (c *AppConfig) validate() error {
	if c.Global.Concurrency <= 0 {
		c.Global.Concurrency = 50
	}
	if c.Global.Timeout <= 0 {
		c.Global.Timeout = 30
	}
	if c.Global.MaxRetries <= 0 {
		c.Global.MaxRetries = 3
	}
	if len(c.Global.RetryInterval) == 0 {
		c.Global.RetryInterval = []int{1, 3, 5}
	}
	if c.Database.Path == "" {
		c.Database.Path = "./data/price_monitor.db"
	}
	if c.Log.Dir == "" {
		c.Log.Dir = "./logs"
	}
	if c.Log.RetentionDays <= 0 {
		c.Log.RetentionDays = 30
	}
	if c.Alert.PriceChangeThreshold <= 0 {
		c.Alert.PriceChangeThreshold = 0.05
	}
	if c.CaptchaSolver.Language == "" {
		c.CaptchaSolver.Language = "eng"
	}
	if c.CaptchaSolver.Timeout <= 0 {
		c.CaptchaSolver.Timeout = 30
	}
	if envKey := os.Getenv("CAPTCHA_SOLVER_API_KEY"); envKey != "" {
		c.CaptchaSolver.APIKey = envKey
	}
	if envProvider := os.Getenv("CAPTCHA_SOLVER_PROVIDER"); envProvider != "" {
		c.CaptchaSolver.Provider = envProvider
	}
	if c.CaptchaSolver.Enabled {
		if c.CaptchaSolver.Provider == "" {
			return fmt.Errorf("captcha_solver.enabled is true but captcha_solver.provider is empty (supported: ocrspace)")
		}
		if c.CaptchaSolver.APIKey == "" {
			return fmt.Errorf("captcha_solver.enabled is true but captcha_solver.api_key is empty (set in config or CAPTCHA_SOLVER_API_KEY env var)")
		}
	}
	if len(c.Sites) == 0 {
		return fmt.Errorf("no sites configured")
	}
	return nil
}

func (c *AppConfig) GetEnabledSites() []SiteConfig {
	var enabled []SiteConfig
	for _, s := range c.Sites {
		if s.Enabled {
			enabled = append(enabled, s)
		}
	}
	return enabled
}

func (c *AppConfig) GetSiteByID(id string) (SiteConfig, bool) {
	for _, s := range c.Sites {
		if s.ID == id {
			return s, true
		}
	}
	return SiteConfig{}, false
}

func (c *AppConfig) GetSKUByID(id string) (SKUConfig, bool) {
	for _, s := range c.SKUs {
		if s.SKUId == id {
			return s, true
		}
	}
	return SKUConfig{}, false
}

func (c *AppConfig) GetSKUsByCategory(category string) []SKUConfig {
	var result []SKUConfig
	for _, s := range c.SKUs {
		if strings.EqualFold(s.Category, category) || category == "" {
			result = append(result, s)
		}
	}
	return result
}

func (c *AppConfig) GetSKUsByBrand(brand string) []SKUConfig {
	var result []SKUConfig
	for _, s := range c.SKUs {
		if strings.EqualFold(s.Brand, brand) || brand == "" {
			result = append(result, s)
		}
	}
	return result
}

func ConvertCurrency(amount float64, from, to string) float64 {
	fromRate, ok1 := CurrencyRates[from]
	toRate, ok2 := CurrencyRates[to]
	if !ok1 || !ok2 {
		return amount
	}
	return amount * fromRate / toRate
}
