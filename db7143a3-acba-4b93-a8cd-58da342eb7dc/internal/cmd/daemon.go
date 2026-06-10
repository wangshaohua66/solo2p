package cmd

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/log"
	"github.com/remote-sensing/sentinel-cli/internal/pipeline"
	"github.com/remote-sensing/sentinel-cli/internal/store"
	"github.com/remote-sensing/sentinel-cli/internal/types"
)

var (
	daemonWatchDir      string
	daemonTaskType      string
	daemonOutputDir     string
	daemonPIDFile       string
	daemonLogFile       string
	daemonSystemd       bool
	daemonPollInterval  int
	daemonUseFSNotify   bool
	daemonFileExtensions []string
)

var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "守护进程管理 | Daemon Management",
	Long: `Sentinel 守护进程 - 后台监控新文件并自动处理
Sentinel Daemon - Watch for new files in background and auto-process

支持以下操作：
  - start: 启动守护进程
  - stop:  停止守护进程
  - status: 查看守护进程状态

Supported operations:
  - start: Start the daemon
  - stop:  Stop the daemon
  - status: Check daemon status`,
}

var daemonStartCmd = &cobra.Command{
	Use:   "start",
	Short: "启动守护进程 | Start daemon",
	Long: `启动 Sentinel 守护进程，监控指定目录中的新文件并自动加入处理队列
Start Sentinel daemon to watch for new files in specified directory and auto-enqueue to processing queue

特性 | Features:
  - 使用文件系统事件或轮询监控新文件 | Watch for new files using fs events or polling
  - 自动将任务加入 BoltDB 队列 | Auto-enqueue tasks to BoltDB
  - 支持优雅关闭 (SIGTERM/SIGINT) | Support graceful shutdown
  - Systemd 集成 (Type=notify, socket activation) | Systemd integration
  - 空闲时 CPU 使用率 < 1% | < 1% CPU usage when idle`,
	Example: `  # 后台监控 /data/input 目录，自动计算 NDVI
  # Watch /data/input directory, auto-calculate NDVI
  sentinel daemon start --watch-dir /data/input --task-type ndvi --output-dir /data/output

  # 使用 5 秒轮询间隔监控
  # Watch with 5 second polling interval
  sentinel daemon start -w /data/input --task-type evi --poll-interval 5000

  # 生成 systemd unit 文件
  # Generate systemd unit file
  sentinel daemon start --systemd > /etc/systemd/system/sentinel-daemon.service

  # 指定 PID 和日志文件
  # Specify PID and log file
  sentinel daemon start -w /data/input --task-type savi \
    --pid-file /var/run/sentinel.pid --log-file /var/log/sentinel.log`,
	RunE: runDaemonStart,
}

var daemonStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "停止守护进程 | Stop daemon",
	Long: `停止正在运行的 Sentinel 守护进程
Stop the running Sentinel daemon

通过 PID 文件读取进程 ID，发送 SIGTERM 信号并等待优雅关闭。
Read process ID from PID file, send SIGTERM and wait for graceful shutdown.`,
	Example: `  # 使用默认 PID 文件停止守护进程
  # Stop daemon using default PID file
  sentinel daemon stop

  # 指定 PID 文件
  # Specify PID file
  sentinel daemon stop --pid-file /var/run/sentinel.pid`,
	RunE: runDaemonStop,
}

var daemonStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "查看守护进程状态 | Check daemon status",
	Long: `查看 Sentinel 守护进程的运行状态
Check the running status of Sentinel daemon`,
	Example: `  # 查看默认守护进程状态
  sentinel daemon status

  # 指定 PID 文件
  sentinel daemon status --pid-file /var/run/sentinel.pid`,
	RunE: runDaemonStatus,
}

