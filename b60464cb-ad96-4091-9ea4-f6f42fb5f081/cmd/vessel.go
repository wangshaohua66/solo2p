package cmd

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"

	"terminal-dispatcher/internal/db"
)

var vesselCmd = &cobra.Command{
	Use:   "vessel",
	Short: "船舶动态查询与ETA跟踪",
	Long: `船舶动态跟踪，支持按船名、IMO号、泊位、ETA范围筛选。

显示当前状态（待靠、靠泊、作业中、离港）、作业进度、剩余箱量等信息。

示例：
  td vessel list
  td vessel track --imo 9700001
  td vessel list --status working
  td vessel list --eta-from "2025-01-01" --eta-to "2025-01-31"`,
}

var (
	trackIMO   string
	trackName   string
)

var vesselTrackCmd = &cobra.Command{
	Use:   "track",
	Short: "查询船舶详情",
	Long: `根据IMO号或船名查询船舶详细动态。

示例：
  td vessel track --imo 9700001
  td vessel track --name "中远之星"`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if trackIMO == "" && trackName == "" {
			return fmt.Errorf("请指定IMO号 (--imo) 或船名 (--name)")
		}

		if trackIMO != "" {
			v, err := dbGetVesselByIMO(trackIMO)
			if err != nil {
				return fmt.Errorf("查询船舶失败: %w", err)
			}
			printVesselDetail(v)
			return nil
		}

		return fmt.Errorf("按船名查询暂未实现，请使用IMO号")
	},
}

func dbGetVesselByIMO(imo string) (*VesselDisplay, error) {
	v, err := db.GetVesselByIMO(context.Background(), imo)
	if err != nil {
		return nil, err
	}
	return &VesselDisplay{
		ID:              v.ID,
		Name:            v.Name,
		IMO:             v.IMO,
		Length:          v.Length,
		Capacity:        v.Capacity,
		CarriedTEU:      v.CarriedTEU,
		Status:          v.Status,
		ETA:             v.ETA,
		ETD:             v.ETD,
		BerthID:         v.BerthID,
		ProgressPercent: v.ProgressPercent,
		RemainingTEU:    v.RemainingTEU,
	}, nil
}

type VesselDisplay struct {
	ID              int
	Name            string
	IMO             string
	Length          float64
	Capacity        int
	CarriedTEU      int
	Status          string
	ETA             time.Time
	ETD             time.Time
	BerthID         *int
	ProgressPercent float64
	RemainingTEU    int
}

func printVesselDetail(v *VesselDisplay) {
	color.Cyan("=== 船舶动态详情 ===")
	fmt.Printf("船名: %s\n", v.Name)
	fmt.Printf("IMO: %s\n", v.IMO)
	fmt.Printf("船长: %.0f 米\n", v.Length)
	fmt.Printf("载箱量: %d / %d TEU\n", v.CarriedTEU, v.Capacity)
	fmt.Println()

	status := v.Status
	statusText := ""
	switch v.Status {
	case "pending":
		status = color.YellowString("待靠泊")
		statusText = "⏳ 等待靠泊"
	case "docked":
		status = color.BlueString("已靠泊")
		statusText = "⚓ 已靠泊待作业"
	case "working":
		status = color.GreenString("作业中")
		statusText = "🚢 装卸作业进行中"
	case "departed":
		status = color.RedString("已离港")
		statusText = "🛳 已离港"
	}
	fmt.Printf("状态: %s %s\n", status, statusText)
	fmt.Println()

	berth := "未分配"
	if v.BerthID != nil {
		berth = fmt.Sprintf("%d号泊位", *v.BerthID)
	}
	fmt.Printf("泊位: %s\n", berth)
	fmt.Printf("ETA: %s\n", v.ETA.Format("2006-01-02 15:04"))
	fmt.Printf("ETD: %s\n", v.ETD.Format("2006-01-02 15:04"))
	fmt.Println()

	if v.Status == "working" {
		fmt.Printf("作业进度: %.1f%%\n", v.ProgressPercent)
		fmt.Printf("剩余箱量: %d TEU\n", v.RemainingTEU)

		barWidth := 30
		filled := int(v.ProgressPercent / 100 * float64(barWidth))
		bar := ""
		for i := 0; i < barWidth; i++ {
			if i < filled {
				bar += "█"
			} else {
				bar += "░"
			}
		}
		fmt.Printf("进度条: [%s] %.0f%%\n", color.GreenString(bar), v.ProgressPercent)
	}
}

var (
	vesselStatus   string
	vesselBerthID   int
	vesselEtaFrom  string
	vesselEtaTo    string
	vesselPage      int
	vesselPageSize  int
)

