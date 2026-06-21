package parser

import (
	"fmt"
	"os"
	"strings"

	"github.com/antchfx/xmlquery"

	"clear-system/internal/model"
)

type XMLParser struct{}

func NewXMLParser() *XMLParser { return &XMLParser{} }

func (p *XMLParser) Parse(filePath string, tmpl *model.FileTemplate, opts ...ParseOption) (*model.ParseResult, error) {
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

	doc, err := xmlquery.Parse(reader)
	if err != nil {
		return nil, fmt.Errorf("XML解析失败: %w", err)
	}

	recordXPath := tmpl.RecordXPath
	if recordXPath == "" {
		recordXPath = "//record"
	}

	nodes, err := xmlquery.QueryAll(doc, recordXPath)
	if err != nil {
		return nil, fmt.Errorf("XPath查询失败[%s]: %w", recordXPath, err)
	}

	result := &model.ParseResult{}
	batch := make([]model.ClearFlow, 0, options.BatchSize)
	scannerLine := int64(0)

	for _, node := range nodes {
		scannerLine++
		if scannerLine <= options.StartLine {
			continue
		}

		raw := node.OutputXML(false)
		result.TotalLines++
		fields := make(map[string]string)

		for _, fd := range tmpl.Fields {
			source := fd.Source
			if source == "" {
				fields[fd.Source] = fd.Default
				continue
			}
			if strings.HasPrefix(source, "/") || strings.HasPrefix(source, "./") {
				matches := xmlquery.Find(node, source)
				if len(matches) > 0 {
					fields[fd.Source] = strings.TrimSpace(matches[0].InnerText())
				} else {
					fields[fd.Source] = fd.Default
				}
			} else if strings.HasPrefix(source, "@") {
				attrName := strings.TrimPrefix(source, "@")
				fields[fd.Source] = node.SelectAttr(attrName)
				if fields[fd.Source] == "" {
					fields[fd.Source] = fd.Default
				}
			} else {
				child := xmlquery.FindOne(node, source)
				if child != nil {
					fields[fd.Source] = strings.TrimSpace(child.InnerText())
				} else {
					fields[fd.Source] = fd.Default
				}
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

	if len(batch) > 0 && options.OnBatch != nil {
		if err := options.OnBatch(batch, scannerLine-int64(len(batch))+1); err != nil {
			return result, err
		}
	}
	return result, nil
}
