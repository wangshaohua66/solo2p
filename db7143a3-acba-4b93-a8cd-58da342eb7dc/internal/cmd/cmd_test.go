package cmd

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func captureOutput(f func()) string {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	r, w, _ := os.Pipe()
	os.Stdout = w
	os.Stderr = w

	f()

	w.Close()
	os.Stdout = oldStdout
	os.Stderr = oldStderr
	var buf bytes.Buffer
	_, _ = buf.ReadFrom(r)
	return buf.String()
}

func setArgs(args []string) {
	os.Args = append([]string{"sentinel"}, args...)
}

func TestRootCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("root command panicked: %v", r)
		}
	}()

	setArgs([]string{"--help"})
	output := captureOutput(func() {
		_ = rootCmd.Help()
	})
	if !strings.Contains(output, "Sentinel CLI") {
		t.Errorf("expected help output, got: %s", output)
	}
}

func TestRootCommand_Version_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("version command panicked: %v", r)
		}
	}()
	setArgs([]string{"--version"})
	output := captureOutput(func() {
		printVersion()
	})
	if !strings.Contains(output, "Sentinel CLI") {
		t.Errorf("expected version output, got: %s", output)
	}
}

func TestBatchCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("batch command panicked: %v", r)
		}
	}()

	setArgs([]string{"batch", "--help"})
	output := captureOutput(func() {
		_ = batchCmd.Help()
	})
	if !strings.Contains(output, "batch") {
		t.Errorf("expected batch help output")
	}
}

func TestBatchRunCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("batch run command panicked: %v", r)
		}
	}()

	setArgs([]string{"batch", "run", "--help"})
	output := captureOutput(func() {
		_ = batchRunCmd.Help()
	})
	if !strings.Contains(output, "run") {
		t.Errorf("expected batch run help output")
	}
}

func TestBatchStatusCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("batch status command panicked: %v", r)
		}
	}()

	setArgs([]string{"batch", "status", "--help"})
	output := captureOutput(func() {
		_ = batchStatusCmd.Help()
	})
	if !strings.Contains(output, "status") {
		t.Errorf("expected batch status help output")
	}
}

func TestBatchRetryCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("batch retry command panicked: %v", r)
		}
	}()

	setArgs([]string{"batch", "retry", "--help"})
	output := captureOutput(func() {
		_ = batchRetryCmd.Help()
	})
	if !strings.Contains(output, "retry") {
		t.Errorf("expected batch retry help output")
	}
}

func TestConfigCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("config command panicked: %v", r)
		}
	}()

	setArgs([]string{"config", "--help"})
	output := captureOutput(func() {
		_ = configCmd.Help()
	})
	if !strings.Contains(output, "config") {
		t.Errorf("expected config help output")
	}
}

func TestConfigInitCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("config init command panicked: %v", r)
		}
	}()

	setArgs([]string{"config", "init", "--help"})
	output := captureOutput(func() {
		_ = configInitCmd.Help()
	})
	if !strings.Contains(output, "init") {
		t.Errorf("expected config init help output")
	}
}

func TestConfigValidateCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("config validate command panicked: %v", r)
		}
	}()

	setArgs([]string{"config", "validate", "--help"})
	output := captureOutput(func() {
		_ = configValidateCmd.Help()
	})
	if !strings.Contains(output, "validate") {
		t.Errorf("expected config validate help output")
	}
}

func TestConvertCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("convert command panicked: %v", r)
		}
	}()

	setArgs([]string{"convert", "--help"})
	output := captureOutput(func() {
		_ = convertCmd.Help()
	})
	if !strings.Contains(output, "convert") {
		t.Errorf("expected convert help output")
	}
}

func TestConvertCRSCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("convert crs command panicked: %v", r)
		}
	}()

	setArgs([]string{"convert", "crs", "--help"})
	output := captureOutput(func() {
		_ = convertCRSCmd.Help()
	})
	if !strings.Contains(output, "crs") {
		t.Errorf("expected convert crs help output")
	}
}

func TestIndexCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("index command panicked: %v", r)
		}
	}()

	setArgs([]string{"index", "--help"})
	output := captureOutput(func() {
		_ = indexCmd.Help()
	})
	if !strings.Contains(output, "index") {
		t.Errorf("expected index help output")
	}
}

func TestIndexNDVICommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("index ndvi command panicked: %v", r)
		}
	}()

	setArgs([]string{"index", "ndvi", "--help"})
	output := captureOutput(func() {
		_ = ndviCmd.Help()
	})
	if !strings.Contains(output, "NDVI") && !strings.Contains(output, "ndvi") {
		t.Errorf("expected ndvi help output")
	}
}

func TestIndexEVICommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("index evi command panicked: %v", r)
		}
	}()

	setArgs([]string{"index", "evi", "--help"})
	output := captureOutput(func() {
		_ = eviCmd.Help()
	})
	if !strings.Contains(output, "EVI") && !strings.Contains(output, "evi") {
		t.Errorf("expected evi help output")
	}
}

func TestIndexSAVICommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("index savi command panicked: %v", r)
		}
	}()

	setArgs([]string{"index", "savi", "--help"})
	output := captureOutput(func() {
		_ = saviCmd.Help()
	})
	if !strings.Contains(output, "SAVI") && !strings.Contains(output, "savi") {
		t.Errorf("expected savi help output")
	}
}

func TestInspectCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("inspect command panicked: %v", r)
		}
	}()

	setArgs([]string{"inspect", "--help"})
	output := captureOutput(func() {
		_ = inspectCmd.Help()
	})
	if !strings.Contains(output, "inspect") {
		t.Errorf("expected inspect help output")
	}
}

func TestInspectTileCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("inspect tile command panicked: %v", r)
		}
	}()

	setArgs([]string{"inspect", "tile", "--help"})
	output := captureOutput(func() {
		_ = inspectTileCmd.Help()
	})
	if !strings.Contains(output, "tile") {
		t.Errorf("expected inspect tile help output")
	}
}

func TestDaemonCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("daemon command panicked: %v", r)
		}
	}()

	setArgs([]string{"daemon", "--help"})
	output := captureOutput(func() {
		_ = daemonCmd.Help()
	})
	if !strings.Contains(output, "daemon") {
		t.Errorf("expected daemon help output")
	}
}

func TestDaemonStartCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("daemon start command panicked: %v", r)
		}
	}()

	setArgs([]string{"daemon", "start", "--help"})
	output := captureOutput(func() {
		_ = daemonStartCmd.Help()
	})
	if !strings.Contains(output, "start") {
		t.Errorf("expected daemon start help output")
	}
}

func TestDaemonStopCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("daemon stop command panicked: %v", r)
		}
	}()

	setArgs([]string{"daemon", "stop", "--help"})
	output := captureOutput(func() {
		_ = daemonStopCmd.Help()
	})
	if !strings.Contains(output, "stop") {
		t.Errorf("expected daemon stop help output")
	}
}

func TestDaemonStatusCommand_NoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("daemon status command panicked: %v", r)
		}
	}()

	setArgs([]string{"daemon", "status", "--help"})
	output := captureOutput(func() {
		_ = daemonStatusCmd.Help()
	})
	if !strings.Contains(output, "status") {
		t.Errorf("expected daemon status help output")
	}
}

func TestConfigInitCommand_Generate_NoPanic(t *testing.T) {
	tmpDir := t.TempDir()
	outputPath := filepath.Join(tmpDir, "test_config.yaml")

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("config init generate panicked: %v", r)
		}
	}()

	configInitOutput = outputPath
	configInitSensor = "all"
	configInitForce = true

	err := runConfigInit()
	if err != nil {
		t.Fatalf("config init failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Fatalf("config file not created at %s", outputPath)
	}

	data, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("cannot read generated config: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("generated config is empty")
	}
	if !strings.Contains(string(data), "global:") {
		t.Error("generated config missing 'global:' section")
	}
	if !strings.Contains(string(data), "crs:") {
		t.Error("generated config missing 'crs:' section")
	}
}

func TestValidateBatchRunFlags_InvalidTaskType(t *testing.T) {
	batchTaskType = "invalid"
	batchPriority = 5
	batchMaxRetries = 3

	tmpDir := t.TempDir()
	batchInputPath = tmpDir

	err := validateBatchRunFlags()
	if err == nil {
		t.Fatal("expected error for invalid task type")
	}
}

func TestValidateConvertCRSFlags_SameEPSG(t *testing.T) {
	convertSourceEPSG = 4326
	convertTargetEPSG = 4326

	tmpDir := t.TempDir()
	convertInputPath = tmpDir
	convertChunkSizeMB = 64

	err := validateConvertCRSFlags()
	if err == nil {
		t.Fatal("expected error for same source/target EPSG")
	}
}

func TestParseLogLevel(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"debug", "debug"},
		{"info", "info"},
		{"warn", "warn"},
		{"warning", "warn"},
		{"error", "error"},
		{"DEBUG", "debug"},
		{"unknown", "info"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := parseLogLevel(tt.input)
			if got.String() != tt.want {
				t.Errorf("parseLogLevel(%q) = %v, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestParseSevenParams_Invalid(t *testing.T) {
	_, err := parseSevenParams("1,2,3")
	if err == nil {
		t.Fatal("expected error for wrong number of params")
	}

	_, err = parseSevenParams("a,b,c,d,e,f,g")
	if err == nil {
		t.Fatal("expected error for non-numeric params")
	}
}

func TestParseSevenParams_Valid(t *testing.T) {
	params, err := parseSevenParams("-13.5,-129.5,-76.8,0,0,0,0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if params.DX != -13.5 {
		t.Errorf("DX = %v, want -13.5", params.DX)
	}
	if params.DY != -129.5 {
		t.Errorf("DY = %v, want -129.5", params.DY)
	}
}

func TestValidateIndexFlags_InvalidSensor(t *testing.T) {
	indexSensor = "invalid"
	indexChunkSizeMB = 64

	tmpDir := t.TempDir()
	indexInputPath = tmpDir

	err := validateIndexFlags("ndvi")
	if err == nil {
		t.Fatal("expected error for invalid sensor")
	}
}

func TestValidateInspectTileFlags_Directory(t *testing.T) {
	tmpDir := t.TempDir()
	inspectInputPath = tmpDir
	inspectFormat = "table"

	err := validateInspectTileFlags()
	if err == nil {
		t.Fatal("expected error for directory input")
	}
}
