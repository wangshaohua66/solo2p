package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"go.uber.org/zap"

	"drug-bid-crawler/config"
	"drug-bid-crawler/crawler"
	"drug-bid-crawler/notify"
	"drug-bid-crawler/storage"
)

var taskID string

func main() {
	taskID = fmt.Sprintf("task_%d", time.Now().Unix())

	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	logger, err := config.InitLogger()
	if err != nil {
		fmt.Printf("初始化日志失败: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	if err := storage.InitDB(cfg.DBPath); err != nil {
		config.Logger.Fatal("初始化数据库失败", zap.Error(err))
		os.Exit(1)
	}
	defer storage.Close()

	setupSignalHandler()

	alertManager := notify.NewAlertManager()

	go notify.CleanupOldLogs()

	if cfg.ShowStats {
		showStats(cfg)
		return
	}

	if cfg.Mode == "batch" {
		if err := runBatchMode(cfg, alertManager); err != nil {
			config.Logger.Fatal("批处理模式运行失败", zap.Error(err))
			notify.SendSystemAlert(alertManager, notify.SeverityCritical,
				"系统异常", "批处理任务运行失败", err)
			os.Exit(1)
		}
	} else {
		if err := runInteractiveMode(cfg, alertManager); err != nil {
			config.Logger.Fatal("交互模式运行失败", zap.Error(err))
			os.Exit(1)
		}
	}

	notify.PrintAlertsSummary(alertManager.GetAll())

	storage.LogExecution(taskID, "INFO", "程序正常退出", "")
	config.Logger.Info("程序运行完成", zap.String("task_id", taskID))
}

func setupSignalHandler() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		config.Logger.Info("收到退出信号，正在清理...", zap.String("signal", sig.String()))
		storage.LogExecution(taskID, "WARN", "程序被中断", "收到信号: "+sig.String())

		config.Logger.Sync()
		storage.Close()

		fmt.Println("\n程序已安全退出")
		os.Exit(0)
	}()
}

func runBatchMode(cfg *config.Config, am *notify.AlertManager) error {
	if cfg.ProjectID == "" {
		return fmt.Errorf("批处理模式必须指定项目编号")
	}

	config.Logger.Info("启动批处理模式",
		zap.String("project_id", cfg.ProjectID),
		zap.Int("concurrency", cfg.Concurrency),
		zap.String("download_dir", cfg.DownloadDir),
	)

	browser, err := crawler.NewBrowser()
	if err != nil {
		notify.SendLoginAlert(am, false, err)
		return fmt.Errorf("创建浏览器实例失败: %w", err)
	}
	defer browser.Close()

	ctx := context.Background()

	if err := browser.EnsureLogin(ctx); err != nil {
		notify.SendLoginAlert(am, false, err)
		return fmt.Errorf("登录失败: %w", err)
	}
	notify.SendLoginAlert(am, true, nil)

	browser.StartSessionKeepAlive(ctx)

	if err := syncProjectData(ctx, browser, cfg.ProjectID, am); err != nil {
		return fmt.Errorf("同步项目数据失败: %w", err)
	}

	downloader := crawler.NewDownloader(browser, cfg.ProjectID)

	if err := downloader.Start(); err != nil {
		notify.SendDownloadAlert(am, 1, 1)
		return fmt.Errorf("下载失败: %w", err)
	}

	stats, _ := storage.GetStats(cfg.ProjectID)
	if stats.FailedFiles > 0 {
		notify.SendDownloadAlert(am, stats.FailedFiles, stats.TotalFiles)
	}

	if err := checkExpiry(cfg.ProjectID, am); err != nil {
		config.Logger.Warn("检查有效期失败", zap.Error(err))
	}

	notify.GenerateDownloadReport(cfg.ProjectID)

	return nil
}

