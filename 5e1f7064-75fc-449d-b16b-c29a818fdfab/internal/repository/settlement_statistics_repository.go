package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"lab-management/internal/model"
)

type SettlementRepository struct {
	*BaseRepository
}

func NewSettlementRepository(db *gorm.DB) *SettlementRepository {
	return &SettlementRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *SettlementRepository) FindByID(id uint) (*model.Settlement, bool, error) {
	var s model.Settlement
	err := r.db.Preload("Institution").Preload("Details").First(&s, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &s, true, err
}

func (r *SettlementRepository) FindByMonth(instID uint, year, month int) (*model.Settlement, bool, error) {
	var s model.Settlement
	err := r.db.Preload("Institution").Preload("Details").
		Where("institution_id = ? AND settle_year = ? AND settle_month = ?", instID, year, month).
		First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &s, true, err
}

func (r *SettlementRepository) List(instID *uint, year, month *int, status string, page, pageSize int) ([]model.Settlement, int64, error) {
	var list []model.Settlement
	var total int64

	query := r.db.Model(&model.Settlement{}).Preload("Institution")
	if instID != nil {
		query = query.Where("institution_id = ?", *instID)
	}
	if year != nil {
		query = query.Where("settle_year = ?", *year)
	}
	if month != nil {
		query = query.Where("settle_month = ?", *month)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&list).Error
	return list, total, err
}

func (r *SettlementRepository) Confirm(id uint, confirmerID uint, now time.Time, remarks string) error {
	return r.db.Model(&model.Settlement{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":       model.SettlementStatusConfirmed,
			"confirmed_by": confirmerID,
			"confirmed_at": now,
			"remarks":      remarks,
		}).Error
}

func (r *SettlementRepository) UpdateAmounts(id uint, totalCount int, totalAmount, discountAmount, finalAmount float64) error {
	return r.db.Model(&model.Settlement{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"total_count":    totalCount,
			"total_amount":   totalAmount,
			"discount_amount": discountAmount,
			"final_amount":   finalAmount,
		}).Error
}

type SettlementDetailRepository struct {
	*BaseRepository
}

func NewSettlementDetailRepository(db *gorm.DB) *SettlementDetailRepository {
	return &SettlementDetailRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *SettlementDetailRepository) CreateBatchWithTx(tx *gorm.DB, details []model.SettlementDetail) error {
	return tx.Create(&details).Error
}

func (r *SettlementDetailRepository) DeleteBySettlementID(tx *gorm.DB, settlementID uint) error {
	return tx.Where("settlement_id = ?", settlementID).Delete(&model.SettlementDetail{}).Error
}

func (r *SettlementDetailRepository) ListBySettlementID(settlementID uint) ([]model.SettlementDetail, error) {
	var list []model.SettlementDetail
	err := r.db.Where("settlement_id = ?", settlementID).Order("id ASC").Find(&list).Error
	return list, err
}

type AuditLogRepository struct {
	*BaseRepository
}

func NewAuditLogRepository(db *gorm.DB) *AuditLogRepository {
	return &AuditLogRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *AuditLogRepository) Create(log *model.AuditLog) error {
	return r.db.Create(log).Error
}

func (r *AuditLogRepository) CreateBatch(logs []model.AuditLog) error {
	if len(logs) == 0 {
		return nil
	}
	return r.db.Create(&logs).Error
}

func (r *AuditLogRepository) List(userID *uint, module, action string, startTime, endTime *time.Time, page, pageSize int) ([]model.AuditLog, int64, error) {
	var list []model.AuditLog
	var total int64

	query := r.db.Model(&model.AuditLog{})
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if module != "" {
		query = query.Where("module = ?", module)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", *endTime)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&list).Error
	return list, total, err
}

type StatisticsRepository struct {
	*BaseRepository
}

func NewStatisticsRepository(db *gorm.DB) *StatisticsRepository {
	return &StatisticsRepository{BaseRepository: NewBaseRepository(db)}
}

type InstitutionStats struct {
	InstitutionID uint   `json:"institution_id"`
	Institution   string `json:"institution"`
	TotalCount    int64  `json:"total_count"`
	CriticalCount int64  `json:"critical_count"`
	TotalAmount   float64 `json:"total_amount"`
}

func (r *StatisticsRepository) InstitutionStats(start, end time.Time, instID *uint) ([]InstitutionStats, error) {
	var result []InstitutionStats
	query := r.db.Table("samples s").
		Select("s.institution_id, i.name as institution, COUNT(s.id) as total_count, " +
			"SUM(CASE WHEN s.is_critical = true THEN 1 ELSE 0 END) as critical_count, " +
			"SUM(s.final_price) as total_amount").
		Joins("LEFT JOIN institutions i ON s.institution_id = i.id").
		Where("s.created_at BETWEEN ? AND ?", start, end).
		Where("s.status != ?", model.SampleStatusCancelled).
		Group("s.institution_id, i.name")
	if instID != nil {
		query = query.Where("s.institution_id = ?", *instID)
	}
	err := query.Order("total_count DESC").Scan(&result).Error
	return result, err
}

type CategoryStats struct {
	Category   string `json:"category"`
	TotalCount int64  `json:"total_count"`
}

func (r *StatisticsRepository) CategoryStats(start, end time.Time, instID *uint) ([]CategoryStats, error) {
	var result []CategoryStats
	query := r.db.Table("sample_items si").
		Select("ti.category, COUNT(si.id) as total_count").
		Joins("JOIN test_items ti ON si.test_item_id = ti.id").
		Joins("JOIN samples s ON si.sample_id = s.id").
		Where("s.created_at BETWEEN ? AND ?", start, end).
		Where("s.status != ?", model.SampleStatusCancelled).
		Group("ti.category")
	if instID != nil {
		query = query.Where("s.institution_id = ?", *instID)
	}
	err := query.Order("total_count DESC").Scan(&result).Error
	return result, err
}

type StatusStats struct {
	Status     string `json:"status"`
	TotalCount int64  `json:"total_count"`
}

func (r *StatisticsRepository) StatusStats(start, end time.Time, instID *uint) ([]StatusStats, error) {
	var result []StatusStats
	query := r.db.Table("samples s").
		Select("s.status, COUNT(s.id) as total_count").
		Where("s.created_at BETWEEN ? AND ?", start, end)
	if instID != nil {
		query = query.Where("s.institution_id = ?", *instID)
	}
	err := query.Group("s.status").Order("total_count DESC").Scan(&result).Error
	return result, err
}

type ItemStats struct {
	TestItemID uint   `json:"test_item_id"`
	ItemName   string `json:"item_name"`
	ItemCode   string `json:"item_code"`
	TotalCount int64  `json:"total_count"`
}

func (r *StatisticsRepository) ItemStats(start, end time.Time, instID *uint, limit int) ([]ItemStats, error) {
	var result []ItemStats
	query := r.db.Table("sample_items si").
		Select("si.test_item_id, ti.name as item_name, ti.code as item_code, COUNT(si.id) as total_count").
		Joins("JOIN test_items ti ON si.test_item_id = ti.id").
		Joins("JOIN samples s ON si.sample_id = s.id").
		Where("s.created_at BETWEEN ? AND ?", start, end).
		Where("s.status != ?", model.SampleStatusCancelled).
		Group("si.test_item_id, ti.name, ti.code")
	if instID != nil {
		query = query.Where("s.institution_id = ?", *instID)
	}
	err := query.Order("total_count DESC").Limit(limit).Scan(&result).Error
	return result, err
}

type UrgencyStats struct {
	TotalSamples      int64   `json:"total_samples"`
	CriticalSamples   int64   `json:"critical_samples"`
	CriticalRate      float64 `json:"critical_rate"`
	AvgTurnaroundMin  float64 `json:"avg_turnaround_min"`
}

func (r *StatisticsRepository) UrgencyStats(start, end time.Time, instID *uint) (*UrgencyStats, error) {
	var result UrgencyStats
	query := r.db.Table("samples s").
		Select("COUNT(s.id) as total_samples, " +
			"SUM(CASE WHEN s.is_critical = true THEN 1 ELSE 0 END) as critical_samples, " +
			"CASE WHEN COUNT(s.id) > 0 THEN " +
			"ROUND(SUM(CASE WHEN s.is_critical = true THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id), 2) " +
			"ELSE 0 END as critical_rate, " +
			"CASE WHEN COUNT(CASE WHEN s.arrival_time IS NOT NULL AND s.updated_at IS NOT NULL THEN 1 END) > 0 THEN " +
			"ROUND(AVG(EXTRACT(EPOCH FROM (s.updated_at - s.arrival_time)) / 60), 2) " +
			"ELSE 0 END as avg_turnaround_min").
		Where("s.created_at BETWEEN ? AND ?", start, end).
		Where("s.status != ?", model.SampleStatusCancelled)
	if instID != nil {
		query = query.Where("s.institution_id = ?", *instID)
	}
	err := query.Scan(&result).Error
	return &result, err
}

type TATStats struct {
	TotalCompleted    int64   `json:"total_completed"`
	AvgTotalMin       float64 `json:"avg_total_min"`
	MedianTotalMin    float64 `json:"median_total_min"`
	P90TotalMin       float64 `json:"p90_total_min"`
	AvgReceiveToTest  float64 `json:"avg_receive_to_test_min"`
	AvgTestToReview   float64 `json:"avg_test_to_review_min"`
	AvgReviewToDone   float64 `json:"avg_review_to_done_min"`
	Within24HoursRate float64 `json:"within_24h_rate"`
	Within4HoursRate  float64 `json:"within_4h_rate"`
}

func (r *StatisticsRepository) TATStats(start, end time.Time, instID *uint) (*TATStats, error) {
	var result TATStats

	type rawRow struct {
		Total       int64   `gorm:"column:total"`
		AvgTotal    float64 `gorm:"column:avg_total"`
		AvgR2T      float64 `gorm:"column:avg_r2t"`
		AvgT2R      float64 `gorm:"column:avg_t2r"`
		AvgR2D      float64 `gorm:"column:avg_r2d"`
		Within24H   int64   `gorm:"column:within_24h"`
		Within4H    int64   `gorm:"column:within_4h"`
	}

	var row rawRow
	sql := `
		SELECT
			COUNT(*) as total,
			COALESCE(AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/60), 0) as avg_total,
			0 as avg_r2t,
			0 as avg_t2r,
			0 as avg_r2d,
			COUNT(CASE WHEN EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/60 <= 1440 THEN 1 END) as within_24h,
			COUNT(CASE WHEN EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/60 <= 240 THEN 1 END) as within_4h
		FROM samples s
		WHERE s.created_at BETWEEN ? AND ?
		AND s.status = ?`
	args := []interface{}{start, end, model.SampleStatusCompleted}
	if instID != nil {
		sql += " AND s.institution_id = ?"
		args = append(args, *instID)
	}

	err := r.db.Raw(sql, args...).Scan(&row).Error
	if err != nil {
		return nil, err
	}

	result.TotalCompleted = row.Total
	result.AvgTotalMin = row.AvgTotal
	result.AvgReceiveToTest = row.AvgR2T
	result.AvgTestToReview = row.AvgT2R
	result.AvgReviewToDone = row.AvgR2D
	if row.Total > 0 {
		result.Within24HoursRate = float64(row.Within24H) * 100.0 / float64(row.Total)
		result.Within4HoursRate = float64(row.Within4H) * 100.0 / float64(row.Total)
	}
	return &result, nil
}

type InstitutionTATStats struct {
	InstitutionID uint    `json:"institution_id"`
	Institution   string  `json:"institution"`
	TotalCount    int64   `json:"total_count"`
	AvgTATMin     float64 `json:"avg_tat_min"`
	Within24HRate float64 `json:"within_24h_rate"`
}

func (r *StatisticsRepository) TATByInstitution(start, end time.Time, instID *uint) ([]InstitutionTATStats, error) {
	var result []InstitutionTATStats
	sql := `
		SELECT
			s.institution_id,
			i.name as institution,
			COUNT(*) as total_count,
			COALESCE(AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/60), 0) as avg_tat_min,
			CASE WHEN COUNT(*) > 0 THEN
				ROUND(COUNT(CASE WHEN EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/60 <= 1440 THEN 1 END)*100.0/COUNT(*), 2)
				ELSE 0 END as within_24h_rate
		FROM samples s
		LEFT JOIN institutions i ON s.institution_id = i.id
		WHERE s.created_at BETWEEN ? AND ?
		AND s.status = ?`
	args := []interface{}{start, end, model.SampleStatusCompleted}
	if instID != nil {
		sql += " AND s.institution_id = ?"
		args = append(args, *instID)
	}
	sql += " GROUP BY s.institution_id, i.name ORDER BY avg_tat_min ASC"
	err := r.db.Raw(sql, args...).Scan(&result).Error
	return result, err
}
