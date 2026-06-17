package config

import (
	"strings"
	"testing"
)

func TestConvertCurrency(t *testing.T) {
	tests := []struct {
		name     string
		amount   float64
		from     string
		to       string
		expected float64
	}{
		{"CNY to CNY", 100.0, "CNY", "CNY", 100.0},
		{"USD to CNY", 100.0, "USD", "CNY", 724.0},
		{"EUR to CNY", 100.0, "EUR", "CNY", 786.0},
		{"JPY to CNY", 100.0, "JPY", "CNY", 4.8},
		{"HKD to CNY", 100.0, "HKD", "CNY", 93.0},
		{"Invalid currency", 100.0, "XXX", "CNY", 100.0},
		{"CNY to USD", 724.0, "CNY", "USD", 100.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ConvertCurrency(tt.amount, tt.from, tt.to)
			diff := result - tt.expected
			if diff < -0.01 || diff > 0.01 {
				t.Errorf("ConvertCurrency(%f, %s, %s) = %f, want %f",
					tt.amount, tt.from, tt.to, result, tt.expected)
			}
		})
	}
}

func TestUserAgentPool(t *testing.T) {
	if len(UserAgentPool) == 0 {
		t.Error("UserAgentPool should not be empty")
	}
	for _, ua := range UserAgentPool {
		if ua == "" {
			t.Error("User agent should not be empty")
		}
	}
}

func TestCurrencyRates(t *testing.T) {
	required := []string{"CNY", "USD", "EUR", "JPY", "HKD"}
	for _, c := range required {
		if _, ok := CurrencyRates[c]; !ok {
			t.Errorf("Currency %s not found in rates", c)
		}
	}
	if CurrencyRates["CNY"] != 1.0 {
		t.Error("CNY rate should be 1.0")
	}
}

func TestLoadConfig(t *testing.T) {
	cfg, err := Load("../config/sites.yaml")
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if cfg == nil {
		t.Fatal("Config is nil")
	}

	if cfg.Global.Concurrency <= 0 {
		t.Error("Concurrency should be positive")
	}

	if cfg.Global.Timeout <= 0 {
		t.Error("Timeout should be positive")
	}

	if len(cfg.Sites) == 0 {
		t.Error("No sites configured")
	}

	if len(cfg.SKUs) < 800 {
		t.Errorf("Expected at least 800 SKUs, got %d", len(cfg.SKUs))
	}
}

func TestGetEnabledSites(t *testing.T) {
	cfg, err := Load("../config/sites.yaml")
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	enabled := cfg.GetEnabledSites()
	if len(enabled) == 0 {
		t.Error("No enabled sites")
	}

	for _, s := range enabled {
		if !s.Enabled {
			t.Errorf("Site %s should be enabled", s.ID)
		}
	}
}

func TestGetSiteByID(t *testing.T) {
	cfg, err := Load("../config/sites.yaml")
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	tests := []string{"tmall", "jd", "suning"}
	for _, id := range tests {
		site, ok := cfg.GetSiteByID(id)
		if !ok {
			t.Errorf("Expected site %s to be found", id)
			continue
		}
		if site.ID != id {
			t.Errorf("Site ID mismatch: got %s, want %s", site.ID, id)
		}
	}

	_, ok := cfg.GetSiteByID("nonexistent")
	if ok {
		t.Error("Expected nonexistent site not to be found")
	}
}

func TestGetSKUByID(t *testing.T) {
	cfg, err := Load("../config/sites.yaml")
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	sku, ok := cfg.GetSKUByID("SKU0001")
	if !ok {
		t.Error("Expected SKU0001 to be found")
	} else if sku.SKUId != "SKU0001" {
		t.Errorf("SKU ID mismatch: got %s, want SKU0001", sku.SKUId)
	}

	_, ok = cfg.GetSKUByID("INVALID_SKU")
	if ok {
		t.Error("Expected invalid SKU not to be found")
	}
}

func TestGetSKUsByCategory(t *testing.T) {
	cfg, err := Load("../config/sites.yaml")
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	categories := []string{"纸尿裤", "奶粉", "奶瓶奶嘴"}
	for _, cat := range categories {
		skus := cfg.GetSKUsByCategory(cat)
		if len(skus) == 0 {
			t.Errorf("Expected some SKUs for category %s", cat)
			continue
		}
		for _, s := range skus {
			if !strings.EqualFold(s.Category, cat) {
				t.Errorf("SKU %s has category %s, expected %s", s.SKUId, s.Category, cat)
			}
		}
	}

	all := cfg.GetSKUsByCategory("")
	if len(all) < 800 {
		t.Errorf("Expected all SKUs when category is empty, got %d", len(all))
	}
}

