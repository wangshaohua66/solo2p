package scraper

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/rs/zerolog/log"
)

type BrowserPool struct {
	poolSize int
	instances chan *BrowserInstance
	mu       sync.Mutex
	userAgents []string
	cookiesDir string
}

type BrowserInstance struct {
	ctx        context.Context
	cancel     context.CancelFunc
	userAgent  string
	viewport   Viewport
	lastUsed   time.Time
	id         int
	busy       bool
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

func NewBrowserPool(poolSize int, userAgents []string, cookiesDir string) *BrowserPool {
	if poolSize <= 0 {
		poolSize = 3
	}
	if len(userAgents) == 0 {
		userAgents = []string{
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		}
	}
	return &BrowserPool{
		poolSize:   poolSize,
		instances:  make(chan *BrowserInstance, poolSize),
		userAgents: userAgents,
		cookiesDir: cookiesDir,
	}
}

func (bp *BrowserPool) Start(ctx context.Context) error {
	if err := os.MkdirAll(bp.cookiesDir, 0755); err != nil {
		return fmt.Errorf("create cookies dir: %w", err)
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

	log.Info().Int("count", len(bp.instances)).Msg("browser pool started")
	return nil
}

func (bp *BrowserPool) newInstance(parentCtx context.Context, id int) (*BrowserInstance, error) {
	ua := bp.userAgents[rand.Intn(len(bp.userAgents))]
	vp := viewports[rand.Intn(len(viewports))]

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("disable-infobars", true),
		chromedp.UserAgent(ua),
		chromedp.WindowSize(vp.Width, vp.Height),
		chromedp.Flag("lang", "en-US"),
		chromedp.Flag("disable-web-security", false),
		chromedp.Flag("allow-running-insecure-content", false),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(parentCtx, opts...)
	ctx, _ := chromedp.NewContext(allocCtx)

	inst := &BrowserInstance{
		ctx:       ctx,
		cancel:    cancel,
		userAgent: ua,
		viewport:  vp,
		id:        id,
		lastUsed:  time.Now(),
	}

	if err := bp.injectFingerprint(ctx); err != nil {
		log.Warn().Err(err).Msg("failed to inject fingerprint")
	}

	return inst, nil
}

func (bp *BrowserPool) injectFingerprint(ctx context.Context) error {
	fp := randomFingerprint(bp.userAgents)

	js := fmt.Sprintf(`
		(() => {
			Object.defineProperty(navigator, 'webdriver', { get: () => false });
			Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
			Object.defineProperty(navigator, 'languages', { get: () => ['%s'] });
			Object.defineProperty(navigator, 'platform', { get: () => '%s' });
			Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
			Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
			const originalQuery = window.navigator.permissions.query;
			window.navigator.permissions.query = (parameters) => (
				parameters.name === 'notifications' ?
					Promise.resolve({ state: Notification.permission }) :
					originalQuery(parameters)
			);
		})();
	`, fp.Language, fp.Platform)

	var result string
	return chromedp.Run(ctx,
		chromedp.Evaluate(js, &result),
	)
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
		if inst.cancel != nil {
			inst.cancel()
		}
	}
	log.Info().Msg("browser pool closed")
}

func (bp *BrowserPool) RestartInstance(inst *BrowserInstance) (*BrowserInstance, error) {
	if inst.cancel != nil {
		inst.cancel()
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

func (bp *BrowserPool) SaveCookies(site string, cookies []byte) error {
	cookieFile := filepath.Join(bp.cookiesDir, site+".json")
	return os.WriteFile(cookieFile, cookies, 0644)
}

func (bp *BrowserPool) LoadCookies(site string) error {
	cookieFile := filepath.Join(bp.cookiesDir, site+".json")
	if _, err := os.Stat(cookieFile); os.IsNotExist(err) {
		return fmt.Errorf("cookie file not found: %s", cookieFile)
	}
	return nil
}

func (bp *BrowserPool) ClearCookies(site string) error {
	cookieFile := filepath.Join(bp.cookiesDir, site+".json")
	if err := os.Remove(cookieFile); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
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
				document.elementFromPoint(%d, %d).dispatchEvent(evt);
			`, x, y, x, y)
			var result string
			chromedp.Evaluate(moveJS, &result).Do(ctx)

			time.Sleep(time.Duration(10+rand.Intn(30)) * time.Millisecond)
		}
		return nil
	})
}
