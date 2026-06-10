package store

import (
	"encoding/gob"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"go.etcd.io/bbolt"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
)

var (
	bucketTasks    = []byte("tasks")
	bucketStatus   = []byte("status")
	bucketCheckpoints = []byte("checkpoints")
	bucketAudit    = []byte("audit")
)

type BoltStore struct {
	db     *bbolt.DB
	path   string
	mu     sync.RWMutex
}

func init() {
	gob.Register(map[string]interface{}{})
	gob.Register(types.CRSTransformConfig{})
	gob.Register(types.VegetationIndexConfig{})
}

func NewBoltStore(path string) (*BoltStore, error) {
	expandedPath := expandPath(path)
	dir := filepath.Dir(expandedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, apperrors.Wrap(err, apperrors.E3001, fmt.Sprintf("cannot create database directory: %s", dir))
	}
	db, err := bbolt.Open(expandedPath, 0600, &bbolt.Options{
		Timeout:      10 * time.Second,
		NoGrowSync:   false,
		FreelistType: bbolt.FreelistMapType,
	})
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E3001, fmt.Sprintf("cannot open database: %s", expandedPath))
	}
	store := &BoltStore{
		db:   db,
		path: expandedPath,
	}
	if err := store.initBuckets(); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func expandPath(path string) string {
	if len(path) > 0 && path[0] == '~' {
		if home, err := os.UserHomeDir(); err == nil {
			path = filepath.Join(home, path[1:])
		}
	}
	return path
}

func (s *BoltStore) initBuckets() error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		for _, bucket := range [][]byte{bucketTasks, bucketStatus, bucketCheckpoints, bucketAudit} {
			if _, err := tx.CreateBucketIfNotExists(bucket); err != nil {
				return apperrors.Wrap(err, apperrors.E3001, fmt.Sprintf("cannot create bucket: %s", bucket))
			}
		}
		return nil
	})
}

func (s *BoltStore) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *BoltStore) CreateTask(task *types.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if task.ID == "" {
		task.ID = generateTaskID()
	}
	if task.CreatedAt.IsZero() {
		task.CreatedAt = time.Now()
	}
	if task.Status == "" {
		task.Status = types.TaskStatusPending
	}
	if task.MaxRetries == 0 {
		task.MaxRetries = 3
	}
	data, err := json.Marshal(task)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E3002, "cannot serialize task")
	}
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		if err := b.Put([]byte(task.ID), data); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot save task")
		}
		sb := tx.Bucket(bucketStatus)
		if err := sb.Put([]byte(task.ID), []byte(task.Status)); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot update task status")
		}
		return nil
	})
}

func (s *BoltStore) GetTask(id string) (*types.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var task types.Task
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		data := b.Get([]byte(id))
		if data == nil {
			return apperrors.New(apperrors.E3004, fmt.Sprintf("task %s not found", id))
		}
		return json.Unmarshal(data, &task)
	})
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (s *BoltStore) UpdateTask(task *types.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := json.Marshal(task)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E3002, "cannot serialize task")
	}
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		existing := b.Get([]byte(task.ID))
		if existing == nil {
			return apperrors.New(apperrors.E3004, fmt.Sprintf("task %s not found", task.ID))
		}
		if err := b.Put([]byte(task.ID), data); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot update task")
		}
		sb := tx.Bucket(bucketStatus)
		if err := sb.Put([]byte(task.ID), []byte(task.Status)); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot update task status")
		}
		return nil
	})
}

func (s *BoltStore) UpdateTaskStatus(id string, status types.TaskStatus, errRecord *types.ErrorRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		data := b.Get([]byte(id))
		if data == nil {
			return apperrors.New(apperrors.E3004, fmt.Sprintf("task %s not found", id))
		}
		var task types.Task
		if err := json.Unmarshal(data, &task); err != nil {
			return apperrors.Wrap(err, apperrors.E3002, "cannot deserialize task")
		}
		task.Status = status
		now := time.Now()
		if status == types.TaskStatusRunning && task.StartedAt == nil {
			task.StartedAt = &now
		}
		if (status == types.TaskStatusDone || status == types.TaskStatusFailed || status == types.TaskStatusDead) && task.CompletedAt == nil {
			task.CompletedAt = &now
		}
		if errRecord != nil {
			task.Errors = append(task.Errors, *errRecord)
			task.RetryCount++
			if task.RetryCount >= task.MaxRetries {
				task.Status = types.TaskStatusDead
			}
		}
		updatedData, err := json.Marshal(&task)
		if err != nil {
			return apperrors.Wrap(err, apperrors.E3002, "cannot serialize task")
		}
		if err := b.Put([]byte(id), updatedData); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot update task")
		}
		sb := tx.Bucket(bucketStatus)
		if err := sb.Put([]byte(id), []byte(task.Status)); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot update task status")
		}
		return nil
	})
}

