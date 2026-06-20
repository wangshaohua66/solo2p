package model

import (
	"time"
)

const (
	DeviceStatusPending   = "pending"
	DeviceStatusOnSale    = "on_sale"
	DeviceStatusReserved  = "reserved"
	DeviceStatusSold      = "sold"
	DeviceStatusOffShelf  = "off_shelf"
)

const (
	TxStatusCreated      = "created"
	TxStatusNegotiating  = "negotiating"
	TxStatusFundFrozen   = "fund_frozen"
	TxStatusTransferring = "transferring"
	TxStatusCompleted    = "completed"
	TxStatusCancelled    = "cancelled"
	TxStatusDisputed     = "disputed"
)

const (
	DisputeStatusPending    = "pending"
	DisputeStatusInvestigating = "investigating"
	DisputeStatusResolved   = "resolved"
	DisputeStatusRejected   = "rejected"
)

const (
	UserStatusActive   = "active"
	UserStatusDisabled = "disabled"
	UserStatusBlacklisted = "blacklisted"
)

const (
	RoleAdmin    = "admin"
	RoleSeller   = "seller"
	RoleBuyer    = "buyer"
	RoleAssessor = "assessor"
	RoleArbitrator = "arbitrator"
)

type BaseModel struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	CreatedAt time.Time `gorm:"type:datetime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"type:datetime;not null;default:CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" json:"updated_at"`
	DeletedAt *time.Time `gorm:"type:datetime;index" json:"deleted_at,omitempty"`
}

type User struct {
	BaseModel
	Username     string    `gorm:"type:varchar(64);uniqueIndex;not null" json:"username"`
	Password     string    `gorm:"type:varchar(255);not null" json:"-"`
	RealName     string    `gorm:"type:varchar(64)" json:"real_name"`
	Phone        string    `gorm:"type:varchar(20);uniqueIndex" json:"phone"`
	Email        string    `gorm:"type:varchar(128);uniqueIndex" json:"email"`
	IDCard       string    `gorm:"type:varchar(32)" json:"id_card"`
	Company      string    `gorm:"type:varchar(255)" json:"company"`
	Status       string    `gorm:"type:varchar(32);not null;default:active" json:"status"`
	Avatar       string    `gorm:"type:varchar(512)" json:"avatar"`
	Roles        []UserRole `gorm:"foreignKey:UserID" json:"roles,omitempty"`
	CreditRating *CreditRating `gorm:"foreignKey:UserID" json:"credit_rating,omitempty"`
}

type Role struct {
	BaseModel
	Name        string `gorm:"type:varchar(64);uniqueIndex;not null" json:"name"`
	Description string `gorm:"type:varchar(255)" json:"description"`
}

type UserRole struct {
	BaseModel
	UserID uint64 `gorm:"index;not null" json:"user_id"`
	RoleID uint64 `gorm:"index;not null" json:"role_id"`
	Role   *Role  `gorm:"foreignKey:RoleID" json:"role,omitempty"`
}

type DeviceCategory struct {
	BaseModel
	Name        string `gorm:"type:varchar(64);uniqueIndex;not null" json:"name"`
	Code        string `gorm:"type:varchar(32);uniqueIndex;not null" json:"code"`
	Description string `gorm:"type:text" json:"description"`
	ParentID    *uint64 `gorm:"index" json:"parent_id,omitempty"`
	Sort        int    `gorm:"type:int;default:0" json:"sort"`
}

