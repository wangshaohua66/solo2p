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

type SampleService struct {
	db                  *gorm.DB
	sampleRepo          *repository.SampleRepository
	sampleItemRepo      *repository.SampleItemRepository
	statusLogRepo       *repository.SampleStatusLogRepository
	counterRepo         *repository.DailyCounterRepository
	instRepo            *repository.InstitutionRepository
	itemRepo            *repository.TestItemRepository
	instPriceRepo       *repository.InstitutionPriceRepository
	packageRepo         *repository.TestItemPackageRepository
	userRepo            *repository.UserRepository
}

func NewSampleService(
	db *gorm.DB,
	sampleRepo *repository.SampleRepository,
	sampleItemRepo *repository.SampleItemRepository,
	statusLogRepo *repository.SampleStatusLogRepository,
	counterRepo *repository.DailyCounterRepository,
	instRepo *repository.InstitutionRepository,
	itemRepo *repository.TestItemRepository,
	instPriceRepo *repository.InstitutionPriceRepository,
	packageRepo *repository.TestItemPackageRepository,
	userRepo *repository.UserRepository,
) *SampleService {
	return &SampleService{
		db:                db,
		sampleRepo:        sampleRepo,
		sampleItemRepo:    sampleItemRepo,
		statusLogRepo:     statusLogRepo,
		counterRepo:       counterRepo,
		instRepo:          instRepo,
		itemRepo:          itemRepo,
		instPriceRepo:     instPriceRepo,
		packageRepo:       packageRepo,
		userRepo:          userRepo,
	}
}

var validSpecimenTypes = map[string]bool{
	"BLOOD": true, "SERUM": true, "PLASMA": true, "URINE": true,
	"STOOL": true, "SPUTUM": true, "CSF": true, "SWAB": true,
	"TISSUE": true, "BONE_MARROW": true, "OTHER": true,
}

var statusTransitionMap = map[string][]string{
	model.SampleStatusCollected: {model.SampleStatusInTransit, model.SampleStatusCancelled},
	model.SampleStatusInTransit: {model.SampleStatusReceived, model.SampleStatusCancelled},
	model.SampleStatusReceived:  {model.SampleStatusTesting, model.SampleStatusCancelled},
	model.SampleStatusTesting:   {model.SampleStatusReviewing},
	model.SampleStatusReviewing: {model.SampleStatusCompleted, model.SampleStatusTesting},
}

