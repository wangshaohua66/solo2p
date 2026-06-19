package repository

import (
	"errors"

	"gorm.io/gorm"
	"port-ops-system/internal/model"
)

type ContainerRepository interface {
	Create(container *model.Container) error
	Update(container *model.Container) error
	GetByID(id int64) (*model.Container, error)
	GetByNo(containerNo string) (*model.Container, error)
	List(page, pageSize int, filters map[string]interface{}) ([]*model.Container, int64, error)
	UpdateStatus(id int64, status model.ContainerStatus) error
	AssignSlot(id int64, yardID int64, bayNo string, rowNo, tierNo int, slotCode string) error
	CountByStatus(status model.ContainerStatus) (int64, error)
}

type YardRepository interface {
	Create(yard *model.Yard) error
	Update(yard *model.Yard) error
	GetByID(id int64) (*model.Yard, error)
	GetByCode(code string) (*model.Yard, error)
	List() ([]*model.Yard, error)
	ListByType(containerType model.ContainerType) ([]*model.Yard, error)
}

type YardSlotRepository interface {
	Create(slot *model.YardSlot) error
	Update(slot *model.YardSlot) error
	GetByID(id int64) (*model.YardSlot, error)
	GetByCode(slotCode string) (*model.YardSlot, error)
	ListAvailable(yards []int64, containerType model.ContainerType, size model.ContainerSize) ([]*model.YardSlot, error)
	ListByBay(yardID int64, bayNo string) ([]*model.YardSlot, error)
	Occupy(slotCode string, containerID int64, containerNo string) error
	Release(slotCode string) error
	CountOccupied(yardID int64) (int64, error)
}

type containerRepo struct {
	db *gorm.DB
}

func NewContainerRepository(r *Repository) ContainerRepository {
	return &containerRepo{db: r.db}
}

func (r *containerRepo) Create(c *model.Container) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(c).Error
}

func (r *containerRepo) Update(c *model.Container) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(c).Error
}

func (r *containerRepo) GetByID(id int64) (*model.Container, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var c model.Container
	err := r.db.First(&c, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &c, err
}

func (r *containerRepo) GetByNo(containerNo string) (*model.Container, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var c model.Container
	err := r.db.Where("container_no = ?", containerNo).First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &c, err
}

func (r *containerRepo) List(page, pageSize int, filters map[string]interface{}) ([]*model.Container, int64, error) {
	if r.db == nil {
		return []*model.Container{}, 0, nil
	}
	query := r.db.Model(&model.Container{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var containers []*model.Container
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&containers).Error
	return containers, total, err
}

func (r *containerRepo) UpdateStatus(id int64, status model.ContainerStatus) error {
	if r.db == nil {
		return nil
	}
	return r.db.Model(&model.Container{}).Where("id = ?", id).Update("status", status).Error
}

func (r *containerRepo) AssignSlot(id int64, yardID int64, bayNo string, rowNo, tierNo int, slotCode string) error {
	if r.db == nil {
		return nil
	}
	return r.db.Model(&model.Container{}).Where("id = ?", id).Updates(map[string]interface{}{
		"yard_id":   yardID,
		"bay_no":    bayNo,
		"row_no":    rowNo,
		"tier_no":   tierNo,
		"slot_code": slotCode,
	}).Error
}

func (r *containerRepo) CountByStatus(status model.ContainerStatus) (int64, error) {
	if r.db == nil {
		return 0, nil
	}
	var count int64
	err := r.db.Model(&model.Container{}).Where("status = ?", status).Count(&count).Error
	return count, err
}

type yardRepo struct {
	db *gorm.DB
}

func NewYardRepository(r *Repository) YardRepository {
	return &yardRepo{db: r.db}
}

func (r *yardRepo) Create(y *model.Yard) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(y).Error
}

func (r *yardRepo) Update(y *model.Yard) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(y).Error
}

func (r *yardRepo) GetByID(id int64) (*model.Yard, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var y model.Yard
	err := r.db.First(&y, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &y, err
}

func (r *yardRepo) GetByCode(code string) (*model.Yard, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var y model.Yard
	err := r.db.Where("yard_code = ?", code).First(&y).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &y, err
}

func (r *yardRepo) List() ([]*model.Yard, error) {
	if r.db == nil {
		return []*model.Yard{}, nil
	}
	var yards []*model.Yard
	err := r.db.Where("is_active = ?", true).Find(&yards).Error
	return yards, err
}

func (r *yardRepo) ListByType(containerType model.ContainerType) ([]*model.Yard, error) {
	if r.db == nil {
		return []*model.Yard{}, nil
	}
	var yards []*model.Yard
	err := r.db.Where("is_active = ? AND (container_type = ? OR container_type = '')", true, containerType).Find(&yards).Error
	return yards, err
}

type yardSlotRepo struct {
	db *gorm.DB
}

func NewYardSlotRepository(r *Repository) YardSlotRepository {
	return &yardSlotRepo{db: r.db}
}

func (r *yardSlotRepo) Create(s *model.YardSlot) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(s).Error
}

func (r *yardSlotRepo) Update(s *model.YardSlot) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(s).Error
}

func (r *yardSlotRepo) GetByID(id int64) (*model.YardSlot, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var s model.YardSlot
	err := r.db.First(&s, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &s, err
}

func (r *yardSlotRepo) GetByCode(slotCode string) (*model.YardSlot, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var s model.YardSlot
	err := r.db.Where("slot_code = ?", slotCode).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &s, err
}

func (r *yardSlotRepo) ListAvailable(yards []int64, containerType model.ContainerType, size model.ContainerSize) ([]*model.YardSlot, error) {
	if r.db == nil {
		return []*model.YardSlot{}, nil
	}
	var slots []*model.YardSlot
	query := r.db.Where("is_occupied = ?", false)
	if len(yards) > 0 {
		query = query.Where("yard_id IN ?", yards)
	}
	err := query.Order("yard_code, bay_no, row_no, tier_no").Find(&slots).Error
	return slots, err
}

func (r *yardSlotRepo) ListByBay(yardID int64, bayNo string) ([]*model.YardSlot, error) {
	if r.db == nil {
		return []*model.YardSlot{}, nil
	}
	var slots []*model.YardSlot
	err := r.db.Where("yard_id = ? AND bay_no = ?", yardID, bayNo).
		Order("row_no, tier_no").Find(&slots).Error
	return slots, err
}

func (r *yardSlotRepo) Occupy(slotCode string, containerID int64, containerNo string) error {
	if r.db == nil {
		return nil
	}
	return r.db.Model(&model.YardSlot{}).Where("slot_code = ?", slotCode).Updates(map[string]interface{}{
		"is_occupied":  true,
		"container_id": containerID,
		"container_no": containerNo,
	}).Error
}

func (r *yardSlotRepo) Release(slotCode string) error {
	if r.db == nil {
		return nil
	}
	return r.db.Model(&model.YardSlot{}).Where("slot_code = ?", slotCode).Updates(map[string]interface{}{
		"is_occupied":  false,
		"container_id": nil,
		"container_no": "",
	}).Error
}

func (r *yardSlotRepo) CountOccupied(yardID int64) (int64, error) {
	if r.db == nil {
		return 0, nil
	}
	var count int64
	err := r.db.Model(&model.YardSlot{}).Where("yard_id = ? AND is_occupied = ?", yardID, true).Count(&count).Error
	return count, err
}