type Device struct {
	BaseModel
	SellerID         uint64             `gorm:"index;not null" json:"seller_id"`
	CategoryID       uint64             `gorm:"index;not null" json:"category_id"`
	Category         *DeviceCategory    `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Title            string             `gorm:"type:varchar(255);not null" json:"title"`
	Brand            string             `gorm:"type:varchar(64);index;not null" json:"brand"`
	Model            string             `gorm:"type:varchar(128);index;not null" json:"model"`
	SerialNumber     string             `gorm:"type:varchar(128);uniqueIndex" json:"serial_number"`
	ManufactureYear  int                `gorm:"type:int;index;not null" json:"manufacture_year"`
	WorkHours        float64            `gorm:"type:double;not null;default:0" json:"work_hours"`
	EngineHours      float64            `gorm:"type:double;default:0" json:"engine_hours"`
	Region           string             `gorm:"type:varchar(128);index" json:"region"`
	Province         string             `gorm:"type:varchar(64)" json:"province"`
	City             string             `gorm:"type:varchar(64)" json:"city"`
	OriginalPrice    float64            `gorm:"type:decimal(15,2);not null;default:0" json:"original_price"`
	AskingPrice      float64            `gorm:"type:decimal(15,2);not null;default:0" json:"asking_price"`
	ValuationPrice   *float64           `gorm:"type:decimal(15,2);index" json:"valuation_price,omitempty"`
	Description      string             `gorm:"type:text" json:"description"`
	Status           string             `gorm:"type:varchar(32);index;not null;default:pending" json:"status"`
	HasAccident      bool               `gorm:"type:tinyint(1);default:0" json:"has_accident"`
	AccidentDetail   string             `gorm:"type:text" json:"accident_detail"`
	HasWarranty      bool               `gorm:"type:tinyint(1);default:0" json:"has_warranty"`
	WarrantyExpire   *time.Time         `gorm:"type:datetime" json:"warranty_expire,omitempty"`
	EquipmentParams  string             `gorm:"type:json" json:"equipment_params"`
	Media            []DeviceMedia      `gorm:"foreignKey:DeviceID" json:"media,omitempty"`
	MaintenanceRecords []MaintenanceRecord `gorm:"foreignKey:DeviceID" json:"maintenance_records,omitempty"`
	OwnershipChanges []OwnershipChange  `gorm:"foreignKey:DeviceID" json:"ownership_changes,omitempty"`
	ValuationReports []ValuationReport  `gorm:"foreignKey:DeviceID" json:"valuation_reports,omitempty"`
	Seller           *User              `gorm:"foreignKey:SellerID" json:"seller,omitempty"`
	ViewCount        uint64             `gorm:"type:bigint;default:0" json:"view_count"`
	FavoriteCount    uint64             `gorm:"type:bigint;default:0" json:"favorite_count"`
	ApprovedAt       *time.Time         `gorm:"type:datetime" json:"approved_at,omitempty"`
	ApprovedBy       *uint64            `gorm:"index" json:"approved_by,omitempty"`
}

type DeviceMedia struct {
	BaseModel
	DeviceID  uint64 `gorm:"index;not null" json:"device_id"`
	Type      string `gorm:"type:varchar(16);not null" json:"type"`
	URL       string `gorm:"type:varchar(512);not null" json:"url"`
	Thumbnail string `gorm:"type:varchar(512)" json:"thumbnail"`
	Sort      int    `gorm:"type:int;default:0" json:"sort"`
}

type MaintenanceRecord struct {
	BaseModel
	DeviceID      uint64     `gorm:"index;not null" json:"device_id"`
	ServiceType   string     `gorm:"type:varchar(64);not null" json:"service_type"`
	ServiceDate   time.Time  `gorm:"type:date;not null" json:"service_date"`
	WorkHours     float64    `gorm:"type:double;not null" json:"work_hours"`
	Description   string     `gorm:"type:text;not null" json:"description"`
	ReplaceParts  string     `gorm:"type:text" json:"replace_parts"`
	Cost          float64    `gorm:"type:decimal(12,2);not null;default:0" json:"cost"`
	ServiceOrg    string     `gorm:"type:varchar(255)" json:"service_org"`
	Operator      string     `gorm:"type:varchar(64)" json:"operator"`
	NextServiceAt *time.Time `gorm:"type:date" json:"next_service_at,omitempty"`
}

type OwnershipChange struct {
	BaseModel
	DeviceID      uint64     `gorm:"index;not null" json:"device_id"`
	FromOwnerID   *uint64    `gorm:"index" json:"from_owner_id,omitempty"`
	ToOwnerID     uint64     `gorm:"index;not null" json:"to_owner_id"`
	FromOwnerName string     `gorm:"type:varchar(128)" json:"from_owner_name"`
	ToOwnerName   string     `gorm:"type:varchar(128);not null" json:"to_owner_name"`
	ChangeDate    time.Time  `gorm:"type:date;not null" json:"change_date"`
	ChangeType    string     `gorm:"type:varchar(32);not null" json:"change_type"`
	TransactionID *uint64    `gorm:"index" json:"transaction_id,omitempty"`
	Remark        string     `gorm:"type:varchar(512)" json:"remark"`
}

type ValuationReport struct {
	BaseModel
	DeviceID       uint64     `gorm:"index;not null" json:"device_id"`
	AssessorID     uint64     `gorm:"index;not null" json:"assessor_id"`
	ValuationPrice float64    `gorm:"type:decimal(15,2);not null" json:"valuation_price"`
	LowPrice       float64    `gorm:"type:decimal(15,2);not null" json:"low_price"`
	HighPrice      float64    `gorm:"type:decimal(15,2);not null" json:"high_price"`
	ReportNo       string     `gorm:"type:varchar(64);uniqueIndex;not null" json:"report_no"`
	Method         string     `gorm:"type:varchar(64);not null" json:"method"`
	BaseFactors    string     `gorm:"type:json" json:"base_factors"`
	AdjustFactors  string     `gorm:"type:json" json:"adjust_factors"`
	MarketRef      string     `gorm:"type:json" json:"market_ref"`
	Content        string     `gorm:"type:text;not null" json:"content"`
	Conclusion     string     `gorm:"type:text;not null" json:"conclusion"`
	Status         string     `gorm:"type:varchar(32);not null;default:valid" json:"status"`
	ValuationDate  time.Time  `gorm:"type:date;not null" json:"valuation_date"`
	ExpireDate     *time.Time `gorm:"type:date" json:"expire_date,omitempty"`
	Attachments    string     `gorm:"type:json" json:"attachments"`
	Assessor       *User      `gorm:"foreignKey:AssessorID" json:"assessor,omitempty"`
}

type Transaction struct {
	BaseModel
	OrderNo         string          `gorm:"type:varchar(64);uniqueIndex;not null" json:"order_no"`
	DeviceID        uint64          `gorm:"index;not null" json:"device_id"`
	BuyerID         uint64          `gorm:"index;not null" json:"buyer_id"`
	SellerID        uint64          `gorm:"index;not null" json:"seller_id"`
	Device          *Device         `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
	Buyer           *User           `gorm:"foreignKey:BuyerID" json:"buyer,omitempty"`
	Seller          *User           `gorm:"foreignKey:SellerID" json:"seller,omitempty"`
	InitialPrice    float64         `gorm:"type:decimal(15,2);not null" json:"initial_price"`
	FinalPrice      float64         `gorm:"type:decimal(15,2);not null" json:"final_price"`
	DepositAmount   float64         `gorm:"type:decimal(15,2);not null;default:0" json:"deposit_amount"`
	InstallmentPlan string          `gorm:"type:json" json:"installment_plan"`
	IsInstallment   bool            `gorm:"type:tinyint(1);default:0" json:"is_installment"`
	Status          string          `gorm:"type:varchar(32);index;not null;default:created" json:"status"`
	BuyerRemark     string          `gorm:"type:varchar(512)" json:"buyer_remark"`
	SellerRemark    string          `gorm:"type:varchar(512)" json:"seller_remark"`
	Funds           []TransactionFund `gorm:"foreignKey:TransactionID" json:"funds,omitempty"`
	Dispute         *Dispute        `gorm:"foreignKey:TransactionID" json:"dispute,omitempty"`
	NegotiationRecords string       `gorm:"type:json" json:"negotiation_records"`
	TransferDocs    string          `gorm:"type:json" json:"transfer_docs"`
	TransferCompletedAt *time.Time  `gorm:"type:datetime" json:"transfer_completed_at,omitempty"`
	CompletedAt     *time.Time      `gorm:"type:datetime" json:"completed_at,omitempty"`
	CancelledAt     *time.Time      `gorm:"type:datetime" json:"cancelled_at,omitempty"`
	CancelReason    string          `gorm:"type:varchar(512)" json:"cancel_reason"`
}

