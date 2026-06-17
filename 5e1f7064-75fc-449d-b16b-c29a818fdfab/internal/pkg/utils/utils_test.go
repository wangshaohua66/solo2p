package utils

import (
	"os"
	"strings"
	"testing"
	"time"
)

func TestIsValidInstitutionCode(t *testing.T) {
	tests := []struct {
		name  string
		code  string
		want  bool
	}{
		{"valid 6 uppercase alphanumeric", "ABC123", true},
		{"valid 6 all digits", "123456", true},
		{"valid 6 all letters", "ABCDEF", true},
		{"invalid lowercase", "abc123", false},
		{"invalid 5 chars", "ABC12", false},
		{"invalid 7 chars", "ABC1234", false},
		{"invalid contains special", "AB-123", false},
		{"invalid chinese chars", "机构123", false},
		{"invalid empty", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidInstitutionCode(tt.code); got != tt.want {
				t.Errorf("IsValidInstitutionCode(%q) = %v, want %v", tt.code, got, tt.want)
			}
		})
	}
}

func TestGenerateBarcode(t *testing.T) {
	code := GenerateBarcode("ABC123", 1)
	if len(code) != 20 {
		t.Errorf("barcode length = %d, want 20", len(code))
	}
	expectedDate := time.Now().Format("20060102")
	if !strings.HasPrefix(code, expectedDate) {
		t.Errorf("barcode should start with date %s, got %s", expectedDate, code[:8])
	}
	if code[8:14] != "ABC123" {
		t.Errorf("barcode institution part = %s, want ABC123", code[8:14])
	}
	if code[14:] != "000001" {
		t.Errorf("barcode seq part = %s, want 000001", code[14:])
	}
}

func TestGenerateBarcodeInvalidInstitution(t *testing.T) {
	if !IsValidInstitutionCode("ABC123") {
		t.Error("ABC123 should be valid")
	}
	if IsValidInstitutionCode("abc123") {
		t.Error("abc123 should be invalid (lowercase)")
	}
}

func TestParseBarcode(t *testing.T) {
	code := GenerateBarcode("ABC123", 42)
	date, inst, seq, err := ParseBarcode(code)
	if err != nil {
		t.Fatalf("ParseBarcode failed: %v", err)
	}
	if date.IsZero() {
		t.Error("date should not be zero")
	}
	if inst != "ABC123" {
		t.Errorf("institution = %s, want ABC123", inst)
	}
	if seq != 42 {
		t.Errorf("seq = %d, want 42", seq)
	}
}

func TestParseBarcodeInvalid(t *testing.T) {
	_, _, _, err := ParseBarcode("short")
	if err == nil {
		t.Error("ParseBarcode with short string should fail")
	}
	_, _, _, err = ParseBarcode("20240101abc123000001")
	if err == nil {
		t.Error("ParseBarcode with lowercase institution should fail")
	}
}

func TestRSASignAndVerify(t *testing.T) {
	content := "test content for rsa signature 中文测试 12345"
	sig, err := RSASign(content)
	if err != nil {
		t.Fatalf("RSASign failed: %v", err)
	}
	if sig == "" {
		t.Fatal("RSASign returned empty signature")
	}
	ok, err := RSAVerify(content, sig)
	if err != nil {
		t.Fatalf("RSAVerify failed: %v", err)
	}
	if !ok {
		t.Error("RSAVerify should pass for valid signature")
	}
}

func TestRSAVerifyTampered(t *testing.T) {
	content := "original content"
	sig, _ := RSASign(content)
	ok, err := RSAVerify("tampered content", sig)
	if err != nil {
		t.Fatalf("RSAVerify failed: %v", err)
	}
	if ok {
		t.Error("RSAVerify should fail for tampered content")
	}
}

func TestGenerateReportSignature(t *testing.T) {
	signContent, sig, err := GenerateReportSignature("RPT202401010001", 123, time.Now())
	if err != nil {
		t.Fatalf("GenerateReportSignature failed: %v", err)
	}
	if !strings.Contains(signContent, "RPT202401010001") {
		t.Errorf("signContent should contain report no, got %s", signContent)
	}
	if !strings.Contains(signContent, "123") {
		t.Errorf("signContent should contain sample id, got %s", signContent)
	}
	ok, err := RSAVerify(signContent, sig)
	if err != nil {
		t.Fatalf("RSAVerify failed: %v", err)
	}
	if !ok {
		t.Error("report signature should verify")
	}
}

func TestGeneratePDF(t *testing.T) {
	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir("../../..")

	if _, err := os.Stat(fontDir + "NotoSansSC-Regular.ttf"); os.IsNotExist(err) {
		t.Skip("中文字体文件不存在，跳过PDF测试")
	}
	if _, err := os.Stat(fontDir + "NotoSansSC-Bold.ttf"); os.IsNotExist(err) {
		t.Skip("中文字体Bold文件不存在，跳过PDF测试")
	}
	data := &ReportData{
		ReportNo:    "RPT202401010001",
		Barcode:     "20240101ABC123000001",
		PatientName: "张三",
		PatientID:   "P001",
		Gender:      "男",
		Age:         35,
		Institution: "XX社区卫生服务中心",
		Doctor:      "李医生",
		Reviewer:    "王主任",
		CollectTime: time.Now(),
		ReportTime:  time.Now(),
		SignContent: "test-sign-content",
		Signature:   "test-signature",
		Items: []ReportItemData{
			{
				ItemName:     "血常规-白细胞",
				ItemCode:     "WBC",
				Result:       "12.5",
				Unit:         "10^9/L",
				RefRange:     "4.0-10.0",
				IsCritical:   true,
				IsAbnormal:   true,
				AbnormalFlag: "↑",
			},
			{
				ItemName:     "血常规-红细胞",
				ItemCode:     "RBC",
				Result:       "4.8",
				Unit:         "10^12/L",
				RefRange:     "4.0-5.5",
				IsCritical:   false,
				IsAbnormal:   false,
				AbnormalFlag: "",
			},
		},
	}
	buf, err := GenerateReportPDF(data)
	if err != nil {
		t.Fatalf("GenerateReportPDF failed: %v", err)
	}
	if len(buf) == 0 {
		t.Error("GenerateReportPDF returned empty buffer")
	}
}
