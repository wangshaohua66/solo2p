package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"grain-monitor/models"
)

type Config struct {
	Sites        []models.SiteConfig  `json:"sites"`
	AlertRules   []models.AlertRule   `json:"alert_rules"`
	SMTPConfig   SMTPConfig           `json:"smtp"`
	DatabasePath string               `json:"database_path"`
	CookieDir    string               `json:"cookie_dir"`
	ReportDir    string               `json:"report_dir"`
	PoolSize     int                  `json:"pool_size"`
	CollectCron  string               `json:"collect_cron"`
	ReportCron   string               `json:"report_cron"`
}

type SMTPConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	From     string `json:"from"`
	To       []string `json:"to"`
	Enabled  bool   `json:"enabled"`
}

var globalConfig *Config

func Load(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			cfg := getDefaultConfig()
			if err := Save(configPath, cfg); err != nil {
				return nil, fmt.Errorf("save default config failed: %w", err)
			}
			globalConfig = cfg
			return cfg, nil
		}
		return nil, fmt.Errorf("read config failed: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config failed: %w", err)
	}

	if err := ensureDirs(&cfg); err != nil {
		return nil, err
	}

	globalConfig = &cfg
	return &cfg, nil
}

func Save(configPath string, cfg *Config) error {
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func Get() *Config {
	return globalConfig
}

func ensureDirs(cfg *Config) error {
	dirs := []string{cfg.CookieDir, cfg.ReportDir, filepath.Dir(cfg.DatabasePath)}
	for _, dir := range dirs {
		if dir == "" {
			continue
		}
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create dir %s failed: %w", dir, err)
		}
	}
	return nil
}

func getDefaultConfig() *Config {
	return &Config{
		Sites:        getDefaultSites(),
		AlertRules:   getDefaultAlertRules(),
		SMTPConfig:   getDefaultSMTP(),
		DatabasePath: "./data/grain.db",
		CookieDir:    "./data/cookies",
		ReportDir:    "./data/reports",
		PoolSize:     5,
		CollectCron:  "*/30 * * * *",
		ReportCron:   "0 18 * * 1-5",
	}
}

