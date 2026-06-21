package scraper

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"go.uber.org/zap"

	"patent-agent/internal/config"
	"patent-agent/internal/model"
	"gorm.io/gorm"
)

type FeeQueryScraper struct {
	*BaseScraper
	endpoint config.SystemEndpoint
}

type FeeInfo struct {
	AppNum          string
	CurrentFeeYear  int
	AnnualFees      []AnnualFeeInfo
	PaymentHistory  []PaymentRecord
	TotalOutstanding float64
	FeeReduction     bool
}

type AnnualFeeInfo struct {
	Year            int
	FeeAmount       float64
	DueDate         *time.Time
	Paid            bool
	PaidAmount      float64
	PaymentDate     *time.Time
	LateFeeAmount   float64
	Overdue         bool
	DaysOverdue     int
	Status          string
}

type PaymentRecord struct {
	FeeType         string
	Amount          float64
	PaymentDate     *time.Time
	ReceiptNo       string
	Remark          string
}

func NewFeeQueryScraper(cfg config.SystemEndpoint, db *gorm.DB) *FeeQueryScraper {
	return &FeeQueryScraper{
		BaseScraper: NewBaseScraper("feequery", cfg.BaseURL, cfg.LoginURL, cfg.Timeout, db),
		endpoint:    cfg,
	}
}

func (s *FeeQueryScraper) LoginWithQRCode(ctx context.Context) error {
	return s.BaseScraper.LoginWithQRCodeCommon(ctx, s.LoginURL, s.SystemName)
}

func (s *FeeQueryScraper) Login(username, password string) error {
	s.Account = username
	if err := s.LoadCookies(); err == nil {
		config.Logger.Info("loaded saved session", zap.String("system", s.SystemName))
		if err := s.Heartbeat(); err == nil {
			return nil
		}
	}
	return fmt.Errorf("cookie login failed, use QR code login instead")
}

func (s *FeeQueryScraper) QueryFeeInfo(appNum string) (*FeeInfo, error) {
	if !s.LoggedIn {
		return nil, errors.New("not logged in")
	}

	url := fmt.Sprintf("%s/feeQuery?appNum=%s", s.BaseURL, appNum)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	s.setCommonHeaders(req)
	req.Header.Set("Referer", s.BaseURL+"/")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusFound {
			s.LoggedIn = false
			return nil, errors.New("session expired")
		}
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	return s.parseFeeHTML(resp.Body, appNum)
}

func (s *FeeQueryScraper) parseFeeHTML(r io.Reader, appNum string) (*FeeInfo, error) {
	doc, err := goquery.NewDocumentFromReader(r)
	if err != nil {
		return nil, fmt.Errorf("parse html failed: %w", err)
	}

	feeInfo := &FeeInfo{AppNum: appNum}

	feeReductionText := strings.TrimSpace(doc.Find(".fee-reduction-status").Text())
	feeInfo.FeeReduction = strings.Contains(feeReductionText, "已费减") || strings.Contains(feeReductionText, "费减备案")

	if yearText := strings.TrimSpace(doc.Find(".current-fee-year").Text()); yearText != "" {
		re := extractNumber(yearText)
		if y, err := strconv.Atoi(re); err == nil {
			feeInfo.CurrentFeeYear = y
		}
	}

	doc.Find(".annual-fee-table tbody tr").Each(func(i int, sel *goquery.Selection) {
		af := AnnualFeeInfo{}
		cols := sel.Find("td")

		if cols.Length() >= 6 {
			if y, err := strconv.Atoi(strings.TrimSpace(cols.Eq(0).Text())); err == nil {
				af.Year = y
			}
			af.FeeAmount = parseAmount(strings.TrimSpace(cols.Eq(1).Text()))

			if dateStr := strings.TrimSpace(cols.Eq(2).Text()); dateStr != "" {
				if t, err := parseDate(dateStr); err == nil {
					af.DueDate = &t
				}
			}

			af.Status = strings.TrimSpace(cols.Eq(3).Text())
			af.Paid = strings.Contains(af.Status, "已缴") || strings.Contains(af.Status, "已交")

			af.PaidAmount = parseAmount(strings.TrimSpace(cols.Eq(4).Text()))
			if dateStr := strings.TrimSpace(cols.Eq(5).Text()); dateStr != "" {
				if t, err := parseDate(dateStr); err == nil {
					af.PaymentDate = &t
				}
			}

			if cols.Length() >= 7 {
				af.LateFeeAmount = parseAmount(strings.TrimSpace(cols.Eq(6).Text()))
			}

			if !af.Paid && af.DueDate != nil {
				overdueDays := int(time.Since(*af.DueDate).Hours() / 24)
				if overdueDays > 0 {
					af.Overdue = true
					af.DaysOverdue = overdueDays
				}
			}

			feeInfo.AnnualFees = append(feeInfo.AnnualFees, af)
		}
	})

	doc.Find(".payment-history tbody tr").Each(func(i int, sel *goquery.Selection) {
		pr := PaymentRecord{}
		cols := sel.Find("td")
		if cols.Length() >= 4 {
			pr.FeeType = strings.TrimSpace(cols.Eq(0).Text())
			pr.Amount = parseAmount(strings.TrimSpace(cols.Eq(1).Text()))
			if dateStr := strings.TrimSpace(cols.Eq(2).Text()); dateStr != "" {
				if t, err := parseDate(dateStr); err == nil {
					pr.PaymentDate = &t
				}
			}
			pr.ReceiptNo = strings.TrimSpace(cols.Eq(3).Text())
			feeInfo.PaymentHistory = append(feeInfo.PaymentHistory, pr)
		}
	})

	for _, af := range feeInfo.AnnualFees {
		if !af.Paid {
			feeInfo.TotalOutstanding += af.FeeAmount
			feeInfo.TotalOutstanding += af.LateFeeAmount
		}
	}

	return feeInfo, nil
}

