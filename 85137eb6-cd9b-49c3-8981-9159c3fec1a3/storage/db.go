package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"price-monitor/config"

	_ "modernc.org/sqlite"
)

type PriceRecord struct {
	ID           int64
	SKUId        string
	SKUName      string
	Brand        string
	Category     string
	SiteId       string
	SiteName     string
	PriceOriginal float64
	PricePromo   float64
	PriceMember  float64
	PriceFinal   float64
	Currency     string
	URL          string
	Title        string
	Stock        string
	CrawledAt    time.Time
	Hash         string
}

type MonitorTask struct {
	ID          int64
	SKUId       string
	SiteId      string
	Keyword     string
	CronExpr    string
	Enabled     bool
	LastRunAt   sql.NullTime
	NextRunAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CrawlStats struct {
	TaskId       int64
	TotalCount   int
	SuccessCount int
	FailedCount  int
	StartTime    time.Time
	EndTime      time.Time
	Duration     time.Duration
}

type Database struct {
	db   *sql.DB
	path string
	mu   sync.RWMutex
}

var (
	instance *Database
	once     sync.Once
)

func GetInstance() *Database {
	return instance
}

func Init(dbPath string) (*Database, error) {
	var err error
	once.Do(func() {
		dir := filepath.Dir(dbPath)
		if dir != "." && dir != "" {
			if mkErr := os.MkdirAll(dir, 0755); mkErr != nil {
				err = fmt.Errorf("failed to create database directory: %w", mkErr)
				return
			}
		}

		var sqlDB *sql.DB
		sqlDB, err = sql.Open("sqlite", dbPath)
		if err != nil {
			err = fmt.Errorf("failed to open database: %w", err)
			return
		}

		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetConnMaxLifetime(5 * time.Minute)

		if pingErr := sqlDB.Ping(); pingErr != nil {
			err = fmt.Errorf("failed to ping database: %w", pingErr)
			return
		}

		instance = &Database{db: sqlDB, path: dbPath}
		if initErr := instance.initSchema(); initErr != nil {
			err = fmt.Errorf("failed to init schema: %w", initErr)
			return
		}
	})
	return instance, err
}

func (d *Database) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS price_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sku_id TEXT NOT NULL,
		sku_name TEXT NOT NULL DEFAULT '',
		brand TEXT NOT NULL DEFAULT '',
		category TEXT NOT NULL DEFAULT '',
		site_id TEXT NOT NULL,
		site_name TEXT NOT NULL DEFAULT '',
		price_original REAL NOT NULL DEFAULT 0,
		price_promo REAL NOT NULL DEFAULT 0,
		price_member REAL NOT NULL DEFAULT 0,
		price_final REAL NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'CNY',
		url TEXT NOT NULL DEFAULT '',
		title TEXT NOT NULL DEFAULT '',
		stock TEXT NOT NULL DEFAULT '',
		crawled_at DATETIME NOT NULL,
		hash TEXT NOT NULL DEFAULT '',
		UNIQUE(sku_id, site_id, hash)
	);

	CREATE INDEX IF NOT EXISTS idx_price_records_sku ON price_records(sku_id);
	CREATE INDEX IF NOT EXISTS idx_price_records_site ON price_records(site_id);
	CREATE INDEX IF NOT EXISTS idx_price_records_crawled ON price_records(crawled_at);
	CREATE INDEX IF NOT EXISTS idx_price_records_sku_site ON price_records(sku_id, site_id);

	CREATE TABLE IF NOT EXISTS monitor_tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sku_id TEXT NOT NULL,
		site_id TEXT NOT NULL,
		keyword TEXT NOT NULL DEFAULT '',
		cron_expr TEXT NOT NULL DEFAULT '0 * * * *',
		enabled INTEGER NOT NULL DEFAULT 1,
		last_run_at DATETIME,
		next_run_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(sku_id, site_id)
	);

	CREATE TABLE IF NOT EXISTS crawl_stats (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		total_count INTEGER NOT NULL DEFAULT 0,
		success_count INTEGER NOT NULL DEFAULT 0,
		failed_count INTEGER NOT NULL DEFAULT 0,
		start_time DATETIME NOT NULL,
		end_time DATETIME,
		duration_ms INTEGER NOT NULL DEFAULT 0,
		error_messages TEXT
	);

	CREATE TABLE IF NOT EXISTS alert_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sku_id TEXT NOT NULL,
		site_id TEXT NOT NULL,
		price_before REAL NOT NULL,
		price_after REAL NOT NULL,
		change_percent REAL NOT NULL,
		alert_type TEXT NOT NULL,
		sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		notified INTEGER NOT NULL DEFAULT 0
	);

	CREATE INDEX IF NOT EXISTS idx_alert_logs_sku ON alert_logs(sku_id);
	CREATE INDEX IF NOT EXISTS idx_alert_logs_sent ON alert_logs(sent_at);
	`
	_, err := d.db.Exec(schema)
	return err
}

func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

func (d *Database) SavePriceRecord(rec *PriceRecord) (int64, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	query := `INSERT OR IGNORE INTO price_records 
		(sku_id, sku_name, brand, category, site_id, site_name, 
		 price_original, price_promo, price_member, price_final, 
		 currency, url, title, stock, crawled_at, hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := d.db.Exec(query,
		rec.SKUId, rec.SKUName, rec.Brand, rec.Category,
		rec.SiteId, rec.SiteName, rec.PriceOriginal, rec.PricePromo,
		rec.PriceMember, rec.PriceFinal, rec.Currency, rec.URL,
		rec.Title, rec.Stock, rec.CrawledAt, rec.Hash)
	if err != nil {
		return 0, fmt.Errorf("failed to insert price record: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert id: %w", err)
	}
	return id, nil
}

