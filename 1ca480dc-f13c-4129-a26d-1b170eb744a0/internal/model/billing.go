package model

import (
	"time"
)

type StorageRate struct {
	ID            int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	RateCode      string        `json:"rate_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	RateName      string        `json:"rate_name" gorm:"type:varchar(200);not null"`
	ContainerType ContainerType `json:"container_type" gorm:"type:varchar(20);index"`
	ContainerSize ContainerSize `json:"container_size" gorm:"type:varchar(10);index"`
	FreeDays      int           `json:"free_days"`
	Day1To7Rate   float64       `json:"day_1_to_7_rate"`
	Day8To15Rate  float64       `json:"day_8_to_15_rate"`
	Day16PlusRate float64       `json:"day_16_plus_rate"`
	ReeferExtraRate float64     `json:"reefer_extra_rate"`
	DangerousExtraRate float64   `json:"dangerous_extra_rate"`
	Currency      string        `json:"currency" gorm:"type:varchar(10);default:CNY"`
	IsActive      bool          `json:"is_active" gorm:"default:true;index"`
	EffectiveFrom time.Time     `json:"effective_from"`
	EffectiveTo   *time.Time    `json:"effective_to"`
	Remark        string        `json:"remark" gorm:"type:text"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

type StorageBill struct {
	ID             int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	BillNo         string        `json:"bill_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	BillingPeriod  string        `json:"billing_period" gorm:"type:varchar(20);index"`
	ContainerID    int64         `json:"container_id" gorm:"index;not null"`
	ContainerNo    string        `json:"container_no" gorm:"type:varchar(20);index"`
	ContainerType  ContainerType `json:"container_type" gorm:"type:varchar(20)"`
	ContainerSize  ContainerSize `json:"container_size" gorm:"type:varchar(10)"`
	CustomerID     int64         `json:"customer_id" gorm:"index"`
	CustomerName   string        `json:"customer_name" gorm:"type:varchar(200);index"`
	ShippingLine   string        `json:"shipping_line" gorm:"type:varchar(100);index"`
	InTime         *time.Time    `json:"in_time"`
	OutTime        *time.Time    `json:"out_time"`
	FreeDays       int           `json:"free_days"`
	ChargeableDays int           `json:"chargeable_days"`
	Day1To7Days    int           `json:"day_1_to_7_days"`
	Day8To15Days   int           `json:"day_8_to_15_days"`
	Day16PlusDays  int           `json:"day_16_plus_days"`
	RateID         int64         `json:"rate_id"`
	Day1To7Rate    float64       `json:"day_1_to_7_rate"`
	Day8To15Rate   float64       `json:"day_8_to_15_rate"`
	Day16PlusRate  float64       `json:"day_16_plus_rate"`
	BaseAmount     float64       `json:"base_amount"`
	ExtraAmount    float64       `json:"extra_amount"`
	TotalAmount    float64       `json:"total_amount"`
	Currency       string        `json:"currency" gorm:"type:varchar(10);default:CNY"`
	Status         BillingStatus `json:"status" gorm:"type:varchar(20);index"`
	InvoiceID      *int64        `json:"invoice_id" gorm:"index"`
	Remark         string        `json:"remark" gorm:"type:text"`
	BillingTime    time.Time     `json:"billing_time"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type Invoice struct {
	ID            int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	InvoiceNo     string        `json:"invoice_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	InvoiceType   string        `json:"invoice_type" gorm:"type:varchar(20)"`
	CustomerID    int64         `json:"customer_id" gorm:"index;not null"`
	CustomerName  string        `json:"customer_name" gorm:"type:varchar(200);index"`
	BillingPeriod string        `json:"billing_period" gorm:"type:varchar(20);index"`
	BillCount     int           `json:"bill_count"`
	Subtotal      float64       `json:"subtotal"`
	TaxRate       float64       `json:"tax_rate"`
	TaxAmount     float64       `json:"tax_amount"`
	TotalAmount   float64       `json:"total_amount"`
	PaidAmount    float64       `json:"paid_amount"`
	Outstanding   float64       `json:"outstanding"`
	Currency      string        `json:"currency" gorm:"type:varchar(10);default:CNY"`
	Status        BillingStatus `json:"status" gorm:"type:varchar(20);index"`
	DueDate       *time.Time    `json:"due_date"`
	IssueDate     time.Time     `json:"issue_date"`
	PaidDate      *time.Time    `json:"paid_date"`
	Remark        string        `json:"remark" gorm:"type:text"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

type Payment struct {
	ID            int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	PaymentNo     string    `json:"payment_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	InvoiceID     int64     `json:"invoice_id" gorm:"index;not null"`
	InvoiceNo     string    `json:"invoice_no" gorm:"type:varchar(50);index"`
	CustomerID    int64     `json:"customer_id" gorm:"index"`
	CustomerName  string    `json:"customer_name" gorm:"type:varchar(200);index"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency" gorm:"type:varchar(10);default:CNY"`
	PaymentMethod string    `json:"payment_method" gorm:"type:varchar(50)"`
	TransactionNo string    `json:"transaction_no" gorm:"type:varchar(100)"`
	PaymentTime   time.Time `json:"payment_time"`
	OperatorID    int64     `json:"operator_id"`
	OperatorName  string    `json:"operator_name" gorm:"type:varchar(100)"`
	Remark        string    `json:"remark" gorm:"type:text"`
	CreatedAt     time.Time `json:"created_at"`
}

type BillDetailItem struct {
	ID             int64         `json:"id"`
	BillNo         string        `json:"bill_no"`
	ContainerNo    string        `json:"container_no"`
	ContainerType  ContainerType `json:"container_type"`
	ContainerSize  ContainerSize `json:"container_size"`
	InTime         *time.Time    `json:"in_time"`
	OutTime        *time.Time    `json:"out_time"`
	StorageDays    int           `json:"storage_days"`
	FreeDays       int           `json:"free_days"`
	ChargeableDays int           `json:"chargeable_days"`
	Amount         float64       `json:"amount"`
	Remark         string        `json:"remark"`
}

type MonthlySummary struct {
	Month          string  `json:"month"`
	TotalInvoices  int     `json:"total_invoices"`
	TotalBills     int     `json:"total_bills"`
	TotalAmount    float64 `json:"total_amount"`
	PaidAmount     float64 `json:"paid_amount"`
	Outstanding    float64 `json:"outstanding"`
	AverageDays    float64 `json:"average_storage_days"`
}
