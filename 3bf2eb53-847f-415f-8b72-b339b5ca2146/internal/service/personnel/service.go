package personnel

import (
	"context"
	"errors"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	personnelRepo *repository.PersonnelRepository
	alertRepo     *repository.AlertRepository
	voyageRepo    *repository.VoyageRepository
}

func NewService(personnelRepo *repository.PersonnelRepository, alertRepo *repository.AlertRepository, voyageRepo *repository.VoyageRepository) *Service {
	return &Service{
		personnelRepo: personnelRepo,
		alertRepo:     alertRepo,
		voyageRepo:    voyageRepo,
	}
}

func (s *Service) CreatePersonnel(ctx context.Context, p *model.Personnel) (*model.Personnel, error) {
	err := s.personnelRepo.Create(ctx, p)
	return p, err
}

func (s *Service) GetPersonnel(ctx context.Context, id string) (*model.Personnel, error) {
	return s.personnelRepo.GetByID(ctx, id)
}

func (s *Service) ListPersonnel(ctx context.Context, req *model.PersonnelListRequest) ([]model.Personnel, int64, error) {
	filter := bson.M{}

	if req.Department != "" {
		filter["department"] = req.Department
	}
	if req.Status != "" {
		filter["status"] = req.Status
	}
	if req.CertType != "" {
		filter["certificates.type"] = req.CertType
	}
	if req.ExpiringSoon {
		threshold := time.Now().AddDate(0, 0, 30)
		filter["certificates"] = bson.M{
			"$elemMatch": bson.M{
				"expiry_date": bson.M{
					"$lte": threshold,
					"$gte": time.Now(),
				},
				"status": "valid",
			},
		}
	}

	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	return s.personnelRepo.List(ctx, filter, page, pageSize)
}

func (s *Service) UpdatePersonnel(ctx context.Context, p *model.Personnel) error {
	return s.personnelRepo.Update(ctx, p)
}

func (s *Service) AddCertificate(ctx context.Context, personnelID string, cert model.Certificate) error {
	p, err := s.personnelRepo.GetByID(ctx, personnelID)
	if err != nil {
		return err
	}

	cert.ID = generateCertID()
	cert.Status = "valid"
	p.Certificates = append(p.Certificates, cert)

	return s.personnelRepo.Update(ctx, p)
}

func (s *Service) UpdateCertificate(ctx context.Context, personnelID, certID string, cert model.Certificate) error {
	p, err := s.personnelRepo.GetByID(ctx, personnelID)
	if err != nil {
		return err
	}

	found := false
	for i, c := range p.Certificates {
		if c.ID == certID {
			cert.ID = certID
			p.Certificates[i] = cert
			found = true
			break
		}
	}

	if !found {
		return errors.New("certificate not found")
	}

	return s.personnelRepo.Update(ctx, p)
}

func (s *Service) CheckExpiringCertificates(ctx context.Context, days int) ([]model.Personnel, error) {
	personnelList, err := s.personnelRepo.GetExpiringCertificates(ctx, days)
	if err != nil {
		return nil, err
	}

	for _, p := range personnelList {
		for _, cert := range p.Certificates {
			if cert.Status != "valid" {
				continue
			}
			daysRemaining := int(time.Until(cert.ExpiryDate).Hours() / 24)
			if daysRemaining <= days && daysRemaining > 0 {
				alert := &model.CertificateAlert{
					PersonnelID:   p.ID.Hex(),
					PersonnelName: p.Name,
					CertificateID: cert.ID,
					CertType:      cert.Type,
					ExpiryDate:    cert.ExpiryDate,
					DaysRemaining: daysRemaining,
					Status:        "active",
				}
				_ = s.personnelRepo.CreateCertAlert(ctx, alert)

				generalAlert := &model.Alert{
					Type:       model.AlertTypeCertificate,
					Severity:   model.SeverityWarning,
					Title:      "证书即将到期",
					Description: p.Name + " 的 " + string(cert.Type) + " 证书将在 " + strconv.Itoa(daysRemaining) + " 天后到期",
					PersonnelID: p.ID.Hex(),
					Source:     "cert_monitor",
				}
				_ = s.alertRepo.Create(ctx, generalAlert)
			}
		}
	}

	return personnelList, nil
}

