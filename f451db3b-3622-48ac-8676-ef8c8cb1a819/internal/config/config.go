// Package config is responsible for loading the YAML configuration that
// describes the pipeline network (stations, segments, contracts, thresholds),
// applying environment-variable overrides, validating it, supporting hot
// reloading on disk changes and recording an audit trail of every change.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"

	"scheduler/internal/models"
)

// AuditSink receives a single audit entry whenever a configuration change is
// persisted. The storage layer implements this interface so audit records land
// in SQLite without config having to depend on storage.
type AuditSink interface {
	WriteAudit(operator, action, detail string) error
}

// ServerConfig holds the Echo HTTP API settings.
type ServerConfig struct {
	Port         int           `yaml:"port"`
	ReadTimeout  time.Duration `yaml:"read_timeout"`
	WriteTimeout time.Duration `yaml:"write_timeout"`
}

// DatabaseConfig holds the SQLite connection settings.
type DatabaseConfig struct {
	Path         string `yaml:"path"`
	MaxOpenConns int    `yaml:"max_open_conns"`
}

// SCADAConfig holds the Modbus TCP polling settings.
type SCADAConfig struct {
	PollInterval time.Duration `yaml:"poll_interval"`
	Timeout      time.Duration `yaml:"timeout"`
	Retries      int           `yaml:"retries"`
	Simulate     bool          `yaml:"simulate"` // 无现场设备时使用模拟数据
}

// AlertConfig holds the pressure loss / imbalance warning thresholds.
type AlertConfig struct {
	PressureLossWarnPct  float64 `yaml:"pressure_loss_warn_pct"`
	PressureLossAlarmPct float64 `yaml:"pressure_loss_alarm_pct"`
	SafetyMarginFloor    float64 `yaml:"safety_margin_floor"` // MPa
	ImbalanceWarnPct     float64 `yaml:"imbalance_warn_pct"`  // %
	PressureAlarmHigh    float64 `yaml:"pressure_alarm_high"` // MPa
	PressureAlarmLow     float64 `yaml:"pressure_alarm_low"`  // MPa
}

// SourceConfig describes an upstream supply source for balance plans.
type SourceConfig struct {
	ID          string  `yaml:"id"`
	Name        string  `yaml:"name"`
	MaxPressure float64 `yaml:"max_pressure"`
	MaxFlow     float64 `yaml:"max_flow"`
	MinFlow     float64 `yaml:"min_flow"`
	CostPerUnit float64 `yaml:"cost_per_unit"`
}

// runtime holds the mutable, non-serialisable state of a Config. It is kept
// behind a pointer so that a Config value (and the snapshots handed to the
// calculation engines) can be copied freely without copying a lock.
type runtime struct {
	mu      sync.RWMutex
	path    string
	lastMod time.Time
	audit   AuditSink
	stopCh  chan struct{}
}

// Config is the fully resolved, in-memory configuration tree. The exported
// fields are the serialisable network description; the unexported rt pointer
// carries file/audit/watcher state.
type Config struct {
	Env       string                   `yaml:"env"`
	Server    ServerConfig             `yaml:"server"`
	Database  DatabaseConfig           `yaml:"database"`
	SCADA      SCADAConfig              `yaml:"scada"`
	Alerts    AlertConfig              `yaml:"alerts"`
	Stations  []models.Station         `yaml:"stations"`
	Pipelines []models.PipelineSegment `yaml:"pipelines"`
	Contracts []models.PriceContract   `yaml:"contracts"`
	Sources   []SourceConfig           `yaml:"sources"`
	rt        *runtime
}

// Load reads the YAML file at path, applies environment variable overrides,
// validates the result and returns a Config ready for use. The optional env
// argument selects a named environment block; when empty the top-level "env"
// field is kept as-is.
func Load(path, env string) (*Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}
	c := &Config{rt: &runtime{path: path, stopCh: make(chan struct{})}}
	if err := yaml.Unmarshal(raw, c); err != nil {
		return nil, fmt.Errorf("config file %s is corrupt: %w", path, err)
	}
	if env != "" {
		c.Env = env
	}
	applyEnvOverrides(c)
	if err := c.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}
	if fi, err := os.Stat(path); err == nil {
		c.rt.lastMod = fi.ModTime()
	}
	return c, nil
}

