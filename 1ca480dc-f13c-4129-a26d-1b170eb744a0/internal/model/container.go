package model

import (
	"time"
)

type Container struct {
	ID            int64           `json:"id" gorm:"primaryKey;autoIncrement"`
	ContainerNo   string          `json:"container_no" gorm:"type:varchar(20);uniqueIndex;not null"`
	ContainerType ContainerType   `json:"container_type" gorm:"type:varchar(20);not null;index"`
	Size          ContainerSize   `json:"size" gorm:"type:varchar(10);not null"`
	Weight        float64         `json:"weight" gorm:"type:decimal(10,2)"`
	WeightLevel   WeightLevel     `json:"weight_level" gorm:"type:varchar(20)"`
	Status        ContainerStatus `json:"status" gorm:"type:varchar(20);index"`
	ShippingLine  string          `json:"shipping_line" gorm:"type:varchar(100);index"`
	Destination   string          `json:"destination" gorm:"type:varchar(100);index"`
	VesselName    string          `json:"vessel_name" gorm:"type:varchar(100)"`
	VoyageNo      string          `json:"voyage_no" gorm:"type:varchar(50)"`
	BillOfLading  string          `json:"bill_of_lading" gorm:"type:varchar(50)"`
	Consignee     string          `json:"consignee" gorm:"type:varchar(200)"`
	Shipper       string          `json:"shipper" gorm:"type:varchar(200)"`

	YardID        int64           `json:"yard_id" gorm:"index"`
	BayNo         string          `json:"bay_no" gorm:"type:varchar(20);index"`
	RowNo         int             `json:"row_no"`
	TierNo        int             `json:"tier_no"`
	SlotCode      string          `json:"slot_code" gorm:"type:varchar(50);index"`

	InTime        *time.Time      `json:"in_time"`
	OutTime       *time.Time      `json:"out_time"`
	EstimatedOutTime *time.Time   `json:"estimated_out_time"`
	FreeDays      int             `json:"free_days"`

	SealNo        string          `json:"seal_no" gorm:"type:varchar(50)"`
	Remark        string          `json:"remark" gorm:"type:text"`

	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type Yard struct {
	ID          int64       `json:"id" gorm:"primaryKey;autoIncrement"`
	YardCode    string      `json:"yard_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	YardName    string      `json:"yard_name" gorm:"type:varchar(100);not null"`
	Zone        string      `json:"zone" gorm:"type:varchar(50);index"`
	TotalBays   int         `json:"total_bays"`
	TotalRows   int         `json:"total_rows"`
	TotalTiers  int         `json:"total_tiers"`
	Capacity    int         `json:"capacity"`
	UsedCount   int         `json:"used_count"`
	ContainerType ContainerType `json:"container_type" gorm:"type:varchar(20);index"`
	IsActive    bool        `json:"is_active" gorm:"default:true;index"`
	Remark      string      `json:"remark" gorm:"type:text"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type YardSlot struct {
	ID          int64       `json:"id" gorm:"primaryKey;autoIncrement"`
	YardID      int64       `json:"yard_id" gorm:"index;not null"`
	YardCode    string      `json:"yard_code" gorm:"type:varchar(50);index"`
	BayNo       string      `json:"bay_no" gorm:"type:varchar(20);index"`
	RowNo       int         `json:"row_no"`
	TierNo      int         `json:"tier_no"`
	SlotCode    string      `json:"slot_code" gorm:"type:varchar(50);uniqueIndex;not null"`
	IsOccupied  bool        `json:"is_occupied" gorm:"default:false;index"`
	ContainerID *int64      `json:"container_id" gorm:"index"`
	ContainerNo string      `json:"container_no" gorm:"type:varchar(20);index"`
	Remark      string      `json:"remark" gorm:"type:text"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type SlotRecommendation struct {
	ContainerID int64    `json:"container_id"`
	ContainerNo string   `json:"container_no"`
	Slots       []SlotOption `json:"slots"`
	Algorithm   string   `json:"algorithm"`
	Score       float64  `json:"score"`
}

type SlotOption struct {
	SlotCode   string  `json:"slot_code"`
	YardCode   string  `json:"yard_code"`
	BayNo      string  `json:"bay_no"`
	RowNo      int     `json:"row_no"`
	TierNo     int     `json:"tier_no"`
	Score      float64 `json:"score"`
	RiskFactor float64 `json:"risk_factor"`
	EstimatedReshuffles int `json:"estimated_reshuffles"`
	Reason     string  `json:"reason"`
}

type ReshufflePlan struct {
	SourceSlot string `json:"source_slot"`
	TargetSlot string `json:"target_slot"`
	ContainerNo string `json:"container_no"`
	Priority   int    `json:"priority"`
}
