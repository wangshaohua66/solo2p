package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"gopkg.in/yaml.v3"

	"github.com/security/vulnmonitor/internal/crawler"
	"github.com/security/vulnmonitor/internal/logger"
	"github.com/security/vulnmonitor/internal/matcher"
	"github.com/security/vulnmonitor/internal/notify"
	"github.com/security/vulnmonitor/internal/retry"
	"github.com/security/vulnmonitor/internal/storage"
	"github.com/security/vulnmonitor/internal/tui"
)

type AppConfig struct {
	Logger  logger.Config  `yaml:"logger"`
	Retry   retry.Config   `yaml:"retry"`
	Storage storage.Config `yaml:"storage"`
	Matcher matcher.Config `yaml:"matcher"`
	Crawler crawler.Config `yaml:"crawler"`
	Notify  notify.Config  `yaml:"notify"`
}

type AssetsConfig struct {
	Assets []*storage.Asset `yaml:"assets"`
}

type RulesConfig struct {
	Rules []matcher.Rule `yaml:"rules"`
}

var (
	configDir = flag.String("config", "configs", "configuration directory")
	dataDir   = flag.String("data", "data", "data directory")
	mode      = flag.String("mode", "tui", "run mode: tui|daemon|crawl|export|list|import")
	source    = flag.String("source", "", "crawl specific source ID")
	full      = flag.Bool("full", false, "full refresh instead of incremental")
	format    = flag.String("format", "json", "export format: json|csv")
	output    = flag.String("output", "", "output file path")
	severity  = flag.String("severity", "", "filter by severity: CRITICAL|HIGH|MEDIUM|LOW")
	limit     = flag.Int("limit", 50, "number of records to show")
)

func main() {
	flag.Parse()

	traceID := logger.NewTraceID()
	log := logger.Default().WithTraceID(traceID)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Info("shutdown signal received")
		cancel()
	}()

	cfg, err := loadConfig(*configDir)
	if err != nil {
		log.Errorf("failed to load config: %v", err)
		os.Exit(1)
	}

	log = logger.New(cfg.Logger).WithTraceID(traceID)
	defer log.Close()

	retryer := retry.New(cfg.Retry, log)

	store, err := storage.New(cfg.Storage, log, retryer)
	if err != nil {
		log.Errorf("failed to init storage: %v", err)
		os.Exit(1)
	}
	defer store.Close()

	if err := loadAssets(store, *configDir, log); err != nil {
		log.Warnf("failed to load assets: %v", err)
	}

	match := matcher.New(cfg.Matcher, log)
	if err := loadRules(match, *configDir, log); err != nil {
		log.Warnf("failed to load rules: %v", err)
	}

	notifier := notify.NewManager(cfg.Notify, log, retryer)

	crawlManager := crawler.NewManager(cfg.Crawler, log, retryer, store)

	switch *mode {
	case "tui":
		runTUI(ctx, store, log)
	case "daemon":
		runDaemon(ctx, crawlManager, match, notifier, store, log)
	case "crawl":
		runCrawl(ctx, crawlManager, match, notifier, store, log, *source, *full)
	case "export":
		runExport(ctx, store, log, *format, *output, *severity)
	case "list":
		runList(ctx, store, log, *severity, *limit)
	case "import":
		runImport(ctx, store, log, *configDir)
	default:
		fmt.Printf("Unknown mode: %s\n", *mode)
		fmt.Println("Available modes: tui, daemon, crawl, export, list, import")
		os.Exit(1)
	}
}

func loadConfig(dir string) (*AppConfig, error) {
	configPath := filepath.Join(dir, "config.yaml")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg AppConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	return &cfg, nil
}

func loadAssets(store *storage.Storage, dir string, log *logger.Logger) error {
	assetsPath := filepath.Join(dir, "assets.yaml")
	data, err := os.ReadFile(assetsPath)
	if err != nil {
		return fmt.Errorf("read assets: %w", err)
	}

	var cfg AssetsConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("parse assets: %w", err)
	}

	ctx := context.Background()
	for _, asset := range cfg.Assets {
		if asset.ID == "" {
			asset.ID = fmt.Sprintf("asset-%s-%s", asset.Component, asset.Version)
		}
		if err := store.SaveAsset(ctx, asset); err != nil {
			log.Warnf("failed to save asset %s: %v", asset.Name, err)
		}
	}

	log.Infof("loaded %d assets", len(cfg.Assets))
	return nil
}

func loadRules(m *matcher.Matcher, dir string, log *logger.Logger) error {
	rulesPath := filepath.Join(dir, "rules.yaml")
	data, err := os.ReadFile(rulesPath)
	if err != nil {
		return fmt.Errorf("read rules: %w", err)
	}

	var cfg RulesConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("parse rules: %w", err)
	}

	m.LoadRules(cfg.Rules)
	log.Infof("loaded %d rules", len(cfg.Rules))
	return nil
}

func runTUI(ctx context.Context, store *storage.Storage, log *logger.Logger) {
	log.Info("starting TUI mode")

	model := tui.NewModel(store, log)
	defer model.Close()

	p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseAllMotion())
	if _, err := p.Run(); err != nil {
		log.Errorf("TUI error: %v", err)
		os.Exit(1)
	}

	log.Info("TUI mode exited")
}

