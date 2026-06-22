package notify

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go.uber.org/zap"

	"drug-bid-crawler/config"
	"drug-bid-crawler/storage"
)

type AlertType string

const (
	AlertTypeExpiry   AlertType = "expiry"
	AlertTypeDownload AlertType = "download"
	AlertTypeLogin    AlertType = "login"
	AlertTypeSystem   AlertType = "system"
)

type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityError    AlertSeverity = "error"
	SeverityCritical AlertSeverity = "critical"
)

type Alert struct {
	ID        string
	Type      AlertType
	Severity  AlertSeverity
	Title     string
	Message   string
	Details   string
	CreatedAt time.Time
}

type AlertManager struct {
	alerts []Alert
}

func NewAlertManager() *AlertManager {
	return &AlertManager{
		alerts: make([]Alert, 0),
	}
}

func (am *AlertManager) Add(alert Alert) {
	alert.ID = fmt.Sprintf("alert_%d_%s", time.Now().UnixNano(), string(alert.Type))
	alert.CreatedAt = time.Now()
	am.alerts = append(am.alerts, alert)

	logAlert(alert)
}

func (am *AlertManager) GetAll() []Alert {
	return am.alerts
}

func (am *AlertManager) GetByType(alertType AlertType) []Alert {
	result := make([]Alert, 0)
	for _, a := range am.alerts {
		if a.Type == alertType {
			result = append(result, a)
		}
	}
	return result
}

func (am *AlertManager) GetBySeverity(severity AlertSeverity) []Alert {
	result := make([]Alert, 0)
	for _, a := range am.alerts {
		if a.Severity == severity {
			result = append(result, a)
		}
	}
	return result
}

func (am *AlertManager) Count() int {
	return len(am.alerts)
}

func (am *AlertManager) Clear() {
	am.alerts = make([]Alert, 0)
}

func logAlert(alert Alert) {
	msg := fmt.Sprintf("[%s] %s: %s", alert.Severity, alert.Title, alert.Message)
	switch alert.Severity {
	case SeverityError, SeverityCritical:
		config.Logger.Error(msg,
			zap.String("alert_id", alert.ID),
			zap.String("type", string(alert.Type)),
			zap.String("details", alert.Details),
		)
	case SeverityWarning:
		config.Logger.Warn(msg,
			zap.String("alert_id", alert.ID),
			zap.String("type", string(alert.Type)),
			zap.String("details", alert.Details),
		)
	default:
		config.Logger.Info(msg,
			zap.String("alert_id", alert.ID),
			zap.String("type", string(alert.Type)),
			zap.String("details", alert.Details),
		)
	}

	storage.LogExecution(alert.ID, string(alert.Severity), msg, alert.Details)
}

func GenerateExpiryReport(projectID string, warnings []storage.ExpiryWarning) error {
	if len(warnings) == 0 {
		config.Logger.Info("没有即将到期或已过期的证书")
		return nil
	}

	project, _ := storage.GetProject(projectID)
	projectName := projectID
	if project != nil {
		projectName = project.ProjectName
	}

	reportDir := filepath.Join(config.GlobalConfig.DownloadDir, "reports")
	if err := os.MkdirAll(reportDir, 0755); err != nil {
		return fmt.Errorf("create report dir: %w", err)
	}

	reportFile := filepath.Join(reportDir,
		fmt.Sprintf("资质到期预警_%s_%s.csv",
			projectName,
			time.Now().Format("20060102_150405")))

	sort.Slice(warnings, func(i, j int) bool {
		return warnings[i].ExpiryDate.Before(warnings[j].ExpiryDate)
	})

	f, err := os.Create(reportFile)
	if err != nil {
		return fmt.Errorf("create report file: %w", err)
	}
	defer f.Close()

	writer := csv.NewWriter(f)
	defer writer.Flush()

	writer.Write([]string{"序号", "项目名称", "企业名称", "证书类型", "文件名", "有效期至", "剩余天数", "状态"})

	expiredCount := 0
	warningCount := 0

	for i, w := range warnings {
		status := "即将到期"
		if w.Status == storage.CertExpired {
			status = "已过期"
			expiredCount++
		} else {
			warningCount++
		}

		writer.Write([]string{
			fmt.Sprintf("%d", i+1),
			w.ProjectName,
			w.CompanyName,
			w.CertType,
			w.FileName,
			w.ExpiryDate.Format("2006-01-02"),
			fmt.Sprintf("%d", w.DaysLeft),
			status,
		})
	}

	config.Logger.Info("资质到期预警报告已生成",
		zap.String("file", reportFile),
		zap.Int("total", len(warnings)),
		zap.Int("expired", expiredCount),
		zap.Int("warning", warningCount),
	)

	printExpirySummary(warnings, expiredCount, warningCount)

	return nil
}

