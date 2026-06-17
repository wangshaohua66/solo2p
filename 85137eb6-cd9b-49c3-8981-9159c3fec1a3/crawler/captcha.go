package crawler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	"price-monitor/logger"
)

type CaptchaType string

const (
	CaptchaTypeImage   CaptchaType = "image"
	CaptchaTypeSlide   CaptchaType = "slide"
	CaptchaTypeClick   CaptchaType = "click"
	CaptchaTypeSMS     CaptchaType = "sms"
	CaptchaTypeUnknown CaptchaType = "unknown"
)

type CaptchaRequest struct {
	SiteID     string      `json:"site_id"`
	Type       CaptchaType `json:"type"`
	ImageData  string      `json:"image_data,omitempty"`
	ImageURL   string      `json:"image_url,omitempty"`
	ExtraData  interface{} `json:"extra_data,omitempty"`
	PageHTML   string      `json:"page_html,omitempty"`
	PageURL    string      `json:"page_url,omitempty"`
}

type CaptchaResponse struct {
	Success  bool        `json:"success"`
	Code     string      `json:"code,omitempty"`
	Data     interface{} `json:"data,omitempty"`
	Message  string      `json:"message,omitempty"`
	Provider string      `json:"provider,omitempty"`
}

type CaptchaSolver interface {
	Solve(req *CaptchaRequest) (*CaptchaResponse, error)
	Name() string
}

type OCRSpaceSolver struct {
	APIKey   string
	APIURL   string
	Language string
	Timeout  time.Duration
}

func NewOCRSpaceSolver(apiKey string) *OCRSpaceSolver {
	return &OCRSpaceSolver{
		APIKey:   apiKey,
		APIURL:   "https://api.ocr.space/parse/image",
		Language: "eng",
		Timeout:  30 * time.Second,
	}
}

func NewOCRSpaceSolverWithConfig(apiKey, apiURL, language string, timeoutSec int) *OCRSpaceSolver {
	if apiURL == "" {
		apiURL = "https://api.ocr.space/parse/image"
	}
	if language == "" {
		language = "eng"
	}
	if timeoutSec <= 0 {
		timeoutSec = 30
	}
	return &OCRSpaceSolver{
		APIKey:   apiKey,
		APIURL:   apiURL,
		Language: language,
		Timeout:  time.Duration(timeoutSec) * time.Second,
	}
}

func (s *OCRSpaceSolver) Name() string { return "ocrspace" }

