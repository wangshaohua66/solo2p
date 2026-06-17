package model

import (
	"time"
)

const (
	SampleStatusCollected   = "COLLECTED"
	SampleStatusInTransit   = "IN_TRANSIT"
	SampleStatusReceived    = "RECEIVED"
	SampleStatusTesting     = "TESTING"
	SampleStatusReviewing   = "REVIEWING"
	SampleStatusCompleted   = "COMPLETED"
	SampleStatusCancelled   = "CANCELLED"
)

const (
	InstitutionTypeCommunity = "COMMUNITY"
	InstitutionTypeTownship  = "TOWNSHIP"
	InstitutionTypeClinic    = "CLINIC"
)

const (
	UserRoleAdmin      = "ADMIN"
	UserRoleDoctor     = "DOCTOR"
	UserRoleReviewer   = "REVIEWER"
	UserRoleInstitution = "INSTITUTION"
	UserRoleFinance    = "FINANCE"
)

const (
	SettlementStatusDraft     = "DRAFT"
	SettlementStatusPending   = "PENDING"
	SettlementStatusConfirmed = "CONFIRMED"
	SettlementStatusPaid      = "PAID"
)

const (
	ReportStatusGenerated = "GENERATED"
	ReportStatusPublished = "PUBLISHED"
	ReportStatusRead      = "READ"
	ReportStatusRevoked   = "REVOKED"
)

const (
	TestCategoryClinical = "CLINICAL"
	TestCategoryPathology = "PATHOLOGY"
	TestCategoryGenetic  = "GENETIC"
)

type Institution struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Code        string    `gorm:"size:20;uniqueIndex;not null" json:"code"`
	Name        string    `gorm:"size:200;not null" json:"name"`
	Type        string    `gorm:"size:20;not null" json:"type"`
	Contact     string    `gorm:"size:50" json:"contact"`
	Phone       string    `gorm:"size:30" json:"phone"`
	Email       string    `gorm:"size:100" json:"email"`
	Address     string    `gorm:"size:500" json:"address"`
	Discount    float64   `gorm:"default:1.0" json:"discount"`
	MinPrice    float64   `gorm:"default:0" json:"min_price"`
	Status      int       `gorm:"default:1" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type User struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Username      string    `gorm:"size:50;uniqueIndex;not null" json:"username"`
	PasswordHash  string    `gorm:"size:255;not null" json:"-"`
	RealName      string    `gorm:"size:50" json:"real_name"`
	Role          string    `gorm:"size:30;not null" json:"role"`
	InstitutionID uint      `gorm:"index" json:"institution_id"`
	Phone         string    `gorm:"size:30" json:"phone"`
	Email         string    `gorm:"size:100" json:"email"`
	Status        int       `gorm:"default:1" json:"status"`
	LastLoginAt   *time.Time `json:"last_login_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Institution   *Institution `gorm:"foreignKey:InstitutionID" json:"institution,omitempty"`
}

type TestItem struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Code           string    `gorm:"size:30;uniqueIndex;not null" json:"code"`
	Name           string    `gorm:"size:200;not null" json:"name"`
	Category       string    `gorm:"size:30;not null" json:"category"`
	SpecimenType   string    `gorm:"size:50" json:"specimen_type"`
	Unit           string    `gorm:"size:30" json:"unit"`
	RefRange       string    `gorm:"size:200" json:"ref_range"`
	MinValue       *float64  `json:"min_value"`
	MaxValue       *float64  `json:"max_value"`
	CriticalLow    *float64  `json:"critical_low"`
	CriticalHigh   *float64  `json:"critical_high"`
	Price          float64   `gorm:"not null" json:"price"`
	Device         string    `gorm:"size:100" json:"device"`
	TurnaroundTime int       `json:"turnaround_time"`
	Status         int       `gorm:"default:1" json:"status"`
	Description    string    `gorm:"size:500" json:"description"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type TestItemPackage struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Code        string    `gorm:"size:30;uniqueIndex;not null" json:"code"`
	Name        string    `gorm:"size:200;not null" json:"name"`
	Category    string    `gorm:"size:30" json:"category"`
	Price       float64   `gorm:"not null" json:"price"`
	OriginalPrice float64 `json:"original_price"`
	Status      int       `gorm:"default:1" json:"status"`
	Description string    `gorm:"size:500" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Items       []PackageItem `gorm:"foreignKey:PackageID" json:"items,omitempty"`
}

