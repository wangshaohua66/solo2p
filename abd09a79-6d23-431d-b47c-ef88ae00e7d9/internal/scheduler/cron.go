package scheduler

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"bankrupt-monitor/internal/config"
	"bankrupt-monitor/internal/crawler"
	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/notify"
	"bankrupt-monitor/internal/parser"
	"bankrupt-monitor/internal/store"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

type Scheduler struct {
	cfg        *config.AppConfig
	logger     *zap.Logger
	store      *store.Store
	crawler    *crawler.Engine
	notifier   *notify.Dispatcher
	cron       *cron.Cron
	running    bool
	mu         sync.Mutex
	stats      map[string]*model.CrawlStats
	onProgress func(court string, stats *model.CrawlStats, currentURL string)
}

func NewScheduler(cfg *config.AppConfig, store *store.Store, engine *crawler.Engine, disp *notify.Dispatcher, log *zap.Logger) *Scheduler {
	c := cron.New(cron.WithParser(cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow,
	)))
	return &Scheduler{
		cfg:     cfg,
		logger:  log,
		store:   store,
		crawler: engine,
		notifier: disp,
		cron:    c,
		stats:   make(map[string]*model.CrawlStats),
	}
}

func (s *Scheduler) SetProgressHandler(fn func(court string, stats *model.CrawlStats, currentURL string)) {
	s.onProgress = fn
}

func (s *Scheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		return nil
	}

	if _, err := s.cron.AddFunc(s.cfg.Scheduler.IncrementalCron, func() {
		s.logger.Info("incremental crawl triggered by cron")
		if err := s.RunIncremental(context.Background()); err != nil {
			s.logger.Error("incremental crawl failed", zap.Error(err))
		}
	}); err != nil {
		return fmt.Errorf("schedule incremental: %w", err)
	}

	if _, err := s.cron.AddFunc(s.cfg.Scheduler.FullCron, func() {
		s.logger.Info("full crawl triggered by cron")
		if err := s.RunFull(context.Background()); err != nil {
			s.logger.Error("full crawl failed", zap.Error(err))
		}
	}); err != nil {
		return fmt.Errorf("schedule full: %w", err)
	}

	s.cron.Start()
	s.running = true
	s.logger.Info("scheduler started",
		zap.String("incremental_cron", s.cfg.Scheduler.IncrementalCron),
		zap.String("full_cron", s.cfg.Scheduler.FullCron),
	)
	return nil
}

func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running {
		return
	}
	ctx := s.cron.Stop()
	<-ctx.Done()
	s.running = false
	s.logger.Info("scheduler stopped")
}

func (s *Scheduler) RunIncremental(ctx context.Context) error {
	return s.runCourts(ctx, false)
}

func (s *Scheduler) RunFull(ctx context.Context) error {
	return s.runCourts(ctx, true)
}

