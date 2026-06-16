package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"equipment-booking/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository[T any] interface {
	Create(ctx context.Context, entity *T) error
	GetByID(ctx context.Context, id uint64) (*T, error)
	Update(ctx context.Context, entity *T) error
	Delete(ctx context.Context, id uint64) error
	List(ctx context.Context, pagination *model.PaginationParams) (*model.PaginatedResult[T], error)
}

type BaseRepository[T any] struct {
	db *gorm.DB
}

func NewBaseRepository[T any](db *gorm.DB) *BaseRepository[T] {
	return &BaseRepository[T]{db: db}
}

func (r *BaseRepository[T]) Create(ctx context.Context, entity *T) error {
	return r.db.WithContext(ctx).Create(entity).Error
}

func (r *BaseRepository[T]) GetByID(ctx context.Context, id uint64) (*T, error) {
	var entity T
	err := r.db.WithContext(ctx).First(&entity, id).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *BaseRepository[T]) Update(ctx context.Context, entity *T) error {
	return r.db.WithContext(ctx).Save(entity).Error
}

func (r *BaseRepository[T]) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(new(T), id).Error
}

func (r *BaseRepository[T]) List(ctx context.Context, pagination *model.PaginationParams) (*model.PaginatedResult[T], error) {
	var items []T
	var total int64

	query := r.db.WithContext(ctx).Model(new(T))

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination == nil {
		pagination = &model.PaginationParams{Page: 1, PageSize: int(total)}
	}

	query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())

	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[T]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

type EquipmentRepository interface {
	Repository[model.Equipment]
	ListWithFilter(ctx context.Context, centerID, category, status *string, pagination *model.PaginationParams) (*model.PaginatedResult[model.Equipment], error)
	GetByIDWithCenter(ctx context.Context, id uint64) (*model.Equipment, error)
}

type equipmentRepository struct {
	*BaseRepository[model.Equipment]
	db *gorm.DB
}

func NewEquipmentRepository(db *gorm.DB) EquipmentRepository {
	return &equipmentRepository{
		BaseRepository: NewBaseRepository[model.Equipment](db),
		db:             db,
	}
}

func (r *equipmentRepository) ListWithFilter(ctx context.Context, centerID, category, status *string, pagination *model.PaginationParams) (*model.PaginatedResult[model.Equipment], error) {
	var items []model.Equipment
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Equipment{}).Preload("Center")

	if centerID != nil {
		query = query.Where("center_id = ?", *centerID)
	}
	if category != nil {
		query = query.Where("category = ?", *category)
	}
	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Equipment]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *equipmentRepository) GetByIDWithCenter(ctx context.Context, id uint64) (*model.Equipment, error) {
	var equipment model.Equipment
	err := r.db.WithContext(ctx).Preload("Center").First(&equipment, id).Error
	if err != nil {
		return nil, err
	}
	return &equipment, nil
}

type BookingRepository interface {
	Repository[model.Booking]
	CheckConflictWithLock(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, excludeBookingID *uint64) (bool, []model.Booking, error)
	ListByEquipmentAndTimeRange(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Booking], error)
	ListByUser(ctx context.Context, userID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Booking], error)
	GetByIDWithDetails(ctx context.Context, id uint64) (*model.Booking, error)
}

type bookingRepository struct {
	*BaseRepository[model.Booking]
	db *gorm.DB
}

func NewBookingRepository(db *gorm.DB) BookingRepository {
	return &bookingRepository{
		BaseRepository: NewBaseRepository[model.Booking](db),
		db:             db,
	}
}

func (r *bookingRepository) CheckConflictWithLock(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, excludeBookingID *uint64) (bool, []model.Booking, error) {
	var conflicts []model.Booking

	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return false, nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&model.Booking{}).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("equipment_id = ?", equipmentID).
		Where("status = ?", "confirmed").
		Where("start_time < ?", endTime).
		Where("end_time > ?", startTime)

	if excludeBookingID != nil {
		query = query.Where("id != ?", *excludeBookingID)
	}

	if err := query.Preload("User").Preload("Equipment").Find(&conflicts).Error; err != nil {
		tx.Rollback()
		return false, nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return false, nil, err
	}

	return len(conflicts) > 0, conflicts, nil
}

