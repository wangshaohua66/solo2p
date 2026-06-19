package crawler

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"github.com/go-rod/bypass"
	"github.com/go-rod/rod"
	"go.uber.org/zap"

	"drugvigil/config"
	"drugvigil/store"
)

type SiteStrategy interface {
	Execute(ctx context.Context, progressCB ProgressCallback) ([]*store.SecurityRecord, int, int64, error)
}

type BaseStrategy struct {
	site   *config.SiteConfig
	logger *zap.Logger
}

func NewSiteStrategy(site *config.SiteConfig, logger *zap.Logger) SiteStrategy {
	switch site.Strategy {
	case "pagination":
		return &PaginationStrategy{BaseStrategy: BaseStrategy{site: site, logger: logger}}
	case "form":
		return &FormStrategy{BaseStrategy: BaseStrategy{site: site, logger: logger}}
	case "dynamic":
		return &DynamicTableStrategy{BaseStrategy: BaseStrategy{site: site, logger: logger}}
	case "pdf":
		return &PDFStrategy{BaseStrategy: BaseStrategy{site: site, logger: logger}}
	case "auth":
		return &AuthStrategy{BaseStrategy: BaseStrategy{site: site, logger: logger}}
	case "multilingual":
		return &MultilingualStrategy{BaseStrategy: BaseStrategy{site: site, logger: logger}}
	default:
		return &PaginationStrategy{BaseStrategy: BaseStrategy{site: site, logger: logger}}
	}
}

func (b *BaseStrategy) parseDate(dateStr string) time.Time {
	formats := []string{
		"2006-01-02", "2006/01/02", "02/01/2006", "Jan 2, 2006",
		"2006年1月2日", "02-01-2006", time.RFC3339,
	}
	for _, f := range formats {
		if t, err := time.Parse(f, strings.TrimSpace(dateStr)); err == nil {
			return t
		}
	}
	return time.Now()
}

func (b *BaseStrategy) extractText(ctx context.Context, sel string) (string, error) {
	var text string
	err := chromedp.Run(ctx,
		chromedp.Text(sel, &text, chromedp.ByQuery, chromedp.NodeVisible),
	)
	return strings.TrimSpace(text), err
}

func (b *BaseStrategy) extractAttribute(ctx context.Context, sel, attr string) (string, error) {
	var value string
	err := chromedp.Run(ctx,
		chromedp.AttributeValue(sel, attr, &value, nil, chromedp.ByQuery),
	)
	return value, err
}

func (b *BaseStrategy) parseRecords(ctx context.Context, nodes []*cdp.Node, sourceAgency string) []*store.SecurityRecord {
	var records []*store.SecurityRecord
	for _, node := range nodes {
		record, err := b.parseSingleRecord(ctx, node, sourceAgency)
		if err != nil {
			b.logger.Debug("parse record failed", zap.Error(err))
			continue
		}
		if record != nil {
			records = append(records, record)
		}
	}
	return records
}

func (b *BaseStrategy) parseSingleRecord(ctx context.Context, node *cdp.Node, sourceAgency string) (*store.SecurityRecord, error) {
	nodeID := node.NodeID

	var drugName, title, dateStr, severity, reportID, content, link string

	chromedp.Run(ctx,
		chromedp.Text(b.site.Selectors.DrugNameSel, &drugName, chromedp.ByQuery, chromedp.FromNode(node)),
		chromedp.Text(b.site.Selectors.TitleSel, &title, chromedp.ByQuery, chromedp.FromNode(node)),
		chromedp.Text(b.site.Selectors.DateSel, &dateStr, chromedp.ByQuery, chromedp.FromNode(node)),
		chromedp.Text(b.site.Selectors.SeveritySel, &severity, chromedp.ByQuery, chromedp.FromNode(node)),
		chromedp.Text(b.site.Selectors.ReportIDSel, &reportID, chromedp.ByQuery, chromedp.FromNode(node)),
		chromedp.Text(b.site.Selectors.ContentSel, &content, chromedp.ByQuery, chromedp.FromNode(node)),
		chromedp.AttributeValue(b.site.Selectors.DetailLinkSel, "href", &link, nil, chromedp.ByQuery, chromedp.FromNode(node)),
	)
	_ = nodeID

	if reportID == "" {
		reportID = fmt.Sprintf("%s-%d", b.site.Code, time.Now().UnixNano())
	}

	return &store.SecurityRecord{
		SourceAgency:  sourceAgency,
		SourceCode:    b.site.Code,
		ReportID:      strings.TrimSpace(reportID),
		DrugName:      strings.TrimSpace(drugName),
		AdverseEvent:  strings.TrimSpace(title),
		Severity:      strings.TrimSpace(severity),
		PublishedDate: b.parseDate(dateStr),
		SourceURL:     strings.TrimSpace(link),
		Summary:       strings.TrimSpace(content),
		Language:      b.site.Language,
	}, nil
}

