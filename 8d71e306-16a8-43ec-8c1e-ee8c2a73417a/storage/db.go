package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"

	"drug-bid-crawler/config"
)

var db *sql.DB

func InitDB(dbPath string) error {
	var err error
	db, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(time.Hour)

	if err := createTables(); err != nil {
		return fmt.Errorf("create tables: %w", err)
	}

	return nil
}

func createTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS bid_projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id TEXT UNIQUE NOT NULL,
			project_name TEXT NOT NULL,
			project_url TEXT,
			signup_start DATETIME,
			signup_end DATETIME,
			bid_open_time DATETIME,
			company_count INTEGER DEFAULT 0,
			file_count INTEGER DEFAULT 0,
			status TEXT DEFAULT 'active',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS bid_companies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id TEXT NOT NULL,
			company_id TEXT NOT NULL,
			company_name TEXT NOT NULL,
			detail_url TEXT,
			contact TEXT,
			phone TEXT,
			file_count INTEGER DEFAULT 0,
			downloaded INTEGER DEFAULT 0,
			failed_count INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(project_id, company_id)
		)`,
		`CREATE TABLE IF NOT EXISTS qualification_files (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id TEXT NOT NULL,
			company_id TEXT NOT NULL,
			company_name TEXT NOT NULL,
			file_id TEXT UNIQUE NOT NULL,
			file_name TEXT,
			file_type TEXT,
			cert_type TEXT,
			cert_number TEXT,
			issue_date DATETIME,
			expiry_date DATETIME,
			cert_status TEXT DEFAULT 'valid',
			file_url TEXT,
			file_size INTEGER DEFAULT 0,
			extension TEXT,
			local_path TEXT,
			download_status TEXT DEFAULT 'pending',
			downloaded_at DATETIME,
			download_time REAL DEFAULT 0,
			retry_count INTEGER DEFAULT 0,
			error_msg TEXT,
			file_hash TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS download_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			file_id TEXT NOT NULL,
			project_id TEXT,
			company_id TEXT,
			start_time DATETIME NOT NULL,
			end_time DATETIME,
			file_size INTEGER DEFAULT 0,
			download_time REAL DEFAULT 0,
			speed REAL DEFAULT 0,
			status TEXT NOT NULL,
			error_msg TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT UNIQUE,
			cookies TEXT,
			user_agent TEXT,
			expires_at DATETIME,
			last_active DATETIME,
			is_valid INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS execution_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id TEXT,
			level TEXT,
			message TEXT,
			details TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_files_project ON qualification_files(project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_files_company ON qualification_files(company_id)`,
		`CREATE INDEX IF NOT EXISTS idx_files_status ON qualification_files(download_status)`,
		`CREATE INDEX IF NOT EXISTS idx_files_expiry ON qualification_files(expiry_date)`,
		`CREATE INDEX IF NOT EXISTS idx_records_file ON download_records(file_id)`,
	}

	for _, schema := range schemas {
		if _, err := db.Exec(schema); err != nil {
			return err
		}
	}

	return nil
}

func BeginTx() (*sql.Tx, error) {
	return db.Begin()
}

func SaveProject(project *BidProject) error {
	now := time.Now()
	if project.ID == 0 {
		result, err := db.Exec(`INSERT INTO bid_projects 
			(project_id, project_name, project_url, signup_start, signup_end, bid_open_time, 
			company_count, file_count, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			project.ProjectID, project.ProjectName, project.ProjectURL,
			project.SignUpStart, project.SignUpEnd, project.BidOpenTime,
			project.CompanyCount, project.FileCount, project.Status, now, now)
		if err != nil {
			return err
		}
		project.ID, _ = result.LastInsertId()
	} else {
		_, err := db.Exec(`UPDATE bid_projects SET 
			project_name=?, project_url=?, signup_start=?, signup_end=?, bid_open_time=?,
			company_count=?, file_count=?, status=?, updated_at=? WHERE id=?`,
			project.ProjectName, project.ProjectURL,
			project.SignUpStart, project.SignUpEnd, project.BidOpenTime,
			project.CompanyCount, project.FileCount, project.Status, now, project.ID)
		return err
	}
	return nil
}

