package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"drugvigil/config"
	"drugvigil/crawler"
	"drugvigil/notifier"
	"drugvigil/parser"
	"drugvigil/store"
)

var (
	cfgPath     string
	verboseFlag bool
	dryRunFlag  bool
)

type App struct {
	cfg        *config.Config
	logger     *zap.Logger
	store      *store.Store
	pool       *crawler.BrowserPool
	authMgr    *crawler.AuthManager
	normalizer *parser.Normalizer
	notifier   *notifier.WeChatNotifier
	cron       *cron.Cron
	mu         sync.Mutex
}

func main() {
	rootCmd := &cobra.Command{
		Use:   "drugvigil",
		Short: "药品安全警戒监控系统",
		Long:  "持续监控全球药品监管机构网站，抓取不良反应报告并推送预警",
	}

	rootCmd.PersistentFlags().StringVarP(&cfgPath, "config", "c", "config.yaml", "配置文件路径")
	rootCmd.PersistentFlags().BoolVarP(&verboseFlag, "verbose", "v", false, "详细输出模式")
	rootCmd.PersistentFlags().BoolVar(&dryRunFlag, "dry-run", false, "模拟执行模式，不实际抓取")

	rootCmd.AddCommand(initCmd())
	rootCmd.AddCommand(runCmd())
	rootCmd.AddCommand(statusCmd())
	rootCmd.AddCommand(notifyTestCmd())
	rootCmd.AddCommand(historyCmd())

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}

func initCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "初始化配置和Cookie",
		RunE: func(cmd *cobra.Command, args []string) error {
			app, err := setupApp()
			if err != nil {
				return err
			}
			defer app.cleanup()

			if err := app.initConfig(); err != nil {
				return fmt.Errorf("init config: %w", err)
			}

			if err := app.initCookies(); err != nil {
				return fmt.Errorf("init cookies: %w", err)
			}

			fmt.Println("✅ 初始化完成")
			return nil
		},
	}
}

func runCmd() *cobra.Command {
	var onceFlag bool

	cmd := &cobra.Command{
		Use:   "run",
		Short: "启动抓取调度",
		RunE: func(cmd *cobra.Command, args []string) error {
			app, err := setupApp()
			if err != nil {
				return err
			}
			defer app.cleanup()

			if onceFlag {
				return app.runOnce()
			}

			return app.runScheduler()
		},
	}

	cmd.Flags().BoolVar(&onceFlag, "once", false, "只执行一次抓取")
	return cmd
}

func statusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "查看各站点抓取状态统计",
		RunE: func(cmd *cobra.Command, args []string) error {
			app, err := setupApp()
			if err != nil {
				return err
			}
			defer app.cleanup()

			return app.showStatus()
		},
	}
}

func notifyTestCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "notify-test",
		Short: "测试推送通道",
		RunE: func(cmd *cobra.Command, args []string) error {
			app, err := setupApp()
			if err != nil {
				return err
			}
			defer app.cleanup()

			if err := app.notifier.TestNotification(); err != nil {
				return fmt.Errorf("test notification: %w", err)
			}

			fmt.Println("✅ 测试推送已发送")
			return nil
		},
	}
}

func historyCmd() *cobra.Command {
	var limit int

	cmd := &cobra.Command{
		Use:   "history",
		Short: "查看历史预警",
		RunE: func(cmd *cobra.Command, args []string) error {
			app, err := setupApp()
			if err != nil {
				return err
			}
			defer app.cleanup()

			return app.showHistory(limit)
		},
	}

	cmd.Flags().IntVarP(&limit, "limit", "n", 20, "显示记录数量")
	return cmd
}

