package collector

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"copyright-monitor/internal/config"
	"copyright-monitor/internal/models"
	"copyright-monitor/pkg/simhash"

	"github.com/chromedp/chromedp"
	"github.com/gocolly/colly/v2"
	"go.uber.org/zap"
)

const (
	AntiCrawlStateNormal    = "normal"
	AntiCrawlStateSuspicious = "suspicious"
	AntiCrawlStateBlocked   = "blocked"
)

type PlatformCollector struct {
	platform          *models.PlatformSource
	collector         *colly.Collector
	logger            *zap.Logger
	mu                sync.Mutex
	results           []*models.CrawledContent

	antiCrawlMu       sync.RWMutex
	antiCrawlState    string
	antiCrawlCount    int
	currentDelay      int
	baseDelay         int

	screenshotEnabled bool
}

type CollectorManager struct {
	collectors map[int64]*PlatformCollector
	logger     *zap.Logger
}

var manager *CollectorManager

func InitManager(logger *zap.Logger) {
	manager = &CollectorManager{
		collectors: make(map[int64]*PlatformCollector),
		logger:     logger,
	}
}

func GetManager() *CollectorManager {
	return manager
}

func NewPlatformCollector(platform *models.PlatformSource, logger *zap.Logger) *PlatformCollector {
	c := colly.NewCollector(
		colly.UserAgent(config.Get().UserAgent),
		colly.AllowURLRevisit(),
		colly.MaxDepth(2),
		colly.CheckHead(),
	)

	c.SetRequestTimeout(time.Duration(config.Get().RequestTimeout) * time.Second)

	pc := &PlatformCollector{
		platform:          platform,
		collector:         c,
		logger:            logger,
		results:           make([]*models.CrawledContent, 0),
		antiCrawlState:    AntiCrawlStateNormal,
		antiCrawlCount:    0,
		baseDelay:         platform.RequestDelay,
		currentDelay:      platform.RequestDelay,
		screenshotEnabled: true,
	}

	c.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Delay:       time.Duration(platform.RequestDelay) * time.Second,
		RandomDelay: time.Duration(platform.RequestDelay/2) * time.Second,
		Parallelism: platform.MaxConcurrency,
	})

	c.OnRequest(func(r *colly.Request) {
		pc.antiCrawlMu.RLock()
		delay := pc.currentDelay
		state := pc.antiCrawlState
		pc.antiCrawlMu.RUnlock()

		if state != AntiCrawlStateNormal {
			pc.logger.Debug("Anti-crawl active, delaying request",
				zap.String("platform", platform.Name),
				zap.String("state", state),
				zap.Int("delay_seconds", delay),
			)
		}

		logger.Debug("Visiting",
			zap.String("url", r.URL.String()),
			zap.String("platform", platform.Name),
		)
	})

	c.OnResponse(func(r *colly.Response) {
		pc.detectAntiCrawl(r)
	})

	c.OnError(func(r *colly.Response, err error) {
		statusCode := 0
		if r != nil {
			statusCode = r.StatusCode
			pc.detectAntiCrawl(r)
		}

		logger.Warn("Request failed",
			zap.String("platform", platform.Name),
			zap.String("url", safeGetURL(r)),
			zap.Int("status_code", statusCode),
			zap.Error(err),
		)
	})

	c.OnHTML(platform.ListSelector, func(e *colly.HTMLElement) {
		if pc.isAntiCrawlBlocked() {
			return
		}

		detailLink := e.ChildAttr(platform.DetailSelector, "href")
		if detailLink != "" {
			absURL := e.Request.AbsoluteURL(detailLink)
			c.Visit(absURL)
		}
	})

	c.OnHTML("html", func(e *colly.HTMLElement) {
		if pc.isAntiCrawlBlocked() {
			return
		}

		title := e.ChildText(platform.TitleSelector)
		content := e.ChildText(platform.ContentSelector)

		if title == "" || content == "" {
			return
		}

		rawHTML, _ := e.DOM.Html()
		headers := formatHeaders(*e.Response.Headers)
		pageURL := e.Request.URL.String()

		crawled := &models.CrawledContent{
			PlatformID:   platform.ID,
			PlatformName: platform.Name,
			URL:          pageURL,
			Title:        strings.TrimSpace(title),
			Content:      strings.TrimSpace(content),
			CrawlTime:    time.Now(),
			Fingerprint:  simhash.Compute(title + " " + content),
			RawHTML:      rawHTML,
			HTTPHeaders:  headers,
			Status:       "crawled",
		}

		if pc.screenshotEnabled {
			screenshot, err := pc.takeScreenshot(pageURL)
			if err != nil {
				pc.logger.Debug("Screenshot failed",
					zap.String("platform", platform.Name),
					zap.String("url", pageURL),
					zap.Error(err),
				)
			} else {
				crawled.ScreenshotBase64 = screenshot
				crawled.Status = "crawled_with_screenshot"
			}
		}

		pc.mu.Lock()
		pc.results = append(pc.results, crawled)
		pc.mu.Unlock()
	})

	return pc
}

