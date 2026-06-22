package crawler

import (
	"context"
	"fmt"
	"math/rand"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/cdproto/browser"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"go.uber.org/zap"

	"drug-bid-crawler/config"
	"drug-bid-crawler/storage"
)

type Browser struct {
	ctx       context.Context
	cancel    context.CancelFunc
	allocator context.Context
	allocCancel context.CancelFunc
	mu        sync.Mutex
	tabCount  int
	maxTabs   int
}

type PageElement struct {
	Selector string
	Text     string
	HTML     string
	Attrs    map[string]string
}

func NewBrowser() (*Browser, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", config.GlobalConfig.Headless),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-extensions", true),
		chromedp.Flag("disable-popup-blocking", false),
		chromedp.Flag("download.prompt_for_download", false),
		chromedp.Flag("download.default_directory", config.GlobalConfig.DownloadDir),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
		chromedp.WindowSize(1920, 1080),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)
	ctx, cancel := chromedp.NewContext(allocCtx)

	b := &Browser{
		ctx:         ctx,
		cancel:      cancel,
		allocator:   allocCtx,
		allocCancel: allocCancel,
		maxTabs:     config.GlobalConfig.MaxTabs,
	}

	if err := b.setDownloadBehavior(); err != nil {
		config.Logger.Warn("set download behavior failed", zap.Error(err))
	}

	return b, nil
}

func (b *Browser) setDownloadBehavior() error {
	return chromedp.Run(b.ctx,
		network.Enable(),
		browser.SetDownloadBehavior(browser.SetDownloadBehaviorBehaviorAllow).
			WithDownloadPath(config.GlobalConfig.DownloadDir),
	)
}

func (b *Browser) NewTab() (context.Context, context.CancelFunc, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.tabCount >= b.maxTabs {
		return nil, nil, fmt.Errorf("max tabs reached: %d", b.maxTabs)
	}

	tabCtx, tabCancel := chromedp.NewContext(b.ctx)
	b.tabCount++

	return tabCtx, func() {
		tabCancel()
		b.mu.Lock()
		b.tabCount--
		b.mu.Unlock()
	}, nil
}

func (b *Browser) Navigate(ctx context.Context, urlStr string, timeout time.Duration) error {
	navCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return chromedp.Run(navCtx,
		network.Enable(),
		network.SetExtraHTTPHeaders(network.Headers{
			"Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
		}),
		chromedp.Navigate(urlStr),
		chromedp.WaitReady("body", chromedp.ByQuery),
	)
}

func (b *Browser) Login(ctx context.Context) error {
	cfg := config.GlobalConfig

	if err := b.Navigate(ctx, cfg.LoginURL, 30*time.Second); err != nil {
		return fmt.Errorf("navigate to login page: %w", err)
	}

	b.RandomSleep(1, 2)

	err := chromedp.Run(ctx,
		chromedp.WaitVisible(`input[name="username"]`, chromedp.ByQuery),
		chromedp.SendKeys(`input[name="username"]`, cfg.Username, chromedp.ByQuery),
		chromedp.SendKeys(`input[name="password"]`, cfg.Password, chromedp.ByQuery),
	)
	if err != nil {
		return fmt.Errorf("fill login form: %w", err)
	}

	if cfg.CaptchaMode == "manual" {
		config.Logger.Info("请手动完成验证码验证，按回车继续...")
		fmt.Scanln()
	}

	b.RandomSleep(1, 2)

	err = chromedp.Run(ctx,
		chromedp.Click(`button[type="submit"]`, chromedp.ByQuery),
		chromedp.WaitNotPresent(`input[name="username"]`, chromedp.ByQuery),
	)
	if err != nil {
		return fmt.Errorf("submit login form: %w", err)
	}

	if err := b.saveSession(ctx); err != nil {
		config.Logger.Warn("save session failed", zap.Error(err))
	}

	config.Logger.Info("登录成功")
	return nil
}

func (b *Browser) CheckLoginStatus(ctx context.Context) (bool, error) {
	session, err := storage.GetValidSession()
	if err != nil {
		return false, nil
	}

	if time.Since(session.LastActive) > config.GlobalConfig.SessionTTL {
		return false, nil
	}

	if err := b.loadSession(ctx, session); err != nil {
		return false, nil
	}

	err = chromedp.Run(ctx,
		chromedp.Navigate(config.GlobalConfig.BaseURL),
		chromedp.WaitReady("body"),
	)
	if err != nil {
		return false, nil
	}

	var title string
	chromedp.Run(ctx, chromedp.Title(&title))
	if strings.Contains(title, "登录") || strings.Contains(title, "login") {
		return false, nil
	}

	b.KeepAlive(ctx)
	return true, nil
}

func (b *Browser) EnsureLogin(ctx context.Context) error {
	loggedIn, _ := b.CheckLoginStatus(ctx)
	if loggedIn {
		return nil
	}

	storage.InvalidateAllSessions()
	return b.Login(ctx)
}

func (b *Browser) KeepAlive(ctx context.Context) {
	session, err := storage.GetValidSession()
	if err != nil {
		return
	}
	session.LastActive = time.Now()
	storage.SaveSession(session)
}

func (b *Browser) saveSession(ctx context.Context) error {
	var cookies []*network.Cookie
	err := chromedp.Run(ctx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			cookies, err = network.GetCookies().Do(ctx)
			return err
		}),
	)
	if err != nil {
		return err
	}

	cookieStr := ""
	for _, c := range cookies {
		cookieStr += fmt.Sprintf("%s=%s; ", c.Name, c.Value)
	}

	session := &storage.Session{
		SessionID:  fmt.Sprintf("sess_%d", time.Now().Unix()),
		Cookies:    cookieStr,
		UserAgent:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		ExpiresAt:  time.Now().Add(config.GlobalConfig.SessionTTL),
		LastActive: time.Now(),
		IsValid:    true,
	}

	return storage.SaveSession(session)
}

