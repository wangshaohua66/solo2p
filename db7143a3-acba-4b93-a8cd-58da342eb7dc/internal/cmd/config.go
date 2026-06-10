package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"

	"github.com/remote-sensing/sentinel-cli/internal/config"
	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"
)

var (
	configInitOutput string
	configInitSensor string
	configInitForce  bool

	configValidateInput  string
	configValidateSchema string
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "配置管理命令 | Configuration management commands",
	Long: `配置管理命令组
Configuration management commands

用于生成和验证配置文件。
Used to generate and validate configuration files.`,
}

var configInitCmd = &cobra.Command{
	Use:   "init",
	Short: "生成配置模板 | Generate configuration template",
	Long: `生成配置模板
Generate configuration template

生成包含所有配置项的 YAML 配置文件模板，支持为指定传感器预设波段配置。
Generate a YAML configuration file template with all configuration items,
supporting preset band configurations for specified sensors.`,
	Example: `  # 生成包含所有传感器预设的完整配置
  sentinel config init -o config.yaml

  # 生成仅包含 Sentinel-2 预设的配置
  sentinel config init --sensor sentinel2 -o sentinel2.yaml

  # 强制覆盖已存在的配置文件
  sentinel config init -o config.yaml --force

  # 生成仅包含 Landsat-8 预设的配置
  sentinel config init --sensor landsat8 -o landsat8.yaml

  # Generate full config with all sensor presets
  sentinel config init -o config.yaml

  # Generate config with Sentinel-2 preset only
  sentinel config init --sensor sentinel2 -o sentinel2.yaml

  # Force overwrite existing config file
  sentinel config init -o config.yaml --force`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return validateConfigInitFlags()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runConfigInit()
	},
}

var configValidateCmd = &cobra.Command{
	Use:   "validate",
	Short: "验证配置文件 | Validate configuration file",
	Long: `验证配置文件
Validate configuration file

根据 schema 验证 YAML 配置文件的正确性，包括 EPSG 代码、波段组合、数值范围等。
Validate the correctness of YAML configuration files against schema,
including EPSG codes, band combinations, numeric ranges, etc.`,
	Example: `  # 验证配置文件
  sentinel config validate -i config.yaml

  # 使用自定义 schema 验证
  sentinel config validate -i config.yaml --schema schema.yaml

  # Validate configuration file
  sentinel config validate -i config.yaml

  # Validate with custom schema
  sentinel config validate -i config.yaml --schema schema.yaml`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		return validateConfigValidateFlags()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runConfigValidate()
	},
}

func init() {
	configCmd.AddCommand(configInitCmd)
	configCmd.AddCommand(configValidateCmd)
	rootCmd.AddCommand(configCmd)

	configInitCmd.Flags().StringVarP(&configInitOutput, "output", "o", "config.yaml",
		"输出文件路径 | Output file path")
	configInitCmd.Flags().StringVarP(&configInitSensor, "sensor", "s", "all",
		"传感器类型: all/sentinel2/landsat8/gf2 | Sensor type: all/sentinel2/landsat8/gf2")
	configInitCmd.Flags().BoolVarP(&configInitForce, "force", "f", false,
		"强制覆盖已存在的文件 | Force overwrite existing file")

	_ = configInitCmd.RegisterFlagCompletionFunc("sensor", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"all\tAll sensors", "sentinel2\tSentinel-2 MSI", "landsat8\tLandsat-8 OLI/TIRS", "gf2\tGaofen-2 PMS"}, cobra.ShellCompDirectiveNoFileComp
	})

	configValidateCmd.Flags().StringVarP(&configValidateInput, "input", "i", "",
		"输入配置文件路径 | Input configuration file path")
	configValidateCmd.Flags().StringVarP(&configValidateSchema, "schema", "", "",
		"自定义 schema 文件路径（可选）| Custom schema file path (optional)")

	_ = configValidateCmd.MarkFlagRequired("input")

	_ = configValidateCmd.RegisterFlagCompletionFunc("input", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"yaml", "yml"}, cobra.ShellCompDirectiveFilterFileExt
	})
}

