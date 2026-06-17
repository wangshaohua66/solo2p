package scheduler

import (
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"

	"price-monitor/config"
	"price-monitor/crawler"
	"price-monitor/logger"
	"price-monitor/storage"
)

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
)

type ScheduledTask struct {
	ID          int64
	SKUId       string
	SiteId      string
	Keyword     string
	CronExpr    string
	Enabled     bool
	Status      TaskStatus
	EntryID     cron.EntryID
	LastRunAt   time.Time
	NextRunAt   time.Time
	RunCount    int
	FailCount   int
}

type TaskScheduler struct {
	cfg        *config.AppConfig
	db         *storage.Database
	engine     *crawler.Engine
	cron       *cron.Cron
	tasks      map[int64]*ScheduledTask
	mu         sync.RWMutex
	running    bool
	onComplete func(records []*storage.PriceRecord)
}

func NewTaskScheduler(cfg *config.AppConfig, db *storage.Database, engine *crawler.Engine) *TaskScheduler {
	return &TaskScheduler{
		cfg:    cfg,
		db:     db,
		engine: engine,
		cron:   cron.New(cron.WithSeconds(), cron.WithChain(cron.SkipIfStillRunning(cron.DefaultLogger))),
		tasks:  make(map[int64]*ScheduledTask),
	}
}

func (ts *TaskScheduler) OnComplete(fn func(records []*storage.PriceRecord)) {
	ts.onComplete = fn
}

func (ts *TaskScheduler) LoadFromConfig() error {
	sites := ts.cfg.GetEnabledSites()
	for _, sku := range ts.cfg.SKUs {
		for _, site := range sites {
			if len(sku.Keywords) == 0 {
				continue
			}
			keyword := sku.Keywords[0]
			task := &storage.MonitorTask{
				SKUId:    sku.SKUId,
				SiteId:   site.ID,
				Keyword:  keyword,
				CronExpr: "0 */2 * * * *",
				Enabled:  true,
			}
			ts.db.SaveMonitorTask(task)
		}
	}
	return nil
}

func (ts *TaskScheduler) LoadTasks() error {
	dbTasks, err := ts.db.GetMonitorTasks()
	if err != nil {
		return fmt.Errorf("load tasks from db failed: %w", err)
	}

	for _, t := range dbTasks {
		site, exists := ts.cfg.GetSiteByID(t.SiteId)
		if !exists || !site.Enabled {
			continue
		}
		sku, exists := ts.cfg.GetSKUByID(t.SKUId)
		if !exists {
			continue
		}

		task := &ScheduledTask{
			ID:        t.ID,
			SKUId:     t.SKUId,
			SiteId:    t.SiteId,
			Keyword:   t.Keyword,
			CronExpr:  t.CronExpr,
			Enabled:   t.Enabled,
			Status:    TaskStatusPending,
			RunCount:  0,
			FailCount: 0,
		}
		if t.LastRunAt.Valid {
			task.LastRunAt = t.LastRunAt.Time
		}

		if err := ts.scheduleTask(task, sku, site); err != nil {
			logger.Warn("Failed to schedule task %d: %v", t.ID, err)
			continue
		}

		ts.mu.Lock()
		ts.tasks[task.ID] = task
		ts.mu.Unlock()
	}

	logger.Info("Loaded %d scheduled tasks", len(ts.tasks))
	return nil
}

func (ts *TaskScheduler) scheduleTask(task *ScheduledTask, sku config.SKUConfig, site config.SiteConfig) error {
	if task.CronExpr == "" {
		task.CronExpr = "0 */2 * * * *"
	}

	entryID, err := ts.cron.AddFunc(task.CronExpr, func() {
		ts.runTask(task, sku, site)
	})
	if err != nil {
		return fmt.Errorf("add cron job failed: %w", err)
	}

	task.EntryID = entryID
	entries := ts.cron.Entries()
	for _, e := range entries {
		if e.ID == entryID {
			task.NextRunAt = e.Next
			break
		}
	}

	return nil
}

