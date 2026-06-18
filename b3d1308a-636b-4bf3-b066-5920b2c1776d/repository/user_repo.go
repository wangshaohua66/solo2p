package repository

import (
	"context"
	"time"

	"smart-lighting-api/model"

	"gorm.io/gorm"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

type UserQueryParams struct {
	Role     string
	AreaID   int64
	Status   *int
	Keyword  string
	Page     int
	PageSize int
}

func (r *UserRepo) Create(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *UserRepo) Update(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

func (r *UserRepo) GetByID(ctx context.Context, id int64) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) List(ctx context.Context, params *UserQueryParams) ([]*model.User, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.User{})
	if params.Role != "" {
		query = query.Where("role = ?", params.Role)
	}
	if params.AreaID > 0 {
		query = query.Where("area_id = ?", params.AreaID)
	}
	if params.Status != nil {
		query = query.Where("status = ?", *params.Status)
	}
	if params.Keyword != "" {
		query = query.Where("(username LIKE ? OR real_name LIKE ? OR phone LIKE ?)",
			"%"+params.Keyword+"%", "%"+params.Keyword+"%", "%"+params.Keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var list []*model.User
	err := query.Order("id DESC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *UserRepo) UpdateLastLogin(ctx context.Context, id int64) error {
	return r.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", id).Update("last_login_at", time.Now()).Error
}

func (r *UserRepo) UpdatePassword(ctx context.Context, id int64, hashedPassword string) error {
	return r.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", id).Update("password", hashedPassword).Error
}

func (r *UserRepo) ListOperatorsByArea(ctx context.Context, areaID int64) ([]*model.User, error) {
	var users []*model.User
	query := r.db.WithContext(ctx).Where("role = ? AND status = 1", model.RoleOperator)
	if areaID > 0 {
		query = query.Where("area_id = ?", areaID)
	}
	err := query.Find(&users).Error
	return users, err
}

func (r *UserRepo) ListAreaManagers(ctx context.Context) ([]*model.User, error) {
	var users []*model.User
	err := r.db.WithContext(ctx).Where("role = ? AND status = 1", model.RoleAreaManager).Find(&users).Error
	return users, err
}

func (r *UserRepo) AddToBlacklist(ctx context.Context, token string, expiresAt time.Time) error {
	return r.db.WithContext(ctx).Create(&model.TokenBlacklist{
		Token:     token,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}).Error
}

func (r *UserRepo) CleanExpiredTokens(ctx context.Context) (int64, error) {
	result := r.db.WithContext(ctx).Where("expires_at < ?", time.Now()).Delete(&model.TokenBlacklist{})
	return result.RowsAffected, result.Error
}

type AreaRepo struct {
	db *gorm.DB
}

func NewAreaRepo(db *gorm.DB) *AreaRepo {
	return &AreaRepo{db: db}
}

func (r *AreaRepo) Create(ctx context.Context, area *model.Area) error {
	return r.db.WithContext(ctx).Create(area).Error
}

func (r *AreaRepo) Update(ctx context.Context, area *model.Area) error {
	return r.db.WithContext(ctx).Save(area).Error
}

func (r *AreaRepo) GetByID(ctx context.Context, id int64) (*model.Area, error) {
	var area model.Area
	err := r.db.WithContext(ctx).First(&area, id).Error
	if err != nil {
		return nil, err
	}
	return &area, nil
}

func (r *AreaRepo) GetByCode(ctx context.Context, code string) (*model.Area, error) {
	var area model.Area
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&area).Error
	if err != nil {
		return nil, err
	}
	return &area, nil
}

func (r *AreaRepo) ListAll(ctx context.Context) ([]*model.Area, error) {
	var areas []*model.Area
	err := r.db.WithContext(ctx).Order("id ASC").Find(&areas).Error
	return areas, err
}

func (r *AreaRepo) ListByParentID(ctx context.Context, parentID int64) ([]*model.Area, error) {
	var areas []*model.Area
	err := r.db.WithContext(ctx).Where("parent_id = ?", parentID).Order("id ASC").Find(&areas).Error
	return areas, err
}

func (r *AreaRepo) GetSubAreaIDs(ctx context.Context, areaID int64) ([]int64, error) {
	var ids []int64
	var allAreas []*model.Area
	err := r.db.WithContext(ctx).Find(&allAreas).Error
	if err != nil {
		return nil, err
	}
	ids = append(ids, areaID)
	var queue []int64
	queue = append(queue, areaID)
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for _, a := range allAreas {
			if a.ParentID == cur {
				ids = append(ids, a.ID)
				queue = append(queue, a.ID)
			}
		}
	}
	return ids, nil
}

func (r *AreaRepo) UpdateDeviceCount(ctx context.Context, id int64) error {
	return r.db.WithContext(ctx).Exec(`
		UPDATE areas SET device_count = (SELECT COUNT(*) FROM devices WHERE area_id = ?), updated_at = ? WHERE id = ?
	`, id, time.Now(), id).Error
}

type CabinetRepo struct {
	db *gorm.DB
}

func NewCabinetRepo(db *gorm.DB) *CabinetRepo {
	return &CabinetRepo{db: db}
}

func (r *CabinetRepo) Create(ctx context.Context, cabinet *model.Cabinet) error {
	return r.db.WithContext(ctx).Create(cabinet).Error
}

func (r *CabinetRepo) Update(ctx context.Context, cabinet *model.Cabinet) error {
	return r.db.WithContext(ctx).Save(cabinet).Error
}

func (r *CabinetRepo) GetByID(ctx context.Context, id int64) (*model.Cabinet, error) {
	var cabinet model.Cabinet
	err := r.db.WithContext(ctx).First(&cabinet, id).Error
	if err != nil {
		return nil, err
	}
	return &cabinet, nil
}

func (r *CabinetRepo) ListByArea(ctx context.Context, areaID int64) ([]*model.Cabinet, error) {
	var cabinets []*model.Cabinet
	err := r.db.WithContext(ctx).Where("area_id = ?", areaID).Find(&cabinets).Error
	return cabinets, err
}

func (r *CabinetRepo) ListAll(ctx context.Context) ([]*model.Cabinet, error) {
	var cabinets []*model.Cabinet
	err := r.db.WithContext(ctx).Find(&cabinets).Error
	return cabinets, nil
}