func init() {
	daemonStartCmd.Flags().StringVarP(&daemonWatchDir, "watch-dir", "w", "",
		"监控目录路径 | Directory to watch for new files")
	daemonStartCmd.Flags().StringVar(&daemonTaskType, "task-type", "",
		"任务类型: crs/ndvi/evi/savi | Task type: crs/ndvi/evi/savi")
	daemonStartCmd.Flags().StringVarP(&daemonOutputDir, "output-dir", "o", "",
		"输出目录路径 | Output directory path")
	daemonStartCmd.Flags().StringVar(&daemonPIDFile, "pid-file", "",
		"PID 文件路径 | PID file path")
	daemonStartCmd.Flags().StringVar(&daemonLogFile, "log-file", "",
		"日志文件路径 | Log file path")
	daemonStartCmd.Flags().BoolVar(&daemonSystemd, "systemd", false,
		"生成 systemd unit 文件并退出 | Generate systemd unit file and exit")
	daemonStartCmd.Flags().IntVar(&daemonPollInterval, "poll-interval", 2000,
		"文件轮询间隔（毫秒） | File polling interval in milliseconds")
	daemonStartCmd.Flags().BoolVar(&daemonUseFSNotify, "use-fsnotify", false,
		"使用 fsnotify 监控（默认轮询） | Use fsnotify (default: polling)")
	daemonStartCmd.Flags().StringSliceVar(&daemonFileExtensions, "extensions", []string{".tif", ".tiff"},
		"监控的文件扩展名 | File extensions to watch")

	daemonStopCmd.Flags().StringVar(&daemonPIDFile, "pid-file", "",
		"PID 文件路径 | PID file path")

	daemonStatusCmd.Flags().StringVar(&daemonPIDFile, "pid-file", "",
		"PID 文件路径 | PID file path")

	_ = daemonStartCmd.MarkFlagRequired("watch-dir")
	_ = daemonStartCmd.MarkFlagRequired("task-type")

	daemonCmd.AddCommand(daemonStartCmd)
	daemonCmd.AddCommand(daemonStopCmd)
	daemonCmd.AddCommand(daemonStatusCmd)
	rootCmd.AddCommand(daemonCmd)
}

func runDaemonStart(cmd *cobra.Command, args []string) error {
	if daemonSystemd {
		return generateSystemdUnit()
	}

	taskType, err := parseTaskType(daemonTaskType)
	if err != nil {
		return err
	}

	if daemonWatchDir == "" {
		return apperrors.New(apperrors.E4001,
			"监控目录不能为空 | Watch directory cannot be empty")
	}

	absWatchDir, err := filepath.Abs(daemonWatchDir)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E4001,
			fmt.Sprintf("无法解析监控目录路径 | Cannot resolve watch directory path: %s", daemonWatchDir))
	}

	if _, err := os.Stat(absWatchDir); os.IsNotExist(err) {
		return apperrors.New(apperrors.E4001,
			fmt.Sprintf("监控目录不存在 | Watch directory does not exist: %s", absWatchDir))
	}

	if daemonOutputDir != "" {
		absOutputDir, err := filepath.Abs(daemonOutputDir)
		if err != nil {
			return apperrors.Wrap(err, apperrors.E4001,
				fmt.Sprintf("无法解析输出目录路径 | Cannot resolve output directory path: %s", daemonOutputDir))
		}
		if err := os.MkdirAll(absOutputDir, 0755); err != nil {
			return apperrors.Wrap(err, apperrors.E1005,
				fmt.Sprintf("无法创建输出目录 | Cannot create output directory: %s", absOutputDir))
		}
		AppConfig.Global.OutputDirectory = absOutputDir
	}

	pidFile := daemonPIDFile
	if pidFile == "" {
		pidFile = AppConfig.Daemon.PIDFile
	}
	if pidFile == "" {
		pidFile = "/var/run/sentinel-daemon.pid"
	}

	if err := checkAndWritePIDFile(pidFile); err != nil {
		return err
	}
	defer removePIDFile(pidFile)

	logFile := daemonLogFile
	if logFile == "" {
		logFile = AppConfig.Daemon.LogFile
	}

	var logger zerolog.Logger
	if logFile != "" {
		logger, err = setupFileLogger(logFile)
		if err != nil {
			return err
		}
	} else {
		logger = Logger
	}

	dbStore, err := store.NewBoltStore(AppConfig.Global.DatabasePath)
	if err != nil {
		return err
	}
	defer dbStore.Close()

	auditLogger, err := log.GetAuditLogger(AppConfig.Logging)
	if err != nil {
		logger.Warn().Err(err).Msg("failed to initialize audit logger, continuing without audit")
	} else if auditLogger != nil {
		defer auditLogger.Close()
	}

	engine := pipeline.NewPipelineEngine(dbStore, AppConfig, logger, auditLogger)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT, syscall.SIGHUP)

	g, ctx := errgroup.WithContext(ctx)

	seenFiles := make(map[string]time.Time)
	var seenFilesMu sync.Mutex

	g.Go(func() error {
		return runFileWatcher(ctx, logger, absWatchDir, taskType, dbStore, engine, seenFiles, &seenFilesMu)
	})

	g.Go(func() error {
		return engine.Start(ctx)
	})

	notifySystemdReady(logger)

	var shutdownErr error
	shutdown := make(chan struct{})

	go func() {
		select {
		case sig := <-sigChan:
			logger.Info().Str("signal", sig.String()).Msg("received shutdown signal")
			notifySystemdStopping(logger)
			cancel()

			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(),
				time.Duration(AppConfig.Daemon.GracefulShutdownSec)*time.Second)
			defer shutdownCancel()

			if err := engine.Stop(shutdownCtx); err != nil {
				shutdownErr = err
			}
			close(shutdown)
		case <-ctx.Done():
			close(shutdown)
		}
	}()

	if err := g.Wait(); err != nil && err != context.Canceled {
		logger.Error().Err(err).Msg("daemon error")
		return err
	}

	<-shutdown

	logger.Info().Msg("daemon stopped successfully")
	return shutdownErr
}