func (ts *TaskScheduler) runTask(task *ScheduledTask, sku config.SKUConfig, site config.SiteConfig) {
	ts.mu.Lock()
	task.Status = TaskStatusRunning
	task.LastRunAt = time.Now()
	ts.mu.Unlock()

	logger.Info("Starting scheduled task: SKU=%s Site=%s Keyword=%s", sku.SKUId, site.Name, task.Keyword)

	crawlTask := &crawler.CrawlTask{
		SKU:     sku,
		Site:    site,
		Keyword: task.Keyword,
	}

	result := ts.engine.CrawlWithRetry(crawlTask)

	ts.mu.Lock()
	task.RunCount++
	if result.Success {
		task.Status = TaskStatusCompleted
	} else {
		task.Status = TaskStatusFailed
		task.FailCount++
	}
	ts.mu.Unlock()

	if result.Success && result.Record != nil {
		ts.db.SavePriceRecord(result.Record)
		if ts.onComplete != nil {
			ts.onComplete([]*storage.PriceRecord{result.Record})
		}
		logger.Info("Scheduled task completed: SKU=%s Site=%s Price=%.2f", sku.SKUId, site.Name, result.Record.PriceFinal)
	} else {
		logger.Warn("Scheduled task failed: SKU=%s Site=%s Error=%v", sku.SKUId, site.Name, result.Error)
	}

	entries := ts.cron.Entries()
	for _, e := range entries {
		if e.ID == task.EntryID {
			ts.mu.Lock()
			task.NextRunAt = e.Next
			ts.mu.Unlock()
			break
		}
	}

	ts.db.UpdateTaskRunTime(task.ID, task.LastRunAt, task.NextRunAt)
}

func (ts *TaskScheduler) Start() {
	if ts.running {
		return
	}
	ts.running = true
	ts.cron.Start()
	logger.Info("Task scheduler started with %d tasks", len(ts.tasks))
}

func (ts *TaskScheduler) Stop() {
	if !ts.running {
		return
	}
	ctx := ts.cron.Stop()
	<-ctx.Done()
	ts.running = false
	logger.Info("Task scheduler stopped")
}

func (ts *TaskScheduler) GetTasks() []*ScheduledTask {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	result := make([]*ScheduledTask, 0, len(ts.tasks))
	for _, t := range ts.tasks {
		result = append(result, t)
	}
	return result
}

func (ts *TaskScheduler) GetTask(id int64) (*ScheduledTask, bool) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	t, ok := ts.tasks[id]
	return t, ok
}

func (ts *TaskScheduler) GetStats() map[string]interface{} {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	total := len(ts.tasks)
	running := 0
	completed := 0
	failed := 0
	totalRuns := 0
	totalFails := 0

	for _, t := range ts.tasks {
		switch t.Status {
		case TaskStatusRunning:
			running++
		case TaskStatusCompleted:
			completed++
		case TaskStatusFailed:
			failed++
		}
		totalRuns += t.RunCount
		totalFails += t.FailCount
	}

	return map[string]interface{}{
		"total":        total,
		"running":      running,
		"completed":    completed,
		"failed":       failed,
		"total_runs":   totalRuns,
		"total_fails":  totalFails,
		"is_running":   ts.running,
	}
}

func (ts *TaskScheduler) AddTask(skuId, siteId, keyword, cronExpr string) (int64, error) {
	site, exists := ts.cfg.GetSiteByID(siteId)
	if !exists {
		return 0, fmt.Errorf("site %s not found", siteId)
	}
	sku, exists := ts.cfg.GetSKUByID(skuId)
	if !exists {
		return 0, fmt.Errorf("sku %s not found", skuId)
	}
	if keyword == "" {
		if len(sku.Keywords) > 0 {
			keyword = sku.Keywords[0]
		} else {
			return 0, fmt.Errorf("keyword is required")
		}
	}
	if cronExpr == "" {
		cronExpr = "0 */2 * * * *"
	}

	dbTask := &storage.MonitorTask{
		SKUId:    skuId,
		SiteId:   siteId,
		Keyword:  keyword,
		CronExpr: cronExpr,
		Enabled:  true,
	}

	id, err := ts.db.SaveMonitorTask(dbTask)
	if err != nil {
		return 0, err
	}

	task := &ScheduledTask{
		ID:       id,
		SKUId:    skuId,
		SiteId:   siteId,
		Keyword:  keyword,
		CronExpr: cronExpr,
		Enabled:  true,
		Status:   TaskStatusPending,
	}

	if err := ts.scheduleTask(task, sku, site); err != nil {
		return id, err
	}

	ts.mu.Lock()
	ts.tasks[id] = task
	ts.mu.Unlock()

	logger.Info("Added scheduled task: id=%d sku=%s site=%s", id, skuId, siteId)
	return id, nil
}

func (ts *TaskScheduler) RemoveTask(id int64) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	task, ok := ts.tasks[id]
	if !ok {
		return fmt.Errorf("task %d not found", id)
	}

	ts.cron.Remove(task.EntryID)
	delete(ts.tasks, id)
	logger.Info("Removed scheduled task: id=%d", id)
	return nil
}
