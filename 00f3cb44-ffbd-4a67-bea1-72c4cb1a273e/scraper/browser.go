package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"github.com/rs/zerolog/log"
)

type BrowserPool struct {
	poolSize     int
	instances    chan *BrowserInstance
	mu           sync.Mutex
	userAgents   []string
	cookiesDir   string
	screenshotsDir string
	crashed      map[int]bool
}

type BrowserInstance struct {
	ctx        context.Context
	cancel     context.CancelFunc
	allocCancel context.CancelFunc
	userAgent  string
	viewport   Viewport
	lastUsed   time.Time
	id         int
	busy       bool
	fingerprint Fingerprint
	lastCheck  time.Time
}

type Viewport struct {
	Width  int
	Height int
}

type Fingerprint struct {
	UserAgent     string
	Viewport      Viewport
	Language      string
	Timezone      string
	WebGLVendor   string
	WebGLRenderer string
	Platform      string
}

type CookieData struct {
	Cookies    []*network.Cookie `json:"cookies"`
	SavedAt    time.Time         `json:"saved_at"`
	ExpiresAt  time.Time         `json:"expires_at"`
}

var (
	viewports = []Viewport{
		{1920, 1080},
		{1366, 768},
		{1440, 900},
		{1536, 864},
		{1280, 720},
		{1680, 1050},
	}

	languages = []string{
		"en-US,en;q=0.9",
		"en-GB,en;q=0.9",
		"en-CA,en;q=0.8",
	}

	timezones = []string{
		"America/New_York",
		"America/Los_Angeles",
		"America/Chicago",
		"Europe/London",
	}

	webglVendors = []string{
		"Google Inc. (Intel)",
		"Google Inc. (ATI Technologies Inc.)",
		"Intel Inc.",
	}

	webglRenderers = []string{
		"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D)",
		"ANGLE (Intel, Iris Plus Graphics Direct3D11 vs_5_0 ps_5_0)",
		"ANGLE (ATI Technologies Inc., AMD Radeon Pro 5500M OpenGL Engine)",
	}

	platforms = []string{
		"Win32",
		"MacIntel",
		"Linux x86_64",
	}
)

func NewBrowserPool(poolSize int, userAgents []string, cookiesDir string, screenshotsDir string) *BrowserPool {
	if poolSize <= 0 {
		poolSize = 3
	}
	if len(userAgents) == 0 {
		userAgents = []string{
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		}
	}
	return &BrowserPool{
		poolSize:       poolSize,
		instances:      make(chan *BrowserInstance, poolSize),
		userAgents:     userAgents,
		cookiesDir:     cookiesDir,
		screenshotsDir: screenshotsDir,
		crashed:        make(map[int]bool),
	}
}

func (bp *BrowserPool) Start(ctx context.Context) error {
	if err := os.MkdirAll(bp.cookiesDir, 0755); err != nil {
		return fmt.Errorf("create cookies dir: %w", err)
	}
	if err := os.MkdirAll(bp.screenshotsDir, 0755); err != nil {
		return fmt.Errorf("create screenshots dir: %w", err)
	}

	for i := 0; i < bp.poolSize; i++ {
		inst, err := bp.newInstance(ctx, i)
		if err != nil {
			log.Error().Err(err).Int("id", i).Msg("failed to create browser instance")
			continue
		}
		bp.instances <- inst
		log.Debug().Int("id", i).Msg("browser instance created")
	}

	if len(bp.instances) == 0 {
		return fmt.Errorf("no browser instances created")
	}

	go bp.healthCheckLoop(ctx)

	log.Info().Int("count", len(bp.instances)).Msg("browser pool started")
	return nil
}

func (bp *BrowserPool) newInstance(parentCtx context.Context, id int) (*BrowserInstance, error) {
	fp := randomFingerprint(bp.userAgents)

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("disable-infobars", true),
		chromedp.UserAgent(fp.UserAgent),
		chromedp.WindowSize(fp.Viewport.Width, fp.Viewport.Height),
		chromedp.Flag("lang", fp.Language),
		chromedp.Flag("disable-web-security", false),
		chromedp.Flag("allow-running-insecure-content", false),
		chromedp.Flag("timezone", fp.Timezone),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(parentCtx, opts...)
	ctx, _ := chromedp.NewContext(allocCtx)

	inst := &BrowserInstance{
		ctx:         ctx,
		cancel:      func() {},
		allocCancel: allocCancel,
		userAgent:   fp.UserAgent,
		viewport:    fp.Viewport,
		id:          id,
		lastUsed:    time.Now(),
		fingerprint: fp,
		lastCheck:   time.Now(),
	}

	if err := bp.injectFingerprint(ctx, fp); err != nil {
		log.Warn().Err(err).Int("id", id).Msg("failed to inject fingerprint")
	}

	return inst, nil
}

