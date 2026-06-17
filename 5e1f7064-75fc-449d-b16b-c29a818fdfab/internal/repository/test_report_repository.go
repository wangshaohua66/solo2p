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

type CriticalAlertRepository struct {
	*BaseRepository
}

func NewCriticalAlertRepository(db *gorm.DB) *CriticalAlertRepository {
	return &CriticalAlertRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *CriticalAlertRepository) CreateBatchWithTx(tx *gorm.DB, alerts []model.CriticalAlert) error {
	if len(alerts) == 0 {
		return nil
	}
	return tx.Create(&alerts).Error
}

func (r *CriticalAlertRepository) Create(alert *model.CriticalAlert) error {
	return r.db.Create(alert).Error
}

func (r *CriticalAlertRepository) FindByID(id uint) (*model.CriticalAlert, bool, error) {
	var alert model.CriticalAlert
	err := r.db.First(&alert, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &alert, true, err
}

func (r *CriticalAlertRepository) FindBySampleID(sampleID uint) ([]model.CriticalAlert, error) {
	var alerts []model.CriticalAlert
	err := r.db.Where("sample_id = ?", sampleID).Order("created_at DESC").Find(&alerts).Error
	return alerts, err
}

func (r *CriticalAlertRepository) ListPending(limit int) ([]model.CriticalAlert, error) {
	var alerts []model.CriticalAlert
	err := r.db.Where("status = ?", model.AlertStatusPending).
		Order("alert_time ASC").Limit(limit).Find(&alerts).Error
	return alerts, err
}

func (r *CriticalAlertRepository) MarkSent(id uint, sentAt time.Time) error {
	return r.db.Model(&model.CriticalAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":  model.AlertStatusSent,
			"sent_at": sentAt,
		}).Error
}

func (r *CriticalAlertRepository) MarkFailed(id uint, errorMsg string) error {
	return r.db.Model(&model.CriticalAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":        model.AlertStatusFailed,
			"error_message": errorMsg,
		}).Error
}

func (r *CriticalAlertRepository) IncrementRetry(id uint) error {
	return r.db.Model(&model.CriticalAlert{}).Where("id = ?", id).
		UpdateColumn("retry_count", gorm.Expr("retry_count + ?", 1)).Error
}

type CriticalAlertListQuery struct {
	SampleID      *uint
	TestItemID    *uint
	InstitutionID *uint
	Status        string
	AlertType     string
	TargetType    string
	Page          int
	PageSize      int
}

func (r *CriticalAlertRepository) List(q *CriticalAlertListQuery) ([]model.CriticalAlert, int64, error) {
	var list []model.CriticalAlert
	var total int64

	query := r.db.Model(&model.CriticalAlert{})

	if q.InstitutionID != nil {
		query = query.Joins("JOIN samples s ON s.id = critical_alerts.sample_id").
			Where("s.institution_id = ?", *q.InstitutionID)
	}
	if q.SampleID != nil {
		query = query.Where("critical_alerts.sample_id = ?", *q.SampleID)
	}
	if q.TestItemID != nil {
		query = query.Where("critical_alerts.test_item_id = ?", *q.TestItemID)
	}
	if q.Status != "" {
		query = query.Where("critical_alerts.status = ?", q.Status)
	}
	if q.AlertType != "" {
		query = query.Where("critical_alerts.alert_type = ?", q.AlertType)
	}
	if q.TargetType != "" {
		query = query.Where("critical_alerts.target_type = ?", q.TargetType)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (q.Page - 1) * q.PageSize
	err := query.Order("critical_alerts.alert_time DESC").
		Offset(offset).Limit(q.PageSize).
		Find(&list).Error
	return list, total, err
}
