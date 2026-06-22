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

var berthCmd = &cobra.Command{
	Use:   "berth",
	Short: "靠泊申请与泊位窗口管理",
	Long: `管理船舶靠泊申请，包括靠泊申请提交、泊位分配、列表查询等功能。

示例：
  td berth add --name "中远之星" --imo 9700001 --length 300 --teu 5000 \
    --eta "2025-01-15 08:00" --etd "2025-01-16 20:00" --loading 2000 --unloading 1500
  td berth list
  td berth list --status pending
  td berth assign 1 --berth 2`,
}

var (
	addVesselName  string
	addIMO         string
	addLength      float64
	addTEU         int
	addETA         string
	addETD         string
	addLoading     int
	addUnloading   int
	addShippingCo  string
	addContactEmail string
	addContactPhone string
	addNotes       string
)

var berthAddCmd = &cobra.Command{
	Use:   "add",
	Short: "提交靠泊申请",
	Long: `提交船舶靠泊申请，系统将自动计算最优泊位分配方案。

必需参数：
  --name      船名
  --imo       IMO编号
  --length    船长(米)
  --teu       载箱量(TEU)
  --eta       预计到港时间
  --etd       预计离港时间

示例：
  td berth add --name "中远之星" --imo 9700001 --length 300 --teu 5000 \
    --eta "2025-01-15 08:00" --etd "2025-01-16 20:00" --loading 2000 --unloading 1500`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if addVesselName == "" {
			return fmt.Errorf("船名不能为空")
		}
		if addIMO == "" {
			return fmt.Errorf("IMO号不能为空")
		}
		if addLength <= 0 {
			return fmt.Errorf("船长必须大于0")
		}
		if addTEU <= 0 {
			return fmt.Errorf("载箱量必须大于0")
		}
		if addETA == "" || addETD == "" {
			return fmt.Errorf("ETA和ETD不能为空")
		}

		eta, err := time.ParseInLocation("2006-01-02 15:04", addETA, time.Local)
		if err != nil {
			return fmt.Errorf("ETA格式错误，应为 YYYY-MM-DD HH:MM: %w", err)
		}
		etd, err := time.ParseInLocation("2006-01-02 15:04", addETD, time.Local)
		if err != nil {
			return fmt.Errorf("ETD格式错误，应为 YYYY-MM-DD HH:MM: %w", err)
		}
		if !etd.After(eta) {
			return fmt.Errorf("ETD必须晚于ETA")
		}

		app := &db.BerthApplication{
			VesselName:   addVesselName,
			VesselIMO:    addIMO,
			VesselLength: addLength,
			CarriedTEU:   addTEU,
			ETA:          eta,
			ETD:          etd,
			LoadingTEU:   addLoading,
			UnloadingTEU: addUnloading,
			ShippingCompany: addShippingCo,
			ContactEmail: addContactEmail,
			ContactPhone: addContactPhone,
			Notes:        addNotes,
		}

		if err := Dispatcher.CreateBerthApplication(context.Background(), app); err != nil {
			return fmt.Errorf("提交申请失败: %w", err)
		}

		assignment, err := Dispatcher.AllocateBerth(context.Background(), app)
		if err != nil {
			color.Yellow("申请已提交(ID: %d)，但自动分配失败: %v", app.ID, err)
			if len(assignment.Conflicts) > 0 {
				fmt.Println("冲突原因:")
				for _, c := range assignment.Conflicts {
					fmt.Printf("  - %s\n", c)
				}
			}
			return nil
		}

		if err := Dispatcher.UpdateBerthAssignment(context.Background(), app.ID, assignment.BerthID); err != nil {
			color.Yellow("分配方案计算成功，但更新数据库失败: %v", err)
		}

		color.Green("靠泊申请提交成功！")
		fmt.Printf("申请ID: %d\n", app.ID)
		fmt.Printf("船舶: %s (IMO: %s)\n", addVesselName, addIMO)
		fmt.Printf("分配泊位: %s\n", assignment.BerthName)
		fmt.Printf("到港时间: %s\n", eta.Format("2006-01-02 15:04"))
		fmt.Printf("离港时间: %s\n", etd.Format("2006-01-02 15:04"))
		fmt.Printf("装卸箱量: 装 %d / 卸 %d\n", addLoading, addUnloading)

		return nil
	},
}

var (
	listStatus string
)

