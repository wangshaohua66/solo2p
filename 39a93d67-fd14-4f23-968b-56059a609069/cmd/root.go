package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"eco-inspector/internal/archive"
	"eco-inspector/internal/database"
	"eco-inspector/internal/enterprise"
	"eco-inspector/internal/inspector"
	"eco-inspector/internal/report"
	"eco-inspector/internal/scheduler"
	"eco-inspector/pkg/config"
	"eco-inspector/pkg/logger"

	"github.com/AlecAivazis/survey/v2"
	"github.com/schollz/progressbar/v3"
	"github.com/spf13/cobra"
)

var cfgFile string
var cfg *config.Config

var rootCmd = &cobra.Command{
	Use:   "eco-inspector",
	Short: "省级生态环境保护督察整改跟踪管理系统",
	Long: `省级生态环境保护督察整改跟踪管理系统 (Eco-Inspector)

用于辖区内重点排污企业的环保督察整改跟踪管理，支持：
  • 企业信息管理 - 增删改查与批量导入导出
  • 整改事项跟踪 - 状态流转与进度更新
  • 预警通知调度 - 超期预警与催办通知
  • 验收销号档案 - 验收材料归档与检索
  • 统计报表生成 - 整改进度汇总与分析

整改事项四态流转：待整改 → 整改中 → 待验收 → 已销号`,
	SilenceUsage:  true,
	SilenceErrors: true,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "\033[31m错误: %s\033[0m\n", err.Error())
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "config.yaml", "配置文件路径")
}

func initConfig() {
	var err error
	cfg, err = config.Load(cfgFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\033[31m加载配置失败: %s\033[0m\n", err.Error())
		os.Exit(1)
	}

	if err := database.Init(cfg.Database.Path); err != nil {
		fmt.Fprintf(os.Stderr, "\033[31m初始化数据库失败: %s\033[0m\n", err.Error())
		os.Exit(1)
	}

	if err := logger.Init(cfg.Log); err != nil {
		fmt.Fprintf(os.Stderr, "\033[31m初始化日志失败: %s\033[0m\n", err.Error())
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(enterpriseCmd())
	rootCmd.AddCommand(rectificationCmd())
	rootCmd.AddCommand(warningCmd())
	rootCmd.AddCommand(archiveCmd())
	rootCmd.AddCommand(reportCmd())
	rootCmd.AddCommand(daemonCmd())
	rootCmd.AddCommand(helpCmd())
}

var interactive bool

func askInput(prompt, def string) string {
	result := def
	survey.AskOne(&survey.Input{Message: prompt, Default: def}, &result)
	return result
}

func askSelect(prompt string, options []string) string {
	var result string
	survey.AskOne(&survey.Select{Message: prompt, Options: options}, &result)
	return result
}

func askConfirm(prompt string) bool {
	var result bool
	survey.AskOne(&survey.Confirm{Message: prompt, Default: false}, &result)
	return result
}

func enterpriseCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "enterprise",
		Short: "企业信息管理",
		Long:  "管理重点排污企业信息，支持增删改查、批量导入导出",
	}

	cmd.PersistentFlags().BoolVarP(&interactive, "interactive", "I", false, "交互式问答模式")

	cmd.AddCommand(enterpriseCreateCmd())
	cmd.AddCommand(enterpriseListCmd())
	cmd.AddCommand(enterpriseGetCmd())
	cmd.AddCommand(enterpriseUpdateCmd())
	cmd.AddCommand(enterpriseDeleteCmd())
	cmd.AddCommand(enterpriseImportCmd())
	cmd.AddCommand(enterpriseExportCmd())
	cmd.AddCommand(enterpriseHistoryCmd())

	return cmd
}

func enterpriseHistoryCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "history",
		Short: "企业督察历史记录",
		Long:  "管理企业督察历史记录，支持增删改查",
	}
	cmd.AddCommand(enterpriseHistoryAddCmd())
	cmd.AddCommand(enterpriseHistoryListCmd())
	cmd.AddCommand(enterpriseHistoryDeleteCmd())
	return cmd
}

func enterpriseHistoryAddCmd() *cobra.Command {
	var round, date, inspector, summary, result, remark string
	var rectCount int
	cmd := &cobra.Command{
		Use:   "add <企业编码>",
		Short: "添加督察历史记录",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			if interactive {
				round = askInput("督察轮次:", round)
				date = askInput("督察日期 (YYYY-MM-DD):", time.Now().Format("2006-01-02"))
				inspector = askInput("督察人:", inspector)
				summary = askInput("问题摘要:", summary)
				rectCount, _ = strconv.Atoi(askInput("整改事项数量:", "0"))
				result = askSelect("督察结果:", []string{"通过", "限期整改", "立案查处", "其他"})
				remark = askInput("备注:", remark)
			}
			h := &enterprise.InspectorHistory{
				EnterpriseID:      args[0],
				InspectorRound:    round,
				InspectionDate:    date,
				Inspector:         inspector,
				ProblemSummary:    summary,
				RectificationCount: rectCount,
				Result:            result,
				Remark:            remark,
			}
			if err := mgr.AddHistory(h); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 督察历史记录已添加 (ID: %s)\033[0m\n", h.ID)
			return nil
		},
	}
	cmd.Flags().StringVarP(&round, "round", "r", "", "督察轮次")
	cmd.Flags().StringVarP(&date, "date", "d", time.Now().Format("2006-01-02"), "督察日期")
	cmd.Flags().StringVarP(&inspector, "inspector", "p", "", "督察人")
	cmd.Flags().StringVarP(&summary, "summary", "s", "", "问题摘要")
	cmd.Flags().IntVarP(&rectCount, "count", "c", 0, "整改事项数量")
	cmd.Flags().StringVarP(&result, "result", "o", "", "督察结果")
	cmd.Flags().StringVarP(&remark, "remark", "k", "", "备注")
	return cmd
}

func enterpriseHistoryListCmd() *cobra.Command {
	var page, pageSize int
	cmd := &cobra.Command{
		Use:   "list <企业编码>",
		Short: "查询企业督察历史记录",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			history, total, err := mgr.ListHistory(args[0], page, pageSize)
			if err != nil {
				return err
			}
			if len(history) == 0 {
				fmt.Println("该企业暂无督察历史记录")
				return nil
			}
			fmt.Println("\n\033[1m督察历史记录\033[0m")
			fmt.Println("┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐")
			fmt.Println("│ 记录ID   │ 轮次     │ 督察日期 │ 督察人   │ 结果     │ 整改数   │")
			fmt.Println("├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤")
			for _, h := range history {
				fmt.Printf("│ %-8s │ %-8s │ %-8s │ %-8s │ %-8s │ %8d │\n",
					h.ID, truncate(h.InspectorRound, 8), truncate(h.InspectionDate, 10),
					truncate(h.Inspector, 8), truncate(h.Result, 8), h.RectificationCount)
			}
			fmt.Println("└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘")
			fmt.Printf("\n共 %d 条 | 第 %d/%d 页\n", total, page, (total+pageSize-1)/pageSize)
			return nil
		},
	}
	cmd.Flags().IntVarP(&page, "page", "p", 1, "页码")
	cmd.Flags().IntVarP(&pageSize, "size", "s", 20, "每页条数")
	return cmd
}

func enterpriseHistoryDeleteCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete <记录ID>",
		Short: "删除督察历史记录",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			if err := mgr.DeleteHistory(args[0]); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 督察历史记录 %s 已删除\033[0m\n", args[0])
			return nil
		},
	}
	return cmd
}

func enterpriseCreateCmd() *cobra.Command {
	var name, region, industry, risk, address, contact, phone, code string
	cmd := &cobra.Command{
		Use:   "create",
		Short: "创建企业",
		RunE: func(cmd *cobra.Command, args []string) error {
			if interactive {
				name = askInput("企业名称:", name)
				region = askInput("区域:", region)
				industry = askInput("行业:", industry)
				risk = askSelect("风险等级:", []string{"高", "中", "低"})
				address = askInput("地址:", address)
				contact = askInput("联系人:", contact)
				phone = askInput("联系电话:", phone)
				code = askInput("企业编码 (留空自动生成):", code)
			}
			if name == "" {
				return fmt.Errorf("企业名称不能为空 (--name)")
			}
			e := &enterprise.Enterprise{
				Name: name, Region: region, Industry: industry,
				RiskLevel: risk, Address: address, Contact: contact,
				Phone: phone, ID: code,
			}
			mgr := enterprise.NewManager()
			if err := mgr.Create(e); err != nil {
				return err
			}
			printEnterpriseTable([]enterprise.Enterprise{*e})
			fmt.Printf("\n\033[32m✔ 企业创建成功\033[0m\n")
			return nil
		},
	}
	cmd.Flags().StringVarP(&name, "name", "n", "", "企业名称 (必填)")
	cmd.Flags().StringVarP(&region, "region", "r", "", "区域")
	cmd.Flags().StringVarP(&industry, "industry", "i", "", "行业")
	cmd.Flags().StringVarP(&risk, "risk", "k", "中", "风险等级 (高/中/低)")
	cmd.Flags().StringVarP(&address, "address", "a", "", "地址")
	cmd.Flags().StringVarP(&contact, "contact", "c", "", "联系人")
	cmd.Flags().StringVarP(&phone, "phone", "p", "", "联系电话")
	cmd.Flags().StringVarP(&code, "code", "d", "", "企业编码 (自动生成如不指定)")
	return cmd
}

func enterpriseListCmd() *cobra.Command {
	var region, industry, risk, keyword string
	var page, pageSize int
	cmd := &cobra.Command{
		Use:   "list",
		Short: "查询企业列表",
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			result, err := mgr.List(enterprise.ListFilter{
				Region: region, Industry: industry, Risk: risk,
				Keyword: keyword, Page: page, PageSize: pageSize,
			})
			if err != nil {
				return err
			}
			printEnterpriseTable(result.Enterprises)
			fmt.Printf("\n共 %d 条 | 第 %d/%d 页 | 每页 %d 条\n",
				result.Total, result.Page, (result.Total+result.PageSize-1)/result.PageSize, result.PageSize)
			return nil
		},
	}
	cmd.Flags().StringVarP(&region, "region", "r", "", "按区域筛选")
	cmd.Flags().StringVarP(&industry, "industry", "i", "", "按行业筛选")
	cmd.Flags().StringVarP(&risk, "risk", "k", "", "按风险等级筛选")
	cmd.Flags().StringVarP(&keyword, "keyword", "q", "", "关键词搜索")
	cmd.Flags().IntVarP(&page, "page", "p", 1, "页码")
	cmd.Flags().IntVarP(&pageSize, "size", "s", 20, "每页条数")
	return cmd
}

func enterpriseGetCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get <企业编码>",
		Short: "查询企业详情",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			e, err := mgr.GetByID(args[0])
			if err != nil {
				return err
			}
			printEnterpriseDetail(e)
			return nil
		},
	}
	return cmd
}

func enterpriseUpdateCmd() *cobra.Command {
	var name, region, industry, risk, address, contact, phone string
	cmd := &cobra.Command{
		Use:   "update <企业编码>",
		Short: "更新企业信息",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			e, err := mgr.GetByID(args[0])
			if err != nil {
				return err
			}
			if name != "" {
				e.Name = name
			}
			if region != "" {
				e.Region = region
			}
			if industry != "" {
				e.Industry = industry
			}
			if risk != "" {
				e.RiskLevel = risk
			}
			if address != "" {
				e.Address = address
			}
			if contact != "" {
				e.Contact = contact
			}
			if phone != "" {
				e.Phone = phone
			}
			if err := mgr.Update(e); err != nil {
				return err
			}
			printEnterpriseDetail(e)
			fmt.Printf("\n\033[32m✔ 企业信息更新成功\033[0m\n")
			return nil
		},
	}
	cmd.Flags().StringVarP(&name, "name", "n", "", "企业名称")
	cmd.Flags().StringVarP(&region, "region", "r", "", "区域")
	cmd.Flags().StringVarP(&industry, "industry", "i", "", "行业")
	cmd.Flags().StringVarP(&risk, "risk", "k", "", "风险等级")
	cmd.Flags().StringVarP(&address, "address", "a", "", "地址")
	cmd.Flags().StringVarP(&contact, "contact", "c", "", "联系人")
	cmd.Flags().StringVarP(&phone, "phone", "p", "", "联系电话")
	return cmd
}

func enterpriseDeleteCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete <企业编码>",
		Short: "删除企业",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			if err := mgr.Delete(args[0]); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 企业 %s 已删除\033[0m\n", args[0])
			return nil
		},
	}
	return cmd
}

func enterpriseImportCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "import <文件路径>",
		Short: "批量导入企业 (支持 .csv 和 .xlsx)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			filePath := args[0]
			fmt.Printf("正在导入 %s ...\n", filePath)
			start := time.Now()

			bar := progressbar.Default(100, "导入进度")
			var lastPct int64 = -1

			progressFn := func(current, total int) {
				if total > 0 {
					pct := int64(current * 100 / total)
					if pct != lastPct {
						bar.Set64(pct)
						lastPct = pct
					}
				}
			}

			count, err := mgr.ImportAutoDetect(filePath, progressFn)
			if err != nil {
				bar.Finish()
				return err
			}
			bar.Finish()

			elapsed := time.Since(start)
			fmt.Printf("\033[32m✔ 成功导入 %d 条企业数据 (耗时: %.2f秒)\033[0m\n", count, elapsed.Seconds())
			return nil
		},
	}
	return cmd
}

