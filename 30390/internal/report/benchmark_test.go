package report

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gitmon/gitmon/internal/storage"
)

func generateTestData(repoCount, commitsPerRepo int) *ReportData {
	var repos []storage.RepoRecord
	var alerts []storage.AlertRecord

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

		if i%5 == 0 {
			alert := storage.AlertRecord{
				ID:        fmt.Sprintf("alert-%d", i),
				RepoName:  repo.Name,
				Type:      "silent_repo",
				Level:     "warning",
				Message:   "Repository has been silent",
				CreatedAt: time.Now(),
			}
			alerts = append(alerts, alert)
		}
	}

	return &ReportData{
		GeneratedAt: time.Now(),
		Repos:       repos,
		Alerts:      alerts,
		TotalRepos:  repoCount,
	}
}

func BenchmarkReportGenerationHTML(b *testing.B) {
	data := generateTestData(50, 1000)

	tmpDir := b.TempDir()
	g := New(tmpDir)
	if err := g.loadTemplates(); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := g.generateHTML(data, tmpDir)
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
	g := New(tmpDir)

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

func BenchmarkReportGenerationCSV(b *testing.B) {
	data := generateTestData(50, 1000)
	tmpDir := b.TempDir()
	g := New(tmpDir)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := g.generateCSV(data, tmpDir)
		if err != nil {
			b.Fatal(err)
		}

		elapsed := time.Since(start)
		b.ReportMetric(float64(elapsed.Milliseconds()), "ms")
	}
}

func BenchmarkReportGeneration100Repos(b *testing.B) {
	data := generateTestData(100, 2000)

	tmpDir := b.TempDir()
	g := New(tmpDir)
	if err := g.loadTemplates(); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := g.generateHTML(data, tmpDir)
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
