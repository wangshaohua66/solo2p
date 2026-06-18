package model

import "time"

const (
	VesselTypeLongline  = "longline"
	VesselTypeTrawl     = "trawl"
	VesselTypeSeine     = "seine"
	VesselTypeCollector = "collector"
)

const (
	VesselStatusActive   = "active"
	VesselStatusInactive = "inactive"
	VesselStatusDocked   = "docked"
)

type Vessel struct {
	ID            string    `json:"id" bson:"_id"`
	VesselNo      string    `json:"vessel_no" bson:"vessel_no"`
	Name          string    `json:"name" bson:"name"`
	Type          string    `json:"type" bson:"type"`
	Tonnage       float64   `json:"tonnage" bson:"tonnage"`
	Captain       string    `json:"captain" bson:"captain"`
	Company       string    `json:"company" bson:"company"`
	FishingGround string    `json:"fishing_ground" bson:"fishing_ground"`
	Status        string    `json:"status" bson:"status"`
	BeidouID      string    `json:"beidou_id" bson:"beidou_id"`
	FuelTankCapacity float64 `json:"fuel_tank_capacity" bson:"fuel_tank_capacity"`
	DailyFuelConsumption float64 `json:"daily_fuel_consumption" bson:"daily_fuel_consumption"`
	AverageSpeed  float64   `json:"average_speed" bson:"average_speed"`
	OperationBasePoint Point `json:"operation_base_point" bson:"operation_base_point"`
	MaxYawDistance float64  `json:"max_yaw_distance" bson:"max_yaw_distance"`
	CreatedAt     time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" bson:"updated_at"`
}

type TrackPoint struct {
	ID        string    `json:"id" bson:"_id"`
	VesselID  string    `json:"vessel_id" bson:"vessel_id"`
	VesselNo  string    `json:"vessel_no" bson:"vessel_no"`
	Location  Point     `json:"location" bson:"location"`
	Speed     float64   `json:"speed" bson:"speed"`
	Heading   float64   `json:"heading" bson:"heading"`
	Timestamp time.Time `json:"timestamp" bson:"timestamp"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
}

type YawAlert struct {
	ID          string    `json:"id" bson:"_id"`
	VesselID    string    `json:"vessel_id" bson:"vessel_id"`
	VesselNo    string    `json:"vessel_no" bson:"vessel_no"`
	Location    Point     `json:"location" bson:"location"`
	BasePoint   Point     `json:"base_point" bson:"base_point"`
	Distance    float64   `json:"distance" bson:"distance"`
	AlertType   string    `json:"alert_type" bson:"alert_type"`
	AlertTime   time.Time `json:"alert_time" bson:"alert_time"`
	Handled     bool      `json:"handled" bson:"handled"`
	HandledBy   string    `json:"handled_by,omitempty" bson:"handled_by,omitempty"`
	HandledAt   time.Time `json:"handled_at,omitempty" bson:"handled_at,omitempty"`
	Remark      string    `json:"remark,omitempty" bson:"remark,omitempty"`
	CreatedAt   time.Time `json:"created_at" bson:"created_at"`
}