func validateConfigInitFlags() error {
	validSensors := map[string]bool{"all": true, "sentinel2": true, "landsat8": true, "gf2": true}
	if !validSensors[strings.ToLower(configInitSensor)] {
		return apperrors.New(apperrors.E5003,
			fmt.Sprintf("无效的传感器类型: %s | Invalid sensor type: %s", configInitSensor, configInitSensor))
	}

	if !configInitForce {
		expandedPath := util.ExpandPath(configInitOutput)
		if _, err := os.Stat(expandedPath); err == nil {
			return apperrors.New(apperrors.E1005,
				fmt.Sprintf("文件已存在: %s，使用 --force 强制覆盖 | File already exists: %s, use --force to overwrite",
					configInitOutput, configInitOutput))
		}
	}

	return nil
}

func runConfigInit() error {
	cfg := config.DefaultConfig()

	if strings.ToLower(configInitSensor) != "all" {
		sensorType := types.SensorType(strings.ToLower(configInitSensor))
		preset, ok := config.GetSensorPreset(sensorType)
		if !ok {
			return apperrors.New(apperrors.E5003,
				fmt.Sprintf("未找到传感器预设: %s | Sensor preset not found: %s", configInitSensor, configInitSensor))
		}
		cfg.Sensors = map[string]types.SensorPreset{
			string(sensorType): preset,
		}
	}

	expandedPath := util.ExpandPath(configInitOutput)
	dir := filepath.Dir(expandedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return apperrors.Wrap(err, apperrors.E1005,
			fmt.Sprintf("无法创建目录: %s | Cannot create directory: %s", dir, dir))
	}

	yamlContent := generateConfigWithComments(cfg)

	if err := os.WriteFile(expandedPath, []byte(yamlContent), 0644); err != nil {
		return apperrors.Wrap(err, apperrors.E1005,
			fmt.Sprintf("无法写入配置文件: %s | Cannot write config file: %s", configInitOutput, configInitOutput))
	}

	fmt.Printf("配置模板已生成 | Config template generated: %s\n", configInitOutput)
	fmt.Printf("  传感器 | Sensor: %s\n", configInitSensor)
	fmt.Printf("  包含部分 | Sections: global, crs, index, io, pipeline, daemon, logging, sensors\n")

	return nil
}

