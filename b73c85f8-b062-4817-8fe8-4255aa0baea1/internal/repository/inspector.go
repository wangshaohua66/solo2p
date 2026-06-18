package repository

import (
	"gas-network-system/internal/model"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type InspectorRepository struct {
	BaseRepository
}

func NewInspectorRepository(db *gorm.DB, logger *zap.Logger) *InspectorRepository {
	return &InspectorRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *InspectorRepository) Create(inspector *model.Inspector) error {
	return r.db.Create(inspector).Error
}

func (r *InspectorRepository) GetByID(id uint) (*model.Inspector, error) {
	var inspector model.Inspector
	err := r.db.First(&inspector, id).Error
	if err != nil {
		return nil, err
	}
	return &inspector, nil
}

func (r *InspectorRepository) List(page, pageSize int, status *string) (int64, []model.Inspector, error) {
	var total int64
	var inspectors []model.Inspector

	query := r.db.Model(&model.Inspector{})
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Find(&inspectors).Error
	return total, inspectors, err
}

func (r *InspectorRepository) UpdateStatus(id uint, status model.InspectorStatus) error {
	return r.db.Model(&model.Inspector{}).Where("id = ?", id).Update("status", status).Error
}

func (r *InspectorRepository) GetAvailableInspectors() ([]model.Inspector, error) {
	var inspectors []model.Inspector
	err := r.db.Where("status = ?", model.InspectorStatusOnDuty).Find(&inspectors).Error
	return inspectors, err
}

func (r *InspectorRepository) GetTaskCountByInspector(inspectorID uint, startDate, endDate time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&model.InspectionTask{}).
		Where("inspector_id = ? AND plan_date BETWEEN ? AND ?", inspectorID, startDate, endDate).
		Where("status IN ?", []model.InspectionTaskStatus{
			model.TaskStatusPending,
			model.TaskStatusAccepted,
			model.TaskStatusInProgress,
		}).
		Count(&count).Error
	return count, err
}

func (r *InspectorRepository) CreateTask(task *model.InspectionTask) error {
	return r.db.Create(task).Error
}

func (r *InspectorRepository) BatchCreateTasks(tasks []model.InspectionTask) error {
	if len(tasks) == 0 {
		return nil
	}
	return r.db.CreateInBatches(tasks, 100).Error
}

func (r *InspectorRepository) GetTaskByID(id uint) (*model.InspectionTask, error) {
	var task model.InspectionTask
	err := r.db.Preload("Inspector").Preload("Pipeline").First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *InspectorRepository) ListTasks(page, pageSize int, inspectorID *uint, status *string, dateFrom, dateTo *time.Time) (int64, []model.InspectionTask, error) {
	var total int64
	var tasks []model.InspectionTask

	query := r.db.Model(&model.InspectionTask{}).Preload("Inspector").Preload("Pipeline")
	if inspectorID != nil {
		query = query.Where("inspector_id = ?", *inspectorID)
	}
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}
	if dateFrom != nil {
		query = query.Where("plan_date >= ?", *dateFrom)
	}
	if dateTo != nil {
		query = query.Where("plan_date <= ?", *dateTo)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tasks).Error
	return total, tasks, err
}

func (r *InspectorRepository) UpdateTask(task *model.InspectionTask) error {
	return r.db.Save(task).Error
}

func (r *InspectorRepository) GetPendingTasksBeforeTime(t time.Time) ([]model.InspectionTask, error) {
	var tasks []model.InspectionTask
	err := r.db.Where("status = ? AND created_at <= ?", model.TaskStatusPending, t).
		Preload("Pipeline").Preload("Inspector").
		Find(&tasks).Error
	return tasks, err
}

func (r *InspectorRepository) ReassignTask(taskID uint, newInspectorID uint) error {
	return r.db.Model(&model.InspectionTask{}).Where("id = ?", taskID).
		Updates(map[string]interface{}{
			"inspector_id": newInspectorID,
			"status":       model.TaskStatusPending,
		}).Error
}

func (r *InspectorRepository) GetTasksByInspectorAndDate(inspectorID uint, date time.Time) ([]model.InspectionTask, error) {
	var tasks []model.InspectionTask
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)
	err := r.db.Where("inspector_id = ? AND plan_date BETWEEN ? AND ?", inspectorID, startOfDay, endOfDay).
		Find(&tasks).Error
	return tasks, err
}

func (r *InspectorRepository) GetTasksForReassign(leaveInspectorID uint, startDate, endDate time.Time) ([]model.InspectionTask, error) {
	var tasks []model.InspectionTask
	err := r.db.Where("inspector_id = ? AND plan_date BETWEEN ? AND ?", leaveInspectorID, startDate, endDate).
		Where("status IN ?", []model.InspectionTaskStatus{
			model.TaskStatusPending,
			model.TaskStatusAccepted,
		}).
		Preload("Pipeline").
		Find(&tasks).Error
	return tasks, err
}

func (r *InspectorRepository) GetExistingTaskPipelineIDs(pipelineIDs []uint, date time.Time, level int) ([]uint, error) {
	var existingIDs []uint
	if len(pipelineIDs) == 0 {
		return existingIDs, nil
	}
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)
	err := r.db.Model(&model.InspectionTask{}).
		Where("pipeline_id IN ? AND inspect_level = ? AND plan_date BETWEEN ? AND ?",
			pipelineIDs, level, startOfDay, endOfDay).
		Where("status IN ?", []model.InspectionTaskStatus{
			model.TaskStatusPending,
			model.TaskStatusAccepted,
			model.TaskStatusInProgress,
		}).
		Pluck("pipeline_id", &existingIDs).Error
	return existingIDs, err
}
