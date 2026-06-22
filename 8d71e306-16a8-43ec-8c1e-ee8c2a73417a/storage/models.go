package storage

import "time"

type DownloadStatus string

const (
	StatusPending   DownloadStatus = "pending"
	StatusDownloading DownloadStatus = "downloading"
	StatusCompleted DownloadStatus = "completed"
	StatusFailed    DownloadStatus = "failed"
	StatusSkipped   DownloadStatus = "skipped"
)

type CertStatus string

const (
	CertValid   CertStatus = "valid"
	CertWarning CertStatus = "warning"
	CertExpired CertStatus = "expired"
)

type BidProject struct {
	ID          int64     `db:"id"`
	ProjectID   string    `db:"project_id"`
	ProjectName string    `db:"project_name"`
	ProjectURL  string    `db:"project_url"`
	SignUpStart time.Time `db:"signup_start"`
	SignUpEnd   time.Time `db:"signup_end"`
	BidOpenTime time.Time `db:"bid_open_time"`
	CompanyCount int      `db:"company_count"`
	FileCount   int       `db:"file_count"`
	Status      string    `db:"status"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type BidCompany struct {
	ID           int64  `db:"id"`
	ProjectID    string `db:"project_id"`
	CompanyID    string `db:"company_id"`
	CompanyName  string `db:"company_name"`
	DetailURL    string `db:"detail_url"`
	Contact      string `db:"contact"`
	Phone        string `db:"phone"`
	FileCount    int    `db:"file_count"`
	Downloaded   int    `db:"downloaded"`
	FailedCount  int    `db:"failed_count"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}

type QualificationFile struct {
	ID           int64      `db:"id"`
	ProjectID    string     `db:"project_id"`
	CompanyID    string     `db:"company_id"`
	CompanyName  string     `db:"company_name"`
	FileID       string     `db:"file_id"`
	FileName     string     `db:"file_name"`
	FileType     string     `db:"file_type"`
	CertType     string     `db:"cert_type"`
	CertNumber   string     `db:"cert_number"`
	IssueDate    *time.Time `db:"issue_date"`
	ExpiryDate   *time.Time `db:"expiry_date"`
	CertStatus   CertStatus `db:"cert_status"`
	FileURL      string     `db:"file_url"`
	FileSize     int64      `db:"file_size"`
	Extension    string     `db:"extension"`
	LocalPath    string     `db:"local_path"`
	DownloadStatus DownloadStatus `db:"download_status"`
	DownloadedAt *time.Time `db:"downloaded_at"`
	DownloadTime float64    `db:"download_time"`
	RetryCount   int        `db:"retry_count"`
	ErrorMsg     string     `db:"error_msg"`
	FileHash     string     `db:"file_hash"`
	CreatedAt    time.Time  `db:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at"`
}

type DownloadRecord struct {
	ID           int64      `db:"id"`
	FileID       string     `db:"file_id"`
	ProjectID    string     `db:"project_id"`
	CompanyID    string     `db:"company_id"`
	StartTime    time.Time  `db:"start_time"`
	EndTime      *time.Time `db:"end_time"`
	FileSize     int64      `db:"file_size"`
	DownloadTime float64    `db:"download_time"`
	Speed        float64    `db:"speed"`
	Status       DownloadStatus `db:"status"`
	ErrorMsg     string     `db:"error_msg"`
	CreatedAt    time.Time  `db:"created_at"`
}

type Session struct {
	ID         int64     `db:"id"`
	SessionID  string    `db:"session_id"`
	Cookies    string    `db:"cookies"`
	UserAgent  string    `db:"user_agent"`
	ExpiresAt  time.Time `db:"expires_at"`
	LastActive time.Time `db:"last_active"`
	IsValid    bool      `db:"is_valid"`
	CreatedAt  time.Time `db:"created_at"`
}

type ExecutionLog struct {
	ID        int64     `db:"id"`
	TaskID    string    `db:"task_id"`
	Level     string    `db:"level"`
	Message   string    `db:"message"`
	Details   string    `db:"details"`
	CreatedAt time.Time `db:"created_at"`
}

type DownloadStats struct {
	TotalFiles     int
	CompletedFiles int
	FailedFiles    int
	SkippedFiles   int
	PendingFiles   int
	TotalSize      int64
	DownloadedSize int64
	ElapsedTime    float64
	RemainingTime  float64
	Speed          float64
}

type ExpiryWarning struct {
	ID          int64
	ProjectID   string
	ProjectName string
	CompanyID   string
	CompanyName string
	FileID      string
	FileName    string
	CertType    string
	ExpiryDate  time.Time
	DaysLeft    int
	Status      CertStatus
}
