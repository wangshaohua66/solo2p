package crawler

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"go.uber.org/zap"

	"drugvigil/config"
)

type CookieData struct {
	Cookies   []*network.CookieParam `json:"cookies"`
	SavedAt   time.Time              `json:"saved_at"`
	ExpiresAt time.Time              `json:"expires_at"`
}

type AuthManager struct {
	logger *zap.Logger
	cfg    *config.Config
}

func NewAuthManager(cfg *config.Config, logger *zap.Logger) *AuthManager {
	return &AuthManager{
		logger: logger,
		cfg:    cfg,
	}
}

func (am *AuthManager) Login(ctx context.Context, site *config.SiteConfig) error {
	if !site.Auth.Required {
		return nil
	}

	am.logger.Info("attempting login", zap.String("site", site.Code))

	if am.HasValidCookies(site) {
		am.logger.Info("using cached cookies", zap.String("site", site.Code))
		return nil
	}

	err := chromedp.Run(ctx,
		chromedp.Navigate(site.Auth.LoginURL),
		chromedp.WaitVisible(site.Auth.UsernameSel, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
		chromedp.SendKeys(site.Auth.UsernameSel, site.Auth.Username, chromedp.ByQuery),
		chromedp.SendKeys(site.Auth.PasswordSel, site.Auth.Password, chromedp.ByQuery),
	)
	if err != nil {
		return fmt.Errorf("fill login form: %w", err)
	}

	for field, value := range site.Auth.ExtraFields {
		if err := chromedp.Run(ctx,
			chromedp.SendKeys(field, value, chromedp.ByQuery),
		); err != nil {
			am.logger.Warn("fill extra field failed", zap.String("field", field), zap.Error(err))
		}
	}

	err = chromedp.Run(ctx,
		chromedp.Click(site.Auth.SubmitSel, chromedp.ByQuery),
		chromedp.WaitVisible(site.Auth.CheckSel, chromedp.ByQuery),
		chromedp.Sleep(2*time.Second),
	)
	if err != nil {
		return fmt.Errorf("submit login: %w", err)
	}

	if err := am.SaveCookies(ctx, site); err != nil {
		am.logger.Warn("save cookies failed", zap.Error(err))
	}

	am.logger.Info("login successful", zap.String("site", site.Code))
	return nil
}

func (am *AuthManager) HasValidCookies(site *config.SiteConfig) bool {
	data, err := am.LoadCookies(site)
	if err != nil {
		return false
	}
	return time.Now().Before(data.ExpiresAt)
}

func (am *AuthManager) LoadCookies(site *config.SiteConfig) (*CookieData, error) {
	path := site.Auth.CookieFile
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("cookie file not found: %s", path)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read cookie file: %w", err)
	}

	var cd CookieData
	if err := json.Unmarshal(data, &cd); err != nil {
		return nil, fmt.Errorf("parse cookies: %w", err)
	}

	return &cd, nil
}

func (am *AuthManager) SaveCookies(ctx context.Context, site *config.SiteConfig) error {
	var c []*network.Cookie
	err := chromedp.Run(ctx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			c, err = network.GetCookies().Do(ctx)
			return err
		}),
	)
	if err != nil {
		return fmt.Errorf("get cookies: %w", err)
	}

	var cookies []*network.CookieParam
	for _, cookie := range c {
		param := &network.CookieParam{
			Name:     cookie.Name,
			Value:    cookie.Value,
			Domain:   cookie.Domain,
			Path:     cookie.Path,
			Secure:   cookie.Secure,
			HTTPOnly: cookie.HTTPOnly,
		}
		cookies = append(cookies, param)
	}

	cd := &CookieData{
		Cookies:   cookies,
		SavedAt:   time.Now(),
		ExpiresAt: time.Now().Add(site.Auth.SessionTimeout),
	}

	path := site.Auth.CookieFile
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create cookie dir: %w", err)
	}

	data, err := json.MarshalIndent(cd, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal cookies: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("write cookie file: %w", err)
	}

	am.logger.Info("cookies saved", zap.String("site", site.Code), zap.Int("count", len(cookies)))
	return nil
}

func (am *AuthManager) InjectCookies(ctx context.Context, site *config.SiteConfig) error {
	if !site.Auth.Required {
		return nil
	}

	data, err := am.LoadCookies(site)
	if err != nil {
		am.logger.Debug("no cached cookies, need login", zap.String("site", site.Code))
		return am.Login(ctx, site)
	}

	if time.Now().After(data.ExpiresAt) {
		am.logger.Info("cookies expired, re-login", zap.String("site", site.Code))
		return am.Login(ctx, site)
	}

	am.logger.Debug("injecting cookies", zap.String("site", site.Code), zap.Int("count", len(data.Cookies)))

	for _, cookie := range data.Cookies {
		err := chromedp.Run(ctx, network.SetCookie(cookie.Name, cookie.Value).
			WithDomain(cookie.Domain).
			WithPath(cookie.Path).
			WithSecure(cookie.Secure).
			WithHTTPOnly(cookie.HTTPOnly),
		)
		if err != nil {
			am.logger.Warn("set cookie failed", zap.String("name", cookie.Name), zap.Error(err))
		}
	}

	return nil
}

func (am *AuthManager) CheckSession(ctx context.Context, site *config.SiteConfig) bool {
	if !site.Auth.Required {
		return true
	}

	if site.Auth.CheckSel == "" {
		return true
	}

	var visible bool
	err := chromedp.Run(ctx,
		chromedp.EvaluateAsDevTools(fmt.Sprintf(`
			(() => {
				const el = document.querySelector('%s');
				return el !== null && el.offsetParent !== null;
			})()
		`, site.Auth.CheckSel), &visible),
	)
	if err != nil {
		am.logger.Debug("session check failed", zap.Error(err))
		return false
	}

	return visible
}

func (am *AuthManager) RefreshSession(ctx context.Context, site *config.SiteConfig) error {
	am.logger.Info("refreshing session", zap.String("site", site.Code))
	if err := am.ClearCookies(ctx, site); err != nil {
		am.logger.Warn("clear cookies failed", zap.Error(err))
	}
	return am.Login(ctx, site)
}

func (am *AuthManager) ClearCookies(ctx context.Context, site *config.SiteConfig) error {
	err := chromedp.Run(ctx, network.ClearBrowserCookies())
	if err != nil {
		return fmt.Errorf("clear browser cookies: %w", err)
	}

	path := site.Auth.CookieFile
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove cookie file: %w", err)
	}

	return nil
}

func (am *AuthManager) InitCookies(site *config.SiteConfig) error {
	if !site.Auth.Required {
		return nil
	}

	path := site.Auth.CookieFile
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create cookie dir: %w", err)
	}

	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		empty := &CookieData{
			Cookies:   []*network.CookieParam{},
			SavedAt:   time.Time{},
			ExpiresAt: time.Time{},
		}
		data, _ := json.MarshalIndent(empty, "", "  ")
		return os.WriteFile(path, data, 0600)
	}
	return nil
}
