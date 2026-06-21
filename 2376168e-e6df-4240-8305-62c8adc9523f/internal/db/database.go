package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/shopspring/decimal"

	"clear-system/internal/model"
)

type Database struct {
	db *sql.DB
	mu sync.RWMutex
}

var instance *Database

const schemaSQL = `
CREATE TABLE IF NOT EXISTS clear_flow (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	biz_no TEXT NOT NULL,
	biz_type TEXT NOT NULL,
	biz_date TEXT NOT NULL,
	src_inst_id TEXT NOT NULL,
	dst_inst_id TEXT NOT NULL,
	amount TEXT NOT NULL,
	currency TEXT DEFAULT 'CNY',
	direction TEXT NOT NULL,
	payer_account TEXT,
	payer_name TEXT,
	payee_account TEXT,
	payee_name TEXT,
	summary TEXT,
	ref_no TEXT,
	source_file TEXT,
	line_no INTEGER,
	status TEXT DEFAULT 'PENDING',
	parse_time DATETIME,
	remark TEXT,
	raw_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_flow_biz ON clear_flow(biz_no, biz_date);
CREATE INDEX IF NOT EXISTS idx_flow_inst ON clear_flow(src_inst_id, dst_inst_id, biz_date);
CREATE INDEX IF NOT EXISTS idx_flow_status ON clear_flow(status, biz_date);

CREATE TABLE IF NOT EXISTS match_result (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	flow_id1 INTEGER NOT NULL,
	flow_id2 INTEGER NOT NULL,
	match_score INTEGER,
	amount_diff TEXT,
	match_type TEXT,
	tolerance_used INTEGER DEFAULT 0,
	match_time DATETIME,
	biz_date TEXT,
	src_inst_id TEXT,
	dst_inst_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_match_date ON match_result(biz_date);
CREATE INDEX IF NOT EXISTS idx_match_flows ON match_result(flow_id1, flow_id2);

CREATE TABLE IF NOT EXISTS unilateral_flow (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	flow_id INTEGER NOT NULL,
	pending_side TEXT NOT NULL,
	hang_time DATETIME,
	biz_date TEXT,
	inst_id TEXT,
	status TEXT DEFAULT 'UNILATERAL'
);

CREATE INDEX IF NOT EXISTS idx_uni_flow ON unilateral_flow(flow_id);
CREATE INDEX IF NOT EXISTS idx_uni_date ON unilateral_flow(biz_date, inst_id);

CREATE TABLE IF NOT EXISTS net_position (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	settle_date TEXT NOT NULL,
	inst_id TEXT NOT NULL,
	currency TEXT DEFAULT 'CNY',
	total_receive TEXT DEFAULT '0',
	total_pay TEXT DEFAULT '0',
	net_amount TEXT DEFAULT '0',
	match_count INTEGER DEFAULT 0,
	unilateral_count INTEGER DEFAULT 0,
	status TEXT DEFAULT 'PENDING',
	create_time DATETIME,
	UNIQUE(settle_date, inst_id, currency)
);

CREATE TABLE IF NOT EXISTS settle_instruction (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	instruction_no TEXT NOT NULL UNIQUE,
	settle_date TEXT,
	sender_inst_id TEXT,
	receiver_inst_id TEXT,
	amount TEXT,
	currency TEXT,
	format TEXT,
	content TEXT,
	status TEXT DEFAULT 'PENDING',
	create_time DATETIME,
	send_time DATETIME
);

CREATE INDEX IF NOT EXISTS idx_inst_date ON settle_instruction(settle_date, status);

CREATE TABLE IF NOT EXISTS audit_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	op_time DATETIME,
	op_type TEXT,
	operator TEXT,
	inst_id TEXT,
	biz_date TEXT,
	detail TEXT,
	ip_address TEXT,
	result TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(op_time);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(op_type, inst_id);

CREATE TABLE IF NOT EXISTS notification (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	send_time DATETIME,
	type TEXT,
	target TEXT,
	title TEXT,
	content TEXT,
	status TEXT,
	inst_id TEXT,
	biz_date TEXT,
	retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS parse_progress (
	file_hash TEXT PRIMARY KEY,
	file_path TEXT,
	last_line INTEGER DEFAULT 0,
	last_offset INTEGER DEFAULT 0,
	update_time DATETIME,
	total_lines INTEGER DEFAULT 0
);
`

