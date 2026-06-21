package storage

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"copyright-monitor/internal/config"
	"copyright-monitor/internal/models"

	_ "github.com/mattn/go-sqlite3"
)

type Storage struct {
	db *sql.DB
}

var globalStorage *Storage

func New(dbPath string) (*Storage, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	s := &Storage{db: db}
	if err := s.initTables(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

func InitGlobal() error {
	s, err := New(config.Get().DatabasePath)
	if err != nil {
		return err
	}
	globalStorage = s
	return nil
}

func Global() *Storage {
	return globalStorage
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func (s *Storage) initTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS copyright_works (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			work_type TEXT NOT NULL,
			owner TEXT NOT NULL,
			owner_contact TEXT,
			registration_no TEXT UNIQUE,
			completion_date DATETIME,
			registration_date DATETIME,
			fingerprint INTEGER DEFAULT 0,
			content_hash TEXT,
			description TEXT,
			is_hot INTEGER DEFAULT 0,
			infringement_count INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS platform_sources (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			type TEXT NOT NULL,
			base_url TEXT,
			list_url_pattern TEXT,
			list_selector TEXT,
			detail_selector TEXT,
			title_selector TEXT,
			content_selector TEXT,
			request_delay INTEGER DEFAULT 2,
			max_concurrency INTEGER DEFAULT 3,
			enabled INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS monitor_tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			work_id INTEGER,
			work_title TEXT,
			work_type TEXT,
			priority INTEGER DEFAULT 2,
			platform_ids TEXT,
			cron_expr TEXT,
			last_run_time DATETIME,
			next_run_time DATETIME,
			status TEXT DEFAULT 'pending',
			failure_count INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS crawled_contents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			platform_id INTEGER,
			platform_name TEXT,
			url TEXT,
			title TEXT,
			content TEXT,
			author TEXT,
			publish_time DATETIME,
			crawl_time DATETIME,
			fingerprint INTEGER DEFAULT 0,
			raw_html TEXT,
			http_headers TEXT,
			status TEXT DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS infringement_clues (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id INTEGER,
			work_id INTEGER,
			work_title TEXT,
			work_type TEXT,
			owner TEXT,
			owner_contact TEXT,
			registration_no TEXT,
			platform_name TEXT,
			infringement_url TEXT,
			infringement_title TEXT,
			similarity REAL DEFAULT 0,
			evidence_id INTEGER,
			discover_time DATETIME,
			status TEXT DEFAULT 'pending',
			report_batch_no TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS evidences (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			clue_id INTEGER,
			url TEXT,
			screenshot_base64 TEXT,
			raw_html TEXT,
			http_headers TEXT,
			crawl_time DATETIME,
			evidence_hash TEXT,
			report_path TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS monitor_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id INTEGER,
			platform_id INTEGER,
			platform_name TEXT,
			start_time DATETIME,
			end_time DATETIME,
			status TEXT,
			items_found INTEGER DEFAULT 0,
			infringements_found INTEGER DEFAULT 0,
			error_message TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_works_fingerprint ON copyright_works(fingerprint)`,
		`CREATE INDEX IF NOT EXISTS idx_works_type ON copyright_works(work_type)`,
		`CREATE INDEX IF NOT EXISTS idx_clues_status ON infringement_clues(status)`,
		`CREATE INDEX IF NOT EXISTS idx_clues_discover_time ON infringement_clues(discover_time)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_status ON monitor_tasks(status)`,
		`CREATE INDEX IF NOT EXISTS idx_logs_platform ON monitor_logs(platform_id)`,
		`CREATE INDEX IF NOT EXISTS idx_crawled_fp ON crawled_contents(fingerprint)`,
	}

	for _, schema := range schemas {
		if _, err := s.db.Exec(schema); err != nil {
			return fmt.Errorf("create table: %w", err)
		}
	}

	return nil
}

func (s *Storage) AddWork(work *models.CopyrightWork) (int64, error) {
	result, err := s.db.Exec(`INSERT INTO copyright_works 
		(title, work_type, owner, owner_contact, registration_no, completion_date, 
		 registration_date, fingerprint, content_hash, description, is_hot, infringement_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		work.Title, work.WorkType, work.Owner, work.OwnerContact, work.RegistrationNo,
		work.CompletionDate, work.RegistrationDate, work.Fingerprint, work.ContentHash,
		work.Description, work.IsHot, work.InfringementCount)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) GetWork(id int64) (*models.CopyrightWork, error) {
	row := s.db.QueryRow(`SELECT id, title, work_type, owner, owner_contact, registration_no,
		completion_date, registration_date, fingerprint, content_hash, description, is_hot,
		infringement_count, created_at, updated_at FROM copyright_works WHERE id = ?`, id)

	work := &models.CopyrightWork{}
	err := row.Scan(&work.ID, &work.Title, &work.WorkType, &work.Owner, &work.OwnerContact,
		&work.RegistrationNo, &work.CompletionDate, &work.RegistrationDate, &work.Fingerprint,
		&work.ContentHash, &work.Description, &work.IsHot, &work.InfringementCount,
		&work.CreatedAt, &work.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return work, err
}

func (s *Storage) GetAllWorks() ([]*models.CopyrightWork, error) {
	rows, err := s.db.Query(`SELECT id, title, work_type, owner, owner_contact, registration_no,
		completion_date, registration_date, fingerprint, content_hash, description, is_hot,
		infringement_count, created_at, updated_at FROM copyright_works`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var works []*models.CopyrightWork
	for rows.Next() {
		work := &models.CopyrightWork{}
		err := rows.Scan(&work.ID, &work.Title, &work.WorkType, &work.Owner, &work.OwnerContact,
			&work.RegistrationNo, &work.CompletionDate, &work.RegistrationDate, &work.Fingerprint,
			&work.ContentHash, &work.Description, &work.IsHot, &work.InfringementCount,
			&work.CreatedAt, &work.UpdatedAt)
		if err != nil {
			return nil, err
		}
		works = append(works, work)
	}
	return works, nil
}

func (s *Storage) GetWorksByType(workType models.WorkType) ([]*models.CopyrightWork, error) {
	rows, err := s.db.Query(`SELECT id, title, work_type, owner, owner_contact, registration_no,
		completion_date, registration_date, fingerprint, content_hash, description, is_hot,
		infringement_count, created_at, updated_at FROM copyright_works WHERE work_type = ?`, workType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var works []*models.CopyrightWork
	for rows.Next() {
		work := &models.CopyrightWork{}
		err := rows.Scan(&work.ID, &work.Title, &work.WorkType, &work.Owner, &work.OwnerContact,
			&work.RegistrationNo, &work.CompletionDate, &work.RegistrationDate, &work.Fingerprint,
			&work.ContentHash, &work.Description, &work.IsHot, &work.InfringementCount,
			&work.CreatedAt, &work.UpdatedAt)
		if err != nil {
			return nil, err
		}
		works = append(works, work)
	}
	return works, nil
}

func (s *Storage) GetWorkCount() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM copyright_works").Scan(&count)
	return count, err
}

func (s *Storage) AddPlatform(platform *models.PlatformSource) (int64, error) {
	result, err := s.db.Exec(`INSERT INTO platform_sources 
		(name, type, base_url, list_url_pattern, list_selector, detail_selector,
		 title_selector, content_selector, request_delay, max_concurrency, enabled)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		platform.Name, platform.Type, platform.BaseURL, platform.ListURLPattern,
		platform.ListSelector, platform.DetailSelector, platform.TitleSelector,
		platform.ContentSelector, platform.RequestDelay, platform.MaxConcurrency, platform.Enabled)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) GetPlatform(id int64) (*models.PlatformSource, error) {
	row := s.db.QueryRow(`SELECT id, name, type, base_url, list_url_pattern, list_selector,
		detail_selector, title_selector, content_selector, request_delay, max_concurrency,
		enabled, created_at, updated_at FROM platform_sources WHERE id = ?`, id)

	p := &models.PlatformSource{}
	err := row.Scan(&p.ID, &p.Name, &p.Type, &p.BaseURL, &p.ListURLPattern, &p.ListSelector,
		&p.DetailSelector, &p.TitleSelector, &p.ContentSelector, &p.RequestDelay,
		&p.MaxConcurrency, &p.Enabled, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (s *Storage) GetAllPlatforms() ([]*models.PlatformSource, error) {
	rows, err := s.db.Query(`SELECT id, name, type, base_url, list_url_pattern, list_selector,
		detail_selector, title_selector, content_selector, request_delay, max_concurrency,
		enabled, created_at, updated_at FROM platform_sources ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var platforms []*models.PlatformSource
	for rows.Next() {
		p := &models.PlatformSource{}
		err := rows.Scan(&p.ID, &p.Name, &p.Type, &p.BaseURL, &p.ListURLPattern, &p.ListSelector,
			&p.DetailSelector, &p.TitleSelector, &p.ContentSelector, &p.RequestDelay,
			&p.MaxConcurrency, &p.Enabled, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		platforms = append(platforms, p)
	}
	return platforms, nil
}

func (s *Storage) GetEnabledPlatforms() ([]*models.PlatformSource, error) {
	rows, err := s.db.Query(`SELECT id, name, type, base_url, list_url_pattern, list_selector,
		detail_selector, title_selector, content_selector, request_delay, max_concurrency,
		enabled, created_at, updated_at FROM platform_sources WHERE enabled = 1 ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var platforms []*models.PlatformSource
	for rows.Next() {
		p := &models.PlatformSource{}
		err := rows.Scan(&p.ID, &p.Name, &p.Type, &p.BaseURL, &p.ListURLPattern, &p.ListSelector,
			&p.DetailSelector, &p.TitleSelector, &p.ContentSelector, &p.RequestDelay,
			&p.MaxConcurrency, &p.Enabled, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		platforms = append(platforms, p)
	}
	return platforms, nil
}

func (s *Storage) AddTask(task *models.MonitorTask) (int64, error) {
	platformIDsJSON, _ := json.Marshal(task.PlatformIDs)
	result, err := s.db.Exec(`INSERT INTO monitor_tasks 
		(work_id, work_title, work_type, priority, platform_ids, cron_expr, 
		 last_run_time, next_run_time, status, failure_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		task.WorkID, task.WorkTitle, task.WorkType, task.Priority,
		string(platformIDsJSON), task.CronExpr, task.LastRunTime, task.NextRunTime,
		task.Status, task.FailureCount)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) UpdateTask(task *models.MonitorTask) error {
	platformIDsJSON, _ := json.Marshal(task.PlatformIDs)
	_, err := s.db.Exec(`UPDATE monitor_tasks SET 
		work_id=?, work_title=?, work_type=?, priority=?, platform_ids=?, cron_expr=?,
		last_run_time=?, next_run_time=?, status=?, failure_count=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=?`,
		task.WorkID, task.WorkTitle, task.WorkType, task.Priority,
		string(platformIDsJSON), task.CronExpr, task.LastRunTime, task.NextRunTime,
		task.Status, task.FailureCount, task.ID)
	return err
}

func (s *Storage) GetPendingTasks() ([]*models.MonitorTask, error) {
	rows, err := s.db.Query(`SELECT id, work_id, work_title, work_type, priority, platform_ids,
		cron_expr, last_run_time, next_run_time, status, failure_count, created_at, updated_at 
		FROM monitor_tasks WHERE status = 'pending' OR status = 'scheduled'
		ORDER BY priority DESC, next_run_time ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*models.MonitorTask
	for rows.Next() {
		task := &models.MonitorTask{}
		var platformIDsStr string
		err := rows.Scan(&task.ID, &task.WorkID, &task.WorkTitle, &task.WorkType, &task.Priority,
			&platformIDsStr, &task.CronExpr, &task.LastRunTime, &task.NextRunTime,
			&task.Status, &task.FailureCount, &task.CreatedAt, &task.UpdatedAt)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(platformIDsStr), &task.PlatformIDs)
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func (s *Storage) AddCrawledContent(content *models.CrawledContent) (int64, error) {
	result, err := s.db.Exec(`INSERT INTO crawled_contents 
		(platform_id, platform_name, url, title, content, author, publish_time,
		 crawl_time, fingerprint, raw_html, http_headers, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		content.PlatformID, content.PlatformName, content.URL, content.Title, content.Content,
		content.Author, content.PublishTime, content.CrawlTime, content.Fingerprint,
		content.RawHTML, content.HTTPHeaders, content.Status)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) AddClue(clue *models.InfringementClue) (int64, error) {
	result, err := s.db.Exec(`INSERT INTO infringement_clues 
		(task_id, work_id, work_title, work_type, owner, owner_contact, registration_no,
		 platform_name, infringement_url, infringement_title, similarity, evidence_id,
		 discover_time, status, report_batch_no)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		clue.TaskID, clue.WorkID, clue.WorkTitle, clue.WorkType, clue.Owner, clue.OwnerContact,
		clue.RegistrationNo, clue.PlatformName, clue.InfringementURL, clue.InfringementTitle,
		clue.Similarity, clue.EvidenceID, clue.DiscoverTime, clue.Status, clue.ReportBatchNo)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) GetPendingClues() ([]*models.InfringementClue, error) {
	rows, err := s.db.Query(`SELECT id, task_id, work_id, work_title, work_type, owner,
		owner_contact, registration_no, platform_name, infringement_url, infringement_title,
		similarity, evidence_id, discover_time, status, report_batch_no, created_at, updated_at
		FROM infringement_clues WHERE status = 'pending' ORDER BY discover_time DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clues []*models.InfringementClue
	for rows.Next() {
		clue := &models.InfringementClue{}
		err := rows.Scan(&clue.ID, &clue.TaskID, &clue.WorkID, &clue.WorkTitle, &clue.WorkType,
			&clue.Owner, &clue.OwnerContact, &clue.RegistrationNo, &clue.PlatformName,
			&clue.InfringementURL, &clue.InfringementTitle, &clue.Similarity, &clue.EvidenceID,
			&clue.DiscoverTime, &clue.Status, &clue.ReportBatchNo, &clue.CreatedAt, &clue.UpdatedAt)
		if err != nil {
			return nil, err
		}
		clues = append(clues, clue)
	}
	return clues, nil
}

func (s *Storage) GetRecentClues(limit int) ([]*models.InfringementClue, error) {
	rows, err := s.db.Query(`SELECT id, task_id, work_id, work_title, work_type, owner,
		owner_contact, registration_no, platform_name, infringement_url, infringement_title,
		similarity, evidence_id, discover_time, status, report_batch_no, created_at, updated_at
		FROM infringement_clues ORDER BY discover_time DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clues []*models.InfringementClue
	for rows.Next() {
		clue := &models.InfringementClue{}
		err := rows.Scan(&clue.ID, &clue.TaskID, &clue.WorkID, &clue.WorkTitle, &clue.WorkType,
			&clue.Owner, &clue.OwnerContact, &clue.RegistrationNo, &clue.PlatformName,
			&clue.InfringementURL, &clue.InfringementTitle, &clue.Similarity, &clue.EvidenceID,
			&clue.DiscoverTime, &clue.Status, &clue.ReportBatchNo, &clue.CreatedAt, &clue.UpdatedAt)
		if err != nil {
			return nil, err
		}
		clues = append(clues, clue)
	}
	return clues, nil
}

func (s *Storage) GetPendingClueCount() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM infringement_clues WHERE status = 'pending'").Scan(&count)
	return count, err
}

func (s *Storage) AddEvidence(evidence *models.Evidence) (int64, error) {
	result, err := s.db.Exec(`INSERT INTO evidences 
		(clue_id, url, screenshot_base64, raw_html, http_headers, crawl_time, evidence_hash, report_path)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		evidence.ClueID, evidence.URL, evidence.ScreenshotBase64, evidence.RawHTML,
		evidence.HTTPHeaders, evidence.CrawlTime, evidence.EvidenceHash, evidence.ReportPath)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) SaveEvidenceReport(clueID int64, reportPath string) error {
	_, err := s.db.Exec(`UPDATE evidences SET report_path = ? WHERE clue_id = ?`, reportPath, clueID)
	return err
}

func (s *Storage) AddMonitorLog(log *models.MonitorLog) (int64, error) {
	result, err := s.db.Exec(`INSERT INTO monitor_logs 
		(task_id, platform_id, platform_name, start_time, end_time, status,
		 items_found, infringements_found, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		log.TaskID, log.PlatformID, log.PlatformName, log.StartTime, log.EndTime,
		log.Status, log.ItemsFound, log.InfringementsFound, log.ErrorMessage)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) GetPlatformStats(days int) ([]*models.PlatformStat, error) {
	rows, err := s.db.Query(`SELECT p.id, p.name,
		COUNT(l.id) as total_runs,
		SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) as failed_runs
		FROM platform_sources p
		LEFT JOIN monitor_logs l ON p.id = l.platform_id AND l.created_at >= datetime('now', ?)
		WHERE p.enabled = 1
		GROUP BY p.id, p.name`, fmt.Sprintf("-%d days", days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*models.PlatformStat
	for rows.Next() {
		stat := &models.PlatformStat{}
		var totalRuns, failedRuns int
		err := rows.Scan(&stat.PlatformID, &stat.PlatformName, &totalRuns, &failedRuns)
		if err != nil {
			return nil, err
		}
		stat.TotalRuns = totalRuns
		stat.FailedRuns = failedRuns
		if totalRuns > 0 {
			stat.SuccessRate = float64(totalRuns-failedRuns) / float64(totalRuns) * 100
		}
		stats = append(stats, stat)
	}
	return stats, nil
}

func (s *Storage) GetSystemStatus() (*models.SystemStatus, error) {
	status := &models.SystemStatus{}

	s.db.QueryRow("SELECT COUNT(*) FROM copyright_works").Scan(&status.TotalWorks)
	s.db.QueryRow("SELECT COUNT(*) FROM platform_sources WHERE enabled = 1").Scan(&status.TotalPlatforms)
	s.db.QueryRow("SELECT COUNT(*) FROM monitor_tasks WHERE status = 'running'").Scan(&status.ActiveTasks)
	s.db.QueryRow("SELECT COUNT(*) FROM infringement_clues WHERE status = 'pending'").Scan(&status.PendingClues)

	stats, err := s.GetPlatformStats(7)
	if err != nil {
		return nil, err
	}
	status.PlatformStats = stats

	clues, err := s.GetRecentClues(10)
	if err != nil {
		return nil, err
	}
	status.RecentInfringements = clues

	return status, nil
}

func (s *Storage) GenerateEvidenceFile(clue *models.InfringementClue, content *models.CrawledContent) (string, error) {
	evidenceDir := config.Get().EvidenceDir
	if err := os.MkdirAll(evidenceDir, 0755); err != nil {
		return "", err
	}

	reportID := fmt.Sprintf("evidence_%d_%s", clue.ID, time.Now().Format("20060102_150405"))
	report := map[string]interface{}{
		"report_id":       reportID,
		"generated_at":    time.Now().Format(time.RFC3339),
		"clue_id":         clue.ID,
		"work_info": map[string]interface{}{
			"work_id":         clue.WorkID,
			"work_title":      clue.WorkTitle,
			"work_type":       clue.WorkType,
			"owner":           clue.Owner,
			"registration_no": clue.RegistrationNo,
		},
		"infringement": map[string]interface{}{
			"platform":     clue.PlatformName,
			"url":          clue.InfringementURL,
			"title":        clue.InfringementTitle,
			"similarity":   clue.Similarity,
			"discover_time": clue.DiscoverTime.Format(time.RFC3339),
		},
		"evidence": map[string]interface{}{
			"crawl_time":   content.CrawlTime.Format(time.RFC3339),
			"http_headers": content.HTTPHeaders,
			"raw_html":     content.RawHTML,
			"content":      content.Content,
		},
		"evidence_hash": generateHash(content),
	}

	reportData, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}

	fileName := fmt.Sprintf("%s.json", reportID)
	filePath := filepath.Join(evidenceDir, fileName)
	if err := os.WriteFile(filePath, reportData, 0644); err != nil {
		return "", err
	}

	return filePath, nil
}

func generateHash(content *models.CrawledContent) string {
	h := sha256.New()
	h.Write([]byte(content.URL))
	h.Write([]byte(content.CrawlTime.Format(time.RFC3339)))
	h.Write([]byte(content.RawHTML))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Storage) GetCluesByTimeRange(start, end time.Time) ([]*models.InfringementClue, error) {
	rows, err := s.db.Query(`SELECT id, task_id, work_id, work_title, work_type, owner,
		owner_contact, registration_no, platform_name, infringement_url, infringement_title,
		similarity, evidence_id, discover_time, status, report_batch_no, created_at, updated_at
		FROM infringement_clues WHERE discover_time BETWEEN ? AND ? ORDER BY discover_time DESC`,
		start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clues []*models.InfringementClue
	for rows.Next() {
		clue := &models.InfringementClue{}
		err := rows.Scan(&clue.ID, &clue.TaskID, &clue.WorkID, &clue.WorkTitle, &clue.WorkType,
			&clue.Owner, &clue.OwnerContact, &clue.RegistrationNo, &clue.PlatformName,
			&clue.InfringementURL, &clue.InfringementTitle, &clue.Similarity, &clue.EvidenceID,
			&clue.DiscoverTime, &clue.Status, &clue.ReportBatchNo, &clue.CreatedAt, &clue.UpdatedAt)
		if err != nil {
			return nil, err
		}
		clues = append(clues, clue)
	}
	return clues, nil
}

func (s *Storage) IncrementInfringementCount(workID int64) error {
	_, err := s.db.Exec(`UPDATE copyright_works SET infringement_count = infringement_count + 1,
		updated_at = CURRENT_TIMESTAMP WHERE id = ?`, workID)
	return err
}
