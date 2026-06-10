package storage

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/gitmon/gitmon/internal/git"
)

type RepoRecord struct {
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	Mode         string    `json:"mode"`
	Owner        string    `json:"owner"`
	HeadBranch   string    `json:"head_branch"`
	HeadCommit   string    `json:"head_commit"`
	LastCommit   time.Time `json:"last_commit"`
	FirstCommit  time.Time `json:"first_commit"`
	CommitCount  int       `json:"commit_count"`
	Contributors int       `json:"contributors"`
	FilesCount   int       `json:"files_count"`
	LinesOfCode  int       `json:"lines_of_code"`
	AddedAt      time.Time `json:"added_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Disabled     bool      `json:"disabled"`
	HealthLevel  string    `json:"health_level"`
	HealthScore  float64   `json:"health_score"`
	SilentDays   int       `json:"silent_days"`
}

type CommitRecord struct {
	Hash           string    `json:"hash"`
	ShortHash      string    `json:"short_hash"`
	RepoName       string    `json:"repo_name"`
	AuthorName     string    `json:"author_name"`
	AuthorEmail    string    `json:"author_email"`
	AuthorDate     time.Time `json:"author_date"`
	CommitterName  string    `json:"committer_name"`
	CommitterEmail string    `json:"committer_email"`
	CommitterDate  time.Time `json:"committer_date"`
	Subject        string    `json:"subject"`
	Body           string    `json:"body"`
	Parents        []string  `json:"parents"`
	IsMerge        bool      `json:"is_merge"`
	Additions      int       `json:"additions"`
	Deletions      int       `json:"deletions"`
	FilesChanged   int       `json:"files_changed"`
	TechDebtCount  int       `json:"tech_debt_count"`
	ReviewDuration int64     `json:"review_duration_seconds,omitempty"`
	PRNumber       string    `json:"pr_number,omitempty"`
	Author         string    `json:"author"`
	Message        string    `json:"message"`
	Date           time.Time `json:"date"`
}

type FileRecord struct {
	RepoName      string    `json:"repo_name"`
	Path          string    `json:"path"`
	Extension     string    `json:"extension"`
	Lines         int       `json:"lines"`
	ChurnCount    int       `json:"churn_count"`
	LastChanged   time.Time `json:"last_changed"`
	FirstAdded    time.Time `json:"first_added"`
	Complexity    float64   `json:"complexity"`
	RiskScore     float64   `json:"risk_score"`
	Contributors  []string  `json:"contributors"`
	TechDebtCount int       `json:"tech_debt_count"`
	LastAuthor    string    `json:"last_author"`
}

type ContributorRecord struct {
	RepoName     string    `json:"repo_name"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Commits      int       `json:"commits"`
	LinesAdded   int       `json:"lines_added"`
	LinesDeleted int       `json:"lines_deleted"`
	FilesTouched int       `json:"files_touched"`
	FirstCommit  time.Time `json:"first_commit"`
	LastCommit   time.Time `json:"last_commit"`
	ActiveDays   int       `json:"active_days"`
	StreakDays   int       `json:"streak_days"`
}

type TechDebtItem struct {
	ID        string    `json:"id"`
	RepoName  string    `json:"repo_name"`
	FilePath  string    `json:"file_path"`
	LineNum   int       `json:"line_num"`
	Pattern   string    `json:"pattern"`
	Content   string    `json:"content"`
	Hash      string    `json:"hash"`
	Author    string    `json:"author"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	AgeDays   int       `json:"age_days"`
	Severity  string    `json:"severity"`
	Type      string    `json:"type"`
	File      string    `json:"file"`
	Message   string    `json:"message"`
}

type AlertRecord struct {
	ID         string    `json:"id"`
	RepoName   string    `json:"repo_name"`
	Type       string    `json:"type"`
	Level      string    `json:"level"`
	Title      string    `json:"title"`
	Message    string    `json:"message"`
	Detail     string    `json:"detail,omitempty"`
	Owner      string    `json:"owner,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	Resolved   bool      `json:"resolved"`
	ResolvedAt time.Time `json:"resolved_at,omitempty"`
}

