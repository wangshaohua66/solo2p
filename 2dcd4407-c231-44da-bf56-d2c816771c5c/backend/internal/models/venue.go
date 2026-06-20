package models

type VenueType string

const (
	VenueTypeExhibition Hall VenueType = "exhibition"
	VenueTypeMeeting         VenueType = "meeting"
	VenueTypeMultiFunction   VenueType = "multifunction"
)

type Venue struct {
	BaseModel
	Name        string    `json:"name" gorm:"size:100;not null" example:"1号展厅"`
	VenueType   VenueType `json:"venueType" gorm:"size:20;not null" example:"exhibition"`
	Capacity    int       `json:"capacity" example:"5000"`
	Area        float64   `json:"area" example:"10000.5"`
	Floor       string    `json:"floor" gorm:"size:20" example:"1F"`
	Description string    `json:"description" gorm:"type:text"`
	Status      string    `json:"status" gorm:"size:20;default:active" example:"active"`
	Facilities  []string  `json:"facilities" gorm:"type:jsonb"`
	ImageURL    string    `json:"imageUrl" gorm:"size:500"`
	Booths      []Booth   `json:"booths,omitempty" gorm:"foreignKey:VenueID"`
}

func (Venue) TableName() string {
	return "venues"
}
