package repository

import (
	"equipment-trading-platform/internal/model"

	"gorm.io/gorm"
)

type UserRepository struct {
	*BaseRepository
}

func NewUserRepository() *UserRepository {
	return &UserRepository{NewBaseRepository()}
}

func (r *UserRepository) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) Update(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepository) GetByID(id uint64) (*model.User, error) {
	var user model.User
	err := r.db.Preload("Roles.Role").Preload("CreditRating").First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByUsername(username string) (*model.User, error) {
	var user model.User
	err := r.db.Where("username = ?", username).Preload("Roles.Role").First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByPhone(phone string) (*model.User, error) {
	var user model.User
	err := r.db.Where("phone = ?", phone).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetUserRoles(userID uint64) ([]string, error) {
	var roles []string
	err := r.db.Table("user_roles ur").
		Select("r.name").
		Joins("JOIN roles r ON ur.role_id = r.id").
		Where("ur.user_id = ? AND ur.deleted_at IS NULL", userID).
		Pluck("name", &roles).Error
	return roles, err
}

func (r *UserRepository) List(page, pageSize int) ([]*model.User, int64, error) {
	var users []*model.User
	var total int64

	db := r.db.Model(&model.User{})
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page > 0 && pageSize > 0 {
		db = db.Offset((page - 1) * pageSize).Limit(pageSize)
	}
	db = db.Preload("Roles.Role").Preload("CreditRating").Order("created_at DESC")

	if err := db.Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (r *UserRepository) AddRole(userID, roleID uint64) error {
	return r.db.Create(&model.UserRole{UserID: userID, RoleID: roleID}).Error
}

func (r *UserRepository) RemoveRole(userID, roleID uint64) error {
	return r.db.Where("user_id = ? AND role_id = ?", userID, roleID).Delete(&model.UserRole{}).Error
}

func (r *UserRepository) GetRoleByName(name string) (*model.Role, error) {
	var role model.Role
	err := r.db.Where("name = ?", name).First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *UserRepository) CreateRole(role *model.Role) error {
	return r.db.Create(role).Error
}

func (r *UserRepository) ListRoles() ([]*model.Role, error) {
	var roles []*model.Role
	err := r.db.Find(&roles).Error
	return roles, err
}

func (r *UserRepository) GetOrCreateCreditRating(userID uint64) (*model.CreditRating, error) {
	var rating model.CreditRating
	err := r.db.Where("user_id = ?", userID).First(&rating).Error
	if err == gorm.ErrRecordNotFound {
		rating = model.CreditRating{
			UserID:      userID,
			Score:       100,
			Level:       "A",
			SuccessRate: 100,
		}
		if err := r.db.Create(&rating).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	return &rating, nil
}

func (r *UserRepository) UpdateCreditRating(rating *model.CreditRating) error {
	return r.db.Save(rating).Error
}

func (r *UserRepository) AddCreditRecord(record *model.CreditRecord) error {
	return r.db.Create(record).Error
}

func (r *UserRepository) ListCreditRecords(userID uint64, page, pageSize int) ([]*model.CreditRecord, int64, error) {
	var records []*model.CreditRecord
	var total int64

	db := r.db.Model(&model.CreditRecord{}).Where("user_id = ?", userID)
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page > 0 && pageSize > 0 {
		db = db.Offset((page - 1) * pageSize).Limit(pageSize)
	}
	db = db.Order("created_at DESC")

	if err := db.Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, total, nil
}