func isValidStatusTransition(from, to string) bool {
	if from == model.SampleStatusCompleted || from == model.SampleStatusCancelled {
		return false
	}
	allowed, ok := statusTransitionMap[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func (s *SampleService) validateSampleItems(items []dto.SampleItemInput, instID uint) ([]model.SampleItem, float64, float64, *appErr.ErrorCode) {
	itemIDs := make([]uint, 0, len(items))
	for _, it := range items {
		itemIDs = append(itemIDs, it.TestItemID)
	}
	dbItems, err := s.itemRepo.FindByIDs(itemIDs)
	if err != nil {
		return nil, 0, 0, appErr.ErrDatabaseError
	}
	if len(dbItems) != len(itemIDs) {
		return nil, 0, 0, appErr.ErrTestItemNotFound
	}

	itemMap := make(map[uint]model.TestItem)
	for _, di := range dbItems {
		if di.Status != 1 {
			return nil, 0, 0, appErr.ErrTestItemDisabled.WithMessage(fmt.Sprintf("项目%s已停用", di.Code))
		}
		itemMap[di.ID] = di
	}

	inst, exists, err := s.instRepo.FindByID(instID)
	if err != nil {
		return nil, 0, 0, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, 0, 0, appErr.ErrInstitutionNotFound
	}
	if inst.Status != 1 {
		return nil, 0, 0, appErr.ErrInstitutionDisabled
	}

	sampleItems := make([]model.SampleItem, 0, len(items))
	var totalPrice float64
	var finalPrice float64

	for _, input := range items {
		ti := itemMap[input.TestItemID]
		unitPrice := ti.Price
		customPrice, hasCustom, err := s.instPriceRepo.GetPrice(instID, ti.ID)
		if err != nil {
			return nil, 0, 0, appErr.ErrDatabaseError
		}
		if hasCustom {
			unitPrice = customPrice.CustomPrice
			if customPrice.Discount != nil {
				unitPrice = unitPrice * (*customPrice.Discount)
			}
		}
		if input.UnitPrice > 0 {
			unitPrice = input.UnitPrice
		}
		itemFinal := unitPrice * inst.Discount

		sampleItems = append(sampleItems, model.SampleItem{
			TestItemID: ti.ID,
			PackageID:  input.PackageID,
			UnitPrice:  utils.FormatDecimal(unitPrice, 2),
			FinalPrice: utils.FormatDecimal(itemFinal, 2),
		})
		totalPrice += unitPrice
		finalPrice += itemFinal
	}

	if inst.MinPrice > 0 && finalPrice < inst.MinPrice {
		finalPrice = inst.MinPrice
	}

	return sampleItems, utils.FormatDecimal(totalPrice, 2), utils.FormatDecimal(finalPrice, 2), nil
}

func (s *SampleService) Create(req *dto.CreateSampleRequest, createdBy uint) (string, *appErr.ErrorCode) {
	if !utils.IsValidCollectTime(req.CollectTime) {
		return "", appErr.ErrSampleTimeInvalid
	}
	if !validSpecimenTypes[req.SpecimenType] {
		return "", appErr.ErrSampleTypeInvalid
	}

	inst, exists, err := s.instRepo.FindByID(req.InstitutionID)
	if err != nil {
		return "", appErr.ErrDatabaseError
	}
	if !exists {
		return "", appErr.ErrInstitutionNotFound
	}
	if inst.Status != 1 {
		return "", appErr.ErrInstitutionDisabled
	}

	sampleItems, totalPrice, finalPrice, ec := s.validateSampleItems(req.Items, req.InstitutionID)
	if ec != nil {
		return "", ec
	}

	date := time.Now().Format("20060102")
	seq, err := s.counterRepo.GetNextSeq(inst.Code, date)
	if err != nil {
		return "", appErr.ErrDatabaseError
	}
	barcode := utils.GenerateBarcode(inst.Code, seq)

	user, _, _ := s.userRepo.FindByID(createdBy)
	operatorName := ""
	if user != nil {
		operatorName = user.RealName
		if operatorName == "" {
			operatorName = user.Username
		}
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		sample := &model.Sample{
			Barcode:       barcode,
			InstitutionID: req.InstitutionID,
			PatientID:     req.PatientID,
			PatientName:   req.PatientName,
			Gender:        req.Gender,
			Age:           req.Age,
			SpecimenType:  req.SpecimenType,
			CollectTime:   req.CollectTime,
			Status:        model.SampleStatusCollected,
			TotalPrice:    totalPrice,
			FinalPrice:    finalPrice,
			Remark:        req.Remark,
			CreatedBy:     createdBy,
		}
		if err := s.sampleRepo.CreateWithTx(tx, sample); err != nil {
			return err
		}

		for i := range sampleItems {
			sampleItems[i].SampleID = sample.ID
		}
		if err := s.sampleItemRepo.CreateBatchWithTx(tx, sampleItems); err != nil {
			return err
		}

		log := &model.SampleStatusLog{
			SampleID:     sample.ID,
			FromStatus:   "",
			ToStatus:     model.SampleStatusCollected,
			OperatorID:   createdBy,
			OperatorName: operatorName,
			Remark:       "样本登记",
			CreatedAt:    time.Now(),
		}
		return s.statusLogRepo.CreateWithTx(tx, log)
	})
	if err != nil {
		return "", appErr.ErrDatabaseError.WithMessage(err.Error())
	}

	return barcode, nil
}

func (s *SampleService) BatchCreate(req *dto.BatchCreateSampleRequest, createdBy uint) ([]string, *appErr.ErrorCode) {
	barcodes := make([]string, 0, len(req.Samples))
	for i := range req.Samples {
		barcode, ec := s.Create(&req.Samples[i], createdBy)
		if ec != nil {
			return barcodes, ec.WithMessage(fmt.Sprintf("第%d条: %s", i+1, ec.Message))
		}
		barcodes = append(barcodes, barcode)
	}
	return barcodes, nil
}

func (s *SampleService) UpdateStatus(id uint, status string, remark string, operatorID uint) *appErr.ErrorCode {
	sample, exists, err := s.sampleRepo.FindByID(id)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrSampleNotFound
	}
	if !isValidStatusTransition(sample.Status, status) {
		return appErr.ErrSampleStatusInvalid.WithMessage(
			fmt.Sprintf("不能从%s变更到%s", sample.Status, status))
	}

	user, _, _ := s.userRepo.FindByID(operatorID)
	operatorName := ""
	if user != nil {
		operatorName = user.RealName
		if operatorName == "" {
			operatorName = user.Username
		}
	}

	var arrivalTime *time.Time
	var doctorID *uint

	if status == model.SampleStatusReceived {
		now := time.Now()
		arrivalTime = &now
	}
	if status == model.SampleStatusTesting && sample.DoctorID == nil {
		doctorID = &operatorID
	}
	if status == model.SampleStatusReviewing && sample.DoctorID == nil {
		doctorID = &operatorID
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.sampleRepo.UpdateStatus(id, status, arrivalTime, doctorID, nil, nil); err != nil {
			return err
		}
		log := &model.SampleStatusLog{
			SampleID:     id,
			FromStatus:   sample.Status,
			ToStatus:     status,
			OperatorID:   operatorID,
			OperatorName: operatorName,
			Remark:       remark,
			CreatedAt:    time.Now(),
		}
		return s.statusLogRepo.CreateWithTx(tx, log)
	})
	if err != nil {
		return appErr.ErrDatabaseError.WithMessage(err.Error())
	}
	return nil
}

