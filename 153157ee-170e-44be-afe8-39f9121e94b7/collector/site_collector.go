package collector

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"grain-monitor/models"
	"grain-monitor/parser"
	"grain-monitor/storage"

	"github.com/chromedp/chromedp"
)

type BrowserPool struct {
	instances chan *BrowserInstance
	mu        sync.Mutex
	total     int
	inUse     int
	headless  bool
}

type BrowserInstance struct {
	ctx    context.Context
	cancel context.CancelFunc
	pool   *BrowserPool
}

type SiteCollector struct {
	pool         *BrowserPool
	loginHandler *LoginHandler
	dataParser   *parser.DataParser
	repo         *storage.Repository
}

func NewBrowserPool(size int, headless bool) *BrowserPool {
	return &BrowserPool{
		instances: make(chan *BrowserInstance, size),
		total:     size,
		headless:  headless,
	}
}

func (bp *BrowserPool) Acquire() (*BrowserInstance, error) {
	select {
	case inst := <-bp.instances:
		bp.mu.Lock()
		bp.inUse++
		bp.mu.Unlock()
		return inst, nil
	default:
		inst, err := bp.createInstance()
		if err != nil {
			return nil, err
		}
		bp.mu.Lock()
		bp.inUse++
		bp.mu.Unlock()
		return inst, nil
	}
}

func (bp *BrowserPool) Release(inst *BrowserInstance) {
	bp.mu.Lock()
	bp.inUse--
	bp.mu.Unlock()

	if inst == nil {
		return
	}

	select {
	case bp.instances <- inst:
	default:
		inst.cancel()
	}
}

func (bp *BrowserPool) createInstance() (*BrowserInstance, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", bp.headless),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("blink-settings", "imagesEnabled=false"),
		chromedp.Flag("disable-javascript", false),
		chromedp.WindowSize(1920, 1080),
	)

	allocCtx, cancel := context.WithCancel(context.Background())
	allocCtx, _ = chromedp.NewExecAllocator(allocCtx, opts...)

	ctx, _ := chromedp.NewContext(allocCtx, chromedp.WithLogf(func(string, ...interface{}) {}))

	return &BrowserInstance{
		ctx:    ctx,
		cancel: cancel,
		pool:   bp,
	}, nil
}

func (bp *BrowserPool) Stats() models.BrowserPoolStats {
	bp.mu.Lock()
	defer bp.mu.Unlock()
	return models.BrowserPoolStats{
		Total:     bp.total,
		InUse:     bp.inUse,
		Available: bp.total - bp.inUse,
	}
}

func (bp *BrowserPool) Close() {
	close(bp.instances)
	for inst := range bp.instances {
		inst.cancel()
	}
}

func (bi *BrowserInstance) Context() context.Context {
	return bi.ctx
}

func (bi *BrowserInstance) Close() {
	bi.pool.Release(bi)
}

func NewSiteCollector(pool *BrowserPool, loginHandler *LoginHandler, dataParser *parser.DataParser, repo *storage.Repository) *SiteCollector {
	return &SiteCollector{
		pool:         pool,
		loginHandler: loginHandler,
		dataParser:   dataParser,
		repo:         repo,
	}
}

