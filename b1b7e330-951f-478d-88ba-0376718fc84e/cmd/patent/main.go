package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/fatih/color"
	"github.com/rodaine/table"
	"github.com/schollz/progressbar/v3"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"patent-agent/internal/config"
	"patent-agent/internal/model"
	"patent-agent/internal/scraper"
	"patent-agent/internal/service"
	"patent-agent/pkg/notify"
)

var (
	cfgFile      string
	systemName   string
	appNum       string
	exportFormat string
	exportOutput string
	enterprise   string
	agent        string
	patentType   string
	daemonMode   bool
	submitDir    string
)

var (
	db          *gorm.DB
	patentSvc   *service.PatentService
	cniprSc     *scraper.CNIPRScraper
	cpquerySc   *scraper.CPQueryScraper
	feequerySc  *scraper.FeeQueryScraper
	notifier    *notify.MultiNotifier
)

var rootCmd = &cobra.Command{
	Use:   "patent",
	Short: "专利代理业务管理系统",
	Long:  `多系统统一登录、专利状态聚合、期限预警、批量操作的专利代理管理工具`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		return initApp()
	},
}

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "扫码登录官方系统",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		switch strings.ToLower(systemName) {
		case "cnipr":
			return cniprSc.LoginWithQRCode(ctx)
		case "cpquery":
			return cpquerySc.LoginWithQRCode(ctx)
		case "feequery":
			return feequerySc.LoginWithQRCode(ctx)
		case "all":
			if err := cniprSc.LoginWithQRCode(ctx); err != nil {
				color.Red("CNIPR 登录失败: %v", err)
			}
			if err := cpquerySc.LoginWithQRCode(ctx); err != nil {
				color.Red("CPQuery 登录失败: %v", err)
			}
			if err := feequerySc.LoginWithQRCode(ctx); err != nil {
				color.Red("FeeQuery 登录失败: %v", err)
			}
			return nil
		default:
			return fmt.Errorf("未知系统: %s, 可选: cnipr/cpquery/feequery/all", systemName)
		}
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "查询专利聚合状态",
	RunE: func(cmd *cobra.Command, args []string) error {
		if appNum != "" {
			status, err := patentSvc.GetAggregatedStatus(appNum)
			if err != nil {
				return err
			}
			printStatusDetail(status)
			return nil
		}

		patents, err := patentSvc.ListPatents(enterprise, agent, patentType)
		if err != nil {
			return err
		}
		printStatusTable(patents)
		fmt.Printf("\n共 %d 条记录\n", len(patents))
		return nil
	},
}

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "同步专利数据",
	RunE: func(cmd *cobra.Command, args []string) error {
		if appNum != "" {
			color.Cyan("正在同步专利: %s", appNum)
			if err := patentSvc.SyncSinglePatent(appNum); err != nil {
				return err
			}
			color.Green("同步完成: %s", appNum)
			return nil
		}

		color.Cyan("开始全量同步...")
		bar := progressbar.Default(100, "同步进度")

		success, err := patentSvc.SyncAll(func(current, total int) {
			pct := int64(float64(current) / float64(total) * 100)
			bar.Set64(pct)
		})
		bar.Finish()

		if err != nil {
			return err
		}
		color.Green("同步完成，成功 %d 件", success)
		return nil
	},
}

