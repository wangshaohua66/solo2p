package repository

import (
	"gas-network-system/internal/model"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AlarmRepository struct {
	BaseRepository
}

func NewAlarmRepository(db *gorm.DB, logger *zap.Logger) *AlarmRepository {
	return &AlarmRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *AlarmRepository) Create(alarm *model.Alarm) error {
	return r.db.Create(alarm).Error
}

func (r *AlarmRepository) GetByID(id uint) (*model.Alarm, error) {
	var alarm model.Alarm
	err := r.db.Preload("Pipeline").First(&alarm, id).Error
	if err != nil {
		return nil, err
	}
	return &alarm, nil
}

func (r *AlarmRepository) GetByAlarmNo(alarmNo string) (*model.Alarm, error) {
	var alarm model.Alarm
	err := r.db.Where("alarm_no = ?", alarmNo).Preload("Pipeline").First(&alarm).Error
	if err != nil {
		return nil, err
	}
	return &alarm, nil
}

func (r *AlarmRepository) List(page, pageSize int, status *string, level *string, alarmType *string) (int64, []model.Alarm, error) {
	var total int64
	var alarms []model.Alarm

	query := r.db.Model(&model.Alarm{}).Preload("Pipeline")
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}
	if level != nil && *level != "" {
		query = query.Where("level = ?", *level)
	}
	if alarmType != nil && *alarmType != "" {
		query = query.Where("type = ?", *alarmType)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&alarms).Error
	return total, alarms, err
}

func (r *AlarmRepository) UpdateStatus(id uint, status model.AlarmStatus) error {
	updates := map[string]interface{}{"status": status}
	if status == model.AlarmStatusDispatched {
		now := time.Now()
		updates["dispatched_at"] = &now
	}
	if status == model.AlarmStatusResolved {
		now := time.Now()
		updates["resolved_at"] = &now
	}
	return r.db.Model(&model.Alarm{}).Where("id = ?", id).Updates(updates).Error
}

func (r *AlarmRepository) GetNewAlarms() ([]model.Alarm, error) {
	var alarms []model.Alarm
	err := r.db.Where("status = ?", model.AlarmStatusNew).
		Preload("Pipeline").
		Order("level DESC, created_at ASC").
		Find(&alarms).Error
	return alarms, err
}

func (r *AlarmRepository) GetOverdueAlarms(timeoutSeconds int) ([]model.Alarm, error) {
	var alarms []model.Alarm
	cutoff := time.Now().Add(-time.Duration(timeoutSeconds) * time.Second)
	err := r.db.Where("status = ? AND created_at <= ?", model.AlarmStatusNew, cutoff).
		Preload("Pipeline").
		Order("level DESC, created_at ASC").
		Find(&alarms).Error
	return alarms, err
}

type RepairRepository struct {
	BaseRepository
}

func NewRepairRepository(db *gorm.DB, logger *zap.Logger) *RepairRepository {
	return &RepairRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *RepairRepository) CreateOrder(order *model.RepairOrder) error {
	return r.db.Create(order).Error
}

func (r *RepairRepository) GetOrderByID(id uint) (*model.RepairOrder, error) {
	var order model.RepairOrder
	err := r.db.Preload("Alarm").Preload("RepairTeam").First(&order, id).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *RepairRepository) ListOrders(page, pageSize int, teamID *uint, status *string, alarmID *uint) (int64, []model.RepairOrder, error) {
	var total int64
	var orders []model.RepairOrder

	query := r.db.Model(&model.RepairOrder{}).Preload("Alarm").Preload("RepairTeam")
	if teamID != nil {
		query = query.Where("repair_team_id = ?", *teamID)
	}
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}
	if alarmID != nil {
		query = query.Where("alarm_id = ?", *alarmID)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&orders).Error
	return total, orders, err
}

func (r *RepairRepository) UpdateOrderStatus(id uint, status model.RepairOrderStatus) error {
	updates := map[string]interface{}{"status": status}
	now := time.Now()
	if status == model.RepairStatusArrived {
		updates["arrived_at"] = &now
	}
	if status == model.RepairStatusCompleted {
		updates["completed_at"] = &now
	}
	return r.db.Model(&model.RepairOrder{}).Where("id = ?", id).Updates(updates).Error
}

func (r *RepairRepository) GetAllTeams() ([]model.RepairTeam, error) {
	var teams []model.RepairTeam
	err := r.db.Find(&teams).Error
	return teams, err
}

func (r *RepairRepository) GetTeamByID(id uint) (*model.RepairTeam, error) {
	var team model.RepairTeam
	err := r.db.First(&team, id).Error
	if err != nil {
		return nil, err
	}
	return &team, nil
}

func (r *RepairRepository) GetActiveOrderCountByTeam(teamID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.RepairOrder{}).
		Where("repair_team_id = ? AND status IN ?", teamID, []model.RepairOrderStatus{
			model.RepairStatusDispatched,
			model.RepairStatusArrived,
			model.RepairStatusProcessing,
		}).
		Count(&count).Error
	return count, err
}

func (r *RepairRepository) UpdateTeamStatus(id uint, status model.RepairTeamStatus, currentTasks int) error {
	return r.db.Model(&model.RepairTeam{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":        status,
			"current_tasks": currentTasks,
		}).Error
}

func (r *RepairRepository) CreateTeam(team *model.RepairTeam) error {
	return r.db.Create(team).Error
}

func (r *RepairRepository) SaveOrder(order *model.RepairOrder) error {
	return r.db.Save(order).Error
}
