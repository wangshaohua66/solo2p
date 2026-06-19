package model

import (
	"time"
)

type ReeferContainer struct {
	ID              int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	ContainerID     int64      `json:"container_id" gorm:"uniqueIndex;not null"`
	ContainerNo     string     `json:"container_no" gorm:"type:varchar(20);uniqueIndex;not null"`
	SetTemperature  float64    `json:"set_temperature"`
	MinTemperature  float64    `json:"min_temperature"`
	MaxTemperature  float64    `json:"max_temperature"`
	CurrentTemperature float64 `json:"current_temperature"`
	Humidity        float64    `json:"humidity"`
	DeviceID        string     `json:"device_id" gorm:"type:varchar(100);index"`
	LastReportTime  *time.Time `json:"last_report_time"`
	HasAlert        bool       `json:"has_alert" gorm:"default:false;index"`
	AlertCount      int        `json:"alert_count"`
	Status          string     `json:"status" gorm:"type:varchar(20);index"`
	PowerStatus     string     `json:"power_status" gorm:"type:varchar(20)"`
	Remark          string     `json:"remark" gorm:"type:text"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type TemperatureReading struct {
	ID              int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	ContainerID     int64     `json:"container_id" gorm:"index"`
	ContainerNo     string    `json:"container_no" gorm:"type:varchar(20);index"`
	DeviceID        string    `json:"device_id" gorm:"type:varchar(100);index"`
	Temperature     float64   `json:"temperature"`
	Humidity        float64   `json:"humidity"`
	ReadingTime     time.Time `json:"reading_time" gorm:"index"`
	IsAbnormal      bool      `json:"is_abnormal" gorm:"default:false;index"`
	AbnormalType    string    `json:"abnormal_type" gorm:"type:varchar(20)"`
	ReceivedAt      time.Time `json:"received_at"`
}

type TemperatureAlert struct {
	ID              int64       `json:"id" gorm:"primaryKey;autoIncrement"`
	AlertCode       string      `json:"alert_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	ContainerID     int64       `json:"container_id" gorm:"index;not null"`
	ContainerNo     string      `json:"container_no" gorm:"type:varchar(20);index"`
	Level           AlertLevel  `json:"level" gorm:"type:varchar(20);index"`
	AlertType       string      `json:"alert_type" gorm:"type:varchar(50)"`
	Temperature     float64     `json:"temperature"`
	Threshold       float64     `json:"threshold"`
	Description     string      `json:"description" gorm:"type:text"`
	Status          AlertStatus `json:"status" gorm:"type:varchar(20);index"`
	WorkOrderID     *int64      `json:"work_order_id" gorm:"index"`
	HandlerID       *int64      `json:"handler_id" gorm:"index"`
	HandlerName     string      `json:"handler_name" gorm:"type:varchar(100)"`
	EscalationLevel int         `json:"escalation_level" gorm:"default:0"`
	StartTime       time.Time   `json:"start_time"`
	EndTime         *time.Time  `json:"end_time"`
	Remark          string      `json:"remark" gorm:"type:text"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

type AlertWorkOrder struct {
	ID              int64       `json:"id" gorm:"primaryKey;autoIncrement"`
	WorkOrderNo     string      `json:"work_order_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	AlertID         int64       `json:"alert_id" gorm:"index;not null"`
	ContainerID     int64       `json:"container_id" gorm:"index;not null"`
	ContainerNo     string      `json:"container_no" gorm:"type:varchar(20);index"`
	Title           string      `json:"title" gorm:"type:varchar(200)"`
	Description     string      `json:"description" gorm:"type:text"`
	Level           AlertLevel  `json:"level" gorm:"type:varchar(20)"`
	Status          AlertStatus `json:"status" gorm:"type:varchar(20);index"`
	Priority        int         `json:"priority"`
	AssigneeID      *int64      `json:"assignee_id" gorm:"index"`
	AssigneeName    string      `json:"assignee_name" gorm:"type:varchar(100)"`
	OwnerContact    string      `json:"owner_contact" gorm:"type:varchar(200)"`
	NotifySent      bool        `json:"notify_sent" gorm:"default:false"`
	NotifyTime      *time.Time  `json:"notify_time"`
	HandleResult    string      `json:"handle_result" gorm:"type:text"`
	HandleTime      *time.Time  `json:"handle_time"`
	DueTime         *time.Time  `json:"due_time"`
	ClosedTime      *time.Time  `json:"closed_time"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

type AlertNotification struct {
	ID              int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	AlertID         int64     `json:"alert_id" gorm:"index;not null"`
	WorkOrderID     int64     `json:"work_order_id" gorm:"index;not null"`
	RecipientType   string    `json:"recipient_type" gorm:"type:varchar(20)"`
	RecipientID     int64     `json:"recipient_id"`
	RecipientName   string    `json:"recipient_name" gorm:"type:varchar(100)"`
	RecipientContact string   `json:"recipient_contact" gorm:"type:varchar(200)"`
	Channel         string    `json:"channel" gorm:"type:varchar(20)"`
	Content         string    `json:"content" gorm:"type:text"`
	Status          string    `json:"status" gorm:"type:varchar(20);index"`
	SentTime        *time.Time `json:"sent_time"`
	ReadTime        *time.Time `json:"read_time"`
	CreatedAt       time.Time `json:"created_at"`
}