func safeGetURL(r *colly.Response) string {
	if r != nil && r.Request != nil && r.Request.URL != nil {
		return r.Request.URL.String()
	}
	return "unknown"
}

func (pc *PlatformCollector) detectAntiCrawl(r *colly.Response) {
	pc.antiCrawlMu.Lock()
	defer pc.antiCrawlMu.Unlock()

	triggered := false
	reason := ""

	if r.StatusCode == http.StatusTooManyRequests {
		triggered = true
		reason = "HTTP 429 Too Many Requests"
	} else if r.StatusCode == http.StatusForbidden {
		triggered = true
		reason = "HTTP 403 Forbidden"
	} else if r.StatusCode == 503 {
		triggered = true
		reason = "HTTP 503 Service Unavailable"
	}

	bodyLower := strings.ToLower(string(r.Body))
	captchaKeywords := []string{
		"captcha", "验证码", "slider", "滑块", "verify", "验证",
		"robot check", "人机验证", "security check", "安全验证",
	}
	for _, kw := range captchaKeywords {
		if strings.Contains(bodyLower, kw) {
			triggered = true
			reason = fmt.Sprintf("detected captcha keyword: %s", kw)
			break
		}
	}

	if triggered {
		pc.antiCrawlCount++

		switch {
		case pc.antiCrawlCount >= 5:
			pc.antiCrawlState = AntiCrawlStateBlocked
			pc.currentDelay = 30
		case pc.antiCrawlCount >= 3:
			pc.antiCrawlState = AntiCrawlStateSuspicious
			pc.currentDelay = pc.baseDelay * 5
			if pc.currentDelay < 5 {
				pc.currentDelay = 5
			}
		default:
			pc.antiCrawlState = AntiCrawlStateSuspicious
			pc.currentDelay = pc.baseDelay * 3
			if pc.currentDelay < 3 {
				pc.currentDelay = 3
			}
		}

		pc.logger.Warn("Anti-crawl detected",
			zap.String("platform", pc.platform.Name),
			zap.String("reason", reason),
			zap.Int("count", pc.antiCrawlCount),
			zap.String("new_state", pc.antiCrawlState),
			zap.Int("new_delay_seconds", pc.currentDelay),
		)

		pc.updateCollectorDelay()
	} else {
		if pc.antiCrawlCount > 0 {
			pc.antiCrawlCount--
			if pc.antiCrawlCount == 0 {
				pc.antiCrawlState = AntiCrawlStateNormal
				pc.currentDelay = pc.baseDelay
				pc.updateCollectorDelay()
				pc.logger.Info("Anti-crawl state recovered to normal",
					zap.String("platform", pc.platform.Name),
				)
			}
		}
	}
}

func (pc *PlatformCollector) updateCollectorDelay() {
	delay := time.Duration(pc.currentDelay) * time.Second
	pc.collector.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Delay:       delay,
		RandomDelay: delay / 2,
		Parallelism: 1,
	})
}

func (pc *PlatformCollector) isAntiCrawlBlocked() bool {
	pc.antiCrawlMu.RLock()
	defer pc.antiCrawlMu.RUnlock()
	return pc.antiCrawlState == AntiCrawlStateBlocked
}

func (pc *PlatformCollector) GetAntiCrawlState() (string, int, int) {
	pc.antiCrawlMu.RLock()
	defer pc.antiCrawlMu.RUnlock()
	return pc.antiCrawlState, pc.antiCrawlCount, pc.currentDelay
}

func (pc *PlatformCollector) takeScreenshot(url string) (string, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.WindowSize(1280, 900),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	ctx, cancel = context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var buf []byte
	err := chromedp.Run(ctx,
		chromedp.Navigate(url),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Sleep(2*time.Second),
		chromedp.FullScreenshot(&buf, 90),
	)
	if err != nil {
		return "", fmt.Errorf("chromedp screenshot: %w", err)
	}

	return base64.StdEncoding.EncodeToString(buf), nil
}

func formatHeaders(headers http.Header) string {
	var sb strings.Builder
	for key, values := range headers {
		for _, value := range values {
			sb.WriteString(fmt.Sprintf("%s: %s\n", key, value))
		}
	}
	return sb.String()
}

