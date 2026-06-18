package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"secfg/internal/audit"
	"secfg/internal/backup"
	"secfg/internal/config"
	"secfg/internal/crypto"
	"secfg/internal/errors"
	"secfg/internal/validator"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorCyan   = "\033[36m"
)

var (
	vault        *crypto.Vault
	configMgr    *config.Manager
	backupMgr    *backup.Manager
	auditLogger  *audit.Logger
	homeDir      string
	secfgDir     string
	verbose      bool
	configPath   string
	outputFormat string

	memoryMu           sync.Mutex
	memoryThresholdMB  uint64 = 100
	memoryAlertCount   int
	watcher            *fsnotify.Watcher
	watcherOnce        sync.Once
	managersMu         sync.RWMutex
)

var rootCmd = &cobra.Command{
	Use:   "secfg",
	Short: "安全配置管理工具 - 加密、解密、同步和审计微服务配置",
	Long: `secfg 是一个企业级安全配置管理工具，支持：
  • 密钥管理与轮换
  • YAML/JSON/Properties 配置文件加密解密
  • 跨环境配置同步
  • 配置备份与恢复
  • 操作审计与追溯

示例:
  secfg key generate                          # 生成主密钥
  secfg encrypt -f config.yaml                # 加密配置文件
  secfg decrypt -f config.yaml                # 解密配置文件
  secfg sync dev prod --dir /configs          # 同步dev到prod环境
  secfg backup create -f config.yaml          # 创建配置备份
  secfg audit query --command encrypt         # 查询加密操作审计`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		return initManagers()
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		if backupMgr != nil {
			backupMgr.Close()
		}
		if auditLogger != nil {
			auditLogger.Close()
		}
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "显示详细输出")
	rootCmd.PersistentFlags().StringVar(&configPath, "config-path", "", "配置目录路径 (默认 ~/.secfg)")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "output-format", "o", "table", "输出格式: table|json")

	viper.BindPFlag("verbose", rootCmd.PersistentFlags().Lookup("verbose"))
	viper.BindPFlag("config-path", rootCmd.PersistentFlags().Lookup("config-path"))
	viper.BindPFlag("output-format", rootCmd.PersistentFlags().Lookup("output-format"))

	rootCmd.AddCommand(newKeyCmd())
	rootCmd.AddCommand(newEncryptCmd())
	rootCmd.AddCommand(newDecryptCmd())
	rootCmd.AddCommand(newSyncCmd())
	rootCmd.AddCommand(newBackupCmd())
	rootCmd.AddCommand(newAuditCmd())
	rootCmd.AddCommand(newCompletionCmd())
}

func initConfig() {
	var err error
	homeDir, err = os.UserHomeDir()
	if err != nil {
		printError("无法获取用户主目录: " + err.Error())
		os.Exit(1)
	}

	secfgDir = filepath.Join(homeDir, ".secfg")
	if configPath != "" {
		secfgDir = configPath
	}

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(secfgDir)
	viper.AddConfigPath(".")
	viper.SetEnvPrefix("SEC_CFG")
	viper.AutomaticEnv()

	viper.SetDefault("key_path", filepath.Join(secfgDir, "keys"))
	viper.SetDefault("backup_path", filepath.Join(secfgDir, "backups"))
	viper.SetDefault("audit_path", filepath.Join(secfgDir, "audit"))
	viper.SetDefault("memory_threshold_mb", 100)
	viper.SetDefault("operation_timeout_seconds", 30)

	viper.OnConfigChange(func(e fsnotify.Event) {
		if verbose {
			printInfo(fmt.Sprintf("检测到配置文件变更: %s (%s), 正在热更新...", e.Name, e.Op))
		}

		threshold := viper.GetUint64("memory_threshold_mb")
		if threshold > 0 {
			memoryMu.Lock()
			memoryThresholdMB = threshold
			memoryMu.Unlock()
		}

		if verbose {
			printSuccess("配置热更新完成")
		}

		logOperation("config:hot-reload", map[string]interface{}{
			"file":  e.Name,
			"event": e.Op.String(),
		}, e.Name, true, nil)
	})

	watcherOnce.Do(func() {
		startConfigWatcher()
	})

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			if err := os.MkdirAll(secfgDir, 0700); err != nil {
				printError("无法创建配置目录: " + err.Error())
				os.Exit(1)
			}
			defaultConfig := filepath.Join(secfgDir, "config.yaml")
			defaultConfigContent := `key_path: ` + viper.GetString("key_path") + `
backup_path: ` + viper.GetString("backup_path") + `
audit_path: ` + viper.GetString("audit_path") + `
memory_threshold_mb: 100
operation_timeout_seconds: 30
`
			if err := os.WriteFile(defaultConfig, []byte(defaultConfigContent), 0644); err != nil {
				printWarning("无法创建默认配置文件: " + err.Error())
			}
			if err := viper.ReadInConfig(); err != nil {
				if verbose {
					printWarning("重读取配置失败: " + err.Error())
				}
			}
		} else if verbose {
			printWarning("读取配置文件失败: " + err.Error())
		}
	}

	memoryThresholdMB = viper.GetUint64("memory_threshold_mb")
	if memoryThresholdMB == 0 {
		memoryThresholdMB = 100
	}
}

func startConfigWatcher() {
	var err error
	watcher, err = fsnotify.NewWatcher()
	if err != nil {
		if verbose {
			printWarning("创建配置文件监听器失败: " + err.Error())
		}
		return
	}

	configFile := filepath.Join(secfgDir, "config.yaml")
	configDir := secfgDir

	if _, statErr := os.Stat(configFile); statErr == nil {
		if addErr := watcher.Add(configFile); addErr != nil && verbose {
			printWarning(fmt.Sprintf("监听配置文件 %s 失败: %v", configFile, addErr))
		}
	} else if _, statErr := os.Stat(configDir); statErr == nil {
		if addErr := watcher.Add(configDir); addErr != nil && verbose {
			printWarning(fmt.Sprintf("监听配置目录 %s 失败: %v", configDir, addErr))
		}
	}

	go func() {
		defer watcher.Close()
		var debounceTimer *time.Timer

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				base := filepath.Base(event.Name)
				if base != "config.yaml" {
					continue
				}

				if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) == 0 {
					continue
				}

				if debounceTimer != nil {
					debounceTimer.Stop()
				}
				debounceTimer = time.AfterFunc(200*time.Millisecond, func() {
					if event.Op&fsnotify.Rename != 0 {
						_ = watcher.Add(event.Name)
					}
					if verbose {
						printInfo(fmt.Sprintf("配置文件 %s 已变更", event.Name))
					}
				})

			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				if verbose {
					printWarning("配置监听错误: " + err.Error())
				}
			}
		}
	}()

	if verbose {
		printSuccess(fmt.Sprintf("配置热更新监听已启动: %s", configFile))
	}
}

