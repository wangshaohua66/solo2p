package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"

	_ "modernc.org/sqlite"
)

type FileStatus string

const (
	FileStatusPending   FileStatus = "pending"
	FileStatusSyncing   FileStatus = "syncing"
	FileStatusCompleted FileStatus = "completed"
	FileStatusFailed    FileStatus = "failed"
	FileStatusSkipped   FileStatus = "skipped"
	FileStatusConflict  FileStatus = "conflict"
	FileStatusDeleted   FileStatus = "deleted"
)

type TaskStatus string

const (
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusPaused    TaskStatus = "paused"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusCancelled TaskStatus = "cancelled"
)

type SyncTask struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	Status        TaskStatus `json:"status"`
	SourceType    string     `json:"source_type"`
	SourceBucket  string     `json:"source_bucket"`
	SourcePrefix  string     `json:"source_prefix"`
	TargetType    string     `json:"target_type"`
	TargetBucket  string     `json:"target_bucket"`
	TargetPrefix  string     `json:"target_prefix"`

	TotalFiles     int64 `json:"total_files"`
	TotalSize      int64 `json:"total_size"`
	CompletedFiles int64 `json:"completed_files"`
	CompletedSize  int64 `json:"completed_size"`
	FailedFiles    int64 `json:"failed_files"`
	SkippedFiles   int64 `json:"skipped_files"`
	ConflictFiles  int64 `json:"conflict_files"`
	DeletedFiles   int64 `json:"deleted_files"`
}

type FileRecord struct {
	TaskID         string     `json:"task_id"`
	Key            string     `json:"key"`
	Size           int64      `json:"size"`
	SourceChecksum string     `json:"source_checksum"`
	TargetChecksum string     `json:"target_checksum"`
	SourceETag     string     `json:"source_etag"`
	TargetETag     string     `json:"target_etag"`
	LastModified   time.Time  `json:"last_modified"`
	Status         FileStatus `json:"status"`
	Version        int64      `json:"version"`
	Attempts       int        `json:"attempts"`
	ErrorMessage   string     `json:"error_message,omitempty"`
	StartTime      *time.Time `json:"start_time,omitempty"`
	EndTime        *time.Time `json:"end_time,omitempty"`
	DurationMs     int64      `json:"duration_ms"`
}

type ProgressDB struct {
	mu      sync.Mutex
	db      *sql.DB
	path    string
	maxSize int64
}

const (
	createTasksTableSQL = `CREATE TABLE IF NOT EXISTS tasks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		started_at TEXT,
		completed_at TEXT,
		status TEXT NOT NULL DEFAULT 'running',
		source_type TEXT NOT NULL DEFAULT '',
		source_bucket TEXT NOT NULL DEFAULT '',
		source_prefix TEXT NOT NULL DEFAULT '',
		target_type TEXT NOT NULL DEFAULT '',
		target_bucket TEXT NOT NULL DEFAULT '',
		target_prefix TEXT NOT NULL DEFAULT '',
		total_files INTEGER NOT NULL DEFAULT 0,
		total_size INTEGER NOT NULL DEFAULT 0,
		completed_files INTEGER NOT NULL DEFAULT 0,
		completed_size INTEGER NOT NULL DEFAULT 0,
		failed_files INTEGER NOT NULL DEFAULT 0,
		skipped_files INTEGER NOT NULL DEFAULT 0,
		conflict_files INTEGER NOT NULL DEFAULT 0,
		deleted_files INTEGER NOT NULL DEFAULT 0
	)`

	createFileRecordsTableSQL = `CREATE TABLE IF NOT EXISTS file_records (
		task_id TEXT NOT NULL,
		key TEXT NOT NULL,
		size INTEGER NOT NULL DEFAULT 0,
		source_checksum TEXT NOT NULL DEFAULT '',
		target_checksum TEXT NOT NULL DEFAULT '',
		source_etag TEXT NOT NULL DEFAULT '',
		target_etag TEXT NOT NULL DEFAULT '',
		last_modified TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'pending',
		version INTEGER NOT NULL DEFAULT 0,
		attempts INTEGER NOT NULL DEFAULT 0,
		error_message TEXT NOT NULL DEFAULT '',
		start_time TEXT,
		end_time TEXT,
		duration_ms INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (task_id, key)
	)`

	createIndexSQL = `CREATE INDEX IF NOT EXISTS idx_file_records_status ON file_records(task_id, status)`
)

