package notifier

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"drugvigil/config"
	"drugvigil/parser"
	"drugvigil/store"
)

type WeChatMessage struct {
	MsgType  string      `json:"msgtype"`
	Markdown *Markdown  `json:"markdown,omitempty"`
	Text     *TextMsg   `json:"text,omitempty"`
}

type Markdown struct {
	Content string `json:"content"`
}

type TextMsg struct {
	Content             string   `json:"content"`
	MentionedList       []string `json:"mentioned_list,omitempty"`
	MentionedMobileList []string `json:"mentioned_mobile_list,omitempty"`
}

type WeChatNotifier struct {
	cfg       *config.Config
	logger    *zap.Logger
	store     *store.Store
	normalizer *parser.Normalizer
	lastSent  map[string]time.Time
	rateLimit map[string]int
}

func NewWeChatNotifier(cfg *config.Config, logger *zap.Logger, st *store.Store, norm *parser.Normalizer) *WeChatNotifier {
	return &WeChatNotifier{
		cfg:        cfg,
		logger:     logger,
		store:      st,
		normalizer: norm,
		lastSent:   make(map[string]time.Time),
		rateLimit:  make(map[string]int),
	}
}

func (n *WeChatNotifier) Notify(record *parser.NormalizedRecord) error {
	if n.cfg.App.DryRun {
		n.logger.Info("dry-run: would send notification",
			zap.String("drug", record.StandardDrugName),
			zap.String("severity", record.StandardSeverity))
		return nil
	}

	level := n.cfg.GetLevel(record.StandardSeverity)

	if !n.checkRateLimit(level) {
		n.logger.Warn("rate limit exceeded, skipping notification",
			zap.String("level", level.Level),
			zap.String("drug", record.StandardDrugName))
		return fmt.Errorf("rate limit exceeded for level %s", level.Level)
	}

	var err error
	if level.CallPhone {
		err = n.sendPhoneAlert(record, level)
	}

	if err == nil {
		err = n.sendWeChat(record, level)
	}

	if err == nil {
		n.saveAlert(record, level)
	}

	return err
}

func (n *WeChatNotifier) checkRateLimit(level *config.LevelConfig) bool {
	now := time.Now()
	key := level.Level

	lastTime, exists := n.lastSent[key]
	if !exists {
		n.lastSent[key] = now
		n.rateLimit[key] = 1
		return true
	}

	if now.Sub(lastTime) > time.Hour {
		n.rateLimit[key] = 1
		n.lastSent[key] = now
		return true
	}

	if n.rateLimit[key] >= level.MaxPerHour {
		return false
	}

	n.rateLimit[key]++
	return true
}

func (n *WeChatNotifier) sendWeChat(record *parser.NormalizedRecord, level *config.LevelConfig) error {
	webhookURL := n.cfg.Notify.WeChat.WebhookURL
	if webhookURL == "" {
		return fmt.Errorf("wechat webhook URL not configured")
	}

	signURL := webhookURL
	if n.cfg.Notify.WeChat.Secret != "" {
		timestamp := time.Now().Unix()
		sign, err := n.generateSignature(timestamp, n.cfg.Notify.WeChat.Secret)
		if err == nil {
			signURL = fmt.Sprintf("%s&timestamp=%d&sign=%s", webhookURL, timestamp, sign)
		}
	}

	message := n.buildMessage(record, level)

	payload, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}

	n.logger.Debug("sending wechat notification",
		zap.String("url", signURL),
		zap.String("severity", level.Level))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(signURL, "application/json", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	json.Unmarshal(body, &result)

	if result.ErrCode != 0 {
		n.logger.Error("wechat notification failed",
			zap.Int("errcode", result.ErrCode),
			zap.String("errmsg", result.ErrMsg),
			zap.String("response", string(body)))
		return fmt.Errorf("wechat error: %d - %s", result.ErrCode, result.ErrMsg)
	}

	n.logger.Info("wechat notification sent",
		zap.String("drug", record.StandardDrugName),
		zap.String("severity", level.Level))

	return nil
}

func (n *WeChatNotifier) generateSignature(timestamp int64, secret string) (string, error) {
	stringToSign := fmt.Sprintf("%d\n%s", timestamp, secret)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(stringToSign))
	signData := mac.Sum(nil)
	return base64.StdEncoding.EncodeToString(signData), nil
}

