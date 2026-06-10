package storage

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"modernc.org/sqlite"

	"github.com/security/vulnmonitor/internal/logger"
	"github.com/security/vulnmonitor/internal/retry"
)

type Severity string

const (
	SeverityCritical Severity = "CRITICAL"
	SeverityHigh     Severity = "HIGH"
	SeverityMedium   Severity = "MEDIUM"
	SeverityLow      Severity = "LOW"
)

type SourceStatus string

const (
	SourceStatusOK       SourceStatus = "OK"
	SourceStatusDegraded SourceStatus = "DEGRADED"
	SourceStatusError    SourceStatus = "ERROR"
)

type Vulnerability struct {
	ID            string      `json:"id"`
	CVEID         string      `json:"cve_id"`
	Source        string      `json:"source"`
	Title         string      `json:"title"`
	Description   string      `json:"description"`
	Severity      Severity    `json:"severity"`
	CVSSScore     float64     `json:"cvss_score"`
	CVSSVector    string      `json:"cvss_vector"`
	Component     string      `json:"component"`
	AffectedRange string      `json:"affected_range"`
	FixedVersion  string      `json:"fixed_version"`
	References    []string    `json:"references"`
	CWEs          []string    `json:"cwes"`
	PublishedAt   time.Time   `json:"published_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	DiscoveredAt  time.Time   `json:"discovered_at"`
	Notified      bool        `json:"notified"`
	AffectedAssets []string   `json:"affected_assets,omitempty"`
	RawData       interface{} `json:"raw_data,omitempty"`
}

type Asset struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Component     string    `json:"component"`
	Version       string    `json:"version"`
	VersionRange  string    `json:"version_range"`
	Environment   string    `json:"environment"`
	Owner         string    `json:"owner"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	LastScannedAt time.Time `json:"last_scanned_at"`
}

type Source struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Type          string       `json:"type"`
	URL           string       `json:"url"`
	Enabled       bool         `json:"enabled"`
	Status        SourceStatus `json:"status"`
	LastCrawledAt time.Time    `json:"last_crawled_at"`
	LastSuccessAt time.Time    `json:"last_success_at"`
	LastError     string       `json:"last_error"`
	TotalRecords  int64        `json:"total_records"`
	SuccessCount  int64        `json:"success_count"`
	ErrorCount    int64        `json:"error_count"`
	Config        interface{}  `json:"config,omitempty"`
}

