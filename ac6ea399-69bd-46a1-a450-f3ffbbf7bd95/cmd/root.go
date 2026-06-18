package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/database"
	"cloudsync/internal/logger"
	"cloudsync/internal/progress"
	"cloudsync/internal/report"
	syncpkg "cloudsync/internal/sync"

	"github.com/spf13/cobra"
)

var (
	cfgFile     string
	envName     string
	verboseFlag bool
	quietFlag   bool
	jsonOutput  bool
	cfg         *config.Config
	rootCmd     = &cobra.Command{
		Use:   "cloudsync",
		Short: "Multi-cloud storage data synchronization tool",
		Long: `CloudSync - 多云存储数据同步命令行工具

支持AWS S3、阿里云OSS、Google Cloud Storage三种对象存储的相互同步，
提供增量同步、冲突检测、断点续传、数据校验、进度追踪、报告生成等功能。

Architecture:
  Config → Source Read → Change Detect → Transfer → Verify → Report

Examples:
  cloudsync sync --config configs/config.yaml
  cloudsync sync --env production --concurrency 200
  cloudsync status --task-id task-1234567890
  cloudsync resume --task-id task-1234567890
  cloudsync report --task-id task-1234567890 --format json,html
  cloudsync email --task-id task-1234567890 --to admin@example.com
`,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if cmd.Name() == "help" || cmd.Name() == "version" || cmd.Name() == "init" {
				return nil
			}
			var err error
			cfg, err = config.Load(cfgFile, envName)
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}
			if verboseFlag {
				cfg.Logger.Level = config.LogDebug
			}
			if quietFlag {
				cfg.Logger.Level = config.LogError
			}
			if err := logger.Init(&cfg.Logger, verboseFlag, quietFlag); err != nil {
				return fmt.Errorf("init logger: %w", err)
			}
			return nil
		},
		PersistentPostRun: func(cmd *cobra.Command, args []string) {
			logger.Close()
		},
		SilenceUsage: true,
	}
)

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&cfgFile, "config", "c", "", "config file path (default: ./configs/config.yaml)")
	rootCmd.PersistentFlags().StringVarP(&envName, "env", "e", "", "environment name (development/staging/production)")
	rootCmd.PersistentFlags().BoolVarP(&verboseFlag, "verbose", "v", false, "verbose output, show debug logs")
	rootCmd.PersistentFlags().BoolVarP(&quietFlag, "quiet", "q", false, "quiet mode, only show errors")
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "format-json", false, "output JSON format result")

	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(resumeCmd)
	rootCmd.AddCommand(reportCmd)
	rootCmd.AddCommand(emailCmd)
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(initCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		info := map[string]interface{}{
			"name":      "cloudsync",
			"version":   "1.0.0",
			"build":     time.Now().Format("2006-01-02"),
			"go_version": "1.21+",
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(info, "", "  ")
			fmt.Println(string(data))
			return
		}
		fmt.Printf("CloudSync v%s (build %s)\n", info["version"], info["build"])
	},
}

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Create a sample config file",
	RunE: func(cmd *cobra.Command, args []string) error {
		samplePath := cfgFile
		if samplePath == "" {
			samplePath = "./configs/config.yaml"
		}
		absPath, _ := filepath.Abs(samplePath)

		if _, err := os.Stat(samplePath); err == nil {
			return fmt.Errorf("config file already exists: %s", absPath)
		}

		defaultCfg := config.DefaultConfig()
		defaultCfg.Source = config.StorageConfig{
			Type:   config.StorageTypeS3,
			Prefix: "products/",
			S3: config.S3Config{
				AccessKeyID:     "AKIAXXXXXXXXXXXXXXXX",
				SecretAccessKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
				Region:          "us-east-1",
				Bucket:          "my-source-bucket",
			},
		}
		defaultCfg.Target = config.StorageConfig{
			Type:   config.StorageTypeOSS,
			Prefix: "products/",
			OSS: config.OSSConfig{
				AccessKeyID:     "LTAIXXXXXXXXXXXXXXXX",
				AccessKeySecret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
				Endpoint:        "oss-cn-hangzhou.aliyuncs.com",
				Bucket:          "my-target-bucket",
			},
		}
		defaultCfg.Report.Formats = []string{"json", "csv", "html"}
		defaultCfg.Report.Email = config.EmailConfig{
			Enabled:     false,
			SMTPHost:    "smtp.example.com",
			SMTPPort:    587,
			Username:    "notify@example.com",
			Password:    "xxxxxxxx",
			FromAddress: "CloudSync <notify@example.com>",
			ToAddresses: []string{"admin@example.com"},
			UseTLS:      true,
		}

		if err := config.Save(defaultCfg, samplePath); err != nil {
			return fmt.Errorf("save config: %w", err)
		}

		fmt.Printf("\033[32m✓\033[0m Sample config created: %s\n", absPath)
		fmt.Println("Next steps:")
		fmt.Println("  1. Edit the config file with your storage credentials")
		fmt.Println("  2. Run: cloudsync sync --config " + samplePath)
		return nil
	},
}

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Start a synchronization task",
	Long:  `Start a new synchronization task from source storage to target storage based on the configuration.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
		defer cancel()

		concurrency, _ := cmd.Flags().GetInt("concurrency")
		if concurrency > 0 {
			cfg.Sync.Concurrency = concurrency
		}
		deleteMissing, _ := cmd.Flags().GetBool("delete")
		if deleteMissing {
			cfg.Sync.DeleteMissing = deleteMissing
		}
		syncMode, _ := cmd.Flags().GetString("mode")
		if syncMode != "" {
			cfg.Sync.SyncMode = syncMode
		}

		engine, err := syncpkg.NewEngine(cfg)
		if err != nil {
			return fmt.Errorf("create engine: %w", err)
		}
		defer engine.Close()

		tracker := progress.NewTracker(quietFlag, verboseFlag, jsonOutput)
		engine.SetTracker(tracker)

		logger.Info("Starting sync task...")
		result, err := engine.Run(ctx)
		if err != nil {
			logger.Error("Sync failed: %v", err)
		}

		if !quietFlag && !jsonOutput {
			tracker.PrintSummary()
		}

		reportGen := report.NewGenerator(&cfg.Report)
		syncReport, err := reportGen.Generate(result,
			report.BuildEndpointInfo(cfg.Source),
			report.BuildEndpointInfo(cfg.Target),
			cfg,
		)
		if err != nil {
			logger.Warn("Generate report failed: %v", err)
		} else {
			paths, writeErr := reportGen.Write(syncReport)
			if writeErr != nil {
				logger.Warn("Write report failed: %v", writeErr)
			}
			if cfg.Report.Email.Enabled {
				if emailErr := reportGen.SendEmail(paths, syncReport); emailErr != nil {
					logger.Warn("Send email failed: %v", emailErr)
				}
			}

			if jsonOutput {
				data, _ := syncReport.ToJSON()
				fmt.Println(data)
			}
		}

		if !result.Success {
			return fmt.Errorf("sync completed with errors: %s", result.ErrorMessage)
		}
		return nil
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "View sync task status",
	Long:  `View the status and progress of a specified task or list recent tasks.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		taskID, _ := cmd.Flags().GetString("task-id")
		limit, _ := cmd.Flags().GetInt("limit")

		db, err := database.NewProgressDB(&cfg.Progress)
		if err != nil {
			return fmt.Errorf("open progress db: %w", err)
		}
		defer db.Close()

		if taskID != "" {
			task, err := db.GetTask(taskID)
			if err != nil {
				return err
			}
			counts, _ := db.GetFileCounts(taskID)

			if jsonOutput {
				output := map[string]interface{}{
					"task":        task,
					"file_counts": counts,
				}
				data, _ := json.MarshalIndent(output, "", "  ")
				fmt.Println(string(data))
				return nil
			}

			printTaskStatus(task, counts)
			return nil
		}

		tasks, err := db.ListTasks(limit)
		if err != nil {
			return err
		}

		if jsonOutput {
			data, _ := json.MarshalIndent(tasks, "", "  ")
			fmt.Println(string(data))
			return nil
		}

		printTaskList(tasks)
		return nil
	},
}

