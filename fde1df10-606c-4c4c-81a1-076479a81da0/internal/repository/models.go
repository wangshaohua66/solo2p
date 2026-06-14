package repository

import (
	"gorm.io/gorm"
	"time"
)

type UserRole string

const (
	UserRoleVenueManager UserRole = "venue_manager"
	UserRoleProducer     UserRole = "producer"
	UserRoleTechDirector UserRole = "tech_director"
	UserRoleFinance      UserRole = "finance"
	UserRoleTroupeAdmin  UserRole = "troupe_admin"
)

type User struct {
	gorm.Model
	Username     string   `gorm:"type:varchar(100);uniqueIndex;not null" json:"username"`
	PasswordHash string   `gorm:"type:varchar(255);not null" json:"-"`
	RealName     string   `gorm:"type:varchar(100)" json:"real_name"`
	Role         UserRole `gorm:"type:varchar(50);not null" json:"role"`
	Email        string   `gorm:"type:varchar(100);uniqueIndex" json:"email"`
	Phone        string   `gorm:"type:varchar(20)" json:"phone"`
}

type VenueType string

const (
	VenueTypeTheater             VenueType = "theater"
	VenueTypeConcertHall         VenueType = "concert_hall"
	VenueTypeExperimentalTheater VenueType = "experimental_theater"
	VenueTypeRehearsalRoom       VenueType = "rehearsal_room"
)

type VenueStatus string

const (
	VenueStatusActive      VenueStatus = "active"
	VenueStatusMaintenance VenueStatus = "maintenance"
)

type Venue struct {
	gorm.Model
	Name        string      `gorm:"type:varchar(200);not null" json:"name"`
	Type        VenueType   `gorm:"type:varchar(50);not null" json:"type"`
	Capacity    int         `gorm:"not null" json:"capacity"`
	Location    string      `gorm:"type:varchar(500)" json:"location"`
	Status      VenueStatus `gorm:"type:varchar(50);not null;default:active" json:"status"`
	Description string      `gorm:"type:text" json:"description"`
}

type BookingStatus string

const (
	BookingStatusPending     BookingStatus = "pending"
	BookingStatusConfirmed   BookingStatus = "confirmed"
	BookingStatusConflict    BookingStatus = "conflict"
	BookingStatusMaintenance BookingStatus = "maintenance"
	BookingStatusCancelled   BookingStatus = "cancelled"
)

type BookingType string

const (
	BookingTypePerformance BookingType = "performance"
	BookingTypeRehearsal   BookingType = "rehearsal"
	BookingTypeMaintenance BookingType = "maintenance"
)

// 性能优化: 建议添加复合索引 (venue_id, start_time, end_time, status) 以加速冲突检测查询
// 建议 MySQL 执行: CREATE INDEX idx_booking_conflict ON bookings(venue_id, start_time, end_time, status);
type Booking struct {
	gorm.Model
	VenueID     uint          `gorm:"not null;index" json:"venue_id"`
	Venue       Venue         `gorm:"foreignKey:VenueID" json:"venue,omitempty"`
	UserID      uint          `gorm:"not null;index" json:"user_id"`
	User        User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Title       string        `gorm:"type:varchar(200);not null" json:"title"`
	Description string        `gorm:"type:text" json:"description"`
	StartTime   time.Time     `gorm:"not null;index" json:"start_time"`
	EndTime     time.Time     `gorm:"not null;index" json:"end_time"`
	Status      BookingStatus `gorm:"type:varchar(50);not null;default:pending" json:"status"`
	Type        BookingType   `gorm:"type:varchar(50);not null" json:"type"`
	Remarks     string        `gorm:"type:text" json:"remarks"`
}

type EquipmentCategory string

const (
	EquipmentCategoryLighting EquipmentCategory = "lighting"
	EquipmentCategorySound    EquipmentCategory = "sound"
	EquipmentCategoryStage    EquipmentCategory = "stage"
)