func Init(dbPath string) (*Database, error) {
	if instance != nil {
		return instance, nil
	}

	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("创建数据库目录失败: %w", err)
		}
	}

	dsn := fmt.Sprintf("%s?_journal=WAL&_busy_timeout=5000&_cache_size=-65536", dbPath)
	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}

	sqlDB.SetMaxOpenConns(16)
	sqlDB.SetMaxIdleConns(8)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if _, err := sqlDB.Exec(schemaSQL); err != nil {
		return nil, fmt.Errorf("初始化表结构失败: %w", err)
	}

	instance = &Database{db: sqlDB}
	return instance, nil
}

func Get() *Database {
	return instance
}

func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

func (d *Database) DB() *sql.DB {
	return d.db
}

func (d *Database) Tx(fn func(tx *sql.Tx) error) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

func (d *Database) InsertFlows(flows []model.ClearFlow) (int64, error) {
	if len(flows) == 0 {
		return 0, nil
	}
	var count int64
	err := d.Tx(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`INSERT INTO clear_flow 
			(biz_no, biz_type, biz_date, src_inst_id, dst_inst_id, amount, currency, direction,
			 payer_account, payer_name, payee_account, payee_name, summary, ref_no, 
			 source_file, line_no, status, parse_time, remark, raw_data)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, f := range flows {
			pt := f.ParseTime
			if pt.IsZero() {
				pt = time.Now()
			}
			res, err := stmt.Exec(
				f.BizNo, f.BizType, f.BizDate, f.SrcInstID, f.DstInstID,
				f.Amount.String(), f.Currency, f.Direction,
				f.PayerAccount, f.PayerName, f.PayeeAccount, f.PayeeName,
				f.Summary, f.RefNo, f.SourceFile, f.LineNo, f.Status,
				pt, f.Remark, f.RawData,
			)
			if err != nil {
				return err
			}
			aff, _ := res.RowsAffected()
			count += aff
		}
		return nil
	})
	return count, err
}

func (d *Database) QueryFlowsByBizDate(bizDate string, status ...model.ClearStatus) ([]model.ClearFlow, error) {
	query := `SELECT id, biz_no, biz_type, biz_date, src_inst_id, dst_inst_id, amount, currency, direction,
		payer_account, payer_name, payee_account, payee_name, summary, ref_no,
		source_file, line_no, status, parse_time, remark, COALESCE(raw_data, '') 
		FROM clear_flow WHERE biz_date = ?`
	args := []interface{}{bizDate}
	if len(status) > 0 {
		placeholders := make([]string, len(status))
		for i, s := range status {
			placeholders[i] = "?"
			args = append(args, s)
		}
		query += fmt.Sprintf(" AND status IN (%s)", join(placeholders, ","))
	}
	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flows []model.ClearFlow
	for rows.Next() {
		var f model.ClearFlow
		var amtStr string
		err := rows.Scan(
			&f.ID, &f.BizNo, &f.BizType, &f.BizDate, &f.SrcInstID, &f.DstInstID,
			&amtStr, &f.Currency, &f.Direction, &f.PayerAccount, &f.PayerName,
			&f.PayeeAccount, &f.PayeeName, &f.Summary, &f.RefNo, &f.SourceFile,
			&f.LineNo, &f.Status, &f.ParseTime, &f.Remark, &f.RawData,
		)
		if err != nil {
			return nil, err
		}
		f.Amount, _ = decimal.NewFromString(amtStr)
		flows = append(flows, f)
	}
	return flows, rows.Err()
}

func (d *Database) QueryFlowsByInst(instID, bizDate string, direction ...model.Direction) ([]model.ClearFlow, error) {
	query := `SELECT id, biz_no, biz_type, biz_date, src_inst_id, dst_inst_id, amount, currency, direction,
		payer_account, payer_name, payee_account, payee_name, summary, ref_no,
		source_file, line_no, status, parse_time, remark, COALESCE(raw_data, '')
		FROM clear_flow WHERE biz_date = ? AND (src_inst_id = ? OR dst_inst_id = ?)`
	args := []interface{}{bizDate, instID, instID}
	if len(direction) > 0 {
		dirs := make([]string, len(direction))
		for i, d := range direction {
			dirs[i] = string(d)
		}
	}
	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flows []model.ClearFlow
	for rows.Next() {
		var f model.ClearFlow
		var amtStr string
		err := rows.Scan(
			&f.ID, &f.BizNo, &f.BizType, &f.BizDate, &f.SrcInstID, &f.DstInstID,
			&amtStr, &f.Currency, &f.Direction, &f.PayerAccount, &f.PayerName,
			&f.PayeeAccount, &f.PayeeName, &f.Summary, &f.RefNo, &f.SourceFile,
			&f.LineNo, &f.Status, &f.ParseTime, &f.Remark, &f.RawData,
		)
		if err != nil {
			return nil, err
		}
		f.Amount, _ = decimal.NewFromString(amtStr)
		flows = append(flows, f)
	}
	return flows, rows.Err()
}

func (d *Database) UpdateFlowStatus(ids []int64, status model.ClearStatus, remark string) error {
	if len(ids) == 0 {
		return nil
	}
	return d.Tx(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`UPDATE clear_flow SET status = ?, remark = COALESCE(remark, '') || ? WHERE id = ?`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, id := range ids {
			_, err := stmt.Exec(status, remark, id)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (d *Database) InsertMatchResult(r model.MatchResult) (int64, error) {
	res, err := d.db.Exec(`INSERT INTO match_result
		(flow_id1, flow_id2, match_score, amount_diff, match_type, tolerance_used, match_time, biz_date, src_inst_id, dst_inst_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.FlowID1, r.FlowID2, r.MatchScore, r.AmountDiff.String(),
		r.MatchType, boolToInt(r.ToleranceUsed), r.MatchTime,
		r.BizDate, r.SrcInstID, r.DstInstID,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (d *Database) InsertMatchResults(results []model.MatchResult) (int64, error) {
	if len(results) == 0 {
		return 0, nil
	}
	var count int64
	err := d.Tx(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`INSERT INTO match_result
			(flow_id1, flow_id2, match_score, amount_diff, match_type, tolerance_used, match_time, biz_date, src_inst_id, dst_inst_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, r := range results {
			mt := r.MatchTime
			if mt.IsZero() {
				mt = time.Now()
			}
			res, err := stmt.Exec(
				r.FlowID1, r.FlowID2, r.MatchScore, r.AmountDiff.String(),
				r.MatchType, boolToInt(r.ToleranceUsed), mt,
				r.BizDate, r.SrcInstID, r.DstInstID,
			)
			if err != nil {
				return err
			}
			aff, _ := res.RowsAffected()
			count += aff
		}
		return nil
	})
	return count, err
}

func (d *Database) InsertUnilateralFlows(items []model.UnilateralFlow) (int64, error) {
	if len(items) == 0 {
		return 0, nil
	}
	var count int64
	err := d.Tx(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`INSERT INTO unilateral_flow
			(flow_id, pending_side, hang_time, biz_date, inst_id, status)
			VALUES (?, ?, ?, ?, ?, ?)`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, u := range items {
			ht := u.HangTime
			if ht.IsZero() {
				ht = time.Now()
			}
			res, err := stmt.Exec(u.FlowID, u.PendingSide, ht, u.BizDate, u.InstID, u.Status)
			if err != nil {
				return err
			}
			aff, _ := res.RowsAffected()
			count += aff
		}
		return nil
	})
	return count, err
}

func (d *Database) InsertNetPositions(positions []model.NetPosition) (int64, error) {
	if len(positions) == 0 {
		return 0, nil
	}
	var count int64
	err := d.Tx(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`INSERT OR REPLACE INTO net_position
			(settle_date, inst_id, currency, total_receive, total_pay, net_amount, 
			 match_count, unilateral_count, status, create_time)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, p := range positions {
			ct := p.CreateTime
			if ct.IsZero() {
				ct = time.Now()
			}
			res, err := stmt.Exec(
				p.SettleDate, p.InstID, p.Currency,
				p.TotalReceive.String(), p.TotalPay.String(), p.NetAmount.String(),
				p.MatchCount, p.UnilateralCount, p.Status, ct,
			)
			if err != nil {
				return err
			}
			aff, _ := res.RowsAffected()
			count += aff
		}
		return nil
	})
	return count, err
}

func (d *Database) QueryNetPositions(settleDate string) ([]model.NetPosition, error) {
	rows, err := d.db.Query(`SELECT id, settle_date, inst_id, currency, total_receive, total_pay, net_amount,
		match_count, unilateral_count, status, create_time FROM net_position WHERE settle_date = ?`, settleDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []model.NetPosition
	for rows.Next() {
		var p model.NetPosition
		var tr, tp, na string
		err := rows.Scan(&p.ID, &p.SettleDate, &p.InstID, &p.Currency, &tr, &tp, &na,
			&p.MatchCount, &p.UnilateralCount, &p.Status, &p.CreateTime)
		if err != nil {
			return nil, err
		}
		p.TotalReceive, _ = decimal.NewFromString(tr)
		p.TotalPay, _ = decimal.NewFromString(tp)
		p.NetAmount, _ = decimal.NewFromString(na)
		result = append(result, p)
	}
	return result, rows.Err()
}

func (d *Database) InsertInstructions(insts []model.SettleInstruction) (int64, error) {
	if len(insts) == 0 {
		return 0, nil
	}
	var count int64
	err := d.Tx(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`INSERT INTO settle_instruction
			(instruction_no, settle_date, sender_inst_id, receiver_inst_id, amount, currency, 
			 format, content, status, create_time)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, i := range insts {
			ct := i.CreateTime
			if ct.IsZero() {
				ct = time.Now()
			}
			res, err := stmt.Exec(
				i.InstructionNo, i.SettleDate, i.SenderInstID, i.ReceiverInstID,
				i.Amount.String(), i.Currency, i.Format, i.Content, i.Status, ct,
			)
			if err != nil {
				return err
			}
			aff, _ := res.RowsAffected()
			count += aff
		}
		return nil
	})
	return count, err
}

func (d *Database) QueryInstructions(settleDate, status string) ([]model.SettleInstruction, error) {
	q := `SELECT id, instruction_no, settle_date, sender_inst_id, receiver_inst_id,
		amount, currency, format, content, status, create_time, send_time
		FROM settle_instruction WHERE settle_date = ?`
	args := []interface{}{settleDate}
	if status != "" {
		q += " AND status = ?"
		args = append(args, status)
	}
	rows, err := d.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []model.SettleInstruction
	for rows.Next() {
		var i model.SettleInstruction
		var amt string
		var sendTime sql.NullTime
		err := rows.Scan(&i.ID, &i.InstructionNo, &i.SettleDate, &i.SenderInstID, &i.ReceiverInstID,
			&amt, &i.Currency, &i.Format, &i.Content, &i.Status, &i.CreateTime, &sendTime)
		if err != nil {
			return nil, err
		}
		i.Amount, _ = decimal.NewFromString(amt)
		if sendTime.Valid {
			i.SendTime = &sendTime.Time
		}
		result = append(result, i)
	}
	return result, rows.Err()
}

func (d *Database) InsertAuditLog(log model.AuditLog) error {
	ot := log.OpTime
	if ot.IsZero() {
		ot = time.Now()
	}
	_, err := d.db.Exec(`INSERT INTO audit_log 
		(op_time, op_type, operator, inst_id, biz_date, detail, ip_address, result)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		ot, log.OpType, log.Operator, log.InstID, log.BizDate, log.Detail, log.IPAddress, log.Result)
	return err
}

func (d *Database) QueryAuditLogs(startDate, endDate, opType, instID string) ([]model.AuditLog, error) {
	q := `SELECT id, op_time, op_type, operator, inst_id, biz_date, detail, ip_address, result 
		FROM audit_log WHERE op_time BETWEEN ? AND ?`
	args := []interface{}{startDate, endDate}
	if opType != "" {
		q += " AND op_type = ?"
		args = append(args, opType)
	}
	if instID != "" {
		q += " AND inst_id = ?"
		args = append(args, instID)
	}
	q += " ORDER BY op_time DESC LIMIT 10000"
	rows, err := d.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var logs []model.AuditLog
	for rows.Next() {
		var l model.AuditLog
		err := rows.Scan(&l.ID, &l.OpTime, &l.OpType, &l.Operator, &l.InstID,
			&l.BizDate, &l.Detail, &l.IPAddress, &l.Result)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, rows.Err()
}

func (d *Database) SaveParseProgress(fileHash, filePath string, lastLine, lastOffset, totalLines int64) error {
	_, err := d.db.Exec(`INSERT OR REPLACE INTO parse_progress
		(file_hash, file_path, last_line, last_offset, update_time, total_lines)
		VALUES (?, ?, ?, ?, ?, ?)`,
		fileHash, filePath, lastLine, lastOffset, time.Now(), totalLines)
	return err
}

func (d *Database) GetParseProgress(fileHash string) (int64, int64, int64, error) {
	var lastLine, lastOffset, totalLines sql.NullInt64
	err := d.db.QueryRow(`SELECT last_line, last_offset, total_lines FROM parse_progress WHERE file_hash = ?`,
		fileHash).Scan(&lastLine, &lastOffset, &totalLines)
	if err == sql.ErrNoRows {
		return 0, 0, 0, nil
	}
	if err != nil {
		return 0, 0, 0, err
	}
	return lastLine.Int64, lastOffset.Int64, totalLines.Int64, nil
}

func (d *Database) QueryMatchResults(bizDate string) ([]model.MatchResult, error) {
	rows, err := d.db.Query(`SELECT id, flow_id1, flow_id2, match_score, amount_diff, 
		match_type, tolerance_used, match_time, biz_date, src_inst_id, dst_inst_id
		FROM match_result WHERE biz_date = ?`, bizDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []model.MatchResult
	for rows.Next() {
		var r model.MatchResult
		var diffStr string
		var tu int
		err := rows.Scan(&r.ID, &r.FlowID1, &r.FlowID2, &r.MatchScore, &diffStr,
			&r.MatchType, &tu, &r.MatchTime, &r.BizDate, &r.SrcInstID, &r.DstInstID)
		if err != nil {
			return nil, err
		}
		r.AmountDiff, _ = decimal.NewFromString(diffStr)
		r.ToleranceUsed = tu > 0
		results = append(results, r)
	}
	return results, rows.Err()
}

func (d *Database) QueryUnilateralFlows(bizDate string) ([]model.UnilateralFlow, error) {
	rows, err := d.db.Query(`SELECT id, flow_id, pending_side, hang_time, biz_date, inst_id, status
		FROM unilateral_flow WHERE biz_date = ?`, bizDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []model.UnilateralFlow
	for rows.Next() {
		var u model.UnilateralFlow
		err := rows.Scan(&u.ID, &u.FlowID, &u.PendingSide, &u.HangTime, &u.BizDate, &u.InstID, &u.Status)
		if err != nil {
			return nil, err
		}
		result = append(result, u)
	}
	return result, rows.Err()
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func join(items []string, sep string) string {
	if len(items) == 0 {
		return ""
	}
	result := items[0]
	for i := 1; i < len(items); i++ {
		result += sep + items[i]
	}
	return result
}