type PaginationStrategy struct {
	BaseStrategy
}

func (s *PaginationStrategy) Execute(ctx context.Context, progressCB ProgressCallback) ([]*store.SecurityRecord, int, int64, error) {
	s.logger.Info("starting pagination crawl", zap.String("site", s.site.Code))
	startTime := time.Now()

	var allRecords []*store.SecurityRecord
	currentPage := s.site.Pagination.StartPage
	totalCount := int64(0)
	maxPages := s.site.MaxPagesPerCrawl
	if s.site.Pagination.MaxPage > 0 && s.site.Pagination.MaxPage < maxPages {
		maxPages = s.site.Pagination.MaxPage
	}

	err := chromedp.Run(ctx,
		chromedp.Navigate(s.site.URL),
		chromedp.WaitVisible(s.site.Selectors.RowSelector, chromedp.ByQuery),
		chromedp.Sleep(s.site.RateLimitDelay),
	)
	if err != nil {
		return nil, currentPage, totalCount, fmt.Errorf("navigate: %w", err)
	}

	for currentPage <= maxPages {
		var nodes []*cdp.Node
		err := chromedp.Run(ctx,
			chromedp.Nodes(s.site.Selectors.RowSelector, &nodes, chromedp.ByQueryAll),
		)
		if err != nil {
			s.logger.Warn("get rows failed", zap.Int("page", currentPage), zap.Error(err))
			break
		}

		records := s.parseRecords(ctx, nodes, s.site.Name)
		allRecords = append(allRecords, records...)
		totalCount += int64(len(records))

		if progressCB != nil {
			progressCB(&CrawlProgress{
				SiteName:    s.site.Name,
				CurrentPage: currentPage,
				Fetched:     totalCount,
				Elapsed:     time.Since(startTime),
				Status:      "crawling",
			})
		}

		s.logger.Debug("page crawled",
			zap.Int("page", currentPage),
			zap.Int("records", len(records)))

		if s.site.Pagination.Type == "url_param" {
			currentPage++
			nextURL := fmt.Sprintf("%s?%s=%d", s.site.URL, s.site.Pagination.PageParam, currentPage)
			err = chromedp.Run(ctx,
				chromedp.Navigate(nextURL),
				chromedp.WaitVisible(s.site.Selectors.RowSelector, chromedp.ByQuery),
				chromedp.Sleep(s.site.RateLimitDelay),
			)
			if err != nil {
				break
			}
		} else {
			var disabled bool
			chromedp.Run(ctx,
				chromedp.EvaluateAsDevTools(fmt.Sprintf(`
					(() => {
						const el = document.querySelector('%s');
						return el && el.classList.contains('%s');
					})()
				`, s.site.Pagination.NextSel, s.site.Pagination.DisabledClass), &disabled),
			)
			if disabled {
				break
			}

			err = chromedp.Run(ctx,
				chromedp.Click(s.site.Pagination.NextSel, chromedp.ByQuery, chromedp.NodeVisible),
				chromedp.WaitVisible(s.site.Selectors.RowSelector, chromedp.ByQuery),
				chromedp.Sleep(s.site.RateLimitDelay),
			)
			if err != nil {
				break
			}
			currentPage++
		}
	}

	s.logger.Info("pagination crawl complete",
		zap.String("site", s.site.Code),
		zap.Int("pages", currentPage-1),
		zap.Int64("records", totalCount),
		zap.Duration("duration", time.Since(startTime)))

	return allRecords, currentPage, totalCount, nil
}

type FormStrategy struct {
	BaseStrategy
}