func setupApp() (*App, error) {
	cfg, err := config.Load(cfgPath)
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	if verboseFlag {
		cfg.App.Verbose = true
	}
	if dryRunFlag {
		cfg.App.DryRun = true
	}

	logger, err := setupLogger(cfg)
	if err != nil {
		return nil, fmt.Errorf("setup logger: %w", err)
	}

	st, err := store.New(cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("setup store: %w", err)
	}

	authMgr := crawler.NewAuthManager(cfg, logger)
	pool := crawler.NewBrowserPool(&cfg.Pool, logger, authMgr)
	normalizer := parser.NewNormalizer(cfg, logger)
	notifier := notifier.NewWeChatNotifier(cfg, logger, st, normalizer)

	return &App{
		cfg:        cfg,
		logger:     logger,
		store:      st,
		pool:       pool,
		authMgr:    authMgr,
		normalizer: normalizer,
		notifier:   notifier,
	}, nil
}

func setupLogger(cfg *config.Config) (*zap.Logger, error) {
	level := zapcore.InfoLevel
	switch cfg.Log.Level {
	case "debug":
		level = zapcore.DebugLevel
	case "warn":
		level = zapcore.WarnLevel
	case "error":
		level = zapcore.ErrorLevel
	}

	if cfg.App.Verbose {
		level = zapcore.DebugLevel
	}

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.TimeKey = "time"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	core := zapcore.NewCore(
		zapcore.NewConsoleEncoder(encoderConfig),
		zapcore.AddSync(os.Stdout),
		level,
	)

	return zap.New(core, zap.AddCaller()), nil
}

func (a *App) cleanup() {
	if a.cron != nil {
		a.cron.Stop()
	}
	if a.pool != nil {
		a.pool.Stop()
	}
	if a.store != nil {
		a.store.Close()
	}
	if a.logger != nil {
		a.logger.Sync()
	}
}

func (a *App) initConfig() error {
	a.logger.Info("initializing configuration",
		zap.String("data_dir", a.cfg.App.DataDir))

	dirs := []string{
		filepath.Join(a.cfg.App.DataDir, "cookies"),
		filepath.Join(a.cfg.App.DataDir, "pdf"),
		filepath.Join(a.cfg.App.DataDir, "boltdb"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create dir %s: %w", dir, err)
		}
	}

	for _, site := range a.cfg.Sites {
		if site.Auth.Required {
			if err := a.authMgr.InitCookies(&site); err != nil {
				a.logger.Warn("init cookie file failed",
					zap.String("site", site.Code),
					zap.Error(err))
			}
		}
		pdfDir := filepath.Join(a.cfg.App.DataDir, "pdf", site.Code)
		os.MkdirAll(pdfDir, 0755)
	}

	a.logger.Info("configuration initialized")
	return nil
}

func (a *App) initCookies() error {
	a.logger.Info("initializing cookies for authenticated sites")

	ctx := context.Background()
	if err := a.pool.Start(ctx); err != nil {
		return fmt.Errorf("start pool: %w", err)
	}

	for _, site := range a.cfg.Sites {
		if site.Auth.Required {
			a.logger.Info("please login manually",
				zap.String("site", site.Code),
				zap.String("login_url", site.Auth.LoginURL))
		}
	}

	return nil
}

func (a *App) runOnce() error {
	a.logger.Info("running single crawl cycle")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := a.pool.Start(ctx); err != nil {
		return fmt.Errorf("start pool: %w", err)
	}

	a.pool.SetProgressCallback(a.progressCallback)

	return a.executeCrawlCycle(ctx)
}

func (a *App) runScheduler() error {
	a.logger.Info("starting scheduler",
		zap.String("cron", a.cfg.Schedule.CronExpr))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := a.pool.Start(ctx); err != nil {
		return fmt.Errorf("start pool: %w", err)
	}

	a.pool.SetProgressCallback(a.progressCallback)

	c := cron.New(cron.WithSeconds())
	a.cron = c

	_, err := c.AddFunc(a.cfg.Schedule.CronExpr, func() {
		a.logger.Info("cron triggered crawl cycle")
		if err := a.executeCrawlCycle(ctx); err != nil {
			a.logger.Error("crawl cycle failed", zap.Error(err))
		}
	})
	if err != nil {
		return fmt.Errorf("add cron job: %w", err)
	}

	c.Start()
	a.logger.Info("scheduler started, waiting for signals")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	<-sigCh
	a.logger.Info("received shutdown signal")

	return nil
}

