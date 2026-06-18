package collector

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"grain-monitor/models"
	"grain-monitor/storage"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
)

type LoginHandler struct {
	repo    *storage.Repository
	encKey  []byte
	frozenSites map[string]time.Time
}

func NewLoginHandler(repo *storage.Repository) *LoginHandler {
	return &LoginHandler{
		repo:        repo,
		encKey:      []byte("grain-monitor-key-32bytes!!!"),
		frozenSites: make(map[string]time.Time),
	}
}

var (
	ErrSiteFrozen     = errors.New("site login is frozen")
	ErrLoginFailed    = errors.New("login failed")
	ErrSessionExpired = errors.New("session expired")
)

func (lh *LoginHandler) IsSiteFrozen(siteID string) bool {
	if frozenAt, ok := lh.frozenSites[siteID]; ok {
		if time.Since(frozenAt) < 30*time.Minute {
			return true
		}
		delete(lh.frozenSites, siteID)
	}
	return false
}

func (lh *LoginHandler) freezeSite(siteID string) {
	lh.frozenSites[siteID] = time.Now()
}

func (lh *LoginHandler) EnsureLogin(ctx context.Context, site *models.SiteConfig) error {
	if !site.RequiresLogin {
		return nil
	}

	if lh.IsSiteFrozen(site.ID) {
		return ErrSiteFrozen
	}

	cookies, expiresAt, err := lh.loadCookies(site.ID)
	if err != nil {
		return fmt.Errorf("load cookies failed: %w", err)
	}

	if cookies != nil && (expiresAt == nil || expiresAt.After(time.Now())) {
		if err := lh.injectCookies(ctx, site.BaseURL, cookies); err == nil {
			if lh.checkSession(ctx, site) {
				return nil
			}
		}
	}

	return lh.performLogin(ctx, site)
}

func (lh *LoginHandler) performLogin(ctx context.Context, site *models.SiteConfig) error {
	failures, _ := lh.repo.GetRecentLoginFailures(site.ID, 24*time.Hour)
	if failures >= 3 {
		lh.freezeSite(site.ID)
		return ErrSiteFrozen
	}

	err := chromedp.Run(ctx,
		chromedp.Navigate(site.LoginURL),
		chromedp.WaitVisible(site.UsernameSelector, chromedp.ByQuery),
		chromedp.SendKeys(site.UsernameSelector, site.Username, chromedp.ByQuery),
		chromedp.SendKeys(site.PasswordSelector, site.Password, chromedp.ByQuery),
		chromedp.Click(site.SubmitSelector, chromedp.ByQuery),
		chromedp.Sleep(3*time.Second),
	)
	if err != nil {
		lh.repo.RecordLoginFailure(site.ID, err.Error())
		return fmt.Errorf("login action failed: %w", err)
	}

	if site.LoginCheckSelector != "" {
		var visible bool
		err = chromedp.Run(ctx,
			chromedp.Evaluate(fmt.Sprintf(`document.querySelector('%s') !== null`, site.LoginCheckSelector), &visible),
		)
		if err != nil || !visible {
			lh.repo.RecordLoginFailure(site.ID, "login check selector not found")
			return ErrLoginFailed
		}
	}

	cookies, err := lh.extractCookies(ctx)
	if err != nil {
		return fmt.Errorf("extract cookies failed: %w", err)
	}

	var expiresAt *time.Time
	for _, c := range cookies {
		if c.Expires > 0 {
			t := time.Unix(c.Expires, 0)
			if expiresAt == nil || t.Before(*expiresAt) {
				expiresAt = &t
			}
		}
	}

	encoded, err := lh.encodeCookies(cookies)
	if err != nil {
		return fmt.Errorf("encode cookies failed: %w", err)
	}

	if err := lh.repo.SaveSiteCookies(site.ID, encoded, expiresAt); err != nil {
		return fmt.Errorf("save cookies failed: %w", err)
	}

	lh.repo.ClearLoginFailures(site.ID)
	return nil
}

func (lh *LoginHandler) checkSession(ctx context.Context, site *models.SiteConfig) bool {
	if site.LoginCheckSelector == "" {
		return true
	}

	var visible bool
	err := chromedp.Run(ctx,
		chromedp.Navigate(site.BaseURL),
		chromedp.Sleep(2*time.Second),
		chromedp.Evaluate(fmt.Sprintf(`document.querySelector('%s') !== null`, site.LoginCheckSelector), &visible),
	)
	return err == nil && visible
}

func (lh *LoginHandler) extractCookies(ctx context.Context) ([]*network.Cookie, error) {
	var cookies []*network.Cookie
	err := chromedp.Run(ctx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			cookies, err = network.GetAllCookies().Do(ctx)
			return err
		}),
	)
	return cookies, err
}

func (lh *LoginHandler) injectCookies(ctx context.Context, baseURL string, cookies []*network.Cookie) error {
	return chromedp.Run(ctx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			for _, c := range cookies {
				expire := c.Expires
				param := network.SetCookieParams{
					Name:     c.Name,
					Value:    c.Value,
					Domain:   c.Domain,
					Path:     c.Path,
					Secure:   c.Secure,
					HTTPOnly: c.HTTPOnly,
				}
				if expire > 0 {
					param.Expires = expire
				}
				if err := param.Do(ctx); err != nil {
					return err
				}
			}
			return nil
		}),
	)
}

func (lh *LoginHandler) loadCookies(siteID string) ([]*network.Cookie, *time.Time, error) {
	data, expiresAt, err := lh.repo.GetSiteCookies(siteID)
	if err != nil {
		return nil, nil, err
	}
	if data == nil {
		return nil, nil, nil
	}

	cookies, err := lh.decodeCookies(data)
	if err != nil {
		return nil, nil, err
	}

	return cookies, expiresAt, nil
}

func (lh *LoginHandler) encodeCookies(cookies []*network.Cookie) ([]byte, error) {
	cookieData := make([]CookieData, len(cookies))
	for i, c := range cookies {
		cookieData[i] = CookieData{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Expires:  c.Expires,
			Secure:   c.Secure,
			HTTPOnly: c.HTTPOnly,
		}
	}

	jsonData, err := json.Marshal(cookieData)
	if err != nil {
		return nil, err
	}

	return lh.encrypt(jsonData)
}

func (lh *LoginHandler) decodeCookies(data []byte) ([]*network.Cookie, error) {
	jsonData, err := lh.decrypt(data)
	if err != nil {
		return nil, err
	}

	var cookieData []CookieData
	if err := json.Unmarshal(jsonData, &cookieData); err != nil {
		return nil, err
	}

	cookies := make([]*network.Cookie, len(cookieData))
	for i, cd := range cookieData {
		cookies[i] = &network.Cookie{
			Name:     cd.Name,
			Value:    cd.Value,
			Domain:   cd.Domain,
			Path:     cd.Path,
			Expires:  cd.Expires,
			Secure:   cd.Secure,
			HTTPOnly: cd.HTTPOnly,
		}
	}

	return cookies, nil
}

type CookieData struct {
	Name     string  `json:"name"`
	Value    string  `json:"value"`
	Domain   string  `json:"domain"`
	Path     string  `json:"path"`
	Expires  float64 `json:"expires"`
	Secure   bool    `json:"secure"`
	HTTPOnly bool    `json:"http_only"`
}

func (lh *LoginHandler) encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(lh.encKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

func (lh *LoginHandler) decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(lh.encKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

func init() {
	gob.Register([]*network.Cookie{})
}
