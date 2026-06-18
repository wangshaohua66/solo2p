package model

import "time"

type ForbiddenZone struct {
	ID          string    `json:"id" bson:"_id"`
	Name        string    `json:"name" bson:"name"`
	ZoneType    string    `json:"zone_type" bson:"zone_type"`
	Description string    `json:"description" bson:"description"`
	Boundary    Polygon   `json:"boundary" bson:"boundary"`
	StartDate   string    `json:"start_date" bson:"start_date"`
	EndDate     string    `json:"end_date" bson:"end_date"`
	YearRound   bool      `json:"year_round" bson:"year_round"`
	Species     []string  `json:"species" bson:"species"`
	Status      string    `json:"status" bson:"status"`
	CreatedAt   time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" bson:"updated_at"`
}

const (
	ZoneStatusActive   = "active"
	ZoneStatusInactive = "inactive"
)

type ForbiddenViolation struct {
	ID         string    `json:"id" bson:"_id"`
	VesselID   string    `json:"vessel_id" bson:"vessel_id"`
	VesselNo   string    `json:"vessel_no" bson:"vessel_no"`
	ZoneID     string    `json:"zone_id" bson:"zone_id"`
	ZoneName   string    `json:"zone_name" bson:"zone_name"`
	EnterPoint Point     `json:"enter_point" bson:"enter_point"`
	EnterTime  time.Time `json:"enter_time" bson:"enter_time"`
	ExitPoint  Point     `json:"exit_point,omitempty" bson:"exit_point,omitempty"`
	ExitTime   time.Time `json:"exit_time,omitempty" bson:"exit_time,omitempty"`
	Duration   float64   `json:"duration" bson:"duration"`
	HasCatch   bool      `json:"has_catch" bson:"has_catch"`
	Status     string    `json:"status" bson:"status"`
	Handled    bool      `json:"handled" bson:"handled"`
	HandledBy  string    `json:"handled_by,omitempty" bson:"handled_by,omitempty"`
	HandledAt  time.Time `json:"handled_at,omitempty" bson:"handled_at,omitempty"`
	FineAmount float64   `json:"fine_amount,omitempty" bson:"fine_amount,omitempty"`
	Remark     string    `json:"remark,omitempty" bson:"remark,omitempty"`
	CreatedAt  time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" bson:"updated_at"`
}

const (
	ViolationStatusActive  = "active"
	ViolationStatusExited  = "exited"
	ViolationStatusHandled = "handled"
)