func (bp *BrowserPool) injectFingerprint(ctx context.Context, fp Fingerprint) error {
	js := fmt.Sprintf(`
		(() => {
			Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
			Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5], configurable: true });
			Object.defineProperty(navigator, 'languages', { get: () => ['%s'], configurable: true });
			Object.defineProperty(navigator, 'language', { get: () => '%s', configurable: true });
			Object.defineProperty(navigator, 'platform', { get: () => '%s', configurable: true });
			Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4, configurable: true });
			Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
			Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });

			const originalQuery = window.navigator.permissions.query;
			window.navigator.permissions.query = (parameters) => (
				parameters.name === 'notifications' ?
					Promise.resolve({ state: Notification.permission }) :
					originalQuery(parameters)
			);

			Object.defineProperty(screen, 'width', { get: () => %d, configurable: true });
			Object.defineProperty(screen, 'height', { get: () => %d, configurable: true });
			Object.defineProperty(screen, 'availWidth', { get: () => %d, configurable: true });
			Object.defineProperty(screen, 'availHeight', { get: () => %d, configurable: true });

			Intl.DateTimeFormat.prototype.resolvedOptions = new Proxy(
				Intl.DateTimeFormat.prototype.resolvedOptions,
				{
					apply(target, thisArg, args) {
						const result = Reflect.apply(target, thisArg, args);
						result.timeZone = '%s';
						return result;
					}
				}
			);

			const origGetContext = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function() {
				const ctx = origGetContext.apply(this, arguments);
				if (!ctx) return ctx;
				if (arguments[0] === 'webgl' || arguments[0] === 'experimental-webgl') {
					const origGetParameter = ctx.getParameter;
					ctx.getParameter = function(param) {
						if (param === 37445) return '%s';
						if (param === 37446) return '%s';
						return origGetParameter.apply(this, arguments);
					};
					const origGetExtension = ctx.getExtension;
					ctx.getExtension = function(ext) {
						const res = origGetExtension.apply(this, arguments);
						if (ext === 'WEBGL_debug_renderer_info' && res) {
							const origGetUnmasked = res.UNMASKED_VENDOR_WEBGL;
							const origGetUnmaskedRend = res.UNMASKED_RENDERER_WEBGL;
						}
						return res;
					};
				}
				return ctx;
			};

			window.chrome = {
				runtime: {},
				loadTimes: function() { return {}; },
				csi: function() { return {}; }
			};
		})();
	`,
		fp.Language,
		stringsSplitFirst(fp.Language, ","),
		fp.Platform,
		fp.Viewport.Width, fp.Viewport.Height,
		fp.Viewport.Width, fp.Viewport.Height,
		fp.Timezone,
		fp.WebGLVendor,
		fp.WebGLRenderer,
	)

	var result string
	return chromedp.Run(ctx,
		chromedp.Evaluate(js, &result),
	)
}

func stringsSplitFirst(s, sep string) string {
	for i := 0; i < len(s); i++ {
		if len(sep) <= len(s)-i && s[i:i+len(sep)] == sep {
			return s[:i]
		}
	}
	return s
}

func randomFingerprint(userAgents []string) Fingerprint {
	return Fingerprint{
		UserAgent:     userAgents[rand.Intn(len(userAgents))],
		Viewport:      viewports[rand.Intn(len(viewports))],
		Language:      languages[rand.Intn(len(languages))],
		Timezone:      timezones[rand.Intn(len(timezones))],
		WebGLVendor:   webglVendors[rand.Intn(len(webglVendors))],
		WebGLRenderer: webglRenderers[rand.Intn(len(webglRenderers))],
		Platform:      platforms[rand.Intn(len(platforms))],
	}
}

