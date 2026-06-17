package utils

import (
	"fmt"
	"time"

	"github.com/jung-kurt/gofpdf"
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

func GenerateReportPDF(data *ReportData) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetAutoPageBreak(true, 20)

	pdf.SetFont("Arial", "B", 18)
	pdf.Cell(0, 15, "MEDICAL LABORATORY REPORT")
	pdf.Ln(20)

	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(40, 8, "Report No.:")
	pdf.SetFont("Arial", "", 12)
	pdf.Cell(0, 8, data.ReportNo)
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(30, 7, "Institution:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(60, 7, data.Institution)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(25, 7, "Patient:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 7, data.PatientName)
	pdf.Ln(7)

	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(30, 7, "Patient ID:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(60, 7, data.PatientID)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(25, 7, "Gender:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(30, 7, data.Gender)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(20, 7, "Age:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 7, fmt.Sprintf("%d", data.Age))
	pdf.Ln(7)

	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(30, 7, "Collect:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(60, 7, data.CollectTime.Format("2006-01-02 15:04"))
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(25, 7, "Report:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 7, data.ReportTime.Format("2006-01-02 15:04"))
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 11)
	pdf.Cell(0, 8, "TEST RESULTS")
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.CellFormat(30, 7, "Code", "1", 0, "C", true, 0, "")
	pdf.CellFormat(50, 7, "Item", "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 7, "Result", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "Unit", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 7, "Ref Range", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "Flag", "1", 0, "C", true, 0, "")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 9)
	for _, item := range data.Items {
		if item.IsCritical {
			pdf.SetTextColor(255, 0, 0)
			pdf.SetFont("Arial", "B", 9)
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
		pdf.CellFormat(20, 6, item.AbnormalFlag, "1", 0, "C", false, 0, "")
		pdf.Ln(-1)
	}
	pdf.SetTextColor(0, 0, 0)

	pdf.Ln(15)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(40, 8, "Doctor:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(60, 8, data.Doctor)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(40, 8, "Reviewer:")
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 8, data.Reviewer)
	pdf.Ln(15)

	pdf.SetFont("Arial", "I", 8)
	pdf.Cell(0, 5, fmt.Sprintf("Signature: %s", data.Signature))
	pdf.Ln(5)
	pdf.Cell(0, 5, fmt.Sprintf("Barcode: %s", data.Barcode))

	var buf []byte
	err := pdf.OutputAndClose(&buf)
	if err != nil {
		return nil, fmt.Errorf("generate pdf failed: %v", err)
	}
	return buf, nil
}
