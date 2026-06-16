package spareparts

import (
	"context"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"

	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	spRepo    *repository.SparePartsRepository
	alertRepo *repository.AlertRepository
}

func NewService(spRepo *repository.SparePartsRepository, alertRepo *repository.AlertRepository) *Service {
	return &Service{
		spRepo:    spRepo,
		alertRepo: alertRepo,
	}
}

func (s *Service) CreatePart(ctx context.Context, part *model.SparePart) (*model.SparePart, error) {
	err := s.spRepo.CreatePart(ctx, part)
	return part, err
}

func (s *Service) GetPart(ctx context.Context, id string) (*model.SparePart, error) {
	return s.spRepo.GetPart(ctx, id)
}

func (s *Service) ListParts(ctx context.Context, category string, page, pageSize int) ([]model.SparePart, int64, error) {
	filter := bson.M{}
	if category != "" {
		filter["category"] = category
	}
	return s.spRepo.ListParts(ctx, filter, page, pageSize)
}

func (s *Service) UpdatePart(ctx context.Context, part *model.SparePart) error {
	return s.spRepo.UpdatePart(ctx, part)
}

func (s *Service) CreateWarehouse(ctx context.Context, wh *model.Warehouse) (*model.Warehouse, error) {
	err := s.spRepo.CreateWarehouse(ctx, wh)
	return wh, err
}

func (s *Service) ListWarehouses(ctx context.Context, windFarmID string) ([]model.Warehouse, error) {
	filter := bson.M{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}
	return s.spRepo.ListWarehouses(ctx, filter)
}

func (s *Service) GetInventory(ctx context.Context, warehouseID string, page, pageSize int) ([]model.SparePartInventory, int64, error) {
	filter := bson.M{}
	if warehouseID != "" {
		filter["warehouse_id"] = warehouseID
	}
	return s.spRepo.ListInventory(ctx, filter, page, pageSize)
}

func (s *Service) UpdateStock(ctx context.Context, partID, warehouseID string, quantity int, note string) error {
	inv, err := s.spRepo.GetInventory(ctx, partID, warehouseID)
	if err != nil {
		part, err := s.spRepo.GetPart(ctx, partID)
		if err != nil {
			return err
		}
		inv = &model.SparePartInventory{
			PartID:     partID,
			PartNo:     part.PartNo,
			PartName:   part.Name,
			WarehouseID: warehouseID,
			Quantity:   quantity,
			Status:     "active",
		}
		return s.spRepo.UpsertInventory(ctx, inv)
	}

	inv.Quantity += quantity
	if inv.Quantity < 0 {
		return errors.New("insufficient stock")
	}

	if err := s.spRepo.UpsertInventory(ctx, inv); err != nil {
		return err
	}

	part, _ := s.spRepo.GetPart(ctx, partID)
	if part != nil && inv.AvailableQty < part.SafetyStock {
		alert := &model.InventoryAlert{
			Type:        "low_stock",
			PartID:      partID,
			PartName:    part.Name,
			WarehouseID: warehouseID,
			CurrentQty:  inv.AvailableQty,
			SafetyStock: part.SafetyStock,
			Status:      "active",
		}
		_ = s.spRepo.CreateInventoryAlert(ctx, alert)

		generalAlert := &model.Alert{
			Type:       model.AlertTypeInventory,
			Severity:   model.SeverityWarning,
			Title:      "库存低于安全阈值",
			Description: part.Name + " 库存不足，当前: " + fmt.Sprintf("%d", inv.AvailableQty) + ", 安全库存: " + fmt.Sprintf("%d", part.SafetyStock),
			PartID:     partID,
			Source:     "inventory_monitor",
		}
		_ = s.alertRepo.Create(ctx, generalAlert)
	}

	return nil
}

func (s *Service) CreateTransfer(ctx context.Context, req *model.TransferCreateRequest, applicantID string) (*model.TransferOrder, error) {
	if req.SourceWarehouseID == req.TargetWarehouseID {
		return nil, errors.New("source and target warehouse cannot be the same")
	}

	for _, item := range req.Items {
		inv, err := s.spRepo.GetInventory(ctx, item.PartID, req.SourceWarehouseID)
		if err != nil {
			return nil, errors.New("part not found in source warehouse: " + item.PartName)
		}
		if inv.AvailableQty < item.Quantity {
			return nil, errors.New("insufficient available quantity for part: " + item.PartName)
		}
	}

	transfer := &model.TransferOrder{
		Type:              req.Type,
		Status:            "pending_approval",
		SourceWarehouseID: req.SourceWarehouseID,
		TargetWarehouseID: req.TargetWarehouseID,
		Items:             req.Items,
		Reason:            req.Reason,
		ApplicantID:       applicantID,
		WorkOrderID:       req.WorkOrderID,
	}

	if err := s.spRepo.CreateTransfer(ctx, transfer); err != nil {
		return nil, err
	}

	return transfer, nil
}