func generateConfigWithComments(cfg *types.Config) string {
	var sb strings.Builder

	sb.WriteString("# Sentinel CLI 配置文件 | Sentinel CLI Configuration\n")
	sb.WriteString("# =========================================\n")
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# Global Configuration | 全局配置\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("global:\n")
	sb.WriteString("  # 最大并发处理数 (1-16) | Maximum concurrent processing count (1-16)\n")
	sb.WriteString(fmt.Sprintf("  max_concurrent: %d\n", cfg.Global.MaxConcurrent))
	sb.WriteString("  # 任务数据库路径 | Task database path\n")
	sb.WriteString(fmt.Sprintf("  database_path: \"%s\"\n", cfg.Global.DatabasePath))
	sb.WriteString("  # 临时文件目录 | Temporary file directory\n")
	sb.WriteString(fmt.Sprintf("  temp_directory: \"%s\"\n", cfg.Global.TempDirectory))
	sb.WriteString("  # 默认输出目录 | Default output directory\n")
	sb.WriteString(fmt.Sprintf("  output_directory: \"%s\"\n", cfg.Global.OutputDirectory))
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# CRS Configuration | 坐标系统配置\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("crs:\n")
	sb.WriteString("  # 默认源EPSG代码 | Default source EPSG code\n")
	sb.WriteString(fmt.Sprintf("  default_source_epsg: %d\n", cfg.CRS.DefaultSourceEPSG))
	sb.WriteString("  # 默认目标EPSG代码 | Default target EPSG code\n")
	sb.WriteString(fmt.Sprintf("  default_target_epsg: %d\n", cfg.CRS.DefaultTargetEPSG))
	sb.WriteString("\n")
	sb.WriteString("  # Bursa-Wolf 七参数转换预设 | Bursa-Wolf seven-parameter transformation presets\n")
	sb.WriteString("  # 参数格式: dx, dy, dz, rx, ry, rz, scale\n")
	sb.WriteString("  # 单位: dx/dy/dz为米, rx/ry/rz为弧秒, scale为ppm\n")
	sb.WriteString("  seven_params:\n")
	for name, params := range cfg.CRS.SevenParams {
		sb.WriteString(fmt.Sprintf("    %s:\n", name))
		sb.WriteString(fmt.Sprintf("      dx: %g\n", params.DX))
		sb.WriteString(fmt.Sprintf("      dy: %g\n", params.DY))
		sb.WriteString(fmt.Sprintf("      dz: %g\n", params.DZ))
		sb.WriteString(fmt.Sprintf("      rx: %g\n", params.RX))
		sb.WriteString(fmt.Sprintf("      ry: %g\n", params.RY))
		sb.WriteString(fmt.Sprintf("      rz: %g\n", params.RZ))
		sb.WriteString(fmt.Sprintf("      ds: %g\n", params.DS))
	}
	sb.WriteString("\n")
	sb.WriteString("  # NTv2 网格文件（高精度转换）| NTv2 grid files (high-accuracy transformation)\n")
	sb.WriteString("  ntv2_grids:\n")
	for name, grid := range cfg.CRS.NTv2Grids {
		sb.WriteString(fmt.Sprintf("    %s:\n", name))
		sb.WriteString(fmt.Sprintf("      file_path: \"%s\"\n", grid.FilePath))
		sb.WriteString(fmt.Sprintf("      grid_name: \"%s\"\n", grid.GridName))
		sb.WriteString(fmt.Sprintf("      source_epsg: %d\n", grid.SourceEPSG))
		sb.WriteString(fmt.Sprintf("      target_epsg: %d\n", grid.TargetEPSG))
	}
	sb.WriteString("  # EPSG 数据库路径 | EPSG database path\n")
	sb.WriteString(fmt.Sprintf("  database_path: \"%s\"\n", cfg.CRS.DatabasePath))
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# Index Configuration | 指数计算配置\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("index:\n")
	sb.WriteString("  # 默认 NoData 值 | Default NoData value\n")
	sb.WriteString(fmt.Sprintf("  default_nodata_value: %g\n", cfg.Index.DefaultNoDataValue))
	sb.WriteString("  # 输出格式 (GTiff/ENVI/HFA) | Output format (GTiff/ENVI/HFA)\n")
	sb.WriteString(fmt.Sprintf("  output_format: \"%s\"\n", cfg.Index.OutputFormat))
	sb.WriteString("  # 自定义指数公式 | Custom index formulas\n")
	sb.WriteString("  # 可用操作符: +, -, *, /, ()\n")
	sb.WriteString("  # 波段引用: B1, B2, B3, ...\n")
	sb.WriteString("  custom_formulas:\n")
	for name, formula := range cfg.Index.CustomFormulas {
		sb.WriteString(fmt.Sprintf("    %s: \"%s\"\n", name, formula))
	}
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# IO Configuration | 输入输出配置\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("io:\n")
	sb.WriteString("  # 块大小 (1-512 MB) | Chunk size (1-512 MB)\n")
	sb.WriteString(fmt.Sprintf("  chunk_size_mb: %d\n", cfg.IO.ChunkSizeMB))
	sb.WriteString("  # 内存限制 (0.5-16 GB) | Memory limit (0.5-16 GB)\n")
	sb.WriteString(fmt.Sprintf("  memory_limit_gb: %g\n", cfg.IO.MemoryLimitGB))
	sb.WriteString("  # 压缩方式: none/lzw/deflate/packbits | Compression: none/lzw/deflate/packbits\n")
	sb.WriteString(fmt.Sprintf("  compression: \"%s\"\n", cfg.IO.Compression))
	sb.WriteString("  # 压缩质量 (1-100) | Compression quality (1-100)\n")
	sb.WriteString(fmt.Sprintf("  compression_quality: %d\n", cfg.IO.CompressionQuality))
	sb.WriteString("  # 写入并发数 | Write concurrency\n")
	sb.WriteString(fmt.Sprintf("  write_concurrency: %d\n", cfg.IO.WriteConcurrency))
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# Pipeline Configuration | 流水线配置\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("pipeline:\n")
	sb.WriteString("  # 默认最大重试次数 (0-10) | Default maximum retries (0-10)\n")
	sb.WriteString(fmt.Sprintf("  default_max_retries: %d\n", cfg.Pipeline.DefaultMaxRetries))
	sb.WriteString("  # 重试等待时间（毫秒）| Retry backoff time (milliseconds)\n")
	sb.WriteString(fmt.Sprintf("  retry_backoff_ms: %d\n", cfg.Pipeline.RetryBackoffMs))
	sb.WriteString("  # 重试等待时间倍增器 | Retry backoff multiplier\n")
	sb.WriteString(fmt.Sprintf("  retry_backoff_multiplier: %g\n", cfg.Pipeline.RetryBackoffMultiplier))
	sb.WriteString("  # 检查点间隔（任务数）| Checkpoint interval (task count)\n")
	sb.WriteString(fmt.Sprintf("  checkpoint_interval: %d\n", cfg.Pipeline.CheckpointInterval))
	sb.WriteString("  # 死任务阈值（超过该重试次数视为死任务）| Dead task threshold (retries beyond this are considered dead)\n")
	sb.WriteString(fmt.Sprintf("  dead_task_threshold: %d\n", cfg.Pipeline.DeadTaskThreshold))
	sb.WriteString("  # 队列容量 | Queue capacity\n")
	sb.WriteString(fmt.Sprintf("  queue_capacity: %d\n", cfg.Pipeline.QueueCapacity))
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# Daemon Configuration | 守护进程配置\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("daemon:\n")
	sb.WriteString("  # PID 文件路径 | PID file path\n")
	sb.WriteString(fmt.Sprintf("  pid_file: \"%s\"\n", cfg.Daemon.PIDFile))
	sb.WriteString("  # 日志文件路径 | Log file path\n")
	sb.WriteString(fmt.Sprintf("  log_file: \"%s\"\n", cfg.Daemon.LogFile))
	sb.WriteString("  # 监听目录列表 | Watch directories\n")
	sb.WriteString("  watch_directories:\n")
	for _, dir := range cfg.Daemon.WatchDirectories {
		sb.WriteString(fmt.Sprintf("    - \"%s\"\n", dir))
	}
	sb.WriteString("  # 监听文件扩展名 | Watch file extensions\n")
	sb.WriteString("  file_extensions:\n")
	for _, ext := range cfg.Daemon.FileExtensions {
		sb.WriteString(fmt.Sprintf("    - \"%s\"\n", ext))
	}
	sb.WriteString("  # 轮询间隔（毫秒）| Poll interval (milliseconds)\n")
	sb.WriteString(fmt.Sprintf("  poll_interval_ms: %d\n", cfg.Daemon.PollIntervalMs))
	sb.WriteString("  # 优雅关闭超时（秒）| Graceful shutdown timeout (seconds)\n")
	sb.WriteString(fmt.Sprintf("  graceful_shutdown_sec: %d\n", cfg.Daemon.GracefulShutdownSec))
	sb.WriteString("  # 是否启用 systemd 通知 | Enable systemd notification\n")
	sb.WriteString(fmt.Sprintf("  systemd_notify: %t\n", cfg.Daemon.SystemdNotify))
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# Logging Configuration | 日志配置\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("logging:\n")
	sb.WriteString("  # 日志级别: debug/info/warn/error | Log level: debug/info/warn/error\n")
	sb.WriteString(fmt.Sprintf("  level: \"%s\"\n", cfg.Logging.Level))
	sb.WriteString("  # 日志格式: json/text | Log format: json/text\n")
	sb.WriteString(fmt.Sprintf("  format: \"%s\"\n", cfg.Logging.Format))
	sb.WriteString("  # 审计日志路径 | Audit log path\n")
	sb.WriteString(fmt.Sprintf("  audit_log_path: \"%s\"\n", cfg.Logging.AuditLogPath))
	sb.WriteString("  # 审计日志最大大小（MB）| Maximum audit log size (MB)\n")
	sb.WriteString(fmt.Sprintf("  audit_log_max_size_mb: %d\n", cfg.Logging.AuditLogMaxSizeMB))
	sb.WriteString("  # 审计日志最大备份数 | Maximum audit log backups\n")
	sb.WriteString(fmt.Sprintf("  audit_log_max_backups: %d\n", cfg.Logging.AuditLogMaxBackups))
	sb.WriteString("  # 详细输出模式 | Verbose output mode\n")
	sb.WriteString(fmt.Sprintf("  verbose: %t\n", cfg.Logging.Verbose))
	sb.WriteString("  # 静默模式（仅输出错误）| Quiet mode (output only errors)\n")
	sb.WriteString(fmt.Sprintf("  quiet: %t\n", cfg.Logging.Quiet))
	sb.WriteString("\n")

	sb.WriteString("# =========================\n")
	sb.WriteString("# Sensor Presets | 传感器预设\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("sensors:\n")
	for sensorKey, sensor := range cfg.Sensors {
		sb.WriteString(fmt.Sprintf("  %s:\n", sensorKey))
		sb.WriteString(fmt.Sprintf("    # %s\n", sensor.Name))
		sb.WriteString(fmt.Sprintf("    name: \"%s\"\n", sensor.Name))
		sb.WriteString("\n")
		sb.WriteString("    # 波段定义 | Band definitions\n")
		sb.WriteString("    bands:\n")
		for bandKey, band := range sensor.Bands {
			sb.WriteString(fmt.Sprintf("      %s:\n", bandKey))
			sb.WriteString(fmt.Sprintf("        # %s | %s\n", band.Name, band.Description))
			sb.WriteString(fmt.Sprintf("        index: %d\n", band.Index))
			sb.WriteString(fmt.Sprintf("        name: \"%s\"\n", band.Name))
			sb.WriteString(fmt.Sprintf("        wavelength_min: %g\n", band.WavelengthMin))
			sb.WriteString(fmt.Sprintf("        wavelength_max: %g\n", band.WavelengthMax))
			sb.WriteString(fmt.Sprintf("        resolution: %g\n", band.Resolution))
			sb.WriteString(fmt.Sprintf("        description: \"%s\"\n", band.Description))
		}
		sb.WriteString("\n")
		sb.WriteString("    # 默认波段映射 | Default band mapping\n")
		sb.WriteString("    default_bands:\n")
		for role, bandKey := range sensor.DefaultBands {
			sb.WriteString(fmt.Sprintf("      %s: \"%s\"\n", role, bandKey))
		}
		sb.WriteString("\n")
		sb.WriteString("    # 植被指数公式 | Vegetation index formulas\n")
		sb.WriteString(fmt.Sprintf("    ndvi_formula: \"%s\"\n", sensor.NDVIFormula))
		sb.WriteString(fmt.Sprintf("    evi_formula: \"%s\"\n", sensor.EVIFormula))
		sb.WriteString(fmt.Sprintf("    savi_formula: \"%s\"\n", sensor.SAVIFormula))
		sb.WriteString("\n")
		sb.WriteString("    # 元数据文件匹配模式 | Metadata file matching pattern\n")
		sb.WriteString(fmt.Sprintf("    metadata_pattern: \"%s\"\n", sensor.MetadataPattern))
		sb.WriteString("\n")
	}

	sb.WriteString("# =========================\n")
	sb.WriteString("# 支持的 EPSG 代码 | Supported EPSG Codes\n")
	sb.WriteString("# =========================\n")
	sb.WriteString("# 4326  - WGS84 - World Geodetic System 1984\n")
	sb.WriteString("# 4490  - CGCS2000 - China Geodetic Coordinate System 2000\n")
	sb.WriteString("# 4214  - Beijing54 - Beijing Geodetic Coordinate System 1954\n")
	sb.WriteString("# 4610  - Xian80 - Xi'an Geodetic Coordinate System 1980\n")
	sb.WriteString("# 3857  - Web Mercator / Pseudo-Mercator\n")
	sb.WriteString("# 32649 - WGS 84 / UTM zone 49N\n")
	sb.WriteString("# 32650 - WGS 84 / UTM zone 50N\n")
	sb.WriteString("# 32651 - WGS 84 / UTM zone 51N\n")
	sb.WriteString("# 23849 - CGCS2000 / 3-degree Gauss-Kruger zone 25\n")
	sb.WriteString("# 23850 - CGCS2000 / 3-degree Gauss-Kruger zone 26\n")

	return sb.String()
}

func validateConfigValidateFlags() error {
	expandedPath := util.ExpandPath(configValidateInput)
	if _, err := os.Stat(expandedPath); os.IsNotExist(err) {
		return apperrors.Wrap(err, apperrors.E4001,
			fmt.Sprintf("配置文件不存在: %s | Config file not found: %s", configValidateInput, configValidateInput))
	}
	return nil
}

func runConfigValidate() error {
	expandedPath := util.ExpandPath(configValidateInput)
	data, err := os.ReadFile(expandedPath)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E5001,
			fmt.Sprintf("无法读取配置文件: %s | Cannot read config file: %s", configValidateInput, configValidateInput))
	}

	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		return apperrors.Wrap(err, apperrors.E5002,
			fmt.Sprintf("YAML 解析错误 | YAML parse error: %v", err))
	}

	var cfg types.Config
	if err := node.Decode(&cfg); err != nil {
		return apperrors.Wrap(err, apperrors.E5002,
			fmt.Sprintf("YAML 解码错误 | YAML decode error: %v", err))
	}

	result := config.ValidateConfigWithSchema(&cfg, data)

	fieldLines := config.GetFieldsWithLineNumbers(&node, "")

	epsgErrors := validateEPSGCodes(&cfg, fieldLines)
	result.Errors = append(result.Errors, epsgErrors.Errors...)
	result.Warning = append(result.Warning, epsgErrors.Warning...)
	if !epsgErrors.Valid {
		result.Valid = false
	}

	bandErrors := validateBandCombinations(&cfg, fieldLines)
	result.Errors = append(result.Errors, bandErrors.Errors...)
	result.Warning = append(result.Warning, bandErrors.Warning...)
	if !bandErrors.Valid {
		result.Valid = false
	}

	printValidationSummary(result, configValidateInput)

	if !result.Valid {
		return apperrors.New(apperrors.E5003,
			fmt.Sprintf("配置验证失败 | Config validation failed with %d error(s)", len(result.Errors)))
	}

	return nil
}