func runDaemon(ctx context.Context, cm *crawler.Manager, m *matcher.Matcher,
	n *notify.Manager, store *storage.Storage, log *logger.Logger) {

	log.Info("starting daemon mode")
	cm.Start()
	defer cm.Stop()

	go processResults(ctx, cm, m, n, store, log)

	dailyTicker := time.NewTicker(24 * time.Hour)
	defer dailyTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info("daemon shutting down")
			return
		case <-dailyTicker.C:
			vulns, _, _ := store.GetVulnerabilities(ctx, storage.SeverityLow, 1000, 0)
			if len(vulns) > 0 {
				n.SendDailyReport(ctx, vulns)
			}
		}
	}
}

func processResults(ctx context.Context, cm *crawler.Manager, m *matcher.Matcher,
	n *notify.Manager, store *storage.Storage, log *logger.Logger) {

	for result := range cm.Results() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if result.Error != nil {
			log.Errorf("crawl %s failed: %v", result.SourceName, result.Error)
			continue
		}

		assets, err := store.GetAssets(ctx)
		if err != nil {
			log.Warnf("failed to get assets: %v", err)
			continue
		}

		deduped := m.Deduplicate(result.Vulns)
		matches := m.BatchMatch(deduped, assets)

		newCount := 0
		notifiedCount := 0

		for _, match := range matches {
			select {
			case <-ctx.Done():
				return
			default:
			}

			v := match.Vuln
			created, err := store.SaveVulnerability(ctx, v)
			if err != nil {
				log.Warnf("failed to save vuln %s: %v", v.CVEID, err)
				continue
			}

			if created {
				newCount++
				if !v.Notified {
					if err := n.Notify(ctx, v); err == nil {
						notifiedCount++
						store.MarkNotified(ctx, v.ID, "multi")
					}
				}
			}
		}

		log.Infof("source %s: %d vulns, %d new, %d notified in %v",
			result.SourceName, len(result.Vulns), newCount, notifiedCount, result.Duration)
	}
}

func runCrawl(ctx context.Context, cm *crawler.Manager, m *matcher.Matcher,
	n *notify.Manager, store *storage.Storage, log *logger.Logger,
	sourceID string, fullRefresh bool) {

	log.Infof("starting one-time crawl, source=%s, full=%v", sourceID, fullRefresh)

	go processResults(ctx, cm, m, n, store, log)

	if sourceID != "" {
		cm.TriggerFetch(ctx, sourceID, fullRefresh)
	} else {
		cm.TriggerAll(ctx, fullRefresh)
	}

	timeout := time.After(30 * time.Minute)
	processed := 0
	total := len(cm.ListCrawlers())

	for processed < total {
		select {
		case <-ctx.Done():
			log.Info("crawl cancelled")
			return
		case <-timeout:
			log.Warn("crawl timed out")
			return
		case result := <-cm.Results():
			processed++
			log.Infof("crawl completed: %s, status=%s, vulns=%d, duration=%v",
				result.SourceName, result.Status, len(result.Vulns), result.Duration)
		}
	}

	log.Info("crawl completed successfully")
}

func runExport(ctx context.Context, store *storage.Storage, log *logger.Logger,
	format, output, severity string) {

	if output == "" {
		output = filepath.Join(*dataDir, fmt.Sprintf("vulns-export.%s", format))
	}

	sev := storage.Severity("")
	if severity != "" {
		sev = storage.Severity(strings.ToUpper(severity))
	}

	log.Infof("exporting vulnerabilities to %s (format=%s, severity=%s)", output, format, severity)

	if err := store.ExportVulnerabilities(ctx, format, output, sev); err != nil {
		log.Errorf("export failed: %v", err)
		os.Exit(1)
	}

	stats, _ := store.GetStats(ctx)
	fmt.Printf("Export completed: %s\n", output)
	fmt.Printf("Total vulnerabilities in DB: %d\n", stats["total_vulnerabilities"])
}

func runList(ctx context.Context, store *storage.Storage, log *logger.Logger, severity string, limit int) {
	sev := storage.Severity("")
	if severity != "" {
		sev = storage.Severity(strings.ToUpper(severity))
	}

	vulns, total, err := store.GetVulnerabilities(ctx, sev, limit, 0)
	if err != nil {
		log.Errorf("list failed: %v", err)
		os.Exit(1)
	}

	fmt.Printf("Vulnerabilities (showing %d/%d):\n", len(vulns), total)
	fmt.Println(strings.Repeat("=", 100))
	fmt.Printf("%-6s %-18s %-10s %-6s %-20s %s\n",
		"SEV", "CVE", "SCORE", "SOURCE", "COMPONENT", "TITLE")
	fmt.Println(strings.Repeat("-", 100))

	for _, v := range vulns {
		title := v.Title
		if len(title) > 40 {
			title = title[:37] + "..."
		}
		fmt.Printf("%-6s %-18s %-10.1f %-6s %-20s %s\n",
			v.Severity, v.CVEID, v.CVSSScore, v.Source, v.Component, title)
	}

	if j, err := json.MarshalIndent(vulns, "", "  "); err == nil {
		if *output != "" {
			os.WriteFile(*output, j, 0644)
			fmt.Printf("\nJSON saved to: %s\n", *output)
		}
	}
}

func runImport(ctx context.Context, store *storage.Storage, log *logger.Logger, configDir string) {
	log.Info("running import for assets and rules")
	if err := loadAssets(store, configDir, log); err != nil {
		log.Errorf("asset import failed: %v", err)
		os.Exit(1)
	}
	fmt.Println("Import completed successfully")
}
