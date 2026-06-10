package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"bankrupt-monitor/cmd"
	"bankrupt-monitor/internal/config"
	"bankrupt-monitor/internal/crawler"
	"bankrupt-monitor/internal/notify"
	"bankrupt-monitor/internal/scheduler"
	"bankrupt-monitor/internal/store"

	"go.uber.org/zap"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	var (
		configPath string
		watch      bool
	)

	collectCmd := flag.NewFlagSet("collect", flag.ExitOnError)
	collectCmd.StringVar(&configPath, "config", "", "配置文件路径")
	collectCmd.BoolVar(&watch, "watch", false, "监听配置文件变更")
	fullScan := collectCmd.Bool("full", false, "执行全量抓取 (默认增量)")

	queryCmd := flag.NewFlagSet("query", flag.ExitOnError)
	queryCmd.StringVar(&configPath, "config", "", "配置文件路径")
	qKeyword := queryCmd.String("filter", "", "关键词过滤 (债务人/案号/法院)")
	qCourt := queryCmd.String("court", "", "按法院过滤")
	qDebtor := queryCmd.String("debtor", "", "按债务人过滤")
	qCase := queryCmd.String("case", "", "按案号过滤")
	qType := queryCmd.String("type", "", "类型: reorganization/liquidation/claim_notice/meeting")
	qFrom := queryCmd.String("from", "", "起始日期 YYYY-MM-DD")
	qTo := queryCmd.String("to", "", "结束日期 YYYY-MM-DD")
	qSort := queryCmd.String("sort", "created_at", "排序字段")
	qOrder := queryCmd.String("order", "desc", "排序方向 asc/desc")
	qPage := queryCmd.Int("page", 1, "页码")
	qSize := queryCmd.Int("page-size", 20, "每页数量")
	qJSON := queryCmd.Bool("json", false, "JSON 输出")
	qHit := queryCmd.Bool("hit-only", false, "仅显示告警命中")
	qRead := queryCmd.String("read", "", "已读状态: 1/0")
	qHighlight := queryCmd.Bool("highlight", false, "关键词高亮")

	exportCmd := flag.NewFlagSet("export", flag.ExitOnError)
	exportCmd.StringVar(&configPath, "config", "", "配置文件路径")
	eFormat := exportCmd.String("format", "csv", "导出格式: csv/json")
	eOutput := exportCmd.String("output", "-", "输出路径 (- 表示 stdout)")
	eCourt := exportCmd.String("court", "", "按法院过滤")
	eDebtor := exportCmd.String("debtor", "", "按债务人过滤")
	eKeyword := exportCmd.String("keyword", "", "关键词过滤")
	eFrom := exportCmd.String("from", "", "起始日期")
	eTo := exportCmd.String("to", "", "结束日期")

	serveCmd := flag.NewFlagSet("serve", flag.ExitOnError)
	serveCmd.StringVar(&configPath, "config", "", "配置文件路径")
	serveCmd.BoolVar(&watch, "watch", false, "监听配置文件变更热重载")
	port := serveCmd.Int("port", 0, "Web 服务端口 (默认读取配置)")
	withSched := serveCmd.Bool("with-scheduler", true, "同时启动定时调度")

	daemonCmd := flag.NewFlagSet("daemon", flag.ExitOnError)
	daemonCmd.StringVar(&configPath, "config", "", "配置文件路径")
	daemonCmd.BoolVar(&watch, "watch", false, "监听配置文件变更热重载")

	var err error
	switch os.Args[1] {
	case "collect":
		collectCmd.Parse(os.Args[2:])
		err = cmd.RunCollect(configPath, *fullScan, watch)

	case "query":
		queryCmd.Parse(os.Args[2:])
		var readFlag *bool
		if *qRead != "" {
			b := *qRead == "1"
			readFlag = &b
		}
		err = cmd.RunQuery(configPath, &cmd.QueryFlags{
			Keyword:   *qKeyword,
			Court:     *qCourt,
			Debtor:    *qDebtor,
			CaseNum:   *qCase,
			Type:      *qType,
			FromDate:  *qFrom,
			ToDate:    *qTo,
			SortBy:    *qSort,
			SortOrder: *qOrder,
			Page:      *qPage,
			PageSize:  *qSize,
			IsRead:    readFlag,
			HitOnly:   *qHit,
			AsJSON:    *qJSON,
			Highlight: *qHighlight,
		})

	case "export":
		exportCmd.Parse(os.Args[2:])
		err = cmd.RunExport(configPath, &cmd.ExportFlags{
			Format:   *eFormat,
			Output:   *eOutput,
			Court:    *eCourt,
			Debtor:   *eDebtor,
			Keyword:  *eKeyword,
			FromDate: *eFrom,
			ToDate:   *eTo,
		})

	case "serve":
		serveCmd.Parse(os.Args[2:])
		if *withSched {
			go runDaemon(configPath, watch)
		}
		err = cmd.RunServe(configPath, *port, watch)

	case "daemon":
		daemonCmd.Parse(os.Args[2:])
		err = runDaemon(configPath, watch)

	case "version", "-v", "--version":
		fmt.Println("破产案件监控 v1.0.0")
		return

	case "help", "-h", "--help":
		printUsage()
		return

	default:
		fmt.Fprintf(os.Stderr, "未知命令: %s\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "错误:", err)
		os.Exit(1)
	}
}

func runDaemon(configPath string, watch bool) error {
	c := config.GetConfig()
	if err := c.Load(configPath, watch); err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	log, err := c.InitLogger()
	if err != nil {
		return fmt.Errorf("init logger: %w", err)
	}
	defer log.Sync()

	cfg := c.Get()
	db, err := store.NewStore(cfg.Store.DBPath, log)
	if err != nil {
		return fmt.Errorf("open store: %w", err)
	}
	defer db.Close()

	engine, err := crawler.NewEngine(cfg, db, log)
	if err != nil {
		return fmt.Errorf("init crawler: %w", err)
	}
	disp := notify.NewDispatcher(&cfg.Notify, log)
	sched := scheduler.NewScheduler(cfg, db, engine, disp, log)

	if err := sched.Start(); err != nil {
		return fmt.Errorf("start scheduler: %w", err)
	}
	defer sched.Stop()

	log.Info("daemon started")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Info("daemon shutting down")
	return nil
}

func printUsage() {
	fmt.Println(`破产案件公告监控系统

用法:
  bankrupt-monitor <command> [flags]

命令:
  collect    执行一次抓取任务
  query      终端查询案件
  export     导出 CSV/JSON
  serve      启动本地 Web 界面
  daemon     后台守护进程 (调度 + 抓取)
  version    显示版本
  help       显示帮助

示例:
  bankrupt-monitor collect --full
  bankrupt-monitor query --filter "某公司" --json
  bankrupt-monitor serve -p 7890
  bankrupt-monitor export --format csv --output cases.csv`)
}
