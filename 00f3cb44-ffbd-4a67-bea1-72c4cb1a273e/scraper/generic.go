package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"crossborder-scraper/pipeline"
	"github.com/chromedp/chromedp"
	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

type SiteConfig struct {
	Name              string            `yaml:"name"`
	Enabled           bool              `yaml:"enabled"`
	BaseURL           string            `yaml:"base_url"`
	SearchURLTemplate string            `yaml:"search_url_template"`
	RequiresLogin     bool              `yaml:"requires_login"`
	LoginURL          string            `yaml:"login_url"`
	Pagination        PaginationConfig  `yaml:"pagination"`
	Selectors         SelectorConfig    `yaml:"selectors"`
	FieldMapping      map[string]string `yaml:"field_mapping"`
	Currency          string            `yaml:"currency"`
	RatingScale       float64           `yaml:"rating_scale"`
}

type PaginationConfig struct {
	Type            string `yaml:"type"`
	MaxPages        int    `yaml:"max_pages"`
	ScrollPauseMs   int    `yaml:"scroll_pause_ms"`
	WaitForSelector string `yaml:"wait_for_selector"`
}

type SelectorConfig struct {
	ItemContainer  string `yaml:"item_container"`
	Title          string `yaml:"title"`
	Price          string `yaml:"price"`
	OriginalPrice  string `yaml:"original_price"`
	Rating         string `yaml:"rating"`
	ReviewCount    string `yaml:"review_count"`
	Seller         string `yaml:"seller"`
	StockStatus    string `yaml:"stock_status"`
	PromoTags      string `yaml:"promo_tags"`
	ProductURL     string `yaml:"product_url"`
	ProductURLAttr string `yaml:"product_url_attr"`
	SKU            string `yaml:"sku"`
	SKUAttr        string `yaml:"sku_attr"`
	Image          string `yaml:"image"`
	ImageAttr      string `yaml:"image_attr"`
}

type GlobalConfig struct {
	BrowserPoolSize    int      `yaml:"browser_pool_size"`
	PageTimeoutSeconds int      `yaml:"page_timeout_seconds"`
	MaxRetries         int      `yaml:"max_retries"`
	RetryBackoffBase   int      `yaml:"retry_backoff_base"`
	MaxRetryBackoff    int      `yaml:"max_retry_backoff"`
	UserAgents         []string `yaml:"user_agents"`
	CookiesDir         string   `yaml:"cookies_dir"`
	ScreenshotsDir     string   `yaml:"screenshots_dir"`
	DBPath             string   `yaml:"db_path"`
	LogDir             string   `yaml:"log_dir"`
	CaptchaWSPort      int      `yaml:"captcha_ws_port"`
	Categories         []string `yaml:"categories"`
}

type Config struct {
	Global GlobalConfig          `yaml:"global"`
	Sites  map[string]SiteConfig `yaml:"sites"`
}

type Scraper interface {
	Name() string
	Scrape(ctx context.Context, category string, opts *ScrapeOptions) (*ScrapeResult, error)
	CheckLogin(ctx context.Context) (bool, error)
	Login(ctx context.Context) error
}

type ScrapeOptions struct {
	MaxPages    int
	StartPage   int
	Timeout     time.Duration
	Incremental bool
}

type ScrapeResult struct {
	SiteName     string
	Category     string
	Products     []*pipeline.RawProductData
	TotalItems   int
	SuccessCount int
	FailCount    int
	SkipCount    int
	Duration     time.Duration
	LastPage     int
	Error        error
}

type BaseScraper struct {
	SiteConfig     SiteConfig
	SiteName       string
	browserPool    *BrowserPool
	staticScraper  *StaticScraper
	screenshotsDir string
	useStaticFirst bool
}

type SelectorError struct {
	URL        string
	Selector   string
	Screenshot string
	Timestamp  time.Time
}

func (e *SelectorError) Error() string {
	return fmt.Sprintf("selector match failed: %s on %s (screenshot: %s)", e.Selector, e.URL, e.Screenshot)
}