func runInteractiveMode(cfg *config.Config, am *notify.AlertManager) error {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println(strings.Repeat("=", 70))
	fmt.Println("  药品招标采购资质文件自动下载系统 v1.0")
	fmt.Println(strings.Repeat("=", 70))

	for {
		fmt.Println("\n请选择操作:")
		fmt.Println("  1. 解析招标项目列表")
		fmt.Println("  2. 查看已保存的项目")
		fmt.Println("  3. 同步指定项目数据")
		fmt.Println("  4. 开始下载资质文件")
		fmt.Println("  5. 查看下载统计")
		fmt.Println("  6. 检查资质有效期")
		fmt.Println("  7. 重试失败的下载")
		fmt.Println("  8. 退出")
		fmt.Print("请输入选项 [1-8]: ")

		choice, _ := reader.ReadString('\n')
		choice = strings.TrimSpace(choice)

		switch choice {
		case "1":
			if err := parseProjects(cfg, am, reader); err != nil {
				fmt.Printf("操作失败: %v\n", err)
			}
		case "2":
			listProjects()
		case "3":
			syncProject(cfg, am, reader)
		case "4":
			startDownload(cfg, am, reader)
		case "5":
			showStats(cfg)
		case "6":
			checkExpiryInteractive(cfg, am, reader)
		case "7":
			retryFailed(cfg, am, reader)
		case "8":
			fmt.Println("感谢使用，再见！")
			return nil
		default:
			fmt.Println("无效选项，请重新选择")
		}
	}
}

func parseProjects(cfg *config.Config, am *notify.AlertManager, reader *bufio.Reader) error {
	fmt.Println("\n正在连接网站解析招标项目列表...")

	browser, err := crawler.NewBrowser()
	if err != nil {
		notify.SendLoginAlert(am, false, err)
		return err
	}
	defer browser.Close()

	ctx := context.Background()

	if err := browser.EnsureLogin(ctx); err != nil {
		notify.SendLoginAlert(am, false, err)
		return err
	}
	notify.SendLoginAlert(am, true, nil)

	downloader := crawler.NewDownloader(browser, "")
	projects, err := downloader.ParseBidProjects(ctx)
	if err != nil {
		return fmt.Errorf("解析项目列表失败: %w", err)
	}

	if len(projects) == 0 {
		fmt.Println("未找到招标项目")
		return nil
	}

	fmt.Printf("\n找到 %d 个招标项目:\n", len(projects))
	fmt.Println(strings.Repeat("-", 90))
	fmt.Printf("%-3s %-15s %-40s %-12s\n", "序号", "项目编号", "项目名称", "开标时间")
	fmt.Println(strings.Repeat("-", 90))

	for i, p := range projects {
		bidTime := p.BidOpenTime.Format("2006-01-02")
		if p.BidOpenTime.IsZero() {
			bidTime = "-"
		}

		name := p.ProjectName
		if len([]rune(name)) > 38 {
			name = string([]rune(name)[:36]) + ".."
		}

		fmt.Printf("%-3d %-15s %-40s %-12s\n", i+1, p.ProjectID, name, bidTime)
	}

	fmt.Print("\n是否保存这些项目? [y/N]: ")
	save, _ := reader.ReadString('\n')
	if strings.ToLower(strings.TrimSpace(save)) == "y" {
		count := 0
		for _, p := range projects {
			if err := storage.SaveProject(&p); err == nil {
				count++
			}
		}
		fmt.Printf("已保存 %d 个项目\n", count)
		config.Logger.Info("保存招标项目", zap.Int("count", count))
	}

	return nil
}

func listProjects() {
	projects, err := storage.ListProjects()
	if err != nil {
		fmt.Printf("查询项目列表失败: %v\n", err)
		return
	}

	if len(projects) == 0 {
		fmt.Println("暂无项目数据，请先解析招标项目列表")
		return
	}

	fmt.Println("\n已保存的招标项目:")
	fmt.Println(strings.Repeat("-", 90))
	fmt.Printf("%-3s %-15s %-40s %-8s %-8s\n",
		"序号", "项目编号", "项目名称", "企业数", "文件数")
	fmt.Println(strings.Repeat("-", 90))

	for i, p := range projects {
		name := p.ProjectName
		if len([]rune(name)) > 38 {
			name = string([]rune(name)[:36]) + ".."
		}
		fmt.Printf("%-3d %-15s %-40s %-8d %-8d\n",
			i+1, p.ProjectID, name, p.CompanyCount, p.FileCount)
	}
	fmt.Println(strings.Repeat("-", 90))
}