func GetProject(projectID string) (*BidProject, error) {
	var p BidProject
	err := db.QueryRow(`SELECT id, project_id, project_name, project_url, 
		signup_start, signup_end, bid_open_time, company_count, file_count, status, 
		created_at, updated_at FROM bid_projects WHERE project_id=?`, projectID).
		Scan(&p.ID, &p.ProjectID, &p.ProjectName, &p.ProjectURL,
			&p.SignUpStart, &p.SignUpEnd, &p.BidOpenTime,
			&p.CompanyCount, &p.FileCount, &p.Status, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func ListProjects() ([]BidProject, error) {
	rows, err := db.Query(`SELECT id, project_id, project_name, project_url, 
		signup_start, signup_end, bid_open_time, company_count, file_count, status, 
		created_at, updated_at FROM bid_projects ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []BidProject
	for rows.Next() {
		var p BidProject
		if err := rows.Scan(&p.ID, &p.ProjectID, &p.ProjectName, &p.ProjectURL,
			&p.SignUpStart, &p.SignUpEnd, &p.BidOpenTime,
			&p.CompanyCount, &p.FileCount, &p.Status, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, nil
}

func SaveCompany(company *BidCompany) error {
	now := time.Now()
	result, err := db.Exec(`INSERT OR REPLACE INTO bid_companies 
		(project_id, company_id, company_name, detail_url, contact, phone, 
		file_count, downloaded, failed_count, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		company.ProjectID, company.CompanyID, company.CompanyName, company.DetailURL,
		company.Contact, company.Phone, company.FileCount, company.Downloaded,
		company.FailedCount, now, now)
	if err != nil {
		return err
	}
	if company.ID == 0 {
		company.ID, _ = result.LastInsertId()
	}
	return nil
}

func GetCompaniesByProject(projectID string) ([]BidCompany, error) {
	rows, err := db.Query(`SELECT id, project_id, company_id, company_name, detail_url, 
		contact, phone, file_count, downloaded, failed_count, created_at, updated_at 
		FROM bid_companies WHERE project_id=? ORDER BY company_name`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var companies []BidCompany
	for rows.Next() {
		var c BidCompany
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.CompanyID, &c.CompanyName,
			&c.DetailURL, &c.Contact, &c.Phone, &c.FileCount,
			&c.Downloaded, &c.FailedCount, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		companies = append(companies, c)
	}
	return companies, nil
}

func SaveFile(file *QualificationFile) error {
	now := time.Now()
	if file.ID == 0 {
		var existingID int64
		err := db.QueryRow(`SELECT id FROM qualification_files WHERE file_id=?`, file.FileID).Scan(&existingID)
		if err == nil {
			file.ID = existingID
			return UpdateFile(file)
		}

		result, err := db.Exec(`INSERT INTO qualification_files 
			(project_id, company_id, company_name, file_id, file_name, file_type, 
			cert_type, cert_number, issue_date, expiry_date, cert_status,
			file_url, file_size, extension, local_path, download_status, 
			downloaded_at, download_time, retry_count, error_msg, file_hash, 
			created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			file.ProjectID, file.CompanyID, file.CompanyName, file.FileID, file.FileName,
			file.FileType, file.CertType, file.CertNumber, file.IssueDate, file.ExpiryDate,
			file.CertStatus, file.FileURL, file.FileSize, file.Extension, file.LocalPath,
			file.DownloadStatus, file.DownloadedAt, file.DownloadTime,
			file.RetryCount, file.ErrorMsg, file.FileHash, now, now)
		if err != nil {
			return err
		}
		file.ID, _ = result.LastInsertId()
	} else {
		return UpdateFile(file)
	}
	return nil
}

func UpdateFile(file *QualificationFile) error {
	now := time.Now()
	_, err := db.Exec(`UPDATE qualification_files SET 
		project_id=?, company_id=?, company_name=?, file_name=?, file_type=?,
		cert_type=?, cert_number=?, issue_date=?, expiry_date=?, cert_status=?,
		file_url=?, file_size=?, extension=?, local_path=?, download_status=?,
		downloaded_at=?, download_time=?, retry_count=?, error_msg=?, file_hash=?, updated_at=? 
		WHERE id=?`,
		file.ProjectID, file.CompanyID, file.CompanyName, file.FileName, file.FileType,
		file.CertType, file.CertNumber, file.IssueDate, file.ExpiryDate, file.CertStatus,
		file.FileURL, file.FileSize, file.Extension, file.LocalPath, file.DownloadStatus,
		file.DownloadedAt, file.DownloadTime, file.RetryCount, file.ErrorMsg,
		file.FileHash, now, file.ID)
	return err
}

func GetFilesByProject(projectID string, status ...DownloadStatus) ([]QualificationFile, error) {
	query := `SELECT id, project_id, company_id, company_name, file_id, file_name,
		file_type, cert_type, cert_number, issue_date, expiry_date, cert_status,
		file_url, file_size, extension, local_path, download_status, downloaded_at,
		download_time, retry_count, error_msg, file_hash, created_at, updated_at
		FROM qualification_files WHERE project_id=?`
	args := []interface{}{projectID}

	if len(status) > 0 {
		query += ` AND download_status IN (`
		for i, s := range status {
			if i > 0 {
				query += ","
			}
			query += "?"
			args = append(args, string(s))
		}
		query += ")"
	}

	query += ` ORDER BY company_name, cert_type`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []QualificationFile
	for rows.Next() {
		var f QualificationFile
		var issueDate, expiryDate, downloadedAt sql.NullTime
		if err := rows.Scan(&f.ID, &f.ProjectID, &f.CompanyID, &f.CompanyName,
			&f.FileID, &f.FileName, &f.FileType, &f.CertType, &f.CertNumber,
			&issueDate, &expiryDate, &f.CertStatus, &f.FileURL, &f.FileSize,
			&f.Extension, &f.LocalPath, &f.DownloadStatus, &downloadedAt,
			&f.DownloadTime, &f.RetryCount, &f.ErrorMsg, &f.FileHash,
			&f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		if issueDate.Valid {
			t := issueDate.Time
			f.IssueDate = &t
		}
		if expiryDate.Valid {
			t := expiryDate.Time
			f.ExpiryDate = &t
		}
		if downloadedAt.Valid {
			t := downloadedAt.Time
			f.DownloadedAt = &t
		}
		files = append(files, f)
	}
	return files, nil
}

func GetPendingFiles(projectID string) ([]QualificationFile, error) {
	return GetFilesByProject(projectID, StatusPending, StatusFailed)
}

func GetFileByID(fileID string) (*QualificationFile, error) {
	var f QualificationFile
	var issueDate, expiryDate, downloadedAt sql.NullTime
	err := db.QueryRow(`SELECT id, project_id, company_id, company_name, file_id, file_name,
		file_type, cert_type, cert_number, issue_date, expiry_date, cert_status,
		file_url, file_size, extension, local_path, download_status, downloaded_at,
		download_time, retry_count, error_msg, file_hash, created_at, updated_at
		FROM qualification_files WHERE file_id=?`, fileID).
		Scan(&f.ID, &f.ProjectID, &f.CompanyID, &f.CompanyName,
			&f.FileID, &f.FileName, &f.FileType, &f.CertType, &f.CertNumber,
			&issueDate, &expiryDate, &f.CertStatus, &f.FileURL, &f.FileSize,
			&f.Extension, &f.LocalPath, &f.DownloadStatus, &downloadedAt,
			&f.DownloadTime, &f.RetryCount, &f.ErrorMsg, &f.FileHash,
			&f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if issueDate.Valid {
		t := issueDate.Time
		f.IssueDate = &t
	}
	if expiryDate.Valid {
		t := expiryDate.Time
		f.ExpiryDate = &t
	}
	if downloadedAt.Valid {
		t := downloadedAt.Time
		f.DownloadedAt = &t
	}
	return &f, nil
}

func SaveDownloadRecord(record *DownloadRecord) error {
	_, err := db.Exec(`INSERT INTO download_records 
		(file_id, project_id, company_id, start_time, end_time, file_size, 
		download_time, speed, status, error_msg, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		record.FileID, record.ProjectID, record.CompanyID, record.StartTime,
		record.EndTime, record.FileSize, record.DownloadTime, record.Speed,
		record.Status, record.ErrorMsg, time.Now())
	return err
}

func GetStats(projectID string) (*DownloadStats, error) {
	stats := &DownloadStats{}

	err := db.QueryRow(`SELECT 
		COUNT(*) as total,
		SUM(CASE WHEN download_status='completed' THEN 1 ELSE 0 END) as completed,
		SUM(CASE WHEN download_status='failed' THEN 1 ELSE 0 END) as failed,
		SUM(CASE WHEN download_status='skipped' THEN 1 ELSE 0 END) as skipped,
		SUM(CASE WHEN download_status='pending' OR download_status='downloading' THEN 1 ELSE 0 END) as pending,
		COALESCE(SUM(file_size), 0) as total_size,
		COALESCE(SUM(CASE WHEN download_status='completed' THEN file_size ELSE 0 END), 0) as downloaded_size
		FROM qualification_files WHERE project_id=?`, projectID).
		Scan(&stats.TotalFiles, &stats.CompletedFiles, &stats.FailedFiles,
			&stats.SkippedFiles, &stats.PendingFiles, &stats.TotalSize, &stats.DownloadedSize)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func GetExpiryWarnings(projectID string, warnDays int) ([]ExpiryWarning, error) {
	warnDate := time.Now().AddDate(0, 0, warnDays)
	rows, err := db.Query(`SELECT q.id, q.project_id, p.project_name, q.company_id, 
		q.company_name, q.file_id, q.file_name, q.cert_type, q.expiry_date
		FROM qualification_files q
		LEFT JOIN bid_projects p ON q.project_id = p.project_id
		WHERE q.project_id=? AND q.expiry_date IS NOT NULL 
		AND q.expiry_date <= ?
		ORDER BY q.expiry_date ASC`, projectID, warnDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var warnings []ExpiryWarning
	for rows.Next() {
		var w ExpiryWarning
		if err := rows.Scan(&w.ID, &w.ProjectID, &w.ProjectName, &w.CompanyID,
			&w.CompanyName, &w.FileID, &w.FileName, &w.CertType, &w.ExpiryDate); err != nil {
			return nil, err
		}
		w.DaysLeft = int(time.Until(w.ExpiryDate).Hours() / 24)
		if w.DaysLeft <= 0 {
			w.Status = CertExpired
		} else if w.DaysLeft <= warnDays {
			w.Status = CertWarning
		} else {
			w.Status = CertValid
		}
		warnings = append(warnings, w)
	}
	return warnings, nil
}

func SaveSession(session *Session) error {
	cookiesJSON, _ := json.Marshal(session)
	_, err := db.Exec(`INSERT OR REPLACE INTO sessions 
		(session_id, cookies, user_agent, expires_at, last_active, is_valid, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		session.SessionID, string(cookiesJSON), session.UserAgent,
		session.ExpiresAt, session.LastActive, session.IsValid, time.Now())
	return err
}

func GetValidSession() (*Session, error) {
	var s Session
	var cookiesStr string
	err := db.QueryRow(`SELECT id, session_id, cookies, user_agent, expires_at, last_active, is_valid 
		FROM sessions WHERE is_valid=1 AND expires_at > ? 
		ORDER BY last_active DESC LIMIT 1`, time.Now()).
		Scan(&s.ID, &s.SessionID, &cookiesStr, &s.UserAgent,
			&s.ExpiresAt, &s.LastActive, &s.IsValid)
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(cookiesStr), &s)
	return &s, nil
}

func InvalidateAllSessions() error {
	_, err := db.Exec(`UPDATE sessions SET is_valid=0 WHERE is_valid=1`)
	return err
}

func LogExecution(taskID, level, message, details string) {
	_, err := db.Exec(`INSERT INTO execution_logs 
		(task_id, level, message, details, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		taskID, level, message, details, time.Now())
	if err != nil {
		config.Logger.Warn("save execution log failed", zap.Error(err))
	}
}

func UpdateFileStatus(fileID string, status DownloadStatus, errMsg string) error {
	_, err := db.Exec(`UPDATE qualification_files SET download_status=?, error_msg=?, updated_at=? 
		WHERE file_id=?`, string(status), errMsg, time.Now(), fileID)
	return err
}

func IncrementRetryCount(fileID string) error {
	_, err := db.Exec(`UPDATE qualification_files SET retry_count = retry_count + 1, updated_at=? 
		WHERE file_id=?`, time.Now(), fileID)
	return err
}

func CleanupOldLogs(retentionDays int) error {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	_, err := db.Exec(`DELETE FROM execution_logs WHERE created_at < ?`, cutoff)
	return err
}

func WithTransaction(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func Close() error {
	if db != nil {
		return db.Close()
	}
	return nil
}
