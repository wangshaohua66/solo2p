package model

import "time"

const (
	TradeStatusPending   = "pending"
	TradeStatusConfirmed = "confirmed"
	TradeStatusRejected  = "rejected"
	TradeStatusSettled   = "settled"
)

type SeaTrade struct {
	ID              string    `json:"id" bson:"_id"`
	TradeNo         string    `json:"trade_no" bson:"trade_no"`
	SellerVesselID  string    `json:"seller_vessel_id" bson:"seller_vessel_id"`
	SellerVesselNo  string    `json:"seller_vessel_no" bson:"seller_vessel_no"`
	BuyerVesselID   string    `json:"buyer_vessel_id" bson:"buyer_vessel_id"`
	BuyerVesselNo   string    `json:"buyer_vessel_no" bson:"buyer_vessel_no"`
	SpeciesCode     string    `json:"species_code" bson:"species_code"`
	SpeciesName     string    `json:"species_name" bson:"species_name"`
	Weight          float64   `json:"weight" bson:"weight"`
	UnitPrice       float64   `json:"unit_price" bson:"unit_price"`
	TotalAmount     float64   `json:"total_amount" bson:"total_amount"`
	TradeLocation   Point     `json:"trade_location" bson:"trade_location"`
	TradeTime       time.Time `json:"trade_time" bson:"trade_time"`
	Status          string    `json:"status" bson:"status"`
	SellerConfirmed bool      `json:"seller_confirmed" bson:"seller_confirmed"`
	BuyerConfirmed  bool      `json:"buyer_confirmed" bson:"buyer_confirmed"`
	ConfirmedAt     time.Time `json:"confirmed_at,omitempty" bson:"confirmed_at,omitempty"`
	SettlementMonth string    `json:"settlement_month" bson:"settlement_month"`
	Settled         bool      `json:"settled" bson:"settled"`
	SettledAt       time.Time `json:"settled_at,omitempty" bson:"settled_at,omitempty"`
	Remark          string    `json:"remark,omitempty" bson:"remark,omitempty"`
	CreatedAt       time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" bson:"updated_at"`
}

type MonthlySettlement struct {
	ID                string     `json:"id" bson:"_id"`
	SettlementMonth   string     `json:"settlement_month" bson:"settlement_month"`
	VesselID          string     `json:"vessel_id" bson:"vessel_id"`
	VesselNo          string     `json:"vessel_no" bson:"vessel_no"`
	TotalSalesWeight  float64    `json:"total_sales_weight" bson:"total_sales_weight"`
	TotalSalesAmount  float64    `json:"total_sales_amount" bson:"total_sales_amount"`
	SalesCount        int        `json:"sales_count" bson:"sales_count"`
	SalesTradeIDs     []string   `json:"sales_trade_ids" bson:"sales_trade_ids"`
	TotalPurchaseWeight float64  `json:"total_purchase_weight" bson:"total_purchase_weight"`
	TotalPurchaseAmount float64  `json:"total_purchase_amount" bson:"total_purchase_amount"`
	PurchaseCount     int        `json:"purchase_count" bson:"purchase_count"`
	PurchaseTradeIDs  []string   `json:"purchase_trade_ids" bson:"purchase_trade_ids"`
	NetAmount         float64    `json:"net_amount" bson:"net_amount"`
	Status            string     `json:"status" bson:"status"`
	CreatedAt         time.Time  `json:"created_at" bson:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" bson:"updated_at"`
}

type TradeDispute struct {
	ID          string    `json:"id" bson:"_id"`
	TradeID     string    `json:"trade_id" bson:"trade_id"`
	TradeNo     string    `json:"trade_no" bson:"trade_no"`
	RaisedBy    string    `json:"raised_by" bson:"raised_by"`
	RaiserRole  string    `json:"raiser_role" bson:"raiser_role"`
	Reason      string    `json:"reason" bson:"reason"`
	Status      string    `json:"status" bson:"status"`
	Resolution  string    `json:"resolution,omitempty" bson:"resolution,omitempty"`
	ResolvedBy  string    `json:"resolved_by,omitempty" bson:"resolved_by,omitempty"`
	ResolvedAt  time.Time `json:"resolved_at,omitempty" bson:"resolved_at,omitempty"`
	CreatedAt   time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" bson:"updated_at"`
}
