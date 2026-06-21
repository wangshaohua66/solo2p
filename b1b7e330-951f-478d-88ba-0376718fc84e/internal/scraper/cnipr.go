package scraper

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
	"go.uber.org/zap"

	"patent-agent/internal/config"
	"patent-agent/internal/model"
	"gorm.io/gorm"
)

type BaseScraper struct {
	SystemName string
	BaseURL    string
	LoginURL   string
	Timeout    time.Duration
	Client     *http.Client
	Cookies    []*http.Cookie
	DB         *gorm.DB
	Account    string
	mu         sync.RWMutex
	LoggedIn   bool
}

type CNIPRScraper struct {
	*BaseScraper
	endpoint config.SystemEndpoint
}

type CNIPRPatentInfo struct {
	AppNum       string `json:"appNum"`
	Title        string `json:"title"`
	PatentType   string `json:"patentType"`
	Status       string `json:"status"`
	Applicant    string `json:"applicant"`
	Inventor     string `json:"inventor"`
	FilingDate   string `json:"filingDate"`
	AgentName    string `json:"agentName"`
	CurrentStage string `json:"currentStage"`
}

func NewBaseScraper(systemName, baseURL, loginURL string, timeout int, db *gorm.DB) *BaseScraper {
	jar, _ := cookiejar.New(nil)
	return &BaseScraper{
		SystemName: systemName,
		BaseURL:    baseURL,
		LoginURL:   loginURL,
		Timeout:    time.Duration(timeout) * time.Second,
		Client: &http.Client{
			Jar:     jar,
			Timeout: time.Duration(timeout) * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				IdleConnTimeout:     90 * time.Second,
				TLSHandshakeTimeout: 10 * time.Second,
			},
		},
		DB: db,
	}
}

func (bs *BaseScraper) SaveCookies() error {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	cookieJSON, err := json.Marshal(bs.Cookies)
	if err != nil {
		return err
	}

	now := time.Now()
	expires := now.Add(24 * time.Hour)

	var session model.SessionStore
	result := bs.DB.Where("system_name = ? AND account = ?", bs.SystemName, bs.Account).First(&session)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			session = model.SessionStore{
				SystemName: bs.SystemName,
				Account:    bs.Account,
				Cookies:    string(cookieJSON),
				ExpiresAt:  &expires,
				LastActive: &now,
			}
			return bs.DB.Create(&session).Error
		}
		return result.Error
	}

	session.Cookies = string(cookieJSON)
	session.ExpiresAt = &expires
	session.LastActive = &now
	return bs.DB.Save(&session).Error
}

func (bs *BaseScraper) LoadCookies() error {
	var session model.SessionStore
	result := bs.DB.Where("system_name = ? AND account = ?", bs.SystemName, bs.Account).First(&session)
	if result.Error != nil {
		return result.Error
	}

	if session.ExpiresAt != nil && session.ExpiresAt.Before(time.Now()) {
		return errors.New("session expired")
	}

	var cookies []*http.Cookie
	if err := json.Unmarshal([]byte(session.Cookies), &cookies); err != nil {
		return err
	}

	bs.mu.Lock()
	bs.Cookies = cookies
	bs.applyCookiesToClient()
	bs.LoggedIn = true
	bs.mu.Unlock()

	return nil
}

func (bs *BaseScraper) applyCookiesToClient() {
	u, _ := http.NewRequest("GET", bs.BaseURL, nil)
	bs.Client.Jar.SetCookies(u.URL, bs.Cookies)
}

func (bs *BaseScraper) Heartbeat() error {
	if !bs.LoggedIn {
		return errors.New("not logged in")
	}

	req, err := http.NewRequest("GET", bs.BaseURL, nil)
	if err != nil {
		return err
	}
	bs.setCommonHeaders(req)

	resp, err := bs.Client.Do(req)
	if err != nil {
		bs.LoggedIn = false
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		now := time.Now()
		if bs.DB != nil {
			bs.DB.Model(&model.SessionStore{}).
				Where("system_name = ? AND account = ?", bs.SystemName, bs.Account).
				Update("last_active", &now)
		}
		return nil
	}

	bs.LoggedIn = false
	return fmt.Errorf("heartbeat failed: status=%d", resp.StatusCode)
}

func (bs *BaseScraper) setCommonHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Connection", "keep-alive")
}

func NewCNIPRScraper(cfg config.SystemEndpoint, db *gorm.DB) *CNIPRScraper {
	return &CNIPRScraper{
		BaseScraper: NewBaseScraper("cnipr", cfg.BaseURL, cfg.LoginURL, cfg.Timeout, db),
		endpoint:    cfg,
	}
}

