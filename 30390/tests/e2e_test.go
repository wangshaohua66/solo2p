package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gitmon/gitmon/internal/config"
)

func checkChromeAvailability() bool {
	chromePaths := []string{
		"google-chrome",
		"chrome",
		"chromium",
		"chromium-browser",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	}

	for _, path := range chromePaths {
		if _, err := exec.LookPath(path); err == nil {
			return true
		}
		if _, err := os.Stat(path); err == nil {
			return true
		}
	}

	return false
}

func createTestRepo(t *testing.T, dir string, repoName string) string {
	t.Helper()

	repoPath := filepath.Join(dir, repoName)
	if err := os.MkdirAll(repoPath, 0755); err != nil {
		t.Fatal(err)
	}

	runGitCmd := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = repoPath
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v, output: %s", args, err, string(out))
		}
	}

	runGitCmd("init")
	runGitCmd("config", "user.name", "Test User")
	runGitCmd("config", "user.email", "test@example.com")

	for i := 0; i < 10; i++ {
		fileName := fmt.Sprintf("file_%d.go", i)
		content := fmt.Sprintf(`package main

// TODO: review this implementation #%d
// FIXME: potential memory leak
func main() {
	if true {
		fmt.Println("test %d")
	}
	for j := 0; j < %d; j++ {
		fmt.Println(j)
	}
}
`, i, i, i+5)

		filePath := filepath.Join(repoPath, fileName)
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		runGitCmd("add", fileName)
		runGitCmd("commit", "-m", fmt.Sprintf("feat: add %s", fileName))
	}

	return repoPath
}

func createTestConfig(t *testing.T, dir string, repoPaths []string) string {
	t.Helper()

	cfg := config.DefaultConfig()
	cfg.Repos = make([]config.RepoConfig, len(repoPaths))
	for i, repoPath := range repoPaths {
		cfg.Repos[i] = config.RepoConfig{
			Name: filepath.Base(repoPath),
			Path: repoPath,
		}
	}

	cfg.Storage.DBPath = filepath.Join(dir, "gitmon.db")
	cfg.Report.OutputDir = filepath.Join(dir, "reports")
	cfg.Database = filepath.Join(dir, "gitmon.db")
	cfg.DataDir = dir

	if err := os.MkdirAll(cfg.Report.OutputDir, 0755); err != nil {
		t.Fatal(err)
	}

	cfgPath := filepath.Join(dir, "gitmon.yaml")
	data, err := cfg.ToYAML()
	if err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(cfgPath, data, 0644); err != nil {
		t.Fatal(err)
	}

	return cfgPath
}

func TestChromeAvailability(t *testing.T) {
	if !checkChromeAvailability() {
		t.Skip("Chrome/Chromium not available, skipping PDF generation tests")
	}
	t.Log("Chrome/Chromium is available at:")

	chromePaths := []string{
		"google-chrome",
		"chrome",
		"chromium",
		"chromium-browser",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	}

	for _, path := range chromePaths {
		if p, err := exec.LookPath(path); err == nil {
			t.Logf("  %s", p)
		}
		if _, err := os.Stat(path); err == nil {
			t.Logf("  %s", path)
		}
	}
}

