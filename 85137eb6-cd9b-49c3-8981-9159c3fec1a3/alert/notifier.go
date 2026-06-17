package alert

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"gopkg.in/gomail.v2"

	"price-monitor/config"
	"price-monitor/logger"
	"price-monitor/storage"
)

type AlertType string

const (
	AlertTypePriceDrop    AlertType = "PRICE_DROP"
	AlertTypePriceRise    AlertType = "PRICE_RISE"
	AlertTypeStockChange  AlertType = "STOCK_CHANGE"
	AlertTypeFlashSale    AlertType = "FLASH_SALE"
	AlertTypeBelowRef     AlertType = "BELOW_REFERENCE"
)

type AlertEvent struct {
	Type          AlertType
	SKUId         string
	SKUName       string
	Brand         string
	Category      string
	SiteId        string
	SiteName      string
	PriceBefore   float64
	PriceAfter    float64
	ChangePercent float64
	URL           string
	OccurredAt    time.Time
	Message       string
}

type Notifier struct {
	cfg        *config.AppConfig
	db         *storage.Database
	lastAlert  map[string]time.Time
	alertMu    map[string]*AlertMu
}

type AlertMu struct {
	lastSent time.Time
}

func NewNotifier(cfg *config.AppConfig, db *storage.Database) *Notifier {
	return &Notifier{
		cfg:       cfg,
		db:        db,
		lastAlert: make(map[string]time.Time),
		alertMu:   make(map[string]*AlertMu),
	}
}

func (n *Notifier) DetectAndAlert(newRecord *storage.PriceRecord) (*AlertEvent, error) {
	if !n.cfg.Alert.Enabled {
		return nil, nil
	}

	oldRecord, err := n.db.GetLatestPrice(newRecord.SKUId, newRecord.SiteId)
	if err != nil {
		logger.Warn("Failed to get latest price for alert check: %v", err)
		return nil, err
	}

	if oldRecord == nil {
		return nil, nil
	}

	threshold := n.cfg.Alert.PriceChangeThreshold
	changePct := 0.0
	if oldRecord.PriceFinal > 0 {
		changePct = (newRecord.PriceFinal - oldRecord.PriceFinal) / oldRecord.PriceFinal
	}

	var event *AlertEvent

	sku, _ := n.cfg.GetSKUByID(newRecord.SKUId)
	if sku.ReferencePrice > 0 && newRecord.PriceFinal < sku.ReferencePrice*0.95 {
		event = n.buildEvent(AlertTypeBelowRef, oldRecord, newRecord, changePct, sku.ReferencePrice)
	} else if math.Abs(changePct) >= threshold {
		if changePct < 0 {
			alertType := AlertTypePriceDrop
			if math.Abs(changePct) >= 0.20 {
				alertType = AlertTypeFlashSale
			}
			event = n.buildEvent(alertType, oldRecord, newRecord, changePct, 0)
		} else {
			event = n.buildEvent(AlertTypePriceRise, oldRecord, newRecord, changePct, 0)
		}
	}

	if event != nil {
		key := fmt.Sprintf("%s_%s_%s", event.Type, event.SKUId, event.SiteId)
		if n.shouldSendAlert(key) {
			if err := n.Notify(event); err != nil {
				logger.Error("Failed to send alert: %v", err)
			}
			if n.db != nil {
				n.db.LogAlert(event.SKUId, event.SiteId, event.PriceBefore,
					event.PriceAfter, event.ChangePercent, string(event.Type))
			}
			return event, nil
		}
	}

	return nil, nil
}

func (n *Notifier) shouldSendAlert(key string) bool {
	mode := strings.ToLower(n.cfg.Alert.Mode)
	if mode == "single" {
		if _, exists := n.lastAlert[key]; exists {
			return false
		}
		n.lastAlert[key] = time.Now()
		return true
	}

	if mu, exists := n.alertMu[key]; exists {
		if time.Since(mu.lastSent) < 30*time.Minute {
			return false
		}
		mu.lastSent = time.Now()
	} else {
		n.alertMu[key] = &AlertMu{lastSent: time.Now()}
	}
	return true
}