func (s *Scheduler) runCourts(ctx context.Context, fullScan bool) error {
	courts := s.enabledCourts()
	if len(courts) == 0 {
		s.logger.Warn("no courts configured")
		return nil
	}

	s.logger.Info("starting crawl",
		zap.Bool("full_scan", fullScan),
		zap.Int("courts", len(courts)),
	)

	var wg sync.WaitGroup
	sem := make(chan struct{}, s.cfg.Crawler.WorkerCount)
	errCh := make(chan error, len(courts))

	for _, court := range courts {
		wg.Add(1)
		sem <- struct{}{}
		go func(c config.CourtConfig) {
			defer wg.Done()
			defer func() { <-sem }()

			select {
			case <-ctx.Done():
				return
			default:
			}

			stats, err := s.crawler.Crawl(ctx, c, fullScan)
			if err != nil {
				s.logger.Error("court crawl failed",
					zap.String("court", c.Name),
					zap.Error(err),
				)
				errCh <- fmt.Errorf("%s: %w", c.Name, err)
				return
			}

			s.mu.Lock()
			s.stats[c.Name] = stats
			s.mu.Unlock()

			s.logger.Info("court crawl finished",
				zap.String("court", c.Name),
				zap.Int64("processed", stats.ProcessedCount),
				zap.Int64("new", stats.NewCount),
				zap.Int64("errors", stats.ErrorCount),
				zap.String("elapsed", stats.Elapsed),
			)

			if fullScan {
				s.checkWithdrawn(ctx, c.Name)
			}

			if s.onProgress != nil {
				s.onProgress(c.Name, stats, s.crawler.CurrentURL())
			}
		}(court)
	}

	wg.Wait()
	close(errCh)

	var errs []string
	for err := range errCh {
		if err != nil {
			errs = append(errs, err.Error())
		}
	}

	s.dispatchHits(ctx)

	if len(errs) > 0 {
		return fmt.Errorf("crawl errors: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (s *Scheduler) enabledCourts() []config.CourtConfig {
	result := make([]config.CourtConfig, 0)
	for _, c := range s.cfg.Courts {
		if c.Enabled {
			result = append(result, c)
		}
	}
	return result
}

func (s *Scheduler) dispatchHits(ctx context.Context) {
	subs, err := s.store.GetSubscriptions(true)
	if err != nil {
		s.logger.Error("get subscriptions failed", zap.Error(err))
		return
	}
	if len(subs) == 0 {
		return
	}

	q := &store.CaseQuery{
		HitSubscription: boolPtr(true),
		NotNotifiedOnly: true,
		PageSize:        500,
	}
	cases, _, err := s.store.QueryCases(q)
	if err != nil {
		s.logger.Error("query hit cases failed", zap.Error(err))
		return
	}

	for i := range cases {
		c := &cases[i]
		for _, sub := range subs {
			if parser.MatchSubscription(&sub, c) {
				if s.notifier == nil {
					continue
				}
				anns, _ := s.getCaseAnnouncements(c.ID)
				if len(anns) == 0 {
					continue
				}
				n := s.notifier.BuildNotification(c, &anns[0])
				if sub.Channels != "" {
					n.Channels = parseChannels(sub.Channels)
				}
				if err := s.notifier.Dispatch(ctx, n); err != nil {
					s.logger.Warn("notification dispatch failed",
						zap.Uint64("case_id", c.ID),
						zap.Error(err),
					)
				} else {
					if err := s.store.MarkCaseNotified(c.ID); err != nil {
						s.logger.Warn("mark notified failed",
							zap.Uint64("case_id", c.ID),
							zap.Error(err),
						)
					}
				}
				break
			}
		}
	}
}

func (s *Scheduler) getCaseAnnouncements(caseID uint64) ([]model.Announcement, error) {
	c, err := s.store.GetCaseByID(caseID)
	if err != nil {
		return nil, err
	}
	return c.Announcements, nil
}

func (s *Scheduler) Stats() map[string]*model.CrawlStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stats
}

func boolPtr(b bool) *bool { return &b }

func parseChannels(s string) []notify.Channel {
	parts := splitAndTrim(s, ",")
	result := make([]notify.Channel, 0, len(parts))
	for _, p := range parts {
		switch p {
		case "webhook":
			result = append(result, notify.ChannelWebhook)
		case "wechat":
			result = append(result, notify.ChannelWechat)
		case "email":
			result = append(result, notify.ChannelEmail)
		case "sms":
			result = append(result, notify.ChannelSMS)
		}
	}
	return result
}

func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func (s *Scheduler) checkWithdrawn(ctx context.Context, courtName string) {
	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	fps, err := s.store.GetAnnouncementFingerprints(courtName, cutoff)
	if err != nil {
		s.logger.Error("get fingerprints for withdrawal check failed",
			zap.String("court", courtName),
			zap.Error(err),
		)
		return
	}

	count, err := s.store.MarkAnnouncementsWithdrawn(courtName, cutoff, fps)
	if err != nil {
		s.logger.Error("mark withdrawn failed",
			zap.String("court", courtName),
			zap.Error(err),
		)
		return
	}
	if count > 0 {
		s.logger.Info("withdrawn announcements detected",
			zap.String("court", courtName),
			zap.Int64("count", count),
		)
	}
}

var _ = time.Second