func (s *FormStrategy) Execute(ctx context.Context, progressCB ProgressCallback) ([]*store.SecurityRecord, int, int64, error) {
	s.logger.Info("starting form crawl", zap.String("site", s.site.Code))
	startTime := time.Now()

	var allRecords []*store.SecurityRecord
	totalCount := int64(0)
	currentPage := 1

	err := chromedp.Run(ctx,
		chromedp.Navigate(s.site.Form.SearchURL),
		chromedp.WaitReady("body"),
		chromedp.Sleep(1*time.Second),
	)
	if err != nil {
		return nil, currentPage, totalCount, fmt.Errorf("navigate: %w", err)
	}

	for field, value := range s.site.Form.Fields {
		if err := chromedp.Run(ctx,
			chromedp.SendKeys(field, value, chromedp.ByQuery),
		); err != nil {
			s.logger.Warn("fill field failed", zap.String("field", field), zap.Error(err))
		}
	}

	err = chromedp.Run(ctx,
		chromedp.Click(s.site.Form.SubmitSel, chromedp.ByQuery, chromedp.NodeVisible),
		chromedp.WaitVisible(s.site.Form.WaitForSel, chromedp.ByQuery),
		chromedp.Sleep(s.site.Form.WaitLoadTime),
	)
	if err != nil {
		return nil, currentPage, totalCount, fmt.Errorf("submit form: %w", err)
	}

	if s.site.Form.ScrollToLoad {
		for i := 0; i < 10; i++ {
			chromedp.Run(ctx,
				chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`, nil),
				chromedp.Sleep(1*time.Second),
			)
		}
	}

	var nodes []*cdp.Node
	chromedp.Run(ctx,
		chromedp.Nodes(s.site.Selectors.RowSelector, &nodes, chromedp.ByQueryAll),
	)

	records := s.parseRecords(ctx, nodes, s.site.Name)
	allRecords = append(allRecords, records...)
	totalCount = int64(len(records))

	if progressCB != nil {
		progressCB(&CrawlProgress{
			SiteName:    s.site.Name,
			CurrentPage: currentPage,
			Fetched:     totalCount,
			Elapsed:     time.Since(startTime),
			Status:      "complete",
		})
	}

	return allRecords, currentPage, totalCount, nil
}

type DynamicTableStrategy struct {
	BaseStrategy
}

func (s *DynamicTableStrategy) Execute(ctx context.Context, progressCB ProgressCallback) ([]*store.SecurityRecord, int, int64, error) {
	s.logger.Info("starting dynamic table crawl", zap.String("site", s.site.Code))
	startTime := time.Now()

	var allRecords []*store.SecurityRecord
	totalCount := int64(0)
	currentPage := 1

	err := chromedp.Run(ctx,
		chromedp.Navigate(s.site.URL),
		chromedp.WaitVisible(s.site.Selectors.RowSelector, chromedp.ByQuery),
		chromedp.Sleep(2*time.Second),
	)
	if err != nil {
		return nil, currentPage, totalCount, fmt.Errorf("navigate: %w", err)
	}

	var rows []*cdp.Node
	chromedp.Run(ctx,
		chromedp.Nodes(s.site.Selectors.RowSelector, &rows, chromedp.ByQueryAll),
	)

	for i, row := range rows {
		rowID := row.NodeID

		err := chromedp.Run(ctx,
			chromedp.Click(s.site.Selectors.RowSelector, chromedp.ByQuery, chromedp.FromNode(row), chromedp.NodeVisible),
			chromedp.Sleep(1*time.Second),
		)
		_ = rowID
		_ = i

		if err != nil {
			s.logger.Debug("click expand failed", zap.Int("row", i), zap.Error(err))
			continue
		}

		record, err := s.parseSingleRecord(ctx, row, s.site.Name)
		if err == nil && record != nil {
			allRecords = append(allRecords, record)
			totalCount++
		}

		if progressCB != nil {
			progressCB(&CrawlProgress{
				SiteName:    s.site.Name,
				CurrentPage: currentPage,
				Fetched:     totalCount,
				Elapsed:     time.Since(startTime),
				Status:      "expanding",
			})
		}
	}

	return allRecords, currentPage, totalCount, nil
}

type PDFStrategy struct {
	BaseStrategy
}

func (s *PDFStrategy) Execute(ctx context.Context, progressCB ProgressCallback) ([]*store.SecurityRecord, int, int64, error) {
	s.logger.Info("starting PDF crawl", zap.String("site", s.site.Code))
	startTime := time.Now()

	var allRecords []*store.SecurityRecord
	totalCount := int64(0)
	currentPage := 1

	if err := os.MkdirAll(s.site.PDF.DownloadDir, 0755); err != nil {
		return nil, currentPage, totalCount, fmt.Errorf("create pdf dir: %w", err)
	}

	err := chromedp.Run(ctx,
		chromedp.Navigate(s.site.URL),
		chromedp.WaitVisible(s.site.PDF.LinkSel, chromedp.ByQuery),
	)
	if err != nil {
		return nil, currentPage, totalCount, fmt.Errorf("navigate: %w", err)
	}

	var pdfLinks []string
	var nodes []*cdp.Node
	chromedp.Run(ctx,
		chromedp.Nodes(s.site.PDF.LinkSel, &nodes, chromedp.ByQueryAll),
	)

	for _, node := range nodes {
		var href string
		chromedp.Run(ctx,
			chromedp.AttributeValue("a", "href", &href, nil, chromedp.ByQuery, chromedp.FromNode(node)),
		)
		if href != "" && (strings.HasSuffix(href, ".pdf") || strings.Contains(href, "download")) {
			pdfLinks = append(pdfLinks, href)
		}
	}

	s.logger.Info("found PDF links", zap.Int("count", len(pdfLinks)))

	for i, link := range pdfLinks {
		if !strings.HasPrefix(link, "http") {
			link = s.site.URL + link
		}

		filePath, err := s.downloadPDF(ctx, link)
		if err != nil {
			s.logger.Warn("download PDF failed", zap.String("link", link), zap.Error(err))
			continue
		}

		text, err := s.extractPDFText(filePath)
		if err != nil {
			s.logger.Warn("extract PDF text failed", zap.String("file", filePath), zap.Error(err))
			continue
		}

		record := s.parsePDFContent(text, link)
		if record != nil {
			allRecords = append(allRecords, record)
			totalCount++
		}

		if progressCB != nil {
			progressCB(&CrawlProgress{
				SiteName:    s.site.Name,
				CurrentPage: currentPage,
				Fetched:     totalCount,
				Elapsed:     time.Since(startTime),
				Status:      fmt.Sprintf("parsing PDF %d/%d", i+1, len(pdfLinks)),
			})
		}

		time.Sleep(s.site.RateLimitDelay)
	}

	return allRecords, currentPage, totalCount, nil
}

func (s *PDFStrategy) downloadPDF(ctx context.Context, url string) (string, error) {
	var downloadPath string

	client := &http.Client{Timeout: 30 * time.Second}
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

	for k, v := range s.site.CustomHeaders {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	filename := filepath.Base(url)
	if !strings.HasSuffix(filename, ".pdf") {
		filename = fmt.Sprintf("report_%d.pdf", time.Now().UnixNano())
	}
	downloadPath = filepath.Join(s.site.PDF.DownloadDir, filename)

	out, err := os.Create(downloadPath)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", fmt.Errorf("copy content: %w", err)
	}

	s.logger.Debug("PDF downloaded", zap.String("path", downloadPath))
	return downloadPath, nil
}

func (s *PDFStrategy) extractPDFText(filePath string) (string, error) {
	browser := rod.New().MustConnect()
	defer browser.MustClose()

	page := bypass.MustPage(browser)
	page.MustNavigate("file://" + filePath)
	page.MustWaitLoad()

	text := page.MustElement("body").MustText()
	return text, nil
}

func (s *PDFStrategy) parsePDFContent(text, sourceURL string) *store.SecurityRecord {
	drugPattern := regexp.MustCompile(`[\u4e00-\u9fa5A-Za-z]+(?:片|胶囊|注射液|颗粒|丸|软膏|乳膏)?`)
	severityPattern := regexp.MustCompile(`(严重|较严重|一般|轻度|中度|重度|死亡|危及生命)`)
	datePattern := regexp.MustCompile(`\d{4}[-年]\d{1,2}[-月]\d{1,2}日?`)
	reportIDPattern := regexp.MustCompile(`[A-Z]?\d{6,}[-/]?\d*`)

	var drugName, severity, dateStr, reportID string

	if match := drugPattern.FindString(text); match != "" {
		drugName = match
	}
	if match := severityPattern.FindString(text); match != "" {
		severity = match
	}
	if match := datePattern.FindString(text); match != "" {
		dateStr = match
	}
	if match := reportIDPattern.FindString(text); match != "" {
		reportID = match
	}

	summary := text
	if len(summary) > 1000 {
		summary = summary[:1000]
	}

	return &store.SecurityRecord{
		SourceAgency:  s.site.Name,
		SourceCode:    s.site.Code,
		ReportID:      reportID,
		DrugName:      drugName,
		Severity:      severity,
		PublishedDate: s.parseDate(dateStr),
		SourceURL:     sourceURL,
		Summary:       summary,
		Language:      s.site.Language,
	}
}

type AuthStrategy struct {
	BaseStrategy
}

func (s *AuthStrategy) Execute(ctx context.Context, progressCB ProgressCallback) ([]*store.SecurityRecord, int, int64, error) {
	s.logger.Info("starting auth crawl", zap.String("site", s.site.Code))
	startTime := time.Now()

	var allRecords []*store.SecurityRecord
	totalCount := int64(0)
	currentPage := 1

	err := chromedp.Run(ctx,
		network.Enable(),
		chromedp.Navigate(s.site.URL),
		chromedp.WaitVisible(s.site.Selectors.RowSelector, chromedp.ByQuery),
		chromedp.Sleep(s.site.RateLimitDelay),
	)
	if err != nil {
		return nil, currentPage, totalCount, fmt.Errorf("navigate: %w", err)
	}

	maxPages := s.site.MaxPagesPerCrawl
	if s.site.Pagination.MaxPage > 0 && s.site.Pagination.MaxPage < maxPages {
		maxPages = s.site.Pagination.MaxPage
	}

	for currentPage <= maxPages {
		var nodes []*cdp.Node
		err := chromedp.Run(ctx,
			chromedp.Nodes(s.site.Selectors.RowSelector, &nodes, chromedp.ByQueryAll),
		)
		if err != nil {
			break
		}

		records := s.parseRecords(ctx, nodes, s.site.Name)
		allRecords = append(allRecords, records...)
		totalCount += int64(len(records))

		if progressCB != nil {
			progressCB(&CrawlProgress{
				SiteName:    s.site.Name,
				CurrentPage: currentPage,
				Fetched:     totalCount,
				Elapsed:     time.Since(startTime),
				Status:      "crawling",
			})
		}

		var disabled bool
		chromedp.Run(ctx,
			chromedp.EvaluateAsDevTools(fmt.Sprintf(`
				(() => {
					const el = document.querySelector('%s');
					return !el || el.disabled || el.classList.contains('%s');
				})()
			`, s.site.Pagination.NextSel, s.site.Pagination.DisabledClass), &disabled),
		)
		if disabled {
			break
		}

		err = chromedp.Run(ctx,
			chromedp.Click(s.site.Pagination.NextSel, chromedp.ByQuery, chromedp.NodeVisible),
			chromedp.WaitVisible(s.site.Selectors.RowSelector, chromedp.ByQuery),
			chromedp.Sleep(s.site.RateLimitDelay),
		)
		if err != nil {
			break
		}
		currentPage++
	}

	return allRecords, currentPage, totalCount, nil
}

type MultilingualStrategy struct {
	BaseStrategy
}

func (s *MultilingualStrategy) Execute(ctx context.Context, progressCB ProgressCallback) ([]*store.SecurityRecord, int, int64, error) {
	s.logger.Info("starting multilingual crawl", zap.String("site", s.site.Code))
	startTime := time.Now()

	var allRecords []*store.SecurityRecord
	totalCount := int64(0)
	currentPage := 1

	languages := []string{"en", "zh", "ja"}

	for _, lang := range languages {
		s.logger.Debug("switching language", zap.String("lang", lang))

		err := chromedp.Run(ctx,
			chromedp.Navigate(s.site.URL),
			chromedp.WaitReady("body"),
		)
		if err != nil {
			continue
		}

		if s.site.Selectors.LanguageSwitcher != "" {
			langSel := fmt.Sprintf("%s [data-lang='%s']", s.site.Selectors.LanguageSwitcher, lang)
			chromedp.Run(ctx,
				chromedp.Click(langSel, chromedp.ByQuery, chromedp.NodeVisible),
				chromedp.Sleep(1*time.Second),
			)
		}

		err = chromedp.Run(ctx,
			chromedp.WaitVisible(s.site.Selectors.RowSelector, chromedp.ByQuery),
		)
		if err != nil {
			continue
		}

		var nodes []*cdp.Node
		chromedp.Run(ctx,
			chromedp.Nodes(s.site.Selectors.RowSelector, &nodes, chromedp.ByQueryAll),
		)

		for _, node := range nodes {
			record, err := s.parseSingleRecord(ctx, node, s.site.Name)
			if err == nil && record != nil {
				record.Language = lang
				allRecords = append(allRecords, record)
				totalCount++
			}
		}

		if progressCB != nil {
			progressCB(&CrawlProgress{
				SiteName:    s.site.Name,
				CurrentPage: currentPage,
				Fetched:     totalCount,
				Elapsed:     time.Since(startTime),
				Status:      fmt.Sprintf("language: %s", lang),
			})
		}
	}

	return allRecords, currentPage, totalCount, nil
}

func (b *BaseStrategy) safeParseInt(s string) int {
	s = strings.TrimSpace(s)
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return 0
}
