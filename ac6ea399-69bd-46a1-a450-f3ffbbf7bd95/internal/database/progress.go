package database

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"
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
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	Status       TaskStatus `json:"status"`
	SourceType   string     `json:"source_type"`
	SourceBucket string     `json:"source_bucket"`
	SourcePrefix string     `json:"source_prefix"`
	TargetType   string     `json:"target_type"`
	TargetBucket string     `json:"target_bucket"`
	TargetPrefix string     `json:"target_prefix"`

	TotalFiles    int64 `json:"total_files"`
	TotalSize     int64 `json:"total_size"`
	CompletedFiles int64 `json:"completed_files"`
	CompletedSize  int64 `json:"completed_size"`
	FailedFiles    int64 `json:"failed_files"`
	SkippedFiles   int64 `json:"skipped_files"`
	ConflictFiles  int64 `json:"conflict_files"`
	DeletedFiles   int64 `json:"deleted_files"`
}

type FileRecord struct {
	TaskID       string     `json:"task_id"`
	Key          string     `json:"key"`
	Size         int64      `json:"size"`
	SourceChecksum string   `json:"source_checksum"`
	TargetChecksum string   `json:"target_checksum"`
	SourceETag   string     `json:"source_etag"`
	TargetETag   string     `json:"target_etag"`
	LastModified time.Time  `json:"last_modified"`
	Status       FileStatus `json:"status"`
	Version      int64      `json:"version"`
	Attempts     int        `json:"attempts"`
	ErrorMessage string     `json:"error_message,omitempty"`
	StartTime    *time.Time `json:"start_time,omitempty"`
	EndTime      *time.Time `json:"end_time,omitempty"`
	DurationMs   int64      `json:"duration_ms"`
}

type ProgressDB struct {
	mu       sync.RWMutex
	path     string
	tasks    map[string]*SyncTask
	files    map[string]map[string]*FileRecord
	dirty    bool
	maxSize  int64
}

