package settlement

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/xuri/excelize/v2"
	"github.com/shopspring/decimal"

	"clear-system/internal/model"
)

type ReportGenerator struct {
	OutputDir string
}

func NewReportGenerator(outputDir string) *ReportGenerator {
	return &ReportGenerator{OutputDir: outputDir}
}

type ReportData struct {
	SettleDate      string
	AllFlows        map[int64]model.ClearFlow
	MatchedResults  []model.MatchResult
	UnilateralFlows []model.UnilateralFlow
	NetPositions    []model.NetPosition
	Instructions    []model.SettleInstruction
	FilterInstID    string
	FilterBizType   string
}

func (rg *ReportGenerator) Generate(data *ReportData) (string, error) {
	if rg.OutputDir == "" {
		rg.OutputDir = "output/reports"
	}
	if err := os.MkdirAll(rg.OutputDir, 0755); err != nil {
		return "", fmt.Errorf("创建输出目录失败: %w", err)
	}

	f := excelize.NewFile()
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"2F5496"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border:    defaultBorder(),
	})
	altStyle, _ := f.NewStyle(&excelize.Style{
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"DCE6F1"}, Pattern: 1},
		Border:    defaultBorder(),
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	normalStyle, _ := f.NewStyle(&excelize.Style{
		Border:    defaultBorder(),
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	amountStyle, _ := f.NewStyle(&excelize.Style{
		Border:    defaultBorder(),
		Alignment: &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		NumFmt:    4,
	})

	rg.writeMatchDetailSheet(f, data, headerStyle, normalStyle, altStyle, amountStyle)
	rg.writeNetSummarySheet(f, data, headerStyle, normalStyle, altStyle, amountStyle)
	rg.writeAbnormalSheet(f, data, headerStyle, normalStyle, altStyle, amountStyle)
	rg.writeInstructionSheet(f, data, headerStyle, normalStyle, altStyle, amountStyle)

	f.DeleteSheet("Sheet1")

	ts := time.Now().Format("20060102_150405")
	fileName := fmt.Sprintf("清算报告_%s_%s.xlsx", data.SettleDate, ts)
	filePath := filepath.Join(rg.OutputDir, fileName)

	if err := f.SaveAs(filePath); err != nil {
		return "", fmt.Errorf("保存Excel失败: %w", err)
	}
	return filePath, nil
}

func (rg *ReportGenerator) writeMatchDetailSheet(f *excelize.File, data *ReportData, headerStyle, normalStyle, altStyle, amountStyle int) {
	sheet := "对账明细表"
	f.NewSheet(sheet)

	headers := []interface{}{"匹配ID", "业务编号", "业务类型", "业务日期",
		"发起机构", "接收机构", "金额", "币种",
		"匹配得分", "差额", "容差使用", "匹配类型", "匹配时间", "状态"}
	setRow(f, sheet, 1, headers, headerStyle)

	row := 2
	total := decimal.Zero
	for _, mr := range data.MatchedResults {
		f1, ok1 := data.AllFlows[mr.FlowID1]
		_, ok2 := data.AllFlows[mr.FlowID2]
		if !ok1 || !ok2 {
			continue
		}
		flow := f1
		if data.FilterInstID != "" && flow.SrcInstID != data.FilterInstID && flow.DstInstID != data.FilterInstID {
			continue
		}
		if data.FilterBizType != "" && string(flow.BizType) != data.FilterBizType {
			continue
		}
		style := normalStyle
		if row%2 == 0 {
			style = altStyle
		}
		tolUsed := "否"
		if mr.ToleranceUsed {
			tolUsed = "是"
		}
		vals := []interface{}{
			mr.ID, flow.BizNo, flow.BizType, flow.BizDate,
			flow.SrcInstID, flow.DstInstID, flow.Amount.InexactFloat64(), flow.Currency,
			mr.MatchScore, mr.AmountDiff.InexactFloat64(), tolUsed,
			mr.MatchType, mr.MatchTime.Format("2006-01-02 15:04:05"), "已匹配",
		}
		writeDataRow(f, sheet, row, vals, style, amountStyle, []int{6, 9})
		total = total.Add(flow.Amount)
		row++
	}
	summary := []interface{}{"合计", "", "", "", "", "", total.InexactFloat64(), "", "", "", "", "", "", fmt.Sprintf("%d 条", row-2)}
	setRow(f, sheet, row, summary, headerStyle)
	setColWidths(f, sheet, []float64{10, 22, 12, 12, 14, 14, 15, 8, 10, 12, 10, 14, 20, 10})
}

func (rg *ReportGenerator) writeNetSummarySheet(f *excelize.File, data *ReportData, headerStyle, normalStyle, altStyle, amountStyle int) {
	sheet := "轧差汇总表"
	f.NewSheet(sheet)
	headers := []interface{}{"机构ID", "币种", "应收总额", "应付总额", "净额", "匹配笔数", "挂账笔数", "状态", "生成时间"}
	setRow(f, sheet, 1, headers, headerStyle)

	row := 2
	totalRecv := decimal.Zero
	totalPay := decimal.Zero
	totalNet := decimal.Zero
	for _, p := range data.NetPositions {
		if data.FilterInstID != "" && p.InstID != data.FilterInstID {
			continue
		}
		style := normalStyle
		if row%2 == 0 {
			style = altStyle
		}
		vals := []interface{}{
			p.InstID, p.Currency,
			p.TotalReceive.InexactFloat64(), p.TotalPay.InexactFloat64(), p.NetAmount.InexactFloat64(),
			p.MatchCount, p.UnilateralCount, p.Status,
			p.CreateTime.Format("2006-01-02 15:04:05"),
		}
		writeDataRow(f, sheet, row, vals, style, amountStyle, []int{2, 3, 4})
		totalRecv = totalRecv.Add(p.TotalReceive)
		totalPay = totalPay.Add(p.TotalPay)
		totalNet = totalNet.Add(p.NetAmount)
		row++
	}
	summary := []interface{}{"合计", "", totalRecv.InexactFloat64(), totalPay.InexactFloat64(), totalNet.InexactFloat64(), "", "", "", fmt.Sprintf("%d 家机构", row-2)}
	setRow(f, sheet, row, summary, headerStyle)
	setColWidths(f, sheet, []float64{14, 8, 15, 15, 15, 10, 10, 12, 20})
}

func (rg *ReportGenerator) writeAbnormalSheet(f *excelize.File, data *ReportData, headerStyle, normalStyle, altStyle, amountStyle int) {
	sheet := "异常流水清单"
	f.NewSheet(sheet)
	headers := []interface{}{"流水ID", "业务编号", "业务类型", "业务日期",
		"发起机构", "接收机构", "金额", "币种",
		"方向", "挂账方", "挂账时间", "状态", "备注"}
	setRow(f, sheet, 1, headers, headerStyle)

	row := 2
	for _, uf := range data.UnilateralFlows {
		flow, ok := data.AllFlows[uf.FlowID]
		if !ok {
			continue
		}
		if data.FilterInstID != "" && uf.InstID != data.FilterInstID {
			continue
		}
		if data.FilterBizType != "" && string(flow.BizType) != data.FilterBizType {
			continue
		}
		style := normalStyle
		if row%2 == 0 {
			style = altStyle
		}
		vals := []interface{}{
			flow.ID, flow.BizNo, flow.BizType, flow.BizDate,
			flow.SrcInstID, flow.DstInstID, flow.Amount.InexactFloat64(), flow.Currency,
			flow.Direction, uf.PendingSide,
			uf.HangTime.Format("2006-01-02 15:04:05"), uf.Status, flow.Remark,
		}
		writeDataRow(f, sheet, row, vals, style, amountStyle, []int{6})
		row++
	}
	if row == 2 {
		vals := []interface{}{"-", "-", "-", "-", "-", "-", 0, "-", "-", "-", "-", "-", "无异常流水"}
		writeDataRow(f, sheet, row, vals, normalStyle, amountStyle, []int{6})
		row++
	}
	setColWidths(f, sheet, []float64{10, 22, 12, 12, 14, 14, 15, 8, 8, 10, 20, 12, 20})
}

func (rg *ReportGenerator) writeInstructionSheet(f *excelize.File, data *ReportData, headerStyle, normalStyle, altStyle, amountStyle int) {
	sheet := "清算指令清单"
	f.NewSheet(sheet)
	headers := []interface{}{"指令编号", "清算日期", "付款方", "收款方", "金额", "币种", "格式", "状态", "生成时间"}
	setRow(f, sheet, 1, headers, headerStyle)

	row := 2
	total := decimal.Zero
	for _, inst := range data.Instructions {
		if data.FilterInstID != "" && inst.SenderInstID != data.FilterInstID && inst.ReceiverInstID != data.FilterInstID {
			continue
		}
		style := normalStyle
		if row%2 == 0 {
			style = altStyle
		}
		vals := []interface{}{
			inst.InstructionNo, inst.SettleDate, inst.SenderInstID, inst.ReceiverInstID,
			inst.Amount.InexactFloat64(), inst.Currency, inst.Format, inst.Status,
			inst.CreateTime.Format("2006-01-02 15:04:05"),
		}
		writeDataRow(f, sheet, row, vals, style, amountStyle, []int{4})
		total = total.Add(inst.Amount)
		row++
	}
	if row == 2 {
		vals := []interface{}{"-", data.SettleDate, "-", "-", 0, "CNY", "-", "-", "无指令"}
		writeDataRow(f, sheet, row, vals, normalStyle, amountStyle, []int{4})
		row++
	}
	summary := []interface{}{"合计", "", "", "", total.InexactFloat64(), "", "", "", fmt.Sprintf("%d 条", row-2)}
	setRow(f, sheet, row, summary, headerStyle)
	setColWidths(f, sheet, []float64{34, 12, 16, 16, 15, 8, 10, 10, 20})
}

func setRow(f *excelize.File, sheet string, row int, vals []interface{}, style int) {
	for col, val := range vals {
		cell := cellName(col, row)
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, style)
	}
}

func writeDataRow(f *excelize.File, sheet string, row int, vals []interface{}, defaultStyle, amountStyle int, amountCols []int) {
	amtColSet := make(map[int]bool)
	for _, c := range amountCols {
		amtColSet[c] = true
	}
	for col, val := range vals {
		cell := cellName(col, row)
		f.SetCellValue(sheet, cell, val)
		style := defaultStyle
		if amtColSet[col] {
			style = amountStyle
		}
		f.SetCellStyle(sheet, cell, cell, style)
	}
}

func cellName(col, row int) string {
	name, _ := excelize.CoordinatesToCellName(col+1, row)
	return name
}

func setColWidths(f *excelize.File, sheet string, widths []float64) {
	for i, w := range widths {
		col := string(rune('A' + i))
		f.SetColWidth(sheet, col, col, w)
	}
}

func defaultBorder() []excelize.Border {
	return []excelize.Border{
		{Type: "left", Color: "BFBFBF", Style: 1},
		{Type: "top", Color: "BFBFBF", Style: 1},
		{Type: "bottom", Color: "BFBFBF", Style: 1},
		{Type: "right", Color: "BFBFBF", Style: 1},
	}
}