func initManagers() error {
	keyPath := viper.GetString("key_path")
	backupPath := viper.GetString("backup_path")
	auditPath := viper.GetString("audit_path")

	var err *errors.SecfgError
	vault, err = crypto.NewVault(keyPath)
	if err != nil {
		return fmt.Errorf("初始化Vault失败: %v", err)
	}

	configMgr = config.NewManager(vault)

	backupMgr, err = backup.NewManager(backupPath, vault)
	if err != nil {
		return fmt.Errorf("初始化Backup管理器失败: %v", err)
	}

	auditLogger, err = audit.NewLogger(auditPath)
	if err != nil {
		return fmt.Errorf("初始化Audit日志器失败: %v", err)
	}

	return nil
}

func logOperation(command string, params map[string]interface{}, filePath string, success bool, err error) {
	if auditLogger == nil {
		return
	}
	if logErr := auditLogger.Log(command, params, filePath, success, err); logErr != nil {
		printWarning("审计日志写入失败: " + logErr.Error())
	}
}

func printSuccess(msg string) {
	fmt.Printf("%s✓ %s%s\n", colorGreen, msg, colorReset)
}

func printError(msg string) {
	fmt.Printf("%s✗ %s%s\n", colorRed, msg, colorReset)
}

func printWarning(msg string) {
	fmt.Printf("%s⚠ %s%s\n", colorYellow, msg, colorReset)
}

func printInfo(msg string) {
	fmt.Printf("%sℹ %s%s\n", colorCyan, msg, colorReset)
}

func printProgress(current, total int, message string) {
	percent := float64(current) / float64(total) * 100
	barWidth := 30
	filled := int(percent / 100 * float64(barWidth))
	bar := strings.Repeat("█", filled) + strings.Repeat("░", barWidth-filled)
	fmt.Printf("\r%s [%s] %d/%d (%.1f%%) %s", colorCyan, bar, current, total, percent, message)
	if current == total {
		fmt.Println(colorReset)
	}
}

func confirmAction(message string) bool {
	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("%s%s (y/N): %s", colorYellow, message, colorReset)
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(strings.ToLower(response))
	return response == "y" || response == "yes"
}

func newKeyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "key",
		Short: "密钥管理",
		Long:  "管理加密密钥，包括生成、轮换、导入、导出和列表查看",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "generate",
		Short: "生成新的主密钥",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := map[string]interface{}{"action": "generate"}

			if vault.GetCurrentKeyID() != "" {
				if !confirmAction("已存在主密钥，生成新密钥将使旧密钥降级为备份，是否继续？") {
					return nil
				}
			}

			keyID, err := vault.GenerateKey()
			if err != nil {
				logOperation("key:generate", params, "", false, err)
				return err
			}

			logOperation("key:generate", params, "", true, nil)
			printSuccess(fmt.Sprintf("主密钥生成成功，ID: %s", keyID))
			printInfo("密钥文件权限已自动设置为600")
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "rotate",
		Short: "轮换主密钥",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := map[string]interface{}{"action": "rotate"}

			if !confirmAction("密钥轮换后，旧密钥将被备份，使用旧密钥加密的配置需要重新加密，是否继续？") {
				return nil
			}

			keyID, err := vault.RotateKey()
			if err != nil {
				logOperation("key:rotate", params, "", false, err)
				return err
			}

			logOperation("key:rotate", params, "", true, nil)
			printSuccess(fmt.Sprintf("密钥轮换成功，新密钥ID: %s", keyID))
			printInfo("旧密钥已备份到 key_backups 目录")
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "列出所有密钥",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := map[string]interface{}{"action": "list"}
			keys := vault.ListKeys()

			if len(keys) == 0 {
				printInfo("没有找到密钥，请先使用 'secfg key generate' 生成")
				return nil
			}

			fmt.Printf("\n%-30s %-10s %-25s %-10s\n", "密钥ID", "版本", "创建时间", "状态")
			fmt.Println(strings.Repeat("-", 75))

			for _, k := range keys {
				status := "备用"
				if k.Active {
					status = "当前 ✓"
				}
				fmt.Printf("%-30s %-10d %-25s %-10s\n",
					validator.MaskSensitive(k.ID),
					k.Version,
					k.CreatedAt.Format("2006-01-02 15:04:05"),
					status)
			}
			fmt.Println()

			logOperation("key:list", params, "", true, nil)
			return nil
		},
	})

	importCmd := &cobra.Command{
		Use:   "import",
		Short: "导入密钥",
		RunE: func(cmd *cobra.Command, args []string) error {
			inputPath, _ := cmd.Flags().GetString("file")
			params := map[string]interface{}{"action": "import", "file": inputPath}

			keyID, err := vault.ImportKey(inputPath)
			if err != nil {
				logOperation("key:import", params, inputPath, false, err)
				return err
			}

			logOperation("key:import", params, inputPath, true, nil)
			printSuccess(fmt.Sprintf("密钥导入成功，ID: %s", keyID))
			return nil
		},
	}
	importCmd.Flags().StringP("file", "f", "", "密钥文件路径")
	importCmd.MarkFlagRequired("file")
	cmd.AddCommand(importCmd)

	exportCmd := &cobra.Command{
		Use:   "export",
		Short: "导出密钥",
		RunE: func(cmd *cobra.Command, args []string) error {
			keyID, _ := cmd.Flags().GetString("key-id")
			outputPath, _ := cmd.Flags().GetString("output")
			params := map[string]interface{}{"action": "export", "key_id": keyID, "output": outputPath}

			if keyID == "" {
				keyID = vault.GetCurrentKeyID()
			}

			if !confirmAction("导出的密钥包含敏感信息，请确保存储安全，是否继续？") {
				return nil
			}

			if err := vault.ExportKey(keyID, outputPath); err != nil {
				logOperation("key:export", params, outputPath, false, err)
				return err
			}

			logOperation("key:export", params, outputPath, true, nil)
			printSuccess(fmt.Sprintf("密钥已导出到: %s", outputPath))
			return nil
		},
	}
	exportCmd.Flags().String("key-id", "", "要导出的密钥ID (默认为当前密钥)")
	exportCmd.Flags().StringP("output", "o", "exported_key.b64", "导出文件路径")
	cmd.AddCommand(exportCmd)

	return cmd
}

func newEncryptCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "encrypt [environment]",
		Short: "加密配置文件",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, cancel := encryptContext()
			defer cancel()
			_ = ctx
			defer checkMemoryUsage()
			defer reportMemoryIfVerbose()

			env := ""
			if len(args) > 0 {
				env = args[0]
				if err := validator.ValidateEnvironment(env); err != nil {
					return err
				}
			}

			filePath, _ := cmd.Flags().GetString("file")
			dirPath, _ := cmd.Flags().GetString("dir")
			recursive, _ := cmd.Flags().GetBool("recursive")
			doBackup, _ := cmd.Flags().GetBool("backup")
			format, _ := cmd.Flags().GetString("format")

			if isInteractive() && filePath == "" && dirPath == "" {
				choice, _ := promptSelect("加密模式", []string{"按文件加密", "按目录加密"}, "按文件加密")
				if choice == "按文件加密" {
					if v, err := promptInput("请输入配置文件路径", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("路径不能为空")
						}
						return nil
					}); err == nil {
						filePath = v
					}
				} else {
					if v, err := promptInput("请输入配置目录路径", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("路径不能为空")
						}
						return nil
					}); err == nil {
						dirPath = v
					}
				}
			}

			params := map[string]interface{}{
				"env":       env,
				"file":      filePath,
				"dir":       dirPath,
				"recursive": recursive,
				"backup":    doBackup,
				"format":    format,
			}

			var files []string
			var err *errors.SecfgError

			if filePath != "" {
				files = []string{filePath}
			} else if dirPath != "" {
				files, err = configMgr.FindConfigFiles(dirPath, recursive)
				if err != nil {
					logOperation("encrypt", params, dirPath, false, err)
					return err
				}
			} else {
				return errors.NewWithMessage(errors.E008, "请指定文件路径 (-f) 或目录路径 (-d)", nil, false)
			}

			if len(files) == 0 {
				printInfo("没有找到需要处理的配置文件")
				return nil
			}

			if doBackup {
				printInfo("创建备份快照...")
				if _, err := backupMgr.CreateSnapshot(files, "encrypt-pre-backup"); err != nil {
					printWarning("备份创建失败: " + err.Error())
				}
			}

			successCount := 0
			totalFields := 0

			var wg sync.WaitGroup
			sem := make(chan struct{}, 5)
			var mu sync.Mutex

			for i, f := range files {
				printProgress(i, len(files), fmt.Sprintf("处理: %s", filepath.Base(f)))

				wg.Add(1)
				go func(file string) {
					defer wg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()

					cfg, err := configMgr.LoadConfig(file, format)
					if err != nil {
						mu.Lock()
						printError(fmt.Sprintf("加载 %s 失败: %s", file, err.Error()))
						mu.Unlock()
						return
					}

					count, err := configMgr.EncryptConfig(cfg)
					if err != nil {
						mu.Lock()
						printError(fmt.Sprintf("加密 %s 失败: %s", file, err.Error()))
						mu.Unlock()
						logOperation("encrypt", params, file, false, err)
						return
					}

					if count > 0 {
						if err := configMgr.SaveConfig(cfg, ""); err != nil {
							mu.Lock()
							printError(fmt.Sprintf("保存 %s 失败: %s", file, err.Error()))
							mu.Unlock()
							logOperation("encrypt", params, file, false, err)
							return
						}
					}

					mu.Lock()
					successCount++
					totalFields += count
					mu.Unlock()
					logOperation("encrypt", params, file, true, nil)
				}(f)
			}

			wg.Wait()
			printProgress(len(files), len(files), "完成")

			printSuccess(fmt.Sprintf("加密完成: %d/%d 文件成功, %d 个敏感字段已加密",
				successCount, len(files), totalFields))

			return nil
		},
		Example: `  secfg encrypt -f config.yaml
  secfg encrypt prod -f config/prod/app.yaml
  secfg encrypt -d /configs -r --backup
  secfg encrypt -f config.json --format json`,
	}

	cmd.Flags().StringP("file", "f", "", "配置文件路径")
	cmd.Flags().StringP("dir", "d", "", "配置目录路径")
	cmd.Flags().BoolP("recursive", "r", false, "递归处理子目录")
	cmd.Flags().Bool("backup", false, "加密前创建备份")
	cmd.Flags().String("format", "", "指定文件格式: yaml|json|properties (自动检测)")

	return cmd
}

func newDecryptCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "decrypt [environment]",
		Short: "解密配置文件",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, cancel := decryptContext()
			defer cancel()
			_ = ctx
			defer checkMemoryUsage()
			defer reportMemoryIfVerbose()

			env := ""
			if len(args) > 0 {
				env = args[0]
				if err := validator.ValidateEnvironment(env); err != nil {
					return err
				}
			}

			filePath, _ := cmd.Flags().GetString("file")
			dirPath, _ := cmd.Flags().GetString("dir")
			recursive, _ := cmd.Flags().GetBool("recursive")
			format, _ := cmd.Flags().GetString("format")
			outputPath, _ := cmd.Flags().GetString("output")

			if isInteractive() && filePath == "" && dirPath == "" {
				choice, _ := promptSelect("解密模式", []string{"按文件解密", "按目录解密"}, "按文件解密")
				if choice == "按文件解密" {
					if v, err := promptInput("请输入配置文件路径", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("路径不能为空")
						}
						return nil
					}); err == nil {
						filePath = v
					}
				} else {
					if v, err := promptInput("请输入配置目录路径", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("路径不能为空")
						}
						return nil
					}); err == nil {
						dirPath = v
					}
				}
			}

			if isInteractive() && outputPath == "" {
				if v, err := promptInput("输出文件路径 (留空则覆盖原文件)", "", nil); err == nil {
					outputPath = v
				}
			}

			params := map[string]interface{}{
				"env":       env,
				"file":      filePath,
				"dir":       dirPath,
				"recursive": recursive,
				"format":    format,
				"output":    outputPath,
			}

			var files []string
			var err *errors.SecfgError

			if filePath != "" {
				files = []string{filePath}
			} else if dirPath != "" {
				files, err = configMgr.FindConfigFiles(dirPath, recursive)
				if err != nil {
					logOperation("decrypt", params, dirPath, false, err)
					return err
				}
			} else {
				return errors.NewWithMessage(errors.E008, "请指定文件路径 (-f) 或目录路径 (-d)", nil, false)
			}

			if len(files) == 0 {
				printInfo("没有找到需要处理的配置文件")
				return nil
			}

			successCount := 0
			totalFields := 0

			var wg sync.WaitGroup
			sem := make(chan struct{}, 5)
			var mu sync.Mutex

			for i, f := range files {
				printProgress(i, len(files), fmt.Sprintf("处理: %s", filepath.Base(f)))

				wg.Add(1)
				go func(file string) {
					defer wg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()

					cfg, err := configMgr.LoadConfig(file, format)
					if err != nil {
						mu.Lock()
						printError(fmt.Sprintf("加载 %s 失败: %s", file, err.Error()))
						mu.Unlock()
						return
					}

					count, err := configMgr.DecryptConfig(cfg)
					if err != nil {
						mu.Lock()
						printError(fmt.Sprintf("解密 %s 失败: %s", file, err.Error()))
						mu.Unlock()
						logOperation("decrypt", params, file, false, err)
						return
					}

					savePath := ""
					if outputPath != "" && len(files) == 1 {
						savePath = outputPath
					}

					if count > 0 || outputPath != "" {
						if err := configMgr.SaveConfig(cfg, savePath); err != nil {
							mu.Lock()
							printError(fmt.Sprintf("保存 %s 失败: %s", file, err.Error()))
							mu.Unlock()
							logOperation("decrypt", params, file, false, err)
							return
						}
					}

					mu.Lock()
					successCount++
					totalFields += count
					mu.Unlock()
					logOperation("decrypt", params, file, true, nil)
				}(f)
			}

			wg.Wait()
			printProgress(len(files), len(files), "完成")

			printSuccess(fmt.Sprintf("解密完成: %d/%d 文件成功, %d 个字段已解密",
				successCount, len(files), totalFields))

			return nil
		},
		Example: `  secfg decrypt -f config.yaml
  secfg decrypt prod -f config/prod/app.yaml
  secfg decrypt -d /configs -r
  secfg decrypt -f config.yaml --output decrypted.yaml`,
	}

	cmd.Flags().StringP("file", "f", "", "配置文件路径")
	cmd.Flags().StringP("dir", "d", "", "配置目录路径")
	cmd.Flags().BoolP("recursive", "r", false, "递归处理子目录")
	cmd.Flags().String("format", "", "指定文件格式: yaml|json|properties (自动检测)")
	cmd.Flags().String("output", "", "输出文件路径 (仅单文件时有效)")

	return cmd
}

func newSyncCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "sync [source] [target]",
		Short: "跨环境配置同步",
		Args:  cobra.RangeArgs(0, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			promptForMissingParams(cmd, map[string]string{
				"dir": "配置根目录路径 (包含各环境子目录)",
			})

			sourceEnv := ""
			targetEnv := ""
			if len(args) >= 2 {
				sourceEnv = args[0]
				targetEnv = args[1]
			}

			if sourceEnv == "" {
				if v, err := promptSelect("请选择源环境", []string{"dev", "test", "staging", "prod"}, "dev"); err == nil {
					sourceEnv = v
				}
			}
			if targetEnv == "" {
				if v, err := promptSelect("请选择目标环境", []string{"dev", "test", "staging", "prod"}, "staging"); err == nil {
					targetEnv = v
				}
			}

			if sourceEnv == "" || targetEnv == "" {
				return fmt.Errorf("必须指定源环境和目标环境")
			}

			ctx, cancel := syncContext()
			defer cancel()
			_ = ctx
			defer checkMemoryUsage()
			defer reportMemoryIfVerbose()

			if err := validator.ValidateEnvironment(sourceEnv); err != nil {
				return err
			}
			if err := validator.ValidateEnvironment(targetEnv); err != nil {
				return err
			}

			dirPath, _ := cmd.Flags().GetString("dir")
			apply, _ := cmd.Flags().GetBool("apply")
			doBackup, _ := cmd.Flags().GetBool("backup")

			if dirPath == "" {
				return fmt.Errorf("必须使用 -d/--dir 指定配置根目录")
			}

			params := map[string]interface{}{
				"source": sourceEnv,
				"target": targetEnv,
				"dir":    dirPath,
				"apply":  apply,
				"backup": doBackup,
			}

			if err := validator.ValidateDirectoryPath(dirPath); err != nil {
				logOperation("sync", params, dirPath, false, err)
				return err
			}

			sourceDir := filepath.Join(dirPath, sourceEnv)
			targetDir := filepath.Join(dirPath, targetEnv)

			if err := validator.ValidateDirectoryPath(sourceDir); err != nil {
				logOperation("sync", params, sourceDir, false, err)
				return err
			}

			if _, err := os.Stat(targetDir); os.IsNotExist(err) {
				if err := os.MkdirAll(targetDir, 0755); err != nil {
					return errors.New(errors.E015, err, false)
				}
			}

			sourceFiles, err := configMgr.FindConfigFiles(sourceDir, true)
			if err != nil {
				logOperation("sync", params, sourceDir, false, err)
				return err
			}

			printInfo(fmt.Sprintf("在源环境 %s 中找到 %d 个配置文件", sourceEnv, len(sourceFiles)))

			var allDiffs []*config.DiffReport
			var targetFiles []string
			var matchedSourceFiles []string

			mappingStr, _ := cmd.Flags().GetString("mapping")
			mappings := parseFieldMappings(mappingStr)

			for _, sf := range sourceFiles {
				relPath, _ := filepath.Rel(sourceDir, sf)
				tf := filepath.Join(targetDir, relPath)

				if _, err := os.Stat(tf); os.IsNotExist(err) {
					targetFiles = append(targetFiles, tf)
					matchedSourceFiles = append(matchedSourceFiles, sf)
					diff := &config.DiffReport{
						SourceEnv: sourceEnv,
						TargetEnv: targetEnv,
					}
					allDiffs = append(allDiffs, diff)
					continue
				}

				targetFiles = append(targetFiles, tf)

				sourceCfg, err := configMgr.LoadConfig(sf, "")
				if err != nil {
					printWarning(fmt.Sprintf("跳过 %s: %s", sf, err.Error()))
					targetFiles = targetFiles[:len(targetFiles)-1]
					continue
				}

				targetCfg, err := configMgr.LoadConfig(tf, "")
				if err != nil {
					printWarning(fmt.Sprintf("跳过 %s: %s", tf, err.Error()))
					targetFiles = targetFiles[:len(targetFiles)-1]
					continue
				}

				matchedSourceFiles = append(matchedSourceFiles, sf)
				diff := configMgr.CompareConfigs(sourceCfg, targetCfg, mappings)
				allDiffs = append(allDiffs, diff)
			}

			totalChanges := 0
			for _, d := range allDiffs {
				totalChanges += d.TotalChanges
			}

			if totalChanges == 0 {
				printSuccess("源环境与目标环境配置完全一致，无需同步")
				logOperation("sync", params, dirPath, true, nil)
				return nil
			}

			fmt.Println()
			printInfo("差异报告:")
			fmt.Println(strings.Repeat("-", 60))

			fileNum := 0
			for i, diff := range allDiffs {
				if diff.TotalChanges == 0 {
					continue
				}
				fileNum++

				fmt.Printf("\n文件 %d:\n", fileNum)
				fmt.Printf("  源:   %s\n", matchedSourceFiles[i])
				fmt.Printf("  目标: %s\n", targetFiles[i])
				if len(diff.AddedItems) > 0 {
					fmt.Printf("  新增字段 (%d):\n", len(diff.AddedItems))
					for _, item := range diff.AddedItems {
						fmt.Printf("    + %s = %v\n", item.Path, formatValue(item.NewValue))
					}
				}
				if len(diff.ModifiedItems) > 0 {
					fmt.Printf("  修改字段 (%d):\n", len(diff.ModifiedItems))
					for _, item := range diff.ModifiedItems {
						fmt.Printf("    ~ %s: %v -> %v\n", item.Path, formatValue(item.OldValue), formatValue(item.NewValue))
					}
				}
				if len(diff.RemovedItems) > 0 {
					fmt.Printf("  删除字段 (%d):\n", len(diff.RemovedItems))
					for _, item := range diff.RemovedItems {
						fmt.Printf("    - %s = %v\n", item.Path, formatValue(item.OldValue))
					}
				}
			}

			fmt.Println()
			printInfo(fmt.Sprintf("总计: %d 处变更", totalChanges))

			if !apply {
				printWarning("使用 --apply 选项确认并执行同步")
				logOperation("sync:preview", params, dirPath, true, nil)
				return nil
			}

			if !confirmAction(fmt.Sprintf("确认将 %d 处变更从 %s 同步到 %s？", totalChanges, sourceEnv, targetEnv)) {
				return nil
			}

			if doBackup {
				printInfo("创建目标环境备份...")
				if _, err := backupMgr.CreateSnapshot(targetFiles, fmt.Sprintf("sync-%s-to-%s-pre", sourceEnv, targetEnv)); err != nil {
					printWarning("备份创建失败: " + err.Error())
				}
			}

			successCount := 0
			for i, diff := range allDiffs {
				if diff.TotalChanges == 0 {
					successCount++
					continue
				}

				tf := targetFiles[i]
				sf := matchedSourceFiles[i]

				sourceCfg, err := configMgr.LoadConfig(sf, "")
				if err != nil {
					printError(fmt.Sprintf("同步失败 %s: %s", tf, err.Error()))
					continue
				}

				if _, err := os.Stat(tf); os.IsNotExist(err) {
					if err := configMgr.SaveConfig(sourceCfg, tf); err != nil {
						printError(fmt.Sprintf("创建失败 %s: %s", tf, err.Error()))
						continue
					}
				} else {
					targetCfg, err := configMgr.LoadConfig(tf, "")
					if err != nil {
						printError(fmt.Sprintf("同步失败 %s: %s", tf, err.Error()))
						continue
					}

					if err := configMgr.ApplyDiff(targetCfg, diff); err != nil {
						printError(fmt.Sprintf("应用差异失败 %s: %s", tf, err.Error()))
						continue
					}

					if err := configMgr.SaveConfig(targetCfg, ""); err != nil {
						printError(fmt.Sprintf("保存失败 %s: %s", tf, err.Error()))
						continue
					}
				}

				successCount++
				logOperation("sync:apply", params, tf, true, nil)
			}

			printSuccess(fmt.Sprintf("同步完成: %d/%d 文件成功", successCount, len(allDiffs)))
			return nil
		},
		Example: `  secfg sync dev prod --dir /configs
  secfg sync test staging --dir /configs --apply
  secfg sync dev prod --dir /configs --apply --backup`,
	}

	cmd.Flags().StringP("dir", "d", "", "配置根目录路径 (包含各环境子目录)")
	cmd.Flags().Bool("apply", false, "确认并执行同步")
	cmd.Flags().Bool("backup", false, "同步前创建目标环境备份")
	cmd.Flags().String("mapping", "", "字段映射规则,格式: sourcePath:targetPath:transform,多个用逗号分隔. 例: database.host:db.host:toUpper,port:db_port")

	return cmd
}

