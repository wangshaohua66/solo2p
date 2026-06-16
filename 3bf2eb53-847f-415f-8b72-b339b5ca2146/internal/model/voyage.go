package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ShipStatus string

const (
	ShipStatusAvailable   ShipStatus = "available"
	ShipStatusSailing  ShipStatus = "sailing"
	ShipStatusMaintenance ShipStatus = "maintenance"
	ShipStatusReturning ShipStatus = "returning"
)

type Ship struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ShipNo            string          `bson:"ship_no" json:"ship_no" validate:"required"`
	ShipName          string          `bson:"ship_name" json:"ship_name" validate:"ship_name"`
	Type              string          `bson:"type" json:"type"`
	Capacity          int             `bson:"capacity" json:"capacity"`
	MaxWindSpeed      float64         `bson:"max_wind_speed" json:"max_wind_speed"`
	MaxWaveHeight      float64        `bson:"max_wave_height" json:"max_wave_height"`
	HomePort           string          `bson:"home_port" json:"home_port"`
	Status             ShipStatus     `bson:"status" json:"status"`
	Captain            string          `bson:"captain" json:"captain"`
	CrewCount           int             `bson:"crew_count" json:"crew_count"`
	LastMaintenanceDate time.Time     `bson:"last_maintenance_date" json:"last_maintenance_date"`
	NextMaintenanceDate time.Time     `bson:"next_maintenance_date" json:"next_maintenance_date"`
	CreatedAt          time.Time       `bson:"created_at" json:"created_at"`
	UpdatedAt          time.Time     `bson:"updated_at" json:"updated_at"`
}

type VoyageStatus string

const (
	VoyageStatusDraft     VoyageStatus = "draft"
	VoyageStatusApproved VoyageStatus = "approved"
	VoyageStatusSailing  VoyageStatus = "sailing"
	VoyageStatusCompleted VoyageStatus = "completed"
	VoyageStatusCancelled VoyageStatus = "cancelled"
)

type Voyage struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	VoyageNo        string           `bson:"voyage_no" json:"voyage_no"`
	ShipID          string           `bson:"ship_id" json:"ship_id" validate:"required"`
	WindFarmID      string           `bson:"wind_farm_id" json:"wind_farm_id"`
	Title           string           `bson:"title" json:"title"`
	Type            string           `bson:"type" json:"type"`
	Status          VoyageStatus     `bson:"status" json:"status"`
	DeparturePort   string           `bson:"departure_port" json:"departure_port"`
	DepartureTime   time.Time        `bson:"departure_time" json:"departure_time"`
	ReturnTime       time.Time        `bson:"return_time" json:"return_time"`
	EstimatedReturn time.Time        `bson:"estimated_return" json:"estimated_return"`
	TurbineList     []string         `bson:"turbine_list" json:"turbine_list"`
	WorkOrderIDs    []string         `bson:"work_order_ids" json:"work_order_ids"`
	CrewList        []string         `bson:"crew_list" json:"crew_list"`
	Passengers      []string         `bson:"passengers" json:"passengers"`
	WeatherFeasible   bool             `bson:"weather_feasible" json:"weather_feasible"`
	WeatherWindowID string           `bson:"weather_window_id,omitempty" json:"weather_window_id,omitempty"`
	DispatcherID        string           `bson:"dispatcher_id" json:"dispatcher_id"`
	SafetyOfficerID string           `bson:"safety_officer_id,omitempty" json:"safety_officer_id,omitempty"`
	ActualDeparture *time.Time       `bson:"actual_departure,omitempty" json:"actual_departure,omitempty"`
	ActualReturn    *time.Time       `bson:"actual_return,omitempty" json:"actual_return,omitempty"`
	Notes           string           `bson:"notes" json:"notes"`
	CreatedAt       time.Time        `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time        `bson:"updated_at" json:"updated_at"`
}

type VoyageCreateRequest struct {
	ShipID        string    `json:"ship_id" validate:"required"`
	WindFarmID    string    `json:"wind_farm_id"`
	Title         string    `json:"title" validate:"required"`
	Type          string    `json:"type"`
	DepartureTime time.Time `json:"departure_time" validate:"required"`
	ReturnTime    time.Time `json:"return_time" validate:"required"`
	TurbineList   []string  `json:"turbine_list"`
	WorkOrderIDs  []string  `json:"work_order_ids"`
	Passengers    []string  `json:"passengers"`
	Notes         string    `json:"notes"`
}

type VoyageConflict struct {
	Type        string    `json:"type"`
	Description string    `json:"description"`
	SuggestedStart time.Time `json:"suggested_start"`
	SuggestedEnd   time.Time `json:"suggested_end"`
}

type WeatherWindow struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	WindFarmID  string           `bson:"wind_farm_id" json:"wind_farm_id"`
	StartTime   time.Time        `bson:"start_time" json:"start_time"`
	EndTime     time.Time        `bson:"end_time" json:"end_time"`
	MaxWindSpeed float64          `bson:"max_wind_speed" json:"max_wind_speed"`
	MaxWaveHeight float64         `bson:"max_wave_height" json:"max_wave_height"`
	MinVisibility float64            `bson:"min_visibility" json:"min_visibility"`
	ShipGrade  string             `bson:"ship_grade" json:"ship_grade"`
	Feasible    bool              `bson:"feasible" json:"feasible"`
	CalculatedAt time.Time         `bson:"calculated_at" json:"calculated_at"`
}

type WeatherForecast struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	WindFarmID  string           `bson:"wind_farm_id" json:"wind_farm_id"`
	Timestamp   time.Time        `bson:"timestamp" json:"timestamp"`
	WindSpeed   float64          `bson:"wind_speed" json:"wind_speed"`
	WindDirection float64        `bson:"wind_direction" json:"wind_direction"`
	WaveHeight  float64          `bson:"wave_height" json:"wave_height"`
	Visibility  float64          `bson:"visibility" json:"visibility"`
	Temperature float64          `bson:"temperature" json:"temperature"`
	WeatherCondition string        `bson:"weather_condition" json:"weather_condition"`
	Source      string           `bson:"source" json:"source"`
}

type WeatherWindowCalcRequest struct {
	WindFarmID   string    `json:"wind_farm_id" validate:"required"`
	StartTime      time.Time `json:"start_time"`
	EndTime        time.Time `json:"end_time"`
	MaxWindSpeed    float64   `json:"max_wind_speed"`
	MaxWaveHeight  float64   `json:"max_wave_height"`
	MinVisibility  float64   `json:"min_visibility"`
	ShipGrade      string    `json:"ship_grade"`
}
