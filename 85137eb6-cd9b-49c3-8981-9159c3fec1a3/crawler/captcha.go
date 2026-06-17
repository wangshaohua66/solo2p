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
	APIKey string
	APIURL string
}

func NewOCRSpaceSolver(apiKey string) *OCRSpaceSolver {
	return &OCRSpaceSolver{
		APIKey: apiKey,
		APIURL: "https://api.ocr.space/parse/image",
	}
}

func (s *OCRSpaceSolver) Name() string { return "ocrspace" }

func (s *OCRSpaceSolver) Solve(req *CaptchaRequest) (*CaptchaResponse, error) {
	if req.ImageData == "" && req.ImageURL == "" {
		return &CaptchaResponse{Success: false, Message: "no image data"}, nil
	}

	formData := url.Values{}
	formData.Set("apikey", s.APIKey)
	formData.Set("language", "eng")
	formData.Set("isOverlayRequired", "false")
	formData.Set("OCREngine", "2")

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

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ocr request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		IsErroredOnProcessing bool   `json:"IsErroredOnProcessing"`
		ErrorMessage          []string `json:"ErrorMessage"`
		ParsedResults         []struct {
			ParsedText string `json:"ParsedText"`
		} `json:"ParsedResults"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse ocr response: %w", err)
	}

	if result.IsErroredOnProcessing {
		return &CaptchaResponse{
			Success: false,
			Message: strings.Join(result.ErrorMessage, "; "),
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

	return &CaptchaResponse{Success: false, Message: "no parsed text"}, nil
}

type DummySolver struct{}

func NewDummySolver() *DummySolver { return &DummySolver{} }
func (s *DummySolver) Name() string { return "dummy" }

func (s *DummySolver) Solve(req *CaptchaRequest) (*CaptchaResponse, error) {
	logger.Warn("Captcha detected but no solver configured (site=%s type=%s)", req.SiteID, req.Type)
	return &CaptchaResponse{
		Success: false,
		Message: "captcha solver not configured",
		Provider: s.Name(),
	}, nil
}

type CaptchaManager struct {
	solvers map[string]CaptchaSolver
	cache   map[string]*CaptchaResponse
}

func NewCaptchaManager() *CaptchaManager {
	cm := &CaptchaManager{
		solvers: make(map[string]CaptchaSolver),
		cache:   make(map[string]*CaptchaResponse),
	}
	cm.RegisterSolver(NewDummySolver())
	return cm
}

func (cm *CaptchaManager) RegisterSolver(solver CaptchaSolver) {
	cm.solvers[solver.Name()] = solver
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

	for _, solver := range cm.solvers {
		resp, err := solver.Solve(req)
		if err != nil {
			logger.Warn("Captcha solver %s error: %v", solver.Name(), err)
			continue
		}
		if resp.Success && resp.Code != "" {
			cm.cache[cacheKey] = resp
			return resp, nil
		}
	}

	return &CaptchaResponse{Success: false, Message: "all solvers failed"}, nil
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
		return nil, true
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
