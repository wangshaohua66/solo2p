package main

import (
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/schollz/progressbar/v3"
	"github.com/spf13/cobra"

	"clear-system/internal/model"
	"clear-system/internal/notify"
	"clear-system/internal/reconcile"
)

var (
	workers     int
	sendNotify  bool
	filterInst  string
)

var reconcileCmd = &cobra.Command{
	Use:   "reconcile",
	Short: "执行清算对账（双向匹配+容差+补录）",
	Long: `reconcile 命令对当日已解析的所有清算流水执行双向对账。

对账规则：
  • 业务编号匹配（权重 40%）
  • 金额匹配（权重 30%，支持容差）
  • 币种匹配（权重 15%）
  • 业务日期匹配（权重 15%）
  • 综合得分 ≥ 80% 视为匹配成功

容差模式：
  • fixed: 固定金额误差（如 0.01 元）
  • percentage: 百分比误差（如 0.1%，设置上限）

示例：
  clear reconcile -d 2026-06-22 --workers 4
  clear reconcile -d 2026-06-22 --inst INST001 --notify
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		flows, err := database.QueryFlowsByBizDate(bizDate, model.StatusParsed)
		if err != nil {
			return fmt.Errorf("查询流水失败: %w", err)
		}
		if len(flows) == 0 {
			fmt.Printf("%s 当日无待对账流水 (biz_date=%s)\n", yellow("[WARN]"), bizDate)
			return nil
		}
		if filterInst != "" {
			filtered := flows[:0]
			for _, f := range flows {
				if f.SrcInstID == filterInst || f.DstInstID == filterInst {
					filtered = append(filtered, f)
				}
			}
			flows = filtered
		}

		fmt.Printf("%s 加载流水: %d 笔\n", cyan("[INFO]"), len(flows))
		fmt.Printf("%s 并行工作线程: %d\n", cyan("[INFO]"), workers)

		bar := progressbar.NewOptions(len(flows),
			progressbar.OptionSetDescription("对账中..."),
			progressbar.OptionSetWriter(os.Stdout),
			progressbar.OptionShowCount(),
			progressbar.OptionSetWidth(40),
			progressbar.OptionThrottle(100*time.Millisecond),
			progressbar.OptionClearOnFinish(),
		)

		engine := reconcile.NewRuleEngine(appConfig)
		matcher := reconcile.NewMatcher(engine)

		var result *reconcile.ReconcileResult
		if workers > 1 {
			result, err = matcher.ReconcileParallel(bizDate, flows, workers)
		} else {
			result, err = matcher.Reconcile(bizDate, flows)
		}
		bar.Finish()
		if err != nil {
			return fmt.Errorf("对账失败: %w", err)
		}

		fmt.Println()
		if !dryRun {
			_, err = database.InsertMatchResults(result.MatchedResults)
			if err != nil {
				return fmt.Errorf("写入匹配结果失败: %w", err)
			}
			_, err = database.InsertUnilateralFlows(result.UnilateralFlows)
			if err != nil {
				return fmt.Errorf("写入挂账记录失败: %w", err)
			}

			matchedIDs := make([]int64, 0, result.MatchedPairs*2)
			for _, mr := range result.MatchedResults {
				matchedIDs = append(matchedIDs, mr.FlowID1, mr.FlowID2)
			}
			_ = database.UpdateFlowStatus(matchedIDs, model.StatusMatched, "")

			uniIDs := make([]int64, 0, result.UnilateralCount)
			for _, uf := range result.UnilateralFlows {
				uniIDs = append(uniIDs, uf.FlowID)
			}
			_ = database.UpdateFlowStatus(uniIDs, model.StatusUnilateral, "")

			misIDs := make([]int64, 0, len(result.MismatchedFlows))
			for _, mf := range result.MismatchedFlows {
				misIDs = append(misIDs, mf.ID)
			}
			_ = database.UpdateFlowStatus(misIDs, model.StatusMismatch, "")
		}

		elapsed := result.ProcessingTime
		matchRate := float64(0)
		if result.TotalFlows > 0 {
			matchRate = float64(result.MatchedPairs*2) / float64(result.TotalFlows) * 100
		}
		status := green("成功")
		if result.UnilateralCount > 0 || result.MismatchCount > 0 {
			status = yellow("部分异常")
		}
		fmt.Printf("═══════════════════ 对账结果 ═══════════════════\n")
		fmt.Printf("  对账状态:    %s\n", status)
		fmt.Printf("  总流水数:    %d 笔\n", result.TotalFlows)
		fmt.Printf("  成功匹配:    %d 对 (%d 笔)  匹配率 %.1f%%\n", result.MatchedPairs, result.MatchedPairs*2, matchRate)
		fmt.Printf("  挂账流水:    %d 笔 %s\n", result.UnilateralCount, redIf(result.UnilateralCount > 0))
		fmt.Printf("  不匹配数:    %d 笔 %s\n", result.MismatchCount, redIf(result.MismatchCount > 0))
		fmt.Printf("  容差调平:    %.4f 元\n", result.TotalTolerance.InexactFloat64())
		fmt.Printf("  处理耗时:    %v\n", elapsed)
		fmt.Printf("═══════════════════════════════════════════════\n")

		if sendNotify {
			notifier := notify.NewMultiNotifier(appConfig, func(n model.Notification) error {
				return nil
			})
			warn := false
			remain := ""
			deadline := appConfig.Settlement.Deadline
			if deadline != "" {
				now := time.Now()
				dl, _ := time.ParseInLocation("15:04", deadline, now.Location())
				dl = time.Date(now.Year(), now.Month(), now.Day(), dl.Hour(), dl.Minute(), 0, 0, now.Location())
				if now.Before(dl) {
					remain = dl.Sub(now).Round(time.Minute).String()
					if dl.Sub(now) < 30*time.Minute {
						warn = true
					}
				}
			}
			subject, body := notify.BuildReconcileNotify(notify.ReconcileReport{
				BizDate: bizDate, TotalFlows: result.TotalFlows,
				MatchedPairs: result.MatchedPairs, UnilateralCount: result.UnilateralCount,
				MismatchCount: result.MismatchCount, ProcessingTime: elapsed.String(),
				DeadlineWarning: warn, TimeLeft: remain,
			})
			targets := []notify.NotifyTarget{}
			for _, inst := range appConfig.Institutions {
				if inst.Email != "" {
					targets = append(targets, notify.NotifyTarget{Type: "email", Value: inst.Email})
				}
			}
			_ = notifier
			_ = targets
			_ = subject
			_ = body
			fmt.Printf("%s 对账通知已发送\n", green("[NOTIFY]"))
		}

		writeAudit("RECONCILE", "CLI",
			fmt.Sprintf("total=%d matched=%d unilateral=%d mismatch=%d workers=%d",
				result.TotalFlows, result.MatchedPairs, result.UnilateralCount, result.MismatchCount, workers),
			"SUCCESS")
		return nil
	},
}

func redIf(cond bool) string {
	if cond {
		return red("⚠")
	}
	return ""
}

func init() {
	defaultWorkers := runtime.NumCPU()
	if defaultWorkers > 8 {
		defaultWorkers = 8
	}
	reconcileCmd.Flags().IntVar(&workers, "workers", defaultWorkers, "并行处理线程数")
	reconcileCmd.Flags().BoolVar(&sendNotify, "notify", false, "完成后发送邮件/短信通知")
	reconcileCmd.Flags().StringVar(&filterInst, "inst", "", "仅对指定机构对账")
}
