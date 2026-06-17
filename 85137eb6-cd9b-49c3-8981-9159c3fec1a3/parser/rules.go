package parser

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"

	"price-monitor/config"
	"price-monitor/logger"
)

type ParsedData struct {
	Title         string
	PriceOriginal float64
	PricePromo    float64
	PriceMember   float64
	CouponPrice   float64
	Stock         string
	SKU           string
}

var priceRegex = regexp.MustCompile(`[-+]?[0-9]*\.?[0-9]+`)
var cleanPriceRegex = regexp.MustCompile(`[^\d.]`)

func parsePriceText(text string) float64 {
	if text == "" {
		return 0
	}

	text = strings.TrimSpace(text)
	replacements := []string{
		"¥", "￥", "$", "€", "£", "HK$", "RMB", "CNY", "USD", "EUR",
		"元", "块", "块钱", "元起", "元/件", "元/盒", "元/袋", "元/罐",
		" ", "\t", "\n", "\r", ",", "，",
	}
	for _, r := range replacements {
		text = strings.ReplaceAll(text, r, "")
	}

	matches := priceRegex.FindAllString(text, -1)
	if len(matches) == 0 {
		return 0
	}

	minVal := 0.0
	for _, m := range matches {
		cleaned := strings.ReplaceAll(m, ",", "")
		if val, err := strconv.ParseFloat(cleaned, 64); err == nil && val > 0 {
			if minVal == 0 || val < minVal {
				minVal = val
			}
		}
	}

	if minVal > 0 {
		return minVal
	}

	cleanedFirst := strings.ReplaceAll(matches[0], ",", "")
	val, err := strconv.ParseFloat(cleanedFirst, 64)
	if err != nil {
		return 0
	}
	return val
}

func extractText(doc *goquery.Document, selector string) string {
	if selector == "" {
		return ""
	}
	sel := doc.Find(selector)
	if sel.Length() == 0 {
		return ""
	}

	text := strings.TrimSpace(sel.First().Text())
	if text != "" {
		return text
	}

	if attr, exists := sel.Attr("content"); exists {
		return strings.TrimSpace(attr)
	}
	if attr, exists := sel.Attr("value"); exists {
		return strings.TrimSpace(attr)
	}
	if attr, exists := sel.Attr("data-price"); exists {
		return strings.TrimSpace(attr)
	}
	if attr, exists := sel.Attr("data-value"); exists {
		return strings.TrimSpace(attr)
	}

	return ""
}

func extractTextAttrs(doc *goquery.Document, selectors []string) string {
	for _, sel := range selectors {
		text := extractText(doc, sel)
		if text != "" {
			return text
		}
	}
	return ""
}

