package main

import (
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"copyright-monitor/internal/collector"
	"copyright-monitor/internal/config"
	"copyright-monitor/internal/models"
	"copyright-monitor/internal/notifier"
	"copyright-monitor/internal/parser"
	"copyright-monitor/internal/scheduler"
	"copyright-monitor/internal/storage"
	"copyright-monitor/pkg/simhash"

	"github.com/fatih/color"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

var (
	green   = color.New(color.FgGreen, color.Bold)
	yellow  = color.New(color.FgYellow, color.Bold)
	red     = color.New(color.FgRed, color.Bold)
	cyan    = color.New(color.FgCyan, color.Bold)
	white   = color.New(color.FgWhite)
	bold    = color.New(color.Bold)
)

var logger *zap.Logger

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]

	switch cmd {
	case "start":
		startService()
	case "stop":
		stopService()
	case "status":
		showStatus()
	case "report":
		generateReport()
	case "init":
		initData()
	default:
		fmt.Printf("未知命令: %s\n\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	cyan.Println("版权监测系统 - Copyright Monitor")
	cyan.Println("=================================")
	fmt.Println()
	bold.Println("用法:")
	fmt.Println("  copyright-monitor <command> [arguments]")
	fmt.Println()
	bold.Println("命令:")
	fmt.Println("  init      初始化数据（平台配置+测试数据）")
	fmt.Println("  start     启动后台监测服务")
	fmt.Println("  stop      优雅停止监测服务")
	fmt.Println("  status    查看系统状态")
	fmt.Println("  report    生成侵权监测报告")
	fmt.Println()
	bold.Println("示例:")
	fmt.Println("  copyright-monitor init")
	fmt.Println("  copyright-monitor start")
	fmt.Println("  copyright-monitor status")
	fmt.Println("  copyright-monitor report --days 7")
}

func initLogger() *zap.Logger {
	logDir := config.Get().LogPath
	os.MkdirAll(logDir, 0755)

	fileWriter := zapcore.AddSync(&lumberjack.Logger{
		Filename:   filepath.Join(logDir, "monitor.log"),
		MaxSize:    100,
		MaxBackups: 30,
		MaxAge:     config.Get().LogRetentionDays,
		Compress:   true,
	})

	consoleWriter := zapcore.AddSync(os.Stdout)

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.TimeKey = "time"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	fileCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		fileWriter,
		zap.InfoLevel,
	)

	consoleCore := zapcore.NewCore(
		zapcore.NewConsoleEncoder(encoderConfig),
		consoleWriter,
		zap.WarnLevel,
	)

	core := zapcore.NewTee(fileCore, consoleCore)
	return zap.New(core)
}