func enterpriseExportCmd() *cobra.Command {
	var region, industry, risk, keyword string
	cmd := &cobra.Command{
		Use:   "export <CSV文件路径>",
		Short: "导出企业数据到CSV",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := enterprise.NewManager()
			count, err := mgr.ExportToCSV(args[0], enterprise.ListFilter{
				Region: region, Industry: industry, Risk: risk, Keyword: keyword,
			})
			if err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 成功导出 %d 条企业数据到 %s\033[0m\n", count, args[0])
			return nil
		},
	}
	cmd.Flags().StringVarP(&region, "region", "r", "", "按区域筛选")
	cmd.Flags().StringVarP(&industry, "industry", "i", "", "按行业筛选")
	cmd.Flags().StringVarP(&risk, "risk", "k", "", "按风险等级筛选")
	cmd.Flags().StringVarP(&keyword, "keyword", "q", "", "关键词搜索")
	return cmd
}

func rectificationCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "rectification",
		Short: "整改事项管理",
		Long:  "管理整改事项，支持创建、状态流转、进度汇报与审核",
	}

	cmd.PersistentFlags().BoolVarP(&interactive, "interactive", "I", false, "交互式问答模式")

	cmd.AddCommand(rectCreateCmd())
	cmd.AddCommand(rectListCmd())
	cmd.AddCommand(rectGetCmd())
	cmd.AddCommand(rectUpdateStatusCmd())
	cmd.AddCommand(rectSubmitProgressCmd())
	cmd.AddCommand(rectReviewProgressCmd())
	cmd.AddCommand(rectListProgressCmd())

	return cmd
}

func rectCreateCmd() *cobra.Command {
	var entID, pType, desc, deadline, responsible, criteria, round string
	cmd := &cobra.Command{
		Use:   "create",
		Short: "创建整改事项",
		RunE: func(cmd *cobra.Command, args []string) error {
			if interactive {
				entID = askInput("企业编码:", entID)
				pType = askSelect("问题类型:", []string{"大气污染", "水污染", "固废管理", "环评手续"})
				desc = askInput("问题描述:", desc)
				deadline = askInput("整改期限 (YYYY-MM-DD):", deadline)
				responsible = askInput("责任人:", responsible)
				criteria = askInput("验收标准:", criteria)
				round = askInput("督察轮次:", round)
			}
			r := &inspector.Rectification{
				EnterpriseID:      entID,
				ProblemType:       pType,
				ProblemDesc:       desc,
				Deadline:          deadline,
				ResponsiblePerson: responsible,
				AcceptanceCriteria: criteria,
				InspectorRound:    round,
			}
			t := inspector.NewTracker()
			if err := t.Create(r); err != nil {
				return err
			}
			printRectificationTable([]inspector.Rectification{*r})
			fmt.Printf("\n\033[32m✔ 整改事项创建成功\033[0m\n")
			return nil
		},
	}
	cmd.Flags().StringVarP(&entID, "enterprise", "e", "", "企业编码 (必填)")
	cmd.Flags().StringVarP(&pType, "type", "t", "", "问题类型: 大气污染/水污染/固废管理/环评手续 (必填)")
	cmd.Flags().StringVarP(&desc, "desc", "d", "", "问题描述 (必填)")
	cmd.Flags().StringVarP(&deadline, "deadline", "l", "", "整改期限 YYYY-MM-DD (必填)")
	cmd.Flags().StringVarP(&responsible, "responsible", "r", "", "责任人")
	cmd.Flags().StringVarP(&criteria, "criteria", "c", "", "验收标准")
	cmd.Flags().StringVarP(&round, "round", "o", "", "督察轮次")
	return cmd
}

func rectListCmd() *cobra.Command {
	var entID, pType, status, keyword string
	var deadlineFrom, deadlineTo string
	var page, pageSize int
	cmd := &cobra.Command{
		Use:   "list",
		Short: "查询整改事项列表",
		RunE: func(cmd *cobra.Command, args []string) error {
			t := inspector.NewTracker()
			result, err := t.List(inspector.RectListFilter{
				EnterpriseID: entID, ProblemType: pType, Status: status,
				DeadlineFrom: deadlineFrom, DeadlineTo: deadlineTo,
				Keyword: keyword, Page: page, PageSize: pageSize,
			})
			if err != nil {
				return err
			}
			printRectificationTable(result.Items)
			fmt.Printf("\n共 %d 条 | 第 %d/%d 页 | 每页 %d 条\n",
				result.Total, result.Page, (result.Total+result.PageSize-1)/result.PageSize, result.PageSize)
			return nil
		},
	}
	cmd.Flags().StringVarP(&entID, "enterprise", "e", "", "按企业编码筛选")
	cmd.Flags().StringVarP(&pType, "type", "t", "", "按问题类型筛选")
	cmd.Flags().StringVarP(&status, "status", "s", "", "按状态筛选")
	cmd.Flags().StringVarP(&keyword, "keyword", "q", "", "关键词搜索")
	cmd.Flags().StringVarP(&deadlineFrom, "from", "f", "", "整改期限起始 YYYY-MM-DD")
	cmd.Flags().StringVarP(&deadlineTo, "to", "o", "", "整改期限截止 YYYY-MM-DD")
	cmd.Flags().IntVarP(&page, "page", "p", 1, "页码")
	cmd.Flags().IntVarP(&pageSize, "size", "z", 20, "每页条数")
	return cmd
}

func rectGetCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get <整改事项ID>",
		Short: "查询整改事项详情",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			t := inspector.NewTracker()
			r, err := t.GetByID(args[0])
			if err != nil {
				return err
			}
			printRectificationDetail(r)
			return nil
		},
	}
	return cmd
}

func rectUpdateStatusCmd() *cobra.Command {
	var newStatus, operator string
	cmd := &cobra.Command{
		Use:   "status <整改事项ID>",
		Short: "更新整改事项状态",
		Long: `更新整改事项状态，支持流转：
  待整改 → 整改中
  整改中 → 待验收 | 待整改(退回)
  待验收 → 已销号 | 整改中(退回)`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			t := inspector.NewTracker()
			if err := t.UpdateStatus(args[0], inspector.Status(newStatus), operator); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 状态更新成功: %s → %s\033[0m\n", args[0], newStatus)
			return nil
		},
	}
	cmd.Flags().StringVarP(&newStatus, "status", "s", "", "新状态 (必填)")
	cmd.Flags().StringVarP(&operator, "operator", "o", "system", "操作人")
	return cmd
}

func rectSubmitProgressCmd() *cobra.Command {
	var content, attachment, reportType string
	cmd := &cobra.Command{
		Use:   "progress <整改事项ID>",
		Short: "提交整改进度汇报",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			report := &inspector.ProgressReport{
				RectificationID: args[0],
				ReportType:     reportType,
				Content:        content,
				Attachment:     attachment,
			}
			t := inspector.NewTracker()
			if err := t.SubmitProgress(report); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 进度汇报提交成功\033[0m\n")
			return nil
		},
	}
	cmd.Flags().StringVarP(&content, "content", "c", "", "汇报内容 (必填)")
	cmd.Flags().StringVarP(&attachment, "attachment", "a", "", "佐证材料路径")
	cmd.Flags().StringVarP(&reportType, "type", "t", "企业汇报", "汇报类型")
	return cmd
}

