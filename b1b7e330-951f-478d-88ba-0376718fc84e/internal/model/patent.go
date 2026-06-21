package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

type PatentType string

const (
	PatentInvention  PatentType = "invention"
	PatentUtility    PatentType = "utility"
	PatentDesign     PatentType = "design"
)

type PatentStatus string

const (
	StatusDraft          PatentStatus = "draft"
	StatusSubmitted      PatentStatus = "submitted"
	StatusPreliminaryExam PatentStatus = "preliminary_exam"
	StatusPublished      PatentStatus = "published"
	StatusSubstantiveExam PatentStatus = "substantive_exam"
	StatusOfficeAction   PatentStatus = "office_action"
	StatusAuthorized     PatentStatus = "authorized"
	StatusRejected       PatentStatus = "rejected"
	StatusWithdrawn      PatentStatus = "withdrawn"
	StatusExpired        PatentStatus = "expired"
)

type AlertLevel string

const (
	AlertCritical AlertLevel = "critical"
	AlertWarning  AlertLevel = "warning"
	AlertInfo     AlertLevel = "info"
)

type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if len(s) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringSlice) Scan(input interface{}) error {
	if input == nil {
		*s = []string{}
		return nil
	}
	var bytes []byte
	switch v := input.(type) {
	case string:
		bytes = []byte(v)
	case []byte:
		bytes = v
	default:
		return errors.New("invalid type for StringSlice")
	}
	return json.Unmarshal(bytes, s)
}

type Enterprise struct {
	ID             uint   `gorm:"primaryKey"`
	Name           string `gorm:"index;size:255;not null"`
	UnifiedCode    string `gorm:"size:50"`
	ContactPerson  string `gorm:"size:100"`
	ContactPhone   string `gorm:"size:50"`
	ContactEmail   string `gorm:"size:255"`
	FeeReductionCertFile string `gorm:"size:500"`
	FeeReductionCertExpire *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type PatentApplication struct {
	ID              uint         `gorm:"primaryKey"`
	AppNum          string       `gorm:"index;size:50;unique;not null"`
	Title           string       `gorm:"size:500"`
	PatentType      PatentType   `gorm:"size:20;index"`
	Status          PatentStatus `gorm:"size:30;index"`
	EnterpriseID    uint         `gorm:"index"`
	Enterprise      Enterprise   `gorm:"foreignKey:EnterpriseID"`
	AgentName       string       `gorm:"size:100;index"`
	Inventor        string       `gorm:"size:500"`
	Applicant       string       `gorm:"size:500"`
	FilingDate      *time.Time   `gorm:"index"`
	PublishDate     *time.Time
	AuthorizationDate *time.Time
	ExpireDate      *time.Time
	CNIPRStatus     string       `gorm:"size:100"`
	CPQueryStatus   string       `gorm:"size:100"`
	FeeStatus       string       `gorm:"size:100"`
	LastSyncedAt    *time.Time
	RawData         string       `gorm:"type:text"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       gorm.DeletedAt `gorm:"index"`
}

type ExaminationRecord struct {
	ID                 uint `gorm:"primaryKey"`
	PatentApplicationID uint `gorm:"index;not null"`
	PatentApplication  PatentApplication `gorm:"foreignKey:PatentApplicationID"`
	OfficeActionType   string `gorm:"size:100"`
	NotificationCode   string `gorm:"size:50"`
	NotificationDate   *time.Time
	ResponseDeadline   *time.Time `gorm:"index"`
	Responded          bool `gorm:"default:false"`
	ResponseDate       *time.Time
	ClaimNumbers       StringSlice `gorm:"type:text"`
	ComparisonDocs     StringSlice `gorm:"type:text"`
	NotificationFile   string `gorm:"size:500"`
	Remark             string `gorm:"type:text"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type FeeRecord struct {
	ID                 uint `gorm:"primaryKey"`
	PatentApplicationID uint `gorm:"index;not null"`
	PatentApplication  PatentApplication `gorm:"foreignKey:PatentApplicationID"`
	FeeType            string `gorm:"size:100"`
	FeeYear            int
	FeeAmount          float64
	PaidAmount         float64
	DueDate            *time.Time `gorm:"index"`
	PaymentDate        *time.Time
	PaymentStatus      string `gorm:"size:50;index"`
	LateFeeAmount      float64
	OfficialReceiptNo  string `gorm:"size:100"`
	Remark             string `gorm:"type:text"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type AlertRecord struct {
	ID                 uint `gorm:"primaryKey"`
	PatentApplicationID uint `gorm:"index;not null"`
	PatentApplication  PatentApplication `gorm:"foreignKey:PatentApplicationID"`
	AlertType          string `gorm:"size:50"`
	AlertLevel         AlertLevel `gorm:"size:20;index"`
	AlertTitle         string `gorm:"size:500"`
	AlertContent       string `gorm:"type:text"`
	DueDate            *time.Time
	Notified           bool `gorm:"default:false"`
	NotifiedAt         *time.Time
	Handled            bool `gorm:"default:false"`
	HandledAt          *time.Time
	Handler            string `gorm:"size:100"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type SessionStore struct {
	ID         uint `gorm:"primaryKey"`
	SystemName string `gorm:"size:50;index;not null"`
	Account    string `gorm:"size:100;index;not null"`
	Cookies    string `gorm:"type:text"`
	ExpiresAt  *time.Time
	LastActive *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type BatchTask struct {
	ID            uint `gorm:"primaryKey"`
	TaskType      string `gorm:"size:50;index"`
	TotalCount    int
	SuccessCount  int `gorm:"default:0"`
	FailedCount   int `gorm:"default:0"`
	Status        string `gorm:"size:30;index"`
	CurrentIndex  int `gorm:"default:0"`
	FailedItems   string `gorm:"type:text"`
	StartedAt     *time.Time
	CompletedAt   *time.Time
	CreatedBy     string `gorm:"size:100"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&Enterprise{},
		&PatentApplication{},
		&ExaminationRecord{},
		&FeeRecord{},
		&AlertRecord{},
		&SessionStore{},
		&BatchTask{},
	)
}
