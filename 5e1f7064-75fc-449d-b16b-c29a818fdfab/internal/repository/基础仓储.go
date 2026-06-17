package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"lab-management/internal/model"
)

type BaseRepository struct {
	db *gorm.DB
}

func NewBaseRepository(db *gorm.DB) *BaseRepository {
	return &BaseRepository{db: db}
}

func (r *BaseRepository) GetDB() *gorm.DB {
	return r.db
}

func (r *BaseRepository) Create(value interface{}) error {
	return r.db.Create(value).Error
}

func (r *BaseRepository) Save(value interface{}) error {
	return r.db.Save(value).Error
}

func (r *BaseRepository) Update(value interface{}) error {
	return r.db.Updates(value).Error
}

func (r *BaseRepository) DeleteByID(id uint, model interface{}) error {
	return r.db.Delete(model, id).Error
}

func (r *BaseRepository) FindByID(id uint, out interface{}) (bool, error) {
	err := r.db.First(out, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return err == nil, err
}

type UserRepository struct {
	*BaseRepository
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *UserRepository) FindByUsername(username string) (*model.User, bool, error) {
	var user model.User
	err := r.db.Where("username = ?", username).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &user, true, nil
}

func (r *UserRepository) FindByID(id uint) (*model.User, bool, error) {
	var user model.User
	err := r.db.Preload("Institution").First(&user, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &user, true, err
}

func (r *UserRepository) UpdateLastLogin(id uint, t time.Time) error {
	return r.db.Model(&model.User{}).Where("id = ?", id).Update("last_login_at", t).Error
}

type InstitutionRepository struct {
	*BaseRepository
}

func NewInstitutionRepository(db *gorm.DB) *InstitutionRepository {
	return &InstitutionRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *InstitutionRepository) FindByID(id uint) (*model.Institution, bool, error) {
	var inst model.Institution
	err := r.db.First(&inst, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &inst, true, err
}

func (r *InstitutionRepository) FindByCode(code string) (*model.Institution, bool, error) {
	var inst model.Institution
	err := r.db.Where("code = ?", code).First(&inst).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &inst, true, err
}

func (r *InstitutionRepository) List(keyword, typ string, status *int, page, pageSize int) ([]model.Institution, int64, error) {
	var list []model.Institution
	var total int64

	query := r.db.Model(&model.Institution{})
	if keyword != "" {
		query = query.Where("name ILIKE ? OR code ILIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if typ != "" {
		query = query.Where("type = ?", typ)
	}
	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&list).Error
	return list, total, err
}

type TestItemRepository struct {
	*BaseRepository
}

func NewTestItemRepository(db *gorm.DB) *TestItemRepository {
	return &TestItemRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *TestItemRepository) FindByID(id uint) (*model.TestItem, bool, error) {
	var item model.TestItem
	err := r.db.First(&item, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &item, true, err
}

func (r *TestItemRepository) FindByCode(code string) (*model.TestItem, bool, error) {
	var item model.TestItem
	err := r.db.Where("code = ?", code).First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &item, true, err
}

func (r *TestItemRepository) FindByIDs(ids []uint) ([]model.TestItem, error) {
	var items []model.TestItem
	err := r.db.Where("id IN ?", ids).Find(&items).Error
	return items, err
}

func (r *TestItemRepository) List(keyword, category string, status *int, page, pageSize int) ([]model.TestItem, int64, error) {
	var list []model.TestItem
	var total int64

	query := r.db.Model(&model.TestItem{})
	if keyword != "" {
		query = query.Where("name ILIKE ? OR code ILIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&list).Error
	return list, total, err
}

type TestItemPackageRepository struct {
	*BaseRepository
}

func NewTestItemPackageRepository(db *gorm.DB) *TestItemPackageRepository {
	return &TestItemPackageRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *TestItemPackageRepository) FindByID(id uint) (*model.TestItemPackage, bool, error) {
	var pkg model.TestItemPackage
	err := r.db.Preload("Items.TestItem").First(&pkg, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &pkg, true, err
}

type InstitutionPriceRepository struct {
	*BaseRepository
}

func NewInstitutionPriceRepository(db *gorm.DB) *InstitutionPriceRepository {
	return &InstitutionPriceRepository{BaseRepository: NewBaseRepository(db)}
}

func (r *InstitutionPriceRepository) GetPrice(instID, itemID uint) (*model.InstitutionPrice, bool, error) {
	var price model.InstitutionPrice
	err := r.db.Where("institution_id = ? AND test_item_id = ?", instID, itemID).First(&price).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	return &price, true, err
}