func TestEndToEnd_Scan_Report_Serve(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	if !checkChromeAvailability() {
		t.Log("Warning: Chrome/Chromium not available, PDF generation will be skipped")
	}

	tmpDir := t.TempDir()

	repo1 := createTestRepo(t, tmpDir, "repo-1")
	repo2 := createTestRepo(t, tmpDir, "repo-2")

	cfgPath := createTestConfig(t, tmpDir, []string{repo1, repo2})

	binPath := filepath.Join(tmpDir, "gitmon")
	buildCmd := exec.Command("go", "build", "-ldflags",
		"-s -w -X github.com/gitmon/gitmon/internal/version.Version=test -X github.com/gitmon/gitmon/internal/version.BuildTime=test -X github.com/gitmon/gitmon/internal/version.GitCommit=test",
		"-o", binPath, ".")
	buildCmd.Dir = filepath.Join("..")
	var buildOut bytes.Buffer
	buildCmd.Stdout = &buildOut
	buildCmd.Stderr = &buildOut
	if err := buildCmd.Run(); err != nil {
		t.Fatalf("Build failed: %v, output: %s", err, buildOut.String())
	}
	t.Log("Binary built successfully")

	t.Run("Scan", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		cmd := exec.CommandContext(ctx, binPath, "scan", "--config", cfgPath)
		var out bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &out

		if err := cmd.Run(); err != nil {
			t.Fatalf("Scan failed: %v, output: %s", err, out.String())
		}

		output := out.String()
		t.Logf("Scan output: %s", output)

		if !strings.Contains(output, "Scan complete") && !strings.Contains(output, "repo-1") {
			t.Errorf("Expected scan to complete successfully, got: %s", output)
		}
		t.Log("✓ Scan completed successfully")
	})

	t.Run("Report", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		reportDir := filepath.Join(tmpDir, "reports")

		formats := []string{"html", "json"}
		if checkChromeAvailability() {
			formats = append(formats, "pdf")
		}

		for _, format := range formats {
			t.Run(format, func(t *testing.T) {
				cmd := exec.CommandContext(ctx, binPath, "report", "--config", cfgPath,
					"--output", reportDir, "--format", format)
				var out bytes.Buffer
				cmd.Stdout = &out
				cmd.Stderr = &out

				if err := cmd.Run(); err != nil {
					t.Fatalf("Report %s failed: %v, output: %s", format, err, out.String())
				}

				expectedFile := filepath.Join(reportDir, fmt.Sprintf("report.%s", format))
				if _, err := os.Stat(expectedFile); err != nil {
					t.Errorf("Expected report file %s not found: %v", expectedFile, err)
				} else {
					info, _ := os.Stat(expectedFile)
					t.Logf("✓ Report file %s generated: %d bytes", format, info.Size())
				}
			})
		}
	})

	t.Run("Serve", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		port := 18081
		cmd := exec.CommandContext(ctx, binPath, "serve", "--config", cfgPath,
			"--addr", fmt.Sprintf(":%d", port))
		var out bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &out

		if err := cmd.Start(); err != nil {
			t.Fatalf("Serve failed to start: %v, output: %s", err, out.String())
		}
		defer cmd.Process.Kill()

		time.Sleep(3 * time.Second)

		baseURL := fmt.Sprintf("http://localhost:%d", port)

		t.Run("API_Health", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/api/v1/health")
			if err != nil {
				t.Fatalf("Health check failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}

			var result map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&result)

			if v, ok := result["version"].(string); !ok || v == "" {
				t.Error("Version not found in health response")
			}
			if v, ok := result["status"].(string); !ok || v != "ok" {
				t.Errorf("Expected status 'ok', got %v", v)
			}
			t.Logf("✓ Health API OK: version=%v", result["version"])
		})

		t.Run("API_Repos", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/api/v1/repos")
			if err != nil {
				t.Fatalf("Repos API failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}

			body, _ := io.ReadAll(resp.Body)
			var result map[string]interface{}
			json.Unmarshal(body, &result)

			if success, ok := result["success"].(bool); !ok || !success {
				t.Errorf("Expected success=true, got %v", result)
			}

			data, ok := result["data"].([]interface{})
			if !ok {
				t.Fatalf("Expected data array, got %T", result["data"])
			}

			if len(data) != 2 {
				t.Errorf("Expected 2 repos, got %d", len(data))
			}

			for _, r := range data {
				repo := r.(map[string]interface{})
				requiredFields := []string{"name", "commit_count", "contributors", "files_count", "last_commit"}
				for _, field := range requiredFields {
					if _, ok := repo[field]; !ok {
						t.Errorf("Expected field %s in repo, got keys: %v", field, repo)
					}
				}
			}
			t.Logf("✓ Repos API OK: %d repos", len(data))
		})

		t.Run("API_Stats", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/api/v1/stats")
			if err != nil {
				t.Fatalf("Stats API failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}

			var result map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&result)

			if success, ok := result["success"].(bool); !ok || !success {
				t.Errorf("Expected success=true, got %v", result)
			}

			data, ok := result["data"].([]interface{})
			if !ok {
				t.Fatalf("Expected data array, got %T", result["data"])
			}

			if len(data) != 2 {
				t.Errorf("Expected 2 stats entries, got %d", len(data))
			}
			t.Logf("✓ Stats API OK: %d entries", len(data))
		})

		t.Run("API_Alerts", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/api/v1/alerts")
			if err != nil {
				t.Fatalf("Alerts API failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}

			var result map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&result)

			if success, ok := result["success"].(bool); !ok || !success {
				t.Errorf("Expected success=true, got %v", result)
			}
			t.Log("✓ Alerts API OK")
		})

		t.Run("API_Filter_JQ_Syntax", func(t *testing.T) {
			tests := []struct {
				name   string
				filter string
			}{
				{"length", "length"},
				{"keys", "keys"},
				{"array_iterate", ".[]"},
				{"map_field", "map(.name)"},
				{"select_gt", "select(.commit_count>5)"},
				{"group_by", "group_by(.health_level)"},
			}

			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					url := fmt.Sprintf("%s/api/v1/repos?filter=%s",
						baseURL, strings.ReplaceAll(tt.filter, " ", "%20"))
					resp, err := http.Get(url)
					if err != nil {
						t.Fatalf("Filter %s failed: %v", tt.filter, err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						t.Errorf("Expected status 200 for filter %s, got %d",
							tt.filter, resp.StatusCode)
					}
				})
			}
			t.Log("✓ Filter API OK with jq syntax")
		})

		t.Run("Dashboard", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/")
			if err != nil {
				t.Fatalf("Dashboard failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}

			body, _ := io.ReadAll(resp.Body)
			bodyStr := string(body)
			if !strings.Contains(bodyStr, "GitMon") {
				t.Error("Dashboard does not contain 'GitMon'")
			}
			if !strings.Contains(bodyStr, "healthChart") {
				t.Error("Dashboard does not contain 'healthChart'")
			}
			t.Log("✓ Dashboard OK")
		})
	})

	t.Log("✓ E2E test completed successfully")
}
