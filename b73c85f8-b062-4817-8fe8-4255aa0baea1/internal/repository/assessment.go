package repository

import (
	"gas-network-system/internal/model"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AssessmentRepository struct {
	BaseRepository
}

func NewAssessmentRepository(db *gorm.DB, logger *zap.Logger) *AssessmentRepository {
	return &AssessmentRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *AssessmentRepository) Create(assessment *model.MonthlyAssessment) error {
	return r.db.Create(assessment).Error
}

func (r *AssessmentRepository) BatchCreate(assessments []model.MonthlyAssessment) error {
	if len(assessments) == 0 {
		return nil
	}
	return r.db.CreateInBatches(assessments, 100).Error
}

func (r *AssessmentRepository) GetByID(id uint) (*model.MonthlyAssessment, error) {
	var a model.MonthlyAssessment
	err := r.db.Preload("Inspector").First(&a, id).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AssessmentRepository) GetByInspectorAndMonth(inspectorID uint, year, month int) (*model.MonthlyAssessment, error) {
	var a model.MonthlyAssessment
	err := r.db.Where("inspector_id = ? AND year = ? AND month = ?", inspectorID, year, month).
		First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AssessmentRepository) List(page, pageSize int, inspectorID *uint, year *int, month *int, isPassed *bool) (int64, []model.MonthlyAssessment, error) {
	var total int64
	var assessments []model.MonthlyAssessment

	query := r.db.Model(&model.MonthlyAssessment{}).Preload("Inspector")
	if inspectorID != nil {
		query = query.Where("inspector_id = ?", *inspectorID)
	}
	if year != nil {
		query = query.Where("year = ?", *year)
	}
	if month != nil {
		query = query.Where("month = ?", *month)
	}
	if isPassed != nil {
		query = query.Where("is_passed = ?", *isPassed)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("year DESC, month DESC").Offset(offset).Limit(pageSize).Find(&assessments).Error
	return total, assessments, err
}

func (r *AssessmentRepository) GetTaskStats(inspectorID uint, startTime, endTime time.Time) (total int64, completed int64, err error) {
	err = r.db.Model(&model.InspectionTask{}).
		Where("inspector_id = ? AND plan_date BETWEEN ? AND ?", inspectorID, startTime, endTime).
		Count(&total).Error
	if err != nil {
		return 0, 0, err
	}

	err = r.db.Model(&model.InspectionTask{}).
		Where("inspector_id = ? AND plan_date BETWEEN ? AND ? AND status = ?",
			inspectorID, startTime, endTime, model.TaskStatusCompleted).
		Count(&completed).Error
	return total, completed, err
}

func (r *AssessmentRepository) GetTrackDeviations(inspectorID uint, startTime, endTime time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&model.InspectionTrack{}).
		Where("inspector_id = ? AND submit_time BETWEEN ? AND ? AND is_deviated = ?",
			inspectorID, startTime, endTime, true).
		Count(&count).Error
	return count, err
}

func (r *AssessmentRepository) GetHazardStats(inspectorID uint, startTime, endTime time.Time) (reported int64, closed int64, err error) {
	err = r.db.Model(&model.Hazard{}).
		Where("inspector_id = ? AND created_at BETWEEN ? AND ?", inspectorID, startTime, endTime).
		Count(&reported).Error
	if err != nil {
		return 0, 0, err
	}

	err = r.db.Model(&model.Hazard{}).
		Where("inspector_id = ? AND created_at BETWEEN ? AND ? AND status = ?",
			inspectorID, startTime, endTime, model.HazardStatusClosed).
		Count(&closed).Error
	return reported, closed, err
}

func (r *AssessmentRepository) GetAllInspectors() ([]model.Inspector, error) {
	var inspectors []model.Inspector
	err := r.db.Find(&inspectors).Error
	return inspectors, err
}