type TransactionFund struct {
	BaseModel
	TransactionID  uint64     `gorm:"index;not null" json:"transaction_id"`
	Type           string     `gorm:"type:varchar(32);not null" json:"type"`
	Amount         float64    `gorm:"type:decimal(15,2);not null" json:"amount"`
	Status         string     `gorm:"type:varchar(32);not null" json:"status"`
	PayerID        uint64     `gorm:"index;not null" json:"payer_id"`
	PayeeID        *uint64    `gorm:"index" json:"payee_id,omitempty"`
	PaymentMethod  string     `gorm:"type:varchar(32)" json:"payment_method"`
	PaymentNo      string     `gorm:"type:varchar(128)" json:"payment_no"`
	EscrowAccount  string     `gorm:"type:varchar(128)" json:"escrow_account"`
	FrozenAt       *time.Time `gorm:"type:datetime" json:"frozen_at,omitempty"`
	ThawedAt       *time.Time `gorm:"type:datetime" json:"thawed_at,omitempty"`
	PaidAt         *time.Time `gorm:"type:datetime" json:"paid_at,omitempty"`
	Remark         string     `gorm:"type:varchar(512)" json:"remark"`
}

type Dispute struct {
	BaseModel
	DisputeNo       string            `gorm:"type:varchar(64);uniqueIndex;not null" json:"dispute_no"`
	TransactionID   uint64            `gorm:"index;not null" json:"transaction_id"`
	ApplicantID     uint64            `gorm:"index;not null" json:"applicant_id"`
	RespondentID    uint64            `gorm:"index;not null" json:"respondent_id"`
	Applicant       *User             `gorm:"foreignKey:ApplicantID" json:"applicant,omitempty"`
	Respondent      *User             `gorm:"foreignKey:RespondentID" json:"respondent,omitempty"`
	ArbitratorID    *uint64           `gorm:"index" json:"arbitrator_id,omitempty"`
	Arbitrator      *User             `gorm:"foreignKey:ArbitratorID" json:"arbitrator,omitempty"`
	Type            string            `gorm:"type:varchar(64);not null" json:"type"`
	Title           string            `gorm:"type:varchar(255);not null" json:"title"`
	Description     string            `gorm:"type:text;not null" json:"description"`
	Status          string            `gorm:"type:varchar(32);index;not null;default:pending" json:"status"`
	Evidence        []DisputeEvidence `gorm:"foreignKey:DisputeID" json:"evidence,omitempty"`
	InspectionReport string           `gorm:"type:text" json:"inspection_report"`
	InspectionAgency string           `gorm:"type:varchar(255)" json:"inspection_agency"`
	InspectionDate  *time.Time        `gorm:"type:date" json:"inspection_date,omitempty"`
	ArbitrationResult string          `gorm:"type:text" json:"arbitration_result"`
	RefundAmount    *float64          `gorm:"type:decimal(15,2)" json:"refund_amount,omitempty"`
	CompensationAmount *float64       `gorm:"type:decimal(15,2)" json:"compensation_amount,omitempty"`
	ApplicantCreditImpact int         `gorm:"type:int;default:0" json:"applicant_credit_impact"`
	RespondentCreditImpact int        `gorm:"type:int;default:0" json:"respondent_credit_impact"`
	FiledAt         time.Time         `gorm:"type:datetime;not null" json:"filed_at"`
	InvestigatedAt  *time.Time        `gorm:"type:datetime" json:"investigated_at,omitempty"`
	ResolvedAt      *time.Time        `gorm:"type:datetime" json:"resolved_at,omitempty"`
}

