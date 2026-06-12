package crawler

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"math/rand"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"courttrack/internal/logger"
	"courttrack/internal/storage"
	"courttrack/internal/types"
)

const stealthScript = `
(() => {
	const originalQuery = window.navigator.permissions.query;
	window.navigator.permissions.query = (parameters) => (
		parameters.name === 'notifications' ?
			Promise.resolve({ state: Notification.permission }) :
			originalQuery(parameters)
	);
	Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
	Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
	Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
	window.chrome = { runtime: {} };
	delete window.cdc_adoQpoasnfa76pfcZLmcfl_;
	const originalGetContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function(type) {
		const ctx = originalGetContext.call(this, type);
		if (type === '2d') {
			const originalToDataURL = ctx.canvas.toDataURL;
			ctx.canvas.toDataURL = function() {
				return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
			};
		}
		return ctx;
	};
})();
`

type BrowserPool struct {
	pool     chan *BrowserInstance
	mu       sync.RWMutex
	instances map[string]*BrowserInstance
	maxSize  int
	headless bool
	store    *storage.Store
}

type BrowserInstance struct {
	ctx        context.Context
	cancel     context.CancelFunc
	allocCtx   context.Context
	allocCancel context.CancelFunc
	id         string
	lastUsed   time.Time
	inUse      bool
}

type CrawlResult struct {
	HTML     string
	URL      string
	HTTPStatus int
	Cookies  []*network.Cookie
	Error    error
}

func NewBrowserPool(maxSize int, headless bool, store *storage.Store) *BrowserPool {
	pool := &BrowserPool{
		pool:      make(chan *BrowserInstance, maxSize),
		instances: make(map[string]*BrowserInstance),
		maxSize:   maxSize,
		headless:  headless,
		store:     store,
	}

	for i := 0; i < maxSize; i++ {
		if inst, err := pool.createInstance(); err == nil {
			pool.pool <- inst
			pool.instances[inst.id] = inst
		}
	}

	go pool.reaper()
	return pool
}

func (p *BrowserPool) createInstance() (*BrowserInstance, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", p.headless),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
		chromedp.WindowSize(1920, 1080),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)
	ctx, cancel := chromedp.NewContext(allocCtx)

	id := md5Hash(fmt.Sprintf("%d-%d", time.Now().UnixNano(), rand.Int()))

	inst := &BrowserInstance{
		ctx:         ctx,
		cancel:      cancel,
		allocCtx:    allocCtx,
		allocCancel: allocCancel,
		id:          id,
		lastUsed:    time.Now(),
	}

	if err := chromedp.Run(ctx,
		chromedp.Evaluate(stealthScript, nil),
		network.Enable(),
	); err != nil {
		allocCancel()
		return nil, err
	}

	return inst, nil
}

func (p *BrowserPool) Get(ctx context.Context) (*BrowserInstance, error) {
	select {
	case inst := <-p.pool:
		inst.inUse = true
		inst.lastUsed = time.Now()
		return inst, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (p *BrowserPool) Put(inst *BrowserInstance) {
	inst.inUse = false
	inst.lastUsed = time.Now()
	select {
	case p.pool <- inst:
	default:
		p.mu.Lock()
		delete(p.instances, inst.id)
		p.mu.Unlock()
		inst.allocCancel()
	}
}

func (p *BrowserPool) reaper() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		p.mu.Lock()
		for id, inst := range p.instances {
			if !inst.inUse && time.Since(inst.lastUsed) > 30*time.Minute {
				inst.allocCancel()
				delete(p.instances, id)
			}
		}

		for len(p.instances) < p.maxSize {
			if inst, err := p.createInstance(); err == nil {
				p.instances[inst.id] = inst
				p.pool <- inst
			} else {
				break
			}
		}
		p.mu.Unlock()
	}
}

func (p *BrowserPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, inst := range p.instances {
		inst.allocCancel()
	}
	close(p.pool)
}

