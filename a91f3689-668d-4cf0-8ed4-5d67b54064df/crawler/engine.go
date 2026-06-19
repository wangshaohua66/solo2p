package crawler

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/chromedp/chromedp"
	"go.uber.org/zap"

	"drugvigil/config"
	"drugvigil/store"
)

type BrowserInstance struct {
	id          int
	ctx         context.Context
	cancel      context.CancelFunc
	allocCancel context.CancelFunc
	inUse       atomic.Bool
	lastUsed    time.Time
	createdAt   time.Time
	memoryMB    int64
	taskCount   int64
}

type CrawlTask struct {
	Site     *config.SiteConfig
	Priority int
	Result   chan *CrawlResult
	Error    chan error
}

type CrawlResult struct {
	SiteCode string
	Records  []*store.SecurityRecord
	Page     int
	Count    int64
	Duration time.Duration
	Error    error
}

type CrawlProgress struct {
	SiteName   string
	CurrentPage int
	Fetched    int64
	Elapsed    time.Duration
	Status     string
	Error      string
}

type ProgressCallback func(*CrawlProgress)

type BrowserPool struct {
	cfg        *config.PoolConfig
	logger     *zap.Logger
	instances  []*BrowserInstance
	mu         sync.Mutex
	taskQueue  chan *CrawlTask
	wg         sync.WaitGroup
	stopCh     chan struct{}
	nextID     int
	authMgr    *AuthManager
	progressCB ProgressCallback
	stats      *PoolStats
}

type PoolStats struct {
	ActiveInstances int32
	IdleInstances   int32
	TasksQueued     int64
	TasksCompleted  int64
	TasksFailed     int64
	TotalMemoryMB   int64
}

func NewBrowserPool(cfg *config.PoolConfig, logger *zap.Logger, authMgr *AuthManager) *BrowserPool {
	return &BrowserPool{
		cfg:       cfg,
		logger:    logger,
		instances: make([]*BrowserInstance, 0, cfg.MaxInstances),
		taskQueue: make(chan *CrawlTask, cfg.TaskQueueSize),
		stopCh:    make(chan struct{}),
		authMgr:   authMgr,
		stats:     &PoolStats{},
	}
}

func (p *BrowserPool) Start(ctx context.Context) error {
	p.logger.Info("starting browser pool",
		zap.Int("min_instances", p.cfg.MinInstances),
		zap.Int("max_instances", p.cfg.MaxInstances))

	for i := 0; i < p.cfg.MinInstances; i++ {
		if _, err := p.createInstance(ctx); err != nil {
			return fmt.Errorf("create instance %d: %w", i, err)
		}
	}

	go p.healthCheckLoop(ctx)
	go p.taskLoop(ctx)

	return nil
}

func (p *BrowserPool) Stop() {
	p.logger.Info("stopping browser pool")
	close(p.stopCh)
	p.wg.Wait()

	p.mu.Lock()
	defer p.mu.Unlock()
	for _, inst := range p.instances {
		p.destroyInstance(inst)
	}
	p.instances = nil
}

func (p *BrowserPool) createInstance(ctx context.Context) (*BrowserInstance, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if len(p.instances) >= p.cfg.MaxInstances {
		return nil, fmt.Errorf("pool full: %d instances", len(p.instances))
	}

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
		chromedp.WindowSize(1920, 1080),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx, opts...)
	taskCtx, taskCancel := chromedp.NewContext(allocCtx)

	inst := &BrowserInstance{
		id:          p.nextID,
		ctx:         taskCtx,
		cancel:      taskCancel,
		allocCancel: allocCancel,
		createdAt:   time.Now(),
		lastUsed:    time.Now(),
	}

	p.nextID++
	p.instances = append(p.instances, inst)
	atomic.AddInt32(&p.stats.IdleInstances, 1)

	p.logger.Info("browser instance created",
		zap.Int("id", inst.id),
		zap.Int("total", len(p.instances)))

	return inst, nil
}