func (b *Browser) loadSession(ctx context.Context, session *storage.Session) error {
	cookies := parseCookies(session.Cookies)
	for _, c := range cookies {
		chromedp.Run(ctx,
			network.SetCookie(c.Name, c.Value).
				WithDomain(c.Domain).
				WithPath(c.Path),
		)
	}
	return nil
}

type Cookie struct {
	Name   string
	Value  string
	Domain string
	Path   string
}

func parseCookies(cookieStr string) []Cookie {
	var cookies []Cookie
	parts := strings.Split(cookieStr, "; ")
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) == 2 {
			u, _ := url.Parse(config.GlobalConfig.BaseURL)
			cookies = append(cookies, Cookie{
				Name:   kv[0],
				Value:  kv[1],
				Domain: u.Hostname(),
				Path:   "/",
			})
		}
	}
	return cookies
}

func (b *Browser) WaitForElement(ctx context.Context, selector string, timeout time.Duration) error {
	waitCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return chromedp.Run(waitCtx, chromedp.WaitVisible(selector, chromedp.ByQuery))
}

func (b *Browser) Click(ctx context.Context, selector string) error {
	return chromedp.Run(ctx,
		chromedp.WaitVisible(selector, chromedp.ByQuery),
		chromedp.Click(selector, chromedp.ByQuery),
	)
}

func (b *Browser) GetText(ctx context.Context, selector string) (string, error) {
	var text string
	err := chromedp.Run(ctx,
		chromedp.WaitVisible(selector, chromedp.ByQuery),
		chromedp.Text(selector, &text, chromedp.ByQuery),
	)
	return strings.TrimSpace(text), err
}

func (b *Browser) GetAttribute(ctx context.Context, selector, attr string) (string, error) {
	var value string
	err := chromedp.Run(ctx,
		chromedp.WaitVisible(selector, chromedp.ByQuery),
		chromedp.AttributeValue(selector, attr, &value, nil, chromedp.ByQuery),
	)
	return value, err
}

func (b *Browser) GetElements(ctx context.Context, selector string) ([]PageElement, error) {
	var texts []string
	var htmls []string
	var hrefs []string

	err := chromedp.Run(ctx,
		chromedp.Evaluate(`Array.from(document.querySelectorAll('`+selector+`')).map(el => el.textContent.trim())`, &texts),
		chromedp.Evaluate(`Array.from(document.querySelectorAll('`+selector+`')).map(el => el.innerHTML)`, &htmls),
		chromedp.Evaluate(`Array.from(document.querySelectorAll('`+selector+`')).map(el => el.getAttribute('href') || '')`, &hrefs),
	)
	if err != nil {
		return nil, err
	}

	var elements []PageElement
	for i := range texts {
		elem := PageElement{
			Selector: selector,
			Text:     texts[i],
			HTML:     "",
			Attrs:    make(map[string]string),
		}
		if i < len(htmls) {
			elem.HTML = htmls[i]
		}
		if i < len(hrefs) && hrefs[i] != "" {
			elem.Attrs["href"] = hrefs[i]
		}
		elements = append(elements, elem)
	}
	return elements, nil
}

func (b *Browser) GetHTML(ctx context.Context, selector string) (string, error) {
	var html string
	err := chromedp.Run(ctx,
		chromedp.WaitVisible(selector, chromedp.ByQuery),
		chromedp.InnerHTML(selector, &html, chromedp.ByQuery),
	)
	return html, err
}

func (b *Browser) GetLinks(ctx context.Context, selector string) ([]string, error) {
	var hrefs []string
	err := chromedp.Run(ctx,
		chromedp.Evaluate(`Array.from(document.querySelectorAll('`+selector+`')).map(a => a.href)`, &hrefs),
	)
	return hrefs, err
}

func (b *Browser) HandleAlert(ctx context.Context, accept bool) error {
	return chromedp.Run(ctx,
		page.HandleJavaScriptDialog(accept),
	)
}

func (b *Browser) LoadMore(ctx context.Context, buttonSelector string) (bool, error) {
	var hasMore bool
	err := chromedp.Run(ctx,
		chromedp.Evaluate(`document.querySelector('`+buttonSelector+`') !== null`, &hasMore),
	)
	if err != nil || !hasMore {
		return false, err
	}

	err = chromedp.Run(ctx,
		chromedp.Click(buttonSelector, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
	)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (b *Browser) RandomSleep(min, max int) {
	if min <= 0 {
		min = config.GlobalConfig.MinInterval
	}
	if max <= 0 {
		max = config.GlobalConfig.MaxInterval
	}
	sleepTime := min + rand.Intn(max-min+1)
	time.Sleep(time.Duration(sleepTime) * time.Second)
}

func (b *Browser) ScrollToBottom(ctx context.Context) error {
	return chromedp.Run(ctx,
		chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`, nil),
		chromedp.Sleep(500*time.Millisecond),
	)
}

func (b *Browser) Screenshot(ctx context.Context, path string) error {
	var buf []byte
	err := chromedp.Run(ctx, chromedp.CaptureScreenshot(&buf))
	if err != nil {
		return err
	}
	return nil
}

func (b *Browser) Close() {
	b.cancel()
	b.allocCancel()
}

func (b *Browser) StartSessionKeepAlive(ctx context.Context) {
	ticker := time.NewTicker(config.GlobalConfig.KeepAliveInterval)
	go func() {
		defer ticker.Stop()
		for range ticker.C {
			select {
			case <-ctx.Done():
				return
			default:
				b.KeepAlive(ctx)
				config.Logger.Debug("Session keep alive executed")
			}
		}
	}()
}