// Validate checks mandatory fields and value ranges so that a corrupted or
// incomplete config is rejected up front rather than crashing at runtime.
// It is safe to call on both live configs (with rt set) and snapshots
// (rt == nil).
func (c *Config) Validate() error {
	if c.rt != nil {
		c.rt.mu.RLock()
		defer c.rt.mu.RUnlock()
	}
	if c.Database.Path == "" {
		return fmt.Errorf("database.path is required")
	}
	if len(c.Stations) == 0 {
		return fmt.Errorf("at least one station must be configured")
	}
	ids := make(map[string]struct{}, len(c.Stations))
	for i := range c.Stations {
		s := &c.Stations[i]
		if s.ID == "" {
			return fmt.Errorf("station #%d missing id", i)
		}
		if _, dup := ids[s.ID]; dup {
			return fmt.Errorf("duplicate station id %s", s.ID)
		}
		ids[s.ID] = struct{}{}
		if s.PressureMax <= s.PressureMin {
			return fmt.Errorf("station %s pressure range invalid", s.ID)
		}
		if s.FlowMax <= s.FlowMin {
			return fmt.Errorf("station %s flow range invalid", s.ID)
		}
		if s.Address == "" && !c.SCADA.Simulate {
			return fmt.Errorf("station %s missing modbus address", s.ID)
		}
	}
	for i := range c.Pipelines {
		p := &c.Pipelines[i]
		if p.ID == "" {
			return fmt.Errorf("pipeline #%d missing id", i)
		}
		if p.Length <= 0 || p.Diameter <= 0 {
			return fmt.Errorf("pipeline %s length/diameter must be positive", p.ID)
		}
		switch p.Formula {
		case "weymouth", "panhandle", "":
		default:
			return fmt.Errorf("pipeline %s unknown formula %s", p.ID, p.Formula)
		}
	}
	if c.Alerts.PressureLossAlarmPct <= c.Alerts.PressureLossWarnPct {
		return fmt.Errorf("alert pressure_loss_alarm_pct must exceed warn pct")
	}
	return nil
}

// SetAuditSink wires an audit sink used when persisting changes.
func (c *Config) SetAuditSink(s AuditSink) {
	c.rt.mu.Lock()
	defer c.rt.mu.Unlock()
	c.rt.audit = s
}

// Snapshot returns a deep copy of the public configuration tree so callers
// cannot mutate the live tree by accident. The returned value has no runtime
// state and is safe to pass to the calculation engines.
func (c *Config) Snapshot() Config {
	c.rt.mu.RLock()
	defer c.rt.mu.RUnlock()
	return Config{
		Env:       c.Env,
		Server:    c.Server,
		Database:  c.Database,
		SCADA:      c.SCADA,
		Alerts:    c.Alerts,
		Stations:  append([]models.Station(nil), c.Stations...),
		Pipelines: append([]models.PipelineSegment(nil), c.Pipelines...),
		Contracts: append([]models.PriceContract(nil), c.Contracts...),
		Sources:   append([]SourceConfig(nil), c.Sources...),
	}
}

// ApplySnapshot copies the public fields from snap into the live config,
// replacing the current values. It is used to apply a modified snapshot back
// to the live configuration before saving.
func (c *Config) ApplySnapshot(snap Config) {
	c.rt.mu.Lock()
	defer c.rt.mu.Unlock()
	c.Env = snap.Env
	c.Server = snap.Server
	c.Database = snap.Database
	c.SCADA = snap.SCADA
	c.Alerts = snap.Alerts
	c.Stations = append([]models.Station(nil), snap.Stations...)
	c.Pipelines = append([]models.PipelineSegment(nil), snap.Pipelines...)
	c.Contracts = append([]models.PriceContract(nil), snap.Contracts...)
	c.Sources = append([]SourceConfig(nil), snap.Sources...)
}

