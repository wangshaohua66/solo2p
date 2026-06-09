package report

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/gitmon/gitmon/internal/analyzer"
	"github.com/gitmon/gitmon/internal/git"
	"github.com/gitmon/gitmon/internal/storage"

	"github.com/go-echarts/go-echarts/v2/charts"
	"github.com/go-echarts/go-echarts/v2/components"
	"github.com/go-echarts/go-echarts/v2/opts"
)

type ReportConfig struct {
	Format     string
	OutputDir  string
	Template   string
	RepoFilter []string
}

type ReportData struct {
	GeneratedAt  time.Time
	Repos        []storage.RepoRecord
	Stats        []storage.RepoStats
	Alerts       []storage.AlertRecord
	TopFiles     map[string][]storage.FileRecord
	Contributors map[string][]storage.ContributorRecord
	Heatmap      map[string][]storage.HeatmapData
	TechDebt     map[string][]storage.TechDebtItem
}

type Generator struct {
	analyzer *analyzer.Analyzer
	store    *storage.Store
	tmpl     *template.Template
}

func New(an *analyzer.Analyzer, store *storage.Store) *Generator {
	g := &Generator{
		analyzer: an,
		store:    store,
	}
	g.loadTemplates()
	return g
}

func (g *Generator) loadTemplates() {
	tmplDir := "templates"
	if _, err := os.Stat(tmplDir); os.IsNotExist(err) {
		return
	}
	tmpl, err := template.ParseGlob(filepath.Join(tmplDir, "*.html"))
	if err != nil {
		g.tmpl = nil
		return
	}
	g.tmpl = tmpl
}

func (g *Generator) Generate(cfg ReportConfig) (string, error) {
	data, err := g.collectData(cfg)
	if err != nil {
		return "", fmt.Errorf("collect data: %w", err)
	}

	switch cfg.Format {
	case "json":
		return g.generateJSON(data, cfg.OutputDir)
	case "html":
		return g.generateHTML(data, cfg.OutputDir, cfg.Template)
	case "pdf":
		return g.generatePDF(data, cfg.OutputDir)
	default:
		return "", fmt.Errorf("unsupported format: %s", cfg.Format)
	}
}

func (g *Generator) collectData(cfg ReportConfig) (*ReportData, error) {
	allRepos, err := g.store.GetAllRepos()
	if err != nil {
		return nil, err
	}

	var repos []storage.RepoRecord
	repoSet := make(map[string]bool)

	if len(cfg.RepoFilter) > 0 {
		for _, r := range allRepos {
			for _, pattern := range cfg.RepoFilter {
				matched, _ := filepath.Match(pattern, r.Name)
				if matched {
					repos = append(repos, r)
					repoSet[r.Name] = true
					break
				}
			}
		}
	} else {
		repos = allRepos
		for _, r := range repos {
			repoSet[r.Name] = true
		}
	}

	allStats, err := g.analyzer.GetAllStats()
	if err != nil {
		return nil, err
	}

	var stats []storage.RepoStats
	for _, s := range allStats {
		if repoSet[s.RepoName] {
			stats = append(stats, s)
		}
	}

	allAlerts, err := g.analyzer.GetAllAlerts()
	if err != nil {
		return nil, err
	}

	var alerts []storage.AlertRecord
	for _, a := range allAlerts {
		if repoSet[a.RepoName] {
			alerts = append(alerts, a)
		}
	}

	topFiles := make(map[string][]storage.FileRecord)
	contributors := make(map[string][]storage.ContributorRecord)
	heatmap := make(map[string][]storage.HeatmapData)
	techDebt := make(map[string][]storage.TechDebtItem)

	for _, r := range repos {
		files, _ := g.store.GetTopFilesByChurn(r.Name, 20)
		topFiles[r.Name] = files

		contrib, _ := g.store.GetContributorsByRepo(r.Name)
		contributors[r.Name] = contrib

		hm, _ := g.store.GetHeatmapData(r.Name, time.Now().AddDate(0, 0, -90))
		heatmap[r.Name] = hm

		td, _ := g.store.GetTechDebtByRepo(r.Name)
		techDebt[r.Name] = td
	}

	return &ReportData{
		GeneratedAt:  time.Now(),
		Repos:        repos,
		Stats:        stats,
		Alerts:       alerts,
		TopFiles:     topFiles,
		Contributors: contributors,
		Heatmap:      heatmap,
		TechDebt:     techDebt,
	}, nil
}

