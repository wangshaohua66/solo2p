package sync

import (
	"context"
	"fmt"
	"io"
	"path"
	"strings"
	"sync"
	"time"

	"cloudsync/internal/checksum"
	"cloudsync/internal/config"
	"cloudsync/internal/conflict"
	"cloudsync/internal/database"
	"cloudsync/internal/logger"
	"cloudsync/internal/progress"
	"cloudsync/internal/storage"
)

type ChangeType string

const (
	ChangeAdd    ChangeType = "add"
	ChangeUpdate ChangeType = "update"
	ChangeDelete ChangeType = "delete"
	ChangeSkip   ChangeType = "skip"
)

type FileChange struct {
	Key          string
	ChangeType   ChangeType
	SourceObj    *storage.FileObject
	TargetObj    *storage.FileObject
	Reason       string
}

type EngineResult struct {
	TaskID        string
	Success       bool
	ErrorMessage  string
	Stats         progress.Stats
	Conflicts     []conflict.ConflictRecord
	ChecksumDiffs []checksum.MismatchReport
	StartTime     time.Time
	EndTime       time.Time
}

type Engine struct {
	cfg         *config.Config
	source      storage.StorageProvider
	target      storage.StorageProvider
	hasher      *checksum.Hasher
	verifier    *checksum.Verifier
	resolver    *conflict.Resolver
	tracker     *progress.Tracker
	db          *database.ProgressDB
	taskID      string
	resumeTask  bool
	cancel      context.CancelFunc
}

func NewEngine(cfg *config.Config) (*Engine, error) {
	src, err := storage.NewProvider(cfg.Source)
	if err != nil {
		return nil, fmt.Errorf("create source provider: %w", err)
	}
	dst, err := storage.NewProvider(cfg.Target)
	if err != nil {
		src.Close()
		return nil, fmt.Errorf("create target provider: %w", err)
	}

	db, err := database.NewProgressDB(&cfg.Progress)
	if err != nil {
		src.Close()
		dst.Close()
		return nil, fmt.Errorf("create progress db: %w", err)
	}

	return &Engine{
		cfg:      cfg,
		source:   src,
		target:   dst,
		hasher:   checksum.New(cfg.Checksum.Algorithm),
		verifier: checksum.NewVerifier(cfg.Checksum.Algorithm),
		resolver: conflict.NewResolver(cfg.Conflict),
		db:       db,
	}, nil
}

func (e *Engine) SetTracker(t *progress.Tracker) {
	e.tracker = t
}

func (e *Engine) ResumeTask(taskID string) {
	e.taskID = taskID
	e.resumeTask = true
}

func (e *Engine) Run(ctx context.Context) (*EngineResult, error) {
	ctx, e.cancel = context.WithCancel(ctx)
	defer e.cancel()

	result := &EngineResult{
		StartTime: time.Now(),
		Success:   false,
	}

	defer func() {
		result.EndTime = time.Now()
		if e.tracker != nil {
			result.Stats = e.tracker.GetStats()
		}
		result.Conflicts = e.resolver.Records()
		result.ChecksumDiffs = e.verifier.Mismatches()
	}()

	logger.Info("Starting sync: %s -> %s", e.source.Name(), e.target.Name())
	logger.Info("Concurrency: %d, Checksum: %s, Strategy: %s",
		e.cfg.Sync.Concurrency, e.cfg.Checksum.Algorithm, e.cfg.Conflict.Strategy)

	if err := e.initTask(); err != nil {
		result.ErrorMessage = err.Error()
		return result, err
	}
	result.TaskID = e.taskID

	changes, err := e.detectChanges(ctx)
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("detect changes: %v", err)
		logger.Error("Failed to detect changes: %v", err)
		return result, err
	}

	logger.Info("Detected changes: %d files to process", len(changes))

	totalFiles := int64(0)
	totalBytes := int64(0)
	for _, c := range changes {
		if c.ChangeType != ChangeSkip {
			totalFiles++
			if c.SourceObj != nil {
				totalBytes += c.SourceObj.Size
			}
		}
	}

	if e.tracker != nil {
		e.tracker.SetTotal(totalFiles, totalBytes)
		e.tracker.Start()
		defer e.tracker.Stop()
	}

	if err := e.saveFileRecords(changes); err != nil {
		result.ErrorMessage = fmt.Sprintf("save file records: %v", err)
		logger.Error("Failed to save file records: %v", err)
		return result, err
	}

	if err := e.processChanges(ctx, changes); err != nil {
		result.ErrorMessage = fmt.Sprintf("process changes: %v", err)
		logger.Error("Failed to process changes: %v", err)
		return result, err
	}

	if err := e.finalizeTask(); err != nil {
		logger.Warn("Failed to finalize task: %v", err)
	}

	result.Success = true
	logger.Info("Sync completed successfully: %s", e.taskID)
	return result, nil
}