type DisputeEvidence struct {
	BaseModel
	DisputeID   uint64 `gorm:"index;not null" json:"dispute_id"`
	UploaderID  uint64 `gorm:"index;not null" json:"uploader_id"`
	Type        string `gorm:"type:varchar(32);not null" json:"type"`
	URL         string `gorm:"type:varchar(512);not null" json:"url"`
	Description string `gorm:"type:varchar(512)" json:"description"`
}

type CreditRating struct {
	BaseModel
	UserID          uint64  `gorm:"uniqueIndex;not null" json:"user_id"`
	Score           int     `gorm:"type:int;not null;default:100" json:"score"`
	Level           string  `gorm:"type:varchar(16);not null;default:A" json:"level"`
	TradeCount      int     `gorm:"type:int;not null;default:0" json:"trade_count"`
	SuccessRate     float64 `gorm:"type:decimal(5,2);not null;default:100" json:"success_rate"`
	PositiveReviews int     `gorm:"type:int;not null;default:0" json:"positive_reviews"`
	NeutralReviews  int     `gorm:"type:int;not null;default:0" json:"neutral_reviews"`
	NegativeReviews int     `gorm:"type:int;not null;default:0" json:"negative_reviews"`
	DisputeCount    int     `gorm:"type:int;not null;default:0" json:"dispute_count"`
	LastEvaluatedAt *time.Time `gorm:"type:datetime" json:"last_evaluated_at,omitempty"`
}