func rectReviewProgressCmd() *cobra.Command {
	var reviewer, comment string
	var approved bool
	cmd := &cobra.Command{
		Use:   "review <进度汇报ID>",
		Short: "审核整改进度汇报",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			t := inspector.NewTracker()
			if err := t.ReviewProgress(args[0], reviewer, comment, approved); err != nil {
				return err
			}
			resultStr := "驳回"
			if approved {
				resultStr = "通过"
			}
			fmt.Printf("\033[32m✔ 审核完成: %s\033[0m\n", resultStr)
			return nil
		},
	}
	cmd.Flags().StringVarP(&reviewer, "reviewer", "r", "", "审核人 (必填)")
	cmd.Flags().StringVarP(&comment, "comment", "c", "", "审核意见")
	cmd.Flags().BoolVarP(&approved, "approve", "a", false, "是否通过")
	return cmd
}

func rectListProgressCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "progress-list <整改事项ID>",
		Short: "查看整改事项所有进度汇报",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			t := inspector.NewTracker()
			reports, err := t.ListProgress(args[0])
			if err != nil {
				return err
			}
			printProgressTable(reports)
			return nil
		},
	}
	return cmd
}

func warningCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "warning",
		Short: "预警通知管理",
		Long:  "扫描超期预警事项，查看催办清单",
	}

	cmd.AddCommand(warningScanCmd())
	cmd.AddCommand(warningOverdueCmd())
	cmd.AddCommand(warningStatsCmd())
	cmd.AddCommand(warningExportCmd())
	cmd.AddCommand(warningDaemonCmd())

	return cmd
}

func warningDaemonCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "daemon",
		Short: "启动定时预警调度后台 (每天 08:00 自动扫描)",
		Long:  "常驻后台模式，按配置的 cron 表达式定时执行 Scan()",
		RunE: func(cmd *cobra.Command, args []string) error {
			cronSpec := cfg.Warning.Cron
			if cronSpec == "" {
				cronSpec = "0 8 * * *"
			}
			n := scheduler.NewNotifierWithCron(cfg.Warning.Levels, cronSpec)
			if err := n.StartCron(); err != nil {
				return fmt.Errorf("启动调度器失败: %w", err)
			}
			fmt.Printf("\033[32m✔ 定时调度已启动 (cron: %s)，Ctrl+C 退出\033[0m\n", cronSpec)

			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
			<-sigCh

			fmt.Println("\n正在关闭调度器...")
			n.StopCron()
			fmt.Println("已退出")
			return nil
		},
	}
	return cmd
}

func warningScanCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "scan",
		Short: "扫描预警事项",
		RunE: func(cmd *cobra.Command, args []string) error {
			n := scheduler.NewNotifier(cfg.Warning.Levels)
			warnings, err := n.Scan()
			if err != nil {
				return err
			}
			if len(warnings) == 0 {
				fmt.Println("\033[32m✔ 当前无预警事项\033[0m")
				return nil
			}
			printWarningTable(warnings)
			fmt.Printf("\n共 %d 条预警\n", len(warnings))
			return nil
		},
	}
	return cmd
}

func warningOverdueCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "overdue",
		Short: "查看超期事项",
		RunE: func(cmd *cobra.Command, args []string) error {
			n := scheduler.NewNotifier(cfg.Warning.Levels)
			items, err := n.GetOverdue()
			if err != nil {
				return err
			}
			if len(items) == 0 {
				fmt.Println("\033[32m✔ 当前无超期事项\033[0m")
				return nil
			}
			printWarningTable(items)
			fmt.Printf("\n共 %d 条超期\033[0m\n", len(items))
			return nil
		},
	}
	return cmd
}

func warningStatsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "stats",
		Short: "预警统计",
		RunE: func(cmd *cobra.Command, args []string) error {
			n := scheduler.NewNotifier(cfg.Warning.Levels)
			stats, err := n.GetWarningStats()
			if err != nil {
				return err
			}
			fmt.Println("\n\033[1m预警统计概览\033[0m")
			fmt.Println("─────────────────────────")
			fmt.Printf("  未关闭事项总数: \033[33m%d\033[0m\n", stats["total_open"])
			fmt.Printf("  已超期:         \033[31m%d\033[0m\n", stats["overdue"])
			fmt.Printf("  1天内到期:      \033[31m%d\033[0m\n", stats["level_1"])
			fmt.Printf("  3天内到期:      \033[33m%d\033[0m\n", stats["level_3"])
			fmt.Printf("  7天内到期:      \033[34m%d\033[0m\n", stats["level_7"])
			fmt.Println("─────────────────────────")
			return nil
		},
	}
	return cmd
}

func warningExportCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "export <CSV文件路径>",
		Short: "导出催办清单",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			n := scheduler.NewNotifier(cfg.Warning.Levels)
			warnings, err := n.Scan()
			if err != nil {
				return err
			}
			if err := n.ExportWarningList(args[0], warnings); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 催办清单已导出到 %s\033[0m\n", args[0])
			return nil
		},
	}
	return cmd
}

func archiveCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "archive",
		Short: "销号档案管理",
		Long:  "管理验收销号档案，支持归档、检索和全文搜索",
	}

	cmd.PersistentFlags().BoolVarP(&interactive, "interactive", "I", false, "交互式问答模式")

	cmd.AddCommand(archiveCreateCmd())
	cmd.AddCommand(archiveListCmd())
	cmd.AddCommand(archiveGetCmd())
	cmd.AddCommand(archiveSearchCmd())
	cmd.AddCommand(archiveMaterialCmd())

	return cmd
}

func archiveMaterialCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "material",
		Short: "验收材料管理",
		Long:  "上传、查询、删除验收归档材料（照片、文档等）",
	}
	cmd.AddCommand(archiveMaterialUploadCmd())
	cmd.AddCommand(archiveMaterialListCmd())
	cmd.AddCommand(archiveMaterialDeleteCmd())
	return cmd
}

func archiveMaterialUploadCmd() *cobra.Command {
	var uploader string
	cmd := &cobra.Command{
		Use:   "upload <档案ID> <文件路径>",
		Short: "上传验收材料到档案",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			a := archive.NewArchiver()
			meta, err := a.UploadMaterial(args[0], args[1], uploader)
			if err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 材料已上传\033[0m\n")
			fmt.Printf("  材料ID: %s\n  原文件名: %s\n  类型: %s\n  大小: %d 字节\n  上传时间: %s\n",
				meta.ID, meta.FileName, meta.FileType, meta.FileSize, meta.UploadTime)
			return nil
		},
	}
	cmd.Flags().StringVarP(&uploader, "uploader", "u", "admin", "上传人")
	return cmd
}

func archiveMaterialListCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list <档案ID>",
		Short: "列出档案中的验收材料",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			a := archive.NewArchiver()
			materials, err := a.ListMaterials(args[0])
			if err != nil {
				return err
			}
			if len(materials) == 0 {
				fmt.Println("该档案暂无验收材料")
				return nil
			}
			fmt.Println("\n\033[1m验收材料列表\033[0m")
			fmt.Println("┌──────────┬──────────────────────┬──────────┬──────────┬──────────┐")
			fmt.Println("│ 材料ID   │ 原文件名             │ 类型     │ 大小     │ 上传时间 │")
			fmt.Println("├──────────┼──────────────────────┼──────────┼──────────┼──────────┤")
			for _, m := range materials {
				fmt.Printf("│ %-8s │ %-20s │ %-8s │ %8d │ %-8s │\n",
					m.ID, truncate(m.FileName, 20), m.FileType, m.FileSize, truncate(m.UploadTime, 10))
			}
			fmt.Println("└──────────┴──────────────────────┴──────────┴──────────┴──────────┘")
			return nil
		},
	}
	return cmd
}

func archiveMaterialDeleteCmd() *cobra.Command {
	var operator string
	cmd := &cobra.Command{
		Use:   "delete <档案ID> <材料ID>",
		Short: "删除验收材料",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			a := archive.NewArchiver()
			if err := a.DeleteMaterial(args[0], args[1], operator); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 材料 %s 已删除\033[0m\n", args[1])
			return nil
		},
	}
	cmd.Flags().StringVarP(&operator, "operator", "u", "admin", "操作人")
	return cmd
}

func archiveCreateCmd() *cobra.Command {
	var rectID, result, date, person, materials, remark string
	cmd := &cobra.Command{
		Use:   "create",
		Short: "创建验收销号档案",
		RunE: func(cmd *cobra.Command, args []string) error {
			if interactive {
				rectID = askInput("整改事项ID:", rectID)
				result = askSelect("验收结论:", []string{"合格", "不合格"})
				date = askInput("验收日期 (YYYY-MM-DD):", time.Now().Format("2006-01-02"))
				person = askInput("验收人:", person)
				remark = askInput("备注:", remark)
			}
			arc := &archive.Archive{
				RectificationID:  rectID,
				AcceptanceResult: result,
				AcceptanceDate:   date,
				AcceptancePerson: person,
				Materials:        materials,
				Remark:           remark,
			}
			a := archive.NewArchiver()
			if err := a.Create(arc); err != nil {
				return err
			}
			printArchiveDetail(arc)
			fmt.Printf("\n\033[32m✔ 验收销号档案创建成功\033[0m\n")
			return nil
		},
	}
	cmd.Flags().StringVarP(&rectID, "rectification", "r", "", "整改事项ID (必填)")
	cmd.Flags().StringVarP(&result, "result", "s", "", "验收结论: 合格/不合格 (必填)")
	cmd.Flags().StringVarP(&date, "date", "d", "", "验收日期 YYYY-MM-DD (必填)")
	cmd.Flags().StringVarP(&person, "person", "p", "", "验收人 (必填)")
	cmd.Flags().StringVarP(&materials, "materials", "m", "", "验收材料")
	cmd.Flags().StringVarP(&remark, "remark", "k", "", "备注")
	return cmd
}

func archiveListCmd() *cobra.Command {
	var entID, pType, dateFrom, dateTo, status, keyword string
	var page, pageSize int
	cmd := &cobra.Command{
		Use:   "list",
		Short: "查询档案列表",
		RunE: func(cmd *cobra.Command, args []string) error {
			a := archive.NewArchiver()
			result, err := a.List(archive.ArchiveFilter{
				EnterpriseID: entID, ProblemType: pType,
				DateFrom: dateFrom, DateTo: dateTo,
				Status: status, Keyword: keyword,
				Page: page, PageSize: pageSize,
			})
			if err != nil {
				return err
			}
			printArchiveTable(result.Items)
			fmt.Printf("\n共 %d 条 | 第 %d/%d 页 | 每页 %d 条\n",
				result.Total, result.Page, (result.Total+result.PageSize-1)/result.PageSize, result.PageSize)
			return nil
		},
	}
	cmd.Flags().StringVarP(&entID, "enterprise", "e", "", "按企业编码筛选")
	cmd.Flags().StringVarP(&pType, "type", "t", "", "按问题类型筛选")
	cmd.Flags().StringVarP(&dateFrom, "from", "f", "", "验收日期起始")
	cmd.Flags().StringVarP(&dateTo, "to", "o", "", "验收日期截止")
	cmd.Flags().StringVarP(&status, "status", "s", "", "验收结论")
	cmd.Flags().StringVarP(&keyword, "keyword", "q", "", "关键词搜索")
	cmd.Flags().IntVarP(&page, "page", "p", 1, "页码")
	cmd.Flags().IntVarP(&pageSize, "size", "z", 20, "每页条数")
	return cmd
}

func archiveGetCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get <档案ID>",
		Short: "查询档案详情",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			a := archive.NewArchiver()
			arc, err := a.GetByID(args[0])
			if err != nil {
				return err
			}
			printArchiveDetail(arc)
			return nil
		},
	}
	return cmd
}

func archiveSearchCmd() *cobra.Command {
	var page, pageSize int
	cmd := &cobra.Command{
		Use:   "search <关键词>",
		Short: "全文关键词搜索档案",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			a := archive.NewArchiver()
			result, err := a.FullTextSearch(args[0], page, pageSize)
			if err != nil {
				return err
			}
			printArchiveTable(result.Items)
			fmt.Printf("\n共 %d 条匹配 | 第 %d/%d 页\n",
				result.Total, result.Page, (result.Total+result.PageSize-1)/result.PageSize)
			return nil
		},
	}
	cmd.Flags().IntVarP(&page, "page", "p", 1, "页码")
	cmd.Flags().IntVarP(&pageSize, "size", "s", 20, "每页条数")
	return cmd
}

func reportCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "report",
		Short: "统计报表",
		Long:  "生成整改进度周报月报，按区域行业统计销号率",
	}

	cmd.AddCommand(reportSummaryCmd())
	cmd.AddCommand(reportWeeklyCmd())
	cmd.AddCommand(reportMonthlyCmd())
	cmd.AddCommand(reportRegionCmd())
	cmd.AddCommand(reportIndustryCmd())
	cmd.AddCommand(reportOverdueListCmd())
	cmd.AddCommand(reportExportCmd())

	return cmd
}

func reportSummaryCmd() *cobra.Command {
	var startDate, endDate string
	cmd := &cobra.Command{
		Use:   "summary",
		Short: "整改进度汇总",
		RunE: func(cmd *cobra.Command, args []string) error {
			g := report.NewGenerator()
			summary, err := g.GetProgressSummary(startDate, endDate)
			if err != nil {
				return err
			}
			fmt.Println("\n\033[1m整改进度汇总\033[0m")
			fmt.Println("═══════════════════════════════════")
			fmt.Printf("  总事项数:  \033[1m%d\033[0m\n", summary.Total)
			fmt.Printf("  \033[31m待整改:\033[0m    %d\n", summary.Pending)
			fmt.Printf("  \033[33m整改中:\033[0m    %d\n", summary.InProgress)
			fmt.Printf("  \033[34m待验收:\033[0m    %d\n", summary.Review)
			fmt.Printf("  \033[32m已销号:\033[0m    %d\n", summary.Closed)
			fmt.Printf("  \033[31m超期:\033[0m      %d\n", summary.Overdue)
			fmt.Printf("  销号率:    \033[1m%.1f%%\033[0m\n", summary.CloseRate)
			fmt.Println("═══════════════════════════════════")
			return nil
		},
	}
	cmd.Flags().StringVarP(&startDate, "from", "f", "", "起始日期 YYYY-MM-DD")
	cmd.Flags().StringVarP(&endDate, "to", "t", "", "截止日期 YYYY-MM-DD")
	return cmd
}

func reportWeeklyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "weekly",
		Short: "生成周报",
		RunE: func(cmd *cobra.Command, args []string) error {
			g := report.NewGenerator()
			rpt, err := g.GenerateWeeklyReport()
			if err != nil {
				return err
			}
			printReport(rpt)
			return nil
		},
	}
	return cmd
}

func reportMonthlyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "monthly",
		Short: "生成月报",
		RunE: func(cmd *cobra.Command, args []string) error {
			g := report.NewGenerator()
			rpt, err := g.GenerateMonthlyReport()
			if err != nil {
				return err
			}
			printReport(rpt)
			return nil
		},
	}
	return cmd
}

func reportRegionCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "region",
		Short: "按区域统计销号率",
		RunE: func(cmd *cobra.Command, args []string) error {
			g := report.NewGenerator()
			stats, err := g.GetRegionStats()
			if err != nil {
				return err
			}
			fmt.Println("\n\033[1m按区域统计\033[0m")
			fmt.Println("┌──────────┬──────────┬──────────┬──────────┬──────────┐")
			fmt.Println("│ 区域     │ 总事项   │ 已销号   │ 销号率   │ 超期     │")
			fmt.Println("├──────────┼──────────┼──────────┼──────────┼──────────┤")
			for _, s := range stats {
				fmt.Printf("│ %-8s │ %8d │ %8d │ %7.1f%% │ %8d │\n",
					s.Region, s.Total, s.Closed, s.CloseRate, s.Overdue)
			}
			fmt.Println("└──────────┴──────────┴──────────┴──────────┴──────────┘")
			return nil
		},
	}
	return cmd
}

func reportIndustryCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "industry",
		Short: "按行业统计销号率",
		RunE: func(cmd *cobra.Command, args []string) error {
			g := report.NewGenerator()
			stats, err := g.GetIndustryStats()
			if err != nil {
				return err
			}
			fmt.Println("\n\033[1m按行业统计\033[0m")
			fmt.Println("┌──────────┬──────────┬──────────┬──────────┐")
			fmt.Println("│ 行业     │ 总事项   │ 已销号   │ 销号率   │")
			fmt.Println("├──────────┼──────────┼──────────┼──────────┤")
			for _, s := range stats {
				fmt.Printf("│ %-8s │ %8d │ %8d │ %7.1f%% │\n",
					s.Industry, s.Total, s.Closed, s.CloseRate)
			}
			fmt.Println("└──────────┴──────────┴──────────┴──────────┘")
			return nil
		},
	}
	return cmd
}

func reportOverdueListCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "overdue",
		Short: "超期未整改企业清单",
		RunE: func(cmd *cobra.Command, args []string) error {
			g := report.NewGenerator()
			items, err := g.GetOverdueEnterprises()
			if err != nil {
				return err
			}
			if len(items) == 0 {
				fmt.Println("\033[32m✔ 当前无超期企业\033[0m")
				return nil
			}
			fmt.Println("\n\033[1m\033[31m超期未整改企业清单\033[0m")
			fmt.Println("┌──────────┬──────────────────────┬──────────┬──────────┬──────────┐")
			fmt.Println("│ 企业编码 │ 企业名称             │ 超期数   │ 最长天数 │ 风险等级 │")
			fmt.Println("├──────────┼──────────────────────┼──────────┼──────────┼──────────┤")
			for _, o := range items {
				fmt.Printf("│ %-8s │ %-20s │ %8d │ %8d │ %s\033[0m │\n",
					o.EnterpriseID, truncate(o.EnterpriseName, 20), o.OverdueCount, o.MaxOverdueDays, logger.FormatRisk(o.RiskLevel))
			}
			fmt.Println("└──────────┴──────────────────────┴──────────┴──────────┴──────────┘")
			return nil
		},
	}
	return cmd
}

func reportExportCmd() *cobra.Command {
	var period string
	cmd := &cobra.Command{
		Use:   "export <CSV文件路径>",
		Short: "导出报表到CSV",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			g := report.NewGenerator()
			var rpt *report.WeeklyReport
			var err error
			if period == "monthly" {
				rpt, err = g.GenerateMonthlyReport()
			} else {
				rpt, err = g.GenerateWeeklyReport()
			}
			if err != nil {
				return err
			}
			if err := g.ExportReportCSV(args[0], rpt); err != nil {
				return err
			}
			fmt.Printf("\033[32m✔ 报表已导出到 %s\033[0m\n", args[0])
			return nil
		},
	}
	cmd.Flags().StringVarP(&period, "period", "p", "weekly", "报表周期: weekly/monthly")
	return cmd
}

func daemonCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "daemon",
		Short: "启动后台守护进程 (等效于 warning daemon)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cronSpec := cfg.Warning.Cron
			if cronSpec == "" {
				cronSpec = "0 8 * * *"
			}
			n := scheduler.NewNotifierWithCron(cfg.Warning.Levels, cronSpec)
			if err := n.StartCron(); err != nil {
				return fmt.Errorf("启动调度器失败: %w", err)
			}
			fmt.Printf("\033[32m✔ 定时调度已启动 (cron: %s)，Ctrl+C 退出\033[0m\n", cronSpec)

			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
			<-sigCh

			fmt.Println("\n正在关闭调度器...")
			n.StopCron()
			fmt.Println("已退出")
			return nil
		},
	}
	return cmd
}

func helpCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "guide",
		Short: "操作指南",
		Long: `省级生态环境保护督察整改跟踪管理系统 - 操作指南

═══════════════════════════════════════════════════════════
  一、企业信息管理
═══════════════════════════════════════════════════════════

  创建企业:
    eco-inspector enterprise create --name "XX化工有限公司" --region "合肥市" --industry "化工" --risk "高"

  查询企业列表:
    eco-inspector enterprise list --region "合肥市" --risk "高" --page 1 --size 20

  查看企业详情:
    eco-inspector enterprise get <企业编码>

  更新企业信息:
    eco-inspector enterprise update <企业编码> --name "新名称" --risk "中"

  删除企业:
    eco-inspector enterprise delete <企业编码>

  批量导入 (CSV格式，列: 企业编码,企业名称,区域,行业,风险等级,地址,联系人,联系电话):
    eco-inspector enterprise import enterprises.csv

  导出企业数据:
    eco-inspector enterprise export output.csv --region "合肥市"

═══════════════════════════════════════════════════════════
  二、整改事项管理
═══════════════════════════════════════════════════════════

  创建整改事项:
    eco-inspector rectification create --enterprise <企业编码> --type "大气污染" --desc "废气排放超标" --deadline "2025-06-30"

  查询整改事项:
    eco-inspector rectification list --status "待整改" --type "大气污染"

  查看整改详情:
    eco-inspector rectification get <整改事项ID>

  更新整改状态 (四态流转):
    待整改 → 整改中:
      eco-inspector rectification status <ID> --status "整改中"
    整改中 → 待验收:
      eco-inspector rectification status <ID> --status "待验收"
    待验收 → 已销号:
      eco-inspector rectification status <ID> --status "已销号"

  提交整改进度:
    eco-inspector rectification progress <整改事项ID> --content "已完成设备安装" --attachment "photo.jpg"

  审核进度汇报:
    eco-inspector rectification review <进度汇报ID> --reviewer "张督察" --approve --comment "同意"

  查看进度历史:
    eco-inspector rectification progress-list <整改事项ID>

═══════════════════════════════════════════════════════════
  三、预警通知
═══════════════════════════════════════════════════════════

  扫描预警事项:
    eco-inspector warning scan

  查看超期事项:
    eco-inspector warning overdue

  预警统计:
    eco-inspector warning stats

  导出催办清单:
    eco-inspector warning export reminders.csv

═══════════════════════════════════════════════════════════
  四、验收销号档案
═══════════════════════════════════════════════════════════

  创建验收档案:
    eco-inspector archive create --rectification <整改事项ID> --result "合格" --date "2025-06-15" --person "李督察"

  查询档案列表:
    eco-inspector archive list --enterprise <企业编码> --type "大气污染"

  查看档案详情:
    eco-inspector archive get <档案ID>

  全文搜索:
    eco-inspector archive search "废气排放"

═══════════════════════════════════════════════════════════
  五、统计报表
═══════════════════════════════════════════════════════════

  进度汇总:
    eco-inspector report summary

  生成周报:
    eco-inspector report weekly

  生成月报:
    eco-inspector report monthly

  按区域统计:
    eco-inspector report region

  按行业统计:
    eco-inspector report industry

  超期企业清单:
    eco-inspector report overdue

  导出报表:
    eco-inspector report export report.csv --period weekly

═══════════════════════════════════════════════════════════
  六、整改事项状态流转规则
═══════════════════════════════════════════════════════════

  待整改 ──→ 整改中 ──→ 待验收 ──→ 已销号
    ↑          │           │
    └──────────┘           │
                 ←─────────┘

═══════════════════════════════════════════════════════════
  七、配置文件说明 (config.yaml)
═══════════════════════════════════════════════════════════

  database:
    path: "data/eco_inspector.db"   # 数据库文件路径
    max_size_mb: 500                 # 数据库最大大小(MB)

  log:
    level: "info"                    # 日志级别: debug/info/warn/error
    dir: "logs"                      # 日志目录
    max_size_mb: 50                  # 单个日志文件最大大小(MB)
    max_backups: 30                  # 日志备份保留数

  warning:
    levels: [7, 3, 1]               # 预警阈值(天)
    cron: "0 8 * * *"               # 扫描时间(cron表达式)

  app:
    default_deadline_days: 30        # 默认整改期限(天)
    page_size: 20                    # 默认分页大小
`,
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println(cmd.Long)
		},
	}
	return cmd
}

func printEnterpriseTable(enterprises []enterprise.Enterprise) {
	fmt.Println("\n┌──────────┬──────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐")
	fmt.Println("│ 编码     │ 企业名称             │ 区域     │ 行业     │ 风险等级 │ 信用分   │ 督察次数 │")
	fmt.Println("├──────────┼──────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤")
	for _, e := range enterprises {
		fmt.Printf("│ %-8s │ %-20s │ %-8s │ %-8s │ %s\033[0m │ %8d │ %8d │\n",
			e.ID, truncate(e.Name, 20), truncate(e.Region, 8), truncate(e.Industry, 8),
			logger.FormatRisk(e.RiskLevel), e.CreditScore, e.InspectedCount)
	}
	fmt.Println("└──────────┴──────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘")
}

func printEnterpriseDetail(e *enterprise.Enterprise) {
	fmt.Println("\n\033[1m企业详情\033[0m")
	fmt.Println("═══════════════════════════════════")
	fmt.Printf("  编码:     %s\n", e.ID)
	fmt.Printf("  名称:     %s\n", e.Name)
	fmt.Printf("  区域:     %s\n", e.Region)
	fmt.Printf("  行业:     %s\n", e.Industry)
	fmt.Printf("  风险等级: %s\n", logger.FormatRisk(e.RiskLevel))
	fmt.Printf("  地址:     %s\n", e.Address)
	fmt.Printf("  联系人:   %s\n", e.Contact)
	fmt.Printf("  电话:     %s\n", e.Phone)
	fmt.Printf("  信用分:   %d\n", e.CreditScore)
	fmt.Printf("  督察次数: %d\n", e.InspectedCount)
	fmt.Printf("  备注:     %s\n", e.Remark)
	fmt.Printf("  创建时间: %s\n", e.CreatedAt)
	fmt.Printf("  更新时间: %s\n", e.UpdatedAt)
	fmt.Println("═══════════════════════════════════")
}

func printRectificationTable(items []inspector.Rectification) {
	fmt.Println("\n┌──────────┬──────────┬──────────────────────┬──────────┬──────────┬──────────┬──────────┐")
	fmt.Println("│ 事项ID   │ 企业编码 │ 企业名称             │ 问题类型 │ 整改期限 │ 状态     │ 责任人   │")
	fmt.Println("├──────────┼──────────┼──────────────────────┼──────────┼──────────┼──────────┼──────────┤")
	for _, r := range items {
		fmt.Printf("│ %-8s │ %-8s │ %-20s │ %-8s │ %-8s │ %s\033[0m │ %-8s │\n",
			r.ID, r.EnterpriseID, truncate(r.EnterpriseName, 20), truncate(r.ProblemType, 8),
			r.Deadline[:10], logger.FormatStatus(r.Status), truncate(r.ResponsiblePerson, 8))
	}
	fmt.Println("└──────────┴──────────┴──────────────────────┴──────────┴──────────┴──────────┴──────────┘")
}

func printRectificationDetail(r *inspector.Rectification) {
	fmt.Println("\n\033[1m整改事项详情\033[0m")
	fmt.Println("═══════════════════════════════════")
	fmt.Printf("  事项ID:     %s\n", r.ID)
	fmt.Printf("  企业编码:   %s\n", r.EnterpriseID)
	fmt.Printf("  企业名称:   %s\n", r.EnterpriseName)
	fmt.Printf("  问题类型:   %s\n", r.ProblemType)
	fmt.Printf("  问题描述:   %s\n", r.ProblemDesc)
	fmt.Printf("  整改期限:   %s\n", r.Deadline)
	fmt.Printf("  责任人:     %s\n", r.ResponsiblePerson)
	fmt.Printf("  验收标准:   %s\n", r.AcceptanceCriteria)
	fmt.Printf("  当前状态:   %s\n", logger.FormatStatus(r.Status))
	fmt.Printf("  督察轮次:   %s\n", r.InspectorRound)
	fmt.Printf("  创建时间:   %s\n", r.CreatedAt)
	fmt.Printf("  更新时间:   %s\n", r.UpdatedAt)
	fmt.Println("═══════════════════════════════════")
}

