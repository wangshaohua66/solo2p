package model

import (
	"time"

	"github.com/shopspring/decimal"
)

type BizType string

const (
	BizTypeTransfer   BizType = "TRANSFER"
	BizTypeGuarantee  BizType = "GUARANTEE"
	BizTypePawn       BizType = "PAWN"
	BizTypeLease      BizType = "LEASE"
)

type ClearStatus string

const (
	StatusPending   ClearStatus = "PENDING"
	StatusParsed    ClearStatus = "PARSED"
	StatusMatched   ClearStatus = "MATCHED"
	StatusUnilateral ClearStatus = "UNILATERAL"
	StatusMismatch  ClearStatus = "MISMATCH"
	StatusSettled   ClearStatus = "SETTLED"
	StatusFailed    ClearStatus = "FAILED"
)

type Direction string

const (
	DirectionIn  Direction = "IN"
	DirectionOut Direction = "OUT"
)

type ClearFlow struct {
	ID            int64           `db:"id"`
	BizNo         string          `db:"biz_no"`
	BizType       BizType         `db:"biz_type"`
	BizDate       string          `db:"biz_date"`
	SrcInstID     string          `db:"src_inst_id"`
	DstInstID     string          `db:"dst_inst_id"`
	Amount        decimal.Decimal `db:"amount"`
	Currency      string          `db:"currency"`
	Direction     Direction       `db:"direction"`
	PayerAccount  string          `db:"payer_account"`
	PayerName     string          `db:"payer_name"`
	PayeeAccount  string          `db:"payee_account"`
	PayeeName     string          `db:"payee_name"`
	Summary       string          `db:"summary"`
	RefNo         string          `db:"ref_no"`
	SourceFile    string          `db:"source_file"`
	LineNo        int64           `db:"line_no"`
	Status        ClearStatus     `db:"status"`
	ParseTime     time.Time       `db:"parse_time"`
	Remark        string          `db:"remark"`
	RawData       string          `db:"raw_data"`
}

type MatchResult struct {
	ID              int64           `db:"id"`
	FlowID1         int64           `db:"flow_id1"`
	FlowID2         int64           `db:"flow_id2"`
	MatchScore      int             `db:"match_score"`
	AmountDiff      decimal.Decimal `db:"amount_diff"`
	MatchType       string          `db:"match_type"`
	ToleranceUsed   bool            `db:"tolerance_used"`
	MatchTime       time.Time       `db:"match_time"`
	BizDate         string          `db:"biz_date"`
	SrcInstID       string          `db:"src_inst_id"`
	DstInstID       string          `db:"dst_inst_id"`
}

type UnilateralFlow struct {
	ID        int64       `db:"id"`
	FlowID    int64       `db:"flow_id"`
	PendingSide string    `db:"pending_side"`
	HangTime  time.Time   `db:"hang_time"`
	BizDate   string      `db:"biz_date"`
	InstID    string      `db:"inst_id"`
	Status    ClearStatus `db:"status"`
}

type NetPosition struct {
	ID              int64           `db:"id"`
	SettleDate      string          `db:"settle_date"`
	InstID          string          `db:"inst_id"`
	Currency        string          `db:"currency"`
	TotalReceive    decimal.Decimal `db:"total_receive"`
	TotalPay        decimal.Decimal `db:"total_pay"`
	NetAmount       decimal.Decimal `db:"net_amount"`
	MatchCount      int             `db:"match_count"`
	UnilateralCount int             `db:"unilateral_count"`
	Status          ClearStatus     `db:"status"`
	CreateTime      time.Time       `db:"create_time"`
}

type SettleInstruction struct {
	ID             int64           `db:"id"`
	InstructionNo  string          `db:"instruction_no"`
	SettleDate     string          `db:"settle_date"`
	SenderInstID   string          `db:"sender_inst_id"`
	ReceiverInstID string          `db:"receiver_inst_id"`
	Amount         decimal.Decimal `db:"amount"`
	Currency       string          `db:"currency"`
	Format         string          `db:"format"`
	Content        string          `db:"content"`
	Status         ClearStatus     `db:"status"`
	CreateTime     time.Time       `db:"create_time"`
	SendTime       *time.Time      `db:"send_time"`
}

type AuditLog struct {
	ID         int64     `db:"id"`
	OpTime     time.Time `db:"op_time"`
	OpType     string    `db:"op_type"`
	Operator   string    `db:"operator"`
	InstID     string    `db:"inst_id"`
	BizDate    string    `db:"biz_date"`
	Detail     string    `db:"detail"`
	IPAddress  string    `db:"ip_address"`
	Result     string    `db:"result"`
}

type Notification struct {
	ID        int64     `db:"id"`
	SendTime  time.Time `db:"send_time"`
	Type      string    `db:"type"`
	Target    string    `db:"target"`
	Title     string    `db:"title"`
	Content   string    `db:"content"`
	Status    string    `db:"status"`
	InstID    string    `db:"inst_id"`
	BizDate   string    `db:"biz_date"`
	RetryCount int      `db:"retry_count"`
}

type FileTemplate struct {
	Name        string        `yaml:"name"`
	Description string        `yaml:"description"`
	Format      string        `yaml:"format"`
	Encoding    string        `yaml:"encoding"`
	Separator   string        `yaml:"separator"`
	HasHeader   bool          `yaml:"has_header"`
	Fields      []FieldDef    `yaml:"fields"`
	XMLConfig   XMLTemplate   `yaml:"xml,omitempty"`
}

type FieldDef struct {
	Name      string `yaml:"name"`
	Source    string `yaml:"source"`
	DataType  string `yaml:"type"`
	Required  bool   `yaml:"required"`
	StartPos  int    `yaml:"start,omitempty"`
	Length    int    `yaml:"length,omitempty"`
	Format    string `yaml:"format,omitempty"`
	Default   string `yaml:"default,omitempty"`
}

type XMLTemplate struct {
	RecordPath string `yaml:"record_path"`
	Encoding   string `yaml:"encoding"`
}

type ParseResult struct {
	TotalLines   int64
	SuccessCount int64
	FailCount    int64
	Flows        []ClearFlow
	Errors       []ParseError
}

type ParseError struct {
	LineNo  int64
	Message string
	RawData string
}
