package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"govresource-crawler/config"
	"govresource-crawler/logger"
	"govresource-crawler/model"
)

var ErrNotFound = errors.New("record not found")

const createAnnouncementsTable = `
CREATE TABLE IF NOT EXISTS announcements (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	url_hash TEXT NOT NULL UNIQUE,
	url TEXT NOT NULL,
	site_id TEXT NOT NULL,
	site_name TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT 'other',
	title TEXT NOT NULL,
	project_number TEXT DEFAULT '',
	budget TEXT DEFAULT '',
	budget_amount REAL DEFAULT 0,
	publish_date TEXT DEFAULT '',
	publish_time DATETIME,
	deadline TEXT DEFAULT '',
	deadline_time DATETIME,
	tenderer TEXT DEFAULT '',
	contact_person TEXT DEFAULT '',
	contact_phone TEXT DEFAULT '',
	requirements TEXT DEFAULT '',
	qualifications TEXT DEFAULT '',
	doc_price TEXT DEFAULT '',
	bid_open_info TEXT DEFAULT '',
	content TEXT DEFAULT '',
	status TEXT NOT NULL DEFAULT 'new',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

const createAnnouncementsIndexes = `
CREATE INDEX IF NOT EXISTS idx_ann_site_id ON announcements(site_id);
CREATE INDEX IF NOT EXISTS idx_ann_category ON announcements(category);
CREATE INDEX IF NOT EXISTS idx_ann_publish_time ON announcements(publish_time);
CREATE INDEX IF NOT EXISTS idx_ann_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_ann_title ON announcements(title);
`

const createCrawlStatesTable = `
CREATE TABLE IF NOT EXISTS crawl_states (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	site_id TEXT NOT NULL UNIQUE,
	last_url TEXT DEFAULT '',
	last_crawl_time DATETIME,
	last_count INTEGER DEFAULT 0,
	fail_streak INTEGER DEFAULT 0,
	status TEXT DEFAULT 'idle',
	resume_point TEXT DEFAULT '',
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

type Repository struct {
	db   *sql.DB
	path string
	mu   sync.RWMutex
}

var globalRepo *Repository
var once sync.Once

func NewRepository(cfg *config.DatabaseConfig) (*Repository, error) {
	var repo *Repository
	var initErr error

	once.Do(func() {
		dir := filepath.Dir(cfg.Path)
		if dir != "." && dir != "" {
			if err := os.MkdirAll(dir, 0755); err != nil {
				initErr = fmt.Errorf("create db dir: %w", err)
				return
			}
		}

		db, err := sql.Open("sqlite3", cfg.Path+"?_journal=WAL&_busy_timeout=5000&_foreign_keys=1")
		if err != nil {
			initErr = fmt.Errorf("open sqlite: %w", err)
			return
		}

		db.SetMaxOpenConns(cfg.MaxOpenConns)
		db.SetMaxIdleConns(cfg.MaxIdleConns)
		db.SetConnMaxLifetime(time.Hour)

		if err := db.Ping(); err != nil {
			db.Close()
			initErr = fmt.Errorf("ping db: %w", err)
			return
		}

		repo = &Repository{db: db, path: cfg.Path}

		if _, err := db.Exec(createAnnouncementsTable); err != nil {
			db.Close()
			initErr = fmt.Errorf("create announcements table: %w", err)
			return
		}
		if _, err := db.Exec(createAnnouncementsIndexes); err != nil {
			logger.Warnf("create indexes: %v", err)
		}
		if _, err := db.Exec(createCrawlStatesTable); err != nil {
			db.Close()
			initErr = fmt.Errorf("create crawl_states table: %w", err)
			return
		}

		globalRepo = repo
	})

	if initErr != nil {
		return nil, initErr
	}
	if repo != nil {
		return repo, nil
	}
	return globalRepo, nil
}

func GetRepository() *Repository {
	return globalRepo
}

func (r *Repository) Close() error {
	if r.db != nil {
		return r.db.Close()
	}
	return nil
}

func (r *Repository) DB() *sql.DB {
	return r.db
}

func (r *Repository) ExistsByURLHash(urlHash string) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM announcements WHERE url_hash = ?", urlHash).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check exists: %w", err)
	}
	return count > 0, nil
}

