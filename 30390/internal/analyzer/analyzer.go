package analyzer

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gitmon/gitmon/internal/config"
	"github.com/gitmon/gitmon/internal/git"
	"github.com/gitmon/gitmon/internal/storage"
)

type Analyzer struct {
	store   *storage.Store
	cfg     *config.Config
	mu      sync.Mutex
	workers int
}

type ScanResult struct {
	RepoName string
	Success  bool
	Error    string
	Commits  int
	Elapsed  time.Duration
}

type WorkerTask struct {
	Repo  config.RepoConfig
	Since time.Time
}

func New(store *storage.Store, cfg *config.Config) *Analyzer {
	workers := cfg.Scan.WorkerCount
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	return &Analyzer{
		store:   store,
		cfg:     cfg,
		workers: workers,
	}
}

func (a *Analyzer) ScanAll(ctx context.Context, patterns []string) ([]ScanResult, error) {
	repos, err := a.filterRepos(patterns)
	if err != nil {
		return nil, err
	}

	if len(repos) == 0 {
		return nil, fmt.Errorf("no repositories matched the patterns")
	}

	taskChan := make(chan WorkerTask, len(repos))
	resultChan := make(chan ScanResult, len(repos))
	var wg sync.WaitGroup
	var collectWg sync.WaitGroup

	concurrency := a.cfg.Scan.Concurrency
	if concurrency > len(repos) {
		concurrency = len(repos)
	}
	if concurrency <= 0 {
		concurrency = 1
	}

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go a.worker(ctx, taskChan, resultChan, &wg)
	}

	var results []ScanResult
	var mu sync.Mutex

	collectWg.Add(1)
	go func() {
		defer collectWg.Done()
		for r := range resultChan {
			mu.Lock()
			results = append(results, r)
			mu.Unlock()
		}
	}()

	for _, repo := range repos {
		var since time.Time
		if a.cfg.Scan.Incremental {
			a.store.View(func(tx *storage.Tx) error {
				scanStatus, _ := tx.GetScanStatus(repo.Name)
				since = scanStatus.LastScanTime
				return nil
			})
		}

		select {
		case taskChan <- WorkerTask{Repo: repo, Since: since}:
		case <-ctx.Done():
			break
		}
	}
	close(taskChan)
	wg.Wait()
	close(resultChan)
	collectWg.Wait()

	return results, nil
}

func (a *Analyzer) worker(ctx context.Context, tasks <-chan WorkerTask, results chan<- ScanResult, wg *sync.WaitGroup) {
	defer wg.Done()

	for task := range tasks {
		select {
		case <-ctx.Done():
			return
		default:
			results <- a.scanRepo(ctx, task)
		}
	}
}

