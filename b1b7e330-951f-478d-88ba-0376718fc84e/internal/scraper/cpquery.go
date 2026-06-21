package scraper

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
	"go.uber.org/zap"

	"patent-agent/internal/config"
	"patent-agent/internal/model"
	"gorm.io/gorm"
)

type CPQueryScraper struct {
	*BaseScraper
	endpoint config.SystemEndpoint
}

type ExaminationInfo struct {
	AppNum             string
	LegalStatus        string
	CurrentStage       string
	OfficeActions      []OfficeActionInfo
	PublicationInfo    PublicationInfo
}

type OfficeActionInfo struct {
	NotificationCode string
	NotificationType string
	NotificationDate *time.Time
	ResponseDeadline *time.Time
	DocURL           string
	Downloaded       bool
	LocalPath        string
}

type PublicationInfo struct {
	PublicationNum   string
	PublicationDate  *time.Time
	Abstract         string
}

type ParsedOfficeAction struct {
	AppNum             string
	OfficeActionType   string
	NotificationCode   string
	NotificationDate   *time.Time
	ResponseDeadline   *time.Time
	ClaimNumbers       []string
	ComparisonDocs     []string
	RawContent         string
}

func NewCPQueryScraper(cfg config.SystemEndpoint, db *gorm.DB) *CPQueryScraper {
	return &CPQueryScraper{
		BaseScraper: NewBaseScraper("cpquery", cfg.BaseURL, cfg.LoginURL, cfg.Timeout, db),
		endpoint:    cfg,
	}
}

func (s *CPQueryScraper) LoginWithQRCode(ctx context.Context) error {
	return s.BaseScraper.LoginWithQRCodeCommon(ctx, s.LoginURL, s.SystemName)
}

func (s *CPQueryScraper) Login(username, password string) error {
	s.Account = username
	if err := s.LoadCookies(); err == nil {
		config.Logger.Info("loaded saved session", zap.String("system", s.SystemName))
		if err := s.Heartbeat(); err == nil {
			return nil
		}
	}
	return fmt.Errorf("cookie login failed, use QR code login instead")
}

func (bs *BaseScraper) LoginWithQRCodeCommon(ctx context.Context, loginURL, systemName string) error {
	fmt.Printf("正在启动浏览器进行 %s 扫码登录...\n", systemName)

	opts := chromedpOptions()
	allocCtx, cancel := chromedp.NewExecAllocator(ctx, opts...)
	defer cancel()

	browserCtx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	timeoutCtx, cancel := context.WithTimeout(browserCtx, 5*time.Minute)
	defer cancel()

	var urlAfterLogin string
	var cookies []*http.Cookie

	err := chromedp.Run(timeoutCtx,
		chromedp.Navigate(loginURL),
		chromedp.WaitVisible("body"),
		chromedp.Sleep(2*time.Second),
		chromedp.ActionFunc(func(ctx context.Context) error {
			deadline := time.Now().Add(4 * time.Minute)
			for time.Now().Before(deadline) {
				var currentURL string
				if err := chromedp.Location(&currentURL).Do(ctx); err != nil {
					return err
				}
				if !strings.Contains(strings.ToLower(currentURL), "login") {
					urlAfterLogin = currentURL
					return nil
				}
				time.Sleep(1 * time.Second)
			}
			return errors.New("login timeout")
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var rawCookies string
			if err := chromedp.Evaluate(`document.cookie`, &rawCookies).Do(ctx); err == nil {
				for _, part := range strings.Split(rawCookies, ";") {
					kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
					if len(kv) == 2 {
						cookies = append(cookies, &http.Cookie{
							Name:  strings.TrimSpace(kv[0]),
							Value: strings.TrimSpace(kv[1]),
						})
					}
				}
			}
			if len(cookies) == 0 {
				return errors.New("no cookies captured")
			}
			bs.mu.Lock()
			bs.Cookies = cookies
			bs.applyCookiesToClient()
			bs.LoggedIn = true
			bs.mu.Unlock()
			return bs.SaveCookies()
		}),
	)
	if err != nil {
		return fmt.Errorf("qr login failed: %w", err)
	}

	_ = urlAfterLogin
	fmt.Printf("登录成功！\n")
	return nil
}

