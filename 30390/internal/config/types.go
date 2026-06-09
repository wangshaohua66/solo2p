package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type RepoConfig struct {
	Name     string `yaml:"name"`
	Path     string `yaml:"path"`
	Mode     string `yaml:"mode"`
	Branch   string `yaml:"branch"`
	Owner    string `yaml:"owner"`
	Disabled bool   `yaml:"disabled"`
}

type ScanConfig struct {
	Concurrency int    `yaml:"concurrency"`
	WorkerCount int    `yaml:"worker_count"`
	Timeout     string `yaml:"timeout"`
	Incremental bool   `yaml:"incremental"`
	MaxCommits  int    `yaml:"max_commits"`
}

type AlertConfig struct {
	SilentDays          int      `yaml:"silent_days"`
	ComplexityThreshold int      `yaml:"complexity_threshold"`
	NotifyTargets       []string `yaml:"notify_targets"`
	NotifyChannels      []string `yaml:"notify_channels"`
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type NotifyConfig struct {
	Feishu   FeishuConfig   `yaml:"feishu"`
	Dingtalk DingtalkConfig `yaml:"dingtalk"`
}

type FeishuConfig struct {
	WebhookURL string `yaml:"webhook_url"`
	Secret     string `yaml:"secret"`
}

type DingtalkConfig struct {
	WebhookURL string `yaml:"webhook_url"`
	Secret     string `yaml:"secret"`
}

type AnalyzerConfig struct {
	TechDebtPatterns []string `yaml:"tech_debt_patterns"`
	ChurnWindow      int      `yaml:"churn_window"`
}

type Config struct {
	Repos    []RepoConfig   `yaml:"repos"`
	Scan     ScanConfig     `yaml:"scan"`
	Alert    AlertConfig    `yaml:"alert"`
	Server   ServerConfig   `yaml:"server"`
	Notify   NotifyConfig   `yaml:"notify"`
	Analyzer AnalyzerConfig `yaml:"analyzer"`
	Database string         `yaml:"database"`
	DataDir  string         `yaml:"data_dir"`
}

func DefaultConfig() *Config {
	home, _ := os.UserHomeDir()
	dataDir := filepath.Join(home, ".gitmon")
	return &Config{
		Repos: []RepoConfig{
			{
				Name:   "example-service",
				Path:   "~/projects/example-service",
				Mode:   "worktree",
				Branch: "main",
				Owner:  "team-a",
			},
		},
		Scan: ScanConfig{
			Concurrency: 20,
			WorkerCount: 4,
			Timeout:     "5m",
			Incremental: true,
			MaxCommits:  100000,
		},
		Alert: AlertConfig{
			SilentDays:          90,
			ComplexityThreshold: 15,
		},
		Server: ServerConfig{
			Host: "localhost",
			Port: 9876,
		},
		Analyzer: AnalyzerConfig{
			TechDebtPatterns: []string{"TODO", "FIXME", "HACK", "XXX", "BUG", "OPTIMIZE"},
			ChurnWindow:      90,
		},
		Database: filepath.Join(dataDir, "gitmon.db"),
		DataDir:  dataDir,
	}
}

func (c *Config) Validate() error {
	if len(c.Repos) == 0 {
		return errors.New("no repositories configured")
	}
	seen := make(map[string]bool)
	for i, repo := range c.Repos {
		if repo.Name == "" {
			return fmt.Errorf("repo at index %d: name is required", i)
		}
		if repo.Path == "" {
			return fmt.Errorf("repo %s: path is required", repo.Name)
		}
		if repo.Mode != "" && repo.Mode != "worktree" && repo.Mode != "bare" {
			return fmt.Errorf("repo %s: mode must be 'worktree' or 'bare'", repo.Name)
		}
		if seen[repo.Name] {
			return fmt.Errorf("duplicate repo name: %s", repo.Name)
		}
		seen[repo.Name] = true
	}
	if c.Scan.Concurrency < 1 {
		return errors.New("scan concurrency must be at least 1")
	}
	if c.Scan.WorkerCount < 1 {
		return errors.New("scan worker count must be at least 1")
	}
	if _, err := time.ParseDuration(c.Scan.Timeout); err != nil {
		return fmt.Errorf("invalid scan timeout: %w", err)
	}
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return errors.New("server port must be between 1 and 65535")
	}
	if c.Alert.SilentDays < 1 {
		return errors.New("alert silent days must be at least 1")
	}
	if c.Alert.ComplexityThreshold < 1 {
		return errors.New("complexity threshold must be at least 1")
	}
	return nil
}
