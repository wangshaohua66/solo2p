package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/crs"
	"github.com/remote-sensing/sentinel-cli/internal/formula"
	"github.com/remote-sensing/sentinel-cli/internal/io"
	"github.com/remote-sensing/sentinel-cli/internal/log"
	"github.com/remote-sensing/sentinel-cli/internal/store"
	"github.com/remote-sensing/sentinel-cli/internal/types"
	"github.com/remote-sensing/sentinel-cli/internal/util"

	"github.com/rs/zerolog"
)

type PipelineEngine struct {
	store       *store.BoltStore
	config      *types.Config
	logger      zerolog.Logger
	auditLogger *log.AuditLogger
	workers     map[string]*Worker
	workerPool  chan struct{}
	taskQueue   chan *types.Task
	running     atomic.Bool
	stopChan    chan struct{}
	stats       *PipelineStats
	mu          sync.RWMutex
}

type Worker struct {
	ID         string
	Status     string
	CurrentTask *types.Task
	Processed  int64
	StartTime  time.Time
	LastActivity time.Time
	logger     zerolog.Logger
	engine     *PipelineEngine
}

type PipelineStats struct {
	TotalTasks     int64
	PendingTasks   int64
	RunningTasks   int64
	CompletedTasks int64
	FailedTasks    int64
	DeadTasks      int64
	ThroughputMBs  float64
	TotalBytes     int64
	ProcessedBytes int64
	StartTime      time.Time
	mu             sync.RWMutex
}

type CheckpointData struct {
	TaskID       string
	ChunkIndex   int
	BytesProcessed int64
	LastUpdate   time.Time
	WorkerID     string
}

func NewPipelineEngine(store *store.BoltStore, config *types.Config, logger zerolog.Logger, auditLogger *log.AuditLogger) *PipelineEngine {
	return &PipelineEngine{
		store:       store,
		config:      config,
		logger:      logger,
		auditLogger: auditLogger,
		workers:     make(map[string]*Worker),
		workerPool:  make(chan struct{}, config.Global.MaxConcurrent),
		taskQueue:   make(chan *types.Task, config.Pipeline.QueueCapacity),
		stopChan:    make(chan struct{}),
		stats: &PipelineStats{
			StartTime: time.Now(),
		},
	}
}

func (e *PipelineEngine) Start(ctx context.Context) error {
	if e.running.Load() {
		return nil
	}
	e.running.Store(true)
	e.logger.Info().Int("workers", e.config.Global.MaxConcurrent).Msg("pipeline engine starting")
	g, ctx := errgroup.WithContext(ctx)
	for i := 0; i < e.config.Global.MaxConcurrent; i++ {
		workerID := fmt.Sprintf("worker-%02d", i+1)
		worker := &Worker{
			ID:     workerID,
			Status: "idle",
			logger: e.logger.With().Str("worker", workerID).Logger(),
			engine: e,
		}
		e.workers[workerID] = worker
		g.Go(func() error {
			return worker.run(ctx)
		})
	}
	go e.monitorStats(ctx)
	return g.Wait()
}

func (e *PipelineEngine) Stop(ctx context.Context) error {
	if !e.running.Load() {
		return nil
	}
	e.logger.Info().Msg("pipeline engine stopping")
	close(e.stopChan)
	timeout := time.After(time.Duration(e.config.Daemon.GracefulShutdownSec) * time.Second)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			e.logger.Warn().Msg("graceful shutdown timeout reached, forcing stop")
			incomplete := 0
			e.mu.RLock()
			for _, w := range e.workers {
				if w.CurrentTask != nil {
					incomplete++
					errRecord := types.ErrorRecord{
						Timestamp: time.Now(),
						ErrorCode: apperrors.E6004,
						Message:   "task interrupted during graceful shutdown",
					}
					_ = e.store.UpdateTaskStatus(w.CurrentTask.ID, types.TaskStatusFailed, &errRecord)
				}
			}
			e.mu.RUnlock()
			if incomplete > 0 {
				e.logger.Warn().Int("incomplete_tasks", incomplete).Msg("some tasks did not complete during shutdown")
			}
			e.running.Store(false)
			return apperrors.New(apperrors.E6004, fmt.Sprintf("%d tasks did not complete during graceful shutdown", incomplete))
		default:
			allIdle := true
			e.mu.RLock()
			for _, w := range e.workers {
				if w.Status != "idle" {
					allIdle = false
					break
				}
			}
			e.mu.RUnlock()
			if allIdle {
				e.running.Store(false)
				e.logger.Info().Msg("pipeline engine stopped gracefully")
				return nil
			}
			time.Sleep(100 * time.Millisecond)
		}
	}
}

