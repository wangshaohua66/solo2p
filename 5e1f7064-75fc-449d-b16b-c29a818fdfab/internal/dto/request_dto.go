package dto

import "time"

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6,max=50"`
}

type LoginResponse struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expires_in"`
	User      UserInfo `json:"user"`
}

type UserInfo struct {
	ID            uint   `json:"id"`
	Username      string `json:"username"`
	RealName      string `json:"real_name"`
	Role          string `json:"role"`
	InstitutionID uint   `json:"institution_id"`
	Institution   string `json:"institution,omitempty"`
}

type PageQuery struct {
	Page     int `form:"page,default=1" binding:"min=1"`
	PageSize int `form:"page_size,default=20" binding:"min=1,max=100"`
}

type CreateInstitutionRequest struct {
	Code     string  `json:"code" binding:"required,min=2,max=20"`
	Name     string  `json:"name" binding:"required,min=2,max=200"`
	Type     string  `json:"type" binding:"required,oneof=COMMUNITY TOWNSHIP CLINIC"`
	Contact  string  `json:"contact" binding:"max=50"`
	Phone    string  `json:"phone" binding:"max=30"`
	Email    string  `json:"email" binding:"omitempty,email,max=100"`
	Address  string  `json:"address" binding:"max=500"`
	Discount float64 `json:"discount" binding:"min=0,max=1"`
	MinPrice float64 `json:"min_price" binding:"min=0"`
}

type UpdateInstitutionRequest struct {
	Name     string  `json:"name" binding:"omitempty,min=2,max=200"`
	Type     string  `json:"type" binding:"omitempty,oneof=COMMUNITY TOWNSHIP CLINIC"`
	Contact  string  `json:"contact" binding:"max=50"`
	Phone    string  `json:"phone" binding:"max=30"`
	Email    string  `json:"email" binding:"omitempty,email,max=100"`
	Address  string  `json:"address" binding:"max=500"`
	Discount float64 `json:"discount" binding:"omitempty,min=0,max=1"`
	MinPrice float64 `json:"min_price" binding:"min=0"`
	Status   *int    `json:"status" binding:"omitempty,oneof=0 1"`
}

type InstitutionQuery struct {
	PageQuery
	Keyword string `form:"keyword" binding:"max=100"`
	Type    string `form:"type" binding:"omitempty,oneof=COMMUNITY TOWNSHIP CLINIC"`
	Status  *int   `form:"status" binding:"omitempty,oneof=0 1"`
}

type CreateTestItemRequest struct {
	Code           string   `json:"code" binding:"required,min=2,max=30"`
	Name           string   `json:"name" binding:"required,min=1,max=200"`
	Category       string   `json:"category" binding:"required,oneof=CLINICAL PATHOLOGY GENETIC"`
	SpecimenType   string   `json:"specimen_type" binding:"max=50"`
	Unit           string   `json:"unit" binding:"max=30"`
	RefRange       string   `json:"ref_range" binding:"max=200"`
	MinValue       *float64 `json:"min_value"`
	MaxValue       *float64 `json:"max_value"`
	CriticalLow    *float64 `json:"critical_low"`
	CriticalHigh   *float64 `json:"critical_high"`
	Price          float64  `json:"price" binding:"required,min=0"`
	Device         string   `json:"device" binding:"max=100"`
	TurnaroundTime int      `json:"turnaround_time" binding:"min=0"`
	Description    string   `json:"description" binding:"max=500"`
}

type UpdateTestItemRequest struct {
	Name           string   `json:"name" binding:"omitempty,min=1,max=200"`
	Category       string   `json:"category" binding:"omitempty,oneof=CLINICAL PATHOLOGY GENETIC"`
	SpecimenType   string   `json:"specimen_type" binding:"max=50"`
	Unit           string   `json:"unit" binding:"max=30"`
	RefRange       string   `json:"ref_range" binding:"max=200"`
	MinValue       *float64 `json:"min_value"`
	MaxValue       *float64 `json:"max_value"`
	CriticalLow    *float64 `json:"critical_low"`
	CriticalHigh   *float64 `json:"critical_high"`
	Price          *float64 `json:"price" binding:"omitempty,min=0"`
	Device         string   `json:"device" binding:"max=100"`
	TurnaroundTime *int     `json:"turnaround_time" binding:"omitempty,min=0"`
	Description    string   `json:"description" binding:"max=500"`
	Status         *int     `json:"status" binding:"omitempty,oneof=0 1"`
}

type TestItemQuery struct {
	PageQuery
	Keyword  string `form:"keyword" binding:"max=100"`
	Category string `form:"category" binding:"omitempty,oneof=CLINICAL PATHOLOGY GENETIC"`
	Status   *int   `form:"status" binding:"omitempty,oneof=0 1"`
}

type SampleItemInput struct {
	TestItemID uint    `json:"test_item_id" binding:"required,min=1"`
	PackageID  *uint   `json:"package_id"`
	UnitPrice  float64 `json:"unit_price" binding:"min=0"`
}