type EquipmentStatus string

const (
	EquipmentStatusAvailable   EquipmentStatus = "available"
	EquipmentStatusInUse       EquipmentStatus = "in_use"
	EquipmentStatusMaintenance EquipmentStatus = "maintenance"
)

type Equipment struct {
	gorm.Model
	Name         string            `gorm:"type:varchar(200);not null" json:"name"`
	Category     EquipmentCategory `gorm:"type:varchar(50);not null" json:"category"`
	ModelName    string            `gorm:"type:varchar(200);column:model" json:"model"`
	Status       EquipmentStatus   `gorm:"type:varchar(50);not null;default:available" json:"status"`
	Location     string            `gorm:"type:varchar(500)" json:"location"`
	Description  string            `gorm:"type:text" json:"description"`
	SerialNumber string            `gorm:"type:varchar(200);uniqueIndex" json:"serial_number"`
}

// 性能优化: 建议添加复合索引 (booking_id, start_time, end_time) 以加速设备占用冲突检测
// 建议 MySQL 执行: CREATE INDEX idx_equipment_booking_conflict ON equipment_bookings(booking_id, start_time, end_time);
// 另外建议添加: CREATE INDEX idx_equipment_booking_time ON equipment_bookings(start_time, end_time);
type EquipmentBooking struct {
	gorm.Model
	EquipmentID uint          `gorm:"not null;index" json:"equipment_id"`
	Equipment   Equipment     `gorm:"foreignKey:EquipmentID" json:"equipment,omitempty"`
	BookingID   uint          `gorm:"not null;index" json:"booking_id"`
	Booking     Booking       `gorm:"foreignKey:BookingID" json:"booking,omitempty"`
	StartTime   time.Time     `gorm:"not null" json:"start_time"`
	EndTime     time.Time     `gorm:"not null" json:"end_time"`
	Status      BookingStatus `gorm:"type:varchar(50);not null;default:pending" json:"status"`
}

type ContractStatus string

const (
	ContractStatusPendingTech    ContractStatus = "pending_tech"
	ContractStatusPendingFinance ContractStatus = "pending_finance"
	ContractStatusPendingVenue   ContractStatus = "pending_venue"
	ContractStatusApproved       ContractStatus = "approved"
	ContractStatusRejected       ContractStatus = "rejected"
	ContractStatusReturned       ContractStatus = "returned"
)

type Contract struct {
	gorm.Model
	BookingID   uint           `gorm:"not null;index" json:"booking_id"`
	Booking     Booking        `gorm:"foreignKey:BookingID" json:"booking,omitempty"`
	SubmitterID uint           `gorm:"not null;index" json:"submitter_id"`
	Submitter   User           `gorm:"foreignKey:SubmitterID" json:"submitter,omitempty"`
	Title       string         `gorm:"type:varchar(200);not null" json:"title"`
	Content     string         `gorm:"type:text" json:"content"`
	Status      ContractStatus `gorm:"type:varchar(50);not null" json:"status"`
	CurrentStep int            `gorm:"not null;default:0" json:"current_step"`
}

type ContractApprovalAction string

const (
	ContractApprovalActionApprove ContractApprovalAction = "approve"
	ContractApprovalActionReject  ContractApprovalAction = "reject"
	ContractApprovalActionReturn  ContractApprovalAction = "return"
)

type ContractApproval struct {
	gorm.Model
	ContractID uint                   `gorm:"not null;index" json:"contract_id"`
	Contract   Contract               `gorm:"foreignKey:ContractID" json:"contract,omitempty"`
	ApproverID uint                   `gorm:"not null;index" json:"approver_id"`
	Approver   User                   `gorm:"foreignKey:ApproverID" json:"approver,omitempty"`
	Step       int                    `gorm:"not null" json:"step"`
	Action     ContractApprovalAction `gorm:"type:varchar(50);not null" json:"action"`
	Comment    string                 `gorm:"type:text" json:"comment"`
}