func (sc *SiteCollector) CollectSite(site *models.SiteConfig) *models.CollectorResult {
	startTime := time.Now()
	result := &models.CollectorResult{
		SiteID:  site.ID,
		Success: false,
	}

	inst, err := sc.pool.Acquire()
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("acquire browser failed: %v", err)
		result.DurationMs = time.Since(startTime).Milliseconds()
		return result
	}
	defer inst.Close()

	ctx := inst.Context()

	if site.RequiresLogin {
		if err := sc.loginHandler.EnsureLogin(ctx, site); err != nil {
			result.ErrorMessage = fmt.Sprintf("login failed: %v", err)
			result.DurationMs = time.Since(startTime).Milliseconds()
			return result
		}
	}

	totalFields := 0
	fieldsCount := 0
	var snapshots []models.MarketSnapshot
	var policyItems []models.PolicyItem

	for pageKey, pageConfig := range site.PageConfigs {
		grainType, priceType := parsePageKey(pageKey)

		pageResult, err := sc.collectPage(ctx, site, &pageConfig, grainType, priceType)
		if err != nil {
			result.ErrorMessage += fmt.Sprintf(" page[%s]: %v;", pageKey, err)
			continue
		}

		totalFields += pageResult.totalFields
		fieldsCount += pageResult.fieldsCount

		if pageConfig.IsPolicyPage {
			policyItems = append(policyItems, pageResult.policyItems...)
		} else {
			prevSnap, _ := sc.repo.GetLatestSnapshot(site.ID, grainType, priceType)

			snap, fc, tf, err := sc.dataParser.ParseMarketData(
				site.ID, grainType, priceType,
				pageResult.rawData, prevSnap,
			)
			if err == nil {
				_ = fc
				_ = tf
				snapshots = append(snapshots, *snap)
			}
		}
	}

	result.Success = true
	result.Snapshots = snapshots
	result.PolicyItems = policyItems
	result.FieldsCount = fieldsCount
	result.TotalFields = totalFields
	result.DurationMs = time.Since(startTime).Milliseconds()
	result.RetryCount = 0

	if !result.Success && result.ErrorMessage == "" {
		result.ErrorMessage = "no data collected"
	}

	return result
}

type pageCollectResult struct {
	rawData      map[string]string
	totalFields  int
	fieldsCount  int
	policyItems  []models.PolicyItem
}

