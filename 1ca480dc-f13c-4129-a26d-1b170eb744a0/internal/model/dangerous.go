package model

import (
	"time"
)

type DangerousGoods struct {
	ID              int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	ContainerID     int64         `json:"container_id" gorm:"uniqueIndex;not null"`
	ContainerNo     string        `json:"container_no" gorm:"type:varchar(20);uniqueIndex;not null"`
	DangerousClass  DangerousClass `json:"dangerous_class" gorm:"type:varchar(20);index"`
	UNNumber        string        `json:"un_number" gorm:"type:varchar(20)"`
	ProperShippingName string     `json:"proper_shipping_name" gorm:"type:varchar(500)"`
	TechnicalName   string        `json:"technical_name" gorm:"type:varchar(500)"`
	FlashPoint      float64       `json:"flash_point"`
	PackingGroup    string        `json:"packing_group" gorm:"type:varchar(10)"`
	EMSNumber       string        `json:"ems_number" gorm:"type:varchar(50)"`
	MarinePollutant bool          `json:"marine_pollutant" gorm:"default:false"`
	Quantity        float64       `json:"quantity"`
	Unit            string        `json:"unit" gorm:"type:varchar(20)"`
	GrossWeight     float64       `json:"gross_weight"`
	NetWeight       float64       `json:"net_weight"`
	HazardLabels    []string      `json:"hazard_labels" gorm:"-"`
	EmergencyContact string       `json:"emergency_contact" gorm:"type:varchar(200)"`
	EmergencyPhone  string        `json:"emergency_phone" gorm:"type:varchar(50)"`
	CustomsStatus   CustomsStatus `json:"customs_status" gorm:"type:varchar(20);index"`
	CustomsDeclared bool          `json:"customs_declared" gorm:"default:false;index"`
	InspectionRequired bool       `json:"inspection_required" gorm:"default:false"`
	InspectionStatus string       `json:"inspection_status" gorm:"type:varchar(20);index"`
	Remark          string        `json:"remark" gorm:"type:text"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type CustomsDeclaration struct {
	ID                int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	DeclarationNo     string        `json:"declaration_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	ContainerID       int64         `json:"container_id" gorm:"index;not null"`
	ContainerNo       string        `json:"container_no" gorm:"type:varchar(20);index"`
	DangerousGoodsID  int64         `json:"dangerous_goods_id" gorm:"index"`
	DeclarationType   string        `json:"declaration_type" gorm:"type:varchar(50)"`
	Declarant         string        `json:"declarant" gorm:"type:varchar(100)"`
	DeclarantCompany  string        `json:"declarant_company" gorm:"type:varchar(200)"`
	DeclarantContact  string        `json:"declarant_contact" gorm:"type:varchar(200)"`
	HSCode            string        `json:"hs_code" gorm:"type:varchar(20)"`
	GoodsDescription  string        `json:"goods_description" gorm:"type:text"`
	OriginCountry     string        `json:"origin_country" gorm:"type:varchar(100)"`
	DestinationCountry string       `json:"destination_country" gorm:"type:varchar(100)"`
	InvoiceNo         string        `json:"invoice_no" gorm:"type:varchar(50)"`
	InvoiceAmount     float64       `json:"invoice_amount"`
	Currency          string        `json:"currency" gorm:"type:varchar(10)"`
	DeclarationData   string        `json:"declaration_data" gorm:"type:jsonb"`
	Status            CustomsStatus `json:"status" gorm:"type:varchar(20);index"`
	SubmitTime        *time.Time    `json:"submit_time"`
	CustomsReceiveTime *time.Time   `json:"customs_receive_time"`
	InspectionNotice  string        `json:"inspection_notice" gorm:"type:text"`
	InspectionTime    *time.Time    `json:"inspection_time"`
	InspectionResult  string        `json:"inspection_result" gorm:"type:text"`
	ReleaseTime       *time.Time    `json:"release_time"`
	CustomsResponse   string        `json:"customs_response" gorm:"type:jsonb"`
	Remark            string        `json:"remark" gorm:"type:text"`
	CreatedAt         time.Time     `json:"created_at"`
	UpdatedAt         time.Time     `json:"updated_at"`
}

type InspectionRecord struct {
	ID                int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	InspectionNo      string     `json:"inspection_no" gorm:"type:varchar(50);uniqueIndex;not null"`
	DeclarationID     int64      `json:"declaration_id" gorm:"index;not null"`
	ContainerID       int64      `json:"container_id" gorm:"index;not null"`
	ContainerNo       string     `json:"container_no" gorm:"type:varchar(20);index"`
	InspectionType    string     `json:"inspection_type" gorm:"type:varchar(50)"`
	InspectionOrderNo string     `json:"inspection_order_no" gorm:"type:varchar(50)"`
	InspectorID       int64      `json:"inspector_id"`
	InspectorName     string     `json:"inspector_name" gorm:"type:varchar(100)"`
	ScheduledTime     *time.Time `json:"scheduled_time"`
	StartTime         *time.Time `json:"start_time"`
	EndTime           *time.Time `json:"end_time"`
	InspectionSite    string     `json:"inspection_site" gorm:"type:varchar(200)"`
	Items             []string   `json:"items" gorm:"-"`
	Findings          string     `json:"findings" gorm:"type:text"`
	Photos            []string   `json:"photos" gorm:"-"`
	Result            string     `json:"result" gorm:"type:varchar(20);index"`
	Passed            bool       `json:"passed" gorm:"default:false"`
	Remark            string     `json:"remark" gorm:"type:text"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type CustomsSyncLog struct {
	ID             int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	LogType        string    `json:"log_type" gorm:"type:varchar(20);index"`
	DeclarationID  int64     `json:"declaration_id" gorm:"index"`
	ContainerNo    string    `json:"container_no" gorm:"type:varchar(20);index"`
	Direction      string    `json:"direction" gorm:"type:varchar(10)"`
	APIEndpoint    string    `json:"api_endpoint" gorm:"type:varchar(500)"`
	RequestData    string    `json:"request_data" gorm:"type:text"`
	ResponseData   string    `json:"response_data" gorm:"type:text"`
	StatusCode     int       `json:"status_code"`
	Success        bool      `json:"success" gorm:"index"`
	ErrorMessage   string    `json:"error_message" gorm:"type:text"`
	RetryCount     int       `json:"retry_count" gorm:"default:0"`
	CreatedAt      time.Time `json:"created_at" gorm:"index"`
}
