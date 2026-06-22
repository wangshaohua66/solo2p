package cmd

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

var statsCmd = &cobra.Command{
	Use:   "stats",
	Short: "运营统计报表",
	Long: `生成运营指标统计报表，包括：
  - 泊位利用率
  - 堆场周转率
  - 集卡效率
  - 平均滞箱时间

支持按日、周、月维度输出，支持JSON和CSV格式。

示例：
  td stats
  td stats --period week
  td stats --format json
  td stats --format csv --output stats.csv`,
}

var (
	statsPeriod string
	statsFormat string
	statsOutput string
)

type StatsReport struct {
	Period           string  `json:"period"`
	GenerateTime     string  `json:"generate_time"`
	BerthUtilization float64 `json:"berth_utilization"`
	YardTurnover     float64 `json:"yard_turnover"`
	AvgDwellDays     float64 `json:"avg_dwell_days"`
	AvgTruckTrips    float64 `json:"avg_truck_trips"`
	AvgTruckKM       float64 `json:"avg_truck_km"`
	TruckIdleRate    float64 `json:"truck_idle_rate"`
	AnnualTEU        int     `json:"annual_teu"`
	AnnualTEUTarget  int     `json:"annual_teu_target"`
}

var statsRunCmd = &cobra.Command{
	Use:   "show",
	Short: "显示运营统计报表",
	Long: `显示当前运营统计报表。

示例：
  td stats show
  td stats show --period month`,
	RunE: func(cmd *cobra.Command, args []string) error {
		stats, err := Dispatcher.GetStats(context.Background(), statsPeriod)
		if err != nil {
			return fmt.Errorf("获取统计数据失败: %w", err)
		}

		report := StatsReport{
			Period:           statsPeriod,
			GenerateTime:     time.Now().Format("2006-01-02 15:04:05"),
			BerthUtilization: stats.BerthUtilization,
			YardTurnover:     stats.YardTurnover,
			AvgDwellDays:     stats.AvgDwellDays,
			AvgTruckTrips:    stats.AvgTruckTrips,
			AvgTruckKM:       stats.AvgTruckKM,
			TruckIdleRate:    35.0,
			AnnualTEU:        1250000,
			AnnualTEUTarget:  1500000,
		}

		switch statsFormat {
		case "json":
			return outputJSON(report)
		case "csv":
			return outputCSV(report)
		default:
			printStatsTable(report)
			return nil
		}
	},
}

func printStatsTable(r StatsReport) {
	periodName := map[string]string{
		"day":   "日",
		"week":  "周",
		"month": "月",
	}[r.Period]
	if periodName == "" {
		periodName = r.Period
	}

	color.Cyan("========================================")
	color.Cyan("  码头运营统计报表 (%s报)", periodName)
	color.Cyan("  生成时间: %s", r.GenerateTime)
	color.Cyan("========================================")
	fmt.Println()

	fmt.Println("【泊位利用率】")
	berthUtil := fmt.Sprintf("%.1f%%", r.BerthUtilization)
	if r.BerthUtilization >= 70 {
		fmt.Printf("  当前: %s %s\n", color.GreenString(berthUtil), color.GreenString("优秀"))
	} else if r.BerthUtilization >= 50 {
		fmt.Printf("  当前: %s %s\n", color.YellowString(berthUtil), color.YellowString("良好"))
	} else {
		fmt.Printf("  当前: %s %s\n", color.RedString(berthUtil), color.RedString("偏低"))
	}
	printProgressBar(r.BerthUtilization, 100, 30)
	fmt.Println()

	fmt.Println("【堆场周转率】")
	turnover := fmt.Sprintf("%.2f 次/周期", r.YardTurnover)
	fmt.Printf("  当前: %s\n", color.CyanString(turnover))
	fmt.Println()

	fmt.Println("【平均滞箱时间】")
	dwell := fmt.Sprintf("%.1f 天", r.AvgDwellDays)
	if r.AvgDwellDays <= 4 {
		fmt.Printf("  当前: %s %s\n", color.GreenString(dwell), color.GreenString("优秀"))
	} else if r.AvgDwellDays <= 6 {
		fmt.Printf("  当前: %s %s\n", color.YellowString(dwell), color.YellowString("达标"))
	} else {
		fmt.Printf("  当前: %s %s\n", color.RedString(dwell), color.RedString("偏高"))
	}
	printProgressBar(100.0-r.AvgDwellDays*10, 100, 30)
	fmt.Println()

	fmt.Println("【集卡效率】")
	fmt.Printf("  平均趟次: %.1f 趟/车\n", r.AvgTruckTrips)
	fmt.Printf("  平均里程: %.1f km/车\n", r.AvgTruckKM)
	idleStr := fmt.Sprintf("%.1f%%", r.TruckIdleRate)
	if r.TruckIdleRate <= 20 {
		fmt.Printf("  空驶率: %s %s\n", color.GreenString(idleStr), color.GreenString("优秀"))
	} else if r.TruckIdleRate <= 35 {
		fmt.Printf("  空驶率: %s %s\n", color.YellowString(idleStr), color.YellowString("一般"))
	} else {
		fmt.Printf("  空驶率: %s %s\n", color.RedString(idleStr), color.RedString("偏高"))
	}
	fmt.Println()

	fmt.Println("【年吞吐量】")
	progress := float64(r.AnnualTEU) / float64(r.AnnualTEUTarget) * 100
	fmt.Printf("  当前: %d TEU / 目标: %d TEU (%.1f%%)\n",
		r.AnnualTEU, r.AnnualTEUTarget, progress)
	printProgressBar(progress, 100, 30)
	fmt.Println()
}

