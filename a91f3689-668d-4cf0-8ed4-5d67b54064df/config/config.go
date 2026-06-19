package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	App      AppConfig      `mapstructure:"app"`
	Database DatabaseConfig `mapstructure:"database"`
	Log      LogConfig      `mapstructure:"log"`
	Pool     PoolConfig     `mapstructure:"pool"`
	Sites    []SiteConfig   `mapstructure:"sites"`
	Drugs    []DrugConfig   `mapstructure:"drugs"`
	Notify   NotifyConfig   `mapstructure:"notify"`
	Schedule ScheduleConfig `mapstructure:"schedule"`
}

type AppConfig struct {
	Name        string `mapstructure:"name"`
	Environment string `mapstructure:"environment"`
	DataDir     string `mapstructure:"data_dir"`
	DryRun      bool   `mapstructure:"dry_run"`
	Verbose     bool   `mapstructure:"verbose"`
}

type DatabaseConfig struct {
	Path string `mapstructure:"path"`
}

type LogConfig struct {
	Level      string `mapstructure:"level"`
	FilePath   string `mapstructure:"file_path"`
	MaxSize    int    `mapstructure:"max_size"`
	MaxBackups int    `mapstructure:"max_backups"`
	MaxAge     int    `mapstructure:"max_age"`
}

type PoolConfig struct {
	MaxInstances     int           `mapstructure:"max_instances"`
	MinInstances     int           `mapstructure:"min_instances"`
	HealthCheckInt   time.Duration `mapstructure:"health_check_interval"`
	InstanceTimeout  time.Duration `mapstructure:"instance_timeout"`
	MaxMemoryMB      int           `mapstructure:"max_memory_mb"`
	TaskQueueSize    int           `mapstructure:"task_queue_size"`
	IdleTimeout      time.Duration `mapstructure:"idle_timeout"`
	RestartOnCrash   bool          `mapstructure:"restart_on_crash"`
}

type SiteConfig struct {
	Name              string            `mapstructure:"name"`
	Code              string            `mapstructure:"code"`
	Enabled           bool              `mapstructure:"enabled"`
	URL               string            `mapstructure:"url"`
	Strategy          string            `mapstructure:"strategy"`
	Auth              AuthConfig        `mapstructure:"auth"`
	Pagination        PaginationConfig  `mapstructure:"pagination"`
	Form              FormConfig        `mapstructure:"form"`
	PDF               PDFConfig         `mapstructure:"pdf"`
	Language          string            `mapstructure:"language"`
	CrawlInterval     time.Duration     `mapstructure:"crawl_interval"`
	Timeout           time.Duration     `mapstructure:"timeout"`
	MaxRetry          int               `mapstructure:"max_retry"`
	RetryBackoff      time.Duration     `mapstructure:"retry_backoff"`
	Selectors         SiteSelectors     `mapstructure:"selectors"`
	CustomHeaders     map[string]string `mapstructure:"custom_headers"`
	RateLimitDelay    time.Duration     `mapstructure:"rate_limit_delay"`
	MaxPagesPerCrawl  int               `mapstructure:"max_pages_per_crawl"`
}

type AuthConfig struct {
	Required       bool              `mapstructure:"required"`
	LoginURL       string            `mapstructure:"login_url"`
	Username       string            `mapstructure:"username"`
	Password       string            `mapstructure:"password"`
	UsernameSel    string            `mapstructure:"username_selector"`
	PasswordSel    string            `mapstructure:"password_selector"`
	SubmitSel      string            `mapstructure:"submit_selector"`
	CheckSel       string            `mapstructure:"check_selector"`
	CookieFile     string            `mapstructure:"cookie_file"`
	SessionTimeout time.Duration     `mapstructure:"session_timeout"`
	ExtraFields    map[string]string `mapstructure:"extra_fields"`
}