func (pc *PlatformCollector) Collect(maxPages int) ([]*models.CrawledContent, error) {
	pc.mu.Lock()
	pc.results = make([]*models.CrawledContent, 0)
	pc.mu.Unlock()

	if pc.isAntiCrawlBlocked() {
		pc.logger.Warn("Skipping collection due to anti-crawl block",
			zap.String("platform", pc.platform.Name),
		)
		return nil, fmt.Errorf("platform %s is blocked by anti-crawl", pc.platform.Name)
	}

	for i := 1; i <= maxPages; i++ {
		if pc.isAntiCrawlBlocked() {
			pc.logger.Warn("Stopping collection early due to anti-crawl block",
				zap.String("platform", pc.platform.Name),
				zap.Int("pages_completed", i-1),
			)
			break
		}

		listURL := strings.ReplaceAll(pc.platform.ListURLPattern, "{page}", fmt.Sprintf("%d", i))
		pc.logger.Debug("Crawling list page",
			zap.String("platform", pc.platform.Name),
			zap.Int("page", i),
			zap.String("url", listURL),
		)

		if err := pc.collector.Visit(listURL); err != nil {
			pc.logger.Warn("Failed to visit list page",
				zap.String("platform", pc.platform.Name),
				zap.Int("page", i),
				zap.Error(err),
			)
			continue
		}
	}

	pc.collector.Wait()

	pc.mu.Lock()
	defer pc.mu.Unlock()

	state, count, delay := pc.GetAntiCrawlState()
	pc.logger.Info("Crawling completed",
		zap.String("platform", pc.platform.Name),
		zap.Int("items_found", len(pc.results)),
		zap.String("anti_crawl_state", state),
		zap.Int("anti_crawl_count", count),
		zap.Int("current_delay", delay),
	)

	return pc.results, nil
}

func (pc *PlatformCollector) CollectWithRetry(maxPages int, maxRetries int) ([]*models.CrawledContent, error) {
	var results []*models.CrawledContent
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		results, lastErr = pc.Collect(maxPages)
		if lastErr == nil && len(results) > 0 {
			return results, nil
		}

		if attempt < maxRetries {
			waitTime := time.Duration(attempt*5) * time.Second
			state, count, _ := pc.GetAntiCrawlState()
			pc.logger.Warn("Retry crawling",
				zap.String("platform", pc.platform.Name),
				zap.Int("attempt", attempt),
				zap.Duration("wait", waitTime),
				zap.String("anti_crawl_state", state),
				zap.Int("anti_crawl_count", count),
				zap.Error(lastErr),
			)
			time.Sleep(waitTime)
		}
	}

	return results, fmt.Errorf("failed after %d retries: %w", maxRetries, lastErr)
}

func (m *CollectorManager) RegisterCollector(platform *models.PlatformSource) {
	pc := NewPlatformCollector(platform, m.logger)
	m.collectors[platform.ID] = pc
	m.logger.Info("Collector registered",
		zap.String("name", platform.Name),
		zap.String("type", string(platform.Type)),
	)
}

func (m *CollectorManager) GetCollector(platformID int64) *PlatformCollector {
	return m.collectors[platformID]
}

func (m *CollectorManager) CollectAll(maxPages int) (map[string][]*models.CrawledContent, error) {
	results := make(map[string][]*models.CrawledContent)
	var wg sync.WaitGroup
	var mu sync.Mutex

	sem := make(chan struct{}, config.Get().MaxConcurrency)

	for _, pc := range m.collectors {
		if !pc.platform.Enabled {
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(pc *PlatformCollector) {
			defer wg.Done()
			defer func() { <-sem }()

			content, err := pc.CollectWithRetry(maxPages, config.Get().MaxRetries)
			if err != nil {
				m.logger.Error("Collection failed",
					zap.String("platform", pc.platform.Name),
					zap.Error(err),
				)
				return
			}

			mu.Lock()
			results[pc.platform.Name] = content
			mu.Unlock()
		}(pc)
	}

	wg.Wait()
	return results, nil
}

func (m *CollectorManager) CollectByType(platformType models.PlatformType, maxPages int) (map[string][]*models.CrawledContent, error) {
	results := make(map[string][]*models.CrawledContent)
	var wg sync.WaitGroup
	var mu sync.Mutex

	sem := make(chan struct{}, config.Get().MaxConcurrency)

	for _, pc := range m.collectors {
		if !pc.platform.Enabled || pc.platform.Type != platformType {
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(pc *PlatformCollector) {
			defer wg.Done()
			defer func() { <-sem }()

			content, err := pc.CollectWithRetry(maxPages, config.Get().MaxRetries)
			if err != nil {
				m.logger.Error("Collection failed",
					zap.String("platform", pc.platform.Name),
					zap.Error(err),
				)
				return
			}

			mu.Lock()
			results[pc.platform.Name] = content
			mu.Unlock()
		}(pc)
	}

	wg.Wait()
	return results, nil
}

func (m *CollectorManager) CollectPlatform(platformID int64, maxPages int) ([]*models.CrawledContent, error) {
	pc, ok := m.collectors[platformID]
	if !ok {
		return nil, fmt.Errorf("collector not found for platform id: %d", platformID)
	}

	if !pc.platform.Enabled {
		return nil, fmt.Errorf("platform is disabled: %d", platformID)
	}

	return pc.CollectWithRetry(maxPages, config.Get().MaxRetries)
}