func (r *bookingRepository) ListByEquipmentAndTimeRange(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Booking], error) {
	var items []model.Booking
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Booking{}).
		Preload("User").
		Preload("Equipment").
		Where("equipment_id = ?", equipmentID).
		Where("start_time < ?", endTime).
		Where("end_time > ?", startTime)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("start_time ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Booking]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *bookingRepository) ListByUser(ctx context.Context, userID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Booking], error) {
	var items []model.Booking
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Booking{}).
		Preload("User").
		Preload("Equipment").
		Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Booking]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *bookingRepository) GetByIDWithDetails(ctx context.Context, id uint64) (*model.Booking, error) {
	var booking model.Booking
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Equipment").
		Preload("Equipment.Center").
		First(&booking, id).Error
	if err != nil {
		return nil, err
	}
	return &booking, nil
}

type WaitlistRepository interface {
	Repository[model.Waitlist]
	ListByEquipment(ctx context.Context, equipmentID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Waitlist], error)
	GetFirstWaitlistItem(ctx context.Context, equipmentID uint64, startTime, endTime time.Time) (*model.Waitlist, error)
	PromoteWaitlist(ctx context.Context, equipmentID uint64) (*model.Waitlist, error)
}

type waitlistRepository struct {
	*BaseRepository[model.Waitlist]
	db *gorm.DB
}

func NewWaitlistRepository(db *gorm.DB) WaitlistRepository {
	return &waitlistRepository{
		BaseRepository: NewBaseRepository[model.Waitlist](db),
		db:             db,
	}
}

func (r *waitlistRepository) ListByEquipment(ctx context.Context, equipmentID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Waitlist], error) {
	var items []model.Waitlist
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Waitlist{}).
		Preload("User").
		Preload("Equipment").
		Where("equipment_id = ?", equipmentID)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("position ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Waitlist]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *waitlistRepository) GetFirstWaitlistItem(ctx context.Context, equipmentID uint64, startTime, endTime time.Time) (*model.Waitlist, error) {
	var waitlist model.Waitlist
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("equipment_id = ?", equipmentID).
		Where("start_time < ?", endTime).
		Where("end_time > ?", startTime).
		Order("position ASC").
		First(&waitlist).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &waitlist, nil
}

func (r *waitlistRepository) PromoteWaitlist(ctx context.Context, equipmentID uint64) (*model.Waitlist, error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var firstItem model.Waitlist
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Preload("User").
		Where("equipment_id = ?", equipmentID).
		Order("position ASC").
		First(&firstItem).Error
	if err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	if err := tx.Delete(&firstItem).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Model(&model.Waitlist{}).
		Where("equipment_id = ? AND position > ?", equipmentID, firstItem.Position).
		Update("position", gorm.Expr("position - 1")).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &firstItem, nil
}

type BillingRepository interface {
	Repository[model.Billing]
	ListByUser(ctx context.Context, userID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error)
	ListByMonth(ctx context.Context, year, month int, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error)
	ListByStatus(ctx context.Context, status string, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error)
	ListByUserAndMonth(ctx context.Context, userID uint64, year, month int, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error)
	GetByIDWithDetails(ctx context.Context, id uint64) (*model.Billing, error)
	GetByBookingID(ctx context.Context, bookingID uint64) (*model.Billing, error)
}

type billingRepository struct {
	*BaseRepository[model.Billing]
	db *gorm.DB
}

func NewBillingRepository(db *gorm.DB) BillingRepository {
	return &billingRepository{
		BaseRepository: NewBaseRepository[model.Billing](db),
		db:             db,
	}
}

func (r *billingRepository) ListByUser(ctx context.Context, userID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error) {
	var items []model.Billing
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Billing{}).
		Preload("User").
		Preload("Booking").
		Preload("Booking.Equipment").
		Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("billing_date DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Billing]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *billingRepository) ListByMonth(ctx context.Context, year, month int, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error) {
	var items []model.Billing
	var total int64

	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0)

	query := r.db.WithContext(ctx).Model(&model.Billing{}).
		Preload("User").
		Preload("Booking").
		Preload("Booking.Equipment").
		Where("billing_date >= ? AND billing_date < ?", startDate, endDate)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("billing_date DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Billing]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *billingRepository) ListByStatus(ctx context.Context, status string, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error) {
	var items []model.Billing
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Billing{}).
		Preload("User").
		Preload("Booking").
		Preload("Booking.Equipment").
		Where("status = ?", status)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("billing_date DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Billing]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *billingRepository) ListByUserAndMonth(ctx context.Context, userID uint64, year, month int, pagination *model.PaginationParams) (*model.PaginatedResult[model.Billing], error) {
	var items []model.Billing
	var total int64

	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0)

	query := r.db.WithContext(ctx).Model(&model.Billing{}).
		Preload("User").
		Preload("Booking").
		Preload("Booking.Equipment").
		Where("user_id = ?", userID).
		Where("billing_date >= ? AND billing_date < ?", startDate, endDate)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("billing_date DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Billing]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *billingRepository) GetByIDWithDetails(ctx context.Context, id uint64) (*model.Billing, error) {
	var billing model.Billing
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Booking").
		Preload("Booking.Equipment").
		First(&billing, id).Error
	if err != nil {
		return nil, err
	}
	return &billing, nil
}

