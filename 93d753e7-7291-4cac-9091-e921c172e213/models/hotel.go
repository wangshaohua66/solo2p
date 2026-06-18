package models

import (
	"time"
)

type HotelQuery struct {
	City        string    `json:"city"`
	CityCode    string    `json:"city_code"`
	CheckInDate time.Time `json:"check_in_date"`
	CheckOutDate time.Time `json:"check_out_date"`
	StarRating  int       `json:"star_rating"`
	Brand       string    `json:"brand"`
	Keyword     string    `json:"keyword"`
	MinPrice    float64   `json:"min_price"`
	MaxPrice    float64   `json:"max_price"`
	PageSize    int       `json:"page_size"`
	PageNo      int       `json:"page_no"`
}

type HotelPrice struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `gorm:"index" json:"created_at"`
	Platform        string    `gorm:"index;size:50" json:"platform"`
	PlatformName    string    `json:"platform_name"`
	HotelID        string    `gorm:"size:50" json:"hotel_id"`
	HotelName      string    `gorm:"size:200" json:"hotel_name"`
	HotelNameEn    string    `gorm:"size:200" json:"hotel_name_en"`
	City           string    `gorm:"index;size:50" json:"city"`
	Address        string    `gorm:"size:500" json:"address"`
	StarRating     int       `json:"star_rating"`
	Brand          string    `gorm:"size:50" json:"brand"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	RoomTypeID     string    `gorm:"size:50" json:"room_type_id"`
	RoomTypeName   string    `gorm:"size:100" json:"room_type_name"`
	BedType        string    `gorm:"size:50" json:"bed_type"`
	RoomSize       int       `json:"room_size"`
	MaxGuests       int       `json:"max_guests"`
	HasBreakfast   bool      `json:"has_breakfast"`
	BreakfastType   string    `gorm:"size:50" json:"breakfast_type"`
	CancelPolicy   string    `gorm:"size:200" json:"cancel_policy"`
	CheckInDate   time.Time `json:"check_in_date"`
	CheckOutDate  time.Time `json:"check_out_date"`
	Price          float64   `gorm:"index" json:"price"`
	OriginalPrice  float64   `json:"original_price"`
	TotalPrice     float64   `json:"total_price"`
	Currency       string    `gorm:"size:10" json:"currency"`
	RoomLeft         int       `json:"rooms_left"`
	URL            string    `gorm:"size:500" json:"url"`
	QueryKey       string    `gorm:"index;size:100" json:"query_key"`
	IsLowest       bool      `gorm:"index;default:false" json:"is_lowest"`
	PriceDropPct   float64   `json:"price_drop_pct"`
}

func (h *HotelPrice) GenerateQueryKey() string {
	return h.City + "-" + h.CheckInDate.Format("2006-01-02") + "-" + h.CheckOutDate.Format("2006-01-02")
}

func (h *HotelPrice) GetDedupKey() string {
	return h.HotelName + "-" + h.RoomTypeName + "-" + h.BedType
}

type HotelPriceHistory struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SnapshotAt  time.Time `gorm:"index" json:"snapshot_at"`
	QueryKey    string    `gorm:"index;size:100" json:"query_key"`
	HotelID     string    `gorm:"size:50" json:"hotel_id"`
	HotelName   string    `gorm:"size:200" json:"hotel_name"`
	Platform    string    `gorm:"size:50" json:"platform"`
	LowPrice    float64   `json:"low_price"`
	AvgPrice    float64   `json:"avg_price"`
	HighPrice   float64   `json:"high_price"`
	RecordCount int     `json:"record_count"`
}

type HotelComparison struct {
	QueryKey       string             `json:"query_key"`
	HotelDedupKey   string             `json:"hotel_dedup_key"`
	HotelName      string             `json:"hotel_name"`
	City            string             `json:"city"`
	RoomTypeName   string             `json:"room_type_name"`
	CheckInDate     time.Time          `json:"check_in_date"`
	CheckOutDate time.Time          `json:"check_out_date"`
	PlatformPrices map[string]float64 `json:"platform_prices"`
	LowestPrice    float64            `json:"lowest_price"`
	LowestPlatform string             `json:"lowest_platform"`
	HighestPrice   float64            `json:"highest_price"`
	PriceDiffPct   float64            `json:"price_diff_pct"`
}

func (h *HotelComparison) CalculateDiff() {
	if len(h.PlatformPrices) == 0 {
		return
	}
	lowest := -1.0
	highest := -1.0
	lowestPlatform := ""
	for platform, price := range h.PlatformPrices {
		if lowest < 0 || price < lowest {
			lowest = price
			lowestPlatform = platform
		}
		if highest < 0 || price > highest {
			highest = price
		}
	}
	h.LowestPrice = lowest
	h.LowestPlatform = lowestPlatform
	h.HighestPrice = highest
	if lowest > 0 && highest > 0 {
		h.PriceDiffPct = ((highest - lowest) / lowest) * 100
	}
}

type PricePrediction struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	QueryKey     string    `gorm:"index;size:100" json:"query_key"`
	ItemType     string    `gorm:"size:20" json:"item_type"`
	CurrentPrice float64   `json:"current_price"`
	PredictedPrice float64 `json:"predicted_price"`
	Trend         string    `gorm:"size:20" json:"trend"`
	Confidence   float64   `json:"confidence"`
	BestBuyDate   time.Time `json:"best_buy_date"`
	TrendData    []float64 `gorm:"-" json:"trend_data"`
}
