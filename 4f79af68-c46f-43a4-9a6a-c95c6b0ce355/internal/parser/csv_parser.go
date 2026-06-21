package parser

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	pverrors "pavement/internal/errors"
	"pavement/internal/storage"
	"pavement/internal/validator"
)

type ColumnMapping struct {
	RouteID           []string
	StartStation      []string
	EndStation        []string
	SectionLength     []string
	IRI               []string
	RutDepth          []string
	CrackDensity      []string
	TrafficVolume     []string
	Importance        []string
	MaintenanceCenter []string
	DetectDate        []string
	BatchID           []string
}

var defaultColumnMapping = ColumnMapping{
	RouteID:           []string{"route_id", "routeid", "route", "路线编号", "路线", "线路编号", "线路"},
	StartStation:      []string{"start_station", "startstation", "start_sta", "起始桩号", "起点桩号", "起始里程"},
	EndStation:        []string{"end_station", "endstation", "end_sta", "终止桩号", "终点桩号", "终止里程"},
	SectionLength:     []string{"section_length", "length", "mileage", "距离", "路段长度", "里程", "长度"},
	IRI:               []string{"iri", "平整度", "国际平整度指数", "iri_index"},
	RutDepth:          []string{"rut_depth", "rutdepth", "rut", "车辙", "车辙深度"},
	CrackDensity:      []string{"crack_density", "crackdensity", "crack", "裂缝", "裂缝密度", "裂缝率"},
	TrafficVolume:     []string{"traffic_volume", "trafficvolume", "traffic", "交通量", "交通流量", "AADT", "年平均日交通量"},
	Importance:        []string{"importance", "weight", "重要性", "权重", "重要性权重"},
	MaintenanceCenter: []string{"maintenance_center", "maintenancecenter", "center", "养护中心", "养护单位", "管养单位"},
	DetectDate:        []string{"detect_date", "detectdate", "date", "检测日期", "日期", "采集日期"},
	BatchID:           []string{"batch_id", "batchid", "batch", "批次号", "批次", "检测批次"},
}

type ImportResult struct {
	TotalFiles      int
	SuccessFiles    int
	FailedFiles     int
	TotalRecords    int
	SuccessRecords  int
	FailedRecords   int
	FailedDetails   []FailedDetail
	SuccessBatchIDs []string
	ParsedRecords   []*storage.PavementRecord
}

type FailedDetail struct {
	FileName  string
	RowNumber int
	Reason    string
	RawData   map[string]string
}

type CSVParser struct {
	mapping ColumnMapping
}

func NewCSVParser() *CSVParser {
	return &CSVParser{
		mapping: defaultColumnMapping,
	}
}

func (p *CSVParser) ImportFromDir(dirPath string) (*ImportResult, error) {
	result := &ImportResult{
		FailedDetails: make([]FailedDetail, 0),
	}

	csvFiles, err := findCSVFiles(dirPath)
	if err != nil {
		return nil, err
	}
	result.TotalFiles = len(csvFiles)
	if result.TotalFiles == 0 {
		return nil, pverrors.NewImportError(
			pverrors.ErrImportEmptyData,
			fmt.Sprintf("目录中未找到CSV文件: %s", dirPath),
			"请确认目录中存在.csv文件",
			nil,
		)
	}

	records := make([]*storage.PavementRecord, 0)
	batchIDs := make(map[string]bool)

	for _, file := range csvFiles {
		fileRecords, fileErrCount, fileDetails, batchID, err := p.parseFile(file)
		if err != nil {
			result.FailedFiles++
			result.FailedDetails = append(result.FailedDetails, FailedDetail{
				FileName: file,
				Reason:   err.Error(),
			})
			continue
		}
		result.SuccessFiles++
		result.TotalRecords += len(fileRecords) + fileErrCount
		result.SuccessRecords += len(fileRecords)
		result.FailedRecords += fileErrCount
		result.FailedDetails = append(result.FailedDetails, fileDetails...)
		records = append(records, fileRecords...)
		if batchID != "" {
			batchIDs[batchID] = true
		}
	}

	for bid := range batchIDs {
		result.SuccessBatchIDs = append(result.SuccessBatchIDs, bid)
	}

	result.ParsedRecords = records
	return result, nil
}

func (p *CSVParser) GetParsedRecords(result *ImportResult) []*storage.PavementRecord {
	return result.ParsedRecords
}