func printProgressTable(reports []inspector.ProgressReport) {
	fmt.Println("\n┌──────────┬──────────┬──────────────────────────────────┬──────────┬──────────┐")
	fmt.Println("│ 汇报ID   │ 类型     │ 内容                             │ 审核人   │ 审核时间 │")
	fmt.Println("├──────────┼──────────┼──────────────────────────────────┼──────────┼──────────┤")
	for _, r := range reports {
		fmt.Printf("│ %-8s │ %-8s │ %-32s │ %-8s │ %-8s │\n",
			r.ID, r.ReportType, truncate(r.Content, 32), truncate(r.Reviewer, 8), truncate(r.ReviewedAt, 10))
	}
	fmt.Println("└──────────┴──────────┴──────────────────────────────────┴──────────┴──────────┘")
}

func printWarningTable(items []scheduler.WarningItem) {
	fmt.Println("\n┌──────────┬──────────────────────┬──────────┬──────────┬──────────┬──────────┐")
	fmt.Println("│ 事项ID   │ 企业名称             │ 问题类型 │ 剩余天数 │ 预警级别 │ 责任人   │")
	fmt.Println("├──────────┼──────────────────────┼──────────┼──────────┼──────────┼──────────┤")
	for _, w := range items {
		levelStr := ""
		if w.WarningLevel == 0 {
			levelStr = "\033[31m已超期\033[0m"
		} else {
			levelStr = fmt.Sprintf("\033[33m%d天\033[0m", w.WarningLevel)
		}
		daysStr := fmt.Sprintf("%d", w.DaysRemaining)
		if w.DaysRemaining < 0 {
			daysStr = fmt.Sprintf("\033[31m%d\033[0m", w.DaysRemaining)
		}
		fmt.Printf("│ %-8s │ %-20s │ %-8s │ %8s │ %s     │ %-8s │\n",
			w.RectificationID, truncate(w.EnterpriseName, 20), truncate(w.ProblemType, 8),
			daysStr, levelStr, truncate(w.ResponsiblePerson, 8))
	}
	fmt.Println("└──────────┴──────────────────────┴──────────┴──────────┴──────────┴──────────┘")
}

func printArchiveTable(items []archive.Archive) {
	fmt.Println("\n┌──────────┬──────────────────────┬──────────┬──────────┬──────────┬──────────┐")
	fmt.Println("│ 档案ID   │ 企业名称             │ 验收结论 │ 验收日期 │ 验收人   │ 备注     │")
	fmt.Println("├──────────┼──────────────────────┼──────────┼──────────┼──────────┼──────────┤")
	for _, a := range items {
		resultStr := a.AcceptanceResult
		if a.AcceptanceResult == "合格" || a.AcceptanceResult == "通过" {
			resultStr = "\033[32m" + a.AcceptanceResult + "\033[0m"
		} else {
			resultStr = "\033[31m" + a.AcceptanceResult + "\033[0m"
		}
		fmt.Printf("│ %-8s │ %-20s │ %s     │ %-8s │ %-8s │ %-8s │\n",
			a.ID, truncate(a.EnterpriseName, 20), resultStr, truncate(a.AcceptanceDate, 10),
			truncate(a.AcceptancePerson, 8), truncate(a.Remark, 8))
	}
	fmt.Println("└──────────┴──────────────────────┴──────────┴──────────┴──────────┴──────────┘")
}

func printArchiveDetail(a *archive.Archive) {
	fmt.Println("\n\033[1m验收销号档案详情\033[0m")
	fmt.Println("═══════════════════════════════════")
	fmt.Printf("  档案ID:     %s\n", a.ID)
	fmt.Printf("  整改事项ID: %s\n", a.RectificationID)
	fmt.Printf("  企业编码:   %s\n", a.EnterpriseID)
	fmt.Printf("  企业名称:   %s\n", a.EnterpriseName)
	fmt.Printf("  验收结论:   %s\n", a.AcceptanceResult)
	fmt.Printf("  验收日期:   %s\n", a.AcceptanceDate)
	fmt.Printf("  验收人:     %s\n", a.AcceptancePerson)
	fmt.Printf("  验收材料:   %s\n", a.Materials)
	fmt.Printf("  备注:       %s\n", a.Remark)
	fmt.Printf("  创建时间:   %s\n", a.CreatedAt)
	fmt.Println("═══════════════════════════════════")
}

func printReport(rpt *report.WeeklyReport) {
	fmt.Printf("\n\033[1m整改进度报告 (%s)\033[0m\n", rpt.Period)
	fmt.Println("═══════════════════════════════════")
	fmt.Printf("  总事项数:  \033[1m%d\033[0m\n", rpt.Summary.Total)
	fmt.Printf("  \033[31m待整改:\033[0m    %d\n", rpt.Summary.Pending)
	fmt.Printf("  \033[33m整改中:\033[0m    %d\n", rpt.Summary.InProgress)
	fmt.Printf("  \033[34m待验收:\033[0m    %d\n", rpt.Summary.Review)
	fmt.Printf("  \033[32m已销号:\033[0m    %d\n", rpt.Summary.Closed)
	fmt.Printf("  \033[31m超期:\033[0m      %d\n", rpt.Summary.Overdue)
	fmt.Printf("  销号率:    \033[1m%.1f%%\033[0m\n", rpt.Summary.CloseRate)
	fmt.Println("═══════════════════════════════════")

	if len(rpt.ByRegion) > 0 {
		fmt.Println("\n\033[1m按区域统计\033[0m")
		fmt.Println("───────────────────────────────────")
		for _, r := range rpt.ByRegion {
			fmt.Printf("  %-10s: 总%d 销号%d (%.1f%%) 超期%d\n",
				r.Region, r.Total, r.Closed, r.CloseRate, r.Overdue)
		}
	}

	if len(rpt.ByProblemType) > 0 {
		fmt.Println("\n\033[1m按问题类型统计\033[0m")
		fmt.Println("───────────────────────────────────")
		for _, p := range rpt.ByProblemType {
			fmt.Printf("  %-10s: 总%d 销号%d (%.1f%%)\n",
				p.ProblemType, p.Total, p.Closed, p.CloseRate)
		}
	}

	if len(rpt.OverdueList) > 0 {
		fmt.Println("\n\033[1m\033[31m超期未整改企业\033[0m")
		fmt.Println("───────────────────────────────────")
		for _, o := range rpt.OverdueList {
			fmt.Printf("  \033[31m%-20s\033[0m 超期%d项 最长%d天\n",
				o.EnterpriseName, o.OverdueCount, o.MaxOverdueDays)
		}
	}
}

func truncate(s string, maxLen int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", "")
	runes := []rune(s)
	if len(runes) > maxLen {
		return string(runes[:maxLen-2]) + ".."
	}
	return s
}

func toJSON(v interface{}) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(data)
}

func parseInt(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return n
}
