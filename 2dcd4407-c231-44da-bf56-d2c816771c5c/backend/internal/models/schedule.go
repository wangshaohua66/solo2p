package models

type ScheduleStatus string

const (
	ScheduleStatusPending   ScheduleStatus = "pending"
	ScheduleStatusApproved  ScheduleStatus = "approved"
	ScheduleStatusLocked    ScheduleStatus = "locked"
	ScheduleStatusCancelled ScheduleStatus = "cancelled"
	ScheduleStatusCompleted ScheduleStatus = "completed"
)

type Schedule struct {
	BaseModel
	ExhibitionName string         `json:"exhibitionName" gorm:"size:200;not null" example:"2026国际建材博览会"`
	OrganizerID    string         `json:"organizerId" gorm:"type:uuid"`
	OrganizerName  string         `json:"organizerName" gorm:"size:200" example:"中国建筑材料联合会"`
	VenueIDs       []string       `json:"venueIds" gorm:"type:jsonb;not null"`
	StartDate      string         `json:"startDate" gorm:"size:10;not null" example:"2026-03-15"`
	EndDate        string         `json:"endDate" gorm:"size:10;not null" example:"2026-03-20"`
	MoveInDate     string         `json:"moveInDate" gorm:"size:10"`
	MoveOutDate    string         `json:"moveOutDate" gorm:"size:10"`
	ExpectedVisits int            `json:"expectedVisits" example:"50000"`
	Description    string         `json:"description" gorm:"type:text"`
	Status         ScheduleStatus `json:"status" gorm:"size:20;default:pending" example:"pending"`
	ApprovedBy     string         `json:"approvedBy" gorm:"size:100"`
	ApprovedAt     string         `json:"approvedAt" gorm:"size:30"`
	Remark         string         `json:"remark" gorm:"type:text"`
	Tags           []string       `json:"tags" gorm:"type:jsonb"`
	IsLocked       bool           `json:"isLocked" example:"false"`
}

func (Schedule) TableName() string {
	return "schedules"
}

type ScheduleConflict struct {
	HasConflict bool       `json:"hasConflict"`
	Conflicts   []Schedule `json:"conflicts"`
}
