package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AlertType string

const (
	AlertTypeHealth      AlertType = "health"
	AlertTypeWeather     AlertType = "weather"
	AlertTypeCertificate AlertType = "certificate"
	AlertTypeInventory   AlertType = "inventory"
	AlertTypeSafety      AlertType = "safety"
)

type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityCritical AlertSeverity = "critical"
)

type AlertStatus string

const (
	AlertStatusNew       AlertStatus = "new"
	AlertStatusAcknowledged AlertStatus = "acknowledged"
	AlertStatusProcessing  AlertStatus = "processing"
	AlertStatusResolved    AlertStatus = "resolved"
)

type Alert struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	AlertNo      string             `bson:"alert_no" json:"alert_no"`
	Type         AlertType          `bson:"type" json:"type"`
	Severity     AlertSeverity      `bson:"severity" json:"severity"`
	Status       AlertStatus        `bson:"status" json:"status"`
	Title        string             `bson:"title" json:"title"`
	Description  string             `bson:"description" json:"description"`
	WindFarmID   string             `bson:"wind_farm_id" json:"wind_farm_id"`
	TurbineID    string             `bson:"turbine_id,omitempty" json:"turbine_id,omitempty"`
	PersonnelID  string             `bson:"personnel_id,omitempty" json:"personnel_id,omitempty"`
	PartID       string             `bson:"part_id,omitempty" json:"part_id,omitempty"`
	AssignedTo   string             `bson:"assigned_to,omitempty" json:"assigned_to,omitempty"`
	Source       string             `bson:"source" json:"source"`
	Metadata     map[string]string  `bson:"metadata,omitempty" json:"metadata,omitempty"`
	AcknowledgedBy string           `bson:"acknowledged_by,omitempty" json:"acknowledged_by,omitempty"`
	AcknowledgedAt *time.Time       `bson:"acknowledged_at,omitempty" json:"acknowledged_at,omitempty"`
	ResolvedBy   string             `bson:"resolved_by,omitempty" json:"resolved_by,omitempty"`
	ResolvedAt   *time.Time         `bson:"resolved_at,omitempty" json:"resolved_at,omitempty"`
	Resolution   string             `bson:"resolution,omitempty" json:"resolution,omitempty"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

type AlertListRequest struct {
	Type       AlertType     `json:"type" query:"type"`
	Severity   AlertSeverity `json:"severity" query:"severity"`
	Status     AlertStatus   `json:"status" query:"status"`
	WindFarmID string        `json:"wind_farm_id" query:"wind_farm_id"`
	StartTime  *time.Time    `json:"start_time" query:"start_time"`
	EndTime    *time.Time    `json:"end_time" query:"end_time"`
	Page       int           `json:"page" query:"page"`
	PageSize   int           `json:"page_size" query:"page_size"`
}

type ReportRequest struct {
	WindFarmID   string     `json:"wind_farm_id" query:"wind_farm_id"`
	TurbineModel string     `json:"turbine_model" query:"turbine_model"`
	FaultType    string     `json:"fault_type" query:"fault_type"`
	StartTime    *time.Time `json:"start_time" query:"start_time"`
	EndTime      *time.Time `json:"end_time" query:"end_time"`
	GroupBy      string     `json:"group_by" query:"group_by"`
}

type MTBFReport struct {
	WindFarmID   string  `bson:"wind_farm_id" json:"wind_farm_id"`
	WindFarmName string  `bson:"wind_farm_name" json:"wind_farm_name"`
	TurbineModel string  `bson:"turbine_model" json:"turbine_model"`
	FaultType    string  `bson:"fault_type" json:"fault_type"`
	TotalFaults  int     `bson:"total_faults" json:"total_faults"`
	TotalRuntime float64 `bson:"total_runtime_hours" json:"total_runtime_hours"`
	MTBF         float64 `bson:"mtbf_hours" json:"mtbf_hours"`
}

type MTTRReport struct {
	WindFarmID   string  `bson:"wind_farm_id" json:"wind_farm_id"`
	WindFarmName string  `bson:"wind_farm_name" json:"wind_farm_name"`
	TurbineModel string  `bson:"turbine_model" json:"turbine_model"`
	FaultType    string  `bson:"fault_type" json:"fault_type"`
	TotalRepairs int     `bson:"total_repairs" json:"total_repairs"`
	TotalRepairTime float64 `bson:"total_repair_time_hours" json:"total_repair_time_hours"`
	MTTR         float64 `bson:"mttr_hours" json:"mttr_hours"`
}

type TrendDataPoint struct {
	Timestamp time.Time `bson:"timestamp" json:"timestamp"`
	Value     float64   `bson:"value" json:"value"`
	Label     string    `bson:"label,omitempty" json:"label,omitempty"`
}

type HealthOverview struct {
	WindFarmID       string  `bson:"wind_farm_id" json:"wind_farm_id"`
	WindFarmName     string  `bson:"wind_farm_name" json:"wind_farm_name"`
	TotalTurbines    int     `bson:"total_turbines" json:"total_turbines"`
	NormalCount      int     `bson:"normal_count" json:"normal_count"`
	WarningCount     int     `bson:"warning_count" json:"warning_count"`
	FaultCount       int     `bson:"fault_count" json:"fault_count"`
	OfflineCount     int     `bson:"offline_count" json:"offline_count"`
	AvgHealthScore   float64 `bson:"avg_health_score" json:"avg_health_score"`
}

type DashboardSummary struct {
	TotalWindFarms      int              `json:"total_wind_farms"`
	TotalTurbines       int              `json:"total_turbines"`
	ActiveVoyages       int              `json:"active_voyages"`
	OpenWorkOrders      int              `json:"open_work_orders"`
	CriticalAlerts      int              `json:"critical_alerts"`
	HealthOverviews     []HealthOverview `json:"health_overviews"`
	WeatherAlerts       int              `json:"weather_alerts"`
	PersonnelAtSea      int              `json:"personnel_at_sea"`
}