func syncProject(cfg *config.Config, am *notify.AlertManager, reader *bufio.Reader) {
	projects, err := storage.ListProjects()
	if err != nil {
		fmt.Printf("查询项目列表失败: %v\n", err)
		return
	}

	if len(projects) == 0 {
		fmt.Println("暂无项目数据")
		return
	}

	listProjects()
	fmt.Print("\n请选择要同步的项目序号: ")
	idxStr, _ := reader.ReadString('\n')
	idxStr = strings.TrimSpace(idxStr)

	var idx int
	fmt.Sscanf(idxStr, "%d", &idx)
	if idx < 1 || idx > len(projects) {
		fmt.Println("无效的序号")
		return
	}

	project := projects[idx-1]
	fmt.Printf("正在同步项目: %s - %s\n", project.ProjectID, project.ProjectName)

	browser, err := crawler.NewBrowser()
	if err != nil {
		fmt.Printf("创建浏览器实例失败: %v\n", err)
		return
	}
	defer browser.Close()

	ctx := context.Background()

	if err := browser.EnsureLogin(ctx); err != nil {
		fmt.Printf("登录失败: %v\n", err)
		return
	}

	if err := syncProjectData(ctx, browser, project.ProjectID, am); err != nil {
		fmt.Printf("同步失败: %v\n", err)
		return
	}

	fmt.Println("同步完成！")
}

func syncProjectData(ctx context.Context, browser *crawler.Browser, projectID string, am *notify.AlertManager) error {
	project, err := storage.GetProject(projectID)
	if err != nil {
		return fmt.Errorf("获取项目信息失败: %w", err)
	}

	downloader := crawler.NewDownloader(browser, projectID)

	fmt.Printf("  正在解析企业列表...\n")
	companies, err := downloader.ParseCompanyList(ctx, project.ProjectURL)
	if err != nil {
		return fmt.Errorf("解析企业列表失败: %w", err)
	}

	fmt.Printf("  找到 %d 家企业，正在解析资质文件...\n", len(companies))

	totalFiles := 0
	for i, company := range companies {
		if err := storage.SaveCompany(&company); err != nil {
			config.Logger.Warn("保存企业信息失败",
				zap.String("company", company.CompanyName),
				zap.Error(err),
			)
			continue
		}

		fmt.Printf("  [%d/%d] 正在解析 %s 的资质文件...\n",
			i+1, len(companies), company.CompanyName)

		files, err := downloader.ParseCompanyFiles(ctx, &company)
		if err != nil {
			config.Logger.Warn("解析企业文件失败",
				zap.String("company", company.CompanyName),
				zap.Error(err),
			)
			continue
		}

		for _, file := range files {
			if err := storage.SaveFile(&file); err != nil {
				config.Logger.Warn("保存文件信息失败",
					zap.String("file", file.FileName),
					zap.Error(err),
				)
			}
		}
		totalFiles += len(files)
	}

	project.CompanyCount = len(companies)
	project.FileCount = totalFiles
	storage.SaveProject(project)

	config.Logger.Info("项目数据同步完成",
		zap.String("project_id", projectID),
		zap.Int("companies", len(companies)),
		zap.Int("files", totalFiles),
	)

	return nil
}

