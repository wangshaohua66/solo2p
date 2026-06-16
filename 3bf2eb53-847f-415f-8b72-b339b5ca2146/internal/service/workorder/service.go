package workorder

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	woRepo      *repository.WorkOrderRepository
	turbineRepo *repository.TurbineRepository
	spareSvc    SparePartsService
}

type SparePartsService interface {
	ConsumeParts(ctx context.Context, workOrderID, warehouseID string, parts []model.SparePartUsage) error
}

func NewService(woRepo *repository.WorkOrderRepository, turbineRepo *repository.TurbineRepository, spareSvc SparePartsService) *Service {
	return &Service{
		woRepo:      woRepo,
		turbineRepo: turbineRepo,
		spareSvc:    spareSvc,
	}
}

func (s *Service) CreateWorkOrder(ctx context.Context, req *model.WorkOrderCreateRequest, createdBy string) (*model.WorkOrder, error) {
	turbine, err := s.turbineRepo.GetTurbine(ctx, req.TurbineID)
	if err != nil {
		return nil, errors.New("turbine not found")
	}

	wo := &model.WorkOrder{
		Type:           req.Type,
		Title:          req.Title,
		Description:    req.Description,
		TurbineID:      req.TurbineID,
		WindFarmID:     turbine.WindFarmID,
		Priority:       req.Priority,
		Status:         model.WOStatusCreated,
		CreatedBy:      createdBy,
		AssignedTo:     req.AssignedTo,
		EstimatedHours: req.EstimatedHours,
		DueDate:        req.DueDate,
		SpareParts:     req.SpareParts,
		Source:         "manual",
	}

	if wo.Priority == "" {
		wo.Priority = "normal"
	}

	err = s.woRepo.Create(ctx, wo)
	return wo, err
}

func (s *Service) GetWorkOrder(ctx context.Context, id string) (*model.WorkOrder, error) {
	return s.woRepo.GetByID(ctx, id)
}

func (s *Service) ListWorkOrders(ctx context.Context, req *model.WorkOrderListRequest) ([]model.WorkOrder, int64, error) {
	filter := bson.M{}

	if req.WindFarmID != "" {
		filter["wind_farm_id"] = req.WindFarmID
	}
	if req.Status != "" {
		filter["status"] = req.Status
	}
	if req.Type != "" {
		filter["type"] = req.Type
	}
	if req.Priority != "" {
		filter["priority"] = req.Priority
	}

	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	return s.woRepo.List(ctx, filter, page, pageSize)
}

func (s *Service) AssignWorkOrder(ctx context.Context, woID, assignee string) error {
	wo, err := s.woRepo.GetByID(ctx, woID)
	if err != nil {
		return err
	}

	if wo.Status != model.WOStatusCreated {
		return errors.New("only created work orders can be assigned")
	}

	wo.AssignedTo = assignee
	wo.Status = model.WOStatusAssigned

	return s.woRepo.Update(ctx, wo)
}

func (s *Service) StartWorkOrder(ctx context.Context, woID, userID string) error {
	wo, err := s.woRepo.GetByID(ctx, woID)
	if err != nil {
		return err
	}

	if wo.Status != model.WOStatusAssigned && wo.Status != model.WOStatusPending {
		return errors.New("work order is not in assignable status")
	}

	now := time.Now()
	wo.Status = model.WOStatusInProgress
	wo.StartTime = &now
	wo.AssignedTo = userID

	return s.woRepo.Update(ctx, wo)
}

func (s *Service) CompleteWorkOrder(ctx context.Context, woID, userID, report string) error {
	wo, err := s.woRepo.GetByID(ctx, woID)
	if err != nil {
		return err
	}

	if wo.Status != model.WOStatusInProgress {
		return errors.New("only in-progress work orders can be completed")
	}

	now := time.Now()
	wo.Status = model.WOStatusCompleted
	wo.CompletedTime = &now

	if wo.StartTime != nil {
		wo.ActualHours = now.Sub(*wo.StartTime).Hours()
	}

	return s.woRepo.Update(ctx, wo)
}

func (s *Service) CloseWorkOrder(ctx context.Context, woID, userID string) error {
	wo, err := s.woRepo.GetByID(ctx, woID)
	if err != nil {
		return err
	}

	if wo.Status != model.WOStatusCompleted {
		return errors.New("only completed work orders can be closed")
	}

	now := time.Now()
	wo.Status = model.WOStatusClosed
	wo.ClosedTime = &now

	return s.woRepo.Update(ctx, wo)
}

func (s *Service) SubmitInspectionReport(ctx context.Context, woID, reporterID string, report *model.InspectionReport) error {
	wo, err := s.woRepo.GetByID(ctx, woID)
	if err != nil {
		return err
	}

	report.WorkOrderID = woID
	report.ReporterID = reporterID
	report.ReportTime = time.Now()

	if err := s.woRepo.CreateInspectionReport(ctx, report); err != nil {
		return err
	}

	wo.InspectionReport = report
	return s.woRepo.Update(ctx, wo)
}

func (s *Service) AddSparePartUsage(ctx context.Context, woID, warehouseID string, usage model.SparePartUsage) error {
	wo, err := s.woRepo.GetByID(ctx, woID)
	if err != nil {
		return err
	}

	if wo.Status != model.WOStatusInProgress {
		return errors.New("can only add parts to in-progress work orders")
	}

	if s.spareSvc != nil {
		if err := s.spareSvc.ConsumeParts(ctx, woID, warehouseID, []model.SparePartUsage{usage}); err != nil {
			return err
		}
	}

	return s.woRepo.AddSparePartUsage(ctx, woID, usage)
}

func (s *Service) UpdateWorkOrderStatus(ctx context.Context, id string, status model.WorkOrderStatus, note string) error {
	return s.woRepo.UpdateStatus(ctx, id, status, note)
}

func (s *Service) GetWorkOrdersByTurbine(ctx context.Context, turbineID string, status string, limit int) ([]model.WorkOrder, error) {
	filter := bson.M{"turbine_id": turbineID}
	if status != "" {
		filter["status"] = status
	}

	list, _, err := s.woRepo.List(ctx, filter, 1, limit)
	return list, err
}

func (s *Service) GetOpenWorkOrdersCount(ctx context.Context, windFarmID string) (int, error) {
	filter := bson.M{
		"status": bson.M{
			"$in": []model.WorkOrderStatus{
				model.WOStatusCreated,
				model.WOStatusAssigned,
				model.WOStatusInProgress,
				model.WOStatusPending,
			},
		},
	}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}

	_, total, err := s.woRepo.List(ctx, filter, 1, 1)
	return int(total), err
}