func (g *Generator) generateJSON(data *ReportData, outputDir string) (string, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", err
	}

	filename := fmt.Sprintf("gitmon_report_%s.json", data.GeneratedAt.Format("20060102_150405"))
	path := filepath.Join(outputDir, filename)

	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(path, content, 0644); err != nil {
		return "", err
	}

	return path, nil
}

func (g *Generator) generateHTML(data *ReportData, outputDir, templatePath string) (string, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", err
	}

	filename := fmt.Sprintf("gitmon_report_%s.html", data.GeneratedAt.Format("20060102_150405"))
	path := filepath.Join(outputDir, filename)

	var htmlContent string

	if templatePath != "" {
		customTmpl, err := template.ParseFiles(templatePath)
		if err != nil {
			return "", fmt.Errorf("parse custom template: %w", err)
		}
		var buf bytes.Buffer
		if err := customTmpl.Execute(&buf, data); err != nil {
			return "", fmt.Errorf("execute custom template: %w", err)
		}
		htmlContent = buf.String()
	} else if g.tmpl != nil && g.tmpl.Lookup("report.html") != nil {
		var buf bytes.Buffer
		if err := g.tmpl.ExecuteTemplate(&buf, "report.html", data); err != nil {
			return "", fmt.Errorf("execute template: %w", err)
		}
		htmlContent = buf.String()
	} else {
		page := g.buildReportPage(data)
		var buf bytes.Buffer
		if err := page.Render(&buf); err != nil {
			return "", err
		}
		htmlContent = buf.String()
	}

	if err := os.WriteFile(path, []byte(htmlContent), 0644); err != nil {
		return "", err
	}

	return path, nil
}

func (g *Generator) generatePDF(data *ReportData, outputDir string) (string, error) {
	htmlPath, err := g.generateHTML(data, outputDir, "")
	if err != nil {
		return "", err
	}

	pdfPath := filepath.Join(outputDir, filepath.Base(htmlPath)+".pdf")

	absHTMLPath, err := filepath.Abs(htmlPath)
	if err != nil {
		return "", fmt.Errorf("get absolute path: %w", err)
	}
	fileURL := "file://" + absHTMLPath

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	var pdfBuf []byte
	if err := chromedp.Run(ctx,
		chromedp.Navigate(fileURL),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
		chromedp.PrintToPDF(&pdfBuf, chromedp.WithPrintToPDFParams(
			chromedp.PaperSize(8.5, 11),
			chromedp.Margin(0.4, 0.4, 0.4, 0.4),
			chromedp.PrintBackground(true),
		)),
	); err != nil {
		return "", fmt.Errorf("chromedp print to pdf: %w", err)
	}

	if err := os.WriteFile(pdfPath, pdfBuf, 0644); err != nil {
		return "", fmt.Errorf("write pdf file: %w", err)
	}

	return pdfPath, nil
}

func (g *Generator) buildReportPage(data *ReportData) *components.Page {
	page := components.NewPage()
	page.PageTitle = fmt.Sprintf("GitMon Report - %s", data.GeneratedAt.Format("2006-01-02"))
	page.AssetsHost = "https://go-echarts.github.io/go-echarts-assets/assets/"

	headerHTML := fmt.Sprintf(`
	<div style="padding: 20px; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; margin-bottom: 20px; border-radius: 8px;">
		<h1 style="margin: 0;">GitMon Repository Analysis Report</h1>
		<p style="margin: 5px 0 0 0;">Generated: %s | Repositories: %d | Alerts: %d</p>
	</div>
	`, data.GeneratedAt.Format(time.RFC1123), len(data.Repos), len(data.Alerts))

	page.Add(components.NewPage().AddHTMLTemplate(headerHTML))

	healthChart := g.buildHealthChart(data.Stats)
	page.Add(healthChart)

	commitsChart := g.buildCommitsChart(data.Stats)
	page.Add(commitsChart)

	alertsChart := g.buildAlertsChart(data.Alerts)
	page.Add(alertsChart)

	if len(data.Repos) > 0 {
		heatmapChart := g.buildHeatmapChart(data.Heatmap[data.Repos[0].Name], data.Repos[0].Name)
		page.Add(heatmapChart)
	}

	contributorsChart := g.buildContributorsChart(data.Contributors)
	page.Add(contributorsChart)

	techDebtChart := g.buildTechDebtChart(data.TechDebt)
	page.Add(techDebtChart)

	summaryTable := g.buildSummaryTable(data)
	page.Add(components.NewPage().AddHTMLTemplate(summaryTable))

	return page
}

