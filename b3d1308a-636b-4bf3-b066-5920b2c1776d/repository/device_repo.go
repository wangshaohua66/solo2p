package repository

import (
	"context"
	"time"

	"smart-lighting-api/model"

	"gorm.io/gorm"
)

type DeviceRepo struct {
	db *gorm.DB
}

func NewDeviceRepo(db *gorm.DB) *DeviceRepo {
	return &DeviceRepo{db: db}
}

type DeviceQueryParams struct {
	AreaID     int64
	CabinetID  int64
	DeviceType string
	Status     string
	IsOn       *bool
	Keyword    string
	Page       int
	PageSize   int
	Sort       string
}

func (r *DeviceRepo) Create(ctx context.Context, device *model.Device) error {
	return r.db.WithContext(ctx).Create(device).Error
}

func (r *DeviceRepo) Update(ctx context.Context, device *model.Device) error {
	return r.db.WithContext(ctx).Save(device).Error
}

func (r *DeviceRepo) GetByID(ctx context.Context, id int64) (*model.Device, error) {
	var device model.Device
	err := r.db.WithContext(ctx).First(&device, id).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (r *DeviceRepo) GetByCode(ctx context.Context, code string) (*model.Device, error) {
	var device model.Device
	err := r.db.WithContext(ctx).Where("device_code = ?", code).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (r *DeviceRepo) Delete(ctx context.Context, id int64) error {
	return r.db.WithContext(ctx).Delete(&model.Device{}, id).Error
}

func (r *DeviceRepo) List(ctx context.Context, params *DeviceQueryParams, areaIDs []int64) ([]*model.Device, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Device{})

	if params.AreaID > 0 {
		query = query.Where("area_id = ?", params.AreaID)
	} else if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	if params.CabinetID > 0 {
		query = query.Where("cabinet_id = ?", params.CabinetID)
	}
	if params.DeviceType != "" {
		query = query.Where("device_type = ?", params.DeviceType)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if params.IsOn != nil {
		query = query.Where("is_on = ?", *params.IsOn)
	}
	if params.Keyword != "" {
		query = query.Where("(name LIKE ? OR device_code LIKE ?)", "%"+params.Keyword+"%", "%"+params.Keyword+"%")
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
		sort = "id DESC"
	}

	var devices []*model.Device
	err := query.Order(sort).Limit(pageSize).Offset(offset).Find(&devices).Error
	return devices, total, err
}

func (r *DeviceRepo) ListByIDs(ctx context.Context, ids []int64) ([]*model.Device, error) {
	var devices []*model.Device
	if len(ids) == 0 {
		return devices, nil
	}
	err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&devices).Error
	return devices, err
}

func (r *DeviceRepo) BatchUpdateStatus(ctx context.Context, ids []int64, status string, isOn bool, brightness int) error {
	if len(ids) == 0 {
		return nil
	}
	updates := map[string]interface{}{
		"status": status,
		"is_on":  isOn,
		"updated_at": time.Now(),
	}
	if brightness > 0 {
		updates["brightness"] = brightness
	}
	return r.db.WithContext(ctx).Model(&model.Device{}).Where("id IN ?", ids).Updates(updates).Error
}

func (r *DeviceRepo) UpdateHealthScore(ctx context.Context, id int64, score int) error {
	return r.db.WithContext(ctx).Model(&model.Device{}).Where("id = ?", id).Update("health_score", score).Error
}

func (r *DeviceRepo) CountByArea(ctx context.Context, areaID int64) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Device{}).Where("area_id = ?", areaID).Count(&count).Error
	return count, err
}

func (r *DeviceRepo) CountByStatus(ctx context.Context, status string, areaIDs []int64) (int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Device{}).Where("status = ?", status)
	if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

func (r *DeviceRepo) GetAllIDs(ctx context.Context, areaIDs []int64) ([]int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Device{}).Select("id")
	if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	var ids []int64
	err := query.Pluck("id", &ids).Error
	return ids, err
}

func (r *DeviceRepo) InsertStatus(ctx context.Context, status *model.DeviceStatus) error {
	return r.db.WithContext(ctx).Create(status).Error
}

func (r *DeviceRepo) GetStatusHistory(ctx context.Context, deviceID int64, startTime, endTime time.Time, page, pageSize int) ([]*model.DeviceStatus, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.DeviceStatus{}).Where("device_id = ?", deviceID)
	if !startTime.IsZero() {
		query = query.Where("report_time >= ?", startTime)
	}
	if !endTime.IsZero() {
		query = query.Where("report_time <= ?", endTime)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize
	var list []*model.DeviceStatus
	err := query.Order("report_time DESC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *DeviceRepo) GetLatestStatus(ctx context.Context, deviceID int64) (*model.DeviceStatus, error) {
	var status model.DeviceStatus
	err := r.db.WithContext(ctx).Where("device_id = ?", deviceID).Order("report_time DESC").First(&status).Error
	if err != nil {
		return nil, err
	}
	return &status, nil
}

func (r *DeviceRepo) GetRecentStatuses(ctx context.Context, deviceID int64, minutes int) ([]*model.DeviceStatus, error) {
	startTime := time.Now().Add(-time.Duration(minutes) * time.Minute)
	var list []*model.DeviceStatus
	err := r.db.WithContext(ctx).Where("device_id = ? AND report_time >= ?", deviceID, startTime).
		Order("report_time ASC").Find(&list).Error
	return list, err
}

func (r *DeviceRepo) BatchInsertStatus(ctx context.Context, statuses []*model.DeviceStatus) error {
	if len(statuses) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(statuses, 500).Error
}

func (r *DeviceRepo) CleanOldStatus(ctx context.Context, days int) (int64, error) {
	cutoff := time.Now().AddDate(0, 0, -days)
	result := r.db.WithContext(ctx).Where("report_time < ?", cutoff).Delete(&model.DeviceStatus{})
	return result.RowsAffected, result.Error
}

func (r *DeviceRepo) FindOfflineDevices(ctx context.Context, offlineMinutes int, areaIDs []int64) ([]*model.Device, error) {
	cutoff := time.Now().Add(-time.Duration(offlineMinutes) * time.Minute)
	query := r.db.WithContext(ctx).Where("last_report_at < ?", cutoff)
	if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	var devices []*model.Device
	err := query.Find(&devices).Error
	return devices, err
}

func (r *DeviceRepo) ListByAreaID(ctx context.Context, areaID int64) ([]*model.Device, error) {
	var devices []*model.Device
	err := r.db.WithContext(ctx).Where("area_id = ?", areaID).Find(&devices).Error
	return devices, err
}

func (r *DeviceRepo) ListByCabinetID(ctx context.Context, cabinetID int64) ([]*model.Device, error) {
	var devices []*model.Device
	err := r.db.WithContext(ctx).Where("cabinet_id = ?", cabinetID).Find(&devices).Error
	return devices, err
}