func (r *billingRepository) GetByBookingID(ctx context.Context, bookingID uint64) (*model.Billing, error) {
	var billing model.Billing
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Booking").
		Preload("Booking.Equipment").
		Where("booking_id = ?", bookingID).
		First(&billing).Error
	if err != nil {
		return nil, err
	}
	return &billing, nil
}

type MaintenanceRepository interface {
	Repository[model.Maintenance]
	ListByEquipment(ctx context.Context, equipmentID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error)
	ListByTimeRange(ctx context.Context, startTime, endTime time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error)
	ListByEquipmentAndTimeRange(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error)
	GetByIDWithDetails(ctx context.Context, id uint64) (*model.Maintenance, error)
	CheckConflict(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, excludeID *uint64) (bool, []model.Maintenance, error)
}

type maintenanceRepository struct {
	*BaseRepository[model.Maintenance]
	db *gorm.DB
}

func NewMaintenanceRepository(db *gorm.DB) MaintenanceRepository {
	return &maintenanceRepository{
		BaseRepository: NewBaseRepository[model.Maintenance](db),
		db:             db,
	}
}

func (r *maintenanceRepository) ListByEquipment(ctx context.Context, equipmentID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error) {
	var items []model.Maintenance
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Maintenance{}).
		Preload("Equipment").
		Preload("Operator").
		Where("equipment_id = ?", equipmentID)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("start_time DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Maintenance]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *maintenanceRepository) ListByTimeRange(ctx context.Context, startTime, endTime time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error) {
	var items []model.Maintenance
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Maintenance{}).
		Preload("Equipment").
		Preload("Operator").
		Where("start_time < ?", endTime).
		Where("end_time > ?", startTime)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("start_time ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Maintenance]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *maintenanceRepository) ListByEquipmentAndTimeRange(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error) {
	var items []model.Maintenance
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Maintenance{}).
		Preload("Equipment").
		Preload("Operator").
		Where("equipment_id = ?", equipmentID).
		Where("start_time < ?", endTime).
		Where("end_time > ?", startTime)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("start_time ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Maintenance]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *maintenanceRepository) GetByIDWithDetails(ctx context.Context, id uint64) (*model.Maintenance, error) {
	var maintenance model.Maintenance
	err := r.db.WithContext(ctx).
		Preload("Equipment").
		Preload("Equipment.Center").
		Preload("Operator").
		First(&maintenance, id).Error
	if err != nil {
		return nil, err
	}
	return &maintenance, nil
}

func (r *maintenanceRepository) CheckConflict(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, excludeID *uint64) (bool, []model.Maintenance, error) {
	var items []model.Maintenance

	query := r.db.WithContext(ctx).Model(&model.Maintenance{}).
		Where("equipment_id = ?", equipmentID).
		Where("status != ?", "cancelled").
		Where("start_time < ?", endTime).
		Where("end_time > ?", startTime)

	if excludeID != nil {
		query = query.Where("id != ?", *excludeID)
	}

	if err := query.Find(&items).Error; err != nil {
		return false, nil, err
	}

	return len(items) > 0, items, nil
}

type StatsRepository interface {
	GetUtilizationByEquipment(ctx context.Context, startTime, endTime time.Time, equipmentIDs []uint64, centerID *uint64) ([]model.UtilizationStats, error)
	GetUtilizationByCenter(ctx context.Context, startTime, endTime time.Time) ([]model.CenterStats, error)
	GetUtilizationByCategory(ctx context.Context, startTime, endTime time.Time, centerID *uint64) ([]model.CategoryStats, error)
	GetUtilizationByTimeDimension(ctx context.Context, startTime, endTime time.Time, dimension string, centerID *uint64) ([]model.UtilizationStats, error)
	GetPeakValleyStats(ctx context.Context, startTime, endTime time.Time) ([]model.PeakValleyStats, error)
	GetTrendStats(ctx context.Context, days int) ([]model.TrendStats, error)
	GetEquipmentRanking(ctx context.Context, startTime, endTime time.Time, limit int) ([]model.EquipmentRankingItem, error)
	GetCenterDetailStats(ctx context.Context, startTime, endTime time.Time) ([]model.CenterDetailStats, error)
	GetDashboardStats(ctx context.Context) (*model.DashboardStats, error)
}