func LoadConfig(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	return &cfg, nil
}

func NewBaseScraper(siteName string, config SiteConfig, browserPool *BrowserPool, staticScraper *StaticScraper, screenshotsDir string) *BaseScraper {
	return &BaseScraper{
		SiteConfig:     config,
		SiteName:       siteName,
		browserPool:    browserPool,
		staticScraper:  staticScraper,
		screenshotsDir: screenshotsDir,
		useStaticFirst: true,
	}
}

func (bs *BaseScraper) Name() string {
	return bs.SiteConfig.Name
}

func (bs *BaseScraper) BuildSearchURL(keyword string, page int) string {
	url := bs.SiteConfig.SearchURLTemplate
	url = strings.ReplaceAll(url, "{keyword}", keyword)
	url = strings.ReplaceAll(url, "{page}", fmt.Sprintf("%d", page))
	return url
}

func (bs *BaseScraper) CheckLogin(ctx context.Context) (bool, error) {
	if !bs.SiteConfig.RequiresLogin {
		return true, nil
	}

	if bs.browserPool == nil {
		return false, fmt.Errorf("browser pool not set")
	}

	inst, err := bs.browserPool.Acquire()
	if err != nil {
		return false, fmt.Errorf("acquire browser: %w", err)
	}
	defer bs.browserPool.Release(inst)

	browserCtx := inst.Context()

	loaded, err := bs.browserPool.LoadCookies(bs.SiteName, browserCtx)
	if err != nil {
		log.Warn().Err(err).Str("site", bs.SiteName).Msg("load cookies failed")
		return false, nil
	}
	if !loaded {
		log.Info().Str("site", bs.SiteName).Msg("no valid cookies, need login")
		return false, nil
	}

	var title string
	err = chromedp.Run(browserCtx,
		chromedp.Navigate(bs.SiteConfig.BaseURL),
		chromedp.Sleep(RandomWait(1000, 2000)),
		chromedp.Title(&title),
	)
	if err != nil {
		return false, fmt.Errorf("check login state: %w", err)
	}

	log.Debug().Str("site", bs.SiteName).Str("title", title).Msg("login check")
	return true, nil
}

func (bs *BaseScraper) Login(ctx context.Context) error {
	if !bs.SiteConfig.RequiresLogin {
		return nil
	}

	if bs.browserPool == nil {
		return fmt.Errorf("browser pool not set")
	}

	inst, err := bs.browserPool.Acquire()
	if err != nil {
		return fmt.Errorf("acquire browser: %w", err)
	}
	defer bs.browserPool.Release(inst)

	browserCtx := inst.Context()

	log.Warn().Str("site", bs.SiteName).Str("url", bs.SiteConfig.LoginURL).Msg("MANUAL LOGIN REQUIRED - navigating to login page")

	err = chromedp.Run(browserCtx,
		chromedp.Navigate(bs.SiteConfig.LoginURL),
		chromedp.Sleep(3*time.Second),
	)
	if err != nil {
		return fmt.Errorf("navigate to login: %w", err)
	}

	log.Warn().Str("site", bs.SiteName).Msg("Please complete login manually in browser. Waiting 120 seconds...")

	loginTimeout := 120 * time.Second
	checkInterval := 3 * time.Second
	startTime := time.Now()

	for time.Since(startTime) < loginTimeout {
		var url string
		chromedp.Run(browserCtx,
			chromedp.Location(&url),
		)

		if !strings.Contains(url, "login") && !strings.Contains(url, "signin") {
			log.Info().Str("site", bs.SiteName).Str("url", url).Msg("detected possible login completion, saving cookies")

			if err := bs.browserPool.SaveCookies(bs.SiteName, browserCtx); err != nil {
				log.Error().Err(err).Str("site", bs.SiteName).Msg("save cookies failed")
				return fmt.Errorf("save cookies: %w", err)
			}

			log.Info().Str("site", bs.SiteName).Msg("login completed and cookies saved")
			return nil
		}

		time.Sleep(checkInterval)
	}

	return fmt.Errorf("login timeout after %v", loginTimeout)
}

