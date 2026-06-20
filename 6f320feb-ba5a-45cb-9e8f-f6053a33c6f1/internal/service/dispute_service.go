package service

import (
	"errors"
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/util"
	"equipment-trading-platform/pkg/logger"
	"time"

	"gorm.io/gorm"
)

type DisputeService struct {
	disputeRepo   *repository.DisputeRepository
	txRepo        *repository.TransactionRepository
	creditService *CreditService
}

func NewDisputeService() *DisputeService {
	return &DisputeService{
		disputeRepo:   repository.NewDisputeRepository(),
		txRepo:        repository.NewTransactionRepository(),
		creditService: NewCreditService(),
	}
}

type FileDisputeRequest struct {
	TransactionID uint64   `json:"transaction_id" binding:"required"`
	ApplicantID   uint64   `json:"applicant_id"`
	Type          string   `json:"type" binding:"required"`
	Title         string   `json:"title" binding:"required"`
	Description   string   `json:"description" binding:"required"`
	Evidence      []EvidenceItem `json:"evidence"`
}

type EvidenceItem struct {
	Type        string `json:"type"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

func (s *DisputeService) FileDispute(req *FileDisputeRequest) (*model.Dispute, error) {
	tx, err := s.txRepo.GetByID(req.TransactionID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrTxNotFound
		}
		return nil, err
	}

	if tx.Status == model.TxStatusCancelled {
		return nil, util.ErrTxStatus
	}

	var respondentID uint64
	if req.ApplicantID == tx.BuyerID {
		respondentID = tx.SellerID
	} else if req.ApplicantID == tx.SellerID {
		respondentID = tx.BuyerID
	} else {
		return nil, util.ErrForbidden
	}

	dispute := &model.Dispute{
		DisputeNo:     util.GenerateOrderNo("DP"),
		TransactionID: req.TransactionID,
		ApplicantID:   req.ApplicantID,
		RespondentID:  respondentID,
		Type:          req.Type,
		Title:         req.Title,
		Description:   req.Description,
		Status:        model.DisputeStatusPending,
		FiledAt:       time.Now(),
	}

	if err := s.disputeRepo.Create(dispute); err != nil {
		return nil, err
	}

	for _, e := range req.Evidence {
		evidence := &model.DisputeEvidence{
			DisputeID:   dispute.ID,
			UploaderID:  req.ApplicantID,
			Type:        e.Type,
			URL:         e.URL,
			Description: e.Description,
		}
		if err := s.disputeRepo.CreateEvidence(evidence); err != nil {
			logger.Warnf("create dispute evidence failed: %v", err)
		}
	}

	if err := s.txRepo.UpdateStatus(req.TransactionID, model.TxStatusDisputed); err != nil {
		logger.Warnf("update tx status to disputed failed: %v", err)
	}

	return dispute, nil
}

type AddEvidenceRequest struct {
	DisputeID   uint64   `json:"dispute_id" binding:"required"`
	UploaderID  uint64   `json:"uploader_id"`
	Evidence    []EvidenceItem `json:"evidence"`
}

func (s *DisputeService) AddEvidence(req *AddEvidenceRequest) error {
	dispute, err := s.disputeRepo.GetByID(req.DisputeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrDisputeNotFound
		}
		return err
	}

	if dispute.Status == model.DisputeStatusResolved || dispute.Status == model.DisputeStatusRejected {
		return util.NewAppError(400, 5002, "纠纷已处理，无法添加证据")
	}

	if req.UploaderID != dispute.ApplicantID && req.UploaderID != dispute.RespondentID {
		return util.ErrForbidden
	}

	for _, e := range req.Evidence {
		evidence := &model.DisputeEvidence{
			DisputeID:   req.DisputeID,
			UploaderID:  req.UploaderID,
			Type:        e.Type,
			URL:         e.URL,
			Description: e.Description,
		}
		if err := s.disputeRepo.CreateEvidence(evidence); err != nil {
			return err
		}
	}

	return nil
}

func (s *DisputeService) AssignArbitrator(disputeID, arbitratorID uint64) error {
	dispute, err := s.disputeRepo.GetByID(disputeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrDisputeNotFound
		}
		return err
	}

	if dispute.Status != model.DisputeStatusPending {
		return util.NewAppError(400, 5003, "纠纷状态不允许分配仲裁员")
	}

	return s.disputeRepo.AssignArbitrator(disputeID, arbitratorID)
}

type ResolveDisputeRequest struct {
	DisputeID            uint64   `json:"dispute_id" binding:"required"`
	ArbitratorID         uint64   `json:"arbitrator_id"`
	Result               string   `json:"result" binding:"required"`
	InspectionReport     string   `json:"inspection_report"`
	InspectionAgency     string   `json:"inspection_agency"`
	RefundAmount         *float64 `json:"refund_amount"`
	CompensationAmount   *float64 `json:"compensation_amount"`
	ApplicantCreditImpact  int    `json:"applicant_credit_impact"`
	RespondentCreditImpact int   `json:"respondent_credit_impact"`
	Accepted             bool     `json:"accepted"`
}

func (s *DisputeService) Resolve(req *ResolveDisputeRequest) error {
	dispute, err := s.disputeRepo.GetByID(req.DisputeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrDisputeNotFound
		}
		return err
	}

	if dispute.Status != model.DisputeStatusInvestigating {
		return util.NewAppError(400, 5004, "纠纷状态不允许仲裁")
	}

	if dispute.ArbitratorID != nil && *dispute.ArbitratorID != req.ArbitratorID {
		return util.ErrForbidden
	}

	now := time.Now()
	updates := map[string]interface{}{
		"arbitration_result":       req.Result,
		"inspection_report":        req.InspectionReport,
		"inspection_agency":        req.InspectionAgency,
		"refund_amount":            req.RefundAmount,
		"compensation_amount":      req.CompensationAmount,
		"applicant_credit_impact":  req.ApplicantCreditImpact,
		"respondent_credit_impact": req.RespondentCreditImpact,
		"investigated_at":          &now,
		"inspection_date":          &now,
	}

	if req.Accepted {
		updates["status"] = model.DisputeStatusResolved
		updates["resolved_at"] = &now
	} else {
		updates["status"] = model.DisputeStatusRejected
		updates["resolved_at"] = &now
	}

	if err := s.disputeRepo.GetDB().Model(dispute).Updates(updates).Error; err != nil {
		return err
	}

	if req.ApplicantCreditImpact != 0 {
		_ = s.creditService.AddRecord(dispute.ApplicantID, &dispute.RespondentID, &dispute.TransactionID, &dispute.ID,
			"dispute_penalty", req.ApplicantCreditImpact, "纠纷仲裁处罚："+req.Result)
	}
	if req.RespondentCreditImpact != 0 {
		_ = s.creditService.AddRecord(dispute.RespondentID, &dispute.ApplicantID, &dispute.TransactionID, &dispute.ID,
			"dispute_penalty", req.RespondentCreditImpact, "纠纷仲裁处罚："+req.Result)
	}

	if req.Accepted && dispute.Status != model.TxStatusCompleted {
		tx, err := s.txRepo.GetByID(dispute.TransactionID)
		if err == nil {
			funds, _ := s.txRepo.ListFunds(dispute.TransactionID)
			for _, fund := range funds {
				if fund.Status == "frozen" {
					if req.RefundAmount != nil && *req.RefundAmount > 0 {
						payeeID := fund.PayerID
						fund.Status = "partial_refund"
						fund.PayeeID = &payeeID
						fund.ThawedAt = &now
						fund.Remark = "纠纷仲裁退款"
						_ = s.txRepo.UpdateFund(fund)
					} else {
						payeeID := tx.SellerID
						fund.Status = "paid"
						fund.PayeeID = &payeeID
						fund.ThawedAt = &now
						fund.PaidAt = &now
						_ = s.txRepo.UpdateFund(fund)
					}
				}
			}
		}
	}

	return nil
}

func (s *DisputeService) GetByID(id uint64) (*model.Dispute, error) {
	dispute, err := s.disputeRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrDisputeNotFound
		}
		return nil, err
	}
	return dispute, nil
}

func (s *DisputeService) List(q *repository.DisputeQuery) ([]*model.Dispute, int64, error) {
	return s.disputeRepo.List(q)
}

func (s *DisputeService) ListEvidence(disputeID uint64) ([]*model.DisputeEvidence, error) {
	return s.disputeRepo.ListEvidence(disputeID)
}