func (s *Service) ApproveTransfer(ctx context.Context, transferID, approverID string) error {
	transfer, err := s.spRepo.GetTransfer(ctx, transferID)
	if err != nil {
		return err
	}

	if transfer.Status != "pending_approval" {
		return errors.New("transfer is not pending approval")
	}

	for _, item := range transfer.Items {
		inv, err := s.spRepo.GetInventory(ctx, item.PartID, transfer.SourceWarehouseID)
		if err != nil {
			return err
		}
		if inv.AvailableQty < item.Quantity {
			return errors.New("insufficient stock for part: " + item.PartName)
		}

		if err := s.spRepo.UpdateInventoryQty(ctx, item.PartID, transfer.SourceWarehouseID, 0, item.Quantity); err != nil {
			return err
		}
	}

	return s.spRepo.UpdateTransferStatus(ctx, transferID, "approved", approverID)
}

func (s *Service) DispatchTransfer(ctx context.Context, transferID string) error {
	transfer, err := s.spRepo.GetTransfer(ctx, transferID)
	if err != nil {
		return err
	}

	if transfer.Status != "approved" {
		return errors.New("transfer is not approved")
	}

	for _, item := range transfer.Items {
		if err := s.spRepo.UpdateInventoryQty(ctx, item.PartID, transfer.SourceWarehouseID, -item.Quantity, -item.Quantity); err != nil {
			return err
		}
	}

	return s.spRepo.UpdateTransferStatus(ctx, transferID, "dispatched", "")
}

func (s *Service) ReceiveTransfer(ctx context.Context, transferID string) error {
	transfer, err := s.spRepo.GetTransfer(ctx, transferID)
	if err != nil {
		return err
	}

	if transfer.Status != "dispatched" {
		return errors.New("transfer is not dispatched")
	}

	for _, item := range transfer.Items {
		if err := s.spRepo.UpdateInventoryQty(ctx, item.PartID, transfer.TargetWarehouseID, item.Quantity, 0); err != nil {
			return err
		}
	}

	return s.spRepo.UpdateTransferStatus(ctx, transferID, "received", "")
}

func (s *Service) RejectTransfer(ctx context.Context, transferID, approverID, reason string) error {
	transfer, err := s.spRepo.GetTransfer(ctx, transferID)
	if err != nil {
		return err
	}

	if transfer.Status != "pending_approval" && transfer.Status != "approved" {
		return errors.New("transfer is not in a rejectable status")
	}

	if transfer.Status == "approved" {
		for _, item := range transfer.Items {
			if err := s.spRepo.UpdateInventoryQty(ctx, item.PartID, transfer.SourceWarehouseID, 0, -item.Quantity); err != nil {
				return err
			}
		}
	}

	return s.spRepo.UpdateTransferStatus(ctx, transferID, "rejected", approverID)
}

func (s *Service) GetTransfer(ctx context.Context, id string) (*model.TransferOrder, error) {
	return s.spRepo.GetTransfer(ctx, id)
}

func (s *Service) ListTransfers(ctx context.Context, status, warehouseID string, page, pageSize int) ([]model.TransferOrder, int64, error) {
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}
	if warehouseID != "" {
		filter["$or"] = []bson.M{
			{"source_warehouse_id": warehouseID},
			{"target_warehouse_id": warehouseID},
		}
	}
	return s.spRepo.ListTransfers(ctx, filter, page, pageSize)
}

func (s *Service) CreateRestockOrder(ctx context.Context, order *model.RestockOrder, applicantID string) (*model.RestockOrder, error) {
	order.Status = "pending_approval"
	order.ApplicantID = applicantID

	var total float64
	for _, item := range order.Items {
		total += item.UnitPrice * float64(item.Quantity)
	}
	order.TotalAmount = total

	err := s.spRepo.CreateRestockOrder(ctx, order)
	return order, err
}

func (s *Service) CheckLowStock(ctx context.Context, warehouseID string) ([]model.SparePartInventory, error) {
	return s.spRepo.GetLowStockItems(ctx, warehouseID)
}

func (s *Service) ConsumeParts(ctx context.Context, workOrderID, warehouseID string, parts []model.SparePartUsage) error {
	for _, p := range parts {
		inv, err := s.spRepo.GetInventory(ctx, p.PartID, warehouseID)
		if err != nil {
			return err
		}
		if inv.AvailableQty < p.Quantity {
			return errors.New("insufficient stock for part: " + p.PartName)
		}

		if err := s.spRepo.UpdateInventoryQty(ctx, p.PartID, warehouseID, -p.Quantity, 0); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) CheckAndGenerateRestockAlerts(ctx context.Context, warehouseID string) (int, error) {
	lowStockItems, err := s.spRepo.GetLowStockItems(ctx, warehouseID)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, item := range lowStockItems {
		part, err := s.spRepo.GetPart(ctx, item.PartID)
		if err != nil {
			continue
		}

		alert := &model.Alert{
			Type:       model.AlertTypeInventory,
			Severity:   model.SeverityWarning,
			Title:      "库存预警 - " + item.PartName,
			Description: "当前库存 " + fmt.Sprintf("%d", item.AvailableQty) + " 低于安全库存 " + fmt.Sprintf("%d", part.SafetyStock),
			PartID:     item.PartID,
			Source:     "auto_check",
		}
		if err := s.alertRepo.Create(ctx, alert); err == nil {
			count++
		}
	}

	return count, nil
}
