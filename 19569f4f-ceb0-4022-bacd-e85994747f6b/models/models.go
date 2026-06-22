package models

import (
	"time"

	"github.com/google/uuid"
)

type SystemConfig struct {
	ID               string        `json:"id" yaml:"id"`
	Name             string        `json:"name" yaml:"name"`
	Type             string        `json:"type" yaml:"type"`
	BaseURL          string        `json:"base_url" yaml:"base_url"`
	AuthType         string        `json:"auth_type" yaml:"auth_type"`
	Username         string        `json:"username" yaml:"username"`
	Password         string        `json:"password" yaml:"password"`
	CACertPath       string        `json:"ca_cert_path" yaml:"ca_cert_path"`
	USBKeyDriver     string        `json:"usb_key_driver" yaml:"usb_key_driver"`
	APIKey           string        `json:"api_key" yaml:"api_key"`
	Secret           string        `json:"secret" yaml:"secret"`
	MaxConcurrency   int           `json:"max_concurrency" yaml:"max_concurrency"`
	MaintenanceStart string        `json:"maintenance_start" yaml:"maintenance_start"`
	MaintenanceEnd   string        `json:"maintenance_end" yaml:"maintenance_end"`
	SessionTimeout   time.Duration `json:"session_timeout" yaml:"session_timeout"`
	KeepAliveInterval time.Duration `json:"keep_alive_interval" yaml:"keep_alive_interval"`
	Priority         int           `json:"priority" yaml:"priority"`
	Enabled          bool          `json:"enabled" yaml:"enabled"`
}

type Session struct {
	ID             uuid.UUID  `json:"id"`
	SystemID       string     `json:"system_id"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	LastActiveAt   time.Time  `json:"last_active_at"`
	ExpiresAt      time.Time  `json:"expires_at"`
	Cookies        []Cookie   `json:"-"`
	Token          string     `json:"-"`
	UserAgent      string     `json:"user_agent"`
	Proxy          string     `json:"proxy"`
	RetryCount     int        `json:"retry_count"`
	LastError      string     `json:"last_error,omitempty"`
}

type Cookie struct {
	Name     string    `json:"name"`
	Value    string    `json:"value"`
	Domain   string    `json:"domain"`
	Path     string    `json:"path"`
	Expires  time.Time `json:"expires"`
	HTTPOnly bool      `json:"http_only"`
	Secure   bool      `json:"secure"`
}

type QueryTask struct {
	ID           uuid.UUID       `json:"id"`
	SystemID     string          `json:"system_id"`
	QueryType    string          `json:"query_type"`
	QueryParams  map[string]any  `json:"query_params"`
	Priority     int             `json:"priority"`
	Status       string          `json:"status"`
	CreatedAt    time.Time       `json:"created_at"`
	StartedAt    *time.Time      `json:"started_at,omitempty"`
	CompletedAt  *time.Time      `json:"completed_at,omitempty"`
	RetryCount   int             `json:"retry_count"`
	MaxRetries   int             `json:"max_retries"`
	Timeout      time.Duration   `json:"timeout"`
	OperatorID   string          `json:"operator_id"`
	BatchID      *uuid.UUID      `json:"batch_id,omitempty"`
	Result       *CreditData     `json:"result,omitempty"`
	Error        string          `json:"error,omitempty"`
}

type BatchTask struct {
	ID            uuid.UUID       `json:"id"`
	Name          string          `json:"name"`
	SystemID      string          `json:"system_id"`
	QueryType     string          `json:"query_type"`
	QueryList     []map[string]any `json:"query_list"`
	Status        string          `json:"status"`
	TotalCount    int             `json:"total_count"`
	SuccessCount  int             `json:"success_count"`
	FailedCount   int             `json:"failed_count"`
	CreatedAt     time.Time       `json:"created_at"`
	CompletedAt   *time.Time      `json:"completed_at,omitempty"`
	OperatorID    string          `json:"operator_id"`
}

type CreditData struct {
	ID              uuid.UUID         `json:"id"`
	TaskID          uuid.UUID         `json:"task_id"`
	SourceSystem    string            `json:"source_system"`
	QueryKey        string            `json:"query_key"`
	QueryValue      string            `json:"query_value"`
	SubjectName     string            `json:"subject_name"`
	IDCardNo        string            `json:"id_card_no,omitempty"`
	EnterpriseName  string            `json:"enterprise_name,omitempty"`
	UnifiedCode     string            `json:"unified_code,omitempty"`
	CreditScore     int               `json:"credit_score,omitempty"`
	CreditLevel     string            `json:"credit_level,omitempty"`
	IsDishonest     bool              `json:"is_dishonest,omitempty"`
	IsExecuted      bool              `json:"is_executed,omitempty"`
	HasOverdue      bool              `json:"has_overdue,omitempty"`
	TaxCreditLevel  string            `json:"tax_credit_level,omitempty"`
	RegistrationStatus string         `json:"registration_status,omitempty"`
	RawData         map[string]any    `json:"raw_data,omitempty"`
	StandardFields  map[string]string `json:"standard_fields,omitempty"`
	DataQuality     float64           `json:"data_quality"`
	CollectedAt     time.Time         `json:"collected_at"`
}

type AuditLog struct {
	ID            uuid.UUID         `json:"id"`
	Timestamp     time.Time         `json:"timestamp"`
	OperatorID    string            `json:"operator_id"`
	SystemID      string            `json:"system_id"`
	Operation     string            `json:"operation"`
	QueryParams   map[string]string `json:"query_params,omitempty"`
	ResultSummary string            `json:"result_summary,omitempty"`
	DurationMs    int64             `json:"duration_ms"`
	Status        string            `json:"status"`
	IPAddress     string            `json:"ip_address"`
	UserAgent     string            `json:"user_agent"`
}

type FieldMapping struct {
	SourceField string `json:"source_field" yaml:"source_field"`
	TargetField string `json:"target_field" yaml:"target_field"`
	DataType    string `json:"data_type" yaml:"data_type"`
	Default     string `json:"default" yaml:"default"`
	Required    bool   `json:"required" yaml:"required"`
}

type SystemHealth struct {
	SystemID      string    `json:"system_id"`
	SystemName    string    `json:"system_name"`
	LoginStatus   string    `json:"login_status"`
	LastSyncTime  time.Time `json:"last_sync_time"`
	SessionTTL    int       `json:"session_ttl_seconds"`
	SuccessRate   float64   `json:"success_rate"`
	AvgLatencyMs  int64     `json:"avg_latency_ms"`
	ErrorCount    int       `json:"error_count"`
	IsMaintenance bool      `json:"is_maintenance"`
}

type Alert struct {
	ID        uuid.UUID `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	SystemID  string    `json:"system_id"`
	Message   string    `json:"message"`
	Details   string    `json:"details,omitempty"`
	Acknowledged bool   `json:"acknowledged"`
}