func (a *Analyzer) scanRepo(ctx context.Context, task WorkerTask) ScanResult {
	start := time.Now()
	result := ScanResult{RepoName: task.Repo.Name}

	client, err := git.NewClient(task.Repo.Path, task.Repo.Name, task.Repo.Mode)
	if err != nil {
		result.Error = fmt.Sprintf("create client: %v", err)
		return result
	}

	if !client.IsRepo(ctx) {
		result.Error = fmt.Sprintf("not a git repository: %s", task.Repo.Path)
		return result
	}

	timeout, _ := time.ParseDuration(a.cfg.Scan.Timeout)
	scanCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	repoInfo, err := client.GetRepoInfo(scanCtx)
	if err != nil {
		result.Error = fmt.Sprintf("get repo info: %v", err)
		a.updateScanStatus(task.Repo.Name, "", 0, result.Error, start)
		return result
	}

	commits, err := client.Log(scanCtx, task.Since, a.cfg.Scan.MaxCommits)
	if err != nil {
		result.Error = fmt.Sprintf("get commits: %v", err)
		a.updateScanStatus(task.Repo.Name, repoInfo.HeadCommit, 0, result.Error, start)
		return result
	}

	result.Commits = len(commits)

	commitRecords := make([]storage.CommitRecord, 0, len(commits))
	for _, c := range commits {
		commitRecords = append(commitRecords, *storage.NewCommitRecord(&c))
	}

	if err := a.store.SaveCommits(commitRecords); err != nil {
		result.Error = fmt.Sprintf("save commits: %v", err)
		a.updateScanStatus(task.Repo.Name, repoInfo.HeadCommit, len(commits), result.Error, start)
		return result
	}

	contributors := a.calculateContributors(commits, task.Repo.Name)
	if err := a.store.SaveContributors(contributors); err != nil {
		result.Error = fmt.Sprintf("save contributors: %v", err)
		return result
	}

	fileChurn := a.calculateFileChurn(commits, task.Repo.Name)
	files := a.buildFileRecords(ctx, client, fileChurn, task.Repo.Name)
	if err := a.store.SaveFiles(files); err != nil {
		result.Error = fmt.Sprintf("save files: %v", err)
		return result
	}

	techDebt := a.scanTechDebt(ctx, client, commits, task.Repo.Name)
	if err := a.store.SaveTechDebt(techDebt); err != nil {
		result.Error = fmt.Sprintf("save tech debt: %v", err)
		return result
	}

	prHealth := a.analyzePRHealth(ctx, client, task.Repo.Name)
	if len(prHealth) > 0 {
		if err := a.store.SavePRHealth(task.Repo.Name, prHealth); err != nil {
			log.Printf("save pr health failed for %s: %v", task.Repo.Name, err)
		}
	}

	repoRecord := a.buildRepoRecord(repoInfo, &task.Repo, commits, files, contributors)
	if err := a.store.SaveRepo(repoRecord); err != nil {
		result.Error = fmt.Sprintf("save repo: %v", err)
		return result
	}

	alerts := a.generateAlerts(repoRecord, task.Repo.Name)
	for _, alert := range alerts {
		if err := a.store.SaveAlert(alert); err != nil {
			log.Printf("save alert failed: %v", err)
		}
	}

	a.updateScanStatus(task.Repo.Name, repoInfo.HeadCommit, len(commits), "", start)
	result.Success = true
	result.Elapsed = time.Since(start)

	log.Printf("scanned %s: %d commits in %v", task.Repo.Name, len(commits), result.Elapsed)
	return result
}

func (a *Analyzer) updateScanStatus(repoName, lastCommit string, commitCount int, errMsg string, start time.Time) {
	status := &storage.ScanStatus{
		RepoName:     repoName,
		LastScanTime: time.Now(),
		LastCommit:   lastCommit,
		CommitCount:  commitCount,
		Status:       "completed",
		ErrorMessage: errMsg,
		ElapsedMs:    time.Since(start).Milliseconds(),
	}
	if errMsg != "" {
		status.Status = "failed"
	}
	a.store.Update(func(tx *storage.Tx) error {
		return tx.SetScanStatus(status)
	})
}

func (a *Analyzer) filterRepos(patterns []string) ([]config.RepoConfig, error) {
	if len(patterns) == 0 {
		var repos []config.RepoConfig
		for _, r := range a.cfg.Repos {
			if !r.Disabled {
				repos = append(repos, r)
			}
		}
		return repos, nil
	}

	var matched []config.RepoConfig
	for _, r := range a.cfg.Repos {
		if r.Disabled {
			continue
		}
		for _, pattern := range patterns {
			matchedPattern, err := filepath.Match(pattern, r.Name)
			if err != nil {
				return nil, fmt.Errorf("invalid pattern %s: %w", pattern, err)
			}
			if matchedPattern || strings.Contains(r.Name, pattern) {
				matched = append(matched, r)
				break
			}
		}
	}

	return matched, nil
}

