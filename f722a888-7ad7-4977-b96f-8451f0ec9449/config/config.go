package config

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

type AppConfig struct {
	Database   DatabaseConfig   `mapstructure:"database"`
	Log        LogConfig        `mapstructure:"log"`
	Scheduler  SchedulerConfig  `mapstructure:"scheduler"`
	Notify     NotifyConfig     `mapstructure:"notify"`
	Export     ExportConfig     `mapstructure:"export"`
	Crawler    CrawlerConfig    `mapstructure:"crawler"`
	Sites      []SiteConfig     `mapstructure:"sites"`
}

type DatabaseConfig struct {
	Path         string `mapstructure:"path"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
}

type LogConfig struct {
	Level       string `mapstructure:"level"`
	FilePath    string `mapstructure:"file_path"`
	MaxAgeDays  int    `mapstructure:"max_age_days"`
	RotateDaily bool   `mapstructure:"rotate_daily"`
}

type SchedulerConfig struct {
	CronExpr    string `mapstructure:"cron_expr"`
	MaxDuration int    `mapstructure:"max_duration_minutes"`
}

type NotifyConfig struct {
	Email    EmailConfig    `mapstructure:"email"`
	Webhook  WebhookConfig  `mapstructure:"webhook"`
	AlertOn  AlertConfig    `mapstructure:"alert_on"`
}

type EmailConfig struct {
	Enabled  bool     `mapstructure:"enabled"`
	SMTPHost string   `mapstructure:"smtp_host"`
	SMTPPort int      `mapstructure:"smtp_port"`
	Username string   `mapstructure:"username"`
	Password string   `mapstructure:"password"`
	From     string   `mapstructure:"from"`
	To       []string `mapstructure:"to"`
	UseTLS   bool     `mapstructure:"use_tls"`
}

type WebhookConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	URL     string `mapstructure:"url"`
	Token   string `mapstructure:"token"`
}

type AlertConfig struct {
	ConsecutiveFailures int  `mapstructure:"consecutive_failures"`
	NotifyNewAnnounce   bool `mapstructure:"notify_new_announce"`
}

type ExportConfig struct {
	OutputDir string `mapstructure:"output_dir"`
}

type CrawlerConfig struct {
	GlobalTimeout     int  `mapstructure:"global_timeout_seconds"`
	GlobalMaxRetries  int  `mapstructure:"global_max_retries"`
	GlobalConcurrency int  `mapstructure:"global_concurrency"`
	UseChromeDP       bool `mapstructure:"use_chromedp"`
}

type SiteConfig struct {
	ID               string              `mapstructure:"id"`
	Name             string              `mapstructure:"name"`
	BaseURL          string              `mapstructure:"base_url"`
	ListURL          string              `mapstructure:"list_url"`
	Enabled          bool                `mapstructure:"enabled"`
	RequestInterval  IntervalConfig      `mapstructure:"request_interval"`
	MaxRetries       int                 `mapstructure:"max_retries"`
	TimeoutSeconds   int                 `mapstructure:"timeout_seconds"`
	Concurrency      int                 `mapstructure:"concurrency"`
	NeedLogin        bool                `mapstructure:"need_login"`
	LoginConfig      LoginConfig         `mapstructure:"login"`
	UseDynamicRender bool                `mapstructure:"use_dynamic_render"`
	UserAgent        string              `mapstructure:"user_agent"`
	ListRules        ListParseRules      `mapstructure:"list_rules"`
	DetailRules      DetailParseRules    `mapstructure:"detail_rules"`
	Categories       []CategoryConfig    `mapstructure:"categories"`
}

type IntervalConfig struct {
	Min int `mapstructure:"min_ms"`
	Max int `mapstructure:"max_ms"`
}

type LoginConfig struct {
	LoginURL      string            `mapstructure:"login_url"`
	UsernameField string            `mapstructure:"username_field"`
	PasswordField string            `mapstructure:"password_field"`
	Username      string            `mapstructure:"username"`
	Password      string            `mapstructure:"password"`
	ExtraFields   map[string]string `mapstructure:"extra_fields"`
	CaptchaURL    string            `mapstructure:"captcha_url"`
	CaptchaAPI    string            `mapstructure:"captcha_api"`
}

type ListParseRules struct {
	ItemSelector    string `mapstructure:"item_selector"`
	TitleSelector   string `mapstructure:"title_selector"`
	TitleAttr       string `mapstructure:"title_attr"`
	LinkSelector    string `mapstructure:"link_selector"`
	LinkAttr        string `mapstructure:"link_attr"`
	DateSelector    string `mapstructure:"date_selector"`
	DateAttr        string `mapstructure:"date_attr"`
	CategorySelector string `mapstructure:"category_selector"`
	PaginationSelector string `mapstructure:"pagination_selector"`
	MaxPages        int    `mapstructure:"max_pages"`
}

type DetailParseRules struct {
	TitleSelector      string `mapstructure:"title_selector"`
	ContentSelector    string `mapstructure:"content_selector"`
	BudgetSelector     string `mapstructure:"budget_selector"`
	BudgetRegex        string `mapstructure:"budget_regex"`
	DeadlineSelector   string `mapstructure:"deadline_selector"`
	DeadlineRegex      string `mapstructure:"deadline_regex"`
	ContactSelector    string `mapstructure:"contact_selector"`
	ContactRegex       string `mapstructure:"contact_regex"`
	ContactPhoneSelector string `mapstructure:"contact_phone_selector"`
	ContactPhoneRegex   string `mapstructure:"contact_phone_regex"`
	TendererSelector    string `mapstructure:"tenderer_selector"`
	ProjectNumSelector  string `mapstructure:"project_num_selector"`
	ProjectNumRegex     string `mapstructure:"project_num_regex"`
	RequirementsSelector string `mapstructure:"requirements_selector"`
	QualificationSelector string `mapstructure:"qualification_selector"`
	DocPriceSelector    string `mapstructure:"doc_price_selector"`
	BidOpenSelector     string `mapstructure:"bid_open_selector"`
}

type CategoryConfig struct {
	Type     string `mapstructure:"type"`
	Name     string `mapstructure:"name"`
	URLParam string `mapstructure:"url_param"`
	Keywords string `mapstructure:"keywords"`
}

var GlobalConfig *AppConfig

func Load(configDir string) (*AppConfig, error) {
	v := viper.New()
	v.SetConfigType("yaml")
	v.SetEnvPrefix("GOVRESOURCE")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	v.SetDefault("database.path", "./data/govresource.db")
	v.SetDefault("database.max_open_conns", 10)
	v.SetDefault("database.max_idle_conns", 5)
	v.SetDefault("log.level", "info")
	v.SetDefault("log.file_path", "./logs/app.log")
	v.SetDefault("log.max_age_days", 30)
	v.SetDefault("log.rotate_daily", true)
	v.SetDefault("scheduler.cron_expr", "0 */2 * * *")
	v.SetDefault("scheduler.max_duration_minutes", 10)
	v.SetDefault("export.output_dir", "./exports")
	v.SetDefault("crawler.global_timeout_seconds", 30)
	v.SetDefault("crawler.global_max_retries", 3)
	v.SetDefault("crawler.global_concurrency", 10)
	v.SetDefault("crawler.use_chromedp", false)
	v.SetDefault("notify.email.enabled", false)
	v.SetDefault("notify.webhook.enabled", false)
	v.SetDefault("notify.alert_on.consecutive_failures", 5)
	v.SetDefault("notify.alert_on.notify_new_announce", true)

	mainConfigPath := filepath.Join(configDir, "config.yaml")
	v.SetConfigFile(mainConfigPath)
	if err := v.ReadInConfig(); err != nil {
		fmt.Printf("Warning: main config not found at %s, using defaults: %v\n", mainConfigPath, err)
	}

	var cfg AppConfig
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal main config: %w", err)
	}

	sitesPath := filepath.Join(configDir, "sites.yaml")
	v2 := viper.New()
	v2.SetConfigType("yaml")
	v2.SetConfigFile(sitesPath)
	if err := v2.ReadInConfig(); err == nil {
		var sitesCfg struct {
			Sites []SiteConfig `mapstructure:"sites"`
		}
		if err := v2.Unmarshal(&sitesCfg); err != nil {
			return nil, fmt.Errorf("unmarshal sites config: %w", err)
		}
		cfg.Sites = sitesCfg.Sites
	} else {
		fmt.Printf("Warning: sites config not found at %s: %v\n", sitesPath, err)
	}

	GlobalConfig = &cfg
	return &cfg, nil
}

func (s *SiteConfig) GetSiteByID(id string) *SiteConfig {
	for i := range GlobalConfig.Sites {
		if GlobalConfig.Sites[i].ID == id {
			return &GlobalConfig.Sites[i]
		}
	}
	return nil
}

func (cfg *AppConfig) GetEnabledSites() []SiteConfig {
	var result []SiteConfig
	for _, s := range cfg.Sites {
		if s.Enabled {
			result = append(result, s)
		}
	}
	return result
}
