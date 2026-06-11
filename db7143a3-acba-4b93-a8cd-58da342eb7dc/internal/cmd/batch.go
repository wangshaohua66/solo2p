package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/remote-sensing/sentinel-cli/internal/config"
	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/log"
	"github.com/remote-sensing/sentinel-cli/internal/pipeline"
	"github.com/remote-sensing/sentinel-cli/internal/store"
	"github.com/remote-sensing/sentinel-cli/internal/tui"
	"github.com/remote-sensing/sentinel-cli/internal/types"
)

var (
	batchInputPath      string
	batchOutputPath     string
	batchRecursive      bool
	batchTaskType       string
	batchStatusFilter   string
	batchErrorCodeFilter string
	batchOutputFormat   string
	batchForceRetry     bool
	batchDryRun         bool
	batchShowTUI        bool
	batchPriority       int
	batchMaxRetries     int
	batchLimit          int
	batchOffset         int
	batchSourceEPSG     int
	batchTargetEPSG     int
)

var batchCmd = &cobra.Command{
	Use:   "batch",
	Short: "批量处理命令组 | Batch processing commands",
	Long: `批量处理命令组
Batch processing commands

包含任务队列管理、批量入队、状态查询、错误重试等功能。
Includes task queue management, batch enqueue, status query, error retry, etc.`,
}

var batchRunCmd = &cobra.Command{
	Use:   "run",
	Short: "批量运行任务 | Run batch tasks",
	Long: `批量运行任务
Run batch tasks

扫描输入目录中的影像文件，批量创建任务并入队执行。
支持坐标转换、植被指数计算等多种任务类型。
Scan image files in input directory, create tasks in batch and enqueue for execution.
Supports multiple task types including CRS transformation, vegetation index calculation, etc.`,
	Example: `  # 批量计算 NDVI 指数 | Batch calculate NDVI index
  sentinel batch run --type ndvi -i /data/input -o /data/output -r

  # 批量转换坐标系统 | Batch transform CRS
  sentinel batch run --type crs --source-epsg 4326 --target-epsg 4490 \
    -i /data/wgs84 -o /data/cgcs2000 -r

  # 启用交互式仪表盘 | Enable interactive dashboard
  sentinel batch run --type evi -i /data/input -o /data/output --tui

  # 设置优先级和最大重试次数 | Set priority and max retries
  sentinel batch run --type savi -i /data/input -o /data/output \
    --priority 5 --max-retries 3`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return validateBatchRunFlags()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runBatchRun()
	},
}

var batchStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "查看任务状态 | Check task status",
	Long: `查看任务状态
Check task status

列出所有任务的状态，支持按状态、错误码筛选。
支持表格和 JSON 两种输出格式。
List status of all tasks, support filtering by status and error code.
Supports table and JSON output formats.`,
	Example: `  # 查看所有任务状态 | Check all task status
  sentinel batch status

  # 只查看失败任务 | Show only failed tasks
  sentinel batch status --status failed

  # 按错误码筛选 | Filter by error code
  sentinel batch status --error-code E1001

  # JSON 格式输出 | JSON format output
  sentinel batch status --format json

  # 分页显示 | Pagination
  sentinel batch status --limit 50 --offset 100`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return validateBatchStatusFlags()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runBatchStatus()
	},
}

var batchRetryCmd = &cobra.Command{
	Use:   "retry",
	Short: "重试失败任务 | Retry failed tasks",
	Long: `重试失败任务
Retry failed tasks

自动查找失败任务并重试，支持按错误码筛选。
显示失败分类和修复建议，帮助解决根本问题。
Automatically find and retry failed tasks, support filtering by error code.
Show failure classification and repair suggestions to help solve root problems.`,
	Example: `  # 重试所有失败任务 | Retry all failed tasks
  sentinel batch retry

  # 强制重试已死亡任务 | Force retry dead tasks
  sentinel batch retry --force

  # 按错误码重试 | Retry by error code
  sentinel batch retry --error-code E2001

  # 预览模式（不实际执行） | Dry run mode
  sentinel batch retry --dry-run

  # 重试后启用仪表盘 | Enable dashboard after retry
  sentinel batch retry --tui`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runBatchRetry()
	},
}

