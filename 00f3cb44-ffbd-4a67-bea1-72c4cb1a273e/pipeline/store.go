package pipeline

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/rs/zerolog/log"
	"github.com/shopspring/decimal"
)

type Product struct {
	ID            int64
	Site          string
	SKU           string
	Title         string
	Price         decimal.Decimal
	OriginalPrice decimal.Decimal
	Currency      string
	Rating        float64
	ReviewCount   int
	Seller        string
	StockStatus   string
	PromoTags     string
	ProductURL    string
	ImageURL      string
	Category      string
	CrawledAt     time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type PriceHistory struct {
	ID         int64
	Site       string
	SKU        string
	Price      decimal.Decimal
	RecordedAt time.Time
}

type CrawlProgress struct {
	Site        string
	Category    string
	LastPage    int
	LastCursor  string
	LastCrawlAt time.Time
	TotalItems  int
	Status      string
}

type TaskReport struct {
	ID            int64
	TaskID        string
	StartTime     time.Time
	EndTime       time.Time
	TotalSites    int
	SuccessCount  int
	FailCount     int
	SkipCount     int
	TotalProducts int
	Status        string
	SiteReports   []SiteReport
}

type SiteReport struct {
	SiteName     string
	SuccessCount int
	FailCount    int
	SkipCount    int
	TotalItems   int
	DurationMs   int64
	ErrorMsg     string
}

type RawProduct struct {
	ID        int64
	Site      string
	RawData   string
	CrawledAt time.Time
	Status    string
}

type Store struct {
	db *sql.DB
}

func NewStore(dbPath string) (*Store, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath+"?_journal=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	s := &Store{db: db}
	if err := s.initTables(); err != nil {
		return nil, fmt.Errorf("init tables: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) initTables() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS products (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site TEXT NOT NULL,
			sku TEXT NOT NULL,
			title TEXT,
			price TEXT DEFAULT '0',
			original_price TEXT DEFAULT '0',
			currency TEXT DEFAULT 'USD',
			rating REAL DEFAULT 0,
			review_count INTEGER DEFAULT 0,
			seller TEXT,
			stock_status TEXT,
			promo_tags TEXT,
			product_url TEXT,
			image_url TEXT,
			category TEXT,
			crawled_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(site, sku)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_products_site ON products(site)`,
		`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`,
		`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
		`CREATE TABLE IF NOT EXISTS price_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site TEXT NOT NULL,
			sku TEXT NOT NULL,
			price TEXT DEFAULT '0',
			recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_price_history_site_sku ON price_history(site, sku)`,
		`CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at)`,
		`CREATE TABLE IF NOT EXISTS raw_products (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site TEXT NOT NULL,
			raw_data TEXT,
			crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			status TEXT DEFAULT 'pending'
		)`,
		`CREATE INDEX IF NOT EXISTS idx_raw_products_status ON raw_products(status)`,
		`CREATE TABLE IF NOT EXISTS crawl_progress (
			site TEXT NOT NULL,
			category TEXT NOT NULL,
			last_page INTEGER DEFAULT 0,
			last_cursor TEXT,
			last_crawl_at DATETIME,
			total_items INTEGER DEFAULT 0,
			status TEXT DEFAULT 'idle',
			PRIMARY KEY(site, category)
		)`,
		`CREATE TABLE IF NOT EXISTS task_reports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id TEXT UNIQUE,
			start_time DATETIME,
			end_time DATETIME,
			total_sites INTEGER DEFAULT 0,
			success_count INTEGER DEFAULT 0,
			fail_count INTEGER DEFAULT 0,
			skip_count INTEGER DEFAULT 0,
			total_products INTEGER DEFAULT 0,
			status TEXT DEFAULT 'running'
		)`,
		`CREATE TABLE IF NOT EXISTS site_reports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id TEXT NOT NULL,
			site_name TEXT NOT NULL,
			success_count INTEGER DEFAULT 0,
			fail_count INTEGER DEFAULT 0,
			skip_count INTEGER DEFAULT 0,
			total_items INTEGER DEFAULT 0,
			duration_ms INTEGER DEFAULT 0,
			error_msg TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_site_reports_task_id ON site_reports(task_id)`,
	}

	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("exec stmt: %w", err)
		}
	}

	return nil
}