func validateEPSGCodes(cfg *types.Config, fieldLines map[string]int) types.ValidationResult {
	var result types.ValidationResult
	result.Valid = true

	if !config.IsValidEPSG(cfg.CRS.DefaultSourceEPSG) {
		result.Valid = false
		result.Errors = append(result.Errors, types.ValidationError{
			Field:    "crs.default_source_epsg",
			Message:  fmt.Sprintf("无效的 EPSG 代码: %d，支持的代码包括: %s", cfg.CRS.DefaultSourceEPSG, listSupportedEPSG()),
			Line:     fieldLines["crs.default_source_epsg"],
			Severity: "error",
		})
	}

	if !config.IsValidEPSG(cfg.CRS.DefaultTargetEPSG) {
		result.Valid = false
		result.Errors = append(result.Errors, types.ValidationError{
			Field:    "crs.default_target_epsg",
			Message:  fmt.Sprintf("无效的 EPSG 代码: %d，支持的代码包括: %s", cfg.CRS.DefaultTargetEPSG, listSupportedEPSG()),
			Line:     fieldLines["crs.default_target_epsg"],
			Severity: "error",
		})
	}

	for name, grid := range cfg.CRS.NTv2Grids {
		if !config.IsValidEPSG(grid.SourceEPSG) {
			result.Valid = false
			result.Errors = append(result.Errors, types.ValidationError{
				Field:    fmt.Sprintf("crs.ntv2_grids.%s.source_epsg", name),
				Message:  fmt.Sprintf("无效的 EPSG 代码: %d", grid.SourceEPSG),
				Line:     fieldLines[fmt.Sprintf("crs.ntv2_grids.%s.source_epsg", name)],
				Severity: "error",
			})
		}
		if !config.IsValidEPSG(grid.TargetEPSG) {
			result.Valid = false
			result.Errors = append(result.Errors, types.ValidationError{
				Field:    fmt.Sprintf("crs.ntv2_grids.%s.target_epsg", name),
				Message:  fmt.Sprintf("无效的 EPSG 代码: %d", grid.TargetEPSG),
				Line:     fieldLines[fmt.Sprintf("crs.ntv2_grids.%s.target_epsg", name)],
				Severity: "error",
			})
		}
	}

	return result
}

