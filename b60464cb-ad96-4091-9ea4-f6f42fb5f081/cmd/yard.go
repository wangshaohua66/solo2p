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

var yardCmd = &cobra.Command{
	Use:   "yard",
	Short: "堆场箱位优化与翻箱预警",
	Long: `堆场管理功能，包括箱位优化分配、翻箱预警、堆场状态查询等。

示例：
  td yard optimize --container CNGU1234567
  td yard warning
  td yard slots --zone A
  td yard list --status stored`,
}

var (
	optContainerNo string
	optDestination string
	optWeight      float64
	optHazardous   bool
	optHazardClass string
	optReefer      bool
	optTemp        float64
)

var yardOptimizeCmd = &cobra.Command{
	Use:   "optimize",
	Short: "计算最优落箱位",
	Long: `根据出口重箱目的港、重量等级、危险品属性、冷藏需求计算最优落箱位。

算法考虑因素：
  - 重压轻原则：重箱放低层，轻箱放高层
  - 危险品隔离：危险品与普通箱保持安全间距
  - 冷藏箱电源：冷藏箱必须放置在有电源的位置
  - 同港集中：同一目的港的箱子集中堆放
  - 翻箱风险：优先选择低层位置减少翻箱

示例：
  td yard optimize --container CNGU1234567 --destination Singapore --weight 18.5
  td yard optimize --container CNGU7654321 --reefer --temp -18 --destination Tokyo`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if optContainerNo == "" {
			return fmt.Errorf("请指定箱号 (--container)")
		}

		container := &db.Container{
			ContainerNo: optContainerNo,
			Destination: optDestination,
			Weight:      optWeight,
			IsHazardous: optHazardous,
			HazardClass: optHazardClass,
			IsReefer:    optReefer,
			TempSet:     optTemp,
			Status:      "inbound",
		}

		falseVal := false
		slots, err := db.ListYardSlots(context.Background(), "", &falseVal)
		if err != nil {
			return fmt.Errorf("查询空箱位失败: %w", err)
		}

		if len(slots) == 0 {
			color.Red("堆场已满，无可用箱位")
			return nil
		}

		yopt := optimizer.NewYardOptimizer(&AppConfig.Dispatch.Yard)
		result, err := yopt.FindOptimalSlot(container, slots)
		if err != nil {
			return fmt.Errorf("优化计算失败: %w", err)
		}

		color.Green("最优落箱位计算完成")
		fmt.Printf("箱号: %s\n", optContainerNo)
		fmt.Printf("推荐位置: %s区 第%d排 第%d列 第%d层\n",
			result.Slot.Zone, result.Slot.Bay, result.Slot.Row, result.Slot.Tier)
		fmt.Printf("评分: %.1f / 100\n", result.Score)

		fmt.Println("\n分配理由:")
		for _, r := range result.Reasons {
			fmt.Printf("  ✓ %s\n", r)
		}

		return nil
	},
}

var yardWarningCmd = &cobra.Command{
	Use:   "warning",
	Short: "翻箱预警列表",
	Long: `生成翻箱预警列表，识别被压在下方且需要优先提取的货柜。

系统检测以下翻箱风险：
  - 海关已放行的箱子被未放行的箱子压住
  - 轻箱被重箱压住（重压轻违规）
  - 预计近期提箱的箱子被压住

示例：
  td yard warning
  td yard warning --threshold 3`,
	RunE: func(cmd *cobra.Command, args []string) error {
		containers, _, err := db.ListContainers(context.Background(), "stored", 0, 0, 5000)
		if err != nil {
			return fmt.Errorf("查询集装箱失败: %w", err)
		}

		yopt := optimizer.NewYardOptimizer(&AppConfig.Dispatch.Yard)
		warnings, err := yopt.FindRestackWarnings(containers)
		if err != nil {
			return fmt.Errorf("计算翻箱预警失败: %w", err)
		}

		if len(warnings) == 0 {
			color.Green("堆场箱位良好，无翻箱风险")
			return nil
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"箱号", "被压次数", "最小翻箱次数", "上方箱子"})
		table.SetBorder(true)

		for _, w := range warnings {
			blockers := ""
			if len(w.Blockers) > 0 {
				blockers = w.Blockers[0]
				if len(w.Blockers) > 1 {
					blockers += fmt.Sprintf(" 等%d个", len(w.Blockers))
				}
			}

			level := color.YellowString
			if w.MinRestacks >= 3 {
				level = color.RedString
			}

			table.Append([]string{
				w.ContainerNo,
				level(strconv.Itoa(w.BlockedByCount)),
				level(strconv.Itoa(w.MinRestacks)),
				blockers,
			})
		}

		table.Render()

		highRisk := 0
		for _, w := range warnings {
			if w.MinRestacks >= 3 {
				highRisk++
			}
		}

		color.Yellow("共 %d 个翻箱预警，其中高风险 %d 个", len(warnings), highRisk)
		return nil
	},
}

var (
	slotsZone    string
	slotsOccupied *bool
)

