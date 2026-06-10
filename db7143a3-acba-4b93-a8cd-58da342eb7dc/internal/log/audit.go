package log

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog"

	apperrors "github.com/remote-sensing/sentinel-cli/internal/errors"
	"github.com/remote-sensing/sentinel-cli/internal/types"
)

type AuditLogger struct {
	logger      zerolog.Logger
	file        *os.File
	mu          sync.Mutex
	logPath     string
	maxSizeMB   int
	maxBackups  int
	currentSize int64
}

var (
	instance *AuditLogger
	once     sync.Once
)

func GetAuditLogger(cfg types.LoggingConfig) (*AuditLogger, error) {
	var err error
	once.Do(func() {
		instance, err = newAuditLogger(cfg)
	})
	if err != nil {
		return nil, err
	}
	return instance, nil
}

func newAuditLogger(cfg types.LoggingConfig) (*AuditLogger, error) {
	expandedPath := expandPath(cfg.AuditLogPath)
	dir := filepath.Dir(expandedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot create audit log directory: %s", dir))
	}
	file, err := os.OpenFile(expandedPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot open audit log file: %s", expandedPath))
	}
	fileInfo, err := file.Stat()
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.E1005, "cannot stat audit log file")
	}
	zlog := zerolog.New(file).With().Timestamp().Str("component", "audit").Logger()
	return &AuditLogger{
		logger:      zlog,
		file:        file,
		logPath:     expandedPath,
		maxSizeMB:   cfg.AuditLogMaxSizeMB,
		maxBackups:  cfg.AuditLogMaxBackups,
		currentSize: fileInfo.Size(),
	}, nil
}

func expandPath(path string) string {
	if len(path) > 0 && path[0] == '~' {
		if home, err := os.UserHomeDir(); err == nil {
			path = filepath.Join(home, path[1:])
		}
	}
	return path
}

func (a *AuditLogger) Log(entry types.AuditLogEntry) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	entry.Timestamp = time.Now()
	host, _ := os.Hostname()
	entry.Hostname = host
	if entry.Operator == "" {
		entry.Operator = os.Getenv("USER")
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return apperrors.Wrap(err, apperrors.E3002, "cannot serialize audit entry")
	}
	event := a.logger.Log().
		Str("task_id", entry.TaskID).
		Str("operation", entry.Operation).
		Str("input_file", entry.InputFile).
		Str("input_sha256", entry.InputSHA256).
		Str("output_file", entry.OutputFile).
		Str("output_sha256", entry.OutputSHA256).
		Str("operator", entry.Operator).
		Str("hostname", entry.Hostname).
		Int64("duration_ms", entry.DurationMs).
		Bool("success", entry.Success)
	if entry.ErrorCode != nil {
		event = event.Str("error_code", string(*entry.ErrorCode)).Str("error_message", entry.ErrorMessage)
	}
	for k, v := range entry.Parameters {
		event = event.Interface(fmt.Sprintf("param_%s", k), v)
	}
	event.Send()
	a.currentSize += int64(len(data)) + 1
	if a.maxSizeMB > 0 && a.currentSize >= int64(a.maxSizeMB)*1024*1024 {
		_ = a.rotate()
	}
	return nil
}

func (a *AuditLogger) rotate() error {
	if err := a.file.Close(); err != nil {
		return err
	}
	for i := a.maxBackups - 1; i > 0; i-- {
		src := fmt.Sprintf("%s.%d", a.logPath, i)
		dst := fmt.Sprintf("%s.%d", a.logPath, i+1)
		if _, err := os.Stat(src); err == nil {
			_ = os.Rename(src, dst)
		}
	}
	_ = os.Rename(a.logPath, a.logPath+".1")
	file, err := os.OpenFile(a.logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	a.file = file
	a.currentSize = 0
	a.logger = zerolog.New(file).With().Timestamp().Str("component", "audit").Logger()
	return nil
}

func (a *AuditLogger) Close() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.file != nil {
		return a.file.Close()
	}
	return nil
}

func ComputeFileSHA256(filePath string) (string, error) {
	expandedPath := expandPath(filePath)
	file, err := os.Open(expandedPath)
	if err != nil {
		return "", apperrors.Wrap(err, apperrors.E4001, fmt.Sprintf("cannot open file for SHA256: %s", filePath))
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", apperrors.Wrap(err, apperrors.E1001, fmt.Sprintf("cannot compute SHA256 for: %s", filePath))
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func ComputeChunkSHA256(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func NewZeroLogger(cfg types.LoggingConfig) zerolog.Logger {
	var level zerolog.Level
	switch cfg.Level {
	case "debug":
		level = zerolog.DebugLevel
	case "info":
		level = zerolog.InfoLevel
	case "warn":
		level = zerolog.WarnLevel
	case "error":
		level = zerolog.ErrorLevel
	default:
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)
	var writer io.Writer
	if cfg.Format == "text" {
		writer = zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339}
	} else {
		writer = os.Stderr
	}
	return zerolog.New(writer).With().Timestamp().Caller().Logger()
}

func LogOperationStart(logger zerolog.Logger, operation, taskID, inputFile string) func(success bool, err *apperrors.AppError) {
	start := time.Now()
	logger.Info().
		Str("operation", operation).
		Str("task_id", taskID).
		Str("input_file", inputFile).
		Msg("operation started")
	return func(success bool, appErr *apperrors.AppError) {
		duration := time.Since(start)
		event := logger.Info().
			Str("operation", operation).
			Str("task_id", taskID).
			Str("input_file", inputFile).
			Dur("duration", duration).
			Bool("success", success)
		if appErr != nil {
			event.
				Str("error_code", string(appErr.Code)).
				Str("severity", string(appErr.Severity)).
				Msg(appErr.Message)
		} else {
			event.Msg("operation completed")
		}
	}
}

func LogChunkProgress(logger zerolog.Logger, taskID string, chunkIndex, totalChunks int, bytesProcessed int64, rateMBs float64) {
	logger.Debug().
		Str("task_id", taskID).
		Int("chunk_index", chunkIndex).
		Int("total_chunks", totalChunks).
		Int64("bytes_processed", bytesProcessed).
		Float64("rate_mb_s", rateMBs).
		Msg("chunk processed")
}

func GenerateReportJSON(tasks []*types.Task, outputPath string) error {
	expandedPath := expandPath(outputPath)
	dir := filepath.Dir(expandedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot create report directory: %s", dir))
	}
	report := struct {
		GeneratedAt time.Time      `json:"generated_at"`
		TotalTasks  int            `json:"total_tasks"`
		Tasks       []*types.Task  `json:"tasks"`
		Summary     map[string]int `json:"summary"`
	}{
		GeneratedAt: time.Now(),
		TotalTasks:  len(tasks),
		Tasks:       tasks,
		Summary: map[string]int{
			"pending":   0,
			"running":   0,
			"completed": 0,
			"failed":    0,
			"dead":      0,
		},
	}
	for _, task := range tasks {
		report.Summary[string(task.Status)]++
	}
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return apperrors.Wrap(err, apperrors.E3002, "cannot serialize report")
	}
	if err := os.WriteFile(expandedPath, data, 0644); err != nil {
		return apperrors.Wrap(err, apperrors.E1005, fmt.Sprintf("cannot write report: %s", outputPath))
	}
	return nil
}