func (s *SampleService) Cancel(id uint, reason string, operatorID uint) *appErr.ErrorCode {
	sample, exists, err := s.sampleRepo.FindByID(id)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrSampleNotFound
	}
	if sample.Status == model.SampleStatusCompleted || sample.Status == model.SampleStatusCancelled ||
		sample.Status == model.SampleStatusTesting || sample.Status == model.SampleStatusReviewing {
		return appErr.ErrSampleCannotCancel
	}

	user, _, _ := s.userRepo.FindByID(operatorID)
	operatorName := ""
	if user != nil {
		operatorName = user.RealName
		if operatorName == "" {
			operatorName = user.Username
		}
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.sampleRepo.Cancel(id, reason); err != nil {
			return err
		}
		log := &model.SampleStatusLog{
			SampleID:     id,
			FromStatus:   sample.Status,
			ToStatus:     model.SampleStatusCancelled,
			OperatorID:   operatorID,
			OperatorName: operatorName,
			Remark:       "取消原因: " + reason,
			CreatedAt:    time.Now(),
		}
		return s.statusLogRepo.CreateWithTx(tx, log)
	})
	if err != nil {
		return appErr.ErrDatabaseError
	}
	return nil
}

func (s *SampleService) GetByID(id uint) (*model.Sample, *appErr.ErrorCode) {
	sample, exists, err := s.sampleRepo.FindByID(id)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrSampleNotFound
	}
	return sample, nil
}

func (s *SampleService) GetByBarcode(barcode string) (*model.Sample, *appErr.ErrorCode) {
	sample, exists, err := s.sampleRepo.FindByBarcode(barcode)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrSampleNotFound
	}
	return sample, nil
}

func (s *SampleService) List(q *dto.SampleQuery, currentInstID uint) ([]model.Sample, int64, *appErr.ErrorCode) {
	query := &repository.SampleListQuery{
		Barcode:       q.Barcode,
		InstitutionID: q.InstitutionID,
		Status:        q.Status,
		PatientID:     q.PatientID,
		PatientName:   q.PatientName,
		IsCritical:    q.IsCritical,
		StartTime:     q.StartTime,
		EndTime:       q.EndTime,
	}
	if currentInstID > 0 && query.InstitutionID == nil {
		query.InstitutionID = &currentInstID
	}

	list, total, err := s.sampleRepo.List(query, q.Page, q.PageSize)
	if err != nil {
		return nil, 0, appErr.ErrDatabaseError
	}
	return list, total, nil
}

func (s *SampleService) GetStatusLogs(sampleID uint) ([]model.SampleStatusLog, *appErr.ErrorCode) {
	logs, err := s.statusLogRepo.ListBySampleID(sampleID)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	return logs, nil
}
