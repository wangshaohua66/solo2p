package parser

import (
	"bufio"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
	"gopkg.in/yaml.v3"

	"clear-system/internal/model"
)

type FileParser interface {
	Parse(filePath string, template *model.FileTemplate, opts ...ParseOption) (*model.ParseResult, error)
}

type ParseOptions struct {
	Resume       bool
	FileHash     string
	StartLine    int64
	StartOffset  int64
	BatchSize    int
	ProgressFunc func(line int64, success, fail int64)
	OnBatch      func(flows []model.ClearFlow, startLine int64) error
}

type ParseOption func(*ParseOptions)

func WithResume(hash string, line int64, offset int64) ParseOption {
	return func(o *ParseOptions) {
		o.Resume = true
		o.FileHash = hash
		o.StartLine = line
		o.StartOffset = offset
	}
}

func WithBatch(size int, onBatch func([]model.ClearFlow, int64) error) ParseOption {
	return func(o *ParseOptions) {
		o.BatchSize = size
		o.OnBatch = onBatch
	}
}

func WithProgress(f func(line int64, success, fail int64)) ParseOption {
	return func(o *ParseOptions) {
		o.ProgressFunc = f
	}
}

func defaultOptions() ParseOptions {
	return ParseOptions{
		BatchSize: 5000,
	}
}

func ComputeFileHash(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func LoadTemplate(templatePath string) (*model.FileTemplate, error) {
	data, err := os.ReadFile(templatePath)
	if err != nil {
		return nil, fmt.Errorf("读取模板文件失败: %w", err)
	}
	tmpl, err := parseTemplateYAML(data)
	if err != nil {
		return nil, fmt.Errorf("解析模板文件失败: %w", err)
	}
	return tmpl, nil
}

func parseTemplateYAML(data []byte) (*model.FileTemplate, error) {
	var tmpl model.FileTemplate
	if err := yaml.Unmarshal(data, &tmpl); err != nil {
		return nil, err
	}
	return &tmpl, nil
}

func getEncoding(name string) encoding.Encoding {
	switch strings.ToLower(name) {
	case "gbk", "gb2312":
		return simplifiedchinese.GBK
	case "gb18030":
		return simplifiedchinese.GB18030
	case "big5":
		return charmap.Windows1252
	default:
		return nil
	}
}

func convertEncoding(r io.Reader, encName string) (io.Reader, error) {
	enc := getEncoding(encName)
	if enc == nil {
		return r, nil
	}
	return transform.NewReader(r, enc.NewDecoder()), nil
}

func fieldValue(fields map[string]string, def model.FieldDef) string {
	v, ok := fields[def.Source]
	if !ok || v == "" {
		return def.Default
	}
	return strings.TrimSpace(v)
}

func buildFlow(fields map[string]string, tmpl *model.FileTemplate, sourceFile string, lineNo int64, rawData string) (model.ClearFlow, error) {
	fieldMap := make(map[string]string)
	for _, f := range tmpl.Fields {
		fieldMap[f.Name] = fieldValue(fields, f)
	}

	get := func(name string) string { return fieldMap[name] }

	amountStr := get("amount")
	if amountStr == "" {
		amountStr = "0"
	}
	amountStr = strings.ReplaceAll(amountStr, ",", "")
	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		return model.ClearFlow{}, fmt.Errorf("金额格式错误: %s", amountStr)
	}

	direction := model.Direction(strings.ToUpper(get("direction")))
	if direction != model.DirectionIn && direction != model.DirectionOut {
		dirVal := strings.ToUpper(get("direction"))
		if dirVal == "借" || dirVal == "DEBIT" || dirVal == "-" {
			direction = model.DirectionOut
		} else if dirVal == "贷" || dirVal == "CREDIT" || dirVal == "+" {
			direction = model.DirectionIn
		}
	}

	bizType := model.BizType(strings.ToUpper(get("biz_type")))
	switch bizType {
	case model.BizTypeTransfer, model.BizTypeGuarantee, model.BizTypePawn, model.BizTypeLease:
	default:
		bizType = model.BizType(get("biz_type"))
	}

	return model.ClearFlow{
		BizNo:        get("biz_no"),
		BizType:      bizType,
		BizDate:      get("biz_date"),
		SrcInstID:    get("src_inst_id"),
		DstInstID:    get("dst_inst_id"),
		Amount:       amount,
		Currency:     firstNonEmpty(get("currency"), "CNY"),
		Direction:    direction,
		PayerAccount: get("payer_account"),
		PayerName:    get("payer_name"),
		PayeeAccount: get("payee_account"),
		PayeeName:    get("payee_name"),
		Summary:      get("summary"),
		RefNo:        get("ref_no"),
		SourceFile:   sourceFile,
		LineNo:       lineNo,
		Status:       model.StatusParsed,
		ParseTime:    time.Now(),
		RawData:      rawData,
	}, nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

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
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 1024*1024), 10*1024*1024)
	lineNo := int64(0)

	for scanner.Scan() {
		lineNo++
		if lineNo <= options.StartLine {
			continue
		}
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}
		if tmpl.HasHeader && lineNo == 1 {
			continue
		}
		result.TotalLines++

		fields := parseFixedWidth(line, tmpl.Fields)
		flow, err := buildFlow(fields, tmpl, filePath, lineNo, line)
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, model.ParseError{
				LineNo:  lineNo,
				Message: err.Error(),
				RawData: line,
			})
			if options.ProgressFunc != nil {
				options.ProgressFunc(lineNo, result.SuccessCount, result.FailCount)
			}
			continue
		}
		result.SuccessCount++
		batch = append(batch, flow)
		result.Flows = append(result.Flows, flow)

		if len(batch) >= options.BatchSize && options.OnBatch != nil {
			if err := options.OnBatch(batch, lineNo-int64(len(batch))+1); err != nil {
				return result, err
			}
			batch = batch[:0]
		}
		if options.ProgressFunc != nil && (result.TotalLines%1000 == 0) {
			options.ProgressFunc(lineNo, result.SuccessCount, result.FailCount)
		}
	}
	if err := scanner.Err(); err != nil {
		return result, fmt.Errorf("读取文件出错: %w", err)
	}

	if len(batch) > 0 && options.OnBatch != nil {
		if err := options.OnBatch(batch, lineNo-int64(len(batch))+1); err != nil {
			return result, err
		}
	}
	return result, nil
}

