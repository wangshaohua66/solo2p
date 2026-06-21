package scheduler

import (
	"container/heap"
	"sync"
	"time"

	"copyright-monitor/internal/collector"
	"copyright-monitor/internal/models"
	"copyright-monitor/internal/parser"
	"copyright-monitor/internal/storage"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

type PriorityQueue []*MonitorJob

type MonitorJob struct {
	Task     *models.MonitorTask
	Priority int
	Index    int
}

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	if pq[i].Priority == pq[j].Priority {
		return pq[i].Task.NextRunTime.Before(pq[j].Task.NextRunTime)
	}
	return pq[i].Priority > pq[j].Priority
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].Index = i
	pq[j].Index = j
}

func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*MonitorJob)
	item.Index = n
	*pq = append(*pq, item)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	item.Index = -1
	*pq = old[0 : n-1]
	return item
}

type Scheduler struct {
	cron        *cron.Cron
	logger      *zap.Logger
	jobQueue    PriorityQueue
	mu          sync.Mutex
	running     bool
	activeTasks int
	stopChan    chan struct{}
	maxWorkers  int
}

var globalScheduler *Scheduler

func NewScheduler(logger *zap.Logger) *Scheduler {
	return &Scheduler{
		cron:       cron.New(),
		logger:     logger,
		jobQueue:   make(PriorityQueue, 0),
		maxWorkers: 5,
		stopChan:   make(chan struct{}),
	}
}

func Init(logger *zap.Logger) {
	globalScheduler = NewScheduler(logger)
}

func Global() *Scheduler {
	return globalScheduler
}

func (s *Scheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return nil
	}

	s.running = true
	s.cron.Start()

	go s.workerLoop()

	s.logger.Info("Scheduler started")
	return nil
}

func (s *Scheduler) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return nil
	}

	s.running = false
	close(s.stopChan)

	ctx := s.cron.Stop()
	<-ctx.Done()

	s.logger.Info("Scheduler stopped")
	return nil
}

func (s *Scheduler) LoadTasks() error {
	tasks, err := storage.Global().GetPendingTasks()
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	heap.Init(&s.jobQueue)

	for _, task := range tasks {
		job := &MonitorJob{
			Task:     task,
			Priority: int(task.Priority),
		}
		heap.Push(&s.jobQueue, job)
	}

	s.logger.Info("Tasks loaded into scheduler",
		zap.Int("count", len(tasks)),
	)

	return nil
}

func (s *Scheduler) AddTask(task *models.MonitorTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job := &MonitorJob{
		Task:     task,
		Priority: int(task.Priority),
	}
	heap.Push(&s.jobQueue, job)

	if task.CronExpr != "" {
		_, err := s.cron.AddFunc(task.CronExpr, func() {
			s.triggerTask(task.ID)
		})
		if err != nil {
			return err
		}
	}

	s.logger.Info("Task added to scheduler",
		zap.Int64("task_id", task.ID),
		zap.String("work_title", task.WorkTitle),
	)

	return nil
}

func (s *Scheduler) triggerTask(taskID int64) {
	s.logger.Debug("Cron triggered task", zap.Int64("task_id", taskID))
	s.mu.Lock()

	for _, job := range s.jobQueue {
		if job.Task.ID == taskID {
			job.Priority = int(models.PriorityUrgent)
			heap.Fix(&s.jobQueue, job.Index)
			break
		}
	}

	s.mu.Unlock()
}

func (s *Scheduler) workerLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.processJobs()
		}
	}
}

func (s *Scheduler) processJobs() {
	s.mu.Lock()
	if s.jobQueue.Len() == 0 || s.activeTasks >= s.maxWorkers {
		s.mu.Unlock()
		return
	}

	job := heap.Pop(&s.jobQueue).(*MonitorJob)
	s.activeTasks++
	s.mu.Unlock()

	go func(j *MonitorJob) {
		defer func() {
			s.mu.Lock()
			s.activeTasks--
			s.mu.Unlock()
		}()

		s.executeTask(j.Task)
	}(job)
}

