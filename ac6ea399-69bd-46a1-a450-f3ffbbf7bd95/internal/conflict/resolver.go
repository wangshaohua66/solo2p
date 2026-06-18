package conflict

import (
	"crypto/md5"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"cloudsync/internal/config"
	"cloudsync/internal/logger"
	"cloudsync/internal/storage"
)

type ConflictType string

const (
	ConflictTypeBothModified ConflictType = "both_modified"
	ConflictTypeSizeMismatch ConflictType = "size_mismatch"
	ConflictTypeChecksumMismatch ConflictType = "checksum_mismatch"
)

type ConflictRecord struct {
	ID            string        `json:"id"`
	Key           string        `json:"key"`
	Type          ConflictType  `json:"type"`
	Strategy      config.ConflictStrategy `json:"strategy"`
	SourceSize    int64         `json:"source_size"`
	TargetSize    int64         `json:"target_size"`
	SourceModTime time.Time     `json:"source_mod_time"`
	TargetModTime time.Time     `json:"target_mod_time"`
	SourceChecksum string       `json:"source_checksum,omitempty"`
	TargetChecksum string       `json:"target_checksum,omitempty"`
	BackupPath    string        `json:"backup_path,omitempty"`
	NewKey        string        `json:"new_key,omitempty"`
	Resolved      bool          `json:"resolved"`
	ResolvedAt    *time.Time    `json:"resolved_at,omitempty"`
	ErrorMessage  string        `json:"error_message,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
}

type Resolver struct {
	mu        sync.RWMutex
	cfg       config.ConflictConfig
	records   []ConflictRecord
	recordMap map[string]*ConflictRecord
}

func NewResolver(cfg config.ConflictConfig) *Resolver {
	return &Resolver{
		cfg:       cfg,
		records:   []ConflictRecord{},
		recordMap: make(map[string]*ConflictRecord),
	}
}

func (r *Resolver) Detect(src, dst *storage.FileObject) (bool, ConflictType) {
	if src == nil || dst == nil {
		return false, ""
	}

	if src.Size != dst.Size {
		return true, ConflictTypeSizeMismatch
	}

	if src.LastModified.After(dst.LastModified) {
		return true, ConflictTypeBothModified
	}

	if !dst.LastModified.IsZero() && dst.LastModified.After(src.LastModified) {
		return true, ConflictTypeBothModified
	}

	return false, ""
}

func (r *Resolver) DetectWithChecksum(src, dst *storage.FileObject) (bool, ConflictType) {
	found, ctype := r.Detect(src, dst)
	if found {
		return found, ctype
	}

	if src.ETag != "" && dst.ETag != "" && src.ETag != dst.ETag {
		return true, ConflictTypeChecksumMismatch
	}

	if src.Checksum != "" && dst.Checksum != "" && src.Checksum != dst.Checksum {
		return true, ConflictTypeChecksumMismatch
	}

	return false, ""
}

func (r *Resolver) Resolve(
	key string,
	srcObj *storage.FileObject,
	dstObj *storage.FileObject,
	srcReader io.Reader,
) (*ConflictRecord, io.Reader, error) {

	hasConflict, ctype := r.DetectWithChecksum(srcObj, dstObj)
	if !hasConflict {
		return nil, srcReader, nil
	}

	rec := &ConflictRecord{
		ID:            fmt.Sprintf("conflict-%s-%d", hashKey(key), time.Now().UnixNano()),
		Key:           key,
		Type:          ctype,
		Strategy:      r.cfg.Strategy,
		CreatedAt:     time.Now(),
	}
	if srcObj != nil {
		rec.SourceSize = srcObj.Size
		rec.SourceModTime = srcObj.LastModified
		rec.SourceChecksum = srcObj.Checksum
	}
	if dstObj != nil {
		rec.TargetSize = dstObj.Size
		rec.TargetModTime = dstObj.LastModified
		rec.TargetChecksum = dstObj.Checksum
	}

	logger.Warn("Conflict detected: key=%s, type=%s, strategy=%s", key, ctype, r.cfg.Strategy)

	var err error
	switch r.cfg.Strategy {
	case config.ConflictOverwrite:
		err = r.resolveOverwrite(key, dstObj)
		rec.Resolved = err == nil
	case config.ConflictSkip:
		err = r.resolveSkip(rec)
	case config.ConflictRename:
		newReader, newKey := r.resolveRename(key, srcReader, dstObj)
		rec.NewKey = newKey
		rec.Resolved = true
		srcReader = newReader
	default:
		err = fmt.Errorf("unknown conflict strategy: %s", r.cfg.Strategy)
	}

	if err != nil {
		rec.ErrorMessage = err.Error()
		logger.Error("Conflict resolution failed for %s: %v", key, err)
	} else {
		now := time.Now()
		rec.ResolvedAt = &now
	}

	r.mu.Lock()
	r.records = append(r.records, *rec)
	r.recordMap[key] = rec
	r.mu.Unlock()

	if r.cfg.Strategy == config.ConflictSkip && err == nil {
		return rec, nil, nil
	}

	return rec, srcReader, err
}

func (r *Resolver) resolveOverwrite(key string, dstObj *storage.FileObject) error {
	if r.cfg.KeepBackup && dstObj != nil {
		return r.backupFile(key, dstObj)
	}
	return nil
}

func (r *Resolver) resolveSkip(rec *ConflictRecord) error {
	logger.Info("Skipping conflicting file: %s", rec.Key)
	return nil
}

func (r *Resolver) resolveRename(
	key string,
	srcReader io.Reader,
	dstObj *storage.FileObject,
) (io.Reader, string) {

	ext := filepath.Ext(key)
	base := key[:len(key)-len(ext)]
	timestamp := time.Now().Format("20060102-150405")
	newKey := fmt.Sprintf("%s-conflict-%s%s", base, timestamp, ext)

	if r.cfg.KeepBackup && dstObj != nil {
		if err := r.backupFile(key, dstObj); err != nil {
			logger.Warn("Failed to backup target file before rename: %v", err)
		}
	}

	logger.Info("Renaming conflicting file: %s -> %s", key, newKey)
	return srcReader, newKey
}

func (r *Resolver) backupFile(key string, obj *storage.FileObject) error {
	if r.cfg.ConflictDir == "" {
		return nil
	}

	conflictDir := r.cfg.ConflictDir
	if err := os.MkdirAll(conflictDir, 0755); err != nil {
		return fmt.Errorf("create conflict dir: %w", err)
	}

	safeName := filepath.Base(key)
	timestamp := time.Now().Format("20060102-150405")
	backupPath := filepath.Join(conflictDir, fmt.Sprintf("%s-%s.backup", timestamp, safeName))

	sizeStr := fmt.Sprintf("size: %d, mod: %s, checksum: %s",
		obj.Size, obj.LastModified.Format(time.RFC3339), obj.ETag)
	if err := os.WriteFile(backupPath, []byte(sizeStr), 0644); err != nil {
		return fmt.Errorf("write backup metadata: %w", err)
	}

	logger.Debug("Created backup metadata: %s", backupPath)
	return nil
}

func (r *Resolver) Records() []ConflictRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]ConflictRecord, len(r.records))
	copy(result, r.records)
	return result
}

func (r *Resolver) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.records)
}

func (r *Resolver) UnresolvedCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	count := 0
	for _, rec := range r.records {
		if !rec.Resolved {
			count++
		}
	}
	return count
}

func (r *Resolver) GetByKey(key string) *ConflictRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rec, ok := r.recordMap[key]
	if !ok {
		return nil
	}
	cp := *rec
	return &cp
}

func hashKey(key string) string {
	h := md5.New()
	h.Write([]byte(key))
	return fmt.Sprintf("%x", h.Sum(nil))[:12]
}
