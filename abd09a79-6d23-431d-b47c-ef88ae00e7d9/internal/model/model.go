package model

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

type CourtLevel string

const (
	CourtLevelSupreme CourtLevel = "supreme"
	CourtLevelHigh    CourtLevel = "high"
	CourtLevelMiddle  CourtLevel = "middle"
	CourtLevelBasic   CourtLevel = "basic"
)

type AnnouncementType string

const (
	TypeReorganization AnnouncementType = "reorganization"
	TypeLiquidation    AnnouncementType = "liquidation"
	TypeClaimNotice    AnnouncementType = "claim_notice"
	TypeMeeting        AnnouncementType = "meeting"
	TypeOther          AnnouncementType = "other"
)

type Case struct {
	ID                uint64           `gorm:"primaryKey;autoIncrement" json:"id"`
	CaseNumber        string           `gorm:"index:idx_case_number;size:128;not null" json:"case_number"`
	CaseNumberNorm    string           `gorm:"index:idx_case_norm;size:128" json:"case_number_norm"`
	Debtor            string           `gorm:"index:idx_debtor;size:256;not null" json:"debtor"`
	DebtorNorm        string           `gorm:"index:idx_debtor_norm;size:256" json:"debtor_norm"`
	DebtorFingerprint string           `gorm:"index:idx_debtor_fp;size:64" json:"debtor_fingerprint"`
	Creditors         string           `gorm:"type:text" json:"creditors"`
	Administrator     string           `gorm:"size:512" json:"administrator"`
	Court             string           `gorm:"index:idx_court;size:256;not null" json:"court"`
	CourtLevel        CourtLevel       `gorm:"size:32" json:"court_level"`
	RulingNumber      string           `gorm:"size:128" json:"ruling_number"`
	AnnouncementType  AnnouncementType `gorm:"index:idx_type;size:32" json:"announcement_type"`
	ClaimDeadline     *time.Time       `gorm:"index:idx_claim_deadline" json:"claim_deadline"`
	FirstHearingDate  *time.Time       `gorm:"index:idx_hearing" json:"first_hearing_date"`
	Industry          string           `gorm:"size:128" json:"industry"`
	Tags              string           `gorm:"type:text" json:"tags"`
	IsRead            bool             `gorm:"default:false;index:idx_read" json:"is_read"`
	IsWithdrawn       bool             `gorm:"default:false;index:idx_withdrawn" json:"is_withdrawn"`
	HitSubscription   bool             `gorm:"default:false;index:idx_hit" json:"hit_subscription"`
	NotifiedAt        *time.Time       `gorm:"index:idx_notified" json:"notified_at"`
	CreatedAt         time.Time        `gorm:"autoCreateTime;index:idx_created" json:"created_at"`
	UpdatedAt         time.Time        `gorm:"autoUpdateTime" json:"updated_at"`

	Announcements []Announcement `gorm:"foreignKey:CaseID" json:"announcements,omitempty"`
}

func (c *Case) Fingerprint() string {
	data := fmt.Sprintf("%s|%s|%s", c.Court, c.CaseNumberNorm, c.DebtorNorm)
	h := sha1.Sum([]byte(data))
	return hex.EncodeToString(h[:])
}

type Announcement struct {
	ID               uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	CaseID           uint64     `gorm:"index:idx_case_id;not null" json:"case_id"`
	Court            string     `gorm:"index:idx_ann_court;size:256;not null" json:"court"`
	Fingerprint      string     `gorm:"uniqueIndex:idx_fp;size:64;not null" json:"fingerprint"`
	Title            string     `gorm:"size:512;not null" json:"title"`
	AnnouncementDate *time.Time `gorm:"index:idx_ann_date" json:"announcement_date"`
	SourceURL        string     `gorm:"size:1024;not null" json:"source_url"`
	SourceCourt      string     `gorm:"size:256" json:"source_court"`
	Content          string     `gorm:"type:mediumtext" json:"content"`
	RawHTML          string     `gorm:"type:mediumtext" json:"raw_html,omitempty"`
	ParserVersion    string     `gorm:"size:32" json:"parser_version"`
	IsWithdrawn      bool       `gorm:"default:false;index:idx_ann_withdrawn" json:"is_withdrawn"`
	FirstDiscovered  time.Time  `gorm:"autoCreateTime" json:"first_discovered"`
	LastChecked      time.Time  `gorm:"autoUpdateTime" json:"last_checked"`

	Case *Case `gorm:"foreignKey:CaseID" json:"case,omitempty"`
}

func (a *Announcement) GenFingerprint() string {
	dateStr := ""
	if a.AnnouncementDate != nil {
		dateStr = a.AnnouncementDate.Format("2006-01-02")
	}
	data := fmt.Sprintf("%s|%s|%s", a.Court, strings.TrimSpace(a.Title), dateStr)
	h := sha1.Sum([]byte(data))
	return hex.EncodeToString(h[:])
}

type Subscription struct {
	ID          uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Keyword     string         `gorm:"index:idx_kw;size:256;not null" json:"keyword"`
	KeywordNorm string         `gorm:"index:idx_kw_norm;size:256" json:"keyword_norm"`
	MatchType   string         `gorm:"size:32;default:contains" json:"match_type"`
	Category    string         `gorm:"size:64" json:"category"`
	Channels    string         `gorm:"size:256" json:"channels"`
	Enabled     bool           `gorm:"default:true;index:idx_enabled" json:"enabled"`
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type DeadLetter struct {
	ID            uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	URL           string         `gorm:"size:1024;not null" json:"url"`
	SourceCourt   string         `gorm:"size:256" json:"source_court"`
	ErrorType     string         `gorm:"index:idx_err_type;size:64;not null" json:"error_type"`
	ErrorMessage  string         `gorm:"type:text" json:"error_message"`
	RawHTML       string         `gorm:"type:mediumtext" json:"raw_html"`
	HTTPStatus    int            `json:"http_status"`
	AttemptCount  int            `gorm:"default:0" json:"attempt_count"`
	LastAttemptAt time.Time      `json:"last_attempt_at"`
	Context       string         `gorm:"type:text" json:"context"`
	CreatedAt     time.Time      `gorm:"autoCreateTime;index:idx_dl_created" json:"created_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type CrawlStats struct {
	URL              string    `json:"url"`
	Court            string    `json:"court"`
	ProcessedCount   int64     `json:"processed_count"`
	NewCount         int64     `json:"new_count"`
	ErrorCount       int64     `json:"error_count"`
	DuplicateCount   int64     `json:"duplicate_count"`
	CurrentURL       string    `json:"current_url"`
	StartedAt        time.Time `json:"started_at"`
	FinishedAt       time.Time `json:"finished_at,omitempty"`
	Elapsed          string    `json:"elapsed"`
}

func (cs *CrawlStats) ElapsedStr() string {
	if cs.FinishedAt.IsZero() {
		return time.Since(cs.StartedAt).Round(time.Second).String()
	}
	return cs.FinishedAt.Sub(cs.StartedAt).Round(time.Second).String()
}