func (a *App) executeCrawlCycle(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	startTime := time.Now()
	a.logger.Info("starting crawl cycle")

	enabledSites := make([]*config.SiteConfig, 0)
	for i := range a.cfg.Sites {
		if a.cfg.Sites[i].Enabled {
			enabledSites = append(enabledSites, &a.cfg.Sites[i])
		}
	}

	a.logger.Info("enabled sites", zap.Int("count", len(enabledSites)))

	tasks := make([]*crawler.CrawlTask, 0, len(enabledSites))
	for _, site := range enabledSites {
		task := &crawler.CrawlTask{
			Site:     site,
			Priority: 1,
			Result:   make(chan *crawler.CrawlResult, 1),
			Error:    make(chan error, 1),
		}
		tasks = append(tasks, task)
		a.pool.Submit(task)
	}

	totalRecords := int64(0)
	totalAlerts := 0
	var cycleErrs []error

	for _, task := range tasks {
		select {
		case result := <-task.Result:
			a.logger.Info("site crawl completed",
				zap.String("site", result.SiteCode),
				zap.Int64("records", result.Count),
				zap.Int("page", result.Page),
				zap.Duration("duration", result.Duration))

			newRecords, err := a.processRecords(result)
			if err != nil {
				cycleErrs = append(cycleErrs, err)
				continue
			}

			totalRecords += result.Count
			totalAlerts += len(newRecords)

			crawlState, _ := a.store.GetCrawlState(result.SiteCode)
			crawlState.LastPage = result.Page
			crawlState.LastSuccess = time.Now()
			crawlState.TotalRecords += result.Count
			crawlState.FailCount = 0
			a.store.SaveCrawlState(crawlState)

			a.store.UpdateStats(result.SiteCode, result.Duration, result.Count)

		case err := <-task.Error:
			a.logger.Error("site crawl failed",
				zap.String("site", task.Site.Code),
				zap.Error(err))
			cycleErrs = append(cycleErrs, err)

			crawlState, _ := a.store.GetCrawlState(task.Site.Code)
			crawlState.FailCount++
			crawlState.LastError = err.Error()
			a.store.SaveCrawlState(crawlState)
		}
	}

	duration := time.Since(startTime)
	a.logger.Info("crawl cycle completed",
		zap.Int64("total_records", totalRecords),
		zap.Int("alerts", totalAlerts),
		zap.Duration("duration", duration),
		zap.Int("errors", len(cycleErrs)))

	if len(cycleErrs) > 0 {
		return fmt.Errorf("cycle completed with errors: %v", cycleErrs)
	}

	return nil
}

func (a *App) processRecords(result *crawler.CrawlResult) ([]*parser.NormalizedRecord, error) {
	normalized := a.normalizer.BatchNormalize(result.Records)

	var toAlert []*parser.NormalizedRecord

	for _, record := range normalized {
		isNew, isModified, err := a.store.SaveRecord(&record.SecurityRecord)
		if err != nil {
			a.logger.Warn("save record failed",
				zap.String("record_id", record.ID),
				zap.Error(err))
			continue
		}

		record.IsNew = isNew
		record.IsModified = isModified

		if !isNew && !isModified {
			continue
		}
		toAlert = append(toAlert, record)
	}

	relevant := a.normalizer.FilterRelevant(toAlert)

	if len(relevant) > 0 && !a.cfg.App.DryRun {
		a.logger.Info("sending alerts",
			zap.Int("count", len(relevant)),
			zap.String("site", result.SiteCode))

		if err := a.notifier.BatchNotify(relevant); err != nil {
			a.logger.Error("batch notify failed", zap.Error(err))
		}
	}

	return relevant, nil
}