func (d *Database) SavePriceRecordsBatch(records []*PriceRecord) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO price_records 
		(sku_id, sku_name, brand, category, site_id, site_name, 
		 price_original, price_promo, price_member, price_final, 
		 currency, url, title, stock, crawled_at, hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return 0, fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	inserted := 0
	for _, rec := range records {
		result, err := stmt.Exec(
			rec.SKUId, rec.SKUName, rec.Brand, rec.Category,
			rec.SiteId, rec.SiteName, rec.PriceOriginal, rec.PricePromo,
			rec.PriceMember, rec.PriceFinal, rec.Currency, rec.URL,
			rec.Title, rec.Stock, rec.CrawledAt, rec.Hash)
		if err != nil {
			continue
		}
		rows, _ := result.RowsAffected()
		if rows > 0 {
			inserted++
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return inserted, nil
}

func (d *Database) GetLatestPrice(skuId, siteId string) (*PriceRecord, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `SELECT id, sku_id, sku_name, brand, category, site_id, site_name,
		price_original, price_promo, price_member, price_final, currency,
		url, title, stock, crawled_at, hash
		FROM price_records WHERE sku_id = ? AND site_id = ?
		ORDER BY crawled_at DESC LIMIT 1`

	rec := &PriceRecord{}
	var crawledAtStr string
	err := d.db.QueryRow(query, skuId, siteId).Scan(
		&rec.ID, &rec.SKUId, &rec.SKUName, &rec.Brand, &rec.Category,
		&rec.SiteId, &rec.SiteName, &rec.PriceOriginal, &rec.PricePromo,
		&rec.PriceMember, &rec.PriceFinal, &rec.Currency, &rec.URL,
		&rec.Title, &rec.Stock, &crawledAtStr, &rec.Hash)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query latest price: %w", err)
	}
	rec.CrawledAt, _ = time.Parse("2006-01-02 15:04:05-07:00", crawledAtStr)
	return rec, nil
}

func (d *Database) GetPriceHistory(skuId, siteId string, startTime, endTime time.Time) ([]*PriceRecord, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `SELECT id, sku_id, sku_name, brand, category, site_id, site_name,
		price_original, price_promo, price_member, price_final, currency,
		url, title, stock, crawled_at, hash
		FROM price_records WHERE sku_id = ? AND site_id = ?
		AND crawled_at >= ? AND crawled_at <= ?
		ORDER BY crawled_at ASC`

	rows, err := d.db.Query(query, skuId, siteId, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to query price history: %w", err)
	}
	defer rows.Close()

	var records []*PriceRecord
	for rows.Next() {
		rec := &PriceRecord{}
		var crawledAtStr string
		err := rows.Scan(
			&rec.ID, &rec.SKUId, &rec.SKUName, &rec.Brand, &rec.Category,
			&rec.SiteId, &rec.SiteName, &rec.PriceOriginal, &rec.PricePromo,
			&rec.PriceMember, &rec.PriceFinal, &rec.Currency, &rec.URL,
			&rec.Title, &rec.Stock, &crawledAtStr, &rec.Hash)
		if err != nil {
			continue
		}
		rec.CrawledAt, _ = time.Parse("2006-01-02 15:04:05-07:00", crawledAtStr)
		records = append(records, rec)
	}
	return records, nil
}

func (d *Database) GetAllLatestPrices() ([]*PriceRecord, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `SELECT p.id, p.sku_id, p.sku_name, p.brand, p.category, p.site_id, p.site_name,
		p.price_original, p.price_promo, p.price_member, p.price_final, p.currency,
		p.url, p.title, p.stock, p.crawled_at, p.hash
		FROM price_records p
		INNER JOIN (
			SELECT sku_id, site_id, MAX(crawled_at) as max_crawled
			FROM price_records
			GROUP BY sku_id, site_id
		) pm ON p.sku_id = pm.sku_id AND p.site_id = pm.site_id AND p.crawled_at = pm.max_crawled
		ORDER BY p.sku_id, p.price_final ASC`

	rows, err := d.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query all latest prices: %w", err)
	}
	defer rows.Close()

	var records []*PriceRecord
	for rows.Next() {
		rec := &PriceRecord{}
		var crawledAtStr string
		err := rows.Scan(
			&rec.ID, &rec.SKUId, &rec.SKUName, &rec.Brand, &rec.Category,
			&rec.SiteId, &rec.SiteName, &rec.PriceOriginal, &rec.PricePromo,
			&rec.PriceMember, &rec.PriceFinal, &rec.Currency, &rec.URL,
			&rec.Title, &rec.Stock, &crawledAtStr, &rec.Hash)
		if err != nil {
			continue
		}
		rec.CrawledAt, _ = time.Parse("2006-01-02 15:04:05-07:00", crawledAtStr)
		records = append(records, rec)
	}
	return records, nil
}

