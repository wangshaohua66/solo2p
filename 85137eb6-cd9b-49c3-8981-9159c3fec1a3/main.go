package main

import (
	"bufio"
	"flag"
	"fmt"
	"math"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
	"github.com/schollz/progressbar/v3"

	"price-monitor/alert"
	"price-monitor/config"
	"price-monitor/crawler"
	"price-monitor/export"
	"price-monitor/logger"
	"price-monitor/scheduler"
	"price-monitor/storage"
)

var (
	bold      = color.New(color.Bold).SprintFunc()
	green     = color.New(color.FgGreen).SprintFunc()
	red       = color.New(color.FgRed).SprintFunc()
	yellow    = color.New(color.FgYellow).SprintFunc()
	cyan      = color.New(color.FgCyan).SprintFunc()
	magenta   = color.New(color.FgMagenta).SprintFunc()
	boldGreen = color.New(color.Bold, color.FgGreen).SprintFunc()
	boldRed   = color.New(color.Bold, color.FgRed).SprintFunc()
)

func printBanner() {
	banner := `
  ╔═══════════════════════════════════════════════════╗
  ║      🛒 母婴电商价格监控系统 v1.0.0                ║
  ║      12平台 · 800SKU · 智能对比 · 实时告警        ║
  ╚═══════════════════════════════════════════════════╝`
	fmt.Println(cyan(banner))
	fmt.Println()
}

func printUsage() {
	fmt.Println(bold("使用方式:"))
	fmt.Println("  price-monitor <command> [options]")
	fmt.Println()
	fmt.Println(bold("可用命令:"))
	commands := [][]string{
		{"crawl", "执行一次全量抓取任务"},
		{"list", "显示当前价格对比列表"},
		{"history", "查询SKU历史价格记录"},
		{"export", "导出数据 (json/csv/html/md)"},
		{"schedule", "启动定时监控服务"},
		{"test", "测试各电商平台连接"},
		{"stats", "显示系统统计信息"},
		{"task", "管理定时任务 (add/remove/list)"},
		{"help", "显示帮助信息"},
	}
	tw := tablewriter.NewWriter(os.Stdout)
	tw.SetBorder(false)
	tw.SetColumnSeparator("")
	tw.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	tw.SetAlignment(tablewriter.ALIGN_LEFT)
	for _, c := range commands {
		tw.Append([]string{"  " + boldGreen(c[0]), c[1]})
	}
	tw.Render()
	fmt.Println()
}

func buildCrawlTasks(cfg *config.AppConfig, category, brand string) []*crawler.CrawlTask {
	var tasks []*crawler.CrawlTask
	sites := cfg.GetEnabledSites()

	var skus []config.SKUConfig
	if category != "" || brand != "" {
		skus = cfg.GetSKUsByCategory(category)
		if brand != "" {
			brandSkus := make(map[string]config.SKUConfig)
			for _, s := range cfg.GetSKUsByBrand(brand) {
				brandSkus[s.SKUId] = s
			}
			var filtered []config.SKUConfig
			for _, s := range skus {
				if _, ok := brandSkus[s.SKUId]; ok {
					filtered = append(filtered, s)
				}
			}
			skus = filtered
		}
	} else {
		skus = cfg.SKUs
	}

	for _, sku := range skus {
		for _, site := range sites {
			if len(sku.Keywords) == 0 {
				continue
			}
			keyword := sku.Keywords[0]
			tasks = append(tasks, &crawler.CrawlTask{
				SKU:     sku,
				Site:    site,
				Keyword: keyword,
			})
		}
	}
	return tasks
}

