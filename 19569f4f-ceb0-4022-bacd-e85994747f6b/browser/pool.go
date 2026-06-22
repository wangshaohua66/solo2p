package browser

import (
	"context"
	"fmt"
	"sync"
	"time"

	"credit-monitor/config"
	"credit-monitor/models"

	"github.com/chromedp/chromedp"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

type BrowserInstance struct {
	ID           uuid.UUID
	SystemID     string
	BrowserCtx   context.Context
	BrowserCancel context.CancelFunc
	AllocatorCtx context.Context
	AllocatorCancel context.CancelFunc
	LastUsedAt   time.Time
	IsInUse      bool
	mu           sync.Mutex
}

type Pool struct {
	instances    map[uuid.UUID]*BrowserInstance
	systemPools  map[string][]*BrowserInstance
	semaphore    chan struct{}
	mu           sync.RWMutex
	maxInstances int
	maxPerSystem int
	idleTimeout  time.Duration
	ctx          context.Context
	cancel       context.CancelFunc
}

var (
	poolInstance *Pool
	poolOnce     sync.Once
)

func NewPool(ctx context.Context) *Pool {
	poolOnce.Do(func() {
		cfg := config.Get()
		maxInstances := cfg.Pool.MaxBrowsers
		if maxInstances <= 0 {
			maxInstances = 12
		}
		maxPerSystem := cfg.Pool.MaxPages
		if maxPerSystem <= 0 {
			maxPerSystem = 3
		}
		idleTimeout := cfg.Pool.IdleTimeout
		if idleTimeout <= 0 {
			idleTimeout = 30 * time.Minute
		}
		totalConcurrency := cfg.Pool.TotalMaxConcurrency
		if totalConcurrency <= 0 {
			totalConcurrency = 20
		}

		poolCtx, poolCancel := context.WithCancel(ctx)

		poolInstance = &Pool{
			instances:    make(map[uuid.UUID]*BrowserInstance),
			systemPools:  make(map[string][]*BrowserInstance),
			semaphore:    make(chan struct{}, totalConcurrency),
			maxInstances: maxInstances,
			maxPerSystem: maxPerSystem,
			idleTimeout:  idleTimeout,
			ctx:          poolCtx,
			cancel:       poolCancel,
		}

		go poolInstance.startIdleCleaner()
	})
	return poolInstance
}

func (p *Pool) Acquire(systemID string) (*BrowserInstance, error) {
	p.mu.Lock()

	if config.IsInMaintenanceWindow(systemID) {
		p.mu.Unlock()
		return nil, fmt.Errorf("system %s is in maintenance window", systemID)
	}

	systemPool := p.systemPools[systemID]
	for _, inst := range systemPool {
		inst.mu.Lock()
		if !inst.IsInUse {
			inst.IsInUse = true
			inst.LastUsedAt = time.Now()
			inst.mu.Unlock()
			p.mu.Unlock()
			p.semaphore <- struct{}{}
			logrus.Debugf("browser acquired from pool: system=%s, id=%s", systemID, inst.ID)
			return inst, nil
		}
		inst.mu.Unlock()
	}

	if len(p.instances) >= p.maxInstances {
		p.mu.Unlock()
		return nil, fmt.Errorf("browser pool exhausted: max=%d", p.maxInstances)
	}

	if len(systemPool) >= p.maxPerSystem {
		p.mu.Unlock()
		return nil, fmt.Errorf("system %s browser pool exhausted: max=%d", systemID, p.maxPerSystem)
	}

	p.mu.Unlock()

	inst, err := p.createBrowser(systemID)
	if err != nil {
		return nil, fmt.Errorf("create browser failed: %w", err)
	}

	p.mu.Lock()
	p.instances[inst.ID] = inst
	p.systemPools[systemID] = append(p.systemPools[systemID], inst)
	p.mu.Unlock()

	p.semaphore <- struct{}{}
	logrus.Debugf("new browser created: system=%s, id=%s", systemID, inst.ID)
	return inst, nil
}

func (p *Pool) Release(inst *BrowserInstance) {
	if inst == nil {
		return
	}

	inst.mu.Lock()
	inst.IsInUse = false
	inst.LastUsedAt = time.Now()
	inst.mu.Unlock()

	select {
	case <-p.semaphore:
	default:
	}

	logrus.Debugf("browser released: system=%s, id=%s", inst.SystemID, inst.ID)
}

func (p *Pool) createBrowser(systemID string) (*BrowserInstance, error) {
	sysConfig := config.GetSystem(systemID)
	if sysConfig == nil {
		return nil, fmt.Errorf("system %s not found", systemID)
	}

	opts := []chromedp.ExecAllocatorOption{
		chromedp.NoFirstRun,
		chromedp.NoDefaultBrowserCheck,
		chromedp.DisableGPU,
		chromedp.NoSandbox,
		chromedp.Headless,
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("exclude-switches", "enable-automation"),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
		chromedp.WindowSize(1920, 1080),
	}

	if sysConfig.CACertPath != "" {
		opts = append(opts, chromedp.Flag("ignore-certificate-errors"))
	}

	allocCtx, allocCancel := chromedp.NewExecAllocator(p.ctx, opts...)

	browserOpts := []chromedp.ContextOption{
		chromedp.WithLogf(logrus.Debugf),
	}
	browserCtx, browserCancel := chromedp.NewContext(allocCtx, browserOpts...)

	timeoutCtx, timeoutCancel := context.WithTimeout(browserCtx, 30*time.Second)
	defer timeoutCancel()

	var title string
	err := chromedp.Run(timeoutCtx,
		chromedp.Navigate("about:blank"),
		chromedp.Title(&title),
	)
	if err != nil {
		browserCancel()
		allocCancel()
		return nil, fmt.Errorf("initialize browser failed: %w", err)
	}

	inst := &BrowserInstance{
		ID:              uuid.New(),
		SystemID:        systemID,
		AllocatorCtx:    allocCtx,
		AllocatorCancel: allocCancel,
		BrowserCtx:      browserCtx,
		BrowserCancel:   browserCancel,
		LastUsedAt:      time.Now(),
		IsInUse:         true,
	}

	return inst, nil
}

func (p *Pool) startIdleCleaner() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			p.cleanIdle()
		}
	}
}