type PaginationConfig struct {
	Type          string `mapstructure:"type"`
	NextSel       string `mapstructure:"next_selector"`
	PageParam     string `mapstructure:"page_param"`
	StartPage     int    `mapstructure:"start_page"`
	MaxPage       int    `mapstructure:"max_page"`
	DisabledClass string `mapstructure:"disabled_class"`
}

type FormConfig struct {
	SearchURL     string            `mapstructure:"search_url"`
	Fields        map[string]string `mapstructure:"fields"`
	SubmitSel     string            `mapstructure:"submit_selector"`
	WaitForSel    string            `mapstructure:"wait_for_selector"`
	WaitLoadTime  time.Duration     `mapstructure:"wait_load_time"`
	IsDynamic     bool              `mapstructure:"is_dynamic"`
	ScrollToLoad  bool              `mapstructure:"scroll_to_load"`
}

type PDFConfig struct {
	DownloadDir   string `mapstructure:"download_dir"`
	LinkSel       string `mapstructure:"link_selector"`
	TextExtraction bool  `mapstructure:"text_extraction"`
	Patterns      []string `mapstructure:"patterns"`
}

type SiteSelectors struct {
	RowSelector      string `mapstructure:"row_selector"`
	DrugNameSel      string `mapstructure:"drug_name_selector"`
	TitleSel         string `mapstructure:"title_selector"`
	DateSel          string `mapstructure:"date_selector"`
	SeveritySel      string `mapstructure:"severity_selector"`
	ReportIDSel      string `mapstructure:"report_id_selector"`
	ContentSel       string `mapstructure:"content_selector"`
	DetailLinkSel    string `mapstructure:"detail_link_selector"`
	LanguageSwitcher string `mapstructure:"language_switcher"`
}

type DrugConfig struct {
	Name         string   `mapstructure:"name"`
	GenericName  string   `mapstructure:"generic_name"`
	Aliases      []string `mapstructure:"aliases"`
	ATCCode      string   `mapstructure:"atc_code"`
	MonitorLevel string   `mapstructure:"monitor_level"`
}

type NotifyConfig struct {
	WeChat WeChatConfig `mapstructure:"wechat"`
	Phone  PhoneConfig  `mapstructure:"phone"`
	Levels []LevelConfig `mapstructure:"levels"`
}

type WeChatConfig struct {
	WebhookURL    string        `mapstructure:"webhook_url"`
	Secret        string        `mapstructure:"secret"`
	UserIDs       []string      `mapstructure:"user_ids"`
	MobileList    []string      `mapstructure:"mobile_list"`
	RateLimit     time.Duration `mapstructure:"rate_limit"`
}

type PhoneConfig struct {
	WebhookURL string `mapstructure:"webhook_url"`
	APIKey     string `mapstructure:"api_key"`
}

type LevelConfig struct {
	Level       string        `mapstructure:"level"`
	AtAll       bool          `mapstructure:"at_all"`
	AtUsers     []string      `mapstructure:"at_users"`
	CallPhone   bool          `mapstructure:"call_phone"`
	MaxPerHour  int           `mapstructure:"max_per_hour"`
	Keywords    []string      `mapstructure:"keywords"`
}

type ScheduleConfig struct {
	CronExpr string        `mapstructure:"cron_expr"`
	FullScan time.Duration `mapstructure:"full_scan_interval"`
}

var globalConfig *Config

func Load(configPath string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")
	v.SetEnvPrefix("DRUGVIGIL")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	for _, env := range []string{
		"APP_ENVIRONMENT", "APP_DRY_RUN", "APP_VERBOSE",
		"DATABASE_PATH", "POOL_MAX_INSTANCES", "POOL_MAX_MEMORY_MB",
		"NOTIFY_WECHAT_WEBHOOK_URL", "NOTIFY_WECHAT_SECRET",
	} {
		if err := v.BindEnv(strings.ReplaceAll(strings.ToLower(env), "_", "."), env); err != nil {
			return nil, fmt.Errorf("bind env %s: %w", env, err)
		}
	}

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	setDefaults(&cfg)
	globalConfig = &cfg
	return &cfg, nil
}