func (bs *BaseScraper) EnsureLoggedIn(ctx context.Context) error {
	if !bs.SiteConfig.RequiresLogin {
		return nil
	}

	loggedIn, err := bs.CheckLogin(ctx)
	if err != nil {
		log.Warn().Err(err).Str("site", bs.SiteName).Msg("check login failed, clearing cookies")
		bs.browserPool.ClearCookies(bs.SiteName)
	}

	if !loggedIn {
		if err := bs.Login(ctx); err != nil {
			return fmt.Errorf("login failed: %w", err)
		}
	}

	return nil
}

func (bs *BaseScraper) ExtractItems(ctx context.Context, htmlContent string) ([]*pipeline.RawProductData, error) {
	return nil, fmt.Errorf("ExtractItems not implemented")
}

func (bs *BaseScraper) NavigateAndWait(ctx context.Context, url string, waitSel string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	err := chromedp.Run(ctx,
		chromedp.Navigate(url),
		chromedp.WaitVisible(waitSel, chromedp.ByQuery),
		chromedp.Sleep(RandomWait(500, 1500)),
	)

	if err != nil {
		bs.logSelectorError(ctx, url, waitSel)
		return fmt.Errorf("navigate and wait: %w", err)
	}
	return nil
}

func (bs *BaseScraper) logSelectorError(ctx context.Context, url string, selector string) {
	screenshotPath, err := TakeScreenshot(ctx, bs.screenshotsDir, bs.SiteName+"_selector_error")
	if err != nil {
		log.Warn().Err(err).Str("url", url).Str("selector", selector).Msg("failed to take screenshot for selector error")
		screenshotPath = "none"
	}

	selErr := &SelectorError{
		URL:        url,
		Selector:   selector,
		Screenshot: screenshotPath,
		Timestamp:  time.Now(),
	}

	logErrorData, _ := json.Marshal(selErr)
	log.Error().
		Str("site", bs.SiteName).
		Str("url", url).
		Str("selector", selector).
		Str("screenshot", screenshotPath).
		RawJSON("error_details", logErrorData).
		Msg("DOM selector match failed")

	errorLogDir := filepath.Join(bs.screenshotsDir, "errors")
	os.MkdirAll(errorLogDir, 0755)
	errorLogFile := filepath.Join(errorLogDir, fmt.Sprintf("%s_%s.json", bs.SiteName, time.Now().Format("20060102_150405")))
	os.WriteFile(errorLogFile, logErrorData, 0644)
}

func (bs *BaseScraper) ScrollToBottom(ctx context.Context, pauseMs int) error {
	scrollJS := `
		Math.max(
			document.body.scrollHeight,
			document.body.offsetHeight,
			document.documentElement.clientHeight,
			document.documentElement.scrollHeight,
			document.documentElement.offsetHeight
		);
	`

	var totalHeight int
	if err := chromedp.Run(ctx,
		chromedp.Evaluate(scrollJS, &totalHeight),
	); err != nil {
		return fmt.Errorf("get scroll height: %w", err)
	}

	currentScroll := 0
	step := 300 + rand.Intn(200)
	for currentScroll < totalHeight {
		if err := chromedp.Run(ctx,
			chromedp.Evaluate(fmt.Sprintf("window.scrollTo(0, %d)", currentScroll), nil),
			chromedp.Sleep(time.Duration(pauseMs)*time.Millisecond),
		); err != nil {
			log.Warn().Err(err).Msg("scroll step failed")
		}
		currentScroll += step

		var newHeight int
		chromedp.Run(ctx, chromedp.Evaluate(scrollJS, &newHeight))
		if newHeight > totalHeight {
			totalHeight = newHeight
		}
	}

	return nil
}

func (bs *BaseScraper) HasNextPage(ctx context.Context) (bool, error) {
	return false, nil
}

