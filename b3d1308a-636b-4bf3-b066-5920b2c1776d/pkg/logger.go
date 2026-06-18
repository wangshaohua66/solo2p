package pkg

import (
	"context"
	"os"
	"path/filepath"
	"sync"

	"smart-lighting-api/config"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

type contextKey string

const LoggerCtxKey contextKey = "logger"

var (
	logger     *zap.Logger
	sugar      *zap.SugaredLogger
	loggerOnce sync.Once
)

func InitLogger() {
	loggerOnce.Do(func() {
		cfg := config.AppConf.Log
		_ = os.MkdirAll(filepath.Dir(cfg.Filename), 0755)

		fileWriter := &lumberjack.Logger{
			Filename:   cfg.Filename,
			MaxSize:    cfg.MaxSize,
			MaxBackups: cfg.MaxBackups,
			MaxAge:     cfg.MaxAge,
			Compress:   cfg.Compress,
		}

		encoderCfg := zapcore.EncoderConfig{
			TimeKey:        "time",
			LevelKey:       "level",
			NameKey:        "logger",
			CallerKey:      "caller",
			MessageKey:     "msg",
			StacktraceKey:  "stacktrace",
			LineEnding:     zapcore.DefaultLineEnding,
			EncodeLevel:    zapcore.CapitalLevelEncoder,
			EncodeTime:     zapcore.ISO8601TimeEncoder,
			EncodeDuration: zapcore.SecondsDurationEncoder,
			EncodeCaller:   zapcore.ShortCallerEncoder,
		}

		consoleEncoder := zapcore.NewConsoleEncoder(encoderCfg)
		fileEncoder := zapcore.NewJSONEncoder(encoderCfg)

		level := zap.InfoLevel
		switch cfg.Level {
		case "debug":
			level = zap.DebugLevel
		case "warn":
			level = zap.WarnLevel
		case "error":
			level = zap.ErrorLevel
		}

		core := zapcore.NewTee(
			zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), level),
			zapcore.NewCore(fileEncoder, zapcore.AddSync(fileWriter), level),
		)

		logger = zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1), zap.AddStacktrace(zap.DPanicLevel))
		sugar = logger.Sugar()
	})
}

func GetLogger() *zap.Logger {
	if logger == nil {
		InitLogger()
	}
	return logger
}

func GetSugar() *zap.SugaredLogger {
	if sugar == nil {
		InitLogger()
	}
	return sugar
}

func WithRequestID(ctx context.Context, requestID string) context.Context {
	l := GetLogger().With(zap.String("request_id", requestID))
	return context.WithValue(ctx, LoggerCtxKey, l)
}

func FromContext(ctx context.Context) *zap.Logger {
	if ctx == nil {
		return GetLogger()
	}
	if l, ok := ctx.Value(LoggerCtxKey).(*zap.Logger); ok && l != nil {
		return l
	}
	return GetLogger()
}

func SyncLogger() {
	if logger != nil {
		_ = logger.Sync()
	}
	if sugar != nil {
		_ = sugar.Sync()
	}
}

func Debug(ctx context.Context, msg string, fields ...zap.Field) {
	FromContext(ctx).Debug(msg, fields...)
}

func Info(ctx context.Context, msg string, fields ...zap.Field) {
	FromContext(ctx).Info(msg, fields...)
}

func Warn(ctx context.Context, msg string, fields ...zap.Field) {
	FromContext(ctx).Warn(msg, fields...)
}

func Error(ctx context.Context, msg string, fields ...zap.Field) {
	FromContext(ctx).Error(msg, fields...)
}

func Fatal(ctx context.Context, msg string, fields ...zap.Field) {
	FromContext(ctx).Fatal(msg, fields...)
}

func Debugf(ctx context.Context, format string, args ...interface{}) {
	FromContext(ctx).Sugar().Debugf(format, args...)
}

func Infof(ctx context.Context, format string, args ...interface{}) {
	FromContext(ctx).Sugar().Infof(format, args...)
}

func Warnf(ctx context.Context, format string, args ...interface{}) {
	FromContext(ctx).Sugar().Warnf(format, args...)
}

func Errorf(ctx context.Context, format string, args ...interface{}) {
	FromContext(ctx).Sugar().Errorf(format, args...)
}