type PackageItem struct {
	ID         uint     `gorm:"primaryKey" json:"id"`
	PackageID  uint     `gorm:"index;not null" json:"package_id"`
	TestItemID uint     `gorm:"index;not null" json:"test_item_id"`
	TestItem   *TestItem `gorm:"foreignKey:TestItemID" json:"test_item,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type InstitutionPrice struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	InstitutionID uint      `gorm:"index:idx_inst_item,unique;not null" json:"institution_id"`
	TestItemID    uint      `gorm:"index:idx_inst_item,unique;not null" json:"test_item_id"`
	CustomPrice   float64   `gorm:"not null" json:"custom_price"`
	Discount      *float64  `json:"discount"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Sample struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Barcode       string    `gorm:"size:30;uniqueIndex;not null" json:"barcode"`
	InstitutionID uint      `gorm:"index;not null" json:"institution_id"`
	PatientID     string    `gorm:"size:50;index" json:"patient_id"`
	PatientName   string    `gorm:"size:50;not null" json:"patient_name"`
	Gender        string    `gorm:"size:10" json:"gender"`
	Age           int       `json:"age"`
	SpecimenType  string    `gorm:"size:50;not null" json:"specimen_type"`
	CollectTime   time.Time `gorm:"not null" json:"collect_time"`
	ArrivalTime   *time.Time `json:"arrival_time"`
	Status        string    `gorm:"size:20;index;not null" json:"status"`
	IsCritical    bool      `gorm:"default:false;index" json:"is_critical"`
	TotalPrice    float64   `gorm:"default:0" json:"total_price"`
	FinalPrice    float64   `gorm:"default:0" json:"final_price"`
	DoctorID      *uint     `json:"doctor_id"`
	ReviewerID    *uint     `json:"reviewer_id"`
	Remark        string    `gorm:"size:500" json:"remark"`
	CancelReason  string    `gorm:"size:200" json:"cancel_reason"`
	CreatedBy     uint      `gorm:"not null" json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Institution   *Institution   `gorm:"foreignKey:InstitutionID" json:"institution,omitempty"`
	Items         []SampleItem   `gorm:"foreignKey:SampleID" json:"items,omitempty"`
	StatusLogs    []SampleStatusLog `gorm:"foreignKey:SampleID" json:"status_logs,omitempty"`
	Report        *Report        `gorm:"foreignKey:SampleID" json:"report,omitempty"`
}

type SampleItem struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	SampleID     uint      `gorm:"index;not null" json:"sample_id"`
	TestItemID   uint      `gorm:"index;not null" json:"test_item_id"`
	PackageID    *uint     `gorm:"index" json:"package_id"`
	UnitPrice    float64   `gorm:"not null" json:"unit_price"`
	FinalPrice   float64   `gorm:"not null" json:"final_price"`
	TestItem     *TestItem `gorm:"foreignKey:TestItemID" json:"test_item,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type SampleStatusLog struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SampleID    uint      `gorm:"index;not null" json:"sample_id"`
	FromStatus  string    `gorm:"size:20" json:"from_status"`
	ToStatus    string    `gorm:"size:20;index;not null" json:"to_status"`
	OperatorID  uint      `gorm:"not null" json:"operator_id"`
	OperatorName string   `gorm:"size:50" json:"operator_name"`
	Remark      string    `gorm:"size:500" json:"remark"`
	CreatedAt   time.Time `gorm:"index;not null" json:"created_at"`
}