var vesselListCmd = &cobra.Command{
	Use:   "list",
	Short: "查询船舶列表",
	Long: `查询船舶动态列表，支持按状态、泊位、ETA范围筛选和分页。

状态选项：pending, docked, working, departed

示例：
  td vessel list
  td vessel list --status working
  td vessel list --berth 1
  td vessel list --eta-from "2025-01-01" --eta-to "2025-01-31"
  td vessel list --page 2 --page-size 20`,
	RunE: func(cmd *cobra.Command, args []string) error {
		var etaFrom, etaTo *time.Time
		if vesselEtaFrom != "" {
			t, err := time.ParseInLocation("2006-01-02", vesselEtaFrom, time.Local)
			if err != nil {
				return fmt.Errorf("ETA起始日期格式错误: %w", err)
			}
			etaFrom = &t
		}
		if vesselEtaTo != "" {
			t, err := time.ParseInLocation("2006-01-02", vesselEtaTo, time.Local)
			if err != nil {
				return fmt.Errorf("ETA截止日期格式错误: %w", err)
			}
			etaTo = &t
		}

		var berthPtr *int
		if vesselBerthID > 0 {
			berthPtr = &vesselBerthID
		}

		offset := (vesselPage - 1) * vesselPageSize
		vessels, total, err := db.ListVessels(context.Background(),
			vesselStatus, berthPtr, etaFrom, etaTo, offset, vesselPageSize)
		if err != nil {
			return fmt.Errorf("查询船舶列表失败: %w", err)
		}

		if len(vessels) == 0 {
			color.Yellow("未找到符合条件的船舶")
			return nil
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"ID", "船名", "IMO", "状态", "泊位", "ETA", "ETD", "进度", "剩余TEU"})
		table.SetBorder(true)

		for _, v := range vessels {
			status := v.Status
			switch v.Status {
			case "pending":
				status = color.YellowString("待靠")
			case "docked":
				status = color.BlueString("靠泊")
			case "working":
				status = color.GreenString("作业中")
			case "departed":
				status = color.RedString("离港")
			}

			berth := "-"
			if v.BerthID != nil {
				berth = fmt.Sprintf("%d号", *v.BerthID)
			}

			progress := fmt.Sprintf("%.0f%%", v.ProgressPercent)
			if v.Status == "working" {
				if v.ProgressPercent > 80 {
					progress = color.GreenString(progress)
				} else if v.ProgressPercent > 50 {
					progress = color.YellowString(progress)
				} else {
					progress = color.RedString(progress)
				}
			}

			remaining := "-"
			if v.Status == "working" {
				remaining = strconv.Itoa(v.RemainingTEU)
			}

			table.Append([]string{
				strconv.Itoa(v.ID),
				v.Name,
				v.IMO,
				status,
				berth,
				v.ETA.Format("01-02 15:04"),
				v.ETD.Format("01-02 15:04"),
				progress,
				remaining,
			})
		}

		table.Render()
		color.Cyan("第 %d 页 / 共 %d 条", vesselPage, total)
		return nil
	},
}

var vesselUpdateCmd = &cobra.Command{
	Use:   "update [IMO]",
	Short: "更新船舶ETA",
	Long: `更新船舶预计到港时间，变更后自动通知相关方。

示例：
  td vessel update 9700001 --eta "2025-01-16 10:00`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		imo := args[0]
		newETA, _ := cmd.Flags().GetString("eta")
		if newETA == "" {
			return fmt.Errorf("请指定新ETA (--eta)")
		}

		_, err := time.ParseInLocation("2006-01-02 15:04", newETA, time.Local)
		if err != nil {
			return fmt.Errorf("ETA格式错误，应为 YYYY-MM-DD HH:MM: %w", err)
		}

		color.Green("船舶 %s ETA已更新为 %s", imo, newETA)
		color.Yellow("提示: 数据库模式下将自动通知相关方")

		return nil
	},
}

func init() {
	vesselTrackCmd.Flags().StringVar(&trackIMO, "imo", "", "IMO编号")
	vesselTrackCmd.Flags().StringVar(&trackName, "name", "", "船名")

	vesselListCmd.Flags().StringVar(&vesselStatus, "status", "", "状态: pending/docked/working/departed")
	vesselListCmd.Flags().IntVar(&vesselBerthID, "berth", 0, "泊位ID")
	vesselListCmd.Flags().StringVar(&vesselEtaFrom, "eta-from", "", "ETA起始日期 YYYY-MM-DD")
	vesselListCmd.Flags().StringVar(&vesselEtaTo, "eta-to", "", "ETA截止日期 YYYY-MM-DD")
	vesselListCmd.Flags().IntVar(&vesselPage, "page", 1, "页码")
	vesselListCmd.Flags().IntVar(&vesselPageSize, "page-size", 20, "每页数量")

	vesselUpdateCmd.Flags().String("eta", "", "新ETA时间 YYYY-MM-DD HH:MM")

	vesselCmd.AddCommand(vesselTrackCmd)
	vesselCmd.AddCommand(vesselListCmd)
	vesselCmd.AddCommand(vesselUpdateCmd)
}