type statsRepository struct {
	db *gorm.DB
}

func NewStatsRepository(db *gorm.DB) StatsRepository {
	return &statsRepository{db: db}
}

func (r *statsRepository) GetUtilizationByEquipment(ctx context.Context, startTime, endTime time.Time, equipmentIDs []uint64, centerID *uint64) ([]model.UtilizationStats, error) {
	var results []model.UtilizationStats

	totalHours := endTime.Sub(startTime).Hours()
	startStr := startTime.Format("2006-01-02 15:04:05")
	endStr := endTime.Format("2006-01-02 15:04:05")
	periodStr := startTime.Format("2006-01-02") + " - " + endTime.Format("2006-01-02")

	sql := fmt.Sprintf(`
		SELECT 
			e.id as equipment_id,
			e.name as equipment_name,
			e.center_id as center_id,
			c.name as center_name,
			e.category as category,
			%f as total_hours,
			COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, $1::timestamp) - GREATEST(b.start_time, $2::timestamp))) / 3600), 0) as booked_hours,
			CASE 
				WHEN %f > 0 THEN COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, $1::timestamp) - GREATEST(b.start_time, $2::timestamp))) / 3600), 0) / %f * 100 
				ELSE 0 
			END as utilization_rate,
			$3 as period
		FROM equipment e
		LEFT JOIN centers c ON e.center_id = c.id
		LEFT JOIN bookings b ON e.id = b.equipment_id 
			AND b.status = 'confirmed'
			AND b.start_time < $1::timestamp 
			AND b.end_time > $2::timestamp
		WHERE 1=1
	`, totalHours, totalHours, totalHours)

	args := []interface{}{endStr, startStr, periodStr}

	if len(equipmentIDs) > 0 {
		sql += " AND e.id IN ($" + strconv.Itoa(len(args)+1) + ")"
		args = append(args, equipmentIDs)
	}

	if centerID != nil && *centerID > 0 {
		sql += " AND e.center_id = $" + strconv.Itoa(len(args)+1)
		args = append(args, *centerID)
	}

	sql += " GROUP BY e.id, e.name, e.center_id, c.name, e.category ORDER BY utilization_rate DESC"

	err := r.db.WithContext(ctx).Raw(sql, args...).Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetUtilizationByCenter(ctx context.Context, startTime, endTime time.Time) ([]model.CenterStats, error) {
	var results []model.CenterStats

	totalHours := endTime.Sub(startTime).Hours()
	startStr := startTime.Format("2006-01-02 15:04:05")
	endStr := endTime.Format("2006-01-02 15:04:05")

	sql := fmt.Sprintf(`
		SELECT 
			c.id as center_id,
			c.name as center_name,
			COUNT(DISTINCT e.id) as equipment_count,
			COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, $1::timestamp) - GREATEST(b.start_time, $2::timestamp))) / 3600), 0) as booked_hours,
			CASE 
				WHEN COUNT(DISTINCT e.id) > 0 AND %f > 0 THEN 
					COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, $1::timestamp) - GREATEST(b.start_time, $2::timestamp))) / 3600), 0) / (COUNT(DISTINCT e.id) * %f) * 100 
				ELSE 0 
			END as utilization_rate
		FROM equipment e
		LEFT JOIN centers c ON e.center_id = c.id
		LEFT JOIN bookings b ON e.id = b.equipment_id 
			AND b.status = 'confirmed'
			AND b.start_time < $1::timestamp 
			AND b.end_time > $2::timestamp
		GROUP BY c.id, c.name
		ORDER BY utilization_rate DESC
	`, totalHours, totalHours)

	err := r.db.WithContext(ctx).Raw(sql, endStr, startStr).Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetUtilizationByCategory(ctx context.Context, startTime, endTime time.Time, centerID *uint64) ([]model.CategoryStats, error) {
	var results []model.CategoryStats

	totalHours := endTime.Sub(startTime).Hours()
	startStr := startTime.Format("2006-01-02 15:04:05")
	endStr := endTime.Format("2006-01-02 15:04:05")

	sql := fmt.Sprintf(`
		SELECT 
			e.category as category,
			COUNT(DISTINCT e.id) as count,
			COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, $1::timestamp) - GREATEST(b.start_time, $2::timestamp))) / 3600), 0) as booked_hours,
			CASE 
				WHEN COUNT(DISTINCT e.id) > 0 AND %f > 0 THEN 
					COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, $1::timestamp) - GREATEST(b.start_time, $2::timestamp))) / 3600), 0) / (COUNT(DISTINCT e.id) * %f) * 100 
				ELSE 0 
			END as utilization_rate
		FROM equipment e
		LEFT JOIN bookings b ON e.id = b.equipment_id 
			AND b.status = 'confirmed'
			AND b.start_time < $1::timestamp 
			AND b.end_time > $2::timestamp
		WHERE 1=1
	`, totalHours, totalHours)

	args := []interface{}{endStr, startStr}

	if centerID != nil && *centerID > 0 {
		sql += " AND e.center_id = $" + strconv.Itoa(len(args)+1)
		args = append(args, *centerID)
	}

	sql += " GROUP BY e.category ORDER BY utilization_rate DESC"

	err := r.db.WithContext(ctx).Raw(sql, args...).Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetUtilizationByTimeDimension(ctx context.Context, startTime, endTime time.Time, dimension string, centerID *uint64) ([]model.UtilizationStats, error) {
	var results []model.UtilizationStats

	var dateTrunc string
	switch dimension {
	case "day":
		dateTrunc = "day"
	case "week":
		dateTrunc = "week"
	case "month":
		dateTrunc = "month"
	default:
		dateTrunc = "day"
	}

	selectSQL := fmt.Sprintf(`
		e.id as equipment_id,
		e.name as equipment_name,
		e.center_id as center_id,
		c.name as center_name,
		e.category as category,
		24 as total_hours,
		COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, date_trunc(%s, b.start_time) + interval '1 %s') - GREATEST(b.start_time, date_trunc(%s, b.start_time)))) / 3600), 0) as booked_hours,
		CASE 
			WHEN 24 > 0 THEN COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, date_trunc(%s, b.start_time) + interval '1 %s') - GREATEST(b.start_time, date_trunc(%s, b.start_time)))) / 3600), 0) / 24 * 100 
			ELSE 0 
		END as utilization_rate,
		TO_CHAR(date_trunc(%s, b.start_time), 'YYYY-MM-DD') as period
	`, dateTrunc, dimension, dateTrunc, dateTrunc, dimension, dateTrunc, dateTrunc)

	groupSQL := fmt.Sprintf("e.id, e.name, e.center_id, c.name, e.category, date_trunc(%s, b.start_time)", dateTrunc)

	query := r.db.WithContext(ctx).
		Table("bookings b").
		Select(selectSQL).
		Joins("JOIN equipment e ON b.equipment_id = e.id").
		Joins("LEFT JOIN centers c ON e.center_id = c.id").
		Where("b.status = 'confirmed'").
		Where("b.start_time >= ? AND b.start_time < ?", startTime, endTime)

	if centerID != nil && *centerID > 0 {
		query = query.Where("e.center_id = ?", *centerID)
	}

	err := query.
		Group(groupSQL).
		Order("period ASC, utilization_rate DESC").
		Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetPeakValleyStats(ctx context.Context, startTime, endTime time.Time) ([]model.PeakValleyStats, error) {
	var results []model.PeakValleyStats

	err := r.db.WithContext(ctx).
		Table("bookings b").
		Select(`
			EXTRACT(HOUR FROM b.start_time) as hour,
			COUNT(*) as booking_count
		`).
		Where("b.status = 'confirmed'").
		Where("b.start_time >= ? AND b.start_time < ?", startTime, endTime).
		Group("EXTRACT(HOUR FROM b.start_time)").
		Order("hour ASC").
		Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetTrendStats(ctx context.Context, days int) ([]model.TrendStats, error) {
	var results []model.TrendStats

	startDate := time.Now().AddDate(0, 0, -days+1)
	endDate := time.Now().AddDate(0, 0, 1)
	totalEquipmentCount := int64(0)

	if err := r.db.WithContext(ctx).Model(&model.Equipment{}).Count(&totalEquipmentCount).Error; err != nil {
		return nil, err
	}

	err := r.db.WithContext(ctx).
		Table("bookings b").
		Select(`
			TO_CHAR(date_trunc('day', b.start_time), 'YYYY-MM-DD') as date,
			COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, date_trunc('day', b.start_time) + interval '1 day') - GREATEST(b.start_time, date_trunc('day', b.start_time)))) / 3600), 0) as booked_hours,
			CASE 
				WHEN ? > 0 THEN COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, date_trunc('day', b.start_time) + interval '1 day') - GREATEST(b.start_time, date_trunc('day', b.start_time)))) / 3600), 0) / (? * 24) * 100 
				ELSE 0 
			END as utilization_rate
		`, totalEquipmentCount, totalEquipmentCount).
		Where("b.status = 'confirmed'").
		Where("b.start_time >= ? AND b.start_time < ?", startDate, endDate).
		Group("date_trunc('day', b.start_time)").
		Order("date ASC").
		Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetEquipmentRanking(ctx context.Context, startTime, endTime time.Time, limit int) ([]model.EquipmentRankingItem, error) {
	var results []model.EquipmentRankingItem

	totalHours := endTime.Sub(startTime).Hours()

	err := r.db.WithContext(ctx).
		Table("equipment e").
		Select(`
			e.id as equipment_id,
			e.name as equipment_name,
			c.name as center_name,
			e.category as category,
			COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, ?) - GREATEST(b.start_time, ?))) / 3600), 0) as booked_hours,
			CASE 
				WHEN ? > 0 THEN COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, ?) - GREATEST(b.start_time, ?))) / 3600), 0) / ? * 100 
				ELSE 0 
			END as utilization_rate,
			ROW_NUMBER() OVER (ORDER BY (CASE 
				WHEN ? > 0 THEN COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, ?) - GREATEST(b.start_time, ?))) / 3600), 0) / ? * 100 
				ELSE 0 
			END) DESC) as rank
		`, endTime, startTime, totalHours, endTime, startTime, totalHours, totalHours, endTime, startTime, totalHours).
		Joins("LEFT JOIN centers c ON e.center_id = c.id").
		Joins(`LEFT JOIN bookings b ON e.id = b.equipment_id 
			AND b.status = 'confirmed'
			AND b.start_time < ? 
			AND b.end_time > ?`, endTime, startTime).
		Group("e.id, e.name, c.name, e.category").
		Order("rank ASC").
		Limit(limit).
		Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetCenterDetailStats(ctx context.Context, startTime, endTime time.Time) ([]model.CenterDetailStats, error) {
	var results []model.CenterDetailStats

	totalHours := endTime.Sub(startTime).Hours()

	err := r.db.WithContext(ctx).
		Table("equipment e").
		Select(`
			c.id as center_id,
			c.name as center_name,
			COUNT(DISTINCT e.id) as equipment_count,
			COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, ?) - GREATEST(b.start_time, ?))) / 3600), 0) as total_booked_hours,
			CASE 
				WHEN COUNT(DISTINCT e.id) > 0 AND ? > 0 THEN 
					COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, ?) - GREATEST(b.start_time, ?))) / 3600), 0) / (COUNT(DISTINCT e.id) * ?) * 100 
				ELSE 0 
			END as avg_utilization
		`, endTime, startTime, totalHours, endTime, startTime, totalHours).
		Joins("LEFT JOIN centers c ON e.center_id = c.id").
		Joins(`LEFT JOIN bookings b ON e.id = b.equipment_id 
			AND b.status = 'confirmed'
			AND b.start_time < ? 
			AND b.end_time > ?`, endTime, startTime).
		Group("c.id, c.name").
		Order("avg_utilization DESC").
		Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetDashboardStats(ctx context.Context) (*model.DashboardStats, error) {
	var stats model.DashboardStats

	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.AddDate(0, 0, 1)
	monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.Local)
	nextMonth := monthStart.AddDate(0, 1, 0)

	if err := r.db.WithContext(ctx).Model(&model.Equipment{}).Count(&stats.TotalEquipment).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).Model(&model.Booking{}).
		Where("start_time >= ? AND start_time < ?", today, tomorrow).
		Where("status = 'confirmed'").
		Count(&stats.TodayBookings).Error; err != nil {
		return nil, err
	}

	var totalEquipment int64
	if err := r.db.WithContext(ctx).Model(&model.Equipment{}).Count(&totalEquipment).Error; err != nil {
		return nil, err
	}

	totalHours := nextMonth.Sub(monthStart).Hours()
	var bookedHours float64

	err := r.db.WithContext(ctx).
		Table("bookings b").
		Select(`COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_time, ?) - GREATEST(b.start_time, ?))) / 3600), 0)`, nextMonth, monthStart).
		Where("b.status = 'confirmed'").
		Where("b.start_time < ? AND b.end_time > ?", nextMonth, monthStart).
		Scan(&bookedHours).Error

	if err != nil {
		return nil, err
	}

	if totalEquipment > 0 && totalHours > 0 {
		stats.MonthlyUtilization = bookedHours / (float64(totalEquipment) * totalHours) * 100
	}

	var pendingBookings int64
	if err := r.db.WithContext(ctx).Model(&model.Booking{}).
		Where("status = ?", "pending").
		Count(&pendingBookings).Error; err != nil {
		return nil, err
	}

	var pendingMaintenance int64
	if err := r.db.WithContext(ctx).Model(&model.Maintenance{}).
		Where("status = ?", "scheduled").
		Count(&pendingMaintenance).Error; err != nil {
		return nil, err
	}

	stats.PendingCount = pendingBookings + pendingMaintenance

	return &stats, nil
}

type NotificationRepository interface {
	Repository[model.Notification]
	ListByUser(ctx context.Context, userID uint64, isRead *bool, pagination *model.PaginationParams) (*model.PaginatedResult[model.Notification], error)
	CountUnread(ctx context.Context, userID uint64) (*model.UnreadNotificationStats, error)
	MarkAllAsRead(ctx context.Context, userID uint64) error
	MarkAsRead(ctx context.Context, userID, notificationID uint64) error
}

type notificationRepository struct {
	*BaseRepository[model.Notification]
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{
		BaseRepository: NewBaseRepository[model.Notification](db),
		db:             db,
	}
}

func (r *notificationRepository) ListByUser(ctx context.Context, userID uint64, isRead *bool, pagination *model.PaginationParams) (*model.PaginatedResult[model.Notification], error) {
	var items []model.Notification
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ?", userID)

	if isRead != nil {
		query = query.Where("is_read = ?", *isRead)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Notification]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *notificationRepository) CountUnread(ctx context.Context, userID uint64) (*model.UnreadNotificationStats, error) {
	var stats model.UnreadNotificationStats
	stats.UserID = userID

	err := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&stats.UnreadCount).Error
	if err != nil {
		return nil, err
	}

	err = r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ? AND type LIKE ?", userID, false, "%booking%").
		Count(&stats.BookingCount).Error
	if err != nil {
		return nil, err
	}

	err = r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ? AND type LIKE ?", userID, false, "%maintenance%").
		Count(&stats.MaintenanceCount).Error
	if err != nil {
		return nil, err
	}

	err = r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ? AND type LIKE ?", userID, false, "%billing%").
		Count(&stats.BillingCount).Error
	if err != nil {
		return nil, err
	}

	return &stats, nil
}

func (r *notificationRepository) MarkAllAsRead(ctx context.Context, userID uint64) error {
	return r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error
}

func (r *notificationRepository) MarkAsRead(ctx context.Context, userID, notificationID uint64) error {
	return r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", notificationID, userID).
		Update("is_read", true).Error
}

type AuditLogRepository interface {
	Repository[model.AuditLog]
	List(ctx context.Context, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error)
	ListByUser(ctx context.Context, userID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error)
	ListByTable(ctx context.Context, tableName string, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error)
	ListByAction(ctx context.Context, action string, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error)
	ListWithFilter(ctx context.Context, userID *uint64, tableName, action *string, startDate, endDate *time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error)
	GetByIDWithDetails(ctx context.Context, id uint64) (*model.AuditLog, error)
}

type auditLogRepository struct {
	*BaseRepository[model.AuditLog]
	db *gorm.DB
}

func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &auditLogRepository{
		BaseRepository: NewBaseRepository[model.AuditLog](db),
		db:             db,
	}
}

func (r *auditLogRepository) List(ctx context.Context, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error) {
	var items []model.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&model.AuditLog{}).Preload("User")

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.AuditLog]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *auditLogRepository) ListByUser(ctx context.Context, userID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error) {
	var items []model.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&model.AuditLog{}).
		Preload("User").
		Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.AuditLog]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *auditLogRepository) ListByTable(ctx context.Context, tableName string, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error) {
	var items []model.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&model.AuditLog{}).
		Preload("User").
		Where("table_name = ?", tableName)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.AuditLog]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *auditLogRepository) ListByAction(ctx context.Context, action string, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error) {
	var items []model.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&model.AuditLog{}).
		Preload("User").
		Where("action = ?", action)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.AuditLog]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *auditLogRepository) ListWithFilter(ctx context.Context, userID *uint64, tableName, action *string, startDate, endDate *time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error) {
	var items []model.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&model.AuditLog{}).Preload("User")

	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if tableName != nil {
		query = query.Where("table_name = ?", *tableName)
	}
	if action != nil {
		query = query.Where("action = ?", *action)
	}
	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("created_at <= ?", *endDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.AuditLog]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

