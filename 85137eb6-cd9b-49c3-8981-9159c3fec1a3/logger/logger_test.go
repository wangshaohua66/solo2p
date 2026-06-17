package logger

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetLogger(t *testing.T) {
	ResetForTest()
	l := Get()
	if l == nil {
		t.Fatal("Get should not return nil")
	}
	l2 := Get()
	if l != l2 {
		t.Error("Get should return singleton instance")
	}
}

func TestInitLogger(t *testing.T) {
	ResetForTest()
	dir := t.TempDir()
	l := Init("DEBUG", dir, 7)
	if l == nil {
		t.Fatal("Init should not return nil")
	}
	if l.level != LevelDebug {
		t.Errorf("Expected level DEBUG (%d), got %d", LevelDebug, l.level)
	}
	if l.logDir != dir {
		t.Errorf("Expected logDir %s, got %s", dir, l.logDir)
	}
	if l.retentionDays != 7 {
		t.Errorf("Expected retentionDays 7, got %d", l.retentionDays)
	}
}

func TestParseLevel(t *testing.T) {
	tests := []struct {
		input    string
		expected Level
	}{
		{"debug", LevelDebug},
		{"DEBUG", LevelDebug},
		{" Debug ", LevelDebug},
		{"info", LevelInfo},
		{"INFO", LevelInfo},
		{"warn", LevelWarn},
		{"warning", LevelWarn},
		{"WARN", LevelWarn},
		{"error", LevelError},
		{"ERROR", LevelError},
		{"fatal", LevelFatal},
		{"FATAL", LevelFatal},
		{"unknown", LevelInfo},
		{"", LevelInfo},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := parseLevel(tt.input)
			if result != tt.expected {
				t.Errorf("parseLevel(%q) = %d, want %d", tt.input, result, tt.expected)
			}
		})
	}
}

func TestLevelName(t *testing.T) {
	ResetForTest()
	l := Init("DEBUG", t.TempDir(), 7)
	tests := []struct {
		level    Level
		expected string
	}{
		{LevelDebug, "DEBUG"},
		{LevelInfo, "INFO "},
		{LevelWarn, "WARN "},
		{LevelError, "ERROR"},
		{LevelFatal, "FATAL"},
	}
	for _, tt := range tests {
		result := l.levelName(tt.level)
		if result != tt.expected {
			t.Errorf("levelName(%d) = %q, want %q", tt.level, result, tt.expected)
		}
	}
}

func TestLevelColor(t *testing.T) {
	ResetForTest()
	l := Init("DEBUG", t.TempDir(), 7)
	colors := []Level{LevelDebug, LevelInfo, LevelWarn, LevelError, LevelFatal}
	for _, c := range colors {
		if l.levelColor(c) == "" {
			t.Errorf("levelColor(%d) should not be empty", c)
		}
	}
}

func TestLogMethods(t *testing.T) {
	ResetForTest()
	dir := t.TempDir()
	l := Init("DEBUG", dir, 7)

	l.Debug("test debug %d", 1)
	l.Info("test info %s", "hello")
	l.Warn("test warn")
	l.Error("test error")

	defer func() {
		if r := recover(); r != nil {
		}
	}()
}

func TestPackageLevelLogFunctions(t *testing.T) {
	ResetForTest()
	dir := t.TempDir()
	Init("DEBUG", dir, 7)

	Debug("package debug %d", 1)
	Info("package info %s", "hello")
	Warn("package warn")
	Error("package error")

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}

	if len(entries) == 0 {
		t.Error("Should have created at least one log file")
	}

	foundLog := false
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) == ".log" {
			foundLog = true
			break
		}
	}
	if !foundLog {
		t.Error("Should have created .log file")
	}
}

func TestLogDirCreation(t *testing.T) {
	ResetForTest()
	dir := filepath.Join(t.TempDir(), "subdir", "logs")
	_, err := os.Stat(dir)
	if !os.IsNotExist(err) {
		t.Fatal("Directory should not exist yet")
	}

	Init("INFO", dir, 7)

	_, err = os.Stat(dir)
	if err != nil {
		t.Errorf("Log directory should be created: %v", err)
	}
}

func TestLoggerSetLevel(t *testing.T) {
	ResetForTest()
	l := Init("INFO", t.TempDir(), 7)
	if l.level != LevelInfo {
		t.Errorf("Initial level should be INFO, got %d", l.level)
	}
	l.SetLevel(LevelError)
	if l.level != LevelError {
		t.Errorf("Level should be ERROR after SetLevel, got %d", l.level)
	}
}

func TestLoggerClose(t *testing.T) {
	ResetForTest()
	l := Init("INFO", t.TempDir(), 7)
	l.Close()
}
