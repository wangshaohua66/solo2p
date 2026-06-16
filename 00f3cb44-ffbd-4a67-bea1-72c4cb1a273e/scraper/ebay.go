package scraper

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

type EbayScraper struct {
	*BaseScraper
	browserPool *BrowserPool
}

func NewEbayScraper(config SiteConfig, browserPool *BrowserPool, staticScraper *StaticScraper, screenshotsDir string) *EbayScraper {
	return &EbayScraper{
		BaseScraper: NewBaseScraper("ebay", config, browserPool, staticScraper, screenshotsDir),
		browserPool: browserPool,
	}
}

func (s *EbayScraper) Scrape(ctx context.Context, category string, opts *ScrapeOptions) (*ScrapeResult, error) {
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

	waitSel := s.SiteConfig.Pagination.WaitForSelector

	for page := startPage; page <= maxPages; page++ {
		url := s.BuildSearchURL(category, page)
		log.Debug().Str("site", "ebay").Int("page", page).Str("url", url).Msg("scraping page")

		products, err := s.ScrapeWithFallback(browserCtx, url, category, waitSel, timeout)
		if err != nil {
			log.Warn().Err(err).Int("page", page).Msg("page scrape failed")
			result.FailCount++
			continue
		}

		if len(products) == 0 {
			log.Warn().Int("page", page).Msg("no products found on page")
			result.FailCount++
			continue
		}

		result.Products = append(result.Products, products...)
		result.SuccessCount++
		result.LastPage = page

		log.Debug().Str("site", "ebay").Int("page", page).Int("items", len(products)).Msg("page scraped")

		time.Sleep(RandomWait(1500, 4000))
	}

	result.TotalItems = len(result.Products)
	result.Duration = time.Since(startTime)

	return result, nil
}

func (s *EbayScraper) CheckLogin(ctx context.Context) (bool, error) {
	return s.BaseScraper.CheckLogin(ctx)
}

func (s *EbayScraper) Login(ctx context.Context) error {
	return s.BaseScraper.Login(ctx)
}

func init() {
	RegisterScraper("ebay", func(config SiteConfig, pool *BrowserPool, staticScraper *StaticScraper, screenshotsDir string) Scraper {
		return NewEbayScraper(config, pool, staticScraper, screenshotsDir)
	})
}
