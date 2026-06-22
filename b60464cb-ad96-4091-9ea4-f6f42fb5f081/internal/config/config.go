package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Database DatabaseConfig `mapstructure:"database"`
	Server   ServerConfig   `mapstructure:"server"`
	Notifier NotifierConfig `mapstructure:"notifier"`
	Dispatch DispatchConfig `mapstructure:"dispatch"`
	Log      LogConfig      `mapstructure:"log"`
}

type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	DBName       string `mapstructure:"dbname"`
	SSLMode      string `mapstructure:"sslmode"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
}

type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
}

type NotifierConfig struct {
	Email   EmailConfig   `mapstructure:"email"`
	SMS     SMSConfig     `mapstructure:"sms"`
	Webhook WebhookConfig `mapstructure:"webhook"`
}

type EmailConfig struct {
	Enabled  bool   `mapstructure:"enabled"`
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
}

type SMSConfig struct {
	Enabled  bool   `mapstructure:"enabled"`
	Provider string `mapstructure:"provider"`
	APIKey   string `mapstructure:"api_key"`
	APIURL   string `mapstructure:"api_url"`
}

type WebhookConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	URL     string `mapstructure:"url"`
	Secret  string `mapstructure:"secret"`
}

type DispatchConfig struct {
	Berth   BerthConfig   `mapstructure:"berth"`
	Yard    YardConfig    `mapstructure:"yard"`
	Truck   TruckConfig   `mapstructure:"truck"`
	Release ReleaseConfig `mapstructure:"release"`
}

type BerthConfig struct {
	SafetyDistance float64 `mapstructure:"safety_distance"`
	DefaultBerths  int     `mapstructure:"default_berths"`
	QuayCranes     int     `mapstructure:"quay_cranes"`
}

type YardConfig struct {
	MaxHeight    int     `mapstructure:"max_height"`
	MinWeightGap float64 `mapstructure:"min_weight_gap"`
	TotalSlots   int     `mapstructure:"total_slots"`
}

type TruckConfig struct {
	TotalTrucks int     `mapstructure:"total_trucks"`
	AvgSpeed    float64 `mapstructure:"avg_speed"`
	IdleCost    float64 `mapstructure:"idle_cost"`
}

type ReleaseConfig struct {
	PollInterval time.Duration `mapstructure:"poll_interval"`
	NotifyDelay  time.Duration `mapstructure:"notify_delay"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

var AppConfig *Config

func Load(path string) (*Config, error) {
	v := viper.New()

	if path != "" {
		v.SetConfigFile(path)
	} else {
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(".")
		v.AddConfigPath("./config")
		v.AddConfigPath("/etc/terminal-dispatcher")
	}

	v.SetEnvPrefix("TD")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	setDefaults(v)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("read config: %w", err)
		}
	}

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	AppConfig = cfg
	return cfg, nil
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "postgres")
	v.SetDefault("database.password", "postgres")
	v.SetDefault("database.dbname", "terminal")
	v.SetDefault("database.sslmode", "disable")
	v.SetDefault("database.max_open_conns", 50)
	v.SetDefault("database.max_idle_conns", 10)

	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)

	v.SetDefault("notifier.email.enabled", false)
	v.SetDefault("notifier.email.host", "smtp.example.com")
	v.SetDefault("notifier.email.port", 587)
	v.SetDefault("notifier.email.username", "")
	v.SetDefault("notifier.email.password", "")
	v.SetDefault("notifier.email.from", "dispatch@terminal.com")

	v.SetDefault("notifier.sms.enabled", false)
	v.SetDefault("notifier.sms.provider", "twilio")
	v.SetDefault("notifier.sms.api_key", "")
	v.SetDefault("notifier.sms.api_url", "")

	v.SetDefault("notifier.webhook.enabled", false)
	v.SetDefault("notifier.webhook.url", "")
	v.SetDefault("notifier.webhook.secret", "")

	v.SetDefault("dispatch.berth.safety_distance", 15.0)
	v.SetDefault("dispatch.berth.default_berths", 3)
	v.SetDefault("dispatch.berth.quay_cranes", 18)

	v.SetDefault("dispatch.yard.max_height", 5)
	v.SetDefault("dispatch.yard.min_weight_gap", 2.0)
	v.SetDefault("dispatch.yard.total_slots", 5000)

	v.SetDefault("dispatch.truck.total_trucks", 120)
	v.SetDefault("dispatch.truck.avg_speed", 25.0)
	v.SetDefault("dispatch.truck.idle_cost", 50.0)

	v.SetDefault("dispatch.release.poll_interval", "5m")
	v.SetDefault("dispatch.release.notify_delay", "1h")

	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "text")
}
