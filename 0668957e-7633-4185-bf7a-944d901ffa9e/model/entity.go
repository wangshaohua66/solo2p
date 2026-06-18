package model

import "time"

type UserRole string

const (
	RoleStreamer  UserRole = "streamer"
	RoleBidder    UserRole = "bidder"
	RoleOperator  UserRole = "operator"
)

type User struct {
	UserID   string   `json:"user_id"`
	Username string   `json:"username"`
	Role     UserRole `json:"role"`
}

type AuctionStatus string

const (
	AuctionStatusActive   AuctionStatus = "active"
	AuctionStatusSold     AuctionStatus = "sold"
	AuctionStatusUnsold   AuctionStatus = "unsold"
	AuctionStatusCanceled AuctionStatus = "canceled"
)

type Auction struct {
	AuctionID      string        `json:"auction_id"`
	StreamerID     string        `json:"streamer_id"`
	ItemName       string        `json:"item_name"`
	StartPrice     float64       `json:"start_price"`
	MinIncrement   float64       `json:"min_increment"`
	Duration       int           `json:"duration"`
	StartTime      time.Time     `json:"start_time"`
	EndTime        time.Time     `json:"end_time"`
	Status         AuctionStatus `json:"status"`
	CurrentPrice   float64       `json:"current_price,omitempty"`
	HighestBidder  string        `json:"highest_bidder,omitempty"`
}

type CreateAuctionRequest struct {
	ItemName     string  `json:"item_name" validate:"required,min=1,max=200"`
	StartPrice   float64 `json:"start_price" validate:"required,gt=0"`
	MinIncrement float64 `json:"min_increment" validate:"required,gt=0"`
	Duration     int     `json:"duration" validate:"required,gte=1,lte=300"`
}

type Bid struct {
	BidID     string    `json:"bid_id"`
	AuctionID string    `json:"auction_id"`
	UserID    string    `json:"user_id"`
	Price     float64   `json:"price"`
	Timestamp time.Time `json:"timestamp"`
	Withdrawn bool      `json:"withdrawn"`
}

type PlaceBidRequest struct {
	AuctionID string  `json:"auction_id" validate:"required"`
	Price     float64 `json:"price" validate:"required,gt=0"`
}

type WithdrawBidRequest struct {
	AuctionID string `json:"auction_id" validate:"required"`
}

type BidRankItem struct {
	UserID    string  `json:"user_id"`
	Username  string  `json:"username,omitempty"`
	Price     float64 `json:"price"`
	Rank      int     `json:"rank"`
}

type AuditLog struct {
	LogID       string    `json:"log_id"`
	AuctionID   string    `json:"auction_id"`
	UserID      string    `json:"user_id"`
	Action      string    `json:"action"`
	Price       float64   `json:"price,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
	IP          string    `json:"ip,omitempty"`
	UserAgent   string    `json:"user_agent,omitempty"`
	Description string    `json:"description,omitempty"`
}

type AuctionResultEvent struct {
	AuctionID    string        `json:"auction_id"`
	Status       AuctionStatus `json:"status"`
	WinnerID     string        `json:"winner_id,omitempty"`
	FinalPrice   float64       `json:"final_price,omitempty"`
	CompletedAt  time.Time     `json:"completed_at"`
	TriggeredBy  string        `json:"triggered_by"`
}

type JWTClaims struct {
	UserID   string   `json:"user_id"`
	Username string   `json:"username"`
	Role     UserRole `json:"role"`
}