func parseFixedWidth(line string, fieldDefs []model.FieldDef) map[string]string {
	result := make(map[string]string)
	runes := []rune(line)
	for _, fd := range fieldDefs {
		if fd.StartPos <= 0 || fd.Length <= 0 {
			continue
		}
		start := fd.StartPos - 1
		end := start + fd.Length
		if start >= len(runes) {
			result[fd.Source] = ""
			continue
		}
		if end > len(runes) {
			end = len(runes)
		}
		result[fd.Source] = strings.TrimSpace(string(runes[start:end]))
		if fd.Source == "" {
			result[fd.Name] = strings.TrimSpace(string(runes[start:end]))
		}
	}
	return result
}

type XMLParser struct{}

func NewXMLParser() *XMLParser { return &XMLParser{} }

type xmlToken struct {
	name  string
	attrs map[string]string
	text  string
	depth int
}

func (p *XMLParser) Parse(filePath string, tmpl *model.FileTemplate, opts ...ParseOption) (*model.ParseResult, error) {
	options := defaultOptions()
	for _, o := range opts {
		o(&options)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	if getEncoding(tmpl.Encoding) != nil || getEncoding(tmpl.XMLConfig.Encoding) != nil {
		enc := getEncoding(tmpl.Encoding)
		if enc == nil {
			enc = getEncoding(tmpl.XMLConfig.Encoding)
		}
		if enc != nil {
			decoded, err := enc.NewDecoder().Bytes(data)
			if err == nil {
				data = decoded
			}
		}
	}

	records := extractXMLRecords(data, tmpl.XMLConfig.RecordPath)
	if records == nil {
		return nil, fmt.Errorf("解析XML失败，未找到记录节点: %s", tmpl.XMLConfig.RecordPath)
	}

	result := &model.ParseResult{}
	batch := make([]model.ClearFlow, 0, options.BatchSize)
	startIdx := int(options.StartLine)

	for i, rec := range records {
		lineNo := int64(i + 1)
		if lineNo <= options.StartLine {
			continue
		}
		_ = startIdx

		result.TotalLines++
		fields := rec
		raw := mapToRaw(rec)
		flow, err := buildFlow(fields, tmpl, filePath, lineNo, raw)
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, model.ParseError{
				LineNo:  lineNo,
				Message: err.Error(),
				RawData: raw,
			})
			if options.ProgressFunc != nil {
				options.ProgressFunc(lineNo, result.SuccessCount, result.FailCount)
			}
			continue
		}
		result.SuccessCount++
		batch = append(batch, flow)
		result.Flows = append(result.Flows, flow)

		if len(batch) >= options.BatchSize && options.OnBatch != nil {
			if err := options.OnBatch(batch, lineNo-int64(len(batch))+1); err != nil {
				return result, err
			}
			batch = batch[:0]
		}
		if options.ProgressFunc != nil && (result.TotalLines%1000 == 0) {
			options.ProgressFunc(lineNo, result.SuccessCount, result.FailCount)
		}
	}

	if len(batch) > 0 && options.OnBatch != nil {
		if err := options.OnBatch(batch, int64(len(records))-int64(len(batch))+1); err != nil {
			return result, err
		}
	}
	return result, nil
}

