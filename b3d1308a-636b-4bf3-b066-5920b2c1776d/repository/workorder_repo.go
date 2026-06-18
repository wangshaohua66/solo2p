package repository

import (
	"context"
	"time"

	"smart-lighting-api/model"

	"gorm.io/gorm"
)

type WorkOrderRepo struct {
	db *gorm.DB
}

func NewWorkOrderRepo(db *gorm.DB) *WorkOrderRepo {
	return &WorkOrderRepo{db: db}
}

type WorkOrderQueryParams struct {
	AreaID     int64
	DeviceID   int64
	FaultID    int64
	Status     string
	Priority   string
	AssigneeID int64
	CreatorID  int64
	StartDate  time.Time
	EndDate    time.Time
	Keyword    string
	Page       int
	PageSize   int
	Sort       string
}

func (r *WorkOrderRepo) Create(ctx context.Context, order *model.WorkOrder) error {
	return r.db.WithContext(ctx).Create(order).Error
}

func (r *WorkOrderRepo) Update(ctx context.Context, order *model.WorkOrder) error {
	return r.db.WithContext(ctx).Save(order).Error
}

func (r *WorkOrderRepo) GetByID(ctx context.Context, id int64) (*model.WorkOrder, error) {
	var order model.WorkOrder
	err := r.db.WithContext(ctx).First(&order, id).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *WorkOrderRepo) GetByCode(ctx context.Context, code string) (*model.WorkOrder, error) {
	var order model.WorkOrder
	err := r.db.WithContext(ctx).Where("order_code = ?", code).First(&order).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *WorkOrderRepo) List(ctx context.Context, params *WorkOrderQueryParams, areaIDs []int64) ([]*model.WorkOrder, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.WorkOrder{})

	if params.AreaID > 0 {
		query = query.Where("area_id = ?", params.AreaID)
	} else if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	if params.DeviceID > 0 {
		query = query.Where("device_id = ?", params.DeviceID)
	}
	if params.FaultID > 0 {
		query = query.Where("fault_id = ?", params.FaultID)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if params.Priority != "" {
		query = query.Where("priority = ?", params.Priority)
	}
	if params.AssigneeID > 0 {
		query = query.Where("assignee_id = ?", params.AssigneeID)
	}
	if params.CreatorID > 0 {
		query = query.Where("creator_id = ?", params.CreatorID)
	}
	if !params.StartDate.IsZero() {
		query = query.Where("created_at >= ?", params.StartDate)
	}
	if !params.EndDate.IsZero() {
		query = query.Where("created_at <= ?", params.EndDate)
	}
	if params.Keyword != "" {
		query = query.Where("(title LIKE ? OR order_code LIKE ? OR description LIKE ?)",
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

	sort := params.Sort
	if sort == "" {
		sort = "created_at DESC"
	}

	var list []*model.WorkOrder
	err := query.Order(sort).Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *WorkOrderRepo) AddLog(ctx context.Context, log *model.WorkOrderLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *WorkOrderRepo) GetLogs(ctx context.Context, orderID int64) ([]*model.WorkOrderLog, error) {
	var logs []*model.WorkOrderLog
	err := r.db.WithContext(ctx).Where("work_order_id = ?", orderID).Order("created_at ASC").Find(&logs).Error
	return logs, err
}

func (r *WorkOrderRepo) CountByStatus(ctx context.Context, status string, areaIDs []int64) (int64, error) {
	query := r.db.WithContext(ctx).Model(&model.WorkOrder{}).Where("status = ?", status)
	if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

func (r *WorkOrderRepo) CountByAssignee(ctx context.Context, assigneeID int64, status string) (int64, error) {
	query := r.db.WithContext(ctx).Model(&model.WorkOrder{}).Where("assignee_id = ?", assigneeID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

func (r *WorkOrderRepo) GetMyOrders(ctx context.Context, assigneeID int64, status string, page, pageSize int) ([]*model.WorkOrder, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.WorkOrder{}).Where("assignee_id = ?", assigneeID)
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
	var list []*model.WorkOrder
	err := query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *WorkOrderRepo) GetLeastBusyOperator(ctx context.Context, areaID int64, role string) (int64, int64, error) {
	type result struct {
		UserID int64 `gorm:"column:user_id"`
		Count  int64 `gorm:"column:count"`
	}
	var results []result
	err := r.db.WithContext(ctx).Raw(`
		SELECT u.id as user_id, COUNT(wo.id) as count 
		FROM users u 
		LEFT JOIN work_orders wo ON u.id = wo.assignee_id AND wo.status IN ('created', 'accepted', 'processing') 
		WHERE u.role = ? AND u.status = 1 AND (? = 0 OR u.area_id = ?)
		GROUP BY u.id 
		ORDER BY count ASC 
		LIMIT 1
	`, role, areaID, areaID).Scan(&results).Error
	if err != nil {
		return 0, 0, err
	}
	if len(results) > 0 {
		return results[0].UserID, results[0].Count, nil
	}
	return 0, 0, nil
}

func (r *WorkOrderRepo) GetStatistics(ctx context.Context, areaIDs []int64, start, end time.Time) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	query := r.db.WithContext(ctx).Model(&model.WorkOrder{})
	if len(areaIDs) > 0 {
		query = query.Where("area_id IN ?", areaIDs)
	}
	if !start.IsZero() {
		query = query.Where("created_at >= ?", start)
	}
	if !end.IsZero() {
		query = query.Where("created_at <= ?", end)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}
	stats["total"] = total

	statuses := []string{
		model.WorkOrderStatusCreated,
		model.WorkOrderStatusAccepted,
		model.WorkOrderStatusProcessing,
		model.WorkOrderStatusReviewing,
		model.WorkOrderStatusCompleted,
	}
	statusCounts := make(map[string]int64)
	for _, s := range statuses {
		var c int64
		tmpQ := r.db.WithContext(ctx).Model(&model.WorkOrder{})
		if len(areaIDs) > 0 {
			tmpQ = tmpQ.Where("area_id IN ?", areaIDs)
		}
		if !start.IsZero() {
			tmpQ = tmpQ.Where("created_at >= ?", start)
		}
		if !end.IsZero() {
			tmpQ = tmpQ.Where("created_at <= ?", end)
		}
		_ = tmpQ.Where("status = ?", s).Count(&c).Error
		statusCounts[s] = c
	}
	stats["by_status"] = statusCounts

	var avgResponse, avgHandle float64
	if total > 0 {
		tmpQ := r.db.WithContext(ctx).Model(&model.WorkOrder{})
		if len(areaIDs) > 0 {
			tmpQ = tmpQ.Where("area_id IN ?", areaIDs)
		}
		if !start.IsZero() {
			tmpQ = tmpQ.Where("created_at >= ?", start)
		}
		if !end.IsZero() {
			tmpQ = tmpQ.Where("created_at <= ?", end)
		}
		_ = tmpQ.Select("AVG(response_time)").Scan(&avgResponse).Error
		_ = tmpQ.Select("AVG(handle_time)").Scan(&avgHandle).Error
	}
	stats["avg_response_time"] = avgResponse
	stats["avg_handle_time"] = avgHandle

	return stats, nil
}
