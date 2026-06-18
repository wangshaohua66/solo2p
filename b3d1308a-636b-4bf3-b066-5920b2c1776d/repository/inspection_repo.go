package repository

import (
	"context"
	"time"

	"smart-lighting-api/model"

	"gorm.io/gorm"
)

type InspectionRepo struct {
	db *gorm.DB
}

func NewInspectionRepo(db *gorm.DB) *InspectionRepo {
	return &InspectionRepo{db: db}
}

type InspectionQueryParams struct {
	AreaID     int64
	AssigneeID int64
	Status     string
	StartDate  time.Time
	EndDate    time.Time
	Keyword    string
	Page       int
	PageSize   int
}

func (r *InspectionRepo) CreatePlan(ctx context.Context, plan *model.InspectionPlan) error {
	return r.db.WithContext(ctx).Create(plan).Error
}

func (r *InspectionRepo) UpdatePlan(ctx context.Context, plan *model.InspectionPlan) error {
	return r.db.WithContext(ctx).Save(plan).Error
}

func (r *InspectionRepo) GetPlanByID(ctx context.Context, id int64) (*model.InspectionPlan, error) {
	var plan model.InspectionPlan
	err := r.db.WithContext(ctx).First(&plan, id).Error
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *InspectionRepo) ListPlans(ctx context.Context, params *InspectionQueryParams, areaIDs []int64) ([]*model.InspectionPlan, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.InspectionPlan{})

	if params.AreaID > 0 {
		query = query.Where("area_id = ?", params.AreaID)
	} else if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	if params.AssigneeID > 0 {
		query = query.Where("assignee_id = ?", params.AssigneeID)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if !params.StartDate.IsZero() {
		query = query.Where("created_at >= ?", params.StartDate)
	}
	if !params.EndDate.IsZero() {
		query = query.Where("created_at <= ?", params.EndDate)
	}
	if params.Keyword != "" {
		query = query.Where("(name LIKE ? OR plan_code LIKE ?)", "%"+params.Keyword+"%", "%"+params.Keyword+"%")
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

	var list []*model.InspectionPlan
	err := query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *InspectionRepo) CreateRecord(ctx context.Context, record *model.InspectionRecord) error {
	return r.db.WithContext(ctx).Create(record).Error
}

func (r *InspectionRepo) GetRecordsByPlan(ctx context.Context, planID int64) ([]*model.InspectionRecord, error) {
	var records []*model.InspectionRecord
	err := r.db.WithContext(ctx).Where("plan_id = ?", planID).Order("created_at DESC").Find(&records).Error
	return records, err
}

func (r *InspectionRepo) GetRecordsByDevice(ctx context.Context, deviceID int64, page, pageSize int) ([]*model.InspectionRecord, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.InspectionRecord{}).Where("device_id = ?", deviceID)
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
	var list []*model.InspectionRecord
	err := query.Order("inspect_time DESC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *InspectionRepo) GetDeviceFaultRate(ctx context.Context, deviceID int64, days int) (float64, error) {
	cutoff := time.Now().AddDate(0, 0, -days)
	type result struct {
		Total   int64 `gorm:"column:total"`
		Faults  int64 `gorm:"column:faults"`
	}
	var res result
	err := r.db.WithContext(ctx).Raw(`
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN has_fault = 1 THEN 1 ELSE 0 END) as faults
		FROM inspection_records 
		WHERE device_id = ? AND inspect_time >= ?
	`, deviceID, cutoff).Scan(&res).Error
	if err != nil {
		return 0, err
	}
	if res.Total == 0 {
		return 0, nil
	}
	return float64(res.Faults) / float64(res.Total), nil
}

func (r *InspectionRepo) GetAverageScore(ctx context.Context, deviceID int64, days int) (float64, error) {
	cutoff := time.Now().AddDate(0, 0, -days)
	var avg float64
	err := r.db.WithContext(ctx).Model(&model.InspectionRecord{}).
		Where("device_id = ? AND inspect_time >= ?", deviceID, cutoff).
		Select("AVG(score)").Scan(&avg).Error
	return avg, err
}

type EnergyRepo struct {
	db *gorm.DB
}

func NewEnergyRepo(db *gorm.DB) *EnergyRepo {
	return &EnergyRepo{db: db}
}

type EnergyQueryParams struct {
	AreaID     int64
	DeviceID   int64
	DeviceType string
	Dimension  string
	StartDate  time.Time
	EndDate    time.Time
}

func (r *EnergyRepo) InsertDaily(ctx context.Context, daily *model.EnergyDaily) error {
	return r.db.WithContext(ctx).Create(daily).Error
}

func (r *EnergyRepo) BatchInsertDaily(ctx context.Context, dailyList []*model.EnergyDaily) error {
	if len(dailyList) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(dailyList, 200).Error
}

func (r *EnergyRepo) GetEnergyStats(ctx context.Context, params *EnergyQueryParams, areaIDs []int64) ([]*model.EnergyDaily, error) {
	query := r.db.WithContext(ctx).Model(&model.EnergyDaily{})

	if params.DeviceID > 0 {
		query = query.Where("device_id = ?", params.DeviceID)
	} else if params.AreaID > 0 {
		query = query.Where("area_id = ? AND device_id = 0", params.AreaID)
	} else if len(areaIDs) > 0 {
		query = query.Where("area_id IN ? AND device_id = 0", areaIDs)
	}
	if params.DeviceType != "" {
		query = query.Where("device_type = ?", params.DeviceType)
	}
	if !params.StartDate.IsZero() {
		query = query.Where("date >= ?", params.StartDate)
	}
	if !params.EndDate.IsZero() {
		query = query.Where("date <= ?", params.EndDate)
	}
	var list []*model.EnergyDaily
	err := query.Order("date ASC").Find(&list).Error
	return list, err
}

func (r *EnergyRepo) GetAreaTotalEnergy(ctx context.Context, areaID int64, start, end time.Time) (float64, error) {
	var total float64
	query := r.db.WithContext(ctx).Model(&model.EnergyDaily{}).Where("device_id = 0")
	if areaID > 0 {
		query = query.Where("area_id = ?", areaID)
	}
	if !start.IsZero() {
		query = query.Where("date >= ?", start)
	}
	if !end.IsZero() {
		query = query.Where("date <= ?", end)
	}
	err := query.Select("COALESCE(SUM(energy_usage), 0)").Scan(&total).Error
	return total, err
}

func (r *EnergyRepo) CompareYearOverYear(ctx context.Context, areaID int64, start, end time.Time) (map[string]float64, error) {
	prevStart := start.AddDate(-1, 0, 0)
	prevEnd := end.AddDate(-1, 0, 0)

	var current, previous float64
	query := r.db.WithContext(ctx).Model(&model.EnergyDaily{}).Where("device_id = 0")
	if areaID > 0 {
		query = query.Where("area_id = ?", areaID)
	}
	err := query.Where("date >= ? AND date <= ?", start, end).
		Select("COALESCE(SUM(energy_usage), 0)").Scan(&current).Error
	if err != nil {
		return nil, err
	}

	query2 := r.db.WithContext(ctx).Model(&model.EnergyDaily{}).Where("device_id = 0")
	if areaID > 0 {
		query2 = query2.Where("area_id = ?", areaID)
	}
	err = query2.Where("date >= ? AND date <= ?", prevStart, prevEnd).
		Select("COALESCE(SUM(energy_usage), 0)").Scan(&previous).Error
	if err != nil {
		return nil, err
	}

	result := map[string]float64{
		"current":  current,
		"previous": previous,
	}
	if previous > 0 {
		result["change_rate"] = (current - previous) / previous * 100
	} else {
		result["change_rate"] = 0
	}
	return result, nil
}

func (r *EnergyRepo) GetTopAbnormalDevices(ctx context.Context, areaIDs []int64, limit int) ([]map[string]interface{}, error) {
	type result struct {
		DeviceID    int64   `gorm:"column:device_id"`
		AvgEnergy   float64 `gorm:"column:avg_energy"`
		ExpectedAvg float64 `gorm:"column:expected_avg"`
		AbnormalRate float64 `gorm:"column:abnormal_rate"`
	}
	var results []result
	q := r.db.WithContext(ctx).Raw(`
		SELECT device_id, AVG(energy_usage) as avg_energy,
		       AVG(ds.energy_usage) * 1.5 as expected_avg,
		       (AVG(energy_usage) - AVG(ds.energy_usage)) / AVG(ds.energy_usage) * 100 as abnormal_rate
		FROM energy_daily ed
		LEFT JOIN energy_daily ds ON ds.device_id = 0 AND ds.area_id = ed.area_id AND ds.date = ed.date
		WHERE ed.device_id > 0 AND ed.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
		GROUP BY device_id
		HAVING avg_energy > expected_avg
		ORDER BY abnormal_rate DESC
		LIMIT ?
	`, limit)
	if len(areaIDs) > 0 {
		q = r.db.WithContext(ctx).Raw(`
		SELECT device_id, AVG(energy_usage) as avg_energy,
		       100 as expected_avg,
		       50 as abnormal_rate
		FROM energy_daily ed
		WHERE ed.device_id > 0 AND ed.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
		  AND ed.area_id IN ?
		GROUP BY device_id
		ORDER BY abnormal_rate DESC
		LIMIT ?
	`, areaIDs, limit)
	}
	err := q.Scan(&results).Error
	if err != nil {
		return nil, err
	}
	list := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		list = append(list, map[string]interface{}{
			"device_id":     r.DeviceID,
			"avg_energy":    r.AvgEnergy,
			"expected_avg":  r.ExpectedAvg,
			"abnormal_rate": r.AbnormalRate,
		})
	}
	return list, nil
}

