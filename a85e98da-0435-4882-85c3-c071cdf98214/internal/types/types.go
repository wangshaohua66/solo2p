package types

import (
	"time"
)

type Notice struct {
	ID           string    `json:"id"`
	CaseNo       string    `json:"case_no"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	URL          string    `json:"url"`
	CourtID      string    `json:"court_id"`
	CourtName    string    `json:"court_name"`
	Parties      []string  `json:"parties"`
	Lawyers      []string  `json:"lawyers"`
	Judges       []string  `json:"judges"`
	CourtRoom    string    `json:"court_room"`
	HearingTime  time.Time `json:"hearing_time"`
	PublishTime  time.Time `json:"publish_time"`
	NoticeType   string    `json:"notice_type"`
	CauseOfAction string   `json:"cause_of_action"`
	FirstSeen    time.Time `json:"first_seen"`
	LastUpdated  time.Time `json:"last_updated"`
	Silenced     bool      `json:"silenced"`
	RawHTML      string    `json:"-"`
}

type CourtSource struct {
	ID             string        `yaml:"id"`
	Name           string        `yaml:"name"`
	URLs           URLs          `yaml:"urls"`
	RequiresLogin  bool          `yaml:"requires_login"`
	AntiCrawlLevel int           `yaml:"anti_crawl_level"`
	LoginConfig    *LoginConfig  `yaml:"login,omitempty"`
	CaptchaConfig  *CaptchaConfig `yaml:"captcha,omitempty"`
	Pagination     *Pagination   `yaml:"pagination,omitempty"`
	Parser         ParserRule    `yaml:"parser"`
	Schedule       ScheduleConfig `yaml:"schedule"`
	Cookies        []byte        `yaml:"-"`
	HealthScore    float64       `yaml:"-"`
	Failures       int           `yaml:"-"`
	LastSuccess    time.Time     `yaml:"-"`
	LastFailure    time.Time     `yaml:"-"`
	UseBackupURL   bool          `yaml:"-"`
}

type URLs struct {
	Primary string `yaml:"primary"`
	Backup  string `yaml:"backup"`
}

type LoginConfig struct {
	URL              string `yaml:"url"`
	UsernameSelector string `yaml:"username_selector"`
	PasswordSelector string `yaml:"password_selector"`
	SubmitSelector   string `yaml:"submit_selector"`
}

type CaptchaConfig struct {
	Type     string `yaml:"type"`
	Selector string `yaml:"selector"`
	Fallback string `yaml:"fallback"`
}

type Pagination struct {
	Type     string `yaml:"type"`
	Param    string `yaml:"param"`
	MaxPages int    `yaml:"max_pages"`
}

type ParserRule struct {
	ListSelector      string `yaml:"list_selector"`
	TitleSelector     string `yaml:"title_selector"`
	CaseNoSelector    string `yaml:"case_no_selector"`
	DateSelector      string `yaml:"date_selector"`
	CourtRoomSelector string `yaml:"court_room_selector"`
	JudgeSelector     string `yaml:"judge_selector"`
	ContentSelector   string `yaml:"content_selector"`
	LinkAttr          string `yaml:"link_attr"`
}

type ScheduleConfig struct {
	Priority int           `yaml:"priority"`
	Interval time.Duration `yaml:"interval"`
}

type Subscription struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	CaseNo      string   `json:"case_no,omitempty"`
	Parties     []string `json:"parties,omitempty"`
	CourtID     string   `json:"court_id,omitempty"`
	CauseOfAction string `json:"cause_of_action,omitempty"`
	Mode        string   `json:"mode"`
	CreatedAt   time.Time `json:"created_at"`
	LastMatched time.Time `json:"last_matched,omitempty"`
	MatchCount  int       `json:"match_count"`
}

type Cursor struct {
	CourtID     string    `json:"court_id"`
	LastURL     string    `json:"last_url"`
	LastCaseNo  string    `json:"last_case_no"`
	LastUpdate  time.Time `json:"last_update"`
	Page        int       `json:"page"`
}

type GlobalConfig struct {
	MaxParallel   int           `yaml:"max_parallel"`
	PageTimeout   time.Duration `yaml:"page_timeout"`
	DBPath        string        `yaml:"db_path"`
	LogPath       string        `yaml:"log_path"`
	WorkingHours  WorkingHours  `yaml:"working_hours"`
	NightInterval time.Duration `yaml:"night_interval"`
	DayInterval   time.Duration `yaml:"day_interval"`
	MaxFailures   int           `yaml:"max_failures"`
	ZstdLevel     int           `yaml:"zstd_level"`
}

type WorkingHours struct {
	Start int `yaml:"start"`
	End   int `yaml:"end"`
}

type FeishuConfig struct {
	WebhookURL     string `yaml:"webhook_url"`
	Secret         string `yaml:"secret"`
	DailySummaryHour int `yaml:"daily_summary_hour"`
}

type AppConfig struct {
	Global GlobalConfig  `yaml:"global"`
	Feishu FeishuConfig  `yaml:"feishu"`
	Courts []CourtSource `yaml:"courts"`
}

type TimelineEntry struct {
	Date        time.Time `json:"date"`
	Court       string    `json:"court"`
	CaseNo      string    `json:"case_no"`
	Title       string    `json:"title"`
	Type        string    `json:"type"`
	URL         string    `json:"url"`
}

type LitigationTimeline struct {
	EntityName string                 `json:"entity_name"`
	EntityType string                 `json:"entity_type"`
	TotalCases int                    `json:"total_cases"`
	Entries    []TimelineEntry        `json:"entries"`
	Heatmap    map[string]int         `json:"heatmap"`
	ByCourt    map[string]int         `json:"by_court"`
	ByYear     map[int]int            `json:"by_year"`
}

type MatchResult struct {
	NoticeID      string         `json:"notice_id"`
	CaseNo        string         `json:"case_no"`
	Subscription  *Subscription  `json:"subscription"`
	MatchedFields []string       `json:"matched_fields"`
}
