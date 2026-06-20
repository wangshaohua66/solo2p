package models

type BoothStatus string

const (
	BoothStatusAvailable   BoothStatus = "available"
	BoothStatusReserved    BoothStatus = "reserved"
	BoothStatusSold        BoothStatus = "sold"
	BoothStatusOccupied    BoothStatus = "occupied"
	BoothStatusMaintenance BoothStatus = "maintenance"
)

type Booth struct {
	BaseModel
	VenueID        string      `json:"venueId" gorm:"type:uuid;not null" example:"venue-uuid-1"`
	BoothNo        string      `json:"boothNo" gorm:"size:50;not null" example:"A01"`
	Zone           string      `json:"zone" gorm:"size:20" example:"A区"`
	X              float64     `json:"x" example:"100"`
	Y              float64     `json:"y" example:"100"`
	Width          float64     `json:"width" example:"36"`
	Height         float64     `json:"height" example:"24"`
	Area           float64     `json:"area" example:"9"`
	Status         BoothStatus `json:"status" gorm:"size:20;default:available" example:"available"`
	Price          float64     `json:"price" gorm:"type:decimal(14,2)" example:"15000.00"`
	PricePerSquare float64     `json:"pricePerSquare" gorm:"type:decimal(14,2)" example:"1666.67"`
	ExhibitorID    string      `json:"exhibitorId" gorm:"type:uuid"`
	ExhibitorName  string      `json:"exhibitorName" gorm:"size:200"`
	ScheduleID     string      `json:"scheduleId" gorm:"type:uuid"`
	IsCorner       bool        `json:"isCorner" example:"false"`
	IsOpenSide     bool        `json:"isOpenSide" example:"false"`
	PowerCapacity  string      `json:"powerCapacity" gorm:"size:20" example:"15KW"`
	Description    string      `json:"description" gorm:"type:text"`
	Facilities     []string    `json:"facilities" gorm:"type:jsonb"`
}

func (Booth) TableName() string {
	return "booths"
}