func (p *CSVParser) parseFile(filePath string) ([]*storage.PavementRecord, int, []FailedDetail, string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, 0, nil, "", pverrors.NewImportError(
			pverrors.ErrImportFileNotFound,
			fmt.Sprintf("无法打开文件: %s", filePath),
			"请检查文件是否存在以及权限设置",
			err,
		)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return nil, 0, nil, "", pverrors.NewImportError(
			pverrors.ErrImportFormatInvalid,
			fmt.Sprintf("读取CSV表头失败: %s", filePath),
			"请确保CSV文件格式正确，第一行为表头",
			err,
		)
	}

	headerMap := p.buildHeaderMap(headers)
	if !p.hasRequiredColumns(headerMap) {
		return nil, 0, nil, "", pverrors.NewImportError(
			pverrors.ErrImportColumnMissing,
			fmt.Sprintf("CSV缺少必要列: %s", filePath),
			"请确保包含路线编号、起始桩号、终止桩号、IRI、车辙深度、裂缝密度等必要列",
			nil,
		)
	}

	records := make([]*storage.PavementRecord, 0)
	failedDetails := make([]FailedDetail, 0)
	failedCount := 0
	rowNum := 1
	fileBatchID := ""

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		rowNum++
		if err != nil {
			failedCount++
			failedDetails = append(failedDetails, FailedDetail{
				FileName:  filePath,
				RowNumber: rowNum,
				Reason:    fmt.Sprintf("读取行失败: %v", err),
			})
			continue
		}

		rowData := make(map[string]string)
		for i, h := range headers {
			if i < len(row) {
				rowData[strings.ToLower(strings.TrimSpace(h))] = strings.TrimSpace(row[i])
			}
		}

		record, err := p.parseRow(row, headers, headerMap, filePath, rowNum)
		if err != nil {
			failedCount++
			failedDetails = append(failedDetails, FailedDetail{
				FileName:  filePath,
				RowNumber: rowNum,
				Reason:    err.Error(),
				RawData:   rowData,
			})
			continue
		}
		records = append(records, record)
		if fileBatchID == "" && record.BatchID != "" {
			fileBatchID = record.BatchID
		}
	}

	if fileBatchID == "" {
		fileBatchID = fmt.Sprintf("BATCH_%s", time.Now().Format("20060102_150405"))
		for _, r := range records {
			r.BatchID = fileBatchID
		}
	}

	return records, failedCount, failedDetails, fileBatchID, nil
}

func (p *CSVParser) buildHeaderMap(headers []string) map[string]int {
	headerMap := make(map[string]int)
	normalized := make([]string, len(headers))
	for i, h := range headers {
		normalized[i] = strings.ToLower(strings.TrimSpace(h))
	}

	for fieldName, candidates := range p.getMappingFields() {
		for i, h := range normalized {
			for _, candidate := range candidates {
				if h == strings.ToLower(candidate) {
					headerMap[fieldName] = i
					break
				}
			}
			if _, exists := headerMap[fieldName]; exists {
				break
			}
		}
	}
	return headerMap
}

func (p *CSVParser) getMappingFields() map[string][]string {
	return map[string][]string{
		"route_id":           p.mapping.RouteID,
		"start_station":      p.mapping.StartStation,
		"end_station":        p.mapping.EndStation,
		"section_length":     p.mapping.SectionLength,
		"iri":                p.mapping.IRI,
		"rut_depth":          p.mapping.RutDepth,
		"crack_density":      p.mapping.CrackDensity,
		"traffic_volume":     p.mapping.TrafficVolume,
		"importance":         p.mapping.Importance,
		"maintenance_center": p.mapping.MaintenanceCenter,
		"detect_date":        p.mapping.DetectDate,
		"batch_id":           p.mapping.BatchID,
	}
}

func (p *CSVParser) hasRequiredColumns(headerMap map[string]int) bool {
	required := []string{"route_id", "start_station", "end_station", "iri", "rut_depth", "crack_density"}
	for _, r := range required {
		if _, exists := headerMap[r]; !exists {
			return false
		}
	}
	return true
}

