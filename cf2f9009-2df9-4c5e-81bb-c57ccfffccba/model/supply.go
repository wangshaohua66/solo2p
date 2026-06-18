package model

import "time"

const (
	FuelRecordTypeRefuel = "refuel"
	FuelRecordTypeConsume = "consume"
	FuelRecordTypeCheck = "check"
)

type FuelRecord struct {
	ID              string    `json:"id" bson:"_id"`
	VesselID        string    `json:"vessel_id" bson:"vessel_id"`
	VesselNo        string    `json:"vessel_no" bson:"vessel_no"`
	RecordType      string    `json:"record_type" bson:"record_type"`
	FuelAmount      float64   `json:"fuel_amount" bson:"fuel_amount"`
	CurrentFuel     float64   `json:"current_fuel" bson:"current_fuel"`
	Location        Point     `json:"location,omitempty" bson:"location,omitempty"`
	SupplyPointID   string    `json:"supply_point_id,omitempty" bson:"supply_point_id,omitempty"`
	SupplyPointName string    `json:"supply_point_name,omitempty" bson:"supply_point_name,omitempty"`
	UnitPrice       float64   `json:"unit_price,omitempty" bson:"unit_price,omitempty"`
	TotalCost       float64   `json:"total_cost,omitempty" bson:"total_cost,omitempty"`
	RecordedAt      time.Time `json:"recorded_at" bson:"recorded_at"`
	RecordedBy      string    `json:"recorded_by" bson:"recorded_by"`
	Remark          string    `json:"remark,omitempty" bson:"remark,omitempty"`
	CreatedAt       time.Time `json:"created_at" bson:"created_at"`
}

type SupplyPoint struct {
	ID       string  `json:"id" bson:"_id"`
	Name     string  `json:"name" bson:"name"`
	Type     string  `json:"type" bson:"type"`
	Location Point   `json:"location" bson:"location"`
	Address  string  `json:"address" bson:"address"`
	Capacity float64 `json:"capacity" bson:"capacity"`
	Phone    string  `json:"phone" bson:"phone"`
	Status   string  `json:"status" bson:"status"`
}

type FuelSupplyPlan struct {
	ID              string    `json:"id" bson:"_id"`
	PlanNo          string    `json:"plan_no" bson:"plan_no"`
	VesselID        string    `json:"vessel_id" bson:"vessel_id"`
	VesselNo        string    `json:"vessel_no" bson:"vessel_no"`
	CurrentFuel     float64   `json:"current_fuel" bson:"current_fuel"`
	DailyConsumption float64  `json:"daily_consumption" bson:"daily_consumption"`
	EnduranceDays   float64   `json:"endurance_days" bson:"endurance_days"`
	SupplyPointID   string    `json:"supply_point_id" bson:"supply_point_id"`
	SupplyPointName string    `json:"supply_point_name" bson:"supply_point_name"`
	Distance        float64   `json:"distance" bson:"distance"`
	SuggestedAmount float64   `json:"suggested_amount" bson:"suggested_amount"`
	EstimatedArrival time.Time `json:"estimated_arrival" bson:"estimated_arrival"`
	Status          string    `json:"status" bson:"status"`
	PlannedBy       string    `json:"planned_by" bson:"planned_by"`
	CreatedAt       time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" bson:"updated_at"`
}

const (
	SupplyPlanStatusPending   = "pending"
	SupplyPlanStatusExecuting = "executing"
	SupplyPlanStatusCompleted = "completed"
	SupplyPlanStatusCancelled = "cancelled"
)

type VesselFuelStatus struct {
	VesselID          string  `json:"vessel_id" bson:"vessel_id"`
	VesselNo          string  `json:"vessel_no" bson:"vessel_no"`
	CurrentFuel       float64 `json:"current_fuel" bson:"current_fuel"`
	DailyConsumption  float64 `json:"daily_consumption" bson:"daily_consumption"`
	EnduranceDays     float64 `json:"endurance_days" bson:"endurance_days"`
	LastRefuelTime    time.Time `json:"last_refuel_time" bson:"last_refuel_time"`
	SafeThresholdDays float64 `json:"safe_threshold_days" bson:"safe_threshold_days"`
	LowFuelAlert      bool    `json:"low_fuel_alert" bson:"low_fuel_alert"`
}
