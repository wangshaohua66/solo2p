package repositories

import (
	"gorm.io/gorm"
	"exhibition-center/internal/models"
)

type VisitorRepository struct {
	db *gorm.DB
}

func NewVisitorRepository(db *gorm.DB) *VisitorRepository {
	return &VisitorRepository{db: db}
}

func (r *VisitorRepository) List(page, pageSize int, scheduleID, keyword string) ([]models.VisitorRecord, int64, error) {
	var records []models.VisitorRecord
	var total int64

	query := r.db.Model(&models.VisitorRecord{})
	if scheduleID != "" {
		query = query.Where("schedule_id = ?", scheduleID)
	}
	if keyword != "" {
		query = query.Where("name ILIKE ? OR phone ILIKE ? OR company ILIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
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

func (r *VisitorRepository) GetByID(id string) (*models.VisitorRecord, error) {
	var record models.VisitorRecord
	if err := r.db.First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *VisitorRepository) GetByQRCode(qrCode string) (*models.VisitorRecord, error) {
	var record models.VisitorRecord
	if err := r.db.First(&record, "qr_code = ?", qrCode).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *VisitorRepository) Create(record *models.VisitorRecord) error {
	return r.db.Create(record).Error
}

func (r *VisitorRepository) Update(id string, data map[string]interface{}) error {
	return r.db.Model(&models.VisitorRecord{}).Where("id = ?", id).Updates(data).Error
}

func (r *VisitorRepository) AddBoothVisit(id string, visit models.BoothVisit) error {
	record, err := r.GetByID(id)
	if err != nil {
		return err
	}

	record.BoothVisits = append(record.BoothVisits, visit)

	return r.db.Model(&models.VisitorRecord{}).Where("id = ?", id).Update("booth_visits", record.BoothVisits).Error
}

func (r *VisitorRepository) ListProviders(page, pageSize int, status, keyword string) ([]models.ServiceProvider, int64, error) {
	var providers []models.ServiceProvider
	var total int64

	query := r.db.Model(&models.ServiceProvider{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		query = query.Where("name ILIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at desc").Offset(offset).Limit(pageSize).Find(&providers).Error; err != nil {
		return nil, 0, err
	}

	return providers, total, nil
}

func (r *VisitorRepository) GetProviderByID(id string) (*models.ServiceProvider, error) {
	var provider models.ServiceProvider
	if err := r.db.First(&provider, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &provider, nil
}

func (r *VisitorRepository) CreateProvider(provider *models.ServiceProvider) error {
	return r.db.Create(provider).Error
}

func (r *VisitorRepository) UpdateProvider(id string, data map[string]interface{}) error {
	return r.db.Model(&models.ServiceProvider{}).Where("id = ?", id).Updates(data).Error
}
