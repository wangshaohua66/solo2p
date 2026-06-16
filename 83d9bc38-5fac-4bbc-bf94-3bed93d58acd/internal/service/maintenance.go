package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
)

type maintenanceService struct {
	repos               *repository.Repositories
	bookingService      BookingService
	notificationService NotificationService
	auditLogService     AuditLogService
}

func NewMaintenanceService(
	repos *repository.Repositories,
	bookingService BookingService,
	notificationService NotificationService,
	auditLogService AuditLogService,
) MaintenanceService {
	return &maintenanceService{
		repos:               repos,
		bookingService:      bookingService,
		notificationService: notificationService,
		auditLogService:     auditLogService,
	}
}

func (s *maintenanceService) CreateMaintenance(ctx context.Context, maintenance *model.Maintenance, operatorID uint64) (*model.Maintenance, error) {
	if maintenance.EndTime.Before(maintenance.StartTime) {
		return nil, ErrInvalidTimeRange
	}

	hasConflict, _, err := s.repos.Maintenance.CheckConflict(ctx, maintenance.EquipmentID, maintenance.StartTime, maintenance.EndTime, nil)
	if err != nil {
		return nil, fmt.Errorf("检查维护计划冲突失败: %w", err)
	}
	if hasConflict {
		return nil, errors.New("该时段已有维护计划")
	}

	maintenance.Status = "scheduled"
	if err := s.repos.Maintenance.Create(ctx, maintenance); err != nil {
		return nil, fmt.Errorf("创建维护计划失败: %w", err)
	}

	equipment, err := s.repos.Equipment.GetByID(ctx, maintenance.EquipmentID)
	if err == nil {
		notificationTitle := "设备维护计划已创建"
		notificationContent := fmt.Sprintf("设备[%s]将于%s至%s进行维护，请合理安排预约时间。",
			equipment.Name,
			maintenance.StartTime.Format("2006-01-02 15:04"),
			maintenance.EndTime.Format("2006-01-02 15:04"),
		)
		_ = s.notificationService.SendNotification(ctx, 0, "maintenance_created", notificationTitle, notificationContent)
	}

	ipAddress := ""
	_ = s.auditLogService.LogAction(ctx, "create_maintenance", "maintenances", &maintenance.ID, nil, maintenance, &operatorID, ipAddress)

	return s.repos.Maintenance.GetByIDWithDetails(ctx, maintenance.ID)
}

func (s *maintenanceService) CompleteMaintenance(ctx context.Context, maintenanceID uint64, operatorID uint64, remark string) (*model.Maintenance, error) {
	maintenance, err := s.repos.Maintenance.GetByID(ctx, maintenanceID)
	if err != nil {
		return nil, errors.New("维护计划不存在")
	}

	if maintenance.Status == "completed" {
		return nil, errors.New("该维护计划已完成")
	}
	if maintenance.Status == "cancelled" {
		return nil, errors.New("该维护计划已取消")
	}

	oldMaintenance := *maintenance

	maintenance.Status = "completed"
	maintenance.Remark = remark

	if err := s.repos.Maintenance.Update(ctx, maintenance); err != nil {
		return nil, fmt.Errorf("完成维护计划失败: %w", err)
	}

	go func() {
		_ = s.bookingService.ProcessWaitlist(context.Background(), maintenance.EquipmentID, maintenance.StartTime, maintenance.EndTime, "")
	}()

	equipment, err := s.repos.Equipment.GetByID(ctx, maintenance.EquipmentID)
	if err == nil {
		notificationTitle := "设备维护已完成"
		notificationContent := fmt.Sprintf("设备[%s]维护已完成，现已恢复可用。", equipment.Name)
		_ = s.notificationService.SendNotification(ctx, 0, "maintenance_completed", notificationTitle, notificationContent)
	}

	ipAddress := ""
	_ = s.auditLogService.LogAction(ctx, "complete_maintenance", "maintenances", &maintenanceID, oldMaintenance, maintenance, &operatorID, ipAddress)

	return s.repos.Maintenance.GetByIDWithDetails(ctx, maintenanceID)
}