var yardSlotsCmd = &cobra.Command{
	Use:   "slots",
	Short: "查询堆场箱位",
	Long: `查询堆场箱位状态，支持按区域和占用状态筛选。

示例：
  td yard slots
  td yard slots --zone A
  td yard slots --occupied false`,
	RunE: func(cmd *cobra.Command, args []string) error {
		slots, err := db.ListYardSlots(context.Background(), slotsZone, slotsOccupied)
		if err != nil {
			return fmt.Errorf("查询箱位失败: %w", err)
		}

		if len(slots) == 0 {
			color.Yellow("未找到符合条件的箱位")
			return nil
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"ID", "区域", "排", "列", "层", "电源", "状态"})
		table.SetBorder(true)

		displayCount := len(slots)
		if displayCount > 50 {
			displayCount = 50
		}

		for i := 0; i < displayCount; i++ {
			s := slots[i]
			status := "空闲"
			statusColor := color.GreenString
			if s.Occupied {
				status = "占用"
				statusColor = color.YellowString
			}

			power := "否"
			if s.HasPower {
				power = "是"
			}

			table.Append([]string{
				strconv.Itoa(s.ID),
				s.Zone,
				strconv.Itoa(s.Bay),
				strconv.Itoa(s.Row),
				strconv.Itoa(s.Tier),
				power,
				statusColor(status),
			})
		}

		table.Render()

		if len(slots) > 50 {
			color.Cyan("显示前 50 条，共 %d 条记录", len(slots))
		} else {
			color.Cyan("共 %d 条记录", len(slots))
		}

		return nil
	},
}

var (
	listContainerStatus string
	listContainerBay    int
	listPage            int
	listPageSize        int
)

var yardListCmd = &cobra.Command{
	Use:   "list",
	Short: "查询集装箱列表",
	Long: `查询堆场中的集装箱列表，支持按状态、排号筛选和分页。

状态选项：stored, inbound, outbound, picked_up

示例：
  td yard list
  td yard list --status stored
  td yard list --bay 5 --page 2 --page-size 20`,
	RunE: func(cmd *cobra.Command, args []string) error {
		offset := (listPage - 1) * listPageSize
		containers, total, err := db.ListContainers(context.Background(),
			listContainerStatus, listContainerBay, offset, listPageSize)
		if err != nil {
			return fmt.Errorf("查询集装箱失败: %w", err)
		}

		if len(containers) == 0 {
			color.Yellow("未找到符合条件的集装箱")
			return nil
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"箱号", "状态", "位置", "重量(t)", "目的港", "危险品", "冷藏", "放行"})
		table.SetBorder(true)

		for _, c := range containers {
			status := c.Status
			switch c.Status {
			case "stored":
				status = color.BlueString("堆存")
			case "inbound":
				status = color.YellowString("进港")
			case "outbound":
				status = color.GreenString("出港")
			case "picked_up":
				status = color.CyanString("已提")
			}

			loc := fmt.Sprintf("%d-%d-%d", c.Bay, c.Row, c.Tier)

			hazard := "否"
			if c.IsHazardous {
				hazard = color.RedString(c.HazardClass)
			}

			reefer := "否"
			if c.IsReefer {
				reefer = color.BlueString(fmt.Sprintf("%.1f°C", c.TempSet))
			}

			release := "未放"
			if c.CustomsRelease {
				release = color.GreenString("已放")
			}

			table.Append([]string{
				c.ContainerNo,
				status,
				loc,
				fmt.Sprintf("%.1f", c.Weight),
				c.Destination,
				hazard,
				reefer,
				release,
			})
		}

		table.Render()
		color.Cyan("第 %d 页 / 共 %d 条", listPage, total)
		return nil
	},
}

func init() {
	yardOptimizeCmd.Flags().StringVar(&optContainerNo, "container", "", "集装箱号 (必需)")
	yardOptimizeCmd.Flags().StringVar(&optDestination, "destination", "", "目的港")
	yardOptimizeCmd.Flags().Float64Var(&optWeight, "weight", 0, "箱重(吨)")
	yardOptimizeCmd.Flags().BoolVar(&optHazardous, "hazardous", false, "是否危险品")
	yardOptimizeCmd.Flags().StringVar(&optHazardClass, "hazard-class", "", "危险品等级")
	yardOptimizeCmd.Flags().BoolVar(&optReefer, "reefer", false, "是否冷藏箱")
	yardOptimizeCmd.Flags().Float64Var(&optTemp, "temp", 0, "冷藏温度(°C)")

	yardSlotsCmd.Flags().StringVar(&slotsZone, "zone", "", "按区域筛选")
	yardSlotsCmd.Flags().String("occupied", "", "占用状态 (true/false)")

	yardListCmd.Flags().StringVar(&listContainerStatus, "status", "", "状态: stored/inbound/outbound/picked_up")
	yardListCmd.Flags().IntVar(&listContainerBay, "bay", 0, "按排号筛选")
	yardListCmd.Flags().IntVar(&listPage, "page", 1, "页码")
	yardListCmd.Flags().IntVar(&listPageSize, "page-size", 20, "每页数量")

	yardCmd.AddCommand(yardOptimizeCmd)
	yardCmd.AddCommand(yardWarningCmd)
	yardCmd.AddCommand(yardSlotsCmd)
	yardCmd.AddCommand(yardListCmd)
}
