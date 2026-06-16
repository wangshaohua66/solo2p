package voyage

import (
	"context"
	"errors"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	voyageRepo    *repository.VoyageRepository
	personnelRepo *repository.PersonnelRepository
	weatherSvc    WeatherService
}

type WeatherService interface {
	CheckVoyageFeasibility(ctx context.Context, voyage *model.Voyage, ship *model.Ship) (bool, []model.WeatherWindow, error)
}

func NewService(voyageRepo *repository.VoyageRepository, personnelRepo *repository.PersonnelRepository, weatherSvc WeatherService) *Service {
	return &Service{
		voyageRepo:    voyageRepo,
		personnelRepo: personnelRepo,
		weatherSvc:    weatherSvc,
	}
}

func (s *Service) CreateVoyage(ctx context.Context, req *model.VoyageCreateRequest, dispatcherID string) (*model.Voyage, error) {
	if req.DepartureTime.After(req.ReturnTime) {
		return nil, errors.New("departure time must be before return time")
	}

	if req.DepartureTime.Before(time.Now()) {
		return nil, errors.New("departure time must be in the future")
	}

	ship, err := s.voyageRepo.GetShip(ctx, req.ShipID)
	if err != nil {
		return nil, errors.New("ship not found")
	}
	if ship.Status != model.ShipStatusAvailable {
		return nil, errors.New("ship is not available")
	}

	conflicts, err := s.CheckConflicts(ctx, "", req.ShipID, req.Passengers, req.DepartureTime, req.ReturnTime)
	if err != nil {
		return nil, err
	}
	if len(conflicts) > 0 {
		return nil, &ConflictError{Conflicts: conflicts}
	}

	voyage := &model.Voyage{
		ShipID:       req.ShipID,
		WindFarmID:   req.WindFarmID,
		Title:        req.Title,
		Type:         req.Type,
		Status:       model.VoyageStatusDraft,
		DeparturePort: ship.HomePort,
		DepartureTime: req.DepartureTime,
		ReturnTime:   req.ReturnTime,
		EstimatedReturn: req.ReturnTime,
		TurbineList:  req.TurbineList,
		WorkOrderIDs: req.WorkOrderIDs,
		Passengers:   req.Passengers,
		DispatcherID: dispatcherID,
		Notes:        req.Notes,
	}

	feasible, _, err := s.weatherSvc.CheckVoyageFeasibility(ctx, voyage, ship)
	if err == nil {
		voyage.WeatherFeasible = feasible
	}

	if err := s.voyageRepo.CreateVoyage(ctx, voyage); err != nil {
		return nil, err
	}

	return voyage, nil
}

type ConflictError struct {
	Conflicts []model.VoyageConflict
}

func (e *ConflictError) Error() string {
	return "voyage conflicts detected"
}

func (s *Service) CheckConflicts(ctx context.Context, voyageID, shipID string, personnelIDs []string, start, end time.Time) ([]model.VoyageConflict, error) {
	startTime := time.Now()
	defer func() {
		log.Printf("[PERF] CheckConflicts ship=%s passengers=%d range=%s-%s elapsed=%v", shipID, len(personnelIDs), start.Format(time.RFC3339), end.Format(time.RFC3339), time.Since(startTime))
	}()

	var conflicts []model.VoyageConflict

	shipConflicts, err := s.voyageRepo.CheckShipConflict(ctx, shipID, start, end, voyageID)
	if err != nil {
		return nil, err
	}
	if len(shipConflicts) > 0 {
		for _, sc := range shipConflicts {
			conflicts = append(conflicts, model.VoyageConflict{
				Type:        "ship_conflict",
				Description: "船舶在 " + sc.DepartureTime.Format("2006-01-02 15:04") + " 至 " + sc.ReturnTime.Format("2006-01-02 15:04") + " 已有航次安排",
			})
		}

		suggestedStart, suggestedEnd := s.findNextAvailableSlot(ctx, shipID, personnelIDs, start, end)
		if !suggestedStart.IsZero() {
			conflicts = append(conflicts, model.VoyageConflict{
				Type:           "suggested_slot",
				Description:    "推荐替代时段",
				SuggestedStart: suggestedStart,
				SuggestedEnd:   suggestedEnd,
			})
		}
	}

	if len(personnelIDs) > 0 {
		personConflicts, err := s.voyageRepo.CheckPersonnelConflict(ctx, personnelIDs, start, end, voyageID)
		if err != nil {
			return nil, err
		}
		for pid, voyages := range personConflicts {
			for _, v := range voyages {
				conflicts = append(conflicts, model.VoyageConflict{
					Type:        "personnel_conflict",
					Description: "人员 " + pid + " 在 " + v.DepartureTime.Format("2006-01-02 15:04") + " 已有航次安排",
				})
			}
		}
	}

	maintenanceConflicts, err := s.checkShipMaintenanceConflict(ctx, shipID, start, end)
	if err != nil {
		return nil, err
	}
	if len(maintenanceConflicts) > 0 {
		conflicts = append(conflicts, maintenanceConflicts...)
	}

	return conflicts, nil
}

