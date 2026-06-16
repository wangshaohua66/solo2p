package main

import (
	"context"
	"fmt"
	"math"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"crossborder-scraper/notify"
	"crossborder-scraper/pipeline"
	"crossborder-scraper/scraper"
	_ "crossborder-scraper/scraper"
)

type Scheduler struct {
	config         *scraper.Config
	store          *pipeline.Store
	cleaner        *pipeline.Cleaner
	browserPool    *scraper.BrowserPool
	alertManager   *notify.AlertManager
	captchaHandler *scraper.CaptchaHandler
	cron           *cron.Cron
	scrapers       map[string]scraper.Scraper
	paused         bool
	pausedMu       sync.RWMutex
	activeTasks    map[string]*TaskStatus
	activeTasksMu  sync.RWMutex
}

type TaskStatus struct {
	TaskID     string
	Status     string
	StartTime  time.Time
	Progress   float64
	TotalItems int
	SiteStatus map[string]string
}

var globalScheduler *Scheduler

func main() {
	setupLogging()

	log.Info().Msg("starting cross-border scraper")

	cfg, err := scraper.LoadConfig("./config/sites.yaml")
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	store, err := pipeline.NewStore(cfg.Global.DBPath)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init store")
	}
	defer store.Close()

	cleaner := pipeline.NewCleaner()
	alertManager := notify.NewAlertManager()
	alertManager.AddNotifier(&notify.ConsoleNotifier{})

	browserPool := scraper.NewBrowserPool(
		cfg.Global.BrowserPoolSize,
		cfg.Global.UserAgents,
		cfg.Global.CookiesDir,
		cfg.Global.ScreenshotsDir,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := browserPool.Start(ctx); err != nil {
		log.Fatal().Err(err).Msg("failed to start browser pool")
	}
	defer browserPool.Close()

	captchaHandler := scraper.NewCaptchaHandler(
		cfg.Global.CaptchaWSPort,
		cfg.Global.ScreenshotsDir,
	)

	captchaHandler.SetTUISolver(func(site string, capType scraper.CaptchaType, screenshot []byte, pageURL string) (string, error) {
		respChan := make(chan string, 1)
		req := &CaptchaRequest{
			Site:         site,
			CapType:      string(capType),
			Screenshot:   screenshot,
			PageURL:      pageURL,
			ResponseChan: respChan,
		}
		ShowCaptchaPopup(req)

		select {
		case solution, ok := <-respChan:
			if !ok || solution == "" {
				return "", fmt.Errorf("captcha skipped or cancelled")
			}
			return solution, nil
		case <-time.After(3 * time.Minute):
			return "", fmt.Errorf("tui captcha timeout")
		}
	})

	if err := captchaHandler.Start(ctx); err != nil {
		log.Warn().Err(err).Msg("captcha handler start failed")
	}

	staticScraper := scraper.NewStaticScraper(cfg.Global.UserAgents[0])

	scrapers := scraper.GetAllScrapers(cfg.Sites, browserPool, staticScraper, cfg.Global.ScreenshotsDir)
	log.Info().Int("count", len(scrapers)).Msg("loaded scrapers")

	sched := &Scheduler{
		config:         cfg,
		store:          store,
		cleaner:        cleaner,
		browserPool:    browserPool,
		alertManager:   alertManager,
		captchaHandler: captchaHandler,
		cron:           cron.New(cron.WithSeconds()),
		scrapers:       scrapers,
		activeTasks:    make(map[string]*TaskStatus),
	}
	globalScheduler = sched

	_, err = sched.cron.AddFunc("0 */6 * * *", func() {
		log.Info().Msg("cron triggered: scheduled crawl")
		go sched.RunCrawlTask("scheduled")
	})
	if err != nil {
		log.Fatal().Err(err).Msg("failed to add cron job")
	}

	sched.cron.Start()
	log.Info().Msg("cron scheduler started (every 6 hours)")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	log.Info().Msg("starting initial crawl task")
	go sched.RunCrawlTask("initial")

	if err := runTUI(sched); err != nil {
		log.Error().Err(err).Msg("tui error")
	}

	log.Info().Msg("shutting down...")
	sched.cron.Stop()
}

func setupLogging() {
	logDir := "./data/logs"
	os.MkdirAll(logDir, 0755)

	if err := cleanupOldLogs(logDir, 30); err != nil {
		log.Warn().Err(err).Msg("cleanup old logs failed")
	}

	go logRotationWorker(logDir, 30)

	consoleWriter := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
	}

	logFile := filepath.Join(logDir, time.Now().Format("2006-01-02")+".log")
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Warn().Err(err).Msg("failed to open log file")
		log.Logger = log.Output(consoleWriter)
		return
	}

	multi := zerolog.MultiLevelWriter(consoleWriter, file)
	log.Logger = zerolog.New(multi).With().Timestamp().Caller().Logger()
}

func logRotationWorker(logDir string, retentionDays int) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		if err := cleanupOldLogs(logDir, retentionDays); err != nil {
			log.Warn().Err(err).Msg("periodic log cleanup failed")
		}
	}
}

