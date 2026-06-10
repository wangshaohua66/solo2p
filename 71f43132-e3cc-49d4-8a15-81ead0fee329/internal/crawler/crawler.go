package crawler

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gocolly/colly/v2"
	"github.com/robfig/cron/v3"

	"github.com/security/vulnmonitor/internal/logger"
	"github.com/security/vulnmonitor/internal/retry"
	"github.com/security/vulnmonitor/internal/storage"
)

type Config struct {
	Concurrency    int            `yaml:"concurrency"`
	RequestTimeout int            `yaml:"request_timeout_seconds"`
	RequestDelay   int            `yaml:"request_delay_ms"`
	RandomDelay    int            `yaml:"random_delay_ms"`
	UserAgent      string         `yaml:"user_agent"`
	CronSchedule   string         `yaml:"cron_schedule"`
	Sources        []SourceConfig `yaml:"sources"`
}

type SourceConfig struct {
	ID       string                 `yaml:"id"`
	Name     string                 `yaml:"name"`
	Type     string                 `yaml:"type"`
	Enabled  bool                   `yaml:"enabled"`
	URL      string                 `yaml:"url"`
	APIToken string                 `yaml:"api_token,omitempty"`
	Config   map[string]interface{} `yaml:"config,omitempty"`
	Cron     string                 `yaml:"cron,omitempty"`
}

type Crawler interface {
	ID() string
	Name() string
	Fetch(ctx context.Context, fullRefresh bool) ([]*storage.Vulnerability, error)
	Collector() *colly.Collector
}

type BaseCrawler struct {
	id      string
	name    string
	cfg     SourceConfig
	col     *colly.Collector
	log     *logger.Logger
	retryer *retry.Retryer
}

type Manager struct {
	cfg      Config
	log      *logger.Logger
	retryer  *retry.Retryer
	store    *storage.Storage
	crawlers map[string]Crawler
	cron     *cron.Cron
	mu       sync.RWMutex
	results  chan *FetchResult
}

type FetchResult struct {
	SourceID    string
	SourceName  string
	Vulns       []*storage.Vulnerability
	Error       error
	Duration    time.Duration
	Status      storage.SourceStatus
	FullRefresh bool
}

func NewBaseCrawler(id, name string, cfg SourceConfig, log *logger.Logger, retryer *retry.Retryer) *BaseCrawler {
	if log == nil {
		log = logger.Default()
	}
	if retryer == nil {
		retryer = retry.New(retry.DefaultConfig(), log)
	}

	col := colly.NewCollector(
		colly.UserAgent(cfgOrDefault(cfg, "User-Agent", "VulnMonitor/1.0")),
		colly.AllowURLRevisit(),
		colly.IgnoreRobotsTxt(),
		colly.Async(true),
	)

	timeout := cfgInt(cfg, "timeout_seconds", 30)
	col.SetRequestTimeout(time.Duration(timeout) * time.Second)

	col.WithTransport(&http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
	})

	delay := cfgInt(cfg, "delay_ms", 1000)
	randomDelay := cfgInt(cfg, "random_delay_ms", 500)
	col.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Delay:       time.Duration(delay) * time.Millisecond,
		RandomDelay: time.Duration(randomDelay) * time.Millisecond,
		Parallelism: cfgInt(cfg, "parallelism", 2),
	})

	return &BaseCrawler{
		id:      id,
		name:    name,
		cfg:     cfg,
		col:     col,
		log:     log,
		retryer: retryer,
	}
}

func (b *BaseCrawler) ID() string   { return b.id }
func (b *BaseCrawler) Name() string { return b.name }
func (b *BaseCrawler) Collector() *colly.Collector { return b.col }

func (b *BaseCrawler) OnError(r *colly.Response, err error) {
	b.log.Warnf("crawler %s request error: %v, url: %s", b.id, err, r.Request.URL)
}

func NewManager(cfg Config, log *logger.Logger, retryer *retry.Retryer, store *storage.Storage) *Manager {
	if log == nil {
		log = logger.Default()
	}
	if retryer == nil {
		retryer = retry.New(retry.DefaultConfig(), log)
	}

	if cfg.Concurrency == 0 {
		cfg.Concurrency = 16
	}

	m := &Manager{
		cfg:      cfg,
		log:      log,
		retryer:  retryer,
		store:    store,
		crawlers: make(map[string]Crawler),
		results:  make(chan *FetchResult, 100),
	}

	m.cron = cron.New(
		cron.WithParser(cron.NewParser(
			cron.SecondOptional | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow,
		)),
	)

	for _, src := range cfg.Sources {
		if !src.Enabled {
			continue
		}

		crawler, err := m.createCrawler(src)
		if err != nil {
			log.Errorf("failed to create crawler %s: %v", src.ID, err)
			continue
		}

		m.crawlers[src.ID] = crawler

		srcStatus := storage.SourceStatusOK
		if err := store.SaveSource(context.Background(), &storage.Source{
			ID:      src.ID,
			Name:    src.Name,
			Type:    src.Type,
			URL:     src.URL,
			Enabled: src.Enabled,
			Status:  srcStatus,
		}); err != nil {
			log.Errorf("failed to save source %s: %v", src.ID, err)
		}

		schedule := src.Cron
		if schedule == "" {
			schedule = cfg.CronSchedule
		}
		if schedule != "" {
			srcID := src.ID
			if _, err := m.cron.AddFunc(schedule, func() {
				m.TriggerFetch(context.Background(), srcID, false)
			}); err != nil {
				log.Errorf("failed to schedule crawler %s: %v", src.ID, err)
			}
		}
	}

	return m
}

