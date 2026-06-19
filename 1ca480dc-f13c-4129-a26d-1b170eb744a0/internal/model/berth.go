package model

import (
	"time"
)

type Berth struct {
	ID          int64       `json:"id" gorm:"primaryKey;autoIncrement"`
	BerthCode   string      `json:"berth_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	BerthName   string      `json:"berth_name" gorm:"type:varchar(100);not null"`
	Terminal    string      `json:"terminal" gorm:"type:varchar(50);index"`
	Length      int         `json:"length"`
	Depth       float64     `json:"depth"`
	MaxVesselSize string    `json:"max_vessel_size" gorm:"type:varchar(20)"`
	Status      BerthStatus `json:"status" gorm:"type:varchar(20);index"`
	CurrentVesselID *int64  `json:"current_vessel_id" gorm:"index"`
	CurrentVesselName string `json:"current_vessel_name" gorm:"type:varchar(100)"`
	QuayCranes  []int64     `json:"quay_cranes" gorm:"-"`
	Remark      string      `json:"remark" gorm:"type:text"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type QuayCrane struct {
	ID          int64           `json:"id" gorm:"primaryKey;autoIncrement"`
	CraneCode   string          `json:"crane_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	CraneName   string          `json:"crane_name" gorm:"type:varchar(100);not null"`
	BerthID     int64           `json:"berth_id" gorm:"index"`
	BerthCode   string          `json:"berth_code" gorm:"type:varchar(50);index"`
	Status      QuayCraneStatus `json:"status" gorm:"type:varchar(20);index"`
	CurrentVesselID *int64      `json:"current_vessel_id" gorm:"index"`
	WorkingRate int             `json:"working_rate"`
	Remark      string          `json:"remark" gorm:"type:text"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type Vessel struct {
	ID            int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	VesselCode    string    `json:"vessel_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	VesselName    string    `json:"vessel_name" gorm:"type:varchar(100);not null;index"`
	VesselType    string    `json:"vessel_type" gorm:"type:varchar(50)"`
	LOA           int       `json:"loa"`
	CapacityTEU   int       `json:"capacity_teu"`
	ShippingLine  string    `json:"shipping_line" gorm:"type:varchar(100);index"`
	Flag          string    `json:"flag" gorm:"type:varchar(50)"`
	IMO           string    `json:"imo" gorm:"type:varchar(20);uniqueIndex"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type VesselCall struct {
	ID              int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	VesselID        int64      `json:"vessel_id" gorm:"index;not null"`
	VesselCode      string     `json:"vessel_code" gorm:"type:varchar(50);index"`
	VesselName      string     `json:"vessel_name" gorm:"type:varchar(100);index"`
	VoyageIn        string     `json:"voyage_in" gorm:"type:varchar(50)"`
	VoyageOut       string     `json:"voyage_out" gorm:"type:varchar(50)"`
	BerthID         *int64     `json:"berth_id" gorm:"index"`
	BerthCode       string     `json:"berth_code" gorm:"type:varchar(50);index"`
	ETA             *time.Time `json:"eta"`
	ETB             *time.Time `json:"etb"`
	ETD             *time.Time `json:"etd"`
	ATA             *time.Time `json:"ata"`
	ATB             *time.Time `json:"atb"`
	ATD             *time.Time `json:"atd"`
	ImportTEU       int        `json:"import_teu"`
	ExportTEU       int        `json:"export_teu"`
	TotalTEU        int        `json:"total_teu"`
	CraneCount      int        `json:"crane_count"`
	Status          string     `json:"status" gorm:"type:varchar(20);index"`
	ServiceType     string     `json:"service_type" gorm:"type:varchar(50)"`
	LastPort        string     `json:"last_port" gorm:"type:varchar(100)"`
	NextPort        string     `json:"next_port" gorm:"type:varchar(100)"`
	Remark          string     `json:"remark" gorm:"type:text"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type BerthPlan struct {
	ID              int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	PlanDate        time.Time  `json:"plan_date" gorm:"index"`
	BerthID         int64      `json:"berth_id" gorm:"index;not null"`
	BerthCode       string     `json:"berth_code" gorm:"type:varchar(50);index"`
	VesselCallID    int64      `json:"vessel_call_id" gorm:"index;not null"`
	VesselName      string     `json:"vessel_name" gorm:"type:varchar(100);index"`
	StartTime       *time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	QuayCraneIDs    []int64    `json:"quay_crane_ids" gorm:"-"`
	EstimatedTEU    int        `json:"estimated_teu"`
	Priority        int        `json:"priority"`
	Status          string     `json:"status" gorm:"type:varchar(20);index"`
	IsEmergency     bool       `json:"is_emergency" gorm:"default:false"`
	OptimizationScore float64  `json:"optimization_score"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type CraneAssignment struct {
	ID           int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	PlanID       int64      `json:"plan_id" gorm:"index;not null"`
	CraneID      int64      `json:"crane_id" gorm:"index;not null"`
	CraneCode    string     `json:"crane_code" gorm:"type:varchar(50)"`
	StartTime    *time.Time `json:"start_time"`
	EndTime      *time.Time `json:"end_time"`
	AssignedTEU  int        `json:"assigned_teu"`
	Status       string     `json:"status" gorm:"type:varchar(20);index"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type ScheduleRecommendation struct {
	PlanID          int64    `json:"plan_id"`
	BerthCode       string   `json:"berth_code"`
	VesselName      string   `json:"vessel_name"`
	RecommendedStart *time.Time `json:"recommended_start"`
	RecommendedEnd   *time.Time `json:"recommended_end"`
	AssignedCranes  []string `json:"assigned_cranes"`
	EstimatedDuration string `json:"estimated_duration"`
	OptimizationScore float64 `json:"optimization_score"`
	Notes           []string `json:"notes"`
}