func getDefaultSites() []models.SiteConfig {
	return []models.SiteConfig{
		{
			ID:                "czce",
			Name:              "郑州商品交易所",
			BaseURL:           "http://www.czce.com.cn",
			LoginURL:          "http://www.czce.com.cn/cn/login.html",
			RequiresLogin:     false,
			CollectInterval:   30,
			TimeoutSeconds:    30,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"wheat_futures": {
					URL:          "http://www.czce.com.cn/cn/jysj/qhjysj/index.htm",
					WaitSelector: ".table-data",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".table-data tr:nth-child(2) td:nth-child(3)",
						"change": ".table-data tr:nth-child(2) td:nth-child(5)",
						"volume": ".table-data tr:nth-child(2) td:nth-child(7)",
						"high":   ".table-data tr:nth-child(2) td:nth-child(4)",
						"low":    ".table-data tr:nth-child(2) td:nth-child(6)",
					},
				},
			},
		},
		{
			ID:                "dce",
			Name:              "大连商品交易所",
			BaseURL:           "http://www.dce.com.cn",
			LoginURL:          "http://www.dce.com.cn/dalianshangpin/xqzx/index.html",
			RequiresLogin:     false,
			CollectInterval:   30,
			TimeoutSeconds:    30,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"corn_futures": {
					URL:          "http://www.dce.com.cn/dalianshangpin/zt/qhq/index.html",
					WaitSelector: ".data-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".data-table tr:nth-child(3) td:nth-child(3)",
						"change": ".data-table tr:nth-child(3) td:nth-child(5)",
						"volume": ".data-table tr:nth-child(3) td:nth-child(7)",
					},
				},
				"soybean_futures": {
					URL:          "http://www.dce.com.cn/dalianshangpin/zt/yc/index.html",
					WaitSelector: ".data-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".data-table tr:nth-child(2) td:nth-child(3)",
						"change": ".data-table tr:nth-child(2) td:nth-child(5)",
						"volume": ".data-table tr:nth-child(2) td:nth-child(7)",
					},
				},
			},
		},
		{
			ID:                "grain-trade-center",
			Name:              "国家粮食交易中心",
			BaseURL:           "http://www.grain.com.cn",
			LoginURL:          "http://www.grain.com.cn/login",
			RequiresLogin:     true,
			UsernameSelector:  "#username",
			PasswordSelector:  "#password",
			SubmitSelector:    "#loginBtn",
			LoginCheckSelector: ".user-info",
			CollectInterval:   60,
			TimeoutSeconds:    45,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"rice_spot": {
					URL:          "http://www.grain.com.cn/trade/rice",
					WaitSelector: ".trade-table",
					WaitType:     "visible",
					NeedScroll:   true,
					DataSelectors: map[string]string{
						"price":  ".trade-table tr:nth-child(2) td:nth-child(4)",
						"volume": ".trade-table tr:nth-child(2) td:nth-child(6)",
						"change": ".trade-table tr:nth-child(2) td:nth-child(5)",
					},
				},
				"policy": {
					URL:         "http://www.grain.com.cn/policy",
					WaitSelector: ".policy-list",
					WaitType:     "visible",
					IsPolicyPage: true,
					PolicyKeywords: []string{"轮换", "收储", "补贴", "政策", "通知", "公告"},
					DataSelectors: map[string]string{
						"title": ".policy-list li a",
						"date":  ".policy-list li span.date",
					},
				},
			},
		},
		{
			ID:                "zhonghua-grain",
			Name:              "中华粮网",
			BaseURL:           "http://www.cngrain.com",
			LoginURL:          "http://www.cngrain.com/member/login.aspx",
			RequiresLogin:     false,
			CollectInterval:   45,
			TimeoutSeconds:    30,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"wheat_spot": {
					URL:          "http://www.cngrain.com/price/wheat.html",
					WaitSelector: ".price-table",
					WaitType:     "visible",
					UseIframe:    false,
					DataSelectors: map[string]string{
						"price":  ".price-table tr:nth-child(2) td:nth-child(3)",
						"change": ".price-table tr:nth-child(2) td:nth-child(4)",
						"high":   ".price-table tr:nth-child(2) td:nth-child(5)",
						"low":    ".price-table tr:nth-child(2) td:nth-child(6)",
					},
				},
				"rice_spot": {
					URL:          "http://www.cngrain.com/price/rice.html",
					WaitSelector: ".price-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".price-table tr:nth-child(2) td:nth-child(3)",
						"change": ".price-table tr:nth-child(2) td:nth-child(4)",
					},
				},
				"corn_spot": {
					URL:          "http://www.cngrain.com/price/corn.html",
					WaitSelector: ".price-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".price-table tr:nth-child(2) td:nth-child(3)",
						"change": ".price-table tr:nth-child(2) td:nth-child(4)",
					},
				},
			},
		},
		{
			ID:                "shfe",
			Name:              "上海期货交易所",
			BaseURL:           "http://www.shfe.com.cn",
			LoginURL:          "",
			RequiresLogin:     false,
			CollectInterval:   30,
			TimeoutSeconds:    30,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"soybean_oil": {
					URL:          "http://www.shfe.com.cn/statements/dataview.html?paramid=kx",
					WaitSelector: ".t-data",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".t-data tr:nth-child(2) td:nth-child(3)",
						"change": ".t-data tr:nth-child(2) td:nth-child(5)",
						"volume": ".t-data tr:nth-child(2) td:nth-child(7)",
					},
				},
			},
		},
		{
			ID:                "zggrain",
			Name:              "中国粮食网",
			BaseURL:           "http://www.zggrain.com",
			LoginURL:          "",
			RequiresLogin:     false,
			CollectInterval:   60,
			TimeoutSeconds:    30,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"wheat_spot": {
					URL:          "http://www.zggrain.com/market/wheat",
					WaitSelector: ".market-table",
					WaitType:     "visible",
					NeedScroll:   true,
					DataSelectors: map[string]string{
						"price":  ".market-table tr:nth-child(2) td:nth-child(3)",
						"volume": ".market-table tr:nth-child(2) td:nth-child(6)",
						"change": ".market-table tr:nth-child(2) td:nth-child(5)",
					},
				},
				"corn_spot": {
					URL:          "http://www.zggrain.com/market/corn",
					WaitSelector: ".market-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".market-table tr:nth-child(2) td:nth-child(3)",
						"change": ".market-table tr:nth-child(2) td:nth-child(5)",
					},
				},
			},
		},
		{
			ID:                "ncggrain",
			Name:              "南方粮食交易市场",
			BaseURL:           "http://www.ncggrain.com",
			LoginURL:          "http://www.ncggrain.com/login",
			RequiresLogin:     false,
			CollectInterval:   60,
			TimeoutSeconds:    30,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"rice_spot": {
					URL:          "http://www.ncggrain.com/trade/rice",
					WaitSelector: ".table-responsive table",
					WaitType:     "visible",
					UseIframe:    false,
					DataSelectors: map[string]string{
						"price":  ".table-responsive tr:nth-child(2) td:nth-child(4)",
						"change": ".table-responsive tr:nth-child(2) td:nth-child(5)",
						"volume": ".table-responsive tr:nth-child(2) td:nth-child(6)",
					},
				},
			},
		},
		{
			ID:                "yifumi",
			Name:              "壹期货",
			BaseURL:           "http://www.yifumi.com.cn",
			LoginURL:          "",
			RequiresLogin:     false,
			CollectInterval:   30,
			TimeoutSeconds:    30,
			MaxRetries:        3,
			Enabled:           true,
			PageConfigs: map[string]models.PageConfig{
				"wheat_futures": {
					URL:          "http://www.yifumi.com.cn/quote/wh",
					WaitSelector: ".quote-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".quote-table tr:nth-child(2) td:nth-child(3)",
						"change": ".quote-table tr:nth-child(2) td:nth-child(4)",
						"volume": ".quote-table tr:nth-child(2) td:nth-child(8)",
						"high":   ".quote-table tr:nth-child(2) td:nth-child(5)",
						"low":    ".quote-table tr:nth-child(2) td:nth-child(6)",
					},
				},
				"corn_futures": {
					URL:          "http://www.yifumi.com.cn/quote/c",
					WaitSelector: ".quote-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".quote-table tr:nth-child(2) td:nth-child(3)",
						"change": ".quote-table tr:nth-child(2) td:nth-child(4)",
						"volume": ".quote-table tr:nth-child(2) td:nth-child(8)",
					},
				},
				"soybean_futures": {
					URL:          "http://www.yifumi.com.cn/quote/m",
					WaitSelector: ".quote-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".quote-table tr:nth-child(2) td:nth-child(3)",
						"change": ".quote-table tr:nth-child(2) td:nth-child(4)",
						"volume": ".quote-table tr:nth-child(2) td:nth-child(8)",
					},
				},
				"rice_futures": {
					URL:          "http://www.yifumi.com.cn/quote/lr",
					WaitSelector: ".quote-table",
					WaitType:     "visible",
					DataSelectors: map[string]string{
						"price":  ".quote-table tr:nth-child(2) td:nth-child(3)",
						"change": ".quote-table tr:nth-child(2) td:nth-child(4)",
						"volume": ".quote-table tr:nth-child(2) td:nth-child(8)",
					},
				},
			},
		},
	}
}