func initData() {
	green.Println("初始化版权监测系统数据...")

	_, err := config.Load("")
	if err != nil {
		red.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	config.EnsureDirs()

	logger = initLogger()
	defer logger.Sync()

	if err := storage.InitGlobal(); err != nil {
		red.Printf("数据库初始化失败: %v\n", err)
		os.Exit(1)
	}
	defer storage.Global().Close()

	platforms := config.GetDefaultPlatforms()
	added := 0
	for _, p := range platforms {
		_, err := storage.Global().AddPlatform(&p)
		if err == nil {
			added++
		}
	}
	green.Printf("已注册 %d 个监测平台\n", added)

	if err := seedSampleWorks(); err != nil {
		red.Printf("添加测试作品失败: %v\n", err)
	}

	green.Println("数据初始化完成!")
	white.Println("  - 平台源:", added, "个")
	white.Println("  - 路径: data/")
}

func seedSampleWorks() error {
	sampleWorks := []*models.CopyrightWork{
		{
			Title:           "新时代新闻报道写作指南",
			WorkType:        models.WorkTypeText,
			Owner:           "省新闻出版协会",
			OwnerContact:    "010-12345678",
			RegistrationNo:  "国作登字-2024-L-0000001",
			CompletionDate:  time.Date(2024, 1, 15, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 2, 1, 0, 0, 0, 0, time.Local),
			Description:     "全面介绍新时代新闻报道的写作技巧与规范，包含案例分析与实操练习",
			IsHot:           true,
		},
		{
			Title:           "山河故人纪录片",
			WorkType:        models.WorkTypeVideo,
			Owner:           "省影视制作集团",
			OwnerContact:    "010-87654321",
			RegistrationNo:  "国作登字-2024-I-0000002",
			CompletionDate:  time.Date(2024, 3, 20, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 4, 10, 0, 0, 0, 0, time.Local),
			Description:     "三集纪录片，讲述改革开放以来山河变迁与人民生活变化",
			IsHot:           true,
		},
		{
			Title:           "黄河谣原创音乐专辑",
			WorkType:        models.WorkTypeAudio,
			Owner:           "省音乐协会",
			OwnerContact:    "010-11112222",
			RegistrationNo:  "国作登字-2024-B-0000003",
			CompletionDate:  time.Date(2024, 5, 1, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 5, 20, 0, 0, 0, 0, time.Local),
			Description:     "收录12首原创歌曲，以黄河为主题，融合民谣与摇滚风格",
			IsHot:           false,
		},
		{
			Title:           "城市印象系列油画",
			WorkType:        models.WorkTypeFineArt,
			Owner:           "省美术馆",
			OwnerContact:    "010-33334444",
			RegistrationNo:  "国作登字-2024-F-0000004",
			CompletionDate:  time.Date(2024, 2, 28, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 3, 15, 0, 0, 0, 0, time.Local),
			Description:     "共8幅油画作品，展现现代城市风貌与人文关怀",
			IsHot:           false,
		},
		{
			Title:           "智能版权管理系统软件V2.0",
			WorkType:        models.WorkTypeSoftware,
			Owner:           "省版权保护中心",
			OwnerContact:    "010-55556666",
			RegistrationNo:  "国作登字-2024-软件-0000005",
			CompletionDate:  time.Date(2024, 6, 1, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 6, 15, 0, 0, 0, 0, time.Local),
			Description:     "集版权登记、监测、维权于一体的智能管理系统",
			IsHot:           true,
		},
		{
			Title:           "乡村振兴专题报道集",
			WorkType:        models.WorkTypeText,
			Owner:           "省日报社",
			OwnerContact:    "010-77778888",
			RegistrationNo:  "国作登字-2024-L-0000006",
			CompletionDate:  time.Date(2024, 4, 1, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 4, 20, 0, 0, 0, 0, time.Local),
			Description:     "收录50篇乡村振兴主题深度报道",
			IsHot:           false,
		},
		{
			Title:           "青春校园网络剧《梦想花开》",
			WorkType:        models.WorkTypeVideo,
			Owner:           "某影视传媒公司",
			OwnerContact:    "010-99990000",
			RegistrationNo:  "国作登字-2024-I-0000007",
			CompletionDate:  time.Date(2024, 7, 1, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 7, 10, 0, 0, 0, 0, time.Local),
			Description:     "24集青春校园题材网络剧，讲述大学生追逐梦想的故事",
			IsHot:           true,
		},
		{
			Title:           "古风音乐作品集《墨韵》",
			WorkType:        models.WorkTypeAudio,
			Owner:           "独立音乐人工作室",
			OwnerContact:    "010-12121212",
			RegistrationNo:  "国作登字-2024-B-0000008",
			CompletionDate:  time.Date(2024, 3, 15, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 4, 1, 0, 0, 0, 0, time.Local),
			Description:     "10首古风原创音乐，融合传统乐器与现代编曲",
			IsHot:           false,
		},
		{
			Title:           "新闻摄影获奖作品集",
			WorkType:        models.WorkTypeFineArt,
			Owner:           "省摄影家协会",
			OwnerContact:    "010-34343434",
			RegistrationNo:  "国作登字-2024-F-0000009",
			CompletionDate:  time.Date(2024, 5, 30, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 6, 10, 0, 0, 0, 0, time.Local),
			Description:     "2023年度省新闻摄影大赛获奖作品合集",
			IsHot:           false,
		},
		{
			Title:           "数据可视化分析平台软件",
			WorkType:        models.WorkTypeSoftware,
			Owner:           "某科技有限公司",
			OwnerContact:    "010-56565656",
			RegistrationNo:  "国作登字-2024-软件-0000010",
			CompletionDate:  time.Date(2024, 1, 20, 0, 0, 0, 0, time.Local),
			RegistrationDate: time.Date(2024, 2, 5, 0, 0, 0, 0, time.Local),
			Description:     "企业级数据可视化分析平台，支持多种图表类型",
			IsHot:           false,
		},
	}

	count := 0
	for _, work := range sampleWorks {
		text := work.Title + " " + work.Description
		work.Fingerprint = simhash.Compute(text)
		_, err := storage.Global().AddWork(work)
		if err == nil {
			count++
		}
	}

	fmt.Printf("已添加 %d 条作品登记数据\n", count)
	return nil
}

func startService() {
	green.Println("启动版权监测服务...")

	_, err := config.Load("")
	if err != nil {
		red.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	config.EnsureDirs()

	logger = initLogger()
	defer logger.Sync()

	logger.Info("Service starting...")

	if err := storage.InitGlobal(); err != nil {
		red.Printf("数据库初始化失败: %v\n", err)
		os.Exit(1)
	}
	defer storage.Global().Close()

	collector.InitManager(logger)

	platforms, err := storage.Global().GetEnabledPlatforms()
	if err != nil {
		red.Printf("获取平台列表失败: %v\n", err)
		os.Exit(1)
	}

	for _, p := range platforms {
		collector.GetManager().RegisterCollector(p)
	}
	green.Printf("已加载 %d 个监测平台\n", len(platforms))

	parser.Init(logger)
	if err := parser.Global().LoadWorks(); err != nil {
		red.Printf("加载作品库失败: %v\n", err)
	}

	notifier.Init(logger)

	scheduler.Init(logger)
	if err := scheduler.Global().LoadTasks(); err != nil {
		red.Printf("加载任务失败: %v\n", err)
	}

	if err := scheduler.Global().Start(); err != nil {
		red.Printf("启动调度器失败: %v\n", err)
		os.Exit(1)
	}

	green.Println("版权监测服务已启动!")
	cyan.Println("按 Ctrl+C 停止服务")

	active := scheduler.Global().GetActiveTaskCount()
	queued := scheduler.Global().GetQueuedTaskCount()
	white.Printf("活跃任务: %d  队列任务: %d\n", active, queued)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case sig := <-sigChan:
			yellow.Printf("\n收到信号 %v, 正在停止服务...\n", sig)
			scheduler.Global().Stop()
			green.Println("服务已停止")
			return
		case <-ticker.C:
			active := scheduler.Global().GetActiveTaskCount()
			queued := scheduler.Global().GetQueuedTaskCount()
			pending, _ := storage.Global().GetPendingClueCount()
			white.Printf("[%s] 活跃:%d 队列:%d 待处理线索:%d\n",
				time.Now().Format("15:04:05"), active, queued, pending)
		}
	}
}

