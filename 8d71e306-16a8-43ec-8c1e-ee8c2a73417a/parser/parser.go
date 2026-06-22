package parser

import (
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type FileInfo struct {
	CompanyName string
	CertType    string
	CertNumber  string
	IssueDate   *time.Time
	ExpiryDate  *time.Time
	Original    string
}

var certTypePatterns = map[string][]string{
	"营业执照": {
		`营业执照`, `经营许可证`, `工商营业执照`,
	},
	"GMP证书": {
		`GMP`, `药品生产质量管理规范`, `药品GMP`,
	},
	"药品注册证": {
		`药品注册证`, `注册批件`, `药品批准文号`, `国药准字`,
	},
	"授权书": {
		`授权书`, `委托书`, `授权委托书`, `法人授权`,
	},
	"药品经营许可证": {
		`药品经营许可证`, `GSP`, `药品经营质量管理规范`,
	},
	"医疗器械经营许可证": {
		`医疗器械经营许可证`, `医疗器械注册证`,
	},
	"生产许可证": {
		`生产许可证`, `药品生产许可证`,
	},
	"税务登记证": {
		`税务登记证`, `税务登记`,
	},
	"组织机构代码证": {
		`组织机构代码`, `代码证`,
	},
	"质量保证协议": {
		`质量保证`, `质保协议`,
	},
	"开户许可证": {
		`开户许可证`, `开户证明`,
	},
	"印章备案": {
		`印章`, `印鉴`, `公章备案`,
	},
	"销售人员资质": {
		`销售员`, `销售人员`, `业务员`, `上岗证`,
	},
}

var datePatterns = []struct {
	Pattern *regexp.Regexp
	Format  string
}{
	{regexp.MustCompile(`有效期[至:：]?\s*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?)`), "2006-01-02"},
	{regexp.MustCompile(`截止日期[为:：]?\s*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?)`), "2006-01-02"},
	{regexp.MustCompile(`到期日期[为:：]?\s*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?)`), "2006-01-02"},
	{regexp.MustCompile(`失效日期[为:：]?\s*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?)`), "2006-01-02"},
	{regexp.MustCompile(`至[：:]?\s*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?)`), "2006-01-02"},
	{regexp.MustCompile(`(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?)[至-](\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}日?)`), "2006-01-02"},
	{regexp.MustCompile(`有效期[：:]?\s*(\d{4})(\d{2})(\d{2})`), "20060102"},
	{regexp.MustCompile(`EXP[：:]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})`), "2006-01-02"},
}

var certNumberPatterns = []*regexp.Regexp{
	regexp.MustCompile(`证书编号[：:]\s*([A-Za-z0-9\-]+)`),
	regexp.MustCompile(`编号[：:]\s*([A-Za-z0-9\-]+)`),
	regexp.MustCompile(`注册号[：:]\s*([A-Za-z0-9\-]+)`),
	regexp.MustCompile(`批准文号[：:]\s*([A-Za-z0-9\-]+)`),
	regexp.MustCompile(`国药准字\s*([A-Za-z0-9]+)`),
	regexp.MustCompile(`(\b[A-Z]{2}\d{4}\d{6}\b)`),
	regexp.MustCompile(`(\b\d{15}\b)`),
	regexp.MustCompile(`(\b91\d{15}\b)`),
}

var companyNameCleanPatterns = []*regexp.Regexp{
	regexp.MustCompile(`^[的和与及关于]`),
	regexp.MustCompile(`[的和与及关于]$`),
}

var longTermPatterns = []*regexp.Regexp{
	regexp.MustCompile(`长期有效`),
	regexp.MustCompile(`永久有效`),
	regexp.MustCompile(`无期限`),
	regexp.MustCompile(`有效期：长期`),
}

func ParseFileInfo(fileName string, companyName string) FileInfo {
	info := FileInfo{
		Original:    fileName,
		CompanyName: companyName,
	}

	cleanName := strings.TrimSuffix(fileName, ".pdf")
	cleanName = strings.TrimSuffix(cleanName, ".PDF")
	cleanName = strings.TrimSuffix(cleanName, ".doc")
	cleanName = strings.TrimSuffix(cleanName, ".docx")
	cleanName = strings.TrimSuffix(cleanName, ".jpg")
	cleanName = strings.TrimSuffix(cleanName, ".png")

	cleanName = strings.ReplaceAll(cleanName, "_", " ")
	cleanName = strings.ReplaceAll(cleanName, "-", " ")
	cleanName = strings.ReplaceAll(cleanName, "  ", " ")
	cleanName = strings.TrimSpace(cleanName)

	if info.CompanyName == "" {
		info.CompanyName = extractCompanyName(cleanName)
	}

	info.CertType = extractCertType(cleanName)

	if hasLongTerm(cleanName) {
		return info
	}

	info.IssueDate, info.ExpiryDate = extractDates(cleanName)

	info.CertNumber = extractCertNumber(cleanName)

	return info
}

func extractCompanyName(name string) string {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`([\u4e00-\u9fa5]+(?:股份有限公司|有限责任公司|有限公司|公司|集团|药厂|制药厂|药业公司))`),
		regexp.MustCompile(`^([\u4e00-\u9fa5]{2,15})`),
	}

	for _, pattern := range patterns {
		match := pattern.FindStringSubmatch(name)
		if len(match) > 1 {
			company := strings.TrimSpace(match[1])
			for _, cleanPattern := range companyNameCleanPatterns {
				company = cleanPattern.ReplaceAllString(company, "")
			}
			if len(company) >= 2 {
				return company
			}
		}
	}

	return ""
}

