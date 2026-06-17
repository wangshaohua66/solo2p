package parser

import (
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"

	"price-monitor/config"
)

func TestParsePriceText(t *testing.T) {
	tests := []struct {
		input    string
		expected float64
	}{
		{"¥128.00", 128.00},
		{"￥99.9", 99.9},
		{"199元", 199},
		{"$29.99", 29.99},
		{"€49.90", 49.90},
		{"  88.88  ", 88.88},
		{"", 0},
		{"无货", 0},
		{"¥ 1 , 234 . 56", 1234.56},
		{"128元起", 128},
		{"促销价: ¥89.90", 89.90},
		{"原价¥198 现价¥99", 99},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := parsePriceText(tt.input)
			diff := result - tt.expected
			if diff < -0.01 || diff > 0.01 {
				t.Errorf("parsePriceText(%q) = %f, want %f", tt.input, result, tt.expected)
			}
		})
	}
}

func TestTruncateStr(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"hello", 10, "hello"},
		{"hello world", 5, "he..."},
		{"abc", 3, "abc"},
		{"abcd", 3, "abc"},
		{"", 5, ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := truncateStr(tt.input, tt.maxLen)
			if result != tt.expected {
				t.Errorf("truncateStr(%q, %d) = %q, want %q",
					tt.input, tt.maxLen, result, tt.expected)
			}
		})
	}
}

func TestExtractText(t *testing.T) {
	html := `<html><body>
		<div id="test1" content="attrValue">textValue</div>
		<div id="test2"></div>
		<div id="test3" data-price="128.50"></div>
		<div id="test4" value="valFromValue"></div>
	</body></html>`

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatalf("Failed to parse HTML: %v", err)
	}

	t.Run("text content", func(t *testing.T) {
		result := extractText(doc, "#test1")
		if result != "textValue" {
			t.Errorf("Expected textValue, got %q", result)
		}
	})

	t.Run("empty element get content attr", func(t *testing.T) {
		result := extractText(doc, "#test2")
		if result != "" {
			t.Errorf("Expected empty, got %q", result)
		}
	})

	t.Run("data-price attribute", func(t *testing.T) {
		result := extractText(doc, "#test3")
		if result != "128.50" {
			t.Errorf("Expected 128.50, got %q", result)
		}
	})

	t.Run("nonexistent selector", func(t *testing.T) {
		result := extractText(doc, "#nonexistent")
		if result != "" {
			t.Errorf("Expected empty, got %q", result)
		}
	})

	t.Run("empty selector", func(t *testing.T) {
		result := extractText(doc, "")
		if result != "" {
			t.Errorf("Expected empty for empty selector, got %q", result)
		}
	})

	t.Run("value attribute", func(t *testing.T) {
		result := extractText(doc, "#test4")
		if result != "valFromValue" {
			t.Errorf("Expected valFromValue, got %q", result)
		}
	})
}

func TestExtractTextAttrs(t *testing.T) {
	html := `<html><body>
		<div class="price-secondary">¥99</div>
		<div class="price-main">¥199</div>
	</body></html>`

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatalf("Failed to parse HTML: %v", err)
	}

	t.Run("first match", func(t *testing.T) {
		selectors := []string{".price-main", ".price-secondary", ".nonexistent"}
		result := extractTextAttrs(doc, selectors)
		if !strings.Contains(result, "199") {
			t.Errorf("Expected 199 in result, got %q", result)
		}
	})

	t.Run("second match when first missing", func(t *testing.T) {
		selectors2 := []string{".nonexistent", ".price-secondary"}
		result2 := extractTextAttrs(doc, selectors2)
		if !strings.Contains(result2, "99") {
			t.Errorf("Expected 99 in result, got %q", result2)
		}
	})

	t.Run("no match", func(t *testing.T) {
		selectors3 := []string{".missing1", ".missing2"}
		result3 := extractTextAttrs(doc, selectors3)
		if result3 != "" {
			t.Errorf("Expected empty for no match, got %q", result3)
		}
	})
}

func buildTestHTML(priceOrig, pricePromo, priceMember, title, stock string) string {
	return `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
	<div class="product">
		<h1 class="title">` + title + `</h1>
		<div class="tm-price-orig">` + priceOrig + `</div>
		<div class="tm-price">` + pricePromo + `</div>
		<div class="tm-price-vip">` + priceMember + `</div>
		<div class="tb-stock"><em>` + stock + `</em></div>
	</div>
</body>
</html>`
}

func TestParsePriceFromHTML(t *testing.T) {
	html := buildTestHTML("¥158.00", "¥99.00", "¥89.00", "测试商品奶粉", "有货")

	type S = struct {
		PriceOriginal string
		PricePromo    string
		PriceMember   string
		Title         string
		SKUId         string
		Stock         string
	}
	type SiteCfg = config.SiteConfig

	site := SiteCfg{ID: "jd"}
	site.Selectors.PriceOriginal = ".tm-price-orig"
	site.Selectors.PricePromo = ".tm-price"
	site.Selectors.PriceMember = ".tm-price-vip"
	site.Selectors.Title = ".title"
	site.Selectors.Stock = ".tb-stock em"

	data, err := ParsePriceFromHTML(html, site)
	if err != nil {
		t.Fatalf("ParsePriceFromHTML failed: %v", err)
	}
	if data == nil {
		t.Fatal("ParsedData is nil")
	}
	if !strings.Contains(data.Title, "测试商品奶粉") {
		t.Errorf("Expected title to contain '测试商品奶粉', got %q", data.Title)
	}
	if data.PriceOriginal == 0 {
		t.Error("PriceOriginal should be parsed")
	}
}

func TestParsedDataStructure(t *testing.T) {
	d := &ParsedData{
		Title:         "测试商品",
		PriceOriginal: 199.0,
		PricePromo:    128.0,
		PriceMember:   118.0,
		CouponPrice:   108.0,
		Stock:         "有货",
		SKU:           "SKU0001",
	}
	if d.Title != "测试商品" {
		t.Error("Title mismatch")
	}
	if d.Stock != "有货" {
		t.Error("Stock mismatch")
	}
	if d.PricePromo != 128.0 {
		t.Error("PricePromo mismatch")
	}
}