func (e *PipelineEngine) SubmitTask(task *types.Task) error {
	if task.ID == "" {
		if err := e.store.CreateTask(task); err != nil {
			return err
		}
	}
	e.logger.Info().Str("task_id", task.ID).Str("task_type", string(task.Type)).Msg("task submitted")
	select {
	case e.taskQueue <- task:
		return nil
	default:
		return apperrors.New(apperrors.E7003, "task queue is full")
	}
}

func (e *PipelineEngine) SubmitTasks(tasks []*types.Task) (int, error) {
	if err := e.store.BatchCreateTasks(tasks); err != nil {
		return 0, err
	}
	submitted := 0
	for _, task := range tasks {
		select {
		case e.taskQueue <- task:
			submitted++
		default:
			e.logger.Warn().Str("task_id", task.ID).Msg("task queue full, task stored but not queued")
		}
	}
	e.logger.Info().Int("submitted", submitted).Int("total", len(tasks)).Msg("batch tasks submitted")
	return submitted, nil
}

func (e *PipelineEngine) GetStats() types.PipelineStats {
	e.stats.mu.RLock()
	defer e.stats.mu.RUnlock()
	workers := make([]types.WorkerStatus, 0, len(e.workers))
	e.mu.RLock()
	for _, w := range e.workers {
		ws := types.WorkerStatus{
			ID:           w.ID,
			Status:       w.Status,
			Processed:    w.Processed,
			StartTime:    w.StartTime,
			LastActivity: w.LastActivity,
		}
		if w.CurrentTask != nil {
			ws.CurrentTask = &w.CurrentTask.ID
		}
		workers = append(workers, ws)
	}
	e.mu.RUnlock()
	uptime := time.Since(e.stats.StartTime)
	return types.PipelineStats{
		TotalTasks:     int(e.stats.TotalTasks),
		PendingTasks:   int(e.stats.PendingTasks),
		RunningTasks:   int(e.stats.RunningTasks),
		CompletedTasks: int(e.stats.CompletedTasks),
		FailedTasks:    int(e.stats.FailedTasks),
		DeadTasks:      int(e.stats.DeadTasks),
		ThroughputMBs:  e.stats.ThroughputMBs,
		TotalBytes:     e.stats.TotalBytes,
		ProcessedBytes: e.stats.ProcessedBytes,
		StartTime:      e.stats.StartTime,
		Uptime:         uptime,
		Workers:        workers,
	}
}

func (e *PipelineEngine) monitorStats(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-e.stopChan:
			return
		case <-ticker.C:
			stats, err := e.store.GetStats()
			if err != nil {
				e.logger.Error().Err(err).Msg("failed to get stats from store")
				continue
			}
			e.stats.mu.Lock()
			e.stats.TotalTasks = int64(stats.TotalTasks)
			e.stats.PendingTasks = int64(stats.PendingTasks)
			e.stats.RunningTasks = int64(stats.RunningTasks)
			e.stats.CompletedTasks = int64(stats.CompletedTasks)
			e.stats.FailedTasks = int64(stats.FailedTasks)
			e.stats.DeadTasks = int64(stats.DeadTasks)
			e.stats.TotalBytes = stats.TotalBytes
			e.stats.ProcessedBytes = stats.ProcessedBytes
			e.stats.ThroughputMBs = stats.ThroughputMBs
			e.stats.mu.Unlock()
		}
	}
}

