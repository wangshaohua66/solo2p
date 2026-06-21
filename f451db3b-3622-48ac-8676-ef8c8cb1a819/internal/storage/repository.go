// Package storage provides the SQLite persistence layer for the scheduling
// assistant: meter readings, dispatch instructions, audit logs and balance
// plans. It is concurrency-safe and tuned for the project's performance budget
// (WAL mode, a bounded connection pool, indexed queries and paged access).
package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3" // CGO SQLite driver

	"scheduler/internal/models"
)

// DefaultPageSize is the page size used when callers do not specify one. It
// matches the CLI auto-pagination threshold of 50 rows.
const DefaultPageSize = 50

// ReadingFilter narrows a readings query.
type ReadingFilter struct {
	StationID string
	From      time.Time
	To        time.Time
	OnlyValid bool
}

// DispatchFilter narrows a dispatch query.
type DispatchFilter struct {
	StationID string
	Operator  string
	Status    string
	From      time.Time
	To        time.Time
}

// Page holds the rows and total count returned by a paged query.
type Page[T any] struct {
	Rows  []T
	Total int64
	Page  int
	Size  int
}

// Repository wraps a *sql.DB with domain-specific helpers.
type Repository struct {
	db *sql.DB
	mu sync.RWMutex
}

// New opens the SQLite database at dsn, applies pragmatic PRAGMAs and creates
// the schema if missing. maxOpen controls the connection pool ceiling which
// directly governs concurrent-query throughput.
func New(dsn string, maxOpen int) (*Repository, error) {
	if maxOpen <= 0 {
		maxOpen = 10
	}
	// Layer connection-level PRAGMAs into the DSN so every pooled connection
	// honours busy_timeout/WAL/foreign keys, not just the first one.
	if !strings.Contains(dsn, "?") {
		dsn += "?_busy_timeout=5000&_journal_mode=WAL&_synchronous=NORMAL&_foreign_keys=on"
	}
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxOpen)
	db.SetConnMaxLifetime(0)
	// journal_mode=WAL is database-persistent; the rest are also in the DSN but
	// re-asserted here for environments that ignore DSN pragmas.
	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA busy_timeout=5000",
		"PRAGMA foreign_keys=ON",
		"PRAGMA temp_store=MEMORY",
	} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("pragma %q: %w", pragma, err)
		}
	}
	r := &Repository{db: db}
	if err := r.initSchema(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return r, nil
}

// Close releases the underlying database handle.
func (r *Repository) Close() error { return r.db.Close() }

// DB exposes the underlying handle for advanced callers (e.g. the API layer).
func (r *Repository) DB() *sql.DB { return r.db }