var resumeCmd = &cobra.Command{
	Use:   "resume",
	Short: "Resume an interrupted sync task",
	Long:  `Resume a sync task from the breakpoint by task ID.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		taskID, _ := cmd.Flags().GetString("task-id")
		if taskID == "" {
			return fmt.Errorf("--task-id is required")
		}

		ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
		defer cancel()

		engine, err := syncpkg.NewEngine(cfg)
		if err != nil {
			return fmt.Errorf("create engine: %w", err)
		}
		defer engine.Close()

		engine.ResumeTask(taskID)

		tracker := progress.NewTracker(quietFlag, verboseFlag, jsonOutput)
		engine.SetTracker(tracker)

		logger.Info("Resuming task: %s", taskID)
		result, err := engine.Run(ctx)
		if err != nil {
			logger.Error("Resume failed: %v", err)
		}

		if !quietFlag && !jsonOutput {
			tracker.PrintSummary()
		}

		if jsonOutput {
			reportGen := report.NewGenerator(&cfg.Report)
			syncReport, _ := reportGen.Generate(result,
				report.BuildEndpointInfo(cfg.Source),
				report.BuildEndpointInfo(cfg.Target),
				cfg,
			)
			data, _ := syncReport.ToJSON()
			fmt.Println(data)
		}

		if !result.Success {
			return fmt.Errorf("resume completed with errors: %s", result.ErrorMessage)
		}
		return nil
	},
}

var reportCmd = &cobra.Command{
	Use:   "report",
	Short: "Generate a sync report",
	Long:  `Generate a sync report for a specified task in the specified format.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		taskID, _ := cmd.Flags().GetString("task-id")
		formats, _ := cmd.Flags().GetStringSlice("format")

		if len(formats) > 0 {
			cfg.Report.Formats = formats
		}

		db, err := database.NewProgressDB(&cfg.Progress)
		if err != nil {
			return fmt.Errorf("open progress db: %w", err)
		}
		defer db.Close()

		task, err := db.GetTask(taskID)
		if err != nil {
			return err
		}

		result := &syncpkg.EngineResult{
			TaskID:    task.ID,
			Success:   task.Status == database.TaskStatusCompleted,
			StartTime: task.CreatedAt,
			EndTime:   time.Now(),
			Stats: progress.Stats{
				TotalFiles:    task.TotalFiles,
				TotalBytes:    task.TotalSize,
				DoneFiles:     task.CompletedFiles,
				DoneBytes:     task.CompletedSize,
				FailedFiles:   task.FailedFiles,
				SkippedFiles:  task.SkippedFiles,
				ConflictFiles: task.ConflictFiles,
				DeletedFiles:  task.DeletedFiles,
			},
		}
		if task.CompletedAt != nil {
			result.EndTime = *task.CompletedAt
		}

		reportGen := report.NewGenerator(&cfg.Report)
		syncReport, err := reportGen.Generate(result,
			report.BuildEndpointInfo(cfg.Source),
			report.BuildEndpointInfo(cfg.Target),
			cfg,
		)
		if err != nil {
			return fmt.Errorf("generate report: %w", err)
		}

		paths, err := reportGen.Write(syncReport)
		if err != nil {
			return fmt.Errorf("write report: %w", err)
		}

		if jsonOutput {
			data, _ := syncReport.ToJSON()
			fmt.Println(data)
			return nil
		}

		for _, p := range paths {
			fmt.Printf("\033[32m✓\033[0m Report: %s\n", p)
		}
		return nil
	},
}

