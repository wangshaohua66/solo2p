package main

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"clear-system/internal/db"
)

var (
	auditDate     string
	auditInst     string
	auditOp       string
	auditLimit    int
	auditFormat   string
)

var auditCmd = &cobra.Command{
	Use:   "audit",
	Short: "查询审计日志",
	Long: `根据日期、机构ID、操作类型查询清算系统审计日志
支持按多维度筛选审计记录，输出支持表格/JSON格式`,
	Example: `  # 查询2026-06-22全部审计
  clear audit -d 2026-06-22

  # 查询某机构的对账操作
  clear audit -d 2026-06-22 --inst INST001 --op reconcile

  # 最近100条记录JSON输出
  clear audit --limit 100 -f json`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if database == nil {
			return fmt.Errorf("数据库未初始化")
		}

		logs, err := database.QueryAuditLogsLimited(auditDate, auditInst, auditOp, auditLimit)
		if err != nil {
			return fmt.Errorf("%s", red(fmt.Sprintf("查询失败: %v", err)))
		}

		if len(logs) == 0 {
			yellow("[WARN] 未找到符合条件的审计日志")
			return nil
		}

		if auditFormat == "json" {
			fmt.Printf("[")
			for i, l := range logs {
				if i > 0 {
					fmt.Print(",")
				}
				fmt.Printf(`{"id":%d,"op_time":"%s","op_type":"%s","biz_date":"%s","inst_id":"%s","detail":"%s","result":"%s"}`,
					l.ID, l.OpTime, l.OpType, l.BizDate, l.InstID, escapeJSON(l.Detail), l.Result)
			}
			fmt.Println("]")
			return nil
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\t操作时间\t操作类型\t业务日期\t机构\t结果\t详情")
		fmt.Fprintln(w, "--\t--------\t--------\t--------\t----\t----\t----")
		for _, l := range logs {
			result := green(l.Result)
			if l.Result == "failed" {
				result = red(l.Result)
			} else if l.Result == "warn" {
				result = yellow(l.Result)
			}
			detail := l.Detail
			if len(detail) > 45 {
				detail = detail[:45] + "..."
			}
			fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\t%s\t%s\n",
				l.ID, l.OpTime, l.OpType, l.BizDate, l.InstID, result, detail)
		}
		w.Flush()

		cyan(fmt.Sprintf("\n共 %d 条审计记录\n", len(logs)))
		return nil
	},
}

func init() {
	auditCmd.Flags().StringVarP(&auditDate, "date", "d", "", "业务日期 (YYYY-MM-DD)")
	auditCmd.Flags().StringVar(&auditInst, "inst", "", "机构ID (如INST001)")
	auditCmd.Flags().StringVar(&auditOp, "op", "", "操作类型 (parse/reconcile/settle/report)")
	auditCmd.Flags().IntVar(&auditLimit, "limit", 200, "返回记录数上限")
	auditCmd.Flags().StringVarP(&auditFormat, "format", "f", "table", "输出格式 table/json")
	rootCmd.AddCommand(auditCmd)
}

func escapeJSON(s string) string {
	s = `"` + s + `"`
	return s[1 : len(s)-1]
}

func writeAuditSafe(op, bizDate, inst, detail, result string) {
	if database == nil {
		return
	}
	audit := db.AuditRecord{
		OpType:  op,
		BizDate: bizDate,
		InstID:  inst,
		Detail:  detail,
		Result:  result,
	}
	_ = database.InsertAuditLogSimple(audit)
}
