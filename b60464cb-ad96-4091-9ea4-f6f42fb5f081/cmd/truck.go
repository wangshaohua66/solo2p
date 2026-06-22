package cmd

import (
	"context"
	"fmt"
	"strconv"

	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"

	"terminal-dispatcher/internal/db"
	"terminal-dispatcher/internal/optimizer"
)

var truckCmd = &cobra.Command{
	Use:   "truck",
	Short: "集卡调度与路径优化",
	Long: `集卡调度管理，包括车辆调度、路径规划、状态监控等功能。

支持单循环（岸边到堆场）和多循环（岸边到堆场再到岸边）路径规划。

示例：
  td truck dispatch
  td truck status
  td truck list
  td truck assign 101 --job 5001`,
}

var truckDispatchCmd = &cobra.Command{
	Use:   "dispatch",
	Short: "执行集卡调度",
	Long: `基于当前待执行作业和空闲集卡，计算最优调度方案。

算法特点：
  - 贪心策略：优先分配高优先级作业
  - 最近可用：选择距离取货点最近的空闲集卡
  - 多循环优化：在一次行程中安排多个作业减少空驶

示例：
  td truck dispatch
  td truck dispatch --max-jobs 5`,
	RunE: func(cmd *cobra.Command, args []string) error {
		plans, err := Dispatcher.DispatchTrucks(context.Background())
		if err != nil {
			return fmt.Errorf("调度计算失败: %w", err)
		}

		if len(plans) == 0 {
			color.Yellow("无待调度作业或无空闲集卡")
			return nil
		}

		color.Green("集卡调度方案计算完成")
		fmt.Println()

		totalDistance := 0.0
		totalJobs := 0

		for i, plan := range plans {
			fmt.Printf("=== 方案 %d: %s (车号: %d) ===\n", i+1, plan.TruckPlate, plan.TruckID)
			fmt.Printf("  作业数: %d\n", len(plan.Jobs))
			fmt.Printf("  总距离: %.1f km\n", plan.TotalDistance/1000)
			fmt.Printf("  预计用时: %.1f 分钟\n", plan.TotalTime*60)
			fmt.Println("  作业顺序:")
			for j, job := range plan.Jobs {
				fmt.Printf("    %d. 作业#%d [%s] %s -> %s\n",
					j+1, job.ID, job.Type, job.PickupLocation, job.DropoffLocation)
			}
			fmt.Println()

			totalDistance += plan.TotalDistance
			totalJobs += len(plan.Jobs)
		}

		color.Cyan("共调度 %d 辆车，分配 %d 个作业，总行驶距离 %.1f km",
			len(plans), totalJobs, totalDistance/1000)

		return nil
	},
}

var truckStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "集卡车队状态概览",
	Long: `查看集卡车队整体运营状态，包括空闲率、利用率等指标。

示例：
  td truck status`,
	RunE: func(cmd *cobra.Command, args []string) error {
		trucks, err := db.ListTrucks(context.Background(), "")
		if err != nil {
			return fmt.Errorf("查询集卡状态失败: %w", err)
		}

		router := optimizer.NewTruckRouter(&AppConfig.Dispatch.Truck)
		idleRate, utilization, maintRate := router.ComputeFleetMetrics(trucks)

		color.Cyan("=== 集卡车队状态 ===")
		fmt.Printf("车辆总数: %d 辆\n", len(trucks))
		fmt.Printf("空闲率: %.1f%% %s\n", idleRate, color.YellowString("(目标<20%%)"))
		fmt.Printf("利用率: %.1f%% %s\n", utilization, color.GreenString("(目标>70%%)"))
		fmt.Printf("维护率: %.1f%%\n", maintRate)

		fmt.Println()
		fmt.Println("各状态车辆数:")

		idleCount := 0
		workingCount := 0
		maintCount := 0
		totalTrips := 0
		totalKM := 0.0

		for _, t := range trucks {
			switch t.Status {
			case "idle":
				idleCount++
			case "working":
				workingCount++
			case "maintenance":
				maintCount++
			}
			totalTrips += t.DailyTrips
			totalKM += t.DailyKM
		}

		fmt.Printf("  空闲: %d 辆 %s\n", idleCount, color.GreenString("█"+repeat("█", idleCount/2)))
		fmt.Printf("  作业中: %d 辆 %s\n", workingCount, color.YellowString("█"+repeat("█", workingCount/2)))
		fmt.Printf("  维护: %d 辆 %s\n", maintCount, color.RedString("█"+repeat("█", maintCount/2)))

		fmt.Println()
		fmt.Printf("今日总趟次: %d 趟\n", totalTrips)
		fmt.Printf("今日总里程: %.1f km\n", totalKM)

		if len(trucks) > 0 {
			fmt.Printf("平均每车趟次: %.1f 趟\n", float64(totalTrips)/float64(len(trucks)))
			fmt.Printf("平均每车里程: %.1f km\n", totalKM/float64(len(trucks)))
		}

		return nil
	},
}