func startDownload(cfg *config.Config, am *notify.AlertManager, reader *bufio.Reader) {
	projects, err := storage.ListProjects()
	if err != nil {
		fmt.Printf("查询项目列表失败: %v\n", err)
		return
	}

	if len(projects) == 0 {
		fmt.Println("暂无项目数据，请先解析招标项目")
		return
	}

	listProjects()
	fmt.Print("\n请选择要下载的项目序号: ")
	idxStr, _ := reader.ReadString('\n')
	idxStr = strings.TrimSpace(idxStr)

	var idx int
	fmt.Sscanf(idxStr, "%d", &idx)
	if idx < 1 || idx > len(projects) {
		fmt.Println("无效的序号")
		return
	}

	project := projects[idx-1]

	fmt.Printf("\n当前配置:\n")
	fmt.Printf("  并发数: %d\n", cfg.Concurrency)
	fmt.Printf("  下载目录: %s\n", cfg.DownloadDir)
	fmt.Printf("  增量更新: %v\n", cfg.Incremental)

	fmt.Print("\n是否修改配置? [y/N]: ")
	modify, _ := reader.ReadString('\n')
	if strings.ToLower(strings.TrimSpace(modify)) == "y" {
		fmt.Print("  并发数 (默认3): ")
		concStr, _ := reader.ReadString('\n')
		concStr = strings.TrimSpace(concStr)
		if concStr != "" {
			fmt.Sscanf(concStr, "%d", &cfg.Concurrency)
		}

		fmt.Print("  下载目录 (默认 ./downloads): ")
		dirStr, _ := reader.ReadString('\n')
		dirStr = strings.TrimSpace(dirStr)
		if dirStr != "" {
			cfg.DownloadDir = dirStr
		}

		fmt.Print("  启用增量更新? [Y/n]: ")
		incStr, _ := reader.ReadString('\n')
		incStr = strings.TrimSpace(incStr)
		cfg.Incremental = strings.ToLower(incStr) != "n"
	}

	fmt.Printf("\n开始下载项目: %s - %s\n", project.ProjectID, project.ProjectName)
	fmt.Println("按 Ctrl+C 可安全中断程序")

	browser, err := crawler.NewBrowser()
	if err != nil {
		fmt.Printf("创建浏览器实例失败: %v\n", err)
		return
	}
	defer browser.Close()

	ctx := context.Background()

	if err := browser.EnsureLogin(ctx); err != nil {
		notify.SendLoginAlert(am, false, err)
		fmt.Printf("登录失败: %v\n", err)
		return
	}
	notify.SendLoginAlert(am, true, nil)

	browser.StartSessionKeepAlive(ctx)

	downloader := crawler.NewDownloader(browser, project.ProjectID)

	if err := downloader.Start(); err != nil {
		fmt.Printf("下载任务异常: %v\n", err)
		notify.SendSystemAlert(am, notify.SeverityError, "下载异常", err.Error(), err)
	}

	stats, _ := storage.GetStats(project.ProjectID)
	if stats.FailedFiles > 0 {
		notify.SendDownloadAlert(am, stats.FailedFiles, stats.TotalFiles)
	}

	checkExpiry(project.ProjectID, am)
	notify.GenerateDownloadReport(project.ProjectID)
}

func showStats(cfg *config.Config) {
	projects, err := storage.ListProjects()
	if err != nil {
		fmt.Printf("查询项目列表失败: %v\n", err)
		return
	}

	if len(projects) == 0 {
		fmt.Println("暂无统计数据")
		return
	}

	fmt.Println("\n下载统计报表:")
	fmt.Println(strings.Repeat("=", 90))
	fmt.Printf("%-15s %-30s %-8s %-8s %-8s %-8s %-8s %-10s\n",
		"项目编号", "项目名称", "总数", "完成", "失败", "跳过", "待处理", "成功率")
	fmt.Println(strings.Repeat("-", 90))

	for _, p := range projects {
		stats, err := storage.GetStats(p.ProjectID)
		if err != nil {
			continue
		}

		name := p.ProjectName
		if len([]rune(name)) > 28 {
			name = string([]rune(name)[:26]) + ".."
		}

		successRate := 0.0
		if stats.TotalFiles > 0 {
			successRate = float64(stats.CompletedFiles) / float64(stats.TotalFiles) * 100
		}

		fmt.Printf("%-15s %-30s %-8d %-8d %-8d %-8d %-8d %-10.2f%%\n",
			p.ProjectID, name, stats.TotalFiles, stats.CompletedFiles,
			stats.FailedFiles, stats.SkippedFiles, stats.PendingFiles, successRate)
	}
	fmt.Println(strings.Repeat("=", 90))
}