func (s *BoltStore) ListTasks(filter types.TaskStatus, limit, offset int) ([]*types.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var tasks []*types.Task
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		c := b.Cursor()
		count := 0
		for k, v := c.First(); k != nil; k, v = c.Next() {
			if offset > 0 && count < offset {
				count++
				continue
			}
			if limit > 0 && count >= offset+limit {
				break
			}
			var task types.Task
			if err := json.Unmarshal(v, &task); err != nil {
				return apperrors.Wrap(err, apperrors.E3002, "cannot deserialize task")
			}
			if filter == "" || task.Status == filter {
				tasks = append(tasks, &task)
				count++
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(tasks, func(i, j int) bool {
		return tasks[i].CreatedAt.After(tasks[j].CreatedAt)
	})
	return tasks, nil
}

func (s *BoltStore) ListTasksByErrorCode(errorCode apperrors.ErrorCode, limit, offset int) ([]*types.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var tasks []*types.Task
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		c := b.Cursor()
		count := 0
		for k, v := c.First(); k != nil; k, v = c.Next() {
			if offset > 0 && count < offset {
				count++
				continue
			}
			if limit > 0 && count >= offset+limit {
				break
			}
			var task types.Task
			if err := json.Unmarshal(v, &task); err != nil {
				return apperrors.Wrap(err, apperrors.E3002, "cannot deserialize task")
			}
			for _, errRec := range task.Errors {
				if errRec.ErrorCode == errorCode {
					tasks = append(tasks, &task)
					count++
					break
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(tasks, func(i, j int) bool {
		return tasks[i].CreatedAt.After(tasks[j].CreatedAt)
	})
	return tasks, nil
}

func (s *BoltStore) GetPendingTasks(limit int) ([]*types.Task, error) {
	return s.ListTasks(types.TaskStatusPending, limit, 0)
}

func (s *BoltStore) GetStats() (types.PipelineStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var stats types.PipelineStats
	stats.StartTime = time.Now()
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		c := b.Cursor()
		for k, v := c.First(); k != nil; k, v = c.Next() {
			stats.TotalTasks++
			var task types.Task
			if err := json.Unmarshal(v, &task); err != nil {
				continue
			}
			switch task.Status {
			case types.TaskStatusPending:
				stats.PendingTasks++
			case types.TaskStatusRunning:
				stats.RunningTasks++
			case types.TaskStatusDone:
				stats.CompletedTasks++
			case types.TaskStatusFailed:
				stats.FailedTasks++
			case types.TaskStatusDead:
				stats.DeadTasks++
			}
			stats.TotalBytes += task.Progress.BytesTotal
			stats.ProcessedBytes += task.Progress.BytesProcessed
		}
		return nil
	})
	if err != nil {
		return stats, err
	}
	stats.Uptime = time.Since(stats.StartTime)
	if stats.Uptime.Seconds() > 0 && stats.ProcessedBytes > 0 {
		stats.ThroughputMBs = float64(stats.ProcessedBytes) / 1024 / 1024 / stats.Uptime.Seconds()
	}
	return stats, nil
}

func (s *BoltStore) SaveCheckpoint(taskID string, checkpointData []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketCheckpoints)
		return b.Put([]byte(taskID), checkpointData)
	})
}

func (s *BoltStore) GetCheckpoint(taskID string) ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var data []byte
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketCheckpoints)
		data = b.Get([]byte(taskID))
		if data == nil {
			return nil
		}
		dataCopy := make([]byte, len(data))
		copy(dataCopy, data)
		data = dataCopy
		return nil
	})
	return data, err
}

func (s *BoltStore) DeleteCheckpoint(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketCheckpoints)
		return b.Delete([]byte(taskID))
	})
}

func (s *BoltStore) BatchCreateTasks(tasks []*types.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		sb := tx.Bucket(bucketStatus)
		for _, task := range tasks {
			if task.ID == "" {
				task.ID = generateTaskID()
			}
			if task.CreatedAt.IsZero() {
				task.CreatedAt = time.Now()
			}
			if task.Status == "" {
				task.Status = types.TaskStatusPending
			}
			data, err := json.Marshal(task)
			if err != nil {
				return apperrors.Wrap(err, apperrors.E3002, "cannot serialize task")
			}
			if err := b.Put([]byte(task.ID), data); err != nil {
				return apperrors.Wrap(err, apperrors.E3003, "cannot save task")
			}
			if err := sb.Put([]byte(task.ID), []byte(task.Status)); err != nil {
				return apperrors.Wrap(err, apperrors.E3003, "cannot update task status")
			}
		}
		return nil
	})
}