func (e *Engine) initTask() error {
	if e.resumeTask && e.taskID != "" {
		task, err := e.db.GetTask(e.taskID)
		if err != nil {
			return fmt.Errorf("resume task: %w", err)
		}
		logger.Info("Resuming task: %s (created: %s)", task.ID, task.CreatedAt.Format(time.RFC3339))
		return nil
	}

	task := &database.SyncTask{
		Name:         fmt.Sprintf("%s→%s", e.source.Bucket(), e.target.Bucket()),
		SourceType:   string(e.cfg.Source.Type),
		SourceBucket: e.source.Bucket(),
		SourcePrefix: e.source.Prefix(),
		TargetType:   string(e.cfg.Target.Type),
		TargetBucket: e.target.Bucket(),
		TargetPrefix: e.target.Prefix(),
	}
	if err := e.db.CreateTask(task); err != nil {
		return fmt.Errorf("create task: %w", err)
	}
	e.taskID = task.ID
	logger.Info("Created new task: %s", e.taskID)
	return nil
}

func (e *Engine) finalizeTask() error {
	status := database.TaskStatusCompleted
	if e.tracker != nil {
		stats := e.tracker.GetStats()
		if stats.FailedFiles > 0 && stats.DoneFiles == 0 {
			status = database.TaskStatusFailed
		}
	}
	return e.db.CompleteTask(e.taskID, status)
}

func (e *Engine) detectChanges(ctx context.Context) ([]FileChange, error) {
	srcObjs, err := e.source.ListAll(ctx, e.cfg.Source.Prefix)
	if err != nil {
		return nil, fmt.Errorf("list source: %w", err)
	}
	logger.Info("Source files: %d", len(srcObjs))

	tgtObjs, err := e.target.ListAll(ctx, e.cfg.Target.Prefix)
	if err != nil {
		return nil, fmt.Errorf("list target: %w", err)
	}
	logger.Info("Target files: %d", len(tgtObjs))

	srcMap := make(map[string]*storage.FileObject, len(srcObjs))
	for i := range srcObjs {
		o := &srcObjs[i]
		key := e.stripPrefixes(o.Key, e.cfg.Source.Prefix)
		if !e.matchesPatterns(key) {
			continue
		}
		if !e.matchesTimeFilter(o.LastModified) {
			continue
		}
		srcMap[key] = o
	}

	tgtMap := make(map[string]*storage.FileObject, len(tgtObjs))
	for i := range tgtObjs {
		o := &tgtObjs[i]
		key := e.stripPrefixes(o.Key, e.cfg.Target.Prefix)
		tgtMap[key] = o
	}

	var changes []FileChange

	for key, srcObj := range srcMap {
		tgtObj := tgtMap[key]
		change := e.compareFile(key, srcObj, tgtObj)
		changes = append(changes, change)
	}

	if e.cfg.Sync.DeleteMissing {
		for key, tgtObj := range tgtMap {
			if _, exists := srcMap[key]; !exists {
				changes = append(changes, FileChange{
					Key:        key,
					ChangeType: ChangeDelete,
					TargetObj:  tgtObj,
					Reason:     "deleted from source",
				})
			}
		}
	}

	return changes, nil
}

