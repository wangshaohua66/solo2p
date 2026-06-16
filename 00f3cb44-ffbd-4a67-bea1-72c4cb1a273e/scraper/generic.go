package scraper

import (
	"context"
	"fmt"
	"math/rand"
	"os"
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
	SiteConfig SiteConfig
	SiteName   string
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

func NewBaseScraper(siteName string, config SiteConfig) *BaseScraper {
	return &BaseScraper{
		SiteConfig: config,
		SiteName:   siteName,
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
		return fmt.Errorf("navigate and wait: %w", err)
	}
	return nil
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
			return results;
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

	var results []map[string]string
	err := chromedp.Run(ctx,
		chromedp.Evaluate(extractJS, &results),
	)
	if err != nil {
		return nil, fmt.Errorf("extract items: %w", err)
	}

	return results, nil
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
