package scraper

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gocolly/colly/v2"
	"github.com/rs/zerolog/log"
	"crossborder-scraper/pipeline"
)

type StaticScraper struct {
	collector *colly.Collector
	userAgent string
	mu        sync.Mutex
}

func NewStaticScraper(userAgent string) *StaticScraper {
	c := colly.NewCollector(
		colly.UserAgent(userAgent),
		colly.Async(true),
		colly.AllowURLRevisit(),
		colly.MaxDepth(2),
	)

	c.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Parallelism: 2,
		RandomDelay: 1 * time.Second,
		Delay:       500 * time.Millisecond,
	})

	ss := &StaticScraper{
		collector: c,
		userAgent: userAgent,
	}

	c.OnError(func(r *colly.Response, err error) {
		log.Warn().Err(err).Str("url", r.Request.URL.String()).Msg("static scrape error")
	})

	return ss
}

func (ss *StaticScraper) IsStaticContent(url string) bool {
	staticPatterns := []string{
		"/product/", "/item/", "/p/", "/dp/",
		".html", ".htm",
	}
	for _, p := range staticPatterns {
		if strings.Contains(url, p) {
			return true
		}
	}
	return false
}

func (ss *StaticScraper) ScrapeProductPage(url string, selectors SelectorConfig, siteName, category string, currency string, ratingScale float64) (*pipeline.RawProductData, error) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	var raw *pipeline.RawProductData
	var scrapeErr error

	ss.collector.OnHTML("html", func(e *colly.HTMLElement) {
		raw = &pipeline.RawProductData{
			Site:        siteName,
			Category:    category,
			Currency:    currency,
			RatingScale: ratingScale,
		}

		if selectors.Title != "" {
			raw.Title = strings.TrimSpace(e.ChildText(selectors.Title))
		}
		if selectors.Price != "" {
			raw.Price = strings.TrimSpace(e.ChildText(selectors.Price))
		}
		if selectors.OriginalPrice != "" {
			raw.OriginalPrice = strings.TrimSpace(e.ChildText(selectors.OriginalPrice))
		}
		if selectors.Rating != "" {
			raw.Rating = strings.TrimSpace(e.ChildText(selectors.Rating))
		}
		if selectors.ReviewCount != "" {
			raw.ReviewCount = strings.TrimSpace(e.ChildText(selectors.ReviewCount))
		}
		if selectors.Seller != "" {
			raw.Seller = strings.TrimSpace(e.ChildText(selectors.Seller))
		}
		if selectors.StockStatus != "" {
			raw.StockStatus = strings.TrimSpace(e.ChildText(selectors.StockStatus))
		}
		if selectors.ProductURL != "" && selectors.ProductURLAttr != "" {
			raw.ProductURL = e.ChildAttr(selectors.ProductURL, selectors.ProductURLAttr)
		}
		if selectors.SKU != "" && selectors.SKUAttr != "" {
			raw.SKU = e.ChildAttr(selectors.SKU, selectors.SKUAttr)
		}
		if selectors.Image != "" && selectors.ImageAttr != "" {
			raw.ImageURL = e.ChildAttr(selectors.Image, selectors.ImageAttr)
		}
		if raw.ProductURL == "" {
			raw.ProductURL = url
		}
	})

	err := ss.collector.Visit(url)
	ss.collector.Wait()

	if err != nil {
		scrapeErr = fmt.Errorf("visit failed: %w", err)
	}
	if raw == nil {
		scrapeErr = fmt.Errorf("no data extracted")
	}
	if raw != nil && raw.SKU == "" {
		scrapeErr = fmt.Errorf("no sku extracted")
	}

	return raw, scrapeErr
}

func (ss *StaticScraper) ScrapeSearchPage(url string, selectors SelectorConfig, siteName, category string, currency string, ratingScale float64) ([]*pipeline.RawProductData, error) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	var products []*pipeline.RawProductData
	var scrapeErr error

	ss.collector.OnHTML(selectors.ItemContainer, func(e *colly.HTMLElement) {
		raw := &pipeline.RawProductData{
			Site:        siteName,
			Category:    category,
			Currency:    currency,
			RatingScale: ratingScale,
		}

		if selectors.Title != "" {
			raw.Title = strings.TrimSpace(e.ChildText(selectors.Title))
		}
		if selectors.Price != "" {
			raw.Price = strings.TrimSpace(e.ChildText(selectors.Price))
		}
		if selectors.OriginalPrice != "" {
			raw.OriginalPrice = strings.TrimSpace(e.ChildText(selectors.OriginalPrice))
		}
		if selectors.Rating != "" {
			raw.Rating = strings.TrimSpace(e.ChildText(selectors.Rating))
		}
		if selectors.ReviewCount != "" {
			raw.ReviewCount = strings.TrimSpace(e.ChildText(selectors.ReviewCount))
		}
		if selectors.Seller != "" {
			raw.Seller = strings.TrimSpace(e.ChildText(selectors.Seller))
		}
		if selectors.StockStatus != "" {
			raw.StockStatus = strings.TrimSpace(e.ChildText(selectors.StockStatus))
		}
		if selectors.ProductURL != "" && selectors.ProductURLAttr != "" {
			raw.ProductURL = e.ChildAttr(selectors.ProductURL, selectors.ProductURLAttr)
		}
		if selectors.SKU != "" && selectors.SKUAttr != "" {
			raw.SKU = e.ChildAttr(selectors.SKU, selectors.SKUAttr)
		}
		if selectors.Image != "" && selectors.ImageAttr != "" {
			raw.ImageURL = e.ChildAttr(selectors.Image, selectors.ImageAttr)
		}

		if raw.SKU != "" && raw.Price != "" {
			products = append(products, raw)
		}
	})

	err := ss.collector.Visit(url)
	ss.collector.Wait()

	if err != nil {
		scrapeErr = fmt.Errorf("visit failed: %w", err)
	}

	log.Debug().Str("site", siteName).Int("items", len(products)).Str("url", url).Msg("static scrape completed")

	return products, scrapeErr
}

func (ss *StaticScraper) Close() {
	ss.collector.Wait()
}