type BudgetStatus string

const (
	BudgetStatusNormal  BudgetStatus = "normal"
	BudgetStatusWarning BudgetStatus = "warning"
	BudgetStatusFrozen  BudgetStatus = "frozen"
)

type Budget struct {
	gorm.Model
	BookingID       uint         `gorm:"not null;uniqueIndex" json:"booking_id"`
	Booking         Booking      `gorm:"foreignKey:BookingID" json:"booking,omitempty"`
	StageBudget     float64      `gorm:"type:decimal(12,2);not null;default:0" json:"stage_budget"`
	StaffBudget     float64      `gorm:"type:decimal(12,2);not null;default:0" json:"staff_budget"`
	MarketingBudget float64      `gorm:"type:decimal(12,2);not null;default:0" json:"marketing_budget"`
	VenueBudget     float64      `gorm:"type:decimal(12,2);not null;default:0" json:"venue_budget"`
	TotalBudget     float64      `gorm:"type:decimal(12,2);not null;default:0" json:"total_budget"`
	TotalSpent      float64      `gorm:"type:decimal(12,2);not null;default:0" json:"total_spent"`
	Status          BudgetStatus `gorm:"type:varchar(50);not null;default:normal" json:"status"`
}

type ExpenseCategory string

const (
	ExpenseCategoryStage     ExpenseCategory = "stage"
	ExpenseCategoryStaff     ExpenseCategory = "staff"
	ExpenseCategoryMarketing ExpenseCategory = "marketing"
	ExpenseCategoryVenue     ExpenseCategory = "venue"
)

type Expense struct {
	gorm.Model
	BudgetID    uint            `gorm:"not null;index" json:"budget_id"`
	Budget      Budget          `gorm:"foreignKey:BudgetID" json:"budget,omitempty"`
	Category    ExpenseCategory `gorm:"type:varchar(50);not null" json:"category"`
	Amount      float64         `gorm:"type:decimal(12,2);not null" json:"amount"`
	Description string          `gorm:"type:text" json:"description"`
	SubmittedBy uint            `gorm:"not null;index" json:"submitted_by"`
	Submitter   User            `gorm:"foreignKey:SubmittedBy" json:"submitter,omitempty"`
}

type RecurrenceRule string

const (
	RecurrenceRuleNone   RecurrenceRule = "none"
	RecurrenceRuleWeekly RecurrenceRule = "weekly"
)

type RehearsalBooking struct {
	gorm.Model
	VenueID         uint           `gorm:"not null;index" json:"venue_id"`
	Venue           Venue          `gorm:"foreignKey:VenueID" json:"venue,omitempty"`
	UserID          uint           `gorm:"not null;index" json:"user_id"`
	User            User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	TroupeName      string         `gorm:"type:varchar(200);not null" json:"troupe_name"`
	StartTime       time.Time      `gorm:"not null" json:"start_time"`
	EndTime         time.Time      `gorm:"not null" json:"end_time"`
	RecurrenceRule  RecurrenceRule `gorm:"type:varchar(50);not null;default:none" json:"recurrence_rule"`
	RecurrenceDays  string         `gorm:"type:varchar(100)" json:"recurrence_days"`
	RecurrenceWeeks int            `gorm:"default:0" json:"recurrence_weeks"`
	Status          BookingStatus  `gorm:"type:varchar(50);not null;default:pending" json:"status"`
}

type Notification struct {
	gorm.Model
	UserID  uint   `gorm:"not null;index" json:"user_id"`
	User    User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Type    string `gorm:"type:varchar(100);not null" json:"type"`
	Title   string `gorm:"type:varchar(200);not null" json:"title"`
	Content string `gorm:"type:text" json:"content"`
	IsRead  bool   `gorm:"not null;default:false" json:"is_read"`
}
