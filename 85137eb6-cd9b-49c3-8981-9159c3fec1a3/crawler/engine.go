package crawler

import (
	"crypto/md5"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/gocolly/colly/v2"
	"github.com/gocolly/colly/v2/extensions"

	"price-monitor/config"
	"price-monitor/logger"
	"price-monitor/parser"
	"price-monitor/storage"
)

type CrawlTask struct {
	SKU       config.SKUConfig
	Site      config.SiteConfig
	Keyword   string
	Priority  int
	Retries   int
}

type CrawlResult struct {
	Task    *CrawlTask
	Record  *storage.PriceRecord
	Success bool
	Error   error
}

type Engine struct {
	collector  *colly.Collector
	cfg        *config.AppConfig
	semaphore  chan struct{}
	results    chan *CrawlResult
	wg         sync.WaitGroup
	active     int32
	successCnt int32
	failCnt    int32
	totalCnt   int32
	cookieJar  map[string]map[string]string
	cookieMu   sync.RWMutex
	uaIndex    int32
	proxyIndex int32
}

func NewEngine(cfg *config.AppConfig) *Engine {
	e := &Engine{
		cfg:       cfg,
		semaphore: make(chan struct{}, cfg.Global.Concurrency),
		results:   make(chan *CrawlResult, cfg.Global.Concurrency*2),
		cookieJar: make(map[string]map[string]string),
	}

	c := colly.NewCollector(
		colly.AllowURLRevisit(),
		colly.MaxDepth(1),
		colly.Async(true),
		colly.IgnoreRobotsTxt(),
	)

	c.SetRequestTimeout(time.Duration(cfg.Global.Timeout) * time.Second)
	c.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Parallelism: cfg.Global.Concurrency,
		RandomDelay: 500 * time.Millisecond,
		Delay:       200 * time.Millisecond,
	})

	extensions.RandomUserAgent(c)

	c.OnRequest(func(r *colly.Request) {
		e.setRequestHeaders(r)
		logger.Debug("Requesting: %s", r.URL.String())
	})

	c.OnResponse(func(r *colly.Response) {
		logger.Debug("Response received from %s, status: %d, size: %d",
			r.Request.URL.String(), r.StatusCode, len(r.Body))
	})

	c.OnError(func(r *colly.Response, err error) {
		logger.Warn("Request error for %s: status=%d, error=%v",
			r.Request.URL.String(), r.StatusCode, err)
	})

	e.collector = c
	return e
}

func (e *Engine) setRequestHeaders(r *colly.Request) {
	if e.cfg.Global.UserAgentRotation {
		idx := atomic.AddInt32(&e.uaIndex, 1) % int32(len(config.UserAgentPool))
		r.Headers.Set("User-Agent", config.UserAgentPool[idx])
	}

	r.Headers.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	r.Headers.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	r.Headers.Set("Accept-Encoding", "gzip, deflate, br")
	r.Headers.Set("Connection", "keep-alive")
	r.Headers.Set("Upgrade-Insecure-Requests", "1")
	r.Headers.Set("Cache-Control", "no-cache")
	r.Headers.Set("Pragma", "no-cache")

	host := r.URL.Host
	r.Headers.Set("Host", host)
	r.Headers.Set("Origin", r.URL.Scheme+"://"+host)
	r.Headers.Set("Referer", r.URL.Scheme+"://"+host+"/")

	e.cookieMu.RLock()
	if cookies, ok := e.cookieJar[host]; ok {
		for k, v := range cookies {
			r.Headers.Set("Cookie", k+"="+v)
		}
	}
	e.cookieMu.RUnlock()
}

func (e *Engine) handleAntiBot(r *colly.Response) bool {
	body := strings.ToLower(string(r.Body))
	detectors := []string{
		"验证码", "captcha", "verify", "security check",
		"访问过于频繁", "rate limit", "forbidden", "403",
		"anti-bot", "antibot", "blocked",
	}
	for _, d := range detectors {
		if strings.Contains(body, d) {
			return true
		}
	}
	return false
}

func (e *Engine) extractCookies(r *colly.Response) {
	cookies := r.Headers.Values("Set-Cookie")
	if len(cookies) == 0 {
		return
	}

	host := r.Request.URL.Host
	e.cookieMu.Lock()
	defer e.cookieMu.Unlock()

	if _, ok := e.cookieJar[host]; !ok {
		e.cookieJar[host] = make(map[string]string)
	}

	for _, cookie := range cookies {
		if idx := strings.Index(cookie, "="); idx > 0 {
			name := strings.TrimSpace(cookie[:idx])
			val := cookie[idx+1:]
			if semi := strings.Index(val, ";"); semi > 0 {
				val = val[:semi]
			}
			e.cookieJar[host][name] = strings.TrimSpace(val)
		}
	}
}