func (s *Service) checkShipMaintenanceConflict(ctx context.Context, shipID string, start, end time.Time) ([]model.VoyageConflict, error) {
	ship, err := s.voyageRepo.GetShip(ctx, shipID)
	if err != nil {
		return nil, err
	}

	var conflicts []model.VoyageConflict
	if !ship.NextMaintenanceDate.IsZero() {
		maintStart := ship.NextMaintenanceDate
		maintEnd := maintStart.Add(24 * time.Hour)

		if start.Before(maintEnd) && end.After(maintStart) {
			conflicts = append(conflicts, model.VoyageConflict{
				Type:        "maintenance_conflict",
				Description: "船舶计划维保时间冲突: " + maintStart.Format("2006-01-02"),
			})
		}
	}

	return conflicts, nil
}

func (s *Service) findNextAvailableSlot(ctx context.Context, shipID string, personnelIDs []string, preferredStart, preferredEnd time.Time) (time.Time, time.Time) {
	duration := preferredEnd.Sub(preferredStart)

	for i := 0; i < 30; i++ {
		candidateStart := preferredStart.Add(time.Duration(i+1) * 24 * time.Hour)
		candidateEnd := candidateStart.Add(duration)

		shipConflicts, err := s.voyageRepo.CheckShipConflict(ctx, shipID, candidateStart, candidateEnd, "")
		if err != nil || len(shipConflicts) > 0 {
			continue
		}

		if len(personnelIDs) > 0 {
			personConflicts, err := s.voyageRepo.CheckPersonnelConflict(ctx, personnelIDs, candidateStart, candidateEnd, "")
			if err != nil || len(personConflicts) > 0 {
				continue
			}
		}

		return candidateStart, candidateEnd
	}

	return time.Time{}, time.Time{}
}

func (s *Service) GetVoyage(ctx context.Context, id string) (*model.Voyage, error) {
	return s.voyageRepo.GetVoyage(ctx, id)
}

func (s *Service) ListVoyages(ctx context.Context, filter bson.M, page, pageSize int) ([]model.Voyage, int64, error) {
	return s.voyageRepo.ListVoyages(ctx, filter, page, pageSize)
}

func (s *Service) ApproveVoyage(ctx context.Context, voyageID, safetyOfficerID string) (*model.Voyage, error) {
	voyage, err := s.voyageRepo.GetVoyage(ctx, voyageID)
	if err != nil {
		return nil, err
	}

	if voyage.Status != model.VoyageStatusDraft {
		return nil, errors.New("only draft voyages can be approved")
	}

	ship, err := s.voyageRepo.GetShip(ctx, voyage.ShipID)
	if err != nil {
		return nil, err
	}

	feasible, _, err := s.weatherSvc.CheckVoyageFeasibility(ctx, voyage, ship)
	if err != nil {
		return nil, err
	}
	if !feasible {
		return nil, errors.New("weather conditions not feasible for this voyage")
	}

	if err := s.verifyPersonnelCertificates(ctx, voyage.Passengers); err != nil {
		return nil, err
	}

	voyage.Status = model.VoyageStatusApproved
	voyage.SafetyOfficerID = safetyOfficerID
	voyage.WeatherFeasible = true

	if err := s.voyageRepo.UpdateVoyage(ctx, voyage); err != nil {
		return nil, err
	}

	return voyage, nil
}

