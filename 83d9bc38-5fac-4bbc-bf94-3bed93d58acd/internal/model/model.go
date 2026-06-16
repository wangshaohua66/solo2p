package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Role struct {
	ID          uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string         `gorm:"type:varchar(50);not null;unique" json:"name"`
	Permissions datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"permissions"`
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`

	Users []User `gorm:"foreignKey:RoleID" json:"users,omitempty"`
}

type Center struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Address     string    `gorm:"type:varchar(255)" json:"address"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updatedAt"`

	Users     []User      `gorm:"foreignKey:CenterID" json:"users,omitempty"`
	Equipment []Equipment `gorm:"foreignKey:CenterID" json:"equipment,omitempty"`
}

type User struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Username     string    `gorm:"type:varchar(50);not null;unique" json:"username"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name"`
	Email        string    `gorm:"type:varchar(100);unique" json:"email"`
	RoleID       uint64    `gorm:"index" json:"roleId"`
	CenterID     uint64    `gorm:"index" json:"centerId"`
	Budget       float64   `gorm:"type:decimal(12,2);not null;default:0" json:"budget"`
	AdvisorID    *uint64   `gorm:"index" json:"advisorId,omitempty"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime" json:"updatedAt"`

	Role          *Role          `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	Center        *Center        `gorm:"foreignKey:CenterID" json:"center,omitempty"`
	Advisor       *User          `gorm:"foreignKey:AdvisorID" json:"advisor,omitempty"`
	Bookings      []Booking      `gorm:"foreignKey:UserID" json:"bookings,omitempty"`
	Billings      []Billing      `gorm:"foreignKey:UserID" json:"billings,omitempty"`
	Notifications []Notification `gorm:"foreignKey:UserID" json:"notifications,omitempty"`
}

type Equipment struct {
	ID         uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Name       string         `gorm:"type:varchar(100);not null" json:"name"`
	Model      string         `gorm:"type:varchar(100)" json:"model"`
	Category   string         `gorm:"type:varchar(50);not null;index" json:"category"`
	CenterID   uint64         `gorm:"index" json:"centerId"`
	HourlyRate float64        `gorm:"type:decimal(10,2);not null" json:"hourlyRate"`
	Status     string         `gorm:"type:varchar(20);not null;default:'available';index" json:"status"`
	Specs      datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"specs"`
	CreatedAt  time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`

	Center        *Center        `gorm:"foreignKey:CenterID" json:"center,omitempty"`
	Bookings      []Booking      `gorm:"foreignKey:EquipmentID" json:"bookings,omitempty"`
	Maintenances  []Maintenance  `gorm:"foreignKey:EquipmentID" json:"maintenances,omitempty"`
	EquipmentLogs []EquipmentLog `gorm:"foreignKey:EquipmentID" json:"equipmentLogs,omitempty"`
	Waitlists     []Waitlist     `gorm:"foreignKey:EquipmentID" json:"waitlists,omitempty"`
}

type EquipmentLog struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	EquipmentID uint64    `gorm:"index" json:"equipmentId"`
	OldStatus   string    `gorm:"type:varchar(20)" json:"oldStatus"`
	NewStatus   string    `gorm:"type:varchar(20);not null" json:"newStatus"`
	OperatorID  uint64    `gorm:"index" json:"operatorId"`
	Remark      string    `gorm:"type:text" json:"remark"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`

	Equipment *Equipment `gorm:"foreignKey:EquipmentID" json:"equipment,omitempty"`
	Operator  *User      `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
}

type Booking struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	EquipmentID uint64    `gorm:"index:idx_bookings_equipment_time" json:"equipmentId"`
	UserID      uint64    `gorm:"index" json:"userId"`
	StartTime   time.Time `gorm:"index:idx_bookings_equipment_time;not null" json:"startTime"`
	EndTime     time.Time `gorm:"index:idx_bookings_equipment_time;not null" json:"endTime"`
	Status      string    `gorm:"type:varchar(20);not null;default:'confirmed';index" json:"status"`
	IsSeries    bool      `gorm:"not null;default:false" json:"isSeries"`
	SeriesID    string    `gorm:"type:varchar(50)" json:"seriesId,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updatedAt"`

	Equipment *Equipment `gorm:"foreignKey:EquipmentID" json:"equipment,omitempty"`
	User      *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Waitlists []Waitlist `gorm:"foreignKey:BookingID" json:"waitlists,omitempty"`
	Billing   *Billing   `gorm:"foreignKey:BookingID" json:"billing,omitempty"`
}

func (b *Booking) BeforeCreate(tx *gorm.DB) error {
	if b.IsSeries && b.SeriesID == "" {
		b.SeriesID = uuid.New().String()
	}
	return nil
}