var emailCmd = &cobra.Command{
	Use:   "email",
	Short: "Send report via email",
	Long:  `Send the report for a specified task to the configured email addresses.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		taskID, _ := cmd.Flags().GetString("task-id")
		toAddrs, _ := cmd.Flags().GetStringSlice("to")

		if len(toAddrs) > 0 {
			cfg.Report.Email.ToAddresses = toAddrs
		}
		cfg.Report.Email.Enabled = true

		db, err := database.NewProgressDB(&cfg.Progress)
		if err != nil {
			return fmt.Errorf("open progress db: %w", err)
		}
		defer db.Close()

		task, err := db.GetTask(taskID)
		if err != nil {
			return err
		}

		result := &syncpkg.EngineResult{
			TaskID:    task.ID,
			Success:   task.Status == database.TaskStatusCompleted,
			StartTime: task.CreatedAt,
			EndTime:   time.Now(),
			Stats: progress.Stats{
				TotalFiles:    task.TotalFiles,
				TotalBytes:    task.TotalSize,
				DoneFiles:     task.CompletedFiles,
				DoneBytes:     task.CompletedSize,
				FailedFiles:   task.FailedFiles,
				SkippedFiles:  task.SkippedFiles,
				ConflictFiles: task.ConflictFiles,
				DeletedFiles:  task.DeletedFiles,
			},
		}
		if task.CompletedAt != nil {
			result.EndTime = *task.CompletedAt
		}

		reportGen := report.NewGenerator(&cfg.Report)
		syncReport, err := reportGen.Generate(result,
			report.BuildEndpointInfo(cfg.Source),
			report.BuildEndpointInfo(cfg.Target),
			cfg,
		)
		if err != nil {
			return fmt.Errorf("generate report: %w", err)
		}

		paths, err := reportGen.Write(syncReport)
		if err != nil {
			logger.Warn("Write report failed: %v", err)
		}

		if err := reportGen.SendEmail(paths, syncReport); err != nil {
			return fmt.Errorf("send email: %w", err)
		}

		fmt.Printf("\033[32m✓\033[0m Email sent to %d recipients\n", len(cfg.Report.Email.ToAddresses))
		return nil
	},
}

func init() {
	syncCmd.Flags().Int("concurrency", 0, "number of concurrent connections (1-1000)")
	syncCmd.Flags().Bool("delete", false, "delete files in target that missing in source")
	syncCmd.Flags().String("mode", "", "sync mode: incremental/full")

	statusCmd.Flags().String("task-id", "", "show status for specific task")
	statusCmd.Flags().IntP("limit", "n", 20, "limit number of tasks to list")

	resumeCmd.Flags().String("task-id", "", "task ID to resume")

	reportCmd.Flags().String("task-id", "", "task ID to generate report for")
	reportCmd.Flags().StringSliceP("format", "f", nil, "report formats: json,csv,html")

	emailCmd.Flags().String("task-id", "", "task ID to send report for")
	emailCmd.Flags().StringSlice("to", nil, "email recipients")
}

func printTaskStatus(task *database.SyncTask, counts map[database.FileStatus]int64) {
	fmt.Println()
	fmt.Println("==============================================")
	fmt.Printf("Task ID:    %s\n", task.ID)
	fmt.Printf("Name:       %s\n", task.Name)
	fmt.Printf("Status:     %s\n", formatStatus(task.Status))
	fmt.Printf("Created:    %s\n", task.CreatedAt.Format("2006-01-02 15:04:05"))
	if task.StartedAt != nil {
		fmt.Printf("Started:    %s\n", task.StartedAt.Format("2006-01-02 15:04:05"))
	}
	if task.CompletedAt != nil {
		fmt.Printf("Completed:  %s\n", task.CompletedAt.Format("2006-01-02 15:04:05"))
		duration := task.CompletedAt.Sub(*task.StartedAt)
		fmt.Printf("Duration:   %s\n", duration.Round(time.Second))
	}
	fmt.Println("----------------------------------------------")
	fmt.Printf("Source: %s://%s/%s\n", task.SourceType, task.SourceBucket, task.SourcePrefix)
	fmt.Printf("Target: %s://%s/%s\n", task.TargetType, task.TargetBucket, task.TargetPrefix)
	fmt.Println("----------------------------------------------")
	fmt.Printf("Total:      %d files (%d bytes)\n", task.TotalFiles, task.TotalSize)
	fmt.Printf("Completed:  %d files (%d bytes)\n", task.CompletedFiles, task.CompletedSize)
	fmt.Printf("Failed:     %d\n", task.FailedFiles)
	fmt.Printf("Skipped:    %d\n", task.SkippedFiles)
	fmt.Printf("Conflicts:  %d\n", task.ConflictFiles)
	fmt.Printf("Deleted:    %d\n", task.DeletedFiles)

	if task.TotalFiles > 0 {
		progress := float64(task.CompletedFiles) / float64(task.TotalFiles) * 100
		fmt.Printf("Progress:   %.1f%%\n", progress)
	}
	fmt.Println("==============================================")
}

func printTaskList(tasks []*database.SyncTask) {
	fmt.Println()
	fmt.Printf("%-24s  %-8s  %-20s  %-12s  %s\n", "TASK ID", "STATUS", "CREATED", "PROGRESS", "NAME")
	fmt.Println(strings.Repeat("-", 100))
	for _, t := range tasks {
		progress := "-"
		if t.TotalFiles > 0 {
			progress = fmt.Sprintf("%.0f%%", float64(t.CompletedFiles)/float64(t.TotalFiles)*100)
		}
		fmt.Printf("%-24s  %-8s  %-20s  %-12s  %s\n",
			t.ID, formatStatusShort(t.Status),
			t.CreatedAt.Format("2006-01-02 15:04:05"),
			progress, t.Name,
		)
	}
	fmt.Println()
}

func formatStatus(s database.TaskStatus) string {
	switch s {
	case database.TaskStatusRunning:
		return "\033[34mRUNNING\033[0m"
	case database.TaskStatusPaused:
		return "\033[33mPAUSED\033[0m"
	case database.TaskStatusCompleted:
		return "\033[32mCOMPLETED\033[0m"
	case database.TaskStatusFailed:
		return "\033[31mFAILED\033[0m"
	case database.TaskStatusCancelled:
		return "\033[35mCANCELLED\033[0m"
	default:
		return string(s)
	}
}

func formatStatusShort(s database.TaskStatus) string {
	switch s {
	case database.TaskStatusRunning:
		return "\033[34mRUN\033[0m"
	case database.TaskStatusPaused:
		return "\033[33mPAUSE\033[0m"
	case database.TaskStatusCompleted:
		return "\033[32mDONE\033[0m"
	case database.TaskStatusFailed:
		return "\033[31mFAIL\033[0m"
	case database.TaskStatusCancelled:
		return "\033[35mCANCEL\033[0m"
	default:
		return string(s)
	}
}
