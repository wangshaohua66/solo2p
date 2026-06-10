package notify

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/security/vulnmonitor/internal/logger"
	"github.com/security/vulnmonitor/internal/retry"
	"github.com/security/vulnmonitor/internal/storage"
)

type ChannelType string

const (
	ChannelEmail   ChannelType = "email"
	ChannelSlack   ChannelType = "slack"
	ChannelServerChan ChannelType = "serverchan"
	ChannelPhone   ChannelType = "phone"
	ChannelSMS     ChannelType = "sms"
)

type Notification struct {
	ID        string
	Vuln      *storage.Vulnerability
	Channel   ChannelType
	Severity  storage.Severity
	Status    string
	Error     string
	CreatedAt time.Time
}

type Config struct {
	SMTP       SMTPConfig       `yaml:"smtp"`
	Slack      SlackConfig      `yaml:"slack"`
	ServerChan ServerChanConfig `yaml:"serverchan"`
	Routing    RoutingConfig    `yaml:"routing"`
	Templates  TemplateConfig   `yaml:"templates"`
}

type SMTPConfig struct {
	Enabled  bool   `yaml:"enabled"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	From     string `yaml:"from"`
	To       []string `yaml:"to"`
	UseTLS   bool   `yaml:"use_tls"`
}

type SlackConfig struct {
	Enabled   bool   `yaml:"enabled"`
	WebhookURL string `yaml:"webhook_url"`
	Channel   string `yaml:"channel"`
	Username  string `yaml:"username"`
}

type ServerChanConfig struct {
	Enabled bool   `yaml:"enabled"`
	SendKey string `yaml:"send_key"`
	APIURL  string `yaml:"api_url"`
}

type RoutingConfig struct {
	Critical []ChannelType `yaml:"critical"`
	High     []ChannelType `yaml:"high"`
	Medium   []ChannelType `yaml:"medium"`
	Low      []ChannelType `yaml:"low"`
}

type TemplateConfig struct {
	EmailTemplate   string `yaml:"email_template"`
	SlackTemplate   string `yaml:"slack_template"`
	SubjectTemplate string `yaml:"subject_template"`
}

type Notifier interface {
	Send(ctx context.Context, vuln *storage.Vulnerability) error
	Channel() ChannelType
	Enabled() bool
}

type Manager struct {
	cfg      Config
	log      *logger.Logger
	retryer  *retry.Retryer
	notifiers map[ChannelType]Notifier
	history  []Notification
	mu       sync.RWMutex
}

func NewManager(cfg Config, log *logger.Logger, retryer *retry.Retryer) *Manager {
	if log == nil {
		log = logger.Default()
	}
	if retryer == nil {
		retryer = retry.New(retry.DefaultConfig(), log)
	}

	m := &Manager{
		cfg:      cfg,
		log:      log,
		retryer:  retryer,
		notifiers: make(map[ChannelType]Notifier),
	}

	if cfg.SMTP.Enabled {
		m.notifiers[ChannelEmail] = &EmailNotifier{cfg: cfg.SMTP, tmpl: cfg.Templates, log: log}
	}
	if cfg.Slack.Enabled {
		m.notifiers[ChannelSlack] = &SlackNotifier{cfg: cfg.Slack, tmpl: cfg.Templates, log: log}
	}
	if cfg.ServerChan.Enabled {
		m.notifiers[ChannelServerChan] = &ServerChanNotifier{cfg: cfg.ServerChan, log: log}
	}

	return m
}

func (m *Manager) Notify(ctx context.Context, vuln *storage.Vulnerability) error {
	if vuln == nil {
		return fmt.Errorf("nil vulnerability")
	}

	channels := m.getChannelsForSeverity(vuln.Severity)
	if len(channels) == 0 {
		m.log.Infof("no channels configured for severity %s, skipping notification for %s",
			vuln.Severity, vuln.CVEID)
		return nil
	}

	var wg sync.WaitGroup
	var firstErr error
	var errMu sync.Mutex

	for _, ch := range channels {
		notifier, ok := m.notifiers[ch]
		if !ok || !notifier.Enabled() {
			continue
		}

		wg.Add(1)
		go func(n Notifier, vuln *storage.Vulnerability) {
			defer wg.Done()

			traceID := logger.NewTraceID()
			log := m.log.WithTraceID(traceID)

			notif := Notification{
				ID:        traceID,
				Vuln:      vuln,
				Channel:   n.Channel(),
				Severity:  vuln.Severity,
				Status:    "pending",
				CreatedAt: time.Now(),
			}

			err := m.retryer.Do(ctx, fmt.Sprintf("notify-%s-%s", n.Channel(), vuln.CVEID),
				func(ctx context.Context) error {
					return n.Send(ctx, vuln)
				})

			m.mu.Lock()
			if err != nil {
				notif.Status = "failed"
				notif.Error = err.Error()
				log.Errorf("notification failed via %s: %v", n.Channel(), err)
				errMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				errMu.Unlock()
			} else {
				notif.Status = "sent"
				log.Infof("notification sent via %s for %s", n.Channel(), vuln.CVEID)
			}
			m.history = append(m.history, notif)
			m.mu.Unlock()
		}(notifier, vuln)
	}

	wg.Wait()
	return firstErr
}

func (m *Manager) NotifyBatch(ctx context.Context, vulns []*storage.Vulnerability) int {
	count := 0
	for _, v := range vulns {
		if err := m.Notify(ctx, v); err == nil {
			count++
		}
	}
	return count
}

func (m *Manager) SendDailyReport(ctx context.Context, vulns []*storage.Vulnerability) error {
	if len(vulns) == 0 {
		return nil
	}

	lowVulns := make([]*storage.Vulnerability, 0)
	for _, v := range vulns {
		if v.Severity == storage.SeverityLow {
			lowVulns = append(lowVulns, v)
		}
	}

	if len(lowVulns) == 0 {
		return nil
	}

	if emailNotifier, ok := m.notifiers[ChannelEmail].(*EmailNotifier); ok {
		summary := &storage.Vulnerability{
			CVEID:        fmt.Sprintf("DAILY-%d", time.Now().Day()),
			Title:        fmt.Sprintf("Daily Low-Severity Vulnerability Report (%d items)", len(lowVulns)),
			Description:  buildDailyReport(lowVulns),
			Severity:     storage.SeverityLow,
			PublishedAt:  time.Now(),
			DiscoveredAt: time.Now(),
		}
		return emailNotifier.Send(ctx, summary)
	}

	return nil
}

func buildDailyReport(vulns []*storage.Vulnerability) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Daily vulnerability report - %d low-severity items:\n\n", len(vulns)))
	for i, v := range vulns {
		sb.WriteString(fmt.Sprintf("%d. %s - %s\n", i+1, v.CVEID, v.Title))
		sb.WriteString(fmt.Sprintf("   Component: %s %s\n", v.Component, v.AffectedRange))
		sb.WriteString(fmt.Sprintf("   CVSS: %.1f\n\n", v.CVSSScore))
	}
	return sb.String()
}

func (m *Manager) getChannelsForSeverity(s storage.Severity) []ChannelType {
	switch s {
	case storage.SeverityCritical:
		return m.cfg.Routing.Critical
	case storage.SeverityHigh:
		return m.cfg.Routing.High
	case storage.SeverityMedium:
		return m.cfg.Routing.Medium
	case storage.SeverityLow:
		return m.cfg.Routing.Low
	default:
		return nil
	}
}

func (m *Manager) GetHistory() []Notification {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h := make([]Notification, len(m.history))
	copy(h, m.history)
	return h
}

type EmailNotifier struct {
	cfg  SMTPConfig
	tmpl TemplateConfig
	log  *logger.Logger
}

func (n *EmailNotifier) Channel() ChannelType { return ChannelEmail }
func (n *EmailNotifier) Enabled() bool      { return n.cfg.Enabled }

func (n *EmailNotifier) Send(ctx context.Context, vuln *storage.Vulnerability) error {
	subject := renderTemplate(n.tmpl.SubjectTemplate, vuln)
	body := renderTemplate(n.tmpl.EmailTemplate, vuln)

	if subject == "" {
		subject = fmt.Sprintf("[%s] Security Alert: %s", vuln.Severity, vuln.CVEID)
	}
	if body == "" {
		body = buildDefaultEmailBody(vuln)
	}

	auth := smtp.PlainAuth("", n.cfg.Username, n.cfg.Password, n.cfg.Host)
	addr := fmt.Sprintf("%s:%d", n.cfg.Host, n.cfg.Port)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		n.cfg.From, strings.Join(n.cfg.To, ", "), subject, body)

	if n.cfg.UseTLS {
		return n.sendTLS(addr, auth, msg)
	}

	return smtp.SendMail(addr, auth, n.cfg.From, n.cfg.To, []byte(msg))
}

func (n *EmailNotifier) sendTLS(addr string, auth smtp.Auth, msg string) error {
	host, _, _ := strings.Cut(addr, ":")
	tlsConfig := &tls.Config{
		ServerName: host,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer client.Quit()

	if err := client.Auth(auth); err != nil {
		return err
	}

	if err := client.Mail(""); err != nil {
		return err
	}
	for _, rcpt := range n.cfg.To {
		if err := client.Rcpt(rcpt); err != nil {
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

func buildDefaultEmailBody(v *storage.Vulnerability) string {
	assets := "None"
	if len(v.AffectedAssets) > 0 {
		assets = strings.Join(v.AffectedAssets, ", ")
	}

	refs := ""
	for _, r := range v.References {
		refs += fmt.Sprintf("<li><a href=\"%s\">%s</a></li>", r, r)
	}

	return fmt.Sprintf(`
<html>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
    <div style="padding: 20px; background-color: #fff5f5; border-left: 4px solid #e53e3e;">
        <h2 style="margin-top: 0; color: #c53030;">Security Vulnerability Alert</h2>
        <h3 style="color: #1a202c;">%s - %s</h3>
    </div>
    
    <div style="padding: 20px;">
        <table style="width: 100%%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Severity:</td><td style="padding: 8px; color: %s;">%s (CVSS: %.1f)</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Component:</td><td style="padding: 8px;">%s</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Affected:</td><td style="padding: 8px;">%s</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Fixed in:</td><td style="padding: 8px;">%s</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Published:</td><td style="padding: 8px;">%s</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Affected Assets:</td><td style="padding: 8px;">%s</td></tr>
        </table>
        
        <h4 style="margin-top: 20px;">Description:</h4>
        <p style="line-height: 1.6;">%s</p>
        
        <h4 style="margin-top: 20px;">References:</h4>
        <ul>%s</ul>
        
        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 12px;">This is an automated security alert from VulnMonitor.</p>
    </div>
</body>
</html>
`, v.CVEID, v.Title, getSeverityColor(v.Severity), v.Severity, v.CVSSScore,
		v.Component, v.AffectedRange, v.FixedVersion,
		v.PublishedAt.Format("2006-01-02 15:04"), assets,
		v.Description, refs)
}

func getSeverityColor(s storage.Severity) string {
	switch s {
	case storage.SeverityCritical:
		return "#c53030"
	case storage.SeverityHigh:
		return "#dd6b20"
	case storage.SeverityMedium:
		return "#d69e2e"
	default:
		return "#38a169"
	}
}

type SlackNotifier struct {
	cfg  SlackConfig
	tmpl TemplateConfig
	log  *logger.Logger
}

func (n *SlackNotifier) Channel() ChannelType { return ChannelSlack }
func (n *SlackNotifier) Enabled() bool      { return n.cfg.Enabled }

func (n *SlackNotifier) Send(ctx context.Context, vuln *storage.Vulnerability) error {
	payload := buildSlackPayload(vuln, n.cfg)

	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", n.cfg.WebhookURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("slack webhook error %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

func buildSlackPayload(v *storage.Vulnerability, cfg SlackConfig) map[string]interface{} {
	color := getSeverityColor(v.Severity)
	if color[0] != '#' {
		color = "#" + color
	}

	fields := []map[string]interface{}{
		{"title": "Severity", "value": fmt.Sprintf("%s (%.1f)", v.Severity, v.CVSSScore), "short": true},
		{"title": "Component", "value": v.Component, "short": true},
		{"title": "Affected Range", "value": v.AffectedRange, "short": true},
		{"title": "Fixed Version", "value": firstNonEmpty(v.FixedVersion, "N/A"), "short": true},
	}

	if len(v.AffectedAssets) > 0 {
		fields = append(fields, map[string]interface{}{
			"title": "Affected Assets",
			"value": strings.Join(v.AffectedAssets, ", "),
			"short": false,
		})
	}

	actions := []map[string]interface{}{}
	if len(v.References) > 0 {
		for _, ref := range v.References[:3] {
			actions = append(actions, map[string]interface{}{
				"type": "button",
				"text": map[string]string{"type": "plain_text", "text": "View Reference"},
				"url":  ref,
			})
		}
	}

	return map[string]interface{}{
		"channel":      cfg.Channel,
		"username":     cfg.Username,
		"attachments": []map[string]interface{}{
			{
				"color":   color,
				"title":   fmt.Sprintf("[%s] %s - %s", v.Severity, v.CVEID, v.Title),
				"text":    v.Description,
				"fields":  fields,
				"actions": actions,
				"footer":  "VulnMonitor Security Alert",
				"ts":      v.PublishedAt.Unix(),
			},
		},
	}
}

type ServerChanNotifier struct {
	cfg ServerChanConfig
	log *logger.Logger
}

func (n *ServerChanNotifier) Channel() ChannelType { return ChannelServerChan }
func (n *ServerChanNotifier) Enabled() bool      { return n.cfg.Enabled }

func (n *ServerChanNotifier) Send(ctx context.Context, vuln *storage.Vulnerability) error {
	title := fmt.Sprintf("[%s] %s", vuln.Severity, vuln.CVEID)
	descr := fmt.Sprintf("%s\n\nComponent: %s %s\nCVSS: %.1f\nFixed: %s",
		vuln.Title, vuln.Component, vuln.AffectedRange, vuln.CVSSScore, vuln.FixedVersion)
	if len(vuln.References) > 0 {
		descr += "\n\nReferences:\n" + vuln.References[0]
	}

	apiURL := n.cfg.APIURL
	if apiURL == "" {
		apiURL = fmt.Sprintf("https://sctapi.ftqq.com/%s.send", n.cfg.SendKey)
	}

	payload := map[string]string{
		"title": title,
		"desp":  descr,
	}

	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)

	if code, ok := result["code"].(float64); ok && code != 0 {
		return fmt.Errorf("serverchan error: %s", string(respBody))
	}

	return nil
}

func renderTemplate(tmplStr string, data interface{}) string {
	if tmplStr == "" {
		return ""
	}

	tmpl, err := template.New("notif").Parse(tmplStr)
	if err != nil {
		return ""
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return ""
	}

	return buf.String()
}

func firstNonEmpty(s ...string) string {
	for _, v := range s {
		if v != "" {
			return v
		}
	}
	return ""
}
