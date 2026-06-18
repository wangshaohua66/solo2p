package models

import (
	"time"
)

type FlightQuery struct {
	FromCity     string    `json:"from_city"`
	ToCity       string    `json:"to_city"`
	FromCityCode string    `json:"from_city_code"`
	ToCityCode   string    `json:"to_city_code"`
	DepartDate   time.Time `json:"depart_date"`
	ReturnDate   time.Time `json:"return_date"`
	IsRoundTrip  bool      `json:"is_round_trip"`
	CabinClass   string    `json:"cabin_class"`
	Passengers   int       `json:"passengers"`
}

type FlightPrice struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `gorm:"index" json:"created_at"`
	Platform       string    `gorm:"index;size:50" json:"platform"`
	PlatformName   string    `json:"platform_name"`
	FlightNo       string    `gorm:"index;size:20" json:"flight_no"`
	SharedFlightNo string    `gorm:"size:20" json:"shared_flight_no,omitempty"`
	Airline        string    `gorm:"size:50" json:"airline"`
	AircraftType   string    `gorm:"size:30" json:"aircraft_type"`
	FromCity       string    `gorm:"index;size:20" json:"from_city"`
	ToCity         string    `gorm:"index;size:20" json:"to_city"`
	FromCityCode   string    `gorm:"size:10" json:"from_city_code"`
	ToCityCode     string    `gorm:"size:10" json:"to_city_code"`
	DepartTime     time.Time `gorm:"index" json:"depart_time"`
	ArriveTime     time.Time `json:"arrive_time"`
	DepartTerminal string    `gorm:"size:10" json:"depart_terminal"`
	ArriveTerminal string    `gorm:"size:10" json:"arrive_terminal"`
	CabinClass     string    `gorm:"size:20" json:"cabin_class"`
	Price          float64   `gorm:"index" json:"price"`
	OriginalPrice  float64   `json:"original_price"`
	SeatsLeft      int       `json:"seats_left"`
	IsDirect       bool      `json:"is_direct"`
	TransferCity   string    `gorm:"size:20" json:"transfer_city,omitempty"`
	TransferCount  int       `json:"transfer_count"`
	DurationMin    int       `json:"duration_min"`
	URL            string    `gorm:"size:500" json:"url"`
	IsLowest       bool      `gorm:"index;default:false" json:"is_lowest"`
	PriceDropPct   float64   `json:"price_drop_pct"`
	QueryKey       string    `gorm:"index;size:100" json:"query_key"`
}

func (f *FlightPrice) GenerateQueryKey() string {
	return f.FromCityCode + "-" + f.ToCityCode + "-" + f.DepartTime.Format("2006-01-02")
}

func (f *FlightPrice) GetDedupKey() string {
	return f.Airline + "-" + f.DepartTime.Format("1504") + "-" + f.ArriveTime.Format("1504") + "-" + f.AircraftType
}

type FlightPriceHistory struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	SnapshotAt time.Time `gorm:"index" json:"snapshot_at"`
	QueryKey  string    `gorm:"index;size:100" json:"query_key"`
	FlightNo  string    `gorm:"size:20" json:"flight_no"`
	Platform  string    `gorm:"size:50" json:"platform"`
	LowPrice  float64   `json:"low_price"`
	AvgPrice  float64   `json:"avg_price"`
	HighPrice float64   `json:"high_price"`
	RecordCount int     `json:"record_count"`
}

type PriceComparison struct {
	QueryKey       string             `json:"query_key"`
	FlightKey      string             `json:"flight_key"`
	FlightNo       string             `json:"flight_no"`
	SharedFlights  []string           `json:"shared_flights"`
	FromCity       string             `json:"from_city"`
	ToCity         string             `json:"to_city"`
	DepartTime     time.Time          `json:"depart_time"`
	PlatformPrices map[string]float64 `json:"platform_prices"`
	LowestPrice    float64            `json:"lowest_price"`
	LowestPlatform string             `json:"lowest_platform"`
	HighestPrice   float64            `json:"highest_price"`
	PriceDiffPct   float64            `json:"price_diff_pct"`
}

func (p *PriceComparison) CalculateDiff() {
	if len(p.PlatformPrices) == 0 {
		return
	}
	lowest := -1.0
	highest := -1.0
	lowestPlatform := ""
	for platform, price := range p.PlatformPrices {
		if lowest < 0 || price < lowest {
			lowest = price
			lowestPlatform = platform
		}
		if highest < 0 || price > highest {
			highest = price
		}
	}
	p.LowestPrice = lowest
	p.LowestPlatform = lowestPlatform
	p.HighestPrice = highest
	if lowest > 0 && highest > 0 {
		p.PriceDiffPct = ((highest - lowest) / lowest) * 100
	}
}
