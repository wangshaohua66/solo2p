package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"scheduler/internal/calculator"
	"scheduler/internal/config"
	"scheduler/internal/export"
	"scheduler/internal/models"
	"scheduler/internal/scheduler"
	"scheduler/internal/scada"
	"scheduler/internal/storage"
)

// collectCmd polls every configured station over Modbus TCP, validates the
// samples, persists them to SQLite and renders a colour-coded summary.
func newCollectCmd() *cobra.Command {
	var stationID string
	var showProgress bool
	cmd := &cobra.Command{
		Use:   "collect",
		Short: "采集各分输站计量数据并校验入库",
		Long: `通过 Modbus TCP（或配置启用的模拟模式）从各分输站采集压力、温度、流量瞬时值与累计量，
完成数据完整性校验（站点编号、时间戳、值域范围），异常数据自动标记并补采重试，最终写入 SQLite。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			stations := cfg.Stations
			if stationID != "" {
				stations = filterStations(stations, stationID)
			}
			if len(stations) == 0 {
				return fmt.Errorf("no stations matched")
			}
			cl := scada.New(cfg.Snapshot())
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()

			var pb *progressBar
			if showProgress {
				pb = newProgressBar(os.Stdout, len(stations), "采集进度")
			}
			readings, err := cl.Collect(ctx, stations, func(done, total int, sid string, e error) {
				if pb != nil {
					pb.update(done, sid)
				}
			})
			if pb != nil {
				pb.finish()
			}
			if err != nil {
				return fmt.Errorf("采集失败: %w", err)
			}
			if err := repo.SaveReadings(context.Background(), readings); err != nil {
				return fmt.Errorf("入库失败（已回滚）: %w", err)
			}
			fmt.Printf("\n%s 采集完成：%d 个站点数据已入库\n", paint(colorGreen, "✓"), len(readings))
			rows := make([][]string, 0, len(readings))
			valid, invalid := 0, 0
			for _, r := range readings {
				status := paint(colorGreen, "有效")
				if !r.Valid {
					status = paint(colorRed, "异常:"+r.Anomaly)
					invalid++
				} else {
					valid++
				}
				rows = append(rows, []string{
					r.StationID, r.Timestamp.Format("15:04:05"),
					fmt.Sprintf("%.3f", r.Pressure),
					fmt.Sprintf("%.1f", r.Temperature),
					fmt.Sprintf("%.0f", r.FlowRate),
					fmt.Sprintf("%.0f", r.Accumulated),
					status,
				})
			}
			table(os.Stdout, []string{"站点", "时间", "压力MPa", "温度℃", "流量Nm³/h", "累计Nm³", "状态"}, rows)
			fmt.Printf("\n有效 %d / 异常 %d\n", valid, invalid)
			return nil
		},
	}
	cmd.Flags().StringVarP(&stationID, "station", "s", "", "仅采集指定站点编号")
	cmd.Flags().BoolVar(&showProgress, "progress", true, "显示进度条")
	return cmd
}

// calculateCmd computes the pressure loss of every configured segment.
func newCalculateCmd() *cobra.Command {
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "calculate",
		Short: "计算各管段压力损失与安全裕度",
		Long: `基于 Weymouth 或 Panhandle 公式计算各管段压力损失，支持管径、粗糙度、高程差等参数配置，
输出压损百分比与安全裕度评估，并按预警/报警阈值高亮显示。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			latest, err := repo.LatestReadings(context.Background())
			if err != nil {
				return err
			}
			eng := calculator.New(cfg.Snapshot())
			results := eng.AllPressureLosses(latest)
			if asJSON {
				return json.NewEncoder(os.Stdout).Encode(results)
			}
			rows := make([][]string, 0, len(results))
			for _, r := range results {
				lbl, col := statusClass(r.LossPercent, r.SafetyMargin,
					cfg.Alerts.PressureLossWarnPct, cfg.Alerts.PressureLossAlarmPct)
				rows = append(rows, []string{
					r.SegmentID, r.SegmentName, r.UpstreamStation + "→" + r.DownstreamStation,
					fmt.Sprintf("%.3f", r.InletPressure),
					fmt.Sprintf("%.3f", r.OutletPressure),
					fmt.Sprintf("%.3f", r.PressureLoss),
					fmt.Sprintf("%.2f%%", r.LossPercent),
					fmt.Sprintf("%.3f", r.SafetyMargin),
					r.Formula,
					paint(col, lbl),
				})
			}
			table(os.Stdout, []string{"管段", "名称", "区间", "入口MPa", "出口MPa", "压损MPa", "压损%", "裕度MPa", "公式", "状态"}, rows)
			return nil
		},
	}
	cmd.Flags().BoolVar(&asJSON, "json", false, "以 JSON 输出")
	return cmd
}