func (s *OCRSpaceSolver) Solve(req *CaptchaRequest) (*CaptchaResponse, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("ocrspace solver: api_key is empty")
	}
	if req.ImageData == "" && req.ImageURL == "" {
		return &CaptchaResponse{Success: false, Message: "no image data", Provider: s.Name()}, nil
	}

	formData := url.Values{}
	formData.Set("apikey", s.APIKey)
	formData.Set("language", s.Language)
	formData.Set("isOverlayRequired", "false")
	formData.Set("OCREngine", "2")
	formData.Set("scale", "true")

	if req.ImageData != "" {
		formData.Set("base64Image", "data:image/png;base64,"+req.ImageData)
	} else if req.ImageURL != "" {
		formData.Set("url", req.ImageURL)
	}

	httpReq, err := http.NewRequest("POST", s.APIURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: s.Timeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ocr request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ocrspace api returned status %d: %s", resp.StatusCode, truncateBody(body, 200))
	}

	var result struct {
		IsErroredOnProcessing bool     `json:"IsErroredOnProcessing"`
		ErrorMessage          []string `json:"ErrorMessage"`
		ParsedResults         []struct {
			ParsedText string `json:"ParsedText"`
		} `json:"ParsedResults"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse ocr response: %w (body: %s)", err, truncateBody(body, 200))
	}

	if result.IsErroredOnProcessing {
		return &CaptchaResponse{
			Success:  false,
			Message:  strings.Join(result.ErrorMessage, "; "),
			Provider: s.Name(),
		}, nil
	}

	if len(result.ParsedResults) > 0 {
		code := strings.TrimSpace(result.ParsedResults[0].ParsedText)
		code = regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(code, "")
		return &CaptchaResponse{
			Success:  len(code) > 0,
			Code:     code,
			Provider: s.Name(),
		}, nil
	}

	return &CaptchaResponse{Success: false, Message: "no parsed text", Provider: s.Name()}, nil
}

func truncateBody(b []byte, max int) string {
	if len(b) <= max {
		return string(b)
	}
	return string(b[:max]) + "..."
}

type DummySolver struct{}

func NewDummySolver() *DummySolver { return &DummySolver{} }
func (s *DummySolver) Name() string { return "dummy" }

func (s *DummySolver) Solve(req *CaptchaRequest) (*CaptchaResponse, error) {
	return nil, fmt.Errorf("captcha detected (site=%s type=%s) but no real solver configured: "+
		"set captcha_solver.enabled=true, captcha_solver.provider=ocrspace and captcha_solver.api_key in config "+
		"or CAPTCHA_SOLVER_API_KEY env var", req.SiteID, req.Type)
}

type CaptchaManager struct {
	solvers map[string]CaptchaSolver
	order   []string
	cache   map[string]*CaptchaResponse
}

func NewCaptchaManager() *CaptchaManager {
	return &CaptchaManager{
		solvers: make(map[string]CaptchaSolver),
		order:   make([]string, 0),
		cache:   make(map[string]*CaptchaResponse),
	}
}

func NewCaptchaManagerFromConfig(cfg CaptchaSolverCfg) (*CaptchaManager, error) {
	cm := NewCaptchaManager()
	if !cfg.Enabled {
		return cm, nil
	}
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("captcha_solver.enabled is true but api_key is empty")
	}

	switch strings.ToLower(cfg.Provider) {
	case "ocrspace", "":
		solver := NewOCRSpaceSolverWithConfig(cfg.APIKey, cfg.APIURL, cfg.Language, cfg.Timeout)
		cm.RegisterSolver(solver)
		logger.Info("Captcha solver registered: provider=%s", solver.Name())
	default:
		return nil, fmt.Errorf("unsupported captcha_solver.provider: %s (supported: ocrspace)", cfg.Provider)
	}
	return cm, nil
}

type CaptchaSolverCfg struct {
	Enabled  bool
	Provider string
	APIKey   string
	APIURL   string
	Language string
	Timeout  int
}

func (cm *CaptchaManager) RegisterSolver(solver CaptchaSolver) {
	name := solver.Name()
	if _, exists := cm.solvers[name]; !exists {
		cm.order = append(cm.order, name)
	}
	cm.solvers[name] = solver
}

func (cm *CaptchaManager) DetectCaptcha(doc *goquery.Document, pageHTML string) (CaptchaType, *CaptchaRequest, bool) {
	lowerHTML := strings.ToLower(pageHTML)

	detectors := []struct {
		pattern *regexp.Regexp
		cType   CaptchaType
	}{
		{regexp.MustCompile(`<img[^>]*captcha[^>]*src=["']([^"']+)["']`), CaptchaTypeImage},
		{regexp.MustCompile(`<img[^>]*verify[^>]*src=["']([^"']+)["']`), CaptchaTypeImage},
		{regexp.MustCompile(`id=["'][^"']*captcha[^"']*["']`), CaptchaTypeImage},
		{regexp.MustCompile(`slide.*captcha|captcha.*slide|geetest|nc_iconfont`), CaptchaTypeSlide},
		{regexp.MustCompile(`click.*captcha|captcha.*click`), CaptchaTypeClick},
	}

	for _, d := range detectors {
		if matches := d.pattern.FindStringSubmatch(lowerHTML); len(matches) > 0 {
			captchaReq := &CaptchaRequest{
				Type:     d.cType,
				PageHTML: pageHTML,
			}

			if d.cType == CaptchaTypeImage && len(matches) > 1 {
				captchaReq.ImageURL = matches[1]
			}

			if imgSel := doc.Find("img[src*='captcha'], img[id*='captcha'], img[class*='captcha']"); imgSel.Length() > 0 {
				if src, exists := imgSel.First().Attr("src"); exists {
					captchaReq.ImageURL = src
				}
			}

			return d.cType, captchaReq, true
		}
	}

	if doc.Find("input[name*='captcha'], input[id*='captcha']").Length() > 0 {
		return CaptchaTypeImage, &CaptchaRequest{Type: CaptchaTypeImage, PageHTML: pageHTML}, true
	}

	return CaptchaTypeUnknown, nil, false
}

