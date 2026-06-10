package crawler

import (
	"context"
	"crypto/tls"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"sync"
	"sync/atomic"
	"time"

	"bankrupt-monitor/internal/config"
	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/parser"
	"bankrupt-monitor/internal/retry"
	"bankrupt-monitor/internal/store"

	"github.com/gocolly/colly/v2"
	"github.com/gocolly/colly/v2/debug"
	"github.com/gocolly/colly/v2/extensions"
	"go.uber.org/zap"
	"golang.org/x/net/publicsuffix"
)

type Engine struct {
	cfg       *config.AppConfig
	logger    *zap.Logger
	store     *store.Store
	backoff   *retry.Backoff
	collector *colly.Collector
	parsers   map[string]AnnouncementParser

	stats      map[string]*model.CrawlStats
	statsMu    sync.Mutex
	currentURL atomic.Value
}

type CrawlResult struct {
	Cases         []*model.Case
	Announcements []*model.Announcement
	NewCount      int
	TotalCount    int
	ErrorCount    int
}

func NewEngine(cfg *config.AppConfig, store *store.Store, log *zap.Logger) (*Engine, error) {
	e := &Engine{
		cfg:     cfg,
		logger:  log,
		store:   store,
		parsers: make(map[string]AnnouncementParser),
		stats:   make(map[string]*model.CrawlStats),
	}

	e.backoff = retry.NewBackoff(
		cfg.Retry.BaseDelay,
		cfg.Retry.MaxDelay,
		cfg.Retry.Multiplier,
		cfg.Retry.MaxAttempts,
		store,
		cfg.Retry.DeadLetterPath,
		log,
	)

	c, err := e.buildCollector()
	if err != nil {
		return nil, err
	}
	e.collector = c

	e.registerBuiltinParsers()

	return e, nil
}

func (e *Engine) buildCollector() (*colly.Collector, error) {
	jar, _ := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})

	c := colly.NewCollector(
		colly.Async(true),
		colly.UserAgent("Mozilla/5.0 (compatible; BankruptMonitor/1.0)"),
		colly.Debugger(&debug.LogDebugger{}),
	)

	c.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Parallelism: e.cfg.Crawler.WorkerCount,
		RandomDelay: time.Duration(e.cfg.Crawler.RequestDelay[0]) * time.Millisecond,
		Delay:       time.Duration(e.cfg.Crawler.RequestDelay[1]) * time.Millisecond,
	})

	c.SetCookieJar(jar)

	transport := &http.Transport{
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
		MaxIdleConns:          e.cfg.Crawler.WorkerCount * 2,
		MaxIdleConnsPerHost:   e.cfg.Crawler.WorkerCount,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	if len(e.cfg.Crawler.ProxyURLs) > 0 {
		proxyPool, err := NewProxyPool(e.cfg.Crawler.ProxyURLs)
		if err != nil {
			e.logger.Warn("proxy pool init failed", zap.Error(err))
		} else {
			transport.Proxy = proxyPool.ProxyFunc()
		}
	}

	c.WithTransport(transport)
	c.SetRequestTimeout(time.Duration(e.cfg.Crawler.Timeout) * time.Second)

	if e.cfg.Crawler.RobotsEnabled {
		c.CheckHead = true
	}

	extensions.RandomUserAgent(c)
	extensions.Referer(c)

	c.OnRequest(func(r *colly.Request) {
		e.currentURL.Store(r.URL.String())
		if len(e.cfg.Crawler.UserAgents) > 0 {
			ua := e.cfg.Crawler.UserAgents[rand.Intn(len(e.cfg.Crawler.UserAgents))]
			r.Headers.Set("User-Agent", ua)
		}
		r.Headers.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		r.Headers.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
		r.Headers.Set("Accept-Encoding", "gzip, deflate")
		r.Headers.Set("Connection", "keep-alive")
	})

	c.OnError(func(r *colly.Response, err error) {
		e.logger.Error("crawl error",
			zap.String("url", r.Request.URL.String()),
			zap.Int("status", r.StatusCode),
			zap.Error(err),
		)
		e.incError(r.Request.Ctx.GetAny("court_name"))
		ctx := context.Background()
		e.backoff.Do(ctx, func(ctx context.Context) error { return nil },
			r.Request.URL.String(),
			r.Request.Ctx.GetAny("court_name").(string),
			string(r.Body),
			false,
		)
	})

	if len(e.cfg.Crawler.CookiePool) > 0 {
		e.applyCookies(c)
	}

	return c, nil
}

