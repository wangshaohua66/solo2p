package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"eco-inspector/pkg/config"
)

type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
)

var levelOrder = map[LogLevel]int{
	LevelDebug: 0,
	LevelInfo:  1,
	LevelWarn:  2,
	LevelError: 3,
}

type Entry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Operator  string `json:"operator,omitempty"`
	Action    string `json:"action,omitempty"`
	Target    string `json:"target,omitempty"`
	Result    string `json:"result,omitempty"`
	Error     string `json:"error,omitempty"`
}

type Logger struct {
	mu        sync.Mutex
	cfg       config.LogConfig
	minLevel  LogLevel
	file      *os.File
	fileSize  int64
	dateStr   string
}

var (
	defaultLogger *Logger
	once          sync.Once
)

func Init(cfg config.LogConfig) error {
	var err error
	once.Do(func() {
		defaultLogger, err = New(cfg)
	})
	return err
}

func New(cfg config.LogConfig) (*Logger, error) {
	if err := os.MkdirAll(cfg.Dir, 0755); err != nil {
		return nil, fmt.Errorf("create log dir: %w", err)
	}
	l := &Logger{
		cfg:      cfg,
		minLevel: LogLevel(strings.ToLower(cfg.Level)),
	}
	if err := l.openFile(); err != nil {
		return nil, err
	}
	return l, nil
}

func (l *Logger) openFile() error {
	now := time.Now()
	dateStr := now.Format("2006-01-02")
	path := filepath.Join(l.cfg.Dir, fmt.Sprintf("eco_inspector_%s.log", dateStr))

	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}

	if fi, err := f.Stat(); err == nil {
		l.fileSize = fi.Size()
	}

	if l.file != nil {
		l.file.Close()
	}
	l.file = f
	l.dateStr = dateStr
	return nil
}

func (l *Logger) checkRotation() error {
	now := time.Now()
	dateStr := now.Format("2006-01-02")

	if dateStr != l.dateStr || l.fileSize >= int64(l.cfg.MaxSizeMB)*1024*1024 {
		if err := l.openFile(); err != nil {
			return err
		}
	}
	return nil
}

func (l *Logger) log(level LogLevel, msg string, fields map[string]string) {
	if levelOrder[level] < levelOrder[l.minLevel] {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	l.checkRotation()

	entry := Entry{
		Timestamp: time.Now().Format(time.RFC3339Nano),
		Level:     string(level),
		Message:   msg,
	}

	if fields != nil {
		entry.Operator = fields["operator"]
		entry.Action = fields["action"]
		entry.Target = fields["target"]
		entry.Result = fields["result"]
		if e, ok := fields["error"]; ok {
			entry.Error = e
		}
	}

	data, _ := json.Marshal(entry)
	data = append(data, '\n')

	n, _ := l.file.Write(data)
	l.fileSize += int64(n)
}

func (l *Logger) Debug(msg string, fields map[string]string) { l.log(LevelDebug, msg, fields) }
func (l *Logger) Info(msg string, fields map[string]string)  { l.log(LevelInfo, msg, fields) }
func (l *Logger) Warn(msg string, fields map[string]string)  { l.log(LevelWarn, msg, fields) }
func (l *Logger) Error(msg string, fields map[string]string) { l.log(LevelError, msg, fields) }

func (l *Logger) Close() {
	if l.file != nil {
		l.file.Close()
	}
}

func Debug(msg string, fields map[string]string) {
	if defaultLogger != nil {
		defaultLogger.Debug(msg, fields)
	}
}

func Info(msg string, fields map[string]string) {
	if defaultLogger != nil {
		defaultLogger.Info(msg, fields)
	}
}

func Warn(msg string, fields map[string]string) {
	if defaultLogger != nil {
		defaultLogger.Warn(msg, fields)
	}
}

func Error(msg string, fields map[string]string) {
	if defaultLogger != nil {
		defaultLogger.Error(msg, fields)
	}
}

func Close() {
	if defaultLogger != nil {
		defaultLogger.Close()
	}
}

func LogAction(operator, action, target, result string) {
	Info(action, map[string]string{
		"operator": operator,
		"action":   action,
		"target":   target,
		"result":   result,
	})
}

type ConsoleWriter struct {
	w io.Writer
}

func NewConsoleWriter() *ConsoleWriter {
	return &ConsoleWriter{w: os.Stdout}
}

func (cw *ConsoleWriter) Write(format string, args ...interface{}) {
	fmt.Fprintf(cw.w, format, args...)
}

func FormatStatus(status string) string {
	colors := map[string]string{
		"待整改": "\033[31m",
		"整改中": "\033[33m",
		"待验收": "\033[34m",
		"已销号": "\033[32m",
	}
	reset := "\033[0m"
	if c, ok := colors[status]; ok {
		return c + status + reset
	}
	return status
}

func FormatRisk(risk string) string {
	colors := map[string]string{
		"高": "\033[31m",
		"中": "\033[33m",
		"低": "\033[32m",
	}
	reset := "\033[0m"
	if c, ok := colors[risk]; ok {
		return c + risk + reset
	}
	return risk
}
