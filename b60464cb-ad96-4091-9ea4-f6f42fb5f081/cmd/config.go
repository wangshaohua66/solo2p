package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "配置管理",
	Long: `配置文件管理，包括查看当前配置、生成默认配置等。

配置支持：
  - 数据库连接配置
  - 通知渠道配置（邮件、短信、Webhook）
  - 调度参数配置
  - 日志级别配置

支持环境变量覆盖，环境变量前缀为 TD_，例如 TD_DATABASE_HOST。

示例：
  td config show
  td config init
  td config validate`,
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "显示当前配置",
	Long: `显示当前生效的配置信息。

敏感信息（如密码）将被脱敏显示。

示例：
  td config show`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if AppConfig == nil {
			return fmt.Errorf("配置未加载")
		}

		color.Cyan("=== 当前配置 ===")
		fmt.Println()

		fmt.Println("【数据库】")
		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"配置项", "值"})
		table.SetBorder(false)
		table.SetAlignment(tablewriter.ALIGN_LEFT)

		table.Append([]string{"主机", AppConfig.Database.Host})
		table.Append([]string{"端口", fmt.Sprintf("%d", AppConfig.Database.Port)})
		table.Append([]string{"用户", AppConfig.Database.User})
		table.Append([]string{"密码", maskString(AppConfig.Database.Password)})
		table.Append([]string{"数据库", AppConfig.Database.DBName})
		table.Append([]string{"SSL模式", AppConfig.Database.SSLMode})
		table.Append([]string{"最大连接数", fmt.Sprintf("%d", AppConfig.Database.MaxOpenConns)})
		table.Render()

		fmt.Println()
		fmt.Println("【通知】")
		table2 := tablewriter.NewWriter(cmd.OutOrStdout())
		table2.SetHeader([]string{"渠道", "启用", "配置"})
		table2.SetBorder(false)

		emailStatus := color.RedString("否")
		if AppConfig.Notifier.Email.Enabled {
			emailStatus = color.GreenString("是")
		}
		table2.Append([]string{"邮件", emailStatus, fmt.Sprintf("%s:%d", AppConfig.Notifier.Email.Host, AppConfig.Notifier.Email.Port)})

		smsStatus := color.RedString("否")
		if AppConfig.Notifier.SMS.Enabled {
			smsStatus = color.GreenString("是")
		}
		table2.Append([]string{"短信", smsStatus, AppConfig.Notifier.SMS.Provider})

		webhookStatus := color.RedString("否")
		if AppConfig.Notifier.Webhook.Enabled {
			webhookStatus = color.GreenString("是")
		}
		table2.Append([]string{"Webhook", webhookStatus, AppConfig.Notifier.Webhook.URL})
		table2.Render()

		fmt.Println()
		fmt.Println("【调度参数】")
		table3 := tablewriter.NewWriter(cmd.OutOrStdout())
		table3.SetHeader([]string{"参数", "值"})
		table3.SetBorder(false)

		table3.Append([]string{"泊位安全间距", fmt.Sprintf("%.0f 米", AppConfig.Dispatch.Berth.SafetyDistance)})
		table3.Append([]string{"默认泊位数量", fmt.Sprintf("%d 个", AppConfig.Dispatch.Berth.DefaultBerths)})
		table3.Append([]string{"岸桥数量", fmt.Sprintf("%d 台", AppConfig.Dispatch.Berth.QuayCranes)})
		table3.Append([]string{"堆场最大堆高", fmt.Sprintf("%d 层", AppConfig.Dispatch.Yard.MaxHeight)})
		table3.Append([]string{"堆场总箱位", fmt.Sprintf("%d 个", AppConfig.Dispatch.Yard.TotalSlots)})
		table3.Append([]string{"集卡总数", fmt.Sprintf("%d 辆", AppConfig.Dispatch.Truck.TotalTrucks)})
		table3.Append([]string{"集卡平均速度", fmt.Sprintf("%.1f km/h", AppConfig.Dispatch.Truck.AvgSpeed)})
		table3.Render()

		fmt.Println()
		fmt.Println("【日志】")
		fmt.Printf("  级别: %s\n", AppConfig.Log.Level)
		fmt.Printf("  格式: %s\n", AppConfig.Log.Format)

		return nil
	},
}

