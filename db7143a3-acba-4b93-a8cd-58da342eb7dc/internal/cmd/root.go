package cmd

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/rs/zerolog"
	"github.com/spf13/cobra"

	"github.com/remote-sensing/sentinel-cli/internal/config"
	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
)

var (
	Version   = "dev"
	GitCommit = "none"
	BuildDate = "unknown"

	cfgFiles    []string
	dbPath      string
	verbose     bool
	quiet       bool
	maxConcurrent int

	AppConfig *types.Config
	Logger    zerolog.Logger
)

var rootCmd = &cobra.Command{
	Use:   "sentinel",
	Short: "遥感图像处理工具 | Remote Sensing Image Processing Tool",
	Long: `Sentinel CLI - 遥感图像处理工具
Sentinel CLI - Remote Sensing Image Processing Tool

支持 Sentinel-2、Landsat-8、高分二号 等多源遥感数据的处理，包括：
  - 坐标系统转换 (CRS transformation)
  - 植被指数计算 (NDVI, EVI, SAVI, 自定义指数)
  - 批处理流水线 (Batch processing pipeline)
  - 守护进程模式 (Daemon mode for automatic processing)

Supports processing of multi-source remote sensing data including Sentinel-2, Landsat-8, Gaofen-2:
  - Coordinate Reference System transformation
  - Vegetation index calculation (NDVI, EVI, SAVI, custom indices)
  - Batch processing pipeline
  - Daemon mode for automatic processing`,
	Example: `  # 查看版本信息 | Show version information
  sentinel --version

  # 使用指定配置文件运行 | Run with specified config file
  sentinel --config /etc/sentinel/config.yaml <command>

  # 叠加多个配置文件 | Overlay multiple config files
  sentinel --config base.yaml --config override.yaml <command>

  # 启用详细日志 | Enable verbose logging
  sentinel --verbose <command>

  # 设置并发数为 8 | Set concurrency to 8
  sentinel --max-concurrent 8 <command>
  sentinel -m 8 <command>

  # 计算 NDVI 指数 | Calculate NDVI index
  sentinel index --type ndvi --input input.tif --output output.tif

  # 坐标系统转换 | CRS transformation
  sentinel crs --source-epsg 4326 --target-epsg 4490 --input input.tif --output output.tif`,
	SilenceUsage:  false,
	SilenceErrors: false,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if err := loadConfiguration(); err != nil {
			return err
		}

		if err := validateFlags(); err != nil {
			return err
		}

		initLogger()

		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		if cmd.Flags().Changed("version") {
			printVersion()
			return nil
		}
		return cmd.Help()
	},
}

func init() {
	rootCmd.PersistentFlags().StringSliceVarP(&cfgFiles, "config", "c", []string{},
		"配置文件路径 (可多次指定，后加载的覆盖先加载的) | Config file path (can be specified multiple times, later files override earlier ones)")
	rootCmd.PersistentFlags().StringVar(&dbPath, "db-path", "",
		"数据库路径，覆盖配置文件中的设置 | Database path, overrides config file setting")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false,
		"启用详细日志输出 | Enable verbose logging output")
	rootCmd.PersistentFlags().BoolVarP(&quiet, "quiet", "q", false,
		"启用静默模式，仅输出错误 | Enable quiet mode, only output errors")
	rootCmd.PersistentFlags().IntVarP(&maxConcurrent, "max-concurrent", "m", 0,
		"最大并发处理数 (1-16) | Maximum concurrent processing count (1-16)")

	rootCmd.Flags().Bool("version", false, "打印版本信息 | Print version information")

	_ = rootCmd.RegisterFlagCompletionFunc("config", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"yaml", "yml"}, cobra.ShellCompDirectiveFilterFileExt
	})

	cobra.OnInitialize(func() {
		bindEnvVars()
	})
}

func bindEnvVars() {
	if v := os.Getenv("SENTINEL_CONFIG"); v != "" && len(cfgFiles) == 0 {
		cfgFiles = strings.Split(v, ",")
	}
	if v := os.Getenv("SENTINEL_DB_PATH"); v != "" && !rootCmd.Flags().Changed("db-path") {
		dbPath = v
	}
	if v := os.Getenv("SENTINEL_VERBOSE"); v != "" && !rootCmd.Flags().Changed("verbose") {
		if b, err := strconv.ParseBool(v); err == nil {
			verbose = b
		}
	}
	if v := os.Getenv("SENTINEL_QUIET"); v != "" && !rootCmd.Flags().Changed("quiet") {
		if b, err := strconv.ParseBool(v); err == nil {
			quiet = b
		}
	}
	if v := os.Getenv("SENTINEL_MAX_CONCURRENT"); v != "" && !rootCmd.Flags().Changed("max-concurrent") {
		if i, err := strconv.Atoi(v); err == nil {
			maxConcurrent = i
		}
	}
}

