package models

import "time"

type BoothVisit struct {
	BoothID     string    `json:"boothId"`
	BoothNo     string    `json:"boothNo"`
	Zone        string    `json:"zone"`
	VisitedAt   time.Time `json:"visitedAt"`
	EnterTime   time.Time `json:"enterTime"`
	LeaveTime   time.Time `json:"leaveTime,omitempty"`
	DurationSec int       `json:"durationSec"`
}

type VisitorRecord struct {
	BaseModel
	ScheduleID     string       `json:"scheduleId" gorm:"type:uuid"`
	ScheduleName   string       `json:"scheduleName" gorm:"size:200"`
	Name           string       `json:"name" gorm:"size:100" example:"张三"`
	Phone          string       `json:"phone" gorm:"size:20" example:"13800138000"`
	Email          string       `json:"email" gorm:"size:100" example:"zhangsan@example.com"`
	Company        string       `json:"company" gorm:"size:200" example:"某某科技有限公司"`
	Title          string       `json:"title" gorm:"size:100" example:"市场经理"`
	VisitorType    string       `json:"visitorType" gorm:"size:20" example:"professional"`
	QRCode         string       `json:"qrCode" gorm:"size:100;uniqueIndex" example:"VISITOR-20260315-0001"`
	CheckInAt      string       `json:"checkInAt" gorm:"size:30"`
	CheckOutAt     string       `json:"checkOutAt" gorm:"size:30"`
	BoothVisits    []BoothVisit `json:"boothVisits" gorm:"type:jsonb"`
	AppointmentIDs []string     `json:"appointmentIds" gorm:"type:jsonb"`
	Tags           []string     `json:"tags" gorm:"type:jsonb"`
	Remarks        string       `json:"remarks" gorm:"type:text"`
	Source         string       `json:"source" gorm:"size:50" example:"online"`
	TotalVisitTime int          `json:"totalVisitTime" example:"0"`
}

func (VisitorRecord) TableName() string {
	return "visitor_records"
}
