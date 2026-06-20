package repository

import (
	"equipment-trading-platform/internal/model"
	"time"
)

type DisputeRepository struct {
	*BaseRepository
}

func NewDisputeRepository() *DisputeRepository {
	return &DisputeRepository{NewBaseRepository()}
}

func (r *DisputeRepository) Create(dispute *model.Dispute) error {
	return r.db.Create(dispute).Error
}

func (r *DisputeRepository) Update(dispute *model.Dispute) error {
	return r.db.Save(dispute).Error
}

func (r *DisputeRepository) GetByID(id uint64) (*model.Dispute, error) {
	var dispute model.Dispute
	err := r.db.Preload("Applicant", func(db interface{ Select(...interface{}) interface{} }) interface{} {
		return db.(interface{ Select(...interface{}) interface{} }).Select("id", "username", "real_name", "phone")
	}).Preload("Respondent", func(db interface{ Select(...interface{}) interface{} }) interface{} {
		return db.(interface{ Select(...interface{}) interface{} }).Select("id", "username", "real_name", "phone")
	}).Preload("Arbitrator", func(db interface{ Select(...interface{}) interface{} }) interface{} {
		return db.(interface{ Select(...interface{}) interface{} }).Select("id", "username", "real_name")
	}).Preload("Evidence").First(&dispute, id).Error
	if err != nil {
		return nil, err
	}
	return &dispute, nil
}

func (r *DisputeRepository) GetByDisputeNo(disputeNo string) (*model.Dispute, error) {
	var dispute model.Dispute
	err := r.db.Where("dispute_no = ?", disputeNo).Preload("Applicant").Preload("Respondent").Preload("Arbitrator").Preload("Evidence").First(&dispute).Error
	if err != nil {
		return nil, err
	}
	return &dispute, nil
}

type DisputeQuery struct {
	ApplicantID  *uint64
	RespondentID *uint64
	ArbitratorID *uint64
	Status       string
	Page         int
	PageSize     int
}

func (r *DisputeRepository) List(q *DisputeQuery) ([]*model.Dispute, int64, error) {
	var disputes []*model.Dispute
	var total int64

	db := r.db.Model(&model.Dispute{})

	if q.ApplicantID != nil {
		db = db.Where("applicant_id = ?", *q.ApplicantID)
	}
	if q.RespondentID != nil {
		db = db.Where("respondent_id = ?", *q.RespondentID)
	}
	if q.ArbitratorID != nil {
		db = db.Where("arbitrator_id = ?", *q.ArbitratorID)
	}
	if q.Status != "" {
		db = db.Where("status = ?", q.Status)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if q.Page > 0 && q.PageSize > 0 {
		db = db.Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize)
	}
	db = db.Preload("Applicant").Preload("Respondent").Preload("Arbitrator").Order("created_at DESC")

	if err := db.Find(&disputes).Error; err != nil {
		return nil, 0, err
	}

	return disputes, total, nil
}

func (r *DisputeRepository) UpdateStatus(id uint64, status string) error {
	updates := map[string]interface{}{"status": status}
	now := time.Now()
	if status == model.DisputeStatusInvestigating {
		updates["investigated_at"] = &now
	} else if status == model.DisputeStatusResolved || status == model.DisputeStatusRejected {
		updates["resolved_at"] = &now
	}
	return r.db.Model(&model.Dispute{}).Where("id = ?", id).Updates(updates).Error
}

func (r *DisputeRepository) CreateEvidence(evidence *model.DisputeEvidence) error {
	return r.db.Create(evidence).Error
}

func (r *DisputeRepository) ListEvidence(disputeID uint64) ([]*model.DisputeEvidence, error) {
	var evidence []*model.DisputeEvidence
	err := r.db.Where("dispute_id = ?", disputeID).Order("created_at ASC").Find(&evidence).Error
	return evidence, err
}

func (r *DisputeRepository) AssignArbitrator(id, arbitratorID uint64) error {
	return r.db.Model(&model.Dispute{}).Where("id = ?", id).Updates(map[string]interface{}{
		"arbitrator_id": arbitratorID,
		"status":        model.DisputeStatusInvestigating,
	}).Error
}
