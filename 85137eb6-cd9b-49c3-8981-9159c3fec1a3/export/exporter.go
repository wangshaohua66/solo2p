package export

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html/template"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"price-monitor/config"
	"price-monitor/storage"
)

type PriceStats struct {
	SKUId          string
	SKUName        string
	Brand          string
	Category       string
	SiteId         string
	SiteName       string
	Avg7Day        float64
	Avg30Day       float64
	MinPrice       float64
	MaxPrice       float64
	CurrentPrice   float64
	Volatility     float64
	PriceCount     int
	LowestSite     string
	LowestPrice    float64
	HighestSite    string
	HighestPrice   float64
	ReferencePrice float64
	CompareRefPct  float64
}

type TrendPoint struct {
	Date   string  `json:"date"`
	Price  float64 `json:"price"`
	Site   string  `json:"site,omitempty"`
}

type ReportData struct {
	GeneratedAt   time.Time
	PeriodDays    int
	TotalSKUs     int
	TotalSites    int
	TotalRecords  int64
	PriceDrops    int
	PriceRises    int
	BelowRefCount int
	SKUStats      []PriceStats
	Trends        map[string][]TrendPoint
	LowestPrices  map[string]LowestPriceInfo
}

type LowestPriceInfo struct {
	Site   string
	Price  float64
	URL    string
	Name   string
}

func CalculateStats(records []*storage.PriceRecord, db *storage.Database, cfg *config.AppConfig) []PriceStats {
	grouped := make(map[string][]*storage.PriceRecord)
	for _, r := range records {
		key := r.SKUId + "_" + r.SiteId
		grouped[key] = append(grouped[key], r)
	}

	var stats []PriceStats
	now := time.Now()
	d7 := now.AddDate(0, 0, -7)
	d30 := now.AddDate(0, 0, -30)

	for key, recs := range grouped {
		parts := strings.SplitN(key, "_", 2)
		if len(parts) != 2 || len(recs) == 0 {
			continue
		}
		skuId, siteId := parts[0], parts[1]

		first := recs[0]
		sort.Slice(recs, func(i, j int) bool {
			return recs[i].CrawledAt.Before(recs[j].CrawledAt)
		})

		var sum7, sum30, sumAll float64
		var cnt7, cnt30 int
		var minP, maxP float64 = math.MaxFloat64, 0
		prices := make([]float64, 0, len(recs))

		for _, r := range recs {
			if r.PriceFinal <= 0 {
				continue
			}
			sumAll += r.PriceFinal
			prices = append(prices, r.PriceFinal)
			if r.PriceFinal < minP {
				minP = r.PriceFinal
			}
			if r.PriceFinal > maxP {
				maxP = r.PriceFinal
			}
			if !r.CrawledAt.Before(d7) {
				sum7 += r.PriceFinal
				cnt7++
			}
			if !r.CrawledAt.Before(d30) {
				sum30 += r.PriceFinal
				cnt30++
			}
		}

		if len(prices) == 0 {
			continue
		}

		avg7 := 0.0
		if cnt7 > 0 {
			avg7 = sum7 / float64(cnt7)
		}
		avg30 := 0.0
		if cnt30 > 0 {
			avg30 = sum30 / float64(cnt30)
		}

		mean := sumAll / float64(len(prices))
		variance := 0.0
		for _, p := range prices {
			variance += math.Pow(p-mean, 2)
		}
		volatility := 0.0
		if len(prices) > 1 {
			volatility = math.Sqrt(variance / float64(len(prices)-1))
		}

		currentPrice := recs[len(recs)-1].PriceFinal
		refPrice := 0.0
		if sku, ok := cfg.GetSKUByID(skuId); ok {
			refPrice = sku.ReferencePrice
		}
		compareRefPct := 0.0
		if refPrice > 0 {
			compareRefPct = (currentPrice - refPrice) / refPrice
		}

		stats = append(stats, PriceStats{
			SKUId:          skuId,
			SKUName:        first.SKUName,
			Brand:          first.Brand,
			Category:       first.Category,
			SiteId:         siteId,
			SiteName:       first.SiteName,
			Avg7Day:        avg7,
			Avg30Day:       avg30,
			MinPrice:       minP,
			MaxPrice:       maxP,
			CurrentPrice:   currentPrice,
			Volatility:     volatility,
			PriceCount:     len(prices),
			ReferencePrice: refPrice,
			CompareRefPct:  compareRefPct,
		})
	}

	skuLowest := make(map[string]LowestPriceInfo)
	skuHighest := make(map[string]LowestPriceInfo)
	for i, s := range stats {
		low, exists := skuLowest[s.SKUId]
		if !exists || s.CurrentPrice < low.Price {
			skuLowest[s.SKUId] = LowestPriceInfo{Site: s.SiteName, Price: s.CurrentPrice, Name: s.SKUName}
		}
		high, exists := skuHighest[s.SKUId]
		if !exists || s.CurrentPrice > high.Price {
			skuHighest[s.SKUId] = LowestPriceInfo{Site: s.SiteName, Price: s.CurrentPrice, Name: s.SKUName}
		}
		_ = i
	}

	for i := range stats {
		if low, ok := skuLowest[stats[i].SKUId]; ok {
			stats[i].LowestSite = low.Site
			stats[i].LowestPrice = low.Price
		}
		if high, ok := skuHighest[stats[i].SKUId]; ok {
			stats[i].HighestSite = high.Site
			stats[i].HighestPrice = high.Price
		}
	}

	return stats
}

