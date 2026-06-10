package analyzer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/gitmon/gitmon/internal/config"
	"github.com/gitmon/gitmon/internal/git"
)

func setupTestRepos(b *testing.B, count int) []string {
	b.Helper()
	tmpDir := b.TempDir()

	var repos []string
	for i := 0; i < count; i++ {
		repoPath := filepath.Join(tmpDir, fmt.Sprintf("repo-%d", i))
		if err := os.MkdirAll(repoPath, 0755); err != nil {
			b.Fatal(err)
		}

		client, err := git.NewClient(repoPath)
		if err != nil {
			b.Fatal(err)
		}

		if err := client.Init(context.Background()); err != nil {
			b.Fatal(err)
		}

		client.SetConfig("user.name", "Test User")
		client.SetConfig("user.email", "test@example.com")

		for j := 0; j < 20; j++ {
			fileName := fmt.Sprintf("file-%d.go", j)
			filePath := filepath.Join(repoPath, fileName)
			content := fmt.Sprintf(`package main
// TODO: fix this issue #%d
// FIXME: critical bug
func main() {
	if true {
		fmt.Println("hello")
	}
	for i := 0; i < 10; i++ {
		fmt.Println(i)
	}
}
`, j)
			if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
				b.Fatal(err)
			}

			if err := client.Add(context.Background(), fileName); err != nil {
				b.Fatal(err)
			}

			msg := fmt.Sprintf("commit %d for repo %d", j, i)
			if _, err := client.Commit(context.Background(), msg); err != nil {
				b.Fatal(err)
			}
		}

		repos = append(repos, repoPath)
	}

	return repos
}

func BenchmarkScan50Repos(b *testing.B) {
	repos := setupTestRepos(b, 50)

	cfg := &config.Config{
		Analyzer: config.AnalyzerConfig{
			MaxCommitsPerRepo: 100,
			TechDebtPatterns:  []string{"TODO", "FIXME", "HACK"},
		},
	}

	an := New(cfg)
	ctx := context.Background()

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()
		var memBefore runtime.MemStats
		runtime.ReadMemStats(&memBefore)

		scanCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		_, err := an.ScanAll(scanCtx, repos)
		cancel()

		if err != nil {
			b.Fatalf("Scan failed: %v", err)
		}

		elapsed := time.Since(start)
		if elapsed > 5*time.Minute {
			b.Fatalf("ScanAll 50 repos took %v, expected < 5min", elapsed)
		}

		var memAfter runtime.MemStats
		runtime.ReadMemStats(&memAfter)
		memUsed := memAfter.Alloc - memBefore.Alloc
		b.ReportMetric(float64(elapsed.Milliseconds()), "ms")
		b.ReportMetric(float64(memUsed)/1024/1024, "MB")
	}
}

func BenchmarkIncrementalScan(b *testing.B) {
	repos := setupTestRepos(b, 10)

	cfg := &config.Config{
		Analyzer: config.AnalyzerConfig{
			MaxCommitsPerRepo: 100,
			TechDebtPatterns:  []string{"TODO", "FIXME"},
		},
	}

	an := New(cfg)
	ctx := context.Background()

	_, err := an.ScanAll(ctx, repos)
	if err != nil {
		b.Fatalf("Initial scan failed: %v", err)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		scanCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		_, err := an.ScanAll(scanCtx, repos)
		cancel()

		if err != nil {
			b.Fatalf("Incremental scan failed: %v", err)
		}

		elapsed := time.Since(start)
		if elapsed > 30*time.Second {
			b.Fatalf("Incremental scan took %v, expected < 30s", elapsed)
		}

		b.ReportMetric(float64(elapsed.Milliseconds()), "ms")
	}
}

func BenchmarkTechDebtScanWithBlame(b *testing.B) {
	repos := setupTestRepos(b, 1)

	cfg := &config.Config{
		Analyzer: config.AnalyzerConfig{
			MaxCommitsPerRepo: 100,
			TechDebtPatterns:  []string{"TODO", "FIXME", "HACK"},
		},
	}

	an := New(cfg)
	ctx := context.Background()

	client, _ := git.NewClient(repos[0])
	commits, _ := client.Log(ctx, 50)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		items := an.scanTechDebt(ctx, client, commits, "test-repo")

		for _, item := range items {
			if item.Author == "" || item.Email == "" {
				b.Errorf("TechDebtItem missing Author/Email: %+v", *item)
			}
		}
	}
}

func Benchmark100KCommitsMemory(b *testing.B) {
	repos := setupTestRepos(b, 5)

	cfg := &config.Config{
		Analyzer: config.AnalyzerConfig{
			MaxCommitsPerRepo: 20000,
			TechDebtPatterns:  []string{"TODO"},
		},
	}

	an := New(cfg)
	ctx := context.Background()

	var memStats runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&memStats)
	initialAlloc := memStats.Alloc

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		records, err := an.ScanAll(ctx, repos)
		if err != nil {
			b.Fatal(err)
		}

		totalCommits := 0
		for _, r := range records {
			totalCommits += r.CommitCount
		}

		runtime.ReadMemStats(&memStats)
		memUsed := memStats.Alloc - initialAlloc

		if memUsed > 500*1024*1024 {
			b.Fatalf("Memory usage for %d commits: %.2f MB, expected < 500MB",
				totalCommits, float64(memUsed)/1024/1024)
		}

		b.ReportMetric(float64(memUsed)/1024/1024, "MB")
		b.ReportMetric(float64(totalCommits), "commits")
	}
}