var alertCmd = &cobra.Command{
	Use:   "alert",
	Short: "检查并发送期限预警",
	RunE: func(cmd *cobra.Command, args []string) error {
		color.Cyan("正在检查期限预警...")
		alerts, err := patentSvc.CheckAndSendAlerts()
		if err != nil {
			return err
		}

		if len(alerts) == 0 {
			color.Green("当前没有需要处理的预警")
			return nil
		}

		printAlerts(alerts)
		color.Yellow("\n共 %d 条预警已处理", len(alerts))
		return nil
	},
}

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出专利数据",
	RunE: func(cmd *cobra.Command, args []string) error {
		if exportOutput == "" {
			ext := ".xlsx"
			if strings.ToLower(exportFormat) == "csv" {
				ext = ".csv"
			}
			exportOutput = fmt.Sprintf("./exports/patent_export_%s%s",
				time.Now().Format("20060102_150405"), ext)
		}

		opts := service.ExportOptions{
			Format:     exportFormat,
			Enterprise: enterprise,
			Agent:      agent,
			PatentType: patentType,
		}

		color.Cyan("正在导出数据到: %s", exportOutput)
		if err := patentSvc.ExportData(opts, exportOutput); err != nil {
			return err
		}
		color.Green("导出完成: %s", exportOutput)
		return nil
	},
}

var submitCmd = &cobra.Command{
	Use:   "submit",
	Short: "批量提交专利申请",
	RunE: func(cmd *cobra.Command, args []string) error {
		if submitDir == "" {
			return fmt.Errorf("请指定申请文件目录 --dir")
		}

		color.Cyan("正在扫描目录: %s", submitDir)
		bar := progressbar.Default(100, "提交进度")

		success, failed, err := patentSvc.BatchSubmitFromDirectory(submitDir, func(current, total int) {
			pct := int64(float64(current) / float64(total) * 100)
			bar.Set64(pct)
		})
		bar.Finish()

		if err != nil {
			return err
		}

		color.Green("提交完成: 成功 %d 件", success)
		if len(failed) > 0 {
			color.Red("失败 %d 件:", len(failed))
			for _, f := range failed {
				fmt.Printf("  - %s\n", f)
			}
		}
		return nil
	},
}

var reportCmd = &cobra.Command{
	Use:   "report",
	Short: "生成月度统计报表",
	RunE: func(cmd *cobra.Command, args []string) error {
		now := time.Now()
		year := now.Year()
		month := int(now.Month())
		if len(args) >= 2 {
			fmt.Sscanf(args[0], "%d", &year)
			fmt.Sscanf(args[1], "%d", &month)
		}

		report, err := patentSvc.GenerateMonthlyReport(year, month)
		if err != nil {
			return err
		}

		fmt.Println()
		color.Cyan("========== %s 月度工作报表 ==========", report["period"])
		fmt.Printf("本月新申请: %d 件\n", report["totalFiled"])
		fmt.Printf("本月授权: %d 件\n\n", report["authorized"])

		fmt.Println("按专利类型统计:")
		for _, tc := range report["typeCounts"].([]struct {
			PatentType string
			Count      int64
		}) {
			typeName := map[string]string{"invention": "发明专利", "utility": "实用新型", "design": "外观设计"}[tc.PatentType]
			if typeName == "" {
				typeName = tc.PatentType
			}
			fmt.Printf("  %s: %d 件\n", typeName, tc.Count)
		}

		fmt.Println("\n代理师工作量 TOP 10:")
		for i, ac := range report["agentStats"].([]struct {
			AgentName string
			Count     int64
		}) {
			name := ac.AgentName
			if name == "" {
				name = "(未指定)"
			}
			fmt.Printf("  %d. %s: %d 件\n", i+1, name, ac.Count)
		}
		return nil
	},
}

