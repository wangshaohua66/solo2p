package models

type ProviderStatus string

const (
	ProviderStatusPending  ProviderStatus = "pending"
	ProviderStatusActive   ProviderStatus = "active"
	ProviderStatusInactive ProviderStatus = "inactive"
	ProviderStatusExpired  ProviderStatus = "expired"
)

type ServiceType string

const (
	ServiceTypeBuild  ServiceType = "build"
	ServiceTypeLogistics ServiceType = "logistics"
	ServiceTypeCatering  ServiceType = "catering"
	ServiceTypeSecurity  ServiceType = "security"
	ServiceTypeCleaning  ServiceType = "cleaning"
	ServiceTypeAV        ServiceType = "av"
	ServiceTypeOther     ServiceType = "other"
)

type ServiceProvider struct {
	BaseModel
	Name            string         `json:"name" gorm:"size:200;not null" example:"诚信搭建有限公司"`
	ServiceTypes    []ServiceType  `json:"serviceTypes" gorm:"type:jsonb"`
	ContactPerson   string         `json:"contactPerson" gorm:"size:100" example:"张三"`
	ContactPhone    string         `json:"contactPhone" gorm:"size:20" example:"13800138000"`
	ContactEmail    string         `json:"contactEmail" gorm:"size:100" example:"zhangsan@company.com"`
	LicenseNo       string         `json:"licenseNo" gorm:"size:50"`
	QualificationNo string         `json:"qualificationNo" gorm:"size:50"`
	QualificationExpireDate string  `json:"qualificationExpireDate" gorm:"size:10"`
	Address         string         `json:"address" gorm:"size:500"`
	Rating          float64        `json:"rating" gorm:"type:decimal(2,1);default:5.0" example:"5.0"`
	Status          ProviderStatus `json:"status" gorm:"size:20;default:pending" example:"pending"`
	Description     string         `json:"description" gorm:"type:text"`
	Certificates    []string       `json:"certificates" gorm:"type:jsonb"`
	CompletedOrders int            `json:"completedOrders" example:"0"`
}

func (ServiceProvider) TableName() string {
	return "service_providers"
}

type ServiceOrderStatus string

const (
	ServiceOrderPending   ServiceOrderStatus = "pending"
	ServiceOrderAssigned  ServiceOrderStatus = "assigned"
	ServiceOrderInProgress ServiceOrderStatus = "in_progress"
	ServiceOrderCompleted ServiceOrderStatus = "completed"
	ServiceOrderCancelled ServiceOrderStatus = "cancelled"
)

type ServiceOrder struct {
	BaseModel
	ProviderID   string            `json:"providerId" gorm:"type:uuid"`
	ProviderName string            `json:"providerName" gorm:"size:200"`
	ScheduleID   string            `json:"scheduleId" gorm:"type:uuid"`
	ScheduleName string            `json:"scheduleName" gorm:"size:200"`
	ServiceType  ServiceType       `json:"serviceType" gorm:"size:20" example:"build"`
	Description  string            `json:"description" gorm:"type:text"`
	Price        float64           `json:"price" gorm:"type:decimal(14,2)" example:"50000.00"`
	Status       ServiceOrderStatus `json:"status" gorm:"size:20;default:pending" example:"pending"`
	AssignedTo   string            `json:"assignedTo" gorm:"size:100"`
	AssignedAt   string            `json:"assignedAt" gorm:"size:30"`
	CompletedAt  string            `json:"completedAt" gorm:"size:30"`
	Rating       int               `json:"rating" example:"0"`
	Review       string            `json:"review" gorm:"type:text"`
}

func (ServiceOrder) TableName() string {
	return "service_orders"
}