func loadConfiguration() error {
	var err error
	if len(cfgFiles) > 0 {
		AppConfig, err = config.LoadConfig(cfgFiles...)
		if err != nil {
			return fmt.Errorf("加载配置失败 | Failed to load config: %w", err)
		}
	} else {
		AppConfig = config.DefaultConfig()
	}

	if dbPath != "" {
		AppConfig.Global.DatabasePath = dbPath
	}
	if verbose {
		AppConfig.Logging.Verbose = true
		AppConfig.Logging.Level = "debug"
	}
	if quiet {
		AppConfig.Logging.Quiet = true
		AppConfig.Logging.Level = "error"
	}
	if maxConcurrent > 0 {
		AppConfig.Global.MaxConcurrent = maxConcurrent
	}

	validationResult := config.ValidateConfig(AppConfig)
	if !validationResult.Valid {
		var errMsgs []string
		for _, e := range validationResult.Errors {
			loc := ""
			if e.Line > 0 {
				loc = fmt.Sprintf(" (line %d)", e.Line)
			}
			errMsgs = append(errMsgs, fmt.Sprintf("  - %s: %s%s", e.Field, e.Message, loc))
		}
		return apperrors.New(apperrors.E5003,
			fmt.Sprintf("配置验证失败 | Config validation failed:\n%s", strings.Join(errMsgs, "\n")))
	}

	for _, w := range validationResult.Warning {
		loc := ""
		if w.Line > 0 {
			loc = fmt.Sprintf(" (line %d)", w.Line)
		}
		fmt.Fprintf(os.Stderr, "警告 | Warning: %s: %s%s\n", w.Field, w.Message, loc)
	}

	return nil
}

func validateFlags() error {
	if maxConcurrent != 0 && (maxConcurrent < 1 || maxConcurrent > 16) {
		return apperrors.New(apperrors.E5003,
			fmt.Sprintf("--max-concurrent 必须在 1-16 之间，当前值: %d | --max-concurrent must be between 1-16, current value: %d",
				maxConcurrent, maxConcurrent))
	}
	return nil
}

func initLogger() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	logLevel := parseLogLevel(AppConfig.Logging.Level)
	if AppConfig.Logging.Verbose {
		logLevel = zerolog.DebugLevel
	}
	if AppConfig.Logging.Quiet {
		logLevel = zerolog.ErrorLevel
	}

	zerolog.SetGlobalLevel(logLevel)

	var output zerolog.LevelWriter
	if AppConfig.Logging.Format == "text" {
		output = zerolog.MultiLevelWriter(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "2006-01-02 15:04:05"})
	} else {
		output = zerolog.MultiLevelWriter(os.Stderr)
	}

	Logger = zerolog.New(output).With().
		Timestamp().
		Str("version", Version).
		Str("commit", GitCommit).
		Logger()
}

func parseLogLevel(level string) zerolog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return zerolog.DebugLevel
	case "info":
		return zerolog.InfoLevel
	case "warn", "warning":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	default:
		return zerolog.InfoLevel
	}
}

func printVersion() {
	fmt.Printf("Sentinel CLI %s\n", Version)
	fmt.Printf("  Git Commit: %s\n", GitCommit)
	fmt.Printf("  Build Date: %s\n", BuildDate)
	fmt.Printf("  Go Version: %s\n", strings.TrimPrefix(os.Getenv("GOVERSION"), "go"))
	fmt.Printf("  OS/Arch:    %s/%s\n", os.Getenv("GOOS"), os.Getenv("GOARCH"))
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "错误 | Error: %v\n", err)

		if appErr, ok := err.(*apperrors.AppError); ok {
			fmt.Fprintln(os.Stderr)
			fmt.Fprintf(os.Stderr, "描述 | Description: %s\n", appErr.FullDescription())
			if len(appErr.Suggestions()) > 0 {
				fmt.Fprintln(os.Stderr)
				fmt.Fprintln(os.Stderr, "建议 | Suggestions:")
				for _, s := range appErr.Suggestions() {
					fmt.Fprintf(os.Stderr, "  - %s\n", s)
				}
			}
			if appErr.Cause != nil {
				fmt.Fprintf(os.Stderr, "\n原因 | Cause: %v\n", appErr.Cause)
			}
		}

		fmt.Fprintln(os.Stderr)
		fmt.Fprintln(os.Stderr, "使用帮助 | Usage:")
		_ = rootCmd.Usage()
		os.Exit(1)
	}
}