var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "后台守护进程模式",
	RunE: func(cmd *cobra.Command, args []string) error {
		color.Cyan("启动守护进程模式...")

		if err := patentSvc.StartScheduler(&config.AppConfig.Schedule); err != nil {
			return err
		}
		defer patentSvc.StopScheduler()

		color.Green("守护进程已启动，按 Ctrl+C 退出")

		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		color.Yellow("\n收到退出信号，正在关闭...")
		return nil
	},
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&cfgFile, "config", "c", "", "配置文件路径")

	loginCmd.Flags().StringVarP(&systemName, "system", "s", "", "系统名称: cnipr/cpquery/feequery/all")
	loginCmd.MarkFlagRequired("system")

	statusCmd.Flags().StringVarP(&appNum, "appnum", "a", "", "申请号")
	statusCmd.Flags().StringVarP(&enterprise, "enterprise", "e", "", "企业名称筛选")
	statusCmd.Flags().StringVarP(&agent, "agent", "g", "", "代理师筛选")
	statusCmd.Flags().StringVarP(&patentType, "type", "t", "", "专利类型: invention/utility/design")

	syncCmd.Flags().StringVarP(&appNum, "appnum", "a", "", "申请号（单件同步）")

	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "excel", "导出格式: excel/csv")
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "输出文件路径")
	exportCmd.Flags().StringVarP(&enterprise, "enterprise", "e", "", "企业名称筛选")
	exportCmd.Flags().StringVarP(&agent, "agent", "g", "", "代理师筛选")
	exportCmd.Flags().StringVarP(&patentType, "type", "t", "", "专利类型筛选")

	submitCmd.Flags().StringVarP(&submitDir, "dir", "d", "", "申请文件目录")

	rootCmd.AddCommand(loginCmd, statusCmd, syncCmd, alertCmd, exportCmd, submitCmd, reportCmd, daemonCmd)
}

func initApp() error {
	cfg, err := config.Load(cfgFile)
	if err != nil {
		return fmt.Errorf("load config failed: %w", err)
	}

	if _, err := config.InitLogger(&cfg.Log); err != nil {
		return fmt.Errorf("init logger failed: %w", err)
	}

	if err := os.MkdirAll("./data", 0755); err != nil {
		return err
	}

	db, err = gorm.Open(sqlite.Open(cfg.Database.DSN), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("open database failed: %w", err)
	}

	if err := model.Migrate(db); err != nil {
		return fmt.Errorf("migrate database failed: %w", err)
	}

	cniprSc = scraper.NewCNIPRScraper(cfg.Systems.CNIPR, db)
	cpquerySc = scraper.NewCPQueryScraper(cfg.Systems.CPQuery, db)
	feequerySc = scraper.NewFeeQueryScraper(cfg.Systems.FeeQuery, db)

	notifier = notify.NewMultiNotifier(&cfg.Notify)

	patentSvc = service.NewPatentService(
		db, cniprSc, cpquerySc, feequerySc, notifier,
		&cfg.Alert, &cfg.Default,
	)

	config.Logger.Info("application initialized",
		zap.String("database", cfg.Database.DSN),
	)
	return nil
}

func printStatusDetail(s *service.AggregatedPatentStatus) {
	fmt.Println()
	color.Cyan("========== 专利详情 ==========")
	fmt.Printf("申请号:   %s\n", s.AppNum)
	fmt.Printf("标题:     %s\n", s.Title)
	typeName := map[string]string{"invention": "发明专利", "utility": "实用新型", "design": "外观设计"}[s.PatentType]
	if typeName == "" {
		typeName = s.PatentType
	}
	fmt.Printf("专利类型: %s\n", typeName)
	fmt.Printf("当前状态: %s\n", s.Status)
	fmt.Printf("企业名称: %s\n", s.EnterpriseName)
	fmt.Printf("代理师:   %s\n", s.AgentName)
	if s.FilingDate != nil {
		fmt.Printf("申请日:   %s\n", s.FilingDate.Format("2006-01-02"))
	}
	fmt.Println()
	color.Cyan("--- 各系统状态 ---")
	fmt.Printf("CNIPR申请系统:   %s\n", displayStatus(s.CNIPRStatus))
	fmt.Printf("CPQuery查询系统: %s\n", displayStatus(s.CPQueryStatus))
	fmt.Printf("FeeQuery缴费系统: %s\n", displayFeeStatus(s.FeeStatus))
	if s.NextDueDate != nil {
		days := int(time.Until(*s.NextDueDate).Hours() / 24)
		fmt.Println()
		if days < 0 {
			color.Red("⚠ 已超期: %s (%s, 超期%d天)", s.NextDueType, s.NextDueDate.Format("2006-01-02"), -days)
		} else if days <= 3 {
			color.Red("⚠ 紧急期限: %s (%s, 剩余%d天)", s.NextDueType, s.NextDueDate.Format("2006-01-02"), days)
		} else if days <= 7 {
			color.Yellow("⚡ 近期期限: %s (%s, 剩余%d天)", s.NextDueType, s.NextDueDate.Format("2006-01-02"), days)
		} else {
			color.Green("✓ 下次期限: %s (%s, 剩余%d天)", s.NextDueType, s.NextDueDate.Format("2006-01-02"), days)
		}
	}
	if s.LastSyncedAt != nil {
		fmt.Printf("\n最后同步: %s\n", s.LastSyncedAt.Format("2006-01-02 15:04:05"))
	}
	fmt.Println()
}