func repeat(s string, n int) string {
	if n <= 0 {
		return ""
	}
	result := ""
	for i := 0; i < n; i++ {
		result += s
	}
	return result
}

var (
	truckListStatus string
)

var truckListCmd = &cobra.Command{
	Use:   "list",
	Short: "查询集卡列表",
	Long: `查询集卡列表，支持按状态筛选。

状态选项：idle, working, maintenance

示例：
  td truck list
  td truck list --status idle`,
	RunE: func(cmd *cobra.Command, args []string) error {
		trucks, err := db.ListTrucks(context.Background(), truckListStatus)
		if err != nil {
			return fmt.Errorf("查询集卡列表失败: %w", err)
		}

		if len(trucks) == 0 {
			color.Yellow("未找到符合条件的集卡")
			return nil
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"ID", "车牌号", "状态", "司机", "位置", "装载", "今日趟次", "今日里程"})
		table.SetBorder(true)

		displayCount := len(trucks)
		if displayCount > 50 {
			displayCount = 50
		}

		for i := 0; i < displayCount; i++ {
			t := trucks[i]

			status := t.Status
			switch t.Status {
			case "idle":
				status = color.GreenString("空闲")
			case "working":
				status = color.YellowString("作业中")
			case "maintenance":
				status = color.RedString("维护中")
			}

			loc := fmt.Sprintf("(%.1f,%.1f)", t.LocationX, t.LocationY)

			load := "空车"
			if t.LoadStatus == "loaded" {
				load = color.BlueString("重车")
			}

			table.Append([]string{
				strconv.Itoa(t.ID),
				t.PlateNo,
				status,
				t.DriverName,
				loc,
				load,
				strconv.Itoa(t.DailyTrips),
				fmt.Sprintf("%.1f", t.DailyKM),
			})
		}

		table.Render()

		if len(trucks) > 50 {
			color.Cyan("显示前 50 辆，共 %d 辆", len(trucks))
		} else {
			color.Cyan("共 %d 辆集卡", len(trucks))
		}

		return nil
	},
}

var (
	assignJobID int
)

var truckAssignCmd = &cobra.Command{
	Use:   "assign [卡车ID]",
	Short: "手动分配作业",
	Long: `手动为指定集卡分配作业。

示例：
  td truck assign 5 --job 101`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		truckID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("卡车ID格式错误: %w", err)
		}
		if assignJobID <= 0 {
			return fmt.Errorf("请指定作业ID (--job)")
		}

		if err := Dispatcher.AssignJob(context.Background(), assignJobID, truckID); err != nil {
			return fmt.Errorf("分配作业失败: %w", err)
		}

		color.Green("作业分配成功！")
		fmt.Printf("作业 #%d -> 卡车 #%d\n", assignJobID, truckID)
		return nil
	},
}

var truckJobsCmd = &cobra.Command{
	Use:   "jobs",
	Short: "查询待作业列表",
	Long: `查看当前待执行的作业列表，按优先级排序。

示例：
  td truck jobs`,
	RunE: func(cmd *cobra.Command, args []string) error {
		jobs, err := db.ListPendingJobs(context.Background())
		if err != nil {
			return fmt.Errorf("查询作业失败: %w", err)
		}

		if len(jobs) == 0 {
			color.Green("暂无待执行作业")
			return nil
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"ID", "类型", "优先级", "箱号", "起点", "终点", "预计时间", "距离"})
		table.SetBorder(true)

		for _, j := range jobs {
			jobType := j.Type
			switch j.Type {
			case "single_cycle":
				jobType = color.CyanString("单循环")
			case "multi_cycle":
				jobType = color.BlueString("多循环")
			case "pickup":
				jobType = color.YellowString("提箱")
			case "delivery":
				jobType = color.GreenString("送箱")
			}

			priority := strconv.Itoa(j.Priority)
			if j.Priority >= 8 {
				priority = color.RedString(priority)
			} else if j.Priority >= 5 {
				priority = color.YellowString(priority)
			}

			table.Append([]string{
				strconv.Itoa(j.ID),
				jobType,
				priority,
				strconv.Itoa(j.ContainerID),
				j.PickupLocation,
				j.DropoffLocation,
				fmt.Sprintf("%.1f min", j.EstimatedTime*60),
				fmt.Sprintf("%.1f m", j.Distance),
			})
		}

		table.Render()
		color.Cyan("共 %d 个待执行作业", len(jobs))
		return nil
	},
}

func init() {
	truckListCmd.Flags().StringVar(&truckListStatus, "status", "", "按状态筛选: idle/working/maintenance")
	truckAssignCmd.Flags().IntVar(&assignJobID, "job", 0, "作业ID (必需)")

	truckCmd.AddCommand(truckDispatchCmd)
	truckCmd.AddCommand(truckStatusCmd)
	truckCmd.AddCommand(truckListCmd)
	truckCmd.AddCommand(truckAssignCmd)
	truckCmd.AddCommand(truckJobsCmd)
}