func (w *Worker) run(ctx context.Context) error {
	w.StartTime = time.Now()
	w.LastActivity = time.Now()
	w.logger.Info().Msg("worker started")
	defer func() {
		if r := recover(); r != nil {
			w.logger.Error().Interface("panic", r).Msg("worker panicked")
			err := apperrors.New(apperrors.E7001, fmt.Sprintf("worker panicked: %v", r))
			if w.CurrentTask != nil {
				errRecord := types.ErrorRecord{
					Timestamp: time.Now(),
					ErrorCode: err.Code,
					Message:   err.Message,
					Context:   map[string]interface{}{"panic": r},
				}
				_ = w.engine.store.UpdateTaskStatus(w.CurrentTask.ID, types.TaskStatusFailed, &errRecord)
			}
			panic(r)
		}
	}()
	for {
		select {
		case <-ctx.Done():
			w.Status = "idle"
			w.logger.Info().Msg("worker stopping due to context cancellation")
			return nil
		case <-w.engine.stopChan:
			w.Status = "idle"
			w.logger.Info().Msg("worker stopping gracefully")
			return nil
		case task := <-w.engine.taskQueue:
			if task == nil {
				continue
			}
			w.Status = "processing"
			w.CurrentTask = task
			w.LastActivity = time.Now()
			err := w.processTask(ctx, task)
			w.LastActivity = time.Now()
			w.Processed++
			if err != nil {
				w.logger.Error().Err(err).Str("task_id", task.ID).Msg("task failed")
				errRecord := types.ErrorRecord{
					Timestamp: time.Now(),
				}
				if appErr, ok := err.(*apperrors.AppError); ok {
					errRecord.ErrorCode = appErr.Code
					errRecord.Message = appErr.Message
					errRecord.Context = appErr.Context
				} else {
					errRecord.ErrorCode = apperrors.E7001
					errRecord.Message = err.Error()
				}
				updateErr := w.engine.store.UpdateTaskStatus(task.ID, types.TaskStatusFailed, &errRecord)
				if updateErr != nil {
					w.logger.Error().Err(updateErr).Str("task_id", task.ID).Msg("failed to update task status")
				}
				atomic.AddInt64(&w.engine.stats.FailedTasks, 1)
				atomic.AddInt64(&w.engine.stats.RunningTasks, -1)
			} else {
				updateErr := w.engine.store.UpdateTaskStatus(task.ID, types.TaskStatusDone, nil)
				if updateErr != nil {
					w.logger.Error().Err(updateErr).Str("task_id", task.ID).Msg("failed to update task status")
				}
				atomic.AddInt64(&w.engine.stats.CompletedTasks, 1)
				atomic.AddInt64(&w.engine.stats.RunningTasks, -1)
			}
			w.Status = "idle"
			w.CurrentTask = nil
		}
	}
}

