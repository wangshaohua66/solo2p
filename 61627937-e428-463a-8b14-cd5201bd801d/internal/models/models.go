package models

import "time"

type WorkType string

const (
	WorkTypeText     WorkType = "text"
	WorkTypeAudio    WorkType = "audio"
	WorkTypeVideo    WorkType = "video"
	WorkTypeFineArt  WorkType = "fine_art"
	WorkTypeSoftware WorkType = "software"
)

type PlatformType string

const (
	PlatformNews   PlatformType = "news"
	PlatformVideo  PlatformType = "video"
	PlatformMusic  PlatformType = "music"
)

type Priority int

const (
	PriorityLow    Priority = 1
	PriorityMedium Priority = 2
	PriorityHigh   Priority = 3
	PriorityUrgent Priority = 4
)

type CopyrightWork struct {
	ID              int64     `json:"id"`
	Title           string    `json:"title"`
	WorkType        WorkType  `json:"work_type"`
	Owner           string    `json:"owner"`
	OwnerContact    string    `json:"owner_contact"`
	RegistrationNo  string    `json:"registration_no"`
	CompletionDate  time.Time `json:"completion_date"`
	RegistrationDate time.Time `json:"registration_date"`
	Fingerprint     uint64    `json:"fingerprint"`
	ContentHash     string    `json:"content_hash"`
	Description     string    `json:"description"`
	IsHot           bool      `json:"is_hot"`
	InfringementCount int     `json:"infringement_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type PlatformSource struct {
	ID             int64        `json:"id"`
	Name           string       `json:"name"`
	Type           PlatformType `json:"type"`
	BaseURL        string       `json:"base_url"`
	ListURLPattern string       `json:"list_url_pattern"`
	ListSelector   string       `json:"list_selector"`
	DetailSelector string       `json:"detail_selector"`
	TitleSelector  string       `json:"title_selector"`
	ContentSelector string      `json:"content_selector"`
	RequestDelay   int          `json:"request_delay"`
	MaxConcurrency int          `json:"max_concurrency"`
	Enabled        bool         `json:"enabled"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

type MonitorTask struct {
	ID            int64     `json:"id"`
	WorkID        int64     `json:"work_id"`
	WorkTitle     string    `json:"work_title"`
	WorkType      WorkType  `json:"work_type"`
	Priority      Priority  `json:"priority"`
	PlatformIDs   []int64   `json:"platform_ids"`
	CronExpr      string    `json:"cron_expr"`
	LastRunTime   time.Time `json:"last_run_time"`
	NextRunTime   time.Time `json:"next_run_time"`
	Status        string    `json:"status"`
	FailureCount  int       `json:"failure_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type CrawledContent struct {
	ID            int64     `json:"id"`
	PlatformID    int64     `json:"platform_id"`
	PlatformName  string    `json:"platform_name"`
	URL           string    `json:"url"`
	Title         string    `json:"title"`
	Content       string    `json:"content"`
	Author        string    `json:"author"`
	PublishTime   time.Time `json:"publish_time"`
	CrawlTime     time.Time `json:"crawl_time"`
	Fingerprint   uint64    `json:"fingerprint"`
	RawHTML       string    `json:"raw_html"`
	HTTPHeaders   string    `json:"http_headers"`
	Status        string    `json:"status"`
}

type InfringementClue struct {
	ID               int64     `json:"id"`
	TaskID           int64     `json:"task_id"`
	WorkID           int64     `json:"work_id"`
	WorkTitle        string    `json:"work_title"`
	WorkType         WorkType  `json:"work_type"`
	Owner            string    `json:"owner"`
	OwnerContact     string    `json:"owner_contact"`
	RegistrationNo   string    `json:"registration_no"`
	PlatformName     string    `json:"platform_name"`
	InfringementURL  string    `json:"infringement_url"`
	InfringementTitle string   `json:"infringement_title"`
	Similarity       float64   `json:"similarity"`
	EvidenceID       int64     `json:"evidence_id"`
	DiscoverTime     time.Time `json:"discover_time"`
	Status           string    `json:"status"`
	ReportBatchNo    string    `json:"report_batch_no"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type Evidence struct {
	ID             int64     `json:"id"`
	ClueID         int64     `json:"clue_id"`
	URL            string    `json:"url"`
	ScreenshotBase64 string   `json:"screenshot_base64"`
	RawHTML        string    `json:"raw_html"`
	HTTPHeaders    string    `json:"http_headers"`
	CrawlTime      time.Time `json:"crawl_time"`
	EvidenceHash   string    `json:"evidence_hash"`
	ReportPath     string    `json:"report_path"`
	CreatedAt      time.Time `json:"created_at"`
}

type MonitorLog struct {
	ID          int64     `json:"id"`
	TaskID      int64     `json:"task_id"`
	PlatformID  int64     `json:"platform_id"`
	PlatformName string   `json:"platform_name"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Status      string    `json:"status"`
	ItemsFound  int       `json:"items_found"`
	InfringementsFound int `json:"infringements_found"`
	ErrorMessage string   `json:"error_message"`
	CreatedAt   time.Time `json:"created_at"`
}

type SystemStatus struct {
	ActiveTasks      int              `json:"active_tasks"`
	PendingClues     int              `json:"pending_clues"`
	PlatformStats    []*PlatformStat  `json:"platform_stats"`
	RecentInfringements []*InfringementClue `json:"recent_infringements"`
	TotalWorks       int              `json:"total_works"`
	TotalPlatforms   int              `json:"total_platforms"`
}

type PlatformStat struct {
	PlatformID   int64   `json:"platform_id"`
	PlatformName string  `json:"platform_name"`
	SuccessRate  float64 `json:"success_rate"`
	TotalRuns    int     `json:"total_runs"`
	FailedRuns   int     `json:"failed_runs"`
}

type EvidenceReport struct {
	ReportID    string              `json:"report_id"`
	GeneratedAt time.Time           `json:"generated_at"`
	ClueCount   int                 `json:"clue_count"`
	Clues       []*InfringementClue `json:"clues"`
}