func cmdCrawl(cfg *config.AppConfig, db *storage.Database, args []string) {
	fs := flag.NewFlagSet("crawl", flag.ExitOnError)
	category := fs.String("category", "", "按品类筛选")
	brand := fs.String("brand", "", "按品牌筛选")
	noAlert := fs.Bool("no-alert", false, "禁用本次告警")
	noSave := fs.Bool("no-save", false, "不保存到数据库")
	fs.Parse(args)

	fmt.Printf("%s %s\n", boldGreen("▶"), bold("开始执行价格抓取任务..."))

	tasks := buildCrawlTasks(cfg, *category, *brand)
	if len(tasks) == 0 {
		fmt.Println(yellow("⚠ 没有符合条件的抓取任务"))
		return
	}
	fmt.Printf("  待抓取: %d 个 (SKU × 站点)\n", len(tasks))
	fmt.Printf("  并发数: %d | 超时: %ds | 重试: %d次\n\n",
		cfg.Global.Concurrency, cfg.Global.Timeout, cfg.Global.MaxRetries)

	engine := crawler.NewEngine(cfg)
	defer engine.Close()

	bar := progressbar.NewOptions(len(tasks),
		progressbar.OptionSetDescription(green("抓取进度")),
		progressbar.OptionSetTheme(progressbar.Theme{
			Saucer:        "█",
			SaucerHead:    "█",
			SaucerPadding: "░",
			BarStart:      "[",
			BarEnd:        "]",
		}),
		progressbar.OptionShowCount(),
		progressbar.OptionShowIts(),
		progressbar.OptionSetItsString("items"),
		progressbar.OptionThrottle(100*time.Millisecond),
	)

	startTime := time.Now()
	var allRecords []*storage.PriceRecord

	records, errs := engine.CrawlBatch(tasks, func(done, total int, result *crawler.CrawlResult) {
		bar.Add(1)
	})

	bar.Finish()
	fmt.Println()

	duration := time.Since(startTime)
	success, fail, _, _ := engine.GetStats()
	successRate := 0.0
	if len(tasks) > 0 {
		successRate = float64(success) / float64(len(tasks)) * 100
	}

	fmt.Println(bold("\n📊 抓取结果统计:"))
	tw := tablewriter.NewWriter(os.Stdout)
	tw.SetHeader([]string{"指标", "数值"})
	tw.AppendBulk([][]string{
		{"总任务数", fmt.Sprintf("%d", len(tasks))},
		{"成功", green(fmt.Sprintf("%d", success))},
		{"失败", red(fmt.Sprintf("%d", fail))},
		{"成功率", fmt.Sprintf("%.1f%%", successRate)},
		{"错误数", fmt.Sprintf("%d", len(errs))},
		{"耗时", duration.Round(time.Millisecond).String()},
		{"平均耗时/任务", fmt.Sprintf("%v", duration/time.Duration(math.Max(1, float64(len(tasks)))) )},
	})
	tw.Render()

	if !*noSave && len(records) > 0 {
		inserted, err := db.SavePriceRecordsBatch(records)
		if err != nil {
			logger.Error("保存记录失败: %v", err)
		} else {
			allRecords = records
			fmt.Printf("\n%s 已保存 %d 条新价格记录到数据库\n", green("✓"), inserted)
		}
	}

	if !*noAlert && len(allRecords) > 0 {
		notifier := alert.NewNotifier(cfg, db)
		events := notifier.BatchAlert(allRecords)
		if len(events) > 0 {
			fmt.Printf("\n%s 触发 %d 条价格告警:\n", yellow("⚠"), len(events))
			for _, e := range events {
				fmt.Printf("  %s %s\n", magenta("▸"), e.Message)
			}
		}
	}

	errMsgs := make([]string, 0, len(errs)+len(engine.GetErrors()))
	for _, e := range errs {
		errMsgs = append(errMsgs, e.Error())
	}
	errMsgs = append(errMsgs, engine.GetErrors()...)

	stats := &storage.CrawlStats{
		TotalCount:    len(tasks),
		SuccessCount:  int(success),
		FailedCount:   int(fail),
		StartTime:     startTime,
		EndTime:       time.Now(),
		Duration:      duration,
		ErrorMessages: errMsgs,
	}
	db.SaveCrawlStats(stats)
}

