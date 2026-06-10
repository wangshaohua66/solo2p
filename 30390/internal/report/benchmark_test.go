package report

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gitmon/gitmon/internal/git"
	"github.com/gitmon/gitmon/internal/storage"
)

func findProjectRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "templates", "report.html")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "."
		}
		dir = parent
	}
}

func generateTestData(repoCount, commitsPerRepo int) *ReportData {
	var repos []storage.RepoRecord
	var alerts []storage.AlertRecord
	var stats []storage.RepoStats

	for i := 0; i < repoCount; i++ {
		repo := storage.RepoRecord{
			Name:         fmt.Sprintf("repo-%d", i),
			Path:         fmt.Sprintf("/path/to/repo-%d", i),
			CommitCount:  commitsPerRepo,
			Contributors: 5 + i%10,
			FilesCount:   50 + i*3,
			LinesOfCode:  10000 + i*1000,
			HealthLevel:  "good",
			HealthScore:  75.0 + float64(i%25),
			SilentDays:   i % 30,
			LastCommit:   time.Now().AddDate(0, 0, -i),
		}
		repos = append(repos, repo)

		stat := storage.RepoStats{
			RepoName:     repo.Name,
			TotalCommits: repo.CommitCount,
			Contributors: repo.Contributors,
			TotalFiles:   repo.FilesCount,
			TotalLines:   repo.LinesOfCode,
			HealthLevel:  git.HealthGood,
			HealthScore:  repo.HealthScore,
			SilentDays:   repo.SilentDays,
			LastCommit:   repo.LastCommit,
		}
		stats = append(stats, stat)

		if i%5 == 0 {
			alert := storage.AlertRecord{
				ID:        fmt.Sprintf("alert-%d", i),
				RepoName:  repo.Name,
				Type:      "silent_repo",
				Level:     "warning",
				Title:     "Silent Repository Alert",
				Message:   "Repository has been silent",
				CreatedAt: time.Now(),
			}
			alerts = append(alerts, alert)
		}
	}

	return &ReportData{
		GeneratedAt:  time.Now(),
		Repos:        repos,
		Stats:        stats,
		Alerts:       alerts,
		TopFiles:     make(map[string][]storage.FileRecord),
		Contributors: make(map[string][]storage.ContributorRecord),
		Heatmap:      make(map[string][]storage.HeatmapData),
		TechDebt:     make(map[string][]storage.TechDebtItem),
	}
}

func BenchmarkReportGenerationHTML(b *testing.B) {
	oldDir, _ := os.Getwd()
	os.Chdir(findProjectRoot())
	defer os.Chdir(oldDir)

	data := generateTestData(50, 1000)

	tmpDir := b.TempDir()
	g := &Generator{}
	if err := g.loadTemplates(); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := g.generateHTML(data, tmpDir, "")
		if err != nil {
			b.Fatal(err)
		}

		elapsed := time.Since(start)
		if elapsed > 3*time.Second {
			b.Fatalf("HTML report generation took %v, expected < 3s", elapsed)
		}

		b.ReportMetric(float64(elapsed.Milliseconds()), "ms")
	}
}

func BenchmarkReportGenerationJSON(b *testing.B) {
	data := generateTestData(50, 1000)
	tmpDir := b.TempDir()
	g := &Generator{}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := g.generateJSON(data, tmpDir)
		if err != nil {
			b.Fatal(err)
		}

		elapsed := time.Since(start)
		b.ReportMetric(float64(elapsed.Milliseconds()), "ms")
	}
}

func BenchmarkReportGeneration100Repos(b *testing.B) {
	oldDir, _ := os.Getwd()
	os.Chdir(findProjectRoot())
	defer os.Chdir(oldDir)

	data := generateTestData(100, 2000)

	tmpDir := b.TempDir()
	g := &Generator{}
	if err := g.loadTemplates(); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := g.generateHTML(data, tmpDir, "")
		if err != nil {
			b.Fatal(err)
		}

		elapsed := time.Since(start)
		if elapsed > 5*time.Second {
			b.Fatalf("Report for 100 repos took %v, expected < 5s", elapsed)
		}

		b.ReportMetric(float64(elapsed.Milliseconds()), "ms")
	}
}

func BenchmarkJSONMarshalLargeDataset(b *testing.B) {
	data := generateTestData(50, 1000)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		_, err := json.Marshal(data)
		if err != nil {
			b.Fatal(err)
		}
	}
}