func (s *BoltStore) BatchUpdateTaskStatus(ids []string, status types.TaskStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		sb := tx.Bucket(bucketStatus)
		for _, id := range ids {
			data := b.Get([]byte(id))
			if data == nil {
				continue
			}
			var task types.Task
			if err := json.Unmarshal(data, &task); err != nil {
				continue
			}
			task.Status = status
			now := time.Now()
			if status == types.TaskStatusRunning && task.StartedAt == nil {
				task.StartedAt = &now
			}
			if (status == types.TaskStatusDone || status == types.TaskStatusFailed) && task.CompletedAt == nil {
				task.CompletedAt = &now
			}
			updatedData, err := json.Marshal(&task)
			if err != nil {
				continue
			}
			if err := b.Put([]byte(id), updatedData); err != nil {
				return err
			}
			if err := sb.Put([]byte(id), []byte(status)); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *BoltStore) ResetTask(id string, force bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		data := b.Get([]byte(id))
		if data == nil {
			return apperrors.New(apperrors.E3004, fmt.Sprintf("task %s not found", id))
		}
		var task types.Task
		if err := json.Unmarshal(data, &task); err != nil {
			return apperrors.Wrap(err, apperrors.E3002, "cannot deserialize task")
		}
		if !force && task.Status != types.TaskStatusFailed && task.Status != types.TaskStatusDead {
			return apperrors.New(apperrors.E7003, fmt.Sprintf("task %s is in state %s, use --force to reset", id, task.Status))
		}
		task.Status = types.TaskStatusPending
		task.RetryCount = 0
		task.StartedAt = nil
		task.CompletedAt = nil
		task.Progress = types.TaskProgress{TaskID: task.ID, StartTime: time.Now()}
		if !force {
			task.Errors = nil
		}
		updatedData, err := json.Marshal(&task)
		if err != nil {
			return apperrors.Wrap(err, apperrors.E3002, "cannot serialize task")
		}
		if err := b.Put([]byte(id), updatedData); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot update task")
		}
		sb := tx.Bucket(bucketStatus)
		if err := sb.Put([]byte(id), []byte(types.TaskStatusPending)); err != nil {
			return apperrors.Wrap(err, apperrors.E3003, "cannot update task status")
		}
		cb := tx.Bucket(bucketCheckpoints)
		return cb.Delete([]byte(id))
	})
}

func (s *BoltStore) PurgeOldTasks(olderThan time.Duration) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	count := 0
	err := s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketTasks)
		sb := tx.Bucket(bucketStatus)
		cb := tx.Bucket(bucketCheckpoints)
		c := b.Cursor()
		cutoff := time.Now().Add(-olderThan)
		var toDelete [][]byte
		for k, v := c.First(); k != nil; k, v = c.Next() {
			var task types.Task
			if err := json.Unmarshal(v, &task); err != nil {
				continue
			}
			if task.Status == types.TaskStatusDone && task.CompletedAt != nil && task.CompletedAt.Before(cutoff) {
				toDelete = append(toDelete, []byte(task.ID))
			}
		}
		for _, id := range toDelete {
			if err := b.Delete(id); err != nil {
				return err
			}
			if err := sb.Delete(id); err != nil {
				return err
			}
			if err := cb.Delete(id); err != nil {
				return err
			}
			count++
		}
		return nil
	})
	return count, err
}

func (s *BoltStore) ClassifyFailure(taskID string) (string, []string, error) {
	task, err := s.GetTask(taskID)
	if err != nil {
		return "", nil, err
	}
	if len(task.Errors) == 0 {
		return "Unknown", []string{"No error records found for task"}, nil
	}
	lastError := task.Errors[len(task.Errors)-1]
	errorInfo, ok := apperrors.GetErrorInfo(lastError.ErrorCode)
	if !ok {
		return string(lastError.ErrorCode), []string{"Unknown error code"}, nil
	}
	category := categorizeError(lastError.ErrorCode)
	return category, errorInfo.Suggestions, nil
}

func categorizeError(code apperrors.ErrorCode) string {
	prefix := string(code[:1])
	switch prefix {
	case "1":
		return "GeoTIFF I/O Error"
	case "2":
		return "CRS Transformation Error"
	case "3":
		return "Database Error"
	case "4":
		return "Input Validation Error"
	case "5":
		return "Configuration Error"
	case "6":
		return "Daemon Error"
	case "7":
		return "Pipeline Execution Error"
	default:
		return "Unknown Error"
	}
}

func generateTaskID() string {
	return fmt.Sprintf("task_%d_%s", time.Now().UnixNano(), randomString(8))
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(1 * time.Nanosecond)
	}
	return string(b)
}

func (s *BoltStore) GetFailedTasksGrouped() (map[string][]*types.Task, error) {
	tasks, err := s.ListTasks(types.TaskStatusFailed, 0, 0)
	if err != nil {
		return nil, err
	}
	deadTasks, err := s.ListTasks(types.TaskStatusDead, 0, 0)
	if err != nil {
		return nil, err
	}
	allFailed := append(tasks, deadTasks...)
	grouped := make(map[string][]*types.Task)
	for _, task := range allFailed {
		category := "Unknown"
		if len(task.Errors) > 0 {
			category = categorizeError(task.Errors[len(task.Errors)-1].ErrorCode)
		}
		grouped[category] = append(grouped[category], task)
	}
	return grouped, nil
}