func (a *App) progressCallback(p *crawler.CrawlProgress) {
	fmt.Printf("\r\033[K[%s] 页码:%d 已抓:%d 耗时:%v 状态:%s",
		p.SiteName, p.CurrentPage, p.Fetched, p.Elapsed.Round(time.Second), p.Status)
	if p.Error != "" {
		fmt.Printf(" 错误:%s", p.Error)
	}
	if p.Elapsed > 0 && p.CurrentPage > 0 {
		fmt.Println()
	}
}

func (a *App) showStatus() error {
	fmt.Println("\n📊 抓取状态统计")
	fmt.Println(strings.Repeat("=", 80))

	stats, err := a.store.GetStats()
	if err != nil {
		return fmt.Errorf("get stats: %w", err)
	}

	poolStats := a.pool.GetStats()

	fmt.Printf("\n浏览器池状态:\n")
	fmt.Printf("  活动实例: %d | 空闲实例: %d | 总实例: %d\n",
		poolStats.ActiveInstances, poolStats.IdleInstances,
		poolStats.ActiveInstances+poolStats.IdleInstances)
	fmt.Printf("  任务队列: %d | 已完成: %d | 失败: %d\n",
		poolStats.TasksQueued, poolStats.TasksCompleted, poolStats.TasksFailed)
	fmt.Printf("  估算内存: %d MB\n\n", poolStats.TotalMemoryMB)

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "站点\t状态\t今日\t本周\t总计\t最后抓取\t平均耗时")
	fmt.Fprintln(w, "----\t----\t----\t----\t----\t--------\t--------")

	for _, site := range a.cfg.Sites {
		status := "✅"
		if !site.Enabled {
			status = "⏸️"
		}

		st := stats[site.Code]
		if st == nil {
			st = &store.SiteStats{}
		}

		crawlState, _ := a.store.GetCrawlState(site.Code)
		if crawlState.FailCount > 2 {
			status = "❌"
		}

		lastCrawl := "未执行"
		if !st.LastCrawl.IsZero() {
			lastCrawl = st.LastCrawl.Format("01-02 15:04")
		}

		fmt.Fprintf(w, "%s(%s)\t%s\t%d\t%d\t%d\t%s\t%v\n",
			site.Name, site.Code, status,
			st.TodayCount, st.WeekCount, st.TotalCount,
			lastCrawl, st.AvgDuration.Round(time.Second))
	}

	w.Flush()

	total, _ := a.store.GetTotalRecords()
	fmt.Printf("\n📈 数据库总记录: %d\n", total)

	return nil
}

func (a *App) showHistory(limit int) error {
	fmt.Println("\n📋 历史预警记录")
	fmt.Println(strings.Repeat("=", 100))

	alerts, err := a.store.ListAlerts(limit)
	if err != nil {
		return fmt.Errorf("list alerts: %w", err)
	}

	if len(alerts) == 0 {
		fmt.Println("暂无历史预警记录")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "时间\t级别\t药品\t不良反应\t来源\t通道")
	fmt.Fprintln(w, "----\t----\t----\t--------\t----\t----")

	for _, alert := range alerts {
		level := a.normalizer.GetSeverityEmoji(alert.AlertLevel) +
			" " + a.normalizer.GetSeverityLabel(alert.AlertLevel)

		record, _ := a.store.GetRecord(alert.RecordID)
		drug := "未知"
		event := "未知"
		source := "未知"
		if record != nil {
			drug = record.DrugName
			event = record.AdverseEvent
			source = record.SourceAgency
		}

		if len(event) > 20 {
			event = event[:20] + "..."
		}

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%v\n",
			alert.SentAt.Format("01-02 15:04"),
			level,
			drug,
			event,
			source,
			alert.Channels)
	}

	w.Flush()
	fmt.Printf("\n共 %d 条记录\n", len(alerts))

	return nil
}
