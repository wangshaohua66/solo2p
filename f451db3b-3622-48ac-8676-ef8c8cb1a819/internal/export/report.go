// Package export renders the monthly settlement report and the dispatch-log
// archive to CSV and JSON. The settlement report is deliberately aligned with
// a finance reconciliation sheet (volume, unit price, amount, tax, total) and
// carries signature placeholders so it can be signed off after export.
package export

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	"scheduler/internal/models"
)

// ExportSettlementCSV writes a monthly settlement report. A UTF-8 BOM is
// emitted so Chinese headers render correctly when opened in Excel.
func ExportSettlementCSV(rows []models.SettlementRow, w io.Writer) error {
	cw := csv.NewWriter(w)
	if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}
	header := []string{"序号", "用户编号", "用户名称", "累计购气量(Nm³)", "单价(元/Nm³)",
		"结算金额(元)", "税额(元)", "含税金额(元)", "结算月份"}
	if err := cw.Write(header); err != nil {
		return err
	}
	var grandVol, grandAmount, grandTax, grandTotal float64
	for i, r := range rows {
		idx := strconv.Itoa(i + 1)
		if err := cw.Write([]string{
			idx, r.UserID, r.UserName,
			fmt.Sprintf("%.2f", r.Volume),
			fmt.Sprintf("%.4f", r.UnitPrice),
			fmt.Sprintf("%.2f", r.Amount),
			fmt.Sprintf("%.2f", r.TaxAmount),
			fmt.Sprintf("%.2f", r.TotalAmount),
			r.Month,
		}); err != nil {
			return err
		}
		grandVol += r.Volume
		grandAmount += r.Amount
		grandTax += r.TaxAmount
		grandTotal += r.TotalAmount
	}
	_ = cw.Write([]string{
		"合计", "", "",
		fmt.Sprintf("%.2f", grandVol), "",
		fmt.Sprintf("%.2f", grandAmount),
		fmt.Sprintf("%.2f", grandTax),
		fmt.Sprintf("%.2f", grandTotal), "",
	})
	_ = cw.Write([]string{})
	_ = cw.Write([]string{"", "", "", "", "", "调度中心签字：__________", "", "财务复核签字：__________", ""})
	_ = cw.Write([]string{"", "", "", "", "", "签字日期：____年__月__日", "", "签字日期：____年__月__日", ""})
	cw.Flush()
	return cw.Error()
}

// ExportDispatchCSV writes the dispatch-log archive as CSV with the same BOM.
func ExportDispatchCSV(in []models.DispatchInstruction, w io.Writer) error {
	cw := csv.NewWriter(w)
	if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}
	header := []string{"指令编号", "站点编号", "站点名称", "紧急程度", "调节类型",
		"目标值", "当前值", "执行开始", "执行结束", "调度依据", "安全提示", "调度员", "状态", "生成时间"}
	if err := cw.Write(header); err != nil {
		return err
	}
	for _, d := range in {
		if err := cw.Write([]string{
			d.ID, d.StationID, d.StationName, string(d.Urgency), d.AdjustType,
			fmt.Sprintf("%.4f", d.TargetValue),
			fmt.Sprintf("%.4f", d.Current),
			d.ExecuteFrom.Format("2006-01-02 15:04:05"),
			d.ExecuteTo.Format("2006-01-02 15:04:05"),
			d.Reason, d.SafetyNotes, d.Operator, d.Status,
			d.CreatedAt.Format("2006-01-02 15:04:05"),
		}); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

// ExportDispatchJSON writes the dispatch-log archive as pretty-printed JSON.
func ExportDispatchJSON(in []models.DispatchInstruction, w io.Writer) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(in)
}

// ExportReadingsCSV writes raw meter readings as CSV, used for hand-off to the
// finance/metering reconciliation when requested.
func ExportReadingsCSV(in []models.Reading, w io.Writer) error {
	cw := csv.NewWriter(w)
	if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}
	if err := cw.Write([]string{"序号", "站点编号", "时间戳", "压力(MPa)", "温度(℃)",
		"瞬时流量(Nm³/h)", "累计量(Nm³)", "有效性", "异常原因"}); err != nil {
		return err
	}
	for i, r := range in {
		valid := "无效"
		if r.Valid {
			valid = "有效"
		}
		if err := cw.Write([]string{
			strconv.Itoa(i + 1), r.StationID,
			r.Timestamp.Format("2006-01-02 15:04:05"),
			fmt.Sprintf("%.4f", r.Pressure),
			fmt.Sprintf("%.2f", r.Temperature),
			fmt.Sprintf("%.2f", r.FlowRate),
			fmt.Sprintf("%.2f", r.Accumulated),
			valid, r.Anomaly,
		}); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}
