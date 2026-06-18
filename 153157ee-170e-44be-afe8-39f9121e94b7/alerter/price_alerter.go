package alerter

import (
	"fmt"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"grain-monitor/config"
	"grain-monitor/models"
	"grain-monitor/storage"
)

type PriceAlerter struct {
	repo      *storage.Repository
	rules     []models.AlertRule
	smtpCfg   config.SMTPConfig
	alertChan chan *models.AlertRecord
	mu        sync.Mutex
	dedupMap  map[string]time.Time
}

func NewPriceAlerter(repo *storage.Repository, rules []models.AlertRule, smtpCfg config.SMTPConfig) *PriceAlerter {
	return &PriceAlerter{
		repo:     repo,
		rules:    rules,
		smtpCfg:  smtpCfg,
		alertChan: make(chan *models.AlertRecord, 100),
		dedupMap: make(map[string]time.Time),
	}
}

func (pa *PriceAlerter) Start() {
	go pa.processAlerts()
}

func (pa *PriceAlerter) processAlerts() {
	for alert := range pa.alertChan {
		pa.sendAlert(alert)
	}
}

func (pa *PriceAlerter) CheckSnapshots(snapshots []models.MarketSnapshot) []*models.AlertRecord {
	var alerts []*models.AlertRecord

	for i := range snapshots {
		snap := &snapshots[i]
		if snap.IsSuspicious {
			continue
		}

		siteAlerts := pa.checkSnapshotRules(snap)
		alerts = append(alerts, siteAlerts...)
	}

	for _, alert := range alerts {
		if pa.shouldAlert(alert.AlertID) {
			pa.repo.SaveAlert(alert)
			pa.alertChan <- alert
		}
	}

	return alerts
}

func (pa *PriceAlerter) checkSnapshotRules(snap *models.MarketSnapshot) []*models.AlertRecord {
	var alerts []*models.AlertRecord

	for _, rule := range pa.rules {
		if !rule.Enabled {
			continue
		}

		if rule.Type == "price_change" {
			if rule.GrainType != "" && rule.GrainType != snap.GrainType {
				continue
			}
			if rule.PriceType != "" && rule.PriceType != snap.PriceType {
				continue
			}

			if pa.checkPriceChange(snap, &rule) {
				alert := pa.createPriceAlert(snap, &rule)
				alerts = append(alerts, alert)
			}
		}

		if rule.Type == "trend_change" {
			if rule.GrainType != "" && rule.GrainType != snap.GrainType {
				continue
			}
			if pa.checkTrendChange(snap, &rule) {
				alert := pa.createTrendAlert(snap, &rule)
				alerts = append(alerts, alert)
			}
		}
	}

	return alerts
}

func (pa *PriceAlerter) checkPriceChange(snap *models.MarketSnapshot, rule *models.AlertRule) bool {
	changePct := snap.ChangePct

	switch rule.Direction {
	case "up":
		return changePct >= rule.Threshold
	case "down":
		return changePct <= -rule.Threshold
	case "both":
		return changePct >= rule.Threshold || changePct <= -rule.Threshold
	default:
		return false
	}
}

func (pa *PriceAlerter) checkTrendChange(snap *models.MarketSnapshot, rule *models.AlertRule) bool {
	since := time.Now().Add(-3 * time.Hour)
	history, err := pa.repo.GetSnapshotsByRange(snap.GrainType, since, time.Now())
	if err != nil || len(history) < 3 {
		return false
	}

	var totalChange float64
	var count int
	for i := 1; i < len(history); i++ {
		if history[i].SiteID == snap.SiteID && history[i].PriceType == snap.PriceType {
			totalChange += history[i].ChangePct
			count++
		}
	}

	if count < 3 {
		return false
	}

	avgChange := totalChange / float64(count)

	switch rule.Direction {
	case "up":
		return avgChange > 0 && avgChange >= rule.Threshold
	case "down":
		return avgChange < 0 && avgChange <= -rule.Threshold
	case "both":
		return (avgChange > 0 && avgChange >= rule.Threshold) || (avgChange < 0 && avgChange <= -rule.Threshold)
	default:
		return false
	}
}

func (pa *PriceAlerter) createPriceAlert(snap *models.MarketSnapshot, rule *models.AlertRule) *models.AlertRecord {
	direction := "上涨"
	if snap.ChangePct < 0 {
		direction = "下跌"
	}

	grainName := models.GrainNames[snap.GrainType]
	title := fmt.Sprintf("【%s异动】%s价格%s %.2f%%", rule.Name, grainName, direction, snap.ChangePct)
	content := fmt.Sprintf(
		"站点: %s\n品种: %s\n价格类型: %s\n当前价格: %.2f %s\n涨跌幅: %.2f%%\n涨跌额: %.2f\n时间: %s",
		snap.SiteID, grainName, snap.PriceType, snap.Price, snap.Unit,
		snap.ChangePct, snap.Change, snap.Timestamp.Format("2006-01-02 15:04:05"),
	)

	return &models.AlertRecord{
		AlertID:   fmt.Sprintf("%s_%s_%s", rule.ID, snap.SiteID, snap.GrainType),
		AlertType: rule.Type,
		SiteID:    snap.SiteID,
		GrainType: snap.GrainType,
		Title:     title,
		Content:   content,
		Price:     snap.Price,
		ChangePct: snap.ChangePct,
		AlertTime: time.Now(),
		Notified:  false,
	}
}