func chromedpOptions() []chromedp.ExecAllocatorOption {
	return append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false),
		chromedp.Flag("disable-gpu", false),
		chromedp.WindowSize(1280, 900),
	)
}

func (s *CPQueryScraper) QueryExaminationInfo(appNum string) (*ExaminationInfo, error) {
	if !s.LoggedIn {
		return nil, errors.New("not logged in")
	}

	url := fmt.Sprintf("%s/patentDetail?appNum=%s", s.BaseURL, appNum)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	s.setCommonHeaders(req)
	req.Header.Set("Referer", s.BaseURL+"/")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusFound {
			s.LoggedIn = false
			return nil, errors.New("session expired")
		}
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	return s.parseExaminationHTML(resp.Body, appNum)
}

func (s *CPQueryScraper) parseExaminationHTML(r io.Reader, appNum string) (*ExaminationInfo, error) {
	doc, err := goquery.NewDocumentFromReader(r)
	if err != nil {
		return nil, fmt.Errorf("parse html failed: %w", err)
	}

	info := &ExaminationInfo{AppNum: appNum}

	info.LegalStatus = strings.TrimSpace(doc.Find(".legal-status").Text())
	info.CurrentStage = strings.TrimSpace(doc.Find(".current-stage").Text())

	info.PublicationInfo.PublicationNum = strings.TrimSpace(doc.Find(".publication-num").Text())
	if dateStr := strings.TrimSpace(doc.Find(".publication-date").Text()); dateStr != "" {
		if t, err := parseDate(dateStr); err == nil {
			info.PublicationInfo.PublicationDate = &t
		}
	}
	info.PublicationInfo.Abstract = strings.TrimSpace(doc.Find(".abstract").Text())

	doc.Find(".office-action-list .oa-item").Each(func(i int, sel *goquery.Selection) {
		oa := OfficeActionInfo{}
		oa.NotificationCode = strings.TrimSpace(sel.Find(".notification-code").Text())
		oa.NotificationType = strings.TrimSpace(sel.Find(".notification-type").Text())

		if dateStr := strings.TrimSpace(sel.Find(".notification-date").Text()); dateStr != "" {
			if t, err := parseDate(dateStr); err == nil {
				oa.NotificationDate = &t
			}
		}
		if dateStr := strings.TrimSpace(sel.Find(".response-deadline").Text()); dateStr != "" {
			if t, err := parseDate(dateStr); err == nil {
				oa.ResponseDeadline = &t
			}
		}
		if href, exists := sel.Find("a.download-link").Attr("href"); exists {
			oa.DocURL = s.resolveURL(href)
		}
		info.OfficeActions = append(info.OfficeActions, oa)
	})

	return info, nil
}

func (s *CPQueryScraper) resolveURL(href string) string {
	if strings.HasPrefix(href, "http") {
		return href
	}
	return s.BaseURL + href
}

func (s *CPQueryScraper) DownloadOfficeActionDoc(appNum string, oa OfficeActionInfo, outputDir string) (string, error) {
	if oa.DocURL == "" {
		return "", errors.New("no doc url")
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", err
	}

	ext := ".pdf"
	if strings.Contains(oa.DocURL, ".doc") {
		ext = ".doc"
	}
	fileName := fmt.Sprintf("%s_%s%s", appNum, oa.NotificationCode, ext)
	localPath := filepath.Join(outputDir, fileName)

	if _, err := os.Stat(localPath); err == nil {
		config.Logger.Debug("file already exists", zap.String("path", localPath))
		return localPath, nil
	}

	req, err := http.NewRequest("GET", oa.DocURL, nil)
	if err != nil {
		return "", err
	}
	s.setCommonHeaders(req)

	resp, err := s.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download failed: status=%d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(localPath, data, 0644); err != nil {
		return "", err
	}

	config.Logger.Info("office action downloaded",
		zap.String("appNum", appNum),
		zap.String("file", fileName),
	)

	return localPath, nil
}