func (r *auditLogRepository) GetByIDWithDetails(ctx context.Context, id uint64) (*model.AuditLog, error) {
	var auditLog model.AuditLog
	err := r.db.WithContext(ctx).Preload("User").First(&auditLog, id).Error
	if err != nil {
		return nil, err
	}
	return &auditLog, nil
}

type UserRepository interface {
	Repository[model.User]
	GetByUsername(ctx context.Context, username string) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	GetByIDWithDetails(ctx context.Context, id uint64) (*model.User, error)
	List(ctx context.Context, pagination *model.PaginationParams) (*model.PaginatedResult[model.User], error)
}

type userRepository struct {
	*BaseRepository[model.User]
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{
		BaseRepository: NewBaseRepository[model.User](db),
		db:             db,
	}
}

func (r *userRepository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Center").
		Where("username = ?", username).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Center").
		Where("email = ?", email).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetByIDWithDetails(ctx context.Context, id uint64) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Center").
		Preload("Advisor").
		First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) List(ctx context.Context, pagination *model.PaginationParams) (*model.PaginatedResult[model.User], error) {
	var items []model.User
	var total int64

	query := r.db.WithContext(ctx).Model(&model.User{}).
		Preload("Role").
		Preload("Center")

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.User]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

type CenterRepository interface {
	Repository[model.Center]
	ListAll(ctx context.Context) ([]model.Center, error)
}