func init() {
	batchCmd.AddCommand(batchRunCmd)
	batchCmd.AddCommand(batchStatusCmd)
	batchCmd.AddCommand(batchRetryCmd)
	rootCmd.AddCommand(batchCmd)

	batchRunCmd.Flags().StringVarP(&batchInputPath, "input", "i", "",
		"输入文件或目录路径 | Input file or directory path")
	batchRunCmd.Flags().StringVarP(&batchOutputPath, "output", "o", "",
		"输出文件或目录路径 | Output file or directory path")
	batchRunCmd.Flags().BoolVarP(&batchRecursive, "recursive", "r", false,
		"递归处理目录 | Process directory recursively")
	batchRunCmd.Flags().StringVar(&batchTaskType, "type", "",
		"任务类型: crs/ndvi/evi/savi | Task type: crs/ndvi/evi/savi")
	batchRunCmd.Flags().IntVar(&batchSourceEPSG, "source-epsg", 4326,
		"源EPSG代码（CRS转换时使用）| Source EPSG code (for CRS transformation)")
	batchRunCmd.Flags().IntVar(&batchTargetEPSG, "target-epsg", 4490,
		"目标EPSG代码（CRS转换时使用）| Target EPSG code (for CRS transformation)")
	batchRunCmd.Flags().IntVar(&batchPriority, "priority", 5,
		"任务优先级 (0-10) | Task priority (0-10)")
	batchRunCmd.Flags().IntVar(&batchMaxRetries, "max-retries", 3,
		"最大重试次数 (0-10) | Max retry count (0-10)")
	batchRunCmd.Flags().BoolVar(&batchShowTUI, "tui", false,
		"启用交互式仪表盘 | Enable interactive dashboard")

	batchStatusCmd.Flags().StringVar(&batchStatusFilter, "status", "",
		"状态过滤: pending/running/done/failed/dead | Status filter: pending/running/done/failed/dead")
	batchStatusCmd.Flags().StringVar(&batchErrorCodeFilter, "error-code", "",
		"错误码过滤（如 E1001）| Error code filter (e.g. E1001)")
	batchStatusCmd.Flags().StringVar(&batchOutputFormat, "format", "table",
		"输出格式: table/json | Output format: table/json")
	batchStatusCmd.Flags().IntVar(&batchLimit, "limit", 100,
		"显示数量限制 | Display limit")
	batchStatusCmd.Flags().IntVar(&batchOffset, "offset", 0,
		"显示偏移量 | Display offset")

	batchRetryCmd.Flags().BoolVar(&batchForceRetry, "force", false,
		"强制重试已死亡任务 | Force retry dead tasks")
	batchRetryCmd.Flags().StringVar(&batchErrorCodeFilter, "error-code", "",
		"按错误码筛选重试 | Filter retry by error code")
	batchRetryCmd.Flags().BoolVar(&batchDryRun, "dry-run", false,
		"预览模式，不实际执行 | Dry run mode, no actual execution")
	batchRetryCmd.Flags().BoolVar(&batchShowTUI, "tui", false,
		"重试后启用仪表盘 | Enable dashboard after retry")

	_ = batchRunCmd.MarkFlagRequired("input")
	_ = batchRunCmd.MarkFlagRequired("output")
	_ = batchRunCmd.MarkFlagRequired("type")

	_ = batchRunCmd.RegisterFlagCompletionFunc("type", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"crs", "ndvi", "evi", "savi"}, cobra.ShellCompDirectiveNoFileComp
	})
	_ = batchStatusCmd.RegisterFlagCompletionFunc("status", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"pending", "running", "done", "failed", "dead"}, cobra.ShellCompDirectiveNoFileComp
	})
	_ = batchStatusCmd.RegisterFlagCompletionFunc("format", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"table", "json"}, cobra.ShellCompDirectiveNoFileComp
	})
}