func mapToRaw(m map[string]string) string {
	var sb strings.Builder
	first := true
	for k, v := range m {
		if !first {
			sb.WriteString(";")
		}
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(v)
		first = false
	}
	return sb.String()
}

type xmlNode struct {
	name     string
	path     []string
	children []*xmlNode
	text     string
	attrs    map[string]string
	depth    int
}

func extractXMLRecords(data []byte, recordPath string) []map[string]string {
	var records []map[string]string
	pathParts := strings.Split(strings.Trim(recordPath, "/"), "/")
	recordName := pathParts[len(pathParts)-1]

	stack := []*xmlNode{}
	var root *xmlNode

	i := 0
	for i < len(data) {
		if data[i] != '<' {
			i++
			continue
		}
		end := strings.IndexByte(string(data[i:]), '>')
		if end < 0 {
			break
		}
		tagStr := string(data[i+1 : i+end])
		i += end + 1

		tagStr = strings.TrimSpace(tagStr)
		if tagStr == "" {
			continue
		}
		isClose := strings.HasPrefix(tagStr, "/")
		isSelfClose := strings.HasSuffix(tagStr, "/")
		isPI := strings.HasPrefix(tagStr, "?") || strings.HasPrefix(tagStr, "!")
		if isPI {
			continue
		}
		if isClose {
			if len(stack) > 0 {
				cur := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				curPath := cur.path
				if recordName != "" && cur.name == recordName {
					rec := extractNodeText(cur)
					for k, v := range cur.attrs {
						if _, exists := rec[k]; !exists {
							rec[k] = v
						}
					}
					records = append(records, rec)
				}
				_ = curPath
			}
			continue
		}
		if isSelfClose {
			tagStr = strings.TrimSuffix(tagStr, "/")
		}
		name, attrs := parseTag(tagStr)
		curPath := []string{}
		if len(stack) > 0 {
			curPath = append([]string{}, stack[len(stack)-1].path...)
		}
		curPath = append(curPath, name)
		n := &xmlNode{
			name:  name,
			path:  curPath,
			attrs: attrs,
			depth: len(stack),
		}
		if len(stack) > 0 {
			stack[len(stack)-1].children = append(stack[len(stack)-1].children, n)
		} else {
			root = n
		}
		if !isSelfClose {
			stack = append(stack, n)
		} else if recordName != "" && name == recordName {
			rec := map[string]string{}
			for k, v := range n.attrs {
				rec[k] = v
			}
			records = append(records, rec)
		}

		textStart := i
		for i < len(data) && data[i] != '<' {
			i++
		}
		textContent := strings.TrimSpace(string(data[textStart:i]))
		if len(stack) > 0 && textContent != "" {
			stack[len(stack)-1].text = textContent
		}
	}
	_ = root
	return records
}

func parseTag(tag string) (string, map[string]string) {
	attrs := map[string]string{}
	parts := strings.Fields(tag)
	if len(parts) == 0 {
		return "", attrs
	}
	name := parts[0]
	for _, p := range parts[1:] {
		eq := strings.IndexByte(p, '=')
		if eq < 0 {
			continue
		}
		k := p[:eq]
		v := strings.Trim(p[eq+1:], "\"'")
		attrs[k] = v
	}
	return name, attrs
}

func extractNodeText(n *xmlNode) map[string]string {
	result := map[string]string{}
	if n.text != "" {
		result[n.name] = n.text
	}
	for _, child := range n.children {
		if len(child.children) == 0 {
			if child.text != "" {
				result[child.name] = child.text
			}
			for k, v := range child.attrs {
				result[k] = v
			}
		} else {
			sub := extractNodeText(child)
			for k, v := range sub {
				prefix := child.name
				result[prefix+"."+k] = v
				if _, ok := result[k]; !ok {
					result[k] = v
				}
			}
		}
	}
	for k, v := range n.attrs {
		if _, ok := result[k]; !ok {
			result[k] = v
		}
	}
	return result
}

func GetParser(format string) (FileParser, error) {
	switch strings.ToLower(format) {
	case "csv":
		return NewCSVParser(), nil
	case "fixed", "fixedwidth", "fw":
		return NewFixedWidthParser(), nil
	case "xml":
		return NewXMLParser(), nil
	default:
		return nil, fmt.Errorf("不支持的文件格式: %s (支持: csv, fixed, xml)", format)
	}
}

func ParseBigInt(s string) *big.Int {
	s = strings.ReplaceAll(s, ",", "")
	n := new(big.Int)
	n.SetString(s, 10)
	return n
}