func (p *CSVParser) parseRow(row []string, headers []string, headerMap map[string]int, fileName string, rowNum int) (*storage.PavementRecord, error) {
	var record storage.PavementRecord

	getField := func(fieldName string) string {
		idx, ok := headerMap[fieldName]
		if !ok || idx < 0 || idx >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[idx])
	}

	_ = fileName
	_ = rowNum
	_ = headers

	routeID := getField("route_id")
	if routeID != "" {
		if err := validator.ValidateRouteID(routeID); err != nil {
			return nil, fmt.Errorf("路线编号不合法: %s", routeID)
		}
	}
	if routeID == "" {
		return nil, fmt.Errorf("路线编号不能为空")
	}
	record.RouteID = strings.ToUpper(routeID)

	startStationStr := getField("start_station")
	startStation, err := validator.ParseStationToMeters(startStationStr)
	if err != nil {
		return nil, fmt.Errorf("起始桩号解析失败: %s - %v", startStationStr, err)
	}
	record.StartStation = startStation

	endStationStr := getField("end_station")
	endStation, err := validator.ParseStationToMeters(endStationStr)
	if err != nil {
		return nil, fmt.Errorf("终止桩号解析失败: %s - %v", endStationStr, err)
	}
	record.EndStation = endStation

	if record.EndStation <= record.StartStation {
		return nil, fmt.Errorf("终止桩号应大于起始桩号: %s ~ %s", startStationStr, endStationStr)
	}

	lengthStr := getField("section_length")
	if lengthStr != "" {
		length, err := validator.ValidateNumericField(lengthStr, "路段长度")
		if err == nil && length > 0 {
			record.SectionLength = length
		}
	}
	if record.SectionLength <= 0 {
		record.SectionLength = float64(record.EndStation-record.StartStation) / 1000.0
	}
	record.SectionLength = roundFloat(record.SectionLength, 3)

	iriStr := getField("iri")
	iri, err := validator.ValidateNumericField(iriStr, "IRI")
	if err != nil {
		return nil, fmt.Errorf("IRI解析失败: %s - %v", iriStr, err)
	}
	iri = clampFloat(iri, 0, 20)
	record.IRI = roundFloat(iri, 2)

	rutStr := getField("rut_depth")
	rut, err := validator.ValidateNumericField(rutStr, "车辙深度")
	if err != nil {
		return nil, fmt.Errorf("车辙深度解析失败: %s - %v", rutStr, err)
	}
	rut = clampFloat(rut, 0, 50)
	record.RutDepth = roundFloat(rut, 1)

	crackStr := getField("crack_density")
	crack, err := validator.ValidateNumericField(crackStr, "裂缝密度")
	if err != nil {
		return nil, fmt.Errorf("裂缝密度解析失败: %s - %v", crackStr, err)
	}
	crack = clampFloat(crack, 0, 100)
	record.CrackDensity = roundFloat(crack, 2)

	trafficStr := getField("traffic_volume")
	if trafficStr != "" {
		traffic, err := validator.ValidateNumericField(trafficStr, "交通流量")
		if err == nil {
			record.TrafficVolume = clampFloat(traffic, 0, 1000000)
		}
	}

	importanceStr := getField("importance")
	if importanceStr != "" {
		imp, err := validator.ValidateNumericField(importanceStr, "重要性权重")
		if err == nil {
			record.Importance = clampFloat(imp, 0.5, 3.0)
		}
	}
	if record.Importance <= 0 {
		record.Importance = 1.0
	}

	center := getField("maintenance_center")
	record.MaintenanceCenter = center

	dateStr := getField("detect_date")
	if dateStr != "" {
		detectDate, err := validator.ParseDate(dateStr)
		if err == nil && !detectDate.IsZero() {
			record.DetectDate = detectDate
		}
	}
	if record.DetectDate.IsZero() {
		record.DetectDate = time.Now()
	}

	batchID := getField("batch_id")
	record.BatchID = strings.ToUpper(batchID)

	return &record, nil
}

func findCSVFiles(dirPath string) ([]string, error) {
	var files []string
	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.EqualFold(filepath.Ext(path), ".csv") {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, pverrors.NewImportError(
			pverrors.ErrImportFileNotFound,
			fmt.Sprintf("遍历目录失败: %s", dirPath),
			"请检查目录是否存在以及权限设置",
			err,
		)
	}
	return files, nil
}

func clampFloat(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func roundFloat(value float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(value*ratio) / ratio
}

func SafeParseFloat(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	return strconv.ParseFloat(s, 64)
}
