package utils

import (
	"fmt"
	"math/rand"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

var validInstitutionCodeRegex = regexp.MustCompile(`^[A-Z0-9]{6}$`)

func IsValidInstitutionCode(code string) bool {
	return validInstitutionCodeRegex.MatchString(code)
}

func GenerateTraceID() string {
	return strings.ReplaceAll(uuid.New().String(), "-", "")
}

func GenerateBarcode(institutionCode string, seq int64) string {
	date := time.Now().Format("20060102")
	return fmt.Sprintf("%s%s%06d", date, institutionCode, seq)
}

func GenerateReportNo() string {
	date := time.Now().Format("20060102150405")
	return fmt.Sprintf("R%s%04d", date, rand.Intn(10000))
}

func GenerateSettlementNo() string {
	date := time.Now().Format("200601")
	return fmt.Sprintf("S%s%s", date, generateRandomString(6))
}

func generateRandomString(n int) string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func ParseBarcode(barcode string) (time.Time, string, int, error) {
	if len(barcode) != 8+6+6 {
		return time.Time{}, "", 0, fmt.Errorf("条码长度不合法")
	}
	dateStr := barcode[:8]
	instCode := barcode[8:14]
	seqStr := barcode[14:]

	if !IsValidInstitutionCode(instCode) {
		return time.Time{}, "", 0, fmt.Errorf("机构码格式不合法(需6位大写字母或数字)")
	}

	t, err := time.Parse("20060102", dateStr)
	if err != nil {
		return time.Time{}, "", 0, fmt.Errorf("日期解析失败: %v", err)
	}
	seq, err := strconv.Atoi(seqStr)
	if err != nil {
		return time.Time{}, "", 0, fmt.Errorf("流水号解析失败: %v", err)
	}
	return t, instCode, seq, nil
}

func GetBeforeDays(days int) time.Time {
	return time.Now().AddDate(0, 0, -days)
}

func GetMonthRange(year, month int) (time.Time, time.Time) {
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	return start, end
}

func ContainsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func IsValidCollectTime(collectTime time.Time) bool {
	return collectTime.Before(time.Now()) && collectTime.After(GetBeforeDays(30))
}

func FormatDecimal(amount float64, places int) float64 {
	format := fmt.Sprintf("%%.%df", places)
	result, _ := strconv.ParseFloat(fmt.Sprintf(format, amount), 64)
	return result
}