func (w *Worker) processTask(ctx context.Context, task *types.Task) error {
	w.logger.Info().Str("task_id", task.ID).Str("type", string(task.Type)).Msg("processing task")
	atomic.AddInt64(&w.engine.stats.RunningTasks, 1)
	endLog := log.LogOperationStart(w.logger, string(task.Type), task.ID, task.InputPath)
	startTime := time.Now()
	inputSHA, err := log.ComputeFileSHA256(task.InputPath)
	if err != nil {
		endLog(false, err.(*apperrors.AppError))
		return err
	}
	checkpointData, err := w.loadCheckpoint(task.ID)
	startChunk := 0
	if err == nil && checkpointData != nil {
		startChunk = checkpointData.ChunkIndex
		w.logger.Info().Str("task_id", task.ID).Int("resume_from_chunk", startChunk).Msg("resuming task from checkpoint")
	}
	reader, err := io.NewGeoTIFFReader(task.InputPath, w.engine.config.IO.ChunkSizeMB)
	if err != nil {
		endLog(false, err.(*apperrors.AppError))
		return err
	}
	defer reader.Close()
	meta := reader.Metadata()
	totalChunks := reader.TotalChunks()
	totalBytes := meta.FileSize
	progress := &types.TaskProgress{
		TaskID:       task.ID,
		TotalChunks:  totalChunks,
		BytesTotal:   totalBytes,
		StartTime:    startTime,
		LastUpdate:   startTime,
	}
	_ = w.engine.store.UpdateTask(task)
	outputMeta := *meta
	outputMeta.EPSGCode = w.engine.config.CRS.DefaultTargetEPSG
	outputMeta.CRS = fmt.Sprintf("EPSG:%d", w.engine.config.CRS.DefaultTargetEPSG)
	outputMeta.SHA256 = ""
	var outputPath string
	switch task.Type {
	case types.TaskTypeConvertCRS:
		if crsConfig, ok := task.Config.(types.CRSTransformConfig); ok {
			outputMeta.EPSGCode = crsConfig.TargetEPSG
			outputMeta.CRS = fmt.Sprintf("EPSG:%d", crsConfig.TargetEPSG)
		}
		outputPath = w.generateOutputPath(task, "_crs")
	case types.TaskTypeIndexNDVI, types.TaskTypeIndexEVI, types.TaskTypeIndexSAVI, types.TaskTypeIndexCustom:
		outputMeta.NumBands = 1
		outputMeta.Bands = []types.BandInfo{
			{Index: 1, Name: strings.ToUpper(string(task.Type)[6:]), DataType: "float32", NoDataValue: &w.engine.config.Index.DefaultNoDataValue},
		}
		outputPath = w.generateOutputPath(task, "_"+strings.ToLower(string(task.Type)[6:]))
	default:
		outputPath = w.generateOutputPath(task, "_output")
	}
	writer, err := io.NewGeoTIFFWriter(outputPath, &outputMeta, w.engine.config.IO.ChunkSizeMB)
	if err != nil {
		endLog(false, err.(*apperrors.AppError))
		return err
	}
	defer writer.Close()
	for chunkIdx := startChunk; chunkIdx < totalChunks; chunkIdx++ {
		select {
		case <-ctx.Done():
			endLog(false, apperrors.New(apperrors.E7001, "context cancelled"))
			return ctx.Err()
		case <-w.engine.stopChan:
			endLog(false, apperrors.New(apperrors.E7001, "engine stopped"))
			return nil
		default:
		}
		chunk, err := reader.ReadChunk(chunkIdx)
		if err != nil {
			endLog(false, err.(*apperrors.AppError))
			return err
		}
		chunk.TaskID = task.ID
		processedChunk, err := w.processChunk(ctx, chunk, task, meta)
		if err != nil {
			endLog(false, err.(*apperrors.AppError))
			return err
		}
		if err := writer.WriteChunk(processedChunk); err != nil {
			endLog(false, err.(*apperrors.AppError))
			return err
		}
		progress.CurrentChunk = chunkIdx + 1
		progress.BytesProcessed += int64(chunk.Height * chunk.Width * meta.NumBands * 2)
		progress.LastUpdate = time.Now()
		elapsed := progress.LastUpdate.Sub(progress.StartTime).Seconds()
		if elapsed > 0 {
			progress.AverageRate = float64(progress.BytesProcessed) / 1024 / 1024 / elapsed
		}
		task.Progress = *progress
		if (chunkIdx+1)%w.engine.config.Pipeline.CheckpointInterval == 0 {
			_ = w.saveCheckpoint(task.ID, chunkIdx+1, progress.BytesProcessed)
		}
		if w.engine.config.Logging.Verbose {
			rateMBs := float64(chunk.Height*chunk.Width*meta.NumBands*2) / 1024 / 1024 / time.Since(progress.LastUpdate).Seconds()
			log.LogChunkProgress(w.logger, task.ID, chunkIdx, totalChunks, progress.BytesProcessed, rateMBs)
		}
		_ = w.engine.store.UpdateTask(task)
	}
	_ = w.engine.store.DeleteCheckpoint(task.ID)
	outputSHA, err := log.ComputeFileSHA256(outputPath)
	if err != nil {
		endLog(false, err.(*apperrors.AppError))
		return err
	}
	durationMs := time.Since(startTime).Milliseconds()
	auditEntry := types.AuditLogEntry{
		TaskID:       task.ID,
		Operation:    string(task.Type),
		InputFile:    task.InputPath,
		InputSHA256:  inputSHA,
		OutputFile:   outputPath,
		OutputSHA256: outputSHA,
		Parameters:   map[string]interface{}{"type": task.Type},
		DurationMs:   durationMs,
		Success:      true,
	}
	if w.engine.auditLogger != nil {
		if err := w.engine.auditLogger.Log(auditEntry); err != nil {
			w.logger.Error().Err(err).Msg("failed to write audit log")
		}
	}
	endLog(true, nil)
	return nil
}