func (e *Engine) applyCookies(c *colly.Collector) {
	for _, rawCookies := range e.cfg.Crawler.CookiePool {
		// cookie format: "name=value; domain=.example.com"
		// simplified: apply to each visited domain
		_ = rawCookies
	}
}

func (e *Engine) RegisterParser(name string, p AnnouncementParser) {
	e.parsers[name] = p
}

func (e *Engine) Crawl(ctx context.Context, courtCfg config.CourtConfig, fullScan bool) (*model.CrawlStats, error) {
	stats := &model.CrawlStats{
		URL:        courtCfg.ListURL,
		Court:      courtCfg.Name,
		StartedAt:  time.Now(),
	}
	e.statsMu.Lock()
	e.stats[courtCfg.Name] = stats
	e.statsMu.Unlock()

	p, ok := e.parsers[courtCfg.Parser]
	if !ok {
		p = &GenericParser{}
	}

	courtCollector := e.collector.Clone()
	p.ConfigureCollector(courtCollector)

	collected := make([]*ParsedAnnouncement, 0)
	var mu sync.Mutex

	courtCollector.OnHTML(p.ListSelector(), func(el *colly.HTMLElement) {
		links := p.ParseList(el)
		for _, link := range links {
			if ctx.Err() != nil {
				return
			}
			detailURL := e.resolveURL(courtCfg.BaseURL, link.URL)
			ctx2 := colly.NewContext()
			ctx2.Put("court_name", courtCfg.Name)
			ctx2.Put("announcement_link", link)
			courtCollector.Request("GET", detailURL, nil, ctx2, nil)
		}
	})

	courtCollector.OnHTML(p.DetailSelector(), func(el *colly.HTMLElement) {
		if ctx.Err() != nil {
			return
		}
		link, _ := el.Request.Ctx.GetAny("announcement_link").(*AnnouncementLink)
		parsed, err := p.ParseDetail(el, link)
		if err != nil {
			e.logger.Warn("parse detail failed",
				zap.String("url", el.Request.URL.String()),
				zap.Error(err),
			)
			e.backoff.Do(ctx, func(ctx context.Context) error { return nil },
				el.Request.URL.String(),
				courtCfg.Name,
				el.Response.Body,
				true,
			)
			e.incError(courtCfg.Name)
			return
		}
		if parsed != nil {
			parsed.SourceURL = el.Request.URL.String()
			parsed.SourceCourt = courtCfg.Name
			parsed.RawHTML = string(el.Response.Body)
			mu.Lock()
			collected = append(collected, parsed)
			mu.Unlock()
			e.incProcessed(courtCfg.Name)
		}
	})

	if p.NextPageSelector() != "" {
		courtCollector.OnHTML(p.NextPageSelector(), func(el *colly.HTMLElement) {
			if !fullScan && stats.ProcessedCount >= 50 {
				return
			}
			nextURL := e.resolveURL(courtCfg.BaseURL, el.Attr("href"))
			if nextURL != "" && nextURL != el.Request.URL.String() {
				ctx2 := colly.NewContext()
				ctx2.Put("court_name", courtCfg.Name)
				courtCollector.Request("GET", nextURL, nil, ctx2, nil)
			}
		})
	}

	startURL := courtCfg.ListURL
	if startURL == "" {
		startURL = courtCfg.BaseURL
	}

	ctx2 := colly.NewContext()
	ctx2.Put("court_name", courtCfg.Name)
	if err := courtCollector.Request("GET", startURL, nil, ctx2, nil); err != nil {
		return nil, fmt.Errorf("start request: %w", err)
	}

	done := make(chan struct{})
	go func() {
		courtCollector.Wait()
		close(done)
	}()

	select {
	case <-ctx.Done():
		return stats, ctx.Err()
	case <-done:
	}

	stats.FinishedAt = time.Now()
	stats.Elapsed = stats.ElapsedStr()

	for _, pa := range collected {
		if err := e.persist(pa); err != nil {
			e.logger.Error("persist failed", zap.Error(err), zap.String("url", pa.SourceURL))
			stats.ErrorCount++
		} else {
			stats.NewCount++
		}
	}

	return stats, nil
}