func cleanupOldLogs(logDir string, retentionDays int) error {
	files, err := filepath.Glob(filepath.Join(logDir, "*.log"))
	if err != nil {
		return fmt.Errorf("glob log files: %w", err)
	}

	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	deletedCount := 0

	for _, file := range files {
		info, statErr := os.Stat(file)
		if statErr != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			if delErr := os.Remove(file); delErr != nil {
				log.Warn().Err(delErr).Str("file", file).Msg("failed to delete old log")
				continue
			}
			deletedCount++
			log.Info().Str("file", file).Time("mod_time", info.ModTime()).Msg("deleted old log file")
		}
	}

	if deletedCount > 0 {
		log.Info().Int("deleted", deletedCount).Int("retention_days", retentionDays).Msg("old log cleanup complete")
	}

	return nil
}

func (s *Scheduler) RunCrawlTask(taskType string) {
	taskID := fmt.Sprintf("%s-%d", taskType, time.Now().Unix())
	log.Info().Str("task_id", taskID).Str("type", taskType).Msg("starting crawl task")

	s.activeTasksMu.Lock()
	s.activeTasks[taskID] = &TaskStatus{
		TaskID:     taskID,
		Status:     "running",
		StartTime:  time.Now(),
		SiteStatus: make(map[string]string),
	}
	s.activeTasksMu.Unlock()

	defer func() {
		s.activeTasksMu.Lock()
		delete(s.activeTasks, taskID)
		s.activeTasksMu.Unlock()
	}()

	startTime := time.Now()
	totalSites := len(s.scrapers)

	if err := s.store.CreateTaskReport(taskID, startTime, totalSites); err != nil {
		log.Warn().Err(err).Msg("create task report failed")
	}

	var wg sync.WaitGroup
	var totalProducts int
	var successCount, failCount, skipCount int
	var mu sync.Mutex

	siteCount := 0
	for siteName, siteScraper := range s.scrapers {
		s.activeTasksMu.Lock()
		if ts, ok := s.activeTasks[taskID]; ok {
			ts.SiteStatus[siteName] = "pending"
		}
		s.activeTasksMu.Unlock()

		wg.Add(1)
		go func(name string, sc scraper.Scraper) {
			defer wg.Done()

			s.activeTasksMu.Lock()
			if ts, ok := s.activeTasks[taskID]; ok {
				ts.SiteStatus[name] = "crawling"
			}
			s.activeTasksMu.Unlock()

			siteReport := s.crawlSite(taskID, name, sc)

			mu.Lock()
			totalProducts += siteReport.TotalItems
			successCount += siteReport.SuccessCount
			failCount += siteReport.FailCount
			skipCount += siteReport.SkipCount
			siteCount++
			mu.Unlock()

			var errorMsg string
			if siteReport.Error != nil {
				errorMsg = siteReport.Error.Error()
			}
			if err := s.store.AddSiteReport(taskID, &pipeline.SiteReport{
				SiteName:     siteReport.SiteName,
				SuccessCount: siteReport.SuccessCount,
				FailCount:    siteReport.FailCount,
				SkipCount:    siteReport.SkipCount,
				TotalItems:   siteReport.TotalItems,
				DurationMs:   siteReport.Duration.Milliseconds(),
				ErrorMsg:     errorMsg,
			}); err != nil {
				log.Warn().Err(err).Msg("add site report failed")
			}

			s.activeTasksMu.Lock()
			if ts, ok := s.activeTasks[taskID]; ok {
				ts.SiteStatus[name] = "done"
				ts.Progress = float64(siteCount) / float64(totalSites)
				ts.TotalItems = totalProducts
			}
			s.activeTasksMu.Unlock()
		}(siteName, siteScraper)
	}

	wg.Wait()

	endTime := time.Now()
	status := "completed"
	if failCount > 0 && successCount == 0 {
		status = "failed"
	} else if failCount > 0 {
		status = "partial"
	}

	if err := s.store.FinishTaskReport(taskID, endTime, successCount, failCount, skipCount, totalProducts, status); err != nil {
		log.Warn().Err(err).Msg("finish task report failed")
	}

	reportsDir := filepath.Join(filepath.Dir(s.config.Global.DBPath), "reports")
	if reportPath, err := s.store.ExportTaskReportJSON(taskID, reportsDir); err != nil {
		log.Warn().Err(err).Msg("export task report to JSON failed")
	} else {
		log.Info().Str("report_path", reportPath).Msg("task report exported")
	}

	s.checkAndArchiveDB()

	log.Info().
		Str("task_id", taskID).
		Int("total_products", totalProducts).
		Int("success", successCount).
		Int("failed", failCount).
		Str("duration", endTime.Sub(startTime).String()).
		Msg("crawl task completed")

	if failCount > 0 {
		s.alertManager.Warning(
			"Crawl Task Partially Failed",
			fmt.Sprintf("%d sites failed out of %d", failCount, totalSites),
			"",
		)
	}
}

