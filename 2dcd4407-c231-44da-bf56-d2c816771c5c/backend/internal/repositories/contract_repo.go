package repositories

import (
	"gorm.io/gorm"
	"exhibition-center/internal/models"
)

type ContractRepository struct {
	db *gorm.DB
}

func NewContractRepository(db *gorm.DB) *ContractRepository {
	return &ContractRepository{db: db}
}

func (r *ContractRepository) List(page, pageSize int, status, keyword string) ([]models.Contract, int64, error) {
	var contracts []models.Contract
	var total int64

	query := r.db.Model(&models.Contract{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		query = query.Where("schedule_name ILIKE ? OR party_b ILIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at desc").Offset(offset).Limit(pageSize).Find(&contracts).Error; err != nil {
		return nil, 0, err
	}

	return contracts, total, nil
}

func (r *ContractRepository) GetByID(id string) (*models.Contract, error) {
	var contract models.Contract
	if err := r.db.First(&contract, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &contract, nil
}

func (r *ContractRepository) Create(contract *models.Contract) error {
	return r.db.Create(contract).Error
}

func (r *ContractRepository) Update(id string, data map[string]interface{}) error {
	return r.db.Model(&models.Contract{}).Where("id = ?", id).Updates(data).Error
}

func (r *ContractRepository) Delete(id string) error {
	return r.db.Delete(&models.Contract{}, "id = ?", id).Error
}

func (r *ContractRepository) ListTemplates() ([]models.ContractTemplate, error) {
	var templates []models.ContractTemplate
	if err := r.db.Where("status = ?", "active").Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}
