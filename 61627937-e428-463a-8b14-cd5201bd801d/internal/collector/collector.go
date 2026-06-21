package collector

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"copyright-monitor/internal/config"
	"copyright-monitor/internal/models"
	"copyright-monitor/pkg/simhash"

	"github.com/gocolly/colly/v2"
	"go.uber.org/zap"
)

type PlatformCollector struct {
	platform *models.PlatformSource
	collector *colly.Collector
	logger   *zap.Logger
	mu       sync.Mutex
	results  []*models.CrawledContent
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
	)

	c.SetRequestTimeout(time.Duration(config.Get().RequestTimeout) * time.Second)

	pc := &PlatformCollector{
		platform:  platform,
		collector: c,
		logger:    logger,
		results:   make([]*models.CrawledContent, 0),
	}

	c.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Delay:       time.Duration(platform.RequestDelay) * time.Second,
		RandomDelay: time.Duration(platform.RequestDelay/2) * time.Second,
		Parallelism: platform.MaxConcurrency,
	})

	c.OnRequest(func(r *colly.Request) {
		logger.Debug("Visiting", zap.String("url", r.URL.String()))
	})

	c.OnError(func(r *colly.Response, err error) {
		logger.Warn("Request failed",
			zap.String("url", r.Request.URL.String()),
			zap.Error(err),
		)
	})

	c.OnHTML(platform.ListSelector, func(e *colly.HTMLElement) {
		detailLink := e.ChildAttr(platform.DetailSelector, "href")
		if detailLink != "" {
			absURL := e.Request.AbsoluteURL(detailLink)
			c.Visit(absURL)
		}
	})

	c.OnHTML("html", func(e *colly.HTMLElement) {
		title := e.ChildText(platform.TitleSelector)
		content := e.ChildText(platform.ContentSelector)

		if title == "" || content == "" {
			return
		}

		rawHTML, _ := e.DOM.Html()
		headers := formatHeaders(*e.Response.Headers)

		crawled := &models.CrawledContent{
			PlatformID:   platform.ID,
			PlatformName: platform.Name,
			URL:          e.Request.URL.String(),
			Title:        strings.TrimSpace(title),
			Content:      strings.TrimSpace(content),
			CrawlTime:    time.Now(),
			Fingerprint:  simhash.Compute(title + " " + content),
			RawHTML:      rawHTML,
			HTTPHeaders:  headers,
			Status:       "crawled",
		}

		pc.mu.Lock()
		pc.results = append(pc.results, crawled)
		pc.mu.Unlock()
	})

	return pc
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

	for i := 1; i <= maxPages; i++ {
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

	pc.logger.Info("Crawling completed",
		zap.String("platform", pc.platform.Name),
		zap.Int("items_found", len(pc.results)),
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
			waitTime := time.Duration(attempt*2) * time.Second
			pc.logger.Warn("Retry crawling",
				zap.String("platform", pc.platform.Name),
				zap.Int("attempt", attempt),
				zap.Duration("wait", waitTime),
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
