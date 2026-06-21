package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type SMSConfig struct {
	APIURL string
	APIKey string
	Sign   string
}

type SMSService struct {
	config SMSConfig
	client *http.Client
}

func NewSMSService() *SMSService {
	return &SMSService{
		config: SMSConfig{
			APIURL: os.Getenv("SMS_API_URL"),
			APIKey: os.Getenv("SMS_API_KEY"),
			Sign:   os.Getenv("SMS_SIGN"),
		},
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *SMSService) SendSMS(phone, content string) error {
	if phone == "" {
		return nil
	}

	if s.config.APIURL == "" {
		log.Printf("[SMS](mock) phone=%s content=%s", phone, content)
		return nil
	}

	sign := s.config.Sign
	if sign == "" {
		sign = "精神健康管理系统"
	}
	payload := map[string]string{
		"phone":   phone,
		"content": fmt.Sprintf("【%s】%s", sign, content),
		"apiKey":  s.config.APIKey,
	}
	body, _ := json.Marshal(payload)

	resp, err := s.client.Post(s.config.APIURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[SMS] send error: phone=%s err=%v", phone, err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("[SMS] send failed: phone=%s status=%d", phone, resp.StatusCode)
	}
	return nil
}

func (s *SMSService) SendWarningNotification(doctorPhone, patientName string, riskScore int, factors []string) error {
	msg := fmt.Sprintf("精神健康预警通知：患者 %s 当前风险评分 %d，触发因素：%s，请及时跟进处理。",
		patientName, riskScore, strings.Join(factors, "、"))
	return s.SendSMS(doctorPhone, msg)
}

func (s *SMSService) SendFollowupReminder(patientPhone, doctorName, date string) error {
	msg := fmt.Sprintf("随访提醒：您于 %s 有随访安排，负责医生：%s，请按时就诊。", date, doctorName)
	return s.SendSMS(patientPhone, msg)
}