func parseFieldMappings(mappingStr string) []config.FieldMapping {
	if mappingStr == "" {
		return nil
	}

	var mappings []config.FieldMapping
	parts := strings.Split(mappingStr, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		segments := strings.Split(part, ":")
		if len(segments) < 2 {
			continue
		}

		fm := config.FieldMapping{
			SourcePath: strings.TrimSpace(segments[0]),
			TargetPath: strings.TrimSpace(segments[1]),
		}

		if len(segments) >= 3 {
			fm.Transform = strings.TrimSpace(segments[2])
		}

		mappings = append(mappings, fm)
	}

	return mappings
}

func formatValue(v interface{}) string {
	if str, ok := v.(string); ok {
		if len(str) > 50 {
			return str[:47] + "..."
		}
		return fmt.Sprintf("%q", str)
	}
	return fmt.Sprintf("%v", v)
}

func newBackupCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "backup",
		Short: "配置备份管理",
		Long:  "创建、恢复、列出和删除配置备份快照",
	}

	createCmd := &cobra.Command{
		Use:   "create",
		Short: "创建配置备份快照",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, cancel := backupContext()
			defer cancel()
			_ = ctx
			defer checkMemoryUsage()
			defer reportMemoryIfVerbose()

			filePath, _ := cmd.Flags().GetString("file")
			dirPath, _ := cmd.Flags().GetString("dir")
			recursive, _ := cmd.Flags().GetBool("recursive")
			comment, _ := cmd.Flags().GetString("comment")

			if isInteractive() && filePath == "" && dirPath == "" {
				choice, _ := promptSelect("备份模式", []string{"按文件备份", "按目录备份"}, "按文件备份")
				if choice == "按文件备份" {
					if v, err := promptInput("请输入配置文件路径", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("路径不能为空")
						}
						return nil
					}); err == nil {
						filePath = v
					}
				} else {
					if v, err := promptInput("请输入配置目录路径", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("路径不能为空")
						}
						return nil
					}); err == nil {
						dirPath = v
					}
				}
			}

			if isInteractive() && comment == "" {
				if v, err := promptInput("备份备注 (可留空)", "", nil); err == nil {
					comment = v
				}
			}

			params := map[string]interface{}{
				"file":      filePath,
				"dir":       dirPath,
				"recursive": recursive,
				"comment":   comment,
			}

			var files []string
			var err *errors.SecfgError

			if filePath != "" {
				files = []string{filePath}
			} else if dirPath != "" {
				files, err = configMgr.FindConfigFiles(dirPath, recursive)
				if err != nil {
					logOperation("backup:create", params, dirPath, false, err)
					return err
				}
			} else {
				return errors.NewWithMessage(errors.E008, "请指定文件路径 (-f) 或目录路径 (-d)", nil, false)
			}

			if len(files) == 0 {
				printInfo("没有找到需要备份的配置文件")
				return nil
			}

			snapshot, err := backupMgr.CreateSnapshot(files, comment)
			if err != nil {
				logOperation("backup:create", params, dirPath, false, err)
				return err
			}

			logOperation("backup:create", params, dirPath, true, nil)
			printSuccess(fmt.Sprintf("备份创建成功"))
			fmt.Printf("  ID: %s\n", snapshot.ID)
			fmt.Printf("  版本: v%d\n", snapshot.Version)
			fmt.Printf("  文件数: %d\n", len(snapshot.Files))
			fmt.Printf("  大小: %.2f KB\n", float64(snapshot.Size)/1024)
			fmt.Printf("  备注: %s\n", snapshot.Comment)

			return nil
		},
	}
	createCmd.Flags().StringP("file", "f", "", "配置文件路径")
	createCmd.Flags().StringP("dir", "d", "", "配置目录路径")
	createCmd.Flags().BoolP("recursive", "r", false, "递归处理子目录")
	createCmd.Flags().StringP("comment", "c", "", "备份备注")
	cmd.AddCommand(createCmd)

	restoreCmd := &cobra.Command{
		Use:   "restore",
		Short: "恢复配置备份",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, cancel := backupContext()
			defer cancel()
			_ = ctx
			defer checkMemoryUsage()
			defer reportMemoryIfVerbose()

			backupID, _ := cmd.Flags().GetString("id")
			timeStr, _ := cmd.Flags().GetString("time")
			targetDir, _ := cmd.Flags().GetString("target-dir")

			if isInteractive() && backupID == "" && timeStr == "" {
				choice, _ := promptSelect("恢复方式", []string{"按备份ID恢复", "按时间点恢复"}, "按备份ID恢复")
				if choice == "按备份ID恢复" {
					if v, err := promptInput("请输入备份ID", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("备份ID不能为空")
						}
						return nil
					}); err == nil {
						backupID = v
					}
				} else {
					if v, err := promptInput("请输入恢复时间点 (YYYY-MM-DD HH:MM:SS)", "", func(s string) error {
						if s == "" {
							return fmt.Errorf("时间点不能为空")
						}
						return nil
					}); err == nil {
						timeStr = v
					}
				}
			}

			if isInteractive() && targetDir == "" {
				if v, err := promptInput("恢复目标目录 (留空恢复原路径)", "", nil); err == nil {
					targetDir = v
				}
			}

			params := map[string]interface{}{
				"backup_id":  backupID,
				"time":       timeStr,
				"target_dir": targetDir,
			}

			var snapshot *backup.BackupSnapshot
			var err *errors.SecfgError

			if backupID != "" {
				snapshot, err = backupMgr.GetSnapshot(backupID)
			} else if timeStr != "" {
				targetTime, parseErr := time.Parse("2006-01-02 15:04:05", timeStr)
				if parseErr != nil {
					return errors.NewWithMessage(errors.E008,
						"时间格式错误，请使用 'YYYY-MM-DD HH:MM:SS' 格式", parseErr, false)
				}
				snapshot, err = backupMgr.FindSnapshotByTime(targetTime)
			} else {
				return errors.NewWithMessage(errors.E008, "请指定备份ID (--id) 或时间点 (--time)", nil, false)
			}

			if err != nil {
				logOperation("backup:restore", params, "", false, err)
				return err
			}

			printInfo(fmt.Sprintf("找到备份: %s (v%d, %s)",
				snapshot.ID, snapshot.Version, snapshot.Timestamp.Format("2006-01-02 15:04:05")))
			printInfo(fmt.Sprintf("包含 %d 个文件，%.2f KB", len(snapshot.Files), float64(snapshot.Size)/1024))

			if !confirmAction("确认恢复此备份？这将覆盖现有文件") {
				return nil
			}

			restored, err := backupMgr.RestoreSnapshot(snapshot.ID, targetDir)
			if err != nil {
				logOperation("backup:restore", params, targetDir, false, err)
				return err
			}

			logOperation("backup:restore", params, targetDir, true, nil)
			printSuccess(fmt.Sprintf("恢复完成，共恢复 %d 个文件", len(restored.Files)))

			return nil
		},
	}
	restoreCmd.Flags().String("id", "", "备份ID")
	restoreCmd.Flags().String("time", "", "按时间点恢复 (格式: 'YYYY-MM-DD HH:MM:SS')")
	restoreCmd.Flags().String("target-dir", "", "恢复到指定目录 (默认恢复到原路径)")
	cmd.AddCommand(restoreCmd)

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "列出所有备份",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := map[string]interface{}{"action": "list"}
			backups, err := backupMgr.ListBackups()
			if err != nil {
				logOperation("backup:list", params, "", false, err)
				return err
			}

			if len(backups) == 0 {
				printInfo("没有找到备份")
				return nil
			}

			if outputFormat == "json" {
				jsonOutput, _ := json.MarshalIndent(backups, "", "  ")
				fmt.Println(string(jsonOutput))
			} else {
				fmt.Printf("\n%-30s %-8s %-25s %-10s %-10s %-20s\n",
					"备份ID", "版本", "创建时间", "文件数", "大小", "备注")
				fmt.Println(strings.Repeat("-", 105))

				for _, b := range backups {
					sizeStr := fmt.Sprintf("%.1f KB", float64(b.Size)/1024)
					comment := b.Comment
					if len(comment) > 18 {
						comment = comment[:15] + "..."
					}
					fmt.Printf("%-30s %-8d %-25s %-10d %-10s %-20s\n",
						b.ID, b.Version,
						b.Timestamp.Format("2006-01-02 15:04:05"),
						b.FileCount, sizeStr, comment)
				}
				fmt.Println()
			}

			logOperation("backup:list", params, "", true, nil)
			return nil
		},
	})

	deleteCmd := &cobra.Command{
		Use:   "delete",
		Short: "删除指定备份",
		RunE: func(cmd *cobra.Command, args []string) error {
			backupID, _ := cmd.Flags().GetString("id")
			params := map[string]interface{}{"backup_id": backupID}

			if !confirmAction(fmt.Sprintf("确认删除备份 %s？此操作不可撤销", backupID)) {
				return nil
			}

			if err := backupMgr.DeleteSnapshot(backupID); err != nil {
				logOperation("backup:delete", params, "", false, err)
				return err
			}

			logOperation("backup:delete", params, "", true, nil)
			printSuccess(fmt.Sprintf("备份 %s 已删除", backupID))
			return nil
		},
	}
	deleteCmd.Flags().String("id", "", "要删除的备份ID")
	deleteCmd.MarkFlagRequired("id")
	cmd.AddCommand(deleteCmd)

	return cmd
}

func newAuditCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "audit",
		Short: "审计日志查询",
		Long:  "查询操作审计日志，支持按时间范围、命令类型、文件路径筛选",
	}

	queryCmd := &cobra.Command{
		Use:   "query",
		Short: "查询审计日志",
		RunE: func(cmd *cobra.Command, args []string) error {
			startTimeStr, _ := cmd.Flags().GetString("start-time")
			endTimeStr, _ := cmd.Flags().GetString("end-time")
			command, _ := cmd.Flags().GetString("command")
			filePath, _ := cmd.Flags().GetString("file-path")
			successOnly, _ := cmd.Flags().GetBool("success-only")
			failureOnly, _ := cmd.Flags().GetBool("failure-only")
			limit, _ := cmd.Flags().GetInt("limit")

			params := map[string]interface{}{
				"start_time":   startTimeStr,
				"end_time":     endTimeStr,
				"command":      command,
				"file_path":    filePath,
				"success_only": successOnly,
				"failure_only": failureOnly,
				"limit":        limit,
			}

			filter := audit.QueryFilter{
				MaxResults: limit,
			}

			if startTimeStr != "" {
				t, err := time.Parse("2006-01-02 15:04:05", startTimeStr)
				if err != nil {
					return errors.NewWithMessage(errors.E008,
						"开始时间格式错误，请使用 'YYYY-MM-DD HH:MM:SS' 格式", err, false)
				}
				filter.StartTime = t
			}

			if endTimeStr != "" {
				t, err := time.Parse("2006-01-02 15:04:05", endTimeStr)
				if err != nil {
					return errors.NewWithMessage(errors.E008,
						"结束时间格式错误，请使用 'YYYY-MM-DD HH:MM:SS' 格式", err, false)
				}
				filter.EndTime = t
			}

			if command != "" {
				filter.Command = command
			}

			if filePath != "" {
				filter.FilePath = filePath
			}

			if successOnly {
				b := true
				filter.Success = &b
			} else if failureOnly {
				b := false
				filter.Success = &b
			}

			logs, err := auditLogger.Query(filter)
			if err != nil {
				logOperation("audit:query", params, "", false, err)
				return err
			}

			if outputFormat == "json" {
				jsonOutput, err := audit.FormatLogsAsJSON(logs)
				if err != nil {
					return err
				}
				fmt.Println(jsonOutput)
			} else {
				fmt.Println(audit.FormatLogsAsTable(logs))
			}

			logOperation("audit:query", params, "", true, nil)
			return nil
		},
		Example: `  secfg audit query --command encrypt
  secfg audit query --start-time "2024-01-01 00:00:00"
  secfg audit query --file-path config.yaml --failure-only
  secfg audit query --limit 50 -o json`,
	}

	queryCmd.Flags().String("start-time", "", "开始时间 (格式: 'YYYY-MM-DD HH:MM:SS')")
	queryCmd.Flags().String("end-time", "", "结束时间 (格式: 'YYYY-MM-DD HH:MM:SS')")
	queryCmd.Flags().String("command", "", "按命令类型筛选 (如: encrypt, decrypt, sync)")
	queryCmd.Flags().String("file-path", "", "按文件路径筛选")
	queryCmd.Flags().Bool("success-only", false, "只显示成功操作")
	queryCmd.Flags().Bool("failure-only", false, "只显示失败操作")
	queryCmd.Flags().IntP("limit", "n", 100, "最大返回结果数")

	cmd.AddCommand(queryCmd)

	return cmd
}

func newCompletionCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "completion [bash|zsh|fish|powershell]",
		Short: "生成命令补全脚本",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			shell := args[0]
			switch shell {
			case "bash":
				rootCmd.GenBashCompletion(os.Stdout)
			case "zsh":
				rootCmd.GenZshCompletion(os.Stdout)
			case "fish":
				rootCmd.GenFishCompletion(os.Stdout, true)
			case "powershell":
				rootCmd.GenPowerShellCompletion(os.Stdout)
			default:
				printError("不支持的 shell 类型，请使用: bash, zsh, fish, powershell")
			}
		},
	}
	return cmd
}

func isInteractive() bool {
	fileInfo, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return (fileInfo.Mode() & os.ModeCharDevice) != 0
}

func promptInput(label, defaultValue string, validate func(string) error) (string, error) {
	if !isInteractive() {
		return defaultValue, nil
	}

	reader := bufio.NewReader(os.Stdin)

	if defaultValue != "" {
		fmt.Printf("%s%s [默认: %s]: %s", colorCyan, label, defaultValue, colorReset)
	} else {
		fmt.Printf("%s%s: %s", colorCyan, label, colorReset)
	}

	response, err := reader.ReadString('\n')
	if err != nil {
		return defaultValue, err
	}
	response = strings.TrimSpace(response)
	if response == "" {
		response = defaultValue
	}

	if validate != nil {
		if verr := validate(response); verr != nil {
			printError(verr.Error())
			return promptInput(label, defaultValue, validate)
		}
	}

	return response, nil
}

func promptSelect(label string, items []string, defaultItem string) (string, error) {
	if !isInteractive() {
		if defaultItem != "" {
			return defaultItem, nil
		}
		return "", fmt.Errorf("非交互模式且无默认值")
	}

	fmt.Printf("%s%s:%s\n", colorCyan, label, colorReset)
	for i, item := range items {
		marker := " "
		if item == defaultItem {
			marker = "*"
		}
		fmt.Printf("  %s %d) %s\n", marker, i+1, item)
	}

	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("%s请选择编号 [1-%d]: %s", colorCyan, len(items), colorReset)

	response, err := reader.ReadString('\n')
	if err != nil {
		return defaultItem, err
	}
	response = strings.TrimSpace(response)

	if response == "" {
		if defaultItem != "" {
			return defaultItem, nil
		}
	}

	if idx, err := strconv.Atoi(response); err == nil {
		if idx >= 1 && idx <= len(items) {
			return items[idx-1], nil
		}
	}

	for _, item := range items {
		if strings.EqualFold(item, response) {
			return item, nil
		}
	}

	printError("无效选择，请重试")
	return promptSelect(label, items, defaultItem)
}

func promptForMissingParams(cmd *cobra.Command, requiredFlags map[string]string) {
	requiredList := make([]string, 0, len(requiredFlags))
	for name := range requiredFlags {
		requiredList = append(requiredList, name)
	}
	sort.Strings(requiredList)

	for _, flagName := range requiredList {
		flag := cmd.Flags().Lookup(flagName)
		if flag == nil {
			continue
		}
		if flag.Changed {
			continue
		}
		if flag.DefValue != "" && flag.DefValue != "false" {
			continue
		}

		helpText := requiredFlags[flagName]

		if strings.Contains(helpText, "|") {
			opts := strings.Split(helpText, "|")
			selected, perr := promptSelect(flag.Usage, opts, "")
			if perr == nil && selected != "" {
				cmd.Flags().Set(flagName, selected)
			}
		} else {
			defaultVal := ""
			if strings.HasPrefix(helpText, "default:") {
				defaultVal = strings.TrimPrefix(helpText, "default:")
				helpText = flag.Usage
			}
			val, ierr := promptInput(helpText, defaultVal, nil)
			if ierr == nil && val != "" {
				cmd.Flags().Set(flagName, val)
			}
		}
	}
}

func operationContext() (context.Context, context.CancelFunc) {
	timeoutSec := viper.GetInt("operation_timeout_seconds")
	if timeoutSec <= 0 {
		timeoutSec = 30
	}
	return context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
}

func encryptContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 5*time.Second)
}

func decryptContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 5*time.Second)
}

func backupContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 10*time.Second)
}

func syncContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 15*time.Second)
}

func checkMemoryUsage() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	allocMB := m.Alloc / (1024 * 1024)

	memoryMu.Lock()
	threshold := memoryThresholdMB
	memoryMu.Unlock()

	if allocMB >= threshold {
		memoryAlertCount++
		if verbose || memoryAlertCount%5 == 1 {
			printWarning(fmt.Sprintf(
				"内存告警: 当前使用 %d MB, 阈值 %d MB (已触发 %d 次)",
				allocMB, threshold, memoryAlertCount))
		}
		if allocMB >= threshold*2 {
			debug.FreeOSMemory()
		}
	}
}

func getMemoryStats() map[string]interface{} {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	stats := map[string]interface{}{
		"alloc_mb":          m.Alloc / (1024 * 1024),
		"total_alloc_mb":    m.TotalAlloc / (1024 * 1024),
		"sys_mb":            m.Sys / (1024 * 1024),
		"heap_alloc_mb":     m.HeapAlloc / (1024 * 1024),
		"heap_inuse_mb":     m.HeapInuse / (1024 * 1024),
		"goroutines":        runtime.NumGoroutine(),
		"alert_threshold_mb": memoryThresholdMB,
		"alert_count":       memoryAlertCount,
	}
	return stats
}

func reportMemoryIfVerbose() {
	if !verbose {
		return
	}
	stats := getMemoryStats()
	printInfo(fmt.Sprintf(
		"内存: %v MB / 阈值 %v MB, 协程: %v, 堆: %v MB",
		stats["alloc_mb"], stats["alert_threshold_mb"], stats["goroutines"], stats["heap_inuse_mb"]))
}