func runFileWatcher(ctx context.Context, logger zerolog.Logger, watchDir string,
	taskType types.TaskType, dbStore *store.BoltStore, engine *pipeline.PipelineEngine,
	seenFiles map[string]time.Time, seenFilesMu *sync.Mutex) error {

	logger.Info().
		Str("watch_dir", watchDir).
		Str("task_type", string(taskType)).
		Int("poll_interval_ms", daemonPollInterval).
		Bool("use_fsnotify", daemonUseFSNotify).
		Msg("file watcher started")

	extMap := make(map[string]bool)
	for _, ext := range daemonFileExtensions {
		extMap[strings.ToLower(ext)] = true
	}

	if err := scanExistingFiles(ctx, logger, watchDir, taskType, dbStore, engine, seenFiles, seenFilesMu, extMap); err != nil {
		return err
	}

	ticker := time.NewTicker(time.Duration(daemonPollInterval) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info().Msg("file watcher stopping")
			return nil
		case <-ticker.C:
			if err := scanForNewFiles(ctx, logger, watchDir, taskType, dbStore, engine, seenFiles, seenFilesMu, extMap); err != nil {
				logger.Error().Err(err).Msg("file scan error")
			}
		}
	}
}

func scanExistingFiles(ctx context.Context, logger zerolog.Logger, watchDir string,
	taskType types.TaskType, dbStore *store.BoltStore, engine *pipeline.PipelineEngine,
	seenFiles map[string]time.Time, seenFilesMu *sync.Mutex, extMap map[string]bool) error {

	entries, err := os.ReadDir(watchDir)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E4001,
			fmt.Sprintf("无法读取监控目录 | Cannot read watch directory: %s", watchDir))
	}

	now := time.Now()
	seenFilesMu.Lock()
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !extMap[strings.ToLower(filepath.Ext(entry.Name()))] {
			continue
		}
		fullPath := filepath.Join(watchDir, entry.Name())
		seenFiles[fullPath] = now
	}
	seenFilesMu.Unlock()

	logger.Info().Int("existing_files", len(entries)).Msg("existing files marked as seen")
	return nil
}

func scanForNewFiles(ctx context.Context, logger zerolog.Logger, watchDir string,
	taskType types.TaskType, dbStore *store.BoltStore, engine *pipeline.PipelineEngine,
	seenFiles map[string]time.Time, seenFilesMu *sync.Mutex, extMap map[string]bool) error {

	entries, err := os.ReadDir(watchDir)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E6003,
			fmt.Sprintf("无法读取监控目录 | Cannot read watch directory: %s", watchDir))
	}

	now := time.Now()
	staleThreshold := now.Add(-5 * time.Minute)

	seenFilesMu.Lock()
	defer seenFilesMu.Unlock()

	for path, seenTime := range seenFiles {
		if seenTime.Before(staleThreshold) {
			if _, err := os.Stat(path); os.IsNotExist(err) {
				delete(seenFiles, path)
			}
		}
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if !extMap[ext] {
			continue
		}

		fullPath := filepath.Join(watchDir, entry.Name())

		if _, seen := seenFiles[fullPath]; seen {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			logger.Warn().Str("file", fullPath).Err(err).Msg("cannot stat file, skipping")
			continue
		}

		if info.Size() == 0 {
			continue
		}

		if now.Sub(info.ModTime()) < 2*time.Second {
			continue
		}

		seenFiles[fullPath] = now

		go processNewFile(ctx, logger, fullPath, taskType, dbStore, engine)
	}

	return nil
}

