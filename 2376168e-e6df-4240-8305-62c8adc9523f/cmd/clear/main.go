package main

import (
	"fmt"
	"os"
	"time"

	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"clear-system/internal/config"
	"clear-system/internal/db"
	"clear-system/internal/model"
)

var (
	cfgFile     string
	verbose     bool
	dryRun      bool
	bizDate     string
	appConfig   *config.AppConfig
	database    *db.Database
)

var green = color.New(color.FgGreen, color.Bold).SprintFunc()
var yellow = color.New(color.FgYellow, color.Bold).SprintFunc()
var red = color.New(color.FgRed, color.Bold).SprintFunc()
var cyan = color.New(color.FgCyan).SprintFunc()
var white = color.New(color.FgWhite).SprintFunc()

var rootCmd = &cobra.Command{
	Use:   "clear",
	Short: "区域金融清算中心日终清算系统",
	Long: `clear - 区域金融清算中心日终清算系统

功能特性：
  • 多格式解析（CSV、定宽文本、XML）
  • 智能双向对账（支持容差、单向补录）
  • 轧差清算（多币种、多周期）
  • Excel报告生成（对账明细/轧差汇总/异常清单）

  清算流程：parse → reconcile → settle → report

使用示例：
  clear parse -f csv -t templates/csv_tpl.yaml -i input/xxx.csv -d 2026-06-22
  clear reconcile -d 2026-06-22 --workers 4
  clear settle -d 2026-06-22 --cycle daily
  clear report -d 2026-06-22 -o output/

Copyright © 2026 区域金融清算中心
`,
	Version: "1.0.0",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		var err error
		appConfig, err = config.Load(cfgFile)
		if err != nil {
			return fmt.Errorf("加载配置失败: %w", err)
		}
		database, err = db.Init(appConfig.Database.Path)
		if err != nil {
			return fmt.Errorf("初始化数据库失败: %w", err)
		}
		if bizDate == "" {
			bizDate = time.Now().Format("2006-01-02")
		}
		if verbose {
			fmt.Printf("%s 业务日期: %s\n", cyan("[INFO]"), bizDate)
			fmt.Printf("%s 配置文件: %s\n", cyan("[INFO]"), cfgFile)
			fmt.Printf("%s 数据库: %s\n", cyan("[INFO]"), appConfig.Database.Path)
		}
		if dryRun {
			fmt.Printf("%s 预演模式 - 所有操作不会真正写入\n", yellow("[DRY-RUN]"))
		}
		return nil
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		if database != nil {
			database.Close()
		}
	},
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&cfgFile, "config", "c", "configs/config.yaml", "配置文件路径")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "输出详细日志")
	rootCmd.PersistentFlags().BoolVar(&dryRun, "dry-run", false, "预演模式（不写入数据）")
	rootCmd.PersistentFlags().StringVarP(&bizDate, "date", "d", "", "业务日期 (YYYY-MM-DD, 默认: 今天)")

	rootCmd.AddCommand(parseCmd)
	rootCmd.AddCommand(reconcileCmd)
	rootCmd.AddCommand(settleCmd)
	rootCmd.AddCommand(reportCmd)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, red("[ERROR]"), err)
		os.Exit(1)
	}
}

func writeAudit(opType, operator, detail, result string) {
	if database == nil {
		return
	}
	log := model.AuditLog{
		OpTime:   time.Now(),
		OpType:   opType,
		Operator: operator,
		InstID:   "SYSTEM",
		BizDate:  bizDate,
		Detail:   detail,
		Result:   result,
	}
	if dryRun {
		if verbose {
			fmt.Printf("%s [AUDIT] %s - %s - %s\n", yellow("[DRY-RUN]"), opType, operator, result)
		}
		return
	}
	_ = database.InsertAuditLog(log)
}

func main() {
	Execute()
}