func (s *Service) CreateEvacuation(ctx context.Context, req *model.EvacuationCreateRequest, triggeredBy string) (*model.EvacuationOrder, error) {
	var personnelList []model.EvacuationPerson

	if len(req.PersonnelIDs) > 0 {
		for _, pid := range req.PersonnelIDs {
			p, err := s.personnelRepo.GetByID(ctx, pid)
			if err != nil {
				continue
			}
			personnelList = append(personnelList, model.EvacuationPerson{
				PersonnelID: pid,
				Name:        p.Name,
				VoyageID:    p.CurrentVoyageID,
				Status:      "pending",
			})
		}
	} else if len(req.VoyageIDs) > 0 {
		for _, vid := range req.VoyageIDs {
			v, err := s.voyageRepo.GetVoyage(ctx, vid)
			if err != nil {
				continue
			}
			for _, pid := range v.Passengers {
				p, _ := s.personnelRepo.GetByID(ctx, pid)
				name := ""
				if p != nil {
					name = p.Name
				}
				personnelList = append(personnelList, model.EvacuationPerson{
					PersonnelID: pid,
					Name:        name,
					VoyageID:    vid,
					ShipID:      v.ShipID,
					Status:      "pending",
				})
			}
		}
	} else {
		filter := bson.M{
			"status":              model.PersonnelStatusOnDuty,
			"current_voyage_id": bson.M{"$ne": ""},
		}
		personnelAtSea, _, err := s.personnelRepo.List(ctx, filter, 1, 1000)
		if err != nil {
			return nil, err
		}
		for _, p := range personnelAtSea {
			personnelList = append(personnelList, model.EvacuationPerson{
				PersonnelID: p.ID.Hex(),
				Name:        p.Name,
				VoyageID:    p.CurrentVoyageID,
				Status:      "pending",
			})
		}
	}

	evac := &model.EvacuationOrder{
		Type:           req.Type,
		Reason:         req.Reason,
		WindFarmID:     req.WindFarmID,
		TriggeredBy:    triggeredBy,
		Status:         "active",
		AffectedVoyages: req.VoyageIDs,
		PersonnelList:  personnelList,
	}

	if err := s.personnelRepo.CreateEvacuation(ctx, evac); err != nil {
		return nil, err
	}

	alert := &model.Alert{
		Type:       model.AlertTypeSafety,
		Severity:   model.SeverityCritical,
		Title:      "人员撤离指令",
		Description: req.Reason,
		WindFarmID: req.WindFarmID,
		Source:     "evacuation",
	}
	_ = s.alertRepo.Create(ctx, alert)

	return evac, nil
}

func (s *Service) GetEvacuation(ctx context.Context, id string) (*model.EvacuationOrder, error) {
	return s.personnelRepo.GetEvacuation(ctx, id)
}

func (s *Service) ListEvacuations(ctx context.Context, windFarmID string, page, pageSize int) ([]model.EvacuationOrder, int64, error) {
	filter := bson.M{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}
	return s.personnelRepo.ListEvacuations(ctx, filter, page, pageSize)
}

func (s *Service) AcknowledgeEvacuation(ctx context.Context, evacID, personnelID string) error {
	now := time.Now()
	return s.personnelRepo.UpdateEvacuationPersonStatus(ctx, evacID, personnelID, "acknowledged", &now, nil, "")
}

func (s *Service) MarkArrived(ctx context.Context, evacID, personnelID, notes string) error {
	now := time.Now()
	return s.personnelRepo.UpdateEvacuationPersonStatus(ctx, evacID, personnelID, "arrived", nil, &now, notes)
}

func (s *Service) CompleteEvacuation(ctx context.Context, id string) error {
	evac, err := s.personnelRepo.GetEvacuation(ctx, id)
	if err != nil {
		return err
	}

	for _, p := range evac.PersonnelList {
		if p.Status != "arrived" {
			return errors.New("not all personnel have arrived at port")
		}
	}

	return s.personnelRepo.CompleteEvacuation(ctx, id)
}

func (s *Service) GetUnacknowledgedPersonnel(ctx context.Context, evacID string) []model.EvacuationPerson {
	evac, err := s.personnelRepo.GetEvacuation(ctx, evacID)
	if err != nil {
		return nil
	}

	var unack []model.EvacuationPerson
	for _, p := range evac.PersonnelList {
		if p.Status == "pending" {
			unack = append(unack, p)
		}
	}
	return unack
}

func (s *Service) ListCertAlerts(ctx context.Context, status string, page, pageSize int) ([]model.CertificateAlert, int64, error) {
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}
	return s.personnelRepo.ListCertAlerts(ctx, filter, page, pageSize)
}

func generateCertID() string {
	return "CERT-" + time.Now().Format("20060102150405")
}

func (s *Service) GetPersonnelAtSeaCount(ctx context.Context) (int, error) {
	filter := bson.M{
		"status":             model.PersonnelStatusOnDuty,
		"current_voyage_id": bson.M{"$ne": ""},
	}
	_, total, err := s.personnelRepo.List(ctx, filter, 1, 1)
	return int(total), err
}

func (s *Service) CheckUnacknowledgedEvacuations(ctx context.Context) (int, error) {
	filter := bson.M{
		"status": "active",
	}

	evacs, _, err := s.personnelRepo.ListEvacuations(ctx, filter, 1, 1000)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, evac := range evacs {
		for _, p := range evac.PersonnelList {
			if p.Status == "pending" {
				alert := &model.Alert{
					Type:       model.AlertTypeSafety,
					Severity:   model.SeverityCritical,
					Title:      "撤离未确认持续告警",
					Description: "撤离人员 " + p.Name + " 未确认撤离指令，撤离原因: " + evac.Reason,
					PersonnelID: p.PersonnelID,
					WindFarmID: evac.WindFarmID,
					Source:     "evacuation_monitor",
				}
				if err := s.alertRepo.Create(ctx, alert); err == nil {
					count++
				}
			}
		}
	}

	return count, nil
}
