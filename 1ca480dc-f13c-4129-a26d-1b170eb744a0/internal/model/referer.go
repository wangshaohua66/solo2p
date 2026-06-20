package model

import (
	"time"
)

type RefererType string

const (
	RefererTypeForwarder RefererType = "FORWARDER"
	RefererTypeShipper   RefererType = "SHIPPER"
	RefererTypeConsignee RefererType = "CONSIGNEE"
	RefererTypeAgent     RefererType = "AGENT"
)

type RefererStatus string

const (
	RefererStatusActive   RefererStatus = "ACTIVE"
	RefererStatusInactive RefererStatus = "INACTIVE"
	RefererStatusBlacklist RefererStatus = "BLACKLIST"
	RefererStatusPending  RefererStatus = "PENDING"
)

type BookingStatus string

const (
	BookingStatusDraft     BookingStatus = "DRAFT"
	BookingStatusSubmitted BookingStatus = "SUBMITTED"
	BookingStatusConfirmed BookingStatus = "CONFIRMED"
	BookingStatusRejected  BookingStatus = "REJECTED"
	BookingStatusCancelled BookingStatus = "CANCELLED"
	BookingStatusCompleted BookingStatus = "COMPLETED"
)

type SettlementType string

const (
	SettlementTypePrepaid  SettlementType = "PREPAID"
	SettlementTypeCollect  SettlementType = "COLLECT"
	SettlementTypeMonthly  SettlementType = "MONTHLY"
)

