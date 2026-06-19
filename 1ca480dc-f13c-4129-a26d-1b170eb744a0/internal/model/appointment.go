package model

import (
	"time"
)

type TruckAppointment struct {
	ID              int64             `json:"id" gorm:"primaryKey;autoIncrement"`
	AppointmentNo   string            `json:"appointment_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	TruckPlateNo    string            `json:"truck_plate_no" gorm:"type:varchar(20);index"`
	DriverName      string            `json:"driver_name" gorm:"type:varchar(100)"`
	DriverPhone     string            `json:"driver_phone" gorm:"type:varchar(20)"`
	DriverLicense   string            `json:"driver_license" gorm:"type:varchar(50)"`
	CompanyName     string            `json:"company_name" gorm:"type:varchar(200);index"`
	ContainerNo     string            `json:"container_no" gorm:"type:varchar(20);index"`
	ContainerType   ContainerType     `json:"container_type" gorm:"type:varchar(20)"`
	ContainerSize   ContainerSize     `json:"container_size" gorm:"type:varchar(10)"`
	OperationType   string            `json:"operation_type" gorm:"type:varchar(20);index"`
	GateID          int64             `json:"gate_id" gorm:"index"`
	GateCode        string            `json:"gate_code" gorm:"type:varchar(50)"`
	AppointmentDate time.Time         `json:"appointment_date" gorm:"index"`
	TimeSlot        string            `json:"time_slot" gorm:"type:varchar(20);index"`
	Status          AppointmentStatus `json:"status" gorm:"type:varchar(20);index"`
	CheckInTime     *time.Time        `json:"check_in_time"`
	CheckOutTime    *time.Time        `json:"check_out_time"`
	ExpireTime      *time.Time        `json:"expire_time"`
	IsBlacklisted   bool              `json:"is_blacklisted" gorm:"default:false;index"`
	Remark          string            `json:"remark" gorm:"type:text"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type Gate struct {
	ID             int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	GateCode       string `json:"gate_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	GateName       string `json:"gate_name" gorm:"type:varchar(100);not null"`
	Direction      string `json:"direction" gorm:"type:varchar(10)"`
	CapacityPerHour int   `json:"capacity_per_hour"`
	IsActive       bool   `json:"is_active" gorm:"default:true;index"`
	LaneCount      int    `json:"lane_count"`
	Remark         string `json:"remark" gorm:"type:text"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type GateSlotConfig struct {
	ID             int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	GateID         int64     `json:"gate_id" gorm:"index;not null"`
	GateCode       string    `json:"gate_code" gorm:"type:varchar(50)"`
	Date           time.Time `json:"date" gorm:"index"`
	TimeSlot       string    `json:"time_slot" gorm:"type:varchar(20);index"`
	TotalQuota     int       `json:"total_quota"`
	UsedQuota      int       `json:"used_quota"`
	RemainingQuota int       `json:"remaining_quota"`
	IsEnabled      bool      `json:"is_enabled" gorm:"default:true"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Blacklist struct {
	ID            int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	EntityType    string    `json:"entity_type" gorm:"type:varchar(20);index"`
	EntityValue   string    `json:"entity_value" gorm:"type:varchar(100);index"`
	Reason        string    `json:"reason" gorm:"type:text"`
	AddedBy       int64     `json:"added_by"`
	AddedByName   string    `json:"added_by_name" gorm:"type:varchar(100)"`
	EffectiveFrom time.Time `json:"effective_from"`
	EffectiveTo   *time.Time `json:"effective_to"`
	IsActive      bool      `json:"is_active" gorm:"default:true;index"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type GatePassRecord struct {
	ID             int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	AppointmentID  int64      `json:"appointment_id" gorm:"index"`
	AppointmentNo  string     `json:"appointment_no" gorm:"type:varchar(50);index"`
	GateID         int64      `json:"gate_id" gorm:"index"`
	GateCode       string     `json:"gate_code" gorm:"type:varchar(50)"`
	TruckPlateNo   string     `json:"truck_plate_no" gorm:"type:varchar(20);index"`
	ContainerNo    string     `json:"container_no" gorm:"type:varchar(20);index"`
	PassType       string     `json:"pass_type" gorm:"type:varchar(10)"`
	PassTime       time.Time  `json:"pass_time" gorm:"index"`
	OperatorID     int64      `json:"operator_id"`
	OperatorName   string     `json:"operator_name" gorm:"type:varchar(100)"`
	VerifyResult   string     `json:"verify_result" gorm:"type:varchar(20)"`
	Remark         string     `json:"remark" gorm:"type:text"`
	CreatedAt      time.Time  `json:"created_at"`
}

type AppointmentStatistics struct {
	Date              time.Time `json:"date"`
	GateCode          string    `json:"gate_code"`
	TotalAppointments int       `json:"total_appointments"`
	CheckedIn         int       `json:"checked_in"`
	Completed         int       `json:"completed"`
	Cancelled         int       `json:"cancelled"`
	Timeout           int       `json:"timeout"`
	AvgWaitTime       int       `json:"avg_wait_time_seconds"`
}
