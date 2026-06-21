package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

type Config struct {
	Systems   SystemsConfig   `mapstructure:"systems"`
	Accounts  AccountsConfig  `mapstructure:"accounts"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Alert     AlertConfig     `mapstructure:"alert"`
	Notify    NotifyConfig    `mapstructure:"notify"`
	Schedule  ScheduleConfig  `mapstructure:"schedule"`
	Default   DefaultConfig   `mapstructure:"default"`
	Log       LogConfig       `mapstructure:"log"`
}

type SystemsConfig struct {
	CNIPR    SystemEndpoint `mapstructure:"cnipr"`
	CPQuery  SystemEndpoint `mapstructure:"cpquery"`
	FeeQuery SystemEndpoint `mapstructure:"feequery"`
}

type SystemEndpoint struct {
	BaseURL      string `mapstructure:"base_url"`
	LoginURL     string `mapstructure:"login_url"`
	Timeout      int    `mapstructure:"timeout"`
	HeartbeatInt int    `mapstructure:"heartbeat_interval"`
}

type AccountsConfig struct {
	DefaultAccount string            `mapstructure:"default_account"`
	Accounts       map[string]Account `mapstructure:"list"`
}

type Account struct {
	Username string `mapstructure:"username"`
	Cookie   string `mapstructure:"cookie"`
	CookieFile string `mapstructure:"cookie_file"`
}

type DatabaseConfig struct {
	Driver string `mapstructure:"driver"`
	DSN    string `mapstructure:"dsn"`
}

type AlertConfig struct {
	OverdueRiskDays int `mapstructure:"overdue_risk_days"`
	WarningDays     int `mapstructure:"warning_days"`
	ReminderDays    int `mapstructure:"reminder_days"`
}

type NotifyConfig struct {
	WeCom   WeComConfig   `mapstructure:"wecom"`
	Email   EmailConfig   `mapstructure:"email"`
	SMS     SMSConfig     `mapstructure:"sms"`
	Enabled []string      `mapstructure:"enabled"`
}

type WeComConfig struct {
	WebhookURL string `mapstructure:"webhook_url"`
}

type EmailConfig struct {
	SMTPHost string `mapstructure:"smtp_host"`
	SMTPPort int    `mapstructure:"smtp_port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
	To       []string `mapstructure:"to"`
}

type SMSConfig struct {
	APIKey    string   `mapstructure:"api_key"`
	APISecret string   `mapstructure:"api_secret"`
	Template  string   `mapstructure:"template"`
	Receivers []string `mapstructure:"receivers"`
}

type ScheduleConfig struct {
	SyncInterval    string `mapstructure:"sync_interval"`
	AlertCheckCron  string `mapstructure:"alert_check_cron"`
	HeartbeatCron   string `mapstructure:"heartbeat_cron"`
}

type DefaultConfig struct {
	DefaultAgent   string   `mapstructure:"default_agent"`
	EnterpriseFilter []string `mapstructure:"enterprise_filter"`
	PatentTypes    []string `mapstructure:"patent_types"`
}

type LogConfig struct {
	Level      string `mapstructure:"level"`
	Filename   string `mapstructure:"filename"`
	MaxSize    int    `mapstructure:"max_size"`
	MaxBackups int    `mapstructure:"max_backups"`
	MaxAge     int    `mapstructure:"max_age"`
	Compress   bool   `mapstructure:"compress"`
}

var AppConfig *Config
var Logger *zap.Logger

func Load(configPath string) (*Config, error) {
	v := viper.New()

	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(".")
		v.AddConfigPath("./config")
		v.AddConfigPath("/etc/patent-agent")
	}

	v.SetEnvPrefix("PATENT")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	setDefaults(v)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("read config failed: %w", err)
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config failed: %w", err)
	}

	AppConfig = &cfg
	return &cfg, nil
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("systems.cnipr.base_url", "https://cponline.cnipa.gov.cn")
	v.SetDefault("systems.cnipr.login_url", "https://cponline.cnipa.gov.cn/userLogin")
	v.SetDefault("systems.cnipr.timeout", 30)
	v.SetDefault("systems.cnipr.heartbeat_interval", 300)

	v.SetDefault("systems.cpquery.base_url", "https://cpquery.cnipa.gov.cn")
	v.SetDefault("systems.cpquery.login_url", "https://cpquery.cnipa.gov.cn/login")
	v.SetDefault("systems.cpquery.timeout", 30)
	v.SetDefault("systems.cpquery.heartbeat_interval", 300)

	v.SetDefault("systems.feequery.base_url", "https://fee.cnipa.gov.cn")
	v.SetDefault("systems.feequery.login_url", "https://fee.cnipa.gov.cn/login")
	v.SetDefault("systems.feequery.timeout", 30)
	v.SetDefault("systems.feequery.heartbeat_interval", 300)

	v.SetDefault("database.driver", "sqlite")
	v.SetDefault("database.dsn", "./data/patent.db")

	v.SetDefault("alert.overdue_risk_days", 3)
	v.SetDefault("alert.warning_days", 7)
	v.SetDefault("alert.reminder_days", 30)

	v.SetDefault("schedule.sync_interval", "1h")
	v.SetDefault("schedule.alert_check_cron", "0 */30 * * * *")
	v.SetDefault("schedule.heartbeat_cron", "0 */5 * * * *")

	v.SetDefault("log.level", "info")
	v.SetDefault("log.filename", "./logs/patent-agent.log")
	v.SetDefault("log.max_size", 100)
	v.SetDefault("log.max_backups", 30)
	v.SetDefault("log.max_age", 90)
	v.SetDefault("log.compress", true)
}

func InitLogger(cfg *LogConfig) (*zap.Logger, error) {
	if err := os.MkdirAll(filepath.Dir(cfg.Filename), 0755); err != nil {
		return nil, fmt.Errorf("create log dir failed: %w", err)
	}

	level := zapcore.InfoLevel
	switch strings.ToLower(cfg.Level) {
	case "debug":
		level = zapcore.DebugLevel
	case "warn":
		level = zapcore.WarnLevel
	case "error":
		level = zapcore.ErrorLevel
	}

	fileWriter := zapcore.AddSync(&lumberjack.Logger{
		Filename:   cfg.Filename,
		MaxSize:    cfg.MaxSize,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAge,
		Compress:   cfg.Compress,
	})

	consoleWriter := zapcore.AddSync(os.Stdout)

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder

	core := zapcore.NewTee(
		zapcore.NewCore(zapcore.NewJSONEncoder(encoderConfig), fileWriter, level),
		zapcore.NewCore(zapcore.NewConsoleEncoder(encoderConfig), consoleWriter, level),
	)

	Logger = zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	zap.ReplaceGlobals(Logger)
	return Logger, nil
}
