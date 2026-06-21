package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	pverrors "pavement/internal/errors"

	_ "github.com/mattn/go-sqlite3"
)

type PavementRecord struct {
	ID             int64     `json:"id"`
	RouteID        string    `json:"route_id"`
	StartStation   int       `json:"start_station"`
	EndStation     int       `json:"end_station"`
	SectionLength  float64   `json:"section_length"`
	IRI            float64   `json:"iri"`
	RutDepth       float64   `json:"rut_depth"`
	CrackDensity   float64   `json:"crack_density"`
	IRIScore       int       `json:"iri_score"`
	RutScore       int       `json:"rut_score"`
	CrackScore     int       `json:"crack_score"`
	TotalScore     float64   `json:"total_score"`
	DiseaseGrade   string    `json:"disease_grade"`
	TrafficVolume  float64   `json:"traffic_volume"`
	Importance     float64   `json:"importance"`
	MaintenanceCenter string  `json:"maintenance_center"`
	DetectDate     time.Time `json:"detect_date"`
	BatchID        string    `json:"batch_id"`
	PriorityScore  float64   `json:"priority_score"`
	EstimatedCost  float64   `json:"estimated_cost"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type QueryCondition struct {
	RouteID      string
	StartStation *int
	EndStation   *int
	Grade        string
	StartDate    *time.Time
	EndDate      *time.Time
	Limit        int
	Offset       int
}

type StatisticsResult struct {
	Dimension     string  `json:"dimension"`
	Value         string  `json:"value"`
	SectionCount  int     `json:"section_count"`
	TotalMileage  float64 `json:"total_mileage"`
	MileageRatio  float64 `json:"mileage_ratio"`
	Excellent     int     `json:"excellent"`
	Good          int     `json:"good"`
	Medium        int     `json:"medium"`
	Poor          int     `json:"poor"`
}

type BudgetAllocation struct {
	RecordID       int64   `json:"record_id"`
	RouteID        string  `json:"route_id"`
	StartStation   string  `json:"start_station"`
	EndStation     string  `json:"end_station"`
	DiseaseGrade   string  `json:"disease_grade"`
	SectionLength  float64 `json:"section_length"`
	PriorityScore  float64 `json:"priority_score"`
	EstimatedCost  float64 `json:"estimated_cost"`
	AllocatedFund  float64 `json:"allocated_fund"`
	FundingRatio   float64 `json:"funding_ratio"`
	FundingStatus  string  `json:"funding_status"`
}

type Database struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS pavement_records (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	route_id TEXT NOT NULL,
	start_station INTEGER NOT NULL,
	end_station INTEGER NOT NULL,
	section_length REAL NOT NULL,
	iri REAL NOT NULL DEFAULT 0,
	rut_depth REAL NOT NULL DEFAULT 0,
	crack_density REAL NOT NULL DEFAULT 0,
	iri_score INTEGER NOT NULL DEFAULT 0,
	rut_score INTEGER NOT NULL DEFAULT 0,
	crack_score INTEGER NOT NULL DEFAULT 0,
	total_score REAL NOT NULL DEFAULT 0,
	disease_grade TEXT NOT NULL DEFAULT '中',
	traffic_volume REAL NOT NULL DEFAULT 0,
	importance REAL NOT NULL DEFAULT 1,
	maintenance_center TEXT NOT NULL DEFAULT '',
	detect_date DATETIME NOT NULL,
	batch_id TEXT NOT NULL DEFAULT '',
	priority_score REAL NOT NULL DEFAULT 0,
	estimated_cost REAL NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_route_id ON pavement_records(route_id);
CREATE INDEX IF NOT EXISTS idx_detect_date ON pavement_records(detect_date);
CREATE INDEX IF NOT EXISTS idx_disease_grade ON pavement_records(disease_grade);
CREATE INDEX IF NOT EXISTS idx_batch_id ON pavement_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_center ON pavement_records(maintenance_center);
CREATE INDEX IF NOT EXISTS idx_station_range ON pavement_records(start_station, end_station);
CREATE INDEX IF NOT EXISTS idx_priority_score ON pavement_records(priority_score DESC);
`

func NewDatabase(dbPath string) (*Database, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000&_cache_size=-64000")
	if err != nil {
		return nil, pverrors.NewStorageError(
			pverrors.ErrStorageOpenFailed,
			fmt.Sprintf("无法打开数据库: %s", dbPath),
			"请检查数据库文件路径是否正确，确保有读写权限",
			err,
		)
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(2)
	d := &Database{db: db}
	if err := d.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return d, nil
}

func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

func (d *Database) migrate() error {
	_, err := d.db.Exec(schema)
	if err != nil {
		return pverrors.NewStorageError(
			pverrors.ErrStorageMigrationFailed,
			"数据库表结构迁移失败",
			"请确保数据库文件未被其他进程锁定",
			err,
		)
	}
	return nil
}

func (d *Database) DB() *sql.DB {
	return d.db
}

func (d *Database) BeginTx(ctx context.Context) (*sql.Tx, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, pverrors.NewStorageError(
			pverrors.ErrStorageTxBeginFailed,
			"开始数据库事务失败",
			"请稍后重试或检查数据库连接",
			err,
		)
	}
	return tx, nil
}

func (d *Database) InsertRecord(tx *sql.Tx, record *PavementRecord) (int64, error) {
	now := time.Now()
	query := `INSERT INTO pavement_records (
		route_id, start_station, end_station, section_length,
		iri, rut_depth, crack_density,
		iri_score, rut_score, crack_score, total_score, disease_grade,
		traffic_volume, importance, maintenance_center,
		detect_date, batch_id, priority_score, estimated_cost,
		created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	var stmt *sql.Stmt
	var err error
	if tx != nil {
		stmt, err = tx.Prepare(query)
	} else {
		stmt, err = d.db.Prepare(query)
	}
	if err != nil {
		return 0, pverrors.NewStorageError(
			pverrors.ErrStorageInsertFailed,
			"准备插入语句失败",
			"请检查表结构是否正确",
			err,
		)
	}
	defer stmt.Close()

	res, err := stmt.Exec(
		record.RouteID, record.StartStation, record.EndStation, record.SectionLength,
		record.IRI, record.RutDepth, record.CrackDensity,
		record.IRIScore, record.RutScore, record.CrackScore, record.TotalScore, record.DiseaseGrade,
		record.TrafficVolume, record.Importance, record.MaintenanceCenter,
		record.DetectDate, record.BatchID, record.PriorityScore, record.EstimatedCost,
		now, now,
	)
	if err != nil {
		return 0, pverrors.NewStorageError(
			pverrors.ErrStorageInsertFailed,
			"插入路面检测记录失败",
			"请检查数据字段是否符合要求",
			err,
		)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	record.ID = id
	record.CreatedAt = now
	record.UpdatedAt = now
	return id, nil
}

func (d *Database) BatchInsertRecords(records []*PavementRecord) (int, error) {
	tx, err := d.BeginTx(context.Background())
	if err != nil {
		return 0, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	successCount := 0
	for _, record := range records {
		_, err = d.InsertRecord(tx, record)
		if err != nil {
			continue
		}
		successCount++
	}

	if err = tx.Commit(); err != nil {
		return successCount, pverrors.NewStorageError(
			pverrors.ErrStorageTxCommitFailed,
			"提交批量插入事务失败",
			"请重试批量插入操作",
			err,
		)
	}
	return successCount, nil
}

func (d *Database) QueryRecords(cond *QueryCondition) ([]*PavementRecord, error) {
	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if cond.RouteID != "" {
		whereClauses = append(whereClauses, "route_id = ?")
		args = append(args, cond.RouteID)
	}
	if cond.StartStation != nil {
		whereClauses = append(whereClauses, "end_station >= ?")
		args = append(args, *cond.StartStation)
	}
	if cond.EndStation != nil {
		whereClauses = append(whereClauses, "start_station <= ?")
		args = append(args, *cond.EndStation)
	}
	if cond.Grade != "" {
		whereClauses = append(whereClauses, "disease_grade = ?")
		args = append(args, cond.Grade)
	}
	if cond.StartDate != nil {
		whereClauses = append(whereClauses, "detect_date >= ?")
		args = append(args, *cond.StartDate)
	}
	if cond.EndDate != nil {
		whereClauses = append(whereClauses, "detect_date <= ?")
		args = append(args, *cond.EndDate)
	}

	query := `SELECT id, route_id, start_station, end_station, section_length,
		iri, rut_depth, crack_density,
		iri_score, rut_score, crack_score, total_score, disease_grade,
		traffic_volume, importance, maintenance_center,
		detect_date, batch_id, priority_score, estimated_cost,
		created_at, updated_at
	FROM pavement_records`

	whereSQL := ""
	for _, w := range whereClauses {
		if whereSQL == "" {
			whereSQL = " WHERE " + w
		} else {
			whereSQL += " AND " + w
		}
	}
	query += whereSQL
	query += " ORDER BY detect_date DESC, route_id ASC"

	if cond.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, cond.Limit)
		if cond.Offset > 0 {
			query += " OFFSET ?"
			args = append(args, cond.Offset)
		}
	}

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, pverrors.NewStorageError(
			pverrors.ErrStorageQueryFailed,
			"查询路面记录失败",
			"请检查查询条件是否合理",
			err,
		)
	}
	defer rows.Close()

	records := []*PavementRecord{}
	for rows.Next() {
		r := &PavementRecord{}
		var detectDate, createdAt, updatedAt string
		err := rows.Scan(
			&r.ID, &r.RouteID, &r.StartStation, &r.EndStation, &r.SectionLength,
			&r.IRI, &r.RutDepth, &r.CrackDensity,
			&r.IRIScore, &r.RutScore, &r.CrackScore, &r.TotalScore, &r.DiseaseGrade,
			&r.TrafficVolume, &r.Importance, &r.MaintenanceCenter,
			&detectDate, &r.BatchID, &r.PriorityScore, &r.EstimatedCost,
			&createdAt, &updatedAt,
		)
		if err != nil {
			return nil, err
		}
		r.DetectDate, _ = time.Parse("2006-01-02 15:04:05-07:00", detectDate)
		if r.DetectDate.IsZero() {
			r.DetectDate, _ = time.Parse("2006-01-02T15:04:05Z", detectDate)
		}
		if r.DetectDate.IsZero() {
			r.DetectDate, _ = time.Parse("2006-01-02 15:04:05", detectDate)
		}
		r.CreatedAt, _ = time.Parse("2006-01-02 15:04:05-07:00", createdAt)
		r.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05-07:00", updatedAt)
		records = append(records, r)
	}
	return records, rows.Err()
}

func (d *Database) GetTopPriorityRecords(topN int) ([]*PavementRecord, error) {
	query := `SELECT id, route_id, start_station, end_station, section_length,
		iri, rut_depth, crack_density,
		iri_score, rut_score, crack_score, total_score, disease_grade,
		traffic_volume, importance, maintenance_center,
		detect_date, batch_id, priority_score, estimated_cost,
		created_at, updated_at
	FROM pavement_records
	ORDER BY priority_score DESC, total_score ASC
	LIMIT ?`

	rows, err := d.db.Query(query, topN)
	if err != nil {
		return nil, pverrors.NewStorageError(
			pverrors.ErrStorageQueryFailed,
			"查询高优先级路段失败",
			"请检查数据库中是否已有检测数据",
			err,
		)
	}
	defer rows.Close()

	records := []*PavementRecord{}
	for rows.Next() {
		r := &PavementRecord{}
		var detectDate, createdAt, updatedAt string
		err := rows.Scan(
			&r.ID, &r.RouteID, &r.StartStation, &r.EndStation, &r.SectionLength,
			&r.IRI, &r.RutDepth, &r.CrackDensity,
			&r.IRIScore, &r.RutScore, &r.CrackScore, &r.TotalScore, &r.DiseaseGrade,
			&r.TrafficVolume, &r.Importance, &r.MaintenanceCenter,
			&detectDate, &r.BatchID, &r.PriorityScore, &r.EstimatedCost,
			&createdAt, &updatedAt,
		)
		if err != nil {
			return nil, err
		}
		r.DetectDate, _ = time.Parse("2006-01-02 15:04:05-07:00", detectDate)
		if r.DetectDate.IsZero() {
			r.DetectDate, _ = time.Parse("2006-01-02 15:04:05", detectDate)
		}
		r.CreatedAt, _ = time.Parse("2006-01-02 15:04:05-07:00", createdAt)
		r.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05-07:00", updatedAt)
		records = append(records, r)
	}
	return records, rows.Err()
}

func (d *Database) UpdatePriorityAndCost(id int64, priorityScore, estimatedCost float64) error {
	now := time.Now()
	query := `UPDATE pavement_records SET priority_score = ?, estimated_cost = ?, updated_at = ? WHERE id = ?`
	_, err := d.db.Exec(query, priorityScore, estimatedCost, now, id)
	if err != nil {
		return pverrors.NewStorageError(
			pverrors.ErrStorageUpdateFailed,
			fmt.Sprintf("更新路段优先级失败: ID=%d", id),
			"请检查该记录是否存在",
			err,
		)
	}
	return nil
}

func (d *Database) UpdateRecordClassify(id int64, iriScore, rutScore, crackScore int, totalScore float64, grade string) error {
	now := time.Now()
	query := `UPDATE pavement_records SET 
		iri_score = ?, rut_score = ?, crack_score = ?, 
		total_score = ?, disease_grade = ?, updated_at = ? 
	WHERE id = ?`
	_, err := d.db.Exec(query, iriScore, rutScore, crackScore, totalScore, grade, now, id)
	if err != nil {
		return pverrors.NewStorageError(
			pverrors.ErrStorageUpdateFailed,
			fmt.Sprintf("更新病害判定结果失败: ID=%d", id),
			"请检查该记录是否存在",
			err,
		)
	}
	return nil
}

func (d *Database) DeleteByBatchID(batchID string) (int64, error) {
	query := `DELETE FROM pavement_records WHERE batch_id = ?`
	res, err := d.db.Exec(query, batchID)
	if err != nil {
		return 0, pverrors.NewStorageError(
			pverrors.ErrStorageDeleteFailed,
			fmt.Sprintf("按批次号删除失败: batch_id=%s", batchID),
			"请检查批次号是否正确",
			err,
		)
	}
	return res.RowsAffected()
}

func (d *Database) DeleteByDateRange(startDate, endDate time.Time) (int64, error) {
	query := `DELETE FROM pavement_records WHERE detect_date >= ? AND detect_date <= ?`
	res, err := d.db.Exec(query, startDate, endDate)
	if err != nil {
		return 0, pverrors.NewStorageError(
			pverrors.ErrStorageDeleteFailed,
			fmt.Sprintf("按日期范围删除失败: %s ~ %s", startDate, endDate),
			"请检查日期格式是否正确",
			err,
		)
	}
	return res.RowsAffected()
}

func (d *Database) GetAllRecordsCount() (int64, error) {
	var count int64
	err := d.db.QueryRow("SELECT COUNT(*) FROM pavement_records").Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (d *Database) GetStatisticsByRoute() ([]*StatisticsResult, error) {
	query := `
		SELECT 
			route_id,
			COUNT(*) as section_count,
			SUM(section_length) as total_mileage,
			SUM(CASE WHEN disease_grade = '优' THEN 1 ELSE 0 END) as excellent,
			SUM(CASE WHEN disease_grade = '良' THEN 1 ELSE 0 END) as good,
			SUM(CASE WHEN disease_grade = '中' THEN 1 ELSE 0 END) as medium,
			SUM(CASE WHEN disease_grade = '差' THEN 1 ELSE 0 END) as poor
		FROM pavement_records
		GROUP BY route_id
		ORDER BY total_mileage DESC
	`
	return d.queryStatistics(query, "route_id")
}

func (d *Database) GetStatisticsByCenter() ([]*StatisticsResult, error) {
	query := `
		SELECT 
			COALESCE(NULLIF(maintenance_center, ''), '未分配') as center_name,
			COUNT(*) as section_count,
			SUM(section_length) as total_mileage,
			SUM(CASE WHEN disease_grade = '优' THEN 1 ELSE 0 END) as excellent,
			SUM(CASE WHEN disease_grade = '良' THEN 1 ELSE 0 END) as good,
			SUM(CASE WHEN disease_grade = '中' THEN 1 ELSE 0 END) as medium,
			SUM(CASE WHEN disease_grade = '差' THEN 1 ELSE 0 END) as poor
		FROM pavement_records
		GROUP BY maintenance_center
		ORDER BY total_mileage DESC
	`
	return d.queryStatistics(query, "maintenance_center")
}

func (d *Database) GetStatisticsByGrade() ([]*StatisticsResult, error) {
	query := `
		SELECT 
			disease_grade,
			COUNT(*) as section_count,
			SUM(section_length) as total_mileage,
			0 as excellent,
			0 as good,
			0 as medium,
			0 as poor
		FROM pavement_records
		GROUP BY disease_grade
		ORDER BY 
			CASE disease_grade 
				WHEN '优' THEN 1 
				WHEN '良' THEN 2 
				WHEN '中' THEN 3 
				WHEN '差' THEN 4 
				ELSE 5 
			END
	`
	return d.queryStatistics(query, "disease_grade")
}

func (d *Database) queryStatistics(query, dimension string) ([]*StatisticsResult, error) {
	rows, err := d.db.Query(query)
	if err != nil {
		return nil, pverrors.NewStorageError(
			pverrors.ErrStorageQueryFailed,
			fmt.Sprintf("统计查询失败: 维度=%s", dimension),
			"请检查表结构和索引状态",
			err,
		)
	}
	defer rows.Close()

	var totalMileage float64
	var results []*StatisticsResult
	for rows.Next() {
		s := &StatisticsResult{Dimension: dimension}
		err := rows.Scan(
			&s.Value, &s.SectionCount, &s.TotalMileage,
			&s.Excellent, &s.Good, &s.Medium, &s.Poor,
		)
		if err != nil {
			return nil, err
		}
		totalMileage += s.TotalMileage
		results = append(results, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, s := range results {
		if totalMileage > 0 {
			s.MileageRatio = (s.TotalMileage / totalMileage) * 100
		}
	}
	return results, nil
}

func (d *Database) GetTotalMileage() (float64, error) {
	var total sql.NullFloat64
	err := d.db.QueryRow("SELECT SUM(section_length) FROM pavement_records").Scan(&total)
	if err != nil {
		return 0, err
	}
	if total.Valid {
		return total.Float64, nil
	}
	return 0, nil
}