func validateBatchRunFlags() error {
	validTaskTypes := map[string]bool{
		"crs": true, "ndvi": true, "evi": true, "savi": true,
	}
	if !validTaskTypes[batchTaskType] {
		return apperrors.New(apperrors.E3001,
			fmt.Sprintf("invalid task type: %s, must be one of: crs, ndvi, evi, savi", batchTaskType))
	}

	if batchPriority < 0 || batchPriority > 10 {
		return apperrors.New(apperrors.E3002,
			fmt.Sprintf("invalid priority: %d, must be between 0 and 10", batchPriority))
	}

	if batchMaxRetries < 0 || batchMaxRetries > 10 {
		return apperrors.New(apperrors.E3002,
			fmt.Sprintf("invalid max-retries: %d, must be between 0 and 10", batchMaxRetries))
	}

	if _, err := os.Stat(batchInputPath); os.IsNotExist(err) {
		return apperrors.New(apperrors.E1003,
			fmt.Sprintf("input path does not exist: %s", batchInputPath))
	}

	absInput, err := filepath.Abs(batchInputPath)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E1003,
			"cannot resolve absolute input path")
	}
	cleanInput := filepath.Clean(absInput)
	if cleanInput != absInput {
		return apperrors.New(apperrors.E4001,
			fmt.Sprintf("input path contains traversal components: %s", batchInputPath))
	}

	absOutput, err := filepath.Abs(batchOutputPath)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E1005,
			"cannot resolve absolute output path")
	}
	cleanOutput := filepath.Clean(absOutput)
	if cleanOutput != absOutput {
		return apperrors.New(apperrors.E4001,
			fmt.Sprintf("output path contains traversal components: %s", batchOutputPath))
	}
	if strings.Contains(cleanOutput, "..") {
		return apperrors.New(apperrors.E4001,
			"output path contains '..' traversal and is unsafe")
	}

	if err := os.MkdirAll(cleanOutput, 0755); err != nil {
		return apperrors.Wrap(err, apperrors.E1005,
			fmt.Sprintf("cannot create output directory: %s", cleanOutput))
	}

	testFile := filepath.Join(cleanOutput, ".sentinel_writable_test_"+strconv.FormatInt(int64(os.Getpid()), 10))
	if f, err := os.OpenFile(testFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600); err != nil {
		return apperrors.Wrap(err, apperrors.E1005,
			fmt.Sprintf("output directory is not writable: %s", cleanOutput))
	} else {
		f.Close()
		_ = os.Remove(testFile)
	}
	batchOutputPath = cleanOutput

	if batchTaskType == "crs" {
		if !config.IsValidEPSG(batchSourceEPSG) {
			return apperrors.New(apperrors.E2001,
				fmt.Sprintf("invalid source EPSG code: %d", batchSourceEPSG))
		}
		if !config.IsValidEPSG(batchTargetEPSG) {
			return apperrors.New(apperrors.E2001,
				fmt.Sprintf("invalid target EPSG code: %d", batchTargetEPSG))
		}
	}

	return nil
}

func getTaskErrorCode(task *types.Task) string {
	if len(task.Errors) > 0 {
		return string(task.Errors[len(task.Errors)-1].ErrorCode)
	}
	return ""
}

func validateBatchStatusFlags() error {
	if batchStatusFilter != "" {
		validStatuses := map[string]bool{
			"pending": true, "running": true, "done": true, "failed": true, "dead": true,
		}
		if !validStatuses[batchStatusFilter] {
			return apperrors.New(apperrors.E3001,
				fmt.Sprintf("invalid status filter: %s, must be one of: pending, running, done, failed, dead", batchStatusFilter))
		}
	}

	if batchOutputFormat != "table" && batchOutputFormat != "json" {
		return apperrors.New(apperrors.E3001,
			fmt.Sprintf("invalid output format: %s, must be table or json", batchOutputFormat))
	}

	return nil
}

