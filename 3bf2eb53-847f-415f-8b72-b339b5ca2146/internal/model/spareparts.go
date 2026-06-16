package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type SparePart struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PartNo         string             `bson:"part_no" json:"part_no" validate:"required"`
	Name           string             `bson:"name" json:"name" validate:"required"`
	Category       string             `bson:"category" json:"category"`
	Specification  string             `bson:"specification" json:"specification"`
	Unit           string             `bson:"unit" json:"unit"`
	UnitPrice      float64            `bson:"unit_price" json:"unit_price"`
	Supplier       string             `bson:"supplier" json:"supplier"`
	LeadTimeDays   int                `bson:"lead_time_days" json:"lead_time_days"`
	SafetyStock    int                `bson:"safety_stock" json:"safety_stock"`
	MinOrderQty    int                `bson:"min_order_qty" json:"min_order_qty"`
	ApplicableModels []TurbineModel   `bson:"applicable_models" json:"applicable_models"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
}

type SparePartInventory struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PartID         string             `bson:"part_id" json:"part_id"`
	PartNo         string             `bson:"part_no" json:"part_no"`
	PartName       string             `bson:"part_name" json:"part_name"`
	WarehouseID    string             `bson:"warehouse_id" json:"warehouse_id"`
	WarehouseName  string             `bson:"warehouse_name" json:"warehouse_name"`
	WindFarmID     string             `bson:"wind_farm_id" json:"wind_farm_id"`
	Quantity       int                `bson:"quantity" json:"quantity"`
	LockedQuantity int                `bson:"locked_quantity" json:"locked_quantity"`
	AvailableQty   int                `bson:"available_qty" json:"available_qty"`
	LastStockTake  time.Time          `bson:"last_stock_take" json:"last_stock_take"`
	Status         string             `bson:"status" json:"status"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
}

type Warehouse struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name       string             `bson:"name" json:"name" validate:"required"`
	Code       string             `bson:"code" json:"code" validate:"required"`
	Location   string             `bson:"location" json:"location"`
	WindFarmID string             `bson:"wind_farm_id" json:"wind_farm_id"`
	Type       string             `bson:"type" json:"type"`
	Manager    string             `bson:"manager" json:"manager"`
	Status     string             `bson:"status" json:"status"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}

type TransferOrder struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TransferNo     string             `bson:"transfer_no" json:"transfer_no"`
	Type           string             `bson:"type" json:"type"`
	Status         string             `bson:"status" json:"status"`
	SourceWarehouseID string          `bson:"source_warehouse_id" json:"source_warehouse_id"`
	TargetWarehouseID string          `bson:"target_warehouse_id" json:"target_warehouse_id"`
	SourceWindFarmID string          `bson:"source_wind_farm_id" json:"source_wind_farm_id"`
	TargetWindFarmID string          `bson:"target_wind_farm_id" json:"target_wind_farm_id"`
	Items          []TransferItem     `bson:"items" json:"items"`
	Reason         string             `bson:"reason" json:"reason"`
	ApplicantID    string             `bson:"applicant_id" json:"applicant_id"`
	ApproverID     string             `bson:"approver_id,omitempty" json:"approver_id,omitempty"`
	ApprovedAt     *time.Time         `bson:"approved_at,omitempty" json:"approved_at,omitempty"`
	DispatchedAt   *time.Time         `bson:"dispatched_at,omitempty" json:"dispatched_at,omitempty"`
	ReceivedAt     *time.Time         `bson:"received_at,omitempty" json:"received_at,omitempty"`
	WorkOrderID    string             `bson:"work_order_id,omitempty" json:"work_order_id,omitempty"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
}

type TransferItem struct {
	PartID   string `bson:"part_id" json:"part_id"`
	PartNo   string `bson:"part_no" json:"part_no"`
	PartName string `bson:"part_name" json:"part_name"`
	Quantity int    `bson:"quantity" json:"quantity"`
}

type RestockOrder struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RestockNo   string             `bson:"restock_no" json:"restock_no"`
	Status      string             `bson:"status" json:"status"`
	WarehouseID string             `bson:"warehouse_id" json:"warehouse_id"`
	WindFarmID  string             `bson:"wind_farm_id" json:"wind_farm_id"`
	Items       []RestockItem      `bson:"items" json:"items"`
	ApplicantID string             `bson:"applicant_id" json:"applicant_id"`
	ApproverID  string             `bson:"approver_id,omitempty" json:"approver_id,omitempty"`
	TotalAmount float64            `bson:"total_amount" json:"total_amount"`
	Supplier    string             `bson:"supplier" json:"supplier"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type RestockItem struct {
	PartID   string  `bson:"part_id" json:"part_id"`
	PartNo   string  `bson:"part_no" json:"part_no"`
	PartName string  `bson:"part_name" json:"part_name"`
	Quantity int     `bson:"quantity" json:"quantity"`
	UnitPrice float64 `bson:"unit_price" json:"unit_price"`
}

type InventoryAlert struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Type          string             `bson:"type" json:"type"`
	PartID        string             `bson:"part_id" json:"part_id"`
	PartName      string             `bson:"part_name" json:"part_name"`
	WarehouseID   string             `bson:"warehouse_id" json:"warehouse_id"`
	WindFarmID    string             `bson:"wind_farm_id" json:"wind_farm_id"`
	CurrentQty    int                `bson:"current_qty" json:"current_qty"`
	SafetyStock   int                `bson:"safety_stock" json:"safety_stock"`
	Status        string             `bson:"status" json:"status"`
	CreatedAt     time.Time          `bson:"created_at" json:"created_at"`
}

type TransferCreateRequest struct {
	Type               string         `json:"type" validate:"required"`
	SourceWarehouseID  string         `json:"source_warehouse_id" validate:"required"`
	TargetWarehouseID  string         `json:"target_warehouse_id" validate:"required"`
	Items              []TransferItem `json:"items" validate:"required,min=1"`
	Reason             string         `json:"reason"`
	WorkOrderID        string         `json:"work_order_id"`
}
