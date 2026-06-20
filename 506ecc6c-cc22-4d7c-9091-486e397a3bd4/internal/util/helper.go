package util

import (
	"crypto/rand"
	"encoding/hex"
	"math"
	"time"

	"github.com/google/uuid"
)

func NewID() string {
	return uuid.New().String()
}

func RandomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func RoundFloat(val float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}

func TruncDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func GetPeriodRange(period string, ref time.Time) (time.Time, time.Time) {
	year, month, _ := ref.Date()
	loc := ref.Location()

	switch period {
	case "monthly":
		start := time.Date(year, month, 1, 0, 0, 0, 0, loc)
		end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
		return start, end
	case "quarterly":
		quarter := int(math.Floor(float64(month-1)/3))*3 + 1
		start := time.Date(year, time.Month(quarter), 1, 0, 0, 0, 0, loc)
		end := start.AddDate(0, 3, 0).Add(-time.Nanosecond)
		return start, end
	case "yearly":
		start := time.Date(year, 1, 1, 0, 0, 0, 0, loc)
		end := start.AddDate(1, 0, 0).Add(-time.Nanosecond)
		return start, end
	default:
		start := TruncDate(ref)
		end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
		return start, end
	}
}

func DaysInRange(start, end time.Time) []string {
	var days []string
	for d := TruncDate(start); !d.After(TruncDate(end)); d = d.AddDate(0, 0, 1) {
		days = append(days, d.Format("2006-01-02"))
	}
	return days
}

func ContainStr(list []string, target string) bool {
	for _, s := range list {
		if s == target {
			return true
		}
	}
	return false
}