func cmdList(cfg *config.AppConfig, db *storage.Database, args []string) {
	fs := flag.NewFlagSet("list", flag.ExitOnError)
	category := fs.String("category", "", "按品类筛选")
	brand := fs.String("brand", "", "按品牌筛选")
	site := fs.String("site", "", "按站点筛选")
	page := fs.Int("page", 1, "页码")
	pageSize := fs.Int("page-size", 20, "每页数量")
	fs.Parse(args)

	records, err := db.GetAllLatestPrices()
	if err != nil {
		fmt.Println(red("✗ 获取价格列表失败:"), err)
		return
	}

	records = export.FilterRecords(records, *category, *brand, *site)

	if len(records) == 0 {
		fmt.Println(yellow("⚠ 暂无价格数据，请先执行 crawl 命令"))
		return
	}

	sort.Slice(records, func(i, j int) bool {
		if records[i].SKUId == records[j].SKUId {
			return records[i].PriceFinal < records[j].PriceFinal
		}
		return records[i].SKUId < records[j].SKUId
	})

	total := len(records)
	totalPages := (total + *pageSize - 1) / *pageSize
	if *page > totalPages {
		*page = totalPages
	}
	start := (*page - 1) * *pageSize
	end := start + *pageSize
	if end > total {
		end = total
	}
	pagedRecords := records[start:end]

	fmt.Printf("%s %s (共 %d 条，第 %d/%d 页)\n\n",
		boldGreen("📋"), bold("全网价格对比表"), total, *page, totalPages)

	tw := tablewriter.NewWriter(os.Stdout)
	tw.SetHeader([]string{"SKU", "商品名称", "品牌", "平台", "原价", "促销价", "会员价", "实付", "库存", "抓取时间"})
	tw.SetAutoWrapText(false)
	colWidths := []int{30, 30, 10, 8, 10, 10, 10, 10, 8, 16}
	for col, width := range colWidths {
		tw.SetColMinWidth(col, width)
	}

	for i, r := range pagedRecords {
		orig := fmt.Sprintf("%.2f", r.PriceOriginal)
		promo := fmt.Sprintf("%.2f", r.PricePromo)
		member := fmt.Sprintf("%.2f", r.PriceMember)
		final := fmt.Sprintf("%.2f", r.PriceFinal)

		if i == 0 || (i > 0 && pagedRecords[i-1].SKUId != r.SKUId) {
			final = boldGreen(final)
		} else if r.PricePromo > 0 && r.PricePromo < r.PriceOriginal {
			promo = green(promo)
		}

		tw.Append([]string{
			r.SKUId,
			truncate(r.SKUName, 20),
			r.Brand,
			r.SiteName,
			orig,
			promo,
			member,
			final,
			r.Stock,
			r.CrawledAt.Format("01-02 15:04"),
		})
	}
	tw.Render()

	if *page < totalPages {
		fmt.Printf("\n使用 %s 查看下一页\n", cyan(fmt.Sprintf("--page %d", *page+1)))
	}
}

func cmdHistory(cfg *config.AppConfig, db *storage.Database, args []string) {
	fs := flag.NewFlagSet("history", flag.ExitOnError)
	skuId := fs.String("sku", "", "SKU ID (必填)")
	siteId := fs.String("site", "", "站点ID (必填)")
	days := fs.Int("days", 30, "查询天数")
	fs.Parse(args)

	if *skuId == "" || *siteId == "" {
		fmt.Println(red("✗ 请指定 --sku 和 --site 参数"))
		return
	}

	endTime := time.Now()
	startTime := endTime.AddDate(0, 0, -*days)

	records, err := db.GetPriceHistory(*skuId, *siteId, startTime, endTime)
	if err != nil {
		fmt.Println(red("✗ 查询历史记录失败:"), err)
		return
	}

	if len(records) == 0 {
		fmt.Println(yellow("⚠ 该SKU在该站点暂无历史记录"))
		return
	}

	sku, _ := cfg.GetSKUByID(*skuId)
	site, _ := cfg.GetSiteByID(*siteId)

	fmt.Printf("%s %s - %s (%s)\n\n",
		boldGreen("📈"), bold(sku.Name), bold(site.Name),
		fmt.Sprintf("最近%d天", *days))

	tw := tablewriter.NewWriter(os.Stdout)
	tw.SetHeader([]string{"时间", "原价", "促销价", "会员价", "实付价", "变动"})

	var prevPrice float64
	for i, r := range records {
		change := "-"
		if i > 0 && prevPrice > 0 {
			diff := r.PriceFinal - prevPrice
			pct := diff / prevPrice * 100
			if diff < 0 {
				change = green(fmt.Sprintf("↓ %.2f (%.1f%%)", math.Abs(diff), math.Abs(pct)))
			} else if diff > 0 {
				change = red(fmt.Sprintf("↑ %.2f (%.1f%%)", diff, pct))
			}
		}
		prevPrice = r.PriceFinal

		tw.Append([]string{
			r.CrawledAt.Format("2006-01-02 15:04"),
			fmt.Sprintf("%.2f", r.PriceOriginal),
			fmt.Sprintf("%.2f", r.PricePromo),
			fmt.Sprintf("%.2f", r.PriceMember),
			fmt.Sprintf("%.2f", r.PriceFinal),
			change,
		})
	}
	tw.Render()
}

