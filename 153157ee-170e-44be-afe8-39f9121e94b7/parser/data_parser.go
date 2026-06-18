package parser

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"grain-monitor/models"
)

type DataParser struct {
	unitMultipliers map[string]float64
}

func NewDataParser() *DataParser {
	return &DataParser{
		unitMultipliers: map[string]float64{
			"元/吨":  1,
			"元/公斤": 1000,
			"元/斤":  2000,
			"元/蒲式耳": 36.7437,
			"美分/蒲式耳": 0.367437,
		},
	}
}

type RawData struct {
	Fields map[string]string
}

func (p *DataParser) ParseMarketData(
	siteID string,
	grainType models.GrainType,
	priceType models.PriceType,
	rawData map[string]string,
	prevSnapshot *models.MarketSnapshot,
) (*models.MarketSnapshot, int, int, error) {
	snapshot := &models.MarketSnapshot{
		SiteID:      siteID,
		GrainType:   grainType,
		PriceType:   priceType,
		Timestamp:   time.Now(),
		Unit:        "元/吨",
	}

	fieldsCount := 0
	totalFields := len(rawData)
	missingFields := []string{}

	if priceStr, ok := rawData["price"]; ok && priceStr != "" {
		if price, err := p.parsePrice(priceStr); err == nil && price > 0 {
			snapshot.Price = price
			fieldsCount++
		} else {
			missingFields = append(missingFields, "price")
		}
	} else {
		missingFields = append(missingFields, "price")
	}

	if changeStr, ok := rawData["change"]; ok && changeStr != "" {
		if change, err := p.parsePrice(changeStr); err == nil {
			snapshot.Change = change
			fieldsCount++
		}
	}

	if changePctStr, ok := rawData["change_pct"]; ok && changePctStr != "" {
		if pct, err := p.parsePercentage(changePctStr); err == nil {
			snapshot.ChangePct = pct
			fieldsCount++
		}
	}

	if highStr, ok := rawData["high"]; ok && highStr != "" {
		if high, err := p.parsePrice(highStr); err == nil {
			snapshot.HighPrice = high
			fieldsCount++
		}
	}

	if lowStr, ok := rawData["low"]; ok && lowStr != "" {
		if low, err := p.parsePrice(lowStr); err == nil {
			snapshot.LowPrice = low
			fieldsCount++
		}
	}

	if openStr, ok := rawData["open"]; ok && openStr != "" {
		if open, err := p.parsePrice(openStr); err == nil {
			snapshot.OpenPrice = open
			fieldsCount++
		}
	}

	if closeStr, ok := rawData["close"]; ok && closeStr != "" {
		if close, err := p.parsePrice(closeStr); err == nil {
			snapshot.ClosePrice = close
			fieldsCount++
		}
	}

	if volumeStr, ok := rawData["volume"]; ok && volumeStr != "" {
		if volume, err := p.parseVolume(volumeStr); err == nil {
			snapshot.Volume = volume
			fieldsCount++
		}
	}

	if unitStr, ok := rawData["unit"]; ok && unitStr != "" {
		snapshot.Unit = unitStr
		fieldsCount++
	}

	if contractStr, ok := rawData["contract"]; ok && contractStr != "" {
		snapshot.Contract = contractStr
		fieldsCount++
	}

	if prevSnapshot != nil {
		snapshot.PrevPrice = prevSnapshot.Price

		if snapshot.Price > 0 && snapshot.ChangePct == 0 && prevSnapshot.Price > 0 {
			snapshot.Change = snapshot.Price - prevSnapshot.Price
			snapshot.ChangePct = (snapshot.Price - prevSnapshot.Price) / prevSnapshot.Price * 100
		}
	}

	p.fillMissingFields(snapshot, prevSnapshot, &missingFields, &fieldsCount)

	if len(missingFields) > 0 {
		snapshot.HasMissingFields = true
		snapshot.MissingFields = missingFields
	}

	p.checkSuspicious(snapshot, prevSnapshot)

	return snapshot, fieldsCount, totalFields, nil
}

func (p *DataParser) fillMissingFields(snapshot *models.MarketSnapshot, prev *models.MarketSnapshot, missingFields *[]string, fieldsCount *int) {
	if prev == nil {
		return
	}

	if snapshot.Price == 0 && prev.Price > 0 {
		snapshot.Price = prev.Price
		*fieldsCount++
		for i, f := range *missingFields {
			if f == "price" {
				*missingFields = append((*missingFields)[:i], (*missingFields)[i+1:]...)
				break
			}
		}
	}

	if snapshot.HighPrice == 0 && prev.HighPrice > 0 {
		snapshot.HighPrice = prev.HighPrice
	}

	if snapshot.LowPrice == 0 && prev.LowPrice > 0 {
		snapshot.LowPrice = prev.LowPrice
	}

	if snapshot.Volume == 0 && prev.Volume > 0 {
		snapshot.Volume = prev.Volume
	}
}