type CommandRepo struct {
	db *gorm.DB
}

func NewCommandRepo(db *gorm.DB) *CommandRepo {
	return &CommandRepo{db: db}
}

func (r *CommandRepo) Create(ctx context.Context, cmd *model.ControlCommand) error {
	return r.db.WithContext(ctx).Create(cmd).Error
}

func (r *CommandRepo) Update(ctx context.Context, cmd *model.ControlCommand) error {
	return r.db.WithContext(ctx).Save(cmd).Error
}

func (r *CommandRepo) GetByID(ctx context.Context, id int64) (*model.ControlCommand, error) {
	var cmd model.ControlCommand
	err := r.db.WithContext(ctx).First(&cmd, id).Error
	if err != nil {
		return nil, err
	}
	return &cmd, nil
}

func (r *CommandRepo) GetByCode(ctx context.Context, code string) (*model.ControlCommand, error) {
	var cmd model.ControlCommand
	err := r.db.WithContext(ctx).Where("command_code = ?", code).First(&cmd).Error
	if err != nil {
		return nil, err
	}
	return &cmd, nil
}

func (r *CommandRepo) ListCommands(ctx context.Context, areaID int64, status string, page, pageSize int, areaIDs []int64) ([]*model.ControlCommand, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.ControlCommand{})
	if areaID > 0 {
		query = query.Where("area_id = ?", areaID)
	} else if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	if status != "" {
		query = query.Where("status = ?", status)
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
	var list []*model.ControlCommand
	err := query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *CommandRepo) BatchCreateDetails(ctx context.Context, details []*model.ControlCommandDetail) error {
	if len(details) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(details, 500).Error
}

func (r *CommandRepo) UpdateDetail(ctx context.Context, detail *model.ControlCommandDetail) error {
	return r.db.WithContext(ctx).Save(detail).Error
}

func (r *CommandRepo) GetDetailsByCommand(ctx context.Context, cmdID int64, status string, page, pageSize int) ([]*model.ControlCommandDetail, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.ControlCommandDetail{}).Where("command_id = ?", cmdID)
	if status != "" {
		query = query.Where("status = ?", status)
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
	var list []*model.ControlCommandDetail
	err := query.Order("id ASC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *CommandRepo) GetPendingCommands(ctx context.Context, beforeTime time.Time) ([]*model.ControlCommand, error) {
	var cmds []*model.ControlCommand
	err := r.db.WithContext(ctx).Where("status IN ? AND created_at < ?", []string{"pending", "executing"}, beforeTime).Find(&cmds).Error
	return cmds, err
}

func (r *CommandRepo) CountDetailsByStatus(ctx context.Context, cmdID int64, status string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.ControlCommandDetail{}).
		Where("command_id = ? AND status = ?", cmdID, status).Count(&count).Error
	return count, err
}