func (s *maintenanceService) CancelMaintenance(ctx context.Context, maintenanceID uint64, operatorID uint64) (*model.Maintenance, error) {
	maintenance, err := s.repos.Maintenance.GetByID(ctx, maintenanceID)
	if err != nil {
		return nil, errors.New("维护计划不存在")
	}

	if maintenance.Status == "completed" {
		return nil, errors.New("已完成的维护计划无法取消")
	}
	if maintenance.Status == "cancelled" {
		return nil, errors.New("该维护计划已取消")
	}

	oldMaintenance := *maintenance
	maintenance.Status = "cancelled"

	if err := s.repos.Maintenance.Update(ctx, maintenance); err != nil {
		return nil, fmt.Errorf("取消维护计划失败: %w", err)
	}

	equipment, err := s.repos.Equipment.GetByID(ctx, maintenance.EquipmentID)
	if err == nil {
		notificationTitle := "设备维护计划已取消"
		notificationContent := fmt.Sprintf("设备[%s]原定于%s至%s的维护计划已取消，设备已恢复可用。",
			equipment.Name,
			maintenance.StartTime.Format("2006-01-02 15:04"),
			maintenance.EndTime.Format("2006-01-02 15:04"),
		)
		_ = s.notificationService.SendNotification(ctx, 0, "maintenance_cancelled", notificationTitle, notificationContent)
	}

	ipAddress := ""
	_ = s.auditLogService.LogAction(ctx, "cancel_maintenance", "maintenances", &maintenanceID, oldMaintenance, maintenance, &operatorID, ipAddress)

	return s.repos.Maintenance.GetByIDWithDetails(ctx, maintenanceID)
}

func (s *maintenanceService) UpdateMaintenance(ctx context.Context, maintenanceID uint64, updates *model.Maintenance, operatorID uint64) (*model.Maintenance, error) {
	maintenance, err := s.repos.Maintenance.GetByID(ctx, maintenanceID)
	if err != nil {
		return nil, errors.New("维护计划不存在")
	}

	if maintenance.Status == "completed" || maintenance.Status == "cancelled" {
		return nil, errors.New("无法修改已完成或已取消的维护计划")
	}

	oldMaintenance := *maintenance

	if !updates.StartTime.IsZero() && !updates.EndTime.IsZero() {
		hasConflict, _, err := s.repos.Maintenance.CheckConflict(ctx, maintenance.EquipmentID, updates.StartTime, updates.EndTime, &maintenanceID)
		if err != nil {
			return nil, fmt.Errorf("检查维护计划冲突失败: %w", err)
		}
		if hasConflict {
			return nil, errors.New("该时段已有维护计划")
		}
	}

	if err := s.repos.Maintenance.Update(ctx, maintenance); err != nil {
		return nil, fmt.Errorf("更新维护计划失败: %w", err)
	}

	ipAddress := ""
	_ = s.auditLogService.LogAction(ctx, "update_maintenance", "maintenances", &maintenanceID, oldMaintenance, maintenance, &operatorID, ipAddress)

	return s.repos.Maintenance.GetByIDWithDetails(ctx, maintenanceID)
}

func (s *maintenanceService) CheckMaintenanceConflict(ctx context.Context, equipmentID uint64, startTime, endTime time.Time, excludeMaintenanceID *uint64) (bool, []model.Maintenance, error) {
	return s.repos.Maintenance.CheckConflict(ctx, equipmentID, startTime, endTime, excludeMaintenanceID)
}

func (s *maintenanceService) GetMaintenanceList(ctx context.Context, equipmentID *uint64, startTime, endTime *time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.Maintenance], error) {
	if pagination == nil {
		pagination = &model.PaginationParams{Page: 1, PageSize: 10}
	}

	if equipmentID != nil && startTime != nil && endTime != nil {
		return s.repos.Maintenance.ListByEquipmentAndTimeRange(ctx, *equipmentID, *startTime, *endTime, pagination)
	}
	if equipmentID != nil {
		return s.repos.Maintenance.ListByEquipment(ctx, *equipmentID, pagination)
	}
	if startTime != nil && endTime != nil {
		return s.repos.Maintenance.ListByTimeRange(ctx, *startTime, *endTime, pagination)
	}
	return s.repos.Maintenance.List(ctx, pagination)
}