func (p *DataParser) checkSuspicious(snapshot *models.MarketSnapshot, prev *models.MarketSnapshot) {
	if snapshot.Price <= 0 {
		snapshot.IsSuspicious = true
		snapshot.SuspiciousReason = "价格为零或负数"
		return
	}

	if math.Abs(snapshot.ChangePct) > 15 {
		snapshot.IsSuspicious = true
		snapshot.SuspiciousReason = fmt.Sprintf("涨跌幅%.2f%%超过15%%阈值", snapshot.ChangePct)
		return
	}

	if prev != nil && prev.Price > 0 {
		changePct := math.Abs((snapshot.Price - prev.Price) / prev.Price * 100)
		if changePct > 15 {
			snapshot.IsSuspicious = true
			snapshot.SuspiciousReason = fmt.Sprintf("与上次采集相比价格波动%.2f%%超过15%%阈值", changePct)
			return
		}
	}

	if snapshot.HighPrice > 0 && snapshot.LowPrice > 0 && snapshot.HighPrice < snapshot.LowPrice {
		snapshot.IsSuspicious = true
		snapshot.SuspiciousReason = "最高价低于最低价"
		return
	}
}

func (p *DataParser) parsePrice(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, "，", "")
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "元/吨", "")
	s = strings.ReplaceAll(s, "元", "")
	s = strings.Trim(s, "¥￥$")

	if s == "" || s == "-" || s == "--" {
		return 0, fmt.Errorf("empty price")
	}

	val, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	return val, nil
}

func (p *DataParser) parsePercentage(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "%", "")
	s = strings.ReplaceAll(s, "％", "")
	s = strings.ReplaceAll(s, " ", "")

	if s == "" || s == "-" || s == "--" {
		return 0, fmt.Errorf("empty percentage")
	}

	val, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	return val, nil
}

func (p *DataParser) parseVolume(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, "，", "")
	s = strings.ReplaceAll(s, "手", "")
	s = strings.ReplaceAll(s, "吨", "")
	s = strings.ReplaceAll(s, "万", "0000")
	s = strings.ReplaceAll(s, " ", "")

	if s == "" || s == "-" || s == "--" {
		return 0, fmt.Errorf("empty volume")
	}

	if strings.Contains(s, "亿") {
		s = strings.ReplaceAll(s, "亿", "")
		val, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, err
		}
		return val * 100000000, nil
	}

	val, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	return val, nil
}

func (p *DataParser) ParsePolicyItems(rawItems []map[string]string, keywords []string) []models.PolicyItem {
	var items []models.PolicyItem
	now := time.Now()

	for _, raw := range rawItems {
		title := strings.TrimSpace(raw["title"])
		if title == "" {
			continue
		}

		url := raw["url"]
		dateStr := raw["date"]

		var date time.Time
		if dateStr != "" {
			if d, err := parseDate(dateStr); err == nil {
				date = d
			} else {
				date = now
			}
		} else {
			date = now
		}

		matchedKeywords := p.matchKeywords(title, keywords)
		if len(keywords) == 0 || len(matchedKeywords) > 0 {
			items = append(items, models.PolicyItem{
				Title:    title,
				URL:      url,
				Date:     date,
				Keywords: matchedKeywords,
			})
		}
	}

	return items
}

func (p *DataParser) matchKeywords(text string, keywords []string) []string {
	var matched []string
	for _, kw := range keywords {
		if strings.Contains(text, kw) {
			matched = append(matched, kw)
		}
	}
	return matched
}

func parseDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "/", "-")
	s = strings.ReplaceAll(s, ".", "-")
	s = strings.ReplaceAll(s, "年", "-")
	s = strings.ReplaceAll(s, "月", "-")
	s = strings.ReplaceAll(s, "日", "")
	s = strings.TrimSpace(s)

	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
		"01-02",
		"2006/01/02",
	}

	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			if t.Year() < 2000 {
				t = t.AddDate(time.Now().Year()-t.Year(), 0, 0)
			}
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unrecognized date format: %s", s)
}

func (p *DataParser) NormalizePrice(price float64, fromUnit string, toUnit string) float64 {
	if fromUnit == toUnit || price == 0 {
		return price
	}

	fromMult, fromOK := p.unitMultipliers[fromUnit]
	toMult, toOK := p.unitMultipliers[toUnit]

	if !fromOK || !toOK {
		return price
	}

	return price * fromMult / toMult
}