type CrawlCursor struct {
	SourceID   string    `json:"source_id"`
	Cursor     string    `json:"cursor"`
	LastItemID string    `json:"last_item_id"`
	LastItemTS time.Time `json:"last_item_ts"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Config struct {
	DBPath       string `yaml:"db_path"`
	MaxOpenConns int    `yaml:"max_open_conns"`
	MaxIdleConns int    `yaml:"max_idle_conns"`
	MaxLifetime  int    `yaml:"max_lifetime_seconds"`
}

type Storage struct {
	db      *sql.DB
	cfg     Config
	log     *logger.Logger
	retryer *retry.Retryer
	mu      sync.RWMutex
}

func init() {
	sql.Register("sqlite3_custom", &sqlite.Driver{})
}

func New(cfg Config, log *logger.Logger, retryer *retry.Retryer) (*Storage, error) {
	if log == nil {
		log = logger.Default()
	}
	if retryer == nil {
		retryer = retry.New(retry.DefaultConfig(), log)
	}

	if cfg.MaxOpenConns == 0 {
		cfg.MaxOpenConns = 10
	}
	if cfg.MaxIdleConns == 0 {
		cfg.MaxIdleConns = 5
	}
	if cfg.MaxLifetime == 0 {
		cfg.MaxLifetime = 3600
	}

	dbDir := filepath.Dir(cfg.DBPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)", cfg.DBPath)
	db, err := sql.Open("sqlite3_custom", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(cfg.MaxLifetime) * time.Second)

	s := &Storage{db: db, cfg: cfg, log: log, retryer: retryer}
	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}

	return s, nil
}

func (s *Storage) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS vulnerabilities (
		id TEXT PRIMARY KEY,
		cve_id TEXT NOT NULL,
		source TEXT NOT NULL,
		title TEXT,
		description TEXT,
		severity TEXT NOT NULL,
		cvss_score REAL DEFAULT 0,
		cvss_vector TEXT,
		component TEXT,
		affected_range TEXT,
		fixed_version TEXT,
		references TEXT,
		cwes TEXT,
		published_at DATETIME,
		updated_at DATETIME,
		discovered_at DATETIME,
		notified INTEGER DEFAULT 0,
		affected_assets TEXT,
		raw_data BLOB,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(cve_id, source)
	);

	CREATE INDEX IF NOT EXISTS idx_vulns_severity ON vulnerabilities(severity);
	CREATE INDEX IF NOT EXISTS idx_vulns_component ON vulnerabilities(component);
	CREATE INDEX IF NOT EXISTS idx_vulns_published ON vulnerabilities(published_at);
	CREATE INDEX IF NOT EXISTS idx_vulns_notified ON vulnerabilities(notified);

	CREATE TABLE IF NOT EXISTS assets (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		component TEXT NOT NULL,
		version TEXT NOT NULL,
		version_range TEXT,
		environment TEXT,
		owner TEXT,
		description TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		last_scanned_at DATETIME,
		UNIQUE(component, version, environment)
	);

	CREATE INDEX IF NOT EXISTS idx_assets_component ON assets(component);

	CREATE TABLE IF NOT EXISTS sources (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		url TEXT,
		enabled INTEGER DEFAULT 1,
		status TEXT DEFAULT 'OK',
		last_crawled_at DATETIME,
		last_success_at DATETIME,
		last_error TEXT,
		total_records INTEGER DEFAULT 0,
		success_count INTEGER DEFAULT 0,
		error_count INTEGER DEFAULT 0,
		config BLOB,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS crawl_cursors (
		source_id TEXT PRIMARY KEY,
		cursor TEXT,
		last_item_id TEXT,
		last_item_ts DATETIME,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS notifications (
		id TEXT PRIMARY KEY,
		vuln_id TEXT NOT NULL,
		channel TEXT NOT NULL,
		status TEXT NOT NULL,
		error TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_notifs_vuln ON notifications(vuln_id);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func (s *Storage) SaveVulnerability(ctx context.Context, v *Vulnerability) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var err error
	var created bool

	err = s.retryer.Do(ctx, fmt.Sprintf("save-vuln-%s", v.ID), func(ctx context.Context) error {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()

		var existingID string
		err = tx.QueryRowContext(ctx, "SELECT id FROM vulnerabilities WHERE cve_id = ? AND source = ?",
			v.CVEID, v.Source).Scan(&existingID)

		if err == nil {
			_, err = tx.ExecContext(ctx, `
				UPDATE vulnerabilities SET
					title=?, description=?, severity=?, cvss_score=?, cvss_vector=?,
					component=?, affected_range=?, fixed_version=?, references=?, cwes=?,
					published_at=?, updated_at=?, affected_assets=?, raw_data=?
				WHERE id=?`,
				v.Title, v.Description, v.Severity, v.CVSSScore, v.CVSSVector,
				v.Component, v.AffectedRange, v.FixedVersion,
				mustJSON(v.References), mustJSON(v.CWEs),
				v.PublishedAt, v.UpdatedAt, mustJSON(v.AffectedAssets),
				mustJSON(v.RawData), existingID)
			created = false
		} else if errors.Is(err, sql.ErrNoRows) {
			_, err = tx.ExecContext(ctx, `
				INSERT INTO vulnerabilities
				(id, cve_id, source, title, description, severity, cvss_score, cvss_vector,
				 component, affected_range, fixed_version, references, cwes,
				 published_at, updated_at, discovered_at, notified, affected_assets, raw_data)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				v.ID, v.CVEID, v.Source, v.Title, v.Description, v.Severity, v.CVSSScore, v.CVSSVector,
				v.Component, v.AffectedRange, v.FixedVersion,
				mustJSON(v.References), mustJSON(v.CWEs),
				v.PublishedAt, v.UpdatedAt, v.DiscoveredAt, 0,
				mustJSON(v.AffectedAssets), mustJSON(v.RawData))
			created = true
		}

		if err != nil {
			return err
		}

		return tx.Commit()
	})

	if err != nil {
		s.log.Errorf("save vulnerability %s failed: %v", v.CVEID, err)
	}

	return created, err
}