func (bs *BaseScraper) ClickNextPage(ctx context.Context) error {
	return fmt.Errorf("ClickNextPage not implemented")
}

func (bs *BaseScraper) ParseItemElements(ctx context.Context) ([]map[string]string, error) {
	sel := bs.SiteConfig.Selectors
	selectors := map[string]string{
		"title":         sel.Title,
		"price":         sel.Price,
		"originalPrice": sel.OriginalPrice,
		"rating":        sel.Rating,
		"reviewCount":   sel.ReviewCount,
		"seller":        sel.Seller,
		"stockStatus":   sel.StockStatus,
		"promoTags":     sel.PromoTags,
		"productURL":    sel.ProductURL,
		"sku":           sel.SKU,
		"image":         sel.Image,
	}

	itemSel := sel.ItemContainer

	extractJS := fmt.Sprintf(`
		(() => {
			const items = document.querySelectorAll(%q);
			const results = [];
			if (items.length === 0) {
				return { empty: true, items: [] };
			}
			items.forEach((item) => {
				const data = {};
				const getText = (selector) => {
					const el = item.querySelector(selector);
					return el ? el.textContent.trim() : '';
				};
				const getAttr = (selector, attr) => {
					const el = item.querySelector(selector);
					return el ? el.getAttribute(attr) : '';
				};
				results.push({
					title: getText(%q),
					price: getText(%q),
					originalPrice: getText(%q),
					rating: getText(%q),
					reviewCount: getText(%q),
					seller: getText(%q),
					stockStatus: getText(%q),
					promoTags: getText(%q),
					productURL: getAttr(%q, %q),
					sku: getAttr(%q, %q),
					image: getAttr(%q, %q),
				});
			});
			return { empty: false, items: results };
		})();
	`,
		itemSel,
		selectors["title"],
		selectors["price"],
		selectors["originalPrice"],
		selectors["rating"],
		selectors["reviewCount"],
		selectors["seller"],
		selectors["stockStatus"],
		selectors["promoTags"],
		selectors["productURL"],
		sel.ProductURLAttr,
		selectors["sku"],
		sel.SKUAttr,
		selectors["image"],
		sel.ImageAttr,
	)

	var extractResult struct {
		Empty bool              `json:"empty"`
		Items []map[string]string `json:"items"`
	}
	err := chromedp.Run(ctx,
		chromedp.Evaluate(extractJS, &extractResult),
	)
	if err != nil {
		var currentURL string
		chromedp.Run(ctx, chromedp.Location(&currentURL))
		bs.logSelectorError(ctx, currentURL, itemSel)
		return nil, fmt.Errorf("extract items: %w", err)
	}

	if extractResult.Empty {
		var currentURL string
		chromedp.Run(ctx, chromedp.Location(&currentURL))
		log.Warn().Str("site", bs.SiteName).Str("url", currentURL).Str("selector", itemSel).Msg("no items found with selector")
	}

	return extractResult.Items, nil
}

func (bs *BaseScraper) MapToRawProducts(items []map[string]string, category string) []*pipeline.RawProductData {
	var products []*pipeline.RawProductData

	for _, item := range items {
		sku := item["sku"]
		if sku == "" {
			continue
		}

		promoTags := []string{}
		if pt := item["promoTags"]; pt != "" {
			promoTags = append(promoTags, pt)
		}

		productURL := item["productURL"]
		if !strings.HasPrefix(productURL, "http") && productURL != "" {
			productURL = bs.SiteConfig.BaseURL + productURL
		}

		imageURL := item["image"]
		if !strings.HasPrefix(imageURL, "http") && imageURL != "" {
			imageURL = bs.SiteConfig.BaseURL + imageURL
		}

		raw := &pipeline.RawProductData{
			Site:          bs.SiteName,
			Title:         item["title"],
			Price:         item["price"],
			OriginalPrice: item["originalPrice"],
			Rating:        item["rating"],
			ReviewCount:   item["reviewCount"],
			Seller:        item["seller"],
			StockStatus:   item["stockStatus"],
			PromoTags:     promoTags,
			ProductURL:    productURL,
			SKU:           sku,
			ImageURL:      imageURL,
			Category:      category,
			Currency:      bs.SiteConfig.Currency,
			RatingScale:   bs.SiteConfig.RatingScale,
		}

		products = append(products, raw)
	}

	return products
}

