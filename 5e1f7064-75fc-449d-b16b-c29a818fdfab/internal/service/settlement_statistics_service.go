package service

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"lab-management/internal/model"
	"lab-management/internal/dto"
	appErr "lab-management/internal/pkg/errors"
	"lab-management/internal/pkg/utils"
	"lab-management/internal/repository"
)

type SettlementService struct {
	db              *gorm.DB
	settlementRepo  *repository.SettlementRepository
	detailRepo      *repository.SettlementDetailRepository
	sampleRepo      *repository.SampleRepository
	instRepo        *repository.InstitutionRepository
}

func NewSettlementService(
	db *gorm.DB,
	settlementRepo *repository.SettlementRepository,
	detailRepo *repository.SettlementDetailRepository,
	sampleRepo *repository.SampleRepository,
	instRepo *repository.InstitutionRepository,
) *SettlementService {
	return &SettlementService{
		db:             db,
		settlementRepo: settlementRepo,
		detailRepo:     detailRepo,
		sampleRepo:     sampleRepo,
		instRepo:       instRepo,
	}
}

type settlementSampleQuery struct {
	InstitutionID uint
	Start         time.Time
	End           time.Time
}

func (s *SettlementService) Create(req *dto.CreateSettlementRequest) (uint, *appErr.ErrorCode) {
	inst, exists, err := s.instRepo.FindByID(req.InstitutionID)
	if err != nil {
		return 0, appErr.ErrDatabaseError
	}
	if !exists {
		return 0, appErr.ErrInstitutionNotFound
	}

	existing, exist, err := s.settlementRepo.FindByMonth(req.InstitutionID, req.SettleYear, req.SettleMonth)
	if err != nil {
		return 0, appErr.ErrDatabaseError
	}
	if exist {
		return existing.ID, appErr.ErrSettlementExist
	}

	start, end := utils.GetMonthRange(req.SettleYear, req.SettleMonth)

	q := &repository.SampleListQuery{
		InstitutionID: &req.InstitutionID,
		StartTime:     &start,
		EndTime:       &end,
	}

	const batchSize = 5000
	var allSamples []model.Sample
	var total int64
	page := 1
	for {
		list, t, err := s.sampleRepo.List(q, page, batchSize)
		if err != nil {
			return 0, appErr.ErrDatabaseError
		}
		if page == 1 {
			total = t
		}
		allSamples = append(allSamples, list...)
		if len(list) < batchSize || len(allSamples) >= int(total) {
			break
		}
		page++
	}

	var settlementID uint
	err = s.db.Transaction(func(tx *gorm.DB) error {
		settlementNo := utils.GenerateSettlementNo()
		var totalCount int
		var totalAmount, discountAmount, finalAmount float64

		details := make([]model.SettlementDetail, 0)
		for _, sample := range allSamples {
			if sample.Status == model.SampleStatusCancelled {
				continue
			}
			if sample.Status != model.SampleStatusCompleted {
				continue
			}
			discount := sample.TotalPrice - sample.FinalPrice
			if discount < 0 {
				discount = 0
			}
			arrivalTime := sample.ArrivalTime
			details = append(details, model.SettlementDetail{
				Barcode:     sample.Barcode,
				SampleID:    sample.ID,
				PatientName: sample.PatientName,
				ItemCount:   0,
				TotalAmount: utils.FormatDecimal(sample.TotalPrice, 2),
				Discount:    utils.FormatDecimal(discount, 2),
				FinalAmount: utils.FormatDecimal(sample.FinalPrice, 2),
				CompletedAt: arrivalTime,
			})
			totalCount++
			totalAmount += sample.TotalPrice
			discountAmount += discount
			finalAmount += sample.FinalPrice
		}

		if inst.MinPrice > 0 && finalAmount < inst.MinPrice && totalCount > 0 {
			adjustDiff := inst.MinPrice - finalAmount
			discountAmount -= adjustDiff
			finalAmount = inst.MinPrice
		}

		settlement := &model.Settlement{
			SettlementNo:   settlementNo,
			InstitutionID:  req.InstitutionID,
			SettleYear:     req.SettleYear,
			SettleMonth:    req.SettleMonth,
			TotalCount:     totalCount,
			TotalAmount:    utils.FormatDecimal(totalAmount, 2),
			DiscountAmount: utils.FormatDecimal(discountAmount, 2),
			FinalAmount:    utils.FormatDecimal(finalAmount, 2),
			Status:         model.SettlementStatusDraft,
		}
		if err := tx.Create(settlement).Error; err != nil {
			return err
		}
		settlementID = settlement.ID

		for i := range details {
			details[i].SettlementID = settlementID
		}
		if len(details) > 0 {
			batch := 500
			for i := 0; i < len(details); i += batch {
				endIdx := i + batch
				if endIdx > len(details) {
					endIdx = len(details)
				}
				if err := s.detailRepo.CreateBatchWithTx(tx, details[i:endIdx]); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return 0, appErr.ErrDatabaseError.WithMessage(err.Error())
	}
	return settlementID, nil
}

func (s *SettlementService) Confirm(id uint, req *dto.ConfirmSettlementRequest, confirmerID uint) *appErr.ErrorCode {
	settlement, exists, err := s.settlementRepo.FindByID(id)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrSettlementNotFound
	}
	if settlement.Status == model.SettlementStatusConfirmed || settlement.Status == model.SettlementStatusPaid {
		return appErr.ErrSettlementConfirmed
	}

	now := time.Now()
	if err := s.settlementRepo.Confirm(id, confirmerID, now, req.Remarks); err != nil {
		return appErr.ErrDatabaseError
	}
	return nil
}

func (s *SettlementService) GetByID(id uint) (*model.Settlement, *appErr.ErrorCode) {
	settlement, exists, err := s.settlementRepo.FindByID(id)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrSettlementNotFound
	}
	return settlement, nil
}

func (s *SettlementService) GetByMonth(instID uint, year, month int) (*model.Settlement, *appErr.ErrorCode) {
	settlement, exists, err := s.settlementRepo.FindByMonth(instID, year, month)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrSettlementNotFound
	}
	return settlement, nil
}

