package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"govresource-crawler/config"
)

type DailyRotateHook struct {
	filePath    string
	maxAgeDays  int
	currentFile *os.File
	currentDate string
	mu          sync.Mutex
	formatter   logrus.Formatter
}

func NewDailyRotateHook(filePath string, maxAgeDays int, formatter logrus.Formatter) *DailyRotateHook {
	return &DailyRotateHook{
		filePath:   filePath,
		maxAgeDays: maxAgeDays,
		formatter:  formatter,
	}
}

func (h *DailyRotateHook) Levels() []logrus.Level {
	return logrus.AllLevels
}

func (h *DailyRotateHook) Fire(entry *logrus.Entry) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	today := time.Now().Format("2006-01-02")
	if h.currentDate != today || h.currentFile == nil {
		if err := h.rotate(today); err != nil {
			return err
		}
	}

	line, err := h.formatter.Format(entry)
	if err != nil {
		return err
	}
	_, err = h.currentFile.Write(line)
	return err
}

func (h *DailyRotateHook) rotate(today string) error {
	if h.currentFile != nil {
		h.currentFile.Close()
		h.currentFile = nil
	}

	dir := filepath.Dir(h.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create log dir: %w", err)
	}

	ext := filepath.Ext(h.filePath)
	base := strings.TrimSuffix(filepath.Base(h.filePath), ext)
	newPath := filepath.Join(dir, fmt.Sprintf("%s-%s%s", base, today, ext))

	f, err := os.OpenFile(newPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}

	h.currentFile = f
	h.currentDate = today

	go h.cleanupOldLogs()

	return nil
}

func (h *DailyRotateHook) cleanupOldLogs() {
	if h.maxAgeDays <= 0 {
		return
	}
	dir := filepath.Dir(h.filePath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	cutoff := time.Now().AddDate(0, 0, -h.maxAgeDays)
	var oldFiles []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			oldFiles = append(oldFiles, filepath.Join(dir, e.Name()))
		}
	}
	sort.Strings(oldFiles)
	for _, f := range oldFiles {
		os.Remove(f)
	}
}

func (h *DailyRotateHook) Close() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.currentFile != nil {
		return h.currentFile.Close()
	}
	return nil
}

type ColoredFormatter struct {
	logrus.TextFormatter
}

func (f *ColoredFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	levelColor := "\033[0m"
	switch entry.Level {
	case logrus.InfoLevel:
		levelColor = "\033[32m"
	case logrus.WarnLevel:
		levelColor = "\033[33m"
	case logrus.ErrorLevel, logrus.FatalLevel, logrus.PanicLevel:
		levelColor = "\033[31m"
	case logrus.DebugLevel, logrus.TraceLevel:
		levelColor = "\033[36m"
	}
	reset := "\033[0m"

	timestamp := entry.Time.Format("2006-01-02 15:04:05")
	level := strings.ToUpper(entry.Level.String())

	var fieldsStr string
	if len(entry.Data) > 0 {
		var parts []string
		for k, v := range entry.Data {
			parts = append(parts, fmt.Sprintf("%s=%v", k, v))
		}
		sort.Strings(parts)
		fieldsStr = " " + strings.Join(parts, " ")
	}

	msg := strings.TrimSuffix(entry.Message, "\n")
	return []byte(fmt.Sprintf("%s[%s] %s%s%s%s%s\n",
		levelColor, timestamp, level, fieldsStr, reset, " ", msg,
	)), nil
}

type PlainFormatter struct {
	logrus.TextFormatter
}

func (f *PlainFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	timestamp := entry.Time.Format("2006-01-02 15:04:05")
	level := strings.ToUpper(entry.Level.String())

	var fieldsStr string
	if len(entry.Data) > 0 {
		var parts []string
		for k, v := range entry.Data {
			parts = append(parts, fmt.Sprintf("%s=%v", k, v))
		}
		sort.Strings(parts)
		fieldsStr = " " + strings.Join(parts, " ")
	}

	msg := strings.TrimSuffix(entry.Message, "\n")
	if entry.HasCaller() {
		return []byte(fmt.Sprintf("[%s] %s %s:%d%s %s\n",
			timestamp, level,
			filepath.Base(entry.Caller.File), entry.Caller.Line,
			fieldsStr, msg,
		)), nil
	}
	return []byte(fmt.Sprintf("[%s] %s%s %s\n",
		timestamp, level, fieldsStr, msg,
	)), nil
}

var (
	Log      *logrus.Logger
	rotateHook *DailyRotateHook
	quiet    bool
	verbose  bool
)

func Init(cfg *config.LogConfig, quietMode, verboseMode bool) error {
	quiet = quietMode
	verbose = verboseMode

	Log = logrus.New()
	Log.SetReportCaller(verboseMode)

	level, err := logrus.ParseLevel(strings.ToLower(cfg.Level))
	if err != nil {
		level = logrus.InfoLevel
	}
	if verboseMode {
		level = logrus.DebugLevel
	}
	Log.SetLevel(level)

	if quietMode {
		Log.SetOutput(io.Discard)
	} else {
		Log.SetOutput(os.Stdout)
		Log.SetFormatter(&ColoredFormatter{
			TextFormatter: logrus.TextFormatter{
				FullTimestamp: true,
			},
		})
	}

	if cfg.FilePath != "" {
		fileFormatter := &PlainFormatter{}
		rotateHook = NewDailyRotateHook(cfg.FilePath, cfg.MaxAgeDays, fileFormatter)
		Log.AddHook(rotateHook)
	}

	return nil
}

func Close() {
	if rotateHook != nil {
		rotateHook.Close()
	}
}

func Debugf(format string, args ...interface{}) {
	Log.Debugf(format, args...)
}

func Infof(format string, args ...interface{}) {
	Log.Infof(format, args...)
}

func Printf(format string, args ...interface{}) {
	Log.Infof(format, args...)
}

func Warnf(format string, args ...interface{}) {
	Log.Warnf(format, args...)
}

func Warningf(format string, args ...interface{}) {
	Log.Warnf(format, args...)
}

func Errorf(format string, args ...interface{}) {
	Log.Errorf(format, args...)
}

func Fatalf(format string, args ...interface{}) {
	Log.Fatalf(format, args...)
}

func Panicf(format string, args ...interface{}) {
	Log.Panicf(format, args...)
}

func Debug(args ...interface{}) {
	Log.Debug(args...)
}

func Info(args ...interface{}) {
	Log.Info(args...)
}

func Warn(args ...interface{}) {
	Log.Warn(args...)
}

func Error(args ...interface{}) {
	Log.Error(args...)
}

func Fatal(args ...interface{}) {
	Log.Fatal(args...)
}

func WithField(key string, value interface{}) *logrus.Entry {
	return Log.WithField(key, value)
}

func WithFields(fields logrus.Fields) *logrus.Entry {
	return Log.WithFields(fields)
}

func WithError(err error) *logrus.Entry {
	return Log.WithError(err)
}

func IsVerbose() bool {
	return verbose
}

func IsQuiet() bool {
	return quiet
}
