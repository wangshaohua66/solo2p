package storage

import (
	"database/sql"
	"fmt"
	"time"

	"grain-monitor/models"

	_ "github.com/mattn/go-sqlite3"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(dbPath string) (*Repository, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite failed: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	repo := &Repository{db: db}
	if err := repo.initTables(); err != nil {
		db.Close()
		return nil, err
	}

	return repo, nil
}

func (r *Repository) Close() error {
	return r.db.Close()
}

func (r *Repository) DB() *sql.DB {
	return r.db
}

func (r *Repository) initTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS market_snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id TEXT NOT NULL,
			grain_type TEXT NOT NULL,
			price_type TEXT NOT NULL,
			price REAL NOT NULL DEFAULT 0,
			prev_price REAL NOT NULL DEFAULT 0,
			change REAL NOT NULL DEFAULT 0,
			change_pct REAL NOT NULL DEFAULT 0,
			high_price REAL NOT NULL DEFAULT 0,
			low_price REAL NOT NULL DEFAULT 0,
			open_price REAL NOT NULL DEFAULT 0,
			close_price REAL NOT NULL DEFAULT 0,
			volume REAL NOT NULL DEFAULT 0,
			unit TEXT NOT NULL DEFAULT '',
			contract TEXT NOT NULL DEFAULT '',
			timestamp DATETIME NOT NULL,
			is_suspicious INTEGER NOT NULL DEFAULT 0,
			suspicious_reason TEXT NOT NULL DEFAULT '',
			has_missing_fields INTEGER NOT NULL DEFAULT 0,
			missing_fields TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE INDEX IF NOT EXISTS idx_snapshots_site_time ON market_snapshots(site_id, timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_snapshots_grain_time ON market_snapshots(grain_type, timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_snapshots_time ON market_snapshots(timestamp)`,
		`CREATE TABLE IF NOT EXISTS task_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id TEXT NOT NULL,
			site_id TEXT NOT NULL,
			start_time DATETIME NOT NULL,
			end_time DATETIME NOT NULL,
			duration_ms INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT '',
			http_status INTEGER NOT NULL DEFAULT 0,
			fields_count INTEGER NOT NULL DEFAULT 0,
			total_fields INTEGER NOT NULL DEFAULT 0,
			completeness REAL NOT NULL DEFAULT 0,
			retry_count INTEGER NOT NULL DEFAULT 0,
			error_message TEXT NOT NULL DEFAULT '',
			snapshot_count INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_task_logs_site_time ON task_logs(site_id, start_time)`,
		`CREATE INDEX IF NOT EXISTS idx_task_logs_time ON task_logs(start_time)`,
		`CREATE TABLE IF NOT EXISTS alert_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			alert_id TEXT NOT NULL,
			alert_type TEXT NOT NULL,
			site_id TEXT NOT NULL DEFAULT '',
			grain_type TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL DEFAULT '',
			content TEXT NOT NULL DEFAULT '',
			price REAL NOT NULL DEFAULT 0,
			change_pct REAL NOT NULL DEFAULT 0,
			alert_time DATETIME NOT NULL,
			notified INTEGER NOT NULL DEFAULT 0,
			notify_method TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE INDEX IF NOT EXISTS idx_alert_records_time ON alert_records(alert_time)`,
		`CREATE INDEX IF NOT EXISTS idx_alert_records_alert ON alert_records(alert_id, alert_time)`,
		`CREATE TABLE IF NOT EXISTS site_cookies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id TEXT NOT NULL UNIQUE,
			cookies BLOB NOT NULL,
			updated_at DATETIME NOT NULL,
			expires_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS login_failures (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id TEXT NOT NULL,
			failure_time DATETIME NOT NULL,
			error_message TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE INDEX IF NOT EXISTS idx_login_failures_site ON login_failures(site_id, failure_time)`,
	}

	for _, schema := range schemas {
		if _, err := r.db.Exec(schema); err != nil {
			return fmt.Errorf("exec schema failed: %w", err)
		}
	}

	return nil
}

func (r *Repository) SaveSnapshot(s *models.MarketSnapshot) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO market_snapshots
		(site_id, grain_type, price_type, price, prev_price, change, change_pct,
		 high_price, low_price, open_price, close_price, volume, unit, contract,
		 timestamp, is_suspicious, suspicious_reason, has_missing_fields, missing_fields)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.SiteID, s.GrainType, s.PriceType, s.Price, s.PrevPrice, s.Change, s.ChangePct,
		s.HighPrice, s.LowPrice, s.OpenPrice, s.ClosePrice, s.Volume, s.Unit, s.Contract,
		s.Timestamp, boolToInt(s.IsSuspicious), s.SuspiciousReason,
		boolToInt(s.HasMissingFields), joinStrings(s.MissingFields))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *Repository) SaveSnapshots(snapshots []models.MarketSnapshot) error {
	if len(snapshots) == 0 {
		return nil
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT INTO market_snapshots
		(site_id, grain_type, price_type, price, prev_price, change, change_pct,
		 high_price, low_price, open_price, close_price, volume, unit, contract,
		 timestamp, is_suspicious, suspicious_reason, has_missing_fields, missing_fields)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for i := range snapshots {
		s := &snapshots[i]
		_, err := stmt.Exec(
			s.SiteID, s.GrainType, s.PriceType, s.Price, s.PrevPrice, s.Change, s.ChangePct,
			s.HighPrice, s.LowPrice, s.OpenPrice, s.ClosePrice, s.Volume, s.Unit, s.Contract,
			s.Timestamp, boolToInt(s.IsSuspicious), s.SuspiciousReason,
			boolToInt(s.HasMissingFields), joinStrings(s.MissingFields))
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *Repository) GetLatestSnapshot(siteID string, grainType models.GrainType, priceType models.PriceType) (*models.MarketSnapshot, error) {
	var s models.MarketSnapshot
	var missingFieldsStr string
	err := r.db.QueryRow(`SELECT id, site_id, grain_type, price_type, price, prev_price,
		change, change_pct, high_price, low_price, open_price, close_price, volume,
		unit, contract, timestamp, is_suspicious, suspicious_reason, has_missing_fields, missing_fields
		FROM market_snapshots WHERE site_id = ? AND grain_type = ? AND price_type = ?
		ORDER BY timestamp DESC LIMIT 1`,
		siteID, grainType, priceType).Scan(
		&s.ID, &s.SiteID, &s.GrainType, &s.PriceType, &s.Price, &s.PrevPrice,
		&s.Change, &s.ChangePct, &s.HighPrice, &s.LowPrice, &s.OpenPrice, &s.ClosePrice, &s.Volume,
		&s.Unit, &s.Contract, &s.Timestamp, &s.IsSuspicious, &s.SuspiciousReason,
		&s.HasMissingFields, &missingFieldsStr)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	s.MissingFields = splitStrings(missingFieldsStr)
	s.IsSuspicious = s.IsSuspicious
	return &s, nil
}

func (r *Repository) GetSnapshotsByRange(grainType models.GrainType, startTime, endTime time.Time) ([]models.MarketSnapshot, error) {
	rows, err := r.db.Query(`SELECT id, site_id, grain_type, price_type, price, prev_price,
		change, change_pct, high_price, low_price, open_price, close_price, volume,
		unit, contract, timestamp, is_suspicious, suspicious_reason, has_missing_fields, missing_fields
		FROM market_snapshots WHERE grain_type = ? AND timestamp >= ? AND timestamp < ?
		AND is_suspicious = 0 ORDER BY timestamp`,
		grainType, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snapshots []models.MarketSnapshot
	for rows.Next() {
		var s models.MarketSnapshot
		var missingFieldsStr string
		err := rows.Scan(&s.ID, &s.SiteID, &s.GrainType, &s.PriceType, &s.Price, &s.PrevPrice,
			&s.Change, &s.ChangePct, &s.HighPrice, &s.LowPrice, &s.OpenPrice, &s.ClosePrice, &s.Volume,
			&s.Unit, &s.Contract, &s.Timestamp, &s.IsSuspicious, &s.SuspiciousReason,
			&s.HasMissingFields, &missingFieldsStr)
		if err != nil {
			return nil, err
		}
		s.MissingFields = splitStrings(missingFieldsStr)
		snapshots = append(snapshots, s)
	}
	return snapshots, rows.Err()
}

func (r *Repository) SaveTaskLog(log *models.TaskLog) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO task_logs
		(task_id, site_id, start_time, end_time, duration_ms, status, http_status,
		 fields_count, total_fields, completeness, retry_count, error_message, snapshot_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		log.TaskID, log.SiteID, log.StartTime, log.EndTime, log.DurationMs,
		log.Status, log.HTTPStatus, log.FieldsCount, log.TotalFields,
		log.Completeness, log.RetryCount, log.ErrorMessage, log.SnapshotCount)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *Repository) GetTaskLogs(siteID string, days int) ([]models.TaskLog, error) {
	since := time.Now().AddDate(0, 0, -days)
	query := `SELECT id, task_id, site_id, start_time, end_time, duration_ms, status,
		http_status, fields_count, total_fields, completeness, retry_count, error_message, snapshot_count
		FROM task_logs WHERE start_time >= ?`
	args := []interface{}{since}

	if siteID != "" {
		query += " AND site_id = ?"
		args = append(args, siteID)
	}
	query += " ORDER BY start_time DESC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.TaskLog
	for rows.Next() {
		var log models.TaskLog
		err := rows.Scan(&log.ID, &log.TaskID, &log.SiteID, &log.StartTime, &log.EndTime,
			&log.DurationMs, &log.Status, &log.HTTPStatus, &log.FieldsCount,
			&log.TotalFields, &log.Completeness, &log.RetryCount, &log.ErrorMessage, &log.SnapshotCount)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	return logs, rows.Err()
}

func (r *Repository) GetSuccessRate(siteID string, days int) (float64, int, error) {
	since := time.Now().AddDate(0, 0, -days)
	var total int
	var success int

	err := r.db.QueryRow(`SELECT COUNT(*), SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)
		FROM task_logs WHERE start_time >= ? AND site_id = ?`, since, siteID).Scan(&total, &success)
	if err != nil {
		return 0, 0, err
	}
	if total == 0 {
		return 0, 0, nil
	}
	return float64(success) / float64(total) * 100, total, nil
}

func (r *Repository) GetRecentLowCompleteness(siteID string, threshold float64, count int) (int, error) {
	var n int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM (
		SELECT completeness FROM task_logs WHERE site_id = ? ORDER BY start_time DESC LIMIT ?
	) t WHERE completeness < ?`, siteID, count, threshold).Scan(&n)
	return n, err
}

func (r *Repository) SaveAlert(alert *models.AlertRecord) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO alert_records
		(alert_id, alert_type, site_id, grain_type, title, content, price, change_pct,
		 alert_time, notified, notify_method)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		alert.AlertID, alert.AlertType, alert.SiteID, alert.GrainType,
		alert.Title, alert.Content, alert.Price, alert.ChangePct,
		alert.AlertTime, boolToInt(alert.Notified), alert.NotifyMethod)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *Repository) HasRecentAlert(alertID string, window time.Duration) (bool, error) {
	since := time.Now().Add(-window)
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM alert_records WHERE alert_id = ? AND alert_time >= ?`,
		alertID, since).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *Repository) SaveSiteCookies(siteID string, cookies []byte, expiresAt *time.Time) error {
	now := time.Now()
	var exp interface{}
	if expiresAt != nil {
		exp = *expiresAt
	}

	var exists int
	r.db.QueryRow(`SELECT COUNT(*) FROM site_cookies WHERE site_id = ?`, siteID).Scan(&exists)

	if exists > 0 {
		_, err := r.db.Exec(`UPDATE site_cookies SET cookies = ?, updated_at = ?, expires_at = ? WHERE site_id = ?`,
			cookies, now, exp, siteID)
		return err
	}

	_, err := r.db.Exec(`INSERT INTO site_cookies (site_id, cookies, updated_at, expires_at) VALUES (?, ?, ?, ?)`,
		siteID, cookies, now, exp)
	return err
}

func (r *Repository) GetSiteCookies(siteID string) ([]byte, *time.Time, error) {
	var cookies []byte
	var expiresAt sql.NullTime
	err := r.db.QueryRow(`SELECT cookies, expires_at FROM site_cookies WHERE site_id = ?`, siteID).
		Scan(&cookies, &expiresAt)
	if err == sql.ErrNoRows {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}

	if expiresAt.Valid {
		t := expiresAt.Time
		return cookies, &t, nil
	}
	return cookies, nil, nil
}

func (r *Repository) RecordLoginFailure(siteID string, errorMsg string) error {
	_, err := r.db.Exec(`INSERT INTO login_failures (site_id, failure_time, error_message) VALUES (?, ?, ?)`,
		siteID, time.Now(), errorMsg)
	return err
}

func (r *Repository) GetRecentLoginFailures(siteID string, window time.Duration) (int, error) {
	since := time.Now().Add(-window)
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM login_failures WHERE site_id = ? AND failure_time >= ?`,
		siteID, since).Scan(&count)
	return count, err
}

func (r *Repository) ClearLoginFailures(siteID string) error {
	_, err := r.db.Exec(`DELETE FROM login_failures WHERE site_id = ?`, siteID)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func joinStrings(arr []string) string {
	if len(arr) == 0 {
		return ""
	}
	result := ""
	for i, s := range arr {
		if i > 0 {
			result += ","
		}
		result += s
	}
	return result
}

func splitStrings(s string) []string {
	if s == "" {
		return nil
	}
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	result = append(result, s[start:])
	return result
}