func (bp *BrowserPool) healthCheckLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			bp.checkAndRestartCrashed(ctx)
		}
	}
}

func (bp *BrowserPool) checkAndRestartCrashed(ctx context.Context) {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	insts := make([]*BrowserInstance, 0)
	for i := 0; i < len(bp.instances); i++ {
		inst := <-bp.instances
		insts = append(insts, inst)
	}
	for _, inst := range insts {
		bp.instances <- inst
	}

	for _, inst := range insts {
		if !inst.IsAlive() {
			log.Warn().Int("id", inst.id).Msg("detected crashed browser instance")
			bp.crashed[inst.id] = true

			newInst, err := bp.newInstance(ctx, inst.id)
			if err != nil {
				log.Error().Err(err).Int("id", inst.id).Msg("failed to restart crashed instance")
				continue
			}
			inst.allocCancel()
			bp.instances <- newInst
			log.Info().Int("id", inst.id).Msg("restarted crashed browser instance")
			delete(bp.crashed, inst.id)
		}
	}
}

func (bi *BrowserInstance) IsAlive() bool {
	if bi.ctx == nil {
		return false
	}

	select {
	case <-bi.ctx.Done():
		return false
	default:
	}

	var result string
	err := chromedp.Run(bi.ctx,
		chromedp.Evaluate("1+1", &result),
	)
	return err == nil
}

func (bp *BrowserPool) Acquire() (*BrowserInstance, error) {
	select {
	case inst := <-bp.instances:
		inst.busy = true
		inst.lastUsed = time.Now()
		return inst, nil
	default:
		return nil, fmt.Errorf("no available browser instances")
	}
}

func (bp *BrowserPool) Release(inst *BrowserInstance) {
	if inst == nil {
		return
	}

	if !inst.IsAlive() {
		log.Warn().Int("id", inst.id).Msg("released instance is crashed, restarting")
		ctx := context.Background()
		newInst, err := bp.newInstance(ctx, inst.id)
		inst.allocCancel()
		if err != nil {
			log.Error().Err(err).Int("id", inst.id).Msg("failed to restart on release")
			return
		}
		inst = newInst
	}

	inst.busy = false
	inst.lastUsed = time.Now()
	select {
	case bp.instances <- inst:
	default:
		log.Warn().Int("id", inst.id).Msg("browser pool full, dropping instance")
	}
}

func (bp *BrowserPool) Close() {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	close(bp.instances)
	for inst := range bp.instances {
		if inst.allocCancel != nil {
			inst.allocCancel()
		}
	}
	log.Info().Msg("browser pool closed")
}

func (bp *BrowserPool) RestartInstance(inst *BrowserInstance) (*BrowserInstance, error) {
	if inst.allocCancel != nil {
		inst.allocCancel()
	}

	newInst, err := bp.newInstance(context.Background(), inst.id)
	if err != nil {
		return nil, fmt.Errorf("restart browser: %w", err)
	}
	return newInst, nil
}

func (bi *BrowserInstance) Context() context.Context {
	return bi.ctx
}

func (bi *BrowserInstance) ID() int {
	return bi.id
}

func (bi *BrowserInstance) UserAgent() string {
	return bi.userAgent
}

func (bi *BrowserInstance) Viewport() Viewport {
	return bi.viewport
}

func (bp *BrowserPool) SaveCookies(site string, ctx context.Context) error {
	var cookies []*network.Cookie
	err := chromedp.Run(ctx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			cookies, err = network.GetCookies().Do(ctx)
			return err
		}),
	)
	if err != nil {
		return fmt.Errorf("get cookies: %w", err)
	}

	data := CookieData{
		Cookies:   cookies,
		SavedAt:   time.Now(),
		ExpiresAt: time.Now().Add(24 * time.Hour * 7),
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal cookies: %w", err)
	}

	cookieFile := filepath.Join(bp.cookiesDir, site+".json")
	if err := os.WriteFile(cookieFile, jsonData, 0644); err != nil {
		return fmt.Errorf("write cookie file: %w", err)
	}

	log.Debug().Str("site", site).Int("cookie_count", len(cookies)).Msg("cookies saved")
	return nil
}

