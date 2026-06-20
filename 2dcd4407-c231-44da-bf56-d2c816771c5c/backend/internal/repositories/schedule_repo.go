package repositories

import (
	"gorm.io/gorm"
	"exhibition-center/internal/models"
)

type ScheduleRepository struct {
	db *gorm.DB
}

func NewScheduleRepository(db *gorm.DB) *ScheduleRepository {
	return &ScheduleRepository{db: db}
}

func (r *ScheduleRepository) List(page, pageSize int, status string) ([]models.Schedule, int64, error) {
	var schedules []models.Schedule
	var total int64

	query := r.db.Model(&models.Schedule{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at desc").Offset(offset).Limit(pageSize).Find(&schedules).Error; err != nil {
		return nil, 0, err
	}

	return schedules, total, nil
}

func (r *ScheduleRepository) GetByID(id string) (*models.Schedule, error) {
	var schedule models.Schedule
	if err := r.db.First(&schedule, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &schedule, nil
}

func (r *ScheduleRepository) Create(schedule *models.Schedule) error {
	return r.db.Create(schedule).Error
}

func (r *ScheduleRepository) Update(id string, data map[string]interface{}) error {
	return r.db.Model(&models.Schedule{}).Where("id = ?", id).Updates(data).Error
}

func (r *ScheduleRepository) Delete(id string) error {
	return r.db.Delete(&models.Schedule{}, "id = ?", id).Error
}

func (r *ScheduleRepository) CheckConflict(scheduleId string, venueIds []string, startDate, endDate string) ([]models.Schedule, error) {
	var conflicts []models.Schedule

	query := r.db.Model(&models.Schedule{}).Where(
		"id != ? AND NOT (end_date < ? OR start_date > ?)",
		scheduleId, startDate, endDate,
	)

	if err := query.Find(&conflicts).Error; err != nil {
		return nil, err
	}

	if len(venueIds) > 0 {
		var filtered []models.Schedule
		for _, s := range conflicts {
			for _, vid := range s.VenueIDs {
				for _, checkVid := range venueIds {
					if vid == checkVid {
						filtered = append(filtered, s)
						goto next
					}
				}
			}
		next:
		}
		return filtered, nil
	}

	return conflicts, nil
}