func (g *Generator) buildHealthChart(stats []storage.RepoStats) *charts.Bar {
	bar := charts.NewBar()
	bar.SetGlobalOptions(
		charts.WithTitleOpts(opts.Title{
			Title:    "Repository Health Scores",
			Subtitle: "Overall health status across all repositories",
		}),
		charts.WithColorsOpts(opts.Colors{"#10b981", "#f59e0b", "#ef4444", "#6b7280"}),
	)

	xData := make([]string, 0, len(stats))
	scores := make([]opts.BarData, 0, len(stats))
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].HealthScore > stats[j].HealthScore
	})

	for _, s := range stats {
		xData = append(xData, s.RepoName)
		color := "#10b981"
		if s.HealthLevel == git.HealthWarning {
			color = "#f59e0b"
		} else if s.HealthLevel == git.HealthCritical {
			color = "#ef4444"
		}
		scores = append(scores, opts.BarData{
			Value:     s.HealthScore,
			ItemStyle: &opts.ItemStyle{Color: color},
		})
	}

	bar.SetXAxis(xData).
		AddSeries("Health Score", scores)
	bar.SetSeriesOptions(
		charts.WithBarChartOpts(opts.BarChart{BarGap: "10%"}),
		charts.WithLabelOpts(opts.Label{Show: true, Position: "top"}),
	)

	return bar
}

func (g *Generator) buildCommitsChart(stats []storage.RepoStats) *charts.Line {
	line := charts.NewLine()
	line.SetGlobalOptions(
		charts.WithTitleOpts(opts.Title{
			Title:    "Commit Activity Overview",
			Subtitle: "Total commits per repository",
		}),
	)

	xData := make([]string, 0, len(stats))
	yData := make([]opts.LineData, 0, len(stats))
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].TotalCommits > stats[j].TotalCommits
	})

	for _, s := range stats {
		xData = append(xData, s.RepoName)
		yData = append(yData, opts.LineData{Value: s.TotalCommits})
	}

	line.SetXAxis(xData).
		AddSeries("Total Commits", yData).
		SetSeriesOptions(
			charts.WithLineChartOpts(opts.LineChart{Smooth: true, ShowSymbol: true}),
			charts.WithAreaStyleOpts(opts.AreaStyle{Opacity: 0.3}),
		)

	return line
}

func (g *Generator) buildAlertsChart(alerts []storage.AlertRecord) *charts.Pie {
	pie := charts.NewPie()
	pie.SetGlobalOptions(
		charts.WithTitleOpts(opts.Title{
			Title:    "Alert Distribution",
			Subtitle: fmt.Sprintf("Total active alerts: %d", len(alerts)),
		}),
	)

	typeMap := make(map[string]int)
	for _, a := range alerts {
		typeMap[a.Type]++
	}

	data := make([]opts.PieData, 0, len(typeMap))
	for t, c := range typeMap {
		data = append(data, opts.PieData{Name: t, Value: c})
	}

	pie.AddSeries("Alerts", data).
		SetSeriesOptions(
			charts.WithPieChartOpts(opts.PieChart{
				Radius: []string{"40%", "70%"},
			}),
			charts.WithLabelOpts(opts.Label{
				Show:      true,
				Formatter: "{b}: {c}",
			}),
		)

	return pie
}

func (g *Generator) buildHeatmapChart(data []storage.HeatmapData, repoName string) *charts.HeatMap {
	heatmap := charts.NewHeatMap()
	heatmap.SetGlobalOptions(
		charts.WithTitleOpts(opts.Title{
			Title:    fmt.Sprintf("Commit Heatmap - %s", repoName),
			Subtitle: "Daily commit activity over last 90 days",
		}),
		charts.WithVisualMapOpts(opts.VisualMap{
			Calculable: true,
			Min:        0,
			Max:        20,
			InRange: &opts.VisualMapInRange{
				Color: []string{"#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"},
			},
		}),
	)

	days := make([]string, 0, len(data))
	values := make([]opts.HeatMapData, 0, len(data))

	for _, d := range data {
		days = append(days, d.Date)
		values = append(values, opts.HeatMapData{
			Name:  d.Date,
			Value: []interface{}{d.Date, 0, d.Count},
		})
	}

	heatmap.SetXAxis(days).
		SetYAxis([]string{"Commits"}).
		AddSeries("Commits", values)

	return heatmap
}