func ParsePricePage(doc *goquery.Document, site config.SiteConfig) *ParsedData {
	data := &ParsedData{}

	sels := site.Selectors

	titleSelectors := []string{sels.Title}
	switch site.ID {
	case "tmall":
		titleSelectors = append(titleSelectors, ".tb-main-title", "[data-spm='title']", ".tb-detail-hd h1")
	case "jd":
		titleSelectors = append(titleSelectors, ".itemInfo-wrap .sku-name", "#name h1", ".p-name")
	case "suning":
		titleSelectors = append(titleSelectors, ".iteminfo-wrap .title", "#itemDisplayName")
	}
	data.Title = extractTextAttrs(doc, titleSelectors)

	origSelectors := []string{sels.PriceOriginal}
	switch site.ID {
	case "tmall":
		origSelectors = append(origSelectors, ".tm-price", ".originPrice", ".tb-rmb-num")
	case "jd":
		origSelectors = append(origSelectors, ".summary-price .p-price", ".p-price .price")
	case "suning":
		origSelectors = append(origSelectors, ".mainprice-wrap .nprice", ".price-box .price")
	}
	origText := extractTextAttrs(doc, origSelectors)
	data.PriceOriginal = parsePriceText(origText)

	promoSelectors := []string{sels.PricePromo}
	switch site.ID {
	case "tmall":
		promoSelectors = append(promoSelectors, ".tm-price", ".promoPrice", "[class*='promotion'] [class*='price']")
	case "jd":
		promoSelectors = append(promoSelectors, ".p-price .price", ".summary-price .p-price")
	case "suning":
		promoSelectors = append(promoSelectors, ".mainprice-wrap .price", ".price-box .promo-price")
	}
	promoText := extractTextAttrs(doc, promoSelectors)
	data.PricePromo = parsePriceText(promoText)

	memberSelectors := []string{sels.PriceMember}
	switch site.ID {
	case "tmall":
		memberSelectors = append(memberSelectors, ".tm-price-vip", ".vipPrice", ".member-price")
	case "jd":
		memberSelectors = append(memberSelectors, ".price-plus-desc .p-price", ".plus-price")
	case "suning":
		memberSelectors = append(memberSelectors, ".viprice", ".member-only-price")
	}
	memberText := extractTextAttrs(doc, memberSelectors)
	data.PriceMember = parsePriceText(memberText)

	if data.PricePromo <= 0 && data.PriceOriginal > 0 {
		data.PricePromo = data.PriceOriginal
	}
	if data.PricePromo > 0 && data.PriceOriginal <= 0 {
		data.PriceOriginal = data.PricePromo
	}

	stockSelectors := []string{sels.Stock}
	switch site.ID {
	case "tmall":
		stockSelectors = append(stockSelectors, ".tb-stock", ".stock-info", "#J_SpanStock")
	case "jd":
		stockSelectors = append(stockSelectors, ".stock", "#store-prompt", ".store-prompt")
	case "suning":
		stockSelectors = append(stockSelectors, ".stock-num", ".stock-info")
	}
	data.Stock = extractTextAttrs(doc, stockSelectors)
	if data.Stock == "" {
		data.Stock = "未知"
	}

	skuSelectors := []string{sels.SKUId}
	switch site.ID {
	case "tmall":
		skuSelectors = append(skuSelectors, "[data-sku]", ".tb-sku")
	case "jd":
		skuSelectors = append(skuSelectors, ".summary-sku", "#summary-sku")
	}
	data.SKU = extractTextAttrs(doc, skuSelectors)

	couponSelectors := []string{
		"[class*='coupon'] [class*='price']",
		".coupon-price",
		".coupon-value",
		"[class*='discount'] [class*='price']",
	}
	couponText := extractTextAttrs(doc, couponSelectors)
	data.CouponPrice = parsePriceText(couponText)

	logger.Debug("Parsed [%s]: 原价=%.2f 促销=%.2f 会员=%.2f 券后=%.2f 库存=%s 标题=%s",
		site.Name, data.PriceOriginal, data.PricePromo, data.PriceMember,
		data.CouponPrice, data.Stock, truncateStr(data.Title, 30))

	return data
}

func ParsePriceFromHTML(html string, site config.SiteConfig) (*ParsedData, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, err
	}
	return ParsePricePage(doc, site), nil
}

func ParseSearchResults(doc *goquery.Document, site config.SiteConfig) []*ParsedData {
	var results []*ParsedData

	itemSelectors := []string{
		".item", ".product-item", ".goods-item", ".J_TItems .item",
		".gl-item", ".gl-i-wrap", ".item-wrap",
		"[class*='product-list'] [class*='item']",
		"[class*='goods-list'] [class*='item']",
	}

	for _, sel := range itemSelectors {
		doc.Find(sel).Each(func(i int, s *goquery.Selection) {
			itemDoc := &goquery.Document{Selection: s}
			data := ParsePricePage(itemDoc, site)
			if data.PricePromo > 0 || data.PriceOriginal > 0 {
				results = append(results, data)
			}
		})
		if len(results) > 0 {
			break
		}
	}

	return results
}

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}