func (n *WeChatNotifier) buildMessage(record *parser.NormalizedRecord, level *config.LevelConfig) *WeChatMessage {
	emoji := n.normalizer.GetSeverityEmoji(level.Level)
	label := n.normalizer.GetSeverityLabel(level.Level)

	changeType := "新增"
	if record.IsModified {
		changeType = "更新"
	}

	content := fmt.Sprintf(`%s **药品安全%s预警** %s

**药品名称**: %s
**通用名称**: %s
**不良反应**: %s
**严重程度**: %s (%s)
**发生频次**: %s
**来源机构**: %s
**发布日期**: %s
**原文链接**: [查看详情](%s)

**摘要**:
%s

**关键词**: %s
**监测级别**: %s
**预警时间**: %s
`,
		emoji, changeType, emoji,
		record.StandardDrugName,
		record.GenericName,
		record.StandardAdverseEvent,
		label, level.Level,
		record.Frequency,
		record.SourceAgency,
		record.PublishedDate.Format("2006-01-02 15:04:05"),
		record.SourceURL,
		n.truncateText(record.Summary, 300),
		strings.Join(record.Keywords, ", "),
		record.DrugMonitorLevel,
		time.Now().Format("2006-01-02 15:04:05"),
	)

	msg := &WeChatMessage{
		MsgType: "markdown",
		Markdown: &Markdown{
			Content: content,
		},
	}

	if level.AtAll || len(level.AtUsers) > 0 || len(n.cfg.Notify.WeChat.UserIDs) > 0 {
		atContent := "\n"
		if level.AtAll {
			atContent += "<at user_id=\"all\">所有人</at> "
		}
		for _, uid := range level.AtUsers {
			atContent += fmt.Sprintf("<at user_id=\"%s\"></at> ", uid)
		}
		for _, uid := range n.cfg.Notify.WeChat.UserIDs {
			atContent += fmt.Sprintf("<at user_id=\"%s\"></at> ", uid)
		}
		msg.Markdown.Content += atContent
	}

	return msg
}

func (n *WeChatNotifier) sendPhoneAlert(record *parser.NormalizedRecord, level *config.LevelConfig) error {
	if n.cfg.Notify.Phone.WebhookURL == "" {
		n.logger.Warn("phone webhook not configured, skipping call")
		return nil
	}

	n.logger.Info("triggering phone alert",
		zap.String("drug", record.StandardDrugName),
		zap.String("severity", level.Level))

	payload := map[string]interface{}{
		"api_key":    n.cfg.Notify.Phone.APIKey,
		"mobiles":    n.cfg.Notify.WeChat.MobileList,
		"drug_name":  record.StandardDrugName,
		"severity":   level.Level,
		"adverse_event": record.StandardAdverseEvent,
		"source":     record.SourceAgency,
	}

	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(
		n.cfg.Notify.Phone.WebhookURL,
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("phone alert: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	n.logger.Debug("phone alert response", zap.String("body", string(respBody)))

	return nil
}

func (n *WeChatNotifier) saveAlert(record *parser.NormalizedRecord, level *config.LevelConfig) {
	alert := &store.AlertRecord{
		RecordID:   record.ID,
		AlertLevel: level.Level,
		SentAt:     time.Now(),
		Channels:   []string{"wechat"},
		Content:    fmt.Sprintf("%s - %s", record.StandardDrugName, record.StandardAdverseEvent),
	}

	if level.CallPhone {
		alert.Channels = append(alert.Channels, "phone")
	}

	if err := n.store.SaveAlert(alert); err != nil {
		n.logger.Warn("save alert failed", zap.Error(err))
	}
}

func (n *WeChatNotifier) BatchNotify(records []*parser.NormalizedRecord) error {
	var errs []error
	for _, r := range records {
		if err := n.Notify(r); err != nil {
			errs = append(errs, err)
			n.logger.Error("notify failed",
				zap.String("drug", r.StandardDrugName),
				zap.Error(err))
		}
		time.Sleep(n.cfg.Notify.WeChat.RateLimit)
	}

	if len(errs) > 0 {
		return fmt.Errorf("some notifications failed: %v", errs)
	}
	return nil
}

func (n *WeChatNotifier) TestNotification() error {
	testRecord := &parser.NormalizedRecord{
		SecurityRecord: store.SecurityRecord{
			ID:           "test-001",
			SourceAgency: "系统测试",
			SourceCode:   "TEST",
			ReportID:     "TEST-001",
			DrugName:     "测试药品",
			GenericName:  "Test Drug",
			AdverseEvent: "测试不良反应",
			Severity:     "一般",
			Frequency:    "常见",
			PublishedDate: time.Now(),
			SourceURL:    "https://example.com",
			Summary:      "这是一条测试消息，用于验证企业微信推送通道是否正常工作。",
			Language:     "zh",
		},
		StandardDrugName:     "测试药品",
		StandardAdverseEvent: "Test adverse event",
		StandardSeverity:     "moderate",
		Keywords:             []string{"test", "drug"},
		MatchedDrugs:         []string{"测试药品"},
		DrugMonitorLevel:     "high",
	}

	level := n.cfg.GetLevel("moderate")
	return n.sendWeChat(testRecord, level)
}

func (n *WeChatNotifier) truncateText(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func (n *WeChatNotifier) GetStats() map[string]interface{} {
	stats := make(map[string]interface{})
	stats["pending_rate_limit"] = n.rateLimit
	return stats
}