func (p *Pool) cleanIdle() {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	for id, inst := range p.instances {
		inst.mu.Lock()
		if !inst.IsInUse && now.Sub(inst.LastUsedAt) > p.idleTimeout {
			logrus.Infof("cleaning idle browser: system=%s, id=%s", inst.SystemID, id)
			inst.BrowserCancel()
			inst.AllocatorCancel()
			delete(p.instances, id)
			p.removeFromSystemPool(inst.SystemID, id)
		}
		inst.mu.Unlock()
	}
}

func (p *Pool) removeFromSystemPool(systemID string, instanceID uuid.UUID) {
	pool := p.systemPools[systemID]
	for i, inst := range pool {
		if inst.ID == instanceID {
			p.systemPools[systemID] = append(pool[:i], pool[i+1:]...)
			break
		}
	}
}

func (p *Pool) GetSession(inst *BrowserInstance) (*models.Session, error) {
	if inst == nil {
		return nil, fmt.Errorf("nil browser instance")
	}

	sysConfig := config.GetSystem(inst.SystemID)
	if sysConfig == nil {
		return nil, fmt.Errorf("system config not found")
	}

	var cookies []*chromedp.Cookie
	err := chromedp.Run(inst.BrowserCtx,
		chromedp.NetworkGetCookies(&cookies),
	)
	if err != nil {
		return nil, fmt.Errorf("get cookies failed: %w", err)
	}

	modelCookies := make([]models.Cookie, len(cookies))
	for i, c := range cookies {
		modelCookies[i] = models.Cookie{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Expires:  c.Expires.Time,
			HTTPOnly: c.HTTPOnly,
			Secure:   c.Secure,
		}
	}

	now := time.Now()
	return &models.Session{
		ID:           uuid.New(),
		SystemID:     inst.SystemID,
		Status:       "active",
		CreatedAt:    now,
		LastActiveAt: now,
		ExpiresAt:    now.Add(sysConfig.SessionTimeout),
		Cookies:      modelCookies,
	}, nil
}

func (p *Pool) RestoreSession(inst *BrowserInstance, session *models.Session) error {
	if inst == nil || session == nil {
		return fmt.Errorf("nil instance or session")
	}

	cookies := make([]*chromedp.Cookie, len(session.Cookies))
	for i, c := range session.Cookies {
		cookies[i] = &chromedp.Cookie{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Expires:  chromedp.TimeSinceEpoch(c.Expires),
			HTTPOnly: c.HTTPOnly,
			Secure:   c.Secure,
		}
	}

	err := chromedp.Run(inst.BrowserCtx,
		chromedp.NetworkSetCookies(cookies),
	)
	if err != nil {
		return fmt.Errorf("restore cookies failed: %w", err)
	}

	return nil
}

func (p *Pool) Close() {
	p.cancel()

	p.mu.Lock()
	defer p.mu.Unlock()

	for _, inst := range p.instances {
		inst.BrowserCancel()
		inst.AllocatorCancel()
	}

	p.instances = make(map[uuid.UUID]*BrowserInstance)
	p.systemPools = make(map[string][]*BrowserInstance)

	logrus.Info("browser pool closed")
}

func (p *Pool) Stats() map[string]int {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := make(map[string]int)
	stats["total"] = len(p.instances)
	stats["in_use"] = 0
	stats["idle"] = 0

	for _, inst := range p.instances {
		inst.mu.Lock()
		if inst.IsInUse {
			stats["in_use"]++
		} else {
			stats["idle"]++
		}
		inst.mu.Unlock()
	}

	for sysID, pool := range p.systemPools {
		stats[sysID] = len(pool)
	}

	return stats
}