func (p *BrowserPool) destroyInstance(inst *BrowserInstance) {
	p.logger.Info("destroying browser instance",
		zap.Int("id", inst.id),
		zap.Int64("tasks", inst.taskCount))

	inst.cancel()
	inst.allocCancel()

	if inst.inUse.Load() {
		atomic.AddInt32(&p.stats.ActiveInstances, -1)
	} else {
		atomic.AddInt32(&p.stats.IdleInstances, -1)
	}
	atomic.AddInt64(&p.stats.TotalMemoryMB, -inst.memoryMB)
}

func (p *BrowserPool) acquireInstance(ctx context.Context) (*BrowserInstance, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for _, inst := range p.instances {
		if !inst.inUse.Load() {
			inst.inUse.Store(true)
			inst.lastUsed = time.Now()
			atomic.AddInt32(&p.stats.IdleInstances, -1)
			atomic.AddInt32(&p.stats.ActiveInstances, 1)
			p.logger.Debug("acquired idle instance", zap.Int("id", inst.id))
			return inst, nil
		}
	}

	if len(p.instances) < p.cfg.MaxInstances {
		p.mu.Unlock()
		inst, err := p.createInstance(ctx)
		if err != nil {
			return nil, err
		}
		p.mu.Lock()
		inst.inUse.Store(true)
		atomic.AddInt32(&p.stats.IdleInstances, -1)
		atomic.AddInt32(&p.stats.ActiveInstances, 1)
		return inst, nil
	}

	return nil, fmt.Errorf("no available instances")
}

func (p *BrowserPool) releaseInstance(inst *BrowserInstance) {
	inst.inUse.Store(false)
	inst.lastUsed = time.Now()
	inst.taskCount++

	inst.memoryMB = p.getInstanceMemory(inst)
	atomic.AddInt32(&p.stats.ActiveInstances, -1)
	atomic.AddInt32(&p.stats.IdleInstances, 1)

	p.logger.Debug("released instance",
		zap.Int("id", inst.id),
		zap.Int64("memory_mb", inst.memoryMB),
		zap.Int64("tasks", inst.taskCount))

	if inst.memoryMB > int64(p.cfg.MaxMemoryMB) {
		p.logger.Info("instance memory exceeded limit, recycling",
			zap.Int("id", inst.id),
			zap.Int64("memory_mb", inst.memoryMB),
			zap.Int("limit_mb", p.cfg.MaxMemoryMB))
		go p.recycleInstance(inst)
	}
}

func (p *BrowserPool) recycleInstance(oldInst *BrowserInstance) {
	p.mu.Lock()
	for i, inst := range p.instances {
		if inst.id == oldInst.id {
			p.instances = append(p.instances[:i], p.instances[i+1:]...)
			break
		}
	}
	p.mu.Unlock()

	p.destroyInstance(oldInst)

	ctx := context.Background()
	if _, err := p.createInstance(ctx); err != nil {
		p.logger.Error("failed to create replacement instance", zap.Error(err))
	}
}

func (p *BrowserPool) getInstanceMemory(inst *BrowserInstance) int64 {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return int64(m.Alloc) / 1024 / 1024 / int64(len(p.instances)+1)
}

