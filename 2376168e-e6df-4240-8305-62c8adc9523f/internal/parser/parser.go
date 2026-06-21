package parser

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
	"gopkg.in/yaml.v3"

	"clear-system/internal/db"
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
	DefaultInst  string
}

type ParseOption func(*ParseOptions)

func WithResume(database *db.Database, filePath string) ParseOption {
	return func(o *ParseOptions) {
		hash, err := ComputeFileHash(filePath)
		if err != nil {
			return
		}
		line, offset, exists := database.QueryParseProgress(hash)
		if !exists {
			return
		}
		o.Resume = true
		o.FileHash = hash
		o.StartLine = line
		o.StartOffset = offset
	}
}

func WithBatchSize(size int) ParseOption {
	return func(o *ParseOptions) {
		o.BatchSize = size
	}
}

func WithBatchCallback(fn func(flows []model.ClearFlow, startLine int64) error) ParseOption {
	return func(o *ParseOptions) {
		o.OnBatch = fn
	}
}

func WithProgressCallback(fn func(line int64, success, fail int64)) ParseOption {
	return func(o *ParseOptions) {
		o.ProgressFunc = fn
	}
}

func WithDefaultSourceInst(instID string) ParseOption {
	return func(o *ParseOptions) {
		o.DefaultInst = instID
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
	var tmpl model.FileTemplate
	if err := yaml.Unmarshal(data, &tmpl); err != nil {
		return nil, fmt.Errorf("解析模板YAML失败: %w", err)
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

func SaveProgress(database *db.Database, filePath string, lastLine int64, lastOffset int64) {
	hash, err := ComputeFileHash(filePath)
	if err != nil {
		return
	}
	_ = database.SaveParseProgress4(hash, filePath, lastLine, lastOffset)
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
		switch strings.ToUpper(get("direction")) {
		case "借", "DEBIT", "-":
			direction = model.DirectionOut
		case "贷", "CREDIT", "+":
			direction = model.DirectionIn
		}
	}

	bizType := model.BizType(strings.ToUpper(get("biz_type")))
	switch bizType {
	case model.BizTypeTransfer, model.BizTypeGuarantee, model.BizTypePawn, model.BizTypeLease:
	default:
		bizType = model.BizType(get("biz_type"))
	}

	f := model.ClearFlow{
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
	}
	return f, nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