func (bp *BrowserPool) LoadCookies(site string, ctx context.Context) (bool, error) {
	cookieFile := filepath.Join(bp.cookiesDir, site+".json")
	data, err := os.ReadFile(cookieFile)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("read cookie file: %w", err)
	}

	var cd CookieData
	if err := json.Unmarshal(data, &cd); err != nil {
		log.Warn().Err(err).Str("site", site).Msg("cookie file corrupted, clearing")
		bp.ClearCookies(site)
		return false, fmt.Errorf("parse cookie file: %w", err)
	}

	if time.Now().After(cd.ExpiresAt) {
		log.Info().Str("site", site).Msg("cookies expired, need re-login")
		bp.ClearCookies(site)
		return false, nil
	}

	params := make([]*network.CookieParam, 0, len(cd.Cookies))
	for _, c := range cd.Cookies {
		params = append(params, &network.CookieParam{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Secure:   c.Secure,
			HTTPOnly: c.HTTPOnly,
		})
	}

	err = chromedp.Run(ctx,
		network.SetCookies(params),
	)
	if err != nil {
		return false, fmt.Errorf("set cookies: %w", err)
	}

	log.Debug().Str("site", site).Int("cookie_count", len(cd.Cookies)).Msg("cookies loaded")
	return true, nil
}

func (bp *BrowserPool) ClearCookies(site string) error {
	cookieFile := filepath.Join(bp.cookiesDir, site+".json")
	if err := os.Remove(cookieFile); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (bp *BrowserPool) CookieExists(site string) bool {
	cookieFile := filepath.Join(bp.cookiesDir, site+".json")
	_, err := os.Stat(cookieFile)
	return err == nil
}

func HumanScroll(ctx context.Context, direction string, distance int) chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		steps := 20 + rand.Intn(30)
		stepDist := distance / steps
		for i := 0; i < steps; i++ {
			scrollJS := fmt.Sprintf("window.scrollBy(0, %d)", stepDist)
			if direction == "up" {
				scrollJS = fmt.Sprintf("window.scrollBy(0, -%d)", stepDist)
			}
			var result string
			if err := chromedp.Evaluate(scrollJS, &result).Do(ctx); err != nil {
				return err
			}
			sleepTime := time.Duration(20+rand.Intn(80)) * time.Millisecond
			time.Sleep(sleepTime)
		}
		return nil
	})
}

func RandomWait(minMs, maxMs int) time.Duration {
	if maxMs <= minMs {
		return time.Duration(minMs) * time.Millisecond
	}
	return time.Duration(minMs+rand.Intn(maxMs-minMs)) * time.Millisecond
}

func RandomMouseMove(ctx context.Context, targetX, targetY int) chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		var currentX, currentY int
		chromedp.Evaluate("window.scrollX + window.innerWidth/2", &currentX).Do(ctx)
		chromedp.Evaluate("window.scrollY + window.innerHeight/2", &currentY).Do(ctx)

		steps := 10 + rand.Intn(15)
		for i := 1; i <= steps; i++ {
			progress := float64(i) / float64(steps)
			progress = progress + (rand.Float64()-0.5)*0.1
			x := currentX + int(float64(targetX-currentX)*progress)
			y := currentY + int(float64(targetY-currentY)*progress)

			moveJS := fmt.Sprintf(`
				const evt = new MouseEvent('mousemove', {
					clientX: %d,
					clientY: %d,
					bubbles: true
				});
				const el = document.elementFromPoint(%d, %d);
				if (el) el.dispatchEvent(evt);
			`, x, y, x, y)
			var result string
			chromedp.Evaluate(moveJS, &result).Do(ctx)

			time.Sleep(time.Duration(10+rand.Intn(30)) * time.Millisecond)
		}
		return nil
	})
}

func TakeScreenshot(ctx context.Context, screenshotsDir, prefix string) (string, error) {
	var buf []byte
	if err := chromedp.Run(ctx, chromedp.FullScreenshot(&buf, 85)); err != nil {
		return "", fmt.Errorf("take screenshot: %w", err)
	}

	filename := fmt.Sprintf("%s_%s.png", prefix, time.Now().Format("20060102_150405"))
	path := filepath.Join(screenshotsDir, filename)
	if err := os.WriteFile(path, buf, 0644); err != nil {
		return "", fmt.Errorf("write screenshot: %w", err)
	}
	return path, nil
}
