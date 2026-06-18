package repository

import (
	"gas-network-system/internal/model"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type ValveRepository struct {
	BaseRepository
}

func NewValveRepository(db *gorm.DB, logger *zap.Logger) *ValveRepository {
	return &ValveRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *ValveRepository) CreateOperation(op *model.ValveOperation) error {
	return r.db.Create(op).Error
}

func (r *ValveRepository) GetOperationByID(id uint) (*model.ValveOperation, error) {
	var op model.ValveOperation
	err := r.db.Preload("ValveWell").First(&op, id).Error
	if err != nil {
		return nil, err
	}
	return &op, nil
}

func (r *ValveRepository) ListOperations(page, pageSize int, valveWellID *uint, valveNo *string, startTime, endTime *time.Time) (int64, []model.ValveOperation, error) {
	var total int64
	var ops []model.ValveOperation

	query := r.db.Model(&model.ValveOperation{}).Preload("ValveWell")
	if valveWellID != nil {
		query = query.Where("valve_well_id = ?", *valveWellID)
	}
	if valveNo != nil && *valveNo != "" {
		query = query.Where("valve_no = ?", *valveNo)
	}
	if startTime != nil {
		query = query.Where("operation_time >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("operation_time <= ?", *endTime)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("operation_time DESC").Offset(offset).Limit(pageSize).Find(&ops).Error
	return total, ops, err
}

func (r *ValveRepository) GetValveWellByID(id uint) (*model.ValveWell, error) {
	var vw model.ValveWell
	err := r.db.First(&vw, id).Error
	if err != nil {
		return nil, err
	}
	return &vw, nil
}

func (r *ValveRepository) CreateValveWell(vw *model.ValveWell) error {
	return r.db.Create(vw).Error
}

type HazardRepository struct {
	BaseRepository
}

func NewHazardRepository(db *gorm.DB, logger *zap.Logger) *HazardRepository {
	return &HazardRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *HazardRepository) Create(hazard *model.Hazard) error {
	return r.db.Create(hazard).Error
}

func (r *HazardRepository) GetByID(id uint) (*model.Hazard, error) {
	var hazard model.Hazard
	err := r.db.Preload("Pipeline").Preload("Inspector").First(&hazard, id).Error
	if err != nil {
		return nil, err
	}
	return &hazard, nil
}

func (r *HazardRepository) List(page, pageSize int, level *string, status *string, pipelineID *uint) (int64, []model.Hazard, error) {
	var total int64
	var hazards []model.Hazard

	query := r.db.Model(&model.Hazard{}).Preload("Pipeline").Preload("Inspector")
	if level != nil && *level != "" {
		query = query.Where("level = ?", *level)
	}
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}
	if pipelineID != nil {
		query = query.Where("pipeline_id = ?", *pipelineID)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&hazards).Error
	return total, hazards, err
}

func (r *HazardRepository) Update(hazard *model.Hazard) error {
	return r.db.Save(hazard).Error
}

func (r *HazardRepository) GetOverdueMajorHazards(beforeTime time.Time) ([]model.Hazard, error) {
	var hazards []model.Hazard
	err := r.db.Where("level = ? AND status IN ? AND deadline <= ?",
		model.HazardLevelMajor,
		[]model.HazardStatus{model.HazardStatusAssigned, model.HazardStatusRectifying},
		beforeTime,
	).Preload("Pipeline").Preload("Inspector").Find(&hazards).Error
	return hazards, err
}

func (r *HazardRepository) UpdateStatus(id uint, status model.HazardStatus, assigneeID *uint, assigneeName *string, deadline *time.Time) error {
	updates := map[string]interface{}{
		"status": status,
	}
	now := time.Now()
	if status == model.HazardStatusAssigned {
		updates["assigned_at"] = &now
		updates["assignee_id"] = assigneeID
		updates["assignee_name"] = assigneeName
		updates["deadline"] = deadline
	}
	if status == model.HazardStatusRectifying {
		updates["rectified_at"] = &now
	}
	if status == model.HazardStatusAccepting {
		updates["accepted_at"] = &now
	}
	if status == model.HazardStatusClosed {
		updates["closed_at"] = &now
	}
	return r.db.Model(&model.Hazard{}).Where("id = ?", id).Updates(updates).Error
}
