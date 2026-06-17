package crawler

import (
	"strings"
	"testing"
	"time"

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
	if err == nil {
		t.Fatal("DummySolver.Solve should return error when no real solver configured")
	}
	if resp != nil {
		t.Error("Response should be nil when DummySolver errors")
	}
	if !strings.Contains(err.Error(), "no real solver configured") {
		t.Errorf("Error should mention 'no real solver configured', got: %v", err)
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
	if len(mgr.solvers) != 0 {
		t.Errorf("Empty manager should have 0 solvers, got %d", len(mgr.solvers))
	}
	if mgr.cache == nil {
		t.Error("Cache should be initialized")
	}
	if mgr.order == nil {
		t.Error("order should be initialized")
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
	_, err := mgr.Solve(req)
	if err == nil {
		t.Fatal("Solve should return error when no solver configured")
	}
	if !strings.Contains(err.Error(), "no solver configured") {
		t.Errorf("Error should mention 'no solver configured', got: %v", err)
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

func TestNewOCRSpaceSolverWithConfig(t *testing.T) {
	t.Run("with all params", func(t *testing.T) {
		solver := NewOCRSpaceSolverWithConfig("my-key", "https://custom.api/ocr", "chs", 60)
		if solver.APIKey != "my-key" {
			t.Errorf("APIKey mismatch: got %s", solver.APIKey)
		}
		if solver.APIURL != "https://custom.api/ocr" {
			t.Errorf("APIURL mismatch: got %s", solver.APIURL)
		}
		if solver.Language != "chs" {
			t.Errorf("Language mismatch: got %s", solver.Language)
		}
		if solver.Timeout != 60*time.Second {
			t.Errorf("Timeout mismatch: got %v", solver.Timeout)
		}
	})

	t.Run("with defaults", func(t *testing.T) {
		solver := NewOCRSpaceSolverWithConfig("key", "", "", 0)
		if solver.APIURL != "https://api.ocr.space/parse/image" {
			t.Errorf("Default APIURL mismatch: got %s", solver.APIURL)
		}
		if solver.Language != "eng" {
			t.Errorf("Default Language mismatch: got %s", solver.Language)
		}
		if solver.Timeout != 30*time.Second {
			t.Errorf("Default Timeout mismatch: got %v", solver.Timeout)
		}
	})
}

func TestNewCaptchaManagerFromConfigDisabled(t *testing.T) {
	mgr, err := NewCaptchaManagerFromConfig(CaptchaSolverCfg{
		Enabled: false,
	})
	if err != nil {
		t.Fatalf("Should not error when disabled: %v", err)
	}
	if mgr == nil {
		t.Fatal("Manager should not be nil")
	}
	if len(mgr.solvers) != 0 {
		t.Errorf("Disabled config should yield 0 solvers, got %d", len(mgr.solvers))
	}
}

func TestNewCaptchaManagerFromConfigEnabled(t *testing.T) {
	mgr, err := NewCaptchaManagerFromConfig(CaptchaSolverCfg{
		Enabled:  true,
		Provider: "ocrspace",
		APIKey:   "test-api-key",
		APIURL:   "https://api.ocr.space/parse/image",
		Language: "eng",
		Timeout:  30,
	})
	if err != nil {
		t.Fatalf("Should not error with valid config: %v", err)
	}
	if len(mgr.solvers) != 1 {
		t.Fatalf("Expected 1 solver, got %d", len(mgr.solvers))
	}
	if _, ok := mgr.solvers["ocrspace"]; !ok {
		t.Error("ocrspace solver should be registered")
	}
	if len(mgr.order) != 1 || mgr.order[0] != "ocrspace" {
		t.Errorf("order should contain ocrspace, got %v", mgr.order)
	}
}

func TestNewCaptchaManagerFromConfigNoAPIKey(t *testing.T) {
	_, err := NewCaptchaManagerFromConfig(CaptchaSolverCfg{
		Enabled:  true,
		Provider: "ocrspace",
		APIKey:   "",
	})
	if err == nil {
		t.Fatal("Should error when enabled but api_key empty")
	}
	if !strings.Contains(err.Error(), "api_key is empty") {
		t.Errorf("Error should mention api_key, got: %v", err)
	}
}

func TestNewCaptchaManagerFromConfigUnsupportedProvider(t *testing.T) {
	_, err := NewCaptchaManagerFromConfig(CaptchaSolverCfg{
		Enabled:  true,
		Provider: "unknown_provider",
		APIKey:   "some-key",
	})
	if err == nil {
		t.Fatal("Should error for unsupported provider")
	}
	if !strings.Contains(err.Error(), "unsupported captcha_solver.provider") {
		t.Errorf("Error should mention unsupported provider, got: %v", err)
	}
}

func TestSolveWithRegisteredSolver(t *testing.T) {
	mgr := NewCaptchaManager()
	mgr.RegisterSolver(&testSuccessSolver{})

	req := &CaptchaRequest{
		SiteID:   "test",
		Type:     CaptchaTypeImage,
		ImageURL: "http://example.com/captcha.jpg",
	}
	resp, err := mgr.Solve(req)
	if err != nil {
		t.Fatalf("Solve should not error with registered solver: %v", err)
	}
	if resp == nil || !resp.Success {
		t.Error("Should return successful response")
	}
	if resp.Code != "1234" {
		t.Errorf("Expected code '1234', got %q", resp.Code)
	}
}

type testSuccessSolver struct{}

func (s *testSuccessSolver) Name() string { return "test_success" }
func (s *testSuccessSolver) Solve(req *CaptchaRequest) (*CaptchaResponse, error) {
	return &CaptchaResponse{
		Success:  true,
		Code:     "1234",
		Provider: "test_success",
	}, nil
}

func TestHandleCaptchaWithCaptchaButNoSolver(t *testing.T) {
	mgr := NewCaptchaManager()
	html := `<!DOCTYPE html><html><body>
		<img id="captcha_img" src="http://example.com/code.jpg"/>
	</body></html>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	resp, detected := mgr.HandleCaptcha(doc, html, "http://example.com", "test")
	if !detected {
		t.Error("Should detect captcha")
	}
	if resp == nil {
		t.Fatal("Response should not be nil even when solve fails")
	}
	if resp.Success {
		t.Error("Should not succeed with no solver")
	}
	if !strings.Contains(resp.Message, "no solver configured") {
		t.Errorf("Response message should mention 'no solver configured', got: %s", resp.Message)
	}
}
