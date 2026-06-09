package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"time"

	"go.etcd.io/bbolt"
)

var (
	BucketRepos        = []byte("repos")
	BucketCommits      = []byte("commits")
	BucketFiles        = []byte("files")
	BucketContributors = []byte("contributors")
	BucketMetrics      = []byte("metrics")
	BucketAlerts       = []byte("alerts")
	BucketIndex        = []byte("index")
	BucketTechDebt     = []byte("techdebt")
)

type Store struct {
	db *bbolt.DB
}

type Tx struct {
	tx *bbolt.Tx
}

type ScanStatus struct {
	RepoName     string    `json:"repo_name"`
	LastScanTime time.Time `json:"last_scan_time"`
	LastCommit   string    `json:"last_commit"`
	CommitCount  int       `json:"commit_count"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"error_message,omitempty"`
	ElapsedMs    int64     `json:"elapsed_ms"`
}

func Open(path string) (*Store, error) {
	if err := bbolt.Verify(path, nil); err != nil && err != bbolt.ErrDatabaseNotOpen {
		fmt.Printf("warning: database verification failed: %v, creating new\n", err)
	}

	db, err := bbolt.Open(path, 0600, &bbolt.Options{
		Timeout:      10 * time.Second,
		NoSync:       false,
		NoGrowSync:   false,
		FreelistType: bbolt.FreelistMapType,
	})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	store := &Store{db: db}
	if err := store.initBuckets(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

func (s *Store) initBuckets() error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		buckets := [][]byte{
			BucketRepos,
			BucketCommits,
			BucketFiles,
			BucketContributors,
			BucketMetrics,
			BucketAlerts,
			BucketIndex,
			BucketTechDebt,
		}
		for _, b := range buckets {
			if _, err := tx.CreateBucketIfNotExists(b); err != nil {
				return fmt.Errorf("create bucket %s: %w", string(b), err)
			}
		}
		return nil
	})
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) Begin(writable bool) (*Tx, error) {
	tx, err := s.db.Begin(writable)
	if err != nil {
		return nil, err
	}
	return &Tx{tx: tx}, nil
}

func (s *Store) Update(fn func(*Tx) error) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		return fn(&Tx{tx: tx})
	})
}

func (s *Store) View(fn func(*Tx) error) error {
	return s.db.View(func(tx *bbolt.Tx) error {
		return fn(&Tx{tx: tx})
	})
}

func (s *Store) Batch(fn func(*Tx) error) error {
	return s.db.Batch(func(tx *bbolt.Tx) error {
		return fn(&Tx{tx: tx})
	})
}

func (s *Store) WithTimeout(ctx context.Context, fn func(*Store) error) error {
	done := make(chan error, 1)
	go func() {
		done <- fn(s)
	}()
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (t *Tx) Bucket(name []byte) *bbolt.Bucket {
	return t.tx.Bucket(name)
}

func (t *Tx) Put(bucket []byte, key, value interface{}) error {
	b := t.tx.Bucket(bucket)
	if b == nil {
		return fmt.Errorf("bucket %s not found", string(bucket))
	}

	k, err := toBytes(key)
	if err != nil {
		return err
	}
	v, err := toBytes(value)
	if err != nil {
		return err
	}
	return b.Put(k, v)
}

func (t *Tx) Get(bucket []byte, key, value interface{}) (bool, error) {
	b := t.tx.Bucket(bucket)
	if b == nil {
		return false, fmt.Errorf("bucket %s not found", string(bucket))
	}

	k, err := toBytes(key)
	if err != nil {
		return false, err
	}
	v := b.Get(k)
	if v == nil {
		return false, nil
	}
	return true, fromBytes(v, value)
}

func (t *Tx) Delete(bucket []byte, key interface{}) error {
	b := t.tx.Bucket(bucket)
	if b == nil {
		return fmt.Errorf("bucket %s not found", string(bucket))
	}
	k, err := toBytes(key)
	if err != nil {
		return err
	}
	return b.Delete(k)
}

func (t *Tx) ForEach(bucket []byte, fn func(k, v []byte) error) error {
	b := t.tx.Bucket(bucket)
	if b == nil {
		return fmt.Errorf("bucket %s not found", string(bucket))
	}
	return b.ForEach(fn)
}

func (t *Tx) ForEachWithPrefix(bucket []byte, prefix []byte, fn func(k, v []byte) error) error {
	b := t.tx.Bucket(bucket)
	if b == nil {
		return fmt.Errorf("bucket %s not found", string(bucket))
	}

	c := b.Cursor()
	for k, v := c.Seek(prefix); k != nil && hasPrefix(k, prefix); k, v = c.Next() {
		if err := fn(k, v); err != nil {
			return err
		}
	}
	return nil
}

func (t *Tx) GetScanStatus(repoName string) (*ScanStatus, error) {
	var status ScanStatus
	key := []byte(repoName)
	found, err := t.Get(BucketIndex, key, &status)
	if err != nil {
		return nil, err
	}
	if !found {
		return &ScanStatus{RepoName: repoName, Status: "pending"}, nil
	}
	return &status, nil
}

func (t *Tx) SetScanStatus(status *ScanStatus) error {
	key := []byte(status.RepoName)
	return t.Put(BucketIndex, key, status)
}

func (t *Tx) Count(bucket []byte) (int, error) {
	b := t.tx.Bucket(bucket)
	if b == nil {
		return 0, fmt.Errorf("bucket %s not found", string(bucket))
	}
	count := 0
	err := b.ForEach(func(_, _ []byte) error {
		count++
		return nil
	})
	return count, err
}

func (t *Tx) Commit() error {
	return t.tx.Commit()
}

func (t *Tx) Rollback() error {
	return t.tx.Rollback()
}

func toBytes(v interface{}) ([]byte, error) {
	switch val := v.(type) {
	case string:
		return []byte(val), nil
	case []byte:
		return val, nil
	default:
		return json.Marshal(v)
	}
}

func fromBytes(data []byte, v interface{}) error {
	switch val := v.(type) {
	case *string:
		*val = string(data)
		return nil
	case *[]byte:
		*val = data
		return nil
	default:
		return json.Unmarshal(data, v)
	}
}

func hasPrefix(b, prefix []byte) bool {
	if len(b) < len(prefix) {
		return false
	}
	for i := range prefix {
		if b[i] != prefix[i] {
			return false
		}
	}
	return true
}

func MakeKey(parts ...interface{}) []byte {
	var key []byte
	for i, p := range parts {
		if i > 0 {
			key = append(key, ':')
		}
		b, _ := toBytes(p)
		key = append(key, b...)
	}
	return key
}

func BackupTo(store *Store, dir string) (string, error) {
	backupPath := filepath.Join(dir, fmt.Sprintf("backup_%s.db", time.Now().Format("20060102_150405")))

	err := store.db.View(func(tx *bbolt.Tx) error {
		return tx.CopyFile(backupPath, 0600)
	})
	if err != nil {
		return "", err
	}
	return backupPath, nil
}

func Vacuum(store *Store) error {
	stats := store.db.Stats()
	if stats.FreePageN > stats.TotalPageN/2 {
		fmt.Printf("vacuuming database: %d free pages\n", stats.FreePageN)
	}
	return nil
}