func (e *Engine) CrawlSingle(task *CrawlTask) *CrawlResult {
	result := &CrawlResult{Task: task}
	searchURL := strings.ReplaceAll(task.Site.SearchURL, "{keyword}", url.QueryEscape(task.Keyword))

	c := e.collector.Clone()
	extensions.RandomUserAgent(c)

	var record *storage.PriceRecord
	var parseErr error
	var doc *goquery.Document

	c.OnResponse(func(r *colly.Response) {
		e.extractCookies(r)

		if r.StatusCode != http.StatusOK {
			parseErr = fmt.Errorf("HTTP status %d", r.StatusCode)
			return
		}

		if e.handleAntiBot(r) {
			parseErr = fmt.Errorf("anti-bot detection triggered")
			return
		}

		var err error
		doc, err = goquery.NewDocumentFromReader(strings.NewReader(string(r.Body)))
		if err != nil {
			parseErr = fmt.Errorf("parse HTML failed: %w", err)
			return
		}

		parsedData := parser.ParsePricePage(doc, task.Site)

		priceFinal := parsedData.PricePromo
		if priceFinal <= 0 {
			priceFinal = parsedData.PriceOriginal
		}
		if parsedData.PriceMember > 0 && parsedData.PriceMember < priceFinal {
			priceFinal = parsedData.PriceMember
		}

		if priceFinal <= 0 {
			parseErr = fmt.Errorf("no valid price found")
			return
		}

		hashData := fmt.Sprintf("%s|%s|%.2f|%.2f|%.2f",
			task.Site.ID, task.SKU.SKUId,
			parsedData.PriceOriginal, parsedData.PricePromo, parsedData.PriceMember)
		hash := fmt.Sprintf("%x", md5.Sum([]byte(hashData)))

		record = &storage.PriceRecord{
			SKUId:         task.SKU.SKUId,
			SKUName:       task.SKU.Name,
			Brand:         task.SKU.Brand,
			Category:      task.SKU.Category,
			SiteId:        task.Site.ID,
			SiteName:      task.Site.Name,
			PriceOriginal: parsedData.PriceOriginal,
			PricePromo:    parsedData.PricePromo,
			PriceMember:   parsedData.PriceMember,
			PriceFinal:    priceFinal,
			Currency:      task.Site.Currency,
			URL:           searchURL,
			Title:         parsedData.Title,
			Stock:         parsedData.Stock,
			CrawledAt:     time.Now(),
			Hash:          hash,
		}
	})

	err := c.Visit(searchURL)
	if err != nil {
		parseErr = fmt.Errorf("visit failed: %w", err)
	}

	c.Wait()

	if parseErr != nil {
		result.Error = parseErr
		result.Success = false
		logger.Warn("Crawl failed [%s][%s][%s]: %v",
			task.Site.Name, task.SKU.SKUId, task.Keyword, parseErr)
	} else if record != nil {
		result.Record = record
		result.Success = true
		atomic.AddInt32(&e.successCnt, 1)
		logger.Debug("Crawl success [%s][%s]: 原价=%.2f 促销=%.2f 会员=%.2f",
			task.Site.Name, task.SKU.Name,
			record.PriceOriginal, record.PricePromo, record.PriceMember)
	} else {
		result.Error = fmt.Errorf("empty result")
		result.Success = false
	}

	return result
}

func (e *Engine) CrawlWithRetry(task *CrawlTask) *CrawlResult {
	maxRetries := e.cfg.Global.MaxRetries
	retryIntervals := e.cfg.Global.RetryInterval

	var lastResult *CrawlResult
	for attempt := 0; attempt <= maxRetries; attempt++ {
		lastResult = e.CrawlSingle(task)
		if lastResult.Success {
			return lastResult
		}

		if attempt < maxRetries {
			interval := retryIntervals[attempt%len(retryIntervals)]
			jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
			waitTime := time.Duration(interval)*time.Second + jitter
			logger.Info("Retry [%d/%d] for [%s][%s] after %v...",
				attempt+1, maxRetries, task.Site.Name, task.SKU.SKUId, waitTime)
			time.Sleep(waitTime)
		}
	}

	atomic.AddInt32(&e.failCnt, 1)
	return lastResult
}

func (e *Engine) CrawlBatch(tasks []*CrawlTask, progressCb func(done, total int, result *CrawlResult)) ([]*storage.PriceRecord, []error) {
	atomic.StoreInt32(&e.successCnt, 0)
	atomic.StoreInt32(&e.failCnt, 0)
	atomic.StoreInt32(&e.totalCnt, int32(len(tasks)))

	var records []*storage.PriceRecord
	var errs []error
	var mu sync.Mutex

	doneCount := int32(0)
	total := len(tasks)

	for _, task := range tasks {
		e.wg.Add(1)
		e.semaphore <- struct{}{}

		go func(t *CrawlTask) {
			defer e.wg.Done()
			defer func() { <-e.semaphore }()

			atomic.AddInt32(&e.active, 1)
			result := e.CrawlWithRetry(t)
			atomic.AddInt32(&e.active, -1)

			mu.Lock()
			if result.Success && result.Record != nil {
				records = append(records, result.Record)
			} else if result.Error != nil {
				errs = append(errs, result.Error)
			}
			done := atomic.AddInt32(&doneCount, 1)
			if progressCb != nil {
				progressCb(int(done), total, result)
			}
			mu.Unlock()
		}(task)
	}

	e.wg.Wait()
	return records, errs
}

func (e *Engine) TestConnection(site config.SiteConfig) error {
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout:   5 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout: 5 * time.Second,
		},
	}

	req, err := http.NewRequest("GET", site.BaseURL, nil)
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("User-Agent", config.UserAgentPool[0])
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
			return fmt.Errorf("connection timeout")
		}
		if dnserr, ok := err.(*net.DNSError); ok {
			return fmt.Errorf("DNS resolution failed: %s", dnserr.Err)
		}
		return fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	return nil
}

func (e *Engine) GetStats() (success, fail, total, active int32) {
	return atomic.LoadInt32(&e.successCnt),
		atomic.LoadInt32(&e.failCnt),
		atomic.LoadInt32(&e.totalCnt),
		atomic.LoadInt32(&e.active)
}

func (e *Engine) Close() {
	if e.collector != nil {
		e.collector = nil
	}
	close(e.results)
}