func (e *Engine) persist(pa *ParsedAnnouncement) error {
	annDate := parser.ParseDate(pa.AnnouncementDateStr)
	if annDate == nil {
		t := time.Now()
		annDate = &t
	}

	c := &model.Case{
		CaseNumber:       pa.CaseNumber,
		Debtor:           pa.Debtor,
		Creditors:        pa.Creditors,
		Administrator:    pa.Administrator,
		Court:            pa.Court,
		RulingNumber:     pa.RulingNumber,
		AnnouncementType: parser.DetectAnnouncementType(pa.Title, pa.Content),
		ClaimDeadline:    parser.ParseDate(pa.ClaimDeadlineStr),
		FirstHearingDate: parser.ParseDate(pa.HearingDateStr),
	}
	parser.NormalizeCase(c)

	isNewCase, err := e.store.UpsertCase(c)
	if err != nil {
		return fmt.Errorf("upsert case: %w", err)
	}
	_ = isNewCase

	ann := &model.Announcement{
		CaseID:           c.ID,
		Court:            pa.Court,
		Title:            pa.Title,
		AnnouncementDate: annDate,
		SourceURL:        pa.SourceURL,
		SourceCourt:      pa.SourceCourt,
		Content:          pa.Content,
		RawHTML:          pa.RawHTML,
		ParserVersion:    "v1.0.0",
	}
	ann.Fingerprint = ann.GenFingerprint()

	isNewAnn, err := e.store.UpsertAnnouncement(ann)
	if err != nil {
		return fmt.Errorf("upsert announcement: %w", err)
	}

	if isNewAnn {
		e.checkSubscriptions(c)
	}

	return nil
}

func (e *Engine) checkSubscriptions(c *model.Case) {
	subs, err := e.store.GetSubscriptions(true)
	if err != nil {
		e.logger.Error("get subscriptions failed", zap.Error(err))
		return
	}
	hit := false
	for _, sub := range subs {
		if parser.MatchSubscription(&sub, c) {
			hit = true
			e.logger.Info("subscription matched",
				zap.String("keyword", sub.Keyword),
				zap.String("debtor", c.Debtor),
			)
			break
		}
	}
	if hit && !c.HitSubscription {
		c.HitSubscription = true
		_, _ = e.store.UpsertCase(c)
	}
}

func (e *Engine) Stats(courtName string) *model.CrawlStats {
	e.statsMu.Lock()
	defer e.statsMu.Unlock()
	return e.stats[courtName]
}

func (e *Engine) CurrentURL() string {
	if v := e.currentURL.Load(); v != nil {
		return v.(string)
	}
	return ""
}

func (e *Engine) incProcessed(courtName any) {
	if courtName == nil {
		return
	}
	name, _ := courtName.(string)
	e.statsMu.Lock()
	defer e.statsMu.Unlock()
	if s, ok := e.stats[name]; ok {
		s.ProcessedCount++
	}
}

func (e *Engine) incError(courtName any) {
	if courtName == nil {
		return
	}
	name, _ := courtName.(string)
	e.statsMu.Lock()
	defer e.statsMu.Unlock()
	if s, ok := e.stats[name]; ok {
		s.ErrorCount++
	}
}

func (e *Engine) resolveURL(base, ref string) string {
	if ref == "" {
		return ""
	}
	baseURL, err := url.Parse(base)
	if err != nil {
		return ref
	}
	refURL, err := url.Parse(ref)
	if err != nil {
		return ref
	}
	return baseURL.ResolveReference(refURL).String()
}

type ProxyPool struct {
	proxies []*url.URL
	idx     int
	mu      sync.Mutex
}

func NewProxyPool(urls []string) (*ProxyPool, error) {
	pool := &ProxyPool{}
	for _, u := range urls {
		pu, err := url.Parse(u)
		if err != nil {
			return nil, err
		}
		pool.proxies = append(pool.proxies, pu)
	}
	return pool, nil
}

func (p *ProxyPool) ProxyFunc() func(*http.Request) (*url.URL, error) {
	return func(req *http.Request) (*url.URL, error) {
		if len(p.proxies) == 0 {
			return nil, nil
		}
		p.mu.Lock()
		defer p.mu.Unlock()
		pu := p.proxies[p.idx%len(p.proxies)]
		p.idx++
		return pu, nil
	}
}