func cmdExport(cfg *config.AppConfig, db *storage.Database, args []string) {
	fs := flag.NewFlagSet("export", flag.ExitOnError)
	format := fs.String("format", "csv", "导出格式: json/csv/html/md")
	output := fs.String("output", "", "输出文件路径")
	category := fs.String("category", "", "按品类筛选")
	brand := fs.String("brand", "", "按品牌筛选")
	site := fs.String("site", "", "按站点筛选")
	fs.Parse(args)

	records, err := db.GetAllLatestPrices()
	if err != nil {
		fmt.Println(red("✗ 获取数据失败:"), err)
		return
	}

	records = export.FilterRecords(records, *category, *brand, *site)

	if len(records) == 0 {
		fmt.Println(yellow("⚠ 暂无数据可导出"))
		return
	}

	if *output == "" {
		timestamp := time.Now().Format("20060102_150405")
		*output = fmt.Sprintf("price_report_%s.%s", timestamp, *format)
	}

	var expErr error
	switch strings.ToLower(*format) {
	case "json":
		expErr = export.ExportJSON(records, *output)
	case "csv":
		expErr = export.ExportCSV(records, *output)
	case "html":
		expErr = export.ExportHTML(records, db, cfg, *output)
	case "md", "markdown":
		md := export.GenerateMarkdownReport(records, db, cfg)
		expErr = os.WriteFile(*output, []byte(md), 0644)
	default:
		fmt.Println(red("✗ 不支持的导出格式:"), *format)
		return
	}

	if expErr != nil {
		fmt.Println(red("✗ 导出失败:"), expErr)
		return
	}

	absPath, _ := filepath.Abs(*output)
	fmt.Printf("%s 导出成功！共 %d 条记录\n", green("✓"), len(records))
	fmt.Printf("  文件: %s\n", cyan(absPath))
}

func cmdSchedule(cfg *config.AppConfig, db *storage.Database, engine *crawler.Engine, args []string) {
	fmt.Printf("%s %s\n", boldGreen("⏰"), bold("启动定时监控服务..."))

	notifier := alert.NewNotifier(cfg, db)
	sched := scheduler.NewTaskScheduler(cfg, db, engine)

	if err := sched.LoadFromConfig(); err != nil {
		logger.Warn("初始化任务配置: %v", err)
	}

	if err := sched.LoadTasks(); err != nil {
		fmt.Println(red("✗ 加载任务失败:"), err)
		return
	}

	sched.OnComplete(func(records []*storage.PriceRecord) {
		notifier.BatchAlert(records)
	})

	sched.Start()

	fmt.Printf("%s 定时服务已启动，当前任务数: %d\n", green("✓"), len(sched.GetTasks()))
	fmt.Println(yellow("  按 Ctrl+C 停止服务..."))

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-sigCh:
			fmt.Println("\n" + yellow("正在停止服务..."))
			sched.Stop()
			fmt.Println(green("✓ 服务已停止"))
			return
		case <-ticker.C:
			stats := sched.GetStats()
			fmt.Printf("[%s] 任务状态: 运行中%d | 已完成%d | 失败%d | 总计%d\n",
				time.Now().Format("15:04:05"),
				stats["running"], stats["completed"], stats["failed"], stats["total"])
		}
	}
}