// Save writes the current configuration back to disk as YAML and records an
// audit entry. It is the single entry point for configuration hot updates.
func (c *Config) Save(operator, reason string) error {
	c.rt.mu.RLock()
	snap := Config{
		Env: c.Env, Server: c.Server, Database: c.Database, SCADA: c.SCADA,
		Alerts: c.Alerts,
		Stations:  append([]models.Station(nil), c.Stations...),
		Pipelines: append([]models.PipelineSegment(nil), c.Pipelines...),
		Contracts: append([]models.PriceContract(nil), c.Contracts...),
		Sources:   append([]SourceConfig(nil), c.Sources...),
	}
	path := c.rt.path
	audit := c.rt.audit
	c.rt.mu.RUnlock()

	out, err := yaml.Marshal(snap)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o644); err != nil {
		return fmt.Errorf("write config tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("replace config: %w", err)
	}
	if fi, err := os.Stat(path); err == nil {
		c.rt.mu.Lock()
		c.rt.lastMod = fi.ModTime()
		c.rt.mu.Unlock()
	}
	if audit != nil {
		_ = audit.WriteAudit(operator, "config_change", reason)
	}
	return nil
}

// StartHotReload watches the config file for modifications and invokes cb with
// a fresh Config whenever it changes. It polls every interval to avoid extra
// platform-specific dependencies. Call StopHotReload to terminate the watcher.
func (c *Config) StartHotReload(interval time.Duration, cb func(*Config)) {
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-c.rt.stopCh:
				return
			case <-t.C:
				fi, err := os.Stat(c.rt.path)
				if err != nil {
					continue
				}
				c.rt.mu.RLock()
				prev := c.rt.lastMod
				env := c.Env
				audit := c.rt.audit
				c.rt.mu.RUnlock()
				if fi.ModTime().Equal(prev) {
					continue
				}
				next, err := Load(c.rt.path, env)
				if err != nil {
					continue
				}
				c.rt.mu.Lock()
				c.rt.lastMod = fi.ModTime()
				c.rt.mu.Unlock()
				next.SetAuditSink(audit)
				cb(next)
			}
		}
	}()
}

// StopHotReload terminates the background watcher goroutine.
func (c *Config) StopHotReload() {
	select {
	case <-c.rt.stopCh:
	default:
		close(c.rt.stopCh)
	}
}

// StationByID looks up a station by id from a snapshot.
func (c Config) StationByID(id string) (models.Station, bool) {
	for _, s := range c.Stations {
		if s.ID == id {
			return s, true
		}
	}
	return models.Station{}, false
}

// PipelineByID looks up a pipeline segment by id from a snapshot.
func (c Config) PipelineByID(id string) (models.PipelineSegment, bool) {
	for _, p := range c.Pipelines {
		if p.ID == id {
			return p, true
		}
	}
	return models.PipelineSegment{}, false
}

// applyEnvOverrides layers environment variables on top of the parsed YAML.
// Variables use the SCHEDULER_ prefix and dot-style names, e.g.
// SCHEDULER_DATABASE_PATH, SCHEDULER_SERVER_PORT, SCHEDULER_SCADA_SIMULATE,
// SCHEDULER_SCADA_POLL_SECONDS, SCHEDULER_SCADA_RETRIES.
func applyEnvOverrides(c *Config) {
	if v := os.Getenv("SCHEDULER_ENV"); v != "" {
		c.Env = v
	}
	if v := os.Getenv("SCHEDULER_DATABASE_PATH"); v != "" {
		c.Database.Path = v
	}
	if v := os.Getenv("SCHEDULER_SERVER_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil {
			c.Server.Port = port
		}
	}
	if v := os.Getenv("SCHEDULER_SCADA_SIMULATE"); v != "" {
		c.SCADA.Simulate = strings.EqualFold(v, "true") || v == "1"
	}
	if v := os.Getenv("SCHEDULER_SCADA_POLL_SECONDS"); v != "" {
		if secs, err := strconv.Atoi(v); err == nil {
			c.SCADA.PollInterval = time.Duration(secs) * time.Second
		}
	}
	if v := os.Getenv("SCHEDULER_SCADA_RETRIES"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.SCADA.Retries = n
		}
	}
}

// ResolvePath expands a leading "~" or makes a relative path absolute against
// the directory of the config file, which is convenient for CLI flags.
func (c *Config) ResolvePath(p string) string {
	if p == "" {
		return p
	}
	if strings.HasPrefix(p, "~") {
		if home, err := os.UserHomeDir(); err == nil {
			p = filepath.Join(home, p[1:])
		}
	}
	if filepath.IsAbs(p) {
		return p
	}
	base := "."
	if c.rt != nil && c.rt.path != "" {
		base = filepath.Dir(c.rt.path)
	}
	return filepath.Join(base, p)
}