func (pa *PriceAlerter) createTrendAlert(snap *models.MarketSnapshot, rule *models.AlertRule) *models.AlertRecord {
	grainName := models.GrainNames[snap.GrainType]
	title := fmt.Sprintf("【趋势告警】%s连续3小时波动超阈值", grainName)
	content := fmt.Sprintf(
		"站点: %s\n品种: %s\n当前价格: %.2f %s\n触发规则: %s\n阈值: %.2f%%\n时间: %s",
		snap.SiteID, grainName, snap.Price, snap.Unit,
		rule.Name, rule.Threshold,
		snap.Timestamp.Format("2006-01-02 15:04:05"),
	)

	return &models.AlertRecord{
		AlertID:   fmt.Sprintf("%s_%s_%s", rule.ID, snap.SiteID, snap.GrainType),
		AlertType: rule.Type,
		SiteID:    snap.SiteID,
		GrainType: snap.GrainType,
		Title:     title,
		Content:   content,
		Price:     snap.Price,
		ChangePct: snap.ChangePct,
		AlertTime: time.Now(),
		Notified:  false,
	}
}

func (pa *PriceAlerter) CheckPolicyItems(items []models.PolicyItem, siteID string) []*models.AlertRecord {
	var alerts []*models.AlertRecord
	var policyRule *models.AlertRule

	for _, r := range pa.rules {
		if r.Type == "policy_keyword" && r.Enabled {
			policyRule = &r
			break
		}
	}

	if policyRule == nil {
		return alerts
	}

	for _, item := range items {
		if len(item.Keywords) == 0 {
			continue
		}

		alertID := fmt.Sprintf("policy_%s_%s", siteID, item.Title)
		if !pa.shouldAlert(alertID) {
			continue
		}

		title := fmt.Sprintf("【政策快讯】%s", item.Title)
		content := fmt.Sprintf(
			"站点: %s\n标题: %s\n关键词: %s\n发布时间: %s\n链接: %s",
			siteID, item.Title, strings.Join(item.Keywords, ", "),
			item.Date.Format("2006-01-02"), item.URL,
		)

		alert := &models.AlertRecord{
			AlertID:   alertID,
			AlertType: "policy_keyword",
			SiteID:    siteID,
			Title:     title,
			Content:   content,
			AlertTime: time.Now(),
			Notified:  false,
		}

		alerts = append(alerts, alert)
		pa.repo.SaveAlert(alert)
		pa.alertChan <- alert
	}

	return alerts
}

func (pa *PriceAlerter) shouldAlert(alertID string) bool {
	pa.mu.Lock()
	defer pa.mu.Unlock()

	dedupWindow := 30 * time.Minute

	if lastTime, ok := pa.dedupMap[alertID]; ok {
		if time.Since(lastTime) < dedupWindow {
			return false
		}
	}

	hasRecent, _ := pa.repo.HasRecentAlert(alertID, dedupWindow)
	if hasRecent {
		pa.dedupMap[alertID] = time.Now()
		return false
	}

	pa.dedupMap[alertID] = time.Now()

	if len(pa.dedupMap) > 1000 {
		pa.cleanupDedupMap()
	}

	return true
}

func (pa *PriceAlerter) cleanupDedupMap() {
	now := time.Now()
	for id, t := range pa.dedupMap {
		if now.Sub(t) > 30*time.Minute {
			delete(pa.dedupMap, id)
		}
	}
}

func (pa *PriceAlerter) sendAlert(alert *models.AlertRecord) {
	if !pa.smtpCfg.Enabled {
		return
	}

	if err := pa.sendEmail(alert); err != nil {
		return
	}

	alert.Notified = true
	alert.NotifyMethod = "email"
}

func (pa *PriceAlerter) sendEmail(alert *models.AlertRecord) error {
	if !pa.smtpCfg.Enabled || len(pa.smtpCfg.To) == 0 {
		return nil
	}

	auth := smtp.PlainAuth("", pa.smtpCfg.Username, pa.smtpCfg.Password, pa.smtpCfg.Host)

	body := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		pa.smtpCfg.From,
		strings.Join(pa.smtpCfg.To, ", "),
		alert.Title,
		alert.Content,
	)

	addr := fmt.Sprintf("%s:%d", pa.smtpCfg.Host, pa.smtpCfg.Port)
	return smtp.SendMail(addr, auth, pa.smtpCfg.From, pa.smtpCfg.To, []byte(body))
}

func (pa *PriceAlerter) CheckSiteHealth(siteID string, completenessThreshold float64, consecutiveCount int) (bool, string) {
	count, err := pa.repo.GetRecentLowCompleteness(siteID, completenessThreshold, consecutiveCount)
	if err != nil {
		return false, ""
	}

	if count >= consecutiveCount {
		alertID := fmt.Sprintf("health_low_completeness_%s", siteID)
		if pa.shouldAlert(alertID) {
			alert := &models.AlertRecord{
				AlertID:   alertID,
				AlertType: "health",
				SiteID:    siteID,
				Title:     fmt.Sprintf("【站点健康告警】%s 采集完整率连续过低", siteID),
				Content: fmt.Sprintf("站点 %s 连续 %d 次采集完整率低于 %.1f%%，请检查站点配置或页面结构是否变化",
					siteID, consecutiveCount, completenessThreshold),
				AlertTime:    time.Now(),
				Notified:     false,
				NotifyMethod: "email",
			}
			pa.repo.SaveAlert(alert)
			pa.alertChan <- alert
		}
		return true, fmt.Sprintf("连续 %d 次完整率低于 %.1f%%", count, completenessThreshold)
	}

	return false, ""
}

func (pa *PriceAlerter) Close() {
	close(pa.alertChan)
}
