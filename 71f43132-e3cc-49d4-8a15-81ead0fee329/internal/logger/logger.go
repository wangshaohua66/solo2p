package logger

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Config struct {
	Level        string `yaml:"level"`
	OutputPath   string `yaml:"output_path"`
	RetentionDays int    `yaml:"retention_days"`
	EnableJSON   bool   `yaml:"enable_json"`
}

type Logger struct {
	inner   *slog.Logger
	mu      sync.Mutex
	cfg     Config
	file    *os.File
	traceID string
}

const (
	traceIDKey = "trace_id"
	sensitive  = "***"
)

var sensitiveFields = map[string]bool{
	"password":   true,
	"token":      true,
	"secret":     true,
	"api_key":    true,
	"auth":       true,
	"credential": true,
}

var (
	defaultLogger *Logger
	once          sync.Once
)

func Default() *Logger {
	once.Do(func() {
		defaultLogger = New(Config{
			Level:         "info",
			OutputPath:    "",
			RetentionDays: 30,
			EnableJSON:    true,
		})
	})
	return defaultLogger
}

func New(cfg Config) *Logger {
	l := &Logger{cfg: cfg}
	l.init()
	return l
}

func (l *Logger) init() {
	level := parseLevel(l.cfg.Level)
	var w io.Writer = os.Stdout

	if l.cfg.OutputPath != "" {
		if err := os.MkdirAll(filepath.Dir(l.cfg.OutputPath), 0755); err != nil {
			fmt.Fprintf(os.Stderr, "failed to create log dir: %v\n", err)
		} else {
			logPath := l.getTodayLogPath()
			if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
				l.file = f
				w = io.MultiWriter(os.Stdout, f)
			}
		}
	}

	var handler slog.Handler
	if l.cfg.EnableJSON {
		handler = slog.NewJSONHandler(w, &slog.HandlerOptions{
			Level:       level,
			AddSource:   true,
			ReplaceAttr: l.replaceAttr,
		})
	} else {
		handler = slog.NewTextHandler(w, &slog.HandlerOptions{
			Level:       level,
			AddSource:   true,
			ReplaceAttr: l.replaceAttr,
		})
	}

	l.inner = slog.New(handler)
	go l.rotateDaily()
	go l.cleanupOldLogs()
}

func (l *Logger) getTodayLogPath() string {
	date := time.Now().Format("2006-01-02")
	ext := filepath.Ext(l.cfg.OutputPath)
	base := strings.TrimSuffix(l.cfg.OutputPath, ext)
	return fmt.Sprintf("%s-%s%s", base, date, ext)
}

func (l *Logger) rotateDaily() {
	for {
		now := time.Now()
		next := now.Add(24 * time.Hour).Truncate(24 * time.Hour)
		time.Sleep(time.Until(next))
		l.mu.Lock()
		if l.file != nil {
			l.file.Close()
			logPath := l.getTodayLogPath()
			if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
				l.file = f
				w := io.MultiWriter(os.Stdout, f)
				var handler slog.Handler
				if l.cfg.EnableJSON {
					handler = slog.NewJSONHandler(w, nil)
				} else {
					handler = slog.NewTextHandler(w, nil)
				}
				l.inner = slog.New(handler)
			}
		}
		l.mu.Unlock()
	}
}

func (l *Logger) cleanupOldLogs() {
	if l.cfg.OutputPath == "" || l.cfg.RetentionDays <= 0 {
		return
	}
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		dir := filepath.Dir(l.cfg.OutputPath)
		base := filepath.Base(l.cfg.OutputPath)
		ext := filepath.Ext(base)
		prefix := strings.TrimSuffix(base, ext) + "-"

		files, err := filepath.Glob(filepath.Join(dir, prefix+"*"+ext))
		if err != nil {
			continue
		}
		cutoff := time.Now().AddDate(0, 0, -l.cfg.RetentionDays)
		for _, f := range files {
			info, err := os.Stat(f)
			if err != nil {
				continue
			}
			if info.ModTime().Before(cutoff) {
				os.Remove(f)
			}
		}
	}
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func (l *Logger) replaceAttr(groups []string, a slog.Attr) slog.Attr {
	if a.Key == slog.SourceKey {
		if src, ok := a.Value.Any().(*slog.Source); ok {
			parts := strings.Split(src.File, string(filepath.Separator))
			if len(parts) > 3 {
				src.File = strings.Join(parts[len(parts)-3:], string(filepath.Separator))
			}
			a.Value = slog.StringValue(fmt.Sprintf("%s:%d", src.File, src.Line))
		}
	}
	if l.traceID != "" && len(groups) == 0 {
		return a
	}
	if sensitiveFields[strings.ToLower(a.Key)] {
		a.Value = slog.StringValue(sensitive)
	}
	return a
}

func (l *Logger) WithTraceID(traceID string) *Logger {
	nl := &Logger{cfg: l.cfg, inner: l.inner, traceID: traceID}
	nl.inner = nl.inner.With(traceIDKey, traceID)
	return nl
}

func (l *Logger) WithContext(ctx context.Context) *Logger {
	if traceID, ok := ctx.Value(traceIDKey).(string); ok {
		return l.WithTraceID(traceID)
	}
	return l
}

func (l *Logger) Debug(msg string, args ...any) {
	l.inner.Debug(msg, args...)
}

func (l *Logger) Info(msg string, args ...any) {
	l.inner.Info(msg, args...)
}

func (l *Logger) Warn(msg string, args ...any) {
	l.inner.Warn(msg, args...)
}

func (l *Logger) Error(msg string, args ...any) {
	l.inner.Error(msg, args...)
}

func (l *Logger) Debugf(format string, args ...any) {
	l.inner.Debug(fmt.Sprintf(format, args...))
}

func (l *Logger) Infof(format string, args ...any) {
	l.inner.Info(fmt.Sprintf(format, args...))
}

func (l *Logger) Warnf(format string, args ...any) {
	l.inner.Warn(fmt.Sprintf(format, args...))
}

func (l *Logger) Errorf(format string, args ...any) {
	l.inner.Error(fmt.Sprintf(format, args...))
}

func (l *Logger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}

func NewTraceID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func ContextWithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, traceIDKey, traceID)
}

func MarshalJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%+v", v)
	}
	return string(b)
}