func (d *Database) SaveMonitorTask(task *MonitorTask) (int64, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	query := `INSERT OR REPLACE INTO monitor_tasks 
		(sku_id, site_id, keyword, cron_expr, enabled, updated_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`

	result, err := d.db.Exec(query, task.SKUId, task.SiteId, task.Keyword, task.CronExpr, task.Enabled)
	if err != nil {
		return 0, fmt.Errorf("failed to save monitor task: %w", err)
	}
	return result.LastInsertId()
}

func (d *Database) GetMonitorTasks() ([]*MonitorTask, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `SELECT id, sku_id, site_id, keyword, cron_expr, enabled, last_run_at, next_run_at, created_at, updated_at
		FROM monitor_tasks WHERE enabled = 1 ORDER BY id`

	rows, err := d.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query monitor tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*MonitorTask
	for rows.Next() {
		t := &MonitorTask{}
		err := rows.Scan(&t.ID, &t.SKUId, &t.SiteId, &t.Keyword, &t.CronExpr,
			&t.Enabled, &t.LastRunAt, &t.NextRunAt, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			continue
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (d *Database) UpdateTaskRunTime(id int64, lastRun, nextRun time.Time) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	query := `UPDATE monitor_tasks SET last_run_at = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := d.db.Exec(query, lastRun, nextRun, id)
	return err
}

func (d *Database) SaveCrawlStats(stats *CrawlStats) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	query := `INSERT INTO crawl_stats 
		(total_count, success_count, failed_count, start_time, end_time, duration_ms)
		VALUES (?, ?, ?, ?, ?, ?)`
	_, err := d.db.Exec(query, stats.TotalCount, stats.SuccessCount, stats.FailedCount,
		stats.StartTime, stats.EndTime, stats.Duration.Milliseconds())
	return err
}

func (d *Database) LogAlert(skuId, siteId string, priceBefore, priceAfter, changePercent float64, alertType string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	query := `INSERT INTO alert_logs (sku_id, site_id, price_before, price_after, change_percent, alert_type)
		VALUES (?, ?, ?, ?, ?, ?)`
	_, err := d.db.Exec(query, skuId, siteId, priceBefore, priceAfter, changePercent, alertType)
	return err
}

func (d *Database) GetStatistics(days int) (map[string]interface{}, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	result := make(map[string]interface{})

	var totalRecords int64
	d.db.QueryRow("SELECT COUNT(*) FROM price_records").Scan(&totalRecords)
	result["total_records"] = totalRecords

	var uniqueSkus int64
	d.db.QueryRow("SELECT COUNT(DISTINCT sku_id) FROM price_records").Scan(&uniqueSkus)
	result["unique_skus"] = uniqueSkus

	var uniqueSites int64
	d.db.QueryRow("SELECT COUNT(DISTINCT site_id) FROM price_records").Scan(&uniqueSites)
	result["unique_sites"] = uniqueSites

	since := time.Now().AddDate(0, 0, -days)
	var recordsInPeriod int64
	d.db.QueryRow("SELECT COUNT(*) FROM price_records WHERE crawled_at >= ?", since).Scan(&recordsInPeriod)
	result["records_in_period"] = recordsInPeriod

	return result, nil
}

func init() {
	if config.Config != nil {
		Init(config.Config.Database.Path)
	}
}