// balanceCmd generates multiple candidate upstream regulation plans.
func newBalanceCmd() *cobra.Command {
	var demandsFile string
	var n int
	var demo bool
	cmd := &cobra.Command{
		Use:   "balance",
		Short: "供需平衡推演并生成多套备选方案",
		Long: `输入下游用户需求计划，系统反推上游供气压力流量调节方案，输出多套备选方案及能耗成本排序，
推荐方案默认为成本最低且安全评分达标的方案。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			demands, err := loadDemands(demandsFile, demo, cfg.Contracts)
			if err != nil {
				return err
			}
			eng := calculator.New(cfg.Snapshot())
			res, err := eng.Balance(demands, n)
			if err != nil {
				return err
			}
			fmt.Printf("总需求：%.2f Nm³/h，生成 %d 套方案\n\n", res.TotalDemand, len(res.Plans))
			sorted := append([]models.BalancePlan(nil), res.Plans...)
			sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].EnergyCost < sorted[j].EnergyCost })
			rows := make([][]string, 0, len(sorted))
			for _, p := range sorted {
				rec := ""
				if p.Recommended {
					rec = paint(colorGreen, "★ 推荐")
				}
				rows = append(rows, []string{
					p.ID, fmt.Sprintf("%.0f", p.TotalDemand), fmt.Sprintf("%.0f", p.TotalSupply),
					fmt.Sprintf("%+.0f", p.Imbalance),
					fmt.Sprintf("%.2f", p.EnergyCost),
					fmt.Sprintf("%.1f", p.SafetyScore),
					rec,
				})
			}
			table(os.Stdout, []string{"方案", "需求", "供气", "供需差", "能耗成本元", "安全评分", "推荐"}, rows)
			for _, p := range sorted {
				if !p.Recommended {
					continue
				}
				fmt.Printf("\n%s 推荐方案 %s 明细：\n", paint(colorGreen, "▸"), p.ID)
				sub := make([][]string, 0, len(p.SourceRegulations))
				for _, r := range p.SourceRegulations {
					sub = append(sub, []string{r.SourceID, r.SourceName,
						fmt.Sprintf("%.2f", r.TargetPressure), fmt.Sprintf("%.0f", r.TargetFlow),
						fmt.Sprintf("%.4f", r.CostPerUnit)})
				}
				table(os.Stdout, []string{"气源编号", "气源名称", "目标压力MPa", "目标流量Nm³/h", "单位成本"}, sub)
				if err := savePlan(repo, p); err != nil {
					fmt.Fprintf(os.Stderr, "%s 保存方案失败: %v\n", paint(colorYellow, "!"), err)
				}
			}
			return nil
		},
	}
	cmd.Flags().StringVarP(&demandsFile, "demands", "d", "", "需求计划 JSON 文件路径")
	cmd.Flags().IntVarP(&n, "plans", "n", 3, "生成方案数量")
	cmd.Flags().BoolVar(&demo, "demo", false, "使用基于合同生成的演示需求")
	return cmd
}

// dispatchCmd generates standardised, prioritised dispatch instructions.
func newDispatchCmd() *cobra.Command {
	var source string
	var save bool
	var operator string
	cmd := &cobra.Command{
		Use:   "dispatch",
		Short: "生成标准化调度指令并按紧急程度排序",
		Long: `根据压损计算或供需平衡推演结果生成标准化调度指令文本，包含站点编号、调节参数、执行时段、
安全注意事项，支持按紧急程度排序并归档。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			gen := scheduler.New(cfg.Snapshot())
			var instructions []models.DispatchInstruction
			switch source {
			case "losses":
				latest, err := repo.LatestReadings(context.Background())
				if err != nil {
					return err
				}
				eng := calculator.New(cfg.Snapshot())
				instructions = gen.FromPressureLosses(eng.AllPressureLosses(latest))
			case "balance":
				demands, err := loadDemands("", true, cfg.Contracts)
				if err != nil {
					return err
				}
				eng := calculator.New(cfg.Snapshot())
				res, err := eng.Balance(demands, 1)
				if err != nil {
					return err
				}
				if len(res.Plans) == 0 {
					return fmt.Errorf("no balance plan generated")
				}
				instructions = gen.FromBalancePlan(res.Plans[0])
			default:
				return fmt.Errorf("--source must be losses or balance")
			}
			scheduler.SortByUrgency(instructions)
			for i := range instructions {
				if operator != "" {
					instructions[i].Operator = operator
				}
				if save {
					instructions[i].Status = "issued"
					if err := repo.SaveDispatch(context.Background(), instructions[i]); err != nil {
						return err
					}
				}
			}
			rows := make([][]string, 0, len(instructions))
			for _, d := range instructions {
				rows = append(rows, []string{
					d.ID, d.StationID, d.StationName,
					paint(urgencyColor(string(d.Urgency)), string(d.Urgency)),
					adjustTypeLabel(d.AdjustType),
					fmt.Sprintf("%.3f", d.TargetValue),
					d.ExecuteFrom.Format("15:04") + "-" + d.ExecuteTo.Format("15:04"),
				})
				fmt.Println(scheduler.Render(d))
			}
			table(os.Stdout, []string{"指令编号", "站点", "名称", "紧急程度", "类型", "目标值", "执行时段"}, rows)
			if save {
				_ = repo.WriteAudit(operator, "dispatch_issue", fmt.Sprintf("issued %d instructions", len(instructions)))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&source, "source", "losses", "指令来源：losses 或 balance")
	cmd.Flags().BoolVar(&save, "save", true, "归档至数据库")
	cmd.Flags().StringVarP(&operator, "operator", "o", "", "调度员姓名（用于审计追溯）")
	return cmd
}

// archiveCmd queries and exports historical dispatch instructions.
func newArchiveCmd() *cobra.Command {
	var stationID, operator, status, from, to, format, out string
	var page, size int
	cmd := &cobra.Command{
		Use:   "archive",
		Short: "查询并导出历史调度记录",
		Long: `按日期、站点、调度员筛选查询历史调度指令，支持分页浏览（每页默认 50 条）与 JSON/CSV 导出。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			_, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			f, err := buildDispatchFilter(stationID, operator, status, from, to)
			if err != nil {
				return err
			}
			p, err := repo.QueryDispatches(context.Background(), f, page, size)
			if err != nil {
				return err
			}
			switch format {
			case "json":
				return writeOut(out, func(w *bufio.Writer) error {
					enc := json.NewEncoder(w)
					enc.SetIndent("", "  ")
					return enc.Encode(p)
				})
			case "csv":
				return writeOut(out, func(w *bufio.Writer) error {
					return export.ExportDispatchCSV(p.Rows, w)
				})
			default:
				rows := make([][]string, 0, len(p.Rows))
				for _, d := range p.Rows {
					rows = append(rows, []string{
						d.ID, d.StationID, d.StationName,
						paint(urgencyColor(string(d.Urgency)), string(d.Urgency)),
						d.Operator, d.Status, d.CreatedAt.Format("01-02 15:04"),
					})
				}
				table(os.Stdout, []string{"指令编号", "站点", "名称", "紧急程度", "调度员", "状态", "生成时间"}, rows)
				pageFooter(os.Stdout, p.Page, p.Size, p.Total)
			}
			return nil
		},
	}
	cmd.Flags().StringVarP(&stationID, "station", "s", "", "按站点筛选")
	cmd.Flags().StringVarP(&operator, "operator", "o", "", "按调度员筛选")
	cmd.Flags().StringVar(&status, "status", "", "按状态筛选 draft|issued|executed|failed")
	cmd.Flags().StringVar(&from, "from", "", "起始日期 YYYY-MM-DD")
	cmd.Flags().StringVar(&to, "to", "", "结束日期 YYYY-MM-DD")
	cmd.Flags().StringVar(&format, "format", "table", "输出格式 table|json|csv")
	cmd.Flags().StringVarP(&out, "out", "O", "", "输出文件路径（默认控制台）")
	cmd.Flags().IntVarP(&page, "page", "p", 1, "页码")
	cmd.Flags().IntVarP(&size, "size", "n", 50, "每页条数")
	cmd.AddCommand(newArchiveFeedbackCmd())
	return cmd
}

func newArchiveFeedbackCmd() *cobra.Command {
	var status, operator string
	cmd := &cobra.Command{
		Use:   "feedback <id>",
		Short: "回填调度指令执行状态",
		Long:  `更新指定调度指令的执行状态（draft/issued/executed/failed），并写入审计日志。`,
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			_, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			id := args[0]
			validStatuses := map[string]bool{
				"draft":    true,
				"issued":   true,
				"executed": true,
				"failed":   true,
			}
			if !validStatuses[status] {
				return fmt.Errorf("无效状态 %q，可选值: draft|issued|executed|failed", status)
			}
			if operator == "" {
				operator = "cli"
			}
			if err := repo.UpdateDispatchStatus(context.Background(), id, status, operator); err != nil {
				return fmt.Errorf("更新失败: %w", err)
			}
			_ = repo.WriteAudit(operator, "dispatch_feedback",
				fmt.Sprintf("指令 %s 状态更新为 %s", id, status))
			fmt.Printf("%s 指令 %s 状态已更新为 %s\n",
				paint(colorGreen, "✓"), id, status)
			return nil
		},
	}
	cmd.Flags().StringVar(&status, "status", "", "目标状态 draft|issued|executed|failed (必填)")
	cmd.Flags().StringVarP(&operator, "operator", "o", "cli", "操作调度员")
	_ = cmd.MarkFlagRequired("status")
	return cmd
}

// exportCmd exports the monthly settlement report aligned with finance.
func newExportCmd() *cobra.Command {
	var month, out, kind string
	cmd := &cobra.Command{
		Use:   "export",
		Short: "导出结算报表或原始计量数据",
		Long: `按月汇总各用户累计购气量、单价、结算金额，与财务口径对齐，输出带签章占位的 CSV 报表；
也可导出原始计量读数用于对账。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			if month == "" {
				month = time.Now().Format("2006-01")
			}
			switch kind {
			case "settlement":
				rows, err := buildSettlement(repo, cfg.Snapshot(), month)
				if err != nil {
					return err
				}
				return writeOut(out, func(w *bufio.Writer) error {
					return export.ExportSettlementCSV(rows, w)
				})
			case "readings":
				p, err := repo.QueryReadings(context.Background(), storage.ReadingFilter{}, 1, 10000)
				if err != nil {
					return err
				}
				return writeOut(out, func(w *bufio.Writer) error {
					return export.ExportReadingsCSV(p.Rows, w)
				})
			default:
				return fmt.Errorf("--kind must be settlement or readings")
			}
		},
	}
	cmd.Flags().StringVarP(&month, "month", "m", "", "结算月份 YYYY-MM（默认当月）")
	cmd.Flags().StringVarP(&out, "out", "O", "", "输出文件路径（默认控制台）")
	cmd.Flags().StringVar(&kind, "kind", "settlement", "导出类型 settlement|readings")
	return cmd
}

