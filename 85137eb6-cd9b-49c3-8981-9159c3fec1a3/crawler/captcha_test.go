package crawler

import (
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
)

func TestDummySolverName(t *testing.T) {
	solver := &DummySolver{}
	if solver.Name() != "dummy" {
		t.Errorf("Expected name 'dummy', got %s", solver.Name())
	}
}

func TestDummySolverSolve(t *testing.T) {
	solver := &DummySolver{}
	req := &CaptchaRequest{
		SiteID:   "test",
		ImageURL: "http://example.com/captcha.jpg",
		Type:     CaptchaTypeImage,
	}
	resp, err := solver.Solve(req)
	if err != nil {
		t.Fatalf("DummySolver.Solve should not return error: %v", err)
	}
	if resp == nil {
		t.Fatal("Response should not be nil")
	}
	if resp.Success {
		t.Error("DummySolver should return Success=false")
	}
	if resp.Code != "" {
		t.Errorf("Expected empty code, got %q", resp.Code)
	}
}

func TestNewOCRSpaceSolver(t *testing.T) {
	solver := NewOCRSpaceSolver("test-api-key")
	if solver == nil {
		t.Fatal("Solver should not be nil")
	}
	if solver.Name() != "ocrspace" {
		t.Errorf("Expected name 'ocrspace', got %s", solver.Name())
	}
	if solver.APIKey != "test-api-key" {
		t.Errorf("Expected APIKey 'test-api-key', got %s", solver.APIKey)
	}
	if solver.APIURL == "" {
		t.Error("APIURL should not be empty")
	}
}

func TestCaptchaTypeConstants(t *testing.T) {
	tests := []struct {
		ct       CaptchaType
		expected string
	}{
		{CaptchaTypeImage, "image"},
		{CaptchaTypeSlide, "slide"},
		{CaptchaTypeClick, "click"},
		{CaptchaTypeSMS, "sms"},
		{CaptchaTypeUnknown, "unknown"},
	}
	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			if string(tt.ct) != tt.expected {
				t.Errorf("CaptchaType = %q, want %q", tt.ct, tt.expected)
			}
		})
	}
}

func TestDetectCaptchaNone(t *testing.T) {
	mgr := NewCaptchaManager()
	html := `<!DOCTYPE html><html><body><h1>正常页面</h1></body></html>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	cType, req, detected := mgr.DetectCaptcha(doc, html)
	if detected {
		t.Error("Should not detect captcha for normal page")
	}
	if cType != CaptchaTypeUnknown {
		t.Errorf("Expected unknown captcha type, got %s", cType)
	}
	if req != nil {
		t.Error("Request should be nil when no captcha detected")
	}
}

func TestDetectCaptchaFromKeyword(t *testing.T) {
	mgr := NewCaptchaManager()
	html := `<!DOCTYPE html><html><body>
		<img alt="verify" src="/captcha.jpg"/>
	</body></html>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	cType, _, detected := mgr.DetectCaptcha(doc, html)
	if !detected {
		t.Error("Should detect captcha from 'verify' keyword in img alt")
	}
	if cType != CaptchaTypeImage {
		t.Errorf("Expected image captcha type, got %s", cType)
	}
}

func TestDetectCaptchaFromImage(t *testing.T) {
	mgr := NewCaptchaManager()
	html := `<!DOCTYPE html><html><body>
		<img id="captcha_img" src="http://example.com/code.jpg"/>
	</body></html>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	cType, _, detected := mgr.DetectCaptcha(doc, html)
	if !detected {
		t.Error("Should detect captcha from captcha id")
	}
	if cType != CaptchaTypeImage {
		t.Errorf("Expected image captcha, got %s", cType)
	}
}

func TestCaptchaManagerInit(t *testing.T) {
	mgr := NewCaptchaManager()
	if mgr == nil {
		t.Fatal("CaptchaManager should not be nil")
	}
	if len(mgr.solvers) == 0 {
		t.Error("Should have at least one solver")
	}
	if mgr.cache == nil {
		t.Error("Cache should be initialized")
	}
}

type testCustomSolver struct{ name string }

func (s *testCustomSolver) Name() string { return s.name }
func (s *testCustomSolver) Solve(req *CaptchaRequest) (*CaptchaResponse, error) {
	return &CaptchaResponse{Success: false, Provider: s.name}, nil
}

func TestCaptchaManagerRegisterSolver(t *testing.T) {
	mgr := NewCaptchaManager()
	initialCount := len(mgr.solvers)

	customSolver := &testCustomSolver{name: "custom_test_solver"}
	mgr.RegisterSolver(customSolver)

	if len(mgr.solvers) != initialCount+1 {
		t.Errorf("Expected %d solvers after register, got %d", initialCount+1, len(mgr.solvers))
	}
	if _, ok := mgr.solvers["custom_test_solver"]; !ok {
		t.Error("Custom solver should be registered by name")
	}
}

func TestCaptchaManagerSolveNoImage(t *testing.T) {
	mgr := NewCaptchaManager()
	req := &CaptchaRequest{
		SiteID: "test",
		Type:   CaptchaTypeImage,
	}
	resp, err := mgr.Solve(req)
	if err != nil {
		t.Fatalf("Solve should not return error: %v", err)
	}
	if resp == nil {
		t.Fatal("Response should not be nil")
	}
	if resp.Success {
		t.Error("Should not succeed with no image data")
	}
}

func TestCaptchaRequestFields(t *testing.T) {
	req := &CaptchaRequest{
		SiteID:    "test_site",
		Type:      CaptchaTypeImage,
		ImageURL:  "http://example.com/captcha.jpg",
		ImageData: "base64_encoded_data",
		PageURL:   "http://example.com/page",
		ExtraData: map[string]string{"key": "value"},
	}
	if req.SiteID != "test_site" {
		t.Error("SiteID mismatch")
	}
	if req.Type != CaptchaTypeImage {
		t.Error("Type mismatch")
	}
	if req.ImageURL != "http://example.com/captcha.jpg" {
		t.Error("ImageURL mismatch")
	}
}

func TestCaptchaResponseFields(t *testing.T) {
	resp := &CaptchaResponse{
		Success:  true,
		Code:     "abcd1234",
		Message:  "OK",
		Provider: "dummy",
	}
	if resp.Code != "abcd1234" {
		t.Error("Code mismatch")
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
}

func TestCaptchaManagerCache(t *testing.T) {
	mgr := NewCaptchaManager()

	cacheKey := "testSite_http://example.com/captcha_cache_test.jpg"
	resp := &CaptchaResponse{
		Code:    "cached-code",
		Success: true,
	}

	mgr.cache[cacheKey] = resp

	cached, ok := mgr.cache[cacheKey]
	if !ok {
		t.Error("Should find cached response")
	}
	if cached.Code != "cached-code" {
		t.Errorf("Expected cached code, got %q", cached.Code)
	}
}

func TestMaskCode(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"ab", "**"},
		{"a", "**"},
		{"", "**"},
		{"abc", "a*c"},
		{"abcd", "a**d"},
		{"abcdef", "a****f"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := maskCode(tt.input)
			if result != tt.expected {
				t.Errorf("maskCode(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestHandleCaptchaNoCaptcha(t *testing.T) {
	mgr := NewCaptchaManager()
	html := `<!DOCTYPE html><html><body><h1>正常页面</h1></body></html>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	resp, detected := mgr.HandleCaptcha(doc, html, "http://example.com", "test")
	if detected {
		t.Error("Should not detect captcha for normal page")
	}
	if resp != nil {
		t.Error("Response should be nil when no captcha")
	}
}
