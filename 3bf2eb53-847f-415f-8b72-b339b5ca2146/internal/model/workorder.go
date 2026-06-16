package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WorkOrderType string

const (
	WOTypeInspection   WorkOrderType = "inspection"
	WOTypeMaintenance  WorkOrderType = "maintenance"
	WOTypeRepair       WorkOrderType = "repair"
	WOTypeEmergency    WorkOrderType = "emergency"
)

type WorkOrderStatus string

const (
	WOStatusCreated    WorkOrderStatus = "created"
	WOStatusAssigned   WorkOrderStatus = "assigned"
	WOStatusInProgress WorkOrderStatus = "in_progress"
	WOStatusPending    WorkOrderStatus = "pending_parts"
	WOStatusCompleted  WorkOrderStatus = "completed"
	WOStatusClosed     WorkOrderStatus = "closed"
)

type WorkOrder struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OrderNo         string             `bson:"order_no" json:"order_no"`
	Type            WorkOrderType      `bson:"type" json:"type" validate:"required"`
	Title           string             `bson:"title" json:"title" validate:"required"`
	Description     string             `bson:"description" json:"description"`
	TurbineID       string             `bson:"turbine_id" json:"turbine_id" validate:"required"`
	WindFarmID      string             `bson:"wind_farm_id" json:"wind_farm_id"`
	Priority        string             `bson:"priority" json:"priority"`
	Status          WorkOrderStatus    `bson:"status" json:"status"`
	CreatedBy       string             `bson:"created_by" json:"created_by"`
	AssignedTo      string             `bson:"assigned_to" json:"assigned_to"`
	Source          string             `bson:"source" json:"source"`
	HealthTrigger   string             `bson:"health_trigger,omitempty" json:"health_trigger,omitempty"`
	EstimatedHours  float64            `bson:"estimated_hours" json:"estimated_hours"`
	ActualHours     float64            `bson:"actual_hours" json:"actual_hours"`
	SpareParts      []SparePartUsage   `bson:"spare_parts" json:"spare_parts"`
	Attachments     []string           `bson:"attachments" json:"attachments"`
	DueDate         time.Time          `bson:"due_date" json:"due_date"`
	StartTime       *time.Time         `bson:"start_time,omitempty" json:"start_time,omitempty"`
	CompletedTime   *time.Time         `bson:"completed_time,omitempty" json:"completed_time,omitempty"`
	ClosedTime      *time.Time         `bson:"closed_time,omitempty" json:"closed_time,omitempty"`
	InspectionReport *InspectionReport `bson:"inspection_report,omitempty" json:"inspection_report,omitempty"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updated_at"`
}

type SparePartUsage struct {
	PartID   string  `bson:"part_id" json:"part_id"`
	PartName string  `bson:"part_name" json:"part_name"`
	Quantity int     `bson:"quantity" json:"quantity"`
	UnitPrice float64 `bson:"unit_price" json:"unit_price"`
}

type InspectionReport struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	WorkOrderID   string             `bson:"work_order_id" json:"work_order_id"`
	ReporterID    string             `bson:"reporter_id" json:"reporter_id"`
	ReportTime    time.Time          `bson:"report_time" json:"report_time"`
	FaultPhenomenon string           `bson:"fault_phenomenon" json:"fault_phenomenon"`
	CauseAnalysis string             `bson:"cause_analysis" json:"cause_analysis"`
	Solution      string             `bson:"solution" json:"solution"`
	Recommendations string           `bson:"recommendations" json:"recommendations"`
	Images        []string           `bson:"images" json:"images"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
}

type WorkOrderCreateRequest struct {
	Type           WorkOrderType `json:"type" validate:"required"`
	Title          string        `json:"title" validate:"required"`
	Description    string        `json:"description"`
	TurbineID      string        `json:"turbine_id" validate:"required"`
	Priority       string        `json:"priority"`
	AssignedTo     string        `json:"assigned_to"`
	EstimatedHours float64       `json:"estimated_hours"`
	DueDate        time.Time     `json:"due_date"`
	SpareParts     []SparePartUsage `json:"spare_parts"`
}

type WorkOrderListRequest struct {
	WindFarmID string          `json:"wind_farm_id" query:"wind_farm_id"`
	Status     WorkOrderStatus `json:"status" query:"status"`
	Type       WorkOrderType   `json:"type" query:"type"`
	Priority   string          `json:"priority" query:"priority"`
	Page       int             `json:"page" query:"page"`
	PageSize   int             `json:"page_size" query:"page_size"`
}