func TestGetSKUsByBrand(t *testing.T) {
	cfg, err := Load("../config/sites.yaml")
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	brands := []string{"花王", "帮宝适", "贝亲"}
	for _, brand := range brands {
		skus := cfg.GetSKUsByBrand(brand)
		if len(skus) == 0 {
			t.Errorf("Expected some SKUs for brand %s", brand)
			continue
		}
		for _, s := range skus {
			if !strings.EqualFold(s.Brand, brand) {
				t.Errorf("SKU %s has brand %s, expected %s", s.SKUId, s.Brand, brand)
			}
		}
	}

	all := cfg.GetSKUsByBrand("")
	if len(all) < 800 {
		t.Errorf("Expected all SKUs when brand is empty, got %d", len(all))
	}
}

func TestCaptchaSolverConfigDefaults(t *testing.T) {
	cfg, err := Load("../config/sites.yaml")
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}
	if cfg.CaptchaSolver.Enabled {
		t.Error("Captcha solver should be disabled by default")
	}
	if cfg.CaptchaSolver.Provider != "ocrspace" {
		t.Errorf("Expected default provider ocrspace, got %s", cfg.CaptchaSolver.Provider)
	}
	if cfg.CaptchaSolver.Language != "eng" {
		t.Errorf("Expected default language eng, got %s", cfg.CaptchaSolver.Language)
	}
	if cfg.CaptchaSolver.Timeout != 30 {
		t.Errorf("Expected default timeout 30, got %d", cfg.CaptchaSolver.Timeout)
	}
}

func TestCaptchaSolverValidateEnabledNoProvider(t *testing.T) {
	t.Setenv("CAPTCHA_SOLVER_API_KEY", "")
	t.Setenv("CAPTCHA_SOLVER_PROVIDER", "")
	cfg := &AppConfig{
		Sites: []SiteConfig{{ID: "test", Enabled: true}},
	}
	cfg.CaptchaSolver.Enabled = true
	cfg.CaptchaSolver.APIKey = "some-key"
	cfg.CaptchaSolver.Provider = ""

	err := cfg.validate()
	if err == nil {
		t.Fatal("Should error when enabled but provider empty")
	}
	if !strings.Contains(err.Error(), "captcha_solver.provider is empty") {
		t.Errorf("Error should mention provider, got: %v", err)
	}
}

func TestCaptchaSolverValidateEnabledNoAPIKey(t *testing.T) {
	t.Setenv("CAPTCHA_SOLVER_API_KEY", "")
	t.Setenv("CAPTCHA_SOLVER_PROVIDER", "")
	cfg := &AppConfig{
		Sites: []SiteConfig{{ID: "test", Enabled: true}},
	}
	cfg.CaptchaSolver.Enabled = true
	cfg.CaptchaSolver.Provider = "ocrspace"
	cfg.CaptchaSolver.APIKey = ""

	err := cfg.validate()
	if err == nil {
		t.Fatal("Should error when enabled but api_key empty")
	}
	if !strings.Contains(err.Error(), "captcha_solver.api_key is empty") {
		t.Errorf("Error should mention api_key, got: %v", err)
	}
}

func TestCaptchaSolverValidateEnvVarOverride(t *testing.T) {
	t.Setenv("CAPTCHA_SOLVER_API_KEY", "env-key")
	t.Setenv("CAPTCHA_SOLVER_PROVIDER", "ocrspace")

	cfg := &AppConfig{
		Sites: []SiteConfig{{ID: "test", Enabled: true}},
	}
	cfg.CaptchaSolver.Enabled = true
	cfg.CaptchaSolver.Provider = "ocrspace"
	cfg.CaptchaSolver.APIKey = ""

	err := cfg.validate()
	if err != nil {
		t.Fatalf("Should not error when env var provides api_key: %v", err)
	}
	if cfg.CaptchaSolver.APIKey != "env-key" {
		t.Errorf("APIKey should be overridden by env var, got %s", cfg.CaptchaSolver.APIKey)
	}
}

func TestCaptchaSolverValidateDisabledNoError(t *testing.T) {
	cfg := &AppConfig{
		Sites: []SiteConfig{{ID: "test", Enabled: true}},
	}
	cfg.CaptchaSolver.Enabled = false
	cfg.CaptchaSolver.APIKey = ""
	cfg.CaptchaSolver.Provider = ""

	err := cfg.validate()
	if err != nil {
		t.Fatalf("Should not error when disabled: %v", err)
	}
}
