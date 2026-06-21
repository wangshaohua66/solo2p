package notify

import (
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"clear-system/internal/config"
	"clear-system/internal/model"
)

type Notifier interface {
	Send(subject, content string, targets []string, bizDate string, instID string) error
}

type MultiNotifier struct {
	cfg    *config.AppConfig
	smtp   *SMTPNotifier
	sms    *SMSNotifier
	record func(n model.Notification) error
}

func NewMultiNotifier(cfg *config.AppConfig, recordFn func(n model.Notification) error) *MultiNotifier {
	return &MultiNotifier{
		cfg:    cfg,
		smtp:   NewSMTPNotifier(cfg.Notify.SMTP),
		sms:    NewSMSNotifier(cfg.Notify.SMS),
		record: recordFn,
	}
}

func (m *MultiNotifier) Send(notifyType, subject, content string, targets []NotifyTarget, bizDate, instID string) error {
	var errs []string
	for _, t := range targets {
		var n model.Notification
		switch t.Type {
		case "email":
			n = model.Notification{
				SendTime: time.Now(), Type: "EMAIL",
				Target: t.Value, Title: subject, Content: content,
				InstID: instID, BizDate: bizDate, Status: "PENDING",
			}
			if m.smtp != nil {
				if err := m.smtp.Send(subject, content, []string{t.Value}); err != nil {
					n.Status = "FAILED"
					errs = append(errs, fmt.Sprintf("email %s: %v", t.Value, err))
				} else {
					n.Status = "SENT"
				}
			}
		case "sms":
			n = model.Notification{
				SendTime: time.Now(), Type: "SMS",
				Target: t.Value, Title: subject, Content: content,
				InstID: instID, BizDate: bizDate, Status: "PENDING",
			}
			if m.sms != nil {
				if err := m.sms.Send(subject, content, []string{t.Value}); err != nil {
					n.Status = "FAILED"
					errs = append(errs, fmt.Sprintf("sms %s: %v", t.Value, err))
				} else {
					n.Status = "SENT"
				}
			}
		}
		if m.record != nil {
			_ = m.record(n)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("部分通知失败: %s", strings.Join(errs, "; "))
	}
	return nil
}

type NotifyTarget struct {
	Type  string
	Value string
}

type SMTPNotifier struct {
	cfg config.SMTPConfig
}

func NewSMTPNotifier(cfg config.SMTPConfig) *SMTPNotifier {
	if cfg.Host == "" {
		return nil
	}
	return &SMTPNotifier{cfg: cfg}
}

func (s *SMTPNotifier) Send(subject, content string, to []string) error {
	if s == nil || s.cfg.Host == "" {
		return nil
	}
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	auth := smtp.PlainAuth("", s.cfg.User, s.cfg.Password, s.cfg.Host)
	from := s.cfg.From
	if from == "" {
		from = s.cfg.User
	}
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n"+
		"MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, strings.Join(to, ","), subject, content)
	return smtp.SendMail(addr, auth, from, to, []byte(msg))
}

type SMSNotifier struct {
	cfg config.SMSConfig
}

func NewSMSNotifier(cfg config.SMSConfig) *SMSNotifier {
	if cfg.Gateway == "" {
		return nil
	}
	return &SMSNotifier{cfg: cfg}
}

func (s *SMSNotifier) Send(subject, content string, to []string) error {
	if s == nil || s.cfg.Gateway == "" {
		return nil
	}
	fullContent := content
	if s.cfg.Sign != "" {
		fullContent = "【" + s.cfg.Sign + "】" + content
	}
	_ = subject
	_ = to
	_ = fullContent
	return nil
}

type ReconcileReport struct {
	BizDate          string
	TotalFlows       int
	MatchedPairs     int
	UnilateralCount  int
	MismatchCount    int
	ProcessingTime   string
	DeadlineWarning  bool
	TimeLeft         string
}

func BuildReconcileNotify(r ReconcileReport) (subject, body string) {
	subject = fmt.Sprintf("[清算对账] %s 对账结果通知", r.BizDate)
	status := "✅ 正常"
	if r.UnilateralCount > 0 || r.MismatchCount > 0 {
		status = "⚠️ 存在异常"
	}
	deadlineMsg := ""
	if r.DeadlineWarning {
		deadlineMsg = fmt.Sprintf("\n⚠️ 清算窗口倒计时: %s，请尽快完成后续处理！", r.TimeLeft)
	}
	body = fmt.Sprintf(`尊敬的清算管理员：

%s 日终清算对账已完成，结果如下：
——————————————————————
  对账状态：%s
  总流水数：%d 笔
  成功匹配：%d 对
  挂账流水：%d 笔
  不匹配数：%d 笔
  处理耗时：%s
——————————————————————
%s

请及时登录清算系统查看详细信息并处理异常流水。

-- 清算中心自动通知
`, r.BizDate, status, r.TotalFlows, r.MatchedPairs,
		r.UnilateralCount, r.MismatchCount, r.ProcessingTime, deadlineMsg)
	return
}

type SettleReport struct {
	SettleDate  string
	InstCount   int
	TotalAmount string
	InstructionCount int
	DeadlinePassed bool
	OutputDir   string
}

func BuildSettleNotify(r SettleReport) (subject, body string) {
	subject = fmt.Sprintf("[清算指令] %s 清算指令生成通知", r.SettleDate)
	status := "✅ 已完成"
	if r.DeadlinePassed {
		status = "❌ 已超过清算窗口"
	}
	body = fmt.Sprintf(`尊敬的清算管理员：

%s 日终轧差清算已完成，结果如下：
——————————————————————
  清算状态：%s
  参与机构：%d 家
  清算金额：%s 元
  生成指令：%d 条
  输出目录：%s
——————————————————————

请核对清算指令并提交至央行支付系统。

-- 清算中心自动通知
`, r.SettleDate, status, r.InstCount, r.TotalAmount,
		r.InstructionCount, r.OutputDir)
	return
}
