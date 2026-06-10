package notify

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gitmon/gitmon/internal/config"
	"github.com/gitmon/gitmon/internal/git"
	"github.com/gitmon/gitmon/internal/storage"
)

type Notifier interface {
	SendAlert(alert *storage.AlertRecord) error
	SendSummary(stats []storage.RepoStats, alerts []storage.AlertRecord) error
}

type FeishuNotifier struct {
	WebhookURL string
	Secret     string
}

type DingtalkNotifier struct {
	WebhookURL string
	Secret     string
}

type NotifierManager struct {
	feishu   *FeishuNotifier
	dingtalk *DingtalkNotifier
}

func NewManager(cfg *config.Config) *NotifierManager {
	m := &NotifierManager{}

	if cfg.Notify.Feishu.WebhookURL != "" {
		m.feishu = &FeishuNotifier{
			WebhookURL: cfg.Notify.Feishu.WebhookURL,
			Secret:     cfg.Notify.Feishu.Secret,
		}
	}

	if cfg.Notify.Dingtalk.WebhookURL != "" {
		m.dingtalk = &DingtalkNotifier{
			WebhookURL: cfg.Notify.Dingtalk.WebhookURL,
			Secret:     cfg.Notify.Dingtalk.Secret,
		}
	}

	return m
}

