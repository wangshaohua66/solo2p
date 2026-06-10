package config

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type Config struct {
	viper     *viper.Viper
	mu        sync.RWMutex
	listeners []func()
}

type CrawlerConfig struct {
	WorkerCount   int      `mapstructure:"worker_count"`
	RequestDelay  [2]int   `mapstructure:"request_delay"`
	UserAgents    []string `mapstructure:"user_agents"`
	ProxyURLs     []string `mapstructure:"proxy_urls"`
	CookiePool    []string `mapstructure:"cookie_pool"`
	Timeout       int      `mapstructure:"timeout"`
	MaxRetry      int      `mapstructure:"max_retry"`
	RobotsEnabled bool     `mapstructure:"robots_enabled"`
}

type CourtConfig struct {
	Name     string `mapstructure:"name"`
	Level    string `mapstructure:"level"`
	BaseURL  string `mapstructure:"base_url"`
	ListURL  string `mapstructure:"list_url"`
	DetailURL string `mapstructure:"detail_url"`
	Parser   string `mapstructure:"parser"`
	Enabled  bool   `mapstructure:"enabled"`
}

type StoreConfig struct {
	DBPath string `mapstructure:"db_path"`
}

type NotifyConfig struct {
	WebhookURLs    []string `mapstructure:"webhook_urls"`
	WechatWebhook  string   `mapstructure:"wechat_webhook"`
	SMTPHost       string   `mapstructure:"smtp_host"`
	SMTPPort       int      `mapstructure:"smtp_port"`
	SMTPUser       string   `mapstructure:"smtp_user"`
	SMTPPassword   string   `mapstructure:"smtp_password"`
	EmailFrom      string   `mapstructure:"email_from"`
	EmailTo        []string `mapstructure:"email_to"`
	SMSAPI         string   `mapstructure:"sms_api"`
	SMSAPIKey      string   `mapstructure:"sms_api_key"`
	SMSPhones      []string `mapstructure:"sms_phones"`
}

type SchedulerConfig struct {
	IncrementalCron string `mapstructure:"incremental_cron"`
	FullCron        string `mapstructure:"full_cron"`
}

type WebConfig struct {
	Port int    `mapstructure:"port"`
	Host string `mapstructure:"host"`
}

type RetryConfig struct {
	BaseDelay    time.Duration `mapstructure:"base_delay"`
	MaxDelay     time.Duration `mapstructure:"max_delay"`
	Multiplier   float64       `mapstructure:"multiplier"`
	MaxAttempts  int           `mapstructure:"max_attempts"`
	DeadLetterPath string      `mapstructure:"dead_letter_path"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
	Output string `mapstructure:"output"`
}

type AppConfig struct {
	Crawler   CrawlerConfig   `mapstructure:"crawler"`
	Courts    []CourtConfig   `mapstructure:"courts"`
	Store     StoreConfig     `mapstructure:"store"`
	Notify    NotifyConfig    `mapstructure:"notify"`
	Scheduler SchedulerConfig `mapstructure:"scheduler"`
	Web       WebConfig       `mapstructure:"web"`
	Retry     RetryConfig     `mapstructure:"retry"`
	Log       LogConfig       `mapstructure:"log"`
}

var (
	instance *Config
	once     sync.Once
)

func GetConfig() *Config {
	once.Do(func() {
		instance = &Config{
			viper: viper.New(),
		}
	})
	return instance
}

func (c *Config) Load(configPath string, watch bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.viper.SetConfigType("yaml")
	c.viper.SetEnvPrefix("BANKRUPT")
	c.viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	c.viper.AutomaticEnv()

	c.setDefaults()

	if configPath != "" {
		c.viper.SetConfigFile(configPath)
	} else {
		c.viper.SetConfigName("config")
		c.viper.AddConfigPath(".")
		c.viper.AddConfigPath("./config")
		c.viper.AddConfigPath("$HOME/.bankrupt-monitor")
	}

	if err := c.viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return fmt.Errorf("read config: %w", err)
		}
	}

	c.applyEnvOverrides()

	if watch {
		c.viper.WatchConfig()
		c.viper.OnConfigChange(func(e fsnotify.Event) {
			c.mu.Lock()
			c.applyEnvOverrides()
			c.mu.Unlock()
			c.notifyListeners()
		})
	}

	return nil
}

func (c *Config) setDefaults() {
	c.viper.SetDefault("crawler.worker_count", 10)
	c.viper.SetDefault("crawler.request_delay", []int{1500, 4000})
	c.viper.SetDefault("crawler.user_agents", []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
	})
	c.viper.SetDefault("crawler.timeout", 30)
	c.viper.SetDefault("crawler.max_retry", 3)
	c.viper.SetDefault("crawler.robots_enabled", true)

	c.viper.SetDefault("store.db_path", "./data/bankrupt.db")

	c.viper.SetDefault("scheduler.incremental_cron", "*/30 * * * *")
	c.viper.SetDefault("scheduler.full_cron", "0 2 * * 0")

	c.viper.SetDefault("web.port", 7890)
	c.viper.SetDefault("web.host", "127.0.0.1")

	c.viper.SetDefault("retry.base_delay", "1s")
	c.viper.SetDefault("retry.max_delay", "16s")
	c.viper.SetDefault("retry.multiplier", 4.0)
	c.viper.SetDefault("retry.max_attempts", 3)
	c.viper.SetDefault("retry.dead_letter_path", "./data/dead_letter")

	c.viper.SetDefault("log.level", "info")
	c.viper.SetDefault("log.format", "json")
	c.viper.SetDefault("log.output", "stdout")
}

func (c *Config) applyEnvOverrides() {
	if v := os.Getenv("COURTS_LIST"); v != "" {
		c.viper.Set("courts_list", v)
	}
	if v := os.Getenv("PROXY_URL"); v != "" {
		c.viper.Set("crawler.proxy_urls", strings.Split(v, ","))
	}
	if v := os.Getenv("WEBHOOK_URL"); v != "" {
		c.viper.Set("notify.webhook_urls", strings.Split(v, ","))
	}
}

func (c *Config) Get() *AppConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var cfg AppConfig
	if err := c.viper.Unmarshal(&cfg); err != nil {
		fmt.Fprintf(os.Stderr, "unmarshal config: %v\n", err)
	}
	return &cfg
}

func (c *Config) OnChange(fn func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.listeners = append(c.listeners, fn)
}

func (c *Config) notifyListeners() {
	c.mu.RLock()
	listeners := make([]func(), len(c.listeners))
	copy(listeners, c.listeners)
	c.mu.RUnlock()

	for _, fn := range listeners {
		fn()
	}
}

func (c *Config) InitLogger() (*zap.Logger, error) {
	appCfg := c.Get()

	var level zapcore.Level
	switch strings.ToLower(appCfg.Log.Level) {
	case "debug":
		level = zapcore.DebugLevel
	case "warn":
		level = zapcore.WarnLevel
	case "error":
		level = zapcore.ErrorLevel
	default:
		level = zapcore.InfoLevel
	}

	zapCfg := zap.NewProductionConfig()
	zapCfg.Level = zap.NewAtomicLevelAt(level)
	zapCfg.Encoding = appCfg.Log.Format
	if appCfg.Log.Output != "stdout" {
		zapCfg.OutputPaths = []string{appCfg.Log.Output}
	}

	return zapCfg.Build()
}
