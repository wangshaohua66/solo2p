package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bankrupt-monitor/internal/config"
	"bankrupt-monitor/internal/crawler"
	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/notify"
	"bankrupt-monitor/internal/scheduler"
	"bankrupt-monitor/internal/store"

	"github.com/gosuri/uilive"
	"go.uber.org/zap"
)

const CollectMaxPage = 100

type CollectFlags struct {
	FullScan bool
	Watch    bool
	Court    string
	FromDate string
	ToDate   string
	Page     int
}

func RunCollect(configPath string, f *CollectFlags) error {
	cfg, log, db, err := bootstrap(configPath, f.Watch)
	if err != nil {
		return err
	}
	defer log.Sync()
	defer db.Close()

	if f.Page > CollectMaxPage {
		return fmt.Errorf("page %d exceeds maximum %d (avoid deep pagination)", f.Page, CollectMaxPage)
	}

	engine, err := crawler.NewEngine(cfg, db, log)
	if err != nil {
		return fmt.Errorf("init crawler: %w", err)
	}
	disp := notify.NewDispatcher(&cfg.Notify, log)
	sched := scheduler.NewScheduler(cfg, db, engine, disp, log)

	if f.Court != "" {
		found := false
		for i := range cfg.Courts {
			if cfg.Courts[i].Name == f.Court {
				cfg.Courts = []config.CourtConfig{cfg.Courts[i]}
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("court %q not found in config", f.Court)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Fprintln(os.Stderr, "\n收到退出信号，正在停止...")
		cancel()
	}()

	writer := uilive.New()
	writer.Start()
	defer writer.Stop()

	sched.SetProgressHandler(func(court string, stats *model.CrawlStats, currentURL string) {
		fmt.Fprintf(writer, "法院: %-20s  已处理: %5d  新增: %5d  错误: %3d  用时: %s\n",
			court, stats.ProcessedCount, stats.NewCount, stats.ErrorCount, stats.ElapsedStr())
		if currentURL != "" {
			fmt.Fprintf(writer.Newline(), "  当前: %s\n", truncateURL(currentURL, 80))
		}
	})

	fmt.Fprintf(os.Stderr, "开始抓取 (全量=%v)...\n", f.FullScan)
	start := time.Now()

	if f.FullScan {
		err = sched.RunFull(ctx)
	} else {
		err = sched.RunIncremental(ctx)
	}

	elapsed := time.Since(start).Round(time.Second)
	if err != nil {
		fmt.Fprintf(os.Stderr, "抓取完成 (用时 %s)，存在错误: %v\n", elapsed, err)
	} else {
		fmt.Fprintf(os.Stderr, "抓取完成，用时 %s\n", elapsed)
	}

	total := int64(0)
	for _, s := range sched.Stats() {
		total += s.ProcessedCount
	}
	fmt.Fprintf(os.Stderr, "总处理: %d 条公告\n", total)
	return nil
}

func truncateURL(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func bootstrap(configPath string, watch bool) (*config.AppConfig, *zap.Logger, *store.Store, error) {
	c := config.GetConfig()
	if err := c.Load(configPath, watch); err != nil {
		return nil, nil, nil, fmt.Errorf("load config: %w", err)
	}
	log, err := c.InitLogger()
	if err != nil {
		return nil, nil, nil, fmt.Errorf("init logger: %w", err)
	}
	cfg := c.Get()
	db, err := store.NewStore(cfg.Store.DBPath, log)
	if err != nil {
		log.Sync()
		return nil, nil, nil, fmt.Errorf("open store: %w", err)
	}
	return cfg, log, db, nil
}