func (s *Store) SaveRawProduct(site string, rawData string) (int64, error) {
	res, err := s.db.Exec(
		"INSERT INTO raw_products (site, raw_data, status) VALUES (?, ?, 'pending')",
		site, rawData,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpsertProduct(p *Product) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var existingPrice string
	err = tx.QueryRow("SELECT price FROM products WHERE site = ? AND sku = ?", p.Site, p.SKU).Scan(&existingPrice)

	if err == sql.ErrNoRows {
		_, err = tx.Exec(`
			INSERT INTO products (site, sku, title, price, original_price, currency, rating, review_count, seller, stock_status, promo_tags, product_url, image_url, category, crawled_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, p.Site, p.SKU, p.Title, p.Price.String(), p.OriginalPrice.String(), p.Currency, p.Rating, p.ReviewCount, p.Seller, p.StockStatus, p.PromoTags, p.ProductURL, p.ImageURL, p.Category, p.CrawledAt)
		if err != nil {
			return fmt.Errorf("insert product: %w", err)
		}

		_, err = tx.Exec(`
			INSERT INTO price_history (site, sku, price, recorded_at)
			VALUES (?, ?, ?, ?)
		`, p.Site, p.SKU, p.Price.String(), p.CrawledAt)
		if err != nil {
			return fmt.Errorf("insert price history: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("query existing product: %w", err)
	} else {
		existingDec, _ := decimal.NewFromString(existingPrice)
		if !existingDec.Equal(p.Price) {
			_, err = tx.Exec(`
				INSERT INTO price_history (site, sku, price, recorded_at)
				VALUES (?, ?, ?, ?)
			`, p.Site, p.SKU, p.Price.String(), p.CrawledAt)
			if err != nil {
				return fmt.Errorf("insert price history: %w", err)
			}
		}

		_, err = tx.Exec(`
			UPDATE products SET title = ?, price = ?, original_price = ?, currency = ?, rating = ?, review_count = ?, seller = ?, stock_status = ?, promo_tags = ?, product_url = ?, image_url = ?, category = ?, crawled_at = ?, updated_at = CURRENT_TIMESTAMP
			WHERE site = ? AND sku = ?
		`, p.Title, p.Price.String(), p.OriginalPrice.String(), p.Currency, p.Rating, p.ReviewCount, p.Seller, p.StockStatus, p.PromoTags, p.ProductURL, p.ImageURL, p.Category, p.CrawledAt, p.Site, p.SKU)
		if err != nil {
			return fmt.Errorf("update product: %w", err)
		}
	}

	return tx.Commit()
}

func (s *Store) BulkUpsertProducts(products []*Product) (int, error) {
	if len(products) == 0 {
		return 0, nil
	}

	count := 0
	for _, p := range products {
		if err := s.UpsertProduct(p); err != nil {
			log.Error().Err(err).Str("sku", p.SKU).Str("site", p.Site).Msg("upsert product failed")
			continue
		}
		count++
	}
	return count, nil
}

func (s *Store) GetProduct(site, sku string) (*Product, error) {
	row := s.db.QueryRow(`
		SELECT id, site, sku, title, price, original_price, currency, rating, review_count, seller, stock_status, promo_tags, product_url, image_url, category, crawled_at, created_at, updated_at
		FROM products WHERE site = ? AND sku = ?
	`, site, sku)

	p := &Product{}
	var priceStr, origPriceStr string
	var crawledAt, createdAt, updatedAt sql.NullTime

	err := row.Scan(&p.ID, &p.Site, &p.SKU, &p.Title, &priceStr, &origPriceStr, &p.Currency, &p.Rating, &p.ReviewCount, &p.Seller, &p.StockStatus, &p.PromoTags, &p.ProductURL, &p.ImageURL, &p.Category, &crawledAt, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}

	p.Price, _ = decimal.NewFromString(priceStr)
	p.OriginalPrice, _ = decimal.NewFromString(origPriceStr)
	if crawledAt.Valid {
		p.CrawledAt = crawledAt.Time
	}
	if createdAt.Valid {
		p.CreatedAt = createdAt.Time
	}
	if updatedAt.Valid {
		p.UpdatedAt = updatedAt.Time
	}

	return p, nil
}

func (s *Store) GetCrawlProgress(site, category string) (*CrawlProgress, error) {
	row := s.db.QueryRow(`
		SELECT site, category, last_page, last_cursor, last_crawl_at, total_items, status
		FROM crawl_progress WHERE site = ? AND category = ?
	`, site, category)

	cp := &CrawlProgress{}
	var lastCrawlAt sql.NullTime
	err := row.Scan(&cp.Site, &cp.Category, &cp.LastPage, &cp.LastCursor, &lastCrawlAt, &cp.TotalItems, &cp.Status)
	if err == sql.ErrNoRows {
		return &CrawlProgress{
			Site:     site,
			Category: category,
			LastPage: 0,
			Status:   "idle",
		}, nil
	}
	if err != nil {
		return nil, err
	}
	if lastCrawlAt.Valid {
		cp.LastCrawlAt = lastCrawlAt.Time
	}
	return cp, nil
}

func (s *Store) UpdateCrawlProgress(cp *CrawlProgress) error {
	_, err := s.db.Exec(`
		INSERT INTO crawl_progress (site, category, last_page, last_cursor, last_crawl_at, total_items, status)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(site, category) DO UPDATE SET
			last_page = excluded.last_page,
			last_cursor = excluded.last_cursor,
			last_crawl_at = excluded.last_crawl_at,
			total_items = excluded.total_items,
			status = excluded.status
	`, cp.Site, cp.Category, cp.LastPage, cp.LastCursor, cp.LastCrawlAt, cp.TotalItems, cp.Status)
	return err
}

func (s *Store) CreateTaskReport(taskID string, startTime time.Time, totalSites int) error {
	_, err := s.db.Exec(`
		INSERT INTO task_reports (task_id, start_time, total_sites, status)
		VALUES (?, ?, ?, 'running')
	`, taskID, startTime, totalSites)
	return err
}

func (s *Store) AddSiteReport(taskID string, sr *SiteReport) error {
	_, err := s.db.Exec(`
		INSERT INTO site_reports (task_id, site_name, success_count, fail_count, skip_count, total_items, duration_ms, error_msg)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, taskID, sr.SiteName, sr.SuccessCount, sr.FailCount, sr.SkipCount, sr.TotalItems, sr.DurationMs, sr.ErrorMsg)
	return err
}

func (s *Store) FinishTaskReport(taskID string, endTime time.Time, successCount, failCount, skipCount, totalProducts int, status string) error {
	_, err := s.db.Exec(`
		UPDATE task_reports SET end_time = ?, success_count = ?, fail_count = ?, skip_count = ?, total_products = ?, status = ?
		WHERE task_id = ?
	`, endTime, successCount, failCount, skipCount, totalProducts, status, taskID)
	return err
}

func (s *Store) GetTaskReport(taskID string) (*TaskReport, error) {
	row := s.db.QueryRow(`
		SELECT id, task_id, start_time, end_time, total_sites, success_count, fail_count, skip_count, total_products, status
		FROM task_reports WHERE task_id = ?
	`, taskID)

	r := &TaskReport{}
	var startTime, endTime sql.NullTime
	err := row.Scan(&r.ID, &r.TaskID, &startTime, &endTime, &r.TotalSites, &r.SuccessCount, &r.FailCount, &r.SkipCount, &r.TotalProducts, &r.Status)
	if err != nil {
		return nil, err
	}
	if startTime.Valid {
		r.StartTime = startTime.Time
	}
	if endTime.Valid {
		r.EndTime = endTime.Time
	}

	rows, err := s.db.Query(`
		SELECT site_name, success_count, fail_count, skip_count, total_items, duration_ms, error_msg
		FROM site_reports WHERE task_id = ?
	`, taskID)
	if err != nil {
		return r, nil
	}
	defer rows.Close()

	for rows.Next() {
		sr := SiteReport{}
		var errorMsg sql.NullString
		err := rows.Scan(&sr.SiteName, &sr.SuccessCount, &sr.FailCount, &sr.SkipCount, &sr.TotalItems, &sr.DurationMs, &errorMsg)
		if err != nil {
			continue
		}
		if errorMsg.Valid {
			sr.ErrorMsg = errorMsg.String
		}
		r.SiteReports = append(r.SiteReports, sr)
	}

	return r, nil
}

func (s *Store) GetRecentReports(limit int) ([]*TaskReport, error) {
	rows, err := s.db.Query(`
		SELECT id, task_id, start_time, end_time, total_sites, success_count, fail_count, skip_count, total_products, status
		FROM task_reports ORDER BY start_time DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*TaskReport
	for rows.Next() {
		r := &TaskReport{}
		var startTime, endTime sql.NullTime
		err := rows.Scan(&r.ID, &r.TaskID, &startTime, &endTime, &r.TotalSites, &r.SuccessCount, &r.FailCount, &r.SkipCount, &r.TotalProducts, &r.Status)
		if err != nil {
			continue
		}
		if startTime.Valid {
			r.StartTime = startTime.Time
		}
		if endTime.Valid {
			r.EndTime = endTime.Time
		}
		reports = append(reports, r)
	}
	return reports, nil
}

func (s *Store) GetDBSize() (int64, error) {
	var size int64
	row := s.db.QueryRow("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
	err := row.Scan(&size)
	return size, err
}

func (s *Store) CountProducts() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM products").Scan(&count)
	return count, err
}

func (s *Store) ArchiveOldData(days int) (int64, error) {
	cutoff := time.Now().AddDate(0, 0, -days)
	res, err := s.db.Exec(`
		DELETE FROM price_history WHERE recorded_at < ?
	`, cutoff)
	if err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()

	_, err = s.db.Exec("VACUUM")
	if err != nil {
		log.Warn().Err(err).Msg("vacuum failed")
	}

	return affected, nil
}
