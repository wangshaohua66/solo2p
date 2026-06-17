package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"lab-management/internal/model"
)

type SampleRepository struct {
	*BaseRepository
}

func NewSampleRepository(db *gorm.DB) *SampleRepository {
	return &SampleRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *SampleRepository) FindByID(id uint) (*model.Sample, bool, error) {
	var sample model.Sample
	err := r.db.Preload("Institution").Preload("Items.TestItem").Preload("StatusLogs").First(&sample, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &sample, true, err
}

func (r *SampleRepository) FindByBarcode(barcode string) (*model.Sample, bool, error) {
	var sample model.Sample
	err := r.db.Preload("Institution").Preload("Items.TestItem").Preload("StatusLogs").
		Where("barcode = ?", barcode).First(&sample).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &sample, true, err
}

func (r *SampleRepository) ExistsByBarcode(barcode string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Sample{}).Where("barcode = ?", barcode).Count(&count).Error
	return count > 0, err
}

type SampleListQuery struct {
	Barcode       string
	InstitutionID *uint
	Status        string
	PatientID     string
	PatientName   string
	IsCritical    *bool
	StartTime     *time.Time
	EndTime       *time.Time
}

func (r *SampleRepository) List(q *SampleListQuery, page, pageSize int) ([]model.Sample, int64, error) {
	var list []model.Sample
	var total int64

	query := r.db.Model(&model.Sample{}).Preload("Institution")
	if q.Barcode != "" {
		query = query.Where("barcode ILIKE ?", "%"+q.Barcode+"%")
	}
	if q.InstitutionID != nil {
		query = query.Where("institution_id = ?", *q.InstitutionID)
	}
	if q.Status != "" {
		query = query.Where("status = ?", q.Status)
	}
	if q.PatientID != "" {
		query = query.Where("patient_id ILIKE ?", "%"+q.PatientID+"%")
	}
	if q.PatientName != "" {
		query = query.Where("patient_name ILIKE ?", "%"+q.PatientName+"%")
	}
	if q.IsCritical != nil {
		query = query.Where("is_critical = ?", *q.IsCritical)
	}
	if q.StartTime != nil {
		query = query.Where("created_at >= ?", *q.StartTime)
	}
	if q.EndTime != nil {
		query = query.Where("created_at <= ?", *q.EndTime)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&list).Error
	return list, total, err
}

func (r *SampleRepository) CreateWithTx(tx *gorm.DB, sample *model.Sample) error {
	return tx.Create(sample).Error
}

func (r *SampleRepository) UpdateStatus(id uint, status string, arrivalTime *time.Time, doctorID, reviewerID *uint, isCritical *bool) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if arrivalTime != nil {
		updates["arrival_time"] = arrivalTime
	}
	if doctorID != nil {
		updates["doctor_id"] = doctorID
	}
	if reviewerID != nil {
		updates["reviewer_id"] = reviewerID
	}
	if isCritical != nil {
		updates["is_critical"] = *isCritical
	}
	return r.db.Model(&model.Sample{}).Where("id = ?", id).Updates(updates).Error
}

func (r *SampleRepository) Cancel(id uint, reason string) error {
	return r.db.Model(&model.Sample{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":        model.SampleStatusCancelled,
			"cancel_reason": reason,
		}).Error
}

type SampleStatusLogRepository struct {
	*BaseRepository
}

func NewSampleStatusLogRepository(db *gorm.DB) *SampleStatusLogRepository {
	return &SampleStatusLogRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *SampleStatusLogRepository) CreateWithTx(tx *gorm.DB, log *model.SampleStatusLog) error {
	return tx.Create(log).Error
}

func (r *SampleStatusLogRepository) ListBySampleID(sampleID uint) ([]model.SampleStatusLog, error) {
	var logs []model.SampleStatusLog
	err := r.db.Where("sample_id = ?", sampleID).Order("id ASC").Find(&logs).Error
	return logs, err
}

type SampleItemRepository struct {
	*BaseRepository
}

func NewSampleItemRepository(db *gorm.DB) *SampleItemRepository {
	return &SampleItemRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *SampleItemRepository) CreateBatchWithTx(tx *gorm.DB, items []model.SampleItem) error {
	return tx.Create(&items).Error
}

func (r *SampleItemRepository) FindBySampleID(sampleID uint) ([]model.SampleItem, error) {
	var items []model.SampleItem
	err := r.db.Preload("TestItem").Where("sample_id = ?", sampleID).Find(&items).Error
	return items, err
}

func (r *SampleRepository) UpdatePrices(id uint, totalPrice, finalPrice float64) error {
	return r.db.Model(&model.Sample{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"total_price": totalPrice,
			"final_price": finalPrice,
		}).Error
}

type DailyCounterRepository struct {
	*BaseRepository
}

func NewDailyCounterRepository(db *gorm.DB) *DailyCounterRepository {
	return &DailyCounterRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *DailyCounterRepository) GetNextSeq(instCode, date string) (int64, error) {
	var counter model.DailyCounter
	err := r.db.Where("institution_code = ? AND count_date = ?", instCode, date).
		First(&counter).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		counter = model.DailyCounter{
			InstitutionCode: instCode,
			CountDate:       date,
			Counter:         1,
		}
		if err := r.db.Create(&counter).Error; err != nil {
			return 0, err
		}
		return 1, nil
	}
	if err != nil {
		return 0, err
	}
	counter.Counter++
	if err := r.db.Save(&counter).Error; err != nil {
		return 0, err
	}
	return counter.Counter, nil
}
