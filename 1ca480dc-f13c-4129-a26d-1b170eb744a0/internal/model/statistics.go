package model

import (
	"time"
)

type YardStatistics struct {
	YardID         int64         `json:"yard_id"`
	YardCode       string        `json:"yard_code"`
	YardName       string        `json:"yard_name"`
	Zone           string        `json:"zone"`
	ContainerType  ContainerType `json:"container_type"`
	TotalCapacity  int           `json:"total_capacity"`
	UsedSlots      int           `json:"used_slots"`
	AvailableSlots int           `json:"available_slots"`
	OccupancyRate  float64       `json:"occupancy_rate"`
	ContainerCount int           `json:"container_count"`
	NormalCount    int           `json:"normal_count"`
	ReeferCount    int           `json:"reefer_count"`
	DangerousCount int           `json:"dangerous_count"`
	OversizeCount  int           `json:"oversize_count"`
}

type PortOverview struct {
	TotalYards          int     `json:"total_yards"`
	TotalSlots          int     `json:"total_slots"`
	UsedSlots           int     `json:"used_slots"`
	TotalCapacity       int     `json:"total_capacity"`
	OverallOccupancy    float64 `json:"overall_occupancy_rate"`
	TotalContainers     int     `json:"total_containers"`
	InYardContainers    int     `json:"in_yard_containers"`
	ActiveBerths        int     `json:"active_berths"`
	OccupiedBerths      int     `json:"occupied_berths"`
	ActiveCranes        int     `json:"active_cranes"`
	WorkingCranes       int     `json:"working_cranes"`
	ActiveAlerts        int     `json:"active_alerts"`
	CriticalAlerts      int     `json:"critical_alerts"`
	TodayAppointments   int     `json:"today_appointments"`
	TodayTEU            int     `json:"today_teu"`
}

type DailyThroughput struct {
	Date        time.Time `json:"date"`
	ImportTEU   int       `json:"import_teu"`
	ExportTEU   int       `json:"export_teu"`
	TotalTEU    int       `json:"total_teu"`
	InCount     int       `json:"in_count"`
	OutCount    int       `json:"out_count"`
	VesselCount int       `json:"vessel_count"`
}

type BerthUtilization struct {
	BerthID      int64   `json:"berth_id"`
	BerthCode    string  `json:"berth_code"`
	BerthName    string  `json:"berth_name"`
	TotalHours   float64 `json:"total_hours"`
	UsedHours    float64 `json:"used_hours"`
	IdleHours    float64 `json:"idle_hours"`
	Utilization  float64 `json:"utilization_rate"`
	VesselCount  int     `json:"vessel_count"`
	TotalTEU     int     `json:"total_teu"`
}

type CranePerformance struct {
	CraneID       int64   `json:"crane_id"`
	CraneCode     string  `json:"crane_code"`
	CraneName     string  `json:"crane_name"`
	WorkingHours  float64 `json:"working_hours"`
	IdleHours     float64 `json:"idle_hours"`
	Utilization   float64 `json:"utilization_rate"`
	MovesCount    int     `json:"moves_count"`
	MovesPerHour  float64 `json:"moves_per_hour"`
	TotalTEU      int     `json:"total_teu"`
}

type ContainerTypeStats struct {
	ContainerType ContainerType `json:"container_type"`
	Count         int           `json:"count"`
	Percentage    float64       `json:"percentage"`
}

type TrendDataPoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
	Label string    `json:"label,omitempty"`
}

type HistoryQuery struct {
	StartDate    time.Time `json:"start_date"`
	EndDate      time.Time `json:"end_date"`
	Dimension    string    `json:"dimension"`
	YardID       *int64    `json:"yard_id,omitempty"`
	BerthID      *int64    `json:"berth_id,omitempty"`
	ContainerType *string   `json:"container_type,omitempty"`
}