func (s *CPQueryScraper) ParseOfficeActionPDF(pdfPath string) (*ParsedOfficeAction, error) {
	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		return nil, err
	}

	data, err := os.ReadFile(pdfPath)
	if err != nil {
		return nil, err
	}

	parsed := &ParsedOfficeAction{}
	content := string(data)
	parsed.RawContent = content

	re := regexp.MustCompile(`申请号[：:]\s*([A-Z0-9]+)`)
	if matches := re.FindStringSubmatch(content); len(matches) > 1 {
		parsed.AppNum = matches[1]
	}

	oaTypes := []string{"第一次审查意见通知书", "第二次审查意见通知书", "第三次审查意见通知书", "驳回决定", "授权通知书", "视为撤回通知书"}
	for _, t := range oaTypes {
		if strings.Contains(content, t) {
			parsed.OfficeActionType = t
			break
		}
	}

	re = regexp.MustCompile(`发文序号[：:]\s*([0-9]+)`)
	if matches := re.FindStringSubmatch(content); len(matches) > 1 {
		parsed.NotificationCode = matches[1]
	}

	re = regexp.MustCompile(`发文日[：:]\s*(\d{4})[年\-](\d{1,2})[月\-](\d{1,2})`)
	if matches := re.FindStringSubmatch(content); len(matches) > 3 {
		year, _ := strconv.Atoi(matches[1])
		month, _ := strconv.Atoi(matches[2])
		day, _ := strconv.Atoi(matches[3])
		t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
		parsed.NotificationDate = &t
		if parsed.OfficeActionType != "" && strings.Contains(parsed.OfficeActionType, "审查意见") {
			deadline := t.AddDate(0, 4, 0)
			parsed.ResponseDeadline = &deadline
		}
	}

	re = regexp.MustCompile(`权利要求\s*(\d+(?:[、,，]\s*\d+)*)`)
	if matches := re.FindAllStringSubmatch(content, -1); len(matches) > 0 {
		for _, m := range matches {
			parts := regexp.MustCompile(`[、,，]`).Split(m[1], -1)
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					parsed.ClaimNumbers = appendIfMissing(parsed.ClaimNumbers, p)
				}
			}
		}
	}

	re = regexp.MustCompile(`对比文件[0-9]*[：:]\s*([^\n\r]+)`)
	if matches := re.FindAllStringSubmatch(content, -1); len(matches) > 0 {
		for _, m := range matches {
			doc := strings.TrimSpace(m[1])
			if doc != "" {
				parsed.ComparisonDocs = append(parsed.ComparisonDocs, doc)
			}
		}
	}

	return parsed, nil
}

func (s *CPQueryScraper) TrackLegalStatusChanges(appNum string, since time.Time) ([]model.ExaminationRecord, error) {
	info, err := s.QueryExaminationInfo(appNum)
	if err != nil {
		return nil, err
	}

	var records []model.ExaminationRecord
	for _, oa := range info.OfficeActions {
		if oa.NotificationDate != nil && oa.NotificationDate.After(since) {
			records = append(records, model.ExaminationRecord{
				OfficeActionType: oa.NotificationType,
				NotificationCode: oa.NotificationCode,
				NotificationDate: oa.NotificationDate,
				ResponseDeadline: oa.ResponseDeadline,
			})
		}
	}
	return records, nil
}

func parseDate(s string) (time.Time, error) {
	layouts := []string{
		"2006-01-02",
		"2006/01/02",
		"2006年01月02日",
		"2006年1月2日",
		"2006.01.02",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, strings.TrimSpace(s), time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized date format: %s", s)
}

func appendIfMissing(slice []string, item string) []string {
	for _, s := range slice {
		if s == item {
			return slice
		}
	}
	return append(slice, item)
}

var _ = json.Marshal