func cmdTest(cfg *config.AppConfig, args []string) {
	fmt.Printf("%s %s\n\n", boldGreen("🔍"), bold("测试电商平台连接..."))

	engine := crawler.NewEngine(cfg)
	defer engine.Close()

	sites := cfg.GetEnabledSites()
	tw := tablewriter.NewWriter(os.Stdout)
	tw.SetHeader([]string{"#", "平台ID", "平台名称", "状态", "耗时"})

	for i, site := range sites {
		start := time.Now()
		err := engine.TestConnection(site)
		duration := time.Since(start)

		status := green("✓ 正常")
		errMsg := ""
		if err != nil {
			status = red("✗ " + err.Error())
			errMsg = err.Error()
		}

		tw.Append([]string{
			fmt.Sprintf("%d", i+1),
			site.ID,
			site.Name,
			status,
			duration.Round(time.Millisecond).String(),
		})
		_ = errMsg
	}
	tw.Render()
}

func cmdStats(cfg *config.AppConfig, db *storage.Database) {
	fmt.Printf("%s %s\n\n", boldGreen("📊"), bold("系统统计信息"))

	dbStats, err := db.GetStatistics(30)
	if err != nil {
		fmt.Println(red("✗ 获取统计信息失败:"), err)
		return
	}

	records, _ := db.GetAllLatestPrices()
	skuLowest := make(map[string]float64)
	for _, r := range records {
		if p, ok := skuLowest[r.SKUId]; !ok || r.PriceFinal < p {
			skuLowest[r.SKUId] = r.PriceFinal
		}
	}

	tw := tablewriter.NewWriter(os.Stdout)
	tw.SetHeader([]string{"指标", "数值"})
	tw.AppendBulk([][]string{
		{"总历史记录数", fmt.Sprintf("%v 条", dbStats["total_records"])},
		{"唯一SKU数", fmt.Sprintf("%v 个", dbStats["unique_skus"])},
		{"唯一站点数", fmt.Sprintf("%v 个", dbStats["unique_sites"])},
		{"近30天新增记录", fmt.Sprintf("%v 条", dbStats["records_in_period"])},
		{"监控站点数", fmt.Sprintf("%d 个", len(cfg.GetEnabledSites()))},
		{"当前有价格数据SKU", fmt.Sprintf("%d 个", len(skuLowest))},
	})
	tw.Render()

	fmt.Println()
	fmt.Println(bold("💰 全网最低价汇总:"))
	if len(records) == 0 {
		fmt.Println(yellow("  暂无数据"))
		return
	}

	sortedSkus := make([]string, 0, len(skuLowest))
	for k := range skuLowest {
		sortedSkus = append(sortedSkus, k)
	}
	sort.Strings(sortedSkus)

	tw2 := tablewriter.NewWriter(os.Stdout)
	tw2.SetHeader([]string{"SKU", "商品名称", "品牌", "全网最低价"})
	for _, skuId := range sortedSkus {
		sku, _ := cfg.GetSKUByID(skuId)
		tw2.Append([]string{
			skuId,
			truncate(sku.Name, 25),
			sku.Brand,
			boldGreen(fmt.Sprintf("¥%.2f", skuLowest[skuId])),
		})
	}
	tw2.Render()
}

