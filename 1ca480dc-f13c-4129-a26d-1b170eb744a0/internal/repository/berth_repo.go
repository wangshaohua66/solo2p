package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"port-ops-system/internal/model"
)

type BerthRepository interface {
	Create(b *model.Berth) error
	Update(b *model.Berth) error
	GetByID(id int64) (*model.Berth, error)
	GetByCode(code string) (*model.Berth, error)
	List() ([]*model.Berth, error)
	ListByStatus(status model.BerthStatus) ([]*model.Berth, error)
}

type QuayCraneRepository interface {
	Create(c *model.QuayCrane) error
	Update(c *model.QuayCrane) error
	GetByID(id int64) (*model.QuayCrane, error)
	GetByCode(code string) (*model.QuayCrane, error)
	List() ([]*model.QuayCrane, error)
	ListByBerth(berthID int64) ([]*model.QuayCrane, error)
	ListByStatus(status model.QuayCraneStatus) ([]*model.QuayCrane, error)
}

type VesselRepository interface {
	Create(v *model.Vessel) error
	Update(v *model.Vessel) error
	GetByID(id int64) (*model.Vessel, error)
	GetByCode(code string) (*model.Vessel, error)
	List(page, pageSize int) ([]*model.Vessel, int64, error)
}

type VesselCallRepository interface {
	Create(vc *model.VesselCall) error
	Update(vc *model.VesselCall) error
	GetByID(id int64) (*model.VesselCall, error)
	ListPending() ([]*model.VesselCall, error)
	ListByDateRange(start, end time.Time) ([]*model.VesselCall, error)
	List(page, pageSize int, filters map[string]interface{}) ([]*model.VesselCall, int64, error)
}

type BerthPlanRepository interface {
	Create(bp *model.BerthPlan) error
	Update(bp *model.BerthPlan) error
	GetByID(id int64) (*model.BerthPlan, error)
	ListByDate(date time.Time) ([]*model.BerthPlan, error)
	ListByBerthAndRange(berthID int64, start, end time.Time) ([]*model.BerthPlan, error)
	Delete(id int64) error
}

type CraneAssignmentRepository interface {
	Create(ca *model.CraneAssignment) error
	Update(ca *model.CraneAssignment) error
	GetByID(id int64) (*model.CraneAssignment, error)
	ListByPlan(planID int64) ([]*model.CraneAssignment, error)
	ListByCraneAndRange(craneID int64, start, end time.Time) ([]*model.CraneAssignment, error)
}

type berthRepo struct {
	db *gorm.DB
}

func NewBerthRepository(r *Repository) BerthRepository {
	return &berthRepo{db: r.db}
}

func (r *berthRepo) Create(b *model.Berth) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(b).Error
}

func (r *berthRepo) Update(b *model.Berth) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(b).Error
}

func (r *berthRepo) GetByID(id int64) (*model.Berth, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var b model.Berth
	err := r.db.First(&b, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &b, err
}

func (r *berthRepo) GetByCode(code string) (*model.Berth, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var b model.Berth
	err := r.db.Where("berth_code = ?", code).First(&b).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &b, err
}

func (r *berthRepo) List() ([]*model.Berth, error) {
	if r.db == nil {
		return []*model.Berth{}, nil
	}
	var berths []*model.Berth
	err := r.db.Find(&berths).Error
	return berths, err
}

func (r *berthRepo) ListByStatus(status model.BerthStatus) ([]*model.Berth, error) {
	if r.db == nil {
		return []*model.Berth{}, nil
	}
	var berths []*model.Berth
	err := r.db.Where("status = ?", status).Find(&berths).Error
	return berths, err
}

type quayCraneRepo struct {
	db *gorm.DB
}

func NewQuayCraneRepository(r *Repository) QuayCraneRepository {
	return &quayCraneRepo{db: r.db}
}

func (r *quayCraneRepo) Create(c *model.QuayCrane) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(c).Error
}

func (r *quayCraneRepo) Update(c *model.QuayCrane) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(c).Error
}

func (r *quayCraneRepo) GetByID(id int64) (*model.QuayCrane, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var c model.QuayCrane
	err := r.db.First(&c, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &c, err
}

func (r *quayCraneRepo) GetByCode(code string) (*model.QuayCrane, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var c model.QuayCrane
	err := r.db.Where("crane_code = ?", code).First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &c, err
}

func (r *quayCraneRepo) List() ([]*model.QuayCrane, error) {
	if r.db == nil {
		return []*model.QuayCrane{}, nil
	}
	var cranes []*model.QuayCrane
	err := r.db.Find(&cranes).Error
	return cranes, err
}

func (r *quayCraneRepo) ListByBerth(berthID int64) ([]*model.QuayCrane, error) {
	if r.db == nil {
		return []*model.QuayCrane{}, nil
	}
	var cranes []*model.QuayCrane
	err := r.db.Where("berth_id = ?", berthID).Find(&cranes).Error
	return cranes, err
}

func (r *quayCraneRepo) ListByStatus(status model.QuayCraneStatus) ([]*model.QuayCrane, error) {
	if r.db == nil {
		return []*model.QuayCrane{}, nil
	}
	var cranes []*model.QuayCrane
	err := r.db.Where("status = ?", status).Find(&cranes).Error
	return cranes, err
}

type vesselRepo struct {
	db *gorm.DB
}

func NewVesselRepository(r *Repository) VesselRepository {
	return &vesselRepo{db: r.db}
}

func (r *vesselRepo) Create(v *model.Vessel) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(v).Error
}

