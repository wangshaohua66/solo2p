package repository

import (
	"equipment-trading-platform/pkg/database"

	"gorm.io/gorm"
)

type BaseRepository struct {
	db *gorm.DB
}

func NewBaseRepository() *BaseRepository {
	return &BaseRepository{db: database.GetDB()}
}

func (r *BaseRepository) GetDB() *gorm.DB {
	return r.db
}

func (r *BaseRepository) Create(model interface{}) error {
	return r.db.Create(model).Error
}

func (r *BaseRepository) Update(model interface{}) error {
	return r.db.Save(model).Error
}

func (r *BaseRepository) Delete(model interface{}) error {
	return r.db.Delete(model).Error
}

func (r *BaseRepository) GetByID(id uint64, model interface{}) error {
	return r.db.First(model, id).Error
}

func (r *BaseRepository) List(where interface{}, model interface{}, page, pageSize int, order string) (int64, error) {
	var total int64
	db := r.db.Model(model).Where(where)
	if err := db.Count(&total).Error; err != nil {
		return 0, err
	}

	if page > 0 && pageSize > 0 {
		db = db.Offset((page - 1) * pageSize).Limit(pageSize)
	}
	if order != "" {
		db = db.Order(order)
	}

	return total, db.Find(model).Error
}