func (e *Engine) compareFile(key string, src, tgt *storage.FileObject) FileChange {
	if tgt == nil {
		return FileChange{
			Key:        key,
			ChangeType: ChangeAdd,
			SourceObj:  src,
			Reason:     "new file",
		}
	}

	if e.cfg.Sync.SyncMode == "full" {
		return FileChange{
			Key:        key,
			ChangeType: ChangeUpdate,
			SourceObj:  src,
			TargetObj:  tgt,
			Reason:     "full sync mode",
		}
	}

	if src.Size != tgt.Size {
		return FileChange{
			Key:        key,
			ChangeType: ChangeUpdate,
			SourceObj:  src,
			TargetObj:  tgt,
			Reason:     fmt.Sprintf("size mismatch: %d vs %d", src.Size, tgt.Size),
		}
	}

	if src.ETag != "" && tgt.ETag != "" && src.ETag != tgt.ETag {
		return FileChange{
			Key:        key,
			ChangeType: ChangeUpdate,
			SourceObj:  src,
			TargetObj:  tgt,
			Reason:     "etag mismatch",
		}
	}

	if src.Checksum != "" && tgt.Checksum != "" {
		if src.Checksum != tgt.Checksum {
			return FileChange{
				Key:        key,
				ChangeType: ChangeUpdate,
				SourceObj:  src,
				TargetObj:  tgt,
				Reason:     "md5 checksum mismatch",
			}
		}
		return FileChange{
			Key:        key,
			ChangeType: ChangeSkip,
			SourceObj:  src,
			TargetObj:  tgt,
			Reason:     "identical (checksum verified)",
		}
	}

	if src.ETag != "" && tgt.ETag != "" && src.ETag == tgt.ETag {
		if !isMultipartETag(src.ETag) {
			return FileChange{
				Key:        key,
				ChangeType: ChangeSkip,
				SourceObj:  src,
				TargetObj:  tgt,
				Reason:     "identical (etag verified)",
			}
		}
		return FileChange{
			Key:        key,
			ChangeType: ChangeUpdate,
			SourceObj:  src,
			TargetObj:  tgt,
			Reason:     "multipart etag requires checksum verification",
		}
	}

	return FileChange{
		Key:        key,
		ChangeType: ChangeSkip,
		SourceObj:  src,
		TargetObj:  tgt,
		Reason:     "identical",
	}
}

func isMultipartETag(etag string) bool {
	return strings.Contains(etag, "-")
}

func (e *Engine) matchesPatterns(key string) bool {
	if len(e.cfg.Sync.IncludePatterns) == 0 {
		return true
	}

	matched := false
	for _, p := range e.cfg.Sync.IncludePatterns {
		if p == "*" || matchPattern(p, key) {
			matched = true
			break
		}
	}
	if !matched {
		return false
	}

	for _, p := range e.cfg.Sync.ExcludePatterns {
		if matchPattern(p, key) {
			return false
		}
	}
	return true
}

func matchPattern(pattern, name string) bool {
	if pattern == "*" {
		return true
	}
	matched, _ := path.Match(pattern, name)
	return matched
}

func (e *Engine) matchesTimeFilter(t time.Time) bool {
	if e.cfg.Sync.TimeFilterStart != nil && t.Before(*e.cfg.Sync.TimeFilterStart) {
		return false
	}
	if e.cfg.Sync.TimeFilterEnd != nil && t.After(*e.cfg.Sync.TimeFilterEnd) {
		return false
	}
	return true
}

func (e *Engine) stripPrefixes(key, prefix string) string {
	if prefix == "" {
		return key
	}
	p := prefix
	if p[len(p)-1] != '/' {
		p += "/"
	}
	if len(key) >= len(p) && key[:len(p)] == p {
		return key[len(p):]
	}
	return key
}