func runBatchRun() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\n收到停止信号，正在优雅退出... | Received stop signal, exiting gracefully...")
		cancel()
	}()

	dbPath := AppConfig.Global.DatabasePath
	if dbPath == "" {
		dbPath = filepath.Join(AppConfig.Global.TempDirectory, "tasks.db")
	}

	boltStore, err := store.NewBoltStore(dbPath)
	if err != nil {
		return err
	}
	defer boltStore.Close()

	extensions := []string{".tif", ".tiff", ".img"}
	files, err := pipeline.FindFiles(batchInputPath, batchRecursive, extensions)
	if err != nil {
		return err
	}

	if len(files) == 0 {
		return apperrors.New(apperrors.E1004,
			fmt.Sprintf("no supported files found in: %s", batchInputPath))
	}

	fmt.Printf("找到 %d 个文件，正在创建任务... | Found %d files, creating tasks...\n", len(files), len(files))

	tasks := make([]*types.Task, 0, len(files))
	for _, file := range files {
		var taskConfig interface{}
		if batchTaskType == "crs" {
			taskConfig = types.CRSTransformConfig{
				SourceEPSG: batchSourceEPSG,
				TargetEPSG: batchTargetEPSG,
			}
		}

		var taskType types.TaskType
		switch batchTaskType {
		case "crs":
			taskType = types.TaskTypeConvertCRS
		case "ndvi":
			taskType = types.TaskTypeIndexNDVI
		case "evi":
			taskType = types.TaskTypeIndexEVI
		case "savi":
			taskType = types.TaskTypeIndexSAVI
		}
		task := pipeline.CreateTaskFromFile(file, taskType, taskConfig, batchPriority, batchMaxRetries)

		outputFile := filepath.Join(batchOutputPath, filepath.Base(file))
		task.OutputPath = outputFile

		tasks = append(tasks, task)
	}

	if len(tasks) == 0 {
		return apperrors.New(apperrors.E3004, "no valid tasks created")
	}

	err = boltStore.BatchCreateTasks(tasks)
	if err != nil {
		return err
	}

	fmt.Printf("成功创建 %d 个任务 | Successfully created %d tasks\n", len(tasks), len(tasks))

	auditLogger, err := log.GetAuditLogger(AppConfig.Logging)
	if err != nil {
		return err
	}
	engine := pipeline.NewPipelineEngine(boltStore, AppConfig, Logger, auditLogger)

	if err := engine.Start(ctx); err != nil {
		return err
	}
	defer engine.Stop(ctx)

	submitted, err := engine.SubmitTasks(tasks)
	if err != nil {
		return err
	}
	fmt.Printf("已提交 %d 个任务到流水线 | Submitted %d tasks to pipeline\n", submitted, submitted)

	if batchShowTUI {
		return tui.StartDashboard(boltStore, Logger)
	}

	<-ctx.Done()
	fmt.Println("\n批处理完成 | Batch processing completed")
	return nil
}

func runBatchStatus() error {
	dbPath := AppConfig.Global.DatabasePath
	if dbPath == "" {
		dbPath = filepath.Join(AppConfig.Global.TempDirectory, "tasks.db")
	}

	boltStore, err := store.NewBoltStore(dbPath)
	if err != nil {
		return err
	}
	defer boltStore.Close()

	var tasks []*types.Task
	if batchErrorCodeFilter != "" {
		tasks, err = boltStore.ListTasksByErrorCode(apperrors.ErrorCode(batchErrorCodeFilter), batchLimit, batchOffset)
	} else {
		filter := types.TaskStatus("")
		if batchStatusFilter != "" {
			filter = types.TaskStatus(batchStatusFilter)
		}
		tasks, err = boltStore.ListTasks(filter, batchLimit, batchOffset)
	}

	if err != nil {
		return err
	}

	if batchOutputFormat == "json" {
		data, err := json.MarshalIndent(tasks, "", "  ")
		if err != nil {
			return err
		}
		fmt.Println(string(data))
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\t类型\t状态\t进度\t重试\t错误码\t创建时间\t文件名")
	fmt.Fprintln(w, "--\t----\t----\t----\t----\t------\t----------\t------")

	for _, task := range tasks {
		progress := "0.0%"
		if task.Progress.BytesTotal > 0 {
			progress = fmt.Sprintf("%.1f%%", float64(task.Progress.BytesProcessed)/float64(task.Progress.BytesTotal)*100)
		}
		retryCount := fmt.Sprintf("%d/%d", task.RetryCount, task.MaxRetries)
		errorCode := getTaskErrorCode(task)
		if errorCode == "" {
			errorCode = "-"
		}
		createdAt := task.CreatedAt.Format("2006-01-02 15:04:05")
		filename := filepath.Base(task.InputPath)

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			task.ID[:8], task.Type, task.Status, progress, retryCount, errorCode, createdAt, filename)
	}

	w.Flush()

	stats, err := boltStore.GetStats()
	if err == nil {
		fmt.Printf("\n统计 | Stats: 总数 %d | 待处理 %d | 运行中 %d | 完成 %d | 失败 %d | 死亡 %d\n",
			stats.TotalTasks, stats.PendingTasks, stats.RunningTasks, stats.CompletedTasks, stats.FailedTasks, stats.DeadTasks)
	}

	return nil
}

