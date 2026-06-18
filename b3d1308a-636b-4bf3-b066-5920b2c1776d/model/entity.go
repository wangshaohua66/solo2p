package model

import (
	"time"
)

const (
	RoleAdmin       = "admin"
	RoleAreaManager = "area_manager"
	RoleOperator    = "operator"

	DeviceTypeHPS  = "hps"
	DeviceTypeLED  = "led"
	DeviceTypeView = "view"

	DeviceStatusOnline  = "online"
	DeviceStatusOffline = "offline"
	DeviceStatusFault   = "fault"

	FaultTypeVoltageAbnormal = "voltage_abnormal"
	FaultTypeOverCurrent     = "over_current"
	FaultTypeBrightnessDecay = "brightness_decay"
	FaultTypeCommInterrupt   = "comm_interrupt"
	FaultTypeOverTemperature = "over_temperature"
	FaultTypePowerAbnormal   = "power_abnormal"
	FaultTypeLightOff        = "light_off"
	FaultTypeOther           = "other"

	FaultLevelCritical = "critical"
	FaultLevelMajor    = "major"
	FaultLevelMinor    = "minor"
	FaultLevelWarning  = "warning"

	AlertStatusPending  = "pending"
	AlertStatusHandled  = "handled"
	AlertStatusIgnored  = "ignored"

	WorkOrderStatusCreated   = "created"
	WorkOrderStatusAccepted  = "accepted"
	WorkOrderStatusProcessing = "processing"
	WorkOrderStatusReviewing = "reviewing"
	WorkOrderStatusCompleted = "completed"

	PriorityHigh   = "high"
	PriorityMedium = "medium"
	PriorityLow    = "low"

	InspectionStatusPending    = "pending"
	InspectionStatusInProgress = "in_progress"
	InspectionStatusCompleted  = "completed"

	CommandStatusPending   = "pending"
	CommandStatusExecuting = "executing"
	CommandStatusSuccess   = "success"
	CommandStatusFailed    = "failed"
	CommandStatusTimeout   = "timeout"

	CommandTypeOn  = "on"
	CommandTypeOff = "off"
)

type User struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Username     string    `gorm:"size:64;uniqueIndex;not null" json:"username"`
	Password     string    `gorm:"size:255;not null" json:"-"`
	RealName     string    `gorm:"size:64" json:"real_name"`
	Role         string    `gorm:"size:32;not null;index" json:"role"`
	AreaID       int64     `gorm:"index" json:"area_id"`
	Phone        string    `gorm:"size:32" json:"phone"`
	Email        string    `gorm:"size:128" json:"email"`
	Status       int       `gorm:"default:1" json:"status"`
	LastLoginAt  time.Time `json:"last_login_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Area struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:128;not null" json:"name"`
	Code      string    `gorm:"size:64;uniqueIndex;not null" json:"code"`
	ParentID  int64     `gorm:"default:0;index" json:"parent_id"`
	ManagerID int64     `json:"manager_id"`
	DeviceCount int     `gorm:"default:0" json:"device_count"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Device struct {
	ID            int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DeviceCode    string    `gorm:"size:64;uniqueIndex;not null" json:"device_code"`
	DeviceType    string    `gorm:"size:32;not null;index" json:"device_type"`
	AreaID        int64     `gorm:"not null;index" json:"area_id"`
	CabinetID     int64     `gorm:"index" json:"cabinet_id"`
	Name          string    `gorm:"size:128" json:"name"`
	Longitude     float64   `json:"longitude"`
	Latitude      float64   `json:"latitude"`
	InstallDate   time.Time `json:"install_date"`
	Manufacturer  string    `gorm:"size:128" json:"manufacturer"`
	Model         string    `gorm:"size:128" json:"model"`
	RatedPower    float64   `json:"rated_power"`
	RatedVoltage  float64   `json:"rated_voltage"`
	Status        string    `gorm:"size:32;default:offline;index" json:"status"`
	Brightness    int       `gorm:"default:100" json:"brightness"`
	IsOn          bool      `gorm:"default:false" json:"is_on"`
	HealthScore   int       `gorm:"default:100;index" json:"health_score"`
	LastReportAt  time.Time `json:"last_report_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type DeviceStatus struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DeviceID    int64     `gorm:"not null;index:idx_device_time" json:"device_id"`
	Voltage     float64   `json:"voltage"`
	Current     float64   `json:"current"`
	Power       float64   `json:"power"`
	Brightness  int       `json:"brightness"`
	Temperature float64   `json:"temperature"`
	IsOn        bool      `json:"is_on"`
	Signal      int       `json:"signal"`
	ReportTime  time.Time `gorm:"index:idx_device_time" json:"report_time"`
	CreatedAt   time.Time `json:"created_at"`
}

