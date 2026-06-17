package utils

import (
	"bytes"
	"fmt"
	"time"

	"github.com/jung-kurt/gofpdf"
)

const (
	fontDir = "fonts/"
)

type ReportData struct {
	ReportNo      string
	Institution   string
	PatientName   string
	PatientID     string
	Gender        string
	Age           int
	CollectTime   time.Time
	ReportTime    time.Time
	Doctor        string
	Reviewer      string
	Items         []ReportItemData
	Signature     string
	Barcode       string
	SignContent   string
}

type ReportItemData struct {
	ItemName     string
	ItemCode     string
	Result       string
	Unit         string
	RefRange     string
	IsCritical   bool
	IsAbnormal   bool
	AbnormalFlag string
}

func registerUnicodeFont(pdf *gofpdf.Fpdf) {
	pdf.AddUTF8Font("NotoSansSC", "", "NotoSansSC-Regular.ttf")
	pdf.AddUTF8Font("NotoSansSC", "B", "NotoSansSC-Bold.ttf")
	pdf.AddUTF8Font("NotoSansSC", "I", "NotoSansSC-Regular.ttf")
	pdf.AddUTF8Font("NotoSansSC", "BI", "NotoSansSC-Bold.ttf")
}

func GenerateReportPDF(data *ReportData) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", fontDir)
	pdf.AddPage()
	pdf.SetAutoPageBreak(true, 20)

	registerUnicodeFont(pdf)

	pdf.SetFont("NotoSansSC", "B", 18)
	pdf.Cell(0, 15, "医学检验报告")
	pdf.Ln(20)

	pdf.SetFont("NotoSansSC", "B", 12)
	pdf.Cell(40, 8, "报告编号：")
	pdf.SetFont("NotoSansSC", "", 12)
	pdf.Cell(0, 8, data.ReportNo)
	pdf.Ln(10)

	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(30, 7, "送检机构：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(60, 7, data.Institution)
	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(25, 7, "患者姓名：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(0, 7, data.PatientName)
	pdf.Ln(7)

	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(30, 7, "患者ID：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(60, 7, data.PatientID)
	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(25, 7, "性别：")
	pdf.SetFont("NotoSansSC", "", 10)
	genderDisplay := data.Gender
	switch data.Gender {
	case "MALE":
		genderDisplay = "男"
	case "FEMALE":
		genderDisplay = "女"
	default:
		genderDisplay = "未知"
	}
	pdf.Cell(30, 7, genderDisplay)
	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(20, 7, "年龄：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(0, 7, fmt.Sprintf("%d岁", data.Age))
	pdf.Ln(7)

	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(30, 7, "采集时间：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(60, 7, data.CollectTime.Format("2006-01-02 15:04"))
	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(25, 7, "报告时间：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(0, 7, data.ReportTime.Format("2006-01-02 15:04"))
	pdf.Ln(12)

	pdf.SetFont("NotoSansSC", "B", 11)
	pdf.Cell(0, 8, "检验结果")
	pdf.Ln(10)

	pdf.SetFont("NotoSansSC", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.CellFormat(30, 7, "项目代码", "1", 0, "C", true, 0, "")
	pdf.CellFormat(50, 7, "项目名称", "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 7, "检验结果", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "单位", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 7, "参考范围", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "提示", "1", 0, "C", true, 0, "")
	pdf.Ln(-1)

	pdf.SetFont("NotoSansSC", "", 9)
	for _, item := range data.Items {
		if item.IsCritical {
			pdf.SetTextColor(255, 0, 0)
			pdf.SetFont("NotoSansSC", "B", 9)
		} else if item.IsAbnormal {
			pdf.SetTextColor(255, 165, 0)
		} else {
			pdf.SetTextColor(0, 0, 0)
		}

		pdf.CellFormat(30, 6, item.ItemCode, "1", 0, "L", false, 0, "")
		pdf.CellFormat(50, 6, item.ItemName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(30, 6, item.Result, "1", 0, "R", false, 0, "")
		pdf.CellFormat(20, 6, item.Unit, "1", 0, "C", false, 0, "")
		pdf.CellFormat(40, 6, item.RefRange, "1", 0, "L", false, 0, "")
		flagDisplay := item.AbnormalFlag
		switch item.AbnormalFlag {
		case "L":
			flagDisplay = "↓"
		case "H":
			flagDisplay = "↑"
		case "!!L":
			flagDisplay = "危急↓"
		case "!!H":
			flagDisplay = "危急↑"
		}
		pdf.CellFormat(20, 6, flagDisplay, "1", 0, "C", false, 0, "")
		pdf.Ln(-1)
	}
	pdf.SetTextColor(0, 0, 0)

	pdf.Ln(15)
	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(40, 8, "检验医师：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(60, 8, data.Doctor)
	pdf.SetFont("NotoSansSC", "B", 10)
	pdf.Cell(40, 8, "审核医师：")
	pdf.SetFont("NotoSansSC", "", 10)
	pdf.Cell(0, 8, data.Reviewer)
	pdf.Ln(15)

	pdf.SetFont("NotoSansSC", "I", 8)
	pdf.Cell(0, 5, fmt.Sprintf("数字签名内容：%s", data.SignContent))
	pdf.Ln(5)
	pdf.Cell(0, 5, fmt.Sprintf("RSA签名值：%s", truncateString(data.Signature, 60)))
	pdf.Ln(5)
	pdf.Cell(0, 5, fmt.Sprintf("样本条码：%s", data.Barcode))

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, fmt.Errorf("generate pdf failed: %v", err)
	}
	return buf.Bytes(), nil
}

func truncateString(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