func processNewFile(ctx context.Context, logger zerolog.Logger, filePath string,
	taskType types.TaskType, dbStore *store.BoltStore, engine *pipeline.PipelineEngine) {

	logger.Info().Str("file", filePath).Msg("new file detected")

	taskConfig := getTaskConfig(taskType)
	task := pipeline.CreateTaskFromFile(filePath, taskType, taskConfig, 0, AppConfig.Pipeline.DefaultMaxRetries)

	if daemonOutputDir != "" {
		base := filepath.Base(filePath)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)
		task.OutputPath = filepath.Join(AppConfig.Global.OutputDirectory,
			fmt.Sprintf("%s_%s%s", name, strings.ToLower(string(taskType)[6:]), ext))
	}

	if err := dbStore.CreateTask(task); err != nil {
		logger.Error().Err(err).Str("file", filePath).Msg("failed to create task in database")
		return
	}

	if err := engine.SubmitTask(task); err != nil {
		logger.Warn().Err(err).Str("task_id", task.ID).Str("file", filePath).
			Msg("task created but failed to submit to queue, will be processed on next restart")
	} else {
		logger.Info().Str("task_id", task.ID).Str("file", filePath).Msg("task enqueued successfully")
	}
}

func getTaskConfig(taskType types.TaskType) interface{} {
	switch taskType {
	case types.TaskTypeConvertCRS:
		return types.CRSTransformConfig{
			SourceEPSG: AppConfig.CRS.DefaultSourceEPSG,
			TargetEPSG: AppConfig.CRS.DefaultTargetEPSG,
		}
	case types.TaskTypeIndexNDVI:
		return types.VegetationIndexConfig{
			IndexType:   "ndvi",
			NoDataValue: AppConfig.Index.DefaultNoDataValue,
		}
	case types.TaskTypeIndexEVI:
		return types.VegetationIndexConfig{
			IndexType:   "evi",
			NoDataValue: AppConfig.Index.DefaultNoDataValue,
		}
	case types.TaskTypeIndexSAVI:
		return types.VegetationIndexConfig{
			IndexType:   "savi",
			NoDataValue: AppConfig.Index.DefaultNoDataValue,
		}
	default:
		return nil
	}
}

func parseTaskType(taskType string) (types.TaskType, error) {
	switch strings.ToLower(taskType) {
	case "crs":
		return types.TaskTypeConvertCRS, nil
	case "ndvi":
		return types.TaskTypeIndexNDVI, nil
	case "evi":
		return types.TaskTypeIndexEVI, nil
	case "savi":
		return types.TaskTypeIndexSAVI, nil
	default:
		return "", apperrors.New(apperrors.E4001,
			fmt.Sprintf("无效的任务类型: %s (支持: crs/ndvi/evi/savi) | Invalid task type: %s (supported: crs/ndvi/evi/savi)",
				taskType, taskType))
	}
}

func checkAndWritePIDFile(pidFile string) error {
	absPIDFile, err := filepath.Abs(pidFile)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法解析 PID 文件路径 | Cannot resolve PID file path: %s", pidFile))
	}

	pidDir := filepath.Dir(absPIDFile)
	if err := os.MkdirAll(pidDir, 0755); err != nil {
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法创建 PID 文件目录 | Cannot create PID file directory: %s", pidDir))
	}

	if data, err := os.ReadFile(absPIDFile); err == nil {
		existingPID, err := strconv.Atoi(strings.TrimSpace(string(data)))
		if err == nil && existingPID > 0 {
			if process, err := os.FindProcess(existingPID); err == nil {
				if err := process.Signal(syscall.Signal(0)); err == nil {
					return apperrors.New(apperrors.E6001,
						fmt.Sprintf("守护进程已在运行 (PID: %d) | Daemon already running (PID: %d)",
							existingPID, existingPID))
				}
			}
		}
	}

	pid := os.Getpid()
	if err := os.WriteFile(absPIDFile, []byte(strconv.Itoa(pid)), 0644); err != nil {
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法写入 PID 文件 | Cannot write PID file: %s", absPIDFile))
	}

	return nil
}

