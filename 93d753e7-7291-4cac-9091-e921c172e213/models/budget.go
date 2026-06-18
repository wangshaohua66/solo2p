package models

import (
	"time"
)

type DepartmentBudget struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Department    string    `gorm:"index;uniqueIndex:idx_department_month;size:50" json:"department"`
	Month         string    `gorm:"uniqueIndex:idx_department_month;size:7" json:"month"`
	TotalBudget   float64   `json:"total_budget"`
	UsedAmount    float64   `json:"used_amount"`
	ReservedAmount float64  `json:"reserved_amount"`
	RemainingAmount float64 `json:"remaining_amount"`
	UsagePercent  float64   `json:"usage_percent"`
	AlertSent     bool      `gorm:"default:false" json:"alert_sent"`
	Description   string    `gorm:"size:500" json:"description"`
}

type BookingRecord struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	BookingNo      string    `gorm:"index;unique;size:50" json:"booking_no"`
	EmployeeID     string    `gorm:"index;size:50" json:"employee_id"`
	EmployeeName   string    `gorm:"size:50" json:"employee_name"`
	Department     string    `gorm:"index;size:50" json:"department"`
	BookingType    string    `gorm:"size:20" json:"booking_type"`
	ItemName       string    `gorm:"size:200" json:"item_name"`
	Platform       string    `gorm:"size:50" json:"platform"`
	OrderNo        string    `gorm:"size:50" json:"order_no"`
	TravelDate     time.Time `json:"travel_date"`
	TotalAmount    float64   `json:"total_amount"`
	IsApproved     bool      `gorm:"default:false" json:"is_approved"`
	IsViolation    bool      `gorm:"default:false" json:"is_violation"`
	ViolationReason string   `gorm:"size:500" json:"violation_reason"`
	Status         string    `gorm:"size:20" json:"status"`
	Reconciled     bool      `gorm:"default:false" json:"reconciled"`
	ReconcileDate  time.Time `json:"reconcile_date"`
	InvoiceNo      string    `gorm:"size:50" json:"invoice_no"`
}

type TaskLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
	TaskName      string    `gorm:"index;size:100" json:"task_name"`
	TaskType      string    `gorm:"size:30" json:"task_type"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	DurationMs    int64     `json:"duration_ms"`
	Status        string    `gorm:"size:20" json:"status"`
	RetryCount    int       `json:"retry_count"`
	TotalItems    int       `json:"total_items"`
	SuccessItems  int       `json:"success_items"`
	FailedItems   int       `json:"failed_items"`
	Platform      string    `gorm:"size:50" json:"platform"`
	ErrorMessage  string    `gorm:"type:text" json:"error_message"`
	QueryParams   string    `gorm:"type:text" json:"query_params"`
}

type AlertRule struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	RuleName        string    `gorm:"size:100" json:"rule_name"`
	AlertType       string    `gorm:"size:30" json:"alert_type"`
	UserID          string    `gorm:"size:50" json:"user_id"`
	QueryKey        string    `gorm:"index;size:100" json:"query_key"`
	TargetPrice     float64   `json:"target_price"`
	DiscountRate    float64   `json:"discount_rate"`
	NotifyChannels  string    `gorm:"size:200" json:"notify_channels"`
	IsEnabled       bool      `gorm:"default:true" json:"is_enabled"`
	LastTriggeredAt time.Time `json:"last_triggered_at"`
	TriggerCount    int       `json:"trigger_count"`
	MaxTriggers     int       `gorm:"default:10" json:"max_triggers"`
}

type AlertRecord struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `gorm:"index" json:"created_at"`
	RuleID         uint      `gorm:"index" json:"rule_id"`
	AlertType      string    `gorm:"size:30" json:"alert_type"`
	Title          string    `gorm:"size:200" json:"title"`
	Content        string    `gorm:"type:text" json:"content"`
	Platform       string    `gorm:"size:50" json:"platform"`
	CurrentPrice   float64   `json:"current_price"`
	TargetPrice    float64   `json:"target_price"`
	PriceDropPct   float64   `json:"price_drop_pct"`
	ItemURL        string    `gorm:"size:500" json:"item_url"`
	ValidUntil     time.Time `json:"valid_until"`
	PriceRiseProb  float64   `json:"price_rise_prob"`
	Channels       string    `gorm:"size:200" json:"channels"`
	IsRead         bool      `gorm:"default:false" json:"is_read"`
}

type ReconcileRecord struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	CreatedAt       time.Time `json:"created_at"`
	Month           string    `gorm:"index;size:7" json:"month"`
	Platform        string    `gorm:"size:50" json:"platform"`
	PlatformOrderNo string    `gorm:"size:50" json:"platform_order_no"`
	InternalOrderNo string    `gorm:"size:50" json:"internal_order_no"`
	PlatformAmount  float64   `json:"platform_amount"`
	InternalAmount  float64   `json:"internal_amount"`
	AmountDiff      float64   `json:"amount_diff"`
	Status          string    `gorm:"size:20" json:"status"`
	Remark          string    `gorm:"size:500" json:"remark"`
}