type Referer struct {
	ID               int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	RefererCode      string        `json:"referer_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	RefererName      string        `json:"referer_name" gorm:"type:varchar(200);index;not null"`
	RefererType      RefererType   `json:"referer_type" gorm:"type:varchar(20);index;not null"`
	ShortName        string        `json:"short_name" gorm:"type:varchar(100)"`
	UnifiedSocialCode string       `json:"unified_social_code" gorm:"type:varchar(50);uniqueIndex"`
	LegalPerson      string        `json:"legal_person" gorm:"type:varchar(100)"`
	RegisteredCapital float64      `json:"registered_capital"`
	BusinessScope    string        `json:"business_scope" gorm:"type:text"`
	BusinessLicense  string        `json:"business_license" gorm:"type:varchar(200)"`
	NVOCCLicense     string        `json:"nvocc_license" gorm:"type:varchar(100)"`
	Level            string        `json:"level" gorm:"type:varchar(20)"`
	CreditRating     string        `json:"credit_rating" gorm:"type:varchar(20);index"`
	CreditLimit      float64       `json:"credit_limit"`
	CreditUsed       float64       `json:"credit_used"`
	Status           RefererStatus `json:"status" gorm:"type:varchar(20);index;default:ACTIVE"`
	Country          string        `json:"country" gorm:"type:varchar(100)"`
	Province         string        `json:"province" gorm:"type:varchar(100)"`
	City             string        `json:"city" gorm:"type:varchar(100)"`
	Address          string        `json:"address" gorm:"type:varchar(500)"`
	PostalCode       string        `json:"postal_code" gorm:"type:varchar(20)"`
	ContactPerson    string        `json:"contact_person" gorm:"type:varchar(100)"`
	ContactPhone     string        `json:"contact_phone" gorm:"type:varchar(50)"`
	ContactEmail     string        `json:"contact_email" gorm:"type:varchar(200)"`
	ContactFax       string        `json:"contact_fax" gorm:"type:varchar(50)"`
	Website          string        `json:"website" gorm:"type:varchar(200)"`
	BankName         string        `json:"bank_name" gorm:"type:varchar(200)"`
	BankAccount      string        `json:"bank_account" gorm:"type:varchar(100)"`
	TaxNo            string        `json:"tax_no" gorm:"type:varchar(50)"`
	SettlementType   SettlementType `json:"settlement_type" gorm:"type:varchar(20)"`
	SettlementCycle  int           `json:"settlement_cycle"`
	TotalShipments   int64         `json:"total_shipments"`
	TotalTEU         float64       `json:"total_teu"`
	Remark           string        `json:"remark" gorm:"type:text"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

type RefererContact struct {
	ID           int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	RefererID    int64  `json:"referer_id" gorm:"index;not null"`
	RefererCode  string `json:"referer_code" gorm:"type:varchar(50);index"`
	Name         string `json:"name" gorm:"type:varchar(100);not null"`
	Position     string `json:"position" gorm:"type:varchar(100)"`
	Department   string `json:"department" gorm:"type:varchar(100)"`
	Phone        string `json:"phone" gorm:"type:varchar(50)"`
	Mobile       string `json:"mobile" gorm:"type:varchar(50)"`
	Email        string `json:"email" gorm:"type:varchar(200)"`
	WeChat       string `json:"wechat" gorm:"type:varchar(100)"`
	IsPrimary    bool   `json:"is_primary" gorm:"default:false"`
	Remark       string `json:"remark" gorm:"type:text"`
}

type BookingOrder struct {
	ID                int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	BookingNo         string        `json:"booking_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	RefererID         int64         `json:"referer_id" gorm:"index;not null"`
	RefererCode       string        `json:"referer_code" gorm:"type:varchar(50);index"`
	RefererName       string        `json:"referer_name" gorm:"type:varchar(200);index"`
	ShipperID         int64         `json:"shipper_id" gorm:"index"`
	ShipperCode       string        `json:"shipper_code" gorm:"type:varchar(50);index"`
	ShipperName       string        `json:"shipper_name" gorm:"type:varchar(200)"`
	ConsigneeID       int64         `json:"consignee_id" gorm:"index"`
	ConsigneeName     string        `json:"consignee_name" gorm:"type:varchar(200)"`
	VesselCallID      int64         `json:"vessel_call_id" gorm:"index"`
	VesselName        string        `json:"vessel_name" gorm:"type:varchar(100)"`
	VoyageNo          string        `json:"voyage_no" gorm:"type:varchar(50)"`
	PortOfLoading     string        `json:"port_of_loading" gorm:"type:varchar(100)"`
	PortOfDischarge   string        `json:"port_of_discharge" gorm:"type:varchar(100)"`
	FinalDestination  string        `json:"final_destination" gorm:"type:varchar(200)"`
	ETD               *time.Time    `json:"etd"`
	ETA               *time.Time    `json:"eta"`
	ServiceType       string        `json:"service_type" gorm:"type:varchar(50)"`
	ContainerCount    int           `json:"container_count"`
	TotalTEU          float64       `json:"total_teu"`
	TotalWeight       float64       `json:"total_weight"`
	GoodsDescription  string        `json:"goods_description" gorm:"type:text"`
	HasDangerousGoods bool          `json:"has_dangerous_goods" gorm:"default:false"`
	HasReefer         bool          `json:"has_reefer" gorm:"default:false"`
	SpecialRequirements string      `json:"special_requirements" gorm:"type:text"`
	SettlementType    SettlementType `json:"settlement_type" gorm:"type:varchar(20)"`
	FreightAmount     float64       `json:"freight_amount"`
	OtherCharges      float64       `json:"other_charges"`
	TotalAmount       float64       `json:"total_amount"`
	Currency          string        `json:"currency" gorm:"type:varchar(10);default:CNY"`
	Status            BookingStatus `json:"status" gorm:"type:varchar(20);index;default:DRAFT"`
	SubmittedAt       *time.Time    `json:"submitted_at"`
	ConfirmedAt       *time.Time    `json:"confirmed_at"`
	RejectedReason    string        `json:"rejected_reason" gorm:"type:text"`
	OperatorID        int64         `json:"operator_id"`
	OperatorName      string        `json:"operator_name" gorm:"type:varchar(100)"`
	Remark            string        `json:"remark" gorm:"type:text"`
	CreatedAt         time.Time     `json:"created_at"`
	UpdatedAt         time.Time     `json:"updated_at"`
}

type RefererShipmentRecord struct {
	ID            int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	RefererID     int64     `json:"referer_id" gorm:"index;not null"`
	RefererCode   string    `json:"referer_code" gorm:"type:varchar(50);index"`
	BookingID     int64     `json:"booking_id" gorm:"index"`
	BookingNo     string    `json:"booking_no" gorm:"type:varchar(50);index"`
	ContainerID   int64     `json:"container_id" gorm:"index"`
	ContainerNo   string    `json:"container_no" gorm:"type:varchar(20);index"`
	VesselCallID  int64     `json:"vessel_call_id" gorm:"index"`
	VesselName    string    `json:"vessel_name" gorm:"type:varchar(100)"`
	VoyageNo      string    `json:"voyage_no" gorm:"type:varchar(50)"`
	TEU           float64   `json:"teu"`
	Weight        float64   `json:"weight"`
	OperationType string    `json:"operation_type" gorm:"type:varchar(20)"`
	OperationTime time.Time `json:"operation_time" gorm:"index"`
	Amount        float64   `json:"amount"`
	Settled       bool      `json:"settled" gorm:"default:false"`
	SettledAt     *time.Time `json:"settled_at"`
	Remark        string    `json:"remark" gorm:"type:text"`
	CreatedAt     time.Time `json:"created_at"`
}

type RefererStatistics struct {
	RefererID     int64   `json:"referer_id"`
	RefererCode   string  `json:"referer_code"`
	RefererName   string  `json:"referer_name"`
	TotalBookings int64   `json:"total_bookings"`
	MonthBookings int64   `json:"month_bookings"`
	TotalTEU      float64 `json:"total_teu"`
	MonthTEU      float64 `json:"month_teu"`
	TotalAmount   float64 `json:"total_amount"`
	MonthAmount   float64 `json:"month_amount"`
	UnpaidAmount  float64 `json:"unpaid_amount"`
	OverdueAmount float64 `json:"overdue_amount"`
}