func (n *Notifier) buildEvent(alertType AlertType, oldRec, newRec *storage.PriceRecord, changePct, refPrice float64) *AlertEvent {
	var msg string
	switch alertType {
	case AlertTypePriceDrop:
		msg = fmt.Sprintf("商品 [%s] 在 [%s] 降价 %.2f%%: ¥%.2f → ¥%.2f",
			newRec.SKUName, newRec.SiteName, math.Abs(changePct)*100,
			oldRec.PriceFinal, newRec.PriceFinal)
	case AlertTypeFlashSale:
		msg = fmt.Sprintf("⚡ 秒杀预警！[%s] 在 [%s] 大幅降价 %.2f%%: ¥%.2f → ¥%.2f",
			newRec.SKUName, newRec.SiteName, math.Abs(changePct)*100,
			oldRec.PriceFinal, newRec.PriceFinal)
	case AlertTypePriceRise:
		msg = fmt.Sprintf("商品 [%s] 在 [%s] 涨价 %.2f%%: ¥%.2f → ¥%.2f",
			newRec.SKUName, newRec.SiteName, changePct*100,
			oldRec.PriceFinal, newRec.PriceFinal)
	case AlertTypeBelowRef:
		msg = fmt.Sprintf("💰 价格低于参考价！[%s] 在 [%s] 当前价 ¥%.2f (参考价 ¥%.2f)",
			newRec.SKUName, newRec.SiteName, newRec.PriceFinal, refPrice)
	}

	return &AlertEvent{
		Type:          alertType,
		SKUId:         newRec.SKUId,
		SKUName:       newRec.SKUName,
		Brand:         newRec.Brand,
		Category:      newRec.Category,
		SiteId:        newRec.SiteId,
		SiteName:      newRec.SiteName,
		PriceBefore:   oldRec.PriceFinal,
		PriceAfter:    newRec.PriceFinal,
		ChangePercent: changePct,
		URL:           newRec.URL,
		OccurredAt:    time.Now(),
		Message:       msg,
	}
}

func (n *Notifier) Notify(event *AlertEvent) error {
	logger.Warn("ALERT [%s]: %s", event.Type, event.Message)

	var err error
	if n.cfg.Alert.Mail.SMTPHost != "" && len(n.cfg.Alert.Mail.To) > 0 {
		if mailErr := n.sendEmail(event); mailErr != nil {
			logger.Error("Failed to send email alert: %v", mailErr)
			err = mailErr
		}
	}

	if n.cfg.Alert.Webhook.Enabled && n.cfg.Alert.Webhook.URL != "" {
		if webhookErr := n.sendWebhook(event); webhookErr != nil {
			logger.Error("Failed to send webhook alert: %v", webhookErr)
			if err == nil {
				err = webhookErr
			}
		}
	}

	return err
}

func (n *Notifier) sendEmail(event *AlertEvent) error {
	mailCfg := n.cfg.Alert.Mail

	m := gomail.NewMessage()
	m.SetHeader("From", mailCfg.From)
	m.SetHeader("To", mailCfg.To...)
	subject := fmt.Sprintf("[价格监控告警][%s] %s", event.Type, event.SKUName)
	m.SetHeader("Subject", subject)

	body := n.buildEmailBody(event)
	m.SetBody("text/html", body)

	d := gomail.NewDialer(mailCfg.SMTPHost, mailCfg.SMTPPort, mailCfg.SMTPUser, mailCfg.SMTPPassword)
	if err := d.DialAndSend(m); err != nil {
		return fmt.Errorf("send email failed: %w", err)
	}

	logger.Info("Email alert sent to %v for [%s]", mailCfg.To, event.SKUName)
	return nil
}