func (a *Analyzer) calculateContributors(commits []git.Commit, repoName string) []storage.ContributorRecord {
	contribMap := make(map[string]*storage.ContributorRecord)
	daySet := make(map[string]map[string]bool)

	for _, c := range commits {
		key := c.AuthorEmail
		if key == "" {
			key = c.AuthorName
		}

		contrib, exists := contribMap[key]
		if !exists {
			contrib = &storage.ContributorRecord{
				RepoName:    repoName,
				Name:        c.AuthorName,
				Email:       c.AuthorEmail,
				FirstCommit: c.AuthorDate,
			}
			contribMap[key] = contrib
		}

		contrib.Commits++
		for _, f := range c.Files {
			contrib.LinesAdded += f.Additions
			contrib.LinesDeleted += f.Deletions
		}
		contrib.FilesTouched += len(c.Files)

		if c.AuthorDate.After(contrib.LastCommit) {
			contrib.LastCommit = c.AuthorDate
		}
		if c.AuthorDate.Before(contrib.FirstCommit) {
			contrib.FirstCommit = c.AuthorDate
		}

		dayKey := c.AuthorDate.Format("2006-01-02")
		if _, ok := daySet[key]; !ok {
			daySet[key] = make(map[string]bool)
		}
		daySet[key][dayKey] = true
	}

	for key, contrib := range contribMap {
		contrib.ActiveDays = len(daySet[key])
		contrib.StreakDays = a.calculateStreak(daySet[key])
	}

	contributors := make([]storage.ContributorRecord, 0, len(contribMap))
	for _, c := range contribMap {
		contributors = append(contributors, *c)
	}

	sort.Slice(contributors, func(i, j int) bool {
		return contributors[i].Commits > contributors[j].Commits
	})

	return contributors
}

func (a *Analyzer) calculateStreak(days map[string]bool) int {
	if len(days) == 0 {
		return 0
	}

	var dayList []string
	for d := range days {
		dayList = append(dayList, d)
	}
	sort.Strings(dayList)

	maxStreak := 1
	currentStreak := 1

	for i := 1; i < len(dayList); i++ {
		curr, _ := time.Parse("2006-01-02", dayList[i])
		prev, _ := time.Parse("2006-01-02", dayList[i-1])
		if curr.Sub(prev).Hours() <= 24 {
			currentStreak++
			if currentStreak > maxStreak {
				maxStreak = currentStreak
			}
		} else {
			currentStreak = 1
		}
	}

	return maxStreak
}

func (a *Analyzer) calculateFileChurn(commits []git.Commit, repoName string) map[string]*storage.FileChurn {
	churnMap := make(map[string]*storage.FileChurn)
	since := time.Now().AddDate(0, 0, -a.cfg.Analyzer.ChurnWindow)

	for _, c := range commits {
		if c.AuthorDate.Before(since) {
			continue
		}
		for _, f := range c.Files {
			path := f.Path
			if churnMap[path] == nil {
				churnMap[path] = &storage.FileChurn{
					Path:    path,
					Authors: make(map[string]bool),
				}
			}
			churnMap[path].Count++
			churnMap[path].Additions += f.Additions
			churnMap[path].Deletions += f.Deletions
			churnMap[path].Authors[c.AuthorEmail] = true
		}
	}

	return churnMap
}

func (a *Analyzer) buildFileRecords(ctx context.Context, client *git.Client, churnMap map[string]*storage.FileChurn, repoName string) []storage.FileRecord {
	var files []storage.FileRecord

	for path, churn := range churnMap {
		ext := strings.ToLower(filepath.Ext(path))
		if ext == "" {
			ext = "unknown"
		}

		complexity := a.estimateComplexity(path, churn.Count, len(churn.Authors))
		riskScore := a.calculateRiskScore(churn.Count, complexity, churn.Additions+churn.Deletions)

		authors := make([]string, 0, len(churn.Authors))
		for a := range churn.Authors {
			authors = append(authors, a)
		}

		record := storage.FileRecord{
			RepoName:     repoName,
			Path:         path,
			Extension:    ext,
			Lines:        churn.Additions + churn.Deletions,
			ChurnCount:   churn.Count,
			Complexity:   complexity,
			RiskScore:    riskScore,
			Contributors: authors,
			LastChanged:  time.Now(),
			FirstAdded:   time.Now(),
		}
		files = append(files, record)
	}

	return files
}