func (r *vesselRepo) Update(v *model.Vessel) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(v).Error
}

func (r *vesselRepo) GetByID(id int64) (*model.Vessel, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var v model.Vessel
	err := r.db.First(&v, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &v, err
}

func (r *vesselRepo) GetByCode(code string) (*model.Vessel, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var v model.Vessel
	err := r.db.Where("vessel_code = ?", code).First(&v).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &v, err
}

func (r *vesselRepo) List(page, pageSize int) ([]*model.Vessel, int64, error) {
	if r.db == nil {
		return []*model.Vessel{}, 0, nil
	}
	var total int64
	if err := r.db.Model(&model.Vessel{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var vessels []*model.Vessel
	offset := (page - 1) * pageSize
	err := r.db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&vessels).Error
	return vessels, total, err
}

type vesselCallRepo struct {
	db *gorm.DB
}

func NewVesselCallRepository(r *Repository) VesselCallRepository {
	return &vesselCallRepo{db: r.db}
}

func (r *vesselCallRepo) Create(vc *model.VesselCall) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(vc).Error
}

func (r *vesselCallRepo) Update(vc *model.VesselCall) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(vc).Error
}

func (r *vesselCallRepo) GetByID(id int64) (*model.VesselCall, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var vc model.VesselCall
	err := r.db.First(&vc, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &vc, err
}

func (r *vesselCallRepo) ListPending() ([]*model.VesselCall, error) {
	if r.db == nil {
		return []*model.VesselCall{}, nil
	}
	var calls []*model.VesselCall
	err := r.db.Where("status IN ?", []string{"ARRIVING", "ANCHORED", "WAITING"}).Order("eta ASC").Find(&calls).Error
	return calls, err
}

func (r *vesselCallRepo) ListByDateRange(start, end time.Time) ([]*model.VesselCall, error) {
	if r.db == nil {
		return []*model.VesselCall{}, nil
	}
	var calls []*model.VesselCall
	err := r.db.Where("(eta BETWEEN ? AND ?) OR (etd BETWEEN ? AND ?)", start, end, start, end).Find(&calls).Error
	return calls, err
}

func (r *vesselCallRepo) List(page, pageSize int, filters map[string]interface{}) ([]*model.VesselCall, int64, error) {
	if r.db == nil {
		return []*model.VesselCall{}, 0, nil
	}
	query := r.db.Model(&model.VesselCall{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var calls []*model.VesselCall
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&calls).Error
	return calls, total, err
}

type berthPlanRepo struct {
	db *gorm.DB
}

func NewBerthPlanRepository(r *Repository) BerthPlanRepository {
	return &berthPlanRepo{db: r.db}
}

func (r *berthPlanRepo) Create(bp *model.BerthPlan) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(bp).Error
}

func (r *berthPlanRepo) Update(bp *model.BerthPlan) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(bp).Error
}

func (r *berthPlanRepo) GetByID(id int64) (*model.BerthPlan, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var bp model.BerthPlan
	err := r.db.First(&bp, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &bp, err
}

func (r *berthPlanRepo) ListByDate(date time.Time) ([]*model.BerthPlan, error) {
	if r.db == nil {
		return []*model.BerthPlan{}, nil
	}
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)
	var plans []*model.BerthPlan
	err := r.db.Where("(start_time < ? AND end_time > ?)", endOfDay, startOfDay).Find(&plans).Error
	return plans, err
}

func (r *berthPlanRepo) ListByBerthAndRange(berthID int64, start, end time.Time) ([]*model.BerthPlan, error) {
	if r.db == nil {
		return []*model.BerthPlan{}, nil
	}
	var plans []*model.BerthPlan
	err := r.db.Where("berth_id = ? AND (start_time < ? AND end_time > ?)", berthID, end, start).Find(&plans).Error
	return plans, err
}

func (r *berthPlanRepo) Delete(id int64) error {
	if r.db == nil {
		return nil
	}
	return r.db.Delete(&model.BerthPlan{}, id).Error
}

type craneAssignmentRepo struct {
	db *gorm.DB
}

func NewCraneAssignmentRepository(r *Repository) CraneAssignmentRepository {
	return &craneAssignmentRepo{db: r.db}
}

func (r *craneAssignmentRepo) Create(ca *model.CraneAssignment) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(ca).Error
}

func (r *craneAssignmentRepo) Update(ca *model.CraneAssignment) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(ca).Error
}

func (r *craneAssignmentRepo) GetByID(id int64) (*model.CraneAssignment, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var ca model.CraneAssignment
	err := r.db.First(&ca, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &ca, err
}

func (r *craneAssignmentRepo) ListByPlan(planID int64) ([]*model.CraneAssignment, error) {
	if r.db == nil {
		return []*model.CraneAssignment{}, nil
	}
	var assignments []*model.CraneAssignment
	err := r.db.Where("plan_id = ?", planID).Find(&assignments).Error
	return assignments, err
}

func (r *craneAssignmentRepo) ListByCraneAndRange(craneID int64, start, end time.Time) ([]*model.CraneAssignment, error) {
	if r.db == nil {
		return []*model.CraneAssignment{}, nil
	}
	var assignments []*model.CraneAssignment
	err := r.db.Where("crane_id = ? AND (start_time < ? AND end_time > ?)", craneID, end, start).Find(&assignments).Error
	return assignments, err
}