func (s *Scheduler) crawlSite(taskID string, siteName string, sc scraper.Scraper) *scraper.ScrapeResult {
	result := &scraper.ScrapeResult{
		SiteName: siteName,
	}

	loginCtx, loginCancel := context.WithTimeout(context.Background(), 130*time.Second)
	if baseScraper, ok := sc.(interface {
		EnsureLoggedIn(ctx context.Context) error
	}); ok {
		if err := baseScraper.EnsureLoggedIn(loginCtx); err != nil {
			loginCancel()
			result.Error = fmt.Errorf("ensure login failed: %w", err)
			log.Error().Err(err).Str("site", siteName).Msg("login check failed, skipping site")
			return result
		}
	}
	loginCancel()

	categories := s.config.Global.Categories
	if len(categories) == 0 {
		categories = []string{"electronics"}
	}

	maxRetries := s.config.Global.MaxRetries
	if maxRetries == 0 {
		maxRetries = 3
	}

	backoffBase := s.config.Global.RetryBackoffBase
	if backoffBase == 0 {
		backoffBase = 2
	}

	maxBackoff := s.config.Global.MaxRetryBackoff
	if maxBackoff == 0 {
		maxBackoff = 60
	}

	timeout := time.Duration(s.config.Global.PageTimeoutSeconds) * time.Second
	if timeout == 0 {
		timeout = 15 * time.Second
	}

	for _, category := range categories {
		s.pausedMu.RLock()
		paused := s.paused
		s.pausedMu.RUnlock()
		if paused {
			log.Info().Str("site", siteName).Msg("task paused, waiting")
			for s.isPaused() {
				time.Sleep(1 * time.Second)
			}
		}

		progress, _ := s.store.GetCrawlProgress(siteName, category)

		var lastResult *scraper.ScrapeResult
		var err error

		for attempt := 1; attempt <= maxRetries; attempt++ {
			opts := &scraper.ScrapeOptions{
				MaxPages:  s.config.Sites[siteName].Pagination.MaxPages,
				StartPage: progress.LastPage + 1,
				Timeout:   timeout,
			}

			ctx := context.Background()
			lastResult, err = sc.Scrape(ctx, category, opts)

			if err == nil && lastResult.FailCount == 0 {
				break
			}

			if attempt < maxRetries {
				backoffSec := int(math.Pow(float64(backoffBase), float64(attempt)))
				if backoffSec > maxBackoff {
					backoffSec = maxBackoff
				}
				log.Warn().
					Str("site", siteName).
					Int("attempt", attempt).
					Int("backoff_sec", backoffSec).
					Err(err).
					Msg("scrape failed, retrying")
				time.Sleep(time.Duration(backoffSec) * time.Second)
			}
		}

		if lastResult != nil {
			if len(lastResult.Products) > 0 {
				cleaned := s.cleaner.CleanBatch(lastResult.Products)
				if count, err := s.store.BulkUpsertProducts(cleaned); err != nil {
					log.Error().Err(err).Str("site", siteName).Msg("bulk upsert failed")
				} else {
					log.Info().Str("site", siteName).Int("count", count).Msg("products saved")
				}
			}

			progress.LastPage = lastResult.LastPage
			progress.LastCrawlAt = time.Now()
			progress.TotalItems += len(lastResult.Products)
			progress.Status = "completed"
			s.store.UpdateCrawlProgress(progress)

			result.Products = append(result.Products, lastResult.Products...)
			result.TotalItems += lastResult.TotalItems
			if lastResult.Error != nil {
				result.FailCount++
				result.Error = lastResult.Error
			} else {
				result.SuccessCount++
			}
		} else {
			result.FailCount++
			if err != nil {
				result.Error = err
			}
		}
	}

	if result.FailCount > 0 {
		s.alertManager.Error(
			"Site Crawl Failed",
			fmt.Sprintf("Site %s failed with %d errors", siteName, result.FailCount),
			siteName,
		)
	}

	return result
}

func (s *Scheduler) isPaused() bool {
	s.pausedMu.RLock()
	defer s.pausedMu.RUnlock()
	return s.paused
}

func (s *Scheduler) Pause() {
	s.pausedMu.Lock()
	defer s.pausedMu.Unlock()
	s.paused = true
	log.Info().Msg("scheduler paused")
}

func (s *Scheduler) Resume() {
	s.pausedMu.Lock()
	defer s.pausedMu.Unlock()
	s.paused = false
	log.Info().Msg("scheduler resumed")
}

func (s *Scheduler) checkAndArchiveDB() {
	dbSize, err := s.store.GetDBSize()
	if err != nil {
		return
	}

	maxSize := int64(5 * 1024 * 1024 * 1024)
	if dbSize > maxSize {
		log.Info().Int64("size_bytes", dbSize).Msg("DB size exceeded threshold, archiving")
		affected, err := s.store.ArchiveOldData(90)
		if err != nil {
			log.Error().Err(err).Msg("archive failed")
		} else {
			log.Info().Int64("records_archived", affected).Msg("archive completed")
		}
	}
}

func (s *Scheduler) GetActiveTask() *TaskStatus {
	s.activeTasksMu.RLock()
	defer s.activeTasksMu.RUnlock()
	for _, t := range s.activeTasks {
		return t
	}
	return nil
}
