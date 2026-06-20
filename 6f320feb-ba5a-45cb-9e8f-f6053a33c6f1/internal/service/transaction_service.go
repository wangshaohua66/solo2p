package service

import (
	"encoding/json"
	"errors"
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/util"
	"equipment-trading-platform/pkg/logger"
	"time"

	"gorm.io/gorm"
)

type TransactionService struct {
	txRepo        *repository.TransactionRepository
	deviceRepo    *repository.DeviceRepository
	creditService *CreditService
}

func NewTransactionService() *TransactionService {
	return &TransactionService{
		txRepo:        repository.NewTransactionRepository(),
		deviceRepo:    repository.NewDeviceRepository(),
		creditService: NewCreditService(),
	}
}

type CreateTransactionRequest struct {
	DeviceID      uint64   `json:"device_id" binding:"required"`
	BuyerID       uint64   `json:"buyer_id"`
	InitialPrice  float64  `json:"initial_price"`
	DepositAmount float64  `json:"deposit_amount"`
	IsInstallment bool     `json:"is_installment"`
	Installments  []map[string]interface{} `json:"installments"`
	BuyerRemark   string   `json:"buyer_remark"`
}

func (s *TransactionService) Create(req *CreateTransactionRequest) (*model.Transaction, error) {
	device, err := s.deviceRepo.GetByID(req.DeviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrDeviceNotFound
		}
		return nil, err
	}

	if device.Status != model.DeviceStatusOnSale {
		return nil, util.ErrDeviceStatus
	}

	initialPrice := req.InitialPrice
	if initialPrice <= 0 {
		initialPrice = device.AskingPrice
	}

	deposit := req.DepositAmount
	if deposit <= 0 {
		deposit = initialPrice * 0.1
	}

	var installmentPlanJSON []byte
	if req.IsInstallment && len(req.Installments) > 0 {
		installmentPlanJSON, _ = json.Marshal(req.Installments)
	}

	tx := &model.Transaction{
		OrderNo:         util.GenerateOrderNo("TX"),
		DeviceID:        req.DeviceID,
		BuyerID:         req.BuyerID,
		SellerID:        device.SellerID,
		InitialPrice:    initialPrice,
		FinalPrice:      initialPrice,
		DepositAmount:   deposit,
		InstallmentPlan: string(installmentPlanJSON),
		IsInstallment:   req.IsInstallment,
		Status:          model.TxStatusCreated,
		BuyerRemark:     req.BuyerRemark,
	}

	if err := s.txRepo.Create(tx); err != nil {
		return nil, err
	}

	if err := s.deviceRepo.UpdateStatus(req.DeviceID, model.DeviceStatusReserved); err != nil {
		logger.Warnf("update device status to reserved failed: %v", err)
	}

	return tx, nil
}

type NegotiateRequest struct {
	TxID       uint64  `json:"tx_id" binding:"required"`
	UserID     uint64  `json:"user_id"`
	Price      float64 `json:"price" binding:"required"`
	Message    string  `json:"message"`
	IsSeller   bool    `json:"is_seller"`
}

func (s *TransactionService) Negotiate(req *NegotiateRequest) (*model.Transaction, error) {
	tx, err := s.txRepo.GetByID(req.TxID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrTxNotFound
		}
		return nil, err
	}

	if tx.Status != model.TxStatusCreated && tx.Status != model.TxStatusNegotiating {
		return nil, util.ErrTxStatus
	}

	records := []map[string]interface{}{}
	if tx.NegotiationRecords != "" {
		_ = json.Unmarshal([]byte(tx.NegotiationRecords), &records)
	}

	records = append(records, map[string]interface{}{
		"user_id":   req.UserID,
		"is_seller": req.IsSeller,
		"price":     req.Price,
		"message":   req.Message,
		"time":      time.Now(),
	})

	recordsJSON, _ := json.Marshal(records)

	tx.Status = model.TxStatusNegotiating
	tx.NegotiationRecords = string(recordsJSON)

	if !req.IsSeller {
		tx.FinalPrice = req.Price
	}

	if err := s.txRepo.Update(tx); err != nil {
		return nil, err
	}

	return tx, nil
}

type FreezeFundRequest struct {
	TxID          uint64  `json:"tx_id" binding:"required"`
	Amount        float64 `json:"amount" binding:"required"`
	PayerID       uint64  `json:"payer_id"`
	PaymentMethod string  `json:"payment_method"`
	PaymentNo     string  `json:"payment_no"`
	Type          string  `json:"type"`
}

func (s *TransactionService) FreezeFund(req *FreezeFundRequest) (*model.TransactionFund, error) {
	tx, err := s.txRepo.GetByID(req.TxID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrTxNotFound
		}
		return nil, err
	}

	if tx.Status != model.TxStatusCreated && tx.Status != model.TxStatusNegotiating {
		return nil, util.ErrTxStatus
	}

	fundType := req.Type
	if fundType == "" {
		fundType = "full"
	}

	now := time.Now()
	fund := &model.TransactionFund{
		TransactionID: req.TxID,
		Type:          fundType,
		Amount:        req.Amount,
		Status:        "frozen",
		PayerID:       req.PayerID,
		PaymentMethod: req.PaymentMethod,
		PaymentNo:     req.PaymentNo,
		EscrowAccount: "ESCROW_" + util.GenerateOrderNo(""),
		FrozenAt:      &now,
	}

	if err := s.txRepo.CreateFund(fund); err != nil {
		return nil, err
	}

	if err := s.txRepo.UpdateStatus(req.TxID, model.TxStatusFundFrozen); err != nil {
		logger.Warnf("update tx status failed: %v", err)
	}

	return fund, nil
}

