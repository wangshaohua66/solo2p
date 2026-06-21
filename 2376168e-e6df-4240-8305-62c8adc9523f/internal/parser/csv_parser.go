package parser

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"clear-system/internal/model"
)

type CSVParser struct{}

func NewCSVParser() *CSVParser { return &CSVParser{} }

func (p *CSVParser) Parse(filePath string, tmpl *model.FileTemplate, opts ...ParseOption) (*model.ParseResult, error) {
	options := defaultOptions()
	for _, o := range opts {
		o(&options)
	}

	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer f.Close()

	reader, err := convertEncoding(f, tmpl.Encoding)
	if err != nil {
		return nil, err
	}

	sep := tmpl.Separator
	if sep == "" {
		sep = ","
	}
	csvR := csv.NewReader(reader)
	csvR.Comma = rune(sep[0])
	csvR.LazyQuotes = true
	csvR.FieldsPerRecord = -1

	result := &model.ParseResult{}
	batch := make([]model.ClearFlow, 0, options.BatchSize)
	scannerLine := int64(0)
	var headers []string

	if options.StartOffset > 0 {
		f.Seek(options.StartOffset, 0)
		scannerLine = options.StartLine
	}

	for {
		scannerLine++
		record, err := csvR.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			if scannerLine <= options.StartLine {
				continue
			}
			result.FailCount++
			result.Errors = append(result.Errors, model.ParseError{
				LineNo:  scannerLine,
				Message: err.Error(),
				RawData: strings.Join(record, sep),
			})
			continue
		}
		if tmpl.HasHeader && scannerLine == 1 {
			headers = record
			continue
		}
		if scannerLine <= options.StartLine {
			continue
		}

		result.TotalLines++
		fields := recordToMap(record, headers, tmpl)
		raw := strings.Join(record, sep)

		flow, err := buildFlow(fields, tmpl, filePath, scannerLine, raw)
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, model.ParseError{
				LineNo:  scannerLine,
				Message: err.Error(),
				RawData: raw,
			})
			if options.ProgressFunc != nil {
				options.ProgressFunc(scannerLine, result.SuccessCount, result.FailCount)
			}
			continue
		}

		if options.DefaultInst != "" && flow.SrcInstID == "" {
			flow.SrcInstID = options.DefaultInst
		}

		result.SuccessCount++
		batch = append(batch, flow)
		result.Flows = append(result.Flows, flow)

		if len(batch) >= options.BatchSize && options.OnBatch != nil {
			if err := options.OnBatch(batch, scannerLine-int64(len(batch))+1); err != nil {
				return result, err
			}
			batch = batch[:0]
			result.LastLine = scannerLine
			result.LastOffset, _ = f.Seek(0, 1)
		}
		if options.ProgressFunc != nil && (result.TotalLines%1000 == 0) {
			options.ProgressFunc(scannerLine, result.SuccessCount, result.FailCount)
		}
	}

	if len(batch) > 0 && options.OnBatch != nil {
		if err := options.OnBatch(batch, scannerLine-int64(len(batch))+1); err != nil {
			return result, err
		}
		result.LastLine = scannerLine
		result.LastOffset, _ = f.Seek(0, 1)
	}
	return result, nil
}

func recordToMap(record []string, headers []string, tmpl *model.FileTemplate) map[string]string {
	m := make(map[string]string)
	if len(headers) > 0 {
		for i, h := range record {
			if i < len(headers) {
				m[headers[i]] = h
			}
		}
	} else {
		for i, f := range tmpl.Fields {
			if i < len(record) {
				m[f.Source] = record[i]
			}
		}
	}
	for _, f := range tmpl.Fields {
		if f.Source == "" {
			continue
		}
		idx := parseSourceIndex(f.Source)
		if idx >= 0 && idx < len(record) {
			m[f.Source] = record[idx]
		}
	}
	return m
}

func parseSourceIndex(s string) int {
	if strings.HasPrefix(s, "col") {
		n, err := strconv.Atoi(strings.TrimPrefix(s, "col"))
		if err == nil {
			return n - 1
		}
	}
	return -1
}