type centerRepository struct {
	*BaseRepository[model.Center]
	db *gorm.DB
}

func NewCenterRepository(db *gorm.DB) CenterRepository {
	return &centerRepository{
		BaseRepository: NewBaseRepository[model.Center](db),
		db:             db,
	}
}

func (r *centerRepository) ListAll(ctx context.Context) ([]model.Center, error) {
	var centers []model.Center
	err := r.db.WithContext(ctx).Order("name ASC").Find(&centers).Error
	return centers, err
}

type RoleRepository interface {
	Repository[model.Role]
	ListAll(ctx context.Context) ([]model.Role, error)
	GetByName(ctx context.Context, name string) (*model.Role, error)
}

type EquipmentLogRepository interface {
	Repository[model.EquipmentLog]
	ListByEquipment(ctx context.Context, equipmentID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.EquipmentLog], error)
}

type roleRepository struct {
	*BaseRepository[model.Role]
	db *gorm.DB
}

func NewRoleRepository(db *gorm.DB) RoleRepository {
	return &roleRepository{
		BaseRepository: NewBaseRepository[model.Role](db),
		db:             db,
	}
}

func (r *roleRepository) ListAll(ctx context.Context) ([]model.Role, error) {
	var roles []model.Role
	err := r.db.WithContext(ctx).Order("name ASC").Find(&roles).Error
	return roles, err
}

