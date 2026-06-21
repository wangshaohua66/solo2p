// Command scheduler is the command-line dispatch assistant for a regional gas
// pipeline operator. It provides eight subcommands (collect, calculate,
// balance, dispatch, archive, export, monitor, config) plus an optional serve
// subcommand that exposes the same capabilities over an Echo v4 REST API for
// downstream SCADA/MES/finance integration.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/spf13/cobra"

	"scheduler/internal/api"
	"scheduler/internal/config"
	"scheduler/internal/storage"
)

// global flags shared by every subcommand.
var (
	cfgPath string
	envName string
	noColor bool
)

// runtime configuration holder used by the serve command so hot reloads can
// swap the active snapshot without restarting the process.
var (
	curCfgMu sync.RWMutex
	curCfg   *config.Config
)

func main() {
	root := newRootCmd()
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

func newRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "scheduler",
		Short: "天然气管道调度辅助工具",
		Long: `scheduler —— 区域天然气管道输送公司命令行调度辅助工具

支持计量数据自动采集校验、管段压损计算、供需平衡推演、调度指令生成、
历史记录归档与结算报表导出，并提供 REST API 供外部系统集成。

子命令：
  collect    采集各分输站计量数据并校验入库
  calculate  计算各管段压力损失与安全裕度
  balance    供需平衡推演并生成多套备选方案
  dispatch   生成标准化调度指令并按紧急程度排序
  archive    查询并导出历史调度记录
  export     导出结算报表或原始计量数据
  monitor    实时刷新各站点压力流量仪表盘
  config     查看、校验、热更新配置参数
  serve      启动 Echo HTTP API 服务（供外部系统调用）

示例：
  scheduler --config configs/config.yaml collect
  scheduler --config configs/config.yaml calculate
  scheduler --config configs/config.yaml balance --demo --plans 3
  scheduler --config configs/config.yaml dispatch --source losses --operator 张工
  scheduler --config configs/config.yaml export --month 2026-06 --out settlement.csv
  scheduler --config configs/config.yaml monitor --interval 5s
  scheduler --config configs/config.yaml serve --port 8080`,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if noColor {
				colorEnabled = false
			}
			if cmd.Name() == "help" || cmd.Name() == "completion" {
				return nil
			}
			return nil
		},
	}
	root.PersistentFlags().StringVarP(&cfgPath, "config", "c", "configs/config.yaml", "配置文件路径")
	root.PersistentFlags().StringVarP(&envName, "env", "e", "", "环境名（覆盖配置中的 env）")
	root.PersistentFlags().BoolVar(&noColor, "no-color", false, "禁用彩色输出")

	root.AddCommand(newCollectCmd())
	root.AddCommand(newCalculateCmd())
	root.AddCommand(newBalanceCmd())
	root.AddCommand(newDispatchCmd())
	root.AddCommand(newArchiveCmd())
	root.AddCommand(newExportCmd())
	root.AddCommand(newMonitorCmd())
	root.AddCommand(newConfigCmd())
	root.AddCommand(newServeCmd())
	return root
}

// newServeCmd starts the Echo HTTP API server.
func newServeCmd() *cobra.Command {
	var port int
	var reload bool
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "启动 Echo HTTP API 服务",
		Long: `启动 Echo v4 HTTP 服务，暴露 /api/* 端点供下游 SCADA/MES/财务系统调用，
支持配置文件热更新（变更自动重载并记录审计日志）。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			curCfg = cfg
			if reload {
				cfg.SetAuditSink(repo)
				cfg.StartHotReload(5*time.Second, func(next *config.Config) {
					next.SetAuditSink(repo)
					curCfgMu.Lock()
					curCfg = next
					curCfgMu.Unlock()
					fmt.Printf("[hot-reload] 配置已重新加载\n")
				})
				defer cfg.StopHotReload()
			}
			e := echo.New()
			e.HideBanner = true
			api.New(api.Deps{Repo: repo, Cfg: curSnapshot}).Register(e)
			addr := fmt.Sprintf(":%d", port)
			if cfg.Server.Port != 0 && port == 0 {
				addr = fmt.Sprintf(":%d", cfg.Server.Port)
			}
			if port == 0 {
				port = 8080
				addr = ":8080"
			}
			stop := make(chan os.Signal, 1)
			signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
			go func() {
				fmt.Printf("%s Echo API 服务启动于 http://localhost%s/api/health\n",
					paint(colorGreen, "▸"), addr)
				if err := e.Start(addr); err != nil {
					fmt.Fprintf(os.Stderr, "server stopped: %v\n", err)
				}
			}()
			<-stop
			fmt.Println("\n正在关闭服务...")
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = e.Shutdown(ctx)
			return nil
		},
	}
	cmd.Flags().IntVarP(&port, "port", "p", 0, "监听端口（默认配置或 8080）")
	cmd.Flags().BoolVar(&reload, "reload", true, "启用配置热更新")
	return cmd
}

// curSnapshot returns the currently active configuration snapshot in a
// concurrency-safe manner.
func curSnapshot() config.Config {
	curCfgMu.RLock()
	defer curCfgMu.RUnlock()
	return curCfg.Snapshot()
}

// loadApp loads the configuration and opens the SQLite repository, wiring the
// repository as the config audit sink. It returns a cleanup function the
// caller must defer.
func loadApp() (*config.Config, *storage.Repository, func(), error) {
	cfg, err := config.Load(cfgPath, envName)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("load config: %w", err)
	}
	maxOpen := cfg.Database.MaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 10 // supports 10 concurrent dispatchers per the performance budget
	}
	repo, err := storage.New(cfg.Database.Path, maxOpen)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("open storage: %w", err)
	}
	cfg.SetAuditSink(repo)
	cleanup := func() {
		_ = repo.Close()
	}
	return cfg, repo, cleanup, nil
}