func (m *NotifierManager) SendAlert(alert *storage.AlertRecord) error {
	var errs []error

	if m.feishu != nil {
		if err := m.feishu.SendAlert(alert); err != nil {
			errs = append(errs, fmt.Errorf("feishu: %w", err))
		}
	}

	if m.dingtalk != nil {
		if err := m.dingtalk.SendAlert(alert); err != nil {
			errs = append(errs, fmt.Errorf("dingtalk: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("notification errors: %v", errs)
	}
	return nil
}

func (m *NotifierManager) SendSummary(stats []storage.RepoStats, alerts []storage.AlertRecord) error {
	var errs []error

	if m.feishu != nil {
		if err := m.feishu.SendSummary(stats, alerts); err != nil {
			errs = append(errs, fmt.Errorf("feishu: %w", err))
		}
	}

	if m.dingtalk != nil {
		if err := m.dingtalk.SendSummary(stats, alerts); err != nil {
			errs = append(errs, fmt.Errorf("dingtalk: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("notification errors: %v", errs)
	}
	return nil
}

func signWebhook(secret string, timestamp int64) string {
	if secret == "" {
		return ""
	}
	stringToSign := fmt.Sprintf("%d\n%s", timestamp, secret)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(stringToSign))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func (n *FeishuNotifier) sign(timestamp int64) string {
	return signWebhook(n.Secret, timestamp)
}

func (n *FeishuNotifier) SendAlert(alert *storage.AlertRecord) error {
	timestamp := time.Now().Unix()
	sign := n.sign(timestamp)

	levelEmoji := "⚠️"
	if alert.Level == string(git.HealthCritical) {
		levelEmoji = "🔴"
	} else if alert.Level == string(git.HealthWarning) {
		levelEmoji = "🟡"
	}

	title := fmt.Sprintf("%s GitMon Alert: %s", levelEmoji, alert.Type)
	text := fmt.Sprintf(`
**Repository**: %s
**Level**: %s
**Message**: %s
**Owner**: %s
**Time**: %s
`, alert.RepoName, alert.Level, alert.Message, alert.Owner, alert.CreatedAt.Format(time.RFC1123))

	if alert.Detail != "" {
		text += fmt.Sprintf("\n**Details**: %s", alert.Detail)
	}

	msg := map[string]interface{}{
		"timestamp": timestamp,
		"sign":      sign,
		"msg_type":  "interactive",
		"card": map[string]interface{}{
			"header": map[string]interface{}{
				"title": map[string]interface{}{
					"content": title,
					"tag":     "plain_text",
				},
				"template": getFeishuTemplate(alert.Level),
			},
			"elements": []map[string]interface{}{
				{
					"tag": "markdown",
					"content": map[string]interface{}{
						"content": text,
						"tag":     "lark_md",
					},
				},
			},
		},
	}

	return n.post(msg)
}

func (n *FeishuNotifier) SendSummary(stats []storage.RepoStats, alerts []storage.AlertRecord) error {
	timestamp := time.Now().Unix()
	sign := n.sign(timestamp)

	title := fmt.Sprintf("📊 GitMon Daily Summary - %s", time.Now().Format("2006-01-02"))

	var text string
	text += fmt.Sprintf("**Total Repositories**: %d\n\n", len(stats))

	criticalCount := 0
	warningCount := 0
	goodCount := 0

	for _, s := range stats {
		switch s.HealthLevel {
		case git.HealthCritical:
			criticalCount++
		case git.HealthWarning:
			warningCount++
		default:
			goodCount++
		}
	}

	text += fmt.Sprintf("**Health Status**:\n")
	text += fmt.Sprintf("✅ Good: %d | 🟡 Warning: %d | 🔴 Critical: %d\n\n", goodCount, warningCount, criticalCount)

	if len(alerts) > 0 {
		text += fmt.Sprintf("**Active Alerts**: %d\n\n", len(alerts))
		for i, a := range alerts {
			if i >= 5 {
				break
			}
			emoji := "🟡"
			if a.Level == string(git.HealthCritical) {
				emoji = "🔴"
			}
			text += fmt.Sprintf("%s %s: %s - %s\n", emoji, a.RepoName, a.Type, a.Message)
		}
	}

	text += fmt.Sprintf("\n**Top 5 by Health Score**:\n")
	sortedStats := make([]storage.RepoStats, len(stats))
	copy(sortedStats, stats)
	for i, s := range sortedStats {
		if i >= 5 {
			break
		}
		text += fmt.Sprintf("%d. %s: %.0f/100\n", i+1, s.RepoName, s.HealthScore)
	}

	msg := map[string]interface{}{
		"timestamp": timestamp,
		"sign":      sign,
		"msg_type":  "interactive",
		"card": map[string]interface{}{
			"header": map[string]interface{}{
				"title": map[string]interface{}{
					"content": title,
					"tag":     "plain_text",
				},
				"template": "blue",
			},
			"elements": []map[string]interface{}{
				{
					"tag": "markdown",
					"content": map[string]interface{}{
						"content": text,
						"tag":     "lark_md",
					},
				},
			},
		},
	}

	return n.post(msg)
}

func (n *FeishuNotifier) post(msg interface{}) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	resp, err := http.Post(n.WebhookURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("feishu webhook failed: %d - %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if code, ok := result["code"].(float64); ok && code != 0 {
		return fmt.Errorf("feishu error: %v", result["msg"])
	}

	return nil
}

func getFeishuTemplate(level string) string {
	switch level {
	case string(git.HealthCritical):
		return "red"
	case string(git.HealthWarning):
		return "yellow"
	default:
		return "green"
	}
}

func (n *DingtalkNotifier) sign(timestamp int64) string {
	return signWebhook(n.Secret, timestamp)
}

func (n *DingtalkNotifier) SendAlert(alert *storage.AlertRecord) error {
	timestamp := time.Now().Unix()
	sign := n.sign(timestamp)

	levelEmoji := "⚠️"
	if alert.Level == string(git.HealthCritical) {
		levelEmoji = "🔴"
	} else if alert.Level == string(git.HealthWarning) {
		levelEmoji = "🟡"
	}

	title := fmt.Sprintf("%s GitMon Alert: %s", levelEmoji, alert.Type)
	text := fmt.Sprintf(`
### GitMon Alert

**Repository**: %s
**Level**: %s
**Message**: %s
**Owner**: %s
**Time**: %s
`, alert.RepoName, alert.Level, alert.Message, alert.Owner, alert.CreatedAt.Format(time.RFC1123))

	if alert.Detail != "" {
		text += fmt.Sprintf("\n**Details**: %s", alert.Detail)
	}

	msg := map[string]interface{}{
		"timestamp": timestamp,
		"sign":      sign,
		"msgtype":   "markdown",
		"markdown": map[string]interface{}{
			"title": title,
			"text":  text,
		},
	}

	return n.post(msg)
}

func (n *DingtalkNotifier) SendSummary(stats []storage.RepoStats, alerts []storage.AlertRecord) error {
	timestamp := time.Now().Unix()
	sign := n.sign(timestamp)

	title := fmt.Sprintf("📊 GitMon Daily Summary - %s", time.Now().Format("2006-01-02"))

	var text string
	text += fmt.Sprintf("## GitMon Daily Summary\n\n")
	text += fmt.Sprintf("**Total Repositories**: %d\n\n", len(stats))

	criticalCount := 0
	warningCount := 0
	goodCount := 0

	for _, s := range stats {
		switch s.HealthLevel {
		case git.HealthCritical:
			criticalCount++
		case git.HealthWarning:
			warningCount++
		default:
			goodCount++
		}
	}

	text += fmt.Sprintf("**Health Status**:\n")
	text += fmt.Sprintf("- ✅ Good: %d\n", goodCount)
	text += fmt.Sprintf("- 🟡 Warning: %d\n", warningCount)
	text += fmt.Sprintf("- 🔴 Critical: %d\n\n", criticalCount)

	if len(alerts) > 0 {
		text += fmt.Sprintf("**Active Alerts**: %d\n\n", len(alerts))
		for i, a := range alerts {
			if i >= 5 {
				break
			}
			emoji := "🟡"
			if a.Level == string(git.HealthCritical) {
				emoji = "🔴"
			}
			text += fmt.Sprintf("%s **%s**: %s - %s\n", emoji, a.RepoName, a.Type, a.Message)
		}
	}

	msg := map[string]interface{}{
		"timestamp": timestamp,
		"sign":      sign,
		"msgtype":   "markdown",
		"markdown": map[string]interface{}{
			"title": title,
			"text":  text,
		},
	}

	return n.post(msg)
}

func (n *DingtalkNotifier) post(msg interface{}) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	url := n.WebhookURL
	if msgMap, ok := msg.(map[string]interface{}); ok {
		if sign, ok := msgMap["sign"].(string); ok && sign != "" {
			if timestamp, ok := msgMap["timestamp"].(int64); ok {
				url = fmt.Sprintf("%s&timestamp=%d&sign=%s", n.WebhookURL, timestamp, sign)
			}
		}
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("dingtalk webhook failed: %d - %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if code, ok := result["errcode"].(float64); ok && code != 0 {
		return fmt.Errorf("dingtalk error: %v", result["errmsg"])
	}

	return nil
}

func CheckSilentRepos(stats []storage.RepoStats, silentDays int) []storage.AlertRecord {
	var alerts []storage.AlertRecord
	now := time.Now()

	for _, s := range stats {
		if s.SilentDays >= silentDays {
			level := string(git.HealthWarning)
			if s.SilentDays >= 90 {
				level = string(git.HealthCritical)
			}
			alerts = append(alerts, storage.AlertRecord{
				RepoName:  s.RepoName,
				Type:      "silent_repo",
				Level:     level,
				Message:   fmt.Sprintf("Repository has been silent for %d days", s.SilentDays),
				CreatedAt: now,
			})
		}
	}

	return alerts
}
