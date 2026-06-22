package notifier

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"

	"terminal-dispatcher/internal/config"
)

type Notifier struct {
	cfg *config.NotifierConfig
}

type Message struct {
	Subject   string
	Body      string
	To        []string
	Channel   string
	Template  string
	Data      map[string]interface{}
}

func New(cfg *config.NotifierConfig) *Notifier {
	return &Notifier{cfg: cfg}
}

func (n *Notifier) Send(msg *Message) error {
	var errs []string

	if n.cfg.Email.Enabled && (msg.Channel == "" || msg.Channel == "email") {
		if err := n.sendEmail(msg); err != nil {
			errs = append(errs, fmt.Sprintf("email: %v", err))
		}
	}

	if n.cfg.SMS.Enabled && (msg.Channel == "" || msg.Channel == "sms") {
		if err := n.sendSMS(msg); err != nil {
			errs = append(errs, fmt.Sprintf("sms: %v", err))
		}
	}

	if n.cfg.Webhook.Enabled && (msg.Channel == "" || msg.Channel == "webhook") {
		if err := n.sendWebhook(msg); err != nil {
			errs = append(errs, fmt.Sprintf("webhook: %v", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("notification errors: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (n *Notifier) sendEmail(msg *Message) error {
	if !n.cfg.Email.Enabled {
		return nil
	}
	if len(msg.To) == 0 {
		return fmt.Errorf("no recipients")
	}

	auth := smtp.PlainAuth("", n.cfg.Email.Username, n.cfg.Email.Password, n.cfg.Email.Host)
	addr := fmt.Sprintf("%s:%d", n.cfg.Email.Host, n.cfg.Email.Port)

	body := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		n.cfg.Email.From, strings.Join(msg.To, ","), msg.Subject, msg.Body)

	return smtp.SendMail(addr, auth, n.cfg.Email.From, msg.To, []byte(body))
}

func (n *Notifier) sendSMS(msg *Message) error {
	if !n.cfg.SMS.Enabled {
		return nil
	}
	if len(msg.To) == 0 {
		return fmt.Errorf("no recipients")
	}

	payload := map[string]interface{}{
		"api_key":     n.cfg.SMS.APIKey,
		"to":          msg.To,
		"message":     msg.Subject + "\n" + msg.Body,
	}

	body, _ := json.Marshal(payload)
	resp, err := http.Post(n.cfg.SMS.APIURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("sms api status %d", resp.StatusCode)
	}
	return nil
}

func (n *Notifier) sendWebhook(msg *Message) error {
	if !n.cfg.Webhook.Enabled {
		return nil
	}

	payload := map[string]interface{}{
		"subject":   msg.Subject,
		"body":      msg.Body,
		"to":        msg.To,
		"template":  msg.Template,
		"data":      msg.Data,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", n.cfg.Webhook.URL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if n.cfg.Webhook.Secret != "" {
		req.Header.Set("X-Secret", n.cfg.Webhook.Secret)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook status %d", resp.StatusCode)
	}
	return nil
}

func (n *Notifier) NotifyBerthAssignment(vesselName, berth, eta, etd, email string) error {
	msg := &Message{
		Subject:  fmt.Sprintf("靠泊分配通知 - %s", vesselName),
		Body:     fmt.Sprintf("尊敬的船公司：\n\n船舶 %s 已分配至 %s 泊位。\n预计到港时间：%s\n预计离港时间：%s\n\n调度中心", vesselName, berth, eta, etd),
		To:       []string{email},
		Channel:  "",
	}
	return n.Send(msg)
}

func (n *Notifier) NotifyRelease(containerNo, ff string, email string) error {
	msg := &Message{
		Subject:  fmt.Sprintf("海关放行通知 - 柜号 %s", containerNo),
		Body:     fmt.Sprintf("尊敬的货代 %s：\n\n货柜 %s 已通过海关放行，请尽快安排提箱。\n\n码头调度中心", ff, containerNo),
		To:       []string{email},
		Channel:  "",
	}
	return n.Send(msg)
}

func (n *Notifier) NotifyETAVessel(vesselName, oldETA, newETA string, emails []string) error {
	msg := &Message{
		Subject:  fmt.Sprintf("到港时间变更 - %s", vesselName),
		Body:     fmt.Sprintf("船舶 %s 到港时间变更：\n原ETA：%s\n新ETA：%s\n\n请相关方调整作业计划。\n\n调度中心", vesselName, oldETA, newETA),
		To:       emails,
		Channel:  "",
	}
	return n.Send(msg)
}