type Cabinet struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	CabinetCode string    `gorm:"size:64;uniqueIndex;not null" json:"cabinet_code"`
	Name        string    `gorm:"size:128" json:"name"`
	AreaID      int64     `gorm:"not null;index" json:"area_id"`
	Longitude   float64   `json:"longitude"`
	Latitude    float64   `json:"latitude"`
	DeviceCount int       `gorm:"default:0" json:"device_count"`
	Status      string    `gorm:"size:32;default:normal" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type FaultRule struct {
	ID           int64   `gorm:"primaryKey;autoIncrement" json:"id"`
	FaultType    string  `gorm:"size:64;uniqueIndex;not null" json:"fault_type"`
	FaultName    string  `gorm:"size:128;not null" json:"fault_name"`
	Description  string  `gorm:"size:512" json:"description"`
	ThresholdMin float64 `json:"threshold_min"`
	ThresholdMax float64 `json:"threshold_max"`
	Weight       int     `gorm:"default:1;index" json:"weight"`
	FaultLevel   string  `gorm:"size:32;not null" json:"fault_level"`
	Duration     int     `gorm:"default:0;comment:持续时间(分钟)" json:"duration"`
	Enabled      bool    `gorm:"default:true" json:"enabled"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Fault struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	FaultCode   string    `gorm:"size:64;uniqueIndex;not null" json:"fault_code"`
	DeviceID    int64     `gorm:"not null;index" json:"device_id"`
	FaultType   string    `gorm:"size:64;not null;index" json:"fault_type"`
	FaultName   string    `gorm:"size:128" json:"fault_name"`
	FaultLevel  string    `gorm:"size:32;not null;index" json:"fault_level"`
	Description string    `gorm:"size:512" json:"description"`
	RuleID      int64     `json:"rule_id"`
	TriggerValue float64  `json:"trigger_value"`
	Status      string    `gorm:"size:32;default:pending;index" json:"status"`
	OccurredAt  time.Time `gorm:"index" json:"occurred_at"`
	RecoveredAt time.Time `json:"recovered_at"`
	WorkOrderID int64     `json:"work_order_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type WorkOrder struct {
	ID            int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderCode     string    `gorm:"size:64;uniqueIndex;not null" json:"order_code"`
	Title         string    `gorm:"size:256;not null" json:"title"`
	Description   string    `gorm:"size:1024" json:"description"`
	FaultID       int64     `gorm:"index" json:"fault_id"`
	DeviceID      int64     `gorm:"index" json:"device_id"`
	AreaID        int64     `gorm:"not null;index" json:"area_id"`
	Priority      string    `gorm:"size:32;default:medium;index" json:"priority"`
	Status        string    `gorm:"size:32;default:created;index" json:"status"`
	CreatorID     int64     `json:"creator_id"`
	AssigneeID    int64     `gorm:"index" json:"assignee_id"`
	AcceptTime    time.Time `json:"accept_time"`
	StartTime     time.Time `json:"start_time"`
	CompleteTime  time.Time `json:"complete_time"`
	ReviewTime    time.Time `json:"review_time"`
	DueTime       time.Time `json:"due_time"`
	ResponseTime  int       `gorm:"comment:响应时长(分钟)" json:"response_time"`
	HandleTime    int       `gorm:"comment:处理时长(分钟)" json:"handle_time"`
	Result        string    `gorm:"size:1024" json:"result"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type WorkOrderLog struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkOrderID int64     `gorm:"not null;index" json:"work_order_id"`
	FromStatus  string    `gorm:"size:32" json:"from_status"`
	ToStatus    string    `gorm:"size:32;not null" json:"to_status"`
	OperatorID  int64     `json:"operator_id"`
	Remark      string    `gorm:"size:512" json:"remark"`
	CreatedAt   time.Time `json:"created_at"`
}

type InspectionPlan struct {
	ID            int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	PlanCode      string    `gorm:"size:64;uniqueIndex;not null" json:"plan_code"`
	Name          string    `gorm:"size:256;not null" json:"name"`
	AreaID        int64     `gorm:"not null;index" json:"area_id"`
	CreatorID     int64     `json:"creator_id"`
	AssigneeID    int64     `gorm:"index" json:"assignee_id"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	DeviceIDs     string    `gorm:"size:4096;comment:设备ID列表,逗号分隔" json:"device_ids"`
	DeviceCount   int       `gorm:"default:0" json:"device_count"`
	Priority      string    `gorm:"size:32;default:medium" json:"priority"`
	Status        string    `gorm:"size:32;default:pending;index" json:"status"`
	Remark        string    `gorm:"size:1024" json:"remark"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type InspectionRecord struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	PlanID       int64     `gorm:"not null;index" json:"plan_id"`
	DeviceID     int64     `gorm:"not null;index" json:"device_id"`
	InspectorID  int64     `json:"inspector_id"`
	InspectTime  time.Time `json:"inspect_time"`
	Appearance   int       `gorm:"comment:外观评分" json:"appearance"`
	Function     int       `gorm:"comment:功能评分" json:"function"`
	Brightness   int       `gorm:"comment:亮度评分" json:"brightness"`
	Cable        int       `gorm:"comment:线缆评分" json:"cable"`
	Score        int       `gorm:"index" json:"score"`
	HasFault     bool      `json:"has_fault"`
	FaultDesc    string    `gorm:"size:512" json:"fault_desc"`
	Images       string    `gorm:"size:1024;comment:图片URL,逗号分隔" json:"images"`
	Remark       string    `gorm:"size:1024" json:"remark"`
	CreatedAt    time.Time `json:"created_at"`
}