func (w *Worker) checkChunkMemory(chunk *types.Chunk, meta *types.GeoTIFFMetadata, task *types.Task) error {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	sysMemory := ms.Sys
	availableBytes := int64(sysMemory) - int64(ms.Alloc)

	configuredLimitGB := w.engine.config.IO.MemoryLimitGB
	if configuredLimitGB <= 0 {
		configuredLimitGB = 1.5
	}
	configuredLimitBytes := int64(configuredLimitGB * 1024 * 1024 * 1024)
	memoryLimitBytes := availableBytes
	if configuredLimitBytes < memoryLimitBytes {
		memoryLimitBytes = configuredLimitBytes
	}
	if memoryLimitBytes < 256*1024*1024 {
		memoryLimitBytes = 256 * 1024 * 1024
	}

	rows := chunk.Height
	cols := chunk.Width
	numBands := meta.NumBands

	bytesPerPixel := io.DataTypeBytesPerPixel(meta.DataType, meta.BitsPerSample)
	inputBytes := int64(rows) * int64(cols) * int64(numBands) * int64(bytesPerPixel)

	var outputBands int
	var outputDataType string
	switch {
	case task.Type == types.TaskTypeConvertCRS:
		outputBands = numBands
		outputDataType = meta.DataType
	default:
		outputBands = 1
		outputDataType = "float32"
	}
	outputBytesPerPixel := io.DataTypeBytesPerPixel(outputDataType, 0)
	outputBytes := int64(rows) * int64(cols) * int64(outputBands) * int64(outputBytesPerPixel)
	overheadBytes := int64(32 * 1024 * 1024)

	totalRequired := inputBytes + outputBytes + overheadBytes
	if totalRequired > memoryLimitBytes {
		return apperrors.New(apperrors.E1004,
			fmt.Sprintf("chunk memory required %.2f MB exceeds available %.2f MB (configured limit %.2f GB), reduce chunk size or increase memory_limit_gb",
				float64(totalRequired)/1024/1024,
				float64(memoryLimitBytes)/1024/1024,
				configuredLimitGB))
	}
	return nil
}

func (w *Worker) processChunk(ctx context.Context, chunk *types.Chunk, task *types.Task, meta *types.GeoTIFFMetadata) (*types.Chunk, error) {
	if err := w.checkChunkMemory(chunk, meta, task); err != nil {
		return nil, err
	}
	switch task.Type {
	case types.TaskTypeConvertCRS:
		crsConfig, ok := task.Config.(types.CRSTransformConfig)
		if !ok {
			crsConfig = types.CRSTransformConfig{
				SourceEPSG: meta.EPSGCode,
				TargetEPSG: w.engine.config.CRS.DefaultTargetEPSG,
			}
		}
		transformer, err := w.getTransformer(crsConfig)
		if err != nil {
			return nil, err
		}
		return transformer.TransformChunk(chunk, meta)
	case types.TaskTypeIndexNDVI, types.TaskTypeIndexEVI, types.TaskTypeIndexSAVI, types.TaskTypeIndexCustom:
		idxConfig, ok := task.Config.(types.VegetationIndexConfig)
		if !ok {
			formula, _ := w.getIndexFormula(meta.SensorType, string(task.Type)[6:])
			idxConfig = types.VegetationIndexConfig{
				IndexType:   string(task.Type)[6:],
				Formula:     formula,
				NoDataValue: w.engine.config.Index.DefaultNoDataValue,
			}
		}
		return w.calculateVegetationIndex(chunk, idxConfig, meta)
	default:
		return chunk, nil
	}
}

func (w *Worker) getTransformer(config types.CRSTransformConfig) (*crs.CRSTransformer, error) {
	return crs.NewCRSTransformer(config)
}

func (w *Worker) getIndexFormula(sensor types.SensorType, indexType string) (string, string) {
	formulas := map[string]map[string]string{
		"sentinel2": {
			"ndvi": "(B8 - B4) / (B8 + B4)",
			"evi":  "2.5 * (B8 - B4) / (B8 + 6 * B4 - 7.5 * B2 + 1)",
			"savi": "((B8 - B4) / (B8 + B4 + 0.5)) * 1.5",
		},
		"landsat8": {
			"ndvi": "(B5 - B4) / (B5 + B4)",
			"evi":  "2.5 * (B5 - B4) / (B5 + 6 * B4 - 7.5 * B2 + 1)",
			"savi": "((B5 - B4) / (B5 + B4 + 0.5)) * 1.5",
		},
		"gf2": {
			"ndvi": "(B5 - B4) / (B5 + B4)",
			"evi":  "2.5 * (B5 - B4) / (B5 + 6 * B4 - 7.5 * B2 + 1)",
			"savi": "((B5 - B4) / (B5 + B4 + 0.5)) * 1.5",
		},
	}
	sensorKey := string(sensor)
	if sensorKey == "" || sensorKey == "unknown" {
		sensorKey = "sentinel2"
	}
	if f, ok := formulas[sensorKey][strings.ToLower(indexType)]; ok {
		return f, sensorKey
	}
	return "(B8 - B4) / (B8 + B4)", "sentinel2"
}

