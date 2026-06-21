package config

import (
	"fmt"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
)

type Institution struct {
	ID          string `mapstructure:"id"`
	Name        string `mapstructure:"name"`
	Type        string `mapstructure:"type"`
	Contact     string `mapstructure:"contact"`
	Email       string `mapstructure:"email"`
	Phone       string `mapstructure:"phone"`
	ClearAccount string `mapstructure:"clear_account"`
}

type MatchRule struct {
	Fields       []string               `mapstructure:"fields"`
	Weights      map[string]int         `mapstructure:"weights"`
	Tolerance    map[string]interface{} `mapstructure:"tolerance"`
	TimeoutHours int                    `mapstructure:"timeout_hours"`
	AllowOneSided bool                  `mapstructure:"allow_one_sided"`
}

type ReconcileConfig struct {
	DefaultRule MatchRule             `mapstructure:"default_rule"`
	ByInstitution map[string]MatchRule `mapstructure:"by_institution"`
	ByBizType     map[string]MatchRule `mapstructure:"by_biz_type"`
}

type ToleranceConfig struct {
	Mode        string  `mapstructure:"mode"`
	FixedAmount float64 `mapstructure:"fixed_amount"`
	Percentage  float64 `mapstructure:"percentage"`
	MaxAmount   float64 `mapstructure:"max_amount"`
}

type DatabaseConfig struct {
	Path string `mapstructure:"path"`
}

type NotifyConfig struct {
	SMTP SMTPConfig `mapstructure:"smtp"`
	SMS  SMSConfig  `mapstructure:"sms"`
}

type SMTPConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
}

type SMSConfig struct {
	APIKey    string `mapstructure:"api_key"`
	APISecret string `mapstructure:"api_secret"`
	Gateway   string `mapstructure:"gateway"`
	Sign      string `mapstructure:"sign"`
}

type SettlementConfig struct {
	Cycle         string   `mapstructure:"cycle"`
	Currencies    []string `mapstructure:"currencies"`
	InstructionFormat string `mapstructure:"instruction_format"`
	OutputDir     string   `mapstructure:"output_dir"`
	Deadline      string   `mapstructure:"deadline"`
}

type ReportConfig struct {
	OutputDir string `mapstructure:"output_dir"`
	Template  string `mapstructure:"template"`
}

type ParseProgress struct {
	FileHash   string `mapstructure:"file_hash"`
	LastLine   int64  `mapstructure:"last_line"`
	UpdateTime string `mapstructure:"update_time"`
}

type AppConfig struct {
	Institutions []Institution     `mapstructure:"institutions"`
	Reconcile    ReconcileConfig   `mapstructure:"reconcile"`
	Database     DatabaseConfig    `mapstructure:"database"`
	Notify       NotifyConfig      `mapstructure:"notify"`
	Settlement   SettlementConfig  `mapstructure:"settlement"`
	Report       ReportConfig      `mapstructure:"report"`
	Progresses   map[string]ParseProgress `mapstructure:"progresses"`
	viper        *viper.Viper
	mu           sync.RWMutex
}

var globalConfig *AppConfig

func Load(configPath string) (*AppConfig, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")

	v.SetDefault("database.path", "data/clear.db")
	v.SetDefault("settlement.cycle", "daily")
	v.SetDefault("settlement.currencies", []string{"CNY"})
	v.SetDefault("settlement.instruction_format", "cfca")
	v.SetDefault("settlement.output_dir", "output/instructions")
	v.SetDefault("settlement.deadline", "18:30")
	v.SetDefault("report.output_dir", "output/reports")

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			return createDefaultConfig(v), nil
		}
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	cfg := &AppConfig{viper: v}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}
	cfg.viper = v

	cfg.watchConfig()
	globalConfig = cfg
	return cfg, nil
}

func createDefaultConfig(v *viper.Viper) *AppConfig {
	cfg := &AppConfig{
		viper: v,
		Institutions: []Institution{},
		Reconcile: ReconcileConfig{
			DefaultRule: MatchRule{
				Fields: []string{"biz_no", "amount", "currency", "biz_date"},
				Weights: map[string]int{
					"biz_no":   40,
					"amount":   30,
					"currency": 15,
					"biz_date": 15,
				},
				Tolerance: map[string]interface{}{
					"mode":         "fixed",
					"fixed_amount": 0.01,
					"max_amount":   1.00,
				},
				TimeoutHours:  24,
				AllowOneSided: true,
			},
			ByInstitution: map[string]MatchRule{},
			ByBizType: map[string]MatchRule{},
		},
		Database:   DatabaseConfig{Path: "data/clear.db"},
		Settlement: SettlementConfig{
			Cycle:             "daily",
			Currencies:        []string{"CNY"},
			InstructionFormat: "cfca",
			OutputDir:         "output/instructions",
			Deadline:          "18:30",
		},
		Report: ReportConfig{
			OutputDir: "output/reports",
		},
		Progresses: map[string]ParseProgress{},
	}
	globalConfig = cfg
	return cfg
}

func (c *AppConfig) watchConfig() {
	c.viper.OnConfigChange(func(e fsnotify.Event) {
		c.mu.Lock()
		defer c.mu.Unlock()
		if err := c.viper.Unmarshal(c); err != nil {
			fmt.Printf("热加载配置失败: %v\n", err)
			return
		}
		fmt.Printf("配置文件已更新: %s\n", e.Name)
	})
	c.viper.WatchConfig()
}

func Get() *AppConfig {
	if globalConfig == nil {
		globalConfig = createDefaultConfig(viper.New())
	}
	return globalConfig
}

func (c *AppConfig) GetInstitution(id string) *Institution {
	c.mu.RLock()
	defer c.mu.RUnlock()
	for i := range c.Institutions {
		if c.Institutions[i].ID == id {
			return &c.Institutions[i]
		}
	}
	return nil
}

func (c *AppConfig) GetMatchRule(instID, bizType string) MatchRule {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if rule, ok := c.Reconcile.ByInstitution[instID]; ok {
		return rule
	}
	if rule, ok := c.Reconcile.ByBizType[bizType]; ok {
		return rule
	}
	return c.Reconcile.DefaultRule
}

func (c *AppConfig) SaveProgress(fileHash string, lastLine int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.Progresses == nil {
		c.Progresses = map[string]ParseProgress{}
	}
	c.Progresses[fileHash] = ParseProgress{
		FileHash:   fileHash,
		LastLine:   lastLine,
		UpdateTime: "",
	}
}

func (c *AppConfig) GetProgress(fileHash string) (int64, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	p, ok := c.Progresses[fileHash]
	if !ok {
		return 0, false
	}
	return p.LastLine, true
}