func NewProgressDB(cfg *config.ProgressConfig) (*ProgressDB, error) {
	absPath, err := filepath.Abs(cfg.DBPath)
	if err != nil {
		return nil, fmt.Errorf("resolve db path: %w", err)
	}

	dir := filepath.Dir(absPath)
	if dir != "" && dir != "." {
		if err := mkdirAll(dir); err != nil {
			return nil, fmt.Errorf("create db dir: %w", err)
		}
	}

	dsn := fmt.Sprintf("file:%s?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL", absPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	pdb := &ProgressDB{
		db:      db,
		path:    absPath,
		maxSize: cfg.MaxDBSizeMB * 1024 * 1024,
	}

	if err := pdb.init(); err != nil {
		db.Close()
		return nil, err
	}

	return pdb, nil
}

func mkdirAll(dir string) error {
	return os.MkdirAll(dir, 0755)
}

func (db *ProgressDB) init() error {
	_, err := db.db.Exec(createTasksTableSQL)
	if err != nil {
		return fmt.Errorf("create tasks table: %w", err)
	}
	_, err = db.db.Exec(createFileRecordsTableSQL)
	if err != nil {
		return fmt.Errorf("create file_records table: %w", err)
	}
	_, err = db.db.Exec(createIndexSQL)
	if err != nil {
		return fmt.Errorf("create index: %w", err)
	}

	_, err = db.db.Exec("PRAGMA auto_vacuum = INCREMENTAL")
	if err != nil {
		logger.Warn("Failed to set auto_vacuum: %v", err)
	}
	return nil
}

func (db *ProgressDB) checkSizeLimit() {
	if db.maxSize <= 0 {
		return
	}
	var size int64
	row := db.db.QueryRow("SELECT page_count * page_size FROM pragma_page_count()")
	_ = row.Scan(&size)
	if size > db.maxSize {
		logger.Warn("Progress DB size %d exceeds limit %d, cleaning old tasks", size, db.maxSize)
		db.cleanOldTasks()
	}
}

func (db *ProgressDB) cleanOldTasks() {
	cutoff := time.Now().AddDate(0, 0, -7)
	_, err := db.db.Exec("DELETE FROM file_records WHERE task_id IN (SELECT id FROM tasks WHERE completed_at IS NOT NULL AND completed_at < ?)", cutoff.Format(time.RFC3339Nano))
	if err != nil {
		logger.Warn("Failed to clean old file records: %v", err)
	}
	_, err = db.db.Exec("DELETE FROM tasks WHERE completed_at IS NOT NULL AND completed_at < ?", cutoff.Format(time.RFC3339Nano))
	if err != nil {
		logger.Warn("Failed to clean old tasks: %v", err)
	}
	_, _ = db.db.Exec("PRAGMA incremental_vacuum")
}

func (db *ProgressDB) CreateTask(task *SyncTask) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if task.ID == "" {
		task.ID = fmt.Sprintf("task-%d", time.Now().UnixNano())
	}
	now := time.Now()
	task.CreatedAt = now
	task.UpdatedAt = now
	task.Status = TaskStatusRunning

	_, err := db.db.Exec(`INSERT INTO tasks
		(id, name, created_at, updated_at, status, source_type, source_bucket, source_prefix, target_type, target_bucket, target_prefix,
		 total_files, total_size, completed_files, completed_size, failed_files, skipped_files, conflict_files, deleted_files)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`,
		task.ID, task.Name, task.CreatedAt.Format(time.RFC3339Nano), task.UpdatedAt.Format(time.RFC3339Nano),
		string(task.Status), task.SourceType, task.SourceBucket, task.SourcePrefix,
		task.TargetType, task.TargetBucket, task.TargetPrefix,
	)
	if err != nil {
		return fmt.Errorf("insert task: %w", err)
	}

	logger.Debug("Created task: %s", task.ID)
	return nil
}

func (db *ProgressDB) GetTask(taskID string) (*SyncTask, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	row := db.db.QueryRow(`SELECT id, name, created_at, updated_at, started_at, completed_at, status,
		source_type, source_bucket, source_prefix, target_type, target_bucket, target_prefix,
		total_files, total_size, completed_files, completed_size, failed_files, skipped_files, conflict_files, deleted_files
		FROM tasks WHERE id = ?`, taskID)

	task, err := scanTask(row)
	if err != nil {
		return nil, fmt.Errorf("task %s not found: %w", taskID, err)
	}
	return task, nil
}