func (a *Analyzer) estimateComplexity(path string, churnCount int, authorCount int) float64 {
	ext := strings.ToLower(filepath.Ext(path))

	if ext == ".go" {
		if complexity, err := calculateGoCyclomaticComplexity(path); err == nil {
			churnFactor := math.Log10(float64(churnCount)+1) * 0.3
			authorFactor := math.Log10(float64(authorCount)+1) * 0.2
			return float64(complexity) * (1.0 + churnFactor + authorFactor)
		}
	}

	baseComplexity := 1.0
	switch ext {
	case ".go", ".java", ".cpp", ".c", ".h", ".cs", ".py", ".rb", ".js", ".ts", ".tsx", ".jsx":
		baseComplexity = 3.0
	case ".rs", ".scala", ".kt", ".swift":
		baseComplexity = 2.5
	case ".php", ".perl", ".sh", ".bash":
		baseComplexity = 2.0
	case ".yaml", ".yml", ".json", ".toml", ".ini", ".xml":
		baseComplexity = 1.5
	case ".md", ".txt", ".rst":
		baseComplexity = 0.5
	}

	churnFactor := math.Log10(float64(churnCount)+1) * 0.5
	authorFactor := math.Log10(float64(authorCount)+1) * 0.3

	return baseComplexity * (1.0 + churnFactor + authorFactor)
}

func calculateGoCyclomaticComplexity(filePath string) (int, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return 0, err
	}

	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, content, parser.ParseComments)
	if err != nil {
		return 0, err
	}

	complexity := 1
	ast.Inspect(node, func(n ast.Node) bool {
		switch n.(type) {
		case *ast.IfStmt, *ast.ForStmt, *ast.RangeStmt, *ast.SwitchStmt,
			*ast.TypeSwitchStmt, *ast.SelectStmt, *ast.CaseClause, *ast.CommClause:
			complexity++
		case *ast.BinaryExpr:
			be := n.(*ast.BinaryExpr)
			if be.Op == token.LAND || be.Op == token.LOR {
				complexity++
			}
		}
		return true
	})

	return complexity, nil
}

func (a *Analyzer) calculateRiskScore(churnCount int, complexity float64, lines int) float64 {
	churnNorm := math.Min(float64(churnCount)/50.0, 1.0)
	complexityNorm := math.Min(complexity/a.cfg.Alert.ComplexityThreshold, 1.0)
	linesNorm := math.Min(float64(lines)/1000.0, 1.0)

	score := churnNorm*0.4 + complexityNorm*0.4 + linesNorm*0.2
	return math.Round(score*100) / 100
}

func (a *Analyzer) scanTechDebt(ctx context.Context, client *git.Client, commits []git.Commit, repoName string) []storage.TechDebtItem {
	var items []storage.TechDebtItem
	patterns := a.cfg.Analyzer.TechDebtPatterns

	fileSet := make(map[string]bool)
	for _, c := range commits {
		for _, f := range c.Files {
			fileSet[f.Path] = true
		}
	}

	for filePath := range fileSet {
		content, err := client.GetFileContent(ctx, "HEAD", filePath)
		if err != nil {
			continue
		}

		for i, line := range strings.Split(content, "\n") {
			for _, pattern := range patterns {
				if strings.Contains(line, pattern) {
					severity := "low"
					switch pattern {
					case "FIXME", "BUG", "HACK":
						severity = "high"
					case "TODO", "XXX":
						severity = "medium"
					}

					item := storage.TechDebtItem{
						ID:        generateTechDebtID(repoName, filePath, i+1, pattern),
						RepoName:  repoName,
						FilePath:  filePath,
						LineNum:   i + 1,
						Pattern:   pattern,
						Content:   strings.TrimSpace(line),
						CreatedAt: time.Now(),
						Severity:  severity,
						AgeDays:   0,
					}
					items = append(items, item)
					break
				}
			}
		}
	}

	return items
}