func cmdTask(cfg *config.AppConfig, db *storage.Database, engine *crawler.Engine, args []string) {
	if len(args) == 0 {
		fmt.Println(red("✗ 请指定子命令: add / remove / list"))
		return
	}

	subCmd := args[0]
	subArgs := args[1:]

	switch subCmd {
	case "list":
		sched := scheduler.NewTaskScheduler(cfg, db, engine)
		if err := sched.LoadTasks(); err != nil {
			fmt.Println(red("✗ 加载任务失败:"), err)
			return
		}
		tasks := sched.GetTasks()
		if len(tasks) == 0 {
			fmt.Println(yellow("⚠ 暂无定时任务"))
			return
		}
		fmt.Printf("%s %s (共 %d 个)\n\n", boldGreen("📋"), bold("定时任务列表"), len(tasks))
		tw := tablewriter.NewWriter(os.Stdout)
		tw.SetHeader([]string{"ID", "SKU", "站点", "关键词", "Cron", "状态", "上次运行", "下次运行"})
		for _, t := range tasks {
			status := green("就绪")
			switch t.Status {
			case scheduler.TaskStatusRunning:
				status = yellow("运行中")
			case scheduler.TaskStatusFailed:
				status = red("失败")
			case scheduler.TaskStatusCompleted:
				status = green("完成")
			}
			lastRun := "-"
			if !t.LastRunAt.IsZero() {
				lastRun = t.LastRunAt.Format("01-02 15:04")
			}
			nextRun := "-"
			if !t.NextRunAt.IsZero() {
				nextRun = t.NextRunAt.Format("01-02 15:04")
			}
			tw.Append([]string{
				fmt.Sprintf("%d", t.ID),
				t.SKUId,
				t.SiteId,
				truncate(t.Keyword, 15),
				t.CronExpr,
				status,
				lastRun,
				nextRun,
			})
		}
		tw.Render()

	case "add":
		fs := flag.NewFlagSet("task add", flag.ExitOnError)
		skuId := fs.String("sku", "", "SKU ID")
		siteId := fs.String("site", "", "站点ID")
		keyword := fs.String("keyword", "", "搜索关键词")
		cronExpr := fs.String("cron", "0 */2 * * * *", "Cron表达式 (秒 分 时 日 月 周)")
		fs.Parse(subArgs)

		if *skuId == "" || *siteId == "" {
			fmt.Println(red("✗ 必须指定 --sku 和 --site"))
			return
		}

		sched := scheduler.NewTaskScheduler(cfg, db, engine)
		id, err := sched.AddTask(*skuId, *siteId, *keyword, *cronExpr)
		if err != nil {
			fmt.Println(red("✗ 添加任务失败:"), err)
			return
		}
		fmt.Printf("%s 任务已添加，ID: %d\n", green("✓"), id)

	case "remove":
		fs := flag.NewFlagSet("task remove", flag.ExitOnError)
		id := fs.Int64("id", 0, "任务ID")
		fs.Parse(subArgs)
		if *id == 0 {
			fmt.Println(red("✗ 请指定 --id"))
			return
		}
		sched := scheduler.NewTaskScheduler(cfg, db, engine)
		if err := sched.LoadTasks(); err != nil {
			fmt.Println(red("✗ 加载任务失败:"), err)
			return
		}
		if err := sched.RemoveTask(*id); err != nil {
			fmt.Println(red("✗ 删除任务失败:"), err)
			return
		}
		fmt.Printf("%s 任务 %d 已删除\n", green("✓"), *id)

	default:
		fmt.Println(red("✗ 未知子命令:"), subCmd)
	}
}

func truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return string(runes[:maxLen])
	}
	return string(runes[:maxLen-3]) + "..."
}

func waitForEnter() {
	fmt.Print("\n按 Enter 继续...")
	bufio.NewReader(os.Stdin).ReadBytes('\n')
}

func main() {
	configPath := flag.String("config", "config/sites.yaml", "配置文件路径")
	logLevel := flag.String("log-level", "", "日志级别 (debug/info/warn/error)")
	flag.Parse()

	args := flag.Args()
	if len(args) == 0 {
		printBanner()
		printUsage()
		os.Exit(0)
	}

	cmd := args[0]
	cmdArgs := args[1:]

	if cmd == "help" {
		printBanner()
		printUsage()
		os.Exit(0)
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s 加载配置失败: %v\n", red("✗"), err)
		os.Exit(1)
	}

	level := cfg.Log.Level
	if *logLevel != "" {
		level = *logLevel
	}
	logger.Init(level, cfg.Log.Dir, cfg.Log.RetentionDays)

	db, err := storage.Init(cfg.Database.Path)
	if err != nil {
		logger.Fatal("初始化数据库失败: %v", err)
	}
	defer db.Close()

	engine := crawler.NewEngine(cfg)
	defer engine.Close()

	printBanner()

	switch cmd {
	case "crawl":
		cmdCrawl(cfg, db, cmdArgs)
	case "list":
		cmdList(cfg, db, cmdArgs)
	case "history":
		cmdHistory(cfg, db, cmdArgs)
	case "export":
		cmdExport(cfg, db, cmdArgs)
	case "schedule":
		cmdSchedule(cfg, db, engine, cmdArgs)
	case "test":
		cmdTest(cfg, cmdArgs)
	case "stats":
		cmdStats(cfg, db)
	case "task":
		cmdTask(cfg, db, engine, cmdArgs)
	default:
		fmt.Println(red("✗ 未知命令:"), cmd)
		printUsage()
		os.Exit(1)
	}
}