func (s *SettlementService) List(q *dto.SettlementQuery, currentInstID uint) ([]model.Settlement, int64, *appErr.ErrorCode) {
	instID := q.InstitutionID
	if currentInstID > 0 && instID == nil {
		instID = &currentInstID
	}
	list, total, err := s.settlementRepo.List(instID, q.SettleYear, q.SettleMonth, q.Status, q.Page, q.PageSize)
	if err != nil {
		return nil, 0, appErr.ErrDatabaseError
	}
	return list, total, nil
}

func (s *SettlementService) GetDetails(settlementID uint) ([]model.SettlementDetail, *appErr.ErrorCode) {
	details, err := s.detailRepo.ListBySettlementID(settlementID)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	return details, nil
}

type StatisticsService struct {
	repo *repository.StatisticsRepository
}

func NewStatisticsService(repo *repository.StatisticsRepository) *StatisticsService {
	return &StatisticsService{repo: repo}
}

type StatsResult struct {
	Dimension string      `json:"dimension"`
	Data      interface{} `json:"data"`
}

func (s *StatisticsService) Query(q *dto.StatisticsQuery, currentInstID uint) (*StatsResult, *appErr.ErrorCode) {
	start := q.StartTime
	end := q.EndTime.AddDate(0, 0, 1).Add(-time.Nanosecond)
	if start.After(end) {
		return nil, appErr.ErrInvalidParams.WithMessage("开始时间不能晚于结束时间")
	}
	instID := q.InstitutionID
	if currentInstID > 0 && instID == nil {
		instID = &currentInstID
	}

	var result StatsResult
	result.Dimension = q.Dimension
	var err error

	switch q.Dimension {
	case "institution":
		result.Data, err = s.repo.InstitutionStats(start, end, instID)
	case "category":
		result.Data, err = s.repo.CategoryStats(start, end, instID)
	case "status":
		result.Data, err = s.repo.StatusStats(start, end, instID)
	case "item":
		result.Data, err = s.repo.ItemStats(start, end, instID, 50)
	case "urgency":
		result.Data, err = s.repo.UrgencyStats(start, end, instID)
	case "tat":
		result.Data, err = s.repo.TATStats(start, end, instID)
	case "tat_institution":
		result.Data, err = s.repo.TATByInstitution(start, end, instID)
	default:
		return nil, appErr.ErrInvalidParams.WithMessage(fmt.Sprintf("不支持的维度: %s", q.Dimension))
	}

	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	return &result, nil
}
