package scraper

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/chromedp/chromedp"

	"travel-monitor/config"
	"travel-monitor/models"
	"travel-monitor/scraper/platforms"
)

type BrowserPool struct {
	mu         sync.Mutex
	maxBrowsers int
	allocators []*chromedp.Allocator
	available  []int
	inUse      map[int]bool
}

type ScrapeEngine struct {
	pool          *BrowserPool
	platforms     map[string]platforms.PlatformAdapter
	cfg           *config.Config
	semaphore     chan struct{}
	progress      *ProgressTracker
}

type ProgressTracker struct {
	mu           sync.Mutex
	TotalTasks   int
	CompletedTasks int
	FailedTasks  int
	CurrentTask  string
	PlatformProgress map[string]*PlatformProgress
}

type PlatformProgress struct {
	Total   int
	Done    int
	Failed  int
	Status  string
}

type ScrapeTask struct {
	ID          string
	Type        string
	Platform    string
	Query       interface{}
	Priority    int
	MaxRetries  int
	RetryCount  int
}

type ScrapeResult struct {
	TaskID      string
	Platform    string
	Success     bool
	Error       error
	FlightPrices []models.FlightPrice
	HotelPrices  []models.HotelPrice
	Duration    time.Duration
}

func NewBrowserPool(maxBrowsers int) *BrowserPool {
	return &BrowserPool{
		maxBrowsers: maxBrowsers,
		allocators:  make([]*chromedp.Allocator, 0, maxBrowsers),
		available:   make([]int, 0, maxBrowsers),
		inUse:       make(map[int]bool),
	}
}

func (bp *BrowserPool) Init(ctx context.Context) error {
	cfg := config.Get()
	for i := 0; i < bp.maxBrowsers; i++ {
		opts := append(chromedp.DefaultExecAllocatorOptions[:],
			chromedp.Flag("headless", cfg.Scraper.Headless),
			chromedp.Flag("disable-gpu", true),
			chromedp.Flag("no-sandbox", true),
			chromedp.Flag("disable-dev-shm-usage", true),
			chromedp.Flag("disable-web-security", true),
			chromedp.Flag("disable-features", "IsolateOrigins,site-per-process"),
			chromedp.UserAgent(cfg.GetRandomUserAgent()),
			chromedp.WindowSize(1920, 1080),
		)

		if cfg.Scraper.ProxyPool.Enabled && len(cfg.Scraper.ProxyPool.Proxies) > 0 {
			proxy := cfg.Scraper.ProxyPool.Proxies[i%len(cfg.Scraper.ProxyPool.Proxies)]
			opts = append(opts, chromedp.ProxyServer(proxy))
		}

		allocCtx, _ := chromedp.NewExecAllocator(ctx, opts...)
		allocator := chromedp.FromContext(allocCtx)
		bp.allocators = append(bp.allocators, allocator)
		bp.available = append(bp.available, i)
	}
	return nil
}

func (bp *BrowserPool) Acquire() (int, *chromedp.Allocator, error) {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	if len(bp.available) == 0 {
		return -1, nil, fmt.Errorf("没有可用的浏览器实例")
	}

	idx := bp.available[0]
	bp.available = bp.available[1:]
	bp.inUse[idx] = true
	return idx, bp.allocators[idx], nil
}

func (bp *BrowserPool) Release(idx int) {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	if bp.inUse[idx] {
		bp.inUse[idx] = false
		bp.available = append(bp.available, idx)
	}
}

func (bp *BrowserPool) Close() {
	for _, alloc := range bp.allocators {
		if alloc != nil {
			alloc.Cancel()
		}
	}
}

func NewProgressTracker() *ProgressTracker {
	return &ProgressTracker{
		PlatformProgress: make(map[string]*PlatformProgress),
	}
}

func (pt *ProgressTracker) SetPlatformTotal(platform string, total int) {
	pt.mu.Lock()
	defer pt.mu.Unlock()
	if pt.PlatformProgress[platform] == nil {
		pt.PlatformProgress[platform] = &PlatformProgress{}
	}
	pt.PlatformProgress[platform].Total = total
	pt.PlatformProgress[platform].Status = "进行中"
}

func (pt *ProgressTracker) MarkDone(platform string) {
	pt.mu.Lock()
	defer pt.mu.Unlock()
	pt.CompletedTasks++
	if pt.PlatformProgress[platform] != nil {
		pt.PlatformProgress[platform].Done++
		if pt.PlatformProgress[platform].Done >= pt.PlatformProgress[platform].Total {
			pt.PlatformProgress[platform].Status = "完成"
		}
	}
}