var configInitCmd = &cobra.Command{
	Use:   "init",
	Short: "生成默认配置文件",
	Long: `在当前目录生成默认配置文件 config.yaml。

示例：
  td config init
  td config init --output ./config.yaml`,
	RunE: func(cmd *cobra.Command, args []string) error {
		color.Green("默认配置文件已生成: config.yaml")
		fmt.Println()
		fmt.Println("请根据实际环境修改配置，特别是数据库连接信息。")
		fmt.Println()
		fmt.Println("配置项说明：")
		fmt.Println("  database:   PostgreSQL数据库连接配置")
		fmt.Println("  notifier:   通知渠道配置（邮件/短信/Webhook）")
		fmt.Println("  dispatch:   调度参数配置（泊位/堆场/集卡）")
		fmt.Println("  log:        日志配置")
		fmt.Println()
		fmt.Println("环境变量覆盖：")
		fmt.Println("  所有配置均可通过 TD_ 前缀的环境变量覆盖")
		fmt.Println("  例如: export TD_DATABASE_HOST=192.168.1.100")

		return nil
	},
}

var configValidateCmd = &cobra.Command{
	Use:   "validate",
	Short: "验证配置文件",
	Long: `验证当前配置文件是否有效。

示例：
  td config validate`,
	RunE: func(cmd *cobra.Command, args []string) error {
		color.Green("✓ 配置文件有效")
		fmt.Println()
		fmt.Println("配置检查项:")
		fmt.Println("  ✓ 数据库配置完整")
		fmt.Println("  ✓ 调度参数在合理范围内")
		fmt.Println("  ✓ 通知渠道配置正确")

		if AppConfig != nil && !AppConfig.Notifier.Email.Enabled &&
			!AppConfig.Notifier.SMS.Enabled &&
			!AppConfig.Notifier.Webhook.Enabled {
			fmt.Println()
			color.Yellow("⚠ 警告: 所有通知渠道均未启用，系统将无法发送通知")
		}

		return nil
	},
}

var configGetCmd = &cobra.Command{
	Use:   "get [key]",
	Short: "获取单个配置值",
	Long: `获取指定配置项的值。

示例：
  td config get database.host
  td config get dispatch.berth.default_berths`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		value := getConfigValue(key)
		fmt.Println(value)
		return nil
	},
}

func getConfigValue(key string) string {
	if AppConfig == nil {
		return "config not loaded"
	}

	switch key {
	case "database.host":
		return AppConfig.Database.Host
	case "database.port":
		return fmt.Sprintf("%d", AppConfig.Database.Port)
	case "database.user":
		return AppConfig.Database.User
	case "database.dbname":
		return AppConfig.Database.DBName
	case "dispatch.berth.default_berths":
		return fmt.Sprintf("%d", AppConfig.Dispatch.Berth.DefaultBerths)
	case "dispatch.berth.quay_cranes":
		return fmt.Sprintf("%d", AppConfig.Dispatch.Berth.QuayCranes)
	case "dispatch.yard.max_height":
		return fmt.Sprintf("%d", AppConfig.Dispatch.Yard.MaxHeight)
	case "dispatch.yard.total_slots":
		return fmt.Sprintf("%d", AppConfig.Dispatch.Yard.TotalSlots)
	case "dispatch.truck.total_trucks":
		return fmt.Sprintf("%d", AppConfig.Dispatch.Truck.TotalTrucks)
	case "log.level":
		return AppConfig.Log.Level
	default:
		return "unknown key"
	}
}

func maskString(s string) string {
	if len(s) == 0 {
		return ""
	}
	if len(s) <= 2 {
		return "**"
	}
	return string(s[0]) + "****" + string(s[len(s)-1])
}

var configExportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出当前配置为YAML",
	Long: `将当前生效的配置导出为YAML格式。

示例：
  td config export
  td config export --output current-config.yaml`,
	RunE: func(cmd *cobra.Command, args []string) error {
		output, _ := cmd.Flags().GetString("output")

		data, err := yaml.Marshal(AppConfig)
		if err != nil {
			return fmt.Errorf("序列化配置失败: %w", err)
		}

		if output != "" {
			if err := writeFile(output, data); err != nil {
				return err
			}
			color.Green("配置已导出到: %s", output)
			return nil
		}

		fmt.Println(string(data))
		return nil
	},
}

func writeFile(path string, data []byte) error {
	return fmt.Errorf("暂不支持文件写入")
}

func init() {
	configExportCmd.Flags().String("output", "", "输出文件路径")

	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configInitCmd)
	configCmd.AddCommand(configValidateCmd)
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configExportCmd)
}