func (e *Engine) saveFileRecords(changes []FileChange) error {
	completedMap := make(map[string]bool)
	if e.resumeTask {
		completed, err := e.db.GetCompletedFiles(e.taskID)
		if err != nil {
			return err
		}
		for _, r := range completed {
			completedMap[r.Key] = true
		}
	}

	for _, c := range changes {
		if completedMap[c.Key] {
			continue
		}

		srcChecksum := ""
		srcETag := ""
		size := int64(0)
		if c.SourceObj != nil {
			srcChecksum = c.SourceObj.Checksum
			srcETag = c.SourceObj.ETag
			size = c.SourceObj.Size
		}
		tgtChecksum := ""
		tgtETag := ""
		if c.TargetObj != nil {
			tgtChecksum = c.TargetObj.Checksum
			tgtETag = c.TargetObj.ETag
		}

		lastMod := time.Time{}
		if c.SourceObj != nil {
			lastMod = c.SourceObj.LastModified
		}

		status := database.FileStatusPending
		if c.ChangeType == ChangeSkip {
			status = database.FileStatusSkipped
		}

		record := &database.FileRecord{
			TaskID:         e.taskID,
			Key:            c.Key,
			Size:           size,
			SourceChecksum: srcChecksum,
			TargetChecksum: tgtChecksum,
			SourceETag:     srcETag,
			TargetETag:     tgtETag,
			LastModified:   lastMod,
			Status:         status,
		}
		if err := e.db.UpsertFileRecord(record); err != nil {
			logger.Warn("Failed to save record for %s: %v", c.Key, err)
		}
	}
	return e.db.Save()
}

