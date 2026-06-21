package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create database directory: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	DB.SetMaxOpenConns(10)
	DB.SetMaxIdleConns(5)

	if err := migrate(); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}

func migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS enterprises (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		region TEXT NOT NULL DEFAULT '',
		industry TEXT NOT NULL DEFAULT '',
		risk_level TEXT NOT NULL DEFAULT '中',
		address TEXT NOT NULL DEFAULT '',
		contact TEXT NOT NULL DEFAULT '',
		phone TEXT NOT NULL DEFAULT '',
		credit_score INTEGER NOT NULL DEFAULT 100,
		inspected_count INTEGER NOT NULL DEFAULT 0,
		remark TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_enterprises_region ON enterprises(region);
	CREATE INDEX IF NOT EXISTS idx_enterprises_industry ON enterprises(industry);
	CREATE INDEX IF NOT EXISTS idx_enterprises_risk ON enterprises(risk_level);
	CREATE INDEX IF NOT EXISTS idx_enterprises_name ON enterprises(name);

	CREATE TABLE IF NOT EXISTS rectifications (
		id TEXT PRIMARY KEY,
		enterprise_id TEXT NOT NULL,
		problem_type TEXT NOT NULL,
		problem_desc TEXT NOT NULL,
		deadline DATETIME NOT NULL,
		responsible_person TEXT NOT NULL DEFAULT '',
		acceptance_criteria TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT '待整改',
		inspector_round TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (enterprise_id) REFERENCES enterprises(id)
	);

	CREATE INDEX IF NOT EXISTS idx_rect_enterprise ON rectifications(enterprise_id);
	CREATE INDEX IF NOT EXISTS idx_rect_status ON rectifications(status);
	CREATE INDEX IF NOT EXISTS idx_rect_type ON rectifications(problem_type);
	CREATE INDEX IF NOT EXISTS idx_rect_deadline ON rectifications(deadline);

	CREATE TABLE IF NOT EXISTS progress_reports (
		id TEXT PRIMARY KEY,
		rectification_id TEXT NOT NULL,
		report_type TEXT NOT NULL DEFAULT '企业汇报',
		content TEXT NOT NULL DEFAULT '',
		attachment TEXT NOT NULL DEFAULT '',
		reviewer TEXT NOT NULL DEFAULT '',
		review_comment TEXT NOT NULL DEFAULT '',
		reviewed_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (rectification_id) REFERENCES rectifications(id)
	);

	CREATE INDEX IF NOT EXISTS idx_progress_rect ON progress_reports(rectification_id);

	CREATE TABLE IF NOT EXISTS archives (
		id TEXT PRIMARY KEY,
		rectification_id TEXT NOT NULL,
		enterprise_id TEXT NOT NULL,
		acceptance_result TEXT NOT NULL DEFAULT '',
		acceptance_date DATETIME NOT NULL,
		acceptance_person TEXT NOT NULL DEFAULT '',
		materials TEXT NOT NULL DEFAULT '',
		remark TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (rectification_id) REFERENCES rectifications(id),
		FOREIGN KEY (enterprise_id) REFERENCES enterprises(id)
	);

	CREATE INDEX IF NOT EXISTS idx_archives_enterprise ON archives(enterprise_id);
	CREATE INDEX IF NOT EXISTS idx_archives_rect ON archives(rectification_id);
	CREATE INDEX IF NOT EXISTS idx_archives_date ON archives(acceptance_date);

	CREATE TABLE IF NOT EXISTS warnings (
		id TEXT PRIMARY KEY,
		rectification_id TEXT NOT NULL,
		warning_level INTEGER NOT NULL,
		days_remaining INTEGER NOT NULL,
		message TEXT NOT NULL DEFAULT '',
		is_sent INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (rectification_id) REFERENCES rectifications(id)
	);

	CREATE INDEX IF NOT EXISTS idx_warnings_rect ON warnings(rectification_id);
	CREATE INDEX IF NOT EXISTS idx_warnings_sent ON warnings(is_sent);

	CREATE TABLE IF NOT EXISTS inspector_history (
		id TEXT PRIMARY KEY,
		enterprise_id TEXT NOT NULL,
		inspector_round TEXT NOT NULL DEFAULT '',
		inspection_date DATETIME NOT NULL,
		inspector TEXT NOT NULL DEFAULT '',
		problem_summary TEXT NOT NULL DEFAULT '',
		rectification_count INTEGER NOT NULL DEFAULT 0,
		result TEXT NOT NULL DEFAULT '',
		remark TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (enterprise_id) REFERENCES enterprises(id)
	);

	CREATE INDEX IF NOT EXISTS idx_history_enterprise ON inspector_history(enterprise_id);
	CREATE INDEX IF NOT EXISTS idx_history_round ON inspector_history(inspector_round);
	CREATE INDEX IF NOT EXISTS idx_history_date ON inspector_history(inspection_date);
	`
	_, err := DB.Exec(schema)
	return err
}