func printStatusTable(patents []service.AggregatedPatentStatus) {
	headerFmt := color.New(color.FgCyan, color.Underline).SprintfFunc()
	columnFmt := color.New(color.FgHiWhite).SprintfFunc()

	tbl := table.New("申请号", "标题", "类型", "状态", "企业", "代理师", "CNIPR", "CPQuery", "缴费", "期限")
	tbl.WithHeaderFormatter(headerFmt).WithFirstColumnFormatter(columnFmt)

	for _, p := range patents {
		typeShort := map[string]string{"invention": "发明", "utility": "实用", "design": "外观"}[p.PatentType]
		if typeShort == "" {
			typeShort = p.PatentType
		}

		title := truncate(p.Title, 20)
		ent := truncate(p.EnterpriseName, 12)
		ag := truncate(p.AgentName, 8)

		nextDue := "-"
		if p.NextDueDate != nil {
			days := int(time.Until(*p.NextDueDate).Hours() / 24)
			if days < 0 {
				nextDue = color.RedString("超期%d天", -days)
			} else if days <= 3 {
				nextDue = color.RedString("%d天", days)
			} else if days <= 7 {
				nextDue = color.YellowString("%d天", days)
			} else {
				nextDue = color.GreenString("%d天", days)
			}
		}

		feeDisplay := displayFeeStatus(p.FeeStatus)

		tbl.AddRow(p.AppNum, title, typeShort, p.Status, ent, ag,
			displayStatus(p.CNIPRStatus), displayStatus(p.CPQueryStatus), feeDisplay, nextDue)
	}
	tbl.Print()
}

func printAlerts(alerts []model.AlertRecord) {
	fmt.Println()
	headerFmt := color.New(color.FgCyan, color.Underline).SprintfFunc()
	tbl := table.New("级别", "申请号", "类型", "标题", "期限")
	tbl.WithHeaderFormatter(headerFmt)

	for _, a := range alerts {
		levelDisplay := ""
		switch a.AlertLevel {
		case model.AlertCritical:
			levelDisplay = color.RedString("紧急")
		case model.AlertWarning:
			levelDisplay = color.YellowString("预警")
		default:
			levelDisplay = color.GreenString("通知")
		}

		dueDate := "-"
		if a.DueDate != nil {
			dueDate = a.DueDate.Format("2006-01-02")
		}

		tbl.AddRow(levelDisplay, a.PatentApplication.AppNum, a.AlertType,
			truncate(a.AlertTitle, 40), dueDate)
	}
	tbl.Print()
}

func displayStatus(s string) string {
	if s == "" {
		return color.HiBlackString("-")
	}
	return s
}

func displayFeeStatus(s string) string {
	switch s {
	case "paid":
		return color.GreenString("已缴")
	case "unpaid":
		return color.YellowString("未缴")
	case "overdue":
		return color.RedString("逾期")
	case "":
		return color.HiBlackString("-")
	default:
		return s
	}
}

func truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + "…"
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		color.Red("错误: %v", err)
		os.Exit(1)
	}
}
