package report

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html/template"
	"net/smtp"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"cloudsync/internal/checksum"
	"cloudsync/internal/config"
	"cloudsync/internal/conflict"
	"cloudsync/internal/logger"
	syncpkg "cloudsync/internal/sync"
)

type SyncReport struct {
	TaskID        string                  `json:"task_id"`
	Success       bool                    `json:"success"`
	ErrorMessage  string                  `json:"error_message,omitempty"`
	ChecksumAlgo  string                  `json:"checksum_algorithm"`
	StartTime     time.Time               `json:"start_time"`
	EndTime       time.Time               `json:"end_time"`
	DurationSec   float64                 `json:"duration_seconds"`
	SourceInfo    EndpointInfo            `json:"source"`
	TargetInfo    EndpointInfo            `json:"target"`
	Statistics    Statistics              `json:"statistics"`
	FailedFiles   []FailedFile            `json:"failed_files,omitempty"`
	Conflicts     []conflict.ConflictRecord `json:"conflicts,omitempty"`
	ChecksumDiffs []checksum.MismatchReport `json:"checksum_diffs,omitempty"`
	GeneratedAt   time.Time               `json:"generated_at"`
}

type EndpointInfo struct {
	Type   string `json:"type"`
	Bucket string `json:"bucket"`
	Prefix string `json:"prefix"`
}

type Statistics struct {
	TotalFiles       int64   `json:"total_files"`
	TotalBytes       int64   `json:"total_bytes"`
	CompletedFiles   int64   `json:"completed_files"`
	CompletedBytes   int64   `json:"completed_bytes"`
	FailedFiles      int64   `json:"failed_files"`
	SkippedFiles     int64   `json:"skipped_files"`
	ConflictFiles    int64   `json:"conflict_files"`
	DeletedFiles     int64   `json:"deleted_files"`
	SuccessRate      float64 `json:"success_rate"`
	AvgSpeedBPS      float64 `json:"avg_speed_bps"`
	AvgSpeedHuman    string  `json:"avg_speed_human"`
	TotalBytesHuman  string  `json:"total_bytes_human"`
	DoneBytesHuman   string  `json:"completed_bytes_human"`
}

type FailedFile struct {
	Key       string    `json:"key"`
	Error     string    `json:"error"`
	Timestamp time.Time `json:"timestamp"`
}

type Generator struct {
	cfg *config.ReportConfig
}

func NewGenerator(cfg *config.ReportConfig) *Generator {
	return &Generator{cfg: cfg}
}

func (g *Generator) Generate(result *syncpkg.EngineResult, sourceInfo, targetInfo EndpointInfo, cfg *config.Config) (*SyncReport, error) {
	stats := result.Stats

	report := &SyncReport{
		TaskID:       result.TaskID,
		Success:      result.Success,
		ErrorMessage: result.ErrorMessage,
		ChecksumAlgo: string(cfg.Checksum.Algorithm),
		StartTime:    result.StartTime,
		EndTime:      result.EndTime,
		DurationSec:  result.EndTime.Sub(result.StartTime).Seconds(),
		SourceInfo:   sourceInfo,
		TargetInfo:   targetInfo,
		Statistics: Statistics{
			TotalFiles:      atomic.LoadInt64(&stats.TotalFiles),
			TotalBytes:      atomic.LoadInt64(&stats.TotalBytes),
			CompletedFiles:  atomic.LoadInt64(&stats.DoneFiles),
			CompletedBytes:  atomic.LoadInt64(&stats.DoneBytes),
			FailedFiles:     atomic.LoadInt64(&stats.FailedFiles),
			SkippedFiles:    atomic.LoadInt64(&stats.SkippedFiles),
			ConflictFiles:   atomic.LoadInt64(&stats.ConflictFiles),
			DeletedFiles:    atomic.LoadInt64(&stats.DeletedFiles),
			SuccessRate:     stats.SuccessRate(),
			AvgSpeedBPS:     stats.AvgSpeedBPS(),
			AvgSpeedHuman:   formatBytes(int64(stats.AvgSpeedBPS())) + "/s",
			TotalBytesHuman: formatBytes(atomic.LoadInt64(&stats.TotalBytes)),
			DoneBytesHuman:  formatBytes(atomic.LoadInt64(&stats.DoneBytes)),
		},
		Conflicts:     result.Conflicts,
		ChecksumDiffs: result.ChecksumDiffs,
		GeneratedAt:   time.Now(),
	}

	if len(stats.Errors) > 0 {
		report.FailedFiles = make([]FailedFile, 0, len(stats.Errors))
		for _, e := range stats.Errors {
			report.FailedFiles = append(report.FailedFiles, FailedFile{
				Key:       e.Key,
				Error:     e.Error,
				Timestamp: e.Timestamp,
			})
		}
	}

	return report, nil
}

