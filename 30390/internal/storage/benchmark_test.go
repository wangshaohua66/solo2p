package storage

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"
)

func setupTestDB(b *testing.B) *Store {
	b.Helper()
	tmpDir := b.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := Open(dbPath)
	if err != nil {
		b.Fatal(err)
	}

	return store
}

func generateRepoRecords(count int) []RepoRecord {
	var repos []RepoRecord
	for i := 0; i < count; i++ {
		repo := RepoRecord{
			Name:         fmt.Sprintf("repo-%d", i),
			Path:         fmt.Sprintf("/path/to/repo-%d", i),
			CommitCount:  100 + i*10,
			Contributors: 5 + i%10,
			FilesCount:   50 + i*3,
			LinesOfCode:  10000 + i*1000,
			HealthLevel:  "good",
			HealthScore:  75.0 + float64(i%25),
			SilentDays:   i % 30,
			LastCommit:   time.Now().AddDate(0, 0, -i),
		}
		repos = append(repos, repo)
	}
	return repos
}

func generateCommitRecords(repoName string, count int) []CommitRecord {
	var commits []CommitRecord
	for i := 0; i < count; i++ {
		commit := NewCommitRecordWithFields(
			fmt.Sprintf("commit-%s-%d", repoName, i),
			repoName,
			fmt.Sprintf("Test Author %d", i%10),
			fmt.Sprintf("author%d@example.com", i%10),
			time.Now().AddDate(0, 0, -i),
			fmt.Sprintf("Commit message %d", i),
			[]GitFile{{Path: fmt.Sprintf("file-%d.go", i%20), Added: 10, Deleted: 5}},
		)
		commits = append(commits, *commit)
	}
	return commits
}

func BenchmarkSaveRepos50(b *testing.B) {
	store := setupTestDB(b)
	defer store.Close()

	repos := generateRepoRecords(50)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		for _, repo := range repos {
			repoCopy := repo
			if err := store.SaveRepo(&repoCopy); err != nil {
				b.Fatal(err)
			}
		}

		b.ReportMetric(float64(time.Since(start).Microseconds()), "μs")
	}
}

func BenchmarkSaveCommits10K(b *testing.B) {
	store := setupTestDB(b)
	defer store.Close()

	repo := RepoRecord{Name: "test-repo", Path: "/test"}
	if err := store.SaveRepo(&repo); err != nil {
		b.Fatal(err)
	}

	commits := generateCommitRecords("test-repo", 10000)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		if err := store.SaveCommits(commits); err != nil {
			b.Fatal(err)
		}

		b.ReportMetric(float64(time.Since(start).Milliseconds()), "ms")
	}
}

func BenchmarkGetAllRepos(b *testing.B) {
	store := setupTestDB(b)
	defer store.Close()

	repos := generateRepoRecords(50)
	for _, repo := range repos {
		repoCopy := repo
		if err := store.SaveRepo(&repoCopy); err != nil {
			b.Fatal(err)
		}
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := store.GetAllRepos()
		if err != nil {
			b.Fatal(err)
		}

		elapsed := time.Since(start)
		if elapsed > 1*time.Second {
			b.Fatalf("GetAllRepos first byte took %v, expected < 1s", elapsed)
		}

		b.ReportMetric(float64(elapsed.Microseconds()), "μs")
	}
}

func BenchmarkGetCommitsByRepo10K(b *testing.B) {
	store := setupTestDB(b)
	defer store.Close()

	repo := RepoRecord{Name: "test-repo", Path: "/test"}
	if err := store.SaveRepo(&repo); err != nil {
		b.Fatal(err)
	}

	commits := generateCommitRecords("test-repo", 10000)
	if err := store.SaveCommits(commits); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		result, err := store.GetCommitsByRepo("test-repo", 10000)
		if err != nil {
			b.Fatal(err)
		}
		if len(result) != 10000 {
			b.Fatalf("Expected 10000 commits, got %d", len(result))
		}

		b.ReportMetric(float64(time.Since(start).Milliseconds()), "ms")
	}
}

func BenchmarkGetContributorsByRepo(b *testing.B) {
	store := setupTestDB(b)
	defer store.Close()

	repo := RepoRecord{Name: "test-repo", Path: "/test"}
	if err := store.SaveRepo(&repo); err != nil {
		b.Fatal(err)
	}

	commits := generateCommitRecords("test-repo", 5000)
	if err := store.SaveCommits(commits); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		_, err := store.GetContributorsByRepo("test-repo")
		if err != nil {
			b.Fatal(err)
		}

		b.ReportMetric(float64(time.Since(start).Milliseconds()), "ms")
	}
}

func BenchmarkSaveTechDebt(b *testing.B) {
	store := setupTestDB(b)
	defer store.Close()

	var items []*TechDebtItem
	for i := 0; i < 1000; i++ {
		item := NewTechDebtItem(
			"test-repo",
			fmt.Sprintf("file-%d.go", i),
			i+1,
			"TODO",
			fmt.Sprintf("TODO: fix issue %d", i),
			"Test Author",
			"test@example.com",
		)
		items = append(items, item)
	}

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		start := time.Now()

		if err := store.SaveTechDebt(items); err != nil {
			b.Fatal(err)
		}

		b.ReportMetric(float64(time.Since(start).Milliseconds()), "ms")
	}
}
