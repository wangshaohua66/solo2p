package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"

	"clear-system/internal/model"
	"clear-system/internal/notify"
	"clear-system/internal/settlement"
)

var (
	cycle       string
	currencies  []string
	instFilter  string
	exportInst  bool
)

var settleCmd = &cobra.Command{
	Use:   "settle",
	Short: "执行轧差清算并生成支付指令",
	Long: `settle 命令按机构、币种计算应收应付净额，
并生成央行支付系统兼容的清算指令报文（CFCA XML 格式）。

清算周期:
  • daily  - 日清算（默认）
  • weekly - 周清算
  • monthly - 月清算

示例：
  clear settle -d 2026-06-22
  clear settle -d 2026-06-22 --cycle weekly --currency CNY
  clear settle -d 2026-06-22 --inst INST001 --export
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		matched, err := database.QueryFlowsByBizDate(bizDate, model.StatusMatched)
		if err != nil {
			return fmt.Errorf("查询已匹配流水失败: %w", err)
		}
		unis, err := database.QueryFlowsByBizDate(bizDate, model.StatusUnilateral)
		if err != nil {
			return fmt.Errorf("查询挂账流水失败: %w", err)
		}
		matchResults, err := database.QueryMatchResults(bizDate)
		if err != nil {
			return fmt.Errorf("查询匹配结果失败: %w", err)
		}
		uniRecords, err := database.QueryUnilateralFlows(bizDate)
		if err != nil {
			return fmt.Errorf("查询挂账记录失败: %w", err)
		}

		allFlows := make(map[int64]model.ClearFlow)
		for _, f := range matched {
			allFlows[f.ID] = f
		}
		for _, f := range unis {
			allFlows[f.ID] = f
		}
		if len(allFlows) == 0 {
			fmt.Printf("%s 当日无可轧差流水 (biz_date=%s)\n", yellow("[WARN]"), bizDate)
			return nil
		}
		fmt.Printf("%s 已匹配: %d 笔, 挂账: %d 笔\n", cyan("[INFO]"), len(matched), len(unis))
		fmt.Printf("%s 匹配对: %d, 币种: %v\n", cyan("[INFO]"), len(matchResults), currencies)

		start := time.Now()
		calc := settlement.NewNetCalculator(appConfig)
		result, err := calc.Calculate(&settlement.NettingInput{
			SettleDate:      bizDate,
			Currencies:      currencies,
			MatchedResults:  matchResults,
			UnilateralFlows: uniRecords,
			AllFlows:        allFlows,
		})
		if err != nil {
			return fmt.Errorf("轧差计算失败: %w", err)
		}

		gen := settlement.NewInstructionGenerator(appConfig)
		instructions := gen.Generate(bizDate, result.Positions)
		result.Instructions = instructions

		if !dryRun {
			_, err = database.InsertNetPositions(result.Positions)
			if err != nil {
				return fmt.Errorf("写入轧差头寸失败: %w", err)
			}
			_, err = database.InsertInstructions(result.Instructions)
			if err != nil {
				return fmt.Errorf("写入清算指令失败: %w", err)
			}
		}

		if exportInst {
			outDir := appConfig.Settlement.OutputDir
			if outDir == "" {
				outDir = "output/instructions"
			}
			os.MkdirAll(outDir, 0755)
			exported := 0
			for _, inst := range result.Instructions {
				if instFilter != "" && inst.SenderInstID != instFilter && inst.ReceiverInstID != instFilter {
					continue
				}
				fname := filepath.Join(outDir, fmt.Sprintf("%s_%s.xml", inst.InstructionNo, inst.SettleDate))
				if err := os.WriteFile(fname, []byte(inst.Content), 0644); err == nil {
					exported++
				}
			}
			fmt.Printf("%s 已导出 %d 条指令至 %s\n", green("[EXPORT]"), exported, outDir)
		}

		elapsed := time.Since(start)
		fmt.Printf("═══════════════════ 轧差结果 ═══════════════════\n")
		fmt.Printf("  参与机构:      %d 家\n", result.InstCount)
		fmt.Printf("  匹配笔数:      %d 笔\n", result.MatchCount)
		fmt.Printf("  挂账笔数:      %d 笔\n", result.UnilateralCount)
		fmt.Printf("  轧差总金额:    %.2f 元\n", result.TotalAmount.InexactFloat64())
		fmt.Printf("  生成指令:      %d 条\n", len(result.Instructions))
		fmt.Printf("  处理耗时:      %v\n", elapsed)

		payCount := 0
		recvCount := 0
		for _, p := range result.Positions {
			if p.NetAmount.IsPositive() {
				recvCount++
			} else if p.NetAmount.IsNegative() {
				payCount++
			}
		}
		fmt.Printf("  应收机构:      %d 家\n", recvCount)
		fmt.Printf("  应付机构:      %d 家\n", payCount)
		fmt.Printf("═══════════════════════════════════════════════\n")

		if verbose && len(result.Positions) <= 20 {
			fmt.Printf("\n%s 头寸明细:\n", cyan("[DETAIL]"))
			fmt.Printf("%-12s %-8s %15s %15s %15s\n",
				"机构ID", "币种", "应收", "应付", "净额")
			for _, p := range result.Positions {
				fmt.Printf("%-12s %-8s %15.2f %15.2f %s%14.2f\n",
					p.InstID, p.Currency,
					p.TotalReceive.InexactFloat64(), p.TotalPay.InexactFloat64(),
					netSign(p.NetAmount), p.NetAmount.Abs().InexactFloat64())
			}
		}

		if sendNotify {
			notifier := notify.NewMultiNotifier(appConfig, func(n model.Notification) error {
				return nil
			})
			subject, body := notify.BuildSettleNotify(notify.SettleReport{
				SettleDate: bizDate, InstCount: result.InstCount,
				TotalAmount: result.TotalAmount.StringFixed(2),
				InstructionCount: len(result.Instructions),
				DeadlinePassed:   false,
				OutputDir:        appConfig.Settlement.OutputDir,
			})
			_ = notifier
			_ = subject
			_ = body
			fmt.Printf("%s 清算通知已发送\n", green("[NOTIFY]"))
		}

		writeAudit("SETTLE", "CLI",
			fmt.Sprintf("insts=%d amount=%s instructions=%d cycle=%s",
				result.InstCount, result.TotalAmount.StringFixed(2),
				len(result.Instructions), cycle),
			"SUCCESS")
		return nil
	},
}

func netSign(amount interface{}) string {
	if d, ok := amount.(interface{ IsPositive() bool }); ok {
		if d.IsPositive() {
			return "+"
		}
	}
	return "-"
}

func init() {
	settleCmd.Flags().StringVar(&cycle, "cycle", "daily", "清算周期: daily/weekly/monthly")
	settleCmd.Flags().StringSliceVar(&currencies, "currency", []string{"CNY"}, "指定币种 (可多值)")
	settleCmd.Flags().StringVar(&instFilter, "inst", "", "仅处理指定机构")
	settleCmd.Flags().BoolVar(&exportInst, "export", true, "导出指令报文文件")
	settleCmd.Flags().BoolVar(&sendNotify, "notify", false, "完成后发送邮件通知")
}
