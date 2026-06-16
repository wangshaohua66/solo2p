package notify

import (
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type AlertLevel string

const (
	AlertLevelInfo     AlertLevel = "info"
	AlertLevelWarning  AlertLevel = "warning"
	AlertLevelError    AlertLevel = "error"
	AlertLevelCritical AlertLevel = "critical"
)

type Alert struct {
	ID        string
	Level     AlertLevel
	Title     string
	Message   string
	Site      string
	Timestamp time.Time
	Resolved  bool
}

type AlertNotifier interface {
	Send(alert *Alert) error
	Name() string
}

type ConsoleNotifier struct{}

func (c *ConsoleNotifier) Name() string {
	return "console"
}

func (c *ConsoleNotifier) Send(alert *Alert) error {
	switch alert.Level {
	case AlertLevelCritical:
		log.Error().
			Str("level", string(alert.Level)).
			Str("site", alert.Site).
			Str("title", alert.Title).
			Msg(alert.Message)
	case AlertLevelError:
		log.Error().
			Str("level", string(alert.Level)).
			Str("site", alert.Site).
			Str("title", alert.Title).
			Msg(alert.Message)
	case AlertLevelWarning:
		log.Warn().
			Str("level", string(alert.Level)).
			Str("site", alert.Site).
			Str("title", alert.Title).
			Msg(alert.Message)
	default:
		log.Info().
			Str("level", string(alert.Level)).
			Str("site", alert.Site).
			Str("title", alert.Title).
			Msg(alert.Message)
	}
	return nil
}

type AlertManager struct {
	notifiers   []AlertNotifier
	alerts      []*Alert
	mu          sync.Mutex
	maxAlerts   int
	rateLimit   map[string]time.Time
	rateLimitMu sync.Mutex
}

func NewAlertManager() *AlertManager {
	return &AlertManager{
		notifiers: make([]AlertNotifier, 0),
		alerts:    make([]*Alert, 0),
		maxAlerts: 1000,
		rateLimit: make(map[string]time.Time),
	}
}

func (am *AlertManager) AddNotifier(notifier AlertNotifier) {
	am.mu.Lock()
	defer am.mu.Unlock()
	am.notifiers = append(am.notifiers, notifier)
	log.Info().Str("notifier", notifier.Name()).Msg("notifier added")
}

func (am *AlertManager) Alert(level AlertLevel, title, message, site string) {
	alert := &Alert{
		ID:        fmt.Sprintf("alert-%d", time.Now().UnixNano()),
		Level:     level,
		Title:     title,
		Message:   message,
		Site:      site,
		Timestamp: time.Now(),
	}

	rateKey := fmt.Sprintf("%s:%s:%s", level, site, title)
	am.rateLimitMu.Lock()
	if lastTime, ok := am.rateLimit[rateKey]; ok {
		if time.Since(lastTime) < 30*time.Second {
			am.rateLimitMu.Unlock()
			return
		}
	}
	am.rateLimit[rateKey] = time.Now()
	am.rateLimitMu.Unlock()

	am.mu.Lock()
	am.alerts = append(am.alerts, alert)
	if len(am.alerts) > am.maxAlerts {
		am.alerts = am.alerts[len(am.alerts)-am.maxAlerts:]
	}
	am.mu.Unlock()

	for _, notifier := range am.notifiers {
		if err := notifier.Send(alert); err != nil {
			log.Error().Err(err).Str("notifier", notifier.Name()).Msg("send alert failed")
		}
	}
}

func (am *AlertManager) Info(title, message, site string) {
	am.Alert(AlertLevelInfo, title, message, site)
}

func (am *AlertManager) Warning(title, message, site string) {
	am.Alert(AlertLevelWarning, title, message, site)
}

func (am *AlertManager) Error(title, message, site string) {
	am.Alert(AlertLevelError, title, message, site)
}

func (am *AlertManager) Critical(title, message, site string) {
	am.Alert(AlertLevelCritical, title, message, site)
}

func (am *AlertManager) GetRecentAlerts(limit int) []*Alert {
	am.mu.Lock()
	defer am.mu.Unlock()

	if limit > len(am.alerts) {
		limit = len(am.alerts)
	}

	result := make([]*Alert, limit)
	for i := 0; i < limit; i++ {
		result[i] = am.alerts[len(am.alerts)-limit+i]
	}
	return result
}

func (am *AlertManager) GetAlertCountByLevel() map[AlertLevel]int {
	am.mu.Lock()
	defer am.mu.Unlock()

	counts := make(map[AlertLevel]int)
	for _, alert := range am.alerts {
		counts[alert.Level]++
	}
	return counts
}