func (r *Repository) ExistsByTitleSimilarity(title string, siteID string, threshold float64) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	rows, err := r.db.Query(`SELECT title FROM announcements WHERE site_id = ? AND publish_time > datetime('now', '-30 days')`, siteID)
	if err != nil {
		return false, fmt.Errorf("query titles: %w", err)
	}
	defer rows.Close()

	titleLower := strings.ToLower(title)
	words1 := strings.Fields(titleLower)
	if len(words1) == 0 {
		return false, nil
	}

	for rows.Next() {
		var existing string
		if err := rows.Scan(&existing); err != nil {
			continue
		}
		sim := similarity(titleLower, strings.ToLower(existing), words1)
		if sim >= threshold {
			return true, nil
		}
	}
	return false, nil
}

func similarity(s1, s2 string, words1 []string) float64 {
	if s1 == s2 {
		return 1.0
	}
	words2 := strings.Fields(s2)
	if len(words2) == 0 {
		return 0.0
	}

	set1 := make(map[string]bool)
	for _, w := range words1 {
		if len(w) >= 2 {
			set1[w] = true
		}
	}
	set2 := make(map[string]bool)
	for _, w := range words2 {
		if len(w) >= 2 {
			set2[w] = true
		}
	}

	intersection := 0
	for w := range set1 {
		if set2[w] {
			intersection++
		}
	}

	union := len(set1) + len(set2) - intersection
	if union == 0 {
		return 0.0
	}
	return float64(intersection) / float64(union)
}