type Waitlist struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	BookingID   *uint64   `json:"bookingId,omitempty"`
	EquipmentID uint64    `gorm:"index:idx_waitlists_equipment;not null" json:"equipmentId"`
	UserID      uint64    `gorm:"not null" json:"userId"`
	StartTime   time.Time `gorm:"not null" json:"startTime"`
	EndTime     time.Time `gorm:"not null" json:"endTime"`
	Position    int       `gorm:"index:idx_waitlists_equipment;not null" json:"position"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`

	Booking   *Booking   `gorm:"foreignKey:BookingID" json:"booking,omitempty"`
	Equipment *Equipment `gorm:"foreignKey:EquipmentID" json:"equipment,omitempty"`
	User      *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type Billing struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	BookingID   *uint64   `json:"bookingId,omitempty"`
	UserID      uint64    `gorm:"index:idx_billings_user_date;not null" json:"userId"`
	Amount      float64   `gorm:"type:decimal(12,2);not null" json:"amount"`
	Status      string    `gorm:"type:varchar(20);not null;default:'paid'" json:"status"`
	BillingDate time.Time `gorm:"index:idx_billings_user_date;type:date;not null" json:"billingDate"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`

	Booking *Booking `gorm:"foreignKey:BookingID" json:"booking,omitempty"`
	User    *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type Maintenance struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	EquipmentID uint64    `gorm:"index:idx_maintenances_equipment_time;not null" json:"equipmentId"`
	StartTime   time.Time `gorm:"index:idx_maintenances_equipment_time;not null" json:"startTime"`
	EndTime     time.Time `gorm:"not null" json:"endTime"`
	Type        string    `gorm:"type:varchar(50);not null" json:"type"`
	Status      string    `gorm:"type:varchar(20);not null;default:'scheduled'" json:"status"`
	Remark      string    `gorm:"type:text" json:"remark"`
	OperatorID  *uint64   `gorm:"index" json:"operatorId,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updatedAt"`

	Equipment *Equipment `gorm:"foreignKey:EquipmentID" json:"equipment,omitempty"`
	Operator  *User      `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
}

type Notification struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `gorm:"index:idx_notifications_user_read;not null" json:"userId"`
	Type      string    `gorm:"type:varchar(50);not null" json:"type"`
	Title     string    `gorm:"type:varchar(200);not null" json:"title"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	IsRead    bool      `gorm:"index:idx_notifications_user_read;not null;default:false" json:"isRead"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type AuditLog struct {
	ID        uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    *uint64        `gorm:"index" json:"userId,omitempty"`
	Action    string         `gorm:"type:varchar(50);not null" json:"action"`
	TableName string         `gorm:"type:varchar(50)" json:"tableName"`
	RecordID  *uint64        `json:"recordId,omitempty"`
	OldValue  datatypes.JSON `gorm:"type:jsonb" json:"oldValue"`
	NewValue  datatypes.JSON `gorm:"type:jsonb" json:"newValue"`
	IPAddress string         `gorm:"type:varchar(45)" json:"ipAddress"`
	CreatedAt time.Time      `gorm:"autoCreateTime;index:idx_audit_logs_created,sort:desc" json:"createdAt"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type PaginationParams struct {
	Page     int `json:"page" form:"page"`
	PageSize int `json:"pageSize" form:"pageSize"`
}

func (p *PaginationParams) GetOffset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 10
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginationParams) GetLimit() int {
	if p.PageSize <= 0 {
		p.PageSize = 10
	}
	return p.PageSize
}

type PaginatedResult[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
}

type UtilizationStats struct {
	EquipmentID     uint64  `json:"equipmentId"`
	EquipmentName   string  `json:"equipmentName"`
	CenterID        uint64  `json:"centerId"`
	CenterName      string  `json:"centerName"`
	Category        string  `json:"category"`
	TotalHours      float64 `json:"totalHours"`
	BookedHours     float64 `json:"bookedHours"`
	UtilizationRate float64 `json:"utilizationRate"`
	Period          string  `json:"period"`
}

type CategoryStats struct {
	Category        string  `json:"category"`
	Count           int64   `json:"count"`
	BookedHours     float64 `json:"bookedHours"`
	UtilizationRate float64 `json:"utilizationRate"`
}

type CenterStats struct {
	CenterID        uint64  `json:"centerId"`
	CenterName      string  `json:"centerName"`
	EquipmentCount  int64   `json:"equipmentCount"`
	BookedHours     float64 `json:"bookedHours"`
	UtilizationRate float64 `json:"utilizationRate"`
}

type UnreadNotificationStats struct {
	UserID           uint64 `json:"userId"`
	UnreadCount      int64  `json:"unreadCount"`
	BookingCount     int64  `json:"bookingCount"`
	MaintenanceCount int64  `json:"maintenanceCount"`
	BillingCount     int64  `json:"billingCount"`
}

type PeakValleyStats struct {
	Hour       int   `json:"hour"`
	BookingCount int64 `json:"bookingCount"`
}

type TrendStats struct {
	Date            string  `json:"date"`
	UtilizationRate float64 `json:"utilizationRate"`
	BookedHours     float64 `json:"bookedHours"`
}

type EquipmentRankingItem struct {
	EquipmentID     uint64  `json:"equipmentId"`
	EquipmentName   string  `json:"equipmentName"`
	CenterName      string  `json:"centerName"`
	Category        string  `json:"category"`
	BookedHours     float64 `json:"bookedHours"`
	UtilizationRate float64 `json:"utilizationRate"`
	Rank            int     `json:"rank"`
}

type DashboardStats struct {
	TotalEquipment   int64   `json:"totalEquipment"`
	TodayBookings    int64   `json:"todayBookings"`
	MonthlyUtilization float64 `json:"monthlyUtilization"`
	PendingCount     int64   `json:"pendingCount"`
}

type CenterDetailStats struct {
	CenterID        uint64  `json:"centerId"`
	CenterName      string  `json:"centerName"`
	EquipmentCount  int64   `json:"equipmentCount"`
	TotalBookedHours float64 `json:"totalBookedHours"`
	AvgUtilization  float64 `json:"avgUtilization"`
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Token       string   `json:"token"`
	User        User     `json:"user"`
	Permissions []string `json:"permissions"`
}

type RefreshTokenRequest struct {
	Token string `json:"token" validate:"required"`
}

type RefreshTokenResponse struct {
	Token string `json:"token"`
}

type LogoutResponse struct {
	Message string `json:"message"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&Role{},
		&Center{},
		&User{},
		&Equipment{},
		&EquipmentLog{},
		&Booking{},
		&Waitlist{},
		&Billing{},
		&Maintenance{},
		&Notification{},
		&AuditLog{},
	)
}