func printExpirySummary(warnings []storage.ExpiryWarning, expiredCount, warningCount int) {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("📋 资质到期预警清单")
	fmt.Println(strings.Repeat("-", 70))
	fmt.Printf("  预警总数: %d (已过期: %d, 即将到期: %d)\n",
		len(warnings), expiredCount, warningCount)
	fmt.Println(strings.Repeat("-", 70))

	if len(warnings) > 0 {
		fmt.Printf("%-4s %-30s %-12s %-12s %-8s\n",
			"序号", "企业名称", "证书类型", "有效期", "剩余天数")
		fmt.Println(strings.Repeat("-", 70))

		displayCount := len(warnings)
		if displayCount > 20 {
			displayCount = 20
		}

		for i := 0; i < displayCount; i++ {
			w := warnings[i]
			daysStr := fmt.Sprintf("%d天", w.DaysLeft)
			if w.DaysLeft < 0 {
				daysStr = fmt.Sprintf("过期%d天", -w.DaysLeft)
			}

			companyName := w.CompanyName
			if len([]rune(companyName)) > 28 {
				companyName = string([]rune(companyName)[:26]) + ".."
			}

			fmt.Printf("%-4d %-30s %-12s %-12s %-8s\n",
				i+1, companyName, w.CertType,
				w.ExpiryDate.Format("2006-01-02"), daysStr)
		}

		if len(warnings) > 20 {
			fmt.Printf("... 还有 %d 条记录，请查看CSV报告\n", len(warnings)-20)
		}
	}
	fmt.Println(strings.Repeat("=", 70))
}

func GenerateDownloadReport(projectID string) error {
	stats, err := storage.GetStats(projectID)
	if err != nil {
		return fmt.Errorf("get stats: %w", err)
	}

	_, err = storage.GetFilesByProject(projectID)
	if err != nil {
		return fmt.Errorf("get files: %w", err)
	}

	project, _ := storage.GetProject(projectID)
	projectName := projectID
	if project != nil {
		projectName = project.ProjectName
	}

	reportDir := filepath.Join(config.GlobalConfig.DownloadDir, "reports")
	if err := os.MkdirAll(reportDir, 0755); err != nil {
		return fmt.Errorf("create report dir: %w", err)
	}

	reportFile := filepath.Join(reportDir,
		fmt.Sprintf("下载统计_%s_%s.csv",
			projectName,
			time.Now().Format("20060102_150405")))

	f, err := os.Create(reportFile)
	if err != nil {
		return fmt.Errorf("create report file: %w", err)
	}
	defer f.Close()

	writer := csv.NewWriter(f)
	defer writer.Flush()

	writer.Write([]string{"项目名称", projectName})
	writer.Write([]string{"统计时间", time.Now().Format("2006-01-02 15:04:05")})
	writer.Write([]string{})
	writer.Write([]string{"统计项", "数值"})
	writer.Write([]string{"总文件数", fmt.Sprintf("%d", stats.TotalFiles)})
	writer.Write([]string{"已完成", fmt.Sprintf("%d", stats.CompletedFiles)})
	writer.Write([]string{"失败", fmt.Sprintf("%d", stats.FailedFiles)})
	writer.Write([]string{"跳过", fmt.Sprintf("%d", stats.SkippedFiles)})
	writer.Write([]string{"待处理", fmt.Sprintf("%d", stats.PendingFiles)})
	writer.Write([]string{"成功率", fmt.Sprintf("%.2f%%",
		float64(stats.CompletedFiles)/float64(stats.TotalFiles)*100)})
	writer.Write([]string{"总大小(MB)", fmt.Sprintf("%.2f", float64(stats.TotalSize)/1024/1024)})
	writer.Write([]string{})
	writer.Write([]string{"企业名称", "文件总数", "已下载", "失败", "成功率"})

	companies, _ := storage.GetCompaniesByProject(projectID)
	for _, c := range companies {
		successRate := 0.0
		if c.FileCount > 0 {
			successRate = float64(c.Downloaded) / float64(c.FileCount) * 100
		}
		writer.Write([]string{
			c.CompanyName,
			fmt.Sprintf("%d", c.FileCount),
			fmt.Sprintf("%d", c.Downloaded),
			fmt.Sprintf("%d", c.FailedCount),
			fmt.Sprintf("%.2f%%", successRate),
		})
	}

	config.Logger.Info("下载统计报告已生成",
		zap.String("file", reportFile),
		zap.Int("total_files", stats.TotalFiles),
		zap.Int("completed", stats.CompletedFiles),
		zap.Int("failed", stats.FailedFiles),
	)

	return nil
}