func GenerateReport(records []*storage.PriceRecord, db *storage.Database, cfg *config.AppConfig, periodDays int) *ReportData {
	stats := CalculateStats(records, db, cfg)

	trends := make(map[string][]TrendPoint)
	for _, r := range records {
		point := TrendPoint{
			Date:  r.CrawledAt.Format("2006-01-02"),
			Price: r.PriceFinal,
			Site:  r.SiteName,
		}
		key := r.SKUId
		trends[key] = append(trends[key], point)
	}

	lowestPrices := make(map[string]LowestPriceInfo)
	skuMap := make(map[string]*storage.PriceRecord)
	for _, r := range records {
		existing, ok := skuMap[r.SKUId]
		if !ok || r.PriceFinal < existing.PriceFinal {
			skuMap[r.SKUId] = r
		}
	}
	for skuId, r := range skuMap {
		lowestPrices[skuId] = LowestPriceInfo{
			Site:  r.SiteName,
			Price: r.PriceFinal,
			URL:   r.URL,
			Name:  r.SKUName,
		}
	}

	dbStats, _ := db.GetStatistics(periodDays)
	totalRecords, _ := dbStats["total_records"].(int64)

	return &ReportData{
		GeneratedAt:  time.Now(),
		PeriodDays:   periodDays,
		TotalSKUs:    len(skuMap),
		TotalSites:   len(cfg.GetEnabledSites()),
		TotalRecords: totalRecords,
		SKUStats:     stats,
		Trends:       trends,
		LowestPrices: lowestPrices,
	}
}

func ExportJSON(data interface{}, path string) error {
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create JSON file failed: %w", err)
	}
	defer file.Close()

	enc := json.NewEncoder(file)
	enc.SetIndent("", "  ")
	if err := enc.Encode(data); err != nil {
		return fmt.Errorf("encode JSON failed: %w", err)
	}
	return nil
}

func ExportCSV(records []*storage.PriceRecord, path string) error {
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create CSV file failed: %w", err)
	}
	defer file.Close()

	w := csv.NewWriter(file)
	defer w.Flush()

	header := []string{"SKU_ID", "商品名称", "品牌", "分类", "平台ID", "平台名称",
		"原价", "促销价", "会员价", "实付价", "币种", "库存", "抓取时间", "链接"}
	if err := w.Write(header); err != nil {
		return fmt.Errorf("write CSV header failed: %w", err)
	}

	for _, r := range records {
		row := []string{
			r.SKUId,
			r.SKUName,
			r.Brand,
			r.Category,
			r.SiteId,
			r.SiteName,
			fmt.Sprintf("%.2f", r.PriceOriginal),
			fmt.Sprintf("%.2f", r.PricePromo),
			fmt.Sprintf("%.2f", r.PriceMember),
			fmt.Sprintf("%.2f", r.PriceFinal),
			r.Currency,
			r.Stock,
			r.CrawledAt.Format("2006-01-02 15:04:05"),
			r.URL,
		}
		if err := w.Write(row); err != nil {
			return fmt.Errorf("write CSV row failed: %w", err)
		}
	}
	return nil
}

func ExportHTML(records []*storage.PriceRecord, db *storage.Database, cfg *config.AppConfig, path string) error {
	report := GenerateReport(records, db, cfg, 30)

	const htmlTmpl = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>母婴电商价格监控报告</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f8fafc; }