func (p *BrowserPool) CrawlPage(ctx context.Context, court *types.CourtSource, targetURL string, timeout time.Duration) *CrawlResult {
	result := &CrawlResult{
		URL: targetURL,
		HTTPStatus: 200,
	}

	inst, err := p.Get(ctx)
	if err != nil {
		result.Error = err
		return result
	}
	defer p.Put(inst)

	crawlCtx, cancel := context.WithTimeout(inst.ctx, timeout)
	defer cancel()

	if err := p.restoreCookies(crawlCtx, court.ID); err != nil {
		logger.Sugar.Warnw("failed to restore cookies", "court", court.ID, "error", err)
	}

	var html string
	var statusCode int64

	actions := []chromedp.Action{
		chromedp.ActionFunc(func(ctx context.Context) error {
			network.SetCookies(p.cookiesFromStore(court.ID))
			return nil
		}),
		chromedp.Navigate(targetURL),
		chromedp.WaitVisible("body", chromedp.ByQuery),
		chromedp.Sleep(randomDelay(1000, 3000)),
	}

	if court.CaptchaConfig != nil {
		actions = append(actions, p.handleCaptcha(court)...)
	}

	actions = append(actions,
		chromedp.OuterHTML("html", &html),
		chromedp.ActionFunc(func(ctx context.Context) error {
			expr := `(() => { return performance.getEntriesByType('navigation')[0]?.responseStatus || 200; })()`
			return chromedp.Evaluate(expr, &statusCode).Do(ctx)
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			cookies, err := network.GetCookies().Do(ctx)
			if err == nil && len(cookies) > 0 {
				p.saveCookies(court.ID, cookies)
			}
			return nil
		}),
	)

	if err := chromedp.Run(crawlCtx, actions...); err != nil {
		if court.CaptchaConfig != nil && court.CaptchaConfig.Fallback == "manual" {
			if err := p.manualFallback(crawlCtx, court); err == nil {
				if retryErr := chromedp.Run(crawlCtx,
					chromedp.OuterHTML("html", &html),
				); retryErr == nil {
					result.HTML = html
					result.HTTPStatus = int(statusCode)
					return result
				}
			}
		}
		result.Error = err
		result.HTTPStatus = int(statusCode)
		return result
	}

	result.HTML = html
	result.HTTPStatus = int(statusCode)
	return result
}

func (p *BrowserPool) handleCaptcha(court *types.CourtSource) []chromedp.Action {
	if court.CaptchaConfig == nil {
		return nil
	}

	switch court.CaptchaConfig.Type {
	case "slider":
		return p.handleSliderCaptcha(court)
	default:
		return nil
	}
}

func (p *BrowserPool) handleSliderCaptcha(court *types.CourtSource) []chromedp.Action {
	selector := court.CaptchaConfig.Selector
	if selector == "" {
		selector = ".slider, #captcha-slider, .nc_iconfont"
	}

	return []chromedp.Action{
		chromedp.WaitVisible(selector, chromedp.ByQuery),
		chromedp.Sleep(randomDelay(500, 1500)),
		chromedp.MouseClickXY(0, 0, chromedp.NodeVisible, chromedp.ByQuery(selector)),
		chromedp.ActionFunc(func(ctx context.Context) error {
			for i := 0; i < 3; i++ {
				if err := p.simulateHumanDrag(ctx, selector); err == nil {
					time.Sleep(randomDelay(500, 1000))
					return nil
				}
				time.Sleep(randomDelay(1000, 2000))
			}
			return errors.New("slider captcha failed after 3 attempts")
		}),
	}
}

func (p *BrowserPool) simulateHumanDrag(ctx context.Context, selector string) error {
	var startX, startY float64
	var node chromedp.Node

	if err := chromedp.EvaluateAsDevTools(
		fmt.Sprintf(`(() => {
			const el = document.querySelector('%s');
			const rect = el.getBoundingClientRect();
			return { x: rect.left + rect.width/2, y: rect.top + rect.height/2, w: rect.width };
		})()`, selector),
		&struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			W float64 `json:"w"`
		}{&startX, &startY, nil},
	).Do(ctx); err != nil {
		return err
	}

	dragDistance := 300.0
	if err := chromedp.MouseMove(startX, startY).Do(ctx); err != nil {
		return err
	}
	if err := chromedp.MouseDown(selector, chromedp.ByQuery).Do(ctx); err != nil {
		return err
	}

	steps := 50 + rand.Intn(30)
	for i := 1; i <= steps; i++ {
		progress := float64(i) / float64(steps)
		humanProgress := progress + mathSin(progress*6*math.Pi)*0.02
		currentX := startX + dragDistance*humanProgress
		currentY := startY + rand.Float64()*5 - 2.5

		if err := chromedp.MouseMove(currentX, currentY).Do(ctx); err != nil {
			chromedp.MouseUp(selector, chromedp.ByQuery).Do(ctx)
			return err
		}
		time.Sleep(time.Duration(10+rand.Intn(20)) * time.Millisecond)
	}

	return chromedp.MouseUp(selector, chromedp.ByQuery).Do(ctx)
}

