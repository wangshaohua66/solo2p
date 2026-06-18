package report

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"time"

	"cloudsync/internal/checksum"
	"cloudsync/internal/config"
	"cloudsync/internal/logger"
)

type ChecksumDiffReport struct {
	TaskID         string                      `json:"task_id"`
	Algorithm      string                      `json:"algorithm"`
	GeneratedAt    time.Time                   `json:"generated_at"`
	TotalChecked   int64                       `json:"total_checked"`
	TotalMismatch  int64                       `json:"total_mismatch"`
	TotalMatched   int64                       `json:"total_matched"`
	MatchRate      float64                     `json:"match_rate"`
	SourceInfo     EndpointInfo                `json:"source"`
	TargetInfo     EndpointInfo                `json:"target"`
	Mismatches     []checksum.MismatchReport   `json:"mismatches"`
	VerifiedFiles  []VerifiedFile              `json:"verified_files,omitempty"`
}

type VerifiedFile struct {
	Path     string `json:"path"`
	Checksum string `json:"checksum"`
	Status   string `json:"status"`
}

type ChecksumDiffGenerator struct {
	cfg *config.ReportConfig
}

func NewChecksumDiffGenerator(cfg *config.ReportConfig) *ChecksumDiffGenerator {
	return &ChecksumDiffGenerator{cfg: cfg}
}

func (g *ChecksumDiffGenerator) Generate(
	taskID string,
	sourceInfo, targetInfo EndpointInfo,
	mismatches []checksum.MismatchReport,
	verifiedCount int64,
	algorithm string,
) *ChecksumDiffReport {
	totalChecked := verifiedCount + int64(len(mismatches))
	matchRate := 100.0
	if totalChecked > 0 {
		matchRate = float64(verifiedCount) / float64(totalChecked) * 100
	}

	return &ChecksumDiffReport{
		TaskID:        taskID,
		Algorithm:     algorithm,
		GeneratedAt:   time.Now(),
		TotalChecked:  totalChecked,
		TotalMismatch: int64(len(mismatches)),
		TotalMatched:  verifiedCount,
		MatchRate:     matchRate,
		SourceInfo:    sourceInfo,
		TargetInfo:    targetInfo,
		Mismatches:    mismatches,
	}
}

func (g *ChecksumDiffGenerator) Write(report *ChecksumDiffReport) ([]string, error) {
	var written []string

	if err := os.MkdirAll(g.cfg.OutputDir, 0755); err != nil {
		return nil, fmt.Errorf("create report dir: %w", err)
	}

	baseName := fmt.Sprintf("checksum-diff-%s-%s",
		report.TaskID,
		time.Now().Format("20060102-150405"))

	formats := g.cfg.Formats
	if len(formats) == 0 {
		formats = []string{"json", "csv", "html"}
	}

	for _, format := range formats {
		format = normalizeFormat(format)
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
			logger.Warn("Unknown checksum diff report format: %s, skipping", format)
			continue
		}
		if err != nil {
			logger.Error("Failed to write %s checksum diff report: %v", format, err)
			continue
		}
		written = append(written, path)
		logger.Info("Generated %s checksum diff report: %s", format, path)
	}

	return written, nil
}

func (g *ChecksumDiffGenerator) writeJSON(report *ChecksumDiffReport, baseName string) (string, error) {
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

func (g *ChecksumDiffGenerator) writeCSV(report *ChecksumDiffReport, baseName string) (string, error) {
	path := filepath.Join(g.cfg.OutputDir, baseName+".csv")
	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("create csv: %w", err)
	}
	defer f.Close()

	w := csv.NewWriter(f)
	defer w.Flush()

	w.Write([]string{"CloudSync Checksum Diff Report"})
	w.Write([]string{"Generated At", report.GeneratedAt.Format(time.RFC3339)})
	w.Write([]string{"Task ID", report.TaskID})
	w.Write([]string{"Algorithm", report.Algorithm})
	w.Write([]string{"Source", fmt.Sprintf("%s://%s/%s", report.SourceInfo.Type, report.SourceInfo.Bucket, report.SourceInfo.Prefix)})
	w.Write([]string{"Target", fmt.Sprintf("%s://%s/%s", report.TargetInfo.Type, report.TargetInfo.Bucket, report.TargetInfo.Prefix)})
	w.Write([]string{})
	w.Write([]string{"Summary"})
	w.Write([]string{"Total Checked", i64(report.TotalChecked)})
	w.Write([]string{"Matched", i64(report.TotalMatched)})
	w.Write([]string{"Mismatched", i64(report.TotalMismatch)})
	w.Write([]string{"Match Rate", fmt.Sprintf("%.2f%%", report.MatchRate)})
	w.Write([]string{})

	if len(report.Mismatches) > 0 {
		w.Write([]string{"Checksum Mismatches"})
		w.Write([]string{"Path", "Expected", "Actual", "Algorithm", "Reason"})
		for _, m := range report.Mismatches {
			w.Write([]string{m.Path, m.Expected, m.Actual, string(m.Algorithm), m.Reason})
		}
		w.Write([]string{})
	}

	return path, nil
}

const checksumDiffHTMLTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Checksum Diff Report - {{.TaskID}}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
.header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
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
.mono { font-family: monospace; font-size: 12px; word-break: break-all; }
</style>
</head>
<body>

<div class="header">
    <h1>Checksum Diff Report</h1>
    <div>
        <span class="badge {{if eq .TotalMismatch 0}}badge-success{{else}}badge-error{{end}}">
            {{if eq .TotalMismatch 0}}ALL MATCHED{{else}}{{.TotalMismatch}} MISMATCH(ES){{end}}
        </span>
        <span style="margin-left:12px; opacity:0.9;">Task #{{.TaskID}}</span>
    </div>
</div>

<div class="card">
    <h2>Summary</h2>
    <div class="grid">
        <div class="stat"><div class="label">Algorithm</div><div class="value info">{{.Algorithm}}</div></div>
        <div class="stat"><div class="label">Total Checked</div><div class="value">{{.TotalChecked}}</div></div>
        <div class="stat"><div class="label">Matched</div><div class="value success">{{.TotalMatched}}</div></div>
        <div class="stat"><div class="label">Mismatched</div><div class="value {{if eq .TotalMismatch 0}}success{{else}}error{{end}}">{{.TotalMismatch}}</div></div>
        <div class="stat"><div class="label">Match Rate</div><div class="value {{if ge .MatchRate 99}}success{{else if ge .MatchRate 95}}warning{{else}}error{{end}}">{{printf "%.2f%%" .MatchRate}}</div></div>
    </div>
</div>

<div class="card">
    <h2>Endpoints</h2>
    <p><strong>Source:</strong> <span class="endpoint">{{.SourceInfo.Type}}://{{.SourceInfo.Bucket}}/{{.SourceInfo.Prefix}}</span></p>
    <p><strong>Target:</strong> <span class="endpoint">{{.TargetInfo.Type}}://{{.TargetInfo.Bucket}}/{{.TargetInfo.Prefix}}</span></p>
</div>

{{if .Mismatches}}
<div class="card">
    <h2 class="error">Checksum Mismatches ({{len .Mismatches}})</h2>
    <table>
        <tr><th>File</th><th>Expected</th><th>Actual</th><th>Algorithm</th><th>Reason</th></tr>
        {{range .Mismatches}}
        <tr>
            <td>{{.Path}}</td>
            <td class="mono">{{.Expected}}</td>
            <td class="mono error">{{.Actual}}</td>
            <td>{{.Algorithm}}</td>
            <td>{{.Reason}}</td>
        </tr>
        {{end}}
    </table>
</div>
{{else}}
<div class="card">
    <h2 class="success">No Checksum Mismatches Detected</h2>
    <p>All files passed checksum verification successfully.</p>
</div>
{{end}}

<div class="card" style="text-align:center; color:#888; font-size:13px;">
    Generated at {{.GeneratedAt.Format "2006-01-02 15:04:05"}} by CloudSync
</div>

</body>
</html>`

func (g *ChecksumDiffGenerator) writeHTML(report *ChecksumDiffReport, baseName string) (string, error) {
	path := filepath.Join(g.cfg.OutputDir, baseName+".html")
	tmpl, err := template.New("checksum_diff").Parse(checksumDiffHTMLTemplate)
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

func (r *ChecksumDiffReport) ToJSON() (string, error) {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func normalizeFormat(format string) string {
	switch format {
	case "JSON", "Json":
		return "json"
	case "CSV", "Csv":
		return "csv"
	case "HTML", "Html":
		return "html"
	default:
		return format
	}
}
