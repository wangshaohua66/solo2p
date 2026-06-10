package storage

import (
	"sort"
	"strings"
	"time"

	"github.com/gitmon/gitmon/internal/git"
)

func (s *Store) GetAllRepos() ([]RepoRecord, error) {
	var repos []RepoRecord
	err := s.View(func(tx *Tx) error {
		return tx.ForEach(BucketRepos, func(_, v []byte) error {
			var r RepoRecord
			if err := fromBytes(v, &r); err == nil {
				repos = append(repos, r)
			}
			return nil
		})
	})
	return repos, err
}

func (s *Store) GetRepo(name string) (*RepoRecord, error) {
	var repo RepoRecord
	err := s.View(func(tx *Tx) error {
		found, err := tx.Get(BucketRepos, []byte(name), &repo)
		if err != nil {
			return err
		}
		if !found {
			return nil
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if repo.Name == "" {
		return nil, nil
	}
	return &repo, nil
}

func (s *Store) SaveRepo(repo *RepoRecord) error {
	repo.UpdatedAt = time.Now()
	err := s.Update(func(tx *Tx) error {
		return tx.Put(BucketRepos, []byte(repo.Name), repo)
	})
	if err != nil {
		return err
	}
	return s.Sync()
}

func (s *Store) GetCommitsByRepo(repoName string, limit int) ([]CommitRecord, error) {
	var commits []CommitRecord
	err := s.View(func(tx *Tx) error {
		count := 0
		prefix := []byte(repoName + ":")
		return tx.ForEachWithPrefix(BucketCommits, prefix, func(k, v []byte) error {
			if limit > 0 && count >= limit {
				return ErrStopIteration
			}
			var c CommitRecord
			if err := fromBytes(v, &c); err == nil {
				commits = append(commits, c)
				count++
			}
			return nil
		})
	})
	sort.Slice(commits, func(i, j int) bool {
		return commits[i].AuthorDate.After(commits[j].AuthorDate)
	})
	return commits, err
}

func (s *Store) SaveCommit(c *CommitRecord) error {
	key := MakeKey(c.RepoName, c.Hash)
	return s.Batch(func(tx *Tx) error {
		return tx.Put(BucketCommits, key, c)
	})
}

func (s *Store) SaveCommits(commits []CommitRecord) error {
	return s.Batch(func(tx *Tx) error {
		for _, c := range commits {
			key := MakeKey(c.RepoName, c.Hash)
			if err := tx.Put(BucketCommits, key, c); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) GetFilesByRepo(repoName string) ([]FileRecord, error) {
	var files []FileRecord
	err := s.View(func(tx *Tx) error {
		prefix := []byte(repoName + ":")
		return tx.ForEachWithPrefix(BucketFiles, prefix, func(k, v []byte) error {
			var f FileRecord
			if err := fromBytes(v, &f); err == nil {
				files = append(files, f)
			}
			return nil
		})
	})
	return files, err
}

func (s *Store) SaveFile(f *FileRecord) error {
	key := MakeKey(f.RepoName, f.Path)
	return s.Update(func(tx *Tx) error {
		return tx.Put(BucketFiles, key, f)
	})
}

func (s *Store) SaveFiles(files []FileRecord) error {
	return s.Batch(func(tx *Tx) error {
		for _, f := range files {
			key := MakeKey(f.RepoName, f.Path)
			if err := tx.Put(BucketFiles, key, f); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) GetContributorsByRepo(repoName string) ([]ContributorRecord, error) {
	var contributors []ContributorRecord
	err := s.View(func(tx *Tx) error {
		prefix := []byte(repoName + ":")
		return tx.ForEachWithPrefix(BucketContributors, prefix, func(k, v []byte) error {
			var c ContributorRecord
			if err := fromBytes(v, &c); err == nil {
				contributors = append(contributors, c)
			}
			return nil
		})
	})
	sort.Slice(contributors, func(i, j int) bool {
		return contributors[i].Commits > contributors[j].Commits
	})
	return contributors, err
}

func (s *Store) SaveContributor(c *ContributorRecord) error {
	key := MakeKey(c.RepoName, c.Email)
	return s.Update(func(tx *Tx) error {
		return tx.Put(BucketContributors, key, c)
	})
}

func (s *Store) SaveContributors(contributors []ContributorRecord) error {
	return s.Batch(func(tx *Tx) error {
		for _, c := range contributors {
			key := MakeKey(c.RepoName, c.Email)
			if err := tx.Put(BucketContributors, key, c); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) GetTechDebtByRepo(repoName string) ([]TechDebtItem, error) {
	var items []TechDebtItem
	err := s.View(func(tx *Tx) error {
		prefix := []byte(repoName + ":")
		return tx.ForEachWithPrefix(BucketTechDebt, prefix, func(k, v []byte) error {
			var item TechDebtItem
			if err := fromBytes(v, &item); err == nil {
				items = append(items, item)
			}
			return nil
		})
	})
	return items, err
}

func (s *Store) SaveTechDebt(items []*TechDebtItem) error {
	return s.Batch(func(tx *Tx) error {
		for _, item := range items {
			key := MakeKey(item.RepoName, item.ID)
			if err := tx.Put(BucketTechDebt, key, *item); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) GetActiveAlerts() ([]AlertRecord, error) {
	var alerts []AlertRecord
	err := s.View(func(tx *Tx) error {
		return tx.ForEach(BucketAlerts, func(k, v []byte) error {
			var a AlertRecord
			if err := fromBytes(v, &a); err == nil && !a.Resolved {
				alerts = append(alerts, a)
			}
			return nil
		})
	})
	sort.Slice(alerts, func(i, j int) bool {
		return alerts[i].CreatedAt.After(alerts[j].CreatedAt)
	})
	return alerts, err
}

func (s *Store) SaveAlert(a *AlertRecord) error {
	err := s.Update(func(tx *Tx) error {
		var existing *AlertRecord
		err := tx.ForEach(BucketAlerts, func(k, v []byte) error {
			var rec AlertRecord
			if err := fromBytes(v, &rec); err != nil {
				return nil
			}
			if rec.RepoName == a.RepoName && rec.Type == a.Type && !rec.Resolved {
				existing = &rec
				return ErrStopIteration
			}
			return nil
		})
		if err != nil && err != ErrStopIteration {
			return err
		}

		if existing != nil {
			existing.Count++
			existing.CreatedAt = time.Now()
			existing.Message = a.Message
			existing.Level = a.Level
			existing.Title = a.Title
			existing.Owner = a.Owner
			return tx.Put(BucketAlerts, []byte(existing.ID), existing)
		}

		a.ID = string(MakeKey(a.RepoName, a.Type, time.Now().UnixNano()))
		a.Count = 1
		a.CreatedAt = time.Now()
		return tx.Put(BucketAlerts, []byte(a.ID), a)
	})
	if err != nil {
		return err
	}
	return s.Sync()
}

func (s *Store) ResolveAlert(id string) error {
	return s.Update(func(tx *Tx) error {
		var a AlertRecord
		found, err := tx.Get(BucketAlerts, []byte(id), &a)
		if err != nil {
			return err
		}
		if !found {
			return nil
		}
		a.Resolved = true
		a.ResolvedAt = time.Now()
		return tx.Put(BucketAlerts, []byte(id), a)
	})
}

func (s *Store) GetHeatmapData(repoName string, since time.Time) ([]HeatmapData, error) {
	var data []HeatmapData
	dailyCounts := make(map[string]int)

	err := s.View(func(tx *Tx) error {
		prefix := []byte(repoName + ":")
		return tx.ForEachWithPrefix(BucketCommits, prefix, func(k, v []byte) error {
			var c CommitRecord
			if err := fromBytes(v, &c); err == nil {
				if c.AuthorDate.After(since) {
					date := c.AuthorDate.Format("2006-01-02")
					dailyCounts[date]++
				}
			}
			return nil
		})
	})

	for date, count := range dailyCounts {
		data = append(data, HeatmapData{
			Date:  date,
			Count: count,
			Repo:  repoName,
		})
	}

	sort.Slice(data, func(i, j int) bool {
		return data[i].Date < data[j].Date
	})

	return data, err
}

func (s *Store) GetTopFilesByChurn(repoName string, limit int) ([]FileRecord, error) {
	files, err := s.GetFilesByRepo(repoName)
	if err != nil {
		return nil, err
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].RiskScore > files[j].RiskScore
	})

	if limit > 0 && limit < len(files) {
		files = files[:limit]
	}

	return files, nil
}

func (s *Store) GetCommitStats(repoName string, days int) (*RepoStats, error) {
	since := time.Now().AddDate(0, 0, -days)

	var stats RepoStats
	stats.RepoName = repoName
	stats.ChurnWindow = days

	repo, err := s.GetRepo(repoName)
	if err != nil {
		return nil, err
	}
	if repo != nil {
		stats.TotalCommits = repo.CommitCount
		stats.TotalFiles = repo.FilesCount
		stats.TotalLines = repo.LinesOfCode
		stats.SilentDays = repo.SilentDays
		stats.LastCommit = repo.LastCommit
		stats.HealthScore = repo.HealthScore
		stats.HealthLevel = git.HealthLevel(repo.HealthLevel)
	}

	commits, err := s.GetCommitsByRepo(repoName, 0)
	if err != nil {
		return nil, err
	}

	contributorSet := make(map[string]bool)
	prSet := make(map[string]bool)
	totalReviewHours := 0.0
	mergedPRs := 0
	totalPRs := 0

	for _, c := range commits {
		if c.AuthorDate.After(since) {
			contributorSet[c.AuthorEmail] = true
			if c.PRNumber != "" {
				prSet[c.PRNumber] = true
				if c.ReviewDuration > 0 {
					totalReviewHours += float64(c.ReviewDuration) / 3600.0
					mergedPRs++
				}
			}
		}
	}

	stats.Contributors = len(contributorSet)
	stats.ActivePRs = len(prSet)
	totalPRs = len(prSet)
	if mergedPRs > 0 {
		stats.AvgReviewHours = totalReviewHours / float64(mergedPRs)
	}
	if totalPRs > 0 {
		stats.MergeRate = float64(mergedPRs) / float64(totalPRs)
	}

	techDebt, _ := s.GetTechDebtByRepo(repoName)
	stats.TechDebtCount = len(techDebt)

	files, _ := s.GetFilesByRepo(repoName)
	highRisk := 0
	for _, f := range files {
		if f.RiskScore >= 0.7 {
			highRisk++
		}
	}
	stats.HighRiskFiles = highRisk

	return &stats, nil
}

func (s *Store) SearchCommits(repoName, query string, limit int) ([]CommitRecord, error) {
	query = strings.ToLower(query)
	var matches []CommitRecord

	err := s.View(func(tx *Tx) error {
		prefix := []byte(repoName + ":")
		count := 0
		return tx.ForEachWithPrefix(BucketCommits, prefix, func(k, v []byte) error {
			if limit > 0 && count >= limit {
				return ErrStopIteration
			}
			var c CommitRecord
			if err := fromBytes(v, &c); err == nil {
				if strings.Contains(strings.ToLower(c.Subject), query) ||
					strings.Contains(strings.ToLower(c.Body), query) ||
					strings.Contains(strings.ToLower(c.AuthorName), query) ||
					strings.Contains(strings.ToLower(c.AuthorEmail), query) {
					matches = append(matches, c)
					count++
				}
			}
			return nil
		})
	})

	sort.Slice(matches, func(i, j int) bool {
		return matches[i].AuthorDate.After(matches[j].AuthorDate)
	})

	return matches, err
}