func (s *Storage) GetVulnerability(ctx context.Context, id string) (*Vulnerability, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	row := s.db.QueryRowContext(ctx, `
		SELECT id, cve_id, source, title, description, severity, cvss_score, cvss_vector,
		       component, affected_range, fixed_version, references, cwes,
		       published_at, updated_at, discovered_at, notified, affected_assets
		FROM vulnerabilities WHERE id = ?`, id)

	v := &Vulnerability{}
	var refs, cwes, assets sql.NullString

	err := row.Scan(&v.ID, &v.CVEID, &v.Source, &v.Title, &v.Description, &v.Severity,
		&v.CVSSScore, &v.CVSSVector, &v.Component, &v.AffectedRange, &v.FixedVersion,
		&refs, &cwes, &v.PublishedAt, &v.UpdatedAt, &v.DiscoveredAt, &v.Notified, &assets)

	if err != nil {
		return nil, err
	}

	mustScanJSON(refs, &v.References)
	mustScanJSON(cwes, &v.CWEs)
	mustScanJSON(assets, &v.AffectedAssets)

	return v, nil
}

func (s *Storage) GetVulnerabilities(ctx context.Context, severity Severity, limit, offset int) ([]*Vulnerability, int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var total int64
	query := "SELECT COUNT(*) FROM vulnerabilities"
	args := []interface{}{}
	if severity != "" {
		query += " WHERE severity = ?"
		args = append(args, severity)
	}

	if err := s.db.QueryRowContext(ctx, query, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query = `
		SELECT id, cve_id, source, title, description, severity, cvss_score, cvss_vector,
		       component, affected_range, fixed_version, published_at, updated_at, notified
		FROM vulnerabilities`
	if severity != "" {
		query += " WHERE severity = ?"
	}
	query += " ORDER BY published_at DESC LIMIT ? OFFSET ?"

	args = append(args, limit, offset)
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	vulns := make([]*Vulnerability, 0)
	for rows.Next() {
		v := &Vulnerability{}
		err := rows.Scan(&v.ID, &v.CVEID, &v.Source, &v.Title, &v.Description, &v.Severity,
			&v.CVSSScore, &v.CVSSVector, &v.Component, &v.AffectedRange, &v.FixedVersion,
			&v.PublishedAt, &v.UpdatedAt, &v.Notified)
		if err != nil {
			return nil, 0, err
		}
		vulns = append(vulns, v)
	}

	return vulns, total, nil
}

func (s *Storage) GetUnnotifiedVulnerabilities(ctx context.Context) ([]*Vulnerability, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, cve_id, source, title, description, severity, cvss_score,
		       component, affected_range, fixed_version, published_at, affected_assets
		FROM vulnerabilities WHERE notified = 0
		ORDER BY cvss_score DESC, published_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vulns := make([]*Vulnerability, 0)
	for rows.Next() {
		v := &Vulnerability{}
		var assets sql.NullString
		err := rows.Scan(&v.ID, &v.CVEID, &v.Source, &v.Title, &v.Description, &v.Severity,
			&v.CVSSScore, &v.Component, &v.AffectedRange, &v.FixedVersion,
			&v.PublishedAt, &assets)
		if err != nil {
			return nil, err
		}
		mustScanJSON(assets, &v.AffectedAssets)
		vulns = append(vulns, v)
	}

	return vulns, nil
}

func (s *Storage) MarkNotified(ctx context.Context, vulnID string, channel string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.retryer.Do(ctx, fmt.Sprintf("mark-notified-%s", vulnID), func(ctx context.Context) error {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()

		if _, err := tx.ExecContext(ctx, "UPDATE vulnerabilities SET notified = 1 WHERE id = ?", vulnID); err != nil {
			return err
		}

		notifID := fmt.Sprintf("%s-%s-%d", vulnID, channel, time.Now().UnixNano())
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO notifications (id, vuln_id, channel, status)
			VALUES (?, ?, ?, 'SENT')`, notifID, vulnID, channel); err != nil {
			return err
		}

		return tx.Commit()
	})
}

func (s *Storage) SaveAsset(ctx context.Context, a *Asset) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.retryer.Do(ctx, fmt.Sprintf("save-asset-%s", a.ID), func(ctx context.Context) error {
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO assets (id, name, component, version, version_range, environment, owner, description, updated_at)
			VALUES (?,?,?,?,?,?,?,?, CURRENT_TIMESTAMP)
			ON CONFLICT(component, version, environment) DO UPDATE SET
				name=excluded.name, version_range=excluded.version_range,
				owner=excluded.owner, description=excluded.description,
				updated_at=CURRENT_TIMESTAMP`,
			a.ID, a.Name, a.Component, a.Version, a.VersionRange, a.Environment, a.Owner, a.Description)
		return err
	})
}