func (sc *SiteCollector) collectPage(ctx context.Context, site *models.SiteConfig, pageCfg *models.PageConfig,
	grainType models.GrainType, priceType models.PriceType) (*pageCollectResult, error) {

	result := &pageCollectResult{
		rawData:     make(map[string]string),
		totalFields: len(pageCfg.DataSelectors),
	}

	timeout := 30 * time.Second
	if site.TimeoutSeconds > 0 {
		timeout = time.Duration(site.TimeoutSeconds) * time.Second
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	err := chromedp.Run(ctx,
		chromedp.Navigate(pageCfg.URL),
	)
	if err != nil {
		return nil, fmt.Errorf("navigate failed: %w", err)
	}

	for _, popupSel := range pageCfg.PopupSelectors {
		chromedp.Run(ctx,
			chromedp.Evaluate(fmt.Sprintf(`
				(function() {
					var el = document.querySelector('%s');
					if (el) { el.style.display = 'none'; return true; }
					return false;
				})()
			`, popupSel), nil),
		)
	}

	if pageCfg.WaitSelector != "" {
		waitTimeout := 15 * time.Second
		waitCtx, waitCancel := context.WithTimeout(ctx, waitTimeout)
		defer waitCancel()

		var waitErr error
		switch pageCfg.WaitType {
		case "visible":
			waitErr = chromedp.Run(waitCtx, chromedp.WaitVisible(pageCfg.WaitSelector, chromedp.ByQuery))
		case "ready":
			waitErr = chromedp.Run(waitCtx, chromedp.WaitReady(pageCfg.WaitSelector, chromedp.ByQuery))
		default:
			waitErr = chromedp.Run(waitCtx, chromedp.WaitVisible(pageCfg.WaitSelector, chromedp.ByQuery))
		}
		if waitErr != nil {
			return nil, fmt.Errorf("wait selector '%s' failed: %w", pageCfg.WaitSelector, waitErr)
		}
	}

	if pageCfg.NeedScroll {
		sc.scrollToBottom(ctx, pageCfg.ScrollSelector)
	}

	if pageCfg.UseIframe && pageCfg.IframeSelector != "" {
		data, err := sc.extractDataFromIframe(ctx, pageCfg)
		if err != nil {
			return nil, fmt.Errorf("extract iframe data failed: %w", err)
		}
		result.rawData = data
	} else {
		data, err := sc.extractData(ctx, pageCfg)
		if err != nil {
			return nil, fmt.Errorf("extract data failed: %w", err)
		}
		result.rawData = data
	}

	for _, v := range result.rawData {
		if v != "" && v != "-" && v != "--" {
			result.fieldsCount++
		}
	}

	if pageCfg.IsPolicyPage {
		result.policyItems = sc.dataParser.ParsePolicyItems(
			sc.extractPolicyList(ctx, pageCfg),
			pageCfg.PolicyKeywords,
		)
	}

	return result, nil
}

func (sc *SiteCollector) extractData(ctx context.Context, pageCfg *models.PageConfig) (map[string]string, error) {
	data := make(map[string]string)

	for field, selector := range pageCfg.DataSelectors {
		var value string
		err := chromedp.Run(ctx,
			chromedp.Evaluate(fmt.Sprintf(`
				(function() {
					var el = document.querySelector('%s');
					return el ? el.textContent.trim() : '';
				})()
			`, selector), &value),
		)
		if err == nil {
			data[field] = strings.TrimSpace(value)
		}
	}

	return data, nil
}

func (sc *SiteCollector) extractDataFromIframe(ctx context.Context, pageCfg *models.PageConfig) (map[string]string, error) {
	data := make(map[string]string)

	var iframeExists bool
	err := chromedp.Run(ctx,
		chromedp.Evaluate(fmt.Sprintf(`document.querySelector('%s') !== null`, pageCfg.IframeSelector), &iframeExists),
	)
	if err != nil || !iframeExists {
		return data, fmt.Errorf("iframe not found")
	}

	jsCode := `
	(function() {
		var iframe = document.querySelector('` + pageCfg.IframeSelector + `');
		if (!iframe || !iframe.contentDocument) return {};
		var doc = iframe.contentDocument;
		var result = {};
	`
	for field, selector := range pageCfg.DataSelectors {
		jsCode += fmt.Sprintf(`
			var el_%s = doc.querySelector('%s');
			result['%s'] = el_%s ? el_%s.textContent.trim() : '';
		`, field, selector, field, field, field)
	}
	jsCode += `
		return result;
	})()
	`

	var result map[string]string
	err = chromedp.Run(ctx, chromedp.Evaluate(jsCode, &result))
	if err != nil {
		return data, err
	}

	return result, nil
}

func (sc *SiteCollector) scrollToBottom(ctx context.Context, selector string) {
	chromedp.Run(ctx,
		chromedp.Evaluate(`
			(function() {
				window.scrollTo(0, document.body.scrollHeight);
				return true;
			})()
		`, nil),
		chromedp.Sleep(500*time.Millisecond),
	)
}

func (sc *SiteCollector) extractPolicyList(ctx context.Context, pageCfg *models.PageConfig) []map[string]string {
	var items []map[string]string

	jsCode := `
	(function() {
		var items = [];
		var list = document.querySelectorAll('.policy-list li');
		for (var i = 0; i < list.length && i < 20; i++) {
			var item = {};
			var a = list[i].querySelector('a');
			if (a) {
				item.title = a.textContent.trim();
				item.url = a.href || '';
			}
			var date = list[i].querySelector('.date');
			if (date) {
				item.date = date.textContent.trim();
			}
			items.push(item);
		}
		return items;
	})()
	`

	chromedp.Run(ctx, chromedp.Evaluate(jsCode, &items))
	return items
}

func parsePageKey(key string) (models.GrainType, models.PriceType) {
	grainMap := map[string]models.GrainType{
		"wheat":   models.Wheat,
		"rice":    models.Rice,
		"corn":    models.Corn,
		"soybean": models.Soybean,
	}

	var grain models.GrainType
	var priceType models.PriceType = models.FuturesPrice

	if strings.Contains(key, "_spot") {
		priceType = models.SpotPrice
	}

	for name, g := range grainMap {
		if strings.HasPrefix(key, name) || strings.Contains(key, name) {
			grain = g
			break
		}
	}

	return grain, priceType
}

func (sc *SiteCollector) CollectWithRetry(site *models.SiteConfig, maxRetries int) *models.CollectorResult {
	var result *models.CollectorResult
	backoff := []time.Duration{2 * time.Second, 4 * time.Second, 8 * time.Second}

	for i := 0; i <= maxRetries; i++ {
		result = sc.CollectSite(site)
		result.RetryCount = i

		if result.Success {
			return result
		}

		if i < maxRetries {
			if i < len(backoff) {
				time.Sleep(backoff[i])
			} else {
				time.Sleep(backoff[len(backoff)-1])
			}
		}
	}

	return result
}