func (db *ProgressDB) ListTasks(limit int) ([]*SyncTask, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if limit <= 0 {
		limit = 100
	}

	rows, err := db.db.Query(`SELECT id, name, created_at, updated_at, started_at, completed_at, status,
		source_type, source_bucket, source_prefix, target_type, target_bucket, target_prefix,
		total_files, total_size, completed_files, completed_size, failed_files, skipped_files, conflict_files, deleted_files
		FROM tasks ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*SyncTask
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func (db *ProgressDB) UpdateTaskStats(taskID string, completedSize int64, statuses map[FileStatus]int64) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	now := time.Now().Format(time.RFC3339Nano)

	completed := statuses[FileStatusCompleted]
	failed := statuses[FileStatusFailed]
	skipped := statuses[FileStatusSkipped]
	conflict := statuses[FileStatusConflict]
	deleted := statuses[FileStatusDeleted]

	_, err := db.db.Exec(`UPDATE tasks SET updated_at = ?, completed_size = ?,
		completed_files = ?, failed_files = ?, skipped_files = ?, conflict_files = ?, deleted_files = ?
		WHERE id = ?`,
		now, completedSize, completed, failed, skipped, conflict, deleted, taskID)
	if err != nil {
		return fmt.Errorf("update task stats: %w", err)
	}
	return nil
}

func (db *ProgressDB) UpdateTaskTotals(taskID string, totalFiles, totalSize int64) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	_, err := db.db.Exec(`UPDATE tasks SET total_files = ?, total_size = ?, updated_at = ? WHERE id = ?`,
		totalFiles, totalSize, time.Now().Format(time.RFC3339Nano), taskID)
	return err
}

func (db *ProgressDB) CompleteTask(taskID string, status TaskStatus) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	now := time.Now().Format(time.RFC3339Nano)
	_, err := db.db.Exec(`UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
		string(status), now, now, taskID)
	if err != nil {
		return fmt.Errorf("complete task: %w", err)
	}

	db.checkSizeLimit()
	return nil
}