func SendExpiryAlert(am *AlertManager, warnings []storage.ExpiryWarning) {
	expired := make([]storage.ExpiryWarning, 0)
	warning := make([]storage.ExpiryWarning, 0)

	for _, w := range warnings {
		if w.Status == storage.CertExpired {
			expired = append(expired, w)
		} else {
			warning = append(warning, w)
		}
	}

	if len(expired) > 0 {
		companies := make(map[string]bool)
		for _, e := range expired {
			companies[e.CompanyName] = true
		}

		am.Add(Alert{
			Type:     AlertTypeExpiry,
			Severity: SeverityError,
			Title:    "资质证书已过期",
			Message: fmt.Sprintf("发现 %d 份已过期的资质证书，涉及 %d 家企业",
				len(expired), len(companies)),
			Details: buildExpiryDetails(expired),
		})
	}

	if len(warning) > 0 {
		companies := make(map[string]bool)
		for _, w := range warning {
			companies[w.CompanyName] = true
		}

		am.Add(Alert{
			Type:     AlertTypeExpiry,
			Severity: SeverityWarning,
			Title:    "资质证书即将到期",
			Message: fmt.Sprintf("发现 %d 份%d天内即将到期的资质证书，涉及 %d 家企业",
				len(warning), config.GlobalConfig.WarnDays, len(companies)),
			Details: buildExpiryDetails(warning),
		})
	}
}

func SendDownloadAlert(am *AlertManager, failedCount, totalCount int) {
	if failedCount == 0 {
		return
	}

	failureRate := float64(failedCount) / float64(totalCount) * 100
	severity := SeverityWarning
	if failureRate > 5 {
		severity = SeverityError
	}

	am.Add(Alert{
		Type:     AlertTypeDownload,
		Severity: severity,
		Title:    "下载任务异常",
		Message: fmt.Sprintf("本次下载任务有 %d 个文件下载失败，失败率 %.2f%%",
			failedCount, failureRate),
		Details: fmt.Sprintf("总文件数: %d, 失败数: %d, 失败率: %.2f%%",
			totalCount, failedCount, failureRate),
	})
}

func SendLoginAlert(am *AlertManager, success bool, err error) {
	if success {
		am.Add(Alert{
			Type:     AlertTypeLogin,
			Severity: SeverityInfo,
			Title:    "登录成功",
			Message:  "系统登录成功，会话已建立",
		})
	} else {
		am.Add(Alert{
			Type:     AlertTypeLogin,
			Severity: SeverityCritical,
			Title:    "登录失败",
			Message:  "系统登录失败，请检查账号密码或网络连接",
			Details:  fmt.Sprintf("错误: %v", err),
		})
	}
}

func SendSystemAlert(am *AlertManager, severity AlertSeverity, title, message string, err error) {
	details := ""
	if err != nil {
		details = err.Error()
	}

	am.Add(Alert{
		Type:     AlertTypeSystem,
		Severity: severity,
		Title:    title,
		Message:  message,
		Details:  details,
	})
}

func buildExpiryDetails(warnings []storage.ExpiryWarning) string {
	var details strings.Builder
	for _, w := range warnings {
		details.WriteString(fmt.Sprintf("企业: %s, 证书: %s, 有效期至: %s, 剩余: %d天\n",
			w.CompanyName, w.CertType, w.ExpiryDate.Format("2006-01-02"), w.DaysLeft))
	}
	return details.String()
}

func PrintAlertsSummary(alerts []Alert) {
	if len(alerts) == 0 {
		fmt.Println("\n✅ 本次运行无告警")
		return
	}

	countByType := make(map[AlertType]int)
	countBySeverity := make(map[AlertSeverity]int)

	for _, a := range alerts {
		countByType[a.Type]++
		countBySeverity[a.Severity]++
	}

	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("🚨 告警汇总")
	fmt.Println(strings.Repeat("-", 60))
	fmt.Printf("  总告警数: %d\n", len(alerts))
	fmt.Println("  按类型:")
	for t, c := range countByType {
		fmt.Printf("    %-12s: %d\n", t, c)
	}
	fmt.Println("  按严重程度:")
	for s, c := range countBySeverity {
		icon := "ℹ️"
		switch s {
		case SeverityWarning:
			icon = "⚠️"
		case SeverityError:
			icon = "❌"
		case SeverityCritical:
			icon = "🔥"
		}
		fmt.Printf("    %s %-12s: %d\n", icon, s, c)
	}
	fmt.Println(strings.Repeat("=", 60))

	for _, a := range alerts {
		if a.Severity == SeverityError || a.Severity == SeverityCritical {
			icon := "❌"
			if a.Severity == SeverityCritical {
				icon = "🔥"
			}
			fmt.Printf("%s [%s] %s: %s\n", icon, a.Severity, a.Title, a.Message)
		}
	}
}

func CleanupOldLogs() error {
	return storage.CleanupOldLogs(90)
}
