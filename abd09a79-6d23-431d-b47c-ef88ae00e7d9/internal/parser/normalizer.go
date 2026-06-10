package parser

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"bankrupt-monitor/internal/model"
)

var (
	caseNumberRegex = regexp.MustCompile(`[（(]\s*(\d{4})\s*[)）]\s*([\p{Han}0-9A-Za-z]+)\s*(破|清|民|商|执|金)\s*字?\s*第?\s*(\d+)\s*号?`)
	caseNumberRegex2 = regexp.MustCompile(`(\d{4})[-—_]([\p{Han}0-9A-Za-z]+)[-—_](破|清|民|商|执)[-—_](\d+)`)
	dateRegexes     = []*regexp.Regexp{
		regexp.MustCompile(`(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日`),
		regexp.MustCompile(`(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})`),
	}
	debtorSuffixRegex = regexp.MustCompile(`(股份有限公司|有限责任公司|有限公司|集团公司|集团|公司|厂|矿|院|所|中心|宾馆|酒店|商城|超市|合作社)$`)
	spaceRegex        = regexp.MustCompile(`\s+`)
	punctRegex        = regexp.MustCompile(`[，。！？、；：""''（）\[\]【】《》,.!?;:"'()\[\]<>]+`)
)

func NormalizeCaseNumber(raw string) string {
	if raw == "" {
		return ""
	}

	s := strings.TrimSpace(raw)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "\u3000", "")

	if m := caseNumberRegex.FindStringSubmatch(s); m != nil {
		return fmt.Sprintf("%s-%s-%s-%s", m[1], m[2], m[3], m[4])
	}
	if m := caseNumberRegex2.FindStringSubmatch(s); m != nil {
		return fmt.Sprintf("%s-%s-%s-%s", m[1], m[2], m[3], m[4])
	}

	return s
}

func NormalizeDebtor(raw string) string {
	if raw == "" {
		return ""
	}

	s := strings.TrimSpace(raw)
	s = spaceRegex.ReplaceAllString(s, "")
	s = punctRegex.ReplaceAllString(s, "")
	s = strings.ToUpper(s)

	s = strings.TrimSuffix(s, "破产管理人")
	s = strings.TrimSuffix(s, "管理人")

	s = debtorSuffixRegex.ReplaceAllString(s, "")

	return strings.TrimSpace(s)
}

func DebtorFingerprint(normalized string) string {
	s := strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || unicode.IsPunct(r) {
			return -1
		}
		return unicode.ToUpper(r)
	}, normalized)
	h := sha1.Sum([]byte(s))
	return hex.EncodeToString(h[:])
}

func ParseDate(raw string) *time.Time {
	if raw == "" {
		return nil
	}
	s := strings.TrimSpace(raw)

	for _, re := range dateRegexes {
		if m := re.FindStringSubmatch(s); m != nil {
			year := atoi(m[1])
			month := atoi(m[2])
			day := atoi(m[3])
			if year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31 {
				t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
				return &t
			}
		}
	}

	layouts := []string{
		"2006年01月02日",
		"2006年1月2日",
		"2006-01-02",
		"2006/01/02",
		"2006.01.02",
		"2006-1-2",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return &t
		}
	}
	return nil
}

func DetectAnnouncementType(title, content string) model.AnnouncementType {
	text := strings.ToLower(title + " " + content)

	switch {
	case strings.Contains(text, "重整") || strings.Contains(text, "重组") || strings.Contains(text, "破产重整"):
		return model.TypeReorganization
	case strings.Contains(text, "清算") || strings.Contains(text, "破产清算") || strings.Contains(text, "宣告破产"):
		return model.TypeLiquidation
	case strings.Contains(text, "债权申报") || strings.Contains(text, "申报债权"):
		return model.TypeClaimNotice
	case strings.Contains(text, "债权人会议") || strings.Contains(text, "开庭") || strings.Contains(text, "听证"):
		return model.TypeMeeting
	default:
		return model.TypeOther
	}
}

func ParseCourtLevel(courtName string) model.CourtLevel {
	name := strings.TrimSpace(courtName)
	switch {
	case strings.Contains(name, "最高人民法院"):
		return model.CourtLevelSupreme
	case strings.Contains(name, "高级人民法院"):
		return model.CourtLevelHigh
	case strings.Contains(name, "中级人民法院"):
		return model.CourtLevelMiddle
	case strings.Contains(name, "人民法院"):
		return model.CourtLevelBasic
	default:
		return model.CourtLevelBasic
	}
}

func NormalizeCase(c *model.Case) {
	if c.CaseNumberNorm == "" {
		c.CaseNumberNorm = NormalizeCaseNumber(c.CaseNumber)
	}
	if c.DebtorNorm == "" {
		c.DebtorNorm = NormalizeDebtor(c.Debtor)
	}
	if c.DebtorFingerprint == "" {
		c.DebtorFingerprint = DebtorFingerprint(c.DebtorNorm)
	}
	if c.CourtLevel == "" {
		c.CourtLevel = ParseCourtLevel(c.Court)
	}
	if c.AnnouncementType == "" {
		c.AnnouncementType = model.TypeOther
	}
}

func MatchSubscription(sub *model.Subscription, c *model.Case) bool {
	if !sub.Enabled {
		return false
	}

	kwNorm := strings.ToLower(sub.KeywordNorm)
	if kwNorm == "" {
		kwNorm = strings.ToLower(NormalizeDebtor(sub.Keyword))
	}

	targets := []string{
		strings.ToLower(c.Debtor),
		strings.ToLower(c.DebtorNorm),
		strings.ToLower(c.Creditors),
		strings.ToLower(c.Court),
		strings.ToLower(c.RulingNumber),
		strings.ToLower(c.Tags),
		strings.ToLower(c.Industry),
	}

	for _, t := range targets {
		if t == "" {
			continue
		}
		switch sub.MatchType {
		case "exact":
			if t == kwNorm {
				return true
			}
		case "prefix":
			if strings.HasPrefix(t, kwNorm) {
				return true
			}
		default:
			if strings.Contains(t, kwNorm) {
				return true
			}
		}
	}
	return false
}

func HighlightKeyword(text, keyword string) string {
	if keyword == "" || text == "" {
		return text
	}
	re := regexp.MustCompile(`(?i)` + regexp.QuoteMeta(keyword))
	return re.ReplaceAllStringFunc(text, func(m string) string {
		return fmt.Sprintf("<mark>%s</mark>", m)
	})
}

func atoi(s string) int {
	n := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			n = n*10 + int(r-'0')
		}
	}
	return n
}
