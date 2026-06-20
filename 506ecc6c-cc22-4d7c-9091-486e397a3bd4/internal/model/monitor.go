package model

import "time"

type PiracyStatus string

const (
	PiracySuspected  PiracyStatus = "suspected"
	PiracyConfirmed  PiracyStatus = "confirmed"
	PiracyProcessing PiracyStatus = "processing"
	PiracyResolved   PiracyStatus = "resolved"
	PiracyDismissed  PiracyStatus = "dismissed"
)

type PiracyRecord struct {
	ID              string       `json:"id"`
	WorkID          string       `json:"work_id"`
	WorkTitle       string       `json:"work_title"`
	WorkFingerprint string       `json:"work_fingerprint"`
	SuspectTitle    string       `json:"suspect_title"`
	SuspectArtist   string       `json:"suspect_artist"`
	SuspectPlatform string       `json:"suspect_platform"`
	SuspectURL      string       `json:"suspect_url"`
	SuspectFingerprint string    `json:"suspect_fingerprint"`
	MatchScore      float64      `json:"match_score"`
	MatchThreshold  float64      `json:"match_threshold"`
	Status          PiracyStatus `json:"status"`
	Note            string       `json:"note"`
	DiscoveredAt    time.Time    `json:"discovered_at"`
	ResolvedAt      *time.Time   `json:"resolved_at"`
}

type RightsLetter struct {
	ID            string    `json:"id"`
	PiracyID      string    `json:"piracy_id"`
	WorkID        string    `json:"work_id"`
	WorkTitle     string    `json:"work_title"`
	CopyrightOwner string   `json:"copyright_owner"`
	Infringer     string    `json:"infringer"`
	InfringingURL string    `json:"infringing_url"`
	Platform      string    `json:"platform"`
	TemplateType  string    `json:"template_type"`
	Content       string    `json:"content"`
	GeneratedAt   time.Time `json:"generated_at"`
	GeneratedBy   string    `json:"generated_by"`
}

type CrawlerTask struct {
	ID          string    `json:"id"`
	Platform    Platform  `json:"platform"`
	WorkID      *string   `json:"work_id"`
	TaskType    string    `json:"task_type"`
	Status      string    `json:"status"`
	RetryCount  int       `json:"retry_count"`
	RecordCount int       `json:"record_count"`
	ErrorMsg    string    `json:"error_msg"`
	StartedAt   *time.Time `json:"started_at"`
	FinishedAt  *time.Time `json:"finished_at"`
	CreatedAt   time.Time `json:"created_at"`
}
