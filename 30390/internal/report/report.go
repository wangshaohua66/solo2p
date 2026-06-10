package report

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/gitmon/gitmon/internal/analyzer"
	"github.com/gitmon/gitmon/internal/storage"
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
	_ = g.loadTemplates()
	return g
}

func (g *Generator) loadTemplates() error {
	tmplDir := "templates"
	if _, err := os.Stat(tmplDir); os.IsNotExist(err) {
		_ = os.MkdirAll(tmplDir, 0755)
	}
	funcMap := template.FuncMap{
		"formatDate": func(t time.Time) string {
			return t.Format("2006-01-02")
		},
		"json": func(v interface{}) string {
			b, _ := json.Marshal(v)
			return string(b)
		},
		"sumCommits": func(repos []storage.RepoRecord) int {
			total := 0
			for _, r := range repos {
				total += r.CommitCount
			}
			return total
		},
		"sumContributors": func(repos []storage.RepoRecord) int {
			total := 0
			for _, r := range repos {
				total += r.Contributors
			}
			return total
		},
		"filterReposByHealth": func(repos []storage.RepoRecord, level string) []storage.RepoRecord {
			var filtered []storage.RepoRecord
			for _, r := range repos {
				if r.HealthLevel == level {
					filtered = append(filtered, r)
				}
			}
			return filtered
		},
		"heatmapLevel": func(count, maxLevels int) int {
			if count <= 0 {
				return 0
			}
			level := int(math.Ceil(float64(count) / float64(5)))
			if level < 1 {
				level = 1
			}
			if level > maxLevels {
				level = maxLevels
			}
			return level
		},
		"renderHealthBarSVG": func(stats []storage.RepoStats, width, height int) template.HTML {
			return template.HTML(RenderHealthBarSVG(stats, width, height, false))
		},
		"renderTrendSVG": func(stats []storage.RepoStats, width, height int) template.HTML {
			return template.HTML(RenderTrendSVG(stats, width, height, false))
		},
		"renderBusFactorBarSVG": func(alerts []storage.AlertRecord, width, height int) template.HTML {
			return template.HTML(RenderBusFactorBar(alerts, width, height, false))
		},
		"renderHealthBarSVGDark": func(stats []storage.RepoStats, width, height int) template.HTML {
			return template.HTML(RenderHealthBarSVG(stats, width, height, true))
		},
		"renderTrendSVGDark": func(stats []storage.RepoStats, width, height int) template.HTML {
			return template.HTML(RenderTrendSVG(stats, width, height, true))
		},
		"renderBusFactorBarSVGDark": func(alerts []storage.AlertRecord, width, height int) template.HTML {
			return template.HTML(RenderBusFactorBar(alerts, width, height, true))
		},
	}
	tmpl, err := template.New("").Funcs(funcMap).ParseGlob(filepath.Join(tmplDir, "*.html"))
	if err != nil {
		log.Printf("load templates failed: %v", err)
		g.tmpl = nil
		return err
	}
	g.tmpl = tmpl
	return nil
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
		return "", fmt.Errorf("report template not found, please create templates/report.html")
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
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBuf, _, err = page.PrintToPDF().
				WithPaperWidth(8.5).
				WithPaperHeight(11).
				WithMarginTop(0.4).
				WithMarginBottom(0.4).
				WithMarginLeft(0.4).
				WithMarginRight(0.4).
				WithPrintBackground(true).
				Do(ctx)
			return err
		}),
	); err != nil {
		return "", fmt.Errorf("chromedp print to pdf: %w", err)
	}

	if err := os.WriteFile(pdfPath, pdfBuf, 0644); err != nil {
		return "", fmt.Errorf("write pdf file: %w", err)
	}

	return pdfPath, nil
}