func (e *Engine) processChanges(ctx context.Context, changes []FileChange) error {
	sem := make(chan struct{}, e.cfg.Sync.Concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex

	doneCount := make(map[database.FileStatus]int64)
	doneBytes := int64(0)

	saveTicker := time.NewTicker(5 * time.Second)
	defer saveTicker.Stop()
	go func() {
		for range saveTicker.C {
			mu.Lock()
			stats := make(map[database.FileStatus]int64, len(doneCount))
			for k, v := range doneCount {
				stats[k] = v
			}
			bytes := doneBytes
			mu.Unlock()
			if err := e.db.UpdateTaskStats(e.taskID, bytes, stats); err != nil {
				logger.Warn("Failed to update task stats: %v", err)
			}
			e.db.Save()
		}
	}()

	completedMap := make(map[string]bool)
	if e.resumeTask {
		completed, err := e.db.GetCompletedFiles(e.taskID)
		if err == nil {
			for _, r := range completed {
				completedMap[r.Key] = true
			}
		}
	}

	for _, c := range changes {
		change := c
		if completedMap[change.Key] {
			mu.Lock()
			doneCount[database.FileStatusCompleted]++
			mu.Unlock()
			if e.tracker != nil {
				e.tracker.AddSkipped(1)
			}
			continue
		}

		if change.ChangeType == ChangeSkip {
			mu.Lock()
			doneCount[database.FileStatusSkipped]++
			mu.Unlock()
			if e.tracker != nil {
				e.tracker.AddSkipped(1)
			}
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(ch FileChange) {
			defer wg.Done()
			defer func() { <-sem }()

			select {
			case <-ctx.Done():
				return
			default:
			}

			e.updateFileStatus(ch.Key, database.FileStatusSyncing, 0, "")

			var err error
			switch ch.ChangeType {
			case ChangeAdd, ChangeUpdate:
				err = e.transferFile(ctx, &ch)
			case ChangeDelete:
				err = e.deleteFile(ctx, &ch)
			}

			mu.Lock()
			if err != nil {
				doneCount[database.FileStatusFailed]++
				e.updateFileStatus(ch.Key, database.FileStatusFailed, 0, err.Error())
				if e.tracker != nil {
					e.tracker.AddFailed(ch.Key, err)
				}
				logger.Error("Failed to process %s (%s): %v", ch.Key, ch.ChangeType, err)
			} else {
				size := int64(0)
				if ch.SourceObj != nil {
					size = ch.SourceObj.Size
				}
				doneCount[database.FileStatusCompleted]++
				doneBytes += size
				if ch.ChangeType == ChangeDelete {
					doneCount[database.FileStatusDeleted]++
					doneCount[database.FileStatusCompleted]--
					if e.tracker != nil {
						e.tracker.AddDeleted(1)
					}
				} else {
					if e.tracker != nil {
						e.tracker.AddProgress(1, size)
					}
				}
				e.updateFileStatus(ch.Key, database.FileStatusCompleted, size, "")
				logger.Debug("Completed %s: %s", ch.ChangeType, ch.Key)
			}
			mu.Unlock()
		}(change)
	}

	wg.Wait()

	stats := make(map[database.FileStatus]int64, len(doneCount))
	for k, v := range doneCount {
		stats[k] = v
	}
	if err := e.db.UpdateTaskStats(e.taskID, doneBytes, stats); err != nil {
		logger.Warn("Final update stats failed: %v", err)
	}

	return nil
}

func (e *Engine) updateFileStatus(key string, status database.FileStatus, size int64, errMsg string) {
	rec, err := e.db.GetFileRecord(e.taskID, key)
	if err != nil {
		rec = &database.FileRecord{
			TaskID: e.taskID,
			Key:    key,
			Size:   size,
		}
	}
	rec.Status = status
	rec.ErrorMessage = errMsg
	rec.Attempts++
	if status == database.FileStatusSyncing {
		now := time.Now()
		rec.StartTime = &now
	} else if rec.StartTime != nil {
		now := time.Now()
		rec.EndTime = &now
		rec.DurationMs = now.Sub(*rec.StartTime).Milliseconds()
	}
	e.db.UpsertFileRecord(rec)
}

func (e *Engine) transferFile(ctx context.Context, change *FileChange) error {
	var lastErr error
	maxAttempts := e.cfg.Sync.RetryCount + 1

	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			logger.Info("Retrying %s (attempt %d/%d): %v", change.Key, attempt+1, maxAttempts, lastErr)
			time.Sleep(e.cfg.Sync.RetryInterval)
		}

		err := e.doTransfer(ctx, change)
		if err == nil {
			return nil
		}

		lastErr = err
		if !storage.IsRetryableError(err) {
			return err
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
	}

	return fmt.Errorf("max retries exceeded: %w", lastErr)
}

func (e *Engine) doTransfer(ctx context.Context, change *FileChange) error {
	srcKey := change.Key
	if e.cfg.Source.Prefix != "" {
		srcKey = path.Join(e.cfg.Source.Prefix, change.Key)
	}

	reader, srcMeta, err := e.source.Get(ctx, srcKey)
	if err != nil {
		return fmt.Errorf("read source: %w", err)
	}
	defer reader.Close()

	checksumStr, size, err := e.hasher.ComputeFromReader(reader)
	if err != nil {
		return fmt.Errorf("compute source checksum: %w", err)
	}
	if srcMeta != nil {
		srcMeta.Checksum = checksumStr
	}

	reader2, _, err := e.source.Get(ctx, srcKey)
	if err != nil {
		return fmt.Errorf("re-read source: %w", err)
	}
	defer reader2.Close()

	targetReader := io.Reader(reader2)
	uploadKey := change.Key

	if change.TargetObj != nil {
		conflictRec, resolvedReader, resolveErr := e.resolver.Resolve(
			change.Key, srcMeta, change.TargetObj, reader2)
		if resolveErr != nil {
			return fmt.Errorf("resolve conflict: %w", resolveErr)
		}
		if conflictRec != nil {
			if e.tracker != nil {
				e.tracker.AddConflict(1)
			}
			if conflictRec.Strategy == config.ConflictSkip {
				logger.Info("Skipped due to conflict strategy: %s", change.Key)
				return nil
			}
			if conflictRec.NewKey != "" {
				uploadKey = conflictRec.NewKey
			}
		}
		if resolvedReader != nil {
			targetReader = resolvedReader
		}
	}

	if e.cfg.Target.Prefix != "" {
		uploadKey = path.Join(e.cfg.Target.Prefix, uploadKey)
	}

	opts := &storage.UploadOptions{
		Concurrency: 10,
		PartSize:    e.cfg.Sync.ChunkSize,
		Metadata:    map[string]string{"checksum": checksumStr},
	}
	if srcMeta != nil {
		opts.ContentType = srcMeta.ContentType
	}

	_, err = e.target.Put(ctx, uploadKey, targetReader, size, opts)
	if err != nil {
		return fmt.Errorf("upload target: %w", err)
	}

	if e.cfg.Checksum.VerifyAfterSync {
		verifyKey := uploadKey
		maxVerifyRetries := 3
		verifyOK := false
		for attempt := 1; attempt <= maxVerifyRetries; attempt++ {
			targetReader2, _, vErr := e.target.Get(ctx, verifyKey)
			if vErr != nil {
				if attempt < maxVerifyRetries {
					logger.Warn("Verify read failed (attempt %d/%d) for %s: %v, retrying",
						attempt, maxVerifyRetries, change.Key, vErr)
					time.Sleep(e.cfg.Sync.RetryInterval)
					continue
				}
				return fmt.Errorf("read target for verify: %w", vErr)
			}

			matched, _, computeErr := e.hasher.VerifyReader(targetReader2, checksumStr)
			targetReader2.Close()

			if computeErr != nil {
				if attempt < maxVerifyRetries {
					logger.Warn("Verify compute failed (attempt %d/%d) for %s: %v, retrying",
						attempt, maxVerifyRetries, change.Key, computeErr)
					time.Sleep(e.cfg.Sync.RetryInterval)
					continue
				}
				return fmt.Errorf("verify checksum compute: %w", computeErr)
			}

			if matched {
				verifyOK = true
				break
			}

			logger.Warn("Checksum verification failed (attempt %d/%d) for %s: expected=%s",
				attempt, maxVerifyRetries, change.Key, checksumStr)
			if attempt < maxVerifyRetries {
				time.Sleep(e.cfg.Sync.RetryInterval)
			}
		}

		if !verifyOK {
			e.verifier.AddMismatch(change.Key, checksumStr, "", "verification failed after 3 retries")
			return fmt.Errorf("checksum verification failed after %d retries for %s", maxVerifyRetries, change.Key)
		}

		logger.Debug("Checksum verified for %s (algorithm=%s)", change.Key, e.cfg.Checksum.Algorithm)
	}

	return nil
}

func (e *Engine) deleteFile(ctx context.Context, change *FileChange) error {
	delKey := change.Key
	if e.cfg.Target.Prefix != "" {
		delKey = path.Join(e.cfg.Target.Prefix, change.Key)
	}
	return e.target.Delete(ctx, delKey)
}

func (e *Engine) Close() {
	if e.cancel != nil {
		e.cancel()
	}
	if e.source != nil {
		e.source.Close()
	}
	if e.target != nil {
		e.target.Close()
	}
	if e.db != nil {
		e.db.Close()
	}
}

type VerifyResult struct {
	TaskID         string
	VerifiedCount  int64
	ChecksumDiffs   []checksum.MismatchReport
}

func (e *Engine) Verify(ctx context.Context, taskID string) (*VerifyResult, error) {
	if taskID == "" {
		taskID = fmt.Sprintf("verify-%d", time.Now().UnixNano())
	}

	logger.Info("Listing source files from %s://%s/%s...",
		e.cfg.Source.Type, e.getSourceBucket(), e.cfg.Source.Prefix)
	srcFiles, err := e.source.ListAll(ctx, e.cfg.Source.Prefix)
	if err != nil {
		return nil, fmt.Errorf("list source: %w", err)
	}

	logger.Info("Listing target files from %s://%s/%s...",
		e.cfg.Target.Type, e.getTargetBucket(), e.cfg.Target.Prefix)
	tgtFiles, err := e.target.ListAll(ctx, e.cfg.Target.Prefix)
	if err != nil {
		return nil, fmt.Errorf("list target: %w", err)
	}

	tgtMap := make(map[string]storage.FileObject, len(tgtFiles))
	for _, f := range tgtFiles {
		tgtMap[f.Key] = f
	}

	srcMap := make(map[string]storage.FileObject, len(srcFiles))
	for _, f := range srcFiles {
		key := f.Key
		if e.cfg.Source.Prefix != "" {
			key = strings.TrimPrefix(f.Key, e.cfg.Source.Prefix)
			key = strings.TrimPrefix(key, "/")
		}
		srcMap[key] = f
	}

	result := &VerifyResult{
		TaskID:       taskID,
		ChecksumDiffs: []checksum.MismatchReport{},
	}

	sem := make(chan struct{}, e.cfg.Sync.Concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex

	for key, srcFile := range srcMap {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case sem <- struct{}{}:
		}

		wg.Add(1)
		go func(key string, srcFile storage.FileObject) {
			defer wg.Done()
			defer func() { <-sem }()

			tgtFile, exists := tgtMap[key]
			if !exists {
				mu.Lock()
				result.ChecksumDiffs = append(result.ChecksumDiffs, checksum.MismatchReport{
					Path:      key,
					Expected:  srcFile.Checksum,
					Actual:    "",
					Algorithm: e.cfg.Checksum.Algorithm,
					Reason:    "file missing in target",
				})
				mu.Unlock()
				return
			}

			srcChecksum := srcFile.Checksum
			if srcChecksum == "" {
				srcChecksum, err = e.computeFileChecksum(ctx, e.source, srcFile.Key)
				if err != nil {
					logger.Warn("Failed to compute source checksum for %s: %v", key, err)
					return
				}
			}

			tgtKey := key
			if e.cfg.Target.Prefix != "" {
				tgtKey = path.Join(e.cfg.Target.Prefix, key)
			}
			tgtChecksum := tgtFile.Checksum
			if tgtChecksum == "" {
				tgtChecksum, err = e.computeFileChecksum(ctx, e.target, tgtKey)
				if err != nil {
					logger.Warn("Failed to compute target checksum for %s: %v", key, err)
					return
				}
			}

			if srcChecksum != tgtChecksum {
				mu.Lock()
				result.ChecksumDiffs = append(result.ChecksumDiffs, checksum.MismatchReport{
					Path:      key,
					Expected:  srcChecksum,
					Actual:    tgtChecksum,
					Algorithm: e.cfg.Checksum.Algorithm,
					Reason:    "checksum mismatch",
				})
				mu.Unlock()
			} else {
				mu.Lock()
				result.VerifiedCount++
				mu.Unlock()
			}
		}(key, srcFile)
	}

	wg.Wait()

	logger.Info("Verification complete: %d checked, %d matched, %d mismatched",
		result.VerifiedCount+int64(len(result.ChecksumDiffs)),
		result.VerifiedCount,
		len(result.ChecksumDiffs))

	return result, nil
}

func (e *Engine) computeFileChecksum(ctx context.Context, provider storage.StorageProvider, key string) (string, error) {
	reader, _, err := provider.Get(ctx, key)
	if err != nil {
		return "", fmt.Errorf("get file %s: %w", key, err)
	}
	defer reader.Close()

	checksumStr, _, err := e.hasher.ComputeFromReader(reader)
	if err != nil {
		return "", fmt.Errorf("compute checksum for %s: %w", key, err)
	}
	return checksumStr, nil
}

func (e *Engine) getSourceBucket() string {
	switch e.cfg.Source.Type {
	case config.StorageTypeS3:
		return e.cfg.Source.S3.Bucket
	case config.StorageTypeOSS:
		return e.cfg.Source.OSS.Bucket
	case config.StorageTypeGCS:
		return e.cfg.Source.GCS.Bucket
	}
	return ""
}

func (e *Engine) getTargetBucket() string {
	switch e.cfg.Target.Type {
	case config.StorageTypeS3:
		return e.cfg.Target.S3.Bucket
	case config.StorageTypeOSS:
		return e.cfg.Target.OSS.Bucket
	case config.StorageTypeGCS:
		return e.cfg.Target.GCS.Bucket
	}
	return ""
}