var berthListCmd = &cobra.Command{
	Use:   "list",
	Short: "查询靠泊申请列表",
	Long: `查询靠泊申请列表，支持按状态筛选。

状态选项：pending, assigned, completed, cancelled

示例：
  td berth list
  td berth list --status pending`,
	RunE: func(cmd *cobra.Command, args []string) error {
		apps, err := Dispatcher.ListBerthApplications(context.Background(), listStatus)
		if err != nil {
			return fmt.Errorf("查询失败: %w", err)
		}

		if len(apps) == 0 {
			color.Yellow("暂无靠泊申请记录")
			return nil
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"ID", "船名", "IMO", "状态", "泊位", "ETA", "ETD", "装卸量"})
		table.SetBorder(true)

		for _, a := range apps {
			status := a.Status
			statusColor := color.WhiteString
			switch a.Status {
			case "pending":
				statusColor = color.YellowString
			case "assigned":
				statusColor = color.GreenString
			case "completed":
				statusColor = color.BlueString
			case "cancelled":
				statusColor = color.RedString
			}
			status = statusColor(status)

			berthName := "-"
			if a.AssignedBerth != nil {
				berthName = fmt.Sprintf("%d号", *a.AssignedBerth)
			}

			teuStr := fmt.Sprintf("装%d/卸%d", a.LoadingTEU, a.UnloadingTEU)

			table.Append([]string{
				strconv.Itoa(a.ID),
				a.VesselName,
				a.VesselIMO,
				status,
				berthName,
				a.ETA.Format("01-02 15:04"),
				a.ETD.Format("01-02 15:04"),
				teuStr,
			})
		}

		table.Render()
		color.Cyan("共 %d 条记录", len(apps))
		return nil
	},
}

var (
	assignBerthID int
)

var berthAssignCmd = &cobra.Command{
	Use:   "assign [申请ID]",
	Short: "手动分配泊位",
	Long: `手动为靠泊申请分配泊位，覆盖自动分配结果。

示例：
  td berth assign 5 --berth 2`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		appID, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("申请ID格式错误: %w", err)
		}
		if assignBerthID <= 0 {
			return fmt.Errorf("请指定泊位ID (--berth)")
		}

		if err := Dispatcher.UpdateBerthAssignment(context.Background(), appID, assignBerthID); err != nil {
			return fmt.Errorf("分配泊位失败: %w", err)
		}

		color.Green("泊位分配成功！")
		fmt.Printf("申请ID: %d -> 泊位: %d号\n", appID, assignBerthID)
		return nil
	},
}

var berthBerthsCmd = &cobra.Command{
	Use:   "berths",
	Short: "查看泊位列表",
	Long: `查看所有泊位信息，包括长度、岸桥数量、状态等。

示例：
  td berth berths`,
	RunE: func(cmd *cobra.Command, args []string) error {
		berths, err := db.ListBerths(context.Background())
		if err != nil {
			return fmt.Errorf("查询泊位失败: %w", err)
		}

		table := tablewriter.NewWriter(cmd.OutOrStdout())
		table.SetHeader([]string{"ID", "名称", "长度(m)", "岸桥数", "状态", "潮汐窗口"})
		table.SetBorder(true)

		for _, b := range berths {
			status := b.Status
			switch b.Status {
			case "available":
				status = color.GreenString(status)
			case "occupied":
				status = color.YellowString(status)
			case "maintenance":
				status = color.RedString(status)
			}

			table.Append([]string{
				strconv.Itoa(b.ID),
				b.Name,
				fmt.Sprintf("%.0f", b.Length),
				strconv.Itoa(b.QuayCranes),
				status,
				b.TidalWindow,
			})
		}

		table.Render()
		return nil
	},
}

func init() {
	berthAddCmd.Flags().StringVar(&addVesselName, "name", "", "船名 (必需)")
	berthAddCmd.Flags().StringVar(&addIMO, "imo", "", "IMO编号 (必需)")
	berthAddCmd.Flags().Float64Var(&addLength, "length", 0, "船长，单位米 (必需)")
	berthAddCmd.Flags().IntVar(&addTEU, "teu", 0, "载箱量，单位TEU (必需)")
	berthAddCmd.Flags().StringVar(&addETA, "eta", "", "预计到港时间 YYYY-MM-DD HH:MM (必需)")
	berthAddCmd.Flags().StringVar(&addETD, "etd", "", "预计离港时间 YYYY-MM-DD HH:MM (必需)")
	berthAddCmd.Flags().IntVar(&addLoading, "loading", 0, "装船箱量")
	berthAddCmd.Flags().IntVar(&addUnloading, "unloading", 0, "卸船箱量")
	berthAddCmd.Flags().StringVar(&addShippingCo, "company", "", "船公司名称")
	berthAddCmd.Flags().StringVar(&addContactEmail, "email", "", "联系邮箱")
	berthAddCmd.Flags().StringVar(&addContactPhone, "phone", "", "联系电话")
	berthAddCmd.Flags().StringVar(&addNotes, "notes", "", "备注")

	berthListCmd.Flags().StringVar(&listStatus, "status", "", "按状态筛选: pending/assigned/completed/cancelled")

	berthAssignCmd.Flags().IntVar(&assignBerthID, "berth", 0, "泊位ID (必需)")

	berthCmd.AddCommand(berthAddCmd)
	berthCmd.AddCommand(berthListCmd)
	berthCmd.AddCommand(berthAssignCmd)
	berthCmd.AddCommand(berthBerthsCmd)
}