func getDefaultAlertRules() []models.AlertRule {
	grains := []models.GrainType{models.Wheat, models.Rice, models.Corn, models.Soybean}
	rules := make([]models.AlertRule, 0, len(grains)*2)

	for _, g := range grains {
		rules = append(rules, models.AlertRule{
			ID:        fmt.Sprintf("price_change_3pct_%s", g),
			Name:      fmt.Sprintf("%s日内涨跌幅超3%%告警", models.GrainNames[g]),
			Type:      "price_change",
			GrainType: g,
			PriceType: models.FuturesPrice,
			Threshold: 3.0,
			Direction: "both",
			Enabled:   true,
		})
		rules = append(rules, models.AlertRule{
			ID:        fmt.Sprintf("trend_2pct_3h_%s", g),
			Name:      fmt.Sprintf("%s连续3小时波动超2%%告警", models.GrainNames[g]),
			Type:      "trend_change",
			GrainType: g,
			PriceType: models.FuturesPrice,
			Threshold: 2.0,
			Direction: "both",
			Enabled:   true,
		})
	}

	rules = append(rules, models.AlertRule{
		ID:        "policy_news",
		Name:      "政策公告关键词告警",
		Type:      "policy_keyword",
		Threshold: 0,
		Direction: "both",
		Enabled:   true,
	})

	return rules
}

func getDefaultSMTP() SMTPConfig {
	return SMTPConfig{
		Host:     "smtp.example.com",
		Port:     587,
		Username: "alerts@example.com",
		Password: "password",
		From:     "alerts@example.com",
		To:       []string{"admin@example.com"},
		Enabled:  false,
	}
}