func (g *Generator) buildContributorsChart(contributors map[string][]storage.ContributorRecord) *charts.Bar {
	bar := charts.NewBar()
	bar.SetGlobalOptions(
		charts.WithTitleOpts(opts.Title{
			Title:    "Top Contributors by Commits",
			Subtitle: "Across all repositories",
		}),
		charts.WithYAxisOpts(opts.YAxis{
			AxisLabel: &opts.AxisLabel{Show: true},
		}),
	)

	totalContrib := make(map[string]int)
	for _, repoContrib := range contributors {
		for _, c := range repoContrib {
			totalContrib[c.Name] += c.Commits
		}
	}

	type pair struct {
		name    string
		commits int
	}
	var pairs []pair
	for n, c := range totalContrib {
		pairs = append(pairs, pair{n, c})
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].commits > pairs[j].commits
	})

	if len(pairs) > 15 {
		pairs = pairs[:15]
	}

	xData := make([]string, 0, len(pairs))
	yData := make([]opts.BarData, 0, len(pairs))

	for _, p := range pairs {
		xData = append(xData, p.name)
		yData = append(yData, opts.BarData{Value: p.commits})
	}

	bar.SetXAxis(xData).
		AddSeries("Commits", yData).
		SetSeriesOptions(
			charts.WithBarChartOpts(opts.BarChart{BarGap: "10%"}),
			charts.WithLabelOpts(opts.Label{Show: true, Position: "top"}),
		)

	return bar
}

func (g *Generator) buildTechDebtChart(techDebt map[string][]storage.TechDebtItem) *charts.Bar {
	bar := charts.NewBar()
	bar.SetGlobalOptions(
		charts.WithTitleOpts(opts.Title{
			Title:    "Technical Debt by Pattern",
			Subtitle: "Count of TODO/FIXME/HACK comments",
		}),
	)

	patternMap := make(map[string]int)
	for _, items := range techDebt {
		for _, item := range items {
			patternMap[item.Pattern]++
		}
	}

	xData := make([]string, 0, len(patternMap))
	yData := make([]opts.BarData, 0, len(patternMap))

	colors := map[string]string{
		"FIXME":    "#ef4444",
		"BUG":      "#ef4444",
		"HACK":     "#f59e0b",
		"TODO":     "#3b82f6",
		"XXX":      "#f59e0b",
		"OPTIMIZE": "#8b5cf6",
	}

	for p, c := range patternMap {
		xData = append(xData, p)
		color := colors[p]
		if color == "" {
			color = "#6b7280"
		}
		yData = append(yData, opts.BarData{
			Value:     c,
			ItemStyle: &opts.ItemStyle{Color: color},
		})
	}

	bar.SetXAxis(xData).
		AddSeries("Count", yData).
		SetSeriesOptions(
			charts.WithBarChartOpts(opts.BarChart{BarGap: "10%"}),
			charts.WithLabelOpts(opts.Label{Show: true, Position: "top"}),
		)

	return bar
}

func (g *Generator) buildSummaryTable(data *ReportData) string {
	var buf bytes.Buffer
	tmpl := `
	<div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
		<h2>Repository Summary</h2>
		<table style="width: 100%%; border-collapse: collapse; margin-top: 15px;">
			<thead>
				<tr style="background: #e5e7eb;">
					<th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Repository</th>
					<th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Health</th>
					<th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Commits</th>
					<th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Contributors</th>
					<th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Files</th>
					<th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">LOC</th>
					<th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Silent Days</th>
				</tr>
			</thead>
			<tbody>
				{{range .Repos}}
				<tr style="border-bottom: 1px solid #e5e7eb;">
					<td style="padding: 10px;"><strong>{{.Name}}</strong></td>
					<td style="padding: 10px;">
						<span style="padding: 4px 12px; border-radius: 12px; color: white;
							{{if eq .HealthLevel "good"}}background: #10b981;
							{{else if eq .HealthLevel "warning"}}background: #f59e0b;
							{{else}}background: #ef4444;{{end}}">
							{{.HealthLevel}} ({{.HealthScore}})
						</span>
					</td>
					<td style="padding: 10px;">{{.CommitCount}}</td>
					<td style="padding: 10px;">{{.Contributors}}</td>
					<td style="padding: 10px;">{{.FilesCount}}</td>
					<td style="padding: 10px;">{{.LinesOfCode}}</td>
					<td style="padding: 10px;">
						{{if gt .SilentDays 60}}<span style="color: #ef4444;">{{.SilentDays}}</span>
						{{else if gt .SilentDays 30}}<span style="color: #f59e0b;">{{.SilentDays}}</span>
						{{else}}{{.SilentDays}}{{end}}
					</td>
				</tr>
				{{end}}
			</tbody>
		</table>
	</div>
	`

	t, err := template.New("summary").Parse(tmpl)
	if err != nil {
		return fmt.Sprintf("<p>Error rendering table: %v</p>", err)
	}

	if err := t.Execute(&buf, data); err != nil {
		return fmt.Sprintf("<p>Error rendering table: %v</p>", err)
	}

	return buf.String()
}
