package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
	LevelFatal
)

type Color string

const (
	ColorReset  Color = "\033[0m"
	ColorRed    Color = "\033[31m"
	ColorGreen  Color = "\033[32m"
	ColorYellow Color = "\033[33m"
	ColorBlue   Color = "\033[34m"
	ColorPurple Color = "\033[35m"
	ColorCyan   Color = "\033[36m"
	ColorGray   Color = "\033[37m"
	ColorBold   Color = "\033[1m"
)

type Logger struct {
	level         Level
	logDir        string
	retentionDays int
	mu            sync.Mutex
	file          *os.File
	currentDate   string
	consoleOutput bool
}

var (
	defaultLogger *Logger
	once          sync.Once
)

func Init(levelStr, logDir string, retentionDays int) *Logger {
	once.Do(func() {
		level := parseLevel(levelStr)
		defaultLogger = &Logger{
			level:         level,
			logDir:        logDir,
			retentionDays: retentionDays,
			consoleOutput: true,
		}
		if err := defaultLogger.ensureDir(); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create log directory: %v\n", err)
		}
		defaultLogger.cleanOldLogs()
	})
	return defaultLogger
}

func Get() *Logger {
	if defaultLogger == nil {
		Init("info", "./logs", 30)
	}
	return defaultLogger
}

func parseLevel(s string) Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return LevelDebug
	case "warn", "warning":
		return LevelWarn
	case "error":
		return LevelError
	case "fatal":
		return LevelFatal
	default:
		return LevelInfo
	}
}

func (l *Logger) levelName(level Level) string {
	switch level {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO "
	case LevelWarn:
		return "WARN "
	case LevelError:
		return "ERROR"
	case LevelFatal:
		return "FATAL"
	default:
		return "?????"
	}
}

func (l *Logger) levelColor(level Level) Color {
	switch level {
	case LevelDebug:
		return ColorGray
	case LevelInfo:
		return ColorGreen
	case LevelWarn:
		return ColorYellow
	case LevelError:
		return ColorRed
	case LevelFatal:
		return Color(ColorBold) + ColorRed
	default:
		return ColorReset
	}
}

func (l *Logger) ensureDir() error {
	if l.logDir == "" {
		return nil
	}
	return os.MkdirAll(l.logDir, 0755)
}

func (l *Logger) currentLogFile() string {
	date := time.Now().Format("2006-01-02")
	return filepath.Join(l.logDir, fmt.Sprintf("app_%s.log", date))
}

func (l *Logger) rotateIfNeeded() error {
	date := time.Now().Format("2006-01-02")
	if date == l.currentDate && l.file != nil {
		return nil
	}

	if l.file != nil {
		l.file.Close()
		l.file = nil
	}

	l.currentDate = date
	if l.logDir == "" {
		return nil
	}

	f, err := os.OpenFile(l.currentLogFile(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	l.file = f

	go l.cleanOldLogs()
	return nil
}

func (l *Logger) cleanOldLogs() {
	if l.logDir == "" || l.retentionDays <= 0 {
		return
	}

	cutoff := time.Now().AddDate(0, 0, -l.retentionDays)
	entries, err := os.ReadDir(l.logDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, "app_") || !strings.HasSuffix(name, ".log") {
			continue
		}

		dateStr := strings.TrimPrefix(strings.TrimSuffix(name, ".log"), "app_")
		fileDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		if fileDate.Before(cutoff) {
			os.Remove(filepath.Join(l.logDir, name))
		}
	}
}

func (l *Logger) log(level Level, format string, args ...interface{}) {
	if level < l.level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	timestamp := now.Format("2006-01-02 15:04:05.000")

	_, file, line, ok := runtime.Caller(2)
	if !ok {
		file = "???"
		line = 0
	}
	if idx := strings.LastIndex(file, string(os.PathSeparator)); idx >= 0 {
		file = file[idx+1:]
	}

	msg := fmt.Sprintf(format, args...)
	logLine := fmt.Sprintf("[%s] [%s] [%s:%d] %s\n",
		timestamp, l.levelName(level), file, line, msg)

	if l.consoleOutput {
		colorLine := fmt.Sprintf("%s[%s] [%s]%s [%s:%d] %s\n",
			l.levelColor(level), timestamp, l.levelName(level),
			ColorReset, file, line, msg)
		writer := os.Stdout
		if level >= LevelError {
			writer = os.Stderr
		}
		io.WriteString(writer, colorLine)
	}

	if err := l.rotateIfNeeded(); err == nil && l.file != nil {
		io.WriteString(l.file, logLine)
	}
}

func (l *Logger) SetLevel(level Level) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

func (l *Logger) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.file != nil {
		l.file.Close()
		l.file = nil
	}
}

func Debug(format string, args ...interface{}) {
	Get().log(LevelDebug, format, args...)
}

func Info(format string, args ...interface{}) {
	Get().log(LevelInfo, format, args...)
}

func Warn(format string, args ...interface{}) {
	Get().log(LevelWarn, format, args...)
}

func Error(format string, args ...interface{}) {
	Get().log(LevelError, format, args...)
}

func Fatal(format string, args ...interface{}) {
	Get().log(LevelFatal, format, args...)
	os.Exit(1)
}