func (db *ProgressDB) PauseTask(taskID string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	_, err := db.db.Exec(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`,
		string(TaskStatusPaused), time.Now().Format(time.RFC3339Nano), taskID)
	return err
}

func (db *ProgressDB) DeleteTask(taskID string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	_, err := db.db.Exec("DELETE FROM file_records WHERE task_id = ?", taskID)
	if err != nil {
		return fmt.Errorf("delete file records: %w", err)
	}
	_, err = db.db.Exec("DELETE FROM tasks WHERE id = ?", taskID)
	if err != nil {
		return fmt.Errorf("delete task: %w", err)
	}
	return nil
}

func (db *ProgressDB) UpsertFileRecord(record *FileRecord) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	var existingVersion int64
	row := db.db.QueryRow("SELECT version FROM file_records WHERE task_id = ? AND key = ?", record.TaskID, record.Key)
	err := row.Scan(&existingVersion)
	if err == sql.ErrNoRows {
		record.Version = 1
	} else if err != nil {
		return fmt.Errorf("query existing record: %w", err)
	} else {
		if record.Version == 0 {
			record.Version = existingVersion + 1
		}
	}

	var startTime, endTime *string
	if record.StartTime != nil {
		s := record.StartTime.Format(time.RFC3339Nano)
		startTime = &s
	}
	if record.EndTime != nil {
		s := record.EndTime.Format(time.RFC3339Nano)
		endTime = &s
	}

	_, err = db.db.Exec(`INSERT INTO file_records
		(task_id, key, size, source_checksum, target_checksum, source_etag, target_etag, last_modified,
		 status, version, attempts, error_message, start_time, end_time, duration_ms)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(task_id, key) DO UPDATE SET
			size = excluded.size,
			source_checksum = excluded.source_checksum,
			target_checksum = excluded.target_checksum,
			source_etag = excluded.source_etag,
			target_etag = excluded.target_etag,
			last_modified = excluded.last_modified,
			status = excluded.status,
			version = excluded.version,
			attempts = excluded.attempts,
			error_message = excluded.error_message,
			start_time = excluded.start_time,
			end_time = excluded.end_time,
			duration_ms = excluded.duration_ms`,
		record.TaskID, record.Key, record.Size,
		record.SourceChecksum, record.TargetChecksum, record.SourceETag, record.TargetETag,
		record.LastModified.Format(time.RFC3339Nano),
		string(record.Status), record.Version, record.Attempts, record.ErrorMessage,
		startTime, endTime, record.DurationMs,
	)
	if err != nil {
		return fmt.Errorf("upsert file record: %w", err)
	}
	return nil
}

func (db *ProgressDB) GetFileRecord(taskID, key string) (*FileRecord, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	row := db.db.QueryRow(`SELECT task_id, key, size, source_checksum, target_checksum, source_etag, target_etag,
		last_modified, status, version, attempts, error_message, start_time, end_time, duration_ms
		FROM file_records WHERE task_id = ? AND key = ?`, taskID, key)

	return scanFileRecord(row)
}

func (db *ProgressDB) GetPendingFiles(taskID string) ([]*FileRecord, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	rows, err := db.db.Query(`SELECT task_id, key, size, source_checksum, target_checksum, source_etag, target_etag,
		last_modified, status, version, attempts, error_message, start_time, end_time, duration_ms
		FROM file_records WHERE task_id = ? AND status IN ('pending', 'failed', 'syncing')
		ORDER BY key`, taskID)
	if err != nil {
		return nil, fmt.Errorf("query pending files: %w", err)
	}
	defer rows.Close()

	var result []*FileRecord
	for rows.Next() {
		rec, err := scanFileRecord(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, rec)
	}
	return result, nil
}

func (db *ProgressDB) GetCompletedFiles(taskID string) ([]*FileRecord, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	rows, err := db.db.Query(`SELECT task_id, key, size, source_checksum, target_checksum, source_etag, target_etag,
		last_modified, status, version, attempts, error_message, start_time, end_time, duration_ms
		FROM file_records WHERE task_id = ? AND status = 'completed'
		ORDER BY key`, taskID)
	if err != nil {
		return nil, fmt.Errorf("query completed files: %w", err)
	}
	defer rows.Close()

	var result []*FileRecord
	for rows.Next() {
		rec, err := scanFileRecord(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, rec)
	}
	return result, nil
}

func (db *ProgressDB) GetAllFileRecords(taskID string) ([]*FileRecord, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	rows, err := db.db.Query(`SELECT task_id, key, size, source_checksum, target_checksum, source_etag, target_etag,
		last_modified, status, version, attempts, error_message, start_time, end_time, duration_ms
		FROM file_records WHERE task_id = ?
		ORDER BY key`, taskID)
	if err != nil {
		return nil, fmt.Errorf("query all file records: %w", err)
	}
	defer rows.Close()

	var result []*FileRecord
	for rows.Next() {
		rec, err := scanFileRecord(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, rec)
	}
	return result, nil
}

func (db *ProgressDB) GetFileCounts(taskID string) (map[FileStatus]int64, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	rows, err := db.db.Query("SELECT status, COUNT(*) FROM file_records WHERE task_id = ? GROUP BY status", taskID)
	if err != nil {
		return nil, fmt.Errorf("query file counts: %w", err)
	}
	defer rows.Close()

	counts := make(map[FileStatus]int64)
	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		counts[FileStatus(status)] = count
	}
	return counts, nil
}

func (db *ProgressDB) Save() error {
	return nil
}

func (db *ProgressDB) Close() error {
	if db.db != nil {
		return db.db.Close()
	}
	return nil
}

type scanner interface {
	Scan(dest ...interface{}) error
}

func scanTask(s scanner) (*SyncTask, error) {
	var task SyncTask
	var createdAt, updatedAt, status string
	var startedAt, completedAt sql.NullString
	var startedAtT, completedAtT *time.Time

	err := s.Scan(
		&task.ID, &task.Name, &createdAt, &updatedAt, &startedAt, &completedAt, &status,
		&task.SourceType, &task.SourceBucket, &task.SourcePrefix,
		&task.TargetType, &task.TargetBucket, &task.TargetPrefix,
		&task.TotalFiles, &task.TotalSize, &task.CompletedFiles, &task.CompletedSize,
		&task.FailedFiles, &task.SkippedFiles, &task.ConflictFiles, &task.DeletedFiles,
	)
	if err != nil {
		return nil, err
	}

	task.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
	task.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updatedAt)
	task.Status = TaskStatus(status)
	if startedAt.Valid {
		t, _ := time.Parse(time.RFC3339Nano, startedAt.String)
		startedAtT = &t
	}
	task.StartedAt = startedAtT
	if completedAt.Valid {
		t, _ := time.Parse(time.RFC3339Nano, completedAt.String)
		completedAtT = &t
	}
	task.CompletedAt = completedAtT

	return &task, nil
}

func scanFileRecord(s scanner) (*FileRecord, error) {
	var rec FileRecord
	var lastModified, status string
	var startTime, endTime sql.NullString
	var startTimeT, endTimeT *time.Time

	err := s.Scan(
		&rec.TaskID, &rec.Key, &rec.Size,
		&rec.SourceChecksum, &rec.TargetChecksum, &rec.SourceETag, &rec.TargetETag,
		&lastModified, &status, &rec.Version, &rec.Attempts, &rec.ErrorMessage,
		&startTime, &endTime, &rec.DurationMs,
	)
	if err != nil {
		return nil, err
	}

	rec.LastModified, _ = time.Parse(time.RFC3339Nano, lastModified)
	rec.Status = FileStatus(status)
	if startTime.Valid {
		t, _ := time.Parse(time.RFC3339Nano, startTime.String)
		startTimeT = &t
	}
	rec.StartTime = startTimeT
	if endTime.Valid {
		t, _ := time.Parse(time.RFC3339Nano, endTime.String)
		endTimeT = &t
	}
	rec.EndTime = endTimeT

	return &rec, nil
}
