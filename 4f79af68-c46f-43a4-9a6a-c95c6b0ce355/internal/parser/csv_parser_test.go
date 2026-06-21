package parser

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewCSVParser(t *testing.T) {
	p := NewCSVParser()
	if p == nil {
		t.Fatal("NewCSVParser() returned nil")
	}
	if p.mapping.RouteID == nil {
		t.Error("Default column mapping should have RouteID candidates")
	}
}

func TestImportFromDir_EmptyDir(t *testing.T) {
	p := NewCSVParser()
	emptyDir := t.TempDir()
	_, err := p.ImportFromDir(emptyDir)
	if err == nil {
		t.Error("ImportFromDir on empty dir should return error")
	}
}

func TestImportFromDir_NonexistentDir(t *testing.T) {
	p := NewCSVParser()
	_, err := p.ImportFromDir("/nonexistent/path/12345")
	if err == nil {
		t.Error("ImportFromDir on nonexistent dir should return error")
	}
}

func TestImportFromDir_ValidCSV(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,1.2,3.0,0.5,30000,3,养护一中心,2024-01-15
G108,K1+000,K2+000,2.5,8.0,5.0,25000,2,养护一中心,2024-01-15
S305,K0+000,K1+000,4.0,12.0,10.0,20000,1.5,养护三中心,2024-01-16
`
	csvFile := filepath.Join(dir, "test_data.csv")
	if err := os.WriteFile(csvFile, []byte(csvContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() error: %v", err)
	}
	if result.TotalFiles != 1 {
		t.Errorf("TotalFiles = %d, want 1", result.TotalFiles)
	}
	if result.SuccessFiles != 1 {
		t.Errorf("SuccessFiles = %d, want 1", result.SuccessFiles)
	}
	if result.SuccessRecords != 3 {
		t.Errorf("SuccessRecords = %d, want 3", result.SuccessRecords)
	}
	if result.FailedRecords != 0 {
		t.Errorf("FailedRecords = %d, want 0", result.FailedRecords)
	}
}

func TestImportFromDir_EnglishHeaders(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	csvContent := `route_id,start_station,end_station,iri,rut_depth,crack_density,traffic_volume,importance,maintenance_center,detect_date
G207,K0+000,K1+000,2.0,5.0,2.0,15000,2,养护五中心,2024-02-01
`
	csvFile := filepath.Join(dir, "en_data.csv")
	if err := os.WriteFile(csvFile, []byte(csvContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() error: %v", err)
	}
	if result.SuccessRecords != 1 {
		t.Errorf("SuccessRecords = %d, want 1", result.SuccessRecords)
	}
}

func TestImportFromDir_MultipleFiles(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	csv1 := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,1.0,3.0,0.5,30000,3,养护一中心,2024-01-15
`
	csv2 := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
S305,K0+000,K1+000,2.0,5.0,2.0,15000,2,养护三中心,2024-01-16
`

	if err := os.WriteFile(filepath.Join(dir, "file1.csv"), []byte(csv1), 0644); err != nil {
		t.Fatalf("Failed to create CSV: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "file2.csv"), []byte(csv2), 0644); err != nil {
		t.Fatalf("Failed to create CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() error: %v", err)
	}
	if result.TotalFiles != 2 {
		t.Errorf("TotalFiles = %d, want 2", result.TotalFiles)
	}
	if result.SuccessRecords != 2 {
		t.Errorf("SuccessRecords = %d, want 2", result.SuccessRecords)
	}
}

func TestImportFromDir_InvalidCSV(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	invalidContent := `this,is,not,valid,header,data
1,2,3,4,5,6
`
	csvFile := filepath.Join(dir, "invalid.csv")
	if err := os.WriteFile(csvFile, []byte(invalidContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() should not error on partially valid data: %v", err)
	}
	if result.TotalRecords == 0 && result.FailedRecords == 0 {
		t.Log("No records from invalid CSV, as expected")
	}
}

func TestImportFromDir_OutlierClamping(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,25.0,60.0,50.0,30000,3,养护一中心,2024-01-15
`
	csvFile := filepath.Join(dir, "outlier.csv")
	if err := os.WriteFile(csvFile, []byte(csvContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() error: %v", err)
	}
	if result.SuccessRecords != 1 {
		t.Errorf("SuccessRecords = %d, want 1", result.SuccessRecords)
	}

	records := p.GetParsedRecords(result)
	if len(records) > 0 {
		r := records[0]
		if r.IRI > 20 {
			t.Errorf("IRI = %.2f, should be clamped to <= 20", r.IRI)
		}
		if r.RutDepth > 50 {
			t.Errorf("RutDepth = %.2f, should be clamped to <= 50", r.RutDepth)
		}
		if r.CrackDensity > 100 {
			t.Errorf("CrackDensity = %.2f, should be clamped to <= 100", r.CrackDensity)
		}
	}
}

func TestImportFromDir_NegativeValuesClamped(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,-1.0,-2.0,-3.0,30000,3,养护一中心,2024-01-15
`
	csvFile := filepath.Join(dir, "negative.csv")
	if err := os.WriteFile(csvFile, []byte(csvContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() error: %v", err)
	}
	if result.SuccessRecords != 1 {
		t.Errorf("SuccessRecords = %d, want 1 (negative values should be clamped)", result.SuccessRecords)
	}

	records := p.GetParsedRecords(result)
	if len(records) > 0 {
		r := records[0]
		if r.IRI < 0 {
			t.Errorf("IRI = %.2f, should be clamped to >= 0", r.IRI)
		}
		if r.RutDepth < 0 {
			t.Errorf("RutDepth = %.2f, should be clamped to >= 0", r.RutDepth)
		}
		if r.CrackDensity < 0 {
			t.Errorf("CrackDensity = %.2f, should be clamped to >= 0", r.CrackDensity)
		}
	}
}

func TestGetParsedRecords(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期
G108,K0+000,K1+000,1.2,3.0,0.5,30000,3,养护一中心,2024-01-15
`
	csvFile := filepath.Join(dir, "test.csv")
	if err := os.WriteFile(csvFile, []byte(csvContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() error: %v", err)
	}

	records := p.GetParsedRecords(result)
	if len(records) != 1 {
		t.Fatalf("GetParsedRecords returned %d records, want 1", len(records))
	}

	r := records[0]
	if r.RouteID != "G108" {
		t.Errorf("RouteID = %q, want %q", r.RouteID, "G108")
	}
	if r.SectionLength != 1.0 {
		t.Errorf("SectionLength = %.2f, want 1.00", r.SectionLength)
	}
}

func TestImportFromDir_NonCSVFilesIgnored(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	txtFile := filepath.Join(dir, "readme.txt")
	if err := os.WriteFile(txtFile, []byte("not a csv"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	_, err := p.ImportFromDir(dir)
	if err == nil {
		t.Error("ImportFromDir on dir with no CSV files should return error")
	}
}

func TestImportFromDir_BatchIDFromCSV(t *testing.T) {
	p := NewCSVParser()
	dir := t.TempDir()

	csvContent := `路线编号,起始桩号,终止桩号,平整度,车辙深度,裂缝密度,交通量,重要性,养护中心,检测日期,批次号
G108,K0+000,K1+000,1.2,3.0,0.5,30000,3,养护一中心,2024-01-15,Q1-2024
`
	csvFile := filepath.Join(dir, "batch.csv")
	if err := os.WriteFile(csvFile, []byte(csvContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV: %v", err)
	}

	result, err := p.ImportFromDir(dir)
	if err != nil {
		t.Fatalf("ImportFromDir() error: %v", err)
	}
	if len(result.SuccessBatchIDs) == 0 {
		t.Error("Expected batch ID from CSV, got none")
	}
}