func (bs *BaseScraper) CanUseStaticScraper(url string) bool {
	if bs.staticScraper == nil || !bs.useStaticFirst {
		return false
	}
	return bs.staticScraper.IsStaticContent(url)
}

func (bs *BaseScraper) ScrapeSearchPageStatic(url string, category string) ([]*pipeline.RawProductData, error) {
	if bs.staticScraper == nil {
		return nil, fmt.Errorf("static scraper not available")
	}

	products, err := bs.staticScraper.ScrapeSearchPage(
		url,
		bs.SiteConfig.Selectors,
		bs.SiteName,
		category,
		bs.SiteConfig.Currency,
		bs.SiteConfig.RatingScale,
	)
	if err != nil {
		return nil, fmt.Errorf("static scrape: %w", err)
	}

	return products, nil
}

func (bs *BaseScraper) ScrapeWithFallback(ctx context.Context, url string, category string, waitSel string, timeout time.Duration) ([]*pipeline.RawProductData, error) {
	var staticProducts []*pipeline.RawProductData
	var staticErr error
	usedStatic := false

	if bs.useStaticFirst && bs.staticScraper != nil {
		log.Debug().Str("site", bs.SiteName).Str("url", url).Msg("trying static scraper first")
		staticProducts, staticErr = bs.ScrapeSearchPageStatic(url, category)
		if staticErr == nil && len(staticProducts) > 0 {
			log.Info().Str("site", bs.SiteName).Int("items", len(staticProducts)).Msg("static scraper succeeded, using results")
			usedStatic = true
			if len(staticProducts) >= 8 {
				return staticProducts, nil
			}
			log.Debug().Str("site", bs.SiteName).Int("items", len(staticProducts)).
				Msg("static results too few, falling back to Chromedp for more data")
		} else {
			if staticErr != nil {
				log.Warn().Err(staticErr).Str("site", bs.SiteName).Msg("static scraper failed, falling back to Chromedp")
			} else {
				log.Debug().Str("site", bs.SiteName).Msg("static scraper returned empty, falling back to Chromedp")
			}
		}
	}

	log.Debug().Str("site", bs.SiteName).Msg("using Chromedp for dynamic scraping")
	if err := bs.NavigateAndWait(ctx, url, waitSel, timeout); err != nil {
		if usedStatic && len(staticProducts) > 0 {
			log.Warn().Err(err).Str("site", bs.SiteName).Msg("Chromedp failed but static results available, using static data")
			return staticProducts, nil
		}
		return nil, err
	}

	items, err := bs.ParseItemElements(ctx)
	if err != nil {
		if usedStatic && len(staticProducts) > 0 {
			return staticProducts, nil
		}
		return nil, err
	}

	dynamicProducts := bs.MapToRawProducts(items, category)

	if usedStatic && len(staticProducts) > 0 {
		seen := make(map[string]bool)
		var merged []*pipeline.RawProductData
		for _, p := range dynamicProducts {
			key := bs.SiteName + ":" + p.SKU
			if !seen[key] {
				seen[key] = true
				merged = append(merged, p)
			}
		}
		for _, p := range staticProducts {
			key := bs.SiteName + ":" + p.SKU
			if !seen[key] {
				seen[key] = true
				merged = append(merged, p)
			}
		}
		log.Debug().Str("site", bs.SiteName).
			Int("static", len(staticProducts)).
			Int("dynamic", len(dynamicProducts)).
			Int("merged", len(merged)).
			Msg("merged static and dynamic results")
		return merged, nil
	}

	return dynamicProducts, nil
}
