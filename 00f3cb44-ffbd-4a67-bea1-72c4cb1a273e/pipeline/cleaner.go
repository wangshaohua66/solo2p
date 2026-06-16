package pipeline

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/rs/zerolog/log"
	"github.com/shopspring/decimal"
)

type RawProductData struct {
	Site          string
	Title         string
	Price         string
	OriginalPrice string
	Rating        string
	ReviewCount   string
	Seller        string
	StockStatus   string
	PromoTags     []string
	ProductURL    string
	SKU           string
	ImageURL      string
	Category      string
	Currency      string
	RatingScale   float64
}

type Cleaner struct {
	currencyRates map[string]float64
}

func NewCleaner() *Cleaner {
	return &Cleaner{
		currencyRates: map[string]float64{
			"USD": 1.0,
			"EUR": 1.08,
			"GBP": 1.27,
			"JPY": 0.0067,
			"CNY": 0.14,
			"CAD": 0.74,
			"AUD": 0.66,
		},
	}
}

func (c *Cleaner) Clean(raw *RawProductData) (*Product, error) {
	if raw.SKU == "" {
		return nil, fmt.Errorf("sku is empty")
	}

	price := c.parsePrice(raw.Price, raw.Currency)
	originalPrice := c.parsePrice(raw.OriginalPrice, raw.Currency)
	rating := c.parseRating(raw.Rating, raw.RatingScale)
	reviewCount := c.parseReviewCount(raw.ReviewCount)

	cleanTitle := c.cleanText(raw.Title)
	cleanSeller := c.cleanText(raw.Seller)
	cleanStock := c.cleanText(raw.StockStatus)
	promoStr := strings.Join(raw.PromoTags, ", ")

	product := &Product{
		Site:          raw.Site,
		SKU:           strings.TrimSpace(raw.SKU),
		Title:         cleanTitle,
		Price:         price,
		OriginalPrice: originalPrice,
		Currency:      "USD",
		Rating:        rating,
		ReviewCount:   reviewCount,
		Seller:        cleanSeller,
		StockStatus:   cleanStock,
		PromoTags:     promoStr,
		ProductURL:    raw.ProductURL,
		ImageURL:      raw.ImageURL,
		Category:      raw.Category,
		CrawledAt:     time.Now(),
	}

	return product, nil
}

func (c *Cleaner) parsePrice(priceStr string, currency string) decimal.Decimal {
	priceStr = strings.TrimSpace(priceStr)
	if priceStr == "" {
		return decimal.Zero
	}

	re := regexp.MustCompile(`[\$€£¥¥]|USD|EUR|GBP|JPY|CNY|\s+`)
	cleaned := re.ReplaceAllString(priceStr, "")
	cleaned = strings.ReplaceAll(cleaned, ",", "")
	cleaned = strings.TrimSpace(cleaned)

	if strings.Contains(cleaned, " - ") || strings.Contains(cleaned, "–") {
		parts := strings.FieldsFunc(cleaned, func(r rune) bool {
			return r == '-' || r == '–' || r == '—'
		})
		if len(parts) > 0 {
			cleaned = strings.TrimSpace(parts[0])
		}
	}

	price, err := decimal.NewFromString(cleaned)
	if err != nil {
		log.Debug().Str("raw", priceStr).Msg("failed to parse price")
		return decimal.Zero
	}

	rate, ok := c.currencyRates[strings.ToUpper(currency)]
	if !ok {
		rate = 1.0
	}

	if rate != 1.0 {
		price = price.Mul(decimal.NewFromFloat(rate))
	}

	return price.Round(2)
}

func (c *Cleaner) parseRating(ratingStr string, scale float64) float64 {
	ratingStr = strings.TrimSpace(ratingStr)
	if ratingStr == "" || scale == 0 {
		return 0
	}

	re := regexp.MustCompile(`[^\d.]`)
	cleaned := re.ReplaceAllString(ratingStr, "")
	cleaned = strings.Trim(cleaned, ".")

	if cleaned == "" {
		return 0
	}

	rating, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}

	if rating > scale {
		rating = scale
	}

	normalized := (rating / scale) * 5.0
	return math.Round(normalized*100) / 100
}

func (c *Cleaner) parseReviewCount(reviewStr string) int {
	reviewStr = strings.TrimSpace(reviewStr)
	if reviewStr == "" {
		return 0
	}

	re := regexp.MustCompile(`[^\dKkMm,]`)
	cleaned := re.ReplaceAllString(reviewStr, "")
	cleaned = strings.ReplaceAll(cleaned, ",", "")
	cleaned = strings.ToLower(cleaned)

	if cleaned == "" {
		return 0
	}

	multiplier := 1.0
	if strings.HasSuffix(cleaned, "k") {
		multiplier = 1000
		cleaned = strings.TrimSuffix(cleaned, "k")
	} else if strings.HasSuffix(cleaned, "m") {
		multiplier = 1000000
		cleaned = strings.TrimSuffix(cleaned, "m")
	}

	count, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}

	return int(count * multiplier)
}

func (c *Cleaner) cleanText(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}

	var b strings.Builder
	for _, r := range text {
		if unicode.IsPrint(r) || r == '\n' || r == '\t' {
			b.WriteRune(r)
		}
	}
	text = b.String()

	re := regexp.MustCompile(`\s+`)
	text = re.ReplaceAllString(text, " ")

	text = strings.TrimSpace(text)

	if len(text) > 500 {
		text = text[:500]
	}

	return text
}

func (c *Cleaner) DeduplicateProducts(products []*Product) []*Product {
	seen := make(map[string]bool)
	var result []*Product

	for _, p := range products {
		key := p.Site + ":" + p.SKU
		if !seen[key] {
			seen[key] = true
			result = append(result, p)
		}
	}

	return result
}

func (c *Cleaner) ValidateProduct(p *Product) error {
	if p.Site == "" {
		return fmt.Errorf("site is required")
	}
	if p.SKU == "" {
		return fmt.Errorf("sku is required")
	}
	if p.Title == "" {
		return fmt.Errorf("title is required")
	}
	if p.Price.LessThanOrEqual(decimal.Zero) {
		return fmt.Errorf("price must be positive")
	}
	return nil
}

func (c *Cleaner) ExtractPromoTags(tags []string) []string {
	var result []string
	promoKeywords := []string{
		"sale", "deal", "discount", "save", "off", "coupon",
		"促销", "折扣", "优惠", "特价", "秒杀", "限时",
		"free shipping", "免邮", "包邮",
		"new", "新品",
		"best seller", "畅销",
	}

	for _, tag := range tags {
		tagLower := strings.ToLower(tag)
		tagLower = strings.TrimSpace(tagLower)
		if tagLower == "" {
			continue
		}
		for _, kw := range promoKeywords {
			if strings.Contains(tagLower, kw) {
				result = append(result, tag)
				break
			}
		}
	}

	return result
}

func (c *Cleaner) CleanBatch(rawItems []*RawProductData) []*Product {
	var products []*Product
	for _, raw := range rawItems {
		p, err := c.Clean(raw)
		if err != nil {
			log.Debug().Err(err).Str("sku", raw.SKU).Msg("clean product failed")
			continue
		}
		if err := c.ValidateProduct(p); err != nil {
			log.Debug().Err(err).Str("sku", p.SKU).Msg("validate product failed")
			continue
		}
		products = append(products, p)
	}

	products = c.DeduplicateProducts(products)
	return products
}