func (r *roleRepository) GetByName(ctx context.Context, name string) (*model.Role, error) {
	var role model.Role
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

type equipmentLogRepository struct {
	*BaseRepository[model.EquipmentLog]
	db *gorm.DB
}

func NewEquipmentLogRepository(db *gorm.DB) EquipmentLogRepository {
	return &equipmentLogRepository{
		BaseRepository: NewBaseRepository[model.EquipmentLog](db),
		db:             db,
	}
}

func (r *equipmentLogRepository) ListByEquipment(ctx context.Context, equipmentID uint64, pagination *model.PaginationParams) (*model.PaginatedResult[model.EquipmentLog], error) {
	var items []model.EquipmentLog
	var total int64

	query := r.db.WithContext(ctx).Model(&model.EquipmentLog{}).
		Preload("Equipment").
		Preload("Operator").
		Where("equipment_id = ?", equipmentID)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if pagination != nil {
		query = query.Offset(pagination.GetOffset()).Limit(pagination.GetLimit())
	}

	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.EquipmentLog]{
		Items:    items,
		Total:    total,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
	}, nil
}

type Repositories struct {
	Equipment     EquipmentRepository
	Booking       BookingRepository
	Waitlist      WaitlistRepository
	Billing       BillingRepository
	Maintenance   MaintenanceRepository
	Stats         StatsRepository
	Notification  NotificationRepository
	AuditLog      AuditLogRepository
	EquipmentLog  EquipmentLogRepository
	User          UserRepository
	Center        CenterRepository
	Role          RoleRepository
}

func NewRepositories(db *gorm.DB) *Repositories {
	return &Repositories{
		Equipment:     NewEquipmentRepository(db),
		Booking:       NewBookingRepository(db),
		Waitlist:      NewWaitlistRepository(db),
		Billing:       NewBillingRepository(db),
		Maintenance:   NewMaintenanceRepository(db),
		Stats:         NewStatsRepository(db),
		Notification:  NewNotificationRepository(db),
		AuditLog:      NewAuditLogRepository(db),
		EquipmentLog:  NewEquipmentLogRepository(db),
		User:          NewUserRepository(db),
		Center:        NewCenterRepository(db),
		Role:          NewRoleRepository(db),
	}
}