func NewProgressDB(cfg *config.ProgressConfig) (*ProgressDB, error) {
	absPath, err := filepath.Abs(cfg.DBPath)
	if err != nil {
		return nil, fmt.Errorf("resolve db path: %w", err)
	}

	db := &ProgressDB{
		path:    absPath,
		tasks:   make(map[string]*SyncTask),
		files:   make(map[string]map[string]*FileRecord),
		maxSize: cfg.MaxDBSizeMB * 1024 * 1024,
	}

	if err := db.load(); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *ProgressDB) load() error {
	data, err := os.ReadFile(db.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read progress db: %w", err)
	}

	if int64(len(data)) > db.maxSize {
		logger.Warn("Progress DB size %d exceeds limit %d, resetting", len(data), db.maxSize)
		return nil
	}

	var raw struct {
		Tasks []SyncTask                `json:"tasks"`
		Files map[string][]*FileRecord `json:"files"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		logger.Warn("Failed to parse progress db: %v, starting fresh", err)
		return nil
	}

	for i := range raw.Tasks {
		t := raw.Tasks[i]
		db.tasks[t.ID] = &t
		db.files[t.ID] = make(map[string]*FileRecord)
	}
	for taskID, records := range raw.Files {
		if _, ok := db.files[taskID]; !ok {
			db.files[taskID] = make(map[string]*FileRecord)
		}
		for _, r := range records {
			db.files[taskID][r.Key] = r
		}
	}

	return nil
}

func (db *ProgressDB) Save() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	return db.saveLocked()
}

func (db *ProgressDB) saveLocked() error {
	raw := struct {
		Tasks []SyncTask                `json:"tasks"`
		Files map[string][]*FileRecord `json:"files"`
	}{
		Tasks: make([]SyncTask, 0, len(db.tasks)),
		Files: make(map[string][]*FileRecord),
	}
	for _, t := range db.tasks {
		raw.Tasks = append(raw.Tasks, *t)
		records := make([]*FileRecord, 0, len(db.files[t.ID]))
		for _, r := range db.files[t.ID] {
			records = append(records, r)
		}
		raw.Files[t.ID] = records
	}

	data, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal progress: %w", err)
	}

	if int64(len(data)) > db.maxSize {
		logger.Warn("Progress DB size %d exceeds limit %d, cleaning old records", len(data), db.maxSize)
		db.cleanOldTasks()
		data, err = json.MarshalIndent(raw, "", "  ")
		if err != nil {
			return fmt.Errorf("marshal progress after clean: %w", err)
		}
	}

	dir := filepath.Dir(db.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create db dir: %w", err)
	}

	tmpPath := db.path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("write progress db: %w", err)
	}
	if err := os.Rename(tmpPath, db.path); err != nil {
		return fmt.Errorf("rename progress db: %w", err)
	}

	db.dirty = false
	return nil
}

func (db *ProgressDB) cleanOldTasks() {
	cutoff := time.Now().AddDate(0, 0, -7)
	for id, t := range db.tasks {
		if t.CompletedAt != nil && t.CompletedAt.Before(cutoff) {
			delete(db.tasks, id)
			delete(db.files, id)
		}
	}
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

	db.tasks[task.ID] = task
	db.files[task.ID] = make(map[string]*FileRecord)
	db.dirty = true

	return db.saveLocked()
}

func (db *ProgressDB) GetTask(taskID string) (*SyncTask, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	t, ok := db.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task %s not found", taskID)
	}
	cp := *t
	return &cp, nil
}

func (db *ProgressDB) ListTasks(limit int) ([]*SyncTask, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	tasks := make([]*SyncTask, 0, len(db.tasks))
	for _, t := range db.tasks {
		cp := *t
		tasks = append(tasks, &cp)
	}
	if limit > 0 && len(tasks) > limit {
		tasks = tasks[:limit]
	}
	return tasks, nil
}

func (db *ProgressDB) UpdateTaskStats(taskID string, completedSize int64, statuses map[FileStatus]int64) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	t, ok := db.tasks[taskID]
	if !ok {
		return fmt.Errorf("task %s not found", taskID)
	}

	t.UpdatedAt = time.Now()
	if s, ok := statuses[FileStatusCompleted]; ok {
		t.CompletedFiles = s
	}
	if s, ok := statuses[FileStatusFailed]; ok {
		t.FailedFiles = s
	}
	if s, ok := statuses[FileStatusSkipped]; ok {
		t.SkippedFiles = s
	}
	if s, ok := statuses[FileStatusConflict]; ok {
		t.ConflictFiles = s
	}
	if s, ok := statuses[FileStatusDeleted]; ok {
		t.DeletedFiles = s
	}
	t.CompletedSize = completedSize

	db.dirty = true
	return nil
}

func (db *ProgressDB) CompleteTask(taskID string, status TaskStatus) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	t, ok := db.tasks[taskID]
	if !ok {
		return fmt.Errorf("task %s not found", taskID)
	}

	now := time.Now()
	t.UpdatedAt = now
	t.CompletedAt = &now
	t.Status = status

	db.dirty = true
	return db.saveLocked()
}

func (db *ProgressDB) PauseTask(taskID string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	t, ok := db.tasks[taskID]
	if !ok {
		return fmt.Errorf("task %s not found", taskID)
	}

	t.UpdatedAt = time.Now()
	t.Status = TaskStatusPaused
	db.dirty = true
	return db.saveLocked()
}

func (db *ProgressDB) DeleteTask(taskID string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	delete(db.tasks, taskID)
	delete(db.files, taskID)
	db.dirty = true
	return db.saveLocked()
}

func (db *ProgressDB) UpsertFileRecord(record *FileRecord) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if _, ok := db.files[record.TaskID]; !ok {
		db.files[record.TaskID] = make(map[string]*FileRecord)
	}
	db.files[record.TaskID][record.Key] = record
	db.dirty = true
	return nil
}

func (db *ProgressDB) GetFileRecord(taskID, key string) (*FileRecord, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	files, ok := db.files[taskID]
	if !ok {
		return nil, fmt.Errorf("task %s not found", taskID)
	}
	r, ok := files[key]
	if !ok {
		return nil, fmt.Errorf("file %s not found in task %s", key, taskID)
	}
	cp := *r
	return &cp, nil
}

func (db *ProgressDB) GetPendingFiles(taskID string) ([]*FileRecord, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	files, ok := db.files[taskID]
	if !ok {
		return nil, nil
	}
	var result []*FileRecord
	for _, r := range files {
		if r.Status == FileStatusPending || r.Status == FileStatusFailed || r.Status == FileStatusSyncing {
			cp := *r
			result = append(result, &cp)
		}
	}
	return result, nil
}

func (db *ProgressDB) GetCompletedFiles(taskID string) ([]*FileRecord, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	files, ok := db.files[taskID]
	if !ok {
		return nil, nil
	}
	var result []*FileRecord
	for _, r := range files {
		if r.Status == FileStatusCompleted {
			cp := *r
			result = append(result, &cp)
		}
	}
	return result, nil
}

func (db *ProgressDB) GetFileCounts(taskID string) (map[FileStatus]int64, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	counts := make(map[FileStatus]int64)
	files, ok := db.files[taskID]
	if !ok {
		return counts, nil
	}
	for _, r := range files {
		counts[r.Status]++
	}
	return counts, nil
}

func (db *ProgressDB) Close() error {
	return db.Save()
}
