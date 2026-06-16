package scraper

import (
	"context"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/rs/zerolog/log"
)

type AliExpressScraper struct {
	*BaseScraper
	browserPool *BrowserPool
}

func NewAliExpressScraper(config SiteConfig, browserPool *BrowserPool) *AliExpressScraper {
	return &AliExpressScraper{
		BaseScraper: NewBaseScraper("aliexpress", config),
		browserPool: browserPool,
	}
}

func (s *AliExpressScraper) Scrape(ctx context.Context, category string, opts *ScrapeOptions) (*ScrapeResult, error) {
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

	maxScrolls := s.SiteConfig.Pagination.MaxPages
	if opts.MaxPages > 0 && opts.MaxPages < maxScrolls {
		maxScrolls = opts.MaxPages
	}

	scrollPauseMs := s.SiteConfig.Pagination.ScrollPauseMs
	if scrollPauseMs == 0 {
		scrollPauseMs = 2000
	}

	timeout := 20 * time.Second
	if opts.Timeout > 0 {
		timeout = opts.Timeout
	}

	url := s.BuildSearchURL(category, 1)
	log.Debug().Str("site", "aliexpress").Str("url", url).Msg("scraping with infinite scroll")

	pageCtx, cancel := context.WithTimeout(browserCtx, timeout)
	err = chromedp.Run(pageCtx,
		chromedp.Navigate(url),
		chromedp.WaitVisible(s.SiteConfig.Pagination.WaitForSelector, chromedp.ByQuery),
		chromedp.Sleep(RandomWait(2000, 4000)),
	)
	cancel()

	if err != nil {
		result.Error = err
		result.FailCount = 1
		return result, err
	}

	for scroll := 0; scroll < maxScrolls; scroll++ {
		err = s.ScrollToBottom(browserCtx, scrollPauseMs)
		if err != nil {
			log.Warn().Err(err).Int("scroll", scroll).Msg("scroll failed")
		}

		time.Sleep(RandomWait(1000, 2500))
		log.Debug().Str("site", "aliexpress").Int("scroll", scroll).Msg("scroll completed")
	}

	items, err := s.ParseItemElements(browserCtx)
	if err != nil {
		log.Warn().Err(err).Msg("parse items failed")
		result.FailCount++
	} else {
		rawProducts := s.MapToRawProducts(items, category)
		result.Products = rawProducts
		result.SuccessCount = 1
		result.TotalItems = len(rawProducts)
		result.LastPage = maxScrolls
		log.Debug().Str("site", "aliexpress").Int("items", len(rawProducts)).Msg("scrape completed")
	}

	result.Duration = time.Since(startTime)
	return result, nil
}

func (s *AliExpressScraper) CheckLogin(ctx context.Context) (bool, error) {
	return true, nil
}

func (s *AliExpressScraper) Login(ctx context.Context) error {
	return nil
}

func init() {
	RegisterScraper("aliexpress", func(config SiteConfig, pool *BrowserPool) Scraper {
		return NewAliExpressScraper(config, pool)
	})
}