type TestResult struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SampleID    uint      `gorm:"index;not null" json:"sample_id"`
	SampleItemID uint     `gorm:"index;not null" json:"sample_item_id"`
	TestItemID  uint      `gorm:"index;not null" json:"test_item_id"`
	ResultValue string    `gorm:"size:100" json:"result_value"`
	NumericValue *float64 `json:"numeric_value"`
	IsCritical  bool      `gorm:"default:false;index" json:"is_critical"`
	IsAbnormal  bool      `gorm:"default:false" json:"is_abnormal"`
	Flag        string    `gorm:"size:10" json:"flag"`
	Device      string    `gorm:"size:100" json:"device"`
	TestTime    *time.Time `json:"test_time"`
	TestedBy    *uint     `json:"tested_by"`
	Remark      string    `gorm:"size:500" json:"remark"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CriticalValueRecord struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SampleID    uint      `gorm:"index;not null" json:"sample_id"`
	TestResultID uint     `gorm:"index;not null" json:"test_result_id"`
	TestItemID  uint      `gorm:"index;not null" json:"test_item_id"`
	ResultValue string    `gorm:"size:100;not null" json:"result_value"`
	RefRange    string    `gorm:"size:200" json:"ref_range"`
	AlertTime   time.Time `gorm:"index;not null" json:"alert_time"`
	FirstReviewedBy *uint `json:"first_reviewed_by"`
	FirstReviewedAt *time.Time `json:"first_reviewed_at"`
	FirstReviewComment string `gorm:"size:500" json:"first_review_comment"`
	SecondReviewedBy *uint `json:"second_reviewed_by"`
	SecondReviewedAt *time.Time `json:"second_reviewed_at"`
	SecondReviewComment string `gorm:"size:500" json:"second_review_comment"`
	IsFullyReviewed bool   `gorm:"default:false;index" json:"is_fully_reviewed"`
	Priority    int       `gorm:"default:1" json:"priority"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Report struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	SampleID     uint      `gorm:"uniqueIndex;not null" json:"sample_id"`
	ReportNo     string    `gorm:"size:30;uniqueIndex;not null" json:"report_no"`
	InstitutionID uint     `gorm:"index;not null" json:"institution_id"`
	Status       string    `gorm:"size:20;index;not null" json:"status"`
	DoctorID     *uint     `json:"doctor_id"`
	ReviewerID   *uint     `json:"reviewer_id"`
	DoctorName   string    `gorm:"size:50" json:"doctor_name"`
	ReviewerName string    `gorm:"size:50" json:"reviewer_name"`
	Signature    string    `gorm:"size:255" json:"signature"`
	GeneratedAt  *time.Time `json:"generated_at"`
	PublishedAt  *time.Time `json:"published_at"`
	FileData     []byte    `gorm:"type:bytea" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ReadLogs     []ReportReadLog `gorm:"foreignKey:ReportID" json:"read_logs,omitempty"`
}

type ReportReadLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ReportID      uint      `gorm:"index;not null" json:"report_id"`
	ReaderID      uint      `gorm:"not null" json:"reader_id"`
	ReaderName    string    `gorm:"size:50" json:"reader_name"`
	InstitutionID uint      `gorm:"index;not null" json:"institution_id"`
	ReadAt        time.Time `gorm:"index;not null" json:"read_at"`
	IPAddress     string    `gorm:"size:50" json:"ip_address"`
}

type Settlement struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	SettlementNo  string    `gorm:"size:30;uniqueIndex;not null" json:"settlement_no"`
	InstitutionID uint      `gorm:"index:idx_inst_month,unique;not null" json:"institution_id"`
	SettleYear    int       `gorm:"index:idx_inst_month,unique;not null" json:"settle_year"`
	SettleMonth   int       `gorm:"index:idx_inst_month,unique;not null" json:"settle_month"`
	TotalCount    int       `gorm:"default:0" json:"total_count"`
	TotalAmount   float64   `gorm:"default:0" json:"total_amount"`
	DiscountAmount float64  `gorm:"default:0" json:"discount_amount"`
	FinalAmount   float64   `gorm:"default:0" json:"final_amount"`
	Status        string    `gorm:"size:20;index;not null" json:"status"`
	ConfirmedBy   *uint     `json:"confirmed_by"`
	ConfirmedAt   *time.Time `json:"confirmed_at"`
	Remarks       string    `gorm:"size:500" json:"remarks"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Institution   *Institution `gorm:"foreignKey:InstitutionID" json:"institution,omitempty"`
	Details       []SettlementDetail `gorm:"foreignKey:SettlementID" json:"details,omitempty"`
}

type SettlementDetail struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	SettlementID  uint      `gorm:"index;not null" json:"settlement_id"`
	SampleID      uint      `gorm:"index;not null" json:"sample_id"`
	Barcode       string    `gorm:"size:30;index" json:"barcode"`
	PatientName   string    `gorm:"size:50" json:"patient_name"`
	ItemCount     int       `gorm:"default:0" json:"item_count"`
	TotalAmount   float64   `gorm:"default:0" json:"total_amount"`
	Discount      float64   `gorm:"default:0" json:"discount"`
	FinalAmount   float64   `gorm:"default:0" json:"final_amount"`
	CompletedAt   *time.Time `json:"completed_at"`
	CreatedAt     time.Time `json:"created_at"`
}

type AuditLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	TraceID    string    `gorm:"size:50;index" json:"trace_id"`
	UserID     uint      `gorm:"index" json:"user_id"`
	Username   string    `gorm:"size:50" json:"username"`
	Action     string    `gorm:"size:50;index;not null" json:"action"`
	Module     string    `gorm:"size:50;index;not null" json:"module"`
	ResourceID string    `gorm:"size:50;index" json:"resource_id"`
	IPAddress  string    `gorm:"size:50" json:"ip_address"`
	UserAgent  string    `gorm:"size:500" json:"user_agent"`
	Method     string    `gorm:"size:10" json:"method"`
	Path       string    `gorm:"size:255" json:"path"`
	ReqParams  string    `gorm:"type:text" json:"req_params"`
	RespCode   int       `json:"resp_code"`
	RespMessage string   `gorm:"size:500" json:"resp_message"`
	CreatedAt  time.Time `gorm:"index;not null" json:"created_at"`
}

type DailyCounter struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	InstitutionCode string  `gorm:"size:20;index:idx_date_code,unique;not null" json:"institution_code"`
	CountDate     string    `gorm:"size:10;index:idx_date_code,unique;not null" json:"count_date"`
	Counter       int64     `gorm:"default:0" json:"counter"`
	UpdatedAt     time.Time `json:"updated_at"`
}
