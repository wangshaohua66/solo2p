package models

import (
	"time"
)

type GrainType string

const (
	Wheat  GrainType = "wheat"
	Rice   GrainType = "rice"
	Corn   GrainType = "corn"
	Soybean GrainType = "soybean"
)

var GrainNames = map[GrainType]string{
	Wheat:   "小麦",
	Rice:    "稻谷",
	Corn:    "玉米",
	Soybean: "大豆",
}

type PriceType string

const (
	FuturesPrice PriceType = "futures"
	SpotPrice    PriceType = "spot"
)

type MarketSnapshot struct {
	ID         int64     `json:"id"`
	SiteID     string    `json:"site_id"`
	GrainType  GrainType `json:"grain_type"`
	PriceType  PriceType `json:"price_type"`
	Price      float64   `json:"price"`
	PrevPrice  float64   `json:"prev_price"`
	Change     float64   `json:"change"`
	ChangePct  float64   `json:"change_pct"`
	HighPrice  float64   `json:"high_price"`
	LowPrice   float64   `json:"low_price"`
	OpenPrice  float64   `json:"open_price"`
	ClosePrice float64   `json:"close_price"`
	Volume     float64   `json:"volume"`
	Unit       string    `json:"unit"`
	Contract   string    `json:"contract"`
	Timestamp  time.Time `json:"timestamp"`
	IsSuspicious bool    `json:"is_suspicious"`
	SuspiciousReason string `json:"suspicious_reason"`
	HasMissingFields bool   `json:"has_missing_fields"`
	MissingFields []string `json:"missing_fields"`
}

type SiteConfig struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	BaseURL           string             `json:"base_url"`
	LoginURL          string             `json:"login_url"`
	RequiresLogin     bool               `json:"requires_login"`
	Username          string             `json:"username"`
	Password          string             `json:"password"`
	UsernameSelector  string             `json:"username_selector"`
	PasswordSelector  string             `json:"password_selector"`
	SubmitSelector    string             `json:"submit_selector"`
	LoginCheckSelector string            `json:"login_check_selector"`
	PageConfigs       map[string]PageConfig `json:"page_configs"`
	CollectInterval   int                `json:"collect_interval"`
	TimeoutSeconds    int                `json:"timeout_seconds"`
	MaxRetries        int                `json:"max_retries"`
	Enabled           bool               `json:"enabled"`
}

type PageConfig struct {
	URL             string            `json:"url"`
	WaitSelector    string            `json:"wait_selector"`
	WaitType        string            `json:"wait_type"`
	UseIframe       bool              `json:"use_iframe"`
	IframeSelector  string            `json:"iframe_selector"`
	NeedScroll      bool              `json:"need_scroll"`
	ScrollSelector  string            `json:"scroll_selector"`
	PopupSelectors  []string          `json:"popup_selectors"`
	DataSelectors   map[string]string `json:"data_selectors"`
	IsPolicyPage    bool              `json:"is_policy_page"`
	PolicyKeywords  []string          `json:"policy_keywords"`
}

type TaskLog struct {
	ID           int64     `json:"id"`
	TaskID       string    `json:"task_id"`
	SiteID       string    `json:"site_id"`
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	DurationMs   int64     `json:"duration_ms"`
	Status       string    `json:"status"`
	HTTPStatus   int       `json:"http_status"`
	FieldsCount  int       `json:"fields_count"`
	TotalFields  int       `json:"total_fields"`
	Completeness float64   `json:"completeness"`
	RetryCount   int       `json:"retry_count"`
	ErrorMessage string    `json:"error_message"`
	SnapshotCount int      `json:"snapshot_count"`
}

type AlertRule struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`
	GrainType       GrainType `json:"grain_type"`
	PriceType       PriceType `json:"price_type"`
	Threshold       float64   `json:"threshold"`
	Direction       string    `json:"direction"`
	Enabled         bool      `json:"enabled"`
}

type AlertRecord struct {
	ID           int64     `json:"id"`
	AlertID      string    `json:"alert_id"`
	AlertType    string    `json:"alert_type"`
	SiteID       string    `json:"site_id"`
	GrainType    GrainType `json:"grain_type"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	Price        float64   `json:"price"`
	ChangePct    float64   `json:"change_pct"`
	AlertTime    time.Time `json:"alert_time"`
	Notified     bool      `json:"notified"`
	NotifyMethod string    `json:"notify_method"`
}

type BrowserPoolStats struct {
	Total     int `json:"total"`
	InUse     int `json:"in_use"`
	Available int `json:"available"`
}

type SchedulerStatus struct {
	Running      bool      `json:"running"`
	TaskCount    int       `json:"task_count"`
	NextRunTime  time.Time `json:"next_run_time"`
	LastRunTime  time.Time `json:"last_run_time"`
	ActiveTasks  int       `json:"active_tasks"`
}

type DailyReport struct {
	Date       time.Time           `json:"date"`
	Varieties  []VarietyReport     `json:"varieties"`
	GeneratedAt time.Time          `json:"generated_at"`
}

type VarietyReport struct {
	GrainType GrainType       `json:"grain_type"`
	Sites     []SitePriceData `json:"sites"`
	AvgPrice  float64         `json:"avg_price"`
	HighPrice float64         `json:"high_price"`
	LowPrice  float64         `json:"low_price"`
	TotalVolume float64       `json:"total_volume"`
	DayChange  float64        `json:"day_change"`
}

type SitePriceData struct {
	SiteID   string  `json:"site_id"`
	SiteName string  `json:"site_name"`
	Price    float64 `json:"price"`
	Volume   float64 `json:"volume"`
	Change   float64 `json:"change"`
	ChangePct float64 `json:"change_pct"`
}

type CollectorResult struct {
	SiteID       string
	Success      bool
	Snapshots    []MarketSnapshot
	DurationMs   int64
	FieldsCount  int
	TotalFields  int
	RetryCount   int
	ErrorMessage string
	PolicyItems  []PolicyItem
}

type PolicyItem struct {
	Title    string
	URL      string
	Date     time.Time
	Keywords []string
}