type CreateSampleRequest struct {
	InstitutionID uint             `json:"institution_id" binding:"required,min=1"`
	PatientID     string           `json:"patient_id" binding:"required,max=50"`
	PatientName   string           `json:"patient_name" binding:"required,max=50"`
	Gender        string           `json:"gender" binding:"required,oneof=MALE FEMALE UNKNOWN"`
	Age           int              `json:"age" binding:"min=0,max=150"`
	SpecimenType  string           `json:"specimen_type" binding:"required,max=50"`
	CollectTime   time.Time        `json:"collect_time" binding:"required"`
	Items         []SampleItemInput `json:"items" binding:"required,min=1,dive"`
	Remark        string           `json:"remark" binding:"max=500"`
}

type BatchCreateSampleRequest struct {
	Samples []CreateSampleRequest `json:"samples" binding:"required,min=1,max=500,dive"`
}

type UpdateSampleStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=IN_TRANSIT RECEIVED TESTING REVIEWING COMPLETED CANCELLED"`
	Remark string `json:"remark" binding:"max=500"`
}

type CancelSampleRequest struct {
	Reason string `json:"reason" binding:"required,max=200"`
}

type SampleQuery struct {
	PageQuery
	Barcode        string    `form:"barcode" binding:"max=30"`
	InstitutionID  *uint     `form:"institution_id" binding:"omitempty,min=1"`
	Status         string    `form:"status" binding:"omitempty,oneof=COLLECTED IN_TRANSIT RECEIVED TESTING REVIEWING COMPLETED CANCELLED"`
	PatientID      string    `form:"patient_id" binding:"max=50"`
	PatientName    string    `form:"patient_name" binding:"max=50"`
	IsCritical     *bool     `form:"is_critical"`
	StartTime      *time.Time `form:"start_time" time_format:"2006-01-02 15:04:05"`
	EndTime        *time.Time `form:"end_time" time_format:"2006-01-02 15:04:05"`
}

type TestResultInput struct {
	SampleItemID uint     `json:"sample_item_id" binding:"required,min=1"`
	TestItemID   uint     `json:"test_item_id" binding:"required,min=1"`
	ResultValue  string   `json:"result_value" binding:"required,max=100"`
	NumericValue *float64 `json:"numeric_value"`
	Device       string   `json:"device" binding:"max=100"`
	Remark       string   `json:"remark" binding:"max=500"`
}

type SubmitTestResultsRequest struct {
	SampleID uint              `json:"sample_id" binding:"required,min=1"`
	Results  []TestResultInput `json:"results" binding:"required,min=1,dive"`
}

type ReviewCriticalValueRequest struct {
	RecordID uint   `json:"record_id" binding:"required,min=1"`
	Comment  string `json:"comment" binding:"required,max=500"`
	IsSecond bool   `json:"is_second"`
}

type SampleReportQuery struct {
	PageQuery
	InstitutionID *uint  `form:"institution_id" binding:"omitempty,min=1"`
	Barcode       string `form:"barcode" binding:"max=30"`
	Status        string `form:"status" binding:"omitempty,oneof=GENERATED PUBLISHED READ REVOKED"`
	IsRead        *bool  `form:"is_read"`
}

type CreateSettlementRequest struct {
	InstitutionID uint `json:"institution_id" binding:"required,min=1"`
	SettleYear    int  `json:"settle_year" binding:"required,min=2000,max=2100"`
	SettleMonth   int  `json:"settle_month" binding:"required,min=1,max=12"`
}

type ConfirmSettlementRequest struct {
	Remarks string `json:"remarks" binding:"max=500"`
}

type SettlementQuery struct {
	PageQuery
	InstitutionID *uint  `form:"institution_id" binding:"omitempty,min=1"`
	SettleYear    *int   `form:"settle_year" binding:"omitempty,min=2000,max=2100"`
	SettleMonth   *int   `form:"settle_month" binding:"omitempty,min=1,max=12"`
	Status        string `form:"status" binding:"omitempty,oneof=DRAFT PENDING CONFIRMED PAID"`
}

type StatisticsQuery struct {
	StartTime     time.Time `form:"start_time" binding:"required" time_format:"2006-01-02"`
	EndTime       time.Time `form:"end_time" binding:"required" time_format:"2006-01-02"`
	InstitutionID *uint     `form:"institution_id" binding:"omitempty,min=1"`
	Dimension     string    `form:"dimension" binding:"required,oneof=institution category status item urgency tat tat_institution"`
}

type CriticalAlertQuery struct {
	PageQuery
	SampleID      *uint   `form:"sample_id" binding:"omitempty,min=1"`
	TestItemID    *uint   `form:"test_item_id" binding:"omitempty,min=1"`
	InstitutionID *uint   `form:"institution_id" binding:"omitempty,min=1"`
	Status        string  `form:"status" binding:"omitempty,oneof=PENDING SENT FAILED"`
	AlertType     string  `form:"alert_type" binding:"omitempty,oneof=SYSTEM SMS EMAIL WEBHOOK"`
	TargetType    string  `form:"target_type" binding:"omitempty,oneof=USER INSTITUTION ADMIN"`
}