type GitFile struct {
	Path    string
	Added   int
	Deleted   int
}

type FileChurn struct {
	Path      string
	Count     int
	Additions int
	Deletions int
	Authors   map[string]bool
}

type PRHealth struct {
	PRNumber       string
	OpenedAt       time.Time
	MergedAt       time.Time
	ClosedAt       time.Time
	ReviewDuration time.Duration
	CommitsCount   int
	Reviewers      []string
	Merged         bool
	Author         string
}

type RepoStats struct {
	RepoName       string         `json:"repo_name"`
	HealthLevel    git.HealthLevel `json:"health_level"`
	HealthScore    float64        `json:"health_score"`
	TotalCommits   int            `json:"total_commits"`
	TotalFiles     int            `json:"total_files"`
	TotalLines     int            `json:"total_lines"`
	Contributors   int            `json:"contributors"`
	SilentDays     int            `json:"silent_days"`
	LastCommit     time.Time      `json:"last_commit"`
	ChurnWindow    int            `json:"churn_window"`
	HighRiskFiles  int            `json:"high_risk_files"`
	TechDebtCount  int            `json:"tech_debt_count"`
	ActivePRs      int            `json:"active_prs"`
	AvgReviewHours float64        `json:"avg_review_hours"`
	MergeRate      float64        `json:"merge_rate"`
}

type HeatmapData struct {
	Date   string
	Count  int
	Repo   string
	Author string
}

func NewCommitRecord(c *git.Commit) *CommitRecord {
	additions := 0
	deletions := 0
	for _, f := range c.Files {
		additions += f.Additions
		deletions += f.Deletions
	}
	return &CommitRecord{
		Hash:           c.Hash,
		ShortHash:      c.ShortHash,
		RepoName:       c.RepoName,
		AuthorName:     c.AuthorName,
		AuthorEmail:    c.AuthorEmail,
		AuthorDate:     c.AuthorDate,
		CommitterName:  c.CommitterName,
		CommitterEmail: c.CommitterEmail,
		CommitterDate:  c.CommitterDate,
		Subject:        c.Subject,
		Body:           c.Body,
		Parents:        c.Parents,
		IsMerge:        c.IsMerge,
		Additions:      additions,
		Deletions:      deletions,
		FilesChanged:   len(c.Files),
		Author:         c.AuthorName,
		Message:        c.Subject,
		Date:           c.AuthorDate,
	}
}

func NewCommitRecordWithFields(hash, repoName, authorName, authorEmail string, date time.Time, message string, files []GitFile) *CommitRecord {
	additions := 0
	deletions := 0
	for _, f := range files {
		additions += f.Added
		deletions += f.Deleted
	}
	return &CommitRecord{
		Hash:           hash,
		ShortHash:      hash[:7],
		RepoName:       repoName,
		AuthorName:     authorName,
		AuthorEmail:    authorEmail,
		AuthorDate:     date,
		CommitterName:  authorName,
		CommitterEmail: authorEmail,
		CommitterDate:  date,
		Subject:        message,
		Additions:      additions,
		Deletions:      deletions,
		FilesChanged:   len(files),
		Author:         authorName,
		Message:        message,
		Date:           date,
	}
}

func NewTechDebtItem(repoName, filePath string, lineNum int, pattern, content, author, email string) *TechDebtItem {
	return &TechDebtItem{
		ID:        generateTechDebtID(repoName, filePath, lineNum, pattern),
		RepoName:  repoName,
		FilePath:  filePath,
		LineNum:   lineNum,
		Pattern:   pattern,
		Content:   content,
		Author:    author,
		Email:     email,
		CreatedAt: time.Now(),
		Type:      pattern,
		File:      filePath,
		Message:   content,
	}
}

func generateTechDebtID(repo, path string, line int, pattern string) string {
	h := sha1.New()
	h.Write([]byte(fmt.Sprintf("%s:%s:%d:%s", repo, path, line, pattern)))
	return hex.EncodeToString(h.Sum(nil))[:16]
}