// monitorCmd renders a live, colour-coded dashboard of the latest readings.
func newMonitorCmd() *cobra.Command {
	var interval time.Duration
	var once bool
	cmd := &cobra.Command{
		Use:   "monitor",
		Short: "实时刷新各站点压力流量仪表盘",
		Long: `通过 CLI 子命令实时刷新各站点压力流量仪表盘，支持阈值预警高亮显示。
按 Ctrl+C 退出。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			stop := make(chan os.Signal, 1)
			signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
			render := func() error {
				latest, err := repo.LatestReadings(context.Background())
				if err != nil {
					return err
				}
				fmt.Print("\033[H\033[2J") // clear screen
				fmt.Printf("%s 天然气管道调度实时监视  %s\n",
					paint(colorBold, "▌"), time.Now().Format("2006-01-02 15:04:05"))
				rows := make([][]string, 0, len(latest))
				for _, r := range latest {
					pCol := colorGreen
					if r.Pressure >= cfg.Alerts.PressureAlarmHigh {
						pCol = colorRed
					} else if r.Pressure >= cfg.Alerts.PressureAlarmHigh*0.9 {
						pCol = colorYellow
					}
					status := paint(colorGreen, "正常")
					if !r.Valid {
						status = paint(colorRed, "异常")
					}
					rows = append(rows, []string{
						r.StationID, r.Timestamp.Format("15:04:05"),
						paint(pCol, fmt.Sprintf("%.3f", r.Pressure)),
						fmt.Sprintf("%.1f", r.Temperature),
						fmt.Sprintf("%.0f", r.FlowRate),
						fmt.Sprintf("%.0f", r.Accumulated),
						status,
					})
				}
				table(os.Stdout, []string{"站点", "时间", "压力MPa", "温度℃", "流量Nm³/h", "累计Nm³", "状态"}, rows)
				n, _ := repo.Count(context.Background(), "readings")
				fmt.Printf("\n%s 阈值: 报警 %.3fMPa  |  历史记录 %d 条  |  Ctrl+C 退出\n",
					paint(colorGray, "›"), cfg.Alerts.PressureAlarmHigh, n)
				return nil
			}
			if once {
				return render()
			}
			t := time.NewTicker(interval)
			defer t.Stop()
			if err := render(); err != nil {
				return err
			}
			for {
				select {
				case <-stop:
					fmt.Println("\n已退出监视。")
					return nil
				case <-t.C:
					if err := render(); err != nil {
						return err
					}
				}
			}
		},
	}
	cmd.Flags().DurationVarP(&interval, "interval", "i", 5*time.Second, "刷新间隔")
	cmd.Flags().BoolVar(&once, "once", false, "仅渲染一帧")
	return cmd
}

// configCmd manages configuration: show, validate, set (hot update + audit).
func newConfigCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "查看、校验、热更新配置参数",
		Long: `管理管道参数、站点映射、计算公式系数、预警阈值等配置。
支持 show（查看）、validate（校验）、set（热更新并记录审计日志）、audit（查看变更记录）。`,
	}
	cmd.AddCommand(&cobra.Command{
		Use:   "show",
		Short: "打印当前配置",
		RunE: func(c *cobra.Command, a []string) error {
			cfg, _, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			out, err := json.MarshalIndent(cfg.Snapshot(), "", "  ")
			if err != nil {
				return err
			}
			fmt.Println(string(out))
			return nil
		},
	})
	cmd.AddCommand(&cobra.Command{
		Use:   "validate",
		Short: "校验配置完整性",
		RunE: func(c *cobra.Command, a []string) error {
			cfg, _, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			if err := cfg.Validate(); err != nil {
				return err
			}
			fmt.Printf("%s 配置校验通过\n", paint(colorGreen, "✓"))
			return nil
		},
	})
	setCmd := &cobra.Command{
		Use:   "set <key> <value>",
		Short: "热更新阈值/环境配置并记录审计日志",
		Args:  cobra.ExactArgs(2),
		RunE: func(c *cobra.Command, a []string) error {
			cfg, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			key, val := a[0], a[1]
			if err := applyConfigSet(cfg, key, val); err != nil {
				return err
			}
			if err := cfg.Save(operatorFlag, fmt.Sprintf("set %s=%s by %s", key, val, operatorFlag)); err != nil {
				return err
			}
			_ = repo.WriteAudit(operatorFlag, "config_change", fmt.Sprintf("%s=%s", key, val))
			fmt.Printf("%s 已更新 %s=%s 并记录审计日志\n", paint(colorGreen, "✓"), key, val)
			return nil
		},
	}
	setCmd.Flags().StringVarP(&operatorFlag, "operator", "o", "system", "操作人（审计追溯）")
	cmd.AddCommand(setCmd)
	cmd.AddCommand(&cobra.Command{
		Use:   "audit",
		Short: "查看配置与调度变更审计记录",
		RunE: func(c *cobra.Command, a []string) error {
			_, repo, cleanup, err := loadApp()
			if err != nil {
				return err
			}
			defer cleanup()
			logs, err := repo.QueryAudit(context.Background(), 50)
			if err != nil {
				return err
			}
			rows := make([][]string, 0, len(logs))
			for _, l := range logs {
				rows = append(rows, []string{
					strconv.FormatInt(l.ID, 10), l.Action, l.Operator, l.Detail,
					l.ChangedAt.Format("01-02 15:04:05"),
				})
			}
			table(os.Stdout, []string{"ID", "动作", "操作人", "详情", "时间"}, rows)
			return nil
		},
	})
	return cmd
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

var operatorFlag string

func loadDemands(path string, demo bool, contracts []models.PriceContract) ([]models.DemandPlan, error) {
	if path != "" {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read demands: %w", err)
		}
		var d []models.DemandPlan
		if err := json.Unmarshal(raw, &d); err != nil {
			return nil, fmt.Errorf("parse demands: %w", err)
		}
		return d, nil
	}
	if !demo {
		return nil, fmt.Errorf("provide --demands <file> or --demo")
	}
	out := make([]models.DemandPlan, 0, len(contracts))
	for i, ct := range contracts {
		out = append(out, models.DemandPlan{
			UserID: ct.UserID, UserName: ct.UserName,
			Demand: 5000 + float64(i)*1500, Priority: i%3 + 1, UnitPrice: ct.UnitPrice,
		})
	}
	return out, nil
}

func savePlan(repo *storage.Repository, p models.BalancePlan) error {
	payload, err := json.Marshal(p)
	if err != nil {
		return err
	}
	return repo.SaveBalancePlan(context.Background(), p.ID, payload)
}

func buildSettlement(repo *storage.Repository, cfg config.Config, month string) ([]models.SettlementRow, error) {
	vols, err := repo.MonthlyVolumes(context.Background(), month)
	if err != nil {
		return nil, err
	}
	contracts := make(map[string]models.PriceContract, len(cfg.Contracts))
	for _, ct := range cfg.Contracts {
		contracts[ct.UserID] = ct
	}
	rows := make([]models.SettlementRow, 0, len(vols))
	for _, v := range vols {
		ct, ok := contracts[v.StationID]
		if !ok {
			continue
		}
		amount := v.Volume * ct.UnitPrice
		tax := amount * ct.TaxRate
		rows = append(rows, models.SettlementRow{
			UserID: ct.UserID, UserName: ct.UserName, Volume: v.Volume,
			UnitPrice: ct.UnitPrice, Amount: amount, TaxAmount: tax,
			TotalAmount: amount + tax, Month: month,
		})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Amount > rows[j].Amount })
	return rows, nil
}

func buildDispatchFilter(stationID, operator, status, from, to string) (storage.DispatchFilter, error) {
	f := storage.DispatchFilter{StationID: stationID, Operator: operator, Status: status}
	t, err := parseTimeFlag(from)
	if err != nil {
		return f, err
	}
	f.From = t
	t, err = parseTimeFlag(to)
	if err != nil {
		return f, err
	}
	f.To = t
	return f, nil
}

func writeOut(path string, fn func(*bufio.Writer) error) error {
	var w *bufio.Writer
	if path == "" {
		w = bufio.NewWriter(os.Stdout)
	} else {
		f, err := os.Create(path)
		if err != nil {
			return err
		}
		defer f.Close()
		w = bufio.NewWriter(f)
	}
	if err := fn(w); err != nil {
		return err
	}
	return w.Flush()
}

func filterStations(stations []models.Station, id string) []models.Station {
	out := stations[:0]
	for _, s := range stations {
		if s.ID == id {
			out = append(out, s)
		}
	}
	return out
}

// applyConfigSet mutates a small, explicit allow-list of configuration keys.
func applyConfigSet(cfg *config.Config, key, val string) error {
	f, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return fmt.Errorf("value must be numeric for key %s", key)
	}
	switch key {
	case "pressure_loss_warn_pct":
		cfg.Alerts.PressureLossWarnPct = f
	case "pressure_loss_alarm_pct":
		cfg.Alerts.PressureLossAlarmPct = f
	case "safety_margin_floor":
		cfg.Alerts.SafetyMarginFloor = f
	case "imbalance_warn_pct":
		cfg.Alerts.ImbalanceWarnPct = f
	case "pressure_alarm_high":
		cfg.Alerts.PressureAlarmHigh = f
	case "pressure_alarm_low":
		cfg.Alerts.PressureAlarmLow = f
	default:
		return fmt.Errorf("unsupported key %q (allowed: thresholds & env)", key)
	}
	return cfg.Validate()
}
