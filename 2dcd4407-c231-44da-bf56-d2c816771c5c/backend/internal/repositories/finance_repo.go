package repositories

import (
	"gorm.io/gorm"
	"exhibition-center/internal/models"
)

type FinanceRepository struct {
	db *gorm.DB
}

func NewFinanceRepository(db *gorm.DB) *FinanceRepository {
	return &FinanceRepository{db: db}
}

func (r *FinanceRepository) ListRecords(page, pageSize int, recordType, status, keyword, startDate, endDate string) ([]models.FinanceRecord, int64, error) {
	var records []models.FinanceRecord
	var total int64

	query := r.db.Model(&models.FinanceRecord{})
	if recordType != "" {
		query = query.Where("type = ?", recordType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
	}
	if keyword != "" {
		query = query.Where("title ILIKE ? OR schedule_name ILIKE ? OR contract_no ILIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at desc").Offset(offset).Limit(pageSize).Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, total, nil
}

func (r *FinanceRepository) GetRecordByID(id string) (*models.FinanceRecord, error) {
	var record models.FinanceRecord
	if err := r.db.First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *FinanceRepository) CreateRecord(record *models.FinanceRecord) error {
	return r.db.Create(record).Error
}

func (r *FinanceRepository) UpdateRecord(id string, data map[string]interface{}) error {
	return r.db.Model(&models.FinanceRecord{}).Where("id = ?", id).Updates(data).Error
}

func (r *FinanceRepository) DeleteRecord(id string) error {
	return r.db.Delete(&models.FinanceRecord{}, "id = ?", id).Error
}

func (r *FinanceRepository) GetSummary() (*models.FinanceSummary, error) {
	var summary models.FinanceSummary

	var result struct {
		Income  float64
		Expense float64
		Deposit float64
		Refund  float64
	}

	r.db.Raw(`
		SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
			COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as deposit,
			COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) as refund
		FROM finance_records
		WHERE status = 'confirmed'
	`).Scan(&result)

	summary.TotalIncome = result.Income
	summary.TotalExpense = result.Expense
	summary.TotalDeposit = result.Deposit
	summary.TotalRefund = result.Refund
	summary.NetProfit = result.Income - result.Expense

	return &summary, nil
}

func (r *FinanceRepository) ListDeposits() ([]models.DepositRecord, error) {
	var deposits []models.DepositRecord
	if err := r.db.Order("created_at desc").Find(&deposits).Error; err != nil {
		return nil, err
	}
	return deposits, nil
}

func (r *FinanceRepository) GetDepositByID(id string) (*models.DepositRecord, error) {
	var deposit models.DepositRecord
	if err := r.db.First(&deposit, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &deposit, nil
}

func (r *FinanceRepository) UpdateDeposit(id string, data map[string]interface{}) error {
	return r.db.Model(&models.DepositRecord{}).Where("id = ?", id).Updates(data).Error
}

func (r *FinanceRepository) GetByScheduleIDs(scheduleIds []string) ([]models.FinanceRecord, error) {
	var records []models.FinanceRecord
	if err := r.db.Where("schedule_id IN ?", scheduleIds).Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}