func (s *Service) verifyPersonnelCertificates(ctx context.Context, personnelIDs []string) error {
	for _, pid := range personnelIDs {
		p, err := s.personnelRepo.GetByID(ctx, pid)
		if err != nil {
			return errors.New("personnel not found: " + pid)
		}

		hasValidCert := false
		for _, cert := range p.Certificates {
			if cert.Type == model.CertSeafarers && cert.Status == "valid" && cert.ExpiryDate.After(time.Now()) {
				hasValidCert = true
				break
			}
		}

		if !hasValidCert {
			return errors.New("personnel " + p.Name + " does not have valid seafarer certificate")
		}
	}
	return nil
}

func (s *Service) StartVoyage(ctx context.Context, voyageID string) error {
	voyage, err := s.voyageRepo.GetVoyage(ctx, voyageID)
	if err != nil {
		return err
	}

	if voyage.Status != model.VoyageStatusApproved {
		return errors.New("only approved voyages can start")
	}

	now := time.Now()
	voyage.Status = model.VoyageStatusSailing
	voyage.ActualDeparture = &now

	if err := s.voyageRepo.UpdateVoyage(ctx, voyage); err != nil {
		return err
	}

	if err := s.personnelRepo.UpdateVoyage(ctx, voyage.Passengers, voyage.ID.Hex()); err != nil {
		return err
	}

	ship, _ := s.voyageRepo.GetShip(ctx, voyage.ShipID)
	if ship != nil {
		ship.Status = model.ShipStatusSailing
		_ = s.voyageRepo.UpdateShip(ctx, ship)
	}

	return nil
}

func (s *Service) CompleteVoyage(ctx context.Context, voyageID string) error {
	voyage, err := s.voyageRepo.GetVoyage(ctx, voyageID)
	if err != nil {
		return err
	}

	if voyage.Status != model.VoyageStatusSailing {
		return errors.New("only sailing voyages can be completed")
	}

	now := time.Now()
	voyage.Status = model.VoyageStatusCompleted
	voyage.ActualReturn = &now

	if err := s.voyageRepo.UpdateVoyage(ctx, voyage); err != nil {
		return err
	}

	if err := s.personnelRepo.UpdateVoyage(ctx, voyage.Passengers, ""); err != nil {
		return err
	}

	ship, _ := s.voyageRepo.GetShip(ctx, voyage.ShipID)
	if ship != nil {
		ship.Status = model.ShipStatusAvailable
		_ = s.voyageRepo.UpdateShip(ctx, ship)
	}

	return nil
}

func (s *Service) CancelVoyage(ctx context.Context, voyageID string, reason string) error {
	voyage, err := s.voyageRepo.GetVoyage(ctx, voyageID)
	if err != nil {
		return err
	}

	if voyage.Status == model.VoyageStatusCompleted || voyage.Status == model.VoyageStatusCancelled {
		return errors.New("voyage cannot be cancelled")
	}

	voyage.Status = model.VoyageStatusCancelled
	voyage.Notes = voyage.Notes + " | 取消原因: " + reason

	if err := s.voyageRepo.UpdateVoyage(ctx, voyage); err != nil {
		return err
	}

	if voyage.Status == model.VoyageStatusSailing {
		_ = s.personnelRepo.UpdateVoyage(ctx, voyage.Passengers, "")
	}

	return nil
}

func (s *Service) CreateShip(ctx context.Context, ship *model.Ship) (*model.Ship, error) {
	err := s.voyageRepo.CreateShip(ctx, ship)
	return ship, err
}

func (s *Service) GetShip(ctx context.Context, id string) (*model.Ship, error) {
	return s.voyageRepo.GetShip(ctx, id)
}

func (s *Service) ListShips(ctx context.Context, filter bson.M) ([]model.Ship, error) {
	return s.voyageRepo.ListShips(ctx, filter)
}

func (s *Service) UpdateShip(ctx context.Context, ship *model.Ship) error {
	return s.voyageRepo.UpdateShip(ctx, ship)
}

func (s *Service) GetActiveVoyagesCount(ctx context.Context) (int, error) {
	filter := bson.M{
		"status": bson.M{
			"$in": []model.VoyageStatus{
				model.VoyageStatusSailing,
				model.VoyageStatusApproved,
			},
		},
	}
	_, total, err := s.voyageRepo.ListVoyages(ctx, filter, 1, 1)
	return int(total), err
}
