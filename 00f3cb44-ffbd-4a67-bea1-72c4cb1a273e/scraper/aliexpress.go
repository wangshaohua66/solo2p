package scraper

import (
	"context"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/rs/zerolog/log"

	"crossborder-scraper/pipeline"
)

type AliExpressScraper struct {
	*BaseScraper
	browserPool *BrowserPool
}

func NewAliExpressScraper(config SiteConfig, browserPool *BrowserPool, staticScraper *StaticScraper, screenshotsDir string) *AliExpressScraper {
	return &AliExpressScraper{
		BaseScraper: NewBaseScraper("aliexpress", config, browserPool, staticScraper, screenshotsDir),
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

	waitSel := s.SiteConfig.Pagination.WaitForSelector
	url := s.BuildSearchURL(category, 1)
	log.Debug().Str("site", "aliexpress").Str("url", url).Msg("scraping with infinite scroll")

	var staticProducts []*pipeline.RawProductData
	if s.useStaticFirst && s.staticScraper != nil && s.staticScraper.IsStaticContent(url) {
		staticProducts, err = s.ScrapeSearchPageStatic(url, category)
		if err == nil && len(staticProducts) > 0 {
			log.Debug().Str("site", "aliexpress").Int("static_items", len(staticProducts)).Msg("static scraper returned results")
		}
	}

	pageCtx, cancel := context.WithTimeout(browserCtx, timeout)
	err = chromedp.Run(pageCtx,
		chromedp.Navigate(url),
		chromedp.WaitVisible(waitSel, chromedp.ByQuery),
		chromedp.Sleep(RandomWait(2000, 4000)),
	)
	cancel()

	if err != nil {
		if len(staticProducts) > 0 {
			result.Products = staticProducts
			result.SuccessCount = 1
			result.TotalItems = len(staticProducts)
			result.Duration = time.Since(startTime)
			log.Warn().Err(err).Msg("chromedp failed, using static results only")
			return result, nil
		}
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
		if len(staticProducts) > 0 {
			result.Products = staticProducts
			result.SuccessCount = 1
			result.TotalItems = len(staticProducts)
		} else {
			result.FailCount++
		}
	} else {
		dynamicProducts := s.MapToRawProducts(items, category)
		seen := make(map[string]bool)
		var merged []*pipeline.RawProductData
		for _, p := range staticProducts {
			key := p.Site + "_" + p.SKU
			if !seen[key] {
				seen[key] = true
				merged = append(merged, p)
			}
		}
		for _, p := range dynamicProducts {
			key := p.Site + "_" + p.SKU
			if !seen[key] {
				seen[key] = true
				merged = append(merged, p)
			}
		}
		result.Products = merged
		result.SuccessCount = 1
		result.TotalItems = len(merged)
		result.LastPage = maxScrolls
		log.Debug().Str("site", "aliexpress").Int("items", len(merged)).Msg("scrape completed")
	}

	result.Duration = time.Since(startTime)
	return result, nil
}

func (s *AliExpressScraper) CheckLogin(ctx context.Context) (bool, error) {
	return s.BaseScraper.CheckLogin(ctx)
}

func (s *AliExpressScraper) Login(ctx context.Context) error {
	return s.BaseScraper.Login(ctx)
}

func init() {
	RegisterScraper("aliexpress", func(config SiteConfig, pool *BrowserPool, staticScraper *StaticScraper, screenshotsDir string) Scraper {
		return NewAliExpressScraper(config, pool, staticScraper, screenshotsDir)
	})
}
