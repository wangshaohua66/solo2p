package notify

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"patent-agent/internal/config"
)

type Notifier interface {
	Send(title, content string) error
	Name() string
}

type Notification struct {
	Title   string
	Content string
	Level   string
}

type WeComNotifier struct {
	WebhookURL string
}

type WeComMessage struct {
	MsgType string `json:"msgtype"`
	Text    struct {
		Content string `json:"content"`
	} `json:"text"`
}

func NewWeComNotifier(cfg config.WeComConfig) *WeComNotifier {
	return &WeComNotifier{WebhookURL: cfg.WebhookURL}
}

func (w *WeComNotifier) Name() string { return "wecom" }

func (w *WeComNotifier) Send(title, content string) error {
	if w.WebhookURL == "" {
		return fmt.Errorf("wecom webhook url not configured")
	}

	msg := WeComMessage{MsgType: "text"}
	msg.Text.Content = fmt.Sprintf("【%s】\n%s\n%s", title, content, time.Now().Format("2006-01-02 15:04:05"))

	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal wecom message failed: %w", err)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(w.WebhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("send wecom message failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("wecom api error: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var result struct {
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	json.Unmarshal(respBody, &result)
	if result.ErrCode != 0 {
		return fmt.Errorf("wecom notify failed: errcode=%d errmsg=%s", result.ErrCode, result.ErrMsg)
	}

	return nil
}

type EmailNotifier struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	To       []string
}

func NewEmailNotifier(cfg config.EmailConfig) *EmailNotifier {
	return &EmailNotifier{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		Username: cfg.Username,
		Password: cfg.Password,
		From:     cfg.From,
		To:       cfg.To,
	}
}

func (e *EmailNotifier) Name() string { return "email" }

func (e *EmailNotifier) Send(title, content string) error {
	if e.Host == "" || len(e.To) == 0 {
		return fmt.Errorf("email not configured")
	}

	header := make(map[string]string)
	header["From"] = e.From
	header["To"] = strings.Join(e.To, ",")
	header["Subject"] = fmt.Sprintf("=?UTF-8?B?%s?=", encodeBase64(title))
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/plain; charset=UTF-8"
	header["Content-Transfer-Encoding"] = "base64"

	message := ""
	for k, v := range header {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + encodeBase64(content)

	auth := smtp.PlainAuth("", e.Username, e.Password, e.Host)
	tlsconfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         e.Host,
	}

	addr := fmt.Sprintf("%s:%d", e.Host, e.Port)
	conn, err := tls.Dial("tcp", addr, tlsconfig)
	if err != nil {
		return fmt.Errorf("dial smtp server failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, e.Host)
	if err != nil {
		return fmt.Errorf("create smtp client failed: %w", err)
	}
	defer client.Quit()

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth failed: %w", err)
	}

	if err := client.Mail(e.From); err != nil {
		return fmt.Errorf("smtp mail failed: %w", err)
	}

	for _, rcpt := range e.To {
		if err := client.Rcpt(rcpt); err != nil {
			return fmt.Errorf("smtp rcpt failed: %w", err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data failed: %w", err)
	}
	if _, err := w.Write([]byte(message)); err != nil {
		return fmt.Errorf("smtp write failed: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close failed: %w", err)
	}

	return nil
}

type SMSNotifier struct {
	APIKey    string
	APISecret string
	Template  string
	Receivers []string
}

func NewSMSNotifier(cfg config.SMSConfig) *SMSNotifier {
	return &SMSNotifier{
		APIKey:    cfg.APIKey,
		APISecret: cfg.APISecret,
		Template:  cfg.Template,
		Receivers: cfg.Receivers,
	}
}

func (s *SMSNotifier) Name() string { return "sms" }

func (s *SMSNotifier) Send(title, content string) error {
	if s.APIKey == "" || len(s.Receivers) == 0 {
		return fmt.Errorf("sms not configured")
	}
	return nil
}

type MultiNotifier struct {
	notifiers []Notifier
}

func NewMultiNotifier(cfg *config.NotifyConfig) *MultiNotifier {
	m := &MultiNotifier{}
	for _, name := range cfg.Enabled {
		switch name {
		case "wecom":
			m.notifiers = append(m.notifiers, NewWeComNotifier(cfg.WeCom))
		case "email":
			m.notifiers = append(m.notifiers, NewEmailNotifier(cfg.Email))
		case "sms":
			m.notifiers = append(m.notifiers, NewSMSNotifier(cfg.SMS))
		}
	}
	return m
}

func (m *MultiNotifier) Send(title, content string) error {
	var errs []string
	for _, n := range m.notifiers {
		if err := n.Send(title, content); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", n.Name(), err))
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("notify partial failed: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (m *MultiNotifier) SendNotification(n Notification) error {
	levelPrefix := ""
	switch n.Level {
	case "critical":
		levelPrefix = "【紧急】"
	case "warning":
		levelPrefix = "【预警】"
	default:
		levelPrefix = "【通知】"
	}
	return m.Send(levelPrefix+n.Title, n.Content)
}

func encodeBase64(s string) string {
	return strings.TrimRight(
		base64Encode([]byte(s)),
		"\r\n",
	)
}

func base64Encode(src []byte) string {
	const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	var buf bytes.Buffer
	for len(src) > 0 {
		var b [3]byte
		var n int
		if len(src) >= 3 {
			n = 3
		} else {
			n = len(src)
		}
		copy(b[:], src[:n])
		src = src[n:]

		buf.WriteByte(base64Chars[b[0]>>2])
		buf.WriteByte(base64Chars[((b[0]&0x3f)<<4)|(b[1]>>4)])
		if n > 1 {
			buf.WriteByte(base64Chars[((b[1]&0x0f)<<2)|(b[2]>>6)])
		} else {
			buf.WriteByte('=')
		}
		if n > 2 {
			buf.WriteByte(base64Chars[b[2]&0x3f])
		} else {
			buf.WriteByte('=')
		}
	}
	return buf.String()
}
