package scraper

import (
	"context"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/rs/zerolog/log"
)

type WalmartScraper struct {
	*BaseScraper
	browserPool *BrowserPool
}

func NewWalmartScraper(config SiteConfig, browserPool *BrowserPool) *WalmartScraper {
	return &WalmartScraper{
		BaseScraper: NewBaseScraper("walmart", config),
		browserPool: browserPool,
	}
}

func (s *WalmartScraper) Scrape(ctx context.Context, category string, opts *ScrapeOptions) (*ScrapeResult, error) {
	result := &ScrapeResult{
		SiteName: s.SiteConfig.Name,
		Category: category,
	}
	startTime := time.Now()

	inst, err := s.browserPool.Acquire()
	if err != nil {
		result.Error = err
		return result, err
	}
	defer s.browserPool.Release(inst)

	browserCtx := inst.Context()

	maxPages := s.SiteConfig.Pagination.MaxPages
	if opts.MaxPages > 0 && opts.MaxPages < maxPages {
		maxPages = opts.MaxPages
	}

	startPage := 1
	if opts.StartPage > 0 {
		startPage = opts.StartPage
	}

	timeout := 15 * time.Second
	if opts.Timeout > 0 {
		timeout = opts.Timeout
	}

	for page := startPage; page <= maxPages; page++ {
		url := s.BuildSearchURL(category, page)
		log.Debug().Str("site", "walmart").Int("page", page).Str("url", url).Msg("scraping page")

		pageCtx, cancel := context.WithTimeout(browserCtx, timeout)
		err := chromedp.Run(pageCtx,
			chromedp.Navigate(url),
			chromedp.WaitVisible(s.SiteConfig.Pagination.WaitForSelector, chromedp.ByQuery),
			chromedp.Sleep(RandomWait(1000, 2500)),
		)
		cancel()

		if err != nil {
			log.Warn().Err(err).Int("page", page).Msg("page load failed")
			result.FailCount++
			continue
		}

		items, err := s.ParseItemElements(browserCtx)
		if err != nil {
			log.Warn().Err(err).Int("page", page).Msg("parse items failed")
			result.FailCount++
			continue
		}

		rawProducts := s.MapToRawProducts(items, category)
		result.Products = append(result.Products, rawProducts...)
		result.SuccessCount++
		result.LastPage = page

		log.Debug().Str("site", "walmart").Int("page", page).Int("items", len(rawProducts)).Msg("page scraped")

		time.Sleep(RandomWait(2000, 5000))
	}

	result.TotalItems = len(result.Products)
	result.Duration = time.Since(startTime)

	return result, nil
}

func (s *WalmartScraper) CheckLogin(ctx context.Context) (bool, error) {
	return true, nil
}

func (s *WalmartScraper) Login(ctx context.Context) error {
	return nil
}

func init() {
	RegisterScraper("walmart", func(config SiteConfig, pool *BrowserPool) Scraper {
		return NewWalmartScraper(config, pool)
	})
}