func (p *BrowserPool) healthCheckLoop(ctx context.Context) {
	ticker := time.NewTicker(p.cfg.HealthCheckInt)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.performHealthCheck(ctx)
		case <-p.stopCh:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (p *BrowserPool) performHealthCheck(ctx context.Context) {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	var toRecycle []*BrowserInstance

	for _, inst := range p.instances {
		if !inst.inUse.Load() {
			idleTime := now.Sub(inst.lastUsed)
			if idleTime > p.cfg.IdleTimeout && len(p.instances) > p.cfg.MinInstances {
				p.logger.Info("recycling idle instance",
					zap.Int("id", inst.id),
					zap.Duration("idle", idleTime))
				toRecycle = append(toRecycle, inst)
			}
		}
	}

	for _, inst := range toRecycle {
		for i, existing := range p.instances {
			if existing.id == inst.id {
				p.instances = append(p.instances[:i], p.instances[i+1:]...)
				break
			}
		}
		p.destroyInstance(inst)
	}

	atomic.StoreInt64(&p.stats.TotalMemoryMB, int64(runtime.NumGoroutine())*5)
}

func (p *BrowserPool) taskLoop(ctx context.Context) {
	for {
		select {
		case task := <-p.taskQueue:
			atomic.AddInt64(&p.stats.TasksQueued, -1)
			p.wg.Add(1)
			go p.executeTask(ctx, task)
		case <-p.stopCh:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (p *BrowserPool) Submit(task *CrawlTask) {
	atomic.AddInt64(&p.stats.TasksQueued, 1)
	p.taskQueue <- task
}

func (p *BrowserPool) executeTask(ctx context.Context, task *CrawlTask) {
	defer p.wg.Done()
	startTime := time.Now()

	p.logger.Info("executing crawl task",
		zap.String("site", task.Site.Code),
		zap.Int("priority", task.Priority))

	var result *CrawlResult
	var execErr error

	for attempt := 0; attempt < task.Site.MaxRetry; attempt++ {
		inst, err := p.acquireInstance(ctx)
		if err != nil {
			execErr = fmt.Errorf("acquire instance: %w", err)
			time.Sleep(p.exponentialBackoff(attempt, task.Site.RetryBackoff))
			continue
		}

		result, err = p.runWithSiteStrategy(inst.ctx, task.Site, attempt)
		p.releaseInstance(inst)

		if err == nil {
			break
		}

		execErr = err
		p.logger.Warn("crawl attempt failed",
			zap.String("site", task.Site.Code),
			zap.Int("attempt", attempt+1),
			zap.Error(err))

		if attempt < task.Site.MaxRetry-1 {
			backoff := p.exponentialBackoff(attempt, task.Site.RetryBackoff)
			p.logger.Info("retrying with backoff",
				zap.String("site", task.Site.Code),
				zap.Duration("backoff", backoff))
			time.Sleep(backoff)
		}
	}

	if execErr != nil {
		atomic.AddInt64(&p.stats.TasksFailed, 1)
		task.Error <- execErr
		return
	}

	result.Duration = time.Since(startTime)
	atomic.AddInt64(&p.stats.TasksCompleted, 1)
	task.Result <- result
}

func (p *BrowserPool) exponentialBackoff(attempt int, base time.Duration) time.Duration {
	return base * time.Duration(1<<uint(attempt))
}

func (p *BrowserPool) runWithSiteStrategy(ctx context.Context, site *config.SiteConfig, attempt int) (*CrawlResult, error) {
	ctx, cancel := context.WithTimeout(ctx, site.Timeout)
	defer cancel()

	if site.Auth.Required {
		if err := p.authMgr.InjectCookies(ctx, site); err != nil {
			return nil, fmt.Errorf("inject cookies: %w", err)
		}
		if !p.authMgr.CheckSession(ctx, site) {
			if err := p.authMgr.RefreshSession(ctx, site); err != nil {
				return nil, fmt.Errorf("refresh session: %w", err)
			}
		}
	}

	strategy := NewSiteStrategy(site, p.logger)
	records, page, count, err := strategy.Execute(ctx, p.progressCB)
	if err != nil {
		return nil, err
	}

	return &CrawlResult{
		SiteCode: site.Code,
		Records:  records,
		Page:     page,
		Count:    count,
	}, nil
}

func (p *BrowserPool) SetProgressCallback(cb ProgressCallback) {
	p.progressCB = cb
}

func (p *BrowserPool) GetStats() *PoolStats {
	return &PoolStats{
		ActiveInstances: atomic.LoadInt32(&p.stats.ActiveInstances),
		IdleInstances:   atomic.LoadInt32(&p.stats.IdleInstances),
		TasksQueued:     atomic.LoadInt64(&p.stats.TasksQueued),
		TasksCompleted:  atomic.LoadInt64(&p.stats.TasksCompleted),
		TasksFailed:     atomic.LoadInt64(&p.stats.TasksFailed),
		TotalMemoryMB:   atomic.LoadInt64(&p.stats.TotalMemoryMB),
	}
}

func (p *BrowserPool) GetInstanceCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.instances)
}