func (n *Notifier) buildEmailBody(event *AlertEvent) string {
	color := "#22c55e"
	icon := "📉"
	if event.ChangePercent > 0 {
		color = "#ef4444"
		icon = "📈"
	}
	if event.Type == AlertTypeFlashSale {
		color = "#f59e0b"
		icon = "⚡"
	}
	if event.Type == AlertTypeBelowRef {
		color = "#8b5cf6"
		icon = "💰"
	}

	return fmt.Sprintf(`
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 16px 0; color: #1e293b;">%s 价格监控告警</h2>
    <div style="background: %s; color: white; padding: 12px 16px; border-radius: 8px; font-size: 18px; font-weight: 600; margin-bottom: 20px;">
      %s %s
    </div>
    <table style="width: 100%%; border-collapse: collapse; margin-bottom: 20px;">
      <tr><td style="padding: 8px 0; color: #64748b; width: 100px;">商品名称</td><td style="padding: 8px 0; color: #1e293b; font-weight: 500;">%s</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">商品品牌</td><td style="padding: 8px 0; color: #1e293b;">%s</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">商品分类</td><td style="padding: 8px 0; color: #1e293b;">%s</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">平台来源</td><td style="padding: 8px 0; color: #1e293b;">%s</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">变动前价格</td><td style="padding: 8px 0; color: #1e293b;">¥%.2f</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">变动后价格</td><td style="padding: 8px 0; color: %s; font-weight: 600; font-size: 18px;">¥%.2f</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">变动幅度</td><td style="padding: 8px 0; color: %s; font-weight: 600;">%.2f%%</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">发生时间</td><td style="padding: 8px 0; color: #1e293b;">%s</td></tr>
    </table>
    <a href="%s" style="display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">查看商品详情 →</a>
    <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
      母婴电商价格监控系统 · 自动告警
    </p>
  </div>
</body>
</html>
`, icon, color, icon, event.Message,
		event.SKUName, event.Brand, event.Category, event.SiteName,
		event.PriceBefore, color, event.PriceAfter,
		color, event.ChangePercent*100,
		event.OccurredAt.Format("2006-01-02 15:04:05"),
		event.URL)
}

func (n *Notifier) sendWebhook(event *AlertEvent) error {
	payload := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"content": n.buildMarkdownMessage(event),
		},
		"event": map[string]interface{}{
			"type":           event.Type,
			"sku_id":         event.SKUId,
			"sku_name":       event.SKUName,
			"brand":          event.Brand,
			"category":       event.Category,
			"site_id":        event.SiteId,
			"site_name":      event.SiteName,
			"price_before":   event.PriceBefore,
			"price_after":    event.PriceAfter,
			"change_percent": event.ChangePercent,
			"url":            event.URL,
			"occurred_at":    event.OccurredAt,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal webhook payload failed: %w", err)
	}

	req, err := http.NewRequest("POST", n.cfg.Alert.Webhook.URL, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("create webhook request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	logger.Info("Webhook alert sent for [%s]", event.SKUName)
	return nil
}

func (n *Notifier) buildMarkdownMessage(event *AlertEvent) string {
	icon := "📉"
	if event.ChangePercent > 0 {
		icon = "📈"
	}
	if event.Type == AlertTypeFlashSale {
		icon = "⚡"
	}
	if event.Type == AlertTypeBelowRef {
		icon = "💰"
	}

	return fmt.Sprintf(`
### %s **价格监控告警**

**%s**

- **商品名称**: %s
- **品牌**: %s
- **分类**: %s
- **平台**: %s
- **变动前**: ¥%.2f
- **变动后**: ¥%.2f
- **变动幅度**: %.2f%%
- **时间**: %s
- **链接**: [查看详情](%s)
`, icon, event.Message,
		event.SKUName, event.Brand, event.Category, event.SiteName,
		event.PriceBefore, event.PriceAfter, event.ChangePercent*100,
		event.OccurredAt.Format("2006-01-02 15:04:05"),
		event.URL)
}

func (n *Notifier) BatchAlert(records []*storage.PriceRecord) []*AlertEvent {
	var events []*AlertEvent
	for _, rec := range records {
		if event, _ := n.DetectAndAlert(rec); event != nil {
			events = append(events, event)
		}
	}
	return events
}