type EnergyDaily struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Date        time.Time `gorm:"not null;index:idx_date_area" json:"date"`
	AreaID      int64     `gorm:"not null;index:idx_date_area" json:"area_id"`
	DeviceID    int64     `gorm:"default:0;index" json:"device_id"`
	DeviceType  string    `gorm:"size:32;index" json:"device_type"`
	EnergyUsage float64   `gorm:"comment:用电量(kWh)" json:"energy_usage"`
	LightHours  float64   `gorm:"comment:亮灯时长(小时)" json:"light_hours"`
	DeviceCount int       `json:"device_count"`
	CreatedAt   time.Time `json:"created_at"`
}

type ControlCommand struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	CommandCode  string    `gorm:"size:64;uniqueIndex;not null" json:"command_code"`
	CommandType  string    `gorm:"size:32;not null" json:"command_type"`
	Brightness   int       `gorm:"default:100" json:"brightness"`
	AreaID       int64     `gorm:"index" json:"area_id"`
	DeviceIDs    string    `gorm:"size:8192;comment:设备ID列表,逗号分隔" json:"device_ids"`
	DeviceCount  int       `gorm:"default:0" json:"device_count"`
	SuccessCount int       `gorm:"default:0" json:"success_count"`
	FailedCount  int       `gorm:"default:0" json:"failed_count"`
	Status       string    `gorm:"size:32;default:pending;index" json:"status"`
	RetryCount   int       `gorm:"default:0" json:"retry_count"`
	MaxRetry     int       `gorm:"default:3" json:"max_retry"`
	Timeout      int       `gorm:"default:60;comment:超时时间(秒)" json:"timeout"`
	CreatorID    int64     `json:"creator_id"`
	ExecuteAt    time.Time `json:"execute_at"`
	CompleteAt   time.Time `json:"complete_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ControlCommandDetail struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	CommandID   int64     `gorm:"not null;index" json:"command_id"`
	DeviceID    int64     `gorm:"not null;index" json:"device_id"`
	Status      string    `gorm:"size:32;default:pending;index" json:"status"`
	ErrorMessage string   `gorm:"size:512" json:"error_message"`
	ExecuteAt   time.Time `json:"execute_at"`
	CompleteAt  time.Time `json:"complete_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type Alert struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	AlertCode   string    `gorm:"size:64;uniqueIndex;not null" json:"alert_code"`
	DeviceID    int64     `gorm:"not null;index" json:"device_id"`
	FaultID     int64     `gorm:"index" json:"fault_id"`
	AlertType   string    `gorm:"size:64;not null;index" json:"alert_type"`
	AlertLevel  string    `gorm:"size:32;not null" json:"alert_level"`
	Title       string    `gorm:"size:256;not null" json:"title"`
	Content     string    `gorm:"size:1024" json:"content"`
	Status      string    `gorm:"size:32;default:pending;index" json:"status"`
	ReceiverIDs string    `gorm:"size:2048;comment:接收人ID列表" json:"receiver_ids"`
	PushChannels string   `gorm:"size:256;comment:推送渠道:sms,app,email" json:"push_channels"`
	PushedAt    time.Time `json:"pushed_at"`
	HandledBy   int64     `json:"handled_by"`
	HandledAt   time.Time `json:"handled_at"`
	HandleRemark string   `gorm:"size:512" json:"handle_remark"`
	CreatedAt   time.Time `json:"created_at"`
}

type TokenBlacklist struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Token     string    `gorm:"size:512;uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null;index" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type OperationLog struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	RequestID  string    `gorm:"size:64;index" json:"request_id"`
	UserID     int64     `gorm:"index" json:"user_id"`
	Username   string    `gorm:"size:64" json:"username"`
	Module     string    `gorm:"size:64;index" json:"module"`
	Operation  string    `gorm:"size:128" json:"operation"`
	Method     string    `gorm:"size:16" json:"method"`
	URL        string    `gorm:"size:512" json:"url"`
	IP         string    `gorm:"size:64" json:"ip"`
	Params     string    `gorm:"type:text" json:"params"`
	Result     string    `gorm:"type:text" json:"result"`
	StatusCode int       `json:"status_code"`
	Duration   int64     `gorm:"comment:耗时(ms)" json:"duration"`
	CreatedAt  time.Time `json:"created_at"`
}

type Response struct {
	Code      int         `json:"code"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

type PageResult struct {
	List      interface{} `json:"list"`
	Total     int64       `json:"total"`
	Page      int         `json:"page"`
	PageSize  int         `json:"page_size"`
	PageCount int         `json:"page_count"`
}
