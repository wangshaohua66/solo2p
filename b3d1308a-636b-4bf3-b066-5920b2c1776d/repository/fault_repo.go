package repository

import (
	"context"
	"time"

	"smart-lighting-api/model"

	"gorm.io/gorm"
)

type FaultRepo struct {
	db *gorm.DB
}

func NewFaultRepo(db *gorm.DB) *FaultRepo {
	return &FaultRepo{db: db}
}

type FaultQueryParams struct {
	DeviceID    int64
	AreaID      int64
	FaultType   string
	FaultLevel  string
	Status      string
	StartDate   time.Time
	EndDate     time.Time
	Page        int
	PageSize    int
	Sort        string
}

func (r *FaultRepo) Create(ctx context.Context, fault *model.Fault) error {
	return r.db.WithContext(ctx).Create(fault).Error
}

func (r *FaultRepo) Update(ctx context.Context, fault *model.Fault) error {
	return r.db.WithContext(ctx).Save(fault).Error
}

func (r *FaultRepo) GetByID(ctx context.Context, id int64) (*model.Fault, error) {
	var fault model.Fault
	err := r.db.WithContext(ctx).First(&fault, id).Error
	if err != nil {
		return nil, err
	}
	return &fault, nil
}

func (r *FaultRepo) GetByCode(ctx context.Context, code string) (*model.Fault, error) {
	var fault model.Fault
	err := r.db.WithContext(ctx).Where("fault_code = ?", code).First(&fault).Error
	if err != nil {
		return nil, err
	}
	return &fault, nil
}

func (r *FaultRepo) List(ctx context.Context, params *FaultQueryParams, areaIDs []int64) ([]*model.Fault, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Fault{})

	if params.DeviceID > 0 {
		query = query.Where("device_id = ?", params.DeviceID)
	}
	if params.AreaID > 0 {
		query = query.Where("id IN (SELECT id FROM faults f LEFT JOIN devices d ON f.device_id = d.id WHERE d.area_id = ?)", params.AreaID)
	}
	if len(areaIDs) > 0 && params.AreaID == 0 {
		query = query.Where("device_id IN (SELECT id FROM devices WHERE area_id IN ?)", areaIDs)
	}
	if params.FaultType != "" {
		query = query.Where("fault_type = ?", params.FaultType)
	}
	if params.FaultLevel != "" {
		query = query.Where("fault_level = ?", params.FaultLevel)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if !params.StartDate.IsZero() {
		query = query.Where("occurred_at >= ?", params.StartDate)
	}
	if !params.EndDate.IsZero() {
		query = query.Where("occurred_at <= ?", params.EndDate)
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

	sort := params.Sort
	if sort == "" {
		sort = "occurred_at DESC"
	}

	var list []*model.Fault
	err := query.Order(sort).Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *FaultRepo) GetActiveFaultsByDevice(ctx context.Context, deviceID int64) ([]*model.Fault, error) {
	var faults []*model.Fault
	err := r.db.WithContext(ctx).Where("device_id = ? AND status IN ?", deviceID, []string{"pending", "handled"}).Find(&faults).Error
	return faults, err
}

func (r *FaultRepo) CountByStatus(ctx context.Context, status string, areaIDs []int64) (int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Fault{}).Where("status = ?", status)
	if len(areaIDs) > 0 {
		query = query.Where("device_id IN (SELECT id FROM devices WHERE area_id IN ?)", areaIDs)
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

func (r *FaultRepo) CountByFaultType(ctx context.Context, areaIDs []int64) (map[string]int64, error) {
	type result struct {
		FaultType string `gorm:"column:fault_type"`
		Count     int64  `gorm:"column:count"`
	}
	var results []result
	query := r.db.WithContext(ctx).Model(&model.Fault{}).
		Select("fault_type, COUNT(*) as count")
	if len(areaIDs) > 0 {
		query = query.Where("device_id IN (SELECT id FROM devices WHERE area_id IN ?)", areaIDs)
	}
	query = query.Group("fault_type")
	err := query.Scan(&results).Error
	if err != nil {
		return nil, err
	}
	m := make(map[string]int64)
	for _, r := range results {
		m[r.FaultType] = r.Count
	}
	return m, nil
}

func (r *FaultRepo) GetAllRules(ctx context.Context) ([]*model.FaultRule, error) {
	var rules []*model.FaultRule
	err := r.db.WithContext(ctx).Where("enabled = ?", true).Find(&rules).Error
	return rules, err
}

func (r *FaultRepo) GetRuleByIDHelper(ctx context.Context, id int64) (*model.FaultRule, error) {
	var rule model.FaultRule
	err := r.db.WithContext(ctx).First(&rule, id).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *FaultRepo) GetRuleByType(ctx context.Context, faultType string) (*model.FaultRule, error) {
	var rule model.FaultRule
	err := r.db.WithContext(ctx).Where("fault_type = ? AND enabled = ?", faultType, true).First(&rule).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *FaultRepo) UpdateRule(ctx context.Context, rule *model.FaultRule) error {
	return r.db.WithContext(ctx).Save(rule).Error
}

func (r *FaultRepo) CreateAlert(ctx context.Context, alert *model.Alert) error {
	return r.db.WithContext(ctx).Create(alert).Error
}

func (r *FaultRepo) UpdateAlert(ctx context.Context, alert *model.Alert) error {
	return r.db.WithContext(ctx).Save(alert).Error
}

func (r *FaultRepo) GetAlertByID(ctx context.Context, id int64) (*model.Alert, error) {
	var alert model.Alert
	err := r.db.WithContext(ctx).First(&alert, id).Error
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

func (r *FaultRepo) ListAlerts(ctx context.Context, status string, page, pageSize int, areaIDs []int64) ([]*model.Alert, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Alert{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if len(areaIDs) > 0 {
		query = query.Where("device_id IN (SELECT id FROM devices WHERE area_id IN ?)", areaIDs)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var list []*model.Alert
	err := query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *FaultRepo) RecoverFaults(ctx context.Context, deviceID int64) (int64, error) {
	result := r.db.WithContext(ctx).Model(&model.Fault{}).
		Where("device_id = ? AND status = ?", deviceID, "pending").
		Updates(map[string]interface{}{
			"status":       "handled",
			"recovered_at": time.Now(),
			"updated_at":   time.Now(),
		})
	return result.RowsAffected, result.Error
}

func (r *FaultRepo) GetPendingFaults(ctx context.Context, areaIDs []int64) ([]*model.Fault, error) {
	query := r.db.WithContext(ctx).Where("status = ?", "pending")
	if len(areaIDs) > 0 {
		query = query.Where("device_id IN (SELECT id FROM devices WHERE area_id IN ?)", areaIDs)
	}
	var faults []*model.Fault
	err := query.Order("occurred_at DESC").Find(&faults).Error
	return faults, err
}