func (m *Manager) createCrawler(cfg SourceConfig) (Crawler, error) {
	switch cfg.Type {
	case "nvd":
		return NewNVDCrawler(cfg, m.log, m.retryer), nil
	case "github":
		return NewGitHubCrawler(cfg, m.log, m.retryer), nil
	case "apache":
		return NewApacheCrawler(cfg, m.log, m.retryer), nil
	case "ubuntu":
		return NewUbuntuCrawler(cfg, m.log, m.retryer), nil
	case "mysql":
		return NewMySQLCrawler(cfg, m.log, m.retryer), nil
	case "postgresql":
		return NewPostgreSQLCrawler(cfg, m.log, m.retryer), nil
	case "redis":
		return NewRedisCrawler(cfg, m.log, m.retryer), nil
	case "kafka":
		return NewKafkaCrawler(cfg, m.log, m.retryer), nil
	default:
		return nil, fmt.Errorf("unknown crawler type: %s", cfg.Type)
	}
}

func (m *Manager) Start() {
	m.cron.Start()
	m.log.Info("crawler manager started with %d sources", len(m.crawlers))
}

func (m *Manager) Stop() {
	m.cron.Stop()
	close(m.results)
	m.log.Info("crawler manager stopped")
}

func (m *Manager) Results() <-chan *FetchResult {
	return m.results
}

func (m *Manager) TriggerFetch(ctx context.Context, sourceID string, fullRefresh bool) {
	m.mu.RLock()
	crawler, ok := m.crawlers[sourceID]
	m.mu.RUnlock()

	if !ok {
		m.log.Warnf("crawler %s not found", sourceID)
		return
	}

	go m.fetchSource(ctx, crawler, fullRefresh)
}

func (m *Manager) TriggerAll(ctx context.Context, fullRefresh bool) {
	m.mu.RLock()
	ids := make([]string, 0, len(m.crawlers))
	for id := range m.crawlers {
		ids = append(ids, id)
	}
	m.mu.RUnlock()

	sem := make(chan struct{}, m.cfg.Concurrency)
	var wg sync.WaitGroup

	for _, id := range ids {
		wg.Add(1)
		go func(sourceID string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			m.TriggerFetch(ctx, sourceID, fullRefresh)
		}(id)
	}

	wg.Wait()
}

func (m *Manager) fetchSource(ctx context.Context, crawler Crawler, fullRefresh bool) {
	start := time.Now()
	sourceID := crawler.ID()

	m.log.Infof("starting crawl for %s (full=%v)", sourceID, fullRefresh)

	vulns, err := crawler.Fetch(ctx, fullRefresh)
	duration := time.Since(start)

	status := storage.SourceStatusOK
	errMsg := ""
	if err != nil {
		status = storage.SourceStatusError
		errMsg = err.Error()
		m.log.Errorf("crawl %s failed after %v: %v", sourceID, duration, err)
	} else if len(vulns) == 0 {
		status = storage.SourceStatusDegraded
		m.log.Warnf("crawl %s returned 0 results after %v", sourceID, duration)
	} else {
		m.log.Infof("crawl %s completed: %d vulns in %v", sourceID, len(vulns), duration)
	}

	if m.store != nil {
		if err := m.store.UpdateSourceStatus(ctx, sourceID, status, errMsg, err == nil); err != nil {
			m.log.Warnf("failed to update source status: %v", err)
		}
	}

	m.results <- &FetchResult{
		SourceID:    sourceID,
		SourceName:  crawler.Name(),
		Vulns:       vulns,
		Error:       err,
		Duration:    duration,
		Status:      status,
		FullRefresh: fullRefresh,
	}
}

func (m *Manager) GetCrawler(id string) (Crawler, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.crawlers[id]
	return c, ok
}

func (m *Manager) ListCrawlers() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := make([]string, 0, len(m.crawlers))
	for id := range m.crawlers {
		ids = append(ids, id)
	}
	return ids
}

func cfgOrDefault(cfg SourceConfig, key, def string) string {
	if cfg.Config != nil {
		if v, ok := cfg.Config[key].(string); ok {
			return v
		}
	}
	return def
}

func cfgInt(cfg SourceConfig, key string, def int) int {
	if cfg.Config != nil {
		if v, ok := cfg.Config[key].(int); ok {
			return v
		}
	}
	return def
}