func (s *FeeQueryScraper) CalculateLateFee(appNum string, year int) (float64, error) {
	feeInfo, err := s.QueryFeeInfo(appNum)
	if err != nil {
		return 0, err
	}

	for _, af := range feeInfo.AnnualFees {
		if af.Year == year {
			return af.LateFeeAmount, nil
		}
	}
	return 0, fmt.Errorf("fee year %d not found", year)
}

func (s *FeeQueryScraper) GetDueFees(appNum string, withinDays int) ([]AnnualFeeInfo, error) {
	feeInfo, err := s.QueryFeeInfo(appNum)
	if err != nil {
		return nil, err
	}

	var dueFees []AnnualFeeInfo
	now := time.Now()
	cutoff := now.AddDate(0, 0, withinDays)

	for _, af := range feeInfo.AnnualFees {
		if af.Paid || af.DueDate == nil {
			continue
		}
		if af.DueDate.Before(cutoff) || af.Overdue {
			dueFees = append(dueFees, af)
		}
	}
	return dueFees, nil
}

func (s *FeeQueryScraper) SyncPaymentRecords(appNum string) ([]model.FeeRecord, error) {
	feeInfo, err := s.QueryFeeInfo(appNum)
	if err != nil {
		return nil, err
	}

	var records []model.FeeRecord

	for _, af := range feeInfo.AnnualFees {
		status := "unpaid"
		if af.Paid {
			status = "paid"
		} else if af.Overdue {
			status = "overdue"
		}

		records = append(records, model.FeeRecord{
			FeeType:       "annual",
			FeeYear:       af.Year,
			FeeAmount:     af.FeeAmount,
			PaidAmount:    af.PaidAmount,
			DueDate:       af.DueDate,
			PaymentDate:   af.PaymentDate,
			PaymentStatus: status,
			LateFeeAmount: af.LateFeeAmount,
		})
	}

	for _, pr := range feeInfo.PaymentHistory {
		records = append(records, model.FeeRecord{
			FeeType:        pr.FeeType,
			FeeAmount:      pr.Amount,
			PaidAmount:     pr.Amount,
			PaymentDate:    pr.PaymentDate,
			PaymentStatus:  "paid",
			OfficialReceiptNo: pr.ReceiptNo,
			Remark:         pr.Remark,
		})
	}

	return records, nil
}

func (s *FeeQueryScraper) CheckPaymentAbnormalities(localRecords []model.FeeRecord, appNum string) ([]string, error) {
	remoteRecords, err := s.SyncPaymentRecords(appNum)
	if err != nil {
		return nil, err
	}

	var abnormalities []string

	remoteMap := make(map[string]model.FeeRecord)
	for _, r := range remoteRecords {
		key := fmt.Sprintf("%s-%d-%s", r.FeeType, r.FeeYear, formatDate(r.DueDate))
		remoteMap[key] = r
	}

	for _, lr := range localRecords {
		key := fmt.Sprintf("%s-%d-%s", lr.FeeType, lr.FeeYear, formatDate(lr.DueDate))
		rr, exists := remoteMap[key]
		if !exists {
			if lr.PaymentStatus == "paid" {
				abnormalities = append(abnormalities,
					fmt.Sprintf("本地记录已缴费但系统无记录: %s 第%d年", lr.FeeType, lr.FeeYear))
			}
			continue
		}
		if lr.PaymentStatus != rr.PaymentStatus {
			abnormalities = append(abnormalities,
				fmt.Sprintf("缴费状态不一致: %s 第%d年 本地=%s 系统=%s",
					lr.FeeType, lr.FeeYear, lr.PaymentStatus, rr.PaymentStatus))
		}
		if lr.PaidAmount != rr.PaidAmount && rr.PaidAmount > 0 {
			abnormalities = append(abnormalities,
				fmt.Sprintf("缴费金额不一致: %s 第%d年 本地=%.2f 系统=%.2f",
					lr.FeeType, lr.FeeYear, lr.PaidAmount, rr.PaidAmount))
		}
	}

	for _, rr := range remoteMap {
		key := fmt.Sprintf("%s-%d-%s", rr.FeeType, rr.FeeYear, formatDate(rr.DueDate))
		found := false
		for _, lr := range localRecords {
			lkey := fmt.Sprintf("%s-%d-%s", lr.FeeType, lr.FeeYear, formatDate(lr.DueDate))
			if lkey == key {
				found = true
				break
			}
		}
		if !found && rr.PaymentStatus == "paid" {
			abnormalities = append(abnormalities,
				fmt.Sprintf("系统有缴费记录但本地缺失: %s 第%d年 金额=%.2f",
					rr.FeeType, rr.FeeYear, rr.PaidAmount))
		}
	}

	return abnormalities, nil
}

func parseAmount(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "¥", "")
	s = strings.ReplaceAll(s, "￥", "")
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, "元", "")
	s = strings.TrimSpace(s)
	if s == "" || s == "-" || s == "/" {
		return 0
	}
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func extractNumber(s string) string {
	var b strings.Builder
	for _, c := range s {
		if c >= '0' && c <= '9' {
			b.WriteRune(c)
		}
	}
	return b.String()
}

func formatDate(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02")
}