func stopService() {
	yellow.Println("停止服务功能（进程模式下通过发送信号实现）")
	white.Println("提示: 在运行服务的终端按 Ctrl+C 即可停止")
}

func showStatus() {
	cyan.Println("系统状态")
	cyan.Println("============")

	_, err := config.Load("")
	if err != nil {
		red.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	logger = initLogger()
	defer logger.Sync()

	if err := storage.InitGlobal(); err != nil {
		red.Printf("数据库初始化失败: %v\n", err)
		os.Exit(1)
	}
	defer storage.Global().Close()

	status, err := storage.Global().GetSystemStatus()
	if err != nil {
		red.Printf("获取系统状态失败: %v\n", err)
		os.Exit(1)
	}

	bold.Println("\n概览:")
	white.Printf("  登记作品总数: ")
	green.Printf("%d 件\n", status.TotalWorks)
	white.Printf("  监测平台总数: ")
	green.Printf("%d 个\n", status.TotalPlatforms)
	white.Printf("  待处理线索: ")
	yellow.Printf("%d 条\n", status.PendingClues)

	bold.Println("\n各平台采集成功率:")
	for _, stat := range status.PlatformStats {
		fmt.Printf("  %-20s ", stat.PlatformName)
		if stat.SuccessRate >= 90 {
			green.Printf("%.1f%%", stat.SuccessRate)
		} else if stat.SuccessRate >= 70 {
			yellow.Printf("%.1f%%", stat.SuccessRate)
		} else {
			red.Printf("%.1f%%", stat.SuccessRate)
		}
		fmt.Printf(" (总%d次 失败%d次)\n", stat.TotalRuns, stat.FailedRuns)
	}

	bold.Println("\n最近发现侵权 (前10条):")
	if len(status.RecentInfringements) == 0 {
		white.Println("  暂无侵权记录")
	} else {
		for i, clue := range status.RecentInfringements {
			red.Printf("  %2d. [%s] %s\n", i+1, clue.PlatformName, clue.WorkTitle)
			white.Printf("      URL: %s\n", clue.InfringementURL)
			yellow.Printf("      相似度: %.2f%% | 发现时间: %s\n",
				clue.Similarity, clue.DiscoverTime.Format("2006-01-02 15:04"))
		}
	}

	fmt.Println()
}

func generateReport() {
	cyan.Println("生成侵权监测报告")
	cyan.Println("================")

	days := 7
	if len(os.Args) > 2 {
		if os.Args[2] == "--days" && len(os.Args) > 3 {
			fmt.Sscanf(os.Args[3], "%d", &days)
		}
	}

	_, err := config.Load("")
	if err != nil {
		red.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	logger = initLogger()
	defer logger.Sync()

	if err := storage.InitGlobal(); err != nil {
		red.Printf("数据库初始化失败: %v\n", err)
		os.Exit(1)
	}
	defer storage.Global().Close()

	notifier.Init(logger)

	end := time.Now()
	start := end.AddDate(0, 0, -days)

	report, path, err := notifier.Global().GenerateReport(start, end)
	if err != nil {
		red.Printf("生成报告失败: %v\n", err)
		os.Exit(1)
	}

	green.Println("报告生成成功!")
	fmt.Printf("  报告ID: %s\n", report.ReportID)
	fmt.Printf("  时间范围: %s 至 %s\n",
		start.Format("2006-01-02"), end.Format("2006-01-02"))
	fmt.Printf("  侵权线索数: ")
	red.Printf("%d 条\n", report.ClueCount)
	fmt.Printf("  报告路径: %s\n", path)

	stats, _ := notifier.Global().GetStatistics(days)

	bold.Println("\n按平台分布:")
	byPlatform := stats["by_platform"].(map[string]int)
	for platform, count := range byPlatform {
		fmt.Printf("  %-20s: %d 条\n", platform, count)
	}

	bold.Println("\n按作品类型分布:")
	byType := stats["by_work_type"].(map[string]int)
	typeNames := map[string]string{
		"text":     "文字作品",
		"audio":    "音乐作品",
		"video":    "视听作品",
		"fine_art": "美术作品",
		"software": "软件著作权",
	}
	for t, count := range byType {
		name := typeNames[t]
		if name == "" {
			name = t
		}
		fmt.Printf("  %-12s: %d 条\n", name, count)
	}

	avgSim := stats["avg_similarity"].(float64)
	fmt.Printf("\n平均相似度: %.2f%%\n", avgSim)
}