func printProgressBar(value, max float64, width int) {
	filled := int(value / max * float64(width))
	if filled > width {
		filled = width
	}
	bar := ""
	for i := 0; i < width; i++ {
		if i < filled {
			bar += "█"
		} else {
			bar += "░"
		}
	}
	fmt.Printf("  [%s] %.1f%%\n", color.GreenString(bar), value)
}

func outputJSON(r StatsReport) error {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return fmt.Errorf("生成JSON失败: %w", err)
	}

	if statsOutput != "" {
		if err := os.WriteFile(statsOutput, data, 0644); err != nil {
			return fmt.Errorf("写入文件失败: %w", err)
		}
		color.Green("JSON报表已保存到: %s", statsOutput)
		return nil
	}

	fmt.Println(string(data))
	return nil
}

func outputCSV(r StatsReport) error {
	records := [][]string{
		{"指标", "值"},
		{"统计周期", r.Period},
		{"生成时间", r.GenerateTime},
		{"泊位利用率(%)", fmt.Sprintf("%.2f", r.BerthUtilization)},
		{"堆场周转率", fmt.Sprintf("%.2f", r.YardTurnover)},
		{"平均滞箱天数", fmt.Sprintf("%.2f", r.AvgDwellDays)},
		{"平均集卡趟次", fmt.Sprintf("%.2f", r.AvgTruckTrips)},
		{"平均集卡里程(km)", fmt.Sprintf("%.2f", r.AvgTruckKM)},
		{"集卡空驶率(%)", fmt.Sprintf("%.2f", r.TruckIdleRate)},
		{"年吞吐量(TEU)", fmt.Sprintf("%d", r.AnnualTEU)},
		{"年吞吐量目标(TEU)", fmt.Sprintf("%d", r.AnnualTEUTarget)},
	}

	if statsOutput != "" {
		f, err := os.Create(statsOutput)
		if err != nil {
			return fmt.Errorf("创建文件失败: %w", err)
		}
		defer f.Close()

		w := csv.NewWriter(f)
		if err := w.WriteAll(records); err != nil {
			return fmt.Errorf("写入CSV失败: %w", err)
		}
		w.Flush()

		color.Green("CSV报表已保存到: %s", statsOutput)
		return nil
	}

	w := csv.NewWriter(os.Stdout)
	w.WriteAll(records)
	w.Flush()
	return nil
}

var statsExportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出统计报表",
	Long: `导出统计报表到文件，支持JSON和CSV格式。

示例：
  td stats export --format json --output stats.json
  td stats export --format csv --output stats.csv`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if statsOutput == "" {
			return fmt.Errorf("请指定输出文件路径 (--output)")
		}

		stats, err := Dispatcher.GetStats(context.Background(), statsPeriod)
		if err != nil {
			return fmt.Errorf("获取统计数据失败: %w", err)
		}

		report := StatsReport{
			Period:           statsPeriod,
			GenerateTime:     time.Now().Format("2006-01-02 15:04:05"),
			BerthUtilization: stats.BerthUtilization,
			YardTurnover:     stats.YardTurnover,
			AvgDwellDays:     stats.AvgDwellDays,
			AvgTruckTrips:    stats.AvgTruckTrips,
			AvgTruckKM:       stats.AvgTruckKM,
			TruckIdleRate:    35.0,
			AnnualTEU:        1250000,
			AnnualTEUTarget:  1500000,
		}

		switch statsFormat {
		case "json":
			return outputJSON(report)
		case "csv":
			return outputCSV(report)
		default:
			return fmt.Errorf("不支持的格式: %s，支持 json/csv", statsFormat)
		}
	},
}

func init() {
	statsRunCmd.Flags().StringVar(&statsPeriod, "period", "week", "统计周期: day/week/month")
	statsRunCmd.Flags().StringVar(&statsFormat, "format", "table", "输出格式: table/json/csv")
	statsRunCmd.Flags().StringVar(&statsOutput, "output", "", "输出文件路径")

	statsExportCmd.Flags().StringVar(&statsPeriod, "period", "week", "统计周期: day/week/month")
	statsExportCmd.Flags().StringVar(&statsFormat, "format", "json", "输出格式: json/csv")
	statsExportCmd.Flags().StringVar(&statsOutput, "output", "", "输出文件路径")

	statsCmd.AddCommand(statsRunCmd)
	statsCmd.AddCommand(statsExportCmd)
}