func checkExpiry(projectID string, am *notify.AlertManager) error {
	warnings, err := storage.GetExpiryWarnings(projectID, config.GlobalConfig.WarnDays)
	if err != nil {
		return err
	}

	if len(warnings) > 0 {
		notify.SendExpiryAlert(am, warnings)
	}

	return notify.GenerateExpiryReport(projectID, warnings)
}

func checkExpiryInteractive(cfg *config.Config, am *notify.AlertManager, reader *bufio.Reader) {
	projects, err := storage.ListProjects()
	if err != nil {
		fmt.Printf("查询项目列表失败: %v\n", err)
		return
	}

	if len(projects) == 0 {
		fmt.Println("暂无项目数据")
		return
	}

	listProjects()
	fmt.Print("\n请选择要检查的项目序号: ")
	idxStr, _ := reader.ReadString('\n')
	idxStr = strings.TrimSpace(idxStr)

	var idx int
	fmt.Sscanf(idxStr, "%d", &idx)
	if idx < 1 || idx > len(projects) {
		fmt.Println("无效的序号")
		return
	}

	project := projects[idx-1]

	fmt.Print("预警天数 (默认30): ")
	daysStr, _ := reader.ReadString('\n')
	daysStr = strings.TrimSpace(daysStr)
	warnDays := config.GlobalConfig.WarnDays
	if daysStr != "" {
		fmt.Sscanf(daysStr, "%d", &warnDays)
	}

	warnings, err := storage.GetExpiryWarnings(project.ProjectID, warnDays)
	if err != nil {
		fmt.Printf("查询失败: %v\n", err)
		return
	}

	notify.SendExpiryAlert(am, warnings)
	notify.GenerateExpiryReport(project.ProjectID, warnings)
}

func retryFailed(cfg *config.Config, am *notify.AlertManager, reader *bufio.Reader) {
	projects, err := storage.ListProjects()
	if err != nil {
		fmt.Printf("查询项目列表失败: %v\n", err)
		return
	}

	if len(projects) == 0 {
		fmt.Println("暂无项目数据")
		return
	}

	listProjects()
	fmt.Print("\n请选择要重试的项目序号: ")
	idxStr, _ := reader.ReadString('\n')
	idxStr = strings.TrimSpace(idxStr)

	var idx int
	fmt.Sscanf(idxStr, "%d", &idx)
	if idx < 1 || idx > len(projects) {
		fmt.Println("无效的序号")
		return
	}

	project := projects[idx-1]

	failedFiles, err := storage.GetFilesByProject(project.ProjectID, storage.StatusFailed)
	if err != nil {
		fmt.Printf("查询失败文件失败: %v\n", err)
		return
	}

	if len(failedFiles) == 0 {
		fmt.Println("该项目没有失败的下载任务")
		return
	}

	fmt.Printf("找到 %d 个失败的文件，开始重试...\n", len(failedFiles))

	browser, err := crawler.NewBrowser()
	if err != nil {
		fmt.Printf("创建浏览器实例失败: %v\n", err)
		return
	}
	defer browser.Close()

	ctx := context.Background()

	if err := browser.EnsureLogin(ctx); err != nil {
		fmt.Printf("登录失败: %v\n", err)
		return
	}

	cfg.RetryFailed = true
	downloader := crawler.NewDownloader(browser, project.ProjectID)
	if err := downloader.Start(); err != nil {
		fmt.Printf("重试下载失败: %v\n", err)
	}
}