func (w *Worker) calculateVegetationIndex(chunk *types.Chunk, config types.VegetationIndexConfig, meta *types.GeoTIFFMetadata) (*types.Chunk, error) {
	data, ok := chunk.Data.([][]float64)
	if !ok {
		return nil, apperrors.New(apperrors.E1001, "invalid chunk data format")
	}
	bandMap := formula.BuildBandMap(meta)
	formulaStr := config.Formula
	if formulaStr == "" {
		f, _ := w.getIndexFormula(meta.SensorType, config.IndexType)
		formulaStr = f
	}
	parsed := formula.Tokenize(formulaStr, bandMap)
	rows := chunk.Height
	cols := chunk.Width
	numPixels := rows * cols
	resultData := make([][]float64, 1)
	resultData[0] = make([]float64, numPixels)
	for i := 0; i < numPixels; i++ {
		values := make(map[string]float64)
		for bandKey, bandIdx := range bandMap {
			if bandIdx < len(data) && i < len(data[bandIdx]) {
				values[bandKey] = data[bandIdx][i]
			}
		}
		resultData[0][i] = formula.Evaluate(parsed, values, config.NoDataValue)
	}
	resultChunk := *chunk
	resultChunk.Data = resultData
	return &resultChunk, nil
}

func (w *Worker) saveCheckpoint(taskID string, chunkIndex int, bytesProcessed int64) error {
	cp := CheckpointData{
		TaskID:         taskID,
		ChunkIndex:     chunkIndex,
		BytesProcessed: bytesProcessed,
		LastUpdate:     time.Now(),
		WorkerID:       w.ID,
	}
	data, err := json.Marshal(cp)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E7002, "cannot serialize checkpoint")
	}
	return w.engine.store.SaveCheckpoint(taskID, data)
}

func (w *Worker) loadCheckpoint(taskID string) (*CheckpointData, error) {
	data, err := w.engine.store.GetCheckpoint(taskID)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, nil
	}
	var cp CheckpointData
	if err := json.Unmarshal(data, &cp); err != nil {
		return nil, apperrors.Wrap(err, apperrors.E7002, "checkpoint data corrupted")
	}
	return &cp, nil
}

func (w *Worker) generateOutputPath(task *types.Task, suffix string) string {
	base := filepath.Base(task.InputPath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	outputDir := w.engine.config.Global.OutputDirectory
	if task.OutputPath != "" {
		return task.OutputPath
	}
	return filepath.Join(outputDir, fmt.Sprintf("%s%s%s", name, suffix, ext))
}

func CalculateETA(progress types.TaskProgress) time.Duration {
	if progress.AverageRate <= 0 || progress.BytesTotal <= 0 {
		return 0
	}
	remainingBytes := progress.BytesTotal - progress.BytesProcessed
	seconds := float64(remainingBytes) / 1024 / 1024 / progress.AverageRate
	return time.Duration(seconds * float64(time.Second))
}

func CalculateThroughputMBs(processedBytes int64, elapsed time.Duration) float64 {
	if elapsed.Seconds() <= 0 {
		return 0
	}
	return float64(processedBytes) / 1024 / 1024 / elapsed.Seconds()
}

func FindFiles(root string, recursive bool, extensions []string) ([]string, error) {
	var files []string
	root = util.ExpandPath(root)
	if _, err := os.Stat(root); os.IsNotExist(err) {
		return nil, apperrors.Wrap(err, apperrors.E4001, fmt.Sprintf("directory not found: %s", root))
	}
	extMap := make(map[string]bool)
	for _, ext := range extensions {
		extMap[strings.ToLower(ext)] = true
	}
	if recursive {
		err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && extMap[strings.ToLower(filepath.Ext(path))] {
				files = append(files, path)
			}
			return nil
		})
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.E4001, "error walking directory")
		}
	} else {
		entries, err := os.ReadDir(root)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.E4001, "error reading directory")
		}
		for _, entry := range entries {
			if !entry.IsDir() && extMap[strings.ToLower(filepath.Ext(entry.Name()))] {
				files = append(files, filepath.Join(root, entry.Name()))
			}
		}
	}
	return files, nil
}

func CreateTaskFromFile(filePath string, taskType types.TaskType, config interface{}, priority, maxRetries int) *types.Task {
	return &types.Task{
		Type:       taskType,
		InputPath:  filePath,
		Config:     config,
		Priority:   priority,
		MaxRetries: maxRetries,
		Status:     types.TaskStatusPending,
		CreatedAt:  time.Now(),
		Progress: types.TaskProgress{
			StartTime: time.Now(),
		},
		Metadata: make(map[string]string),
	}
}
