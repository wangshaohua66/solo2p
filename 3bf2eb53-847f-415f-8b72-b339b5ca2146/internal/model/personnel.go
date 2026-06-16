package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PersonnelStatus string

const (
	PersonnelStatusActive   PersonnelStatus = "active"
	PersonnelStatusOnDuty   PersonnelStatus = "on_duty"
	PersonnelStatusOffDuty  PersonnelStatus = "off_duty"
	PersonnelStatusTraining PersonnelStatus = "training"
	PersonnelStatusSuspended PersonnelStatus = "suspended"
)

type CertificateType string

const (
	CertSeafarers   CertificateType = "seafarers"
	CertSafety      CertificateType = "safety_training"
	CertFirstAid    CertificateType = "first_aid"
	CertFirefighting CertificateType = "firefighting"
	CertRescueBoat  CertificateType = "rescue_boat"
	CertSpecialOps  CertificateType = "special_operations"
	CertElectrical  CertificateType = "electrical"
	CertHighAltitude CertificateType = "high_altitude"
)

type Personnel struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	EmployeeNo    string             `bson:"employee_no" json:"employee_no" validate:"required"`
	Name          string             `bson:"name" json:"name" validate:"required"`
	Gender        string             `bson:"gender" json:"gender"`
	BirthDate     time.Time          `bson:"birth_date" json:"birth_date"`
	Phone         string             `bson:"phone" json:"phone" validate:"required"`
	Position      string             `bson:"position" json:"position"`
	Department    string             `bson:"department" json:"department"`
	Status        PersonnelStatus    `bson:"status" json:"status"`
	Certificates  []Certificate      `bson:"certificates" json:"certificates"`
	CurrentVoyageID string           `bson:"current_voyage_id,omitempty" json:"current_voyage_id,omitempty"`
	CurrentLocation string           `bson:"current_location" json:"current_location"`
	EmergencyContact string          `bson:"emergency_contact" json:"emergency_contact"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at" json:"updated_at"`
}

type Certificate struct {
	ID           string          `bson:"id" json:"id"`
	Type         CertificateType `bson:"type" json:"type"`
	CertNo       string          `bson:"cert_no" json:"cert_no"`
	IssueDate    time.Time       `bson:"issue_date" json:"issue_date"`
	ExpiryDate   time.Time       `bson:"expiry_date" json:"expiry_date"`
	IssuingAuthority string       `bson:"issuing_authority" json:"issuing_authority"`
	Status       string          `bson:"status" json:"status"`
}

type EvacuationOrder struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OrderNo        string             `bson:"order_no" json:"order_no"`
	Type           string             `bson:"type" json:"type"`
	Reason         string             `bson:"reason" json:"reason"`
	WindFarmID     string             `bson:"wind_farm_id" json:"wind_farm_id"`
	TriggeredBy    string             `bson:"triggered_by" json:"triggered_by"`
	TriggeredAt    time.Time          `bson:"triggered_at" json:"triggered_at"`
	Status         string             `bson:"status" json:"status"`
	AffectedVoyages []string          `bson:"affected_voyages" json:"affected_voyages"`
	PersonnelList  []EvacuationPerson `bson:"personnel_list" json:"personnel_list"`
	CompletedAt    *time.Time         `bson:"completed_at,omitempty" json:"completed_at,omitempty"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
}

type EvacuationPerson struct {
	PersonnelID    string    `bson:"personnel_id" json:"personnel_id"`
	Name           string    `bson:"name" json:"name"`
	VoyageID       string    `bson:"voyage_id" json:"voyage_id"`
	ShipID         string    `bson:"ship_id" json:"ship_id"`
	Status         string    `bson:"status" json:"status"`
	AcknowledgedAt *time.Time `bson:"acknowledged_at,omitempty" json:"acknowledged_at,omitempty"`
	ArrivedAtPort   *time.Time `bson:"arrived_at_port,omitempty" json:"arrived_at_port,omitempty"`
	Notes          string    `bson:"notes" json:"notes"`
}

type EvacuationCreateRequest struct {
	Type         string   `json:"type" validate:"required"`
	Reason       string   `json:"reason" validate:"required"`
	WindFarmID   string   `json:"wind_farm_id" validate:"required"`
	VoyageIDs    []string `json:"voyage_ids"`
	PersonnelIDs []string `json:"personnel_ids"`
}

type CertificateAlert struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PersonnelID   string             `bson:"personnel_id" json:"personnel_id"`
	PersonnelName string             `bson:"personnel_name" json:"personnel_name"`
	CertificateID string            `bson:"certificate_id" json:"certificate_id"`
	CertType      CertificateType    `bson:"cert_type" json:"cert_type"`
	ExpiryDate    time.Time          `bson:"expiry_date" json:"expiry_date"`
	DaysRemaining int                `bson:"days_remaining" json:"days_remaining"`
	Status        string             `bson:"status" json:"status"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
}

type PersonnelListRequest struct {
	Department string           `json:"department" query:"department"`
	Status     PersonnelStatus  `json:"status" query:"status"`
	CertType   CertificateType  `json:"cert_type" query:"cert_type"`
	ExpiringSoon bool            `json:"expiring_soon" query:"expiring_soon"`
	Page       int              `json:"page" query:"page"`
	PageSize   int              `json:"page_size" query:"page_size"`
}