func (r *Repository) InsertAnnouncement(a *model.Announcement) (int64, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	a.ComputeURLHash()

	exists, err := r.existsByURLHashLocked(a.URLHash)
	if err != nil {
		return 0, false, err
	}
	if exists {
		return 0, false, nil
	}

	now := time.Now()
	if a.CreatedAt.IsZero() {
		a.CreatedAt = now
	}
	a.UpdatedAt = now
	if a.Status == "" {
		a.Status = model.StatusNew
	}

	result, err := r.db.Exec(`
		INSERT INTO announcements (
			url_hash, url, site_id, site_name, category, title,
			project_number, budget, budget_amount, publish_date, publish_time,
			deadline, deadline_time, tenderer, contact_person, contact_phone,
			requirements, qualifications, doc_price, bid_open_info, content,
			status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		a.URLHash, a.URL, a.SiteID, a.SiteName, string(a.Category), a.Title,
		a.ProjectNumber, a.Budget, a.BudgetAmount, a.PublishDate, a.PublishTime,
		a.Deadline, a.DeadlineTime, a.Tenderer, a.ContactPerson, a.ContactPhone,
		a.Requirements, a.Qualifications, a.DocPrice, a.BidOpenInfo, a.Content,
		string(a.Status), a.CreatedAt, a.UpdatedAt,
	)
	if err != nil {
		return 0, false, fmt.Errorf("insert announcement: %w", err)
	}

	id, _ := result.LastInsertId()
	a.ID = id
	a.IsNew = true
	return id, true, nil
}

func (r *Repository) existsByURLHashLocked(urlHash string) (bool, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM announcements WHERE url_hash = ?", urlHash).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check exists locked: %w", err)
	}
	return count > 0, nil
}

func (r *Repository) UpdateAnnouncement(a *model.Announcement) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	a.UpdatedAt = time.Now()
	_, err := r.db.Exec(`
		UPDATE announcements SET
			title = ?, category = ?, project_number = ?, budget = ?, budget_amount = ?,
			publish_date = ?, publish_time = ?, deadline = ?, deadline_time = ?,
			tenderer = ?, contact_person = ?, contact_phone = ?,
			requirements = ?, qualifications = ?, doc_price = ?, bid_open_info = ?,
			content = ?, status = ?, updated_at = ?
		WHERE id = ?
	`,
		a.Title, string(a.Category), a.ProjectNumber, a.Budget, a.BudgetAmount,
		a.PublishDate, a.PublishTime, a.Deadline, a.DeadlineTime,
		a.Tenderer, a.ContactPerson, a.ContactPhone,
		a.Requirements, a.Qualifications, a.DocPrice, a.BidOpenInfo,
		a.Content, string(a.Status), a.UpdatedAt, a.ID,
	)
	if err != nil {
		return fmt.Errorf("update announcement: %w", err)
	}
	return nil
}

func (r *Repository) GetAnnouncementByID(id int64) (*model.Announcement, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	row := r.db.QueryRow(`
		SELECT id, url_hash, url, site_id, site_name, category, title,
			project_number, budget, budget_amount, publish_date, publish_time,
			deadline, deadline_time, tenderer, contact_person, contact_phone,
			requirements, qualifications, doc_price, bid_open_info, content,
			status, created_at, updated_at
		FROM announcements WHERE id = ?
	`, id)

	a := &model.Announcement{}
	var cat, status string
	err := row.Scan(
		&a.ID, &a.URLHash, &a.URL, &a.SiteID, &a.SiteName, &cat, &a.Title,
		&a.ProjectNumber, &a.Budget, &a.BudgetAmount, &a.PublishDate, &a.PublishTime,
		&a.Deadline, &a.DeadlineTime, &a.Tenderer, &a.ContactPerson, &a.ContactPhone,
		&a.Requirements, &a.Qualifications, &a.DocPrice, &a.BidOpenInfo, &a.Content,
		&status, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get announcement: %w", err)
	}
	a.Category = model.AnnounceType(cat)
	a.Status = model.AnnounceStatus(status)
	return a, nil
}

type QueryFilter struct {
	StartDate  string
	EndDate    string
	Category   model.AnnounceType
	Keyword    string
	SiteID     string
	Status     model.AnnounceStatus
	Limit      int
	Offset     int
	OrderBy    string
	OrderDesc  bool
}

func (r *Repository) QueryAnnouncements(f QueryFilter) ([]*model.Announcement, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var where []string
	var args []interface{}

	if f.StartDate != "" {
		where = append(where, "date(publish_time) >= date(?)")
		args = append(args, f.StartDate)
	}
	if f.EndDate != "" {
		where = append(where, "date(publish_time) <= date(?)")
		args = append(args, f.EndDate)
	}
	if f.Category != "" {
		where = append(where, "category = ?")
		args = append(args, string(f.Category))
	}
	if f.SiteID != "" {
		where = append(where, "site_id = ?")
		args = append(args, f.SiteID)
	}
	if f.Status != "" {
		where = append(where, "status = ?")
		args = append(args, string(f.Status))
	}
	if f.Keyword != "" {
		where = append(where, "(title LIKE ? OR content LIKE ? OR tenderer LIKE ?)")
		kw := "%" + f.Keyword + "%"
		args = append(args, kw, kw, kw)
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	orderClause := "ORDER BY publish_time DESC"
	if f.OrderBy != "" {
		direction := "ASC"
		if f.OrderDesc {
			direction = "DESC"
		}
		orderClause = fmt.Sprintf("ORDER BY %s %s", f.OrderBy, direction)
	}

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM announcements %s", whereClause)
	var total int
	if err := r.db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count query: %w", err)
	}

	limitClause := ""
	if f.Limit > 0 {
		limitClause = fmt.Sprintf("LIMIT %d", f.Limit)
		if f.Offset > 0 {
			limitClause += fmt.Sprintf(" OFFSET %d", f.Offset)
		}
	}

	querySQL := fmt.Sprintf(`
		SELECT id, url_hash, url, site_id, site_name, category, title,
			project_number, budget, budget_amount, publish_date, publish_time,
			deadline, deadline_time, tenderer, contact_person, contact_phone,
			requirements, qualifications, doc_price, bid_open_info, content,
			status, created_at, updated_at
		FROM announcements %s %s %s
	`, whereClause, orderClause, limitClause)

	rows, err := r.db.Query(querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query announcements: %w", err)
	}
	defer rows.Close()

	var list []*model.Announcement
	for rows.Next() {
		a := &model.Announcement{}
		var cat, status string
		err := rows.Scan(
			&a.ID, &a.URLHash, &a.URL, &a.SiteID, &a.SiteName, &cat, &a.Title,
			&a.ProjectNumber, &a.Budget, &a.BudgetAmount, &a.PublishDate, &a.PublishTime,
			&a.Deadline, &a.DeadlineTime, &a.Tenderer, &a.ContactPerson, &a.ContactPhone,
			&a.Requirements, &a.Qualifications, &a.DocPrice, &a.BidOpenInfo, &a.Content,
			&status, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan row: %w", err)
		}
		a.Category = model.AnnounceType(cat)
		a.Status = model.AnnounceStatus(status)
		list = append(list, a)
	}
	return list, total, nil
}

func (r *Repository) GetCrawlState(siteID string) (*model.CrawlState, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	row := r.db.QueryRow(`
		SELECT id, site_id, last_url, last_crawl_time, last_count, fail_streak, status, resume_point, updated_at
		FROM crawl_states WHERE site_id = ?
	`, siteID)

	s := &model.CrawlState{}
	var lastCrawlTime, updatedAt sql.NullTime
	var lastURL, resumePoint sql.NullString
	err := row.Scan(
		&s.ID, &s.SiteID, &lastURL, &lastCrawlTime, &s.LastCount,
		&s.FailStreak, &s.Status, &resumePoint, &updatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get crawl state: %w", err)
	}
	if lastCrawlTime.Valid {
		s.LastCrawlTime = lastCrawlTime.Time
	}
	if updatedAt.Valid {
		s.UpdatedAt = updatedAt.Time
	}
	s.LastURL = lastURL.String
	s.ResumePoint = resumePoint.String
	return s, nil
}

func (r *Repository) UpsertCrawlState(s *model.CrawlState) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	s.UpdatedAt = now

	result, err := r.db.Exec(`
		INSERT INTO crawl_states (site_id, last_url, last_crawl_time, last_count, fail_streak, status, resume_point, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(site_id) DO UPDATE SET
			last_url = excluded.last_url,
			last_crawl_time = excluded.last_crawl_time,
			last_count = excluded.last_count,
			fail_streak = excluded.fail_streak,
			status = excluded.status,
			resume_point = excluded.resume_point,
			updated_at = excluded.updated_at
	`,
		s.SiteID, s.LastURL, s.LastCrawlTime, s.LastCount,
		s.FailStreak, s.Status, s.ResumePoint, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("upsert crawl state: %w", err)
	}
	if s.ID == 0 {
		id, _ := result.LastInsertId()
		s.ID = id
	}
	return nil
}

func (r *Repository) IncrementFailStreak(siteID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, err := r.db.Exec(`
		INSERT INTO crawl_states (site_id, fail_streak, status, updated_at)
		VALUES (?, 1, 'failed', CURRENT_TIMESTAMP)
		ON CONFLICT(site_id) DO UPDATE SET
			fail_streak = fail_streak + 1,
			status = 'failed',
			updated_at = CURRENT_TIMESTAMP
	`, siteID)
	if err != nil {
		return 0, fmt.Errorf("increment fail streak: %w", err)
	}

	var streak int
	err = r.db.QueryRow("SELECT fail_streak FROM crawl_states WHERE site_id = ?", siteID).Scan(&streak)
	if err != nil {
		return 0, fmt.Errorf("get fail streak: %w", err)
	}
	return streak, nil
}

func (r *Repository) ResetFailStreak(siteID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, err := r.db.Exec(`
		INSERT INTO crawl_states (site_id, fail_streak, status, updated_at)
		VALUES (?, 0, 'success', CURRENT_TIMESTAMP)
		ON CONFLICT(site_id) DO UPDATE SET
			fail_streak = 0,
			status = 'success',
			updated_at = CURRENT_TIMESTAMP
	`, siteID)
	if err != nil {
		return fmt.Errorf("reset fail streak: %w", err)
	}
	return nil
}

func (r *Repository) BatchInsertAnnouncements(items []*model.Announcement) (int, int, error) {
	newCount := 0
	skipCount := 0

	for _, a := range items {
		_, isNew, err := r.InsertAnnouncement(a)
		if err != nil {
			logger.Errorf("batch insert item %s: %v", a.Title, err)
			continue
		}
		if isNew {
			newCount++
		} else {
			skipCount++
		}
	}
	return newCount, skipCount, nil
}

func (r *Repository) CountTotal() (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM announcements").Scan(&count)
	return count, err
}

func (r *Repository) CountToday() (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM announcements WHERE date(created_at) = date('now', 'localtime')
	`).Scan(&count)
	return count, err
}

func (r *Repository) GetStatsBySite() (map[string]int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	rows, err := r.db.Query(`
		SELECT site_id, COUNT(*) FROM announcements GROUP BY site_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]int)
	for rows.Next() {
		var siteID string
		var count int
		if err := rows.Scan(&siteID, &count); err == nil {
			stats[siteID] = count
		}
	}
	return stats, nil
}
