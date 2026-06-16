package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WindFarm struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name" validate:"required"`
	Code        string             `bson:"code" json:"code" validate:"required"`
	Location    string             `bson:"location" json:"location"`
	Coordinates []float64          `bson:"coordinates" json:"coordinates"`
	TotalTurbines int              `bson:"total_turbines" json:"total_turbines"`
	Capacity    float64            `bson:"capacity" json:"capacity"`
	Status      string             `bson:"status" json:"status"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type TurbineModel string

const (
	ModelSG8000  TurbineModel = "SG8.0-167"
	ModelMySE11  TurbineModel = "MySE11-230"
	ModelV164    TurbineModel = "V164-9.5"
)

type TurbineStatus string

const (
	TurbineStatusNormal   TurbineStatus = "normal"
	TurbineStatusWarning  TurbineStatus = "warning"
	TurbineStatusFault    TurbineStatus = "fault"
	TurbineStatusOffline  TurbineStatus = "offline"
	TurbineStatusMaintain TurbineStatus = "maintenance"
)

type Turbine struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TurbineNo       string             `bson:"turbine_no" json:"turbine_no" validate:"required"`
	WindFarmID      string             `bson:"wind_farm_id" json:"wind_farm_id" validate:"required"`
	Model           TurbineModel       `bson:"model" json:"model" validate:"required"`
	Capacity        float64            `bson:"capacity" json:"capacity"`
	Coordinates     []float64          `bson:"coordinates" json:"coordinates"`
	CommissionDate  time.Time          `bson:"commission_date" json:"commission_date"`
	Status          TurbineStatus      `bson:"status" json:"status"`
	HealthScore     float64            `bson:"health_score" json:"health_score"`
	LastHealthCheck time.Time          `bson:"last_health_check" json:"last_health_check"`
	InstalledHeight float64            `bson:"installed_height" json:"installed_height"`
	RotorDiameter   float64            `bson:"rotor_diameter" json:"rotor_diameter"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updated_at"`
}

type SCADAData struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TurbineID   string             `bson:"turbine_id" json:"turbine_id"`
	Timestamp   time.Time          `bson:"timestamp" json:"timestamp"`
	VibrationX  float64            `bson:"vibration_x" json:"vibration_x"`
	VibrationY  float64            `bson:"vibration_y" json:"vibration_y"`
	VibrationZ  float64            `bson:"vibration_z" json:"vibration_z"`
	TempGearbox float64            `bson:"temp_gearbox" json:"temp_gearbox"`
	TempGenerator float64          `bson:"temp_generator" json:"temp_generator"`
	TempBearing float64            `bson:"temp_bearing" json:"temp_bearing"`
	RotSpeed    float64            `bson:"rot_speed" json:"rot_speed"`
	PowerOutput float64            `bson:"power_output" json:"power_output"`
	WindSpeed   float64            `bson:"wind_speed" json:"wind_speed"`
	PitchAngle  float64            `bson:"pitch_angle" json:"pitch_angle"`
	YawAngle    float64            `bson:"yaw_angle" json:"yaw_angle"`
	HydPressure float64            `bson:"hyd_pressure" json:"hyd_pressure"`
}

type HealthScoreConfig struct {
	ID            primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	TurbineModel  TurbineModel         `bson:"turbine_model" json:"turbine_model" validate:"required"`
	Weights       map[string]float64   `bson:"weights" json:"weights" validate:"required"`
	Thresholds    map[string]ThresholdRange `bson:"thresholds" json:"thresholds"`
	WarningScore  float64              `bson:"warning_score" json:"warning_score"`
	FaultScore    float64              `bson:"fault_score" json:"fault_score"`
	ConsecutivePeriods int              `bson:"consecutive_periods" json:"consecutive_periods"`
	UpdatedBy     string               `bson:"updated_by" json:"updated_by"`
	CreatedAt     time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time            `bson:"updated_at" json:"updated_at"`
}

type ThresholdRange struct {
	MinNormal float64 `bson:"min_normal" json:"min_normal"`
	MaxNormal float64 `bson:"max_normal" json:"max_normal"`
	MinWarning float64 `bson:"min_warning" json:"min_warning"`
	MaxWarning float64 `bson:"max_warning" json:"max_warning"`
}

type HealthRecord struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TurbineID      string             `bson:"turbine_id" json:"turbine_id"`
	Timestamp      time.Time          `bson:"timestamp" json:"timestamp"`
	OverallScore   float64            `bson:"overall_score" json:"overall_score"`
	IndicatorScores map[string]float64 `bson:"indicator_scores" json:"indicator_scores"`
	Status         TurbineStatus      `bson:"status" json:"status"`
	Alerts         []string           `bson:"alerts" json:"alerts"`
}
