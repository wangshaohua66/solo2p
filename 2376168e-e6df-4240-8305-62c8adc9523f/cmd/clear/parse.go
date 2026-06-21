package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/schollz/progressbar/v3"
	"github.com/spf13/cobra"

	"clear-system/internal/model"
	"clear-system/internal/parser"
)

var (
	inputFile  string
	format     string
	templateFile string
	resume     bool
	batchSize  int
	srcInstID  string
)

var parseCmd = &cobra.Command{
	Use:   "parse",
	Short: "解析清算文件（支持CSV/定宽文本/XML）",
	Long: `parse 命令将各机构报送的清算文件解析为标准流水结构，
支持断点续传，解析结果写入SQLite数据库。

示例：
  clear parse -f csv -t templates/csv_tpl.yaml -i data/inst01.csv --src INST001 -d 2026-06-22
  clear parse -f fixed -t templates/fw_tpl.yaml -i data/inst02.txt --resume
  clear parse -f xml   -t templates/xml_tpl.yaml -i data/inst03.xml --batch 2000
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if inputFile == "" {
			return fmt.Errorf("请通过 -i/--input 指定输入文件")
		}
		if _, err := os.Stat(inputFile); os.IsNotExist(err) {
			return fmt.Errorf("输入文件不存在: %s", inputFile)
		}
		if templateFile == "" {
			return fmt.Errorf("请通过 -t/--template 指定模板文件")
		}
		if _, err := os.Stat(templateFile); os.IsNotExist(err) {
			return fmt.Errorf("模板文件不存在: %s", templateFile)
		}
		tmpl, err := parser.LoadTemplate(templateFile)
		if err != nil {
			return err
		}
		if format != "" {
			tmpl.Format = format
		}
		if tmpl.Format == "" {
			tmpl.Format = detectFormat(inputFile)
		}
		p, err := parser.GetParser(tmpl.Format)
		if err != nil {
			return err
		}
		absPath, _ := filepath.Abs(inputFile)
		fileHash, err := parser.ComputeFileHash(inputFile)
		if err != nil {
			return fmt.Errorf("计算文件哈希失败: %w", err)
		}
		fmt.Printf("%s 文件格式: %s\n", cyan("[INFO]"), tmpl.Format)
		fmt.Printf("%s 文件路径: %s\n", cyan("[INFO]"), absPath)
		fmt.Printf("%s 文件哈希: %s...\n", cyan("[INFO]"), fileHash[:16])

		var opts []parser.ParseOption
		var bar *progressbar.ProgressBar
		lastLine := int64(0)
		lastOffset := int64(0)
		if resume {
			ll, lo, _, err := database.GetParseProgress(fileHash)
			if err == nil && ll > 0 {
				lastLine = ll
				lastOffset = lo
				fmt.Printf("%s 从上次中断处继续: 行=%d, 偏移=%d\n", yellow("[RESUME]"), lastLine, lastOffset)
				opts = append(opts, parser.WithResume(fileHash, lastLine, lastOffset))
			}
		}

		opts = append(opts, parser.WithBatch(batchSize, func(flows []model.ClearFlow, start int64) error {
			if srcInstID != "" {
				for i := range flows {
					if flows[i].SrcInstID == "" {
						flows[i].SrcInstID = srcInstID
					}
				}
			}
			if !dryRun {
				_, dbErr := database.InsertFlows(flows)
				if dbErr != nil {
					return fmt.Errorf("写入数据库失败: %w", dbErr)
				}
			}
			return nil
		}))

		opts = append(opts, parser.WithProgress(func(line, success, fail int64) {
			if bar != nil {
				bar.Set64(line)
			}
		}))

		bar = progressbar.NewOptions64(-1,
			progressbar.OptionSetDescription("解析中..."),
			progressbar.OptionSetWriter(os.Stdout),
			progressbar.OptionShowCount(),
			progressbar.OptionThrottle(200*time.Millisecond),
			progressbar.OptionClearOnFinish(),
		)
		start := time.Now()
		result, err := p.Parse(inputFile, tmpl, opts...)
		bar.Finish()
		fmt.Println()
		if err != nil {
			return fmt.Errorf("解析失败: %w", err)
		}

		if !dryRun {
			_ = database.SaveParseProgress(fileHash, absPath, lastLine+result.TotalLines, lastOffset, lastLine+result.TotalLines)
		}
		elapsed := time.Since(start)
		fmt.Printf("%s 解析完成 总记录:%d 成功:%d 失败:%d 耗时:%v\n",
			green("[SUCCESS]"), result.TotalLines, result.SuccessCount, result.FailCount, elapsed)

		if len(result.Errors) > 0 {
			fmt.Printf("%s 错误记录 (最多显示前10条):\n", red("[ERRORS]"))
			for i, e := range result.Errors {
				if i >= 10 {
					break
				}
				fmt.Printf("  行%d: %s\n", e.LineNo, e.Message)
			}
		}
		writeAudit("PARSE", "CLI",
			fmt.Sprintf("file=%s format=%s total=%d success=%d fail=%d",
				filepath.Base(inputFile), tmpl.Format, result.TotalLines, result.SuccessCount, result.FailCount),
			"SUCCESS")
		return nil
	},
}

func init() {
	parseCmd.Flags().StringVarP(&inputFile, "input", "i", "", "输入清算文件路径")
	parseCmd.Flags().StringVarP(&format, "format", "f", "", "文件格式: csv/fixed/xml (默认根据扩展名)")
	parseCmd.Flags().StringVarP(&templateFile, "template", "t", "", "解析模板文件 (YAML)")
	parseCmd.Flags().BoolVar(&resume, "resume", false, "从上次中断处继续解析")
	parseCmd.Flags().IntVar(&batchSize, "batch", 5000, "批量写入大小")
	parseCmd.Flags().StringVar(&srcInstID, "src", "", "源机构ID（文件中未包含时使用）")
	_ = parseCmd.MarkFlagRequired("input")
	_ = parseCmd.MarkFlagRequired("template")
}

func detectFormat(path string) string {
	ext := filepath.Ext(path)
	switch ext {
	case ".csv":
		return "csv"
	case ".txt", ".dat", ".fw":
		return "fixed"
	case ".xml":
		return "xml"
	default:
		return "csv"
	}
}