func generateTechDebtID(repo, path string, line int, pattern string) string {
	h := sha1.New()
	h.Write([]byte(fmt.Sprintf("%s:%s:%d:%s", repo, path, line, pattern)))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func (a *Analyzer) analyzePRHealth(ctx context.Context, client *git.Client, repoName string) []storage.PRHealth {
	reflog, err := client.Reflog(ctx, 1000)
	if err != nil {
		return nil
	}

	var prs []storage.PRHealth
	prMap := make(map[string]*storage.PRHealth)

	prPattern := regexp.MustCompile(`merge(?:d)?.*(?:pull request|pr)?\s*#?(\d+)`)

	for _, entry := range reflog {
		msg := strings.ToLower(entry.Message)
		matches := prPattern.FindStringSubmatch(msg)
		if len(matches) > 1 {
			prNum := matches[1]
			if prMap[prNum] == nil {
				prMap[prNum] = &storage.PRHealth{
					PRNumber: prNum,
					OpenedAt: entry.Timestamp,
				}
			}
			if strings.Contains(msg, "merged") {
				prMap[prNum].Merged = true
				prMap[prNum].MergedAt = entry.Timestamp
				prMap[prNum].ReviewDuration = entry.Timestamp.Sub(prMap[prNum].OpenedAt)
			}
		}
	}

	for _, pr := range prMap {
		prs = append(prs, *pr)
	}

	return prs
}

func (a *Analyzer) buildRepoRecord(info *git.RepoInfo, cfg *config.RepoConfig, commits []git.Commit, files []storage.FileRecord, contributors []storage.ContributorRecord) *storage.RepoRecord {
	record := &storage.RepoRecord{
		Name:         cfg.Name,
		Path:         cfg.Path,
		Mode:         cfg.Mode,
		Owner:        cfg.Owner,
		HeadBranch:   info.HeadBranch,
		HeadCommit:   info.HeadCommit,
		LastCommit:   info.LastCommit,
		FirstCommit:  info.FirstCommit,
		CommitCount:  info.CommitCount,
		Contributors: len(contributors),
		FilesCount:   len(files),
		AddedAt:      time.Now(),
		Disabled:     cfg.Disabled,
	}

	if !info.LastCommit.IsZero() {
		record.SilentDays = int(time.Since(info.LastCommit).Hours() / 24)
	}

	totalLines := 0
	for _, f := range files {
		totalLines += f.Lines
	}
	record.LinesOfCode = totalLines

	record.HealthScore, record.HealthLevel = a.calculateHealth(record, contributors, files)

	return record
}

func (a *Analyzer) calculateHealth(repo *storage.RepoRecord, contributors []storage.ContributorRecord, files []storage.FileRecord) (float64, string) {
	score := 100.0

	silentDays := repo.SilentDays
	if silentDays > a.cfg.Alert.SilentDays {
		score -= 40
	} else if silentDays > a.cfg.Alert.SilentDays/2 {
		score -= 20
	}

	if repo.Contributors < 2 {
		score -= 20
	} else if repo.Contributors < 3 {
		score -= 10
	}

	highRiskCount := 0
	for _, f := range files {
		if f.RiskScore >= 0.7 {
			highRiskCount++
		}
	}
	highRiskRatio := float64(highRiskCount) / float64(len(files)+1)
	score -= highRiskRatio * 30

	recentActivity := 0
	cutoff := time.Now().AddDate(0, 0, -30)
	for _, c := range contributors {
		if c.LastCommit.After(cutoff) {
			recentActivity++
		}
	}
	if recentActivity == 0 && len(contributors) > 0 {
		score -= 15
	}

	score = math.Max(0, math.Min(100, score))

	level := "good"
	if score < 50 {
		level = "critical"
	} else if score < 75 {
		level = "warning"
	}

	return score, level
}

func (a *Analyzer) generateAlerts(repo *storage.RepoRecord, repoName string) []*storage.AlertRecord {
	var alerts []*storage.AlertRecord

	if repo.SilentDays >= 60 {
		alerts = append(alerts, &storage.AlertRecord{
			RepoName: repoName,
			Type:     "silent_repo",
			Level:    "critical",
			Message:  fmt.Sprintf("Repository has been silent for %d days", repo.SilentDays),
			Owner:    repo.Owner,
		})
	} else if repo.SilentDays >= 30 {
		alerts = append(alerts, &storage.AlertRecord{
			RepoName: repoName,
			Type:     "silent_repo",
			Level:    "warning",
			Message:  fmt.Sprintf("Repository has been silent for %d days", repo.SilentDays),
			Owner:    repo.Owner,
		})
	}

	if repo.HealthScore < 50 {
		alerts = append(alerts, &storage.AlertRecord{
			RepoName: repoName,
			Type:     "health_score",
			Level:    "critical",
			Message:  fmt.Sprintf("Repository health score is critically low: %.0f/100", repo.HealthScore),
			Owner:    repo.Owner,
		})
	} else if repo.HealthScore < 75 {
		alerts = append(alerts, &storage.AlertRecord{
			RepoName: repoName,
			Type:     "health_score",
			Level:    "warning",
			Message:  fmt.Sprintf("Repository health score is below average: %.0f/100", repo.HealthScore),
			Owner:    repo.Owner,
		})
	}

	if repo.Contributors < 2 {
		alerts = append(alerts, &storage.AlertRecord{
			RepoName: repoName,
			Type:     "bus_factor",
			Level:    "warning",
			Message:  fmt.Sprintf("Low contributor count: %d", repo.Contributors),
			Owner:    repo.Owner,
		})
	}

	return alerts
}

func (a *Analyzer) GetStats(repoName string) (*storage.RepoStats, error) {
	return a.store.GetCommitStats(repoName, a.cfg.Analyzer.ChurnWindow)
}

func (a *Analyzer) GetAllStats() ([]storage.RepoStats, error) {
	repos, err := a.store.GetAllRepos()
	if err != nil {
		return nil, err
	}

	var stats []storage.RepoStats
	for _, r := range repos {
		s, err := a.GetStats(r.Name)
		if err != nil {
			continue
		}
		stats = append(stats, *s)
	}

	return stats, nil
}

func (a *Analyzer) GetContributorMatrix(repoName string) ([]git.ContributorMatrix, error) {
	commits, err := a.store.GetCommitsByRepo(repoName, 0)
	if err != nil {
		return nil, err
	}

	contribMap := make(map[string]*git.ContributorMatrix)
	now := time.Now()
	weekAgo := now.AddDate(0, 0, -7)
	monthAgo := now.AddDate(0, -1, 0)
	quarterAgo := now.AddDate(0, -3, 0)

	for _, c := range commits {
		key := c.AuthorEmail
		if key == "" {
			key = c.AuthorName
		}

		if contribMap[key] == nil {
			contribMap[key] = &git.ContributorMatrix{
				Contributor: c.AuthorName,
				Weekly:      make(map[string]int),
				Monthly:     make(map[string]int),
				Quarterly:   make(map[string]int),
			}
		}

		if c.AuthorDate.After(weekAgo) {
			week := c.AuthorDate.Format("2006-W01")
			contribMap[key].Weekly[week]++
		}
		if c.AuthorDate.After(monthAgo) {
			month := c.AuthorDate.Format("2006-01")
			contribMap[key].Monthly[month]++
		}
		if c.AuthorDate.After(quarterAgo) {
			quarter := fmt.Sprintf("%d-Q%d", c.AuthorDate.Year(), (c.AuthorDate.Month()-1)/3+1)
			contribMap[key].Quarterly[quarter]++
		}
	}

	matrix := make([]git.ContributorMatrix, 0, len(contribMap))
	for _, m := range contribMap {
		matrix = append(matrix, *m)
	}

	return matrix, nil
}

func (a *Analyzer) GetAllAlerts() ([]storage.AlertRecord, error) {
	return a.store.GetActiveAlerts()
}

func (a *Analyzer) ResolveAlert(id string) error {
	return a.store.ResolveAlert(id)
}

func ExpandPath(p string) string {
	if strings.HasPrefix(p, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return p
		}
		return filepath.Join(home, strings.TrimPrefix(p, "~/"))
	}
	return p
}