func (pt *ProgressTracker) MarkFailed(platform string) {
	pt.mu.Lock()
	defer pt.mu.Unlock()
	pt.FailedTasks++
	if pt.PlatformProgress[platform] != nil {
		pt.PlatformProgress[platform].Failed++
	}
}

func (pt *ProgressTracker) GetProgress() float64 {
	pt.mu.Lock()
	defer pt.mu.Unlock()
	if pt.TotalTasks == 0 {
		return 0
	}
	return float64(pt.CompletedTasks+pt.FailedTasks) / float64(pt.TotalTasks) * 100
}

func NewScrapeEngine(cfg *config.Config) *ScrapeEngine {
	engine := &ScrapeEngine{
		cfg:       cfg,
		platforms: make(map[string]platforms.PlatformAdapter),
		semaphore: make(chan struct{}, cfg.Scraper.MaxBrowsers),
		progress:  NewProgressTracker(),
	}

	engine.registerPlatforms()
	return engine
}

func (se *ScrapeEngine) registerPlatforms() {
	enabledPlatforms := se.cfg.GetEnabledPlatforms()

	for key, pcfg := range enabledPlatforms {
		var adapter platforms.PlatformAdapter
		switch key {
		case "ctrip_flight":
			adapter = platforms.NewCtripFlightAdapter(pcfg)
		case "qunar_flight":
			adapter = platforms.NewQunarFlightAdapter(pcfg)
		case "fliggy_flight":
			adapter = platforms.NewFliggyFlightAdapter(pcfg)
		case "train12306":
			adapter = platforms.NewTrain12306Adapter(pcfg)
		case "meituan_hotel":
			adapter = platforms.NewMeituanHotelAdapter(pcfg)
		case "ctrip_hotel":
			adapter = platforms.NewCtripHotelAdapter(pcfg)
		}
		if adapter != nil {
			se.platforms[key] = adapter
		}
	}
}

func (se *ScrapeEngine) Init(ctx context.Context) error {
	se.pool = NewBrowserPool(se.cfg.Scraper.MaxBrowsers)
	return se.pool.Init(ctx)
}

func (se *ScrapeEngine) GetProgress() *ProgressTracker {
	return se.progress
}

func (se *ScrapeEngine) ScrapeFlights(ctx context.Context, query models.FlightQuery) ([]ScrapeResult, error) {
	results := make([]ScrapeResult, 0)
	var mu sync.Mutex
	var wg sync.WaitGroup

	flightPlatforms := []string{"ctrip_flight", "qunar_flight", "fliggy_flight", "train12306"}
	enabledCount := 0
	for _, p := range flightPlatforms {
		if _, ok := se.platforms[p]; ok {
			enabledCount++
		}
	}
	se.progress.TotalTasks = enabledCount

	for _, key := range flightPlatforms {
		adapter, ok := se.platforms[key]
		if !ok {
			continue
		}

		wg.Add(1)
		se.semaphore <- struct{}{}
		se.progress.SetPlatformTotal(key, 1)

		go func(platformKey string, ad platforms.PlatformAdapter) {
			defer wg.Done()
			defer func() { <-se.semaphore }()

			result := ScrapeResult{
				TaskID:   fmt.Sprintf("%s-%s", platformKey, time.Now().Format("150405")),
				Platform: platformKey,
			}

			start := time.Now()
			flightPrices, err := se.executeWithRetry(ctx, ad, query)
			result.Duration = time.Since(start)

			if err != nil {
				result.Success = false
				result.Error = err
				se.progress.MarkFailed(platformKey)
			} else {
				result.Success = true
				result.FlightPrices = flightPrices
				se.progress.MarkDone(platformKey)
			}

			mu.Lock()
			results = append(results, result)
			mu.Unlock()
		}(key, adapter)

		se.randomSleep()
	}

	wg.Wait()
	return results, nil
}

