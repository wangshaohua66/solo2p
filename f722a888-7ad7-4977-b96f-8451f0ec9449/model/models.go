package model

import (
	"crypto/md5"
	"encoding/hex"
	"time"
)

type AnnounceType string

const (
	TypeConstruction  AnnounceType = "construction"
	TypeService       AnnounceType = "service"
	TypeGoods         AnnounceType = "goods"
	TypeLand          AnnounceType = "land"
	TypeProperty      AnnounceType = "property"
	TypeOther         AnnounceType = "other"
)

type AnnounceStatus string

const (
	StatusNew         AnnounceStatus = "new"
	StatusPublished   AnnounceStatus = "published"
	StatusClosed      AnnounceStatus = "closed"
	StatusArchived    AnnounceStatus = "archived"
)

type Announcement struct {
	ID              int64         `json:"id" db:"id"`
	URLHash         string        `json:"url_hash" db:"url_hash"`
	URL             string        `json:"url" db:"url"`
	SiteID          string        `json:"site_id" db:"site_id"`
	SiteName        string        `json:"site_name" db:"site_name"`
	Category        AnnounceType  `json:"category" db:"category"`
	Title           string        `json:"title" db:"title"`
	ProjectNumber   string        `json:"project_number" db:"project_number"`
	Budget          string        `json:"budget" db:"budget"`
	BudgetAmount    float64       `json:"budget_amount" db:"budget_amount"`
	PublishDate     string        `json:"publish_date" db:"publish_date"`
	PublishTime     time.Time     `json:"publish_time" db:"publish_time"`
	Deadline        string        `json:"deadline" db:"deadline"`
	DeadlineTime    time.Time     `json:"deadline_time" db:"deadline_time"`
	Tenderer        string        `json:"tenderer" db:"tenderer"`
	ContactPerson   string        `json:"contact_person" db:"contact_person"`
	ContactPhone    string        `json:"contact_phone" db:"contact_phone"`
	Requirements    string        `json:"requirements" db:"requirements"`
	Qualifications  string        `json:"qualifications" db:"qualifications"`
	DocPrice        string        `json:"doc_price" db:"doc_price"`
	BidOpenInfo     string        `json:"bid_open_info" db:"bid_open_info"`
	Content         string        `json:"content" db:"content"`
	Status          AnnounceStatus `json:"status" db:"status"`
	CreatedAt       time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at" db:"updated_at"`
	IsNew           bool          `json:"is_new,omitempty" db:"-"`
}

type CrawlResult struct {
	SiteID       string
	SiteName     string
	SuccessCount int
	FailCount    int
	NewCount     int
	SkipCount    int
	TotalCount   int
	Duration     time.Duration
	Errors       []CrawlError
	StartTime    time.Time
	EndTime      time.Time
}

type CrawlError struct {
	URL        string
	Err        error
	StatusCode int
	RetryCount int
	Timestamp  time.Time
}

type ExportFilter struct {
	StartDate   string
	EndDate     string
	Category    AnnounceType
	Keyword     string
	SiteID      string
	OutputType  string
}

type CrawlState struct {
	ID            int64     `db:"id"`
	SiteID        string    `db:"site_id"`
	LastURL       string    `db:"last_url"`
	LastCrawlTime time.Time `db:"last_crawl_time"`
	LastCount     int       `db:"last_count"`
	FailStreak    int       `db:"fail_streak"`
	Status        string    `db:"status"`
	ResumePoint   string    `db:"resume_point"`
	UpdatedAt     time.Time `db:"updated_at"`
}

func (a *Announcement) ComputeURLHash() string {
	if a.URLHash != "" {
		return a.URLHash
	}
	h := md5.New()
	h.Write([]byte(a.URL))
	a.URLHash = hex.EncodeToString(h.Sum(nil))
	return a.URLHash
}

func ComputeURLHash(url string) string {
	h := md5.New()
	h.Write([]byte(url))
	return hex.EncodeToString(h.Sum(nil))
}

func (a *Announcement) IsExpired() bool {
	if a.DeadlineTime.IsZero() {
		return false
	}
	return time.Now().After(a.DeadlineTime)
}

func TypeFromString(s string) AnnounceType {
	switch s {
	case "施工", "工程", "construction":
		return TypeConstruction
	case "服务", "service":
		return TypeService
	case "货物", "goods":
		return TypeGoods
	case "土地", "矿产", "land":
		return TypeLand
	case "产权", "property":
		return TypeProperty
	default:
		return TypeOther
	}
}

func (t AnnounceType) DisplayName() string {
	switch t {
	case TypeConstruction:
		return "工程建设"
	case TypeService:
		return "服务采购"
	case TypeGoods:
		return "货物采购"
	case TypeLand:
		return "土地矿产"
	case TypeProperty:
		return "产权交易"
	default:
		return "其他"
	}
}
