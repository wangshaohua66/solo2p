package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/fatih/color"

	"github.com/gitmon/gitmon/internal/analyzer"
	"github.com/gitmon/gitmon/internal/cli"
	"github.com/gitmon/gitmon/internal/config"
	"github.com/gitmon/gitmon/internal/git"
	"github.com/gitmon/gitmon/internal/notify"
	"github.com/gitmon/gitmon/internal/report"
	"github.com/gitmon/gitmon/internal/server"
	"github.com/gitmon/gitmon/internal/storage"
	"github.com/gitmon/gitmon/internal/version"
)

type globalFlags struct {
	config  string
	output  string
	verbose bool
	help    bool
}

type scanFlags struct {
	*globalFlags
	full        bool
	concurrency int
	timeout     string
}

type reportFlags struct {
	*globalFlags
	format   string
	template string
}

type serveFlags struct {
	*globalFlags
	host string
	port int
}

type configFlags struct {
	*globalFlags
	init     bool
	validate bool
	show     bool
}

type notifyFlags struct {
	*globalFlags
	summary bool
	alertID string
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	for _, arg := range os.Args[1:] {
		if arg == "--version" {
			version.Print()
			os.Exit(0)
		}
		if arg == "-v" && len(os.Args) == 2 {
			version.Print()
			os.Exit(0)
		}
		if arg == "--help" || (arg == "-h" && len(os.Args) == 2) {
			printUsage()
			os.Exit(0)
		}
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "scan":
		os.Exit(runScan(args))
	case "report":
		os.Exit(runReport(args))
	case "serve":
		os.Exit(runServe(args))
	case "config":
		os.Exit(runConfig(args))
	case "notify":
		os.Exit(runNotify(args))
	case "-h", "--help":
		printUsage()
		os.Exit(0)
	default:
		if strings.HasPrefix(cmd, "-") {
			for _, arg := range args {
				if arg == "-h" || arg == "--help" {
					printUsage()
					os.Exit(0)
				}
			}
		}
		fmt.Printf("Unknown command: %s\n\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`gitmon - Git Repository Monitoring & Analytics Tool

Usage:
  gitmon <command> [flags] [args...]

Commands:
  scan      Scan git repositories and analyze metrics
  report    Generate analysis reports in multiple formats
  serve     Start local HTTP dashboard server
  config    Manage configuration
  notify    Send notifications for alerts and summaries
  help      Show this help message

Global Flags:
  --config <path>   Path to config file (default: ~/.gitmon/config.yaml)
  --output <path>   Output directory for generated files
  --verbose, -v     Enable verbose logging
  --help, -h        Show help for command
  --version         Show version information

Examples:
  gitmon scan all
  gitmon scan "service-*" --verbose
  gitmon report --format html --output ./reports
  gitmon serve --port 9876
  gitmon config init
  gitmon notify --summary

Environment Variables:
  GITMON_CONFIG      Path to config file
  GITMON_DATA_DIR    Data directory for storage
  GITMON_LOG_LEVEL   Log level (debug, info, warn, error)

Exit Codes:
  0   Success
  1   General error
  2   Invalid arguments
  3   Configuration error
  4   Scan error
  5   Database error`)
}

func parseGlobalFlags(args []string) (*globalFlags, []string) {
	gf := &globalFlags{}

	globalFlags := map[string]bool{
		"-config": true, "--config": true,
		"-output": true, "--output": true,
		"-verbose": true, "--verbose": true,
		"-v": true,
		"-help": true, "--help": true,
		"-h": true,
	}

	var remaining []string
	i := 0
	for i < len(args) {
		arg := args[i]
		if globalFlags[arg] {
			switch arg {
			case "-config", "--config":
				if i+1 < len(args) {
					gf.config = args[i+1]
					i += 2
				} else {
					i++
				}
			case "-output", "--output":
				if i+1 < len(args) {
					gf.output = args[i+1]
					i += 2
				} else {
					i++
				}
			case "-verbose", "--verbose", "-v":
				gf.verbose = true
				i++
			case "-help", "--help", "-h":
				gf.help = true
				i++
			default:
				remaining = append(remaining, arg)
				i++
			}
		} else {
			remaining = append(remaining, arg)
			i++
		}
	}
	return gf, remaining
}

func expandArgs(args []string) []string {
	var expanded []string
	for _, arg := range args {
		if strings.HasPrefix(arg, "~/") {
			home, err := os.UserHomeDir()
			if err == nil {
				arg = filepath.Join(home, strings.TrimPrefix(arg, "~/"))
			}
		}
		matches, err := filepath.Glob(arg)
		if err == nil && len(matches) > 0 {
			expanded = append(expanded, matches...)
		} else {
			expanded = append(expanded, arg)
		}
	}
	return expanded
}

func loadConfig(gf *globalFlags) (*config.Config, *config.Manager, error) {
	configPath := gf.config
	if configPath == "" {
		configPath = os.Getenv("GITMON_CONFIG")
	}
	if configPath == "" {
		p, err := config.GetDefaultPath()
		if err != nil {
			return nil, nil, fmt.Errorf("get default config path: %w", err)
		}
		configPath = p
	}

	ctx := context.Background()
	cm := config.NewManager(ctx, configPath)

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		fmt.Printf(color.YellowString("First run detected. Creating example config at %s\n", configPath))
		fmt.Printf(color.YellowString("Please edit the config file to add your repositories.\n\n"))
		if err := cm.SaveExample(); err != nil {
			return nil, nil, fmt.Errorf("create example config: %w", err)
		}
		fmt.Printf(color.GreenString("✓ Example config created at %s\n", configPath))
	}

	cfg, err := cm.Load()
	if err != nil {
		return nil, nil, fmt.Errorf("load config: %w", err)
	}

	if gf.verbose {
		log.Printf("Loaded config from %s", configPath)
		log.Printf("Configured repositories: %d", len(cfg.Repos))
	}

	for i := range cfg.Repos {
		cfg.Repos[i].Path = analyzer.ExpandPath(cfg.Repos[i].Path)
	}

	return cfg, cm, nil
}

func openStorage(cfg *config.Config, verbose bool) (*storage.Store, error) {
	if verbose {
		log.Printf("Opening database at %s", cfg.Database)
	}

	if err := os.MkdirAll(filepath.Dir(cfg.Database), 0755); err != nil {
		return nil, fmt.Errorf("create database dir: %w", err)
	}

	store, err := storage.Open(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	return store, nil
}

func runScan(args []string) int {
	gf, remaining := parseGlobalFlags(args)

	sf := &scanFlags{globalFlags: gf}
	fs := flag.NewFlagSet("scan", flag.ContinueOnError)
	fs.BoolVar(&sf.full, "full", false, "full scan (ignore incremental)")
	fs.IntVar(&sf.concurrency, "concurrency", 0, "scan concurrency override")
	fs.StringVar(&sf.timeout, "timeout", "", "scan timeout override")
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(remaining); err != nil {
		return 2
	}

	if gf.help {
		fmt.Println(`Usage: gitmon scan [flags] [patterns...]

Scan git repositories and analyze metrics.

Patterns:
  Glob patterns to match repository names (e.g., "service-*").
  If no patterns given, scans all configured repositories.

Flags:
  --full               Full scan (ignore incremental)
  --concurrency <n>    Override concurrency setting
  --timeout <dur>      Override scan timeout (e.g., "10m")
  --config <path>      Path to config file
  --verbose, -v        Enable verbose logging
  --help, -h           Show this help

Exit Codes:
  0   Success
  4   Scan error (some repos failed)
  5   Database error

Examples:
  gitmon scan
  gitmon scan all --verbose
  gitmon scan "api-*" --full
  gitmon scan user-service order-service --timeout 10m`)
		return 0
	}

	cfg, cm, err := loadConfig(gf)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 3
	}
	defer cm.Close()

	if sf.full {
		cfg.Scan.Incremental = false
	}
	if sf.concurrency > 0 {
		cfg.Scan.Concurrency = sf.concurrency
	}
	if sf.timeout != "" {
		cfg.Scan.Timeout = sf.timeout
	}

	store, err := openStorage(cfg, gf.verbose)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 5
	}
	defer store.Close()

	an := analyzer.New(store, cfg)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\nInterrupted. Shutting down...")
		cancel()
	}()

	patterns := expandArgs(fs.Args())
	if gf.verbose {
		log.Printf("Scanning %d repositories with concurrency %d", len(cfg.Repos), cfg.Scan.Concurrency)
	}

	fmt.Println(color.CyanString("🚀 Starting repository scan..."))
	fmt.Println(color.CyanString("─────────────────────────────────────────────"))

	results, err := an.ScanAll(ctx, patterns)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Scan failed: %v", err))
		return 4
	}

	t := cli.NewTableWriter()
	t.Header("REPOSITORY", "STATUS", "COMMITS", "TIME", "MESSAGE")
	t.Header("──────────", "──────", "───────", "────", "───────")

	success := 0
	failed := 0

	for _, r := range results {
		status := color.GreenString("✓ OK")
		msg := ""
		if !r.Success {
			status = color.RedString("✗ FAIL")
			msg = r.Error
			failed++
		} else {
			success++
		}

		t.Row(
			r.RepoName,
			status,
			r.Commits,
			r.Elapsed.Round(time.Millisecond),
			msg,
		)
	}
	t.Flush()

	fmt.Println()
	fmt.Println(color.CyanString("─────────────────────────────────────────────"))
	fmt.Printf(color.GreenString("✓ Success: %d"), success)
	if failed > 0 {
		fmt.Printf(color.RedString("  ✗ Failed: %d"), failed)
	}
	fmt.Println()

	if failed > 0 {
		return 4
	}
	return 0
}

func runReport(args []string) int {
	gf, remaining := parseGlobalFlags(args)

	rf := &reportFlags{globalFlags: gf}
	fs := flag.NewFlagSet("report", flag.ContinueOnError)
	fs.StringVar(&rf.format, "format", "html", "report format (html, json, pdf)")
	fs.StringVar(&rf.template, "template", "", "custom template path")
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(remaining); err != nil {
		return 2
	}

	if gf.help {
		fmt.Println(`Usage: gitmon report [flags] [repos...]

Generate analysis reports in multiple formats.

Flags:
  --format <fmt>       Report format: html, json, pdf (default: html)
  --template <path>    Custom Go template for HTML reports
  --output <dir>       Output directory (default: current dir)
  --config <path>      Path to config file
  --verbose, -v        Enable verbose logging
  --help, -h           Show this help

Examples:
  gitmon report --format html
  gitmon report --format json --output ./reports
  gitmon report service-a service-b --format pdf`)
		return 0
	}

	cfg, cm, err := loadConfig(gf)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 3
	}
	defer cm.Close()

	store, err := openStorage(cfg, gf.verbose)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 5
	}
	defer store.Close()

	an := analyzer.New(store, cfg)
	gen := report.New(an, store)

	outputDir := gf.output
	if outputDir == "" {
		outputDir = "."
	}

	patterns := expandArgs(fs.Args())

	fmt.Printf(color.CyanString("📊 Generating %s report...\n"), strings.ToUpper(rf.format))

	path, err := gen.Generate(report.ReportConfig{
		Format:     rf.format,
		OutputDir:  outputDir,
		Template:   rf.template,
		RepoFilter: patterns,
	})

	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Report generation failed: %v", err))
		return 1
	}

	fmt.Println(color.GreenString("✓ Report generated: %s", path))
	return 0
}

func runServe(args []string) int {
	gf, remaining := parseGlobalFlags(args)

	sf := &serveFlags{globalFlags: gf}
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	fs.StringVar(&sf.host, "host", "", "server host override")
	fs.IntVar(&sf.port, "port", 0, "server port override")
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(remaining); err != nil {
		return 2
	}

	if gf.help {
		fmt.Println(`Usage: gitmon serve [flags]

Start local HTTP dashboard server.

Flags:
  --host <host>        Server host override (default: localhost)
  --port <port>        Server port override (default: 9876)
  --config <path>      Path to config file
  --verbose, -v        Enable verbose logging
  --help, -h           Show this help

Endpoints:
  GET  /                          Dashboard UI
  GET  /api/v1/health            Health check
  GET  /api/v1/stats             Repository statistics
  GET  /api/v1/repos             List repositories
  GET  /api/v1/repos/:name       Repository details
  GET  /api/v1/alerts            Active alerts
  GET  /api/v1/contributors/ranking  Contributor ranking

Examples:
  gitmon serve
  gitmon serve --port 8080 --host 0.0.0.0`)
		return 0
	}

	cfg, cm, err := loadConfig(gf)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 3
	}
	defer cm.Close()

	if sf.host != "" {
		cfg.Server.Host = sf.host
	}
	if sf.port > 0 {
		cfg.Server.Port = sf.port
	}

	store, err := openStorage(cfg, gf.verbose)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 5
	}
	defer store.Close()

	an := analyzer.New(store, cfg)
	srv := server.New(cfg, store, an)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\nShutting down server...")
		cancel()
	}()

	addr := fmt.Sprintf("http://%s", srv.GetAddr())
	fmt.Println(color.CyanString("🚀 GitMon Dashboard Server"))
	fmt.Println(color.CyanString("────────────────────────────────────"))
	fmt.Printf("Listening on: %s\n", color.BlueString(addr))
	fmt.Printf("API Base:     %s/api/v1\n", color.BlueString(addr))
	fmt.Println()
	fmt.Println("Press Ctrl+C to stop")
	fmt.Println()

	if err := srv.Start(ctx); err != nil && err != context.Canceled {
		fmt.Fprintln(os.Stderr, color.RedString("Server error: %v", err))
		return 1
	}

	return 0
}

func runConfig(args []string) int {
	gf, remaining := parseGlobalFlags(args)

	cf := &configFlags{globalFlags: gf}
	fs := flag.NewFlagSet("config", flag.ContinueOnError)
	fs.BoolVar(&cf.init, "init", false, "initialize example config")
	fs.BoolVar(&cf.validate, "validate", false, "validate current config")
	fs.BoolVar(&cf.show, "show", false, "show current config")
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(remaining); err != nil {
		return 2
	}

	if gf.help || (!cf.init && !cf.validate && !cf.show) {
		fmt.Println(`Usage: gitmon config <command> [flags]

Manage gitmon configuration.

Commands:
  init      Create example config file
  validate  Validate current config file
  show      Show current effective config

Flags:
  --config <path>      Path to config file
  --help, -h           Show this help

Examples:
  gitmon config init
  gitmon config validate
  gitmon config show
  gitmon config show --config ~/custom-config.yaml`)

		if !cf.init && !cf.validate && !cf.show {
			return 2
		}
		return 0
	}

	configPath := gf.config
	if configPath == "" {
		configPath = os.Getenv("GITMON_CONFIG")
	}
	if configPath == "" {
		p, err := config.GetDefaultPath()
		if err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
			return 3
		}
		configPath = p
	}

	ctx := context.Background()
	cm := config.NewManager(ctx, configPath)
	defer cm.Close()

	switch {
	case cf.init:
		if _, err := os.Stat(configPath); err == nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error: config file already exists: %s", configPath))
			return 3
		}
		if err := cm.SaveExample(); err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error creating config: %v", err))
			return 3
		}
		fmt.Println(color.GreenString("✓ Example config created at: %s"), configPath)
		fmt.Println()
		fmt.Println("Please edit the config file to add your repositories.")
		return 0

	case cf.validate:
		cfg, err := cm.Load()
		if err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("✗ Config validation failed: %v", err))
			return 3
		}
		if err := cfg.Validate(); err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("✗ Config validation failed: %v", err))
			return 3
		}
		fmt.Println(color.GreenString("✓ Config validation passed"))
		fmt.Printf("  Config file: %s\n", configPath)
		fmt.Printf("  Repositories: %d\n", len(cfg.Repos))
		fmt.Printf("  Scan concurrency: %d\n", cfg.Scan.Concurrency)
		return 0

	case cf.show:
		cfg, err := cm.Load()
		if err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
			return 3
		}

		fmt.Println(color.CyanString("📋 Current Configuration"))
		fmt.Println(color.CyanString("──────────────────────────────"))
		fmt.Printf("Config file: %s\n\n", configPath)

		data, _ := json.MarshalIndent(cfg, "", "  ")
		fmt.Println(string(data))
		return 0
	}

	return 0
}

func runNotify(args []string) int {
	gf, remaining := parseGlobalFlags(args)

	nf := &notifyFlags{globalFlags: gf}
	fs := flag.NewFlagSet("notify", flag.ContinueOnError)
	fs.BoolVar(&nf.summary, "summary", false, "send daily summary")
	fs.StringVar(&nf.alertID, "alert-id", "", "send specific alert")
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(remaining); err != nil {
		return 2
	}

	if gf.help || (!nf.summary && nf.alertID == "") {
		fmt.Println(`Usage: gitmon notify [flags]

Send notifications via configured webhooks (Feishu/Dingtalk).

Flags:
  --summary            Send daily summary notification
  --alert-id <id>      Send specific alert by ID
  --config <path>      Path to config file
  --verbose, -v        Enable verbose logging
  --help, -h           Show this help

Examples:
  gitmon notify --summary
  gitmon notify --alert-id abc123`)

		if !nf.summary && nf.alertID == "" {
			return 2
		}
		return 0
	}

	cfg, cm, err := loadConfig(gf)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 3
	}
	defer cm.Close()

	store, err := openStorage(cfg, gf.verbose)
	if err != nil {
		fmt.Fprintln(os.Stderr, color.RedString("Error: %v", err))
		return 5
	}
	defer store.Close()

	an := analyzer.New(store, cfg)
	notifier := notify.NewManager(cfg)

	switch {
	case nf.summary:
		stats, err := an.GetAllStats()
		if err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error getting stats: %v", err))
			return 1
		}

		alerts, err := an.GetAllAlerts()
		if err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error getting alerts: %v", err))
			return 1
		}

		fmt.Println(color.CyanString("📤 Sending summary notification..."))

		if err := notifier.SendSummary(stats, alerts); err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error sending notification: %v", err))
			return 1
		}

		fmt.Println(color.GreenString("✓ Summary notification sent"))
		printSummaryStats(stats, alerts)
		return 0

	case nf.alertID != "":
		alerts, err := an.GetAllAlerts()
		if err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error getting alerts: %v", err))
			return 1
		}

		var alert *storage.AlertRecord
		for i := range alerts {
			if alerts[i].ID == nf.alertID {
				alert = &alerts[i]
				break
			}
		}

		if alert == nil {
			fmt.Fprintln(os.Stderr, color.RedString("Alert not found: %s", nf.alertID))
			return 1
		}

		fmt.Printf(color.CyanString("📤 Sending alert notification: %s...\n"), alert.Type)

		if err := notifier.SendAlert(alert); err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error sending notification: %v", err))
			return 1
		}

		fmt.Println(color.GreenString("✓ Alert notification sent"))
		return 0
	}

	return 0
}

func printSummaryStats(stats []storage.RepoStats, alerts []storage.AlertRecord) {
	t := cli.NewTableWriter()

	sort.Slice(stats, func(i, j int) bool {
		return stats[i].HealthScore < stats[j].HealthScore
	})

	t.Header("REPOSITORY", "HEALTH", "SILENT DAYS", "ALERTS")
	for _, s := range stats {
		level := git.HealthLevel(s.HealthLevel)
		healthColor := color.New(color.FgGreen).SprintFunc()
		if level == git.HealthWarning {
			healthColor = color.New(color.FgYellow).SprintFunc()
		} else if level == git.HealthCritical {
			healthColor = color.New(color.FgRed).SprintFunc()
		}

		silentColor := color.New(color.FgWhite).SprintFunc()
		if s.SilentDays >= 60 {
			silentColor = color.New(color.FgRed).SprintFunc()
		} else if s.SilentDays >= 30 {
			silentColor = color.New(color.FgYellow).SprintFunc()
		}

		alertCount := 0
		for _, a := range alerts {
			if a.RepoName == s.RepoName {
				alertCount++
			}
		}

		t.Row(
			s.RepoName,
			fmt.Sprintf("%s (%.0f)", healthColor(level.String()), s.HealthScore),
			silentColor(fmt.Sprintf("%d", s.SilentDays)),
			alertCount,
		)
	}
	t.Flush()
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
