package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"cloudsync/internal/config"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorPurple = "\033[35m"
	colorCyan   = "\033[36m"
	colorGray   = "\033[37m"
)

type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

var levelNames = map[Level]string{
	LevelDebug: "DEBUG",
	LevelInfo:  "INFO",
	LevelWarn:  "WARN",
	LevelError: "ERROR",
}

var levelColors = map[Level]string{
	LevelDebug: colorCyan,
	LevelInfo:  colorGreen,
	LevelWarn:  colorYellow,
	LevelError: colorRed,
}

type Logger struct {
	mu       sync.Mutex
	level    Level
	logDir   string
	file     *os.File
	fileName string
	console  bool
	verbose  bool
	quiet    bool
	maxSize  int64
	maxBackups int
	maxAge   int
	compress bool
}

var (
	defaultLogger *Logger
	once         sync.Once
)

func Init(cfg *config.LoggerConfig, verbose, quiet bool) error {
	var err error
	once.Do(func() {
		defaultLogger, err = newLogger(cfg, verbose, quiet)
	})
	return err
}

func newLogger(cfg *config.LoggerConfig, verbose, quiet bool) (*Logger, error) {
	l := &Logger{
		level:      parseLevel(cfg.Level),
		logDir:     cfg.LogDir,
		console:    true,
		verbose:    verbose,
		quiet:      quiet,
		maxSize:    int64(cfg.MaxSizeMB) * 1024 * 1024,
		maxBackups: cfg.MaxBackups,
		maxAge:     cfg.MaxAgeDays,
		compress:   cfg.Compress,
	}

	if err := l.rotateIfNeeded(); err != nil {
		return nil, err
	}

	return l, nil
}

func parseLevel(level config.LogLevel) Level {
	switch level {
	case config.LogDebug:
		return LevelDebug
	case config.LogInfo:
		return LevelInfo
	case config.LogWarn:
		return LevelWarn
	case config.LogError:
		return LevelError
	default:
		return LevelInfo
	}
}

func (l *Logger) SetLevel(level Level) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

func (l *Logger) GetLevel() Level {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.level
}

func (l *Logger) shouldLog(level Level) bool {
	if l.quiet && level < LevelError {
		return false
	}
	if l.verbose && level >= LevelDebug {
		return true
	}
	return level >= l.level
}

func (l *Logger) log(level Level, format string, args ...interface{}) {
	if !l.shouldLog(level) {
		return
	}

	now := time.Now()
	caller := getCaller(3)
	msg := fmt.Sprintf(format, args...)

	l.mu.Lock()
	defer l.mu.Unlock()

	fileEntry := fmt.Sprintf("[%s] [%s] [%s] %s\n",
		now.Format("2006-01-02 15:04:05.000"),
		levelNames[level],
		caller,
		msg,
	)

	if l.file != nil {
		if err := l.rotateIfNeededLocked(); err != nil {
			log.Printf("failed to rotate log: %v", err)
		}
		if _, err := l.file.WriteString(fileEntry); err != nil {
			log.Printf("failed to write log file: %v", err)
		}
	}

	if l.console && !l.quiet {
		color := levelColors[level]
		consoleEntry := fmt.Sprintf("%s[%s]%s %s[%s]%s %s%s%s\n",
			colorGray,
			now.Format("15:04:05"),
			colorReset,
			color,
			levelNames[level],
			colorReset,
			msg,
			colorReset,
			"",
		)
		if l.verbose {
			consoleEntry = fmt.Sprintf("%s[%s]%s %s[%s]%s %s[%s]%s %s%s%s\n",
				colorGray,
				now.Format("2006-01-02 15:04:05.000"),
				colorReset,
				color,
				levelNames[level],
				colorReset,
				colorPurple,
				caller,
				colorReset,
				msg,
				colorReset,
				"",
			)
		}
		os.Stdout.WriteString(consoleEntry)
	}
}

func getCaller(skip int) string {
	_, file, line, ok := runtime.Caller(skip)
	if !ok {
		return "???:0"
	}
	short := file
	for i := len(file) - 1; i > 0; i-- {
		if file[i] == '/' {
			short = file[i+1:]
			break
		}
	}
	idx := strings.LastIndex(short, ".go")
	if idx > 0 {
		short = short[:idx+3]
	}
	return fmt.Sprintf("%s:%d", short, line)
}

func (l *Logger) rotateIfNeeded() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.rotateIfNeededLocked()
}

func (l *Logger) rotateIfNeededLocked() error {
	dateStr := time.Now().Format("2006-01-02")
	newFileName := filepath.Join(l.logDir, fmt.Sprintf("cloudsync-%s.log", dateStr))

	if l.fileName == newFileName && l.file != nil {
		info, err := l.file.Stat()
		if err == nil && info.Size() < l.maxSize {
			return nil
		}
	}

	if l.file != nil {
		l.file.Close()
		l.backupOld()
		l.file = nil
	}

	if err := os.MkdirAll(l.logDir, 0755); err != nil {
		return fmt.Errorf("create log dir: %w", err)
	}

	f, err := os.OpenFile(newFileName, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}

	l.file = f
	l.fileName = newFileName
	return nil
}

func (l *Logger) backupOld() {
	matches, _ := filepath.Glob(filepath.Join(l.logDir, "cloudsync-*.log"))
	if len(matches) > l.maxBackups {
		for i := 0; i < len(matches)-l.maxBackups; i++ {
			os.Remove(matches[i])
		}
	}

	cutoff := time.Now().AddDate(0, 0, -l.maxAge)
	for _, m := range matches {
		info, err := os.Stat(m)
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(m)
		}
	}
}

func (l *Logger) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.file != nil {
		l.file.Close()
		l.file = nil
	}
}

func GetWriter(level Level) io.Writer {
	return &logWriter{level: level}
}

type logWriter struct {
	level Level
}

func (w *logWriter) Write(p []byte) (n int, err error) {
	if defaultLogger != nil {
		defaultLogger.log(w.level, "%s", strings.TrimSpace(string(p)))
	}
	return len(p), nil
}

func Debug(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LevelDebug, format, args...)
	}
}

func Info(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LevelInfo, format, args...)
	}
}

func Warn(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LevelWarn, format, args...)
	}
}

func Error(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LevelError, format, args...)
	}
}

func Debugf(format string, args ...interface{}) { Debug(format, args...) }
func Infof(format string, args ...interface{})  { Info(format, args...) }
func Warnf(format string, args ...interface{})  { Warn(format, args...) }
func Errorf(format string, args ...interface{}) { Error(format, args...) }

func SetConsole(enabled bool) {
	if defaultLogger != nil {
		defaultLogger.mu.Lock()
		defer defaultLogger.mu.Unlock()
		defaultLogger.console = enabled
	}
}

func SetVerbose(enabled bool) {
	if defaultLogger != nil {
		defaultLogger.mu.Lock()
		defer defaultLogger.mu.Unlock()
		defaultLogger.verbose = enabled
	}
}

func SetQuiet(enabled bool) {
	if defaultLogger != nil {
		defaultLogger.mu.Lock()
		defer defaultLogger.mu.Unlock()
		defaultLogger.quiet = enabled
	}
}

func Close() {
	if defaultLogger != nil {
		defaultLogger.Close()
	}
}