func (s *Storage) GetAssets(ctx context.Context) ([]*Asset, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, component, version, version_range, environment, owner, description,
		       created_at, updated_at, last_scanned_at
		FROM assets ORDER BY component, version`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]*Asset, 0)
	for rows.Next() {
		a := &Asset{}
		err := rows.Scan(&a.ID, &a.Name, &a.Component, &a.Version, &a.VersionRange,
			&a.Environment, &a.Owner, &a.Description, &a.CreatedAt, &a.UpdatedAt, &a.LastScannedAt)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	return assets, nil
}

func (s *Storage) SaveSource(ctx context.Context, src *Source) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfgJSON, _ := json.Marshal(src.Config)
	return s.retryer.Do(ctx, fmt.Sprintf("save-source-%s", src.ID), func(ctx context.Context) error {
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO sources (id, name, type, url, enabled, status, config)
			VALUES (?,?,?,?,?,?,?)
			ON CONFLICT(id) DO UPDATE SET
				name=excluded.name, type=excluded.type, url=excluded.url,
				enabled=excluded.enabled, status=excluded.status, config=excluded.config`,
			src.ID, src.Name, src.Type, src.URL, src.Enabled, src.Status, cfgJSON)
		return err
	})
}

func (s *Storage) GetSources(ctx context.Context) ([]*Source, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, type, url, enabled, status, last_crawled_at, last_success_at,
		       last_error, total_records, success_count, error_count
		FROM sources ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sources := make([]*Source, 0)
	for rows.Next() {
		src := &Source{}
		err := rows.Scan(&src.ID, &src.Name, &src.Type, &src.URL, &src.Enabled, &src.Status,
			&src.LastCrawledAt, &src.LastSuccessAt, &src.LastError,
			&src.TotalRecords, &src.SuccessCount, &src.ErrorCount)
		if err != nil {
			return nil, err
		}
		sources = append(sources, src)
	}

	return sources, nil
}

func (s *Storage) UpdateSourceStatus(ctx context.Context, sourceID string, status SourceStatus, errMsg string, success bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	return s.retryer.Do(ctx, fmt.Sprintf("update-source-%s", sourceID), func(ctx context.Context) error {
		query := `UPDATE sources SET status=?, last_crawled_at=?`
		args := []interface{}{status, now}

		if success {
			query += `, last_success_at=?, success_count=success_count+1`
			args = append(args, now)
		} else {
			query += `, last_error=?, error_count=error_count+1`
			args = append(args, errMsg)
		}
		query += ` WHERE id=?`
		args = append(args, sourceID)

		_, err := s.db.ExecContext(ctx, query, args...)
		return err
	})
}

func (s *Storage) GetCursor(ctx context.Context, sourceID string) (*CrawlCursor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	row := s.db.QueryRowContext(ctx, `
		SELECT source_id, cursor, last_item_id, last_item_ts, updated_at
		FROM crawl_cursors WHERE source_id = ?`, sourceID)

	c := &CrawlCursor{}
	err := row.Scan(&c.SourceID, &c.Cursor, &c.LastItemID, &c.LastItemTS, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &CrawlCursor{SourceID: sourceID}, nil
		}
		return nil, err
	}
	return c, nil
}

