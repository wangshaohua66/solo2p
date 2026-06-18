package model

import (
	"errors"
	"time"
)

func ValidateCoordinates(lng, lat float64) error {
	if lng != 0 || lat != 0 {
		if lng < -180 || lng > 180 {
			return errors.New("longitude must be between -180 and 180")
		}
		if lat < -90 || lat > 90 {
			return errors.New("latitude must be between -90 and 90")
		}
	}
	return nil
}

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
