package repository

import (
	"equipment-trading-platform/internal/model"

	"gorm.io/gorm"
)

type DeviceRepository struct {
	*BaseRepository
}

func NewDeviceRepository() *DeviceRepository {
	return &DeviceRepository{NewBaseRepository()}
}

func (r *DeviceRepository) CreateDevice(device *model.Device) error {
	return r.db.Create(device).Error
}

func (r *DeviceRepository) UpdateDevice(device *model.Device) error {
	return r.db.Save(device).Error
}

func (r *DeviceRepository) GetByID(id uint64) (*model.Device, error) {
	var device model.Device
	err := r.db.Preload("Category").Preload("Media").Preload("Seller", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "username", "real_name", "company", "avatar")
	}).First(&device, id).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (r *DeviceRepository) GetByIDWithDetail(id uint64) (*model.Device, error) {
	var device model.Device
	err := r.db.Preload("Category").
		Preload("Media").
		Preload("MaintenanceRecords", func(db *gorm.DB) *gorm.DB {
			return db.Order("service_date DESC")
		}).
		Preload("OwnershipChanges", func(db *gorm.DB) *gorm.DB {
			return db.Order("change_date DESC")
		}).
		Preload("ValuationReports", func(db *gorm.DB) *gorm.DB {
			return db.Where("status = ?", "valid").Order("valuation_date DESC")
		}).
		Preload("Seller", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "username", "real_name", "company", "avatar")
		}).
		First(&device, id).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

type DeviceQuery struct {
	CategoryID *uint64
	Brand      string
	Model      string
	Status     string
	SellerID   *uint64
	Region     string
	MinPrice   *float64
	MaxPrice   *float64
	MinYear    *int
	MaxYear    *int
	Keyword    string
	Page       int
	PageSize   int
}

func (r *DeviceRepository) ListDevices(q *DeviceQuery) ([]*model.Device, int64, error) {
	var devices []*model.Device
	var total int64

	db := r.db.Model(&model.Device{}).Preload("Category").Preload("Media")

	if q.CategoryID != nil {
		db = db.Where("category_id = ?", *q.CategoryID)
	}
	if q.Brand != "" {
		db = db.Where("brand = ?", q.Brand)
	}
	if q.Model != "" {
		db = db.Where("model LIKE ?", "%"+q.Model+"%")
	}
	if q.Status != "" {
		db = db.Where("status = ?", q.Status)
	}
	if q.SellerID != nil {
		db = db.Where("seller_id = ?", *q.SellerID)
	}
	if q.Region != "" {
		db = db.Where("region = ? OR province = ? OR city = ?", q.Region, q.Region, q.Region)
	}
	if q.MinPrice != nil {
		db = db.Where("asking_price >= ?", *q.MinPrice)
	}
	if q.MaxPrice != nil {
		db = db.Where("asking_price <= ?", *q.MaxPrice)
	}
	if q.MinYear != nil {
		db = db.Where("manufacture_year >= ?", *q.MinYear)
	}
	if q.MaxYear != nil {
		db = db.Where("manufacture_year <= ?", *q.MaxYear)
	}
	if q.Keyword != "" {
		db = db.Where("title LIKE ? OR model LIKE ? OR brand LIKE ? OR description LIKE ?",
			"%"+q.Keyword+"%", "%"+q.Keyword+"%", "%"+q.Keyword+"%", "%"+q.Keyword+"%")
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if q.Page > 0 && q.PageSize > 0 {
		db = db.Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize)
	}
	db = db.Order("created_at DESC")

	if err := db.Find(&devices).Error; err != nil {
		return nil, 0, err
	}

	return devices, total, nil
}

func (r *DeviceRepository) UpdateStatus(id uint64, status string) error {
	return r.db.Model(&model.Device{}).Where("id = ?", id).Update("status", status).Error
}

func (r *DeviceRepository) IncrementViewCount(id uint64) error {
	return r.db.Model(&model.Device{}).Where("id = ?", id).UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

func (r *DeviceRepository) CreateMaintenanceRecord(record *model.MaintenanceRecord) error {
	return r.db.Create(record).Error
}

func (r *DeviceRepository) ListMaintenanceRecords(deviceID uint64) ([]*model.MaintenanceRecord, error) {
	var records []*model.MaintenanceRecord
	err := r.db.Where("device_id = ?", deviceID).Order("service_date DESC").Find(&records).Error
	return records, err
}

func (r *DeviceRepository) CreateOwnershipChange(change *model.OwnershipChange) error {
	return r.db.Create(change).Error
}

func (r *DeviceRepository) ListOwnershipChanges(deviceID uint64) ([]*model.OwnershipChange, error) {
	var changes []*model.OwnershipChange
	err := r.db.Where("device_id = ?", deviceID).Order("change_date DESC").Find(&changes).Error
	return changes, err
}

func (r *DeviceRepository) CreateMedia(media *model.DeviceMedia) error {
	return r.db.Create(media).Error
}

func (r *DeviceRepository) DeleteMedia(id uint64) error {
	return r.db.Delete(&model.DeviceMedia{}, id).Error
}

func (r *DeviceRepository) ListCategories() ([]*model.DeviceCategory, error) {
	var categories []*model.DeviceCategory
	err := r.db.Order("sort ASC, id ASC").Find(&categories).Error
	return categories, err
}

func (r *DeviceRepository) GetCategoryByID(id uint64) (*model.DeviceCategory, error) {
	var category model.DeviceCategory
	err := r.db.First(&category, id).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}