func (se *ScrapeEngine) ScrapeHotels(ctx context.Context, query models.HotelQuery) ([]ScrapeResult, error) {
	results := make([]ScrapeResult, 0)
	var mu sync.Mutex
	var wg sync.WaitGroup

	hotelPlatforms := []string{"meituan_hotel", "ctrip_hotel"}
	enabledCount := 0
	for _, p := range hotelPlatforms {
		if _, ok := se.platforms[p]; ok {
			enabledCount++
		}
	}
	se.progress.TotalTasks = enabledCount

	for _, key := range hotelPlatforms {
		adapter, ok := se.platforms[key]
		if !ok {
			continue
		}

		wg.Add(1)
		se.semaphore <- struct{}{}
		se.progress.SetPlatformTotal(key, 1)

		go func(platformKey string, ad platforms.PlatformAdapter) {
			defer wg.Done()
			defer func() { <-se.semaphore }()

			result := ScrapeResult{
				TaskID:   fmt.Sprintf("%s-%s", platformKey, time.Now().Format("150405")),
				Platform: platformKey,
			}

			start := time.Now()
			hotelPrices, err := se.executeHotelWithRetry(ctx, ad, query)
			result.Duration = time.Since(start)

			if err != nil {
				result.Success = false
				result.Error = err
				se.progress.MarkFailed(platformKey)
			} else {
				result.Success = true
				result.HotelPrices = hotelPrices
				se.progress.MarkDone(platformKey)
			}

			mu.Lock()
			results = append(results, result)
			mu.Unlock()
		}(key, adapter)

		se.randomSleep()
	}

	wg.Wait()
	return results, nil
}

func (se *ScrapeEngine) executeWithRetry(ctx context.Context, adapter platforms.PlatformAdapter, query models.FlightQuery) ([]models.FlightPrice, error) {
	maxRetries := se.cfg.Scraper.MaxRetries
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*2) * time.Second)
		}

		idx, allocator, err := se.pool.Acquire()
		if err != nil {
			lastErr = err
			continue
		}

		browserCtx, cancel := chromedp.NewContext(allocator)
		timeoutCtx, timeoutCancel := context.WithTimeout(browserCtx, time.Duration(se.cfg.Scraper.TimeoutSeconds)*time.Second)

		prices, err := adapter.ScrapeFlights(timeoutCtx, query)
		se.pool.Release(idx)
		timeoutCancel()
		cancel()

		if err != nil {
			lastErr = err
			continue
		}
		return prices, nil
	}

	return nil, fmt.Errorf("重试%d次后仍然失败: %w", maxRetries, lastErr)
}

func (se *ScrapeEngine) executeHotelWithRetry(ctx context.Context, adapter platforms.PlatformAdapter, query models.HotelQuery) ([]models.HotelPrice, error) {
	maxRetries := se.cfg.Scraper.MaxRetries
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*2) * time.Second)
		}

		idx, allocator, err := se.pool.Acquire()
		if err != nil {
			lastErr = err
			continue
		}

		browserCtx, cancel := chromedp.NewContext(allocator)
		timeoutCtx, timeoutCancel := context.WithTimeout(browserCtx, time.Duration(se.cfg.Scraper.TimeoutSeconds)*time.Second)

		prices, err := adapter.ScrapeHotels(timeoutCtx, query)
		se.pool.Release(idx)
		timeoutCancel()
		cancel()

		if err != nil {
			lastErr = err
			continue
		}
		return prices, nil
	}

	return nil, fmt.Errorf("重试%d次后仍然失败: %w", maxRetries, lastErr)
}

func (se *ScrapeEngine) randomSleep() {
	min := se.cfg.Scraper.RequestIntervalMin
	max := se.cfg.Scraper.RequestIntervalMax
	if max <= min {
		max = min + 1
	}
	sleepTime := min + rand.Intn(max-min)
	time.Sleep(time.Duration(sleepTime) * time.Second)
}

func (se *ScrapeEngine) Close() {
	if se.pool != nil {
		se.pool.Close()
	}
}

func SimulateHumanScroll(ctx context.Context) error {
	for i := 0; i < 5; i++ {
		err := chromedp.Run(ctx,
			chromedp.Evaluate(fmt.Sprintf(`window.scrollBy(0, %d + Math.random() * 200)`, 300+i*100), nil),
		)
		if err != nil {
			return err
		}
		time.Sleep(time.Duration(500+rand.Intn(500)) * time.Millisecond)
	}
	return nil
}

func RandomMouseMove(ctx context.Context) error {
	return chromedp.Run(ctx,
		chromedp.Evaluate(`
			(function() {
				const x = Math.random() * window.innerWidth;
				const y = Math.random() * window.innerHeight;
				const event = new MouseEvent('mousemove', {
					clientX: x,
					clientY: y,
					bubbles: true
				});
				document.dispatchEvent(event);
			})()
		`, nil),
	)
}
