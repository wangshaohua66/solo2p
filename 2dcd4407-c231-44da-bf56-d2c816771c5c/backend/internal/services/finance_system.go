package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"exhibition-center/config"
	"exhibition-center/internal/models"
)

type FinanceSystemService struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

type FinanceVoucherRequest struct {
	VoucherType   string  `json:"voucherType"`
	VoucherDate   string  `json:"voucherDate"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Summary       string  `json:"summary"`
	ExhibitionNo  string  `json:"exhibitionNo,omitempty"`
	ContractNo    string  `json:"contractNo,omitempty"`
	PartyName     string  `json:"partyName,omitempty"`
	SourceSystem  string  `json:"sourceSystem"`
}

type FinanceVoucherResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	VoucherNo string `json:"voucherNo"`
}

func NewFinanceSystemService() *FinanceSystemService {
	return &FinanceSystemService{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: config.AppConfig.FinanceAPIURL,
		apiKey:  config.AppConfig.FinanceAPIKey,
	}
}

func (s *FinanceSystemService) IsEnabled() bool {
	return s.baseURL != "" && s.apiKey != ""
}

func (s *FinanceSystemService) ExportVoucher(record *models.FinanceRecord) (*FinanceVoucherResponse, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("财务系统对接未配置")
	}

	voucherType := "SHOU"
	if record.Type == models.FinanceTypeExpense {
		voucherType = "FU"
	} else if record.Type == models.FinanceTypeDeposit {
		voucherType = "YSH"
	} else if record.Type == models.FinanceTypeRefund {
		voucherType = "TUI"
	}

	req := FinanceVoucherRequest{
		VoucherType:  voucherType,
		VoucherDate:  record.CreatedAt.Format("2006-01-02"),
		Amount:       record.Amount,
		Currency:     record.Currency,
		Summary:      record.Title,
		ExhibitionNo: record.ScheduleID,
		ContractNo:   record.ContractNo,
		PartyName:    record.PartyName,
		SourceSystem: "EXHIBITION-CENTER",
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("序列化财务凭证失败: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.baseURL+"/vouchers", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("X-Source-System", "EXHIBITION-CENTER")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("调用财务系统失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("财务系统返回错误: %s - %s", resp.Status, string(respBody))
	}

	var result FinanceVoucherResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("解析财务系统响应失败: %w", err)
	}

	return &result, nil
}

func (s *FinanceSystemService) ConvertRecordsToFinanceFormat(records []models.FinanceRecord) ([]FinanceVoucherRequest, error) {
	var vouchers []FinanceVoucherRequest

	for _, record := range records {
		voucherType := "SHOU"
		if record.Type == models.FinanceTypeExpense {
			voucherType = "FU"
		} else if record.Type == models.FinanceTypeDeposit {
			voucherType = "YSH"
		} else if record.Type == models.FinanceTypeRefund {
			voucherType = "TUI"
		}

		vouchers = append(vouchers, FinanceVoucherRequest{
			VoucherType:  voucherType,
			VoucherDate:  record.CreatedAt.Format("2006-01-02"),
			Amount:       record.Amount,
			Currency:     record.Currency,
			Summary:      record.Title,
			ExhibitionNo: record.ScheduleID,
			ContractNo:   record.ContractNo,
			PartyName:    record.PartyName,
			SourceSystem: "EXHIBITION-CENTER",
		})
	}

	return vouchers, nil
}

func (s *FinanceSystemService) BatchExportVouchers(records []models.FinanceRecord) ([]FinanceVoucherResponse, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("财务系统对接未配置")
	}

	var results []FinanceVoucherResponse

	for _, record := range records {
		result, err := s.ExportVoucher(&record)
		if err != nil {
			results = append(results, FinanceVoucherResponse{
				Success: false,
				Message: fmt.Sprintf("记录 %s 导出失败: %v", record.ID, err),
			})
			continue
		}
		results = append(results, *result)
	}

	return results, nil
}
