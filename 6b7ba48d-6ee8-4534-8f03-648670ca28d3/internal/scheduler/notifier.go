package scheduler

import (
	"craftbrew-tracker/internal/config"
	"craftbrew-tracker/internal/service"
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type Scheduler struct {
	cfg     *config.SchedulerConfig
	svc     *service.Service
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	running bool
	mu      sync.Mutex
}

func New(cfg *config.SchedulerConfig, svc *service.Service) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())
	return &Scheduler{
		cfg:    cfg,
		svc:    svc,
		ctx:    ctx,
		cancel: cancel,
	}
}

func (s *Scheduler) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.mu.Unlock()

	s.wg.Add(2)
	go s.loopDeviation()
	go s.loopInventory()

	log.Info().
		Int("deviationIntervalSec", s.cfg.DeviationCheckIntervalSec).
		Int("inventoryIntervalSec", s.cfg.InventoryCheckIntervalSec).
		Msg("scheduler started")
}

func (s *Scheduler) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	s.cancel()
	s.mu.Unlock()

	s.wg.Wait()
	log.Info().Msg("scheduler stopped")
}

func (s *Scheduler) loopDeviation() {
	defer s.wg.Done()
	interval := time.Duration(s.cfg.DeviationCheckIntervalSec) * time.Second
	if interval < 1*time.Second {
		interval = 30 * time.Second
	}
	t := time.NewTicker(interval)
	defer t.Stop()

	// 启动立即执行一次
	s.runDeviationCheck()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-t.C:
			s.runDeviationCheck()
		}
	}
}

func (s *Scheduler) loopInventory() {
	defer s.wg.Done()
	interval := time.Duration(s.cfg.InventoryCheckIntervalSec) * time.Second
	if interval < 1*time.Second {
		interval = 60 * time.Second
	}
	t := time.NewTicker(interval)
	defer t.Stop()

	s.runInventoryCheck()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-t.C:
			s.runInventoryCheck()
		}
	}
}

func (s *Scheduler) runDeviationCheck() {
	start := time.Now()
	log.Debug().Msg("running deviation check")
	if err := s.svc.RunDeviationCheck(); err != nil {
		log.Error().Err(err).Msg("deviation check failed")
		return
	}
	log.Info().Dur("latency", time.Since(start)).Msg("deviation check completed")
}

func (s *Scheduler) runInventoryCheck() {
	start := time.Now()
	log.Debug().Msg("running inventory check")
	if err := s.svc.RunInventoryAlerts(); err != nil {
		log.Error().Err(err).Msg("inventory alert check failed")
		return
	}
	log.Info().Dur("latency", time.Since(start)).Msg("inventory check completed")
}
