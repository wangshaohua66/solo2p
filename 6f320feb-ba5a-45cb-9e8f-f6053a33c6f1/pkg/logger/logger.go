package logger

import (
	"equipment-trading-platform/internal/config"
	"os"
	"path/filepath"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

var (
	globalLogger *zap.Logger
	sugarLogger  *zap.SugaredLogger
)

func Init(cfg *config.LogConfig) {
	if err := os.MkdirAll(filepath.Dir(cfg.Filename), 0755); err != nil {
		panic("create log dir failed: " + err.Error())
	}

	writer := &lumberjack.Logger{
		Filename:   cfg.Filename,
		MaxSize:    cfg.MaxSize,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAge,
		Compress:   cfg.Compress,
	}

	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	level := zapcore.InfoLevel
	switch cfg.Level {
	case "debug":
		level = zapcore.DebugLevel
	case "warn":
		level = zapcore.WarnLevel
	case "error":
		level = zapcore.ErrorLevel
	}

	fileWriter := zapcore.AddSync(writer)
	consoleWriter := zapcore.AddSync(os.Stdout)

	core := zapcore.NewTee(
		zapcore.NewCore(zapcore.NewJSONEncoder(encoderConfig), fileWriter, level),
		zapcore.NewCore(zapcore.NewConsoleEncoder(encoderConfig), consoleWriter, level),
	)

	globalLogger = zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))
	sugarLogger = globalLogger.Sugar()
}

func GetLogger() *zap.Logger {
	if globalLogger == nil {
		globalLogger, _ = zap.NewProduction()
	}
	return globalLogger
}

func GetSugar() *zap.SugaredLogger {
	if sugarLogger == nil {
		sugarLogger = GetLogger().Sugar()
	}
	return sugarLogger
}

func Debug(args ...interface{}) {
	GetSugar().Debug(args...)
}

func Debugf(format string, args ...interface{}) {
	GetSugar().Debugf(format, args...)
}

func Info(args ...interface{}) {
	GetSugar().Info(args...)
}

func Infof(format string, args ...interface{}) {
	GetSugar().Infof(format, args...)
}

func Warn(args ...interface{}) {
	GetSugar().Warn(args...)
}

func Warnf(format string, args ...interface{}) {
	GetSugar().Warnf(format, args...)
}

func Error(args ...interface{}) {
	GetSugar().Error(args...)
}

func Errorf(format string, args ...interface{}) {
	GetSugar().Errorf(format, args...)
}

func Fatal(args ...interface{}) {
	GetSugar().Fatal(args...)
}

func Fatalf(format string, args ...interface{}) {
	GetSugar().Fatalf(format, args...)
}

func Sync() {
	if globalLogger != nil {
		_ = globalLogger.Sync()
	}
}
