package service

import (
	"context"
	"encoding/json"
	"time"

	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
	"gorm.io/datatypes"
)

type auditLogService struct {
	auditLogRepo repository.AuditLogRepository
}

func NewAuditLogService(auditLogRepo repository.AuditLogRepository) AuditLogService {
	return &auditLogService{auditLogRepo: auditLogRepo}
}

func (s *auditLogService) LogCreate(ctx context.Context, tableName string, recordID uint64, newValue interface{}, userID *uint64, ipAddress string) error {
	return s.LogAction(ctx, "create", tableName, &recordID, nil, newValue, userID, ipAddress)
}

func (s *auditLogService) LogUpdate(ctx context.Context, tableName string, recordID uint64, oldValue, newValue interface{}, userID *uint64, ipAddress string) error {
	return s.LogAction(ctx, "update", tableName, &recordID, oldValue, newValue, userID, ipAddress)
}

func (s *auditLogService) LogDelete(ctx context.Context, tableName string, recordID uint64, oldValue interface{}, userID *uint64, ipAddress string) error {
	return s.LogAction(ctx, "delete", tableName, &recordID, oldValue, nil, userID, ipAddress)
}

func (s *auditLogService) LogAction(ctx context.Context, action, tableName string, recordID *uint64, oldValue, newValue interface{}, userID *uint64, ipAddress string) error {
	auditLog := &model.AuditLog{
		UserID:    userID,
		Action:    action,
		TableName: tableName,
		RecordID:  recordID,
		IPAddress: ipAddress,
	}

	if oldValue != nil {
		oldJSON, err := json.Marshal(oldValue)
		if err != nil {
			return err
		}
		auditLog.OldValue = datatypes.JSON(oldJSON)
	}

	if newValue != nil {
		newJSON, err := json.Marshal(newValue)
		if err != nil {
			return err
		}
		auditLog.NewValue = datatypes.JSON(newJSON)
	}

	return s.auditLogRepo.Create(ctx, auditLog)
}

func (s *auditLogService) GetAuditLogList(ctx context.Context, userID *uint64, tableName, action *string, startDate, endDate *time.Time, pagination *model.PaginationParams) (*model.PaginatedResult[model.AuditLog], error) {
	return s.auditLogRepo.ListWithFilter(ctx, userID, tableName, action, startDate, endDate, pagination)
}

func (s *auditLogService) GetAuditLogDetail(ctx context.Context, id uint64) (*model.AuditLog, error) {
	return s.auditLogRepo.GetByIDWithDetails(ctx, id)
}
