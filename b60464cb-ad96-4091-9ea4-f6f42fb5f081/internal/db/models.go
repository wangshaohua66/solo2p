package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"terminal-dispatcher/internal/config"
)

type Berth struct {
	ID          int       `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Length      float64   `db:"length" json:"length"`
	QuayCranes  int       `db:"quay_cranes" json:"quay_cranes"`
	Status      string    `db:"status" json:"status"`
	TidalWindow string    `db:"tidal_window" json:"tidal_window"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type Vessel struct {
	ID              int       `db:"id" json:"id"`
	Name            string    `db:"name" json:"name"`
	IMO             string    `db:"imo" json:"imo"`
	Length          float64   `db:"length" json:"length"`
	Capacity        int       `db:"capacity" json:"capacity"`
	CarriedTEU      int       `db:"carried_teu" json:"carried_teu"`
	Status          string    `db:"status" json:"status"`
	ETA             time.Time `db:"eta" json:"eta"`
	ETD             time.Time `db:"etd" json:"etd"`
	BerthID         *int      `db:"berth_id" json:"berth_id"`
	LoadingPlan     string    `db:"loading_plan" json:"loading_plan"`
	UnloadingPlan   string    `db:"unloading_plan" json:"unloading_plan"`
	ProgressPercent float64   `db:"progress_percent" json:"progress_percent"`
	RemainingTEU    int       `db:"remaining_teu" json:"remaining_teu"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

type Container struct {
	ID          int       `db:"id" json:"id"`
	ContainerNo string    `db:"container_no" json:"container_no"`
	SizeType    string    `db:"size_type" json:"size_type"`
	Status      string    `db:"status" json:"status"`
	Location    string    `db:"location" json:"location"`
	Bay         int       `db:"bay" json:"bay"`
	Row         int       `db:"row" json:"row"`
	Tier        int       `db:"tier" json:"tier"`
	Weight      float64   `db:"weight" json:"weight"`
	Destination string    `db:"destination" json:"destination"`
	IsHazardous bool      `db:"is_hazardous" json:"is_hazardous"`
	HazardClass string    `db:"hazard_class" json:"hazard_class"`
	IsReefer    bool      `db:"is_reefer" json:"is_reefer"`
	TempSet     float64   `db:"temp_set" json:"temp_set"`
	HasPower    bool      `db:"has_power" json:"has_power"`
	CustomsRelease bool   `db:"customs_release" json:"customs_release"`
	ReleaseTime *time.Time `db:"release_time" json:"release_time"`
	FreightForwarder string `db:"freight_forwarder" json:"freight_forwarder"`
	NotifySent  bool      `db:"notify_sent" json:"notify_sent"`
	VesselID    *int      `db:"vessel_id" json:"vessel_id"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type Truck struct {
	ID            int       `db:"id" json:"id"`
	PlateNo       string    `db:"plate_no" json:"plate_no"`
	Status        string    `db:"status" json:"status"`
	LocationX     float64   `db:"location_x" json:"location_x"`
	LocationY     float64   `db:"location_y" json:"location_y"`
	CurrentJobID  *int      `db:"current_job_id" json:"current_job_id"`
	LoadStatus    string    `db:"load_status" json:"load_status"`
	ContainerID   *int      `db:"container_id" json:"container_id"`
	DriverName    string    `db:"driver_name" json:"driver_name"`
	DailyTrips    int       `db:"daily_trips" json:"daily_trips"`
	DailyKM       float64   `db:"daily_km" json:"daily_km"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

type BerthApplication struct {
	ID           int       `db:"id" json:"id"`
	VesselName   string    `db:"vessel_name" json:"vessel_name"`
	VesselIMO    string    `db:"vessel_imo" json:"vessel_imo"`
	VesselLength float64   `db:"vessel_length" json:"vessel_length"`
	CarriedTEU   int       `db:"carried_teu" json:"carried_teu"`
	ETA          time.Time `db:"eta" json:"eta"`
	ETD          time.Time `db:"etd" json:"etd"`
	LoadingTEU   int       `db:"loading_teu" json:"loading_teu"`
	UnloadingTEU int       `db:"unloading_teu" json:"unloading_teu"`
	Status       string    `db:"status" json:"status"`
	AssignedBerth *int      `db:"assigned_berth" json:"assigned_berth"`
	AssignedTime *time.Time `db:"assigned_time" json:"assigned_time"`
	ShippingCompany string  `db:"shipping_company" json:"shipping_company"`
	ContactEmail  string    `db:"contact_email" json:"contact_email"`
	ContactPhone  string    `db:"contact_phone" json:"contact_phone"`
	Notes         string    `db:"notes" json:"notes"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

type YardSlot struct {
	ID         int    `db:"id" json:"id"`
	Bay        int    `db:"bay" json:"bay"`
	Row        int    `db:"row" json:"row"`
	Tier       int    `db:"tier" json:"tier"`
	Zone       string `db:"zone" json:"zone"`
	HasPower   bool   `db:"has_power" json:"has_power"`
	Occupied   bool   `db:"occupied" json:"occupied"`
	ContainerID *int   `db:"container_id" json:"container_id"`
}

type Job struct {
	ID              int       `db:"id" json:"id"`
	Type            string    `db:"type" json:"type"`
	Status          string    `db:"status" json:"status"`
	ContainerID     int       `db:"container_id" json:"container_id"`
	TruckID         *int      `db:"truck_id" json:"truck_id"`
	PickupLocation  string    `db:"pickup_location" json:"pickup_location"`
	DropoffLocation string    `db:"dropoff_location" json:"dropoff_location"`
	PickupBay       int       `db:"pickup_bay" json:"pickup_bay"`
	DropoffBay      int       `db:"dropoff_bay" json:"dropoff_bay"`
	EstimatedTime   float64   `db:"estimated_time" json:"estimated_time"`
	Distance        float64   `db:"distance" json:"distance"`
	StartTime       *time.Time `db:"start_time" json:"start_time"`
	EndTime         *time.Time `db:"end_time" json:"end_time"`
	Priority        int       `db:"priority" json:"priority"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

type RestackWarning struct {
	ContainerID    int    `json:"container_id"`
	ContainerNo    string `json:"container_no"`
	BlockedByCount int    `json:"blocked_by_count"`
	Blockers       []string `json:"blockers"`
	MinRestacks    int    `json:"min_restacks"`
}

var Pool *pgxpool.Pool

func InitDB(cfg *config.DatabaseConfig) error {
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName, cfg.SSLMode)

	poolCfg, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return fmt.Errorf("parse config: %w", err)
	}

	poolCfg.MaxConns = int32(cfg.MaxOpenConns)
	poolCfg.MinConns = int32(cfg.MaxIdleConns)

	pool, err := pgxpool.NewWithConfig(context.Background(), poolCfg)
	if err != nil {
		return fmt.Errorf("connect pool: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}

	Pool = pool
	return nil
}

func Close() {
	if Pool != nil {
		Pool.Close()
	}
}