func (s *CNIPRScraper) LoginWithQRCode(ctx context.Context) error {
	fmt.Printf("正在启动浏览器进行 %s 扫码登录...\n", s.SystemName)
	fmt.Printf("请在打开的浏览器中完成扫码认证\n")

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false),
		chromedp.Flag("disable-gpu", false),
		chromedp.WindowSize(1280, 900),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(ctx, opts...)
	defer cancel()

	browserCtx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	timeoutCtx, cancel := context.WithTimeout(browserCtx, 5*time.Minute)
	defer cancel()

	var urlAfterLogin string
	var cookies []*http.Cookie

	err := chromedp.Run(timeoutCtx,
		chromedp.Navigate(s.LoginURL),
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
			c, err := chromedp.RunResponse(ctx)
			if err != nil {
				return err
			}
			_ = c
			return nil
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var cookieList []map[string]interface{}
			if err := chromedp.Evaluate(`document.cookie`, &cookieList).Do(ctx); err != nil {
				var rawCookies string
				if err2 := chromedp.Evaluate(`document.cookie`, &rawCookies).Do(ctx); err2 == nil {
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
			}
			return nil
		}),
	)
	if err != nil {
		return fmt.Errorf("qr login failed: %w", err)
	}

	if len(cookies) == 0 {
		return errors.New("no cookies captured after login")
	}

	s.mu.Lock()
	s.Cookies = cookies
	s.applyCookiesToClient()
	s.LoggedIn = true
	s.mu.Unlock()

	if err := s.SaveCookies(); err != nil {
		config.Logger.Warn("save cookies failed", zap.Error(err))
	}

	fmt.Printf("登录成功！当前URL: %s\n", urlAfterLogin)
	return nil
}

func (s *CNIPRScraper) Login(username, password string) error {
	s.Account = username

	if err := s.LoadCookies(); err == nil {
		config.Logger.Info("loaded saved session", zap.String("system", s.SystemName))
		if err := s.Heartbeat(); err == nil {
			return nil
		}
	}

	return fmt.Errorf("cookie login failed, use QR code login instead")
}

func (s *CNIPRScraper) GetPatentStatus(appNum string) (*CNIPRPatentInfo, error) {
	if !s.LoggedIn {
		return nil, errors.New("not logged in")
	}

	url := fmt.Sprintf("%s/patentInfo?appNum=%s", s.BaseURL, appNum)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	s.setCommonHeaders(req)
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Referer", s.BaseURL+"/")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusFound {
			s.LoggedIn = false
			return nil, errors.New("session expired, please re-login")
		}
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Code int             `json:"code"`
		Data CNIPRPatentInfo `json:"data"`
		Msg  string          `json:"msg"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse response failed: %w", err)
	}

	if result.Code != 200 && result.Code != 0 {
		return nil, fmt.Errorf("api error: %s", result.Msg)
	}

	return &result.Data, nil
}

func (s *CNIPRScraper) SubmitApplication(appNum string, files []string) error {
	if !s.LoggedIn {
		return errors.New("not logged in")
	}

	for _, f := range files {
		if _, err := os.Stat(f); os.IsNotExist(err) {
			return fmt.Errorf("file not found: %s", f)
		}
	}

	config.Logger.Info("submitting application",
		zap.String("appNum", appNum),
		zap.Int("fileCount", len(files)),
	)

	return nil
}

func (s *CNIPRScraper) UploadFeeReductionCert(enterpriseID uint, certPath string) error {
	if !s.LoggedIn {
		return errors.New("not logged in")
	}

	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return fmt.Errorf("cert file not found: %s", certPath)
	}

	config.Logger.Info("uploading fee reduction cert",
		zap.Uint("enterpriseID", enterpriseID),
		zap.String("file", filepath.Base(certPath)),
	)

	return nil
}

func (s *CNIPRScraper) BatchUploadFeeReduction(enterpriseIDs []uint, certMap map[uint]string) (successCount int, failed []uint, err error) {
	for _, eid := range enterpriseIDs {
		certPath, ok := certMap[eid]
		if !ok {
			failed = append(failed, eid)
			continue
		}
		if err := s.UploadFeeReductionCert(eid, certPath); err != nil {
			failed = append(failed, eid)
			config.Logger.Warn("upload fee reduction failed",
				zap.Uint("enterpriseID", eid),
				zap.Error(err),
			)
			continue
		}
		successCount++
		time.Sleep(500 * time.Millisecond)
	}
	return successCount, failed, nil
}

func (s *CNIPRScraper) BatchSubmitApplications(appNums []string, fileMap map[string][]string, progressFn func(current, total int)) (successCount int, failed []string) {
	total := len(appNums)
	for i, appNum := range appNums {
		files, ok := fileMap[appNum]
		if !ok {
			failed = append(failed, appNum)
			if progressFn != nil {
				progressFn(i+1, total)
			}
			continue
		}
		if err := s.SubmitApplication(appNum, files); err != nil {
			failed = append(failed, appNum)
		} else {
			successCount++
		}
		if progressFn != nil {
			progressFn(i+1, total)
		}
		time.Sleep(1 * time.Second)
	}
	return successCount, failed
}
