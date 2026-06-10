package notify

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"bankrupt-monitor/internal/config"
	"bankrupt-monitor/internal/model"

	"go.uber.org/zap"
)

type Channel string

const (
	ChannelWebhook Channel = "webhook"
	ChannelWechat  Channel = "wechat"
	ChannelEmail   Channel = "email"
	ChannelSMS     Channel = "sms"
)

type Dispatcher struct {
	cfg    *config.NotifyConfig
	logger *zap.Logger
	client *http.Client
	mu     sync.Mutex
}

type Notification struct {
	Case        *model.Case
	Announcement *model.Announcement
	Channels    []Channel
	Subject     string
	Body        string
}

func NewDispatcher(cfg *config.NotifyConfig, log *zap.Logger) *Dispatcher {
	transport := &http.Transport{
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: true},
		MaxIdleConns:        20,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	}
	return &Dispatcher{
		cfg:    cfg,
		logger: log,
		client: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
		},
	}
}

func (d *Dispatcher) Dispatch(ctx context.Context, n *Notification) error {
	if n == nil {
		return nil
	}
	channels := n.Channels
	if len(channels) == 0 {
		channels = []Channel{ChannelWebhook, ChannelWechat}
	}

	var errs []string
	for _, ch := range channels {
		switch ch {
		case ChannelWebhook:
			if err := d.sendWebhook(ctx, n); err != nil {
				errs = append(errs, fmt.Sprintf("webhook: %v", err))
			}
		case ChannelWechat:
			if err := d.sendWechat(ctx, n); err != nil {
				errs = append(errs, fmt.Sprintf("wechat: %v", err))
			}
		case ChannelEmail:
			if err := d.sendEmail(ctx, n); err != nil {
				errs = append(errs, fmt.Sprintf("email: %v", err))
			}
		case ChannelSMS:
			if err := d.sendSMS(ctx, n); err != nil {
				errs = append(errs, fmt.Sprintf("sms: %v", err))
			}
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("dispatch errors: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (d *Dispatcher) BuildNotification(c *model.Case, ann *model.Announcement) *Notification {
	subject := fmt.Sprintf("[破产案件告警] %s - %s", c.Debtor, c.CaseNumber)
	claimStr := ""
	if c.ClaimDeadline != nil {
		claimStr = fmt.Sprintf("债权申报截止: %s\n", c.ClaimDeadline.Format("2006-01-02"))
	}
	hearingStr := ""
	if c.FirstHearingDate != nil {
		hearingStr = fmt.Sprintf("开庭时间: %s\n", c.FirstHearingDate.Format("2006-01-02"))
	}
	body := fmt.Sprintf(
		"债务人: %s\n案号: %s\n法院: %s\n类型: %s\n管理人: %s\n%s%s原文链接: %s\n",
		c.Debtor, c.CaseNumber, c.Court, c.AnnouncementType,
		c.Administrator, claimStr, hearingStr, ann.SourceURL,
	)
	return &Notification{
		Case:         c,
		Announcement: ann,
		Subject:      subject,
		Body:         body,
	}
}

func (d *Dispatcher) sendWebhook(ctx context.Context, n *Notification) error {
	if len(d.cfg.WebhookURLs) == 0 {
		return nil
	}
	payload := map[string]interface{}{
		"title":   n.Subject,
		"content": n.Body,
		"case":    n.Case,
		"url":     n.Announcement.SourceURL,
	}
	data, _ := json.Marshal(payload)

	var lastErr error
	for _, url := range d.cfg.WebhookURLs {
		if err := d.postJSON(ctx, url, data); err != nil {
			d.logger.Warn("webhook send failed", zap.String("url", url), zap.Error(err))
			lastErr = err
		}
	}
	return lastErr
}

func (d *Dispatcher) sendWechat(ctx context.Context, n *Notification) error {
	if d.cfg.WechatWebhook == "" {
		return nil
	}
	payload := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"content": fmt.Sprintf("## %s\n\n```\n%s\n```\n[查看原文](%s)",
				n.Subject, n.Body, n.Announcement.SourceURL),
		},
	}
	data, _ := json.Marshal(payload)
	return d.postJSON(ctx, d.cfg.WechatWebhook, data)
}

func (d *Dispatcher) sendEmail(ctx context.Context, n *Notification) error {
	if d.cfg.SMTPHost == "" || len(d.cfg.EmailTo) == 0 {
		return nil
	}

	from := d.cfg.EmailFrom
	if from == "" {
		from = d.cfg.SMTPUser
	}
	addr := fmt.Sprintf("%s:%d", d.cfg.SMTPHost, d.cfg.SMTPPort)
	auth := smtp.PlainAuth("", d.cfg.SMTPUser, d.cfg.SMTPPassword, d.cfg.SMTPHost)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, strings.Join(d.cfg.EmailTo, ","), n.Subject, n.Body)

	var dialer net.Dialer
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, d.cfg.SMTPHost)
	if err != nil {
		return fmt.Errorf("smtp new client: %w", err)
	}
	defer client.Quit()

	if d.cfg.SMTPPassword != "" {
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	for _, to := range d.cfg.EmailTo {
		if err := client.Rcpt(to); err != nil {
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte(msg)); err != nil {
		return err
	}
	return w.Close()
}

func (d *Dispatcher) sendSMS(ctx context.Context, n *Notification) error {
	if d.cfg.SMSAPI == "" || len(d.cfg.SMSPhones) == 0 {
		return nil
	}
	payload := map[string]interface{}{
		"phones":   d.cfg.SMSPhones,
		"content":  n.Subject + " - " + truncate(n.Body, 100),
		"api_key":  d.cfg.SMSAPIKey,
	}
	data, _ := json.Marshal(payload)
	return d.postJSON(ctx, d.cfg.SMSAPI, data)
}

func (d *Dispatcher) postJSON(ctx context.Context, url string, data []byte) error {
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}