.container { max-width: 1200px; margin: 0 auto; }
h1 { color: #1e293b; margin-bottom: 8px; }
.subtitle { color: #64748b; margin-bottom: 24px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.stat-label { color: #64748b; font-size: 14px; margin-bottom: 4px; }
.stat-value { color: #1e293b; font-size: 28px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
th { background: #1e293b; color: white; padding: 14px 12px; text-align: left; font-weight: 600; font-size: 13px; }
td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; }
tr:hover { background: #f8fafc; }
.price-up { color: #ef4444; font-weight: 600; }
.price-down { color: #22c55e; font-weight: 600; }
.lowest { background: #dcfce7 !important; }
.footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<div class="container">
<h1>🛒 母婴电商价格监控报告</h1>
<p class="subtitle">生成时间: {{.GeneratedAt.Format "2006-01-02 15:04:05"}} | 周期: {{.PeriodDays}}天</p>
<div class="stats-grid">
  <div class="stat-card"><div class="stat-label">监控SKU数</div><div class="stat-value">{{.TotalSKUs}}</div></div>
  <div class="stat-card"><div class="stat-label">监控平台数</div><div class="stat-value">{{.TotalSites}}</div></div>
  <div class="stat-card"><div class="stat-label">历史记录数</div><div class="stat-value">{{.TotalRecords}}</div></div>
</div>
<table>
<thead><tr>
  <th>SKU</th><th>商品名称</th><th>品牌</th><th>平台</th>
  <th>当前价</th><th>7日均价</th><th>30日均价</th>
  <th>最低价</th><th>最高价</th><th>波动率</th>
  <th>全网最低</th><th>对比参考价</th>
</tr></thead>
<tbody>
{{range .SKUStats}}
<tr>
  <td>{{.SKUId}}</td>
  <td>{{.SKUName}}</td>
  <td>{{.Brand}}</td>
  <td>{{.SiteName}}</td>
  <td><strong>¥{{printf "%.2f" .CurrentPrice}}</strong></td>
  <td>¥{{printf "%.2f" .Avg7Day}}</td>
  <td>¥{{printf "%.2f" .Avg30Day}}</td>
  <td>¥{{printf "%.2f" .MinPrice}}</td>
  <td>¥{{printf "%.2f" .MaxPrice}}</td>
  <td>{{printf "%.2f" .Volatility}}</td>
  <td class="{{if eq .SiteName .LowestSite}}lowest{{end}}">{{.LowestSite}} ¥{{printf "%.2f" .LowestPrice}}</td>
  <td class="{{if lt .CompareRefPct 0}}price-down{{else if gt .CompareRefPct 0}}price-up{{end}}">
    {{if gt .CompareRefPct 0}}+{{end}}{{printf "%.1f" (mul .CompareRefPct 100)}}%
  </td>
</tr>
{{end}}
</tbody>
</table>
<p class="footer">母婴电商价格监控系统 · 数据仅供参考</p>
</div>
</body>
</html>`

	funcMap := template.FuncMap{
		"mul": func(a, b float64) float64 { return a * b },
	}

	tmpl, err := template.New("report").Funcs(funcMap).Parse(htmlTmpl)
	if err != nil {
		return fmt.Errorf("parse HTML template failed: %w", err)
	}

	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create HTML file failed: %w", err)
	}
	defer file.Close()

	if err := tmpl.Execute(file, report); err != nil {
		return fmt.Errorf("render HTML template failed: %w", err)
	}
	return nil
}

func GenerateMarkdownReport(records []*storage.PriceRecord, db *storage.Database, cfg *config.AppConfig) string {
	report := GenerateReport(records, db, cfg, 30)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 🛒 母婴电商价格监控报告\n\n"))
	sb.WriteString(fmt.Sprintf("**生成时间**: %s | **周期**: %d天\n\n",
		report.GeneratedAt.Format("2006-01-02 15:04:05"), report.PeriodDays))

	sb.WriteString(fmt.Sprintf("| 指标 | 数值 |\n"))
	sb.WriteString(fmt.Sprintf("|------|------|\n"))
	sb.WriteString(fmt.Sprintf("| 监控SKU数 | %d |\n", report.TotalSKUs))
	sb.WriteString(fmt.Sprintf("| 监控平台数 | %d |\n", report.TotalSites))
	sb.WriteString(fmt.Sprintf("| 历史记录数 | %d |\n\n", report.TotalRecords))

	sb.WriteString("## 💰 全网最低价汇总\n\n")
	sb.WriteString("| SKU | 商品名称 | 最低平台 | 最低价格 |\n")
	sb.WriteString("|-----|---------|---------|----------|\n")
	for skuId, info := range report.LowestPrices {
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | ¥%.2f |\n",
			skuId, info.Name, info.Site, info.Price))
	}
	sb.WriteString("\n")

	sb.WriteString("## 📊 各SKU多平台价格对比\n\n")
	sb.WriteString("| SKU | 商品 | 平台 | 当前价 | 7日均价 | 30日均价 | 最低 | 最高 | 波动率 | 全网最低 |\n")
	sb.WriteString("|-----|------|------|--------|---------|----------|------|------|--------|----------|\n")
	for _, s := range report.SKUStats {
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | ¥%.2f | ¥%.2f | ¥%.2f | ¥%.2f | ¥%.2f | %.2f | %s ¥%.2f |\n",
			s.SKUId, s.SKUName, s.SiteName, s.CurrentPrice,
			s.Avg7Day, s.Avg30Day, s.MinPrice, s.MaxPrice, s.Volatility,
			s.LowestSite, s.LowestPrice))
	}

	return sb.String()
}

func FilterRecords(records []*storage.PriceRecord, category, brand, site string) []*storage.PriceRecord {
	var filtered []*storage.PriceRecord
	for _, r := range records {
		if category != "" && !strings.EqualFold(r.Category, category) {
			continue
		}
		if brand != "" && !strings.EqualFold(r.Brand, brand) {
			continue
		}
		if site != "" && !strings.EqualFold(r.SiteId, site) {
			continue
		}
		filtered = append(filtered, r)
	}
	return filtered
}