func (p *BrowserPool) manualFallback(ctx context.Context, court *types.CourtSource) error {
	logger.Sugar.Warnw("manual captcha fallback required", "court", court.ID)

	fmt.Printf("\n=== 需要人工验证 ===\n")
	fmt.Printf("法院: %s\n", court.Name)
	fmt.Printf("请在浏览器中完成验证码验证...\n")
	fmt.Printf("按 Enter 继续...\n")
	fmt.Scanln()

	return chromedp.Run(ctx,
		chromedp.Sleep(2*time.Second),
		chromedp.WaitVisible("body", chromedp.ByQuery),
	)
}

func (p *BrowserPool) saveCookies(courtID string, cookies []*network.Cookie) {
	if p.store == nil || len(cookies) == 0 {
		return
	}

	data, err := network.GetCookiesReturns{Cookies: cookies}.MarshalJSON()
	if err != nil {
		return
	}
	p.store.SaveCourtSiteMetadata(courtID+"_cookies", data)
}

func (p *BrowserPool) restoreCookies(ctx context.Context, courtID string) error {
	if p.store == nil {
		return nil
	}

	data, err := p.store.GetCourtSiteMetadata(courtID + "_cookies")
	if err != nil {
		return err
	}

	var cookies network.GetCookiesReturns
	if err := cookies.UnmarshalJSON(data); err != nil {
		return err
	}

	return network.SetCookies(cookies.Cookies).Do(ctx)
}

func (p *BrowserPool) cookiesFromStore(courtID string) []*network.CookieParam {
	if p.store == nil {
		return nil
	}

	data, err := p.store.GetCourtSiteMetadata(courtID + "_cookies")
	if err != nil {
		return nil
	}

	var cookies network.GetCookiesReturns
	if err := cookies.UnmarshalJSON(data); err != nil {
		return nil
	}

	params := make([]*network.CookieParam, len(cookies.Cookies))
	for i, c := range cookies.Cookies {
		params[i] = &network.CookieParam{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Secure:   c.Secure,
			HTTPOnly: c.HTTPOnly,
		}
	}
	return params
}

func (p *BrowserPool) Login(court *types.CourtSource, username, password string) error {
	if court.LoginConfig == nil {
		return errors.New("no login config")
	}

	ctx := context.Background()
	inst, err := p.Get(ctx)
	if err != nil {
		return err
	}
	defer p.Put(inst)

	return chromedp.Run(inst.ctx,
		chromedp.Navigate(court.LoginConfig.URL),
		chromedp.WaitVisible(court.LoginConfig.UsernameSelector, chromedp.ByQuery),
		chromedp.Sleep(randomDelay(500, 1000)),
		chromedp.SendKeys(court.LoginConfig.UsernameSelector, username, chromedp.ByQuery),
		chromedp.Sleep(randomDelay(300, 800)),
		chromedp.SendKeys(court.LoginConfig.PasswordSelector, password, chromedp.ByQuery),
		chromedp.Sleep(randomDelay(500, 1000)),
		chromedp.Click(court.LoginConfig.SubmitSelector, chromedp.ByQuery),
		chromedp.WaitVisible("body", chromedp.ByQuery),
		chromedp.Sleep(2*time.Second),
		chromedp.ActionFunc(func(ctx context.Context) error {
			cookies, err := network.GetCookies().Do(ctx)
			if err == nil {
				p.saveCookies(court.ID, cookies)
			}
			return err
		}),
	)
}

func md5Hash(s string) string {
	h := md5.Sum([]byte(s))
	return hex.EncodeToString(h[:])
}

func randomDelay(min, max int) time.Duration {
	return time.Duration(min+rand.Intn(max-min)) * time.Millisecond
}

func mathSin(x float64) float64 {
	return float64(mathSinInt(int(x * 10000)))
}

func mathSinInt(x int) float64 {
	neg := false
	if x < 0 {
		x = -x
		neg = true
	}
	x %= 62831
	if x > 31415 {
		x = 62831 - x
		neg = !neg
	}
	x2 := x * x
	x4 := x2 * x2
	x6 := x4 * x2
	result := float64(x) - float64(x2*x)/6e8 + float64(x4*x)/120e16 - float64(x6*x)/5040e24
	if neg {
		return -result
	}
	return result
}

func ExtractDomain(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	host := parsed.Hostname()
	parts := strings.Split(host, ".")
	if len(parts) >= 2 {
		return strings.Join(parts[len(parts)-2:], ".")
	}
	return host
}