func removePIDFile(pidFile string) {
	absPIDFile, err := filepath.Abs(pidFile)
	if err != nil {
		return
	}
	_ = os.Remove(absPIDFile)
}

func setupFileLogger(logFile string) (zerolog.Logger, error) {
	absLogFile, err := filepath.Abs(logFile)
	if err != nil {
		return zerolog.Logger{}, apperrors.Wrap(err, apperrors.E1005,
			fmt.Sprintf("无法解析日志文件路径 | Cannot resolve log file path: %s", logFile))
	}

	logDir := filepath.Dir(absLogFile)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return zerolog.Logger{}, apperrors.Wrap(err, apperrors.E1005,
			fmt.Sprintf("无法创建日志目录 | Cannot create log directory: %s", logDir))
	}

	file, err := os.OpenFile(absLogFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return zerolog.Logger{}, apperrors.Wrap(err, apperrors.E1005,
			fmt.Sprintf("无法打开日志文件 | Cannot open log file: %s", absLogFile))
	}

	var output zerolog.LevelWriter
	if AppConfig.Logging.Format == "text" {
		output = zerolog.MultiLevelWriter(zerolog.ConsoleWriter{Out: file, TimeFormat: "2006-01-02 15:04:05"})
	} else {
		output = zerolog.MultiLevelWriter(file)
	}

	logger := zerolog.New(output).With().
		Timestamp().
		Str("version", Version).
		Str("commit", GitCommit).
		Str("component", "daemon").
		Logger()

	zerolog.SetGlobalLevel(parseLogLevel(AppConfig.Logging.Level))

	return logger, nil
}

func notifySystemdReady(logger zerolog.Logger) {
	if !AppConfig.Daemon.SystemdNotify {
		return
	}

	socketPath := os.Getenv("NOTIFY_SOCKET")
	if socketPath == "" {
		return
	}

	conn, err := net.Dial("unixgram", socketPath)
	if err != nil {
		logger.Warn().Err(err).Msg("failed to connect to systemd notify socket")
		return
	}
	defer conn.Close()

	_, err = conn.Write([]byte("READY=1\n"))
	if err != nil {
		logger.Warn().Err(err).Msg("failed to send READY=1 to systemd")
		return
	}

	logger.Info().Msg("notified systemd: READY=1")
}

func notifySystemdStopping(logger zerolog.Logger) {
	socketPath := os.Getenv("NOTIFY_SOCKET")
	if socketPath == "" {
		return
	}

	conn, err := net.Dial("unixgram", socketPath)
	if err != nil {
		return
	}
	defer conn.Close()

	_, _ = conn.Write([]byte("STOPPING=1\n"))
}

func runDaemonStop(cmd *cobra.Command, args []string) error {
	pidFile := daemonPIDFile
	if pidFile == "" {
		pidFile = AppConfig.Daemon.PIDFile
	}
	if pidFile == "" {
		pidFile = "/var/run/sentinel-daemon.pid"
	}

	absPIDFile, err := filepath.Abs(pidFile)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法解析 PID 文件路径 | Cannot resolve PID file path: %s", pidFile))
	}

	data, err := os.ReadFile(absPIDFile)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("PID 文件不存在，守护进程可能未运行 | PID file does not exist, daemon may not be running\n")
			return nil
		}
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法读取 PID 文件 | Cannot read PID file: %s", absPIDFile))
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("PID 文件内容无效 | Invalid PID file content: %s", string(data)))
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		fmt.Printf("进程 %d 未找到 | Process %d not found\n", pid, pid)
		_ = os.Remove(absPIDFile)
		return nil
	}

	if err := process.Signal(syscall.Signal(0)); err != nil {
		fmt.Printf("进程 %d 未运行 | Process %d is not running\n", pid, pid)
		_ = os.Remove(absPIDFile)
		return nil
	}

	fmt.Printf("正在停止守护进程 (PID: %d)... | Stopping daemon (PID: %d)...\n", pid, pid)

	if err := process.Signal(syscall.SIGTERM); err != nil {
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法发送 SIGTERM 信号 | Cannot send SIGTERM signal"))
	}

	timeout := time.After(time.Duration(AppConfig.Daemon.GracefulShutdownSec+5) * time.Second)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			fmt.Printf("警告: 优雅关闭超时，强制终止 | Warning: graceful shutdown timeout, forcing kill\n")
			_ = process.Kill()
			_ = os.Remove(absPIDFile)
			return apperrors.New(apperrors.E6004,
				fmt.Sprintf("守护进程未能在超时内关闭 | Daemon did not shut down within timeout"))
		case <-ticker.C:
			if err := process.Signal(syscall.Signal(0)); err != nil {
				fmt.Printf("守护进程已成功停止 | Daemon stopped successfully\n")
				_ = os.Remove(absPIDFile)
				return nil
			}
		}
	}
}