func extractCertType(name string) string {
	nameLower := strings.ToLower(name)

	for certType, patterns := range certTypePatterns {
		for _, pattern := range patterns {
			if strings.Contains(nameLower, strings.ToLower(pattern)) {
				return certType
			}
		}
	}

	specialPatterns := map[string]*regexp.Regexp{
		"GMP证书":  regexp.MustCompile(`(?i)gmp`),
		"GSP证书":  regexp.MustCompile(`(?i)gsp`),
		"营业执照": regexp.MustCompile(`(?i)business.*license|营业执照`),
	}

	for certType, pattern := range specialPatterns {
		if pattern.MatchString(name) {
			return certType
		}
	}

	return ""
}

func extractDates(name string) (*time.Time, *time.Time) {
	var issueDate, expiryDate *time.Time

	for _, dp := range datePatterns {
		matches := dp.Pattern.FindStringSubmatch(name)
		if len(matches) >= 2 {
			if len(matches) >= 3 && strings.Contains(name, "至") {
				start := parseDateFlexible(matches[1], dp.Format)
				end := parseDateFlexible(matches[2], dp.Format)
				if start != nil {
					issueDate = start
				}
				if end != nil {
					expiryDate = end
				}
			} else {
				date := parseDateFlexible(matches[1], dp.Format)
				if date != nil {
					expiryDate = date
				}
			}
			break
		}
	}

	if expiryDate == nil {
		genericPattern := regexp.MustCompile(`(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})`)
		allMatches := genericPattern.FindAllStringSubmatch(name, -1)
		if len(allMatches) >= 2 {
			dates := make([]time.Time, 0, len(allMatches))
			for _, m := range allMatches {
				if d := parseDateFlexible(m[0], "2006-01-02"); d != nil {
					dates = append(dates, *d)
				}
			}
			if len(dates) >= 2 {
				issueDate = &dates[0]
				expiryDate = &dates[1]
			}
		} else if len(allMatches) == 1 {
			if d := parseDateFlexible(allMatches[0][0], "2006-01-02"); d != nil {
				expiryDate = d
			}
		}
	}

	return issueDate, expiryDate
}

func parseDateFlexible(dateStr string, format string) *time.Time {
	dateStr = strings.TrimSpace(dateStr)
	dateStr = strings.ReplaceAll(dateStr, "年", "-")
	dateStr = strings.ReplaceAll(dateStr, "月", "-")
	dateStr = strings.ReplaceAll(dateStr, "日", "")
	dateStr = strings.ReplaceAll(dateStr, ".", "-")
	dateStr = strings.ReplaceAll(dateStr, "/", "-")

	formats := []string{
		"2006-01-02",
		"2006-1-2",
		"20060102",
		"2006-01-02 15:04:05",
	}

	for _, f := range formats {
		if t, err := time.ParseInLocation(f, dateStr, time.Local); err == nil {
			return &t
		}
	}

	return nil
}

func extractCertNumber(name string) string {
	for _, pattern := range certNumberPatterns {
		match := pattern.FindStringSubmatch(name)
		if len(match) > 1 {
			return strings.TrimSpace(match[1])
		}
	}

	return ""
}

func hasLongTerm(name string) bool {
	for _, pattern := range longTermPatterns {
		if pattern.MatchString(name) {
			return true
		}
	}
	return false
}

func IsCertExpiring(expiryDate *time.Time, warnDays int) (bool, int) {
	if expiryDate == nil {
		return false, 0
	}

	daysLeft := int(time.Until(*expiryDate).Hours() / 24)
	return daysLeft <= warnDays, daysLeft
}

func NormalizeCertType(certType string) string {
	if certType == "" {
		return "其他资质"
	}
	return certType
}

func ValidateFileName(fileName string) (bool, string) {
	if fileName == "" {
		return false, "文件名为空"
	}

	ext := strings.ToLower(filepath.Ext(fileName))
	allowedExts := map[string]bool{
		".pdf":  true,
		".doc":  true,
		".docx": true,
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".tif":  true,
		".tiff": true,
		".bmp":  true,
	}

	if !allowedExts[ext] {
		return false, "不支持的文件格式: " + ext
	}

	base := strings.TrimSuffix(fileName, ext)
	if len(base) == 0 {
		return false, "文件名无效"
	}

	return true, ""
}

func GenerateNewFileName(companyName, certType string, expiryDate *time.Time, ext string) string {
	var expiryStr string
	if expiryDate != nil {
		expiryStr = expiryDate.Format("20060102")
	} else {
		expiryStr = "长期"
	}

	certType = NormalizeCertType(certType)

	cleanName := SanitizeFileName(companyName + "_" + certType + "_" + expiryStr + ext)
	return cleanName
}

func SanitizeFileName(name string) string {
	reg := regexp.MustCompile(`[\\/:*?"<>|\r\n\t]`)
	name = reg.ReplaceAllString(name, "_")
	name = strings.TrimSpace(name)
	name = strings.Trim(name, ".")
	return name
}

func ParseMultipleFiles(fileNames []string, companyName string) []FileInfo {
	results := make([]FileInfo, 0, len(fileNames))
	for _, fn := range fileNames {
		results = append(results, ParseFileInfo(fn, companyName))
	}
	return results
}

func ExtractCertStatistics(files []FileInfo) map[string]int {
	stats := make(map[string]int)
	for _, f := range files {
		stats[f.CertType]++
	}
	return stats
}

func FindExpiringCerts(files []FileInfo, warnDays int) []FileInfo {
	var expiring []FileInfo
	for _, f := range files {
		if f.ExpiryDate != nil {
			daysLeft := int(time.Until(*f.ExpiryDate).Hours() / 24)
			if daysLeft <= warnDays {
				expiring = append(expiring, f)
			}
		}
	}
	return expiring
}
