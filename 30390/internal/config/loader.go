package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type Manager struct {
	mu       sync.RWMutex
	config   *Config
	path     string
	watchers []func(*Config)
	ctx      context.Context
	cancel   context.CancelFunc
}

func NewManager(ctx context.Context, path string) *Manager {
	ctx, cancel := context.WithCancel(ctx)
	return &Manager{
		path:   path,
		ctx:    ctx,
		cancel: cancel,
	}
}

func (m *Manager) Load() (*Config, error) {
	if _, err := os.Stat(m.path); os.IsNotExist(err) {
		cfg := DefaultConfig()
		m.mu.Lock()
		m.config = cfg
		m.mu.Unlock()
		return cfg, nil
	}

	data, err := os.ReadFile(m.path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	cfg := DefaultConfig()
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validate config: %w", err)
	}

	if err := os.MkdirAll(cfg.DataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	m.mu.Lock()
	m.config = cfg
	m.mu.Unlock()

	return cfg, nil
}

func (m *Manager) Get() *Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.config
}

func (m *Manager) Save(cfg *Config) error {
	if err := cfg.Validate(); err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(m.path), 0755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	header := []byte("# gitmon configuration file\n# Generated at: " + time.Now().Format(time.RFC3339) + "\n\n")
	if err := os.WriteFile(m.path, append(header, data...), 0644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}

	m.mu.Lock()
	m.config = cfg
	m.mu.Unlock()

	m.notifyWatchers(cfg)
	return nil
}

func (m *Manager) SaveExample() error {
	if _, err := os.Stat(m.path); err == nil {
		return fmt.Errorf("config file already exists: %s", m.path)
	}

	cfg := &Config{
		Repos: []RepoConfig{
			{
				Name:   "example-service",
				Path:   "~/projects/example-service",
				Mode:   "worktree",
				Branch: "main",
				Owner:  "team-a",
			},
			{
				Name:   "api-gateway",
				Path:   "~/projects/api-gateway",
				Mode:   "worktree",
				Branch: "main",
				Owner:  "team-b",
			},
		},
		Scan:     DefaultConfig().Scan,
		Alert:    DefaultConfig().Alert,
		Server:   DefaultConfig().Server,
		Analyzer: DefaultConfig().Analyzer,
		Database: DefaultConfig().Database,
		DataDir:  DefaultConfig().DataDir,
	}

	return m.Save(cfg)
}

func (m *Manager) OnChange(fn func(*Config)) {
	m.mu.Lock()
	m.watchers = append(m.watchers, fn)
	m.mu.Unlock()
}

func (m *Manager) notifyWatchers(cfg *Config) {
	m.mu.RLock()
	watchers := make([]func(*Config), len(m.watchers))
	copy(watchers, m.watchers)
	m.mu.RUnlock()

	for _, fn := range watchers {
		go fn(cfg)
	}
}

func (m *Manager) StartHotReload(interval time.Duration) {
	go func() {
		var lastMod time.Time
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-m.ctx.Done():
				return
			case <-ticker.C:
				info, err := os.Stat(m.path)
				if err != nil {
					continue
				}
				if info.ModTime().After(lastMod) {
					lastMod = info.ModTime()
					if _, err := m.Load(); err != nil {
						log.Printf("config reload failed: %v", err)
					} else {
						log.Printf("config reloaded from %s", m.path)
						m.notifyWatchers(m.Get())
					}
				}
			}
		}
	}()
}

func (m *Manager) Close() {
	m.cancel()
}

func GetDefaultPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".gitmon", "config.yaml"), nil
}
