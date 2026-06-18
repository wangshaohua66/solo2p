package model

import "time"

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type Point struct {
	Type        string    `json:"type" bson:"type"`
	Coordinates []float64 `json:"coordinates" bson:"coordinates"`
}

func NewPoint(lng, lat float64) Point {
	return Point{
		Type:        "Point",
		Coordinates: []float64{lng, lat},
	}
}

type Polygon struct {
	Type         string        `json:"type" bson:"type"`
	Coordinates  [][][]float64 `json:"coordinates" bson:"coordinates"`
}

type TimeRangeQuery struct {
	StartTime time.Time `json:"start_time" form:"start_time" query:"start_time"`
	EndTime   time.Time `json:"end_time" form:"end_time" query:"end_time"`
}

type PaginationQuery struct {
	Page     int64 `json:"page" form:"page" query:"page"`
	PageSize int64 `json:"page_size" form:"page_size" query:"page_size"`
}

type PaginationResult struct {
	Total    int64       `json:"total"`
	Page     int64       `json:"page"`
	PageSize int64       `json:"page_size"`
	List     interface{} `json:"list"`
}

const (
	ErrCodeSuccess       = 0
	ErrCodeParamInvalid  = 10001
	ErrCodeNotFound      = 10002
	ErrCodeSystemError   = 10003
	ErrCodeQuotaExceeded = 20001
	ErrCodeQuotaLocked   = 20002
	ErrCodeTradeConflict = 30001
	ErrCodeSupplyShort   = 40001
	ErrCodeForbiddenZone = 50001
)
