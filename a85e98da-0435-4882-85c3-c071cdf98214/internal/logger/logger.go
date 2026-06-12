package logger

import (
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

var (
	Logger *zap.Logger
	Sugar  *zap.SugaredLogger
	Error  *zap.Logger
)

func Init(logPath string) error {
	if err := os.MkdirAll(logPath, 0755); err != nil {
		return err
	}

	trackWriter := &lumberjack.Logger{
		Filename:   filepath.Join(logPath, "track.log"),
		MaxSize:    100,
		MaxBackups: 30,
		MaxAge:     30,
		Compress:   true,
	}

	errorWriter := &lumberjack.Logger{
		Filename:   filepath.Join(logPath, "error.log"),
		MaxSize:    100,
		MaxBackups: 30,
		MaxAge:     30,
		Compress:   true,
	}

	consoleWriter := zapcore.Lock(os.Stderr)

	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	jsonEncoder := zapcore.NewJSONEncoder(encoderConfig)
	consoleEncoder := zapcore.NewConsoleEncoder(encoderConfig)

	trackCore := zapcore.NewTee(
		zapcore.NewCore(jsonEncoder, zapcore.AddSync(trackWriter), zap.InfoLevel),
		zapcore.NewCore(consoleEncoder, consoleWriter, zap.InfoLevel),
	)

	errorCore := zapcore.NewCore(jsonEncoder, zapcore.AddSync(errorWriter), zap.ErrorLevel)

	Logger = zap.New(trackCore, zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel))
	Sugar = Logger.Sugar()
	Error = zap.New(errorCore, zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel))

	return nil
}

func Sync() {
	if Logger != nil {
		_ = Logger.Sync()
	}
	if Error != nil {
		_ = Error.Sync()
	}
}

func WithCourt(courtID string) *zap.Logger {
	return Logger.With(zap.String("court_id", courtID))
}

func LogCrawlResult(courtID string, httpStatus int, parsedCount int, duration time.Duration, err error) {
	fields := []zap.Field{
		zap.String("court_id", courtID),
		zap.Int("http_status", httpStatus),
		zap.Int("parsed_count", parsedCount),
		zap.Duration("duration", duration),
		zap.Time("timestamp", time.Now()),
	}
	if err != nil {
		fields = append(fields, zap.Error(err))
		Error.With(fields...).Error("crawl failed")
		return
	}
	Logger.With(fields...).Info("crawl success")
}