func (g *Generator) Write(report *SyncReport) ([]string, error) {
	var written []string

	if err := os.MkdirAll(g.cfg.OutputDir, 0755); err != nil {
		return nil, fmt.Errorf("create report dir: %w", err)
	}

	baseName := fmt.Sprintf("sync-report-%s-%s",
		report.TaskID,
		time.Now().Format("20060102-150405"))

	for _, format := range g.cfg.Formats {
		format = strings.ToLower(strings.TrimSpace(format))
		var err error
		var path string
		switch format {
		case "json":
			path, err = g.writeJSON(report, baseName)
		case "csv":
			path, err = g.writeCSV(report, baseName)
		case "html":
			path, err = g.writeHTML(report, baseName)
		default:
			logger.Warn("Unknown report format: %s, skipping", format)
			continue
		}
		if err != nil {
			logger.Error("Failed to write %s report: %v", format, err)
			continue
		}
		written = append(written, path)
		logger.Info("Generated %s report: %s", format, path)
	}

	return written, nil
}

func (g *Generator) writeJSON(report *SyncReport, baseName string) (string, error) {
	path := filepath.Join(g.cfg.OutputDir, baseName+".json")
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal json: %w", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}
	return path, nil
}

func (g *Generator) writeCSV(report *SyncReport, baseName string) (string, error) {
	path := filepath.Join(g.cfg.OutputDir, baseName+".csv")
	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("create csv: %w", err)
	}
	defer f.Close()

	w := csv.NewWriter(f)
	defer w.Flush()

	w.Write([]string{"CloudSync Sync Report"})
	w.Write([]string{"Generated At", report.GeneratedAt.Format(time.RFC3339)})
	w.Write([]string{})

	w.Write([]string{"Task Summary"})
	w.Write([]string{"Task ID", report.TaskID})
	w.Write([]string{"Success", fmt.Sprintf("%v", report.Success)})
	if report.ErrorMessage != "" {
		w.Write([]string{"Error", report.ErrorMessage})
	}
	w.Write([]string{"Checksum Algorithm", report.ChecksumAlgo})
	w.Write([]string{"Start Time", report.StartTime.Format(time.RFC3339)})
	w.Write([]string{"End Time", report.EndTime.Format(time.RFC3339)})
	w.Write([]string{"Duration (s)", fmt.Sprintf("%.2f", report.DurationSec)})
	w.Write([]string{})

	w.Write([]string{"Source / Target"})
	w.Write([]string{"Source Type", report.SourceInfo.Type})
	w.Write([]string{"Source Bucket", report.SourceInfo.Bucket})
	w.Write([]string{"Source Prefix", report.SourceInfo.Prefix})
	w.Write([]string{"Target Type", report.TargetInfo.Type})
	w.Write([]string{"Target Bucket", report.TargetInfo.Bucket})
	w.Write([]string{"Target Prefix", report.TargetInfo.Prefix})
	w.Write([]string{})

	w.Write([]string{"Statistics"})
	w.Write([]string{"Total Files", i64(report.Statistics.TotalFiles)})
	w.Write([]string{"Total Size", report.Statistics.TotalBytesHuman})
	w.Write([]string{"Completed Files", i64(report.Statistics.CompletedFiles)})
	w.Write([]string{"Completed Size", report.Statistics.DoneBytesHuman})
	w.Write([]string{"Failed Files", i64(report.Statistics.FailedFiles)})
	w.Write([]string{"Skipped Files", i64(report.Statistics.SkippedFiles)})
	w.Write([]string{"Conflict Files", i64(report.Statistics.ConflictFiles)})
	w.Write([]string{"Deleted Files", i64(report.Statistics.DeletedFiles)})
	w.Write([]string{"Success Rate", fmt.Sprintf("%.2f%%", report.Statistics.SuccessRate)})
	w.Write([]string{"Avg Speed", report.Statistics.AvgSpeedHuman})
	w.Write([]string{})

	if len(report.FailedFiles) > 0 {
		w.Write([]string{"Failed Files"})
		w.Write([]string{"Key", "Error", "Timestamp"})
		for _, ff := range report.FailedFiles {
			w.Write([]string{ff.Key, ff.Error, ff.Timestamp.Format(time.RFC3339)})
		}
		w.Write([]string{})
	}

	if len(report.Conflicts) > 0 {
		w.Write([]string{"Conflicts"})
		w.Write([]string{"Key", "Type", "Strategy", "Resolved", "Source Size", "Target Size"})
		for _, c := range report.Conflicts {
			w.Write([]string{
				c.Key, string(c.Type), string(c.Strategy),
				fmt.Sprintf("%v", c.Resolved),
				i64(c.SourceSize), i64(c.TargetSize),
			})
		}
		w.Write([]string{})
	}

	return path, nil
}

