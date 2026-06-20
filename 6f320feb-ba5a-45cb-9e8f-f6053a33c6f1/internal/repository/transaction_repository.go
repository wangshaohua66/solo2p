package repository

import (
	"equipment-trading-platform/internal/model"
	"time"
)

type TransactionRepository struct {
	*BaseRepository
}

func NewTransactionRepository() *TransactionRepository {
	return &TransactionRepository{NewBaseRepository()}
}

func (r *TransactionRepository) Create(tx *model.Transaction) error {
	return r.db.Create(tx).Error
}

func (r *TransactionRepository) Update(tx *model.Transaction) error {
	return r.db.Save(tx).Error
}

func (r *TransactionRepository) GetByID(id uint64) (*model.Transaction, error) {
	var tx model.Transaction
	err := r.db.Preload("Device").
		Preload("Buyer").
		Preload("Seller").
		Preload("Funds").
		Preload("Dispute").
		First(&tx, id).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *TransactionRepository) GetByOrderNo(orderNo string) (*model.Transaction, error) {
	var tx model.Transaction
	err := r.db.Where("order_no = ?", orderNo).Preload("Device").Preload("Buyer").Preload("Seller").Preload("Funds").First(&tx).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

type TxQuery struct {
	BuyerID  *uint64
	SellerID *uint64
	DeviceID *uint64
	Status   string
	Page     int
	PageSize int
}

func (r *TransactionRepository) List(q *TxQuery) ([]*model.Transaction, int64, error) {
	var txs []*model.Transaction
	var total int64

	db := r.db.Model(&model.Transaction{})

	if q.BuyerID != nil {
		db = db.Where("buyer_id = ?", *q.BuyerID)
	}
	if q.SellerID != nil {
		db = db.Where("seller_id = ?", *q.SellerID)
	}
	if q.DeviceID != nil {
		db = db.Where("device_id = ?", *q.DeviceID)
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
	db = db.Preload("Device").Preload("Buyer").Preload("Seller").Order("created_at DESC")

	if err := db.Find(&txs).Error; err != nil {
		return nil, 0, err
	}

	return txs, total, nil
}

func (r *TransactionRepository) UpdateStatus(id uint64, status string) error {
	updates := map[string]interface{}{"status": status}
	if status == model.TxStatusCompleted {
		now := time.Now()
		updates["completed_at"] = &now
	} else if status == model.TxStatusCancelled {
		now := time.Now()
		updates["cancelled_at"] = &now
	}
	return r.db.Model(&model.Transaction{}).Where("id = ?", id).Updates(updates).Error
}

func (r *TransactionRepository) CreateFund(fund *model.TransactionFund) error {
	return r.db.Create(fund).Error
}

func (r *TransactionRepository) UpdateFund(fund *model.TransactionFund) error {
	return r.db.Save(fund).Error
}

func (r *TransactionRepository) ListFunds(txID uint64) ([]*model.TransactionFund, error) {
	var funds []*model.TransactionFund
	err := r.db.Where("transaction_id = ?", txID).Order("created_at ASC").Find(&funds).Error
	return funds, err
}

func (r *TransactionRepository) GetFundByID(id uint64) (*model.TransactionFund, error) {
	var fund model.TransactionFund
	err := r.db.First(&fund, id).Error
	if err != nil {
		return nil, err
	}
	return &fund, nil
}

type StatsQuery struct {
	StartDate string
	EndDate   string
	Region    string
	CategoryID *uint64
}

func (r *TransactionRepository) DailyStats(q *StatsQuery) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	db := r.db.Table("transactions t").
		Select("DATE(t.created_at) as date, COUNT(*) as count, SUM(t.final_price) as total_amount").
		Where("t.status = ?", model.TxStatusCompleted)

	if q.StartDate != "" {
		db = db.Where("DATE(t.created_at) >= ?", q.StartDate)
	}
	if q.EndDate != "" {
		db = db.Where("DATE(t.created_at) <= ?", q.EndDate)
	}

	return results, db.Group("DATE(t.created_at)").Order("date DESC").Scan(&results).Error
}

func (r *TransactionRepository) CategoryStats(q *StatsQuery) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	db := r.db.Table("transactions t").
		Select("d.category_id, dc.name as category_name, COUNT(*) as count, SUM(t.final_price) as total_amount").
		Joins("JOIN devices d ON t.device_id = d.id").
		Joins("JOIN device_categories dc ON d.category_id = dc.id").
		Where("t.status = ?", model.TxStatusCompleted)

	if q.StartDate != "" {
		db = db.Where("DATE(t.created_at) >= ?", q.StartDate)
	}
	if q.EndDate != "" {
		db = db.Where("DATE(t.created_at) <= ?", q.EndDate)
	}
	if q.CategoryID != nil {
		db = db.Where("d.category_id = ?", *q.CategoryID)
	}

	return results, db.Group("d.category_id, dc.name").Order("total_amount DESC").Scan(&results).Error
}

func (r *TransactionRepository) RegionStats(q *StatsQuery) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	db := r.db.Table("transactions t").
		Select("d.region, COUNT(*) as count, SUM(t.final_price) as total_amount").
		Joins("JOIN devices d ON t.device_id = d.id").
		Where("t.status = ? AND d.region != ''", model.TxStatusCompleted)

	if q.StartDate != "" {
		db = db.Where("DATE(t.created_at) >= ?", q.StartDate)
	}
	if q.EndDate != "" {
		db = db.Where("DATE(t.created_at) <= ?", q.EndDate)
	}

	return results, db.Group("d.region").Order("total_amount DESC").Scan(&results).Error
}
