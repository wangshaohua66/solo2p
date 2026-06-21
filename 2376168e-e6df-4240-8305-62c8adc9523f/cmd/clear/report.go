package main

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"clear-system/internal/model"
	"clear-system/internal/settlement"
)

var (
	outputDir   string
	reportInst  string
	reportBiz   string
)

var reportCmd = &cobra.Command{
	Use:   "report",
	Short: "生成清算报告（Excel格式）",
	Long: `report 命令生成完整的清算报告 Excel 文件，包含 4 个工作表：

  • 对账明细表  - 所有匹配成功的流水（含得分、差额、容差使用）
  • 轧差汇总表  - 各机构应收应付净额汇总
  • 异常流水清单 - 挂账/不匹配流水明细
  • 清算指令清单 - 已生成的支付指令明细

支持按机构ID、业务类型筛选导出。

示例：
  clear report -d 2026-06-22
  clear report -d 2026-06-22 --inst INST001
  clear report -d 2026-06-22 --biz TRANSFER -o output/
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		flowsMatched, err := database.QueryFlowsByBizDate(bizDate, model.StatusMatched)
		if err != nil {
			return fmt.Errorf("查询匹配流水失败: %w", err)
		}
		flowsUni, err := database.QueryFlowsByBizDate(bizDate, model.StatusUnilateral)
		if err != nil {
			return fmt.Errorf("查询挂账流水失败: %w", err)
		}
		flowsMis, err := database.QueryFlowsByBizDate(bizDate, model.StatusMismatch)
		if err != nil {
			return fmt.Errorf("查询不匹配流水失败: %w", err)
		}
		matchResults, err := database.QueryMatchResults(bizDate)
		if err != nil {
			return fmt.Errorf("查询匹配结果失败: %w", err)
		}
		uniRecords, err := database.QueryUnilateralFlows(bizDate)
		if err != nil {
			return fmt.Errorf("查询挂账记录失败: %w", err)
		}
		positions, err := database.QueryNetPositions(bizDate)
		if err != nil {
			return fmt.Errorf("查询轧差头寸失败: %w", err)
		}
		instructions, err := database.QueryInstructions(bizDate, "")
		if err != nil {
			return fmt.Errorf("查询清算指令失败: %w", err)
		}

		allFlows := make(map[int64]model.ClearFlow)
		for _, f := range flowsMatched {
			allFlows[f.ID] = f
		}
		for _, f := range flowsUni {
			allFlows[f.ID] = f
		}
		for _, f := range flowsMis {
			allFlows[f.ID] = f
		}

		if len(allFlows) == 0 && len(matchResults) == 0 && len(positions) == 0 {
			fmt.Printf("%s 当日无数据生成报告 (biz_date=%s)\n", yellow("[WARN]"), bizDate)
			return nil
		}

		reportDir := outputDir
		if reportDir == "" {
			reportDir = appConfig.Report.OutputDir
		}
		gen := settlement.NewReportGenerator(reportDir)

		start := time.Now()
		path, err := gen.Generate(&settlement.ReportData{
			SettleDate:      bizDate,
			AllFlows:        allFlows,
			MatchedResults:  matchResults,
			UnilateralFlows: uniRecords,
			NetPositions:    positions,
			Instructions:    instructions,
			FilterInstID:    reportInst,
			FilterBizType:   reportBiz,
		})
		if err != nil {
			return fmt.Errorf("生成报告失败: %w", err)
		}
		elapsed := time.Since(start)

		fmt.Printf("%s 清算报告已生成\n", green("[SUCCESS]"))
		fmt.Printf("  业务日期:    %s\n", bizDate)
		fmt.Printf("  文件路径:    %s\n", cyan(path))
		fmt.Printf("  生成耗时:    %v\n", elapsed)
		fmt.Printf("\n工作表概览:\n")
		fmt.Printf("  1. 对账明细表     %d 条匹配记录\n", len(matchResults))
		fmt.Printf("  2. 轧差汇总表     %d 家机构头寸\n", len(positions))
		fmt.Printf("  3. 异常流水清单   %d 条挂账流水\n", len(uniRecords))
		fmt.Printf("  4. 清算指令清单   %d 条支付指令\n", len(instructions))

		writeAudit("REPORT", "CLI",
			fmt.Sprintf("file=%s matched=%d positions=%d uni=%d insts=%d filter_inst=%s filter_biz=%s",
				path, len(matchResults), len(positions), len(uniRecords), len(instructions),
				reportInst, reportBiz),
			"SUCCESS")
		return nil
	},
}

func init() {
	reportCmd.Flags().StringVarP(&outputDir, "output", "o", "", "报告输出目录 (默认: configs/report.output_dir)")
	reportCmd.Flags().StringVar(&reportInst, "inst", "", "按机构ID筛选导出")
	reportCmd.Flags().StringVar(&reportBiz, "biz", "", "按业务类型筛选导出 (TRANSFER/GUARANTEE/PAWN/LEASE)")
}