const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CloudSync Report - {{.TaskID}}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
.header h1 { margin: 0 0 8px 0; font-size: 28px; }
.card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.card h2 { margin-top: 0; color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.stat { background: #f8f9fa; padding: 16px; border-radius: 8px; }
.stat .label { color: #666; font-size: 13px; margin-bottom: 4px; }
.stat .value { font-size: 24px; font-weight: 600; color: #333; }
.success { color: #10b981; }
.error { color: #ef4444; }
.warning { color: #f59e0b; }
.info { color: #3b82f6; }
.badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
.badge-success { background: #d1fae5; color: #065f46; }
.badge-error { background: #fee2e2; color: #991b1b; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
th { background: #f8f9fa; font-weight: 600; color: #555; }
tr:hover { background: #fafafa; }
.endpoint { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 6px; font-family: monospace; margin-right: 8px; }
</style>
</head>
<body>

<div class="header">
    <h1>CloudSync Report</h1>
    <div>
        <span class="badge {{if .Success}}badge-success{{else}}badge-error{{end}}">{{if .Success}}SUCCESS{{else}}FAILED{{end}}</span>
        <span style="margin-left:12px; opacity:0.9;">Task #{{.TaskID}}</span>
    </div>
</div>

<div class="card">
    <h2>Overview</h2>
    <div class="grid">
        <div class="stat"><div class="label">Checksum</div><div class="value info">{{.ChecksumAlgo}}</div></div>
        <div class="stat"><div class="label">Start Time</div><div class="value">{{.StartTime.Format "2006-01-02 15:04:05"}}</div></div>
        <div class="stat"><div class="label">Duration</div><div class="value">{{printf "%.1fs" .DurationSec}}</div></div>
        <div class="stat"><div class="label">Success Rate</div><div class="value {{if ge .Statistics.SuccessRate 95}}success{{else if ge .Statistics.SuccessRate 80}}warning{{else}}error{{end}}">{{printf "%.1f%%" .Statistics.SuccessRate}}</div></div>
    </div>
    {{if .ErrorMessage}}
    <div style="margin-top:16px; padding:12px; background:#fee2e2; border-radius:8px; color:#991b1b;">
        <strong>Error:</strong> {{.ErrorMessage}}
    </div>
    {{end}}
</div>

<div class="card">
    <h2>Endpoints</h2>
    <p><strong>Source:</strong> <span class="endpoint">{{.SourceInfo.Type}}://{{.SourceInfo.Bucket}}/{{.SourceInfo.Prefix}}</span></p>
    <p><strong>Target:</strong> <span class="endpoint">{{.TargetInfo.Type}}://{{.TargetInfo.Bucket}}/{{.TargetInfo.Prefix}}</span></p>
</div>

<div class="card">
    <h2>Statistics</h2>
    <div class="grid">
        <div class="stat"><div class="label">Total Files</div><div class="value">{{.Statistics.TotalFiles}}</div></div>
        <div class="stat"><div class="label">Total Size</div><div class="value info">{{.Statistics.TotalBytesHuman}}</div></div>
        <div class="stat"><div class="label">Completed</div><div class="value success">{{.Statistics.CompletedFiles}} ({{.Statistics.DoneBytesHuman}})</div></div>
        <div class="stat"><div class="label">Failed</div><div class="value error">{{.Statistics.FailedFiles}}</div></div>
        <div class="stat"><div class="label">Skipped</div><div class="value warning">{{.Statistics.SkippedFiles}}</div></div>
        <div class="stat"><div class="label">Conflicts</div><div class="value warning">{{.Statistics.ConflictFiles}}</div></div>
        <div class="stat"><div class="label">Deleted</div><div class="value">{{.Statistics.DeletedFiles}}</div></div>
        <div class="stat"><div class="label">Avg Speed</div><div class="value success">{{.Statistics.AvgSpeedHuman}}</div></div>
    </div>
</div>

{{if .FailedFiles}}
<div class="card">
    <h2 class="error">Failed Files ({{len .FailedFiles}})</h2>
    <table>
        <tr><th>File</th><th>Error</th><th>Time</th></tr>
        {{range .FailedFiles}}
        <tr><td>{{.Key}}</td><td class="error">{{.Error}}</td><td>{{.Timestamp.Format "2006-01-02 15:04:05"}}</td></tr>
        {{end}}
    </table>
</div>
{{end}}

{{if .Conflicts}}
<div class="card">
    <h2 class="warning">Conflicts ({{len .Conflicts}})</h2>
    <table>
        <tr><th>File</th><th>Type</th><th>Strategy</th><th>Resolved</th><th>Source Size</th><th>Target Size</th></tr>
        {{range .Conflicts}}
        <tr>
            <td>{{.Key}}</td>
            <td>{{.Type}}</td>
            <td>{{.Strategy}}</td>
            <td class="{{if .Resolved}}success{{else}}error{{end}}">{{if .Resolved}}Yes{{else}}No{{end}}</td>
            <td>{{.SourceSize}}</td>
            <td>{{.TargetSize}}</td>
        </tr>
        {{end}}
    </table>
</div>
{{end}}

<div class="card" style="text-align:center; color:#888; font-size:13px;">
    Generated at {{.GeneratedAt.Format "2006-01-02 15:04:05"}} by CloudSync
</div>

</body>
</html>`

func (g *Generator) writeHTML(report *SyncReport, baseName string) (string, error) {
	path := filepath.Join(g.cfg.OutputDir, baseName+".html")
	tmpl, err := template.New("report").Parse(htmlTemplate)
	if err != nil {
		return "", fmt.Errorf("parse template: %w", err)
	}

	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("create html: %w", err)
	}
	defer f.Close()

	if err := tmpl.Execute(f, report); err != nil {
		return "", fmt.Errorf("execute template: %w", err)
	}
	return path, nil
}

func (g *Generator) SendEmail(reportPaths []string, report *SyncReport) error {
	if !g.cfg.Email.Enabled {
		logger.Info("Email sending disabled, skipping")
		return nil
	}

	if len(g.cfg.Email.ToAddresses) == 0 {
		return fmt.Errorf("no email recipients configured")
	}

	emailCfg := g.cfg.Email
	subject := fmt.Sprintf("[CloudSync] %s Report - %s",
		map[bool]string{true: "SUCCESS", false: "FAILED"}[report.Success],
		report.TaskID,
	)

	body := buildEmailBody(report, reportPaths)

	return sendSMTP(&emailCfg, subject, body, reportPaths)
}

func buildEmailBody(report *SyncReport, attachments []string) string {
	status := "FAILED"
	if report.Success {
		status = "SUCCESS"
	}

	return fmt.Sprintf(`CloudSync Sync Report
========================

Task ID: %s
Status:  %s
Duration: %.1f seconds
Checksum: %s

Source: %s://%s/%s
Target: %s://%s/%s

Statistics:
  Total Files:     %d (%s)
  Completed:       %d (%s)
  Failed:          %d
  Skipped:         %d
  Conflicts:       %d
  Deleted:         %d
  Success Rate:    %.1f%%
  Avg Speed:       %s

%s
Report files:
%s
`,
		report.TaskID, status, report.DurationSec, report.ChecksumAlgo,
		report.SourceInfo.Type, report.SourceInfo.Bucket, report.SourceInfo.Prefix,
		report.TargetInfo.Type, report.TargetInfo.Bucket, report.TargetInfo.Prefix,
		report.Statistics.TotalFiles, report.Statistics.TotalBytesHuman,
		report.Statistics.CompletedFiles, report.Statistics.DoneBytesHuman,
		report.Statistics.FailedFiles,
		report.Statistics.SkippedFiles,
		report.Statistics.ConflictFiles,
		report.Statistics.DeletedFiles,
		report.Statistics.SuccessRate,
		report.Statistics.AvgSpeedHuman,
		buildFailedSummary(report),
		strings.Join(attachments, "\n"),
	)
}

func buildFailedSummary(report *SyncReport) string {
	if len(report.FailedFiles) == 0 {
		return ""
	}
	lines := []string{"Failed Files:"}
	limit := len(report.FailedFiles)
	if limit > 10 {
		limit = 10
	}
	for i := 0; i < limit; i++ {
		lines = append(lines, fmt.Sprintf("  - %s: %s", report.FailedFiles[i].Key, report.FailedFiles[i].Error))
	}
	if len(report.FailedFiles) > 10 {
		lines = append(lines, fmt.Sprintf("  ... and %d more", len(report.FailedFiles)-10))
	}
	lines = append(lines, "")
	return strings.Join(lines, "\n")
}

func sendSMTP(cfg *config.EmailConfig, subject, body string, attachments []string) error {
	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.SMTPHost)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		cfg.FromAddress,
		strings.Join(cfg.ToAddresses, ","),
		subject,
		body,
	)

	addr := fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort)

	logger.Info("Sending report email to %d recipients via %s", len(cfg.ToAddresses), addr)

	if err := smtp.SendMail(addr, auth, cfg.FromAddress, cfg.ToAddresses, []byte(msg)); err != nil {
		return fmt.Errorf("send email: %w", err)
	}

	logger.Info("Email sent successfully")
	return nil
}

func formatBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(n)/float64(div), "KMGTPE"[exp])
}

func i64(n int64) string {
	return strconv.FormatInt(n, 10)
}

func BuildEndpointInfo(cfg config.StorageConfig) EndpointInfo {
	var bucket string
	switch cfg.Type {
	case config.StorageTypeS3:
		bucket = cfg.S3.Bucket
	case config.StorageTypeOSS:
		bucket = cfg.OSS.Bucket
	case config.StorageTypeGCS:
		bucket = cfg.GCS.Bucket
	}
	return EndpointInfo{
		Type:   string(cfg.Type),
		Bucket: bucket,
		Prefix: cfg.Prefix,
	}
}

func (r *SyncReport) ToJSON() (string, error) {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s Statistics) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"total_files":      s.TotalFiles,
		"total_bytes":      s.TotalBytes,
		"completed_files":  s.CompletedFiles,
		"completed_bytes":  s.CompletedBytes,
		"failed_files":     s.FailedFiles,
		"skipped_files":    s.SkippedFiles,
		"conflict_files":   s.ConflictFiles,
		"deleted_files":    s.DeletedFiles,
		"success_rate":     s.SuccessRate,
		"avg_speed_bps":    s.AvgSpeedBPS,
	}
}