// initSchema creates all tables and indexes. It is idempotent.
func (r *Repository) initSchema(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS readings (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			station_id   TEXT    NOT NULL,
			ts           TEXT    NOT NULL,
			pressure     REAL    NOT NULL,
			temperature  REAL    NOT NULL,
			flow_rate    REAL    NOT NULL,
			accumulated  REAL    NOT NULL,
			valid        INTEGER NOT NULL,
			anomaly      TEXT    NOT NULL DEFAULT '',
			collected_at TEXT    NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_readings_station_ts ON readings(station_id, ts)`,
		`CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts)`,

		`CREATE TABLE IF NOT EXISTS dispatches (
			id           TEXT    PRIMARY KEY,
			station_id   TEXT    NOT NULL,
			station_name TEXT    NOT NULL,
			urgency      TEXT    NOT NULL,
			adjust_type  TEXT    NOT NULL,
			target_value REAL    NOT NULL,
			current      REAL    NOT NULL,
			execute_from TEXT    NOT NULL,
			execute_to   TEXT    NOT NULL,
			safety_notes TEXT    NOT NULL DEFAULT '',
			operator     TEXT    NOT NULL DEFAULT '',
			status       TEXT    NOT NULL DEFAULT 'draft',
			reason       TEXT    NOT NULL DEFAULT '',
			created_at   TEXT    NOT NULL,
			executed_at  TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dispatches_station ON dispatches(station_id)`,
		`CREATE INDEX IF NOT EXISTS idx_dispatches_created ON dispatches(created_at)`,

		`CREATE TABLE IF NOT EXISTS audit_logs (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			action     TEXT NOT NULL,
			operator   TEXT NOT NULL,
			detail     TEXT NOT NULL,
			changed_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_changed ON audit_logs(changed_at)`,

		`CREATE TABLE IF NOT EXISTS balance_plans (
			id         TEXT PRIMARY KEY,
			ts         TEXT NOT NULL,
			payload    TEXT NOT NULL
		)`,
	}
	for _, s := range stmts {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("schema %q: %w", s, err)
		}
	}
	return nil
}

// SaveReadings persists a batch of readings atomically. On any failure the
// transaction is rolled back so a partial poll never leaves the store in an
// inconsistent state, satisfying the data-validation rollback requirement.
func (r *Repository) SaveReadings(ctx context.Context, rs []models.Reading) error {
	if len(rs) == 0 {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	stmt, err := tx.PrepareContext(ctx, `INSERT INTO readings
		(station_id, ts, pressure, temperature, flow_rate, accumulated, valid, anomaly, collected_at)
		VALUES (?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()
	for _, rd := range rs {
		valid := 0
		if rd.Valid {
			valid = 1
		}
		if _, err := stmt.ExecContext(ctx, rd.StationID, rd.Timestamp.Format(time.RFC3339),
			rd.Pressure, rd.Temperature, rd.FlowRate, rd.Accumulated, valid, rd.Anomaly,
			rd.CollectedAt.Format(time.RFC3339)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("insert reading for %s: %w", rd.StationID, err)
		}
	}
	return tx.Commit()
}

// QueryReadings runs a paged, filtered readings query.
func (r *Repository) QueryReadings(ctx context.Context, f ReadingFilter, page, size int) (Page[models.Reading], error) {
	if size <= 0 {
		size = DefaultPageSize
	}
	if page <= 0 {
		page = 1
	}
	var (
		where []byte
		args  []any
	)
	where = append(where, "1=1"...)
	if f.StationID != "" {
		where = append(where, " AND station_id=?"...)
		args = append(args, f.StationID)
	}
	if !f.From.IsZero() {
		where = append(where, " AND ts>=?"...)
		args = append(args, f.From.Format(time.RFC3339))
	}
	if !f.To.IsZero() {
		where = append(where, " AND ts<=?"...)
		args = append(args, f.To.Format(time.RFC3339))
	}
	if f.OnlyValid {
		where = append(where, " AND valid=1"...)
	}
	var total int64
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM readings WHERE "+string(where), args...).Scan(&total); err != nil {
		return Page[models.Reading]{}, err
	}
	args = append(args, size, (page-1)*size)
	rows, err := r.db.QueryContext(ctx, `SELECT id, station_id, ts, pressure, temperature, flow_rate,
		accumulated, valid, anomaly, collected_at FROM readings WHERE `+string(where)+
		` ORDER BY ts DESC LIMIT ? OFFSET ?`, args...)
	if err != nil {
		return Page[models.Reading]{}, err
	}
	defer rows.Close()
	out := make([]models.Reading, 0, size)
	for rows.Next() {
		var rd models.Reading
		var valid int
		var ts, collected string
		if err := rows.Scan(&rd.ID, &rd.StationID, &ts, &rd.Pressure, &rd.Temperature,
			&rd.FlowRate, &rd.Accumulated, &valid, &rd.Anomaly, &collected); err != nil {
			return Page[models.Reading]{}, err
		}
		rd.Valid = valid == 1
		rd.Timestamp, _ = time.Parse(time.RFC3339, ts)
		rd.CollectedAt, _ = time.Parse(time.RFC3339, collected)
		out = append(out, rd)
	}
	return Page[models.Reading]{Rows: out, Total: total, Page: page, Size: size}, rows.Err()
}

// LatestReadings returns the most recent reading per station for the monitor.
func (r *Repository) LatestReadings(ctx context.Context) ([]models.Reading, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT r.id, r.station_id, r.ts, r.pressure, r.temperature,
		r.flow_rate, r.accumulated, r.valid, r.anomaly, r.collected_at
		FROM readings r
		INNER JOIN (SELECT station_id, MAX(ts) mts FROM readings GROUP BY station_id) x
		ON x.station_id=r.station_id AND x.mts=r.ts`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Reading, 0, 16)
	for rows.Next() {
		var rd models.Reading
		var valid int
		var ts, collected string
		if err := rows.Scan(&rd.ID, &rd.StationID, &ts, &rd.Pressure, &rd.Temperature,
			&rd.FlowRate, &rd.Accumulated, &valid, &rd.Anomaly, &collected); err != nil {
			return nil, err
		}
		rd.Valid = valid == 1
		rd.Timestamp, _ = time.Parse(time.RFC3339, ts)
		rd.CollectedAt, _ = time.Parse(time.RFC3339, collected)
		out = append(out, rd)
	}
	return out, rows.Err()
}

// MonthlyVolumes returns (stationID, volumeNm3) pairs for a calendar month.
// Volume is derived from the running accumulated counter: max-min within the
// month, which aligns with the field metrology of the SCADA accumulators.
func (r *Repository) MonthlyVolumes(ctx context.Context, month string) ([]struct {
	StationID string
	Volume    float64
}, error) {
	start := month + "-01T00:00:00Z"
	y, m, err := parseMonth(month)
	if err != nil {
		return nil, err
	}
	end := time.Date(y, m+1, 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
	rows, err := r.db.QueryContext(ctx, `SELECT station_id, MAX(accumulated)-MIN(accumulated)
		FROM readings WHERE ts>=? AND ts<? AND valid=1 GROUP BY station_id`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]struct {
		StationID string
		Volume    float64
	}, 0, 16)
	for rows.Next() {
		var sid string
		var vol float64
		if err := rows.Scan(&sid, &vol); err != nil {
			return nil, err
		}
		out = append(out, struct {
			StationID string
			Volume    float64
		}{sid, vol})
	}
	return out, rows.Err()
}

// SaveDispatch persists a dispatch instruction (insert or update by id).
func (r *Repository) SaveDispatch(ctx context.Context, d models.DispatchInstruction) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	var executed any
	if !d.ExecuteTo.IsZero() {
		executed = d.ExecuteTo.Format(time.RFC3339)
	}
	_, err := r.db.ExecContext(ctx, `INSERT INTO dispatches
		(id, station_id, station_name, urgency, adjust_type, target_value, current,
		 execute_from, execute_to, safety_notes, operator, status, reason, created_at, executed_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
		 station_id=excluded.station_id, station_name=excluded.station_name,
		 urgency=excluded.urgency, adjust_type=excluded.adjust_type,
		 target_value=excluded.target_value, current=excluded.current,
		 execute_from=excluded.execute_from, execute_to=excluded.execute_to,
		 safety_notes=excluded.safety_notes, operator=excluded.operator,
		 status=excluded.status, reason=excluded.reason`,
		d.ID, d.StationID, d.StationName, string(d.Urgency), d.AdjustType, d.TargetValue, d.Current,
		d.ExecuteFrom.Format(time.RFC3339), d.ExecuteTo.Format(time.RFC3339), d.SafetyNotes,
		d.Operator, d.Status, d.Reason, d.CreatedAt.Format(time.RFC3339), executed)
	if err != nil {
		return fmt.Errorf("save dispatch: %w", err)
	}
	return nil
}

// UpdateDispatchStatus updates an instruction's lifecycle status.
func (r *Repository) UpdateDispatchStatus(ctx context.Context, id, status, operator string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	res, err := r.db.ExecContext(ctx, `UPDATE dispatches SET status=?, operator=? WHERE id=?`, status, operator, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("dispatch %s not found", id)
	}
	return nil
}

// QueryDispatches runs a paged, filtered dispatch query.
func (r *Repository) QueryDispatches(ctx context.Context, f DispatchFilter, page, size int) (Page[models.DispatchInstruction], error) {
	if size <= 0 {
		size = DefaultPageSize
	}
	if page <= 0 {
		page = 1
	}
	var where []byte
	var args []any
	where = append(where, "1=1"...)
	if f.StationID != "" {
		where = append(where, " AND station_id=?"...)
		args = append(args, f.StationID)
	}
	if f.Operator != "" {
		where = append(where, " AND operator=?"...)
		args = append(args, f.Operator)
	}
	if f.Status != "" {
		where = append(where, " AND status=?"...)
		args = append(args, f.Status)
	}
	if !f.From.IsZero() {
		where = append(where, " AND created_at>=?"...)
		args = append(args, f.From.Format(time.RFC3339))
	}
	if !f.To.IsZero() {
		where = append(where, " AND created_at<=?"...)
		args = append(args, f.To.Format(time.RFC3339))
	}
	var total int64
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM dispatches WHERE "+string(where), args...).Scan(&total); err != nil {
		return Page[models.DispatchInstruction]{}, err
	}
	args = append(args, size, (page-1)*size)
	rows, err := r.db.QueryContext(ctx, `SELECT id, station_id, station_name, urgency, adjust_type,
		target_value, current, execute_from, execute_to, safety_notes, operator, status, reason,
		created_at, executed_at FROM dispatches WHERE `+string(where)+
		` ORDER BY created_at DESC LIMIT ? OFFSET ?`, args...)
	if err != nil {
		return Page[models.DispatchInstruction]{}, err
	}
	defer rows.Close()
	out := make([]models.DispatchInstruction, 0, size)
	for rows.Next() {
		var d models.DispatchInstruction
		var from, to, created string
		var executed sql.NullString
		if err := rows.Scan(&d.ID, &d.StationID, &d.StationName, &d.Urgency, &d.AdjustType,
			&d.TargetValue, &d.Current, &from, &to, &d.SafetyNotes, &d.Operator,
			&d.Status, &d.Reason, &created, &executed); err != nil {
			return Page[models.DispatchInstruction]{}, err
		}
		d.ExecuteFrom, _ = time.Parse(time.RFC3339, from)
		d.ExecuteTo, _ = time.Parse(time.RFC3339, to)
		d.CreatedAt, _ = time.Parse(time.RFC3339, created)
		if executed.Valid {
			d.ExecuteTo, _ = time.Parse(time.RFC3339, executed.String)
		}
		out = append(out, d)
	}
	return Page[models.DispatchInstruction]{Rows: out, Total: total, Page: page, Size: size}, rows.Err()
}

// SaveBalancePlan stores a serialised balance plan for later review.
func (r *Repository) SaveBalancePlan(ctx context.Context, id string, payload []byte) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO balance_plans(id, ts, payload) VALUES(?,?,?)
		ON CONFLICT(id) DO UPDATE SET ts=excluded.ts, payload=excluded.payload`,
		id, time.Now().Format(time.RFC3339), string(payload))
	return err
}

// WriteAudit implements config.AuditSink.
func (r *Repository) WriteAudit(operator, action, detail string) error {
	_, err := r.db.Exec(`INSERT INTO audit_logs(action, operator, detail, changed_at) VALUES(?,?,?,?)`,
		action, operator, detail, time.Now().Format(time.RFC3339))
	return err
}

// QueryAudit returns recent audit entries.
func (r *Repository) QueryAudit(ctx context.Context, limit int) ([]models.AuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.QueryContext(ctx, `SELECT id, action, operator, detail, changed_at
		FROM audit_logs ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.AuditLog, 0, limit)
	for rows.Next() {
		var a models.AuditLog
		var changed string
		if err := rows.Scan(&a.ID, &a.Action, &a.Operator, &a.Detail, &changed); err != nil {
			return nil, err
		}
		a.ChangedAt, _ = time.Parse(time.RFC3339, changed)
		out = append(out, a)
	}
	return out, rows.Err()
}

// Count returns the row count of a table, used by the monitor to warn as the
// 5-million-row ceiling per table is approached.
func (r *Repository) Count(ctx context.Context, table string) (int64, error) {
	allowed := map[string]string{
		"readings": "1", "dispatches": "1", "audit_logs": "1", "balance_plans": "1",
	}
	if _, ok := allowed[table]; !ok {
		return 0, fmt.Errorf("unknown table %s", table)
	}
	var n int64
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+table).Scan(&n)
	return n, err
}

func parseMonth(month string) (int, time.Month, error) {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return 0, 0, fmt.Errorf("month must be YYYY-MM: %w", err)
	}
	return t.Year(), t.Month(), nil
}