func (cm *CaptchaManager) ExtractImageFromDoc(doc *goquery.Document, baseURL string) (string, error) {
	imgSel := doc.Find("img[src*='captcha'], img[id*='captcha'], img[class*='captcha'], img[src*='verify'], img[src*='ValidateCode']")
	if imgSel.Length() == 0 {
		return "", fmt.Errorf("captcha image not found")
	}

	src, exists := imgSel.First().Attr("src")
	if !exists || src == "" {
		return "", fmt.Errorf("captcha image src empty")
	}

	imgURL := src
	if !strings.HasPrefix(src, "http") {
		parsedBase, err := url.Parse(baseURL)
		if err != nil {
			return "", err
		}
		if strings.HasPrefix(src, "//") {
			imgURL = parsedBase.Scheme + ":" + src
		} else if strings.HasPrefix(src, "/") {
			imgURL = parsedBase.Scheme + "://" + parsedBase.Host + src
		} else {
			imgURL = strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(src, "/")
		}
	}

	return cm.downloadImageAsBase64(imgURL)
}

func (cm *CaptchaManager) downloadImageAsBase64(imgURL string) (string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(imgURL)
	if err != nil {
		return "", fmt.Errorf("download image: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return base64.StdEncoding.EncodeToString(data), nil
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return base64.StdEncoding.EncodeToString(data), nil
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

func (cm *CaptchaManager) Solve(req *CaptchaRequest) (*CaptchaResponse, error) {
	cacheKey := req.SiteID + "_" + req.ImageURL
	if cached, ok := cm.cache[cacheKey]; ok {
		return cached, nil
	}

	if len(cm.solvers) == 0 {
		return nil, fmt.Errorf("captcha detected (site=%s type=%s) but no solver configured: "+
			"set captcha_solver.enabled=true, captcha_solver.provider=ocrspace and captcha_solver.api_key in config "+
			"or CAPTCHA_SOLVER_API_KEY env var", req.SiteID, req.Type)
	}

	var lastErr error
	for _, name := range cm.order {
		solver := cm.solvers[name]
		resp, err := solver.Solve(req)
		if err != nil {
			logger.Warn("Captcha solver %s error: %v", solver.Name(), err)
			lastErr = err
			continue
		}
		if resp != nil && resp.Success && resp.Code != "" {
			cm.cache[cacheKey] = resp
			return resp, nil
		}
		if resp != nil {
			logger.Warn("Captcha solver %s returned no result: %s", solver.Name(), resp.Message)
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("all captcha solvers failed, last error: %w", lastErr)
	}
	return &CaptchaResponse{Success: false, Message: "all solvers returned no result"}, nil
}

func (cm *CaptchaManager) HandleCaptcha(doc *goquery.Document, pageHTML, pageURL, siteID string) (*CaptchaResponse, bool) {
	cType, req, detected := cm.DetectCaptcha(doc, pageHTML)
	if !detected {
		return nil, false
	}

	req.SiteID = siteID
	req.PageURL = pageURL

	if cType == CaptchaTypeImage && req.ImageData == "" {
		if imgData, err := cm.ExtractImageFromDoc(doc, pageURL); err == nil {
			req.ImageData = imgData
		}
	}

	resp, err := cm.Solve(req)
	if err != nil {
		logger.Error("Captcha solving error: %v", err)
		return &CaptchaResponse{
			Success: false,
			Message: err.Error(),
		}, true
	}

	if resp.Success {
		logger.Info("Captcha solved successfully (type=%s, code=%s, provider=%s)",
			cType, maskCode(resp.Code), resp.Provider)
	} else {
		logger.Warn("Captcha solving failed: %s", resp.Message)
	}

	return resp, true
}

func maskCode(code string) string {
	if len(code) <= 2 {
		return "**"
	}
	return code[:1] + strings.Repeat("*", len(code)-2) + code[len(code)-1:]
}