func validateBandCombinations(cfg *types.Config, fieldLines map[string]int) types.ValidationResult {
	var result types.ValidationResult
	result.Valid = true

	for sensorKey, sensor := range cfg.Sensors {
		for bandKey, band := range sensor.Bands {
			if band.Index < 1 {
				result.Valid = false
				result.Errors = append(result.Errors, types.ValidationError{
					Field:    fmt.Sprintf("sensors.%s.bands.%s.index", sensorKey, bandKey),
					Message:  fmt.Sprintf("波段索引必须大于 0，当前值: %d", band.Index),
					Line:     fieldLines[fmt.Sprintf("sensors.%s.bands.%s.index", sensorKey, bandKey)],
					Severity: "error",
				})
			}
			if band.WavelengthMin <= 0 {
				result.Valid = false
				result.Errors = append(result.Errors, types.ValidationError{
					Field:    fmt.Sprintf("sensors.%s.bands.%s.wavelength_min", sensorKey, bandKey),
					Message:  fmt.Sprintf("波长最小值必须大于 0，当前值: %g", band.WavelengthMin),
					Line:     fieldLines[fmt.Sprintf("sensors.%s.bands.%s.wavelength_min", sensorKey, bandKey)],
					Severity: "error",
				})
			}
			if band.WavelengthMax <= band.WavelengthMin {
				result.Valid = false
				result.Errors = append(result.Errors, types.ValidationError{
					Field:    fmt.Sprintf("sensors.%s.bands.%s.wavelength_max", sensorKey, bandKey),
					Message:  fmt.Sprintf("波长最大值必须大于最小值 (%g)，当前值: %g", band.WavelengthMin, band.WavelengthMax),
					Line:     fieldLines[fmt.Sprintf("sensors.%s.bands.%s.wavelength_max", sensorKey, bandKey)],
					Severity: "error",
				})
			}
			if band.Resolution <= 0 {
				result.Valid = false
				result.Errors = append(result.Errors, types.ValidationError{
					Field:    fmt.Sprintf("sensors.%s.bands.%s.resolution", sensorKey, bandKey),
					Message:  fmt.Sprintf("分辨率必须大于 0，当前值: %g", band.Resolution),
					Line:     fieldLines[fmt.Sprintf("sensors.%s.bands.%s.resolution", sensorKey, bandKey)],
					Severity: "error",
				})
			}
		}

		for role, bandKey := range sensor.DefaultBands {
			if _, ok := sensor.Bands[bandKey]; !ok {
				result.Valid = false
				result.Errors = append(result.Errors, types.ValidationError{
					Field:    fmt.Sprintf("sensors.%s.default_bands.%s", sensorKey, role),
					Message:  fmt.Sprintf("默认波段 '%s' 引用了未定义的波段: '%s'", role, bandKey),
					Line:     fieldLines[fmt.Sprintf("sensors.%s.default_bands.%s", sensorKey, role)],
					Severity: "error",
				})
			}
		}

		ndviResult := config.ValidateBandCombination(types.SensorType(sensorKey), sensor.NDVIFormula)
		if !ndviResult.Valid {
			result.Valid = false
			for _, e := range ndviResult.Errors {
				e.Field = fmt.Sprintf("sensors.%s.ndvi_formula", sensorKey)
				e.Line = fieldLines[fmt.Sprintf("sensors.%s.ndvi_formula", sensorKey)]
				result.Errors = append(result.Errors, e)
			}
		}

		eviResult := config.ValidateBandCombination(types.SensorType(sensorKey), sensor.EVIFormula)
		if !eviResult.Valid {
			result.Valid = false
			for _, e := range eviResult.Errors {
				e.Field = fmt.Sprintf("sensors.%s.evi_formula", sensorKey)
				e.Line = fieldLines[fmt.Sprintf("sensors.%s.evi_formula", sensorKey)]
				result.Errors = append(result.Errors, e)
			}
		}

		saviResult := config.ValidateBandCombination(types.SensorType(sensorKey), sensor.SAVIFormula)
		if !saviResult.Valid {
			result.Valid = false
			for _, e := range saviResult.Errors {
				e.Field = fmt.Sprintf("sensors.%s.savi_formula", sensorKey)
				e.Line = fieldLines[fmt.Sprintf("sensors.%s.savi_formula", sensorKey)]
				result.Errors = append(result.Errors, e)
			}
		}
	}

	for name, formula := range cfg.Index.CustomFormulas {
		var foundSensor types.SensorType
		for sensorKey := range cfg.Sensors {
			if preset, ok := config.GetSensorPreset(types.SensorType(sensorKey)); ok {
				r := config.ValidateBandCombination(types.SensorType(sensorKey), formula)
				if r.Valid {
					foundSensor = types.SensorType(sensorKey)
					break
				}
				_ = preset
			}
		}
		if foundSensor == "" {
			result.Warning = append(result.Warning, types.ValidationError{
				Field:    fmt.Sprintf("index.custom_formulas.%s", name),
				Message:  fmt.Sprintf("自定义公式 '%s' 可能包含无效的波段引用，请确保在使用时与正确的传感器匹配", name),
				Line:     fieldLines[fmt.Sprintf("index.custom_formulas.%s", name)],
				Severity: "warning",
			})
		}
	}

	return result
}

