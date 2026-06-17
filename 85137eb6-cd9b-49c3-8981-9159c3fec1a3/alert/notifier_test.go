package alert

import (
	"strings"
	"testing"

	"price-monitor/config"
	"price-monitor/storage"
)

func TestContainsAny(t *testing.T) {
	tests := []struct {
		s        string
		keywords []string
		expected bool
	}{
		{"现货100件", []string{"现货", "有货"}, true},
		{"无货中", []string{"无货", "缺货"}, true},
		{"正常销售", []string{"无货", "缺货"}, false},
		{"", []string{"test"}, false},
		{"anything", []string{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.s, func(t *testing.T) {
			result := containsAny(tt.s, tt.keywords)
			if result != tt.expected {
				t.Errorf("containsAny(%q, %v) = %v, want %v",
					tt.s, tt.keywords, result, tt.expected)
			}
		})
	}
}

func TestAlertTypeConstants(t *testing.T) {
	tests := []struct {
		at       AlertType
		expected string
	}{
		{AlertTypePriceDrop, "PRICE_DROP"},
		{AlertTypePriceRise, "PRICE_RISE"},
		{AlertTypeStockChange, "STOCK_CHANGE"},
		{AlertTypeFlashSale, "FLASH_SALE"},
		{AlertTypeBelowRef, "BELOW_REFERENCE"},
	}

	for _, tt := range tests {
		t.Run(string(tt.at), func(t *testing.T) {
			if string(tt.at) != tt.expected {
				t.Errorf("AlertType = %q, want %q", tt.at, tt.expected)
			}
		})
	}
}

func TestNewNotifier(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Alert.Enabled = true
	cfg.Alert.Mode = "continuous"
	db := &storage.Database{}

	n := NewNotifier(cfg, db)
	if n == nil {
		t.Fatal("NewNotifier should not return nil")
	}
	if n.cfg == nil {
		t.Error("cfg should be set")
	}
	if n.db == nil {
		t.Error("db should be set")
	}
	if n.lastAlert == nil {
		t.Error("lastAlert map should be initialized")
	}
	if n.alertMu == nil {
		t.Error("alertMu map should be initialized")
	}
}

func TestIsStockChanged(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Alert.Enabled = true
	cfg.Alert.Mode = "continuous"
	n := NewNotifier(cfg, nil)

	tests := []struct {
		oldStock string
		newStock string
		expected bool
	}{
		{"现货100件", "无货", true},
		{"有货", "现货50件", false},
		{"无货", "有货", true},
		{"无货", "缺货", false},
		{"有货", "有货", false},
		{"", "现货200件", false},
		{"现货200件", "现货50件", true},
		{"现货100件", "现货100件", false},
		{"有货", "无货", true},
		{"有货", "", false},
		{"", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.oldStock+"->"+tt.newStock, func(t *testing.T) {
			result := n.isStockChanged(tt.oldStock, tt.newStock)
			if result != tt.expected {
				t.Errorf("isStockChanged(%q, %q) = %v, want %v",
					tt.oldStock, tt.newStock, result, tt.expected)
			}
		})
	}
}

func TestBuildEvent(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Alert.Enabled = true
	cfg.Alert.Mode = "continuous"
	n := NewNotifier(cfg, nil)

	oldRec := &storage.PriceRecord{
		SKUId:      "SKU0001",
		SKUName:    "测试商品",
		Brand:      "花王",
		Category:   "纸尿裤",
		SiteId:     "tmall",
		SiteName:   "天猫",
		PriceFinal: 199.0,
		Stock:      "有货",
		URL:        "http://example.com/item",
	}

	newRec := &storage.PriceRecord{
		SKUId:      "SKU0001",
		SKUName:    "测试商品",
		Brand:      "花王",
		Category:   "纸尿裤",
		SiteId:     "tmall",
		SiteName:   "天猫",
		PriceFinal: 128.0,
		Stock:      "现货50件",
		URL:        "http://example.com/item",
	}

	tests := []struct {
		alertType AlertType
		refPrice  float64
		checks    []string
	}{
		{AlertTypePriceDrop, 0, []string{"降价", "测试商品", "天猫"}},
		{AlertTypePriceRise, 0, []string{"涨价", "测试商品", "天猫"}},
		{AlertTypeStockChange, 0, []string{"库存", "测试商品"}},
		{AlertTypeBelowRef, 200.0, []string{"参考价", "测试商品"}},
		{AlertTypeFlashSale, 0, []string{"秒杀", "测试商品"}},
	}

	for _, tc := range tests {
		t.Run(string(tc.alertType), func(t *testing.T) {
			event := n.buildEvent(tc.alertType, oldRec, newRec, -0.3567, tc.refPrice)
			if event == nil {
				t.Fatal("Event is nil")
			}
			if event.SKUId != "SKU0001" {
				t.Errorf("Expected SKU0001, got %s", event.SKUId)
			}
			if event.SiteId != "tmall" {
				t.Errorf("Expected tmall, got %s", event.SiteId)
			}
			if event.Type != tc.alertType {
				t.Errorf("Expected type %s, got %s", tc.alertType, event.Type)
			}
			if event.PriceBefore != 199.0 {
				t.Errorf("Expected PriceBefore 199.0, got %f", event.PriceBefore)
			}
			if event.PriceAfter != 128.0 {
				t.Errorf("Expected PriceAfter 128.0, got %f", event.PriceAfter)
			}
			for _, check := range tc.checks {
				if !strings.Contains(event.Message, check) {
					t.Errorf("Message should contain %q, got %q", check, event.Message)
				}
			}
		})
	}
}

func TestBuildEventStockFields(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Alert.Enabled = true
	cfg.Alert.Mode = "continuous"
	n := NewNotifier(cfg, nil)

	oldRec := &storage.PriceRecord{
		SKUId:    "SKU0001",
		SKUName:  "测试",
		SiteId:   "test",
		SiteName: "测试",
		Stock:    "有货",
		URL:      "http://example.com",
	}
	newRec := &storage.PriceRecord{
		SKUId:    "SKU0001",
		SKUName:  "测试",
		SiteId:   "test",
		SiteName: "测试",
		Stock:    "无货",
		URL:      "http://example.com",
	}

	event := n.buildEvent(AlertTypeStockChange, oldRec, newRec, 0, 0)
	if event.StockBefore != "有货" {
		t.Errorf("StockBefore: got %q, want %q", event.StockBefore, "有货")
	}
	if event.StockAfter != "无货" {
		t.Errorf("StockAfter: got %q, want %q", event.StockAfter, "无货")
	}
}

func TestAlertEventTimestamp(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Alert.Enabled = true
	cfg.Alert.Mode = "continuous"
	n := NewNotifier(cfg, nil)

	oldRec := &storage.PriceRecord{
		SKUId:    "SKU0001",
		SKUName:  "测试",
		SiteId:   "test",
		SiteName: "测试",
		URL:      "http://example.com",
	}
	newRec := &storage.PriceRecord{
		SKUId:    "SKU0001",
		SKUName:  "测试",
		SiteId:   "test",
		SiteName: "测试",
		URL:      "http://example.com",
	}

	event := n.buildEvent(AlertTypePriceDrop, oldRec, newRec, -0.1, 0)
	if event.OccurredAt.IsZero() {
		t.Error("OccurredAt should not be zero time")
	}
}

func TestShouldSendAlertContinuous(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Alert.Enabled = true
	cfg.Alert.Mode = "continuous"
	n := NewNotifier(cfg, nil)

	key := "test_key"
	if !n.shouldSendAlert(key) {
		t.Error("First alert should be sent")
	}
	if n.shouldSendAlert(key) {
		t.Error("Continuous mode should throttle (30min cooldown)")
	}

	key2 := "different_key"
	if !n.shouldSendAlert(key2) {
		t.Error("Different key should still allow alert")
	}
}

func TestShouldSendAlertSingle(t *testing.T) {
	cfg := &config.AppConfig{}
	cfg.Alert.Enabled = true
	cfg.Alert.Mode = "single"
	n := NewNotifier(cfg, nil)

	key := "single_key"
	if !n.shouldSendAlert(key) {
		t.Error("First alert should be sent in single mode")
	}
	if n.shouldSendAlert(key) {
		t.Error("Second alert should NOT be sent in single mode")
	}
}
