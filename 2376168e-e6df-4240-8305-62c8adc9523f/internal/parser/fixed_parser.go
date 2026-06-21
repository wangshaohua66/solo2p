package parser

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"

	"clear-system/internal/model"
)

type FixedWidthParser struct{}

func NewFixedWidthParser() *FixedWidthParser { return &FixedWidthParser{} }

func (p *FixedWidthParser) Parse(filePath string, tmpl *model.FileTemplate, opts ...ParseOption) (*model.ParseResult, error) {
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

	result := &model.ParseResult{}
	batch := make([]model.ClearFlow, 0, options.BatchSize)
	scannerLine := int64(0)

	if options.StartOffset > 0 {
		f.Seek(options.StartOffset, 0)
		scannerLine = options.StartLine
	}

	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 1024*1024*10), 1024*1024*10)
	for scanner.Scan() {
		scannerLine++
		if tmpl.HasHeader && scannerLine == 1 {
			continue
		}
		if scannerLine <= options.StartLine {
			continue
		}

		raw := scanner.Text()
		if strings.TrimSpace(raw) == "" {
			continue
		}

		result.TotalLines++
		runes := []rune(raw)
		fields := make(map[string]string)
		for _, fd := range tmpl.Fields {
			if fd.StartPos < 0 || fd.Length <= 0 {
				continue
			}
			end := fd.StartPos + fd.Length
			if end > len(runes) {
				end = len(runes)
			}
			if fd.StartPos >= len(runes) {
				fields[fd.Source] = fd.Default
			} else {
				fields[fd.Source] = string(runes[fd.StartPos:end])
			}
		}

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
		}
		if options.ProgressFunc != nil && (result.TotalLines%1000 == 0) {
			options.ProgressFunc(scannerLine, result.SuccessCount, result.FailCount)
		}
	}
	if err := scanner.Err(); err != nil && err != io.EOF {
		return result, err
	}
	if len(batch) > 0 && options.OnBatch != nil {
		if err := options.OnBatch(batch, scannerLine-int64(len(batch))+1); err != nil {
			return result, err
		}
	}
	return result, nil
}
