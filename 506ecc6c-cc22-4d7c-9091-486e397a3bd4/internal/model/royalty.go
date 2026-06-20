package model

import "time"

type RoyaltyRuleType string

const (
	RuleFixed   RoyaltyRuleType = "fixed"
	RuleTiered  RoyaltyRuleType = "tiered"
	RuleGuarantee RoyaltyRuleType = "guarantee"
)

type SettlementPeriod string

const (
	PeriodMonthly SettlementPeriod = "monthly"
	PeriodQuarter SettlementPeriod = "quarterly"
	PeriodYearly  SettlementPeriod = "yearly"
)

type SettlementStatus string

const (
	SettleDraft     SettlementStatus = "draft"
	SettlePending   SettlementStatus = "pending"
	SettleApproved  SettlementStatus = "approved"
	SettlePaid      SettlementStatus = "paid"
	SettleRejected  SettlementStatus = "rejected"
)

type Platform string

const (
	PlatformNetEase    Platform = "netease"
	PlatformQQMusic    Platform = "qqmusic"
	PlatformKugou      Platform = "kugou"
	PlatformKuwo       Platform = "kuwo"
	PlatformSpotify    Platform = "spotify"
	PlatformAppleMusic Platform = "apple_music"
)

var PlatformNames = map[Platform]string{
	PlatformNetEase:    "网易云音乐",
	PlatformQQMusic:    "QQ音乐",
	PlatformKugou:      "酷狗音乐",
	PlatformKuwo:       "酷我音乐",
	PlatformSpotify:    "Spotify",
	PlatformAppleMusic: "Apple Music",
}

type RoyaltyRule struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	WorkID         *string          `json:"work_id"`
	ArtistID       *string          `json:"artist_id"`
	ContributorRole ContributorRole  `json:"contributor_role"`
	RuleType       RoyaltyRuleType  `json:"rule_type"`
	FixedRate      *float64         `json:"fixed_rate"`
	TieredRates    []TieredRate     `json:"tiered_rates"`
	Guaranteed     *float64         `json:"guaranteed"`
	Period         SettlementPeriod `json:"period"`
	ValidFrom      *time.Time       `json:"valid_from"`
	ValidTo        *time.Time       `json:"valid_to"`
	CreatedAt      time.Time        `json:"created_at"`
}

type TieredRate struct {
	Threshold float64 `json:"threshold"`
	Rate      float64 `json:"rate"`
}

type PlatformData struct {
	ID          string    `json:"id"`
	WorkID      string    `json:"work_id"`
	Platform    Platform  `json:"platform"`
	DataDate    string    `json:"data_date"`
	PlayCount   int64     `json:"play_count"`
	DownloadCount int64   `json:"download_count"`
	FavoriteCount int64   `json:"favorite_count"`
	ShareCount  int64     `json:"share_count"`
	CommentCount int64    `json:"comment_count"`
	Revenue     float64   `json:"revenue"`
	UnitPrice   float64   `json:"unit_price"`
	CreatedAt   time.Time `json:"created_at"`
}

type Settlement struct {
	ID              string            `json:"id"`
	Period          SettlementPeriod  `json:"period"`
	PeriodStart     time.Time         `json:"period_start"`
	PeriodEnd       time.Time         `json:"period_end"`
	ArtistID        string            `json:"artist_id"`
	ArtistName      string            `json:"artist_name"`
	Brand           Brand             `json:"brand"`
	TotalRevenue    float64           `json:"total_revenue"`
	PlatformBreakdown map[Platform]float64 `json:"platform_breakdown"`
	WorkBreakdown   map[string]float64 `json:"work_breakdown"`
	ContributorBreakdown map[string]float64 `json:"contributor_breakdown"`
	Status          SettlementStatus  `json:"status"`
	Details         []SettlementDetail `json:"details,omitempty"`
	Remark          string            `json:"remark"`
	CreatedAt       time.Time         `json:"created_at"`
	ApprovedAt      *time.Time        `json:"approved_at"`
	PaidAt          *time.Time        `json:"paid_at"`
}

type SettlementDetail struct {
	ID               string          `json:"id"`
	SettlementID     string          `json:"settlement_id"`
	WorkID           string          `json:"work_id"`
	WorkTitle        string          `json:"work_title"`
	Platform         Platform        `json:"platform"`
	ContributorID    string          `json:"contributor_id"`
	ContributorName  string          `json:"contributor_name"`
	ContributorRole  ContributorRole `json:"contributor_role"`
	TotalRevenue     float64         `json:"total_revenue"`
	PlatformRevenue  float64         `json:"platform_revenue"`
	ContributorShare float64         `json:"contributor_share"`
	ShareRate        float64         `json:"share_rate"`
	RuleType         RoyaltyRuleType `json:"rule_type"`
}

type DashboardSummary struct {
	PeriodRange      [2]time.Time          `json:"period_range"`
	TotalRevenue     float64               `json:"total_revenue"`
	RevenueTrend     []DailyRevenue        `json:"revenue_trend"`
	PlayRanking      []WorkRanking         `json:"play_ranking"`
	PlatformShare    []PlatformShareItem   `json:"platform_share"`
	ArtistRanking    []ArtistRankingItem   `json:"artist_ranking"`
	ReleaseStats     ReleaseStats          `json:"release_stats"`
}

type DailyRevenue struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
}

type WorkRanking struct {
	Rank      int     `json:"rank"`
	WorkID    string  `json:"work_id"`
	WorkTitle string  `json:"work_title"`
	PlayCount int64   `json:"play_count"`
	Revenue   float64 `json:"revenue"`
}

type PlatformShareItem struct {
	Platform Platform `json:"platform"`
	Name     string   `json:"name"`
	Revenue  float64  `json:"revenue"`
	Share    float64  `json:"share"`
}

type ArtistRankingItem struct {
	Rank        int     `json:"rank"`
	ArtistID    string  `json:"artist_id"`
	ArtistName  string  `json:"artist_name"`
	Revenue     float64 `json:"revenue"`
	PlayCount   int64   `json:"play_count"`
}

type ReleaseStats struct {
	AlbumCount  int `json:"album_count"`
	SingleCount int `json:"single_count"`
	EPCount     int `json:"ep_count"`
	TotalCount  int `json:"total_count"`
}