func (s *Storage) SaveCursor(ctx context.Context, c *CrawlCursor) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.retryer.Do(ctx, fmt.Sprintf("save-cursor-%s", c.SourceID), func(ctx context.Context) error {
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO crawl_cursors (source_id, cursor, last_item_id, last_item_ts, updated_at)
			VALUES (?,?,?,?,CURRENT_TIMESTAMP)
			ON CONFLICT(source_id) DO UPDATE SET
				cursor=excluded.cursor, last_item_id=excluded.last_item_id,
				last_item_ts=excluded.last_item_ts, updated_at=CURRENT_TIMESTAMP`,
			c.SourceID, c.Cursor, c.LastItemID, c.LastItemTS)
		return err
	})
}

func (s *Storage) GetStats(ctx context.Context) (map[string]interface{}, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := make(map[string]interface{})

	row := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*),
		       SUM(CASE WHEN severity='CRITICAL' THEN 1 ELSE 0 END),
		       SUM(CASE WHEN severity='HIGH' THEN 1 ELSE 0 END),
		       SUM(CASE WHEN severity='MEDIUM' THEN 1 ELSE 0 END),
		       SUM(CASE WHEN severity='LOW' THEN 1 ELSE 0 END),
		       SUM(CASE WHEN notified=0 THEN 1 ELSE 0 END)
		FROM vulnerabilities`)

	var total, critical, high, medium, low, unnotified sql.NullInt64
	if err := row.Scan(&total, &critical, &high, &medium, &low, &unnotified); err != nil {
		return nil, err
	}

	stats["total_vulnerabilities"] = total.Int64
	stats["critical"] = critical.Int64
	stats["high"] = high.Int64
	stats["medium"] = medium.Int64
	stats["low"] = low.Int64
	stats["unnotified"] = unnotified.Int64

	var assetCount int64
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM assets").Scan(&assetCount); err == nil {
		stats["total_assets"] = assetCount
	}

	return stats, nil
}

func (s *Storage) ExportVulnerabilities(ctx context.Context, format, path string, severity Severity) error {
	vulns, _, err := s.GetVulnerabilities(ctx, severity, 10000, 0)
	if err != nil {
		return err
	}

	sort.Slice(vulns, func(i, j int) bool {
		return vulns[i].PublishedAt.After(vulns[j].PublishedAt)
	})

	switch format {
	case "json":
		return s.exportJSON(vulns, path)
	case "csv":
		return s.exportCSV(vulns, path)
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

func (s *Storage) exportJSON(vulns []*Vulnerability, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(vulns)
}

func (s *Storage) exportCSV(vulns []*Vulnerability, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	w := csv.NewWriter(f)
	defer w.Flush()

	header := []string{"CVE ID", "Source", "Severity", "CVSS", "Component", "Affected Range",
		"Fixed Version", "Published", "Title", "References"}
	if err := w.Write(header); err != nil {
		return err
	}

	for _, v := range vulns {
		refs := ""
		if len(v.References) > 0 {
			refs = v.References[0]
		}
		row := []string{
			v.CVEID, v.Source, string(v.Severity),
			fmt.Sprintf("%.1f", v.CVSSScore),
			v.Component, v.AffectedRange, v.FixedVersion,
			v.PublishedAt.Format("2006-01-02"),
			v.Title, refs,
		}
		if err := w.Write(row); err != nil {
			return err
		}
	}

	return nil
}

func mustJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func mustScanJSON(ns sql.NullString, v interface{}) {
	if !ns.Valid || ns.String == "" {
		return
	}
	_ = json.Unmarshal([]byte(ns.String), v)
}

func ParseSeverity(s string) Severity {
	switch s {
	case "CRITICAL", "critical", "Critical":
		return SeverityCritical
	case "HIGH", "high", "High":
		return SeverityHigh
	case "MEDIUM", "medium", "Medium", "MODERATE", "moderate":
		return SeverityMedium
	case "LOW", "low", "Low":
		return SeverityLow
	default:
		return SeverityMedium
	}
}

func CVSStoSeverity(score float64) Severity {
	switch {
	case score >= 9.0:
		return SeverityCritical
	case score >= 7.0:
		return SeverityHigh
	case score >= 4.0:
		return SeverityMedium
	default:
		return SeverityLow
	}
}