func (s *Scheduler) executeTask(task *models.MonitorTask) {
	s.logger.Info("Executing monitor task",
		zap.Int64("task_id", task.ID),
		zap.String("work_title", task.WorkTitle),
	)

	task.Status = "running"
	task.LastRunTime = time.Now()
	storage.Global().UpdateTask(task)

	var totalItems int
	var totalInfringements int
	var failedPlatforms int

	for _, platformID := range task.PlatformIDs {
		platform, err := storage.Global().GetPlatform(platformID)
		if err != nil || platform == nil || !platform.Enabled {
			continue
		}

		log := &models.MonitorLog{
			TaskID:      task.ID,
			PlatformID:  platformID,
			PlatformName: platform.Name,
			StartTime:   time.Now(),
			Status:      "running",
		}

		contents, err := collector.GetManager().CollectPlatform(platformID, 3)
		log.EndTime = time.Now()

		if err != nil {
			log.Status = "failed"
			log.ErrorMessage = err.Error()
			failedPlatforms++
			s.logger.Error("Platform collection failed",
				zap.String("platform", platform.Name),
				zap.Error(err),
			)
		} else {
			log.Status = "success"
			log.ItemsFound = len(contents)
			totalItems += len(contents)

			clues, err := parser.Global().ProcessCrawledContents(contents, task.ID)
			if err != nil {
				s.logger.Error("Content parsing failed", zap.Error(err))
			}
			log.InfringementsFound = len(clues)
			totalInfringements += len(clues)
		}

		storage.Global().AddMonitorLog(log)
	}

	task.Status = "pending"
	task.FailureCount = 0
	if failedPlatforms > 0 {
		task.FailureCount++
	}

	now := time.Now()
	switch task.Priority {
	case models.PriorityHigh, models.PriorityUrgent:
		task.NextRunTime = now.Add(24 * time.Hour)
	case models.PriorityMedium:
		task.NextRunTime = now.Add(3 * 24 * time.Hour)
	default:
		task.NextRunTime = now.Add(7 * 24 * time.Hour)
	}

	storage.Global().UpdateTask(task)

	s.logger.Info("Task completed",
		zap.Int64("task_id", task.ID),
		zap.Int("items_found", totalItems),
		zap.Int("infringements", totalInfringements),
		zap.Int("failed_platforms", failedPlatforms),
	)
}

func (s *Scheduler) RunAllNow() error {
	tasks, err := storage.Global().GetPendingTasks()
	if err != nil {
		return err
	}

	s.logger.Info("Running all tasks immediately",
		zap.Int("task_count", len(tasks)),
	)

	for _, task := range tasks {
		go s.executeTask(task)
	}

	return nil
}

func (s *Scheduler) RunTaskNow(taskID int64) error {
	task, err := s.getTaskByID(taskID)
	if err != nil {
		return err
	}

	if task == nil {
		return nil
	}

	go s.executeTask(task)
	return nil
}

func (s *Scheduler) getTaskByID(taskID int64) (*models.MonitorTask, error) {
	tasks, err := storage.Global().GetPendingTasks()
	if err != nil {
		return nil, err
	}

	for _, t := range tasks {
		if t.ID == taskID {
			return t, nil
		}
	}

	return nil, nil
}

func (s *Scheduler) GetActiveTaskCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.activeTasks
}

func (s *Scheduler) GetQueuedTaskCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.jobQueue.Len()
}

func GenerateDefaultTasks() error {
	works, err := storage.Global().GetAllWorks()
	if err != nil {
		return err
	}

	platforms, err := storage.Global().GetEnabledPlatforms()
	if err != nil {
		return err
	}

	var platformIDs []int64
	for _, p := range platforms {
		platformIDs = append(platformIDs, p.ID)
	}

	for _, work := range works {
		var priority models.Priority
		var cronExpr string

		if work.IsHot || work.InfringementCount > 5 {
			priority = models.PriorityHigh
			cronExpr = "0 0 */1 * *"
		} else if work.InfringementCount > 0 {
			priority = models.PriorityMedium
			cronExpr = "0 0 */3 * *"
		} else {
			priority = models.PriorityLow
			cronExpr = "0 0 */7 * *"
		}

		task := &models.MonitorTask{
			WorkID:      work.ID,
			WorkTitle:   work.Title,
			WorkType:    work.WorkType,
			Priority:    priority,
			PlatformIDs: platformIDs,
			CronExpr:    cronExpr,
			NextRunTime: time.Now().Add(1 * time.Hour),
			Status:      "pending",
		}

		_, err := storage.Global().AddTask(task)
		if err != nil {
			return err
		}
	}

	return nil
}