func runDaemonStatus(cmd *cobra.Command, args []string) error {
	pidFile := daemonPIDFile
	if pidFile == "" {
		pidFile = AppConfig.Daemon.PIDFile
	}
	if pidFile == "" {
		pidFile = "/var/run/sentinel-daemon.pid"
	}

	absPIDFile, err := filepath.Abs(pidFile)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法解析 PID 文件路径 | Cannot resolve PID file path: %s", pidFile))
	}

	data, err := os.ReadFile(absPIDFile)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("守护进程未运行 | Daemon is not running\n")
			return nil
		}
		return apperrors.Wrap(err, apperrors.E6002,
			fmt.Sprintf("无法读取 PID 文件 | Cannot read PID file: %s", absPIDFile))
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		fmt.Printf("PID 文件损坏 | PID file is corrupted\n")
		return nil
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		fmt.Printf("守护进程未运行 (PID: %d 不存在) | Daemon not running (PID: %d not found)\n", pid, pid)
		_ = os.Remove(absPIDFile)
		return nil
	}

	if err := process.Signal(syscall.Signal(0)); err != nil {
		fmt.Printf("守护进程未运行 (PID: %d 已失效) | Daemon not running (PID: %d stale)\n", pid, pid)
		_ = os.Remove(absPIDFile)
		return nil
	}

	fmt.Printf("守护进程正在运行 | Daemon is running\n")
	fmt.Printf("  PID:          %d\n", pid)
	fmt.Printf("  PID 文件:     %s\n", absPIDFile)

	dbStore, err := store.NewBoltStore(AppConfig.Global.DatabasePath)
	if err == nil {
		defer dbStore.Close()
		stats, err := dbStore.GetStats()
		if err == nil {
			fmt.Printf("\n任务统计 | Task Statistics:\n")
			fmt.Printf("  总任务数:     %d\n", stats.TotalTasks)
			fmt.Printf("  等待中:       %d\n", stats.PendingTasks)
			fmt.Printf("  运行中:       %d\n", stats.RunningTasks)
			fmt.Printf("  已完成:       %d\n", stats.CompletedTasks)
			fmt.Printf("  失败:         %d\n", stats.FailedTasks)
			fmt.Printf("  已终止:       %d\n", stats.DeadTasks)
		}
	}

	return nil
}

func generateSystemdUnit() error {
	exePath, err := os.Executable()
	if err != nil {
		exePath = "/usr/local/bin/sentinel"
	}

	unit := fmt.Sprintf(`[Unit]
Description=Sentinel Remote Sensing Daemon
Documentation=https://github.com/remote-sensing/sentinel-cli
After=network.target local-fs.target
Wants=network.target

[Service]
Type=notify
ExecStart=%s daemon start --watch-dir /data/sentinel/input --task-type ndvi --output-dir /data/sentinel/output --pid-file /run/sentinel/sentinel.pid --log-file /var/log/sentinel/daemon.log
ExecStop=%s daemon stop --pid-file /run/sentinel/sentinel.pid
PIDFile=/run/sentinel/sentinel.pid
Restart=on-failure
RestartSec=5s
TimeoutStartSec=30
TimeoutStopSec=%ds

User=sentinel
Group=sentinel

RuntimeDirectory=sentinel
StateDirectory=sentinel
LogsDirectory=sentinel
ConfigurationDirectory=sentinel

# Hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/data /var/log/sentinel /run/sentinel
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictNamespaces=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes

# Systemd notify
NotifyAccess=main

[Install]
WantedBy=multi-user.target
`, exePath, exePath, AppConfig.Daemon.GracefulShutdownSec+10)

	fmt.Print(unit)
	return nil
}
