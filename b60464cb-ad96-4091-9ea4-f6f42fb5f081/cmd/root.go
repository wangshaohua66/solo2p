package cmd

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"terminal-dispatcher/internal/config"
	"terminal-dispatcher/internal/db"
	"terminal-dispatcher/internal/dispatcher"
	"terminal-dispatcher/internal/notifier"
)

var (
	cfgFile    string
	noColor    bool
	AppConfig  *config.Config
	Dispatcher *dispatcher.Dispatcher
	Notifier   *notifier.Notifier
)

var rootCmd = &cobra.Command{
	Use:   "td",
	Short: "集装箱码头调度系统 (Terminal Dispatcher)",
	Long: `集装箱码头调度命令行工具，支持：
  - 泊位分配管理
  - 堆场箱位优化
  - 集卡调度与路径规划
  - 船舶动态跟踪
  - 海关放行监控
  - 运营统计报表`,
	Version: "1.0.0",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		if noColor {
			color.NoColor = true
		}
		initConfig()
	},
	Run: func(cmd *cobra.Command, args []string) {
		cmd.Help()
	},
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&cfgFile, "config", "c", "", "配置文件路径 (默认 ./config.yaml)")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "禁用彩色输出")

	rootCmd.AddCommand(berthCmd)
	rootCmd.AddCommand(yardCmd)
	rootCmd.AddCommand(truckCmd)
	rootCmd.AddCommand(vesselCmd)
	rootCmd.AddCommand(releaseCmd)
	rootCmd.AddCommand(statsCmd)
	rootCmd.AddCommand(configCmd)
}

func initConfig() {
	cfg, err := config.Load(cfgFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "警告: 加载配置失败: %v\n使用默认配置\n", err)
		cfg = &config.Config{}
	}
	AppConfig = cfg

	Notifier = notifier.New(&cfg.Notifier)
	Dispatcher = dispatcher.New(&cfg.Dispatch, Notifier)
}

func initDB() error {
	if err := db.InitDB(&AppConfig.Database); err != nil {
		return fmt.Errorf("连接数据库失败: %w", err)
	}
	return nil
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