func setDefaults(cfg *Config) {
	if cfg.App.Name == "" {
		cfg.App.Name = "drugvigil"
	}
	if cfg.App.DataDir == "" {
		cfg.App.DataDir = "./data"
	}
	if cfg.Database.Path == "" {
		cfg.Database.Path = cfg.App.DataDir + "/boltdb/drugvigil.db"
	}
	if cfg.Log.Level == "" {
		cfg.Log.Level = "info"
	}
	if cfg.Pool.MaxInstances == 0 {
		cfg.Pool.MaxInstances = 4
	}
	if cfg.Pool.MinInstances == 0 {
		cfg.Pool.MinInstances = 1
	}
	if cfg.Pool.MaxMemoryMB == 0 {
		cfg.Pool.MaxMemoryMB = 500
	}
	if cfg.Pool.TaskQueueSize == 0 {
		cfg.Pool.TaskQueueSize = 100
	}
	if cfg.Pool.HealthCheckInt == 0 {
		cfg.Pool.HealthCheckInt = 30 * time.Second
	}
	if cfg.Pool.InstanceTimeout == 0 {
		cfg.Pool.InstanceTimeout = 3 * time.Minute
	}
	if cfg.Pool.IdleTimeout == 0 {
		cfg.Pool.IdleTimeout = 5 * time.Minute
	}
	for i := range cfg.Sites {
		if cfg.Sites[i].Timeout == 0 {
			cfg.Sites[i].Timeout = 3 * time.Minute
		}
		if cfg.Sites[i].MaxRetry == 0 {
			cfg.Sites[i].MaxRetry = 5
		}
		if cfg.Sites[i].RetryBackoff == 0 {
			cfg.Sites[i].RetryBackoff = 2 * time.Second
		}
		if cfg.Sites[i].RateLimitDelay == 0 {
			cfg.Sites[i].RateLimitDelay = 500 * time.Millisecond
		}
		if cfg.Sites[i].MaxPagesPerCrawl == 0 {
			cfg.Sites[i].MaxPagesPerCrawl = 50
		}
		if cfg.Sites[i].Auth.SessionTimeout == 0 {
			cfg.Sites[i].Auth.SessionTimeout = 24 * time.Hour
		}
		if cfg.Sites[i].PDF.DownloadDir == "" {
			cfg.Sites[i].PDF.DownloadDir = cfg.App.DataDir + "/pdf/" + cfg.Sites[i].Code
		}
		if cfg.Sites[i].Auth.CookieFile == "" {
			cfg.Sites[i].Auth.CookieFile = cfg.App.DataDir + "/cookies/" + cfg.Sites[i].Code + ".json"
		}
	}
	if cfg.Schedule.CronExpr == "" {
		cfg.Schedule.CronExpr = "0 */15 * * * *"
	}
	if cfg.Schedule.FullScan == 0 {
		cfg.Schedule.FullScan = 24 * time.Hour
	}
}

func Get() *Config {
	return globalConfig
}

func (c *Config) GetSite(code string) *SiteConfig {
	for i := range c.Sites {
		if c.Sites[i].Code == code {
			return &c.Sites[i]
		}
	}
	return nil
}

func (c *Config) GetDrug(name string) *DrugConfig {
	for i := range c.Drugs {
		if c.Drugs[i].Name == name || c.Drugs[i].GenericName == name {
			return &c.Drugs[i]
		}
		for _, alias := range c.Drugs[i].Aliases {
			if alias == name {
				return &c.Drugs[i]
			}
		}
	}
	return nil
}

func (c *Config) GetLevel(severity string) *LevelConfig {
	for i := range c.Notify.Levels {
		if c.Notify.Levels[i].Level == severity {
			return &c.Notify.Levels[i]
		}
	}
	return &c.Notify.Levels[0]
}
