package repository

import (
	"craftbrew-tracker/internal/config"
	"craftbrew-tracker/internal/model"
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/rs/zerolog/log"
)

type DB struct {
	*sql.DB
}

func New(cfg *config.DatabaseConfig) (*DB, error) {
	dsn := fmt.Sprintf("%s?_journal=WAL&_busy_timeout=5000&_foreign_keys=on&_cache_size=-64000&_synchronous=NORMAL", cfg.Path)

	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	repo := &DB{db}
	if err := repo.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	if err := repo.seed(); err != nil {
		log.Warn().Err(err).Msg("seed data failed, continuing")
	}

	log.Info().Msg("database initialized (WAL mode)")
	return repo, nil
}

func (db *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		real_name TEXT NOT NULL,
		role TEXT NOT NULL,
		email TEXT DEFAULT '',
		phone TEXT DEFAULT '',
		active INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS recipes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		code TEXT NOT NULL,
		version INTEGER NOT NULL DEFAULT 1,
		description TEXT DEFAULT '',
		style TEXT DEFAULT '',
		abv_target REAL DEFAULT 0,
		ibu_target REAL DEFAULT 0,
		srm_target REAL DEFAULT 0,
		created_by INTEGER NOT NULL,
		active INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(code, version)
	);

	CREATE TABLE IF NOT EXISTS recipe_ingredients (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		recipe_id INTEGER NOT NULL,
		material_id INTEGER NOT NULL,
		material_name TEXT NOT NULL,
		quantity_kg REAL NOT NULL,
		stage TEXT DEFAULT '',
		notes TEXT DEFAULT '',
		FOREIGN KEY(recipe_id) REFERENCES recipes(id)
	);
	CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

	CREATE TABLE IF NOT EXISTS recipe_params (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		recipe_id INTEGER NOT NULL,
		stage TEXT NOT NULL,
		param_name TEXT NOT NULL,
		target_value REAL DEFAULT 0,
		min_value REAL DEFAULT 0,
		max_value REAL DEFAULT 0,
		tolerance_pct REAL DEFAULT 5,
		unit TEXT DEFAULT '',
		required INTEGER DEFAULT 1,
		FOREIGN KEY(recipe_id) REFERENCES recipes(id)
	);
	CREATE INDEX IF NOT EXISTS idx_recipe_params_recipe_stage ON recipe_params(recipe_id, stage);

	CREATE TABLE IF NOT EXISTS batches (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_no TEXT UNIQUE NOT NULL,
		recipe_id INTEGER NOT NULL,
		recipe_version INTEGER NOT NULL,
		recipe_name TEXT NOT NULL,
		current_stage TEXT NOT NULL DEFAULT 'mashing',
		status TEXT NOT NULL DEFAULT 'active',
		target_volume_l REAL NOT NULL,
		actual_volume_l REAL DEFAULT 0,
		brewer_id INTEGER NOT NULL,
		brewer_name TEXT NOT NULL,
		mashing_start DATETIME,
		fermenting_start DATETIME,
		aging_start DATETIME,
		bottling_start DATETIME,
		completed_at DATETIME,
		notes TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
	CREATE INDEX IF NOT EXISTS idx_batches_stage ON batches(current_stage);
	CREATE INDEX IF NOT EXISTS idx_batches_recipe ON batches(recipe_id);
	CREATE INDEX IF NOT EXISTS idx_batches_created ON batches(created_at DESC);

	CREATE TABLE IF NOT EXISTS stage_params (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_id INTEGER NOT NULL,
		stage TEXT NOT NULL,
		param_name TEXT NOT NULL,
		param_value REAL NOT NULL,
		unit TEXT DEFAULT '',
		recorded_by INTEGER NOT NULL,
		recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		notes TEXT DEFAULT '',
		FOREIGN KEY(batch_id) REFERENCES batches(id)
	);
	CREATE INDEX IF NOT EXISTS idx_stage_params_batch_stage ON stage_params(batch_id, stage);

	CREATE TABLE IF NOT EXISTS batch_materials (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_id INTEGER NOT NULL,
		material_id INTEGER NOT NULL,
		material_name TEXT NOT NULL,
		material_lot TEXT NOT NULL,
		quantity_kg REAL NOT NULL,
		supplier TEXT DEFAULT '',
		FOREIGN KEY(batch_id) REFERENCES batches(id)
	);
	CREATE INDEX IF NOT EXISTS idx_batch_materials_batch ON batch_materials(batch_id);

	CREATE TABLE IF NOT EXISTS quality_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		code TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		category TEXT DEFAULT '',
		method TEXT DEFAULT '',
		min_value REAL,
		max_value REAL,
		target_value REAL,
		unit TEXT DEFAULT '',
		required INTEGER DEFAULT 1,
		applicable_stages TEXT DEFAULT '',
		created_by INTEGER NOT NULL,
		active INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS quality_samples (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sample_no TEXT UNIQUE NOT NULL,
		batch_id INTEGER NOT NULL,
		batch_no TEXT NOT NULL,
		stage TEXT NOT NULL,
		sampled_by INTEGER NOT NULL,
		sampled_by_name TEXT NOT NULL,
		sampled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		status TEXT NOT NULL DEFAULT 'pending',
		reviewed_by INTEGER,
		reviewed_at DATETIME,
		overall_pass INTEGER,
		notes TEXT DEFAULT '',
		retest_of_id INTEGER,
		FOREIGN KEY(batch_id) REFERENCES batches(id)
	);
	CREATE INDEX IF NOT EXISTS idx_quality_samples_batch ON quality_samples(batch_id);
	CREATE INDEX IF NOT EXISTS idx_quality_samples_status ON quality_samples(status);
	CREATE INDEX IF NOT EXISTS idx_quality_samples_created ON quality_samples(sampled_at DESC);

	CREATE TABLE IF NOT EXISTS quality_results (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sample_id INTEGER NOT NULL,
		item_id INTEGER NOT NULL,
		item_name TEXT NOT NULL,
		item_code TEXT NOT NULL,
		result_value REAL NOT NULL,
		unit TEXT DEFAULT '',
		is_pass INTEGER,
		tested_by INTEGER NOT NULL,
		tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		remarks TEXT DEFAULT '',
		FOREIGN KEY(sample_id) REFERENCES quality_samples(id),
		FOREIGN KEY(item_id) REFERENCES quality_items(id)
	);
	CREATE INDEX IF NOT EXISTS idx_quality_results_sample ON quality_results(sample_id);

	CREATE TABLE IF NOT EXISTS materials (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		code TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		category TEXT DEFAULT '',
		unit TEXT DEFAULT 'kg',
		supplier TEXT DEFAULT '',
		spec TEXT DEFAULT '',
		safety_stock REAL DEFAULT 0,
		active INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS material_lots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		material_id INTEGER NOT NULL,
		lot_no TEXT NOT NULL,
		quantity REAL NOT NULL DEFAULT 0,
		received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
		expiry_date DATETIME,
		warehouse TEXT DEFAULT '',
		location TEXT DEFAULT '',
		remarks TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(material_id, lot_no),
		FOREIGN KEY(material_id) REFERENCES materials(id)
	);
	CREATE INDEX IF NOT EXISTS idx_material_lots_expiry ON material_lots(expiry_date);

	CREATE TABLE IF NOT EXISTS finished_goods (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_id INTEGER NOT NULL,
		batch_no TEXT NOT NULL,
		product_code TEXT NOT NULL,
		product_name TEXT NOT NULL,
		package_type TEXT DEFAULT '',
		quantity INTEGER NOT NULL DEFAULT 0,
		unit TEXT DEFAULT 'bottle',
		volume_ml INTEGER DEFAULT 0,
		warehouse TEXT DEFAULT '',
		location TEXT DEFAULT '',
		produced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(batch_id) REFERENCES batches(id)
	);
	CREATE INDEX IF NOT EXISTS idx_finished_batch ON finished_goods(batch_id);

	CREATE TABLE IF NOT EXISTS stock_movements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		move_no TEXT UNIQUE NOT NULL,
		type TEXT NOT NULL,
		direction TEXT NOT NULL,
		material_id INTEGER,
		material_lot TEXT,
		finished_id INTEGER,
		batch_id INTEGER,
		quantity REAL NOT NULL,
		ref_no TEXT DEFAULT '',
		operator_id INTEGER NOT NULL,
		operator_name TEXT NOT NULL,
		remarks TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_movements_batch ON stock_movements(batch_id);

	CREATE TABLE IF NOT EXISTS alerts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		alert_type TEXT NOT NULL,
		level TEXT NOT NULL,
		title TEXT NOT NULL,
		message TEXT NOT NULL,
		batch_id INTEGER,
		batch_no TEXT,
		ref_type TEXT DEFAULT '',
		ref_id INTEGER DEFAULT 0,
		resolved INTEGER DEFAULT 0,
		resolved_by INTEGER,
		resolved_at DATETIME,
		resolved_note TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);

	CREATE TABLE IF NOT EXISTS deviation_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_id INTEGER NOT NULL,
		batch_no TEXT NOT NULL,
		stage TEXT NOT NULL,
		param_name TEXT NOT NULL,
		standard_value REAL NOT NULL,
		actual_value REAL NOT NULL,
		deviation_pct REAL NOT NULL,
		threshold_pct REAL NOT NULL,
		handled INTEGER DEFAULT 0,
		handler_id INTEGER,
		handle_note TEXT DEFAULT '',
		handled_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_deviation_batch ON deviation_logs(batch_id);
	CREATE INDEX IF NOT EXISTS idx_deviation_handled ON deviation_logs(handled);

	CREATE TABLE IF NOT EXISTS async_tasks (
		id TEXT PRIMARY KEY,
		task_type TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		progress INTEGER DEFAULT 0,
		result TEXT DEFAULT '',
		error_msg TEXT DEFAULT '',
		created_by INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS compliance_reports (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		report_no TEXT UNIQUE NOT NULL,
		report_type TEXT NOT NULL,
		batch_id INTEGER NOT NULL,
		batch_no TEXT NOT NULL,
		content_json TEXT NOT NULL,
		file_url TEXT DEFAULT '',
		generated_by INTEGER NOT NULL,
		generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_reports_batch ON compliance_reports(batch_id);
	`
	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("create schema: %w", err)
	}
	return nil
}

func (db *DB) seed() error {
	var count int
	_ = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	passwordHash := "$2a$10$u2VwJLg8w6qV8vZ5aM5nJOWZx2T5vHq5w6pAqZ9s7dV7zYx8C8X7K"

	users := []struct {
		Username, Password, RealName, Role, Email string
	}{
		{"admin", passwordHash, "系统管理员", string(model.RoleAdmin), "admin@craftbrew.com"},
		{"brewer01", passwordHash, "张酿酒师", string(model.RoleBrewer), "brewer01@craftbrew.com"},
		{"qc01", passwordHash, "李品控", string(model.RoleQC), "qc01@craftbrew.com"},
		{"wh01", passwordHash, "王仓管", string(model.RoleWarehouse), "wh01@craftbrew.com"},
		{"audit01", passwordHash, "赵审计", string(model.RoleCompliance), "audit01@craftbrew.com"},
	}

	for _, u := range users {
		_, err := tx.Exec(
			"INSERT INTO users(username, password_hash, real_name, role, email) VALUES(?,?,?,?,?)",
			u.Username, u.Password, u.RealName, u.Role, u.Email,
		)
		if err != nil {
			return err
		}
	}

	materials := []struct {
		Code, Name, Category, Unit, Supplier string
		SafetyStock                          float64
	}{
		{"MAT-001", "淡色麦芽", "malt", "kg", "麦芽供应商A", 500},
		{"MAT-002", "巧克力麦芽", "malt", "kg", "麦芽供应商A", 100},
		{"MAT-003", "西楚酒花", "hop", "kg", "酒花供应商B", 20},
		{"MAT-004", "酵母US-05", "yeast", "kg", "酵母供应商C", 10},
		{"MAT-005", "处理水", "water", "L", "本地水厂", 5000},
	}

	for _, m := range materials {
		_, err := tx.Exec(
			"INSERT INTO materials(code, name, category, unit, supplier, safety_stock) VALUES(?,?,?,?,?,?)",
			m.Code, m.Name, m.Category, m.Unit, m.Supplier, m.SafetyStock,
		)
		if err != nil {
			return err
		}
	}

	qItems := []struct {
		Code, Name, Category, Method, Unit, Stages string
		Min, Max, Target                           float64
	}{
		{"QC-001", "原麦汁浓度", "physical", "密度法", "°P", "mashing,fermenting,aging", 10, 14, 12},
		{"QC-002", "酒精含量", "physical", "蒸馏法", "vol%", "aging,bottling", 4, 6, 5},
		{"QC-003", "PH值", "chemical", "电极法", "", "mashing,fermenting,aging", 3.8, 4.6, 4.2},
		{"QC-004", "浊度", "physical", "浊度仪", "EBC", "bottling", 0, 1.5, 0.5},
		{"QC-005", "总酸", "chemical", "滴定法", "mL/100mL", "fermenting,aging", 1.0, 2.5, 1.8},
		{"QC-006", "菌落总数", "microbial", "平板计数", "CFU/mL", "bottling", 0, 100, 0},
	}

	for _, q := range qItems {
		_, err := tx.Exec(
			"INSERT INTO quality_items(code, name, category, method, min_value, max_value, target_value, unit, applicable_stages, created_by) VALUES(?,?,?,?,?,?,?,?,?,?)",
			q.Code, q.Name, q.Category, q.Method, q.Min, q.Max, q.Target, q.Unit, q.Stages, 1,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func CloseOrLog(db *sql.DB) {
	if db != nil {
		if err := db.Close(); err != nil {
			log.Error().Err(err).Msg("close db error")
			os.Stderr.WriteString("close db: " + err.Error() + "\n")
		}
	}
}