type CreditRecord struct {
	BaseModel
	UserID        uint64  `gorm:"index;not null" json:"user_id"`
	RelatedUserID *uint64 `gorm:"index" json:"related_user_id,omitempty"`
	TransactionID *uint64 `gorm:"index" json:"transaction_id,omitempty"`
	DisputeID     *uint64 `gorm:"index" json:"dispute_id,omitempty"`
	Type          string  `gorm:"type:varchar(32);not null" json:"type"`
	ScoreChange   int     `gorm:"type:int;not null;default:0" json:"score_change"`
	Description   string  `gorm:"type:varchar(512);not null" json:"description"`
	OperatorID    *uint64 `gorm:"index" json:"operator_id,omitempty"`
}

type OperationLog struct {
	BaseModel
	UserID       *uint64 `gorm:"index" json:"user_id,omitempty"`
	Username     string  `gorm:"type:varchar(64)" json:"username"`
	Role         string  `gorm:"type:varchar(32)" json:"role"`
	Module       string  `gorm:"type:varchar(64);index;not null" json:"module"`
	Action       string  `gorm:"type:varchar(64);index;not null" json:"action"`
	ResourceType string  `gorm:"type:varchar(64);index" json:"resource_type"`
	ResourceID   *uint64 `gorm:"index" json:"resource_id,omitempty"`
	Method       string  `gorm:"type:varchar(16)" json:"method"`
	Path         string  `gorm:"type:varchar(512)" json:"path"`
	IP           string  `gorm:"type:varchar(64)" json:"ip"`
	UserAgent    string  `gorm:"type:varchar(512)" json:"user_agent"`
	Params       string  `gorm:"type:text" json:"params"`
	Result       string  `gorm:"type:text" json:"result"`
	Status       string  `gorm:"type:varchar(16);index;not null" json:"status"`
	ErrorMsg     string  `gorm:"type:text" json:"error_msg"`
	ExecTime     int64   `gorm:"type:bigint" json:"exec_time"`
}

type RegionMarket struct {
	BaseModel
	Region       string  `gorm:"type:varchar(128);index;not null" json:"region"`
	CategoryID   uint64  `gorm:"index;not null" json:"category_id"`
	Brand        string  `gorm:"type:varchar(64);index;not null" json:"brand"`
	Model        string  `gorm:"type:varchar(128);index;not null" json:"model"`
	AvgPrice     float64 `gorm:"type:decimal(15,2);not null" json:"avg_price"`
	LowPrice     float64 `gorm:"type:decimal(15,2);not null" json:"low_price"`
	HighPrice    float64 `gorm:"type:decimal(15,2);not null" json:"high_price"`
	SampleCount  int     `gorm:"type:int;not null;default:0" json:"sample_count"`
	DataDate     string  `gorm:"type:varchar(16);index;not null" json:"data_date"`
	Trend        string  `gorm:"type:varchar(16)" json:"trend"`
	ChangeRate   float64 `gorm:"type:decimal(5,2);default:0" json:"change_rate"`
}
