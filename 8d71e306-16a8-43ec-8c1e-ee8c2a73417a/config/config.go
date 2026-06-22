package config

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type Config struct {
	BaseURL         string `json:"base_url"`
	LoginURL        string `json:"login_url"`
	BidListURL      string `json:"bid_list_url"`
	Username        string `json:"username"`
	Password        string `json:"password"`
	CaptchaMode     string `json:"captcha_mode"`

	DownloadDir     string `json:"download_dir"`
	DBPath          string `json:"db_path"`
	LogDir          string `json:"log_dir"`

	Concurrency     int           `json:"concurrency"`
	DownloadTimeout time.Duration `json:"download_timeout"`
	MaxRetry        int           `json:"max_retry"`
	MinInterval     int           `json:"min_interval"`
	MaxInterval     int           `json:"max_interval"`
	MaxTabs         int           `json:"max_tabs"`

	WarnDays        int           `json:"warn_days"`
	SessionTTL      time.Duration `json:"session_ttl"`
	KeepAliveInterval time.Duration `json:"keep_alive_interval"`

	Incremental     bool          `json:"incremental"`
	Headless        bool          `json:"headless"`

	ProjectID       string `json:"-"`
	Mode            string `json:"-"`
	ShowProgress    bool   `json:"-"`
	ShowStats       bool   `json:"-"`
	RetryFailed     bool   `json:"-"`
}

var GlobalConfig *Config
var Logger *zap.Logger

func Load() (*Config, error) {
	cfg := &Config{
		BaseURL:            "https://ggzy.example.gov.cn",
		LoginURL:           "https://ggzy.example.gov.cn/login",
		BidListURL:         "https://ggzy.example.gov.cn/bid/list",
		Username:           os.Getenv("BID_USERNAME"),
		Password:           os.Getenv("BID_PASSWORD"),
		CaptchaMode:        "manual",
		DownloadDir:        "./downloads",
		DBPath:             "./data/bid_crawler.db",
		LogDir:             "./logs",
		Concurrency:        3,
		DownloadTimeout:    30 * time.Second,
		MaxRetry:           3,
		MinInterval:        2,
		MaxInterval:        5,
		MaxTabs:            5,
		WarnDays:           30,
		SessionTTL:         30 * time.Minute,
		KeepAliveInterval:  10 * time.Minute,
		Incremental:        true,
		Headless:           true,
		ShowProgress:       true,
	}

	configPath := "./config.json"
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(data, cfg); err != nil {
			return nil, err
		}
	}

	parseFlags(cfg)

	if err := os.MkdirAll(cfg.DownloadDir, 0755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(cfg.LogDir, 0755); err != nil {
		return nil, err
	}

	GlobalConfig = cfg
	return cfg, nil
}

func parseFlags(cfg *Config) {
	flag.StringVar(&cfg.Mode, "mode", "interactive", "运行模式: interactive 或 batch")
	flag.StringVar(&cfg.ProjectID, "project", "", "招标项目编号 (批处理模式必填)")
	flag.StringVar(&cfg.DownloadDir, "dir", cfg.DownloadDir, "下载目录")
	flag.IntVar(&cfg.Concurrency, "concurrency", cfg.Concurrency, "并发下载线程数")
	flag.BoolVar(&cfg.ShowProgress, "progress", cfg.ShowProgress, "显示进度条")
	flag.BoolVar(&cfg.ShowStats, "stats", false, "显示统计报表")
	flag.BoolVar(&cfg.RetryFailed, "retry", false, "重试失败的下载")
	flag.BoolVar(&cfg.Incremental, "incremental", cfg.Incremental, "增量更新模式")
	flag.BoolVar(&cfg.Headless, "headless", cfg.Headless, "无头模式")
	flag.Parse()
}

func InitLogger() (*zap.Logger, error) {
	logPath := filepath.Join(GlobalConfig.LogDir, time.Now().Format("2006-01-02")+".log")

	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.TimeKey = "time"
	encoderConfig.LevelKey = "level"
	encoderConfig.MessageKey = "msg"
	encoderConfig.CallerKey = "caller"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder

	fileCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(file),
		zap.InfoLevel,
	)

	consoleConfig := zap.NewDevelopmentEncoderConfig()
	consoleConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	consoleCore := zapcore.NewCore(
		zapcore.NewConsoleEncoder(consoleConfig),
		zapcore.AddSync(os.Stdout),
		zap.InfoLevel,
	)

	core := zapcore.NewTee(fileCore, consoleCore)
	Logger = zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))
	zap.ReplaceGlobals(Logger)

	return Logger, nil
}