func listSupportedEPSG() string {
	codes := config.ListEPSGCodes()
	var parts []string
	for code, desc := range codes {
		parts = append(parts, fmt.Sprintf("%d (%s)", code, desc))
	}
	return strings.Join(parts, ", ")
}

func printValidationSummary(result types.ValidationResult, filePath string) {
	fmt.Println("========================================")
	fmt.Printf("配置验证结果 | Config Validation Result\n")
	fmt.Printf("文件 | File: %s\n", filePath)
	fmt.Println("========================================")
	fmt.Println()

	if len(result.Errors) > 0 {
		fmt.Printf("错误 | Errors: %d\n", len(result.Errors))
		for _, e := range result.Errors {
			lineInfo := ""
			if e.Line > 0 {
				lineInfo = fmt.Sprintf(" (line %d)", e.Line)
			}
			fmt.Printf("  [ERROR]%s %s: %s\n", lineInfo, e.Field, e.Message)
		}
		fmt.Println()
	}

	if len(result.Warning) > 0 {
		fmt.Printf("警告 | Warnings: %d\n", len(result.Warning))
		for _, w := range result.Warning {
			lineInfo := ""
			if w.Line > 0 {
				lineInfo = fmt.Sprintf(" (line %d)", w.Line)
			}
			fmt.Printf("  [WARN]%s %s: %s\n", lineInfo, w.Field, w.Message)
		}
		fmt.Println()
	}

	fmt.Println("----------------------------------------")
	if result.Valid {
		fmt.Printf("结果 | Result: ✓ PASS\n")
		fmt.Printf("配置文件验证通过，所有字段均有效。\n")
		fmt.Printf("Config file validated successfully, all fields are valid.\n")
	} else {
		fmt.Printf("结果 | Result: ✗ FAIL\n")
		fmt.Printf("配置文件验证失败，请修复上述错误。\n")
		fmt.Printf("Config file validation failed, please fix the errors above.\n")
	}
	fmt.Println("========================================")
}