func (s *TransactionService) ConfirmTransfer(txID, operatorID uint64) error {
	tx, err := s.txRepo.GetByID(txID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrTxNotFound
		}
		return err
	}

	if tx.Status != model.TxStatusFundFrozen {
		return util.ErrTxStatus
	}

	if err := s.txRepo.GetDB().Model(tx).Updates(map[string]interface{}{
		"status":                 model.TxStatusTransferring,
		"transfer_completed_at":  time.Now(),
	}).Error; err != nil {
		return err
	}

	change := &model.OwnershipChange{
		DeviceID:      tx.DeviceID,
		FromOwnerID:   &tx.SellerID,
		ToOwnerID:     tx.BuyerID,
		FromOwnerName: tx.Seller.RealName,
		ToOwnerName:   tx.Buyer.RealName,
		ChangeDate:    time.Now(),
		ChangeType:    "sale",
		TransactionID: &txID,
		Remark:        "交易过户",
	}
	_ = s.deviceRepo.CreateOwnershipChange(change)

	return nil
}

func (s *TransactionService) Complete(txID uint64) error {
	tx, err := s.txRepo.GetByID(txID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrTxNotFound
		}
		return err
	}

	if tx.Status != model.TxStatusTransferring {
		return util.ErrTxStatus
	}

	funds, _ := s.txRepo.ListFunds(txID)
	now := time.Now()
	for _, fund := range funds {
		if fund.Status == "frozen" {
			payeeID := tx.SellerID
			fund.Status = "paid"
			fund.PayeeID = &payeeID
			fund.ThawedAt = &now
			fund.PaidAt = &now
			if err := s.txRepo.UpdateFund(fund); err != nil {
				logger.Warnf("update fund %d failed: %v", fund.ID, err)
			}
		}
	}

	if err := s.txRepo.UpdateStatus(txID, model.TxStatusCompleted); err != nil {
		return err
	}

	if err := s.deviceRepo.UpdateStatus(tx.DeviceID, model.DeviceStatusSold); err != nil {
		logger.Warnf("update device to sold failed: %v", err)
	}

	_ = s.creditService.OnTradeSuccess(tx.BuyerID)
	_ = s.creditService.OnTradeSuccess(tx.SellerID)

	return nil
}

type CancelRequest struct {
	TxID     uint64 `json:"tx_id" binding:"required"`
	UserID   uint64 `json:"user_id"`
	Reason   string `json:"reason"`
	IsBuyer  bool   `json:"is_buyer"`
}

func (s *TransactionService) Cancel(req *CancelRequest) error {
	tx, err := s.txRepo.GetByID(req.TxID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrTxNotFound
		}
		return err
	}

	if tx.Status == model.TxStatusCompleted || tx.Status == model.TxStatusCancelled {
		return util.ErrTxStatus
	}

	funds, _ := s.txRepo.ListFunds(req.TxID)
	now := time.Now()
	for _, fund := range funds {
		if fund.Status == "frozen" {
			payeeID := fund.PayerID
			fund.Status = "refunded"
			fund.PayeeID = &payeeID
			fund.ThawedAt = &now
			fund.Remark = "交易取消退款"
			if err := s.txRepo.UpdateFund(fund); err != nil {
				logger.Warnf("refund fund %d failed: %v", fund.ID, err)
			}
		}
	}

	updates := map[string]interface{}{
		"status":        model.TxStatusCancelled,
		"cancel_reason": req.Reason,
		"cancelled_at":  &now,
	}
	if err := s.txRepo.GetDB().Model(tx).Updates(updates).Error; err != nil {
		return err
	}

	if err := s.deviceRepo.UpdateStatus(tx.DeviceID, model.DeviceStatusOnSale); err != nil {
		logger.Warnf("restore device status failed: %v", err)
	}

	if req.IsBuyer {
		_ = s.creditService.AddRecord(tx.BuyerID, nil, &tx.ID, nil, "cancel_trade", -2, "买家取消交易")
	} else {
		_ = s.creditService.AddRecord(tx.SellerID, nil, &tx.ID, nil, "cancel_trade", -5, "卖家取消交易")
	}

	return nil
}

func (s *TransactionService) GetByID(id uint64) (*model.Transaction, error) {
	tx, err := s.txRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrTxNotFound
		}
		return nil, err
	}
	return tx, nil
}

func (s *TransactionService) List(q *repository.TxQuery) ([]*model.Transaction, int64, error) {
	return s.txRepo.List(q)
}

func (s *TransactionService) ListFunds(txID uint64) ([]*model.TransactionFund, error) {
	return s.txRepo.ListFunds(txID)
}

func (s *TransactionService) DailyStats(q *repository.StatsQuery) ([]map[string]interface{}, error) {
	return s.txRepo.DailyStats(q)
}

func (s *TransactionService) CategoryStats(q *repository.StatsQuery) ([]map[string]interface{}, error) {
	return s.txRepo.CategoryStats(q)
}

func (s *TransactionService) RegionStats(q *repository.StatsQuery) ([]map[string]interface{}, error) {
	return s.txRepo.RegionStats(q)
}
