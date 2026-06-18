package model

import "time"

type CatchRecord struct {
	ID           string    `json:"id" bson:"_id"`
	VesselID     string    `json:"vessel_id" bson:"vessel_id"`
	VesselNo     string    `json:"vessel_no" bson:"vessel_no"`
	SpeciesCode  string    `json:"species_code" bson:"species_code"`
	SpeciesName  string    `json:"species_name" bson:"species_name"`
	Weight       float64   `json:"weight" bson:"weight"`
	LengthMin    float64   `json:"length_min" bson:"length_min"`
	LengthMax    float64   `json:"length_max" bson:"length_max"`
	Location     Point     `json:"location" bson:"location"`
	WaterTemp    float64   `json:"water_temp" bson:"water_temp"`
	FishingGround string   `json:"fishing_ground" bson:"fishing_ground"`
	CatchTime    time.Time `json:"catch_time" bson:"catch_time"`
	ReportedBy   string    `json:"reported_by" bson:"reported_by"`
	CreatedAt    time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" bson:"updated_at"`
}

type AnnualQuota struct {
	ID             string    `json:"id" bson:"_id"`
	Year           int       `json:"year" bson:"year"`
	FishingGround  string    `json:"fishing_ground" bson:"fishing_ground"`
	SpeciesCode    string    `json:"species_code" bson:"species_code"`
	SpeciesName    string    `json:"species_name" bson:"species_name"`
	TotalQuota     float64   `json:"total_quota" bson:"total_quota"`
	UsedQuota      float64   `json:"used_quota" bson:"used_quota"`
	RemainingQuota float64   `json:"remaining_quota" bson:"remaining_quota"`
	WarningThreshold float64 `json:"warning_threshold" bson:"warning_threshold"`
	Locked         bool      `json:"locked" bson:"locked"`
	CreatedAt      time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" bson:"updated_at"`
}

type VesselQuota struct {
	ID             string    `json:"id" bson:"_id"`
	Year           int       `json:"year" bson:"year"`
	VesselID       string    `json:"vessel_id" bson:"vessel_id"`
	VesselNo       string    `json:"vessel_no" bson:"vessel_no"`
	SpeciesCode    string    `json:"species_code" bson:"species_code"`
	SpeciesName    string    `json:"species_name" bson:"species_name"`
	FishingGround  string    `json:"fishing_ground" bson:"fishing_ground"`
	TotalQuota     float64   `json:"total_quota" bson:"total_quota"`
	UsedQuota      float64   `json:"used_quota" bson:"used_quota"`
	RemainingQuota float64   `json:"remaining_quota" bson:"remaining_quota"`
	WarningThreshold float64 `json:"warning_threshold" bson:"warning_threshold"`
	Locked         bool      `json:"locked" bson:"locked"`
	CreatedAt      time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" bson:"updated_at"`
}

type QuotaTransfer struct {
	ID              string    `json:"id" bson:"_id"`
	Year            int       `json:"year" bson:"year"`
	SpeciesCode     string    `json:"species_code" bson:"species_code"`
	FromVesselID    string    `json:"from_vessel_id" bson:"from_vessel_id"`
	FromVesselNo    string    `json:"from_vessel_no" bson:"from_vessel_no"`
	ToVesselID      string    `json:"to_vessel_id" bson:"to_vessel_id"`
	ToVesselNo      string    `json:"to_vessel_no" bson:"to_vessel_no"`
	Amount          float64   `json:"amount" bson:"amount"`
	Status          string    `json:"status" bson:"status"`
	ApplyReason     string    `json:"apply_reason" bson:"apply_reason"`
	ApprovalRemark  string    `json:"approval_remark,omitempty" bson:"approval_remark,omitempty"`
	ApprovedBy      string    `json:"approved_by,omitempty" bson:"approved_by,omitempty"`
	ApprovedAt      time.Time `json:"approved_at,omitempty" bson:"approved_at,omitempty"`
	CreatedAt       time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" bson:"updated_at"`
}

const (
	QuotaTransferStatusPending  = "pending"
	QuotaTransferStatusApproved = "approved"
	QuotaTransferStatusRejected = "rejected"
)