func runBatchRetry() error {
	dbPath := AppConfig.Global.DatabasePath
	if dbPath == "" {
		dbPath = filepath.Join(AppConfig.Global.TempDirectory, "tasks.db")
	}

	boltStore, err := store.NewBoltStore(dbPath)
	if err != nil {
		return err
	}
	defer boltStore.Close()

	statuses := []types.TaskStatus{types.TaskStatusFailed}
	if batchForceRetry {
		statuses = append(statuses, types.TaskStatusDead)
	}

	var tasksToRetry []*types.Task
	for _, status := range statuses {
		var tasks []*types.Task
		if batchErrorCodeFilter != "" {
			tasks, err = boltStore.ListTasksByErrorCode(apperrors.ErrorCode(batchErrorCodeFilter), 1000, 0)
		} else {
			tasks, err = boltStore.ListTasks(status, 1000, 0)
		}
		if err != nil {
			return err
		}
		tasksToRetry = append(tasksToRetry, tasks...)
	}

	if len(tasksToRetry) == 0 {
		fmt.Println("没有找到需要重试的任务 | No tasks found to retry")
		return nil
	}

	groupedFailed, err := boltStore.GetFailedTasksGrouped()
	if err == nil && len(groupedFailed) > 0 {
		fmt.Println("\n失败分类统计 | Failure Classification:")
		for errorCode, tasks := range groupedFailed {
			info, ok := apperrors.GetErrorInfo(apperrors.ErrorCode(errorCode))
			if !ok {
				continue
			}
			fmt.Printf("  错误码 %s (%s): %d 个任务\n", errorCode, info.Severity, len(tasks))
			fmt.Printf("    描述 | Description: %s\n", info.Description)
			fmt.Printf("    建议 | Suggestions: %s\n", strings.Join(info.Suggestions, "; "))
		}
		fmt.Println()
	}

	fmt.Printf("找到 %d 个任务需要重试 | Found %d tasks to retry:\n", len(tasksToRetry), len(tasksToRetry))
	for _, task := range tasksToRetry {
		errorCode := getTaskErrorCode(task)
		fmt.Printf("  - %s [%s] %s\n", task.ID[:8], task.Status, filepath.Base(task.InputPath))
		if errorCode != "" {
			info, ok := apperrors.GetErrorInfo(apperrors.ErrorCode(errorCode))
			if ok {
				fmt.Printf("    错误 | Error: %s - %s\n", errorCode, info.Description)
			}
		}
	}

	if batchDryRun {
		fmt.Println("\n预览模式，不执行重试 | Dry run mode, no retry executed")
		return nil
	}

	fmt.Println("\n正在重置任务... | Resetting tasks...")
	var resetTasks []*types.Task
	for _, task := range tasksToRetry {
		err := boltStore.ResetTask(task.ID, batchForceRetry)
		if err != nil {
			fmt.Printf("警告 | Warning: 重置任务 %s 失败: %v\n", task.ID, err)
			continue
		}
		resetTask, err := boltStore.GetTask(task.ID)
		if err != nil {
			continue
		}
		resetTasks = append(resetTasks, resetTask)
	}

	if len(resetTasks) == 0 {
		return apperrors.New(apperrors.E3004, "no tasks were reset successfully")
	}

	fmt.Printf("成功重置 %d 个任务 | Successfully reset %d tasks\n", len(resetTasks), len(resetTasks))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		cancel()
	}()

	auditLogger, err := log.GetAuditLogger(AppConfig.Logging)
	if err != nil {
		return err
	}
	engine := pipeline.NewPipelineEngine(boltStore, AppConfig, Logger, auditLogger)

	if err := engine.Start(ctx); err != nil {
		return err
	}
	defer engine.Stop(ctx)

	submitted, err := engine.SubmitTasks(resetTasks)
	if err != nil {
		return err
	}
	fmt.Printf("已提交 %d 个重试任务到流水线 | Submitted %d retry tasks to pipeline\n", submitted, submitted)

	if batchShowTUI {
		return tui.StartDashboard(boltStore, Logger)
	}

	<-ctx.Done()
	return nil
}
