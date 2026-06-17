package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"lab-management/internal/model"
)

type TestResultRepository struct {
	*BaseRepository
}

func NewTestResultRepository(db *gorm.DB) *TestResultRepository {
	return &TestResultRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *TestResultRepository) CreateBatchWithTx(tx *gorm.DB, results []model.TestResult) error {
	return tx.Create(&results).Error
}

func (r *TestResultRepository) FindBySampleID(sampleID uint) ([]model.TestResult, error) {
	var results []model.TestResult
	err := r.db.Where("sample_id = ?", sampleID).Find(&results).Error
	return results, err
}

func (r *TestResultRepository) FindBySampleItemID(sampleItemID uint) (*model.TestResult, bool, error) {
	var result model.TestResult
	err := r.db.Where("sample_item_id = ?", sampleItemID).First(&result).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &result, true, err
}

func (r *TestResultRepository) Update(id uint, resultValue string, numericValue *float64, isCritical, isAbnormal bool, flag, device string, testTime *time.Time, testedBy *uint, remark string) error {
	updates := map[string]interface{}{
		"result_value": resultValue,
		"is_critical":  isCritical,
		"is_abnormal":  isAbnormal,
		"flag":         flag,
		"remark":       remark,
	}
	if numericValue != nil {
		updates["numeric_value"] = numericValue
	}
	if device != "" {
		updates["device"] = device
	}
	if testTime != nil {
		updates["test_time"] = testTime
	}
	if testedBy != nil {
		updates["tested_by"] = testedBy
	}
	return r.db.Model(&model.TestResult{}).Where("id = ?", id).Updates(updates).Error
}

type CriticalValueRecordRepository struct {
	*BaseRepository
}

func NewCriticalValueRecordRepository(db *gorm.DB) *CriticalValueRecordRepository {
	return &CriticalValueRecordRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *CriticalValueRecordRepository) FindByID(id uint) (*model.CriticalValueRecord, bool, error) {
	var record model.CriticalValueRecord
	err := r.db.First(&record, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &record, true, err
}

func (r *CriticalValueRecordRepository) FindBySampleID(sampleID uint) ([]model.CriticalValueRecord, error) {
	var records []model.CriticalValueRecord
	err := r.db.Where("sample_id = ?", sampleID).Find(&records).Error
	return records, err
}

func (r *CriticalValueRecordRepository) CreateWithTx(tx *gorm.DB, record *model.CriticalValueRecord) error {
	return tx.Create(record).Error
}

func (r *CriticalValueRecordRepository) FirstReview(id uint, reviewerID uint, comment string, now time.Time) error {
	return r.db.Model(&model.CriticalValueRecord{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"first_reviewed_by":     reviewerID,
			"first_reviewed_at":     now,
			"first_review_comment":  comment,
		}).Error
}

func (r *CriticalValueRecordRepository) SecondReview(id uint, reviewerID uint, comment string, now time.Time) error {
	return r.db.Model(&model.CriticalValueRecord{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"second_reviewed_by":     reviewerID,
			"second_reviewed_at":     now,
			"second_review_comment":  comment,
			"is_fully_reviewed":      true,
		}).Error
}

func (r *CriticalValueRecordRepository) HasUnreviewed(sampleID uint) (bool, error) {
	var count int64
	err := r.db.Model(&model.CriticalValueRecord{}).
		Where("sample_id = ? AND is_fully_reviewed = ?", sampleID, false).
		Count(&count).Error
	return count > 0, err
}

type ReportRepository struct {
	*BaseRepository
}

func NewReportRepository(db *gorm.DB) *ReportRepository {
	return &ReportRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *ReportRepository) FindByID(id uint) (*model.Report, bool, error) {
	var report model.Report
	err := r.db.First(&report, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &report, true, err
}

func (r *ReportRepository) FindBySampleID(sampleID uint) (*model.Report, bool, error) {
	var report model.Report
	err := r.db.Where("sample_id = ?", sampleID).First(&report).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &report, true, err
}

func (r *ReportRepository) FindByReportNo(reportNo string) (*model.Report, bool, error) {
	var report model.Report
	err := r.db.Where("report_no = ?", reportNo).First(&report).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &report, true, err
}

func (r *ReportRepository) UpdateStatus(id uint, status string, doctorID, reviewerID *uint, doctorName, reviewerName, signature string, generatedAt, publishedAt *time.Time) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if doctorID != nil {
		updates["doctor_id"] = doctorID
	}
	if reviewerID != nil {
		updates["reviewer_id"] = reviewerID
	}
	if doctorName != "" {
		updates["doctor_name"] = doctorName
	}
	if reviewerName != "" {
		updates["reviewer_name"] = reviewerName
	}
	if signature != "" {
		updates["signature"] = signature
	}
	if generatedAt != nil {
		updates["generated_at"] = generatedAt
	}
	if publishedAt != nil {
		updates["published_at"] = publishedAt
	}
	return r.db.Model(&model.Report{}).Where("id = ?", id).Updates(updates).Error
}

func (r *ReportRepository) UpdateFileData(id uint, fileData []byte) error {
	return r.db.Model(&model.Report{}).Where("id = ?", id).Update("file_data", fileData).Error
}

func (r *ReportRepository) List(instID *uint, barcode, status string, isRead *bool, page, pageSize int) ([]model.Report, int64, error) {
	var list []model.Report
	var total int64

	query := r.db.Model(&model.Report{})
	if instID != nil {
		query = query.Where("institution_id = ?", *instID)
	}
	if barcode != "" {
		sub := r.db.Model(&model.Sample{}).Select("id").Where("barcode ILIKE ?", "%"+barcode+"%")
		query = query.Where("sample_id IN (?)", sub)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if isRead != nil {
		if *isRead {
			query = query.Where("status = ?", model.ReportStatusRead)
		} else {
			query = query.Where("status IN ?", []string{model.ReportStatusGenerated, model.ReportStatusPublished})
		}
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&list).Error
	return list, total, err
}

type ReportReadLogRepository struct {
	*BaseRepository
}

func NewReportReadLogRepository(db *gorm.DB) *ReportReadLogRepository {
	return &ReportReadLogRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *ReportReadLogRepository) Create(log *model.ReportReadLog) error {
	return r.db.Create(log).Error
}

func (r *ReportReadLogRepository) Exists(reportID, readerID uint) (bool, error) {
	var count int64
	err := r.db.Model(&model.ReportReadLog{}).
		Where("report_id = ? AND reader_id = ?", reportID, readerID).
		Count(&count).Error
	return count > 0, err
}
